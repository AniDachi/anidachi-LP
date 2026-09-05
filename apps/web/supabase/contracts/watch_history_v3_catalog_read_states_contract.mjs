import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import {
	assertV3Prerequisite,
	DATABASE_PREREQUISITE_SQL,
	requireDisposableTarget,
	requireOutputPath,
} from "./watch_history_v3_disposable_target.mjs";

const target = requireDisposableTarget();
const outputPath = requireOutputPath(
	process.env,
	"ANIDACHI_WATCH_HISTORY_CATALOG_STATES_OUTPUT",
);
const psqlArgs = [
	"exec",
	"-i",
	target.container,
	"psql",
	"-U",
	"postgres",
	"-d",
	"postgres",
	"-X",
	"-qAt",
	"-v",
	"ON_ERROR_STOP=1",
];
function sql(input, timeout = 30_000) {
	const result = spawnSync("docker", psqlArgs, {
		input,
		encoding: "utf8",
		maxBuffer: 8 * 1024 * 1024,
		timeout,
	});
	assert.equal(result.error, undefined, result.error?.message);
	assert.equal(result.status, 0, result.stderr);
	return result.stdout.trim();
}

assertV3Prerequisite(JSON.parse(sql(DATABASE_PREREQUISITE_SQL)));

const userId = "77777777-7777-4777-8777-777777777777";
const titleKey = "crunchyroll:series:READ_STATES";
const quote = (value) =>
	`'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const baseTime = Date.now() - 20_000;
const request = (region, requestedLocale) => ({
	schemaVersion: 3,
	accountGeneration: 1,
	provider: "crunchyroll",
	titleKey,
	providerSeriesId: "READ_STATES",
	context: {
		region,
		requestedLocale,
		audioLocale: "ja-JP",
		subtitleLocales: [],
		observedAt: new Date().toISOString(),
	},
});
const event = (number) => ({
	schemaVersion: 3,
	accountGeneration: 1,
	provider: "crunchyroll",
	titleKey,
	seasonKey: `crunchyroll:season:RS${Math.floor(number / 6)}`,
	episodeKey: `crunchyroll:episode:RE${number}`,
	itemKind: "series",
	title: "Observed title",
	episodeTitle: `Observed ${number}`,
	seasonTitle: "Observed season",
	seasonNumber: Math.floor(number / 6) + 1,
	episodeNumber: (number % 6) + 1,
	artworkUrl: null,
	clientEventId: crypto.randomUUID(),
	clientSessionKey: "catalog-read-states",
	currentTime: number % 2 ? 95 : 10,
	duration: 100,
	progress: number % 2 ? 0.95 : 0.1,
	kind: "heartbeat",
	sharedRoom: null,
	observedAt: new Date(baseTime + number * 1000).toISOString(),
	sourceUrl: `https://www.crunchyroll.com/watch/RR${number}`,
	crunchyrollIdentity: {
		providerSeriesId: "READ_STATES",
		providerSeasonIdentifier: `RS${Math.floor(number / 6)}`,
		providerEpisodeIdentifier: `RE${number}`,
		providerContentId: `RR${number}`,
		audioLocale: "ja-JP",
	},
});
const snapshot = (catalogRequest, zero = false) => ({
	schemaVersion: 3,
	provider: "crunchyroll",
	titleKey,
	providerSeriesId: "READ_STATES",
	title: "Titre du catalogue",
	completeness: "complete",
	context: catalogRequest.context,
	seasons: Array.from({ length: 2 }, (_, season) => ({
		seasonKey: `crunchyroll:season:RS${season}`,
		providerSeasonIdentifier: `RS${season}`,
		title: `Saison ${season + 1}`,
		seasonNumber: season + 1,
		order: season,
		episodes: Array.from({ length: 7 }, (_, episode) => {
			const suffix =
				episode === 6 ? `U${season}` : String(season * 6 + episode);
			return {
				episodeKey: `crunchyroll:episode:RE${suffix}`,
				providerEpisodeIdentifier: `RE${suffix}`,
				title: `Episode du catalogue ${suffix}`,
				episodeNumber: episode + 1,
				order: episode,
				releasedAt: null,
				available: !zero && suffix !== "11",
				watchVariants: [
					{
						providerContentId: `RR${suffix}`,
						audioLocale: "ja-JP",
						original: true,
						order: 0,
						sourceUrl: `https://www.crunchyroll.com/watch/RR${suffix}`,
					},
				],
			};
		}),
	})),
});

