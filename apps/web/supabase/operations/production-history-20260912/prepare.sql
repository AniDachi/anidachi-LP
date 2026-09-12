-- Operator bridge, deliberately OUTSIDE supabase/migrations. Called in one
-- transaction with pg_temp.transition_input(document jsonb), after target checks.
-- Production execution is withheld pending the separate operator release review.
do $$
begin
 if not (current_user = 'postgres' and (
  (session_user = 'postgres' and current_setting('role') in ('none','postgres')) or
  (session_user = 'cli_login_postgres' and current_setting('role') = 'postgres'
   and pg_catalog.pg_has_role(session_user, 'postgres', 'MEMBER'))
 )) then raise exception 'OPERATOR_LOGIN_REQUIRED'; end if;
end $$;
create schema anidachi_transition_20260912;
revoke all on schema anidachi_transition_20260912 from public,anon,authenticated,service_role;
create table anidachi_transition_20260912.control (
 singleton boolean primary key default true check(singleton),
 document jsonb not null,
 phase text not null check(phase in ('prepared','chain_applied','verified','completed')),
 prepared_at timestamptz not null default clock_timestamp(),
 maintenance boolean not null default true
);
create table anidachi_transition_20260912.relations (
 table_name text primary key,
 descriptor jsonb not null,
 row_count bigint not null,
 row_hash text not null,
 archived boolean not null
);
create table anidachi_transition_20260912.rows (
 table_name text not null references anidachi_transition_20260912.relations(table_name),
 original_key jsonb not null,
 row_data jsonb not null,
 row_hash text not null,
 primary key(table_name,original_key)
);
create table anidachi_transition_20260912.cron_state (
 jobid bigint primary key, jobname text not null, active boolean not null
);
alter table anidachi_transition_20260912.control enable row level security;
alter table anidachi_transition_20260912.relations enable row level security;
alter table anidachi_transition_20260912.rows enable row level security;
alter table anidachi_transition_20260912.cron_state enable row level security;
revoke all on all tables in schema anidachi_transition_20260912 from public,anon,authenticated,service_role;
alter default privileges in schema anidachi_transition_20260912 revoke all on tables from public,anon,authenticated,service_role;
alter default privileges in schema anidachi_transition_20260912 revoke execute on functions from public,anon,authenticated,service_role;

create function anidachi_transition_20260912.sha(value text) returns text
language sql immutable security invoker set search_path='' as $$
 select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(value,'UTF8')),'hex')
$$;
create function anidachi_transition_20260912.descriptor(t text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'nullable',not a.attnotnull,'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
 from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
 where a.attrelid=pg_catalog.to_regclass('public.'||pg_catalog.quote_ident(t)) and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_object('name',conname,'definition',pg_catalog.pg_get_constraintdef(oid),'validated',convalidated) order by conname)
 from pg_catalog.pg_constraint where conrelid=pg_catalog.to_regclass('public.'||pg_catalog.quote_ident(t))))
