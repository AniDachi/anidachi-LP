// Run only after provisioning/first-35/fixture/backup in the runbook. Never
// resets an existing project. The driver checks marker + labels + loopback port.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	createDriver,
	manifest,
	operations,
	root,
} from "./production-history-transition.mjs";

const d = createDriver();
const S = "anidachi_transition_20260912";
const read = (f) => readFileSync(resolve(operations, f), "utf8");
const q = (s) => `'${s.replaceAll("'", "''")}'`;
const input = () =>
	`create temp table transition_input(document jsonb); insert into pg_temp.transition_input values(${q(JSON.stringify(d.document()))}::jsonb);`;
const checks = [];
function pass(name) {
	checks.push(name);
	console.log(`PASS ${name}`);
}
function rejected(query, pattern) {
	const r = query.includes("set session authorization")
		? spawnSync(
				"docker",
				[
					"exec",
					"-i",
					"-e",
					"PGPASSWORD=task3-disposable-only",
					d.target.container,
					"psql",
					"-U",
					"supabase_admin",
					"-d",
					"postgres",
					"-XqAt",
					"-v",
					"ON_ERROR_STOP=1",
				],
				{ input: query, encoding: "utf8", timeout: 60_000 },
			)
		: d.sql(query, { allowFailure: true });
	assert.ifError(r.error);
	assert.notEqual(r.status, 0);
	assert.match(r.stderr, pattern);
	assert.doesNotMatch(
		r.stderr,
		/permission denied to set session authorization/,
		"The test must reach the actual runtime role",
	);
}
assert.equal(d.prefix(), 35);
d.sql(
	"drop event trigger if exists task3_failure; drop function if exists public.task3_fail_migration();",
);
// An interrupted test may restart at the same baseline; prepare verifies the
// existing immutable document instead of replacing its snapshot.
assert.deepEqual(d.inventory(), manifest.inventory);
if (d.sql(`select to_regnamespace('${S}') is null;`) === "t") {
	const writer = spawn(
		"docker",
		[
			"exec",
			"-i",
			d.target.container,
			"psql",
			"-U",
			"postgres",
			"-d",
			"postgres",
			"-XqAt",
			"-v",
			"ON_ERROR_STOP=1",
		],
		{ stdio: ["pipe", "pipe", "pipe"] },
	);
	const closed = new Promise((resolve, reject) => {
		writer.on("error", reject);
		writer.on("close", (code) =>
			code === 0
				? resolve()
				: reject(new Error("Concurrent fixture writer failed")),
		);
	});
	let output = "";
	const locked = new Promise((resolve, reject) => {
		writer.stdout.on("data", (chunk) => {
			output += chunk;
			if (output.includes("TASK3_LOCKED")) resolve();
		});
		writer.on("error", reject);
		writer.on("close", () => {
			if (!output.includes("TASK3_LOCKED"))
				reject(new Error("Concurrent fixture writer never acquired lock"));
		});
	});
	writer.stdin.end(
		"begin; update public.user_watch_settings set next_server_order=next_server_order+1; select 'TASK3_LOCKED'; select pg_sleep(3); rollback;",
	);
	await locked;
	const started = Date.now();
	d.prepare();
	assert.ok(
		Date.now() - started >= 1500,
		"Preparation must wait for the old writer to drain",
	);
	await closed;
	pass(
		"prepare waits for an in-flight settings writer and captures only committed baseline values",
	);
}
const prepared = d.prepare();
assert.equal(prepared.archivedRows, 47);
assert.equal(d.sql(`select bool_and(active) from ${S}.cron_state;`), "t");
assert.equal(
	d.sql(
		`select count(*) from cron.job j join ${S}.cron_state s using(jobid) where j.active;`,
	),
	"0",
);
pass("original active cron flags retained while scheduled jobs are suspended");
assert.deepEqual(
	d.prepare(),
	prepared,
	"Identical prepare retry must verify, never overwrite",
);
pass(
	"transactional prepare and identical restart preserve 47 rows in 10 declared relations",
);
// Negative preparation cases roll back the entire tentative bridge plus fixture
// mutation. No failed prepare leaves an archive or any deleted source row.
const uid = "md5('task3-user-1')::uuid";
const sid = "md5('task3-session-1')::uuid";
const refusals = [
	[
		"schema2 session",
		`update public.watch_sessions set schema_version=2,client_session_key='active-v2' where id=md5('task3-session-4')::uuid`,
		/ACTIVE_HISTORY_REFUSED/,
	],
	[
		"schema2 participant",
		`update public.watch_session_participants set schema_version=2 where session_id=${sid}`,
		/ACTIVE_HISTORY_REFUSED/,
	],
	[
		"schema2 tracked title",
		`update public.user_tracked_titles set schema_version=2 where user_id=${uid}`,
		/ACTIVE_HISTORY_REFUSED/,
	],
	[
		"active progress",
		`insert into public.watch_episode_progress(user_id,provider,title_key,episode_key,item_kind,title,episode_title,source_url,current_time_seconds,duration,progress,last_event_id,observed_at,server_order,history_generation,updated_at) values(${uid},'youtube','x','x','movie','x','x','https://youtu.be/abcdefghijk',10,100,0.1,gen_random_uuid(),now(),1,1,now())`,
		/INVENTORY_DRIFT/,
	],
	[
		"receipt",
		`insert into public.watch_history_receipts(user_id,client_id,kind,acknowledgement) values(${uid},gen_random_uuid(),'progress','{}')`,
		/INVENTORY_DRIFT/,
	],
	[
		"deletion",
		`insert into public.watch_history_deletions(user_id,scope,history_generation,deleted_at,last_client_mutation_id) values(${uid},'all',1,now(),gen_random_uuid())`,
		/INVENTORY_DRIFT/,
	],
	[
		"title summary",
		`insert into public.watch_history_title_summaries values(${uid},1,'youtube','x','youtube:x',now(),1,1)`,
		/INVENTORY_DRIFT/,
	],
	[
		"session summary",
		`insert into public.watch_history_user_session_summaries values(${uid},${sid},1,'youtube','x',now())`,
		/INVENTORY_DRIFT/,
	],
	[
		"source schema drift",
		`alter table public.watch_sessions add column unexpected text`,
		/SCHEMA_DRIFT/,
	],
	[
		"baseline drift",
		`insert into supabase_migrations.schema_migrations(version) values('unexpected')`,
		/BASELINE_DRIFT/,
	],
];
for (const [name, mutation, error] of refusals) {
	rejected(
		`begin; drop schema ${S} cascade; ${mutation}; ${input()} ${read("prepare.sql")} rollback;`,
		error,
	);
	d.verifyArchive();
	pass(`refuses ${name} before any destructive migration`);
}
for (const role of ["anon", "authenticated", "service_role"]) {
	rejected(
		`set session authorization authenticator; set role ${role}; select * from ${S}.rows;`,
		/permission denied/,
	);
}
pass("anon/authenticated/service_role cannot read the private archive");
for (const mutation of [
	`update public.user_watch_settings set youtube_history_enabled=false where user_id=${uid}`,
	`delete from public.users where id=${uid}`,
	"delete from public.rooms where room_id='task3-shared-room'",
	`select public.set_watch_preferences_v2(${uid},'{"youtubeHistoryEnabled":true}')`,
	"truncate public.watch_progress_checkpoints",
])
	rejected(
		`set session authorization authenticator; set role service_role; ${mutation};`,
		/PRODUCTION_HISTORY_MAINTENANCE/,
	);
