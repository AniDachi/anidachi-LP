begin;
set local search_path=public,extensions;
select no_plan();
select has_table('public','trial_conversion_events','verified transitions have a durable outbox');
insert into public.users(id,email,display_name) values
 ('c1000000-0000-4000-8000-000000000001','conversion-host@example.test','Host'),
 ('c1000000-0000-4000-8000-000000000002','conversion-guest@example.test','Guest'),
 ('c1000000-0000-4000-8000-000000000003','conversion-guest2@example.test','Guest2');
insert into public.billing_customers(user_id,stripe_customer_id) values('c1000000-0000-4000-8000-000000000001','cus_conversion');
update public.hosting_commercial_policy set activation_at=now()-interval '1 day',trials_enabled=true,cardless_trials_enabled=true;
update anidachi_private.trial_event_scheduler set environment='staging',enabled=true;
create temporary table conversion_proof(name text primary key,value jsonb);
grant all on conversion_proof to service_role;
set local role service_role;
insert into conversion_proof values('a',public.reserve_cardless_trial_v1('c1000000-0000-4000-8000-000000000001',gen_random_uuid(),'plus','monthly','price_plus','cus_conversion',1));
select is((select count(*) from public.trial_conversion_events),0::bigint,'reservation is not an active trial');
select public.record_cardless_trial_created_v1('c1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from conversion_proof where name='a'),'cus_conversion','sched_conversion','sub_conversion','price_plus',now(),now()+interval '72 hours');
select is((select count(*) from public.trial_conversion_events),0::bigint,'Stripe create alone is not verified access');
insert into conversion_proof values('lease',public.begin_stripe_subscription_refresh_v1('sub_conversion'));
select public.commit_stripe_subscription_refresh_v3('sub_conversion',(select (value->>'fence')::bigint from conversion_proof where name='lease'),(select (value->>'token')::uuid from conversion_proof where name='lease'),
 'c1000000-0000-4000-8000-000000000001','cus_conversion','price_plus','plus','trialing',now()+interval '72 hours',true,
 jsonb_build_object('trialMode','cardless','trialActivationId',(select value->>'id' from conversion_proof where name='a'),'stripeScheduleId','sched_conversion','scheduleStatus','active','scheduleEndBehavior','cancel','trialStartedAt',now(),'trialEndsAt',now()+interval '72 hours','firstPaymentState','awaiting','firstInvoiceId',null,'firstPaidAt',null));
select is((select count(*) from public.trial_conversion_events where event_type='trial_started'),1::bigint,'shared refresh commits the trial event atomically');
select is((select count(*) from public.trial_conversion_events where event_type='trial_first_payment_succeeded'),0::bigint,'initial zero invoice is not paid');
reset role;
update public.account_subscription_trials set first_payment_state=first_payment_state;
select is((select count(*) from public.trial_conversion_events where event_type='trial_started'),1::bigint,'duplicate refresh preserves one logical event');
update anidachi_private.trial_event_scheduler set enabled=false;
set local role service_role;
select is((select count(*) from public.claim_trial_conversion_events_v1('staging',8)),0::bigint,'disabled scheduler does not deliver even by manual HTTP drain');
reset role;
update anidachi_private.trial_event_scheduler set enabled=true;
select anidachi_private.tick_trial_event_scheduler();
select is((select last_result from anidachi_private.trial_event_scheduler),'missing_secret','missing dedicated bearer never sends a request');
select is((select last_request_id from anidachi_private.trial_event_scheduler),null::bigint,'no request is queued without a secret');
select ok(not has_function_privilege('service_role','anidachi_private.tick_trial_event_scheduler()','EXECUTE'),'runtime cannot reach Vault through scheduler');
insert into public.rooms(room_id,host_user_id,host_plan_code,status) values('conversion-room','c1000000-0000-4000-8000-000000000001','plus','lobby');
select is((select count(*) from public.trial_conversion_events where event_type='trial_first_room_created'),1::bigint,'first owned room is observed independently');
select is((select count(*) from public.trial_conversion_events where event_type='trial_first_shared_session'),0::bigint,'solo room is not shared');
set local role service_role;
select public.record_recent_room_presence_v1(jsonb_build_object('roomId','conversion-room','roomGeneration',1,'observedAt',floor(extract(epoch from clock_timestamp())*1000),'participants',jsonb_build_array(jsonb_build_object('userId','c1000000-0000-4000-8000-000000000002','sessionId','g1'),jsonb_build_object('userId','c1000000-0000-4000-8000-000000000003','sessionId','g2'))));
select is((select count(*) from public.trial_conversion_events where event_type='trial_first_shared_session'),0::bigint,'two guests without host are not the host shared-session milestone');
select public.record_recent_room_presence_v1(jsonb_build_object('roomId','conversion-room','roomGeneration',1,'observedAt',floor(extract(epoch from clock_timestamp())*1000),'participants',jsonb_build_array(jsonb_build_object('userId','c1000000-0000-4000-8000-000000000001','sessionId','host'),jsonb_build_object('userId','c1000000-0000-4000-8000-000000000002','sessionId','g1'))));
select public.record_recent_room_presence_v1(jsonb_build_object('roomId','conversion-room','roomGeneration',1,'observedAt',floor(extract(epoch from clock_timestamp())*1000),'participants',jsonb_build_array(jsonb_build_object('userId','c1000000-0000-4000-8000-000000000001','sessionId','host'),jsonb_build_object('userId','c1000000-0000-4000-8000-000000000003','sessionId','g2'))));
select is((select count(*) from public.trial_conversion_events where event_type='trial_first_shared_session'),1::bigint,'host plus guest confirms one logical shared milestone across retries and guests');
insert into conversion_proof values('op',public.reserve_trial_renewal_v1('c1000000-0000-4000-8000-000000000001',gen_random_uuid(),'sub_conversion','enable','{"planCode":"pro","billingPeriod":"yearly","priceId":"price_pro_yearly","amount":14390,"currency":"usd","termsRevision":"v1","quoteRevision":"q1"}'));
select public.begin_trial_setup_v1('c1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from conversion_proof where name='op'),1,gen_random_uuid(),'https://staging.anidachi.app');
select public.record_trial_setup_session_v1('c1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from conversion_proof where name='op'),1,'cs_conversion');
select is((select count(*) from public.trial_conversion_events where event_type in ('trial_renewal_enabled','trial_first_payment_succeeded')),0::bigint,'consent and Checkout setup creation are not verified renewal or payment');
select public.commit_trial_renewal_v2('c1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from conversion_proof where name='op'),1,'setup_pending','applying','{"setupSessionId":"cs_conversion","setupIntentId":"seti_conversion","paymentMethodId":"pm_conversion"}');
select public.commit_trial_renewal_v2('c1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from conversion_proof where name='op'),1,'applying','applied',jsonb_build_object('scheduleId','sched_conversion','subscriptionId','sub_conversion','customerId','cus_conversion','trialEndsAt',now()+interval '72 hours','endBehavior','release','priceId','price_pro_yearly','paymentMethodId','pm_conversion'));
select is((select count(*) from public.trial_conversion_events where event_type='trial_renewal_enabled'),1::bigint,'verified Schedule transition records renewal');
select is((select plan_code||'/'||billing_period from public.trial_conversion_events where event_type='trial_renewal_enabled'),'pro/yearly','renewal uses confirmed selection, not the original trial selection');
select is((select count(*) from public.trial_conversion_events where event_type='trial_first_payment_succeeded'),0::bigint,'successful setup still is not revenue');
insert into conversion_proof values('credit-lease',public.begin_stripe_subscription_refresh_v1('sub_conversion'));
select public.commit_stripe_subscription_refresh_v3('sub_conversion',(select (value->>'fence')::bigint from conversion_proof where name='credit-lease'),(select (value->>'token')::uuid from conversion_proof where name='credit-lease'),
 'c1000000-0000-4000-8000-000000000001','cus_conversion','price_pro_yearly','pro','active',now()+interval '368 days',false,
 jsonb_build_object('trialMode','cardless','trialActivationId',(select value->>'id' from conversion_proof where name='a'),'stripeScheduleId','sched_conversion','scheduleStatus','released','scheduleEndBehavior','release','trialStartedAt',now(),'trialEndsAt',now()+interval '72 hours','firstPaymentState','paid','firstInvoiceId','in_credit_conversion','firstPaidAt',now()+interval '72 hours'));
select is((select count(*) from public.trial_conversion_events where event_type='trial_first_payment_succeeded'),0::bigint,'credit-settled service is not new cash revenue');
select is((select plan_code from public.subscription_access_grants_v1('c1000000-0000-4000-8000-000000000001',now()+interval '4 days')),'pro','settled recurring credit keeps consented paid access beyond the trial grace');
insert into conversion_proof values('paid-lease',public.begin_stripe_subscription_refresh_v1('sub_conversion'));
select public.commit_stripe_subscription_refresh_v3('sub_conversion',(select (value->>'fence')::bigint from conversion_proof where name='paid-lease'),(select (value->>'token')::uuid from conversion_proof where name='paid-lease'),
 'c1000000-0000-4000-8000-000000000001','cus_conversion','price_pro_yearly','pro','active',now()+interval '368 days',false,
 jsonb_build_object('trialMode','cardless','trialActivationId',(select value->>'id' from conversion_proof where name='a'),'stripeScheduleId','sched_conversion','scheduleStatus','released','scheduleEndBehavior','release','trialStartedAt',now(),'trialEndsAt',now()+interval '72 hours','firstPaymentState','paid','firstInvoiceId','in_credit_conversion','firstPaidAt',now()+interval '72 hours','firstCashInvoiceId','in_positive_conversion','firstCashPaidAt',now()+interval '33 days','firstCashAmountPaid',14390));
select is((select count(*) from public.trial_conversion_events where event_type='trial_first_payment_succeeded'),1::bigint,'verified positive first-invoice ledger creates a payment event');
select is((select plan_code||'/'||billing_period from public.trial_conversion_events where event_type='trial_first_payment_succeeded'),'pro/yearly','payment conversion retains the renewal terms');
reset role;
update public.account_subscription_trials set first_payment_state=first_payment_state;
select is((select count(*) from public.trial_conversion_events where event_type='trial_first_payment_succeeded'),1::bigint,'duplicate paid refresh cannot create another conversion');
set local role service_role;
select is((select count(*) from public.claim_trial_conversion_events_v1('production',8)),0::bigint,'foreign environment cannot claim staging data');
insert into conversion_proof values('claim',(select to_jsonb(c) from public.claim_trial_conversion_events_v1('staging',1) c));
select is((select count(*) from public.claim_trial_conversion_events_v1('staging',1) c where c.id=(select (value->>'id')::uuid from conversion_proof where name='claim')),0::bigint,'live lease prevents duplicate claim');
select is(public.finish_trial_conversion_event_v1((select (value->>'id')::uuid from conversion_proof where name='claim'),gen_random_uuid(),'staging',true),false,'stale lease cannot acknowledge delivery');
select is(public.finish_trial_conversion_event_v1((select (value->>'id')::uuid from conversion_proof where name='claim'),(select (value->>'lease_token')::uuid from conversion_proof where name='claim'),'production',true),false,'wrong environment cannot acknowledge delivery');
select is(public.finish_trial_conversion_event_v1((select (value->>'id')::uuid from conversion_proof where name='claim'),(select (value->>'lease_token')::uuid from conversion_proof where name='claim'),'staging',false),true,'failed HTTP receipt remains recoverable');
select is((select delivered_at from public.trial_conversion_events where id=(select (value->>'id')::uuid from conversion_proof where name='claim')),null::timestamptz,'failure is not marked delivered');
select throws_ok($$update public.trial_conversion_events set delivered_at=now()$$,'42501',null,'runtime cannot invent delivery directly');
reset role;
update public.trial_conversion_events set next_attempt_at=now()-interval '1 second' where id=(select (value->>'id')::uuid from conversion_proof where name='claim');
set local role service_role;
insert into conversion_proof values('retry',(select to_jsonb(c) from public.claim_trial_conversion_events_v1('staging',1) c));
select is((select value->>'id' from conversion_proof where name='retry'),(select value->>'id' from conversion_proof where name='claim'),'retry retains immutable event ID');
select is(public.finish_trial_conversion_event_v1((select (value->>'id')::uuid from conversion_proof where name='retry'),(select (value->>'lease_token')::uuid from conversion_proof where name='retry'),'staging',true),true,'valid acknowledgement marks delivered');
reset role;
update public.trial_conversion_events set lease_token=null,lease_until=null,next_attempt_at=now()-interval '1 second',first_attempt_at=now()-interval '7 days' where delivered_at is null;
set local role service_role;
select is((select count(*) from public.claim_trial_conversion_events_v1('staging',8)),0::bigint,'old unknown receipts stop automatic replay outside dedupe safety window');
reset role;
select ok((select bool_and(manual_recovery_at is not null) from public.trial_conversion_events where delivered_at is null),'old events are retained for explicit reconciliation, not dropped');
set local role authenticated;
select throws_ok($$select * from public.trial_conversion_events$$,'42501',null,'clients cannot read private analytics records');
select throws_ok($$select * from public.claim_trial_conversion_events_v1('staging',8)$$,'42501',null,'clients cannot claim events');
reset role;
delete from public.rooms where room_id='conversion-room';
delete from public.users where id='c1000000-0000-4000-8000-000000000001';
select is((select count(*) from public.trial_conversion_events),0::bigint,'account deletion cascades the private analytics outbox');
select * from finish();
rollback;
