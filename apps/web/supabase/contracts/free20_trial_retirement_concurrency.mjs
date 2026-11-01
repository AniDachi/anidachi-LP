// Explicit labeled, disconnected local Docker fixture only. No remote DB URLs.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const users = Array.from({ length: 6 }, () => randomUUID());
const quoted = users.map((u) => `'${u}'`).join(",");
const enableTrials = (cardless = true) =>
	sql(
		`update public.hosting_commercial_policy set free20_enabled=false,trials_enabled=true,cardless_trials_enabled=${cardless},activation_at=now()-interval '1 day',revision=101;`,
	);
const cutoff =
	"update public.hosting_commercial_policy set free20_enabled=true,trials_enabled=false,revision=102 where singleton;";
const reserve = (user, version, request = user) =>
	version === 1
		? `select public.reserve_cardless_trial_v1('${user}','${request}','plus','yearly','price_original',null,101)->>'id';`
		: `select public.reserve_cardless_trial_v2('${user}','${request}','plus','yearly','price_original',null,101,'${user.replaceAll("-", "").repeat(2)}',null)->>'id';`;
const staleInsert = (user) =>
	`insert into public.subscription_checkout_reservations(user_id,request_id,plan_code,price_id,origin,policy_revision,trial_offered) values('${user}','${user}','plus','price_original','https://anidachi.test',101,true);`;
try {
	sql(
		`insert into public.users(id,email,display_name) values ${users.map((u) => `('${u}','${u}@example.test','Cutoff race')`).join(",")};`,
	);
	for (const version of [1, 2]) {
		enableTrials();
		const owner = users[version - 1];
		const accepted = session(),
			operator = session(),
			replay = session();
		const holder = Number(await accepted.query("select pg_backend_pid();"));
		const operatorPid = Number(
			await operator.query("select pg_backend_pid();"),
		);
		const replayPid = Number(await replay.query("select pg_backend_pid();"));
		await accepted.query("begin; set local role service_role;");
		const id = await accepted.query(reserve(owner, version));
		const frozen = await accepted.query(
			`select to_jsonb(a) from public.subscription_trial_activations a where user_id='${owner}';`,
		);
		await operator.query("begin;");
		const update = operator.query(cutoff);
		await blocked(operatorPid, holder);
		// Another request for the same account waits on account authority. The
		// operator only waits on policy SHARE; it never takes an account lock.
		await replay.query("begin;set local role service_role;");
		const recovering = replay.query(reserve(owner, version));
		await blocked(replayPid, holder);
		await accepted.query("commit;");
		await update;
		await operator.query("commit;");
		assert.equal(await recovering, id);
		await replay.query("commit;");
		assert.equal(
			sql(`set role service_role;${reserve(owner, version)}`),
			id,
			"Accepted replay survives cutoff",
		);
		assert.equal(
			sql(
				`select to_jsonb(a) from public.subscription_trial_activations a where user_id='${owner}';`,
			),
			frozen,
		);
		accepted.close();
		operator.close();
		replay.close();
		console.log(
			`PASS v${version}: policy cutoff waits for accepted reservation; account waiter and post-cutoff replay preserve exact operation`,
		);
	}
	// Legacy INSERT takes the same policy SHARE lock until commit.
	enableTrials(false);
	const accepted = session(),
		operator = session();
	const holder = Number(await accepted.query("select pg_backend_pid();"));
	const operatorPid = Number(await operator.query("select pg_backend_pid();"));
	await accepted.query(`begin;${staleInsert(users[2])}`);
	await operator.query("begin;");
	const update = operator.query(cutoff);
	await blocked(operatorPid, holder);
	await accepted.query("commit;");
	await update;
	await operator.query("commit;");
	assert.equal(
		sql(
			`select trial_offered from public.subscription_checkout_reservations where user_id='${users[2]}';`,
		),
		"t",
	);
	accepted.close();
	operator.close();
	console.log("PASS legacy reservation commits before cutoff and is preserved");

	// Capture old authority, then force cutoff to hold UPDATE before the stale
	// INSERT reaches its guard. INSERT waits and re-reads committed policy.
	enableTrials(false);
	const stale = session(),
		cutting = session();
	const stalePid = Number(await stale.query("select pg_backend_pid();"));
	const cuttingPid = Number(await cutting.query("select pg_backend_pid();"));
	await stale.query("begin;");
	const authority = JSON.parse(
		await stale.query(
			`select public.resolve_watch_history_access_v1('${users[3]}');`,
		),
	);
	assert.equal(
		authority.hosting.trialEligibility,
		"eligible",
		"Capture real pre-cutoff eligibility",
	);
	await cutting.query(`begin;${cutoff}`);
	const rejected = stale.query(staleInsert(users[3]));
	// Attach rejection before releasing cutoff, preventing unhandled rejection.
	const outcome = rejected.then(
		() => null,
		(error) => error,
	);
	await blocked(stalePid, cuttingPid);
	await cutting.query("commit;");
	assert.match((await outcome)?.message ?? "", /CARDLESS_TRIAL_OFFER_CHANGED/);
	assert.equal(
		sql(
			`select count(*) from public.subscription_checkout_reservations where user_id='${users[3]}';`,
		),
		"0",
	);
	cutting.close();
	console.log(
		"PASS cutoff commits before stale legacy INSERT: blocked request is rejected without reservation",
	);

	// Rolling back an accepted reservation releases SHARE without accepting it.
	enableTrials();
	const aborted = session(),
		cutAfterAbort = session();
	const abortedPid = Number(await aborted.query("select pg_backend_pid();"));
	const cutPid = Number(await cutAfterAbort.query("select pg_backend_pid();"));
	await aborted.query(
		`begin;set local role service_role;${reserve(users[4], 2)}`,
	);
	await cutAfterAbort.query("begin;");
	const afterAbort = cutAfterAbort.query(cutoff);
	await blocked(cutPid, abortedPid);
	await aborted.query("rollback;");
	await afterAbort;
	await cutAfterAbort.query("commit;");
	assert.equal(
		sql(
			`select count(*) from public.subscription_trial_activations where user_id='${users[4]}';`,
		),
		"0",
	);
	const fresh = session();
	await assert.rejects(
		fresh.query(`set role service_role;${reserve(users[4], 2)}`),
		/CARDLESS_TRIAL_UNAVAILABLE/,
	);
	aborted.close();
	cutAfterAbort.close();
	// A rolled-back cutoff admits the original offer again; it changes no flags.
	enableTrials(false);
	const rollbackCut = session();
	await rollbackCut.query(`begin;${cutoff}rollback;`);
	sql(staleInsert(users[5]));
	rollbackCut.close();
	console.log(
		"PASS reservation rollback releases policy lock; cutoff rollback restores original admission",
	);
} finally {
	await Promise.all(sessions.map((connection) => connection.close()));
	sql(`delete from anidachi_private.trial_marker_claims where activation_id in(select id from public.subscription_trial_activations where user_id in(${quoted}));
 delete from public.users where id in(${quoted});
 update public.hosting_commercial_policy set free20_enabled=(p.j->>'free20_enabled')::boolean,trials_enabled=(p.j->>'trials_enabled')::boolean,cardless_trials_enabled=(p.j->>'cardless_trials_enabled')::boolean,activation_at=(p.j->>'activation_at')::timestamptz,revision=(p.j->>'revision')::bigint from(select '${oldPolicy.replaceAll("'", "''")}'::jsonb j) p;`);
	assert.equal(
		sql("select to_jsonb(p) from public.hosting_commercial_policy p;"),
		oldPolicy,
		"Full policy restored exactly",
	);
}