rejected(
	`set session authorization authenticator; set role service_role; set anidachi.transition_bypass='true'; update public.user_watch_settings set next_server_order=9;`,
	/PRODUCTION_HISTORY_MAINTENANCE/,
);
// A real SECURITY DEFINER wrapper must not convert the authenticator session into
// the operator login. This fixture wrapper is transaction-local and rolled back.
rejected(
	`begin; create function public.task3_definer() returns void language plpgsql security definer set search_path='' as $$ begin update public.user_watch_settings set next_server_order=9 where user_id=${uid}; end $$; grant execute on function public.task3_definer() to service_role; set session authorization authenticator; set role service_role; select public.task3_definer();`,
	/PRODUCTION_HISTORY_MAINTENANCE/,
);
pass(
	"maintenance rejects preference RPC, direct mutation, parent cascades, truncate and SECURITY DEFINER",
);
rejected(
	`begin; update public.watch_sessions set item_title='changed after snapshot' where id=${sid}; ${input()} ${read("verify-archive.sql")} rollback;`,
	/LIVE_SNAPSHOT_DRIFT/,
);
rejected(
	`begin; update ${S}.rows set row_data=row_data||'{"item_title":"tampered"}' where table_name='watch_sessions'; ${input()} ${read("verify-archive.sql")} rollback;`,
	/ARCHIVE_CORRUPT/,
);
rejected(
	`begin; alter table public.users disable trigger production_history_maintenance; ${input()} ${read("verify-archive.sql")} rollback;`,
	/MAINTENANCE_TRIGGER_MISSING/,
);
pass(
	"live equal-count drift, archive tampering and missing maintenance all fail closed",
);
// Inject real PostgreSQL DDL failures at exact migration-history prefixes. The
// pinned CLI still receives all 60 unchanged files and records normal history.
for (const failAt of [35, 37, 38, 50]) {
	d.sql(
		`create function public.task3_fail_migration() returns event_trigger language plpgsql as $$ begin if (select count(*) from supabase_migrations.schema_migrations)=${failAt} then raise exception 'TASK3_INJECTED_FAILURE'; end if; end $$; create event trigger task3_failure on ddl_command_start when tag in ('CREATE FUNCTION') execute function public.task3_fail_migration();`,
	);
	assert.throws(() => d.apply(), /TASK3_INJECTED_FAILURE/);
	assert.equal(d.prefix(), failAt);
	d.sql(
		"drop event trigger task3_failure; drop function public.task3_fail_migration();",
	);
	assert.equal(d.status().maintenance, true);
	assert.equal(d.status().archivedRows, 47);
	assert.deepEqual(d.prepare(), d.status());
	pass(
		`real CLI failure at ${failAt} preserves archive and maintenance; retry cannot resnapshot`,
	);
}
d.apply();
assert.equal(d.status().phase, "chain_applied");
pass(
	"all 25 unchanged pending migrations applied by pinned CLI; restart before verification is safe",
);
const finished = d.finish();
assert.equal(finished.phase, "completed");
assert.equal(finished.maintenance, true);
assert.deepEqual(d.finish(), finished);
pass(
	"60-version finish verifies history emptiness, settings generation+1, all old product columns, manual grants and inactive policy/scheduler",
);
// Real final schema RPC still cannot bypass maintenance through its definer.
rejected(
	`set session authorization authenticator; set role service_role; select public.resolve_watch_history_access_v1(${uid});`,
	/PRODUCTION_HISTORY_MAINTENANCE/,
);
pass(
	"final real access-resolver SECURITY DEFINER cannot bypass durable maintenance",
);
// Restore the complete baseline, including migration history, in the SECOND
// dedicated container. Never roll back the transitioned database to fake proof.
const restoreContainer =
	"supabase_db_anidachi-prod-transition-restore-20260912";
