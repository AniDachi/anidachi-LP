-- Full chain must be present. Never relabel v1 or replay it through current RPCs.
do $$
declare doc jsonb; versions jsonb; r record; m jsonb; n bigint;
begin
 select document into strict doc from anidachi_transition_20260912.control where singleton;
 select jsonb_agg(version order by version) into versions from supabase_migrations.schema_migrations;
 if versions<>doc->'targetVersions' then raise exception 'TARGET_CHAIN_INCOMPLETE'; end if;
 update anidachi_transition_20260912.control set phase='chain_applied' where phase='prepared';
 for r in select * from anidachi_transition_20260912.relations loop
  m:=anidachi_transition_20260912.measure(r.table_name,r.descriptor);
  if not r.archived then
   if (m->>'count')::bigint<>r.row_count or m->>'hash'<>r.row_hash then raise exception 'UNRELATED_DATA_DRIFT: %',r.table_name; end if;
  elsif r.table_name <> 'user_watch_settings' then
   if (m->>'count')::bigint<>0 then raise exception 'INVENTED_HISTORY: %',r.table_name; end if;
  else
   if (m->>'count')::bigint<>r.row_count then raise exception 'SETTINGS_OWNERS_DRIFT'; end if;
   if exists(select 1 from anidachi_transition_20260912.rows a left join public.user_watch_settings s on s.user_id=(a.row_data->>'user_id')::uuid
    where a.table_name='user_watch_settings' and (s.user_id is null or s.history_generation<>(a.row_data->>'history_generation')::bigint+1
     or s.next_server_order<>(a.row_data->>'next_server_order')::bigint
     or s.youtube_history_enabled<>(a.row_data->>'youtube_history_enabled')::boolean or s.write_schema_version<>3)) then raise exception 'SETTINGS_FENCE_DRIFT'; end if;
  end if;
 end loop;
 if (select active from public.personal_history_policy where singleton) is distinct from false then raise exception 'POLICY_MUST_STAY_INACTIVE'; end if;
 if (select enabled from anidachi_private.inbox_push_scheduler where singleton) is distinct from false then raise exception 'SCHEDULER_MUST_STAY_DISABLED'; end if;
 if exists(select 1 from public.account_manual_plan_grants g full join
   (select u.id,u.plan from public.users u where u.plan in ('plus','pro') and not exists(select 1 from public.subscriptions s where s.user_id=u.id)) expected on g.user_id=expected.id
   where g.user_id is null or expected.id is null or g.plan_code<>expected.plan or g.valid_until is not null) then raise exception 'MANUAL_PLAN_GRANT_DRIFT'; end if;
 if exists(select 1 from public.watch_catalog_snapshots) or exists(select 1 from public.personal_watch_sequences) or exists(select 1 from public.watch_history_session_observations) or exists(select 1 from public.watch_history_session_groups) then raise exception 'INVENTED_CANONICAL_HISTORY'; end if;
 update anidachi_transition_20260912.control set phase='verified' where phase='chain_applied';
end $$;
-- Cover new tables before any new runtime may be delivered. This does NOT reopen
-- traffic or activate shared media/personal policy. Cron remains suspended.
select anidachi_transition_20260912.install_holds();
update anidachi_transition_20260912.control set phase='completed' where phase='verified';
