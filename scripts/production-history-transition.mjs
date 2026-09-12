import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	proofPsqlArgs,
	requireDisposableTarget,
	withPsqlSessionTimeouts,
} from "../apps/web/supabase/contracts/watch_history_v3_disposable_target.mjs";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const operations = resolve(
	root,
	"apps/web/supabase/operations/production-history-20260912",
);
export const manifest = JSON.parse(
	readFileSync(resolve(operations, "manifest.json"), "utf8"),
);
const schema = "anidachi_transition_20260912";
const sha = (data) => createHash("sha256").update(data).digest("hex");
const quote = (text) => `'${text.replaceAll("'", "''")}'`;
const sqlFile = (name) => readFileSync(resolve(operations, name), "utf8");
export function verifyManifest(
	actual = readdirSync(resolve(root, "apps/web/supabase/migrations"))
		.filter((f) => f.endsWith(".sql"))
		.sort()
		.map((file) => ({
			file,
			version: file.split("_")[0],
			sha256: sha(
				readFileSync(resolve(root, "apps/web/supabase/migrations", file)),
			),
		})),
) {
	assert.deepEqual(
		actual,
		manifest.migrations,
		"Exact ordered 60-file manifest required; no automatic repinning",
	);
}
export function validateInventory(actual) {
	assert.deepEqual(
		actual,
		manifest.inventory,
		"Only the reviewed inert-v1 inventory is eligible; new inventory needs review",
	);
}
export function validateTarget(target) {
	assert.equal(
		target.project,
		"anidachi-prod-transition-20260912",
		"Remote production/staging executor is intentionally unavailable",
	);
	assert.equal(
		target.hostPort,
		55692,
		"Only the dedicated nondefault loopback target",
	);
}
export function createDriver(env = process.env) {
	verifyManifest();
	const target = requireDisposableTarget(env);
	validateTarget(target);
	assert.ok(
		target.workdir.startsWith("/private/tmp/"),
		"Disposable files must stay task-local",
	);
	const inspect = spawnSync(
		"docker",
		[
			"inspect",
			"--format",
			"{{json .NetworkSettings.Ports}}",
			target.container,
		],
		{ encoding: "utf8" },
	);
	assert.equal(inspect.status, 0);
	assert.ok(
		JSON.parse(inspect.stdout)["5432/tcp"].every(
			(p) => p.HostIp === "127.0.0.1",
		),
		"Loopback-only database required",
	);
	function sql(input, { allowFailure = false, timeout = 60_000 } = {}) {
		const r = spawnSync("docker", proofPsqlArgs(target.container), {
			input: withPsqlSessionTimeouts(`set timezone='UTC';\n${input}`),
			encoding: "utf8",
			timeout,
			maxBuffer: 16 * 1024 * 1024,
		});
		assert.ifError(r.error);
		if (!allowFailure) assert.equal(r.status, 0, r.stderr);
		return allowFailure ? r : r.stdout.trim();
	}
	const json = (input) => JSON.parse(sql(input));
	const versions = () =>
		json(
			"select coalesce(jsonb_agg(version order by version),'[]'::jsonb) from supabase_migrations.schema_migrations;",
		);
	function prefix() {
		const v = versions();
		assert.ok(v.length >= 35 && v.length <= 60, "Unexpected migration count");
		assert.deepEqual(
			v,
			manifest.migrations.slice(0, v.length).map((m) => m.version),
			"Migration history is not an exact prefix",
		);
		return v.length;
	}
	function inventory() {
		return Object.fromEntries(
			Object.entries(manifest.inventory).map(([t, expected]) => [
				t,
				json(
					`select jsonb_build_object('count',count(*)${expected.schemas ? ",'schemas',jsonb_agg(distinct schema_version order by schema_version)" : ""}) from public.${t};`,
				),
			]),
		);
	}
	function document() {
		const backup = resolve(target.workdir, "baseline.dump");
		assert.ok(existsSync(backup), "Actual pre-transition backup file required");
		const descriptors = JSON.parse(sqlFile("baseline-schema.json"));
		return {
			transition: manifest.transition,
			productionProject: manifest.productionProject,
			target,
			sourceCommit: manifest.sourceCommit,
			manifestSha256: sha(sqlFile("manifest.json")),
			bridgeSha256: sha(
				[
					"prepare.sql",
					"verify-archive.sql",
					"finish.sql",
					"baseline-schema.json",
				]
					.map(sqlFile)
					.join("\n"),
			),
			backupSha256: sha(readFileSync(backup)),
			baselineVersions: manifest.migrations.slice(0, 35).map((m) => m.version),
			targetVersions: manifest.migrations.map((m) => m.version),
			inventory: manifest.inventory,
			descriptors,
			publicTables: Object.keys(descriptors).sort(),
			evidenceClass: "synthetic-disposable-rehearsal-only",
		};
	}
	const transaction = (body) =>
		`begin; set local search_path=''; create temp table transition_input(document jsonb); insert into pg_temp.transition_input values(${quote(JSON.stringify(document()))}::jsonb); ${body}\ncommit;`;
	function verifyArchive() {
		prefix();
		sql(transaction(sqlFile("verify-archive.sql")));
	}
	function prepare() {
		const existing =
			sql(`select to_regclass('${schema}.control') is not null;`) === "t";
		if (existing) {
			verifyArchive();
			return status();
		}
		assert.equal(
			prefix(),
			35,
			"Prepare must precede the FIRST pending migration",
		);
		validateInventory(inventory());
		sql(
			transaction(
				`${sqlFile("prepare.sql")}\n${sqlFile("verify-archive.sql")}`,
			),
		);
		return status();
	}
	function apply() {
		verifyManifest();
		verifyArchive();
		assert.ok(
			["prepared", "chain_applied"].includes(status().phase),
			"Completed transition cannot apply again",
		);
		// Copy all 60 immutable files, never a selected suffix or migration repair.
		const dir = resolve(target.workdir, "supabase/migrations");
		for (const m of manifest.migrations)
			copyFileSync(
				resolve(root, "apps/web/supabase/migrations", m.file),
				resolve(dir, m.file),
			);
		assert.deepEqual(
			readdirSync(dir)
				.filter((f) => f.endsWith(".sql"))
				.sort(),
			manifest.migrations.map((m) => m.file),
		);
		for (const m of manifest.migrations)
			assert.equal(sha(readFileSync(resolve(dir, m.file))), m.sha256);
		const args = [
			"exec",
			`--using=${readFileSync(resolve(root, ".node-version"), "utf8").trim()}`,
			"corepack",
			"pnpm",
			"dlx",
			`supabase@${manifest.cli}`,
		];
		const cli = spawnSync("fnm", [...args, "--version"], {
			cwd: root,
			env,
			encoding: "utf8",
			timeout: 30_000,
		});
		assert.equal(cli.status, 0, cli.stderr);
		assert.equal(cli.stdout.trim(), manifest.cli);
		const r = spawnSync(
			"fnm",
			[
				...args,
				"--workdir",
				target.workdir,
				"db",
				"push",
				"--db-url",
				`postgresql://postgres:task3-disposable-only@127.0.0.1:${target.hostPort}/postgres`,
				"--yes",
			],
			{
				cwd: root,
				env,
				encoding: "utf8",
				timeout: 180_000,
				maxBuffer: 4 * 1024 * 1024,
			},
		);
		assert.ifError(r.error);
		assert.equal(
			r.status,
			0,
			`Migration stopped; retain maintenance and archive. ${r.stderr}\n${r.stdout}`,
		);
		assert.equal(prefix(), 60);
		sql(
			`update ${schema}.control set phase='chain_applied' where phase='prepared';`,
		);
		return status();
	}
	function finish() {
		verifyArchive();
		sql(
			transaction(`${sqlFile("finish.sql")}\n${sqlFile("verify-archive.sql")}`),
		);
		return status();
	}
	function status() {
		verifyArchive();
		return json(
			`select jsonb_build_object('phase',phase,'maintenance',maintenance,'migrationCount',(select count(*) from supabase_migrations.schema_migrations),'archivedRelations',(select count(*) from ${schema}.relations where archived),'archivedRows',(select count(*) from ${schema}.rows),'manifestSha256',document->>'manifestSha256','backupSha256',document->>'backupSha256') from ${schema}.control;`,
		);
	}
	return {
		target,
		sql,
		json,
		prefix,
		inventory,
		document,
		prepare,
		apply,
		finish,
		status,
		verifyArchive,
	};
}
if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const phase = process.argv[2];
	assert.ok(
		["prepare", "apply", "finish", "status"].includes(phase),
		"Expected prepare/apply/finish/status; production executor is withheld",
	);
	console.log(JSON.stringify(createDriver()[phase](), null, 2));
}