function run(args) {
	const r = spawnSync("docker", args, {
		encoding: "utf8",
		timeout: 60_000,
		maxBuffer: 4 * 1024 * 1024,
	});
	assert.ifError(r.error);
	assert.equal(r.status, 0, r.stderr);
	return r.stdout.trim();
}
const identity = JSON.parse(
	run([
		"inspect",
		"--format",
		'{"labels":{{json .Config.Labels}},"ports":{{json .NetworkSettings.Ports}}}',
		restoreContainer,
	]),
);
assert.equal(
	identity.labels["com.supabase.cli.project"],
	"anidachi-prod-transition-restore-20260912",
);
assert.equal(
	identity.labels["com.docker.compose.project"],
	"anidachi-prod-transition-restore-20260912",
);
assert.ok(
	identity.ports["5432/tcp"].every(
		(p) => p.HostIp === "127.0.0.1" && p.HostPort === "55693",
	),
);
run([
	"cp",
	resolve(d.target.workdir, "baseline.dump"),
	`${restoreContainer}:/tmp/task3-baseline.dump`,
]);
run([
	"exec",
	"-e",
	"PGPASSWORD=task3-disposable-only",
	restoreContainer,
	"pg_restore",
	"-U",
	"supabase_admin",
	"-d",
	"postgres",
	"--clean",
	"--if-exists",
	"--exit-on-error",
	"/tmp/task3-baseline.dump",
]);
function restoredSql(query) {
	const r = spawnSync(
		"docker",
		[
			"exec",
			"-i",
			restoreContainer,
			"psql",
			"-U",
			"postgres",
			"-d",
			"postgres",
			"-XqAt",
			"-v",
			"ON_ERROR_STOP=1",
		],
		{ input: query, encoding: "utf8", timeout: 60_000 },
	);
	assert.equal(r.status, 0, r.stderr);
	return r.stdout.trim();
}
const restoredVersions = JSON.parse(
	restoredSql(
		"select jsonb_agg(version order by version) from supabase_migrations.schema_migrations;",
	),
);
assert.deepEqual(
	restoredVersions,
	manifest.migrations.slice(0, 35).map((m) => m.version),
);
const relations = d.json(
	`select jsonb_agg(to_jsonb(r) order by table_name) from ${S}.relations r;`,
);
for (const r of relations) {
	const columns = r.descriptor.columns
		.map((c) => `'${c.name}',to_jsonb(src)->'${c.name}'`)
		.join(",");
	const measured = JSON.parse(
		restoredSql(
			`select jsonb_build_object('count',count(*),'hash',encode(sha256(convert_to(coalesce(string_agg(row::text,E'\n' order by row::text),''),'UTF8')),'hex')) from (select jsonb_build_object(${columns}) row from public.${r.table_name} src) q;`,
		),
	);
	assert.deepEqual(
		measured,
		{ count: r.row_count, hash: r.row_hash },
		`Full baseline restore must recover ${r.table_name} exactly`,
	);
}
pass(
	`full baseline restore recovers exact original values in all ${relations.length} public relations and exact 35-version history`,
);
const report = {
	pass: true,
	kind: "local-synthetic-35-to-60-only",
	manifestSha256: finished.manifestSha256,
	bridgeSha256: d.document().bridgeSha256,
	backupSha256: finished.backupSha256,
	sourceCommit: manifest.sourceCommit,
	head: spawnSync("git", ["rev-parse", "HEAD"], {
		cwd: root,
		encoding: "utf8",
	}).stdout.trim(),
	cli: manifest.cli,
	target: d.target,
	restoredContainer: restoreContainer,
	checks,
	finished,
	productionApplyAuthorized: false,
};
report.testedFiles = Object.fromEntries(
	[
		"scripts/production-history-transition.mjs",
		"scripts/production-history-rehearsal.mjs",
		"scripts/production-history-transition.test.mjs",
		"scripts/production-deployment-hold.mjs",
		".github/workflows/db-production.yml",
		".github/workflows/deploy-api.yml",
		"apps/web/vercel.json",
		...[
			"manifest.json",
			"baseline-schema.json",
			"prepare.sql",
			"verify-archive.sql",
			"finish.sql",
			"fixture.sql",
		].map(
			(f) => `apps/web/supabase/operations/production-history-20260912/${f}`,
		),
	].map((file) => [
		file,
		createHash("sha256")
			.update(readFileSync(resolve(root, file)))
			.digest("hex"),
	]),
);
report.headIsOnlyCheckoutContext = true;
const out = resolve(d.target.workdir, "rehearsal-receipt.json");
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
console.log(`Receipt: ${out}`);
