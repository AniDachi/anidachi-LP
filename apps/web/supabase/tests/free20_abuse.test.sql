-- Rollback-only synthetic fixture. Every authority call uses the real service role.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_column('public','hosting_commercial_policy','free20_abuse_enabled','default-off abuse policy exists');
select has_column('public','rooms','free20_abuse_protected','durable room binding marker exists');
select has_function('public','resolve_free20_context_access_v1',array['uuid','text','text'],'scoped authority RPC exists');
insert into public.users(id,email,display_name) values
 ('fa200000-0000-4000-8000-000000000001','abuse-a@example.test','A'),
 ('fa200000-0000-4000-8000-000000000002','abuse-b@example.test','B'),
 ('fa200000-0000-4000-8000-000000000003','abuse-c@example.test','C');
update public.personal_history_policy set active=true;
update public.hosting_commercial_policy set free20_enabled=true,trials_enabled=false,activation_at=clock_timestamp()-interval '1 day';
create function pg_temp.abuse_create(owner_id uuid,req text,b text default repeat('a',64),i text default repeat('b',64))
returns jsonb language sql as $$
 select room_record from public.create_room_with_active_session_v5(owner_id,'host',null,null,null,null,null,null,null,req,'free',4,4,false,false,3,1,b,i);
$$;
create temporary table abuse_results(k text primary key,v jsonb);
grant all on abuse_results to service_role;
create function pg_temp.abuse_claim(owner_id uuid,room text,b text default repeat('a',64),i text default repeat('b',64),role_name text default 'host') returns text language sql as $$
 select outcome from public.claim_active_room_session_v5(owner_id,room,role_name,'replacement',3,1,b,i);
$$;
create function pg_temp.abuse_snapshot() returns jsonb language sql as $$
 select jsonb_build_object('rooms',(select jsonb_agg(to_jsonb(r) order by room_id) from public.rooms r where host_user_id::text like 'fa200000-%'),
 'sessions',(select jsonb_agg(to_jsonb(a) order by user_id) from public.active_room_sessions a where user_id::text like 'fa200000-%'));
$$;
select is((select free20_abuse_enabled from public.hosting_commercial_policy),false,'migration stays default off');
set local role service_role;
select lives_ok($$insert into abuse_results values('legacy',pg_temp.abuse_create('fa200000-0000-4000-8000-000000000003','legacy',null,null))$$,'disabled gate retains legacy admission without proof');
reset role;
select throws_ok($$update public.hosting_commercial_policy set free20_abuse_enabled=true$$,'P0001','FREE20_UNPROTECTED_ACTIVE_ROOMS','activation refuses unprotected active Free20 rooms');
select is((select free20_abuse_enabled from public.hosting_commercial_policy),false,'failed activation is atomic');
set local role service_role;
select lives_ok($$select public.finalize_room_usage((select v->>'room_id' from abuse_results where k='legacy'),clock_timestamp(),(clock_timestamp() at time zone 'UTC')::date,0)$$,'legacy room settles normally');
reset role;
update public.hosting_commercial_policy set free20_abuse_enabled=true;
insert into anidachi_private.trial_marker_claims(kind,marker_hash,state,expires_at) values
 ('browser',repeat('a',64),'consumed',clock_timestamp()+interval '1 year'),
 ('installation',repeat('b',64),'consumed',clock_timestamp()+interval '1 year');
