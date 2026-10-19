begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name) values ('ad000000-0000-4000-8000-000000000099','context-budget@example.test','Context budget');
set local role service_role;
select lives_ok($$select public.consume_trial_action_rate_limit_v1('ad000000-0000-4000-8000-000000000099','context')$$,'context has its own bounded budget');
reset role;
-- Seed the boundary directly to minimize the minute-rollover window.
insert into public.subscription_trial_request_limits(user_id,action,window_started_at,request_count)
values ('ad000000-0000-4000-8000-000000000099','context',date_trunc('minute',clock_timestamp()),20)
on conflict(user_id,action) do update set window_started_at=excluded.window_started_at,request_count=20;
set local role service_role;
select ok(not public.consume_trial_action_rate_limit_v1('ad000000-0000-4000-8000-000000000099','context'),'context attempt 21 is limited');
select ok(public.consume_trial_action_rate_limit_v1('ad000000-0000-4000-8000-000000000099','offer'),'context does not spend offer budget');
select ok(public.consume_trial_action_rate_limit_v1('ad000000-0000-4000-8000-000000000099','start'),'browsing does not spend activation budget');
select throws_ok($$select public.consume_trial_action_rate_limit_v1('ad000000-0000-4000-8000-000000000099','invalid')$$,'P0001','TRIAL_RATE_LIMIT_INPUT_INVALID','unknown actions fail closed');
reset role;
select ok(not has_function_privilege('anon','public.consume_trial_action_rate_limit_v1(uuid,text)','execute'),'anonymous cannot consume arbitrary account budgets');
select ok(not has_function_privilege('authenticated','public.consume_trial_action_rate_limit_v1(uuid,text)','execute'),'browser role cannot consume arbitrary account budgets');
select ok(has_function_privilege('service_role','public.consume_trial_action_rate_limit_v1(uuid,text)','execute'),'server can enforce budgets');
select is((select count(*) from public.subscription_trial_activations where user_id='ad000000-0000-4000-8000-000000000099'),0::bigint,'budget check never activates a trial');
select * from finish();
rollback;
