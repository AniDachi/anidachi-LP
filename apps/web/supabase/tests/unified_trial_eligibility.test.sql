begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name,created_at) values
 ('e1111111-1111-4111-8111-111111111111','unified-old@example.test','Old Free','2026-09-01T00:00:00Z'),
 ('e2222222-2222-4222-8222-222222222222','unified-boundary@example.test','Boundary Free','2026-09-27T00:00:00Z'),
 ('e3333333-3333-4333-8333-333333333333','unified-new@example.test','New Free','2026-09-27T12:00:00Z');
create temporary table trial_accounts as select id from public.users where email like 'unified-%@example.test';
grant select on trial_accounts to service_role;
update public.hosting_commercial_policy set activation_at=null,trials_enabled=false;
set local role service_role;
select is(public.resolve_watch_history_access_v1(id)#>>'{hosting,trialEligibility}','unavailable','dormant policy offers no trial: '||id) from trial_accounts;
reset role;
update public.hosting_commercial_policy set activation_at=clock_timestamp()+interval '1 day',trials_enabled=true;
set local role service_role;
select is(public.resolve_watch_history_access_v1(id)#>>'{hosting,trialEligibility}','unavailable','future activation offers no trial: '||id) from trial_accounts;
reset role;
update public.hosting_commercial_policy set activation_at='2026-09-27T00:00:00Z',trials_enabled=true;
set local role service_role;
select is(public.resolve_watch_history_access_v1(id)#>>'{hosting,trialEligibility}','eligible','unused Free trial ignores registration date: '||id) from trial_accounts;
select is(public.resolve_watch_history_access_v1(id)#>>'{hosting,canHost}','false','an offer alone never grants hosting: '||id) from trial_accounts;
select is(public.resolve_watch_history_access_v1(id)#>>'{history,state}','plan_required','an offer alone never grants recording: '||id) from trial_accounts;
reset role;
update public.hosting_commercial_policy set trials_enabled=false;
set local role service_role;
select is(public.resolve_watch_history_access_v1(id)#>>'{hosting,trialEligibility}','unavailable','disabled trials apply to all account ages: '||id) from trial_accounts;
reset role;
update public.hosting_commercial_policy set trials_enabled=true;
insert into public.account_manual_plan_grants(user_id,plan_code,reason) values ('e2222222-2222-4222-8222-222222222222','pro','local unified trial test');
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end,cancel_at_period_end) values
 ('e1111111-1111-4111-8111-111111111111','cus_unified_old','sub_unified_old','price_plus','plus','active',clock_timestamp()+interval '30 days',false);
set local role service_role;
select is(public.resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111')#>>'{hosting,trialEligibility}','unavailable','active paid account is not offered a parallel trial');
select is(public.resolve_watch_history_access_v1('e2222222-2222-4222-8222-222222222222')#>>'{hosting,trialEligibility}','unavailable','manual paid access is not offered a parallel trial');
reset role;
update public.subscriptions set status='canceled' where stripe_subscription_id='sub_unified_old';
set local role service_role;
select is(public.resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111')#>>'{hosting,trialEligibility}','eligible','returning Free account without a used trial remains eligible');
reset role;
insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at) values
 ('e1111111-1111-4111-8111-111111111111','sub_unified_old',statement_timestamp()-interval '4 days',statement_timestamp()-interval '1 day');
set local role service_role;
select is(public.resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111')#>>'{hosting,trialEligibility}','used','old Free account cannot repeat a consumed trial');
select is(public.reserve_subscription_checkout_v1('e1111111-1111-4111-8111-111111111111','pro','price_pro','https://anidachi.test','e4444444-4444-4444-8444-444444444444','{}')->>'trial_offered','false','switching to Pro after a used Plus trial requires payment');
select throws_ok($$select public.resolve_watch_history_access_v1('e9999999-9999-4999-8999-999999999999')$$,'P0001','HISTORY_ACCESS_UNAVAILABLE','unknown account never receives trial eligibility');
reset role;
select ok(not has_function_privilege('anon','public.resolve_watch_history_access_v1(uuid)','execute'),'anonymous clients cannot resolve arbitrary accounts');
select ok(not has_function_privilege('authenticated','public.resolve_watch_history_access_v1(uuid)','execute'),'browser clients cannot resolve arbitrary accounts');
select ok(has_function_privilege('service_role','public.resolve_watch_history_access_v1(uuid)','execute'),'server resolver remains executable by service role');
select * from finish();
rollback;
