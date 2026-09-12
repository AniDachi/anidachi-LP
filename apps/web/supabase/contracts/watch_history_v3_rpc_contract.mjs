import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import {
	assertV3Prerequisite,
	DATABASE_PREREQUISITE_SQL,
	proofPsqlArgs,
	requireDisposableTarget,
	requireOutputPath,
	withPsqlSessionTimeouts,
} from "./watch_history_v3_disposable_target.mjs";

const target = requireDisposableTarget();
const outputPath = requireOutputPath(
	process.env,
	"ANIDACHI_WATCH_HISTORY_RPC_OUTPUT",
);
const userId = "66666666-6666-4666-8666-666666666666";

function sql(input) {
	const result = spawnSync("docker", proofPsqlArgs(target.container), {
		input: withPsqlSessionTimeouts(input),
		encoding: "utf8",
		maxBuffer: 8 * 1024 * 1024,
		timeout: 30_000,
	});
	assert.equal(result.error, undefined, result.error?.message);
	assert.equal(result.status, 0, result.stderr);
	return result.stdout.trim().split("\n").filter(Boolean).map(JSON.parse);
}

assertV3Prerequisite(sql(DATABASE_PREREQUISITE_SQL)[0]);

const setup = `begin; insert into public.users(id,email,display_name)
values('${userId}','rpc-v3@example.test','RPC');`;
const event = (number, title) =>
	JSON.stringify({
		schemaVersion: 3,
		accountGeneration: 1,
		provider: "crunchyroll",
		titleKey: `crunchyroll:series:${title}`,
		seasonKey: "crunchyroll:season:S",
		episodeKey: `crunchyroll:episode:E${number}`,
		itemKind: "series",
		title: "RPC",
		episodeTitle: "Episode",
		seasonTitle: "Season",
		seasonNumber: 1,
		episodeNumber: number,
		artworkUrl: null,
		clientEventId: crypto.randomUUID(),
		clientSessionKey: "rpc",
		sourceUrl: `https://www.crunchyroll.com/watch/R${number}`,
		currentTime: number % 2 ? 95 : 10,
		duration: 100,
		progress: number % 2 ? 0.95 : 0.1,
		kind: "heartbeat",
		sharedRoom: null,
		observedAt: new Date().toISOString(),
		crunchyrollIdentity: {
			providerSeriesId: title,
			providerSeasonIdentifier: "S",
			providerEpisodeIdentifier: `E${number}`,
			providerContentId: `R${number}`,
			audioLocale: null,
		},
	});

const first = sql(`${setup}
do $$ begin perform public.apply_watch_progress_v3('${userId}','${event(0, "local-rpc-title")}',null); end; $$;
select public.list_watch_history_v3_bounded_page('${userId}',1,1);
do $$ begin perform public.delete_watch_history_v3('${userId}',jsonb_build_object(
  'schemaVersion',3,'accountGeneration',1,'clientMutationId',gen_random_uuid(),
  'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','all'))); end; $$;
select public.list_watch_history_v3_bounded_page('${userId}',1,1);
rollback;`);
const second = sql(`${setup}
do $$ begin ${Array.from(
	{ length: 12 },
	(_, number) =>
		`perform public.apply_watch_progress_v3('${userId}','${event(number, "bounded-title")}',null);`,
).join("\n")} end; $$;
select public.list_watch_history_v3_bounded_page('${userId}',1,1);
select public.list_watch_history_v3_title_episodes_page(
  '${userId}',1,'crunchyroll','crunchyroll:series:bounded-title',7,null
);
select public.list_watch_history_v3_title_episodes_page(
  '${userId}',1,'crunchyroll','crunchyroll:series:bounded-title',7,
  public.list_watch_history_v3_title_episodes_page(
    '${userId}',1,'crunchyroll','crunchyroll:series:bounded-title',7,null
  )->>'nextCursor'
);
rollback;`);

const pages = [...first, ...second];
assert.equal(pages.length, 5);
assert.equal(first[1].accountGeneration, 2);
assert.equal(second[0].progressRows.length, 8);
assert.equal(second[1].progressRows.length, 7);
assert.equal(second[2].progressRows.length, 5);
assert.equal(second[0].titleSummaries[0].completedEpisodeCount, 6);
writeFileSync(outputPath, `${JSON.stringify(pages)}\n`);
console.log(
	JSON.stringify({
		pages: 5,
		clearGeneration: first[1].accountGeneration,
		titleSlice: 8,
		detailSlices: [7, 5],
		historicalCompleted: 6,
		catalog: second[0].titleSummaries[0].catalog,
		rollback: true,
		output: outputPath,
	}),
);
