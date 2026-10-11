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
if (
	sql(
		"select to_regprocedure('public.begin_trial_setup_v1(uuid,uuid,bigint,uuid,text)') is null;",
	).trim() === "t"
) {
	const migration = readdirSync(resolve(base, "migrations")).find((f) =>
		f.endsWith("_cardless_trial_renewal_setup.sql"),
	);
	if (migration)
		sql(
			"begin;\n" +
				readFileSync(resolve(base, "migrations", migration), "utf8") +
				"\ncommit;",
		);
}
if (
	sql(
		"select to_regclass('public.trial_conversion_events') is null;",
	).trim() === "t"
) {
	const migration = readdirSync(resolve(base, "migrations")).find((f) =>
		f.endsWith("_trial_conversion_events.sql"),
	);
	if (migration)
		sql(
			"begin;\n" +
				readFileSync(resolve(base, "migrations", migration), "utf8") +
				"\ncommit;",
		);
}
if (
	sql(
		"select to_regclass('public.subscription_trial_activation_attempts') is null;",
	).trim() === "t"
) {
	const migration = readdirSync(resolve(base, "migrations")).find((f) =>
		f.endsWith("_cardless_trial_review_guards.sql"),
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
	"cardless_trial_renewal",
	"trial_conversion_events",
	"cardless_trial_review_guards",
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
// Separate service-role connections race setup finalization against cancellation.
// The DB must choose one mutation authority even when HTTP workers overlap.
const renewalUser = randomUUID(),
	renewalActivation = randomUUID();
const renewalSub = `sub_${renewalUser}`,
	renewalCustomer = `cus_${renewalUser}`;
try {
	sql(`begin;
 insert into public.users(id,email,display_name) values('${renewalUser}','${renewalUser}@example.test','Renewal race');
 insert into public.billing_customers(user_id,stripe_customer_id) values('${renewalUser}','${renewalCustomer}');
 insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end)
 values('${renewalUser}','${renewalCustomer}','${renewalSub}','price_plus','plus','trialing',now()+interval '72 hours');
 insert into public.subscription_trial_activations(id,user_id,request_id,plan_code,billing_period,price_id,policy_revision,stripe_customer_id,stripe_schedule_id,stripe_subscription_id,state,trial_started_at,trial_ends_at)
 values('${renewalActivation}','${renewalUser}','${randomUUID()}','plus','monthly','price_plus',1,'${renewalCustomer}','sched_${renewalUser}','${renewalSub}','committed',now(),now()+interval '72 hours');
 insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at,trial_mode,trial_activation_id,stripe_schedule_id)
 values('${renewalUser}','${renewalSub}',now(),now()+interval '72 hours','cardless','${renewalActivation}','sched_${renewalUser}');commit;`);
	const op = JSON.parse(
		sql(
			`set role service_role;select public.reserve_trial_renewal_v1('${renewalUser}','${randomUUID()}','${renewalSub}','enable','{"planCode":"plus","billingPeriod":"monthly","priceId":"price_plus","amount":799,"currency":"usd","termsRevision":"v1","quoteRevision":"q1"}');`,
		).trim(),
	);
	sql(
		`set role service_role;select public.begin_trial_setup_v1('${renewalUser}','${op.id}',${op.generation},'${randomUUID()}','https://staging.anidachi.app');select public.record_trial_setup_session_v1('${renewalUser}','${op.id}',${op.generation},'cs_${renewalUser}');`,
	);
	const races = await Promise.allSettled(
		[
			`select public.commit_trial_renewal_v2('${renewalUser}','${op.id}',${op.generation},'setup_pending','applying','{"setupSessionId":"cs_${renewalUser}","setupIntentId":"seti_${renewalUser}","paymentMethodId":"pm_${renewalUser}"}');`,
			`select public.reserve_trial_renewal_v1('${renewalUser}','${randomUUID()}','${renewalSub}','cancel','{}');`,
		].map((s) =>
			parallelSql(
				`begin;set local role service_role;${s}select pg_sleep(0.15);commit;`,
			),
		),
	);
	assert.equal(
		races.filter((r) => r.status === "fulfilled").length,
		1,
		"Only enable or cancellation may own the unresolved external mutation",
	);
	for (const r of races)
		if (r.status === "rejected")
			assert.match(
				r.reason.message,
				/TRIAL_RENEWAL_STALE|TRIAL_MUTATION_UNRESOLVED/,
			);
	assert.equal(
		sql(
			`select count(*) from public.subscription_trial_renewals where user_id='${renewalUser}' and state='applying';`,
		).trim(),
		"1",
	);
	console.log(
		"PASS setup completion / cancel concurrency: one durable mutation authority",
	);
} finally {
	sql(`delete from public.users where id='${renewalUser}';`);
}
// Separate connections verify operator hold and positive webhook recovery use the same account fence.
const guardedUser = randomUUID(),
	guardedActivation = randomUUID();
try {
	sql(`insert into public.users(id,email,display_name) values('${guardedUser}','${guardedUser}@example.test','Guard race');
 insert into public.billing_customers(user_id,stripe_customer_id) values('${guardedUser}','cus_${guardedUser}');
 insert into public.subscription_trial_activations(id,user_id,request_id,plan_code,billing_period,price_id,policy_revision,stripe_customer_id)
 values('${guardedActivation}','${guardedUser}','${randomUUID()}','plus','monthly','price_plus',1,'cus_${guardedUser}');`);
	const key = `cardless-trial-v1:${guardedActivation}`;
	const admission = `select public.begin_cardless_trial_attempt_v1('${guardedUser}','${guardedActivation}','schedule','${key}');`;
	const hold = `select anidachi_private.hold_cardless_trial_activation_v1('${guardedUser}','${guardedActivation}','${key}',true);`;
	const attempts = await Promise.allSettled([
		parallelSql(
			`begin;set local role service_role;${admission}select pg_sleep(0.15);commit;`,
		),
		parallelSql(`begin;${hold}select pg_sleep(0.15);commit;`),
	]);
	assert.equal(attempts[1].status, "fulfilled");
	if (attempts[0].status === "rejected")
		assert.match(attempts[0].reason.message, /TRIAL_RECOVERY_HELD/);
	else
		assert.equal(
			sql(
				`select count(*) from public.subscription_trial_activation_attempts where activation_id='${guardedActivation}' and outcome='applying';`,
			).trim(),
			"1",
		);
	let attemptId = sql(
		`select id from public.subscription_trial_activation_attempts where activation_id='${guardedActivation}';`,
	).trim();
	if (!attemptId) {
		sql(
			`select anidachi_private.hold_cardless_trial_activation_v1('${guardedUser}','${guardedActivation}','${key}',false);`,
		);
		attemptId = sql(`set role service_role;${admission}`).trim();
		sql(hold);
	}
	sql(
		`set role service_role;select public.finish_cardless_trial_attempt_v1('${guardedUser}','${guardedActivation}','${attemptId}','succeeded','sched_${guardedUser}','req_success');`,
	);
	const createdAt = sql(
		`select created_at from public.subscription_trial_activations where id='${guardedActivation}';`,
	).trim();
	const settle = `select anidachi_private.settle_cardless_trial_activation_v1('${guardedUser}','${guardedActivation}','${key}','${createdAt}','Operator tries settlement while a positive Schedule receipt exists');`;
	const commit = `select public.record_cardless_trial_created_v1('${guardedUser}','${guardedActivation}','cus_${guardedUser}','sched_${guardedUser}','sub_${guardedUser}','price_plus',now(),now()+interval '72 hours');`;
	const race = await Promise.allSettled([
		parallelSql(`begin;${settle}select pg_sleep(0.15);commit;`),
		parallelSql(
			`begin;set local role service_role;${commit}select pg_sleep(0.15);commit;`,
		),
	]);
	assert.equal(race[0].status, "rejected");
	if (race[0].status === "rejected")
		assert.match(
			race[0].reason.message,
			/TRIAL_EXTERNAL_EFFECT_EXISTS|TRIAL_ACTIVATION_MISMATCH/,
		);
	assert.equal(race[1].status, "fulfilled");
	assert.equal(
		sql(
			`select state from public.subscription_trial_activations where id='${guardedActivation}';`,
		).trim(),
		"created",
	);
	console.log(
		"PASS create admission / operator hold and webhook / settlement concurrency",
	);
} finally {
	sql(`delete from public.users where id='${guardedUser}';`);
}
assert.equal(snapshot(), before, "Tests preserve preexisting records");
