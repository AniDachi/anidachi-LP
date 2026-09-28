// Disposable Docker database only; verifies real locks and a wall-clock cutover.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const context = process.env.PAID_HOSTING_DOCKER_CONTEXT;
const container = process.env.PAID_HOSTING_TEST_CONTAINER;
assert.ok(context && container?.startsWith("anidachi-paid-hosting-"));
function docker(args, input = "") {
	return new Promise((resolve, reject) => {
		const p = spawn("docker", ["--context", context, ...args], {
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 30000,
		});
		let out = "",
			err = "";
		p.stdout.on("data", (v) => {
			out += v;
		});
		p.stderr.on("data", (v) => {
			err += v;
		});
		p.on("error", reject);
		p.on("close", (code) =>
			code === 0 ? resolve(out) : reject(new Error(err)),
		);
		p.stdin.end(input);
	});
}
const inspected = JSON.parse(await docker(["inspect", container]))[0];
assert.equal(inspected.Config.Labels["anidachi.disposable"], "true");
assert.equal(inspected.Config.Labels["anidachi.task"], "paid-hosting");
const sql = (input) =>
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
	);
const baseline = JSON.parse(
	(
		await sql("select row_to_json(p) from public.hosting_commercial_policy p;")
	).trim(),
);
assert.equal(
	baseline.activation_at,
	null,
	"Do not override an already active test scenario",
);
assert.equal(baseline.trials_enabled, false);
const a = randomUUID(),
	b = randomUUID(),
	free = randomUUID();
try {
	await sql(`insert into public.users(id,email,display_name) values
 ('${a}','${a}@example.test','Concurrent host A'),('${b}','${b}@example.test','Concurrent host B'),('${free}','${free}@example.test','Cutover Free');
 insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values
 ('${a}','pro',now()+interval '1 day','hosting concurrency'),('${b}','pro',now()+interval '1 day','hosting concurrency');
 update public.hosting_commercial_policy set activation_at=clock_timestamp()-interval '1 second';`);
	const create = (owner) =>
		`set role service_role; select room_record->>'room_id' from public.create_room_with_active_session_v3('${owner}','host-session',null,null,null,null,null,null,null,'concurrent-${owner}','pro',15,8,true,true,3);`;
	const rooms = await Promise.all([sql(create(a)), sql(create(b))]);
	const [roomA, roomB] = rooms.map((s) => s.trim());
	assert.match(roomA, /^[a-zA-Z0-9-]+$/);
	assert.match(roomB, /^[a-zA-Z0-9-]+$/);
	await sql(
		`insert into public.room_members(room_id,user_id) values('${roomA}','${b}'),('${roomB}','${a}');`,
	);
	const join = (
		user,
		room,
	) => `begin;set local role service_role;set local statement_timeout='10s';set local lock_timeout='5s';
 select outcome from public.claim_active_room_session_v3('${user}','${room}','member','crossed',3);select pg_sleep(0.2);commit;`;
	const results = await Promise.all([sql(join(a, roomB)), sql(join(b, roomA))]);
	assert.deepEqual(
		results.map((s) => s.trim()),
		["conflict", "conflict"],
		"Crossed guest/host checks retain assignments without a deadlock",
	);
	await sql(
		"update public.hosting_commercial_policy set activation_at=clock_timestamp()+interval '2 seconds';",
	);
	await assert.rejects(
		sql(`begin;set local role service_role;
 select public.require_room_hosting_access_v1('${free}');
 do $$begin
  if clock_timestamp()>=(select activation_at from public.hosting_commercial_policy) then
   raise exception 'preflight missed its pre-T window';
  end if;
  raise notice 'PRE_T_HOSTING_ALLOWED';
 end$$;
 select pg_sleep(2.2);
 insert into public.rooms(room_id,host_user_id,host_plan_code,status) values('cutover-${free}','${free}','free','lobby');commit;`),
		(error) => {
			assert.match(error.message, /PRE_T_HOSTING_ALLOWED/);
			assert.match(error.message, /HOST_SUBSCRIPTION_REQUIRED/);
			return true;
		},
	);
	assert.equal(
		(
			await sql(
				`select count(*) from public.rooms where host_user_id='${free}';`,
			)
		).trim(),
		"0",
	);
	console.log(
		"PASS: crossed host/member transactions avoid deadlock; insertion after T rejects an earlier successful Free preflight.",
	);
} finally {
	await sql(`update public.hosting_commercial_policy set activation_at=null,trials_enabled=false;
 delete from public.rooms where host_user_id in ('${a}','${b}','${free}');
 delete from public.users where id in ('${a}','${b}','${free}');`);
}