select ok(not has_table_privilege('service_role','anidachi_room_private.free20_marker_days','INSERT'),'runtime cannot forge marker totals');
select ok(not has_table_privilege('service_role','anidachi_room_private.free20_room_bindings','DELETE'),'runtime cannot drop reservations');
select ok(not has_table_privilege('service_role','anidachi_room_private.free20_admission_context','INSERT'),'runtime cannot forge permits');
select ok(not has_function_privilege('authenticated','public.resolve_free20_context_access_v1(uuid,text,text)','EXECUTE'),'browser cannot resolve authority');
set local role service_role;
select throws_ok($$select pg_temp.abuse_create('fa200000-0000-4000-8000-000000000001','missing',null,null)$$,'P0001','FREE20_CONTEXT_REQUIRED','new free room requires both markers');
select throws_ok($$select pg_temp.abuse_create('fa200000-0000-4000-8000-000000000001','missing',repeat('a',64),null)$$,'P0001','FREE20_CONTEXT_REQUIRED','cookie alone is insufficient');
select throws_ok($$select pg_temp.abuse_create('fa200000-0000-4000-8000-000000000001','forged',repeat('A',64),repeat('b',64))$$,'22023','FREE20_CONTEXT_INVALID','uppercase digest is rejected');
select throws_ok($$select pg_temp.abuse_create('fa200000-0000-4000-8000-000000000001','forged','abc',repeat('b',64))$$,'22023','FREE20_CONTEXT_INVALID','short digest is rejected');
select throws_ok($$select public.create_room_with_active_session_v4('fa200000-0000-4000-8000-000000000001','old',null,null,null,null,null,null,null,'old','free',4,4,false,false,3,1)$$,'P0001','FREE20_CONTEXT_REQUIRED','old v4 cannot bypass protection');
select throws_ok($$insert into public.rooms(room_id,host_user_id,host_plan_code,max_participants,max_media_seats,can_name_room,can_send_push_invites) values('abuse-direct','fa200000-0000-4000-8000-000000000001','free',4,4,false,false)$$,'P0001','FREE20_CONTEXT_REQUIRED','direct room insertion cannot bypass protection');
select throws_ok($$select public.read_free20_context_status_v1('fa200000-0000-4000-8000-000000000001')$$,'P0001','FREE20_CONTEXT_REQUIRED','free status fails closed without context');
select lives_ok($$insert into abuse_results values('a',pg_temp.abuse_create('fa200000-0000-4000-8000-000000000001','a'))$$,'verified pair admits Free20 despite old consumed-trial markers');
select is((select v->>'free20_abuse_protected' from abuse_results where k='a'),'true','room durably marks scoped accounting');
select is((select v->>'max_participants' from abuse_results where k='a'),'4','original four-person capacity retained');
select is(pg_temp.abuse_create('fa200000-0000-4000-8000-000000000001','a')->>'room_id',(select v->>'room_id' from abuse_results where k='a'),'same-context replay preserves room');
select is((select outcome from public.create_room_with_active_session_v5('fa200000-0000-4000-8000-000000000001','other',null,null,null,null,null,null,null,'other-request','free',4,4,false,false,3,1,repeat('a',64),repeat('b',64))),'conflict','same-account different request preserves mature active-room conflict');
select lives_ok($$select pg_temp.abuse_claim('fa200000-0000-4000-8000-000000000001',(select v->>'room_id' from abuse_results where k='a'))$$,'same-context host reconnect works');
insert into abuse_results values('before',pg_temp.abuse_snapshot());
select throws_ok($$select pg_temp.abuse_create('fa200000-0000-4000-8000-000000000001','a',repeat('c',64),repeat('d',64))$$,'P0001','FREE20_CONTEXT_ATTACH_REQUIRED','replay with fresh markers requires serialized attach');
select is(pg_temp.abuse_snapshot(),(select v from abuse_results where k='before'),'rejected replay preserves room and assignment byte-for-byte');
select throws_ok($$select pg_temp.abuse_claim('fa200000-0000-4000-8000-000000000001',(select v->>'room_id' from abuse_results where k='a'),repeat('c',64),repeat('d',64))$$,'P0001','FREE20_CONTEXT_ATTACH_REQUIRED','host claim cannot silently attach markers');
select is(pg_temp.abuse_snapshot(),(select v from abuse_results where k='before'),'rejected claim has no session mutation');
select throws_ok($$select public.claim_active_room_session_v4('fa200000-0000-4000-8000-000000000001',(select v->>'room_id' from abuse_results where k='a'),'host','old',3,1)$$,'P0001','FREE20_CONTEXT_REQUIRED','old host claim requires proof');
insert into public.room_members(room_id,user_id) select v->>'room_id',u from abuse_results cross join unnest(array['fa200000-0000-4000-8000-000000000001'::uuid,'fa200000-0000-4000-8000-000000000002'::uuid]) u where k='a';
select throws_ok($$select pg_temp.abuse_claim('fa200000-0000-4000-8000-000000000001',(select v->>'room_id' from abuse_results where k='a'),null,null,'member')$$,'P0001','FREE20_CONTEXT_REQUIRED','owner spoofing guest role cannot bypass proof');
select lives_ok($$select pg_temp.abuse_claim('fa200000-0000-4000-8000-000000000002',(select v->>'room_id' from abuse_results where k='a'),null,null,'member')$$,'real guest needs no personal proof');
select throws_ok($$select public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000002',repeat('a',64),repeat('b',64))$$,'P0001','FREE20_CONTEXT_BUSY','another account sees neutral busy while scopes reserved');
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date,720)$$,'cumulative settlement charges the bound pair');
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date,720)$$,'duplicate ACK is accepted once');
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date,300)$$,'older ACK cannot subtract usage');
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64))->>'remainingSeconds','480','A consumes 720 and retains 480');
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000001',repeat('c',64),repeat('d',64))->>'remainingSeconds','480','same account on fresh markers still has 480');
select is(public.read_free20_context_status_v1('fa200000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64))->>'committedSeconds','720','status exposes effective committed seconds');
select lives_ok($$select public.attach_free20_room_context_v1('fa200000-0000-4000-8000-000000000001',(select v->>'room_id' from abuse_results where k='a'),repeat('c',64),repeat('d',64))$$,'trusted transfer appends verified replacement context');
select lives_ok($$select public.attach_free20_room_context_v1('fa200000-0000-4000-8000-000000000001',(select v->>'room_id' from abuse_results where k='a'),repeat('c',64),repeat('d',64))$$,'attach retry is idempotent');
select lives_ok($$select pg_temp.abuse_claim('fa200000-0000-4000-8000-000000000001',(select v->>'room_id' from abuse_results where k='a'),repeat('c',64),repeat('d',64))$$,'attached context may resume same room');
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date,800)$$,'only the subsequent delta charges appended scopes');
select is(public.read_free20_room_usage_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date),800,'append plus next ACK does not re-add room history');
reset role;
select is((select count(*)::integer from anidachi_room_private.free20_room_bindings where room_id=(select v->>'room_id' from abuse_results where k='a')),4,'all original and additional bindings retained');
select is((select min(committed_seconds) from anidachi_room_private.free20_marker_days where day=(clock_timestamp() at time zone 'UTC')::date),800,'every scope is charged exactly 800');
-- Paid upgrade never releases reservations and paid reads do not need context.
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values('fa200000-0000-4000-8000-000000000001','plus',clock_timestamp()+interval '1 hour','synthetic abuse test');
select lives_ok($$update public.rooms set host_plan_code='plus' where room_id=(select v->>'room_id' from abuse_results where k='a')$$,'synthetic durable paid upgrade retains protected time mode');
set local role service_role;
select is(public.read_free20_context_status_v1('fa200000-0000-4000-8000-000000000001')->>'planCode','plus','paid status succeeds without markers');
select lives_ok($$select pg_temp.abuse_claim('fa200000-0000-4000-8000-000000000001',(select v->>'room_id' from abuse_results where k='a'),null,null)$$,'confirmed unlimited host reconnect retains exemption');
select throws_ok($$select public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000002',repeat('a',64),repeat('b',64))$$,'P0001','FREE20_CONTEXT_BUSY','paid-upgraded bound room retains reservation');
reset role;
update public.account_manual_plan_grants set valid_until=clock_timestamp()-interval '1 second' where user_id='fa200000-0000-4000-8000-000000000001';
set local role service_role;
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000001',repeat('a',64),repeat('b',64))->>'remainingSeconds','400','paid expiry returns to real shared remainder');
-- Late UTC delivery and gate disable retain the immutable accounting contract.
reset role;
update public.rooms set created_at=created_at-interval '2 days' where room_id=(select v->>'room_id' from abuse_results where k='a');
update public.hosting_commercial_policy set free20_abuse_enabled=false;
set local role service_role;
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date-1,1100)$$,'late ACK charges the old UTC day after disable');
select is(public.read_free20_room_usage_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date),800,'late ACK never spends the new UTC day');
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date,820)$$,'disabled admission gate does not disable bound accounting');
select is(public.read_free20_room_usage_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date),820,'room usage reads remain scoped after disable');
select lives_ok($$select public.finalize_room_usage((select v->>'room_id' from abuse_results where k='a'),clock_timestamp(),(clock_timestamp() at time zone 'UTC')::date,820)$$,'terminal ACK releases reservations atomically');
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date,820)$$,'ended room accepts exact replay');
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date,10)$$,'ended room accepts older replay');
select throws_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='a'),(clock_timestamp() at time zone 'UTC')::date,821)$$,'P0001','ROOM_USAGE_ENDED','ended room rejects new spending');
select throws_ok($$select public.attach_free20_room_context_v1('fa200000-0000-4000-8000-000000000001',(select v->>'room_id' from abuse_results where k='a'),repeat('e',64),repeat('f',64))$$,'P0001','ROOM_ENDED','terminal room cannot attach/resume');
reset role;
update public.hosting_commercial_policy set free20_abuse_enabled=true;
-- Use 820 rather than resetting any already-consumed evidence.
set local role service_role;
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000002',repeat('a',64),repeat('b',64))->>'remainingSeconds','380','fresh B inherits A exact shared remainder');
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000002',repeat('a',64),repeat('f',64))->>'remainingSeconds','380','retaining browser alone preserves remainder');
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000002',repeat('e',64),repeat('b',64))->>'remainingSeconds','380','retaining installation alone preserves remainder');
select lives_ok($$insert into abuse_results values('b',pg_temp.abuse_create('fa200000-0000-4000-8000-000000000002','b',repeat('a',64),repeat('f',64)))$$,'B binds existing browser and fresh installation');
select lives_ok($$select public.attach_free20_room_context_v1('fa200000-0000-4000-8000-000000000002',(select v->>'room_id' from abuse_results where k='b'),repeat('e',64),repeat('f',64))$$,'alternating marker replacement retains the surviving marker floor');
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='b'),(clock_timestamp() at time zone 'UTC')::date,100)$$,'B spends only another hundred');
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000002',repeat('e',64),repeat('f',64))->>'remainingSeconds','280','fresh account plus alternating one-marker resets cannot mint time');
select is(public.read_free20_room_usage_v1((select v->>'room_id' from abuse_results where k='b'),(clock_timestamp() at time zone 'UTC')::date),920,'room effective total includes inherited high-water floor');
reset role;
select is((select committed_seconds from anidachi_room_private.free20_marker_days where kind='installation' and marker_hash=repeat('f',64) and day=(clock_timestamp() at time zone 'UTC')::date),920,'fresh installation inherits 820 then charges delta100');
select is((select committed_seconds from anidachi_room_private.free20_marker_days where kind='browser' and marker_hash=repeat('e',64) and day=(clock_timestamp() at time zone 'UTC')::date),920,'fresh browser inherits surviving installation high water');
-- Disabling only new enforcement never enlarges this protected running room.
update public.hosting_commercial_policy set free20_abuse_enabled=false;
set local role service_role;
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000002')->>'remainingSeconds','280','flag-off bound owner keeps280 without new proof despite account100');
select is(public.read_free20_context_status_v1('fa200000-0000-4000-8000-000000000002')->>'committedSeconds','920','flag-off status retains bound effective total');
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='b'),(clock_timestamp() at time zone 'UTC')::date,110)$$,'flag-off protected room continues delta accounting');
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000002')->>'remainingSeconds','270','flag-off resolver reflects subsequent delta once');
reset role;
update public.hosting_commercial_policy set free20_abuse_enabled=true;
-- A higher incoming marker is reconciled only by trusted stopped-host attach.
insert into anidachi_room_private.free20_marker_days values('browser',repeat('9',64),(clock_timestamp() at time zone 'UTC')::date,1000);
set local role service_role;
select lives_ok($$select public.attach_free20_room_context_v1('fa200000-0000-4000-8000-000000000002',(select v->>'room_id' from abuse_results where k='b'),repeat('9',64),repeat('f',64))$$,'higher incoming floor is attached through trusted transfer');
select is(public.read_free20_room_usage_v1((select v->>'room_id' from abuse_results where k='b'),(clock_timestamp() at time zone 'UTC')::date),1000,'higher incoming floor becomes effective room authority');
reset role;
select is((select min(d.committed_seconds) from anidachi_room_private.free20_marker_days d join anidachi_room_private.free20_room_bindings b using(kind,marker_hash) where b.room_id=(select v->>'room_id' from abuse_results where k='b') and d.day=(clock_timestamp() at time zone 'UTC')::date),1000,'retained original scopes also inherit higher incoming floor');
-- Both terminal and unsettled evidence survives deletion; no cascading FK.
set local role service_role;
select lives_ok($$select public.finalize_room_usage((select v->>'room_id' from abuse_results where k='b'),clock_timestamp(),(clock_timestamp() at time zone 'UTC')::date,110)$$,'B terminal settlement keeps inherited total');
reset role;
delete from public.rooms where room_id=(select v->>'room_id' from abuse_results where k='a');
delete from public.users where id='fa200000-0000-4000-8000-000000000001';
set local role service_role;
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000003',repeat('e',64),repeat('f',64))->>'remainingSeconds','200','aggregate survives deletion and dropping the stricter replacement marker');
-- Ordinary paid room never reserves contexts, even if supplied.
reset role;
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values('fa200000-0000-4000-8000-000000000003','plus',clock_timestamp()+interval '1 hour','ordinary paid abuse test');
set local role service_role;
select lives_ok($$insert into abuse_results values('paid',pg_temp.abuse_create('fa200000-0000-4000-8000-000000000003','paid',null,null))$$,'ordinary paid creation needs no proof');
select is((select v->>'free20_abuse_protected' from abuse_results where k='paid'),'false','ordinary paid room has no quota binding');
reset role;
select is((select count(*)::integer from anidachi_room_private.free20_room_bindings where room_id=(select v->>'room_id' from abuse_results where k='paid')),0,'ordinary paid rooms reserve no markers');
-- Independent exact owner-approved example with a previously consumed trial pair.
insert into public.users(id,email,display_name) values
 ('fa200000-0000-4000-8000-000000000004','abuse-exact-a@example.test','Exact A'),
 ('fa200000-0000-4000-8000-000000000005','abuse-exact-b@example.test','Exact B');
