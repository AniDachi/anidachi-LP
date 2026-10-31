// Real transactions in an explicitly disposable local Docker database only.
// Apply repository migrations first. No database URLs, credentials or remote targets.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const context = process.env.FREE20_DOCKER_CONTEXT;
const container = process.env.FREE20_TEST_CONTAINER;
assert.ok(context && container?.startsWith("anidachi-free20-"));
function docker(args, input = "", onData) {
	return new Promise((resolve, reject) => {
		const child = spawn("docker", ["--context", context, ...args], {
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 20_000,
		});
		let out = "",
			err = "";
		child.stdout.on("data", (data) => {
			out += data;
			onData?.(out);
		});
		child.stderr.on("data", (data) => {
			err += data;
		});
		child.on("error", reject);
		child.on("close", (code) =>
			code === 0 ? resolve(out.trim()) : reject(new Error(err)),
		);
		child.stdin.end(input);
	});
}
const inspected = JSON.parse(await docker(["inspect", container]))[0];
assert.equal(inspected.Config.Labels["anidachi.disposable"], "true");
assert.equal(inspected.Config.Labels["anidachi.task"], "free20");
assert.equal(inspected.HostConfig.NetworkMode, "none");
const sql = (input, onData) =>
	docker(
		[
			"exec",
			"-i",
			container,
			"psql",
			"-U",
			"postgres",
			"-d",
			"postgres",
			"-XqAt",
			"-v",
			"ON_ERROR_STOP=1",
		],
		input,
		onData,
	);
const policy = JSON.parse(
	await sql("select row_to_json(p) from public.hosting_commercial_policy p;"),
);
assert.equal(
	policy.free20_enabled,
	false,
	"Do not overwrite another enabled test scenario",
);
const history = await sql("select active from public.personal_history_policy;");
const owner = randomUUID();
let room;
const create = (request, session = request) => `set role service_role;
 select jsonb_build_object('outcome',outcome,'roomId',room_record->>'room_id')
 from public.create_room_with_active_session_v3('${owner}','${session}',null,null,null,null,null,null,null,'${request}','pro',15,8,true,true,3);`;
try {
	await sql(`insert into public.users(id,email,display_name) values('${owner}','${owner}@example.test','Concurrent Free20');
 update public.personal_history_policy set active=true;
 update public.hosting_commercial_policy set activation_at=coalesce(activation_at,clock_timestamp()-interval '1 second'),free20_enabled=true;`);
	const concurrent = (
		await Promise.all([sql(create("a")), sql(create("b"))])
	).map(JSON.parse);
	assert.deepEqual(concurrent.map((r) => r.outcome).sort(), [
		"claimed",
		"conflict",
	]);
	const winner = concurrent[0].outcome === "claimed" ? "a" : "b";
	room = concurrent.find((r) => r.roomId).roomId;
	assert.equal(
		await sql(
			`select count(*) from public.rooms where host_user_id='${owner}';`,
		),
		"1",
	);
	const replay = JSON.parse(await sql(create(winner, "replacement-tab")));
	assert.equal(replay.roomId, room);
	assert.equal(replay.outcome, "reused");
	assert.equal(
		await sql(
			`select count(*) from public.active_room_sessions where user_id='${owner}';`,
		),
		"1",
	);
	// A terminal transaction must persist the full usage before its assignment
	// deletion becomes visible. The new create waits, then rechecks the new ledger.
	let releaseReady;
	const ready = new Promise((resolve) => {
		releaseReady = resolve;
	});
	const finishing = sql(
		`begin; set local role service_role;
 select public.commit_room_usage_day_v1('${room}',(clock_timestamp() at time zone 'UTC')::date,1200);
 select * from public.finalize_room_usage('${room}',clock_timestamp(),(clock_timestamp() at time zone 'UTC')::date,1200);
 select 'SETTLEMENT_PENDING'; select pg_sleep(0.6); commit;`,
		(out) => {
			if (out.includes("SETTLEMENT_PENDING")) releaseReady();
		},
	);
	await Promise.race([
		ready,
		finishing.then(() => {
			throw new Error("missing settlement barrier");
		}),
	]);
	await assert.rejects(sql(create("after-end")), /QUOTA_EXHAUSTED/);
	await finishing;
	assert.equal(
		await sql(
			`select count(*) from public.rooms where host_user_id='${owner}';`,
		),
		"1",
	);
	assert.equal(
		await sql(
			`select host_seconds from public.usage_daily where user_id='${owner}' and day=(clock_timestamp() at time zone 'UTC')::date;`,
		),
		"1200",
	);
	await sql(
		`set role service_role; select public.commit_room_usage_day_v1('${room}',(clock_timestamp() at time zone 'UTC')::date,1200);`,
	);
	assert.equal(
		await sql(
			`select host_seconds from public.usage_daily where user_id='${owner}' and day=(clock_timestamp() at time zone 'UTC')::date;`,
		),
		"1200",
	);
	await assert.rejects(
		sql(
			`set role service_role; select public.commit_room_usage_day_v1('${room}',(clock_timestamp() at time zone 'UTC')::date,1201);`,
		),
		/ROOM_USAGE_ENDED/,
	);
	assert.equal(
		await sql(
			`select count(*) from public.active_room_sessions where user_id='${owner}';`,
		),
		"0",
	);
	console.log(
		"PASS real concurrent creates: one room/assignment; replay reuses; pending terminal settlement blocks a new allowance; retry does not double-charge; ended room cannot append usage.",
	);
} finally {
	await sql(`update public.hosting_commercial_policy set free20_enabled=false,activation_at=${policy.activation_at ? `'${policy.activation_at}'::timestamptz` : "null"};
 update public.personal_history_policy set active=${history === "t"};
 delete from public.rooms where host_user_id='${owner}'; delete from public.users where id='${owner}';`);
}
