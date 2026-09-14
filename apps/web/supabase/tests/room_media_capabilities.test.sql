begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='15s';set local lock_timeout='3s';set local idle_in_transaction_session_timeout='30s';
select no_plan();
insert into public.users(id,email,display_name) values ('a7777777-7777-4777-8777-777777777771','room-v2-free@example.test','Free'),('a7777777-7777-4777-8777-777777777772','room-v2-pro@example.test','Pro');
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason)values('a7777777-7777-4777-8777-777777777772','pro',clock_timestamp()+interval '10 minutes','Task7 synthetic');
create function pg_temp.create_room_v2(owner_id uuid,request_id text,version integer default 2)returns jsonb language plpgsql as $$
declare result jsonb;
begin
 if version=1 then
 select room_record into result from public.create_room_with_active_session_v1(owner_id,'task7-session',null,null,null,null,null,null,null,request_id,'free',4,4,false,false);
 else
 select room_record into result from public.create_room_with_active_session_v2(owner_id,'task7-session',null,null,null,null,null,null,null,request_id,'free',4,4,false,false,2);
 end if;return result;
end $$;
create temporary table task7_result(name text primary key,value jsonb);
insert into task7_result values('legacy',pg_temp.create_room_v2('a7777777-7777-4777-8777-777777777771','legacy',1));
select ok((select value->'media_lease'='null'::jsonb from task7_result where name='legacy'),'inactive policy creates legacy room');
update public.personal_history_policy set active=true where singleton;
select lives_ok($$select public.claim_active_room_session_v1('a7777777-7777-4777-8777-777777777771',(select value->>'room_id' from task7_result where name='legacy'),'host','task7-session')$$,'existing legacy room reconnects under active policy');
select lives_ok($$select public.claim_active_room_session_v2('a7777777-7777-4777-8777-777777777771',(select value->>'room_id' from task7_result where name='legacy'),'host','task7-session',2)$$,'new negotiated client also reconnects to unchanged legacy room');
update public.personal_history_policy set active=false where singleton;
select * from public.finalize_room_usage((select value->>'room_id' from task7_result where name='legacy'),clock_timestamp(),current_date,0);
update public.personal_history_policy set active=true where singleton;
select throws_ok($$select pg_temp.create_room_v2('a7777777-7777-4777-8777-777777777771','blocked',1)$$,'P0001','ROOM_UPDATE_REQUIRED','active policy rejects old Web create RPC');
insert into task7_result values('free',pg_temp.create_room_v2('a7777777-7777-4777-8777-777777777771','free-v2'));
insert into task7_result values('pro',pg_temp.create_room_v2('a7777777-7777-4777-8777-777777777772','pro-v2'));
select throws_ok($$select public.claim_active_room_session_v1('a7777777-7777-4777-8777-777777777771',(select value->>'room_id' from task7_result where name='free'),'host','old-web-session')$$,'P0001','ROOM_UPDATE_REQUIRED','oldWeb cannot mint legacy token for existing v2 room');
select is((select value#>>'{media_lease,capabilities,maxParticipants}' from task7_result where name='pro'),'15','durable Pro overrides caller Free');
select is((select value#>>'{media_lease,capabilities,maxMicrophones}' from task7_result where name='pro'),'8','Pro has independent8microphones');
select ok((select (value#>>'{media_lease,capabilities,capabilitiesValidUntil}')::timestamptz <= (value#>>'{media_lease,paidUntil}')::timestamptz from task7_result where name='pro'),'lease capped at selected-plan expiry');
update public.rooms set created_at=clock_timestamp()-interval '1 day' where room_id=(select value->>'room_id' from task7_result where name='free');
select is(public.commit_room_usage_day_v1((select value->>'room_id' from task7_result where name='free'),current_date-1,120)->>'seconds','120','closed day120seconds ACK');
select is((select status from public.rooms where room_id=(select value->>'room_id' from task7_result where name='free')),'lobby','nonterminal day commit does not end room');
select is(public.commit_room_usage_day_v1((select value->>'room_id' from task7_result where name='free'),current_date,180)->>'seconds','180','current day180seconds ACK');
select is(public.commit_room_usage_day_v1((select value->>'room_id' from task7_result where name='free'),current_date-1,120)->>'seconds','120','repeated cumulative ACK is idempotent');
select is(public.commit_room_usage_day_v1((select value->>'room_id' from task7_result where name='free'),current_date-1,90)->>'seconds','120','older cumulative retry does not decrement');
select is((select host_seconds from public.usage_daily where user_id='a7777777-7777-4777-8777-777777777771' and day=current_date-1),120,'exact day1total120');
select * from public.finalize_room_usage((select value->>'room_id' from task7_result where name='free'),clock_timestamp(),current_date,180);
select * from public.finalize_room_usage((select value->>'room_id' from task7_result where name='free'),clock_timestamp(),current_date,180);
select is((select host_seconds from public.usage_daily where user_id='a7777777-7777-4777-8777-777777777771' and day=current_date),180,'double finalization leaves exact day2total180');
select throws_ok($$select public.commit_room_usage_day_v1((select value->>'room_id' from task7_result where name='pro'),current_date,100)$$,'P0001','ROOM_USAGE_NOT_METERED','paid room time never charged');
update public.account_manual_plan_grants set plan_code='plus' where user_id='a7777777-7777-4777-8777-777777777772';
insert into task7_result values('denied',public.renew_room_media_lease_v2((select value->>'room_id' from task7_result where name='pro')));
select is((select value->>'denied' from task7_result where name='denied'),'true','Pro room authority lost even if Plus history remains');
select is((public.resolve_watch_history_access_v1('a7777777-7777-4777-8777-777777777772')#>>'{history,state}'),'allowed','Plus still retains history');
select is(public.renew_room_media_lease_v2((select value->>'room_id' from task7_result where name='pro'))->>'closingAt',(select value->>'closingAt' from task7_result where name='denied'),'repeated renewal never resets close deadline');
select ok(not has_function_privilege('anon','public.commit_room_usage_day_v1(text,date,integer)','EXECUTE'),'anon cannot charge quota');
select ok(not has_function_privilege('authenticated','public.renew_room_media_lease_v2(text)','EXECUTE'),'browser cannot renew authority');
select ok(not has_function_privilege('service_role','anidachi_room_private.create_room_with_active_session_v1(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean)','EXECUTE'),'server cannot bypass legacy/create fence directly');
select throws_ok($$select public.claim_active_room_session_v2('a7777777-7777-4777-8777-777777777772',(select value->>'room_id' from task7_result where name='pro'),'host','mismatch-session',1)$$,'P0001','ROOM_UPDATE_REQUIRED','negotiated mismatch cannot mutate assignment');
select lives_ok($$select public.claim_active_room_session_v2('a7777777-7777-4777-8777-777777777772',(select value->>'room_id' from task7_result where name='pro'),'host','valid-v2-session',2)$$,'negotiated v2 claim succeeds');
select ok((select relrowsecurity from pg_class where oid='public.room_usage_days_v1'::regclass),'ledger RLS enabled');
select ok((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']::text[] and has_function_privilege('service_role',p.oid,'EXECUTE') and not has_function_privilege('public',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_room_with_active_session_v1','create_room_with_active_session_v2','claim_active_room_session_v1','claim_active_room_session_v2')), 'all admission wrappers are safe definer functions with service-only execute allowlist');
select ok((select bool_and(not has_function_privilege('service_role',p.oid,'EXECUTE') and not has_function_privilege('public',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='anidachi_room_private'), 'all private admission cores deny direct browser and service execution');
select throws_ok($$select public.commit_room_usage_day_v1((select value->>'room_id' from task7_result where name='free'),current_date+1,1)$$,'22023','ROOM_USAGE_INVALID','nonzero future-day usage still rejected');
-- v3 matrix runs under the deployed service role, never the postgres owner.
insert into public.users(id,email,display_name) values
 ('a7777777-7777-4777-8777-777777777773','room-v3-free@example.test','Free v3'),
 ('a7777777-7777-4777-8777-777777777774','room-v3-plus@example.test','Plus v3'),
 ('a7777777-7777-4777-8777-777777777775','room-v3-pro@example.test','Pro v3'),
 ('a7777777-7777-4777-8777-777777777776','room-v2-service@example.test','V2 service'),
 ('a7777777-7777-4777-8777-777777777777','room-legacy-service@example.test','Legacy service');
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values
 ('a7777777-7777-4777-8777-777777777774','plus',clock_timestamp()+interval '2 hours','Task2 synthetic'),
 ('a7777777-7777-4777-8777-777777777775','pro',clock_timestamp()+interval '2 hours','Task2 synthetic');
create function pg_temp.create_room_v3(owner_id uuid,request_id text,version integer,session_id text default 'v3-session') returns jsonb language sql as $$
 select room_record from public.create_room_with_active_session_v3(owner_id,session_id,null,null,null,null,null,null,null,request_id,'pro',50,16,true,true,version);
$$;
grant all on table task7_result to service_role;
set local role service_role;
insert into task7_result values
 ('v3free',pg_temp.create_room_v3('a7777777-7777-4777-8777-777777777773','v3free',3)),
 ('v3plus',pg_temp.create_room_v3('a7777777-7777-4777-8777-777777777774','v3plus',3)),
 ('v3pro',pg_temp.create_room_v3('a7777777-7777-4777-8777-777777777775','v3pro',3)),
 ('v2service',pg_temp.create_room_v3('a7777777-7777-4777-8777-777777777776','v2service',2));
select is((select value#>>'{media_lease,capabilities,mediaProtocolVersion}' from task7_result where name='v2service'),'2','v2 service client creates v2 through new RPC');
select is((select value->>'max_media_seats' from task7_result where name='v3pro'),'8','v3 durable row agrees with lease seats');
select is((select value->>'max_media_seats' from task7_result where name='v2service'),'4','v2 durable row unchanged');
select is((public.renew_room_media_lease_v3((select value->>'room_id' from task7_result where name='v2service'))#>>'{capabilities,mediaProtocolVersion}'),'2','v2 renewal under runtime role preserves version');
select is((select outcome from public.create_room_with_active_session_v3('a7777777-7777-4777-8777-777777777776','conflict',null,null,null,null,null,null,null,'different-request','pro',50,16,true,true,3)),'conflict','v3 create conflict does not convert active v2 room');
select is((select media_lease#>>'{capabilities,mediaProtocolVersion}' from public.rooms where room_id=(select value->>'room_id' from task7_result where name='v2service')),'2','conflict preserves active v2');
select throws_ok($$select pg_temp.create_room_v3(null,'null-host',3)$$,'22023','active_room_session_invalid_input','null host preserves core input error before entitlement resolution');
select is((select value#>>'{media_lease,capabilities,mediaProtocolVersion}' from task7_result where name='v3pro'),'3','v3 client creates pinned v3');
select is((select value#>>'{media_lease,capabilities,maxParticipants}' from task7_result where name='v3free'),'4','caller cannot elevate Free participants');
select is((select value#>>'{media_lease,capabilities,maxMediaSeats}' from task7_result where name='v3free'),'4','Free has four seats');
select is((select value#>>'{media_lease,capabilities,maxMediaSeats}' from task7_result where name='v3plus'),'6','Plus has six seats');
select is((select value#>>'{media_lease,capabilities,maxMediaSeats}' from task7_result where name='v3pro'),'8','Pro has eight seats');
select is((select value#>>'{media_lease,capabilities,maxCameras}' from task7_result where name='v3pro'),'4','Pro retains four cameras');
select ok((select not (value#>'{media_lease,capabilities}') ? 'maxMicrophones' from task7_result where name='v3pro'),'v3 does not mix v2 fields');
select lives_ok($$select public.claim_active_room_session_v3('a7777777-7777-4777-8777-777777777775',(select value->>'room_id' from task7_result where name='v3pro'),'host','v3-rejoined',3)$$,'v3 client claims v3');
select throws_ok($$select public.claim_active_room_session_v3('a7777777-7777-4777-8777-777777777775',(select value->>'room_id' from task7_result where name='v3pro'),'host','rejected-v2',2)$$,'P0001','ROOM_UPDATE_REQUIRED','v2 rejects v3 before claim');
select throws_ok($$select public.claim_active_room_session_v2('a7777777-7777-4777-8777-777777777775',(select value->>'room_id' from task7_result where name='v3pro'),'host','old-rpc-v2',2)$$,'P0001','ROOM_UPDATE_REQUIRED','old v2 RPC cannot bypass v3 fence');
select is((select participant_session_id from public.active_room_sessions where user_id='a7777777-7777-4777-8777-777777777775'),'v3-rejoined','rejection leaves assignment intact');
select throws_ok($$select pg_temp.create_room_v3('a7777777-7777-4777-8777-777777777775','v3pro',2,'retry-v2')$$,'P0001','ROOM_UPDATE_REQUIRED','v2 create retry cannot claim v3');
select is((pg_temp.create_room_v3('a7777777-7777-4777-8777-777777777775','v3pro',3,'retry-v3')#>>'{media_lease,capabilities,mediaProtocolVersion}'),'3','replacement-session retry preserves v3');
select lives_ok($$select public.claim_active_room_session_v3('a7777777-7777-4777-8777-777777777772',(select value->>'room_id' from task7_result where name='pro'),'host','v3-in-v2',3)$$,'v3 client claims v2');
select is((pg_temp.create_room_v3('a7777777-7777-4777-8777-777777777772','pro-v2',3,'v3-retry-v2')#>>'{media_lease,capabilities,mediaProtocolVersion}'),'2','v3 retry preserves existing v2 despite claimed/reused outcome');
select throws_ok($$select pg_temp.create_room_v3('a7777777-7777-4777-8777-777777777775','v3pro',4)$$,'P0001','ROOM_UPDATE_REQUIRED','unknown create protocol rejected');
select throws_ok($$select public.claim_active_room_session_v3('a7777777-7777-4777-8777-777777777775',(select value->>'room_id' from task7_result where name='v3pro'),'host','unknown',4)$$,'P0001','ROOM_UPDATE_REQUIRED','unknown claim protocol rejected');
-- Advance the old lease timestamps; renewal must issue a new 30-minute window.
update public.rooms set media_lease=jsonb_set(jsonb_set(media_lease,'{issuedAt}',to_jsonb(clock_timestamp()-interval '31 minutes')),'{capabilities,capabilitiesValidUntil}',to_jsonb(clock_timestamp()-interval '1 minute')) where room_id=(select value->>'room_id' from task7_result where name='v3free');
insert into task7_result values('v3renew',public.renew_room_media_lease_v3((select value->>'room_id' from task7_result where name='v3free')));
select is((select value#>>'{capabilities,mediaProtocolVersion}' from task7_result where name='v3renew'),'3','renewal preserves v3 under service role');
select ok((select (value#>>'{capabilities,capabilitiesValidUntil}')::timestamptz > clock_timestamp()+interval '29 minutes' from task7_result where name='v3renew'),'expired window reissues for 30 minutes');
select is((public.renew_room_media_lease_v2((select value->>'room_id' from task7_result where name='v3plus'))#>>'{capabilities,mediaProtocolVersion}'),'3','old renewal caller cannot downgrade v3');
select is(public.commit_room_usage_day_v1((select value->>'room_id' from task7_result where name='v3free'),current_date,120)->>'seconds','120','v3 preserves Free cumulative accounting');
select throws_ok($$select public.commit_room_usage_day_v1((select value->>'room_id' from task7_result where name='v3pro'),current_date,100)$$,'P0001','ROOM_USAGE_NOT_METERED','v3 paid rooms not charged');
reset role;
update public.account_manual_plan_grants set plan_code='plus' where user_id='a7777777-7777-4777-8777-777777777775';
set local role service_role;
insert into task7_result values('v3denied',public.renew_room_media_lease_v3((select value->>'room_id' from task7_result where name='v3pro')));
select is((select value->>'denied' from task7_result where name='v3denied'),'true','v3 loses Pro authority after downgrade');
select is(public.renew_room_media_lease_v3((select value->>'room_id' from task7_result where name='v3pro'))->>'closingAt',(select value->>'closingAt' from task7_result where name='v3denied'),'v3 denial preserves first closing deadline');
reset role;
select ok(not has_function_privilege('authenticated','public.renew_room_media_lease_v3(text)','EXECUTE'),'browser cannot renew v3');
-- Inactive policy permits new legacy rooms; it does not erase negotiated fences.
update public.personal_history_policy set active=false where singleton;
set local role service_role;
select throws_ok($$select pg_temp.create_room_v2('a7777777-7777-4777-8777-777777777775','v3pro',1)$$,'P0001','ROOM_UPDATE_REQUIRED','inactive policy does not let legacy RPC claim existing v3');
select is((select participant_session_id from public.active_room_sessions where user_id='a7777777-7777-4777-8777-777777777775'),'retry-v3','legacy rejection leaves v3 assignment intact');
select ok((pg_temp.create_room_v2('a7777777-7777-4777-8777-777777777777','legacy-service',1)->'media_lease')='null'::jsonb,'runtime role retains inactive legacy creation');
reset role;
update public.personal_history_policy set active=true where singleton;
set local role service_role;
select * from public.finalize_room_usage((select value->>'room_id' from task7_result where name='v2service'),clock_timestamp(),current_date,0);
select is((pg_temp.create_room_v3('a7777777-7777-4777-8777-777777777776','v2service',3)#>>'{media_lease,capabilities,mediaProtocolVersion}'),'3','ended request room is not reused; new room can select v3');
reset role;
select ok((select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']::text[] and has_function_privilege('service_role',p.oid,'EXECUTE') and not has_function_privilege('public',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE') and not has_function_privilege('authenticated',p.oid,'EXECUTE')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('create_room_with_active_session_v3','claim_active_room_session_v3')), 'v3 admission wrappers keep service-only definer boundary');
select ok((select not prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid='public.renew_room_media_lease_v3(text)'::regprocedure),'v3 renewal keeps invoker and empty search_path');
select * from finish();
rollback;
