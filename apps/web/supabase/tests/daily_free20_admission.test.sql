-- Disposable/rollback-only fixtures; actual PostgREST role exercises every RPC.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name) values
 ('f6200000-0000-4000-8000-000000000001','free20-host@example.test','Free20 host'),
 ('f6200000-0000-4000-8000-000000000002','free20-guest@example.test','Free20 guest'),
 ('f6200000-0000-4000-8000-000000000003','free20-legacy@example.test','Legacy host');
create function pg_temp.free20_create(owner_id uuid,request_id text,version integer default 3)
returns jsonb language sql as $$
 select jsonb_build_object('outcome',outcome,'room',room_record,'activeRoom',active_room)
 from public.create_room_with_active_session_v3(owner_id,'host-session',null,null,null,null,null,null,null,request_id,'pro',15,8,true,true,version);
$$;
create temporary table free20_results(name text primary key,value jsonb);
grant all on free20_results to service_role;
update public.personal_history_policy set active=true;
insert into free20_results values('legacy',pg_temp.free20_create('f6200000-0000-4000-8000-000000000003','legacy'));
update public.hosting_commercial_policy set activation_at=clock_timestamp()-interval '1 minute';
insert into public.usage_daily(user_id,day,host_seconds) values
 ('f6200000-0000-4000-8000-000000000001',(clock_timestamp() at time zone 'UTC')::date,420),
 ('f6200000-0000-4000-8000-000000000002',(clock_timestamp() at time zone 'UTC')::date,1200);
