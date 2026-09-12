import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
	requireDisposableTarget,
	proofPsqlArgs,
	withPsqlSessionTimeouts,
} from "./watch_history_v3_disposable_target.mjs";

// Additive populated-schema upgrade proof. This never resets a database or data.
assert.equal(process.env.DOCKER_HOST, "unix:///Users/vladyslavhulyi/.colima/anidachi-personal-mvp/docker.sock", "Only the task-local Docker daemon is allowed");
const target = requireDisposableTarget();
assert.equal(target.project, "anidachi-personal-mvp-preserve-20260908");
assert.equal(target.hostPort, 55592);
const dir = dirname(fileURLToPath(import.meta.url));
const output = process.env.ANIDACHI_PRESERVATION_RECEIPT;
assert.ok(
	output?.startsWith("/private/tmp/"),
	"Explicit task receipt path required",
);
const phase = process.argv[2];
function sql(query) {
	const r = spawnSync("docker", proofPsqlArgs(target.container), {
		input: withPsqlSessionTimeouts(query),
		encoding: "utf8",
		timeout: 60_000,
		maxBuffer: 8 * 1024 * 1024,
	});
	assert.ifError(r.error);
	assert.equal(r.status, 0, r.stderr);
	return r.stdout.trim();
}
function json(query) {
	return JSON.parse(sql(query));
}
function identity() {
	return json(
		"select json_build_object('count',count(*),'latest',max(version)) from supabase_migrations.schema_migrations;",
	);
}
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
function snapshot(tables) {
	return tables.map(({ table, columns }) => ({
		table,
		columns,
		...json(
			`select json_build_object('count',count(*),'hash',md5(coalesce(string_agg(row::text,E'\\n' order by row::text),''))) from (select jsonb_build_array(${columns.map(quote).join(",")}) row from public.${quote(table)}) q;`,
		),
	}));
}
function chain() {
	const path = resolve(target.workdir, "supabase/migrations");
	return readdirSync(path)
		.filter((f) => f.endsWith(".sql"))
		.sort()
		.map((file) => ({
			file,
			sha256: createHash("sha256")
				.update(readFileSync(resolve(path, file)))
				.digest("hex"),
		}));
}
if (phase === "seed") {
	assert.deepEqual(identity(), { count: 41, latest: "20260905145315" });
	assert.equal(
		sql("select count(*) from public.users;"),
		"0",
		"Only initially empty dedicated synthetic project may be populated",
	);
	sql(readFileSync(resolve(dir, "personal_mvp_preservation_seed.sql"), "utf8"));
	const tables = json(
		`select json_agg(json_build_object('table',table_name,'columns',columns) order by table_name) from (select table_name,array_agg(column_name order by ordinal_position) columns from information_schema.columns where table_schema='public' and (table_name like 'watch_%' or table_name like 'friend_%' or table_name like 'room_invite%' or table_name in ('user_watch_settings','users','rooms','room_members','friendships','recent_people')) group by table_name) t;`,
	);
	const before = snapshot(tables);
	for (const name of [
		"users",
		"rooms",
		"room_members",
		"friendships",
		"friend_groups",
		"friend_group_members",
		"room_invites",
		"room_invite_recipients",
		"watch_episode_progress",
		"watch_sessions",
		"user_watch_settings",
	])
		assert.ok(
			before.find((t) => t.table === name)?.count > 0,
			`Required populated ${name}`,
		);
	const semantic = json(
		`select json_build_object('completed', (select count(*) from watch_episode_progress where completed_at is not null),'consentOn',(select count(*) from user_watch_settings where youtube_history_enabled),'consentOff',(select count(*) from user_watch_settings where not youtube_history_enabled),'advancedGeneration',(select count(*) from user_watch_settings where history_generation=2),'clearedRows',(select count(*) from watch_episode_progress where user_id='a3444444-4444-4444-8444-444444444444'),'sharedSessions',(select count(*) from watch_sessions where room_id is not null),'soloSessions',(select count(*) from watch_sessions where room_id is null));`,
	);
	assert.ok(
		semantic.completed > 0 &&
			semantic.consentOn > 0 &&
			semantic.consentOff > 0 &&
			semantic.advancedGeneration > 0 &&
			semantic.sharedSessions > 0 &&
			semantic.soloSessions > 0,
	);
	assert.equal(semantic.clearedRows, 0);
	writeFileSync(
		output,
		JSON.stringify(
			{
				phase: "before",
				target,
				baselineCommit: "a03c0128825c73edcfdf9062a8d85e70148b2423",
				migration: identity(),
				chain: chain(),
				before,
				semantic,
			},
			null,
			2,
		) + "\n",
		{ flag: "wx" },
	);
	console.log(
		JSON.stringify({
			pass: true,
			phase: "before",
			tables: before.length,
			semantic,
		}),
	);
} else if (phase === "verify") {
	const before = JSON.parse(readFileSync(output, "utf8"));
	assert.deepEqual(before.target, target);
	assert.equal(before.phase, "before");
	assert.deepEqual(identity(), { count: 55, latest: "20260908072249" });
	const currentChain = chain();
	assert.deepEqual(currentChain.slice(0, 41), before.chain);
	const after = snapshot(before.before);
	assert.deepEqual(
		after,
		before.before,
		"Populated old-column counts and hashes must remain identical",
	);
	const policy = json(
		"select json_build_object('active',active,'version',policy_version) from personal_history_policy;",
	);
	assert.equal(policy.active, false);
	const report = {
		...before,
		phase: "verified",
		afterMigration: identity(),
		after,
		forwardChain: currentChain.slice(41),
		policy,
		pass: true,
	};
	writeFileSync(
		output.replace(/\.json$/, ".verified.json"),
		JSON.stringify(report, null, 2) + "\n",
		{ flag: "wx" },
	);
	console.log(
		JSON.stringify({
			pass: true,
			phase: "after",
			tables: after.length,
			policy,
		}),
	);
} else throw new Error("Expected seed or verify");
