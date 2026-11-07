// Explicit labeled, disconnected local Docker fixture only. No remote DB URLs.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const context = process.env.FREE20_TEST_DOCKER_CONTEXT;
const container = process.env.FREE20_TEST_CONTAINER;
assert.ok(
	context && container?.startsWith("anidachi-free20-"),
	"Explicit Free20 fixture required",
);
const run = (args, input = "") => {
	const result = spawnSync("docker", ["--context", context, ...args], {
		input,
		encoding: "utf8",
		timeout: 30000,
		maxBuffer: 8 * 1024 * 1024,
	});
	assert.ifError(result.error);
	assert.equal(result.status, 0, result.stderr);
	return result.stdout.trim();
};
const dockerContext = JSON.parse(run(["context", "inspect", context]))[0];
assert.match(
	dockerContext.Endpoints.docker.Host,
	/^unix:/,
	"Local Docker socket required",
);
const target = JSON.parse(run(["inspect", container]))[0];
assert.equal(target.Config.Labels["anidachi.disposable"], "true");
assert.equal(target.Config.Labels["anidachi.task"], "free20");
assert.equal(target.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(target.HostConfig.PortBindings ?? {}).length, 0);
assert.equal(target.Mounts.length, 0);
const args = [
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
];
const sql = (input) => run(args, input);
const sessions = [];
function session() {
	const process = spawn("docker", ["--context", context, ...args], {
		stdio: ["pipe", "pipe", "pipe"],
		timeout: 30000,
	});
	let output = "",
		error = "",
		pending,
		closed = false,
		ended = false;
	const stopped = new Promise((resolve) => process.on("close", resolve));
	process.stdout.on("data", (data) => {
		output += data;
		if (pending && output.includes(pending.marker)) {
			const { resolve, marker, timer } = pending;
			pending = undefined;
			clearTimeout(timer);
			const end = output.indexOf(marker);
			const value = output.slice(0, end).trim();
			output = output.slice(end + marker.length).trimStart();
			resolve(value);
		}
	});
	process.stderr.on("data", (data) => {
		error += data;
	});
	const fail = (e) => {
		closed = true;
		if (pending) {
			clearTimeout(pending.timer);
			pending.reject(e);
			pending = undefined;
		}
	};
	process.on("error", fail);
	process.on("close", (code) =>
		fail(new Error(`psql exited ${code}: ${error}`)),
	);
	const connection = {
		query(input) {
			assert.ok(!closed && !pending, "One statement barrier per live session");
			return new Promise((resolve, reject) => {
				const marker = `barrier_${randomUUID()}`;
				const timer = setTimeout(() => {
					pending = undefined;
					reject(new Error(`Transaction barrier timed out: ${error}`));
					process.kill();
				}, 15000);
				pending = { resolve, reject, marker, timer };
				process.stdin.write(`${input}\n\\echo ${marker}\n`);
			});
		},
		close() {
			if (!closed && !ended) {
				ended = true;
				process.stdin.end("rollback;\n\\q\n");
			}
			return stopped;
		},
	};
	sessions.push(connection);
	return connection;
}
// Wait for a real DB lock, not elapsed time. The blocked session must remain
// waiting until the test explicitly commits or rolls back its holder.
async function blocked(pid, holder) {
	const until = Date.now() + 8000;
	while (Date.now() < until) {
		if (sql(`select ${holder}=any(pg_blocking_pids(${pid}));`) === "t") return;
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	assert.fail(`Backend ${pid} never blocked on ${holder}`);
}

const oldPolicy = sql(
	"select to_jsonb(p) from public.hosting_commercial_policy p;",
);
const oldHistory = sql("select active from public.personal_history_policy;");
const receiptDirectory = mkdtempSync(join(tmpdir(), "free20-client-fixture-"));
writeFileSync(
	join(receiptDirectory, "original-state.json"),
	JSON.stringify({
		context,
		container,
		policy: JSON.parse(oldPolicy),
		historyActive: oldHistory,
	}),
);
console.log(`Fixture restore receipt: ${receiptDirectory}/original-state.json`);
const users = Array.from({ length: 9 }, () => randomUUID());
writeFileSync(
	join(receiptDirectory, "synthetic-users.json"),
	JSON.stringify(users),
);
const quoted = users.map((u) => `'${u}'`).join(",");

const coreSignature =
	"anidachi_room_private.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer)";
const coreDefinition = sql(
	`select pg_get_functiondef('${coreSignature}'::regprocedure);`,
);
writeFileSync(
	join(receiptDirectory, "original-core.sql"),
	coreDefinition + ";",
);
const create = (
	owner,
	current = false,
	request = "request",
	participant = "host",
) =>
	`select room_record->>'room_id' from public.create_room_with_active_session_${current ? "v4" : "v3"}('${owner}','${participant}',null,null,null,null,null,null,null,'${request}','free',4,4,false,false,3${current ? ",1" : ""});`;
const claim = (owner, room, current = false, participant = "host") =>
	`select outcome from public.claim_active_room_session_${current ? "v4" : "v3"}('${owner}','${room}','host','${participant}',3${current ? ",1" : ""});`;
const snapshot = (owner) =>
	sql(
		`select jsonb_build_object('rooms',(select jsonb_agg(to_jsonb(r) order by room_id) from public.rooms r where host_user_id='${owner}'),'assignments',(select jsonb_agg(to_jsonb(a)) from public.active_room_sessions a where user_id='${owner}'));`,
	);
const denied = (pending) =>
	pending.then(
		(value) => ({ value }),
		(error) => ({ error }),
	);
async function pair() {
	const holder = session(),
		waiter = session();
	const h = Number(await holder.query("select pg_backend_pid();"));
	const w = Number(await waiter.query("select pg_backend_pid();"));
	return { holder, waiter, h, w };
}
try {
	sql(`update public.personal_history_policy set active=true;
 insert into public.users(id,email,display_name) values ${users.map((u) => `('${u}','${u}@example.test','Client race')`).join(",")};`);
	// Policy writer wins first: old caller waits on the actual policy tuple lock.
	{
		const { holder, waiter, h, w } = await pair(),
			owner = users[0];
		await holder.query(
			"begin;update public.hosting_commercial_policy set free20_enabled=true,trials_enabled=false,activation_at=clock_timestamp()-interval '1 day';",
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = denied(waiter.query(create(owner)));
		await blocked(w, h);
		await holder.query("commit;");
		assert.match(
			(await waiting).error?.message ?? "",
			/ROOM_UPDATE_REQUIRED_FREE20/,
		);
		assert.equal(snapshot(owner), '{"rooms": null, "assignments": null}');
		await holder.close();
		await waiter.close();
		console.log(
			"PASS policy enable wins: actual old v3 waits then denies, no room/assignment",
		);
	}
	// Admission's shared policy lock wins: a legitimately pre-enable unmarked room
	// commits first; enable cannot silently adopt/backfill it.
	{
		sql(
			"update public.hosting_commercial_policy set free20_enabled=false,activation_at=null;",
		);
		const { holder, waiter, h, w } = await pair(),
			owner = users[1];
		await holder.query(
			"begin;select public.lock_hosting_commercial_policy_v1();",
		);
		await waiter.query("begin;");
		const enabling = waiter.query(
			"update public.hosting_commercial_policy set free20_enabled=true,trials_enabled=false,activation_at=clock_timestamp()-interval '1 day';",
		);
		await blocked(w, h);
		const room = await holder.query(
			`set local role service_role;${create(owner)}`,
		);
		await holder.query("commit;");
		await enabling;
		await waiter.query("commit;");
		assert.equal(
			sql(
				`select hosting_time_mode is null from public.rooms where room_id='${room}';`,
			),
			"t",
		);
		assert.throws(
			() => sql(`set role service_role;${claim(owner, room)}`),
			/HOST_SUBSCRIPTION_REQUIRED/,
		);
		await holder.close();
		await waiter.close();
		console.log(
			"PASS admission policy lock wins: legacy unmarked room stays unmarked and retains cutover denial",
		);
	}
	// Revocation wins the account advisory lock before the unsupported caller.
	{
		const owner = users[2];
		sql(
			`insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values('${owner}','plus',clock_timestamp()+interval '1 hour','client race');`,
		);
		const { holder, waiter, h, w } = await pair();
		await holder.query(
			`begin;select public.lock_hosting_commercial_policy_v1();select pg_advisory_xact_lock(hashtextextended('${owner}',0));update public.account_manual_plan_grants set valid_until=clock_timestamp()-interval '1 second' where user_id='${owner}';`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = denied(waiter.query(create(owner)));
		await blocked(w, h);
		await holder.query("commit;");
		assert.match(
			(await waiting).error?.message ?? "",
			/ROOM_UPDATE_REQUIRED_FREE20/,
		);
		assert.equal(snapshot(owner), '{"rooms": null, "assignments": null}');
		await holder.close();
		await waiter.close();
		console.log(
			"PASS grant revocation wins account lock: old caller resolves Free and denies",
		);
	}
	// Deterministic test-only barrier at private-core entry, after outer preflight.
	// Only this disconnected fixture is altered; restore its exact function in finally.
	{
		const owner = users[3],
			key = 706203;
		const anchor = "begin\n  select active into strict v_policy";
		assert.equal(coreDefinition.split(anchor).length, 2);
		sql(
			coreDefinition.replace(
				anchor,
				`begin\n  perform pg_advisory_xact_lock(70620,${key});\n  select active into strict v_policy`,
			) + ";",
		);
		const { holder, waiter, h, w } = await pair();
		await holder.query(`begin;select pg_advisory_xact_lock(70620,${key});`);
		sql(
			`insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values('${owner}','plus',clock_timestamp()+interval '2 seconds','client expiry race');`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = denied(waiter.query(create(owner)));
		await blocked(w, h); // reaching this core proves unsupported outer preflight saw paid
		await holder.query(
			`select pg_sleep(greatest(0,extract(epoch from (select valid_until-clock_timestamp() from public.account_manual_plan_grants where user_id='${owner}')))+0.1);commit;`,
		);
		assert.match(
			(await waiting).error?.message ?? "",
			/ROOM_UPDATE_REQUIRED_FREE20/,
		);
		assert.equal(snapshot(owner), '{"rooms": null, "assignments": null}');
		await holder.close();
		await waiter.close();
		sql(coreDefinition + ";");
		console.log(
			"PASS paid expires between outer and inner canonical reads under held account/policy locks: final core denies before mutations",
		);
	}
	for (const replacement of [false, true]) {
		const owner = users[replacement ? 5 : 4];
		const initial = replacement
			? sql(`set role service_role;${create(owner, true)}`)
			: null;
		const { holder, waiter, h, w } = await pair();
		await holder.query("begin;set local role service_role;");
		const result = await holder.query(
			replacement
				? claim(owner, initial, true, "current-replacement")
				: create(owner, true),
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = denied(
			waiter.query(
				replacement
					? claim(owner, initial, false, "old-replacement")
					: create(owner, false, "request", "old-replay"),
			),
		);
		await blocked(w, h);
		await holder.query("commit;");
		const winner = snapshot(owner);
		assert.match(
			(await waiting).error?.message ?? "",
			/ROOM_UPDATE_REQUIRED_FREE20/,
		);
		assert.equal(snapshot(owner), winner);
		assert.equal(
			sql(`select count(*) from public.rooms where host_user_id='${owner}';`),
			"1",
		);
		assert.ok(result);
		await holder.close();
		await waiter.close();
		console.log(
			`PASS current/old ${replacement ? "host replacement" : "same-request create"} race: current winner preserved byte-for-byte`,
		);
	}
	// Old client can win scheduling, never admission. Its rollback releases all
	// locks so a waiting supported caller can create the sole marked room.
	{
		const owner = users[6],
			{ holder, waiter, h, w } = await pair();
		await holder.query(
			`begin;select public.lock_hosting_commercial_policy_v1();select pg_advisory_xact_lock(hashtextextended('${owner}',0));`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = waiter.query(create(owner, true));
		await blocked(w, h);
		const rejected = await denied(
			holder.query(`set local role service_role;${create(owner)}`),
		);
		assert.match(rejected.error?.message ?? "", /ROOM_UPDATE_REQUIRED_FREE20/);
		assert.ok(await waiting);
		await waiter.query("commit;");
		assert.equal(
			sql(`select count(*) from public.rooms where host_user_id='${owner}';`),
			"1",
		);
		await holder.close();
		await waiter.close();
		console.log(
			"PASS old caller rolls back first; waiting supported caller creates sole room",
		);
	}
	// The preliminary host can change before the room lock. Reject without taking
	// a newly discovered host lock in the wrong order.
	{
		const owner = users[7],
			newHost = users[8],
			room = sql(`set role service_role;${create(owner, true)}`);
		const { holder, waiter, h, w } = await pair();
		await holder.query(
			`begin;select public.lock_hosting_commercial_policy_v1();select pg_advisory_xact_lock(hashtextextended('${owner}',0));`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = denied(waiter.query(claim(owner, room, true)));
		await blocked(w, h);
		await holder.query(
			`update public.rooms set host_user_id='${newHost}' where room_id='${room}';commit;`,
		);
		assert.match(
			(await waiting).error?.message ?? "",
			/ROOM_AUTHORITY_UNAVAILABLE/,
		);
		assert.equal(
			sql(
				`select participant_session_id from public.active_room_sessions where user_id='${owner}';`,
			),
			"host",
		);
		await holder.close();
		await waiter.close();
		console.log(
			"PASS changed host identity is rejected after room lock without inverted account locking",
		);
	}
} finally {
	await Promise.all(sessions.map((s) => s.close()));
	sql(coreDefinition + ";");
	sql(`delete from public.active_room_sessions where user_id in(${quoted});
 delete from public.rooms where host_user_id in(${quoted});delete from public.users where id in(${quoted});
 update public.personal_history_policy set active=${oldHistory === "t"};
 update public.hosting_commercial_policy set free20_enabled=(p.j->>'free20_enabled')::boolean,trials_enabled=(p.j->>'trials_enabled')::boolean,activation_at=(p.j->>'activation_at')::timestamptz from(select '${oldPolicy.replaceAll("'", "''")}'::jsonb j) p;`);
	assert.equal(
		sql("select to_jsonb(p) from public.hosting_commercial_policy p;"),
		oldPolicy,
	);
	assert.equal(
		sql("select active from public.personal_history_policy;"),
		oldHistory,
	);
	assert.equal(
		sql(`select pg_get_functiondef('${coreSignature}'::regprocedure);`),
		coreDefinition,
	);
	assert.equal(
		sql(`select count(*) from public.users where id in(${quoted});`),
		"0",
	);
	console.log(
		"PASS cleanup: exact policy/history/core restored, synthetic users/rooms/assignments removed",
	);
}
