// LOCAL TEST ONLY. Parent/operator supplies an already-running isolated PostgreSQL17
// container. No Docker lifecycle, network connection, hosted credentials or backups.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { buildArtifacts } from "./production-history-hosted-artifacts.mjs";

const container = process.argv[2];
assert.match(
	container ?? "",
	/^anidachi-acl-[a-z0-9-]+$/,
	"Supply the dedicated local ACL test container",
);
const inspected = spawnSync("docker", ["inspect", container], {
	encoding: "utf8",
});
assert.equal(inspected.status, 0, inspected.stderr);
const metadata = JSON.parse(inspected.stdout)[0];
assert.equal(
	metadata.Config.Labels?.["anidachi.task"],
	"acl-recovery-20260912",
);
assert.equal(metadata.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(metadata.NetworkSettings.Ports ?? {}).length, 0);
const binding = {
	projectRef: "abcdefghijklmnopqrst",
	host: "db.abcdefghijklmnopqrst.supabase.co",
	port: 5432,
	database: "postgres",
	user: "postgres",
	sessionUser: "postgres",
	nonce: "a".repeat(32),
	releaseCommit: "b".repeat(40),
	backupSha256: "c".repeat(64),
};
function run(args, input, success = true) {
	const r = spawnSync("docker", ["exec", "-i", container, ...args], {
		input,
		encoding: "utf8",
		maxBuffer: 8 * 1024 * 1024,
	});
	assert.ifError(r.error);
	if (success) assert.equal(r.status, 0, r.stderr);
	else assert.notEqual(r.status, 0, "Expected SQL failure");
	return r;
}
const sql = (text, success = true) =>
	run(
		[
			"psql",
			"-X",
			"-qAt",
			"-v",
			"ON_ERROR_STOP=1",
			"-U",
			"postgres",
			"-d",
			"postgres",
		],
		text,
		success,
	);
const quote = (s) => `"${s.replaceAll('"', '""')}"`;
const routine = quote(`strange '"routine`);
const tables = JSON.parse(buildArtifacts(binding)["input.json"]).publicTables;
// This dedicated fixture is created only once; all negative probes run in rollback transactions.
sql(`begin; do $$ begin if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') or exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public') or to_regnamespace('anidachi_rehearsal_binding') is not null or to_regnamespace('supabase_migrations') is not null then raise exception 'FRESH_FIXTURE_REQUIRED'; end if; if current_user<>'postgres' or (select rolsuper from pg_roles where rolname=current_user) or current_setting('server_version_num')::int/10000<>17 then raise exception 'NON_SUPERUSER_PG17_REQUIRED';end if;end $$;
create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text);
${tables.map((n) => `create table public.${quote(n)}(id int);`).join("\n")}
create function public.restricted() returns int language sql as 'select 1';
create function public.empty_acl() returns int language sql as 'select 3';
revoke all on function public.empty_acl() from postgres,public;
create function public.${routine}(a int) returns int language sql as 'select 1';
create function public.${routine}(a text) returns int language sql as 'select 2';
revoke execute on function public.restricted() from public;
grant execute on function public.restricted() to service_role;
grant select on public.${quote(tables[0])} to service_role;
grant select on public.${quote(tables[1])} to anon with grant option;
grant update on public.${quote(tables[1])} to authenticated;
grant select on public.${quote(tables[2])} to public;
insert into public.${quote(tables[0])} values(1);
create schema anidachi_rehearsal_binding;
create table anidachi_rehearsal_binding.identity(project_ref text,nonce text);
insert into anidachi_rehearsal_binding.identity values('${binding.projectRef}','${binding.nonce}');commit;`);
// Real pg_dump restore ACL replay recreates the bug under surviving defaults.
const dump = run([
	"pg_dump",
	"-U",
	"postgres",
	"-d",
	"postgres",
	"--schema=public",
	"--schema=supabase_migrations",
	"--no-comments",
]).stdout;
const strip = dump
	.split("\n")
	.filter(
		(l) =>
			!/^CREATE SCHEMA|^ALTER SCHEMA|^GRANT .* ON SCHEMA|^REVOKE .* ON SCHEMA/.test(
				l,
			),
	)
	.join("\n");
