-- Disposable local fixture only. All records and helper objects roll back.
begin;
set search_path=public,extensions;
select no_plan();

select ok(not has_table_privilege('anon','public.email_login_challenges','SELECT'),'anonymous cannot read codes');
select ok(not has_table_privilege('authenticated','public.email_login_challenges','SELECT'),'ordinary sessions cannot read codes');
select ok(not has_table_privilege('authenticated','public.email_login_limits','UPDATE'),'ordinary sessions cannot reset limits');
select ok(not has_function_privilege('anon','public.consume_email_login_v1(uuid,text,text)','EXECUTE'),'anonymous cannot consume a code via Data API');
select ok(has_function_privilege('service_role','public.consume_email_login_v1(uuid,text,text)','EXECUTE'),'only trusted server can consume');
select ok(not prosecdef and 'search_path=""'=any(proconfig),'consume is invoker with fixed search path') from pg_proc where oid='public.consume_email_login_v1(uuid,text,text)'::regprocedure;
select ok(relrowsecurity,'challenge RLS enabled') from pg_class where oid='public.email_login_challenges'::regclass;

insert into public.users(id,email,display_name,google_id,discord_id,plan) values
('15151515-1111-4111-8111-000000000001','Existing@Example.com','Keep my name','otp-fixture-google','otp-fixture-discord','plus'),
('15151515-1111-4111-8111-000000000002','legacy@example.com','Legacy', 'otp-fixture-legacy',null,'pro');
insert into public.profiles(user_id,display_name,avatar_url) values('15151515-1111-4111-8111-000000000001','Custom public name','https://example.com/avatar.png');
insert into public.billing_customers(user_id,stripe_customer_id) values('15151515-1111-4111-8111-000000000001','cus_otp_fixture');
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end) values('15151515-1111-4111-8111-000000000001','cus_otp_fixture','sub_otp_fixture','price_otp_fixture','plus','active',now()+interval '1 month');
select public.record_verified_account_email_v1('15151515-1111-4111-8111-000000000001','Existing@Example.com');
create temp table saved_account as select to_jsonb(u) as value from public.users u where id='15151515-1111-4111-8111-000000000001';
create temp table saved_subscription as select to_jsonb(s) as value from public.subscriptions s where stripe_subscription_id='sub_otp_fixture';

