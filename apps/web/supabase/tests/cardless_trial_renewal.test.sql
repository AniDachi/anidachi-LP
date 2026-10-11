begin;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name) values('b1000000-0000-4000-8000-000000000001','renewal@example.test','Renewal');
insert into public.billing_customers(user_id,stripe_customer_id) values('b1000000-0000-4000-8000-000000000001','cus_renewal');
update public.hosting_commercial_policy set activation_at=now()-interval '1 day',trials_enabled=true,cardless_trials_enabled=true;
create temporary table proof(name text primary key,value jsonb);
grant all on proof to service_role;
set local role service_role;
insert into proof values('a',public.reserve_cardless_trial_v1('b1000000-0000-4000-8000-000000000001',gen_random_uuid(),'plus','monthly','price_plus','cus_renewal',1));
select public.record_cardless_trial_created_v1('b1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='a'),'cus_renewal','sched_renewal','sub_renewal','price_plus',now(),now()+interval '72 hours');
insert into proof values('lease',public.begin_stripe_subscription_refresh_v1('sub_renewal'));
select public.commit_stripe_subscription_refresh_v3('sub_renewal',(select (value->>'fence')::bigint from proof where name='lease'),(select (value->>'token')::uuid from proof where name='lease'),
 'b1000000-0000-4000-8000-000000000001','cus_renewal','price_plus','plus','trialing',now()+interval '72 hours',true,
 jsonb_build_object('trialMode','cardless','trialActivationId',(select value->>'id' from proof where name='a'),'stripeScheduleId','sched_renewal','scheduleStatus','active','scheduleEndBehavior','cancel','trialStartedAt',now(),'trialEndsAt',now()+interval '72 hours','firstPaymentState','awaiting','firstInvoiceId',null,'firstPaidAt',null));
insert into proof values('op',public.reserve_trial_renewal_v1('b1000000-0000-4000-8000-000000000001',gen_random_uuid(),'sub_renewal','enable','{"planCode":"plus","billingPeriod":"monthly","priceId":"price_plus","amount":799,"currency":"usd","termsRevision":"v1","quoteRevision":"q1"}'));
create function pg_temp.begin_setup(origin text default 'https://staging.anidachi.app') returns jsonb language sql as $$
 select public.begin_trial_setup_v1('b1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='op'),(select (value->>'generation')::bigint from proof where name='op'),'b2000000-0000-4000-8000-000000000001',origin) $$;
select is(pg_temp.begin_setup()->>'state','setup_pending','consent stored before creating Session');
select ok((pg_temp.begin_setup()->>'consented_at') is not null,'consent has server timestamp');
select is(pg_temp.begin_setup()->>'setup_origin','https://staging.anidachi.app','stable origin preserved for retry');
select throws_ok($$select pg_temp.begin_setup('https://other.example')$$,'P0001','TRIAL_SETUP_REQUEST_MISMATCH','origin cannot change on idempotent retry');
create function pg_temp.save_setup(session_id text) returns jsonb language sql as $$
 select public.record_trial_setup_session_v1('b1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='op'),(select (value->>'generation')::bigint from proof where name='op'),session_id) $$;
select is(pg_temp.save_setup('cs_renewal')->>'setup_session_id','cs_renewal','Session identity durably stored');
select is(pg_temp.save_setup('cs_renewal')->>'setup_session_id','cs_renewal','duplicate Session write is harmless');
select throws_ok($$select pg_temp.save_setup('cs_other')$$,'P0001','TRIAL_SETUP_SESSION_MISMATCH','Session cannot be replaced');
select throws_ok($$select public.record_trial_setup_session_v1('b1000000-0000-4000-8000-000000000002',(select (value->>'id')::uuid from proof where name='op'),1,'cs_renewal')$$,'P0001','TRIAL_RENEWAL_STALE','foreign owner cannot bind Session');
select throws_ok($$select public.commit_trial_renewal_v2('b1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='op'),1,'setup_pending','applying','{"setupSessionId":"cs_other","setupIntentId":"seti_test","paymentMethodId":"pm_test"}')$$,
 'P0001','TRIAL_SETUP_SESSION_MISMATCH','verified completion must use the reserved Session');
select public.commit_trial_renewal_v2('b1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='op'),1,'setup_pending','applying','{"setupSessionId":"cs_renewal","setupIntentId":"seti_test","paymentMethodId":"pm_test"}');
select throws_ok($$select public.settle_expired_trial_renewal_v1('b1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='op'),1,'{}')$$,
 'P0001','TRIAL_RENEWAL_UNVERIFIED','unknown mutation cannot be expired based only on time');
select public.commit_trial_renewal_v2('b1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='op'),1,'applying','applied',
 jsonb_build_object('scheduleId','sched_renewal','subscriptionId','sub_renewal','customerId','cus_renewal','trialEndsAt',now()+interval '72 hours','endBehavior','release','priceId','price_plus','paymentMethodId','pm_test'));
select is(pg_temp.save_setup('cs_renewal')->>'state','applied','late same Session write does not regress committed state');
select public.reserve_trial_renewal_v1('b1000000-0000-4000-8000-000000000001',gen_random_uuid(),'sub_renewal','cancel','{}');
select throws_ok($$select pg_temp.save_setup('cs_renewal')$$,'P0001','TRIAL_RENEWAL_STALE','later cancel fences late setup persistence');
select throws_ok($$select pg_temp.begin_setup()$$,'P0001','TRIAL_RENEWAL_STALE','later cancel fences stale consent');
select throws_ok($$update public.subscription_trial_renewals set setup_origin='https://other.example'$$,'42501',null,'runtime cannot directly mutate setup consent');
reset role;
-- Persisted state left by a worker lost for more than the whole trial. The
-- synthetic fixture uses a past original deadline; the RPC must verify expiry.
insert into public.users(id,email,display_name) values('b1000000-0000-4000-8000-000000000002','renewal-expired@example.test','Expired');
insert into public.billing_customers(user_id,stripe_customer_id) values('b1000000-0000-4000-8000-000000000002','cus_expired');
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end)
 values('b1000000-0000-4000-8000-000000000002','cus_expired','sub_expired','price_plus','plus','canceled',now()-interval '1 hour');
insert into public.subscription_trial_activations(id,user_id,request_id,plan_code,billing_period,price_id,policy_revision,stripe_customer_id,stripe_schedule_id,stripe_subscription_id,state,trial_started_at,trial_ends_at,created_at)
 values('b3000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002',gen_random_uuid(),'plus','monthly','price_plus',1,'cus_expired','sched_expired','sub_expired','committed',now()-interval '73 hours',now()-interval '1 hour',now()-interval '73 hours');
insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at,trial_mode,trial_activation_id,stripe_schedule_id)
 values('b1000000-0000-4000-8000-000000000002','sub_expired',now()-interval '73 hours',now()-interval '1 hour','cardless','b3000000-0000-4000-8000-000000000002','sched_expired');
insert into public.subscription_trial_renewals(id,user_id,request_id,stripe_subscription_id,generation,action,terms,plan_code,billing_period,price_id,amount,currency,terms_revision,quote_revision,original_trial_end,quote_expires_at,state,consented_at,created_at,updated_at)
 select 'b4000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002',gen_random_uuid(),'sub_expired',1,'enable',terms,plan_code,billing_period,price_id,amount,currency,terms_revision,quote_revision,now()-interval '1 hour',now()-interval '72 hours','applying',now()-interval '73 hours',now()-interval '73 hours',now()-interval '73 hours' from public.subscription_trial_renewals where id=(select (value->>'id')::uuid from proof where name='op');
insert into proof values('expired-proof',jsonb_build_object('scheduleId','sched_expired','subscriptionId','sub_expired','customerId','cus_expired','trialEndsAt',now()-interval '1 hour','endBehavior','cancel','scheduleStatus','completed','subscriptionStatus','canceled'));
create function pg_temp.settle(snapshot jsonb) returns jsonb language sql as $$
 select public.settle_expired_trial_renewal_v1('b1000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000002',1,snapshot) $$;
set local role service_role;
select throws_ok($$select pg_temp.settle(jsonb_set((select value from proof where name='expired-proof'),'{endBehavior}','"release"'))$$,'P0001','TRIAL_RENEWAL_UNVERIFIED','released subscription cannot be settled as no-charge expiry');
select throws_ok($$select pg_temp.settle(jsonb_set((select value from proof where name='expired-proof'),'{customerId}','"cus_other"'))$$,'P0001','TRIAL_RENEWAL_UNVERIFIED','expired proof must belong to the original customer');
select is(pg_temp.settle((select value from proof where name='expired-proof'))->>'state','expired','positive terminal proof settles old applying operation');
select is(pg_temp.settle((select value from proof where name='expired-proof'))->>'state','expired','duplicate expiry settlement is idempotent');
select is((select count(*) from public.subscription_access_grants_v1('b1000000-0000-4000-8000-000000000002',now())),0::bigint,'recovery of expired operation grants no paid rights');
reset role;
set local role authenticated;
select throws_ok($$select * from public.subscription_trial_renewals$$,'42501',null,'renewal and consent records are private');
select throws_ok($$select pg_temp.begin_setup()$$,'42501',null,'client cannot call setup RPC');
reset role;
select * from finish();
rollback;
