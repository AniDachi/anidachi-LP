// Run actual pre-task Web + transitive protocol code against post-migration SQL output.
// Usage: node apps/web/scripts/prime-navigation-legacy-replay.mjs <JSON artifact>
import { execFileSync } from "node:child_process";
import {
	mkdtempSync,
	mkdirSync,
	symlinkSync,
	readdirSync,
	writeFileSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	encoding: "utf8",
}).trim();
const base = "49f86b060c6d0c0f12cf978e9125fb2a1454e5d3";
const payload = JSON.parse(readFileSync(resolve(process.argv[2]), "utf8"));
const root = mkdtempSync(join(tmpdir(), "anidachi-prime-legacy-"));
try {
	const archive = execFileSync(
		"git",
		[
			"archive",
			base,
			"apps/web/lib",
			"apps/web/tsconfig.json",
			"apps/web/package.json",
			"packages/protocol/src",
			"packages/protocol/package.json",
		],
		{ cwd: repo, maxBuffer: 50 * 1024 * 1024 },
	);
	execFileSync("tar", ["-x", "-C", root], { input: archive });
	for (const dir of ["apps/web", "packages/protocol"]) {
		const dest = join(root, dir, "node_modules");
		mkdirSync(dest, { recursive: true });
		for (const entry of readdirSync(join(repo, dir, "node_modules"))) {
			if (entry === "@anidachi") continue;
			symlinkSync(join(repo, dir, "node_modules", entry), join(dest, entry));
		}
	}
	mkdirSync(join(root, "apps/web/node_modules/@anidachi"), { recursive: true });
	symlinkSync(
		join(root, "packages/protocol"),
		join(root, "apps/web/node_modules/@anidachi/protocol"),
	);
	writeFileSync(join(root, "apps/web/replay.json"), JSON.stringify(payload));
	writeFileSync(
		join(root, "apps/web/replay.ts"),
		`
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildWatchHistoryV3Response,parseResourceBoundedWatchHistoryPage,parseWatchHistoryTitleEpisodesPage} from './lib/anidachi-auth/watch-history-v3';
import {WatchProgressAckSchema,WatchHistoryEditorResponseSchema,WatchCatalogSnapshotInputSchema,WatchHistoryCatalogSeasonProjectionSchema} from '@anidachi/protocol';
const p=JSON.parse(readFileSync('./replay.json','utf8'));
// Negative controls prove that these are the old strict schemas/parser.
assert.equal(WatchCatalogSnapshotInputSchema.safeParse({...p.catalog.snapshot,seasons:p.catalog.snapshot.seasons.map((s:any)=>({...s,episodes:s.episodes.map((e:any)=>({...e,watchVariants:e.watchVariants.map((v:any)=>({...v,primeNavigation:{}}))}))}))}).success,false);
const build=(page:any)=>buildWatchHistoryV3Response({userId:p.owner,accountGeneration:1,progressRows:page.progressRows,sessions:[],limit:50,generatedAt:new Date()});
for(const page of p.pages){assert.ok(page.progressRows.length>0);parseResourceBoundedWatchHistoryPage(page);build(page);}
assert.throws(()=>build({...p.pages[2],progressRows:p.pages[2].progressRows.map((r:any)=>({...r,prime_navigation:null}))}));
parseWatchHistoryTitleEpisodesPage(p.episodes);build(p.episodes);build(p.browse);
WatchProgressAckSchema.parse(p.ack);
for(const ack of p.receipts)WatchProgressAckSchema.parse(ack);
WatchHistoryEditorResponseSchema.parse(p.editor);
WatchCatalogSnapshotInputSchema.parse(p.catalog.snapshot);
for(const season of p.catalog.projection.seasons)WatchHistoryCatalogSeasonProjectionSchema.parse(season);
console.log('PASS actual legacy Web/protocol: provider v1/v2/v3, episodes, browse, ack/replayed receipts, editor, catalog; strict negative controls pass. Same retained-schema payload parses before deploy and after rollback.');
`,
	);
	execFileSync(
		process.execPath,
		[
			"--import",
			join(repo, "apps/web/node_modules/tsx/dist/loader.mjs"),
			"replay.ts",
		],
		{ cwd: join(root, "apps/web"), stdio: "inherit" },
	);
} finally {
	rmSync(root, { recursive: true, force: true });
}
