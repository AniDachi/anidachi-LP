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
const receiptDirectory = mkdtempSync(join(tmpdir(), "free20-warning-fixture-"));
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
const users = Array.from({ length: 5 }, () => randomUUID());
writeFileSync(
	join(receiptDirectory, "synthetic-users.json"),
	JSON.stringify(users),
);
const quoted = users.map((u) => `'${u}'`).join(",");
const literal = (value) =>
	`'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
function projection(owner, remaining = 300, metering = false) {
	const raw = JSON.parse(
		sql(
			`set role service_role;select public.read_free20_account_status_v1('${owner}');`,
		),
	);
	const { enabled, committedSeconds, ...context } = raw;
	for (const key of ["serverTime", "refreshBy", "resetAt"])
		context[key] = Date.parse(context[key]);
	context.utcDay = new Date(context.serverTime).toISOString().slice(0, 10);
	const live = {
		liveStatusVersion: 1,
		ownerUserId: owner,
		roomId: context.assignment.roomId,
		roomGeneration: 1,
		utcDay: context.utcDay,
		serverTime: context.serverTime,
		validUntil: context.refreshBy,
		access: {
			kind: "daily_free",
			budgetSeconds: 1200,
			usedSeconds: 1200 - remaining,
			remainingSeconds: remaining,
			metering,
		},
	};
	return { context, live };
}
const claim = (owner, { context, live }) =>
	`select public.claim_free20_daily_warning_v1('${owner}',${literal(context)},${literal(live)})->>'decision';`;
const count = (owner) =>
	sql(
		`select count(*) from public.free20_daily_warning_claims where user_id='${owner}';`,
	);
try {
	sql(`update public.personal_history_policy set active=true; update public.hosting_commercial_policy set free20_enabled=true,trials_enabled=false,activation_at=now()-interval '1 day';
 insert into public.users(id,email,display_name) values ${users.map((u) => `('${u}','${u}@example.test','Warning race')`).join(",")};`);
	for (const owner of users)
		sql(
			`set role service_role;select room_record->>'room_id' from public.create_room_with_active_session_v3('${owner}','warning-host',null,null,null,null,null,null,null,'${owner}','free',4,4,false,false,3);`,
		);
	for (const rollback of [false, true]) {
		const owner = users[rollback ? 1 : 0],
			measurement = projection(owner);
		const first = session(),
			second = session();
		const firstPid = Number(await first.query("select pg_backend_pid();"));
		const secondPid = Number(await second.query("select pg_backend_pid();"));
		await first.query("begin;set local role service_role;");
		assert.equal(await first.query(claim(owner, measurement)), "show");
		await second.query("begin;set local role service_role;");
		const next = second.query(claim(owner, measurement));
		await blocked(secondPid, firstPid);
		await first.query(rollback ? "rollback;" : "commit;");
		assert.equal(await next, rollback ? "show" : "already_claimed");
		await second.query("commit;");
		assert.equal(count(owner), "1");
		assert.equal(
			sql(`set role service_role;${claim(owner, projection(owner))}`),
			"already_claimed",
		);
		await first.close();
		await second.close();
		console.log(
			`PASS two real sessions: ${rollback ? "rollback releases claim to waiter" : "exactly one committed show, waiter and replay already_claimed"}`,
		);
	}
	// Keep an explicit account authority lock while the live observation expires.
	const owner = users[2],
		measurement = projection(owner, 1, true);
	measurement.live.validUntil = measurement.live.serverTime + 600;
	const holder = session(),
		waiter = session();
	const holderPid = Number(await holder.query("select pg_backend_pid();"));
	const waiterPid = Number(await waiter.query("select pg_backend_pid();"));
	await holder.query(
		`begin;select public.read_free20_account_status_v1('${owner}')->>'accessEpoch';`,
	);
	await waiter.query("begin;set local role service_role;");
	const waiting = waiter.query(claim(owner, measurement)).then(
		() => null,
		(e) => e,
	);
	await blocked(waiterPid, holderPid);
	await holder.query("select pg_sleep(0.7);commit;");
	assert.match((await waiting)?.message ?? "", /HOSTING_WARNING_UNAVAILABLE/);
	assert.equal(count(owner), "0");
	await holder.close();
	console.log(
		"PASS observation expires while blocked: fresh clock rejects without marker",
	);
	for (const scenario of ["session", "paid"]) {
		const owner = users[scenario === "session" ? 3 : 4],
			measurement = projection(owner);
		const holder = session(),
			waiter = session();
		const holderPid = Number(await holder.query("select pg_backend_pid();"));
		const waiterPid = Number(await waiter.query("select pg_backend_pid();"));
		await holder.query(
			`begin;select public.read_free20_account_status_v1('${owner}')->>'accessEpoch';`,
		);
		await holder.query(
			scenario === "session"
				? `update public.active_room_sessions set participant_session_id='replacement' where user_id='${owner}';`
				: `insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values('${owner}','plus',clock_timestamp()+interval '1 hour','Warning race');`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = waiter.query(claim(owner, measurement)).then(
			(value) => ({ value }),
			(error) => ({ error }),
		);
		await blocked(waiterPid, holderPid);
		await holder.query("commit;");
		const result = await waiting;
		if (scenario === "session")
			assert.match(
				result.error?.message ?? "",
				/HOSTING_WARNING_CONTEXT_CHANGED/,
			);
		else {
			assert.equal(result.value, "not_eligible");
			await waiter.query("commit;");
		}
		assert.equal(count(owner), "0");
		await holder.close();
		await waiter.close();
		console.log(
			`PASS ${scenario} changes while blocked: ${scenario === "paid" ? "not_eligible" : "context conflict"}, no marker`,
		);
	}
} finally {
	await Promise.all(sessions.map((s) => s.close()));
	sql(`delete from public.active_room_sessions where user_id in(${quoted});
 delete from public.rooms where host_user_id in(${quoted});
 delete from public.users where id in(${quoted});
 update public.personal_history_policy set active=${oldHistory === "t"};
 update public.hosting_commercial_policy set free20_enabled=(p.j->>'free20_enabled')::boolean,trials_enabled=(p.j->>'trials_enabled')::boolean,activation_at=(p.j->>'activation_at')::timestamptz from(select '${oldPolicy.replaceAll("'", "''")}'::jsonb j) p;`);
	assert.equal(
		sql("select to_jsonb(p) from public.hosting_commercial_policy p;"),
		oldPolicy,
	);
	assert.equal(
		sql(`select count(*) from public.users where id in(${quoted});`),
		"0",
	);
}
