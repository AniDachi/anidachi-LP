import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
	browseWatchHistoryV3,
	browseWatchHistoryTitleEpisodesV3,
	browseWatchHistorySessionsV3,
	browseWatchHistoryOptionsV3,
} from "./watch-history-browse";

const enabled = process.env.WATCH_HISTORY_BROWSE_LOCAL_RPC === "1";
const owner = "bbbbbbbb-1111-4111-8111-111111111111";

test("disposable preview RPC renders only matching canonical episodes and rejects corrupt evidence", {
	skip: !enabled,
}, async (context) => {
	const guard = spawnSync(
		process.execPath,
		[resolve("supabase/contracts/watch_history_v3_target_preflight.mjs")],
		{ encoding: "utf8" },
	);
	assert.equal(guard.status, 0, guard.stderr);
	const fixture = readFileSync(
		resolve("supabase/tests/watch_history_v3_episode_previews.test.sql"),
		"utf8",
	).split("-- Assertions below this marker")[0];
	const container = process.env.ANIDACHI_DISPOSABLE_DB_CONTAINER;
	assert.ok(container);
	const previewOwner = "eeeeeeee-1111-4111-8111-111111111111";
	const store = {
		async browse(
			userId: string,
			query: Record<string, unknown>,
			scope: string,
		) {
			assert.equal(userId, previewOwner);
			const sql =
				fixture +
				`
with page as(select public.browse_watch_history_v3('${previewOwner}','${JSON.stringify(query)}'::jsonb,'${scope}') raw)
select 'PREVIEW_JSON:'||(raw||jsonb_build_object('sessions',coalesce((
select jsonb_agg(jsonb_build_object('provider',s.provider,'titleKey',s.item_key,'episodeKey',s.episode_key,'session',jsonb_build_object(
'id',s.id,'roomId',s.room_id,'roomGeneration',s.room_generation,'hostUserId',s.host_user_id,'kind',case when s.room_id is null then 'solo' else 'shared' end,'sourceGeneration',s.source_generation,
'currentTime',s.current_time_seconds,'duration',s.duration_seconds,'progress',s.progress,'startedAt',s.started_at,'endedAt',s.ended_at,'lastWatchedAt',s.last_checkpoint_at,
'participants',(select jsonb_agg(jsonb_build_object('user',jsonb_build_object('userId',u.id,'handle',null,'displayName',u.display_name,'avatarUrl',null),'role',p.role,'currentTime',p.current_time_seconds,'progress',p.progress,'joinedAt',p.joined_at,'leftAt',p.left_at,'updatedAt',p.updated_at)) from public.watch_session_participants p join public.users u on u.id=p.user_id where p.session_id=s.id))))
from public.watch_sessions s where s.id in(select jsonb_array_elements_text(raw->'sessionIds')::uuid)),'[]'::jsonb)))::text from page;
rollback;`;
			const result = spawnSync(
				"docker",
				[
					"exec",
					"-i",
					container,
					"psql",
					"-U",
					"postgres",
					"-d",
					"postgres",
					"-v",
					"ON_ERROR_STOP=1",
					"-qAt",
				],
				{ input: sql, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
			);
			assert.equal(result.status, 0, result.stderr);
			const line = result.stdout
				.split("\n")
				.find((line) => line.startsWith("PREVIEW_JSON:"));
			assert.ok(line);
			return JSON.parse(line.slice("PREVIEW_JSON:".length));
		},
	};
	const query = { mode: "shared", search: "MIX", includeEpisodePreviews: true };
	const response = await browseWatchHistoryV3({
		userId: previewOwner,
		input: query,
		store,
	});
	assert.deepEqual(
		response.episodePreviews?.[0]?.detail.episodes.map((e) => e.episodeKey),
		["crunchyroll:episode:eligible-old-episode"],
	);
	assert.equal(response.episodePreviews?.[0]?.detail.complete, true);
	assert.equal(response.episodePreviews?.[0]?.detail.observedEpisodeCount, 13);
	assert.equal(response.history.items[0]?.observedEpisodeCount, 13);
	const legacy = await browseWatchHistoryV3({
		userId: previewOwner,
		input: { mode: "shared", search: "MIX" },
		store,
	});
	assert.deepEqual(Object.keys(legacy).sort(), ["history", "matches"]);
	assert.deepEqual(
		response.history.items[0]?.aggregate,
		legacy.history.items[0]?.aggregate,
	);
	const solo = await browseWatchHistoryV3({
		userId: previewOwner,
		input: { mode: "solo", search: "MIX", includeEpisodePreviews: true },
		store,
	});
	assert.equal(solo.episodePreviews?.[0]?.detail.episodes.length, 8);
	assert.ok(
		solo.episodePreviews?.[0]?.detail.episodes.every((e) =>
			e.episodeKey.startsWith("crunchyroll:episode:SOLO"),
		),
	);
	const raw = await store.browse(
		previewOwner,
		{ ...query, limit: 20 },
		"titles",
	);
	for (const mutate of [
		(value: typeof raw) => {
			value.episodePreviews[0].progressRows[0].user_id =
				"eeeeeeee-2222-4222-8222-222222222222";
		},
		(value: typeof raw) => {
			value.episodePreviews[0].progressRows[0].history_generation = 2;
		},
		(value: typeof raw) => {
			value.episodePreviews[0].matches[0].episodeKey = "unmatched";
		},
		(value: typeof raw) => {
			value.episodePreviews[0].complete = false;
		},
		(value: typeof raw) => {
			value.episodePreviews[0].sessionIds = [];
		},
		(value: typeof raw) => {
			value.episodePreviews[0].unexpected = true;
		},
		(value: typeof raw) => {
			value.episodePreviews[0].matches = [];
			value.episodePreviews[0].progressRows = [];
			value.episodePreviews[0].sessionIds = [];
		},
	]) {
		const corrupt = structuredClone(raw);
		mutate(corrupt);
		await assert.rejects(
			browseWatchHistoryV3({
				userId: previewOwner,
				input: query,
				store: {
					async browse() {
						return corrupt;
					},
				},
			}),
			{ code: "INVALID_DATABASE_RESPONSE" },
		);
	}
	context.diagnostic(
		JSON.stringify({
			previewResponseBytes: Buffer.byteLength(JSON.stringify(response)),
			legacyResponseBytes: Buffer.byteLength(JSON.stringify(legacy)),
			previewCanonicalSessionLoads: raw.sessionIds.length,
		}),
	);
});
test("disposable production RPC payloads parse through canonical builders with observed session dates", {
	skip: !enabled,
}, async (context) => {
	const guard = spawnSync(
		process.execPath,
		[resolve("supabase/contracts/watch_history_v3_target_preflight.mjs")],
		{ encoding: "utf8" },
	);
	assert.equal(guard.status, 0, guard.stderr);
	const fixture = readFileSync(
		resolve("supabase/tests/watch_history_v3_browse.test.sql"),
		"utf8",
	).split("-- SQL permission checks")[0];
	assert.ok(fixture);
	const container = process.env.ANIDACHI_DISPOSABLE_DB_CONTAINER;
	assert.ok(container);
	const queries = {
		titles: {
			mode: "shared",
			search: "tHe pRoMiSe Ω",
			limit: 1,
		},
		episodes: {
			mode: "shared",
			provider: "crunchyroll",
			titleKey: "crunchyroll:series:TARGET",
			search: "tHe pRoMiSe Ω",
			limit: 20,
		},
		sessions: {
			mode: "shared",
			provider: "crunchyroll",
			titleKey: "crunchyroll:series:S",
			episodeKey: "crunchyroll:episode:OLD",
			search: "pRoMiSe",
			participantUserId: "bbbbbbbb-3333-4333-8333-333333333333",
			limit: 20,
		},
		options: { mode: "shared", limit: 20 },
	};
	const sql =
		fixture +
		`
create function pg_temp.enriched(q jsonb,scope text) returns jsonb language sql as $$
with page as(select pg_temp.browse(q,scope,case when scope='sessions' then 'bbbbbbbb-3333-4333-8333-333333333333'::uuid else 'bbbbbbbb-1111-4111-8111-111111111111'::uuid end) raw)
select case when scope='options' then raw else raw||jsonb_build_object('sessions',coalesce((
select jsonb_agg(jsonb_build_object('provider',s.provider,'titleKey',s.item_key,'episodeKey',s.episode_key,'session',jsonb_build_object(
'id',s.id,'roomId',s.room_id,'roomGeneration',s.room_generation,'hostUserId',s.host_user_id,'kind',case when s.room_id is null then 'solo' else 'shared' end,'sourceGeneration',s.source_generation,
'currentTime',s.current_time_seconds,'duration',s.duration_seconds,'progress',s.progress,'startedAt',s.started_at,'endedAt',s.ended_at,'lastWatchedAt',s.last_checkpoint_at,
'participants',(select jsonb_agg(jsonb_build_object('user',jsonb_build_object('userId',u.id,'handle',null,'displayName',u.display_name,'avatarUrl',null),'role',p.role,'currentTime',p.current_time_seconds,'progress',p.progress,'joinedAt',p.joined_at,'leftAt',p.left_at,'updatedAt',p.updated_at)) from public.watch_session_participants p join public.users u on u.id=p.user_id where p.session_id=s.id))) order by s.id)
from public.watch_sessions s where s.id in (select jsonb_array_elements_text(raw->'sessionIds')::uuid)), '[]'::jsonb)) end from page $$;
${Object.entries(queries)
	.map(
		([scope, q]) =>
			`select 'BROWSE_JSON:${scope}:'||pg_temp.enriched('${JSON.stringify(q)}'::jsonb,'${scope}')::text;`,
	)
	.join("\n")}
create function pg_temp.browse_plan() returns jsonb language plpgsql as $$
declare body text; result jsonb;
begin
select prosrc into body from pg_proc where oid='public.watch_history_browse_matches_v3(uuid,bigint,jsonb)'::regprocedure;
body:=replace(replace(replace(body,'p_user_id',quote_literal('bbbbbbbb-1111-4111-8111-111111111111')||'::uuid'),'p_generation','1'),'p_query',quote_literal('{"mode":"shared","groupId":"aaaaaaaa-1111-4111-8111-111111111111"}')||'::jsonb');
execute 'explain (analyze,buffers,format json) '||body into result;
return result;
end $$;
select 'BROWSE_PLAN:'||pg_temp.browse_plan()::text;
rollback;`;
	const output = spawnSync(
		"docker",
		[
			"exec",
			"-i",
			container,
			"psql",
			"-U",
			"postgres",
			"-d",
			"postgres",
			"-v",
			"ON_ERROR_STOP=1",
			"-qAt",
		],
		{ input: sql, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
	);
	assert.equal(output.status, 0, output.stderr);
	const planLine = output.stdout
		.split("\n")
		.find((l) => l.startsWith("BROWSE_PLAN:"));
	assert.ok(planLine);
	const plan = JSON.parse(planLine.slice("BROWSE_PLAN:".length));
	const indexes = [
		...JSON.stringify(plan).matchAll(/"Index Name":"([^"]+)"/g),
	].map((m) => m[1]);
	assert.ok(
		indexes.length > 0,
		"populated production eligibility query uses indexes",
	);
	context.diagnostic(
		JSON.stringify({
			eligibilityExecutionMs: plan[0]["Execution Time"],
			rows: plan[0].Plan["Actual Rows"],
			indexes,
		}),
	);
	const values = Object.fromEntries(
		output.stdout
			.split("\n")
			.filter((l) => l.startsWith("BROWSE_JSON:"))
			.map((l) => {
				const [, scope, ...body] = l.split(":");
				return [scope, JSON.parse(body.join(":"))];
			}),
	);
	const store = {
		async browse(
			_owner: string,
			_query: Record<string, unknown>,
			scope: string,
		) {
			return values[scope];
		},
	};
	const titles = await browseWatchHistoryV3({
		userId: owner,
		input: queries.titles,
		store,
	});
	assert.equal(titles.history.items.length, 1);
	assert.equal(titles.matches[0]?.titleKey, "crunchyroll:series:TARGET");
	const episodes = await browseWatchHistoryTitleEpisodesV3({
		userId: owner,
		input: queries.episodes,
		store,
	});
	assert.deepEqual(
		episodes.detail.episodes.map((e) => [e.episodeKey, e.episodeTitle]),
		[["crunchyroll:episode:TARGET", "Episode 2 - The Promise Ω"]],
	);
	const sessions = await browseWatchHistorySessionsV3({
		userId: "bbbbbbbb-3333-4333-8333-333333333333",
		input: queries.sessions,
		store,
	});
	assert.equal(sessions.totalSessionCount, 1);
	assert.equal(
		sessions.sessions[0]?.lastWatchedAt,
		values.sessions.matches[0].lastWatchedAt,
	);
	const options = await browseWatchHistoryOptionsV3({
		userId: owner,
		input: queries.options,
		store,
	});
	assert.ok(options.options.some((o) => o.label === "Original group"));
});
