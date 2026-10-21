begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

insert into public.users(id,email,display_name) values
 ('f0111111-1111-4111-8111-111111111111','access-noop@example.test','Access Noop');
update public.hosting_commercial_policy set activation_at=clock_timestamp()-interval '1 day',trials_enabled=true;
create temporary table results(name text primary key, value jsonb);
create temporary table settings_snapshots(name text primary key, tuple_id text, value jsonb);

insert into results values('free',public.resolve_watch_history_access_v1('f0111111-1111-4111-8111-111111111111'));
insert into settings_snapshots select 'free',ctid::text,to_jsonb(s) from public.user_watch_settings s where user_id='f0111111-1111-4111-8111-111111111111';
insert into results values('free_again',public.resolve_watch_history_access_v1('f0111111-1111-4111-8111-111111111111'));
select is((select ctid::text from public.user_watch_settings where user_id='f0111111-1111-4111-8111-111111111111'),(select tuple_id from settings_snapshots where name='free'),'unchanged Free resolution does not write a new tuple');
select is((select to_jsonb(s) from public.user_watch_settings s where user_id='f0111111-1111-4111-8111-111111111111'),(select value from settings_snapshots where name='free'),'Free settings are unchanged');
select is((select value#>>'{hosting,trialEligibility}' from results where name='free_again'),'eligible','Free eligibility remains server resolved');

insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end,cancel_at_period_end) values
 ('f0111111-1111-4111-8111-111111111111','cus_noop','sub_noop_plus','price_plus','plus','active',transaction_timestamp()+interval '2 days',false),
 ('f0111111-1111-4111-8111-111111111111','cus_noop','sub_noop_pro','price_pro','pro','active',transaction_timestamp()+interval '1 day',false);
insert into results values('paid',public.resolve_watch_history_access_v1('f0111111-1111-4111-8111-111111111111'));
insert into settings_snapshots select 'paid',ctid::text,to_jsonb(s) from public.user_watch_settings s where user_id='f0111111-1111-4111-8111-111111111111';
insert into results values('paid_again',public.resolve_watch_history_access_v1('f0111111-1111-4111-8111-111111111111'));
select is((select ctid::text from public.user_watch_settings where user_id='f0111111-1111-4111-8111-111111111111'),(select tuple_id from settings_snapshots where name='paid'),'unchanged paid resolution does not write a new tuple');
select is((select value->>'planCode' from results where name='paid_again'),'pro','highest plan still wins');
select is((select (value->>'paidUntil')::timestamptz from results where name='paid_again'),transaction_timestamp()+interval '2 days','history retains longer Plus expiry');
select is((select (value->>'selectedPlanExpiresAt')::timestamptz from results where name='paid_again'),transaction_timestamp()+interval '1 day','selected plan retains shorter Pro expiry');
select is((select value#>>'{history,accessEpoch}' from results where name='paid_again'),'1','repeated paid reads preserve epoch');
select ok((select (value#>>'{history,validUntil}')::timestamptz=(value#>>'{history,serverTime}')::timestamptz+interval '5 minutes' from results where name='paid_again'),'access lease remains five minutes');

-- A known elapsed boundary must still fence old events even if a renewal is
-- already present when the next resolution runs.
update public.user_watch_settings set history_access_expires_at=clock_timestamp()-interval '1 second' where user_id='f0111111-1111-4111-8111-111111111111';
insert into results values('renewed',public.resolve_watch_history_access_v1('f0111111-1111-4111-8111-111111111111'));
select is((select value#>>'{history,accessEpoch}' from results where name='renewed'),'3','elapsed paid boundary and regain both advance the epoch');
select ok((select (value#>>'{history,captureNotBefore}')::timestamptz from results where name='renewed')>(select (value#>>'{history,captureNotBefore}')::timestamptz from results where name='paid'),'renewal gap moves the capture fence');

insert into public.account_manual_plan_grants(user_id,plan_code,reason) values ('f0111111-1111-4111-8111-111111111111','plus','local no-op test');
insert into results values('infinite_plus',public.resolve_watch_history_access_v1('f0111111-1111-4111-8111-111111111111'));
select is((select value->>'paidUntil' from results where name='infinite_plus'),null::text,'unlimited Plus makes history expiry null');
select is((select (value->>'selectedPlanExpiresAt')::timestamptz from results where name='infinite_plus'),transaction_timestamp()+interval '1 day','unlimited lower plan does not extend Pro');
update public.account_manual_plan_grants set plan_code='pro' where user_id='f0111111-1111-4111-8111-111111111111';
insert into results values('infinite_pro',public.resolve_watch_history_access_v1('f0111111-1111-4111-8111-111111111111'));
select is((select value->>'selectedPlanExpiresAt' from results where name='infinite_pro'),null::text,'unlimited Pro keeps selected expiry null');
insert into settings_snapshots select 'infinite',ctid::text,to_jsonb(s) from public.user_watch_settings s where user_id='f0111111-1111-4111-8111-111111111111';
insert into results values('infinite_again',public.resolve_watch_history_access_v1('f0111111-1111-4111-8111-111111111111'));
select is((select ctid::text from public.user_watch_settings where user_id='f0111111-1111-4111-8111-111111111111'),(select tuple_id from settings_snapshots where name='infinite'),'unchanged unlimited access does not write a tuple');

delete from public.account_manual_plan_grants where user_id='f0111111-1111-4111-8111-111111111111';
update public.subscriptions set status='canceled' where user_id='f0111111-1111-4111-8111-111111111111';
insert into results values('lost',public.resolve_watch_history_access_v1('f0111111-1111-4111-8111-111111111111'));
select is((select value#>>'{history,state}' from results where name='lost'),'plan_required','lost access still revokes recording');
select is((select value#>>'{history,accessEpoch}' from results where name='lost'),'4','lost access advances epoch');
select is((select value->>'paidUntil' from results where name='lost'),null::text,'no grants means no paid expiry');
select is((select value->>'selectedPlanExpiresAt' from results where name='lost'),null::text,'no grants means no selected expiry');
select is((select plan from public.users where id='f0111111-1111-4111-8111-111111111111'),'free','user plan mirror stays synchronized');
select throws_ok($$select public.resolve_watch_history_access_v1('f0999999-9999-4999-8999-999999999999')$$,'P0001','HISTORY_ACCESS_UNAVAILABLE','missing owner is not an implicit Free account');
select ok(not has_function_privilege('anon','public.resolve_watch_history_access_v1(uuid)','execute'),'anonymous resolution remains denied');
select ok(not has_function_privilege('authenticated','public.resolve_watch_history_access_v1(uuid)','execute'),'browser resolution remains denied');
select ok(has_function_privilege('service_role','public.resolve_watch_history_access_v1(uuid)','execute'),'server resolution remains allowed');
select * from finish();
rollback;
