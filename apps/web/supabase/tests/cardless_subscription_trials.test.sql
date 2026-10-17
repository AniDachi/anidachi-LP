begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_table('public','subscription_trial_activations','durable activation exists');
select has_table('public','subscription_trial_renewals','durable renewal consent exists');
select ok(not cardless_trials_enabled,'migration leaves new trial disabled') from public.hosting_commercial_policy;
insert into public.users(id,email,display_name) values
 ('a1000000-0000-4000-8000-000000000001','cardless-one@example.test','Cardless'),
 ('a1000000-0000-4000-8000-000000000002','cardless-two@example.test','Other'),
 ('a1000000-0000-4000-8000-000000000003','cardless-legacy@example.test','Legacy'),
 ('a1000000-0000-4000-8000-000000000004','cardless-new-customer@example.test','New Customer');
insert into public.billing_customers(user_id,stripe_customer_id) values
 ('a1000000-0000-4000-8000-000000000001','cus_cardless_one'),
 ('a1000000-0000-4000-8000-000000000002','cus_cardless_two');
create temporary table proof(name text primary key,value jsonb);
grant all on proof to service_role;
create function pg_temp.reserve_trial(plan text default 'plus',price text default 'price_plus',revision bigint default 1)
returns jsonb language sql as $$select public.reserve_cardless_trial_v1(
 'a1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',plan,'monthly',price,'cus_cardless_one',revision)$$;
set local role service_role;
select throws_ok($$select pg_temp.reserve_trial()$$,'P0001','CARDLESS_TRIAL_UNAVAILABLE','disabled start fails closed');
reset role;
update public.hosting_commercial_policy set activation_at=now()-interval '1 day',trials_enabled=true,cardless_trials_enabled=true;
set local role service_role;
select throws_ok($$select pg_temp.reserve_trial('plus','price_plus',2)$$,'P0001','TRIAL_OFFER_CHANGED','fresh start rejects stale policy revision');
insert into proof values('new-customer',public.reserve_cardless_trial_v1('a1000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000004','plus','monthly','price_plus',null,1));
select throws_ok($$select public.record_cardless_trial_created_v1('a1000000-0000-4000-8000-000000000004',(select (value->>'id')::uuid from proof where name='new-customer'),null,'sched_unbound','sub_unbound','price_plus',now(),now()+interval '72 hours')$$,
 'P0001','TRIAL_ACTIVATION_MISMATCH','subscription cannot bind before its Customer is verified');
select throws_ok($$select public.reserve_subscription_checkout_v1('a1000000-0000-4000-8000-000000000004','plus','price_plus','https://anidachi.test',gen_random_uuid(),'{}')$$,
 'P0001','TRIAL_ACTIVATION_BUSY','authority is reserved before external Customer creation');
select public.record_cardless_trial_customer_v1('a1000000-0000-4000-8000-000000000004',(select (value->>'id')::uuid from proof where name='new-customer'),'cus_cardless_new');
select is(public.reserve_cardless_trial_v1('a1000000-0000-4000-8000-000000000004','a2000000-0000-4000-8000-000000000004','plus','monthly','price_plus',null,1)->>'stripe_customer_id',
 'cus_cardless_new','lost Customer response recovers the same binding');
select throws_ok($$select public.record_cardless_trial_customer_v1('a1000000-0000-4000-8000-000000000004',(select (value->>'id')::uuid from proof where name='new-customer'),'cus_cardless_two')$$,
 'P0001','TRIAL_CUSTOMER_MISMATCH','binding cannot steal another Customer or change owner mapping');
select throws_ok($$select public.reserve_cardless_trial_v1('a1000000-0000-4000-8000-000000000001',gen_random_uuid(),'plus','monthly','price_plus','cus_cardless_two',1)$$,
 'P0001','TRIAL_CUSTOMER_MISMATCH','another owner customer rejected');
