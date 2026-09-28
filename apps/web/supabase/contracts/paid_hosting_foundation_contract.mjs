// Explicitly disposable Docker target only; never accepts a database URL.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const context = process.env.PAID_HOSTING_DOCKER_CONTEXT;
const container = process.env.PAID_HOSTING_TEST_CONTAINER;
assert.ok(
	context && container?.startsWith("anidachi-paid-hosting-"),
	"Explicit disposable context/container required",
);
function docker(args, input) {
	const result = spawnSync("docker", ["--context", context, ...args], {
		input,
		encoding: "utf8",
		timeout: 60000,
		maxBuffer: 8 * 1024 * 1024,
	});
	assert.ifError(result.error);
	assert.equal(result.status, 0, result.stderr);
	return result.stdout;
}
const inspected = JSON.parse(docker(["inspect", container]))[0];
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
assert.equal(
	sql("select to_regclass('public.users') is null;").trim(),
	"t",
	"Fresh target required; existing data is never reset",
);
const base = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migration = "20260927131509_paid_hosting_trial_foundation.sql";
for (const file of readdirSync(resolve(base, "migrations"))
	.filter((f) => f.endsWith(".sql") && f < migration)
	.sort()) {
	sql(readFileSync(resolve(base, "migrations", file), "utf8"));
}
// Reuse the real existing history fixture up to its populated snapshot, before downgrade.
const accessTest = readFileSync(
	resolve(base, "tests/personal_history_access.test.sql"),
	"utf8",
);
const seed = accessTest.split("insert into access_results values('failed'")[0];
assert.ok(seed.includes("create temporary table saved_progress"));
const seeded = sql(seed + "\ncommit;");
assert.doesNotMatch(seeded, /not ok \d/);
assert.equal(
	sql("select count(*) from public.watch_episode_progress;").trim(),
	"1",
);
const tables = [
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
		tables
			.map(
				(t) =>
					`select '${t}',coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) from public.${t} t;`,
			)
			.join("\n"),
	);
const before = snapshot();
sql(
	"begin;\n" +
		readFileSync(resolve(base, "migrations", migration), "utf8") +
		"\ncommit;",
);
assert.equal(
	snapshot(),
	before,
	"Migration must preserve populated canonical records and access fences exactly",
);
assert.equal(
	sql(
		"select activation_at is null and not trials_enabled from public.hosting_commercial_policy;",
	).trim(),
	"t",
);
// Replay additive follow-ups before checking the current contract. Never rewrite
// the original foundation migration to match a later product decision.
for (const file of readdirSync(resolve(base, "migrations"))
	.filter((f) => f.endsWith(".sql") && f > migration)
	.sort()) {
	sql("begin;\n" + readFileSync(resolve(base, "migrations", file), "utf8") + "\ncommit;");
}
assert.equal(snapshot(), before, "Follow-up migrations preserve existing records and access fences");
assert.equal(sql("select activation_at is null and not trials_enabled from public.hosting_commercial_policy;").trim(), "t");
const output = sql(
	readFileSync(resolve(base, "tests/paid_hosting_trials.test.sql"), "utf8"),
);
assert.doesNotMatch(output, /not ok \d/);
assert.match(output, /1\.\.\d+/);
console.log(
	"PASS populated users/subscriptions/history/fences preserved; policy dormant; trial SQL suite passed",
);
