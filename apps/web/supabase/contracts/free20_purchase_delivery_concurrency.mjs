// Real transactions; accepts only an explicitly labelled, isolated task fixture.
// This is not a full migration replay or hosted-system acceptance test.
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
			code === 0
				? resolve(out.trim())
				: reject(new Error(err || `exit ${code}`)),
		);
		child.stdin.end(input);
	});
}
const inspected = JSON.parse(await docker(["inspect", container]))[0];
for (const [key, value] of Object.entries({
	"anidachi.disposable": "true",
	"anidachi.task": "free20",
	"anidachi.block": "purchase-delivery",
}))
	assert.equal(inspected.Config.Labels[key], value);
assert.equal(inspected.HostConfig.NetworkMode, "none");
assert.deepEqual(inspected.HostConfig.PortBindings, {});
assert.deepEqual(inspected.Mounts, []);
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
assert.equal(
	await sql("show cron.launch_active_jobs;"),
	"off",
	"fixture cron execution must be disabled",
);
const policy = JSON.parse(
	await sql("select row_to_json(p) from public.hosting_commercial_policy p;"),
);
assert.equal(
	policy.free20_enabled,
	false,
	"do not replace another enabled scenario",
);
const history = await sql("select active from public.personal_history_policy;");
const owner = randomUUID(),
	rollbackOwner = randomUUID();
const sub = `sub_fixture_${owner}`;
let room;
const purchase = (
	who = owner,
	status = "active",
) => `set local role service_role; do $$declare lease jsonb; begin
 lease:=public.begin_stripe_subscription_refresh_v1('sub_fixture_${who}');
 perform public.commit_stripe_subscription_refresh_v4('sub_fixture_${who}',(lease->>'fence')::bigint,(lease->>'token')::uuid,'${who}','cus_fixture_${who}','price_fixture','plus','${status}',now()+interval '30 days',false,null);
end $$; reset role;`;
const claimSql = `select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from public.claim_free20_room_refresh_v1(4,'${owner}') q;`;
const claim = async () =>
	JSON.parse(await sql(`set role service_role; ${claimSql}`));
const finish = (job) =>
	`select public.finish_free20_room_refresh_v1('${owner}','${job.room_id}',${job.room_generation},${job.lease_revision},'${job.lease_token}','applied');`;
