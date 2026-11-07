// Explicit labeled, disconnected local Docker fixture only. No remote DB URLs.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

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
const users = Array.from({ length: 14 }, () => randomUUID());
const hashes = Array.from({ length: 30 }, () =>
	randomUUID().replaceAll("-", "").repeat(2),
);
const quoted = users.map((u) => `'${u}'`).join(",");
const day = "(clock_timestamp() at time zone 'UTC')::date";
const create = (u, b, i, req = "create") =>
	`select room_record->>'room_id' from public.create_room_with_active_session_v5('${u}','host',null,null,null,null,null,null,null,'${req}','free',4,4,false,false,3,1,'${b}','${i}');`;
const commit = (r, n) =>
	`select public.commit_room_usage_day_v1('${r}',${day},${n});`;
const finish = (r, n) =>
	`select * from public.finalize_room_usage('${r}',clock_timestamp(),${day},${n});`;
const attach = (u, r, b, i) =>
	`select public.attach_free20_room_context_v1('${u}','${r}','${b}','${i}');`;
const denied = (p) =>
	p.then(
		(value) => ({ value }),
		(error) => ({ error }),
	);
async function pair() {
	const holder = session(),
		waiter = session();
	const h = Number(await holder.query("select pg_backend_pid();")),
		w = Number(await waiter.query("select pg_backend_pid();"));
	return { holder, waiter, h, w };
}
const assertUsage = (r, n) =>
	assert.equal(
		sql(`select public.read_free20_room_usage_v1('${r}',${day});`),
		String(n),
	);
const coreSignature =
	"anidachi_room_private.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer)";
