-- Synthetic accounts, real roles/RPCs. Every fixture rolls back.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_table('public','free20_room_refresh_outbox','durable purchase delivery exists');
insert into public.users(id,email,display_name)
 select ('f6260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'purchase-'||n||'@example.test','Purchase fixture' from generate_series(1,7) n;
update public.personal_history_policy set active=true;
update public.hosting_commercial_policy set activation_at=now()-interval '5 days',free20_enabled=false,trials_enabled=true,cardless_trials_enabled=true;
create temporary table purchase_proof(name text primary key,value jsonb);
grant all on purchase_proof to service_role;
create function pg_temp.owner(n integer) returns uuid language sql as $$select ('f6260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.create_purchase_room(n integer) returns jsonb language sql as $$
 select room_record from public.create_room_with_active_session_v4(pg_temp.owner(n),'host-session',null,null,null,null,null,null,null,'purchase-room-'||n,'free',4,4,false,false,3,1);
$$;
create function pg_temp.purchase(n integer,trial jsonb default null,sub_status text default 'active') returns jsonb language plpgsql as $$
declare lease jsonb; begin
 lease:=public.begin_stripe_subscription_refresh_v1('sub_purchase_'||n);
 return public.commit_stripe_subscription_refresh_v4('sub_purchase_'||n,(lease->>'fence')::bigint,(lease->>'token')::uuid,
  pg_temp.owner(n),'cus_purchase_'||n,'price_purchase','plus',sub_status,now()+interval '30 days',false,trial);
end $$;
-- Freeze the accepted operation before retirement; finalize it after Free20.
insert into public.billing_customers(user_id,stripe_customer_id) values(pg_temp.owner(7),'cus_purchase_7');
set local role service_role;
insert into purchase_proof values('activation',public.reserve_cardless_trial_v1(pg_temp.owner(7),gen_random_uuid(),'plus','monthly','price_purchase','cus_purchase_7',1));
reset role;
update public.hosting_commercial_policy set free20_enabled=true,trials_enabled=false;
set local role service_role;
insert into purchase_proof select 'room-'||n,pg_temp.create_purchase_room(n) from generate_series(1,5) n;
-- A valid service-role caller alone cannot choose an arbitrary enqueue target.
select ok(not has_table_privilege('anon','public.free20_room_refresh_outbox','SELECT'),'anonymous cannot inspect queue');
select ok(not has_table_privilege('authenticated','public.free20_room_refresh_outbox','INSERT'),'browser cannot enqueue work');
select ok(not has_table_privilege('service_role','public.free20_room_refresh_outbox','INSERT'),'runtime enqueue is scoped to the atomic subscription RPC');
select ok(not has_function_privilege('authenticated','public.claim_free20_room_refresh_v1(integer,uuid)','EXECUTE'),'browser cannot claim deliveries');
reset role;
set local role anon;
select throws_ok($$select * from public.claim_free20_room_refresh_v1(4,null)$$,'42501',null,'anonymous role cannot execute claim');
select throws_ok($$select * from public.free20_room_refresh_outbox$$,'42501',null,'RLS queue is inaccessible to anonymous role');
reset role;
set local role authenticated;
select throws_ok($$select public.commit_stripe_subscription_refresh_v4('x',1,gen_random_uuid(),pg_temp.owner(1),'c','p','plus','active',now()+interval '1 day',false,null)$$,'42501',null,'browser cannot commit payments or enqueue');
select throws_ok($$select public.finish_free20_room_refresh_v1(pg_temp.owner(1),'x',1,1,gen_random_uuid(),'applied')$$,'42501',null,'browser cannot acknowledge a delivery');
reset role;
-- Only exact current host assignment and durable marker qualify.
update public.active_room_sessions set role='member' where user_id=pg_temp.owner(2);
update public.rooms set host_user_id=pg_temp.owner(7) where room_id=(select value->>'room_id' from purchase_proof where name='room-3');
update public.rooms set status='ended' where room_id=(select value->>'room_id' from purchase_proof where name='room-4');
alter table public.rooms disable trigger preserve_room_time_mode;
update public.rooms set hosting_time_mode=null where room_id=(select value->>'room_id' from purchase_proof where name='room-5');
alter table public.rooms enable trigger preserve_room_time_mode;
update public.rooms set presence_room_generation=17 where room_id=(select value->>'room_id' from purchase_proof where name='room-1');
set local role service_role;
select lives_ok($$select pg_temp.purchase(1)$$,'purchase commits and enqueues current host');
select lives_ok($$select pg_temp.purchase(2)$$,'guest subscription still commits');
select lives_ok($$select pg_temp.purchase(3)$$,'mismatched assignment subscription still commits');
select lives_ok($$select pg_temp.purchase(4)$$,'ended room subscription still commits');
select lives_ok($$select pg_temp.purchase(5)$$,'unmarked room subscription still commits');
select lives_ok($$select pg_temp.purchase(6)$$,'idle owner subscription still commits');
reset role;
select is((select count(*) from public.free20_room_refresh_outbox),1::bigint,'guest, mismatched, ended, legacy and idle produce no job');
select is((select room_generation from public.free20_room_refresh_outbox),17::bigint,'enqueue uses actual presence authority generation');
select is((select revision from public.free20_room_refresh_outbox),1::bigint,'first durable revision');
select is((select max_participants from public.rooms where room_id=(select value->>'room_id' from purchase_proof where name='room-1')),4,'purchase keeps pinned capacity');
set local role service_role;
select throws_ok($$select * from public.claim_free20_room_refresh_v1(5,null)$$,'22023','FREE20_REFRESH_CLAIM_INVALID','claim limit is bounded at four');
insert into purchase_proof select 'claim',to_jsonb(c) from public.claim_free20_room_refresh_v1(4,pg_temp.owner(1)) c;
select is((select count(*) from public.claim_free20_room_refresh_v1(4,null)),0::bigint,'duplicate drain cannot claim an active lease');
select lives_ok($$select pg_temp.purchase(1)$$,'another committed refresh coalesces while leased');
reset role;
select is((select revision from public.free20_room_refresh_outbox),2::bigint,'enqueue advances revision');
select is((select lease_revision from public.free20_room_refresh_outbox),1::bigint,'enqueue preserves active lease revision');
select is((select lease_token::text from public.free20_room_refresh_outbox),(select value->>'lease_token' from purchase_proof where name='claim'),'enqueue preserves lease token');
set local role service_role;
select is(public.finish_free20_room_refresh_v1(pg_temp.owner(1),(select value->>'room_id' from purchase_proof where name='claim'),17,1,(select (value->>'lease_token')::uuid from purchase_proof where name='claim'),'applied'),'superseded','old ACK cannot consume newer revision');
reset role;
select is((select completed_revision from public.free20_room_refresh_outbox),1::bigint,'old ACK records only its processed revision');
set local role service_role;
update purchase_proof set value=to_jsonb(c) from public.claim_free20_room_refresh_v1(4,pg_temp.owner(1)) c where name='claim';
reset role;
update public.free20_room_refresh_outbox set lease_until=clock_timestamp()-interval '1 second';
set local role service_role;
select is(public.finish_free20_room_refresh_v1(pg_temp.owner(1),(select value->>'room_id' from purchase_proof where name='claim'),17,2,(select (value->>'lease_token')::uuid from purchase_proof where name='claim'),'applied'),'stale','expired lease cannot ACK');
insert into purchase_proof select 'reclaimed',to_jsonb(c) from public.claim_free20_room_refresh_v1(4,null) c;
select is(public.finish_free20_room_refresh_v1(pg_temp.owner(1),(select value->>'room_id' from purchase_proof where name='claim'),17,2,(select (value->>'lease_token')::uuid from purchase_proof where name='claim'),'applied'),'stale','previous holder cannot ACK a newer claim');
select is(public.finish_free20_room_refresh_v1(pg_temp.owner(1),(select value->>'room_id' from purchase_proof where name='reclaimed'),17,2,(select (value->>'lease_token')::uuid from purchase_proof where name='reclaimed'),'applied'),'completed','current full ACK completes work');
select is((select count(*) from public.claim_free20_room_refresh_v1(4,null)),0::bigint,'completed fence is not reclaimed');
select lives_ok($$select pg_temp.purchase(1,null,'canceled')$$,'no paid inference: canceled mirror can queue revalidation too');
reset role;
select is((select revision from public.free20_room_refresh_outbox),3::bigint,'completed rows retain monotonic revision fence');
select is((select completed_revision from public.free20_room_refresh_outbox),2::bigint,'new revision remains pending');
-- Local subtransaction rollback must undo the mirror AND enqueue together.
create function pg_temp.abort_purchase() returns void language plpgsql as $$begin
 perform pg_temp.purchase(1); raise exception 'synthetic rollback'; end$$;
set local role service_role;
select throws_ok($$select pg_temp.abort_purchase()$$,'P0001','synthetic rollback','post-enqueue transaction failure rolls back');
reset role;
select is((select revision from public.free20_room_refresh_outbox),3::bigint,'aborted transaction cannot advance queue');
select is((select status from public.subscriptions where stripe_subscription_id='sub_purchase_1'),'canceled','aborted transaction cannot advance mirror');
-- Lost/failed Worker ACK always keeps work, with capped retry and no abandonment.
update public.free20_room_refresh_outbox set attempts=999999,queued_at=now()-interval '90 days';
set local role service_role;
update purchase_proof set value=to_jsonb(c) from public.claim_free20_room_refresh_v1(4,null) c where name='claim';
select is(public.finish_free20_room_refresh_v1(pg_temp.owner(1),(select value->>'room_id' from purchase_proof where name='claim'),17,3,(select (value->>'lease_token')::uuid from purchase_proof where name='claim'),null),'retry','old high-attempt job retries without abandonment');
reset role;
select ok((select next_attempt_at between clock_timestamp()+interval '59 seconds' and clock_timestamp()+interval '60 seconds' from public.free20_room_refresh_outbox),'backoff caps at sixty seconds');
update public.free20_room_refresh_outbox set next_attempt_at=clock_timestamp();
update public.rooms set status='ended' where room_id=(select value->>'room_id' from purchase_proof where name='room-1');
set local role service_role;
select is((select count(*) from public.claim_free20_room_refresh_v1(4,null)),0::bigint,'durably ended target retires without needing an initialized Worker');
reset role;
select is((select completed_revision from public.free20_room_refresh_outbox where owner_user_id=pg_temp.owner(1)),3::bigint,'ended target preserves its completed revision tombstone');
set local role service_role;
reset role;
-- Cardless v3 finalization is visible before enqueue, never the earlier v1 mirror.
set local role service_role;
insert into purchase_proof values('room-7',pg_temp.create_purchase_room(7));
insert into purchase_proof values('created',public.record_cardless_trial_created_v1(pg_temp.owner(7),(select (value->>'id')::uuid from purchase_proof where name='activation'),
 'cus_purchase_7','sched_purchase_7','sub_purchase_7','price_purchase',now(),now()+interval '72 hours'));
insert into purchase_proof values('snapshot',jsonb_build_object('trialMode','cardless','trialActivationId',(select value->>'id' from purchase_proof where name='activation'),
 'stripeScheduleId','sched_purchase_7','scheduleStatus','active','scheduleEndBehavior','cancel',
 'trialStartedAt',now(),'trialEndsAt',now()+interval '72 hours','firstInvoiceId',null,'firstPaymentState','awaiting','firstPaidAt',null));
reset role;
create function pg_temp.require_final_ledger() returns trigger language plpgsql as $$begin
 if new.owner_user_id=pg_temp.owner(7) and not exists(
  select 1 from public.account_subscription_trials t join public.subscription_trial_activations a on a.id=t.trial_activation_id
  where t.user_id=new.owner_user_id and t.stripe_subscription_id='sub_purchase_7' and t.trial_mode='cardless' and a.state='committed'
 ) then raise exception 'ENQUEUED_BEFORE_LEDGER_FINALIZATION'; end if;
 return new;
end $$;
create trigger fixture_final_ledger before insert on public.free20_room_refresh_outbox for each row execute function pg_temp.require_final_ledger();
set local role service_role;
select throws_ok($$select pg_temp.purchase(7,jsonb_set((select value from purchase_proof where name='snapshot'),'{stripeScheduleId}','"wrong"'),'trialing')$$,
 'P0001','TRIAL_ACTIVATION_MISMATCH','invalid trial provenance rejects the complete v4 transaction');
reset role;
select is((select count(*) from public.free20_room_refresh_outbox where owner_user_id=pg_temp.owner(7)),0::bigint,'failed trial never queues');
select is((select count(*) from public.subscriptions where user_id=pg_temp.owner(7)),0::bigint,'failed trial never creates mirror');
set local role service_role;
select lives_ok($$select pg_temp.purchase(7,(select value from purchase_proof where name='snapshot'),'trialing')$$,'enqueue observes finalized cardless trial ledger and activation');
reset role;
select is((select count(*) from public.free20_room_refresh_outbox where owner_user_id=pg_temp.owner(7)),1::bigint,'verified trial commits exactly one revalidation');
select is((select state from public.subscription_trial_activations where stripe_subscription_id='sub_purchase_7'),'committed','v4 preserves final activation state');
-- A ledger error AFTER v1 wrote the mirror must also roll everything back.
create function pg_temp.reject_trial_finalization() returns trigger language plpgsql as $$begin raise exception 'SYNTHETIC_TRIAL_FINALIZE_FAILURE'; end$$;
create trigger fixture_reject_finalization before update on public.account_subscription_trials for each row execute function pg_temp.reject_trial_finalization();
set local role service_role;
select throws_ok($$select pg_temp.purchase(7,(select value from purchase_proof where name='snapshot'),'active')$$,'P0001','SYNTHETIC_TRIAL_FINALIZE_FAILURE','failure after v1 mirror update aborts v4');
reset role;
select is((select status from public.subscriptions where stripe_subscription_id='sub_purchase_7'),'trialing','post-mirror ledger failure rolls back subscription');
select is((select revision from public.free20_room_refresh_outbox where owner_user_id=pg_temp.owner(7)),1::bigint,'post-mirror ledger failure rolls back enqueue');
-- Absence of an assignment alone is not terminal: live authority may recover.
delete from public.active_room_sessions where user_id=pg_temp.owner(7);
set local role service_role;
insert into purchase_proof select 'unassigned',to_jsonb(c) from public.claim_free20_room_refresh_v1(4,pg_temp.owner(7)) c;
select is((select (value->>'lease_revision')::bigint from purchase_proof where name='unassigned'),1::bigint,'live unassigned target remains deliverable');
select is(public.finish_free20_room_refresh_v1(pg_temp.owner(7),(select value->>'room_id' from purchase_proof where name='unassigned'),1,1,(select (value->>'lease_token')::uuid from purchase_proof where name='unassigned'),null),'retry','unavailable live authority retains retry work');
reset role;
update public.free20_room_refresh_outbox set next_attempt_at=clock_timestamp() where owner_user_id=pg_temp.owner(7);
update public.rooms set presence_room_generation=19 where room_id=(select value->>'room_id' from purchase_proof where name='room-7');
set local role service_role;
select is((select count(*) from public.claim_free20_room_refresh_v1(4,pg_temp.owner(7))),0::bigint,'confirmed obsolete generation retires without Worker ACK');
reset role;
select is((select completed_revision from public.free20_room_refresh_outbox where owner_user_id=pg_temp.owner(7)),1::bigint,'obsolete generation retains revision tombstone');
-- The media lease supplies generation when presence has not yet reached SQL.
drop trigger fixture_reject_finalization on public.account_subscription_trials;
insert into public.active_room_sessions(user_id,room_id,role,participant_session_id)
 select pg_temp.owner(7),value->>'room_id','host','restored-fixture' from purchase_proof where name='room-7';
update public.rooms set presence_room_generation=null,media_lease=jsonb_set(media_lease,'{roomGeneration}','23')
 where room_id=(select value->>'room_id' from purchase_proof where name='room-7');
set local role service_role;
select lives_ok($$select pg_temp.purchase(7,(select value from purchase_proof where name='snapshot'),'trialing')$$,'new actual generation can enqueue independently');
reset role;
select is((select room_generation from public.free20_room_refresh_outbox where owner_user_id=pg_temp.owner(7) and completed_revision<revision),23::bigint,'generation uses current media authority when no presence generation exists');
set local role service_role;
insert into purchase_proof select 'owner-stale',to_jsonb(c) from public.claim_free20_room_refresh_v1(4,pg_temp.owner(7)) c;
reset role;
update public.rooms set host_user_id=pg_temp.owner(1) where room_id=(select value->>'room_id' from purchase_proof where name='room-7');
set local role service_role;
select is((select count(*) from public.claim_free20_room_refresh_v1(4,pg_temp.owner(7))),0::bigint,'cleanup does not steal a current owner-stale lease');
reset role;
select is((select completed_revision from public.free20_room_refresh_outbox where owner_user_id=pg_temp.owner(7) and room_generation=23),0::bigint,'live lease retains its revision even after host changes');
set local role service_role;
select is(public.finish_free20_room_refresh_v1(pg_temp.owner(7),(select value->>'room_id' from purchase_proof where name='owner-stale'),23,1,(select (value->>'lease_token')::uuid from purchase_proof where name='owner-stale'),null),'retry','failed owner-stale delivery releases lease');
select is((select count(*) from public.claim_free20_room_refresh_v1(4,pg_temp.owner(7))),0::bigint,'confirmed owner mismatch retires without another delivery');
reset role;
select is((select completed_revision from public.free20_room_refresh_outbox where owner_user_id=pg_temp.owner(7) and room_generation=23),1::bigint,'owner-stale target preserves its fence');
update public.rooms set host_user_id=pg_temp.owner(7) where room_id=(select value->>'room_id' from purchase_proof where name='room-7');
set local role service_role;
select lives_ok($$select pg_temp.purchase(7,(select value from purchase_proof where name='snapshot'),'trialing')$$,'new committed request reopens same generation with next revision');
reset role;
delete from public.rooms where room_id=(select value->>'room_id' from purchase_proof where name='room-7');
set local role service_role;
select is((select count(*) from public.claim_free20_room_refresh_v1(4,pg_temp.owner(7))),0::bigint,'confirmed deleted room retires without initialized Worker');
reset role;
select is((select completed_revision from public.free20_room_refresh_outbox where owner_user_id=pg_temp.owner(7) and room_generation=23),2::bigint,'deleted-room completion preserves final fence');
select * from finish();
rollback;