insert into proof values('activation',pg_temp.reserve_trial());
select is(pg_temp.reserve_trial()->>'id',(select value->>'id' from proof where name='activation'),'request replay uses identical activation');
select throws_ok($$select pg_temp.reserve_trial('pro','price_pro')$$,'P0001','TRIAL_REQUEST_MISMATCH','request cannot change plan or price');
select throws_ok($$select pg_temp.reserve_trial('plus','price_changed')$$,'P0001','TRIAL_REQUEST_MISMATCH','request cannot change verified price');
select throws_ok($$select pg_temp.reserve_trial('plus','price_plus',2)$$,'P0001','TRIAL_REQUEST_MISMATCH','request cannot change revision');
select throws_ok($$select public.reserve_cardless_trial_v1('a1000000-0000-4000-8000-000000000001',gen_random_uuid(),'plus','monthly','price_plus','cus_cardless_one',1)$$,
 'P0001','TRIAL_ACTIVATION_BUSY','different click cannot create a second operation');
select throws_ok($$select public.reserve_subscription_checkout_v1('a1000000-0000-4000-8000-000000000001','plus','price_plus','https://anidachi.test',gen_random_uuid(),'{}')$$,
 'P0001','TRIAL_ACTIVATION_BUSY','legacy checkout uses the same account authority');
reset role;
update public.subscription_trial_activations set created_at=now()-interval '8 days';
update public.hosting_commercial_policy set cardless_trials_enabled=false,revision=2;
set local role service_role;
select is(pg_temp.reserve_trial()->>'id',(select value->>'id' from proof where name='activation'),'unknown outcome survives age and flag off');
select throws_ok($$select public.record_cardless_trial_created_v1('a1000000-0000-4000-8000-000000000002',
 (select (value->>'id')::uuid from proof where name='activation'),'cus_cardless_one','sub_sched_cardless','sub_cardless','price_plus',now(),now()+interval '72 hours')$$,
 'P0001','TRIAL_ACTIVATION_STALE','wrong owner cannot record created subscription');
insert into proof values('created',public.record_cardless_trial_created_v1('a1000000-0000-4000-8000-000000000001',
 (select (value->>'id')::uuid from proof where name='activation'),'cus_cardless_one','sub_sched_cardless','sub_cardless','price_plus',now(),now()+interval '72 hours'));
select is((select count(*) from public.account_subscription_trials where user_id='a1000000-0000-4000-8000-000000000001'),0::bigint,'recording IDs alone cannot mint access');
insert into proof values('snapshot',jsonb_build_object('trialMode','cardless','trialActivationId',(select value->>'id' from proof where name='activation'),
 'stripeScheduleId','sub_sched_cardless','scheduleStatus','active','scheduleEndBehavior','cancel',
 'trialStartedAt',now(),'trialEndsAt',now()+interval '72 hours','firstInvoiceId',null,'firstPaymentState','awaiting','firstPaidAt',null));
insert into proof values('lease',public.begin_stripe_subscription_refresh_v1('sub_cardless'));
create function pg_temp.refresh_trial(snapshot jsonb,sub_status text default 'trialing',period_end timestamptz default now()+interval '72 hours')
returns jsonb language sql as $$select public.commit_stripe_subscription_refresh_v3(
 'sub_cardless',(select (value->>'fence')::bigint from proof where name='lease'),(select (value->>'token')::uuid from proof where name='lease'),
 'a1000000-0000-4000-8000-000000000001','cus_cardless_one','price_plus','plus',sub_status,period_end,false,snapshot)$$;
select throws_ok($$select pg_temp.refresh_trial(jsonb_set((select value from proof where name='snapshot'),'{stripeScheduleId}','"sub_sched_other"'))$$,
 'P0001','TRIAL_ACTIVATION_MISMATCH','unverified schedule cannot grant access');
select is((select count(*) from public.subscriptions where stripe_subscription_id='sub_cardless'),0::bigint,'rejected provenance leaves no mirror');
insert into proof values('access',pg_temp.refresh_trial((select value from proof where name='snapshot')));
select is((select value->>'planCode' from proof where name='access'),'plus','verified activation grants selected trial');
select is((select trial_mode from public.account_subscription_trials where stripe_subscription_id='sub_cardless'),'cardless','ledger records provenance');
select is((select state from public.subscription_trial_activations where stripe_subscription_id='sub_cardless'),'committed','activation and ledger commit together');
select is((select expires_at from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now())),now()+interval '72 hours','no consent gives exactly 72h');
select is((select count(*) from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now()+interval '72 hours')),0::bigint,'exact expiry loses grant despite false cancellation flag');
select throws_ok($$select pg_temp.refresh_trial((select value from proof where name='snapshot'))$$,'P0001','STRIPE_REFRESH_STALE','stale lease cannot refresh');
update proof set value=public.begin_stripe_subscription_refresh_v1('sub_cardless') where name='lease';
select throws_ok($$select pg_temp.refresh_trial(jsonb_set(jsonb_set(jsonb_set((select value from proof where name='snapshot'),'{firstInvoiceId}','"in_no_consent"'),'{firstPaymentState}','"paid"'),'{firstPaidAt}',to_jsonb(now()+interval '73 hours')))$$,
 'P0001','TRIAL_RENEWAL_UNVERIFIED','a paid-looking snapshot cannot bypass missing renewal consent');