sql(
	"alter default privileges in schema public grant all on tables to anon,authenticated; alter default privileges in schema public grant execute on functions to anon,authenticated;",
);
const cleanup = `${tables.map((n) => `drop table public.${quote(n)} restrict;`).join("\n")}
drop table supabase_migrations.schema_migrations restrict;
drop function public.restricted() restrict;
drop function public.empty_acl() restrict;
drop function public.${routine}(int) restrict;
drop function public.${routine}(text) restrict;`;
const regression = sql(
	`begin;${cleanup}\n${strip}\nselect has_function_privilege('anon','public.restricted()','EXECUTE'),has_table_privilege('anon','public.${tables[0]}','SELECT');rollback;`,
).stdout.trim();
assert.equal(regression, "t|t");
console.log(
	"RED reproduced: pg_dump ACL replay leaves surplus anon table/function access under surviving defaults.",
);
if (process.argv.includes("--reproduce-only")) process.exit(0);
const { buildCaptureArtifacts, buildRecoveryArtifacts } = await import(
	"./production-history-application-acl.mjs"
);
const capture = buildCaptureArtifacts(binding)["capture.sql"];
const snapshot = JSON.parse(sql(capture).stdout.trim());
const reconcile = buildRecoveryArtifacts(binding, snapshot)["reconcile.sql"];
const normalized = (s) =>
	s.objects
		.map((o) =>
			JSON.stringify([
				o.kind,
				o.schema,
				o.name,
				o.identityArguments,
				o.owner,
				o.acl
					.map((a) =>
						JSON.stringify([a.grantor, a.grantee, a.privilege, a.grantOption]),
					)
					.sort(),
			]),
		)
		.sort();
const actual = () => JSON.parse(sql(capture).stdout.trim());
const baseline = normalized(snapshot);
assert.equal(snapshot.objects.filter((o) => o.kind === "table").length, 35);
const defaultAcl = () =>
	sql(
		"select coalesce(jsonb_agg(to_jsonb(d) order by oid),'[]'::jsonb) from pg_default_acl d;",
	).stdout;
const originalDefaults = defaultAcl();
const state = () =>
	sql(
		`select c.oid,c.relacl::text,(select array_agg(id order by id) from public.${quote(tables[0])}) from pg_class c where c.oid='public.${tables[0]}'::regclass;`,
	).stdout;
// Distinct pre-restore rows prove rollback restores the old state, not the dump state.
sql(`insert into public.${quote(tables[0])} values(42);`);
const before = state();
const assertPreserved = () => {
	assert.equal(state(), before);
	assert.deepEqual(normalized(actual()), baseline);
	assert.equal(defaultAcl(), originalDefaults);
};
function fail(change, error, body = reconcile) {
	const result = sql(
		`begin;${cleanup}\n${strip}\n${change}\n${body}\ncommit;`,
		false,
	);
	assert.match(result.stderr, error);
	assertPreserved();
}
fail(`drop table public.${quote(tables[3])};`, /ACL_OBJECT_INVENTORY_MISMATCH/);
fail(
	"create table public.unexpected(id int);",
	/ACL_OBJECT_INVENTORY_MISMATCH/,
);
fail(
	"create function public.unexpected() returns int language sql as 'select 1';",
	/ACL_OBJECT_INVENTORY_MISMATCH/,
);
fail(
	`alter table public.${quote(tables[0])} owner to service_role;`,
	/ACL_UNSUPPORTED_OWNER/,
);
fail(
	`grant select(id) on public.${quote(tables[0])} to anon;`,
	/ACL_UNSUPPORTED_COLUMN_ACL/,
);
fail(
	"create view public.unexpected as select 1 as id;",
	/ACL_UNSUPPORTED_RELATION/,
);
fail("create sequence public.unexpected;", /ACL_UNSUPPORTED_RELATION/);
fail(
	"create table public.unexpected(id int) partition by range(id);",
	/ACL_UNSUPPORTED_RELATION/,
);
fail("create type public.unexpected as enum ('x');", /ACL_UNSUPPORTED_TYPE/);
// Grantor chain dependency is rejected before attempting a cascading revoke.
fail(
	`grant select on public.${quote(tables[0])} to anon with grant option;set role anon;grant select on public.${quote(tables[0])} to authenticated;set role postgres;`,
	/ACL_UNSUPPORTED_GRANTOR/,
);
fail(
	"create schema acl_extension_fixture; create extension pg_trgm with schema acl_extension_fixture; alter extension pg_trgm add function public.restricted();",
	/ACL_UNSUPPORTED_EXTENSION_MEMBER/,
);
fail(
	"",
	/deliberate recovery failure/,
	reconcile +
		"do $$ begin raise exception 'deliberate recovery failure'; end $$;",
);
// Raw ACL auditing cannot disagree with normalized privileges even in a checksum-bound file.
const wrong = structuredClone(snapshot);
wrong.objects.find((o) => o.name === "restricted").rawAcl = [];
fail(
	"",
	/ACL_RAW_NORMALIZED_MISMATCH/,
	buildRecoveryArtifacts(binding, wrong)["reconcile.sql"],
);
// Snapshot-provided signatures are data only: hostile SQL text cannot execute.
const injected = structuredClone(snapshot);
injected.objects.find((o) => o.kind === "function").identityArguments =
	"integer); drop table public.users; --";
