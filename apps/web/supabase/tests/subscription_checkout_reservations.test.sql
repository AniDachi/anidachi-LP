begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name,created_at) values
 ('c1111111-1111-4111-8111-111111111111','checkout-new@example.test','New','2026-09-27T00:00:00Z'),
 ('c2222222-2222-4222-8222-222222222222','checkout-old@example.test','Old','2026-09-01T00:00:00Z');
select has_function('public','reserve_subscription_checkout_v1',array['uuid','text','text','text','uuid','jsonb'],'server reservation exists');
update public.hosting_commercial_policy set activation_at='2026-09-27T00:00:00Z',trials_enabled=true;
create temporary table checkout_results(name text, value jsonb);
grant all on checkout_results to service_role;
set local role service_role;
insert into checkout_results values('first',public.reserve_subscription_checkout_v1('c1111111-1111-4111-8111-111111111111','plus','price_plus','https://anidachi.test','b1111111-1111-4111-8111-111111111111','{}'));
insert into checkout_results values('second',public.reserve_subscription_checkout_v1('c1111111-1111-4111-8111-111111111111','pro','price_pro','https://anidachi.test','b2222222-2222-4222-8222-222222222222','{}'));
select is((select value->>'id' from checkout_results where name='first'),(select value->>'id' from checkout_results where name='second'),'parallel clicks reuse the durable reservation until Stripe outcome is known');
select is((select value->>'plan_code' from checkout_results where name='second'),'plus','changing plan cannot mutate existing Stripe idempotency parameters');
select is((select value->>'trial_offered' from checkout_results where name='first'),'true','new eligible account reserves trial');
select is((select count(*) from public.account_subscription_trials where user_id='c1111111-1111-4111-8111-111111111111'),0::bigint,'uncompleted checkout never consumes trial');
select throws_ok($$select public.complete_subscription_checkout_reservation_v1('c1111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cs_fake','open')$$,'P0001','CHECKOUT_RESERVATION_STALE','old holder cannot bind a new reservation');
select public.complete_subscription_checkout_reservation_v1('c1111111-1111-4111-8111-111111111111',(select (value->>'id')::uuid from checkout_results where name='first'),'cs_first','open');
select throws_ok($$select public.complete_subscription_checkout_reservation_v1('c1111111-1111-4111-8111-111111111111',(select (value->>'id')::uuid from checkout_results where name='first'),'cs_another','expired')$$,'P0001','CHECKOUT_SESSION_MISMATCH','cannot expire another session to clear a reservation');
select public.complete_subscription_checkout_reservation_v1('c1111111-1111-4111-8111-111111111111',(select (value->>'id')::uuid from checkout_results where name='first'),'cs_first','expired');
insert into checkout_results values('after_expiry',public.reserve_subscription_checkout_v1('c1111111-1111-4111-8111-111111111111','pro','price_pro','https://anidachi.test','b2222222-2222-4222-8222-222222222222','{}'));
select isnt((select value->>'id' from checkout_results where name='first'),(select value->>'id' from checkout_results where name='after_expiry'),'confirmed expired session allows a fresh offer');
select is((select value->>'trial_offered' from checkout_results where name='after_expiry'),'true','abandoned checkout preserves eligibility');
select is(public.reserve_subscription_checkout_v1('c2222222-2222-4222-8222-222222222222','plus','price_plus','https://anidachi.test','b3333333-3333-4333-8333-333333333333','{}')->>'trial_offered','true','existing Free reserves the same unused trial as new Free');
reset role;
select ok(not has_function_privilege('authenticated','public.reserve_subscription_checkout_v1(uuid,text,text,text,uuid,jsonb)','execute'),'browser cannot choose server offer');
select ok(not has_table_privilege('service_role','public.subscription_checkout_reservations','delete'),'runtime cannot delete uncertain reservations');
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status)
values
 ('c1111111-1111-4111-8111-111111111111','cus_fixture','sub_first','price_plus','plus','active'),
 ('c1111111-1111-4111-8111-111111111111','cus_fixture','sub_second','price_plus','plus','active');
set local role service_role;
select public.complete_subscription_checkout_reservation_v1('c1111111-1111-4111-8111-111111111111',(select (value->>'id')::uuid from checkout_results where name='after_expiry'),'cs_final','complete','sub_first');
select throws_ok($$select public.complete_subscription_checkout_reservation_v1('c1111111-1111-4111-8111-111111111111',(select (value->>'id')::uuid from checkout_results where name='after_expiry'),'cs_final','expired')$$,'P0001','CHECKOUT_RESERVATION_TERMINAL','late expiration cannot release completed checkout');
select throws_ok($$select public.complete_subscription_checkout_reservation_v1('c1111111-1111-4111-8111-111111111111',(select (value->>'id')::uuid from checkout_results where name='after_expiry'),'cs_final','complete','sub_second')$$,'P0001','CHECKOUT_SUBSCRIPTION_MISMATCH','completed checkout cannot be rebound to another subscription');
reset role;
select * from finish();
rollback;