select throws_ok($$select public.commit_stripe_subscription_refresh_v2('sub_cardless',
 (select (value->>'fence')::bigint from proof where name='lease'),(select (value->>'token')::uuid from proof where name='lease'),
 'a1000000-0000-4000-8000-000000000001','cus_cardless_one','price_plus','plus','active',now()+interval '30 days',false,(select value from proof where name='snapshot'))$$,
 'P0001','TRIAL_REFRESH_V3_REQUIRED','old writer cannot bypass cardless consent');
select public.release_stripe_subscription_refresh_v1('sub_cardless',(select (value->>'fence')::bigint from proof where name='lease'),(select (value->>'token')::uuid from proof where name='lease'));
-- Quotes, setup and an unknown mutation do not establish renewal consent.
insert into proof values('terms','{"planCode":"plus","billingPeriod":"monthly","priceId":"price_plus","amount":799,"currency":"usd","termsRevision":"cardless_v1","quoteRevision":"offer_1"}');
insert into proof values('renewal',public.reserve_trial_renewal_v1('a1000000-0000-4000-8000-000000000001',
 'a3000000-0000-4000-8000-000000000001','sub_cardless','enable',(select value from proof where name='terms')));
create function pg_temp.move_renewal(expected text,next_state text,snapshot jsonb default '{}') returns jsonb language sql as $$
 select public.commit_trial_renewal_v1('a1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='renewal'),
 (select (value->>'generation')::bigint from proof where name='renewal'),expected,next_state,snapshot)$$;
select is((select count(*) from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now()+interval '72 hours')),0::bigint,'quote alone grants no grace');
select pg_temp.move_renewal('quoted','setup_pending');
select throws_ok($$select pg_temp.move_renewal('setup_pending','applying')$$,'P0001','TRIAL_SETUP_UNVERIFIED','application requires verified setup IDs and payment method');
select pg_temp.move_renewal('setup_pending','applying','{"setupSessionId":"cs_setup_cardless","setupIntentId":"seti_cardless","paymentMethodId":"pm_cardless"}');
select throws_ok($$select public.reserve_trial_renewal_v1('a1000000-0000-4000-8000-000000000001',gen_random_uuid(),'sub_cardless','cancel','{}')$$,
 'P0001','TRIAL_MUTATION_UNRESOLVED','cannot overtake unknown external mutation');
select is((select count(*) from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now()+interval '72 hours')),0::bigint,'applying alone is not consent proof');
insert into proof values('renewal-proof',jsonb_build_object('scheduleId','sub_sched_cardless','subscriptionId','sub_cardless','customerId','cus_cardless_one',
 'trialEndsAt',now()+interval '72 hours','endBehavior','release','priceId','price_plus','paymentMethodId','pm_cardless'));
select pg_temp.move_renewal('applying','applied',(select value from proof where name='renewal-proof'));
select is((select expires_at from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now()+interval '72 hours')),now()+interval '74 hours','confirmed renewal receives existing bounded waiting period');
select is((select count(*) from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now()+interval '74 hours')),0::bigint,'waiting cannot outlive original two-hour boundary');
select is(pg_temp.move_renewal('applying','applied',(select value from proof where name='renewal-proof'))->>'state','applied','duplicate commit is idempotent');
insert into proof values('cancel',public.reserve_trial_renewal_v1('a1000000-0000-4000-8000-000000000001',gen_random_uuid(),'sub_cardless','cancel','{}'));
select throws_ok($$select pg_temp.move_renewal('applying','applied',(select value from proof where name='renewal-proof'))$$,
 'P0001','TRIAL_RENEWAL_STALE','newer cancel fences old callback even with old key');
