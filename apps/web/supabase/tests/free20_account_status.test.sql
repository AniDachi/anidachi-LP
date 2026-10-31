-- Synthetic, transaction-rollback fixtures only. No Stripe or real accounts.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_function('public','read_free20_account_status_v1',array['uuid'],'versioned account status reader exists');
insert into public.users(id,email,display_name)
 select ('f6250000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'status-'||n||'@example.test','Status fixture' from generate_series(1,5) n;
create temporary table status_results(name text primary key,value jsonb);
grant all on status_results to service_role;
create function pg_temp.status_for(n integer) returns jsonb language sql as $$
 select public.read_free20_account_status_v1(('f6250000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid);
$$;
set local role service_role;
select is(pg_temp.status_for(1),'{"enabled":false}'::jsonb,'dormant database gate returns no account data');
select ok(not has_function_privilege('anon','public.read_free20_account_status_v1(uuid)','EXECUTE'),'anonymous callers cannot read status authority');
select ok(not has_function_privilege('authenticated','public.read_free20_account_status_v1(uuid)','EXECUTE'),'browser role cannot read status authority');
select ok(not has_function_privilege('authenticated','public.subscription_access_details_v1(uuid,timestamptz)','EXECUTE'),'grant details are service-only');
select ok(not has_table_privilege('service_role','public.hosting_commercial_policy','UPDATE'),'status runtime cannot enable policy');
reset role;
update public.personal_history_policy set active=true;
update public.hosting_commercial_policy set activation_at=clock_timestamp()-interval '1 minute',free20_enabled=true;
insert into public.usage_daily(user_id,day,host_seconds) values
 ('f6250000-0000-4000-8000-000000000001',(now() at time zone 'UTC')::date,420),
 ('f6250000-0000-4000-8000-000000000005',(now() at time zone 'UTC')::date,1300);
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end,cancel_at_period_end) values
 ('f6250000-0000-4000-8000-000000000002','cus_status_paid','sub_status_paid','price_status','plus','active',now()+interval '1 day',true),
 ('f6250000-0000-4000-8000-000000000003','cus_status_trial','sub_status_trial','price_status','pro','trialing',now()+interval '71 hours',false);
insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at) values
 ('f6250000-0000-4000-8000-000000000003','sub_status_trial',now()-interval '1 hour',now()+interval '71 hours');
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values
 ('f6250000-0000-4000-8000-000000000004','plus',null,'status test');
set local role service_role;
insert into status_results values ('free',pg_temp.status_for(1)),('paid',pg_temp.status_for(2)),('trial',pg_temp.status_for(3)),('manual',pg_temp.status_for(4)),('zero',pg_temp.status_for(5));
select is((select value->>'committedSeconds' from status_results where name='free'),'420','reader preserves committed seconds rather than fabricating live usage');
select is((select value->>'planCode' from status_results where name='free'),'free','Free remains the effective plan');
select is((select value->'grant' from status_results where name='free'),'null'::jsonb,'Free has no invented grant');
select is((select value->>'committedSeconds' from status_results where name='zero'),'1300','raw overshoot retained for the display clamp');
select is((select value#>>'{grant,source}' from status_results where name='paid'),'paid','canceled-at-period-end paid access remains paid until its boundary');
select is((select value#>>'{grant,source}' from status_results where name='trial'),'trial','old trial source comes from its grant, not the Pro name');
select is((select value#>>'{grant,source}' from status_results where name='manual'),'manual','manual access is explicit');
select is((select value#>'{grant,validUntil}' from status_results where name='manual'),'null'::jsonb,'only indefinite manual authority has a null grant boundary');
select ok((select (value->>'refreshBy')::timestamptz<=(value->>'serverTime')::timestamptz+interval '5 minutes' from status_results where name='manual'),'indefinite manual source still has a bounded read');
select is((select (value->>'resetAt')::timestamptz from status_results where name='free'),(((now() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC'),'reset is UTC midnight');
select is((select value->'assignment' from status_results where name='free'),'null'::jsonb,'idle account has no active assignment');
select throws_ok($$select public.read_free20_account_status_v1('f6250000-0000-4000-8000-000000000099')$$,'P0001','HISTORY_ACCESS_UNAVAILABLE','missing account never becomes Free20');
insert into status_results select 'created',room_record from public.create_room_with_active_session_v3(
 'f6250000-0000-4000-8000-000000000001','status-host',null,null,null,null,null,null,null,'status-request','free',4,4,false,false,3);
insert into status_results values('hosting',pg_temp.status_for(1));
select is((select value#>>'{assignment,roomId}' from status_results where name='hosting'),(select value->>'room_id' from status_results where name='created'),'reader identifies the assigned room to read its live time');
select is((select value#>>'{assignment,role}' from status_results where name='hosting'),'host','host assignment is explicit');
select is((select value#>>'{assignment,hostingTimeMode}' from status_results where name='hosting'),'daily_free20','only marked rooms can supply live Free20');
select is((select value->>'committedSeconds' from status_results where name='hosting'),'420','status reads never consume or reserve seconds');
reset role;
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values
 ('f6250000-0000-4000-8000-000000000002','pro',now()+interval '30 minutes','overlap');
set local role service_role;
insert into status_results values('overlap',pg_temp.status_for(2));
select is((select value->>'planCode' from status_results where name='overlap'),'pro','highest current plan still wins');
select is((select value#>>'{grant,source}' from status_results where name='overlap'),'manual','lower paid grant cannot mislabel selected manual Pro');
select is((select (value#>>'{grant,validUntil}')::timestamptz from status_results where name='overlap'),now()+interval '30 minutes','longer lower-plan right does not extend selected Pro');
select is((select count(*) from public.subscription_access_grants_v1('f6250000-0000-4000-8000-000000000003',now()+interval '73 hours')),0::bigint,'legacy trial grace expires at the same boundary');
select is((select expires_at from public.subscription_access_grants_v1('f6250000-0000-4000-8000-000000000003',now())),now()+interval '73 hours','legacy trial expiry logic is unchanged');
select is((select grant_source from public.subscription_access_details_v1('f6250000-0000-4000-8000-000000000003',now()+interval '72 hours')),'trial','unpaid conversion grace never claims confirmed payment');
reset role;
update public.account_subscription_trials set first_payment_state='failed' where user_id='f6250000-0000-4000-8000-000000000003';
set local role service_role;
select is((select count(*) from public.subscription_access_details_v1('f6250000-0000-4000-8000-000000000003',now()+interval '72 hours')),0::bigint,'failed conversion does not receive grace');
select is((select grant_source from public.subscription_access_details_v1('f6250000-0000-4000-8000-000000000003',now())),'trial','failed future payment does not erase the remaining promised trial');
reset role;
update public.account_subscription_trials set first_payment_state='action_required' where user_id='f6250000-0000-4000-8000-000000000003';
set local role service_role;
select is((select count(*) from public.subscription_access_details_v1('f6250000-0000-4000-8000-000000000003',now()+interval '72 hours')),0::bigint,'payment authentication does not extend trial');
reset role;
update public.account_subscription_trials set first_payment_state='awaiting' where user_id='f6250000-0000-4000-8000-000000000003';
update public.subscriptions set cancel_at_period_end=true where user_id='f6250000-0000-4000-8000-000000000003';
set local role service_role;
select is((select expires_at from public.subscription_access_details_v1('f6250000-0000-4000-8000-000000000003',now())),now()+interval '71 hours','cancelled trial keeps its original end without conversion grace');
reset role;
update public.account_subscription_trials set first_payment_state='paid',first_invoice_id='in_status_paid',first_paid_at=now() where user_id='f6250000-0000-4000-8000-000000000003';
update public.subscriptions set status='active',current_period_end=now()+interval '31 days' where user_id='f6250000-0000-4000-8000-000000000003';
set local role service_role;
select is((select grant_source from public.subscription_access_details_v1('f6250000-0000-4000-8000-000000000003',now()+interval '72 hours')),'paid','confirmed first payment becomes paid after the trial');
select is((select expires_at from public.subscription_access_grants_v1('f6250000-0000-4000-8000-000000000003',now()+interval '72 hours')),now()+interval '31 days','the legacy helper retains the paid subscription boundary');
reset role;
update public.personal_history_policy set active=false;
set local role service_role;
select throws_ok($$select pg_temp.status_for(1)$$,'P0001','ROOM_AUTHORITY_UNAVAILABLE','unavailable authority never invents remaining minutes');
reset role;
delete from public.personal_history_policy where singleton;
set local role service_role;
select throws_ok($$select pg_temp.status_for(1)$$,'P0001','ROOM_AUTHORITY_UNAVAILABLE','a missing authority policy cannot issue a successful snapshot');
reset role;
select * from finish();
rollback;
