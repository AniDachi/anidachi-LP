-- Disposable database only. All queued HTTP stays uncommitted and is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_table('public','room_hosting_cutover_outbox','cutover delivery survives process failure');
select has_function('anidachi_private','activate_paid_hosting_v1',array['uuid','bigint'],'activation is an operator-only transaction');
insert into public.users(id,email,display_name) values
 ('fb100000-0000-4000-8000-000000000001','cutover-free@example.test','Free'),
 ('fb100000-0000-4000-8000-000000000002','cutover-upgrade@example.test','Upgraded'),
 ('fb100000-0000-4000-8000-000000000003','cutover-paid@example.test','Paid');
insert into public.rooms(room_id,host_user_id,host_plan_code,status) values
 ('cutover-free','fb100000-0000-4000-8000-000000000001','free','lobby'),
 ('cutover-watcher','fb100000-0000-4000-8000-000000000002','watcher','live'),
 ('cutover-paid','fb100000-0000-4000-8000-000000000003','pro','live'),
 ('cutover-ended','fb100000-0000-4000-8000-000000000001','free','ended');
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values
 ('fb100000-0000-4000-8000-000000000002','pro',now()+interval '1 day','synthetic pre-cutover upgrade'),
 ('fb100000-0000-4000-8000-000000000003','pro',now()+interval '1 day','synthetic paid');
