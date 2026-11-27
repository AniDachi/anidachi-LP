-- Synthetic fixtures in a disposable database. All changes roll back.
begin;
set local statement_timeout = '20s';
create extension if not exists pgtap with schema extensions;
set local search_path = public,extensions;
select no_plan();
insert into public.users(id,email,display_name)
values ('f6300000-0000-4000-8000-000000000001','free30@example.test','Allowance fixture');
update public.personal_history_policy set active=true;
update public.hosting_commercial_policy set free20_enabled=true,free20_abuse_enabled=true,
  trials_enabled=false,activation_at=clock_timestamp()-interval '1 day',free_daily_host_seconds=1200;
insert into public.usage_daily(user_id,day,host_seconds)
values ('f6300000-0000-4000-8000-000000000001',(now() at time zone 'UTC')::date,1080);
insert into anidachi_room_private.free20_marker_days(kind,marker_hash,day,committed_seconds)
values ('browser',repeat('a',64),(now() at time zone 'UTC')::date,1200);

create function pg_temp.access() returns jsonb language sql as $$
 select public.resolve_free20_context_access_v1('f6300000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64))
$$;
create function pg_temp.host(client_version integer) returns text language sql as $$
 select outcome from public.create_room_with_active_session_v5(
  'f6300000-0000-4000-8000-000000000001','host',null,null,null,null,null,null,null,'free30','free',
  4,4,false,false,3,client_version,repeat('a',64),repeat('b',64))
$$;
set local role service_role;
select is(pg_temp.access()->>'remainingSeconds','0','exhausted 20-minute installation has no old time left');
reset role;
update public.hosting_commercial_policy set free_daily_host_seconds=1800;
set local role service_role;
select is(public.resolve_free20_hosting_access_v1('f6300000-0000-4000-8000-000000000001')->>'remainingSeconds','720','18 spent minutes leave 12 on the account');
select is(pg_temp.access()->>'remainingSeconds','600','20 spent minutes on a shared browser leave 10');
select throws_ok('select pg_temp.host(1)','P0001','ROOM_UPDATE_REQUIRED_FREE20','old Free host gets an actionable update response');
select lives_ok('select pg_temp.host(2)','current host can start a new room from the remaining ten minutes');
reset role;
update anidachi_room_private.free20_marker_days set committed_seconds=1800
where kind='browser' and marker_hash=repeat('a',64) and day=(now() at time zone 'UTC')::date;
set local role service_role;
select is(pg_temp.access()->>'canHost','false','the shared scope enforces the new daily maximum');
select is(pg_temp.access()->>'remainingSeconds','0','zero remains after 30 minutes');
select * from finish();
rollback;