select public.commit_trial_renewal_v1('a1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='cancel'),
 (select (value->>'generation')::bigint from proof where name='cancel'),'applying','canceled',
 jsonb_set((select value from proof where name='renewal-proof'),'{endBehavior}','"cancel"'));
select is((select count(*) from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now()+interval '72 hours')),0::bigint,'confirmed cancel removes waiting grant');
-- A later quote can invalidate an unfinished setup but never rewind trial dates.
update proof set value=public.reserve_trial_renewal_v1('a1000000-0000-4000-8000-000000000001',gen_random_uuid(),'sub_cardless','enable',(select value from proof where name='terms')) where name='renewal';
select pg_temp.move_renewal('quoted','setup_pending');
select public.reserve_trial_renewal_v1('a1000000-0000-4000-8000-000000000001',gen_random_uuid(),'sub_cardless','cancel','{}');
select throws_ok($$select pg_temp.move_renewal('setup_pending','applying','{"setupSessionId":"cs_late","setupIntentId":"seti_late","paymentMethodId":"pm_late"}')$$,
 'P0001','TRIAL_RENEWAL_STALE','canceled setup cannot start a new Stripe mutation');
select throws_ok($$update public.subscription_trial_activations set state='failed'$$,'42501',null,'runtime cannot erase uncertain activation');
select throws_ok($$update public.account_subscription_trials set renewal_operation_id=null$$,'42501',null,'runtime cannot bypass consent RPC');
-- Finish cancellation, then a new explicit consent, before first-payment recovery.
update proof set value=(select to_jsonb(r) from public.subscription_trial_renewals r where user_id='a1000000-0000-4000-8000-000000000001' order by generation desc limit 1) where name='cancel';
select public.commit_trial_renewal_v1('a1000000-0000-4000-8000-000000000001',(select (value->>'id')::uuid from proof where name='cancel'),
 (select (value->>'generation')::bigint from proof where name='cancel'),'applying','canceled',jsonb_set((select value from proof where name='renewal-proof'),'{endBehavior}','"cancel"'));
