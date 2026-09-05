import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

import {
	assertPreTransitionPrerequisite,
	DATABASE_PREREQUISITE_SQL,
	proofPsqlArgs,
	requireDisposableTarget,
	requireOutputPath,
	requireTransitionAcknowledgement,
	withPsqlSessionTimeouts,
} from "./watch_history_v3_disposable_target.mjs";

const target = requireDisposableTarget();
requireTransitionAcknowledgement();
const outputPath = requireOutputPath(
	process.env,
	"ANIDACHI_WATCH_HISTORY_TRANSITION_OUTPUT",
);
const psqlArgs = proofPsqlArgs(target.container);

function sql(input, timeout = 30_000) {
	const result = spawnSync("docker", psqlArgs, {
		input: withPsqlSessionTimeouts(input),
		encoding: "utf8",
		maxBuffer: 12 * 1024 * 1024,
		timeout,
	});
	assert.equal(result.error, undefined, result.error?.message);
	assert.equal(result.status, 0, result.stderr);
	return result.stdout.trim();
}

assertPreTransitionPrerequisite(JSON.parse(sql(DATABASE_PREREQUISITE_SQL)));

const ids = Array.from(
	{ length: 4 },
	(_, index) => `a9999999-1111-4111-8111-11111111111${index}`,
);
const children = new Set();
const startPsql = () => {
	const child = spawn("docker", psqlArgs, { stdio: ["pipe", "pipe", "pipe"] });
	children.add(child);
	child.once("close", () => children.delete(child));
	return child;
};
const delay = (milliseconds) =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(check, timeout, message) {
	const deadline = Date.now() + timeout;
	while (!check()) {
		assert.ok(Date.now() < deadline, message);
		await delay(20);
	}
}
function closeResult(child, timeout) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			child.kill("SIGTERM");
			reject(new Error(`Child SQL process exceeded ${timeout}ms`));
		}, timeout);
		child.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		child.once("close", (code) => {
			clearTimeout(timer);
			resolve(code);
		});
	});
}

