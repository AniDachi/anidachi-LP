// Rollback-only synthetic probes. This module never opens a database connection.
// The caller must first validate its disposable target and provide a fresh,
// non-postgres superuser connection per runSql call, closed even on SQL failure.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const S = "anidachi_transition_20260912";
const read = (file) =>
	readFileSync(
		new URL(
			`../apps/web/supabase/operations/production-history-20260912/${file}`,
			import.meta.url,
		),
		"utf8",
	);
const q = (value) => `'${value.replaceAll("'", "''")}'`;

export function operatorFenceSources() {
	const guards = [];
	for (const [file, count] of [
		["prepare.sql", 2],
		["verify-archive.sql", 1],
		["finish.sql", 1],
	]) {
		const matches = [
			...read(file).matchAll(
				/if not \([^;]*\) then raise exception 'OPERATOR_LOGIN_REQUIRED'; end if;/g,
			),
		];
		assert.equal(matches.length, count, `${file}: operator entry points`);
		for (const [index, match] of matches.entries())
			guards.push({ name: `${file}:${index + 1}`, sql: match[0] });
	}
	const trigger = read("prepare.sql").match(
		/create function anidachi_transition_20260912\.block_runtime_writes\(\) returns trigger[\s\S]*?end \$\$;/,
	)?.[0];
	assert.ok(trigger, "Use the actual maintenance trigger definition");
	return {
		guards,
		trigger: trigger.replace(
			`${S}.block_runtime_writes`,
			"public.task3_fence_block",
		),
	};
}

const fixture = `
begin;
do $fixture$
begin
 if session_user = 'postgres' or not (select rolsuper from pg_catalog.pg_roles where rolname=session_user) then
  raise exception 'FENCE_FIXTURE_REQUIRES_SEPARATE_DISPOSABLE_SUPERUSER';
 end if;
end $fixture$;
-- These fixture attributes, roles, grants, objects and mutations all roll back.
alter role postgres nosuperuser;
do $fixture$
declare r text;
begin
 foreach r in array array['cli_login_postgres','cli_login_postgres_extra','task3_postgres_member','authenticator','anon','authenticated','service_role'] loop
  if not exists(select 1 from pg_catalog.pg_roles where rolname=r) then
   execute format('create role %I nologin nosuperuser noinherit',r);
  end if;
 end loop;
end $fixture$;
alter role cli_login_postgres nosuperuser noinherit;
grant postgres to cli_login_postgres,cli_login_postgres_extra,task3_postgres_member;
grant service_role to postgres,cli_login_postgres;
grant anon,authenticated,service_role to authenticator;
create table public.task3_fence_probe(value integer);
insert into public.task3_fence_probe values(1);
grant all on public.task3_fence_probe to postgres,cli_login_postgres,authenticator,anon,authenticated,service_role;
create function public.task3_fence_write() returns void language plpgsql security definer set search_path='' as $$
begin update public.task3_fence_probe set value=value+1; end $$;
alter function public.task3_fence_write() owner to postgres;
create function public.task3_fence_other_owner_write() returns void language plpgsql security definer set search_path='' as $$
begin update public.task3_fence_probe set value=value+1; end $$;
alter function public.task3_fence_other_owner_write() owner to service_role;
create function public.task3_revoke_operator_membership() returns void language plpgsql security definer set search_path='' as $$
begin revoke postgres from cli_login_postgres; end $$;
`;

export function runOperatorFenceChecks(runSql) {
	const { guards, trigger } = operatorFenceSources();
	const cases = [
		["postgres login", "postgres", "", true],
		["postgres explicit role", "postgres", "set role postgres;", true],
		[
			"native CLI explicit postgres member",
			"cli_login_postgres",
			"set role postgres;",
			true,
		],
		["CLI without explicit role", "cli_login_postgres", "", false],
		[
			"CLI membership revoked after SET ROLE",
			"cli_login_postgres",
			"set role postgres; select public.task3_revoke_operator_membership();",
			false,
		],
		["CLI service role", "cli_login_postgres", "set role service_role;", false],
		["postgres service role", "postgres", "set role service_role;", false],
		[
			"arbitrary postgres member",
			"task3_postgres_member",
			"set role postgres;",
			false,
		],
		[
			"similar CLI member name",
			"cli_login_postgres_extra",
			"set role postgres;",
			false,
		],
		[
			"authenticator identity GUC spoof",
			"authenticator",
			"set anidachi.transition_bypass='true'; set request.jwt.claim.role='postgres';",
			false,
		],
		...["anon", "authenticated", "service_role"].map((role) => [
			`authenticator SET ROLE ${role}`,
			"authenticator",
			`set role ${role};`,
			false,
		]),
	];
	const actions = [
		{
			name: "maintenance direct",
			sql: "update public.task3_fence_probe set value=value+1;",
			error: "PRODUCTION_HISTORY_MAINTENANCE",
			state: "55000",
		},
		{
			name: "maintenance SECURITY DEFINER",
			sql: "select public.task3_fence_write();",
			error: "PRODUCTION_HISTORY_MAINTENANCE",
			state: "55000",
		},
		{
			name: "maintenance other definer owner",
			sql: "select public.task3_fence_other_owner_write();",
			error: "PRODUCTION_HISTORY_MAINTENANCE",
			state: "55000",
			deny: true,
		},
		...guards.map(({ name, sql }) => ({
			name,
			sql: `do $operator$ begin ${sql} end $operator$;`,
			error: "OPERATOR_LOGIN_REQUIRED",
			state: "P0001",
		})),
	];
	const checks = [];
	for (const [name, login, role, operator] of cases) {
		for (const action of actions) {
			const accepted = operator && !action.deny;
			const query = `${fixture}
${trigger}
create trigger task3_fence before insert or update or delete or truncate on public.task3_fence_probe for each statement execute function public.task3_fence_block();
set session authorization ${login};
${role}
do $probe$
declare denied boolean:=false; message text; state text;
begin
 begin
  execute ${q(action.sql)};
 exception when others then
  get stacked diagnostics message=message_text,state=returned_sqlstate;
  if ${accepted} or message<>${q(action.error)} or state<>${q(action.state)} then raise; end if;
  denied:=true;
 end;
 if denied=${accepted} then raise exception 'FENCE_PROBE_UNEXPECTED_AUTHORIZATION'; end if;
end $probe$;
rollback;
`;
			const result = runSql(query);
			assert.ifError(result.error);
			assert.equal(
				result.status,
				0,
				`${name} / ${action.name}: ${result.stderr}`,
			);
			checks.push(`${name} / ${action.name}`);
		}
	}
	return checks;
}