fail(
	"",
	/ACL_OBJECT_INVENTORY_MISMATCH/,
	buildRecoveryArtifacts(binding, injected)["reconcile.sql"],
);
// Standalone psql must fail before privilege mutation.
assert.match(
	sql(reconcile, false).stderr,
	/application_acl_input.*does not exist/,
);
assertPreserved();
// Capture itself rejects unsupported schema state, not just restore preflight.
const badCapture = sql(
	`begin;create view public.unexpected as select 1 as id;\n${capture}`,
	false,
);
assert.match(badCapture.stderr, /ACL_UNSUPPORTED_RELATION/);
assertPreserved();
console.log(
	"Negative SQL gates passed: inventory, owner, grantor chain, column ACL, relation/type forms, raw tamper, autocommit and complete failed-restore rollback.",
);
// Remove legitimate rights/options and add surplus grant options before reconciliation.
const adjustments = `revoke execute on function public.restricted() from service_role;
revoke grant option for select on public.${quote(tables[1])} from anon restrict;
grant update on public.${quote(tables[1])} to authenticated with grant option;
revoke select on public.${quote(tables[2])} from public;`;
sql(
	`begin;${cleanup}\n${strip}\n${adjustments}\n${reconcile}\n${reconcile}\ncommit;`,
);
assert.deepEqual(normalized(actual()), baseline);
assert.equal(defaultAcl(), originalDefaults);
assert.equal(
	sql(
		`select array_agg(id order by id) from public.${quote(tables[0])};`,
	).stdout.trim(),
	"{1}",
);
assert.equal(
	sql(
		`select has_function_privilege('anon','public.restricted()','EXECUTE'),has_table_privilege('anon','public.${tables[0]}','SELECT'),has_function_privilege('service_role','public.restricted()','EXECUTE'),has_table_privilege('anon','public.${tables[1]}','SELECT WITH GRANT OPTION'),has_table_privilege('authenticated','public.${tables[1]}','UPDATE WITH GRANT OPTION'),has_table_privilege('public','public.${tables[2]}','SELECT');`,
	).stdout.trim(),
	"f|f|t|t|f|t",
);
assert.ok(
	snapshot.objects.some(
		(o) =>
			o.name === "empty_acl" && o.rawAcl?.length === 0 && o.acl.length === 0,
	),
	"Explicit empty ACL covered",
);
assert.ok(
	snapshot.objects.some((o) => o.rawAcl === null),
	"NULL ACL defaults covered",
);
assert.equal(
	snapshot.objects.filter((o) => o.name === `strange '"routine`).length,
	2,
	"quoted overload identities covered",
);
console.log(
	"GREEN: real pg_dump replay + delta reconciliation restores exact normalized ACL/owners/grantors, legitimate PUBLIC/client/service grants, grant options, overloads and rows; repeat is idempotent; default ACLs unchanged.",
);