set local role service_role;
insert into abuse_results values('exact',pg_temp.abuse_create('fa200000-0000-4000-8000-000000000004','exact',repeat('2',64),repeat('3',64)));
select lives_ok($$select public.finalize_room_usage((select v->>'room_id' from abuse_results where k='exact'),clock_timestamp(),(clock_timestamp() at time zone 'UTC')::date,720)$$,'A settles exactly720');
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000005',repeat('2',64),repeat('3',64))->>'remainingSeconds','480','fresh B sees480 after A consumes720');
select is(public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000004',repeat('4',64),repeat('5',64))->>'remainingSeconds','480','same account on new pair retains480');
select ok(position(repeat('2',64) in public.read_free20_context_status_v1('fa200000-0000-4000-8000-000000000005',repeat('2',64),repeat('3',64))::text)=0,'status contains no private marker');
select throws_ok($$select public.attach_free20_room_context_v1('fa200000-0000-4000-8000-000000000005',(select v->>'room_id' from abuse_results where k='b'),repeat('4',64),repeat('5',64))$$,'42501','active_room_session_role_invalid','another account cannot attach to original owner room');
-- Exhaust inherited scope while account is far below1200; every room authority
-- and lease renewal uses effective scoped usage, not just the account ledger.
insert into abuse_results values('exhaust',pg_temp.abuse_create('fa200000-0000-4000-8000-000000000005','exhaust',repeat('2',64),repeat('3',64)));
select lives_ok($$select public.commit_room_usage_day_v1((select v->>'room_id' from abuse_results where k='exhaust'),(clock_timestamp() at time zone 'UTC')::date,480)$$,'B exhausts only remaining480');
select is(public.read_free20_context_status_v1('fa200000-0000-4000-8000-000000000005',repeat('2',64),repeat('3',64))->>'committedSeconds','1200','status reports exhausted effective total');
select throws_ok($$select public.require_room_hosting_admission_v1((select v->>'room_id' from abuse_results where k='exhaust'),'fa200000-0000-4000-8000-000000000005')$$,'P0001','QUOTA_EXHAUSTED','room admission cannot bypass inherited exhaustion');
select is((select public.renew_room_media_lease_v3(v->>'room_id')->>'denied' from abuse_results where k='exhaust'),'true','lease renewal also rejects inherited exhaustion');
reset role;
select is((select count(*)::integer from anidachi_private.trial_marker_claims where marker_hash in(repeat('a',64),repeat('b',64))),2,'historical trial ledger remains unchanged');
-- Active deletion retains its reservation and history without a cascading FK.
delete from public.rooms where room_id=(select v->>'room_id' from abuse_results where k='exhaust');
delete from public.users where id='fa200000-0000-4000-8000-000000000005';
set local role service_role;
select throws_ok($$select public.resolve_free20_context_access_v1('fa200000-0000-4000-8000-000000000004',repeat('2',64),repeat('3',64))$$,'P0001','FREE20_CONTEXT_BUSY','deleting unsettled room/account cannot release its reservation');
reset role;
-- Cleanup is shared and bounded, with unsettled evidence retained beyond 7 days.
insert into anidachi_room_private.free20_marker_days values('browser',repeat('0',64),(clock_timestamp() at time zone 'UTC')::date-8,900),('browser',repeat('1',64),(clock_timestamp() at time zone 'UTC')::date-8,900);
insert into anidachi_room_private.free20_room_bindings(room_id,owner_user_id,kind,marker_hash) values('deleted-unsettled-room','fa200000-0000-4000-8000-000000000001','browser',repeat('1',64));
set local role service_role;
select is(public.cleanup_free20_marker_history_v1(1),1,'cleanup deletes at most its bound');
reset role;
select is((select count(*)::integer from anidachi_room_private.free20_marker_days where marker_hash=repeat('1',64)),1,'unsettled deleted room preserves old marker evidence');
select is((select count(*)::integer from cron.job where jobname='free20-marker-history-cleanup'),1,'one shared daily cleanup job');
select is((select count(*)::integer from anidachi_room_private.free20_admission_context),0,'no admission permit survives RPC completion');
select * from finish();
rollback;