let assertions = 0;
function check(value, expected, message) {
	assert.deepEqual(value, expected, message);
	console.log(`ok ${++assertions} - ${message}`);
}
function held(input, marker) {
	let started;
	const ready = new Promise((resolve) => {
		started = resolve;
	});
	const done = sql(input, (out) => {
		if (out.includes(marker)) started();
	});
	// SQL errors also reject ready, so a failed barrier cannot hang the runner.
	return {
		ready: Promise.race([
			ready,
			done.then(() => {
				throw new Error(`barrier ${marker} missing`);
			}),
		]),
		done,
	};
}
try {
	await sql(`insert into public.users(id,email,display_name) values('${owner}','${owner}@example.test','Concurrent purchase'),('${rollbackOwner}','${rollbackOwner}@example.test','Rollback purchase');
 update public.personal_history_policy set active=true;
 update public.hosting_commercial_policy set activation_at=clock_timestamp()-interval '1 day',free20_enabled=true;`);
	const create = async (who) =>
		JSON.parse(
			await sql(`set role service_role;
 select room_record from public.create_room_with_active_session_v3('${who}','fixture-host',null,null,null,null,null,null,null,'fixture-${who}','free',4,4,false,false,3);`),
		);
	room = (await create(owner)).room_id;
	await create(rollbackOwner);
	// A durable v4 transaction is not drainable before COMMIT.
	const commitTx = held(
		`begin;${purchase()}select 'COMMIT_PENDING';select pg_sleep(0.8);commit;`,
		"COMMIT_PENDING",
	);
	await commitTx.ready;
	check(
		await claim(),
		[],
		"uncommitted subscription+outbox is invisible to drain",
	);
	await commitTx.done;
	check(
		await sql(
			`select status from public.subscriptions where stripe_subscription_id='${sub}';`,
		),
		"active",
		"v4 mirror is durable after commit",
	);
	// Two overlapping claimers cannot deliver the same revision.
	const claimTx = held(
		`begin;set local role service_role;${claimSql}select 'CLAIM_HELD';select pg_sleep(0.8);commit;`,
		"CLAIM_HELD",
	);
	await claimTx.ready;
	check(await claim(), [], "SKIP LOCKED excludes concurrently held claim");
	const first = JSON.parse((await claimTx.done).split("\n")[0])[0];
	check(first.lease_revision, 1, "first committed delivery is revision one");
	check(await claim(), [], "committed lease blocks duplicate scheduled drain");
	// Enqueue holds the row; concurrent finish must re-read the newest revision.
	const enqueueTx = held(
		`begin;${purchase()}select 'ENQUEUE_HELD';select pg_sleep(0.8);commit;`,
		"ENQUEUE_HELD",
	);
	await enqueueTx.ready;
	const oldFinish = sql(`set role service_role;${finish(first)}`);
	await enqueueTx.done;
	check(
		await oldFinish,
		"superseded",
		"ACK racing coalescing commit cannot consume newer revision",
	);
	let current = (await claim())[0];
	check(current.lease_revision, 2, "newer revision is claimable after old ACK");
	// A finish started before expiry but waiting for a row lock must fail AFTER expiry.
	await sql(
		`update public.free20_room_refresh_outbox set lease_until=clock_timestamp()+interval '0.3 seconds' where owner_user_id='${owner}';`,
	);
	const lockTx = held(
		`begin;select owner_user_id from public.free20_room_refresh_outbox where owner_user_id='${owner}' for update;select 'EXPIRY_LOCK_HELD';select pg_sleep(0.8);commit;`,
		"EXPIRY_LOCK_HELD",
	);
	await lockTx.ready;
	const expiredFinish = sql(`set role service_role;${finish(current)}`);
	await lockTx.done;
	check(
		await expiredFinish,
		"stale",
		"lease expiration is checked after waiting for row lock",
	);
	const reclaimers = await Promise.all([claim(), claim()]);
	check(
		reclaimers.map((r) => r.length).sort(),
		[0, 1],
		"expired lease is reclaimed by exactly one concurrent caller",
	);
	current = reclaimers.flat()[0];
	check(
		await sql(`set role service_role;${finish(current)}`),
		"completed",
		"winning reclaimed lease completes current revision",
	);
	// Real transaction ROLLBACK cannot leave mirror or pending work behind.
	const rollbackTx = held(
		`begin;${purchase(rollbackOwner)}select 'ROLLBACK_PENDING';select pg_sleep(0.8);rollback;`,
		"ROLLBACK_PENDING",
	);
	await rollbackTx.ready;
	check(
		await sql(
			`select count(*) from public.free20_room_refresh_outbox where owner_user_id='${rollbackOwner}';`,
		),
		"0",
		"in-flight rollback fixture is invisible to recovery",
	);
	await rollbackTx.done;
	check(
		await sql(
			`select count(*) from public.subscriptions where user_id='${rollbackOwner}';`,
		),
		"0",
		"rolled-back mirror is absent",
	);
	check(
		await sql(
			`select count(*) from public.free20_room_refresh_outbox where owner_user_id='${rollbackOwner}';`,
		),
		"0",
		"rolled-back outbox is absent",
	);
	console.log(`1..${assertions}`);
} finally {
	await sql(`delete from public.rooms where host_user_id in ('${owner}','${rollbackOwner}');
 delete from public.users where id in ('${owner}','${rollbackOwner}');
 delete from public.stripe_subscription_refresh_leases where subscription_id in ('${sub}','sub_fixture_${rollbackOwner}');
 update public.hosting_commercial_policy set activation_at=${policy.activation_at ? `'${policy.activation_at}'` : "null"},free20_enabled=false;
 update public.personal_history_policy set active=${history === "t" ? "true" : "false"};`);
}