set local role service_role;
select throws_ok($$select pg_temp.free20_create('f6200000-0000-4000-8000-000000000001','off')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','disabled policy keeps the existing paid-hosting gate');
select lives_ok($$insert into free20_results values('disabled',public.resolve_free20_hosting_access_v1('f6200000-0000-4000-8000-000000000001'))$$,'new reader exists without enabling hosting');
select is((select value from free20_results where name='disabled'),'{"enabled":false}'::jsonb,'reader is dormant by default');
select ok(not has_table_privilege('service_role','public.hosting_commercial_policy','UPDATE'),'runtime cannot enable Free20');
select ok(not has_function_privilege('authenticated','public.resolve_free20_hosting_access_v1(uuid)','EXECUTE'),'browser cannot issue time authority');
reset role;
select lives_ok($$update public.hosting_commercial_policy set free20_enabled=true$$,'operator can enable candidate in this rollback-only transaction');
set local role service_role;
select lives_ok($$insert into free20_results values('access',public.resolve_free20_hosting_access_v1('f6200000-0000-4000-8000-000000000001'))$$,'Free20 reads confirmed daily usage');
select is((select value->>'remainingSeconds' from free20_results where name='access'),'780','seven used minutes leave thirteen');
select is(public.resolve_watch_history_access_v1('f6200000-0000-4000-8000-000000000001')#>>'{history,state}','plan_required','Free20 grants no new history rights');
select throws_ok($$select public.require_room_hosting_admission_v1((select value#>>'{room,room_id}' from free20_results where name='legacy'),'f6200000-0000-4000-8000-000000000003')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','enabling Free20 does not revive a legacy Free room');
select throws_ok($$select pg_temp.free20_create('f6200000-0000-4000-8000-000000000001','old-protocol',2)$$,'P0001','ROOM_UPDATE_REQUIRED','new daily rooms require current media protocol');
select lives_ok($$insert into free20_results values('room',pg_temp.free20_create('f6200000-0000-4000-8000-000000000001','daily'))$$,'confirmed remainder admits a Free host');
select is((select value#>>'{room,hosting_time_mode}' from free20_results where name='room'),'daily_free20','new room pins its time mode durably');
select is((select value#>>'{room,host_plan_code}' from free20_results where name='room'),'free','caller cannot forge paid capacity');
select is((select value#>>'{room,media_lease,capabilities,maxParticipants}' from free20_results where name='room'),'4','four participants including host');
select is((select value#>>'{room,media_lease,capabilities,maxMediaSeats}' from free20_results where name='room'),'4','four media seats');
select is(pg_temp.free20_create('f6200000-0000-4000-8000-000000000001','daily')#>>'{room,room_id}',(select value#>>'{room,room_id}' from free20_results where name='room'),'same request reuses the same room');
select is(pg_temp.free20_create('f6200000-0000-4000-8000-000000000001','second')->>'outcome','conflict','another room cannot bypass active host assignment');
insert into public.room_members(room_id,user_id) select value#>>'{room,room_id}','f6200000-0000-4000-8000-000000000002' from free20_results where name='room';
select lives_ok($$select public.claim_active_room_session_v3('f6200000-0000-4000-8000-000000000002',(select value#>>'{room,room_id}' from free20_results where name='room'),'member','guest',3)$$,'guest with exhausted own budget can join');
select is((select public.check_room_hosting_socket_v1(value#>>'{room,room_id}','f6200000-0000-4000-8000-000000000001')->>'hostingTimeMode' from free20_results where name='room'),'daily_free20','Worker receives the durable mode');
select lives_ok($$select public.commit_room_usage_day_v1((select value#>>'{room,room_id}' from free20_results where name='room'),(clock_timestamp() at time zone 'UTC')::date,180)$$,'actual room usage commits');
select lives_ok($$select public.commit_room_usage_day_v1((select value#>>'{room,room_id}' from free20_results where name='room'),(clock_timestamp() at time zone 'UTC')::date,180)$$,'lost-response retry is idempotent');
select is(public.resolve_free20_hosting_access_v1('f6200000-0000-4000-8000-000000000001')->>'remainingSeconds','600','seven prior plus three live committed minutes leave ten');
set local time zone 'Etc/GMT+12';
select is(public.resolve_free20_hosting_access_v1('f6200000-0000-4000-8000-000000000001')->>'remainingSeconds','600','session timezone never changes the daily bucket');
select is((public.resolve_free20_hosting_access_v1('f6200000-0000-4000-8000-000000000001')->>'resetAt')::timestamptz,(((clock_timestamp() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC'),'reset is the next UTC midnight');
set local time zone 'UTC';
reset role;
update public.rooms set created_at=created_at-interval '1 day' where room_id=(select value#>>'{room,room_id}' from free20_results where name='room');
set local role service_role;
select lives_ok($$select public.commit_room_usage_day_v1((select value#>>'{room,room_id}' from free20_results where name='room'),(clock_timestamp() at time zone 'UTC')::date-1,1200)$$,'late previous-day ACK stays in the old day');
select is(public.resolve_free20_hosting_access_v1('f6200000-0000-4000-8000-000000000001')->>'remainingSeconds','600','old-day settlement does not spend or restore current-day minutes');
select is((select public.renew_room_media_lease_v3(value#>>'{room,room_id}')#>>'{capabilities,hostPlanCode}' from free20_results where name='room'),'free','finite room renews under service role');
reset role;
update public.hosting_commercial_policy set free20_enabled=false;
set local role service_role;
select throws_ok($$select public.require_room_hosting_admission_v1((select value#>>'{room,room_id}' from free20_results where name='room'),'f6200000-0000-4000-8000-000000000001')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','disabling policy stops new admission to marked rooms');
reset role;
update public.hosting_commercial_policy set free20_enabled=true;
set local role service_role;
select throws_ok($$insert into public.rooms(room_id,host_user_id,host_plan_code,max_participants,max_media_seats,status) values('forged-free20-paid','f6200000-0000-4000-8000-000000000001','pro',15,8,'lobby')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','raw insertion cannot forge paid capabilities');
reset role;
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason)
 values('f6200000-0000-4000-8000-000000000001','plus',clock_timestamp()+interval '1 hour','synthetic confirmed right');
set local role service_role;
select is(public.resolve_free20_hosting_access_v1('f6200000-0000-4000-8000-000000000001')->>'planCode','plus','confirmed paid time wins without relabeling its source');
select is((select public.renew_room_media_lease_v3(value#>>'{room,room_id}')#>>'{capabilities,maxParticipants}' from free20_results where name='room'),'4','upgrade preserves pinned room capacity');
select lives_ok($$select public.commit_room_usage_day_v1((select value#>>'{room,room_id}' from free20_results where name='room'),(clock_timestamp() at time zone 'UTC')::date,780)$$,'outstanding cumulative usage survives upgrade');
select lives_ok($$select public.require_room_hosting_admission_v1((select value#>>'{room,room_id}' from free20_results where name='room'),'f6200000-0000-4000-8000-000000000001')$$,'confirmed paid access remains valid after Free budget is used');
reset role;
update public.account_manual_plan_grants set valid_until=clock_timestamp()-interval '1 second' where user_id='f6200000-0000-4000-8000-000000000001';
set local role service_role;
select is(public.resolve_free20_hosting_access_v1('f6200000-0000-4000-8000-000000000001')->>'remainingSeconds','0','paid expiry returns to real used remainder');
select throws_ok($$select public.require_room_hosting_admission_v1((select value#>>'{room,room_id}' from free20_results where name='room'),'f6200000-0000-4000-8000-000000000001')$$,'P0001','QUOTA_EXHAUSTED','zero budget cannot rejoin');
insert into free20_results select 'expired',public.renew_room_media_lease_v3(value#>>'{room,room_id}') from free20_results where name='room';
select is((select value->>'denied' from free20_results where name='expired'),'true','zero denies renewal');
select ok((select (value->>'closingAt')::timestamptz<=clock_timestamp() from free20_results where name='expired'),'quota zero adds no payment grace');
reset role;
update public.account_manual_plan_grants set valid_until=clock_timestamp()+interval '1 hour'
 where user_id='f6200000-0000-4000-8000-000000000001';
set local role service_role;
select is((select public.renew_room_media_lease_v3(value#>>'{room,room_id}')->>'closingAt' from free20_results where name='room'),(select value->>'closingAt' from free20_results where name='expired'),'late grant never clears a terminal deadline');
select throws_ok($$update public.rooms set hosting_time_mode=null where room_id=(select value#>>'{room,room_id}' from free20_results where name='room')$$,'P0001','ROOM_TIME_MODE_IMMUTABLE','room mode cannot change during its lifetime');
reset role;
select * from finish();
rollback;