update proof set value=public.reserve_trial_renewal_v1('a1000000-0000-4000-8000-000000000001',gen_random_uuid(),'sub_cardless','enable',(select value from proof where name='terms')) where name='renewal';
select pg_temp.move_renewal('quoted','setup_pending');
select pg_temp.move_renewal('setup_pending','applying','{"setupSessionId":"cs_setup_again","setupIntentId":"seti_again","paymentMethodId":"pm_cardless"}');
select pg_temp.move_renewal('applying','applied',(select value from proof where name='renewal-proof'));
update proof set value=jsonb_set(jsonb_set(jsonb_set(value,'{scheduleEndBehavior}','"release"'),'{firstInvoiceId}','"in_cardless_first"'),'{firstPaymentState}','"failed"') where name='snapshot';
update proof set value=public.begin_stripe_subscription_refresh_v1('sub_cardless') where name='lease';
select pg_temp.refresh_trial((select value from proof where name='snapshot'),'active',now()+interval '30 days');
select is((select count(*) from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now()+interval '73 hours')),0::bigint,'cardless payment decline ends bounded waiting');
update proof set value=jsonb_set(value,'{firstPaymentState}','"awaiting"') where name='snapshot';
update proof set value=public.begin_stripe_subscription_refresh_v1('sub_cardless') where name='lease';
select pg_temp.refresh_trial((select value from proof where name='snapshot'),'active',now()+interval '30 days');
select is((select first_payment_state from public.account_subscription_trials where stripe_subscription_id='sub_cardless'),'failed','later pending event cannot reopen grace');
update proof set value=jsonb_set(value,'{firstPaymentState}','"action_required"') where name='snapshot';
update proof set value=public.begin_stripe_subscription_refresh_v1('sub_cardless') where name='lease';
select pg_temp.refresh_trial((select value from proof where name='snapshot'),'active',now()+interval '30 days');
select is((select count(*) from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now()+interval '73 hours')),0::bigint,'cardless 3DS required does not grant grace');
update proof set value=jsonb_set(jsonb_set(value,'{firstPaymentState}','"paid"'),'{firstPaidAt}',to_jsonb(now()+interval '75 hours')) where name='snapshot';
update proof set value=public.begin_stripe_subscription_refresh_v1('sub_cardless') where name='lease';
select pg_temp.refresh_trial((select value from proof where name='snapshot'),'active',now()+interval '30 days');
select is((select expires_at from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000001',now()+interval '75 hours')),now()+interval '30 days','paid recovery grants ordinary service period');
update proof set value=jsonb_set(jsonb_set(value,'{firstPaymentState}','"failed"'),'{firstPaidAt}','null') where name='snapshot';
update proof set value=public.begin_stripe_subscription_refresh_v1('sub_cardless') where name='lease';
select pg_temp.refresh_trial((select value from proof where name='snapshot'),'active',now()+interval '30 days');
select is((select first_payment_state from public.account_subscription_trials where stripe_subscription_id='sub_cardless'),'paid','stale failure cannot erase first payment');
-- An ordinary later subscription uses the legacy path even when this account has a cardless ledger.
update proof set value=public.begin_stripe_subscription_refresh_v1('sub_cardless_later_paid') where name='lease';
select is(public.commit_stripe_subscription_refresh_v3('sub_cardless_later_paid',(select (value->>'fence')::bigint from proof where name='lease'),
 (select (value->>'token')::uuid from proof where name='lease'),'a1000000-0000-4000-8000-000000000001','cus_cardless_one','price_plus','plus','active',now()+interval '30 days',false,null)->>'planCode','plus','later paid checkout is not mistaken for a second trial');
-- The other ordering: an old Checkout already reserved must block a new activation.
select public.reserve_subscription_checkout_v1('a1000000-0000-4000-8000-000000000002','plus','price_plus','https://anidachi.test',gen_random_uuid(),'{}');
select throws_ok($$select public.reserve_cardless_trial_v1('a1000000-0000-4000-8000-000000000002',gen_random_uuid(),'plus','monthly','price_plus','cus_cardless_two',2)$$,
 'P0001','TRIAL_CHECKOUT_UNRESOLVED','old Checkout cannot be overtaken even when new starts disabled');
reset role;
-- Legacy rows/defaults and manual rights retain their behavior.
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end)
values('a1000000-0000-4000-8000-000000000003','cus_legacy','sub_cardless_legacy','price_plus','plus','trialing',now()+interval '72 hours');
insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at)
values('a1000000-0000-4000-8000-000000000003','sub_cardless_legacy',now(),now()+interval '72 hours');
select is((select trial_mode from public.account_subscription_trials where stripe_subscription_id='sub_cardless_legacy'),'card_required','old inserts stay card-required');
select is((select expires_at from public.subscription_access_grants_v1('a1000000-0000-4000-8000-000000000003',now()+interval '72 hours')),now()+interval '74 hours','legacy payment waiting unchanged');
insert into public.account_manual_plan_grants(user_id,plan_code,reason) values('a1000000-0000-4000-8000-000000000002','pro','cardless proof');
select is(public.resolve_watch_history_access_v1('a1000000-0000-4000-8000-000000000002')->>'planCode','pro','manual rights unchanged');
select throws_ok($$update public.account_subscription_trials set trial_mode='card_required' where stripe_subscription_id='sub_cardless'$$,
 'P0001','TRIAL_IDENTITY_IMMUTABLE','mode cannot be rewritten as a legacy trial');
select ok((select relrowsecurity from pg_class where oid='public.subscription_trial_activations'::regclass),'activation RLS on');
select ok((select relrowsecurity from pg_class where oid='public.subscription_trial_renewals'::regclass),'renewal RLS on');
select ok(not has_table_privilege('authenticated','public.subscription_trial_renewals','select'),'browser cannot read other consent records');
select ok(not has_function_privilege('anon','public.reserve_cardless_trial_v1(uuid,uuid,text,text,text,text,bigint)','execute'),'anonymous cannot reserve trial');
select ok(not has_function_privilege('authenticated','public.reserve_trial_renewal_v1(uuid,uuid,text,text,jsonb)','execute'),'browser cannot forge price and consent');
select * from finish();
rollback;
