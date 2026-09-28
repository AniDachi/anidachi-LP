begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select has_table('public','hosting_commercial_policy','durable policy exists');
select has_table('public','account_subscription_trials','one-account trial ledger exists');
insert into public.users(id,email,display_name,created_at) values
 ('d1111111-1111-4111-8111-111111111111','trial-old@example.test','Old Free','2026-09-01T00:00:00Z'),
 ('d2222222-2222-4222-8222-222222222222','trial-new@example.test','New Free','2026-09-27T00:00:00Z'),
 ('d3333333-3333-4333-8333-333333333333','trial-paid@example.test','Paid','2026-09-01T00:00:00Z');
select is(public.resolve_watch_history_access_v1('d1111111-1111-4111-8111-111111111111')#>>'{hosting,canHost}','true','inactive policy preserves Free hosting');
select is(public.resolve_watch_history_access_v1('d2222222-2222-4222-8222-222222222222')#>>'{hosting,trialEligibility}','unavailable','inactive policy never offers trial');

update public.hosting_commercial_policy set activation_at='2026-09-27T00:00:00Z',trials_enabled=true;
set local role service_role;
select is(public.resolve_watch_history_access_v1('d1111111-1111-4111-8111-111111111111')#>>'{hosting,canHost}','false','Free hosting denied at cutover under runtime role');
select is(public.resolve_watch_history_access_v1('d1111111-1111-4111-8111-111111111111')#>>'{hosting,trialEligibility}','eligible','existing Free has the same unused trial as new Free');
select is(public.resolve_watch_history_access_v1('d2222222-2222-4222-8222-222222222222')#>>'{hosting,trialEligibility}','eligible','registration equal to T is eligible');
reset role;
insert into public.account_manual_plan_grants(user_id,plan_code,reason) values ('d3333333-3333-4333-8333-333333333333','pro','local test');
select is(public.resolve_watch_history_access_v1('d3333333-3333-4333-8333-333333333333')#>>'{hosting,canHost}','true','manual grant retains hosting');
select is(public.resolve_watch_history_access_v1('d3333333-3333-4333-8333-333333333333')#>>'{history,state}','allowed','manual grant retains personal history');

insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end,cancel_at_period_end)
values ('d2222222-2222-4222-8222-222222222222','cus_trial_test','sub_trial_test','price_trial_test','plus','trialing',clock_timestamp()+interval '3 days',false);
insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at)
values ('d2222222-2222-4222-8222-222222222222','sub_trial_test','2026-09-24T12:00:00Z','2026-09-27T12:00:00Z');
select is(public.resolve_watch_history_access_v1('d2222222-2222-4222-8222-222222222222')#>>'{hosting,trialEligibility}','used','trial belongs to account across plans');
select is((select expires_at::text from public.subscription_access_grants_v1('d2222222-2222-4222-8222-222222222222','2026-09-27T11:59:59Z')),'2026-09-27 14:00:00+00','renewing trial authority has original bounded pending expiry');
select is((select plan_code from public.subscription_access_grants_v1('d2222222-2222-4222-8222-222222222222','2026-09-27T12:00:00Z')),'plus','pending first payment retains chosen rights');
select is((select count(*) from public.subscription_access_grants_v1('d2222222-2222-4222-8222-222222222222','2026-09-27T14:00:00Z')),0::bigint,'two-hour boundary expires without webhook');
update public.subscriptions set status='active',current_period_end='2026-10-27T12:00:00Z' where stripe_subscription_id='sub_trial_test';
select is((select count(*) from public.subscription_access_grants_v1('d2222222-2222-4222-8222-222222222222','2026-09-27T14:00:00Z')),0::bigint,'active alone cannot grant first unpaid month');
update public.subscriptions set cancel_at_period_end=true where stripe_subscription_id='sub_trial_test';
select is((select count(*) from public.subscription_access_grants_v1('d2222222-2222-4222-8222-222222222222','2026-09-27T12:00:00Z')),0::bigint,'canceling trial never receives payment grace');
select is((select plan_code from public.subscription_access_grants_v1('d2222222-2222-4222-8222-222222222222','2026-09-27T11:59:59Z')),'plus','cancellation keeps trial through original end');
update public.subscriptions set cancel_at_period_end=false where stripe_subscription_id='sub_trial_test';
update public.account_subscription_trials set first_payment_state='failed' where stripe_subscription_id='sub_trial_test';
select is((select count(*) from public.subscription_access_grants_v1('d2222222-2222-4222-8222-222222222222','2026-09-27T12:30:00Z')),0::bigint,'confirmed failure ends waiting early');
update public.account_subscription_trials set first_payment_state='action_required' where stripe_subscription_id='sub_trial_test';
select is((select count(*) from public.subscription_access_grants_v1('d2222222-2222-4222-8222-222222222222','2026-09-27T12:30:00Z')),0::bigint,'3DS required ends waiting early');
update public.account_subscription_trials set first_payment_state='paid',first_invoice_id='in_first_paid',first_paid_at='2026-09-27T15:00:00Z' where stripe_subscription_id='sub_trial_test';
select is((select plan_code from public.subscription_access_grants_v1('d2222222-2222-4222-8222-222222222222','2026-09-27T15:00:00Z')),'plus','late paid invoice restores regular access');
select is(public.resolve_watch_history_access_v1('d2222222-2222-4222-8222-222222222222')#>>'{hosting,trialEligibility}','used','late recovery does not restore trial eligibility');
select throws_ok($$update public.account_subscription_trials set trial_ends_at=trial_ends_at+interval '3 days',trial_started_at=trial_started_at+interval '3 days'$$,'P0001','TRIAL_IDENTITY_IMMUTABLE','retries and plan changes cannot move original trial');
select throws_ok($$update public.account_subscription_trials set first_payment_state='awaiting',first_paid_at=null$$,'P0001','TRIAL_PAYMENT_ALREADY_CONFIRMED','late old events cannot erase a confirmed first payment');
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end,cancel_at_period_end)
values ('d2222222-2222-4222-8222-222222222222','cus_trial_test','sub_trial_second','price_trial_test','pro','trialing',clock_timestamp()+interval '3 days',false);
select throws_ok($$insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at)
 values ('d2222222-2222-4222-8222-222222222222','sub_trial_second','2026-09-24T12:00:00Z','2026-09-27T12:00:00Z')$$,'23505',null,'second plan cannot create another account trial');
select throws_ok($$insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at)
 values ('d1111111-1111-4111-8111-111111111111','sub_trial_second','2026-09-24T12:00:00Z','2026-09-27T12:00:00Z')$$,'23503',null,'trial subscription must belong to the same account');

-- Expiry and later payment must actually fence capture, even without an intervening webhook.
insert into public.users(id,email,display_name) values ('d4444444-4444-4444-8444-444444444444','trial-epochs@example.test','Trial Epochs');
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end,cancel_at_period_end)
values ('d4444444-4444-4444-8444-444444444444','cus_trial_epochs','sub_trial_epochs','price_trial_test','plus','active',clock_timestamp()+interval '30 days',false);
select public.resolve_watch_history_access_v1('d4444444-4444-4444-8444-444444444444')#>>'{history,state}';
insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at)
values ('d4444444-4444-4444-8444-444444444444','sub_trial_epochs',statement_timestamp()-interval '76 hours',statement_timestamp()-interval '4 hours');
create temporary table expired_access as select public.resolve_watch_history_access_v1('d4444444-4444-4444-8444-444444444444') as value;
select is((select value#>>'{history,state}' from expired_access),'plan_required','expired trial stops history before monthly mirror end');
update public.account_subscription_trials set first_payment_state='paid',first_invoice_id='in_epochs_paid',first_paid_at=clock_timestamp() where stripe_subscription_id='sub_trial_epochs';
select ok((public.resolve_watch_history_access_v1('d4444444-4444-4444-8444-444444444444')#>>'{history,accessEpoch}')::bigint>(select (value#>>'{history,accessEpoch}')::bigint from expired_access),'late recovery fences stale Free-period history');
select is(public.resolve_watch_history_access_v1('d4444444-4444-4444-8444-444444444444')#>>'{history,state}','allowed','paid recovery restores personal recording');

select ok(not has_table_privilege('anon','public.hosting_commercial_policy','select'),'anon cannot read policy table');
select ok(not has_table_privilege('authenticated','public.account_subscription_trials','insert'),'browser cannot mint trials');
select ok(not has_table_privilege('service_role','public.account_subscription_trials','delete'),'runtime cannot erase used trial');
select ok(not has_table_privilege('service_role','public.hosting_commercial_policy','update'),'runtime cannot activate policy accidentally');
select ok(has_table_privilege('service_role','public.hosting_commercial_policy','select'),'runtime can read policy');
select ok((select relrowsecurity from pg_class where oid='public.hosting_commercial_policy'::regclass),'policy RLS enabled');
select ok((select relrowsecurity from pg_class where oid='public.account_subscription_trials'::regclass),'trial ledger RLS enabled');
select ok(not has_function_privilege('anon','public.subscription_access_grants_v1(uuid,timestamptz)','execute'),'anon cannot read arbitrary account rights');
delete from public.hosting_commercial_policy;
select throws_ok($$select public.resolve_watch_history_access_v1('d1111111-1111-4111-8111-111111111111')$$,'P0001','HISTORY_ACCESS_UNAVAILABLE','missing policy fails closed instead of granting Free hosting');
select * from finish();
rollback;