try {
	sql(`insert into public.users(id,email,display_name) values ${ids
		.map(
			(id, index) =>
				`('${id}','transition-${index}@example.test','Transition')`,
		)
		.join(",")};
insert into public.user_watch_settings(user_id,next_server_order,youtube_history_enabled)
values('${ids[0]}',77,true);
insert into public.rooms(room_id,host_user_id,status,source_url,title)
values('task3-preserved-room','${ids[0]}','live','https://www.youtube.com/watch?v=TEST','Preserve');
insert into public.room_members(room_id,user_id)
values('task3-preserved-room','${ids[1]}');
insert into public.recent_people_evidence(user_id,other_user_id,last_room_id,last_watched_at)
values('${ids[0]}','${ids[1]}','task3-preserved-room',now());`);

	function event(accountGeneration, populated = false) {
		return {
			schemaVersion: 2,
			accountGeneration,
			provider: "youtube",
			titleKey: "old-title",
			episodeKey: "old-episode",
			itemKind: "movie",
			title: "Old",
			episodeTitle: "Old",
			clientEventId: crypto.randomUUID(),
			clientSessionKey: "old-session",
			sourceUrl: "https://www.youtube.com/watch?v=TEST",
			currentTime: populated ? 55 : 0,
			duration: populated ? 100 : 0,
			progress: populated ? 0.55 : 0,
			kind: "heartbeat",
			observedAt: new Date().toISOString(),
			sharedRoom: null,
		};
	}

	sql(
		`select public.apply_watch_progress_v2('${ids[0]}','${JSON.stringify(event(1, true))}',null);`,
	);
	const populatedBefore = JSON.parse(
		sql(`select jsonb_build_object(
  'progress',(select count(*) from public.watch_episode_progress),
  'sessions',(select count(*) from public.watch_sessions),
  'participants',(select count(*) from public.watch_session_participants),
  'receipts',(select count(*) from public.watch_history_receipts),
  'titleSummaries',(select count(*) from public.watch_history_title_summaries),
  'sessionSummaries',(select count(*) from public.watch_history_user_session_summaries),
  'settings',(select count(*) from public.user_watch_settings)
);`),
	);
	for (const [relation, count] of Object.entries(populatedBefore)) {
		assert.ok(Number(count) > 0, `Pre-transition ${relation} fixture is empty`);
	}
	const preserveSql = `select jsonb_build_object(
  'users',(select jsonb_agg(to_jsonb(value) order by id) from public.users value),
  'rooms',(select jsonb_agg(to_jsonb(value) order by room_id) from public.rooms value),
  'members',(select jsonb_agg(to_jsonb(value) order by user_id) from public.room_members value),
  'recent',(select jsonb_agg(to_jsonb(value) order by user_id) from public.recent_people_evidence value)
);`;
	const before = sql(preserveSql);
	const workers = [];
	const main = startPsql();
	let mainOutput = "";
	let mainError = "";
	main.stdout.on("data", (data) => {
		mainOutput += data;
	});
	main.stderr.on("data", (data) => {
		mainError += data;
	});
	const mainComplete = closeResult(main, 60_000);
	main.stdin.write(
		"set statement_timeout='45s'; set idle_in_transaction_session_timeout='15s'; " +
			"begin; lock public.user_watch_settings in share row exclusive mode; select 'LOCK_READY';\n",
	);
	await waitFor(
		() => mainOutput.includes("LOCK_READY"),
		5_000,
		`Timed out waiting for transition lock readiness: ${mainError}`,
	);

	for (const [index, id] of ids.slice(1).entries()) {
		const child = startPsql();
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (data) => {
			stdout += data;
		});
		child.stderr.on("data", (data) => {
			stderr += data;
		});
		const complete = closeResult(child, 30_000).then((code) => ({
			code,
			stdout,
			stderr,
		}));
		child.stdin.end(
			`set statement_timeout='15s'; set lock_timeout='10s'; ` +
				`set application_name='watch_history_v3_old_${index}'; ` +
				`select public.apply_watch_progress_v2('${id}','${JSON.stringify(event(index === 0 ? 1 : 2))}',null);`,
		);
		workers.push(complete);
	}

	let waiting = 0;
	await waitFor(
		() => {
			waiting = Number(
				sql(
					"select count(*) from pg_stat_activity where application_name like 'watch_history_v3_old_%' and wait_event_type='Lock'",
				),
			);
			return waiting === 3;
		},
		5_000,
		"Old schema-2 invocations did not all reach the migration lock",
	);
	assert.equal(waiting, 3);

	const migration = readFileSync(
		"apps/web/supabase/migrations/20260904205540_watch_history_canonical_catalog.sql",
		"utf8",
	);
	assert.match(migration, /^begin;\n/);
	main.stdin.end(migration.replace(/^begin;\n/, ""));
	assert.equal(await mainComplete, 0, mainError);

	const workerResults = await Promise.all(workers);
	for (const result of workerResults) {
		assert.notEqual(result.code, 0);
		assert.match(result.stderr, /write_schema_version.*not-null constraint/);
	}
	assert.equal(
		sql(preserveSql),
		before,
		"Non-history rows changed during the scoped transition",
	);
	assert.equal(
		sql(`select history_generation||':'||next_server_order||':'||youtube_history_enabled
      from public.user_watch_settings where user_id='${ids[0]}'`),
		"2:78:true",
	);
	const resetAfter = JSON.parse(
		sql(`select jsonb_build_object(
    'progress',(select count(*) from public.watch_episode_progress),
    'sessions',(select count(*) from public.watch_sessions),
    'participants',(select count(*) from public.watch_session_participants),
    'receipts',(select count(*) from public.watch_history_receipts),
    'titleSummaries',(select count(*) from public.watch_history_title_summaries),
    'sessionSummaries',(select count(*) from public.watch_history_user_session_summaries),
    'catalogSnapshots',(select count(*) from public.watch_catalog_snapshots),
    'catalogAliases',(select count(*) from public.watch_catalog_aliases)
  );`),
	);
	assert.deepEqual(resetAfter, {
		progress: 0,
		sessions: 0,
		participants: 0,
		receipts: 0,
		titleSummaries: 0,
		sessionSummaries: 0,
		catalogSnapshots: 0,
		catalogAliases: 0,
	});
	assert.equal(sql("select count(*) from public.user_watch_settings"), "1");

	const result = {
		populatedTransition: "PASS",
		target: {
			project: target.project,
			container: target.container,
			hostPort: target.hostPort,
		},
		resetScope: "watch history only",
		populatedBefore,
		resetAfter,
		preserved:
			"users rooms room_members recent_people_evidence consent server order",
		cachedOldInvocations: workerResults.map((value) => ({
			exit: value.code,
			rejectedBy: "write_schema_version NOT NULL",
		})),
		guessedGeneration: 2,
	};
	writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
	console.log(JSON.stringify({ ...result, output: outputPath }));
} finally {
	const closing = [];
	for (const child of children) {
		closing.push(new Promise((resolve) => child.once("close", resolve)));
		if (!child.killed) {
			child.stdin?.end("rollback;\n");
			child.kill("SIGTERM");
		}
	}
	await Promise.race([Promise.allSettled(closing), delay(2_000)]);
	sql(`delete from public.rooms where room_id='task3-preserved-room';
    delete from public.users where id in (${ids.map((id) => `'${id}'`).join(",")});`);
}