const coreDefinition = sql(
	`select pg_get_functiondef('${coreSignature}'::regprocedure);`,
);
try {
	sql(`update public.personal_history_policy set active=true;
 insert into public.users(id,email,display_name) values ${users.map((u) => `('${u}','${u}@example.test','Scoped race')`).join(",")};
 update public.hosting_commercial_policy set free20_enabled=true,trials_enabled=false,free20_abuse_enabled=true,activation_at=clock_timestamp()-interval '1 day';`);
	// A room-first first-ever ACK must not deadlock against account-first replay.
	// usage_daily's INSERT checks the user FK: admission's user lock must remain
	// compatible with KEY SHARE (NO KEY UPDATE, not FOR UPDATE).
	{
		const owner = users[0],
			room = sql(
				`set role service_role;${create(owner, hashes[0], hashes[1])}`,
			);
		const { holder, waiter, h, w } = await pair();
		await holder.query(
			`begin; select room_id from public.rooms where room_id='${room}' for update;`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = denied(waiter.query(create(owner, hashes[0], hashes[1])));
		await blocked(w, h);
		await holder.query(
			`set local role service_role;${commit(room, 720)}commit;`,
		);
		const replay = await waiting;
		assert.equal(replay.value, room, replay.error?.message);
		await waiter.query("commit;");
		assertUsage(room, 720);
		await holder.close();
		await waiter.close();
		console.log(
			"PASS room-first first ACK versus same-account replay: FK lock compatibility, no deadlock",
		);
	}
	// Different accounts compete for one pair: exactly one reservation wins.
	{
		const { holder, waiter, h, w } = await pair();
		await holder.query("begin;set local role service_role;");
		const room = await holder.query(create(users[1], hashes[2], hashes[3]));
		await waiter.query("begin;set local role service_role;");
		const waiting = denied(
			waiter.query(create(users[2], hashes[2], hashes[3])),
		);
		await blocked(w, h);
		await holder.query("commit;");
		assert.match((await waiting).error?.message ?? "", /FREE20_CONTEXT_BUSY/);
		assert.equal(
			sql(
				`select count(*) from anidachi_room_private.free20_room_bindings where marker_hash in('${hashes[2]}','${hashes[3]}') and settled_at is null;`,
			),
			"2",
		);
		assert.equal(
			sql(
				`select count(*) from public.rooms where host_user_id='${users[2]}';`,
			),
			"0",
		);
		await holder.close();
		await waiter.close();
		console.log(
			"PASS competing accounts: one bound pair, loser has no room/session",
		);
		// Terminal ACK holds marker reservation until commit; waiter then inherits720.
		const f = await pair();
		await f.holder.query(
			`begin;set local role service_role;${finish(room, 720)}`,
		);
		await f.waiter.query("begin;set local role service_role;");
		const next = f.waiter.query(create(users[2], hashes[2], hashes[3]));
		await blocked(f.w, f.h);
		await f.holder.query("commit;");
		const nextRoom = await next;
		await f.waiter.query("commit;");
		assertUsage(nextRoom, 720);
		assert.equal(
			sql(
				`select public.resolve_free20_context_access_v1('${users[2]}','${hashes[2]}','${hashes[3]}')->>'remainingSeconds';`,
			),
			"480",
		);
		await f.holder.close();
		await f.waiter.close();
		console.log(
			"PASS create versus final settlement: reservation release and inherited 480 are atomic",
		);
	}
	// ACK first: attach must include the cumulative write that was pending.
	{
		const owner = users[3],
			room = sql(
				`set role service_role;${create(owner, hashes[4], hashes[5])}`,
			);
		const { holder, waiter, h, w } = await pair();
		await holder.query(
			`begin;set local role service_role;${commit(room, 100)}`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = waiter.query(attach(owner, room, hashes[6], hashes[7]));
		await blocked(w, h);
		await holder.query("commit;");
		await waiting;
		await waiter.query("commit;");
		sql(`set role service_role;${commit(room, 150)}`);
		assertUsage(room, 150);
		assert.equal(
			sql(
				`select min(committed_seconds)||':'||max(committed_seconds) from anidachi_room_private.free20_marker_days where marker_hash in('${hashes[4]}','${hashes[5]}','${hashes[6]}','${hashes[7]}');`,
			),
			"150:150",
		);
		await holder.close();
		await waiter.close();
		console.log(
			"PASS pending ACK versus attachment: all four scopes receive150 exactly once",
		);
	}
	// Attach first: a higher incoming floor must reach originals before pending ACK.
	{
		const owner = users[4],
			room = sql(
				`set role service_role;${create(owner, hashes[8], hashes[9])}`,
			);
		sql(`set role service_role;${commit(room, 720)}`);
		sql(
			`insert into anidachi_room_private.free20_marker_days values('browser','${hashes[10]}',${day},1000);`,
		);
		const { holder, waiter, h, w } = await pair();
		await holder.query(
			`begin;set local role service_role;${attach(owner, room, hashes[10], hashes[11])}`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = waiter.query(commit(room, 800));
		await blocked(w, h);
		await holder.query("commit;");
		await waiting;
		await waiter.query("commit;");
		assertUsage(room, 1080);
		assert.equal(
			sql(
				`select min(committed_seconds)||':'||max(committed_seconds) from anidachi_room_private.free20_marker_days where marker_hash in('${hashes[8]}','${hashes[9]}','${hashes[10]}','${hashes[11]}');`,
			),
			"1080:1080",
		);
		await holder.close();
		await waiter.close();
		console.log(
			"PASS higher-floor attachment versus ACK: original/new scopes become1080, account stays800",
		);
	}
	// Duplicate cumulative delivery on two independent sessions charges one delta.
	{
		const owner = users[5],
			room = sql(
				`set role service_role;${create(owner, hashes[12], hashes[13])}`,
			);
		const { holder, waiter, h, w } = await pair();
		await holder.query(
			`begin;set local role service_role;${commit(room, 700)}`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = waiter.query(commit(room, 700));
		await blocked(w, h);
		await holder.query("commit;");
		await waiting;
		await waiter.query("commit;");
		assertUsage(room, 700);
		assert.equal(
			sql(
				`select host_seconds from public.usage_daily where user_id='${owner}' and day=${day};`,
			),
			"700",
		);
		await holder.close();
		await waiter.close();
		console.log(
			"PASS duplicate ACK race: account and both marker scopes charged once",
		);
	}
	// Crossed attachment locks union(original,proposed) in one total order. Busy
	// inspection must not lock the other room/account while marker locks are held.
	{
		const a = users[6],
			b = users[7],
			ra = sql(`set role service_role;${create(a, hashes[14], hashes[15])}`),
			rb = sql(`set role service_role;${create(b, hashes[16], hashes[17])}`);
		const { holder, waiter, h, w } = await pair();
		await holder.query(
			`begin;select room_id from public.rooms where room_id='${ra}' for update;select anidachi_room_private.lock_free20_scopes('${ra}','${hashes[16]}','${hashes[17]}');`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = denied(waiter.query(attach(b, rb, hashes[14], hashes[15])));
		await blocked(w, h);
		const first = await denied(
			holder.query(
				`set local role service_role;${attach(a, ra, hashes[16], hashes[17])}`,
			),
		);
		assert.match(first.error?.message ?? "", /FREE20_CONTEXT_BUSY/);
		assert.match((await waiting).error?.message ?? "", /FREE20_CONTEXT_BUSY/);
		assert.equal(
			sql(
				`select count(*) from anidachi_room_private.free20_room_bindings where room_id in('${ra}','${rb}');`,
			),
			"4",
		);
		await holder.close();
		await waiter.close();
		console.log(
			"PASS crossed marker attachment: neutral busy on both sides, no deadlock or new bindings",
		);
	}
	// Paid outer preflight expires while waiting at the final canonical core.
	{
		const owner = users[8],
			key = 962031;
		const anchor = "begin\n  select active into strict v_policy";
		assert.equal(coreDefinition.split(anchor).length, 2);
		sql(
			`${coreDefinition.replace(
				anchor,
				`begin\n  perform pg_advisory_xact_lock(9620,${key});\n  select active into strict v_policy`,
			)};`,
		);
		const { holder, waiter, h, w } = await pair();
		await holder.query(`begin;select pg_advisory_xact_lock(9620,${key});`);
		sql(
			`insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values('${owner}','plus',clock_timestamp()+interval '2 seconds','scoped expiry race');`,
		);
		await waiter.query("begin;set local role service_role;");
		const waiting = denied(
			waiter.query(create(owner, null, null).replaceAll("'null'", "null")),
		);
		await blocked(w, h);
		await holder.query(
			`select pg_sleep(greatest(0,extract(epoch from(select valid_until-clock_timestamp() from public.account_manual_plan_grants where user_id='${owner}')))+0.1);commit;`,
		);
		assert.match(
			(await waiting).error?.message ?? "",
			/FREE20_CONTEXT_REQUIRED/,
		);
		assert.equal(
			sql(`select count(*) from public.rooms where host_user_id='${owner}';`),
			"0",
		);
		assert.equal(
			sql(
				`select count(*) from public.active_room_sessions where user_id='${owner}';`,
			),
			"0",
		);
		await holder.close();
		await waiter.close();
		sql(`${coreDefinition};`);
		console.log(
			"PASS paid preflight expiry: final core requires proof with no room/session mutation",
		);
	}
} finally {
	await Promise.all(sessions.map((s) => s.close()));
	sql(`${coreDefinition};`);
	sql(`delete from public.active_room_sessions where user_id in(${quoted});
 delete from public.rooms where host_user_id in(${quoted});
 delete from anidachi_room_private.free20_marker_days where marker_hash in(${hashes.map((h) => `'${h}'`).join(",")});
 delete from anidachi_room_private.free20_room_bindings where owner_user_id in(${quoted});
 delete from public.users where id in(${quoted});
 update public.personal_history_policy set active=${oldHistory === "t"};
 update public.hosting_commercial_policy set free20_enabled=(p.j->>'free20_enabled')::boolean,free20_abuse_enabled=(p.j->>'free20_abuse_enabled')::boolean,trials_enabled=(p.j->>'trials_enabled')::boolean,activation_at=(p.j->>'activation_at')::timestamptz from(select '${oldPolicy.replaceAll("'", "''")}'::jsonb j) p;`);
	assert.equal(
		sql("select to_jsonb(p) from public.hosting_commercial_policy p;"),
		oldPolicy,
	);
	assert.equal(
		sql("select active from public.personal_history_policy;"),
		oldHistory,
	);
	assert.equal(
		sql(`select count(*) from public.users where id in(${quoted});`),
		"0",
	);
	assert.equal(sql("show cron.launch_active_jobs;"), "off");
	console.log(
		"PASS cleanup: synthetic fixture removed, exact policy/history restored, cron remains off",
	);
}
