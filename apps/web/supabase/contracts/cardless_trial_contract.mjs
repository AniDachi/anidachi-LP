// Only a labeled, network-isolated disposable Docker target; no database URL.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const context = process.env.PAID_HOSTING_DOCKER_CONTEXT;
const container = process.env.PAID_HOSTING_TEST_CONTAINER;
assert.ok(
	context && container?.startsWith("anidachi-paid-hosting-"),
	"Explicit disposable target required",
);
const run = (args, input) => {
	const r = spawnSync("docker", ["--context", context, ...args], {
		input,
		encoding: "utf8",
		timeout: 60000,
		maxBuffer: 8 * 1024 * 1024,
	});
	assert.ifError(r.error);
	assert.equal(r.status, 0, r.stderr);
	return r.stdout;
};
const target = JSON.parse(run(["inspect", container]))[0];
assert.equal(target.Config.Labels["anidachi.disposable"], "true");
assert.equal(target.Config.Labels["anidachi.task"], "paid-hosting");
assert.equal(target.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(target.HostConfig.PortBindings ?? {}).length, 0);
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
const base = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonical = [
	"users",
	"subscriptions",
	"billing_customers",
	"user_watch_settings",
	"watch_episode_progress",
	"watch_sessions",
	"watch_session_participants",
	"account_manual_plan_grants",
];
const snapshot = () =>
	sql(
		canonical
			.map(
				(t) =>
					`select '${t}',coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.${t} t;`,
			)
			.join("\n"),
	);
const before = snapshot();
if (
	sql(
		"select to_regclass('public.subscription_trial_activations') is null;",
	).trim() === "t"
) {
	const files = readdirSync(resolve(base, "migrations")).filter((f) =>
		f.endsWith("_cardless_subscription_trials.sql"),
	);
	assert.ok(files.length <= 1, "One additive migration expected");
	if (files.length)
		sql(
			"begin;\n" +
				readFileSync(resolve(base, "migrations", files[0]), "utf8") +
				"\ncommit;",
		);
}
if (
	sql(
		"select to_regprocedure('public.consume_trial_action_rate_limit_v1(uuid,text)') is null;",
	).trim() === "t"
) {
	const migration = readdirSync(resolve(base, "migrations")).find((f) =>
		f.endsWith("_cardless_trial_launch_guards.sql"),
	);
	if (migration)
		sql(
			"begin;\n" +
				readFileSync(resolve(base, "migrations", migration), "utf8") +
				"\ncommit;",
		);
}
assert.equal(
	snapshot(),
	before,
	"Additive migration preserves existing records exactly",
);
for (const name of [
	"cardless_subscription_trials",
	"cardless_trial_launch",
	"paid_hosting_trials",
	"unified_trial_eligibility",
	"subscription_checkout_reservations",
	"stripe_trial_lifecycle",
	"paid_hosting_room_admission",
]) {
	const out = sql(
		readFileSync(resolve(base, "tests", name + ".test.sql"), "utf8"),
	);
	assert.doesNotMatch(out, /not ok \d/);
	assert.match(out, /1\.\.\d+/);
	console.log(`PASS ${name}: ${out.match(/1\.\.\d+/)?.[0]}`);
}
const parallelSql = (input) =>
	new Promise((resolveResult, reject) => {
		const p = spawn("docker", ["--context", context, ...args], {
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 30000,
		});
		let out = "",
			err = "";
		p.stdout.on("data", (v) => (out += v));
		p.stderr.on("data", (v) => (err += v));
		p.on("error", reject);
		p.on("close", (code) =>
			code === 0 ? resolveResult(out.trim()) : reject(new Error(err)),
		);
		p.stdin.end(input);
	});
const oldPolicy = sql(
	"select row_to_json(p) from public.hosting_commercial_policy p;",
).trim();
const user = randomUUID();
try {
	sql(`insert into public.users(id,email,display_name) values('${user}','${user}@example.test','Cardless race');
 insert into public.billing_customers(user_id,stripe_customer_id) values('${user}','cus_${user}');
 update public.hosting_commercial_policy set activation_at=now()-interval '1 day',trials_enabled=true,cardless_trials_enabled=true;`);
	const revision = JSON.parse(oldPolicy).revision;
	const activation = (plan, request = randomUUID()) =>
		`select public.reserve_cardless_trial_v1('${user}','${request}','${plan}','monthly','price_${plan}','cus_${user}',${revision})->>'id';`;
	const checkout = `select public.reserve_subscription_checkout_v1('${user}','plus','price_plus','https://anidachi.test','${randomUUID()}','{}')->>'id';`;
	const race = await Promise.allSettled(
		[activation("plus"), activation("pro"), checkout].map((s) =>
			parallelSql(
				`begin;set local role service_role;${s}select pg_sleep(0.15);commit;`,
			),
		),
	);
	assert.equal(
		race.filter((r) => r.status === "fulfilled").length,
		1,
		"Only one old/new/plan request may reserve external creation",
	);
	for (const r of race)
		if (r.status === "rejected")
			assert.match(
				r.reason.message,
				/TRIAL_ACTIVATION_BUSY|TRIAL_CHECKOUT_UNRESOLVED|CARDLESS_TRIAL_OFFER_CHANGED/,
			);
	assert.equal(
		sql(
			`select (select count(*) from public.subscription_trial_activations where user_id='${user}')+(select count(*) from public.subscription_checkout_reservations where user_id='${user}');`,
		).trim(),
		"1",
	);
	console.log(
		"PASS old Checkout / Plus / Pro concurrency: one durable authority",
	);
} finally {
	sql(`delete from public.users where id='${user}';
 update public.hosting_commercial_policy set revision=(p.j->>'revision')::bigint,activation_at=(p.j->>'activation_at')::timestamptz,trials_enabled=(p.j->>'trials_enabled')::boolean,cardless_trials_enabled=(p.j->>'cardless_trials_enabled')::boolean from (select '${oldPolicy.replaceAll("'", "''")}'::jsonb j) p;`);
}
assert.equal(snapshot(), before, "Tests preserve preexisting records");
