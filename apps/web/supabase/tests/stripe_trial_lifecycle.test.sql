begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_function('public','commit_stripe_subscription_refresh_v2',
 array['text','bigint','uuid','uuid','text','text','text','text','timestamp with time zone','boolean','jsonb'],
 'atomic Stripe trial commit exists');
insert into public.users(id,email,display_name,created_at)
 values('e1111111-1111-4111-8111-111111111111','trial-sync@example.test','Trial sync',now()-interval '4 days');
update public.hosting_commercial_policy set activation_at=now()-interval '5 days',trials_enabled=true;
create temporary table trial_sync(name text primary key,value jsonb);
grant all on trial_sync to service_role;
set local role service_role;
insert into trial_sync values('reservation',public.reserve_subscription_checkout_v1(
 'e1111111-1111-4111-8111-111111111111','plus','price_trial','https://anidachi.test','e2222222-2222-4222-8222-222222222222','{}'));
reset role;
-- Simulate a checkout issued four days ago, then a delayed first webhook.
update public.subscription_checkout_reservations set created_at=now()-interval '4 days';
insert into trial_sync values('snapshot',jsonb_build_object(
 'checkoutReservationId',(select value->>'id' from trial_sync where name='reservation'),
 'trialStartedAt',now()-interval '73 hours','trialEndsAt',now()-interval '1 hour',
 'firstInvoiceId',null,'firstPaymentState','awaiting','firstPaidAt',null));
set local role service_role;
insert into trial_sync values('lease',public.begin_stripe_subscription_refresh_v1('sub_trial_sync'));
insert into trial_sync values('first',public.commit_stripe_subscription_refresh_v2(
 'sub_trial_sync',(select (value->>'fence')::bigint from trial_sync where name='lease'),
 (select (value->>'token')::uuid from trial_sync where name='lease'),
 'e1111111-1111-4111-8111-111111111111','cus_trial_sync','price_trial','plus','active',now()+interval '30 days',false,
 (select value from trial_sync where name='snapshot')));
select is((select count(*) from public.account_subscription_trials where stripe_subscription_id='sub_trial_sync'),1::bigint,'verified subscription consumes account trial atomically');
select is((select value->>'planCode' from trial_sync where name='first'),'plus','first pending invoice retains bounded rights');
select is((select (value->>'paidUntil')::timestamptz from trial_sync where name='first'),now()+interval '1 hour','active mirror cannot grant an unpaid month');
select throws_ok($$select public.commit_stripe_subscription_refresh_v2(
 'sub_trial_sync',(select (value->>'fence')::bigint from trial_sync where name='lease'),
 (select (value->>'token')::uuid from trial_sync where name='lease'),
 'e1111111-1111-4111-8111-111111111111','cus_trial_sync','price_trial','plus','active',now()+interval '30 days',false,
 (select value from trial_sync where name='snapshot'))$$,'P0001','STRIPE_REFRESH_STALE','stale replay cannot update the ledger');
update trial_sync set value=public.begin_stripe_subscription_refresh_v1('sub_trial_sync') where name='lease';
update trial_sync set value=jsonb_set(jsonb_set(value,'{firstInvoiceId}','"in_trial_first"'),'{firstPaymentState}','"failed"') where name='snapshot';
select is(public.commit_stripe_subscription_refresh_v2(
 'sub_trial_sync',(select (value->>'fence')::bigint from trial_sync where name='lease'),
 (select (value->>'token')::uuid from trial_sync where name='lease'),
 'e1111111-1111-4111-8111-111111111111','cus_trial_sync','price_trial','plus','active',now()+interval '30 days',false,
 (select value from trial_sync where name='snapshot'))->>'planCode','free','first payment failure ends access immediately');
update trial_sync set value=public.begin_stripe_subscription_refresh_v1('sub_trial_sync') where name='lease';
update trial_sync set value=jsonb_set(value,'{firstPaymentState}','"awaiting"') where name='snapshot';
select is(public.commit_stripe_subscription_refresh_v2(
 'sub_trial_sync',(select (value->>'fence')::bigint from trial_sync where name='lease'),
 (select (value->>'token')::uuid from trial_sync where name='lease'),
 'e1111111-1111-4111-8111-111111111111','cus_trial_sync','price_trial','plus','active',now()+interval '30 days',false,
 (select value from trial_sync where name='snapshot'))->>'planCode','free','retry cannot re-open pending grace after failure');
update trial_sync set value=public.begin_stripe_subscription_refresh_v1('sub_trial_sync') where name='lease';
update trial_sync set value=jsonb_set(jsonb_set(value,'{firstPaymentState}','"paid"'),'{firstPaidAt}',to_jsonb(now())) where name='snapshot';
select is(public.commit_stripe_subscription_refresh_v2(
 'sub_trial_sync',(select (value->>'fence')::bigint from trial_sync where name='lease'),
 (select (value->>'token')::uuid from trial_sync where name='lease'),
 'e1111111-1111-4111-8111-111111111111','cus_trial_sync','price_trial','plus','active',now()+interval '30 days',false,
 (select value from trial_sync where name='snapshot'))->>'planCode','plus','fresh successful payment restores ordinary access');
select is(public.resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111')#>>'{hosting,trialEligibility}','used','recovery never resets eligibility');
update trial_sync set value=public.begin_stripe_subscription_refresh_v1('sub_trial_sync') where name='lease';
update trial_sync set value=jsonb_set(jsonb_set(value,'{firstPaymentState}','"failed"'),'{firstPaidAt}','null') where name='snapshot';
select is(public.commit_stripe_subscription_refresh_v2(
 'sub_trial_sync',(select (value->>'fence')::bigint from trial_sync where name='lease'),
 (select (value->>'token')::uuid from trial_sync where name='lease'),
 'e1111111-1111-4111-8111-111111111111','cus_trial_sync','price_trial','plus','active',now()+interval '30 days',false,
 (select value from trial_sync where name='snapshot'))->>'planCode','plus','stale payment failure never erases confirmed conversion');
select throws_ok($$update public.account_subscription_trials set first_payment_state='awaiting'$$,'42501',null,'runtime cannot bypass fenced trial writes');
reset role;
insert into public.users(id,email,display_name) values('e3333333-3333-4333-8333-333333333333','trial-unreserved@example.test','Unreserved');
set local role service_role;
update trial_sync set value=public.begin_stripe_subscription_refresh_v1('sub_unreserved') where name='lease';
select throws_ok($$select public.commit_stripe_subscription_refresh_v2(
 'sub_unreserved',(select (value->>'fence')::bigint from trial_sync where name='lease'),
 (select (value->>'token')::uuid from trial_sync where name='lease'),
 'e3333333-3333-4333-8333-333333333333','cus_unreserved','price_trial','plus','active',now()+interval '30 days',false,
 (select value from trial_sync where name='snapshot'))$$,'P0001','TRIAL_RESERVATION_INVALID','unreserved trial cannot grant subscription rights');
select is((select count(*) from public.subscriptions where stripe_subscription_id='sub_unreserved'),0::bigint,'rejected ledger transaction rolls back the subscription mirror');
select is((select plan from public.users where id='e3333333-3333-4333-8333-333333333333'),'free','rejected ledger cannot leak intermediate paid account state');
reset role;
select ok(not has_function_privilege('authenticated','public.commit_stripe_subscription_refresh_v2(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean,jsonb)','execute'),'browser cannot commit Stripe trial state');
select * from finish();
rollback;
