begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name) values
 ('af000000-0000-4000-8000-000000000001','promo1@example.test','Promo one'),
 ('af000000-0000-4000-8000-000000000002','promo2@example.test','Promo two');
insert into public.billing_customers(user_id,stripe_customer_id) values
 ('af000000-0000-4000-8000-000000000001','cus_promo1'),
 ('af000000-0000-4000-8000-000000000002','cus_promo2');
select ok(not has_table_privilege('anon','public.subscription_campaign_bindings','select'),'anonymous cannot inspect bindings');
select ok(not has_table_privilege('authenticated','public.subscription_campaign_bindings','insert'),'browser cannot claim campaign');
select ok(not has_table_privilege('service_role','public.subscription_campaign_bindings','delete'),'runtime cannot reset redemption binding');
select ok(not has_function_privilege('authenticated','public.claim_product_hunt_promotion_v1(uuid,text,text)','execute'),'claim is service-only');
set local role service_role;
select lives_ok($$select public.claim_product_hunt_promotion_v1('af000000-0000-4000-8000-000000000001','cus_promo1','coupon_one')$$,'owner may bind once');
select is(public.claim_product_hunt_promotion_v1('af000000-0000-4000-8000-000000000001','cus_promo1','coupon_one')->>'id',
 public.claim_product_hunt_promotion_v1('af000000-0000-4000-8000-000000000001','cus_promo1','coupon_one')->>'id','retry preserves idempotency identity');
select throws_ok($$select public.claim_product_hunt_promotion_v1('af000000-0000-4000-8000-000000000001','cus_promo2','coupon_one')$$,'P0001','PROMOTION_CUSTOMER_MISMATCH','cannot claim another customer');
select throws_ok($$select public.claim_product_hunt_promotion_v1('af000000-0000-4000-8000-000000000001','cus_promo1','coupon_changed')$$,'P0001','PROMOTION_BINDING_MISMATCH','coupon change cannot reset campaign');
reset role;
select is((select count(*) from public.subscription_campaign_bindings where campaign='product_hunt_2026'),1::bigint,'one durable binding');
update public.billing_customers set stripe_customer_id='cus_replaced' where user_id='af000000-0000-4000-8000-000000000001';
set local role service_role;
select throws_ok($$select public.claim_product_hunt_promotion_v1('af000000-0000-4000-8000-000000000001','cus_replaced','coupon_one')$$,'P0001','PROMOTION_BINDING_MISMATCH','replacing customer cannot reset campaign');
reset role;
delete from public.users where id='af000000-0000-4000-8000-000000000001';
select is((select count(*) from public.subscription_campaign_bindings where stripe_customer_id='cus_promo1' and user_id is null),1::bigint,'account deletion preserves opaque Stripe claim');
select * from finish();
rollback;
