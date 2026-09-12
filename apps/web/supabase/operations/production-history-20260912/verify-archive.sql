-- Run inside a transaction for prepare retry, status, every apply/resume, finish.
do $$
declare r record; actual_hash text; actual_count bigint; doc jsonb; measured jsonb;
begin
 if not (current_user = 'postgres' and (
  (session_user = 'postgres' and current_setting('role') in ('none','postgres')) or
  (session_user = 'cli_login_postgres' and current_setting('role') = 'postgres'
   and pg_catalog.pg_has_role(session_user, 'postgres', 'MEMBER'))
 )) then raise exception 'OPERATOR_LOGIN_REQUIRED'; end if;
 select document into strict doc from anidachi_transition_20260912.control where singleton;
 if doc <> (select document from pg_temp.transition_input) then raise exception 'TRANSITION_DOCUMENT_DRIFT'; end if;
 if (select count(*) from anidachi_transition_20260912.relations where archived) <> 10 then raise exception 'ARCHIVE_RELATIONS_MISSING'; end if;
 for r in select * from anidachi_transition_20260912.relations where archived loop
  select count(*),anidachi_transition_20260912.sha(coalesce(string_agg(row_data::text,E'\n' order by row_data::text),''))
   into actual_count,actual_hash from anidachi_transition_20260912.rows where table_name=r.table_name;
  if actual_count<>r.row_count or actual_hash<>r.row_hash then raise exception 'ARCHIVE_CORRUPT: %',r.table_name; end if;
 end loop;
 if exists(select 1 from anidachi_transition_20260912.rows where row_hash<>anidachi_transition_20260912.sha(row_data::text)) then raise exception 'ARCHIVE_ROW_CORRUPT'; end if;
 -- Operator-side drift also fails closed. Before the canonical reset, even an
 -- equal-count replacement must not silently lose a newly changed legacy row.
 for r in select * from anidachi_transition_20260912.relations where not archived or
   (select max(version) from supabase_migrations.schema_migrations) < '20260904205540' loop
  measured:=anidachi_transition_20260912.measure(r.table_name,r.descriptor);
  if (measured->>'count')::bigint<>r.row_count or measured->>'hash'<>r.row_hash then raise exception 'LIVE_SNAPSHOT_DRIFT: %',r.table_name; end if;
 end loop;
 if exists(select 1 from anidachi_transition_20260912.control where not maintenance) then raise exception 'MAINTENANCE_NOT_HELD'; end if;
 if exists(select 1 from jsonb_array_elements_text(doc->'publicTables') p(t)
   where not exists(select 1 from pg_catalog.pg_trigger where tgrelid=pg_catalog.to_regclass('public.'||pg_catalog.quote_ident(t)) and tgname='production_history_maintenance' and tgenabled='O')) then raise exception 'MAINTENANCE_TRIGGER_MISSING'; end if;
 if exists(select 1 from anidachi_transition_20260912.control where phase='completed') and exists(
   select 1 from pg_catalog.pg_tables p where schemaname='public' and not exists(
    select 1 from pg_catalog.pg_trigger where tgrelid=pg_catalog.to_regclass('public.'||pg_catalog.quote_ident(p.tablename))
     and tgname='production_history_maintenance' and tgenabled='O')) then raise exception 'NEW_TABLE_MAINTENANCE_MISSING'; end if;
 if exists(select 1 from cron.job j join anidachi_transition_20260912.cron_state s using(jobid) where j.active or j.jobname<>s.jobname)
   or (select count(*) from cron.job j join anidachi_transition_20260912.cron_state s using(jobid))<>2 then raise exception 'MAINTENANCE_CRON_DRIFT'; end if;
 if (select jsonb_agg(jobname order by jobname) from cron.job) <> (case
   when (select max(version) from supabase_migrations.schema_migrations)>='20260904154732'
   then '["anidachi-auth-artifact-cleanup-hourly","anidachi-inbox-push-drain","anidachi-watch-history-receipt-cleanup-hourly"]'::jsonb
   else '["anidachi-auth-artifact-cleanup-hourly","anidachi-watch-history-receipt-cleanup-hourly"]'::jsonb end)
 then raise exception 'UNEXPECTED_SCHEDULER'; end if;
 if exists(select 1 from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role') and pg_catalog.has_schema_privilege(rolname,'anidachi_transition_20260912','USAGE')) then raise exception 'ARCHIVE_ACL_DRIFT'; end if;
end $$;