select is(public.start_email_login_v1('15151515-2222-4222-8222-000000000001','existing@example.com',repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',64),'/extension/connect?handoff=opaque'),0,'first request reserved');
select is((select outcome from public.consume_email_login_v1('15151515-2222-4222-8222-000000000001',repeat('b',64),repeat('a',64))),'invalid','unconfirmed delivery cannot sign in');
update public.email_login_challenges set sent_at=now() where id='15151515-2222-4222-8222-000000000001';
select is((select outcome from public.consume_email_login_v1('15151515-2222-4222-8222-000000000001',repeat('f',64),repeat('a',64))),'invalid','other browser rejected');
select is((select attempts from public.email_login_challenges where id='15151515-2222-4222-8222-000000000001'),0,'foreign browser cannot exhaust valid challenge');
create temp table verified as select * from public.consume_email_login_v1('15151515-2222-4222-8222-000000000001',repeat('b',64),repeat('a',64));
select is((select outcome from verified),'verified','existing verified email accepted case-insensitively');
select is((select user_id from verified),'15151515-1111-4111-8111-000000000001'::uuid,'same paid user ID');
select is((select return_to from verified),'/extension/connect?handoff=opaque','extension return destination preserved');
select is((select is_new from verified),false,'existing account is not a signup');
select is((select to_jsonb(u) from public.users u where id='15151515-1111-4111-8111-000000000001'),(select value from saved_account),'user fields, plan and provider IDs unchanged');
select is((select to_jsonb(s) from public.subscriptions s where stripe_subscription_id='sub_otp_fixture'),(select value from saved_subscription),'subscription unchanged');
select is((select display_name from public.profiles where user_id='15151515-1111-4111-8111-000000000001'),'Custom public name','profile name unchanged');
select is((select outcome from public.consume_email_login_v1('15151515-2222-4222-8222-000000000001',repeat('b',64),repeat('a',64))),'invalid','successful code cannot replay');
select throws_ok($$insert into public.users(email,display_name) values('existing@example.com','Duplicate')$$,'23505',null,'case variant cannot create duplicate account from OAuth');

insert into public.email_login_challenges(id,email,code_hash,browser_hash,sent_at) values
('15151515-2222-4222-8222-000000000002','new@example.com',repeat('a',64),repeat('b',64),now()),
('15151515-2222-4222-8222-000000000003','legacy@example.com',repeat('a',64),repeat('b',64),now()),
('15151515-2222-4222-8222-000000000004','wrong@example.com',repeat('a',64),repeat('b',64),now()),
('15151515-2222-4222-8222-000000000005','expired@example.com',repeat('a',64),repeat('b',64),now());
select is((select count(*)::integer from public.users where email='new@example.com'),0,'request alone does not register');
create temp table new_verified as select * from public.consume_email_login_v1('15151515-2222-4222-8222-000000000002',repeat('b',64),repeat('a',64));
select is((select is_new from new_verified),true,'valid new code registers once');
select is((select plan from public.users where id=(select user_id from new_verified)),'free','new account uses existing Free default');
select is((select count(*)::integer from public.profiles where user_id=(select user_id from new_verified)),1,'profile created once');
select is((select email from public.account_verified_emails where user_id=(select user_id from new_verified)),'new@example.com','email proof recorded');
select is((select outcome from public.consume_email_login_v1('15151515-2222-4222-8222-000000000003',repeat('b',64),repeat('a',64))),'provider_required','legacy ID is never silently merged or hijacked');
select is((select plan from public.users where email='legacy@example.com'),'pro','legacy paid account preserved');
select is((select count(*)::integer from public.users where email='legacy@example.com'),1,'no second legacy account created');
do $$begin for i in 1..5 loop perform public.consume_email_login_v1('15151515-2222-4222-8222-000000000004',repeat('b',64),repeat('f',64)); end loop; end $$;
select is((select attempts from public.email_login_challenges where id='15151515-2222-4222-8222-000000000004'),5,'five independent wrong attempts counted');
select is((select outcome from public.consume_email_login_v1('15151515-2222-4222-8222-000000000004',repeat('b',64),repeat('a',64))),'invalid','correct code after five failures rejected');
select is((select count(*)::integer from public.users where email='wrong@example.com'),0,'wrong guesses never register');
update public.email_login_challenges set expires_at=now()-interval '1 second' where id='15151515-2222-4222-8222-000000000005';
select is((select outcome from public.consume_email_login_v1('15151515-2222-4222-8222-000000000005',repeat('b',64),repeat('a',64))),'invalid','expired code rejected');

select ok(public.start_email_login_v1(gen_random_uuid(),'existing@example.com',repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',64),'')>0,'resend before sixty seconds denied');
update public.email_login_limits set window_started_at=now()-interval '61 seconds' where key='resend:'||repeat('c',64);
select is(public.start_email_login_v1('15151515-2222-4222-8222-000000000006','existing@example.com',repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',64),''),0,'resend after cooldown allowed');
update public.email_login_limits set window_started_at=now()-interval '61 seconds' where key='resend:'||repeat('c',64);
select is(public.start_email_login_v1(gen_random_uuid(),'existing@example.com',repeat('a',64),repeat('b',64),repeat('c',64),repeat('d',64),''),0,'later request allowed');
update public.email_login_challenges set sent_at=now() where id='15151515-2222-4222-8222-000000000006';
select is((select outcome from public.consume_email_login_v1('15151515-2222-4222-8222-000000000006',repeat('b',64),repeat('a',64))),'invalid','resend invalidates older code including delayed delivery');
select is(public.consume_email_login_limit_v1('fixture',60,1),0,'rate bucket allows first attempt');
select ok(public.consume_email_login_limit_v1('fixture',60,1)>0,'rate bucket persists across requests');
update public.email_login_limits set hits=80 where key='global';
select ok(public.start_email_login_v1(gen_random_uuid(),'quota@example.com',repeat('a',64),repeat('b',64),repeat('e',64),repeat('e',64),'')>0,'global sender quota cannot be bypassed by new email/IP');
select is((select count(*)::integer from public.email_login_challenges where email='quota@example.com'),0,'over-quota request creates no challenge');

set local role anon;
select throws_ok($$select * from public.email_login_challenges$$,'42501',null,'actual anonymous role denied');
select throws_ok($$select * from public.consume_email_login_v1(gen_random_uuid(),repeat('a',64),repeat('a',64))$$,'42501',null,'actual anonymous RPC denied');
reset role;
set local role service_role;
select lives_ok($$select * from public.consume_email_login_v1(gen_random_uuid(),repeat('a',64),repeat('a',64))$$,'service role executes guarded verifier');
reset role;
select * from finish();
rollback;
