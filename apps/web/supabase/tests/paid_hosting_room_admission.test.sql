begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name) values
 ('f1111111-1111-4111-8111-111111111111','hosting-legacy@example.test','Legacy'),
 ('f2222222-2222-4222-8222-222222222222','hosting-free@example.test','Free'),
 ('f3333333-3333-4333-8333-333333333333','hosting-paid@example.test','Paid'),
 ('f4444444-4444-4444-8444-444444444444','hosting-guest@example.test','Guest');
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason)
 values('f3333333-3333-4333-8333-333333333333','pro',now()+interval '1 day','hosting synthetic');
create function pg_temp.host_room(owner_id uuid,request_id text,version integer default 3) returns jsonb language plpgsql as $$
declare result jsonb;
begin
 select room_record into result from public.create_room_with_active_session_v3(owner_id,'hosting-session',null,null,null,null,null,null,null,request_id,'pro',15,8,true,true,version);
 return result;
end $$;
create temporary table hosting_results(name text primary key,value jsonb);
grant all on hosting_results to service_role;
update public.personal_history_policy set active=false;
insert into hosting_results values('legacy',pg_temp.host_room('f1111111-1111-4111-8111-111111111111','legacy',1));
update public.personal_history_policy set active=true;
insert into hosting_results values('free',pg_temp.host_room('f2222222-2222-4222-8222-222222222222','free',3));
update public.hosting_commercial_policy set activation_at=now()-interval '1 minute';
insert into public.room_members(room_id,user_id) values((select value->>'room_id' from hosting_results where name='free'),'f4444444-4444-4444-8444-444444444444');
set local role service_role;
select throws_ok($$insert into public.rooms(room_id,host_user_id,host_plan_code,status) values('hosting-raw-insert','f4444444-4444-4444-8444-444444444444','pro','lobby')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','direct insert also checks the host at insertion time');
select throws_ok($$select pg_temp.host_room('f2222222-2222-4222-8222-222222222222','new-free')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','raw v3 cannot create a Free room with forged paid capabilities');
select throws_ok($$select pg_temp.host_room('f2222222-2222-4222-8222-222222222222','free')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','idempotent create cannot revive the existing Free room');
select throws_ok($$select public.create_room_with_active_session_v2('f4444444-4444-4444-8444-444444444444','guest-host',null,null,null,null,null,null,null,'old-v2','pro',15,8,true,true,2)$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','legacy v2 create delegates to the hosting gate');
select throws_ok($$select public.claim_active_room_session_v3('f2222222-2222-4222-8222-222222222222',(select value->>'room_id' from hosting_results where name='free'),'host','reconnect',3)$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','existing host cannot reconnect to the closing Free room');
select throws_ok($$select public.claim_active_room_session_v3('f4444444-4444-4444-8444-444444444444',(select value->>'room_id' from hosting_results where name='free'),'member','guest-reconnect',3)$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','Free guest cannot newly connect to the closing Free room');
select throws_ok($$select public.claim_active_room_session_v1('f1111111-1111-4111-8111-111111111111',(select value->>'room_id' from hosting_results where name='legacy'),'host','legacy-reconnect')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','legacy claim wrapper cannot bypass the gate');
insert into hosting_results values('free-denied',public.renew_room_media_lease_v3((select value->>'room_id' from hosting_results where name='free')));
select is((select value->>'denied' from hosting_results where name='free-denied'),'true','Free room lease cannot renew');
select is((select (value->>'closingAt')::timestamptz from hosting_results where name='free-denied'),(select activation_at from public.hosting_commercial_policy),'Free room closes at original activation T without a transition grace period');
select is(public.renew_room_media_lease_v2((select value->>'room_id' from hosting_results where name='free'))->>'closingAt',(select value->>'closingAt' from hosting_results where name='free-denied'),'renewal does not move the deadline');
insert into hosting_results values('legacy-denied',public.renew_room_media_lease_v2((select value->>'room_id' from hosting_results where name='legacy')));
select is((select value->>'denied' from hosting_results where name='legacy-denied'),'true','legacy rooms without a media lease are denied too');
select is((select (value->>'closingAt')::timestamptz from hosting_results where name='legacy-denied'),(select activation_at from public.hosting_commercial_policy),'legacy Free rooms also close at T without waiting for an extension update');
insert into hosting_results values('paid',pg_temp.host_room('f3333333-3333-4333-8333-333333333333','paid'));
select is((select value->>'host_plan_code' from hosting_results where name='paid'),'pro','paid host can create using authoritative plan');
reset role;
insert into public.room_members(room_id,user_id) values((select value->>'room_id' from hosting_results where name='paid'),'f4444444-4444-4444-8444-444444444444');
set local role service_role;
select is((select outcome from public.claim_active_room_session_v3('f4444444-4444-4444-8444-444444444444',(select value->>'room_id' from hosting_results where name='paid'),'member','paid-guest',3)),'claimed','Free account still joins a paid host');
select is(public.resolve_watch_history_access_v1('f4444444-4444-4444-8444-444444444444')#>>'{history,state}','plan_required','joining paid host does not grant personal history');
reset role;
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason)
 values('f2222222-2222-4222-8222-222222222222','pro',now()+interval '1 day','upgrade after cutover');
set local role service_role;
select throws_ok($$select pg_temp.host_room('f2222222-2222-4222-8222-222222222222','free')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','host upgrade cannot transform frozen Free room');
select is(public.renew_room_media_lease_v3((select value->>'room_id' from hosting_results where name='free'))->>'closingAt',(select value->>'closingAt' from hosting_results where name='free-denied'),'host upgrade keeps the Free room close deadline');
reset role;
update public.account_manual_plan_grants set valid_until=now()-interval '1 second' where user_id='f3333333-3333-4333-8333-333333333333';
set local role service_role;
select throws_ok($$select public.claim_active_room_session_v3('f3333333-3333-4333-8333-333333333333',(select value->>'room_id' from hosting_results where name='paid'),'host','lost-paid',3)$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','lost rights reject new host admission immediately');
insert into hosting_results values('paid-denied',public.renew_room_media_lease_v3((select value->>'room_id' from hosting_results where name='paid')));
select is((select value->>'denied' from hosting_results where name='paid-denied'),'true','lost paid rights enter existing ordered closure');
select cmp_ok((select (value->>'closingAt')::timestamptz from hosting_results where name='paid-denied'),'>=',clock_timestamp()+interval '4 minutes 59 seconds','ordinary paid access loss retains its separate five-minute grace');
select cmp_ok((select (value->>'closingAt')::timestamptz from hosting_results where name='paid-denied'),'<=',clock_timestamp()+interval '5 minutes','ordinary paid access loss grace does not exceed five minutes');
reset role;
update public.personal_history_policy set active=false;
set local role service_role;
select throws_ok($$select public.create_room_with_active_session_v1('f4444444-4444-4444-8444-444444444444','old-create',null,null,null,null,null,null,null,'old-v1','pro',15,8,true,true)$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','v1 creation cannot bypass hosting policy if media rollout is inactive');
reset role;
select * from finish();
rollback;