select is((select count(*) from public.room_hosting_cutover_outbox),0::bigint,'dormant preparation schedules no closure');
select throws_ok($$select anidachi_private.activate_paid_hosting_v1('fb200000-0000-4000-8000-000000000001',1)$$,'P0001','HOSTING_DELIVERY_NOT_READY','activation fails before recovery is configured');
select is((select activation_at from public.hosting_commercial_policy),null::timestamptz,'failed preflight leaves policy inactive');
update public.personal_history_policy set active=true;
update anidachi_private.hosting_cutover_scheduler set enabled=true,environment='staging';
do $$begin perform vault.create_secret('cutover-test-only-credential','anidachi_hosting_cutover_drain_secret');end$$;
create temporary table cutover_result(value jsonb);
savepoint abandoned_activation;
insert into cutover_result select anidachi_private.activate_paid_hosting_v1('fb200000-0000-4000-8000-000000000001',1);
rollback to abandoned_activation;
select is((select activation_at from public.hosting_commercial_policy),null::timestamptz,'rollback of uncommitted activation preserves old policy');
select is((select count(*) from public.room_hosting_cutover_outbox),0::bigint,'rollback also removes its queued closures');
insert into cutover_result select anidachi_private.activate_paid_hosting_v1('fb200000-0000-4000-8000-000000000001',1);
select is((select value->>'revision' from cutover_result),'2','activation advances policy revision');
select is((select value->>'targetCount' from cutover_result),'2','only open frozen Free rooms including legacy watcher are targets');
select ok((select trials_enabled and activation_at is not null from public.hosting_commercial_policy),'trial and hosting rules become active together');
select ok((select bool_and(closing_at=(select activation_at from public.hosting_commercial_policy)) from public.room_hosting_cutover_outbox),'every target retains original T without transition grace');
select is((select count(*) from public.rooms where room_id in ('cutover-free','cutover-watcher') and status<>'ended'),2::bigint,'activation does not bypass Worker accounting by marking rooms ended');
select is(anidachi_private.activate_paid_hosting_v1('fb200000-0000-4000-8000-000000000001',1),(select value from cutover_result),'lost commit response returns identical operation and T');
select throws_ok($$select anidachi_private.activate_paid_hosting_v1('fb200000-0000-4000-8000-000000000002',2)$$,'P0001','HOSTING_ALREADY_ACTIVATED','a second operation cannot reset T');
select is((select url from net.http_request_queue where id=(select last_request_id from anidachi_private.hosting_cutover_scheduler)),'https://staging.anidachi.app/api/internal/rooms/cutover/drain','activation queues immediate drain in its transaction');
set local role service_role;
select throws_ok($$select anidachi_private.activate_paid_hosting_v1('fb200000-0000-4000-8000-000000000001',1)$$,'42501',null,'runtime cannot activate policy');
select throws_ok($$insert into public.room_hosting_cutover_outbox(revision,room_id,room_generation,closing_at) values(2,'cutover-paid',1,now())$$,'42501',null,'runtime cannot fabricate paid-room closure targets');
select throws_ok($$select public.require_room_hosting_admission_v1('cutover-watcher','fb100000-0000-4000-8000-000000000002')$$,'P0001','HOST_SUBSCRIPTION_REQUIRED','upgraded host cannot reconnect to frozen watcher room');
select is(public.renew_room_media_lease_v3('cutover-watcher')->>'denied','true','legacy watcher renewal observes cutover despite host upgrade');
select is(public.check_room_hosting_socket_v1('cutover-watcher','fb100000-0000-4000-8000-000000000002')->>'allowed','false','old token socket authority rejects a cutover room');
select is(public.check_room_hosting_socket_v1('cutover-watcher','fb100000-0000-4000-8000-000000000002')#>>'{cutover,revision}','2','socket refusal carries the committed closure identity');
select is(public.check_room_hosting_socket_v1('cutover-paid','fb100000-0000-4000-8000-000000000001')->>'allowed','true','Free guest token remains valid at an eligible paid host');
select is(public.check_room_hosting_socket_v1('cutover-ended','fb100000-0000-4000-8000-000000000001')->>'code','ROOM_ENDED','ended durable room is never reopened by a signed token');
select is(public.check_room_hosting_socket_v1('cutover-missing','fb100000-0000-4000-8000-000000000001')->>'code','ROOM_ENDED','missing durable room cannot be opened by a signed token');
reset role;
create temporary table cutover_claim as select * from public.claim_room_hosting_cutover_v1(1);
grant all on cutover_claim to service_role;
select is((select count(*) from cutover_claim),1::bigint,'claims are bounded');
select is((select count(*) from public.claim_room_hosting_cutover_v1(8)),1::bigint,'a live lease cannot be claimed twice');
select is((select count(*) from public.claim_room_hosting_cutover_v1(8)),0::bigint,'all live leases suppress duplicate delivery');
set local role service_role;
select is(public.finish_room_hosting_cutover_v1(c.revision,c.room_id,c.room_generation,gen_random_uuid(),now(),null),'stale','wrong lease token cannot acknowledge') from cutover_claim c;
select is(public.finish_room_hosting_cutover_v1(c.revision,c.room_id,c.room_generation,c.lease_token,now(),now()),'retry','premature finalized ACK cannot bypass actual room finalization') from cutover_claim c;
reset role;
select ok((select fenced_at is not null and finalized_at is null from public.room_hosting_cutover_outbox where room_id=(select room_id from cutover_claim)),'durable fence evidence is retained independently');
update public.room_hosting_cutover_outbox set lease_token=null,lease_until=null,next_attempt_at=now()-interval '1 second',attempts=100;
truncate cutover_claim;
insert into cutover_claim select * from public.claim_room_hosting_cutover_v1(8);
select is((select count(*) from cutover_claim),2::bigint,'extended outages never exhaust or discard pending closure tasks');
select ok((select bool_and(attempts=101) from public.room_hosting_cutover_outbox),'retry counts remain observable');
update public.rooms set status='ended',ended_at=now() where room_id='cutover-free';
insert into public.active_room_sessions(user_id,room_id,role,participant_session_id) values('fb100000-0000-4000-8000-000000000001','cutover-free','host','leftover');
set local role service_role;
select is(public.finish_room_hosting_cutover_v1(c.revision,c.room_id,c.room_generation,c.lease_token,now(),now()),'retry','an unreleased active assignment prevents completed ACK') from cutover_claim c where room_id='cutover-free';
reset role;
delete from public.active_room_sessions where room_id='cutover-free';
update public.room_hosting_cutover_outbox set next_attempt_at=now()-interval '1 second' where room_id='cutover-free';
delete from cutover_claim where room_id='cutover-free';
insert into cutover_claim select * from public.claim_room_hosting_cutover_v1(8);
set local role service_role;
select is(public.finish_room_hosting_cutover_v1(c.revision,c.room_id,c.room_generation,c.lease_token,now(),now()),'completed','fence plus database finalization and assignment release completes delivery') from cutover_claim c where room_id='cutover-free';
select is(public.finish_room_hosting_cutover_v1(c.revision,c.room_id,c.room_generation,c.lease_token,now(),now()),'completed','lost ACK replay remains idempotent') from cutover_claim c where room_id='cutover-free';
reset role;
select is((select count(*) from public.room_hosting_cutover_outbox where finalized_at is not null),1::bigint,'completed targets remain as coverage evidence');
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason)
 values('fb100000-0000-4000-8000-000000000001','plus',now()+interval '1 day','post-cutover synthetic upgrade');
create temporary table next_paid_room as select room_record->>'room_id' room_id from public.create_room_with_active_session_v3(
 'fb100000-0000-4000-8000-000000000001','paid-after-cutover',null,null,null,null,null,null,null,'paid-after-cutover','plus',6,6,true,true,3);
select ok((select r.host_plan_code='plus' and a.room_id=r.room_id from public.rooms r join next_paid_room n using(room_id)
 join public.active_room_sessions a on a.user_id=r.host_user_id),'upgraded host creates a new paid room after old assignment is released');
select * from public.finalize_room_usage('cutover-free',now(),current_date,0);
select is((select room_id from public.active_room_sessions where user_id='fb100000-0000-4000-8000-000000000001'),(select room_id from next_paid_room),'late old-room finalization cannot release the new paid-room assignment');
set local role anon;
select throws_ok($$select * from public.claim_room_hosting_cutover_v1(8)$$,'42501',null,'anonymous cannot drain closures');
reset role;
set local role authenticated;
select throws_ok($$select * from public.claim_room_hosting_cutover_v1(8)$$,'42501',null,'signed-in user cannot drain closures');
reset role;
select * from finish();
rollback;