const statements = [
	"begin;",
	`insert into public.users(id,email,display_name)
    values('${userId}','catalog-read-states@example.test','Catalog Read States');`,
	"create temporary table current_attempt(request jsonb, ack jsonb);",
	...Array.from(
		{ length: 12 },
		(_, number) =>
			`do $$ begin perform public.apply_watch_progress_v3('${userId}',${quote(event(number))},null); end $$;`,
	),
];
const list = (name) =>
	statements.push(
		`select jsonb_build_object('name','${name}','kind','list','page',` +
			`public.list_watch_history_v3_bounded_page('${userId}',1,1));`,
	);
const detail = (name, cursor = "null") =>
	statements.push(
		`select jsonb_build_object('name','${name}','kind','detail','page',` +
			`public.list_watch_history_v3_title_episodes_page('${userId}',1,'crunchyroll','${titleKey}',6,${cursor}));`,
	);
function begin(catalogRequest) {
	statements.push(
		`delete from current_attempt; insert into current_attempt select ${quote(catalogRequest)},` +
			`public.begin_watch_catalog_v3('${userId}',${quote(catalogRequest)});`,
	);
}
function commit(catalogSnapshot) {
	statements.push(
		`do $$ begin perform public.apply_watch_catalog_v3('${userId}',` +
			`(select request||jsonb_build_object('revision',ack->'revision','snapshot',${quote(catalogSnapshot)}) ` +
			"from current_attempt)); end $$;",
	);
}

list("unavailable");
const first = request("US", "fr-FR");
begin(first);
commit(snapshot(first));
list("complete");
detail("complete-detail-first");
detail(
	"complete-detail-next",
	`public.list_watch_history_v3_title_episodes_page('${userId}',1,'crunchyroll','${titleKey}',6,null)->>'nextCursor'`,
);
const failed = request("US", "ja-JP");
begin(failed);
commit({ ...snapshot(failed), completeness: "partial", seasons: [] });
list("same-region-failed-locale");
const foreign = request("GB", "en-GB");
begin(foreign);
list("region-pending");
detail("region-pending-detail");
const zero = request("GB", "de-DE");
begin(zero);
commit(snapshot(zero, true));
list("zero-available");
detail("zero-available-detail");
statements.push("rollback;");

const cases = sql(statements.join("\n"))
	.split("\n")
	.filter(Boolean)
	.map(JSON.parse);
assert.equal(cases.length, 9);
const catalog = (name) => {
	const selected = cases.find((value) => value.name === name);
	return selected.kind === "list"
		? selected.page.titleSummaries[0].catalog
		: selected.page.catalog;
};
assert.equal(catalog("unavailable").state, "unavailable");
assert.equal(catalog("complete").aggregate.completedEpisodes, 5);
assert.equal(catalog("complete").aggregate.availableEpisodes, 13);
assert.ok(Math.abs(catalog("complete").aggregate.progress - 5 / 13) < 1e-12);
assert.equal(
	cases.find((value) => value.name === "complete").page.titleSummaries[0]
		.completedEpisodeCount,
	6,
);
assert.equal(catalog("same-region-failed-locale").title, "Titre du catalogue");
assert.equal(catalog("same-region-failed-locale").state, "complete");
assert.equal(catalog("region-pending").state, "partial");
assert.equal(catalog("region-pending-detail").aggregate, null);
assert.deepEqual(catalog("zero-available").aggregate, {
	completedEpisodes: 0,
	availableEpisodes: 0,
	progress: 0,
});
assert.equal(
	catalog("complete-detail-first").seasons[0].seasonKey,
	"crunchyroll:season:RS1",
);
assert.equal(
	catalog("complete-detail-next").seasons[0].seasonKey,
	"crunchyroll:season:RS0",
);
assert.ok(
	cases
		.filter((value) => value.kind === "detail")
		.every((value) => value.page.progressRows.length === 6),
);

writeFileSync(outputPath, `${JSON.stringify({ userId, cases }, null, 2)}\n`);
console.log(
	JSON.stringify({
		cases: cases.map((value) => value.name),
		rollback: true,
		target: {
			project: target.project,
			container: target.container,
			hostPort: target.hostPort,
		},
		output: outputPath,
	}),
);
