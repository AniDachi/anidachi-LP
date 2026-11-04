-- Synthetic, rollback-only contracts; run on an isolated schema fixture.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name) values
 ('11111111-1111-4111-8111-111111111111','uninstall-first@example.test','First'),
 ('22222222-2222-4222-8222-222222222222','uninstall-renew@example.test','Renew'),
 ('33333333-3333-4333-8333-333333333333','uninstall-other@example.test','Other');
insert into public.billing_customers(user_id,stripe_customer_id) values
 ('11111111-1111-4111-8111-111111111111','cus_first'),
 ('22222222-2222-4222-8222-222222222222','cus_renew'),
 ('33333333-3333-4333-8333-333333333333','cus_other');
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end) values
 ('11111111-1111-4111-8111-111111111111','cus_first','sub_first','price_plus','plus','active',to_timestamp(4102444800)),
 ('22222222-2222-4222-8222-222222222222','cus_renew','sub_renew','price_plus','plus','active',to_timestamp(4102444800));

select ok(bool_and(relrowsecurity),'all uninstall tables have RLS') from pg_class where relname in ('uninstall_offer_grants','uninstall_first_bindings','uninstall_retention_claims','uninstall_feedback','uninstall_feedback_windows');
select ok(not has_table_privilege('anon','public.uninstall_feedback','SELECT'),'anonymous cannot read feedback');
select ok(not has_table_privilege('authenticated','public.uninstall_retention_claims','SELECT'),'authenticated cannot read claims');
select ok(not has_table_privilege('service_role','public.uninstall_offer_grants','UPDATE'),'service role cannot rewrite lifetime authority');
select ok(not has_table_privilege('service_role','public.uninstall_retention_claims','UPDATE'),'service role cannot mutate frozen claim fields');
select ok(not has_function_privilege('anon','public.claim_uninstall_first_v1(uuid,text,text)','EXECUTE'),'anonymous cannot claim first');
select ok(not has_function_privilege('authenticated','public.reserve_uninstall_retention_v1(uuid,text,text,text,text[],text,text,integer,bigint,text)','EXECUTE'),'authenticated cannot reserve renewal');
select ok(has_function_privilege('service_role','public.submit_uninstall_feedback_v1(uuid,text,uuid,text,text)','EXECUTE'),'service role can submit bounded feedback');
select ok(bool_and('search_path=""'=any(proconfig)),'RPCs have fixed empty search_path') from pg_proc where proname in ('claim_uninstall_first_v1','reserve_uninstall_retention_v1','bind_uninstall_retention_invoice_v1','finish_uninstall_retention_v1','submit_uninstall_feedback_v1');

select lives_ok($$select claim_uninstall_first_v1('11111111-1111-4111-8111-111111111111','cus_first','coupon_first')$$,'first allowance reserved');
select lives_ok($$select claim_uninstall_first_v1('11111111-1111-4111-8111-111111111111','cus_first','coupon_first')$$,'first retry restores binding');
select is((select count(*)::integer from uninstall_first_bindings),1,'only one first binding');
select throws_ok($$select claim_uninstall_first_v1('11111111-1111-4111-8111-111111111111','cus_other','coupon_first')$$,'P0001','OFFER_CUSTOMER_MISMATCH','foreign customer rejected');
select throws_ok($$select claim_uninstall_first_v1('11111111-1111-4111-8111-111111111111','cus_first','coupon_changed')$$,'P0001','OFFER_BINDING_MISMATCH','coupon identity immutable');
select throws_ok($$select reserve_uninstall_retention_v1('11111111-1111-4111-8111-111111111111','cus_first','sub_first','coupon_renew',array['prod_plus','prod_pro'],'price_plus','plus',799,4102444800,'review')$$,'P0001','OFFER_LIFETIME_LIMIT','first reservation prevents a second uninstall allowance');
select lives_ok($$select reserve_uninstall_retention_v1('22222222-2222-4222-8222-222222222222','cus_renew','sub_renew','coupon_renew',array['prod_plus','prod_pro'],'price_plus','plus',799,4102444800,'review')$$,'renewal accepted');
select lives_ok($$select reserve_uninstall_retention_v1('22222222-2222-4222-8222-222222222222','cus_renew','sub_renew','coupon_renew',array['prod_plus','prod_pro'],'price_plus','plus',799,4102444800,'review')$$,'identical renewal retry restores accepted claim');
select is((select count(*)::integer from uninstall_retention_claims),1,'one renewal claim');
select throws_ok($$select claim_uninstall_first_v1('22222222-2222-4222-8222-222222222222','cus_renew','coupon_first')$$,'P0001','OFFER_LIFETIME_LIMIT','accepted renewal prevents first offer');
select throws_ok($$select reserve_uninstall_retention_v1('22222222-2222-4222-8222-222222222222','cus_renew','sub_renew','coupon_renew',array['prod_plus','prod_pro'],'price_plus','plus',799,4102444800,'new_review')$$,'P0001','OFFER_ALREADY_RESERVED','different revision cannot replace claim');
select lives_ok($$select bind_uninstall_retention_invoice_v1((select id from uninstall_retention_claims),'in_target')$$,'invoice bound before external write');
select lives_ok($$select bind_uninstall_retention_invoice_v1((select id from uninstall_retention_claims),'in_target')$$,'duplicate invoice restores binding');
select throws_ok($$select bind_uninstall_retention_invoice_v1((select id from uninstall_retention_claims),'in_foreign')$$,'P0001','OFFER_INVOICE_MISMATCH','one claim cannot attach to another invoice');
select lives_ok($$select finish_uninstall_retention_v1((select id from uninstall_retention_claims),'in_target','applied','Verified')$$,'verified readback persisted');
select throws_ok($$select finish_uninstall_retention_v1((select id from uninstall_retention_claims),'in_target','ineligible','Changed')$$,'P0001','OFFER_OUTCOME_MISMATCH','confirmed applied outcome cannot be reversed');

select is(submit_uninstall_feedback_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',repeat('a',64),null,'other','Note'),'saved','anonymous feedback stored');
select is(submit_uninstall_feedback_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',repeat('a',64),null,'other','Note'),'saved','feedback replay idempotent');
select is((select admissions from uninstall_feedback_windows where actor_hash=repeat('a',64)),1,'retry does not consume admission');
select throws_ok($$select submit_uninstall_feedback_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',repeat('b',64),null,'other','Note')$$,'P0001','FEEDBACK_IDENTITY_MISMATCH','cannot replay another actor submission');
select throws_ok($$select submit_uninstall_feedback_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',repeat('a',64),null,'other',repeat('x',501))$$,'P0001','FEEDBACK_INVALID_INPUT','long notes rejected in durable boundary');
select submit_uninstall_feedback_v1(('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa'||n)::uuid,repeat('a',64),null,'not_using','') from generate_series(2,5) n;
select is(submit_uninstall_feedback_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6',repeat('a',64),null,'other',''),'rate_limited','sixth per-hour admission denied');
select is((select count(*)::integer from uninstall_feedback),5,'rate-limited response is not silently saved');
select is(submit_uninstall_feedback_v1('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',repeat('a',64),null,'other','Note'),'saved','retry still succeeds after quota consumed');
select * from finish();
rollback;