$$;
create function anidachi_transition_20260912.measure(t text, descriptor jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 execute format('select jsonb_build_object(''count'',count(*),''hash'',anidachi_transition_20260912.sha(coalesce(string_agg(r::text,E''\n'' order by r::text),''''))) from (select (select jsonb_object_agg(k,to_jsonb(src)->k) from jsonb_array_elements($1->''columns'') c cross join lateral (select c->>''name'' k) key) r from public.%I src) q',t)
 into result using descriptor;
 return result;
end $$;
-- SECURITY DEFINER changes current_user, but not session_user or the selected
-- role GUC. Require both the exact login and effective postgres role. The managed
-- CLI login must explicitly SET ROLE postgres and still have real membership;
-- neither an arbitrary postgres member nor a client identity GUC is sufficient.
create function anidachi_transition_20260912.block_runtime_writes() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if not (current_user = 'postgres' and (
  (session_user = 'postgres' and current_setting('role') in ('none','postgres')) or
  (session_user = 'cli_login_postgres' and current_setting('role') = 'postgres'
   and pg_catalog.pg_has_role(session_user, 'postgres', 'MEMBER'))
 )) then
  raise exception 'PRODUCTION_HISTORY_MAINTENANCE' using errcode='55000';
 end if;
 return null;
end $$;
create function anidachi_transition_20260912.install_holds() returns void
language plpgsql security invoker set search_path='' as $$
declare t record;
begin
 if not (current_user = 'postgres' and (
  (session_user = 'postgres' and current_setting('role') in ('none','postgres')) or
  (session_user = 'cli_login_postgres' and current_setting('role') = 'postgres'
   and pg_catalog.pg_has_role(session_user, 'postgres', 'MEMBER'))
 )) then raise exception 'OPERATOR_LOGIN_REQUIRED'; end if;
 for t in select tablename from pg_catalog.pg_tables where schemaname='public' order by tablename loop
  execute format('lock table public.%I in share row exclusive mode',t.tablename);
  if not exists(select 1 from pg_catalog.pg_trigger where tgrelid=pg_catalog.to_regclass('public.'||pg_catalog.quote_ident(t.tablename)) and tgname='production_history_maintenance') then
   execute format('create trigger production_history_maintenance before insert or update or delete or truncate on public.%I for each statement execute function anidachi_transition_20260912.block_runtime_writes()',t.tablename);
  end if;
 end loop;
end $$;
revoke all on all functions in schema anidachi_transition_20260912 from public,anon,authenticated,service_role;

-- Drain every existing public writer including FK parents and mutating readers.
select anidachi_transition_20260912.install_holds();
do $$
declare doc jsonb; t record; d jsonb; m jsonb; schemas jsonb; actual_versions jsonb; key_columns text;
begin
 select document into strict doc from pg_temp.transition_input;
 select jsonb_agg(version order by version) into actual_versions from supabase_migrations.schema_migrations;
 if actual_versions <> doc->'baselineVersions' then raise exception 'BASELINE_DRIFT'; end if;
 if (select jsonb_agg(tablename order by tablename) from pg_catalog.pg_tables where schemaname='public') <> doc->'publicTables' then raise exception 'PUBLIC_SCHEMA_DRIFT'; end if;
 if (select jsonb_agg(jobname order by jobname) from cron.job) <> '["anidachi-auth-artifact-cleanup-hourly","anidachi-watch-history-receipt-cleanup-hourly"]'::jsonb then raise exception 'SCHEDULER_DRIFT'; end if;
 for t in select key,value from jsonb_each(doc->'descriptors') order by key loop
  d:=anidachi_transition_20260912.descriptor(t.key);
  if d <> t.value then raise exception 'SCHEMA_DRIFT: %',t.key; end if;
  m:=anidachi_transition_20260912.measure(t.key,d);
  if doc->'inventory' ? t.key then
   if (m->'count') <> doc->'inventory'->t.key->'count' then raise exception 'INVENTORY_DRIFT: %',t.key; end if;
   if doc->'inventory'->t.key ? 'schemas' then
    execute format('select jsonb_agg(distinct schema_version order by schema_version) from public.%I',t.key) into schemas;
    if schemas <> doc->'inventory'->t.key->'schemas' then raise exception 'ACTIVE_HISTORY_REFUSED: %',t.key; end if;
   end if;
  end if;
  insert into anidachi_transition_20260912.relations values(t.key,d,(m->>'count')::bigint,m->>'hash',doc->'inventory' ? t.key);
  if doc->'inventory' ? t.key then
   select string_agg(format('%L,to_jsonb(src)->%L',a.attname,a.attname),',' order by k.n) into key_columns
   from pg_catalog.pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum,n)
   join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
   where i.indrelid=pg_catalog.to_regclass('public.'||pg_catalog.quote_ident(t.key)) and i.indisprimary;
   if key_columns is null then raise exception 'PRIMARY_KEY_REQUIRED'; end if;
   execute format('insert into anidachi_transition_20260912.rows select %L,jsonb_build_object(%s),to_jsonb(src),anidachi_transition_20260912.sha(to_jsonb(src)::text) from public.%I src',t.key,key_columns,t.key);
  end if;
 end loop;
 -- These statements and snapshot commit together; no empty/partial snapshot can
 -- be accepted. A retry uses verify.sql and never refreshes rows from live tables.
 insert into anidachi_transition_20260912.cron_state select jobid,jobname,active from cron.job;
 for t in select jobid from cron.job loop
  perform cron.alter_job(t.jobid,active:=false);
 end loop;
 insert into anidachi_transition_20260912.control(document,phase) values(doc,'prepared');
end $$;
