-- Rollback-only; RPC calls execute under the real runtime role.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name) values
 ('f6230000-0000-4000-8000-000000000001','client-host@example.test','Client host'),
 ('f6230000-0000-4000-8000-000000000002','client-guest@example.test','Client guest'),
 ('f6230000-0000-4000-8000-000000000003','client-outsider@example.test','Client outsider'),
 ('f6230000-0000-4000-8000-000000000004','client-paid@example.test','Client paid');
update public.personal_history_policy set active=true;
update public.hosting_commercial_policy set activation_at=clock_timestamp()-interval '1 day',free20_enabled=true,trials_enabled=false;
set local role service_role;
select throws_ok($$select * from public.create_room_with_active_session_v3('f6230000-0000-4000-8000-000000000001','host',null,null,null,null,null,null,null,'old','free',4,4,false,false,3)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','old media3 alone cannot create a Free20 room');
reset role;
select is((select count(*)::integer from public.rooms where host_user_id='f6230000-0000-4000-8000-000000000001'),0,'unsupported legacy caller creates no room');
select is((select count(*)::integer from public.active_room_sessions where user_id='f6230000-0000-4000-8000-000000000001'),0,'unsupported legacy caller creates no assignment');

create function pg_temp.client_create(owner_id uuid,request_id text,client_version integer default 1,session_id text default 'host',media integer default 3)
returns jsonb language sql as $$
 select jsonb_build_object('outcome',outcome,'room',room_record,'activeRoom',active_room)
 from public.create_room_with_active_session_v4(owner_id,session_id,null,null,'netflix','https://www.netflix.com/watch/123','netflix|watch/123',1,null,request_id,'pro',15,8,true,true,media,client_version);
$$;
create temporary table client_results(name text primary key,value jsonb);
grant all on client_results to service_role;
create function pg_temp.client_snapshot() returns jsonb language sql as $$
 select jsonb_build_object('rooms',(select jsonb_agg(to_jsonb(r) order by room_id) from public.rooms r),
 'assignments',(select jsonb_agg(to_jsonb(a) order by user_id) from public.active_room_sessions a));
$$;
set local role service_role;
select throws_ok(format('select pg_temp.client_create(%L,%L,%s)',
 'f6230000-0000-4000-8000-000000000001','unsupported',coalesce(v::text,'null')),
 'P0001','ROOM_UPDATE_REQUIRED_FREE20','v4 rejects unsupported capability '||coalesce(v::text,'null')) from unnest(array[null,0,2]) v;
select throws_ok($$select pg_temp.client_create('f6230000-0000-4000-8000-000000000001','media2',1,'host',2)$$,'P0001','ROOM_UPDATE_REQUIRED','independent media3 requirement survives');
select lives_ok($$insert into client_results values('daily',pg_temp.client_create('f6230000-0000-4000-8000-000000000001','current'))$$,'supported v4 creates the room');
select is((select value#>>'{room,hosting_time_mode}' from client_results where name='daily'),'daily_free20','room is marked');
select is((select value#>>'{room,source_provider}' from client_results where name='daily'),'netflix','Netflix source survives');
select is((select value#>>'{room,media_lease,capabilities,maxParticipants}' from client_results where name='daily'),'4','canonical Free participant cap');
select is((select value#>>'{room,media_lease,capabilities,maxMediaSeats}' from client_results where name='daily'),'4','canonical Free media cap');
insert into client_results values('snapshot',pg_temp.client_snapshot());
select throws_ok(format('select pg_temp.client_create(%L,%L,null,%L)',
 'f6230000-0000-4000-8000-000000000001','current',session_id),'P0001','ROOM_UPDATE_REQUIRED_FREE20','unsupported replay/replacement rejects '||session_id)
 from unnest(array['host','replacement']) session_id;
select throws_ok($$select pg_temp.client_create('f6230000-0000-4000-8000-000000000001','different',null)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','unsupported candidate426 takes precedence over active-room conflict');
select is(pg_temp.client_snapshot(),(select value from client_results where name='snapshot'),'denied replay leaves full rooms and assignments unchanged');
select is(pg_temp.client_create('f6230000-0000-4000-8000-000000000001','current')#>>'{room,room_id}',(select value#>>'{room,room_id}' from client_results where name='daily'),'supported replay returns same room');
select is(pg_temp.client_create('f6230000-0000-4000-8000-000000000001','different')->>'outcome','conflict','supported conflict unchanged');
select throws_ok($$select public.claim_active_room_session_v3('f6230000-0000-4000-8000-000000000001',(select value#>>'{room,room_id}' from client_results where name='daily'),'host','host',3)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','old claimv3 cannot refresh assignment');
select throws_ok($$select public.claim_active_room_session_v4('f6230000-0000-4000-8000-000000000003',(select value#>>'{room,room_id}' from client_results where name='daily'),'host','outsider',3,1)$$,'42501','active_room_session_role_invalid','capability cannot forge host role');
select throws_ok($$select public.claim_active_room_session_v4('f6230000-0000-4000-8000-000000000003',(select value#>>'{room,room_id}' from client_results where name='daily'),'member','outsider',3,1)$$,'42501','active_room_session_role_invalid','capability cannot forge membership');
select throws_ok($$select public.claim_active_room_session_v4(null,'missing','host','session',3,1)$$,'22023','active_room_session_invalid_input','input validation precedes admission');
select throws_ok($$select public.claim_active_room_session_v4('f6230000-0000-4000-8000-000000000001','missing','host','session',3,1)$$,'P0002','active_room_session_room_not_found','missing room behavior retained');
insert into public.room_members(room_id,user_id) select value#>>'{room,room_id}',u from client_results cross join unnest(array['f6230000-0000-4000-8000-000000000001'::uuid,'f6230000-0000-4000-8000-000000000002'::uuid]) u where name='daily';
select throws_ok($$select public.claim_active_room_session_v4('f6230000-0000-4000-8000-000000000001',(select value#>>'{room,room_id}' from client_results where name='daily'),'member','spoof',3,null)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','host cannot bypass capability by selecting member role');
reset role;
insert into public.usage_daily(user_id,day,host_seconds) values('f6230000-0000-4000-8000-000000000002',(clock_timestamp() at time zone 'UTC')::date,1200);
set local role service_role;
select lives_ok($$select public.claim_active_room_session_v3('f6230000-0000-4000-8000-000000000002',(select value#>>'{room,room_id}' from client_results where name='daily'),'member','old-guest',3)$$,'old guest works with exhausted own quota');
select lives_ok($$select public.renew_room_media_lease_v3((select value#>>'{room,room_id}' from client_results where name='daily'))$$,'ongoing renewal needs no capability');
select is(public.check_room_hosting_socket_v1((select value#>>'{room,room_id}' from client_results where name='daily'),'f6230000-0000-4000-8000-000000000001')->>'allowed','true','ongoing socket check needs no capability');
reset role;
insert into public.usage_daily(user_id,day,host_seconds) values('f6230000-0000-4000-8000-000000000001',(clock_timestamp() at time zone 'UTC')::date,1200);
set local role service_role;
select throws_ok($$select pg_temp.client_create('f6230000-0000-4000-8000-000000000001','current',null)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','replay426 precedes exhausted quota');
select throws_ok($$select public.claim_active_room_session_v4('f6230000-0000-4000-8000-000000000001',(select value#>>'{room,room_id}' from client_results where name='daily'),'host','host',3,null)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','claim426 precedes exhausted quota');
reset role;
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values
 ('f6230000-0000-4000-8000-000000000001','plus',clock_timestamp()+interval '1 hour','client synthetic'),
 ('f6230000-0000-4000-8000-000000000004','plus',clock_timestamp()+interval '1 hour','client synthetic');
set local role service_role;
select throws_ok($$select pg_temp.client_create('f6230000-0000-4000-8000-000000000001','current',null)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','paid-upgraded marked replay still requires capability');
select throws_ok($$select public.claim_active_room_session_v4('f6230000-0000-4000-8000-000000000001',(select value#>>'{room,room_id}' from client_results where name='daily'),'host','host',3,null)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','paid-upgraded marked claim still requires capability');
select lives_ok($$insert into client_results values('paid',pg_temp.client_create('f6230000-0000-4000-8000-000000000004','paid',null))$$,'ordinary manual paid create works without capability');
select is((select value#>>'{room,hosting_time_mode}' from client_results where name='paid'),null,'ordinary paid room remains unmarked');
select lives_ok($$select public.claim_active_room_session_v3('f6230000-0000-4000-8000-000000000004',(select value#>>'{room,room_id}' from client_results where name='paid'),'host','paid-host',3)$$,'ordinary paid reconnect works without capability');
select throws_ok($$select public.claim_active_room_session_v1('f6230000-0000-4000-8000-000000000001',(select value#>>'{room,room_id}' from client_results where name='daily'),'host','host')$$,'P0001','ROOM_UPDATE_REQUIRED','old claimv1 nonnull media guard retained');
select throws_ok($$select public.claim_active_room_session_v2('f6230000-0000-4000-8000-000000000001',(select value#>>'{room,room_id}' from client_results where name='daily'),'host','host',2)$$,'P0001','ROOM_UPDATE_REQUIRED','old claimv2 media compatibility retained');
reset role;

-- Exercise legacy private routes as the owning definer and direct runtime ACLs.
select throws_ok($$select * from anidachi_room_private.create_room_with_active_session_v1('f6230000-0000-4000-8000-000000000001','host',null,null,null,null,null,null,null,'current','free',4,4,false,false)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','old private create cannot bypass marked replay');
select throws_ok($$select * from anidachi_room_private.claim_active_room_session_v1('f6230000-0000-4000-8000-000000000001',(select value#>>'{room,room_id}' from client_results where name='daily'),'host','host')$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','old private claim cannot bypass marked host');
-- Removing media only inside this rollback fixture exercises publicv1's private
-- wrapper path, separately from its preserved non-null-media refusal above.
update public.rooms set media_lease=null where room_id=(select value#>>'{room,room_id}' from client_results where name='daily');
set local role service_role;
select throws_ok($$select * from public.claim_active_room_session_v1('f6230000-0000-4000-8000-000000000001',(select value#>>'{room,room_id}' from client_results where name='daily'),'host','host')$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','public claimv1 null-media path cannot bypass guard');
select throws_ok($$select * from public.create_room_with_active_session_v1('f6230000-0000-4000-8000-000000000001','host',null,null,null,null,null,null,null,'current','free',4,4,false,false)$$,'P0001','ROOM_UPDATE_REQUIRED','public createv1 retains old media refusal');
select throws_ok($$select * from public.create_room_with_active_session_v2('f6230000-0000-4000-8000-000000000001','host',null,null,null,null,null,null,null,'current','free',4,4,false,false,2)$$,'P0001','ROOM_UPDATE_REQUIRED_FREE20','public createv2 cannot bypass marked target');
reset role;
update public.rooms set media_lease=(select value#>'{room,media_lease}' from client_results where name='daily') where room_id=(select value#>>'{room,room_id}' from client_results where name='daily');
insert into public.users(id,email,display_name) values
 ('f6230000-0000-4000-8000-000000000005','client-sub@example.test','Paid subscription'),
 ('f6230000-0000-4000-8000-000000000006','client-trial@example.test','Existing trial');
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end,cancel_at_period_end) values
 ('f6230000-0000-4000-8000-000000000005','cus_client_paid','sub_client_paid','price_client','plus','active',now()+interval '1 day',true),
 ('f6230000-0000-4000-8000-000000000006','cus_client_trial','sub_client_trial','price_client','pro','trialing',now()+interval '71 hours',false);
insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at) values
 ('f6230000-0000-4000-8000-000000000006','sub_client_trial',now()-interval '1 hour',now()+interval '71 hours');
set local role service_role;
select lives_ok($$insert into client_results values('subscription',pg_temp.client_create('f6230000-0000-4000-8000-000000000005','subscription',null))$$,'ordinary paid subscription creates without new capability');
select lives_ok($$insert into client_results values('trial',pg_temp.client_create('f6230000-0000-4000-8000-000000000006','trial',null))$$,'existing trial creates without new capability');
select is((select value#>>'{room,hosting_time_mode}' from client_results where name='subscription'),null,'subscription room unmarked');
select is((select value#>>'{room,hosting_time_mode}' from client_results where name='trial'),null,'existing trial room unmarked');
reset role;
-- All exact overloads stay service-only; private cores are not directly callable.
select ok(p.prosecdef and p.proconfig @> array['search_path=""','lock_timeout=5s','statement_timeout=30s'],p.proname||' fixed definer configuration')
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('create_room_with_active_session_v4','claim_active_room_session_v4');
select ok(not has_function_privilege(r,p.oid,'EXECUTE'),r||' denied '||p.oid::regprocedure::text)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join unnest(array['anon','authenticated']) r
 where (n.nspname='public' and p.proname in('create_room_with_active_session_v1','create_room_with_active_session_v2','create_room_with_active_session_v3','create_room_with_active_session_v4','claim_active_room_session_v1','claim_active_room_session_v2','claim_active_room_session_v3','claim_active_room_session_v4'))
 or (n.nspname='anidachi_room_private' and p.proname in('create_room_with_active_session_v1','create_room_with_active_session_v2','claim_active_room_session_v1','claim_active_room_session_v2'));
select ok(not p.prosecdef and not has_function_privilege('service_role',p.oid,'EXECUTE'),'runtime denied private invoker '||p.oid::regprocedure::text)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='anidachi_room_private' and p.proname in('create_room_with_active_session_v1','create_room_with_active_session_v2','claim_active_room_session_v1','claim_active_room_session_v2');
select ok(not has_schema_privilege('service_role','anidachi_room_private','USAGE'),'runtime gets no private schema usage');
select ok(not has_table_privilege('service_role','public.hosting_commercial_policy','UPDATE'),'runtime gets no operator-policy writes');
set local role service_role;
select throws_ok($$select * from anidachi_room_private.create_room_with_active_session_v1(null,null,null,null,null,null,null,null,null,null,'free',4,4,false,false)$$,'42501',null,'service_role direct create_room_with_active_session_v1 denied');
select throws_ok($$select * from anidachi_room_private.create_room_with_active_session_v2(null,null,null,null,null,null,null,null,null,null,'free',4,4,false,false,1)$$,'42501',null,'service_role direct create_room_with_active_session_v2 denied');
select throws_ok($$select * from anidachi_room_private.claim_active_room_session_v1(null,'room','host','session')$$,'42501',null,'service_role direct claim_active_room_session_v1 denied');
select throws_ok($$select * from anidachi_room_private.claim_active_room_session_v2(null,'room','host','session',1)$$,'42501',null,'service_role direct claim_active_room_session_v2 denied');
reset role;
set local role anon;
select throws_ok($$select * from anidachi_room_private.create_room_with_active_session_v1(null,null,null,null,null,null,null,null,null,null,'free',4,4,false,false)$$,'42501',null,'anon direct create_room_with_active_session_v1 denied');
select throws_ok($$select * from anidachi_room_private.create_room_with_active_session_v2(null,null,null,null,null,null,null,null,null,null,'free',4,4,false,false,1)$$,'42501',null,'anon direct create_room_with_active_session_v2 denied');
select throws_ok($$select * from anidachi_room_private.claim_active_room_session_v1(null,'room','host','session')$$,'42501',null,'anon direct claim_active_room_session_v1 denied');
select throws_ok($$select * from anidachi_room_private.claim_active_room_session_v2(null,'room','host','session',1)$$,'42501',null,'anon direct claim_active_room_session_v2 denied');
select throws_ok($$select * from public.claim_active_room_session_v4(null,'room','host','session',3,1)$$,'42501',null,'anon publicv4 denied');
reset role;
set local role authenticated;
select throws_ok($$select * from anidachi_room_private.create_room_with_active_session_v1(null,null,null,null,null,null,null,null,null,null,'free',4,4,false,false)$$,'42501',null,'authenticated direct create_room_with_active_session_v1 denied');
select throws_ok($$select * from anidachi_room_private.create_room_with_active_session_v2(null,null,null,null,null,null,null,null,null,null,'free',4,4,false,false,1)$$,'42501',null,'authenticated direct create_room_with_active_session_v2 denied');
select throws_ok($$select * from anidachi_room_private.claim_active_room_session_v1(null,'room','host','session')$$,'42501',null,'authenticated direct claim_active_room_session_v1 denied');
select throws_ok($$select * from anidachi_room_private.claim_active_room_session_v2(null,'room','host','session',1)$$,'42501',null,'authenticated direct claim_active_room_session_v2 denied');
select throws_ok($$select * from public.claim_active_room_session_v4(null,'room','host','session',3,1)$$,'42501',null,'authenticated publicv4 denied');
reset role;
select * from finish();
rollback;
