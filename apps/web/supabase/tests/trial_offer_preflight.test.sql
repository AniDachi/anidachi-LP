begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name) values('ad000000-0000-4000-8000-000000000001','offer-preflight@example.test','Preflight');
create function pg_temp.check_marker(b text,i text default null) returns text language sql as $$
 select public.read_trial_marker_status_v1('ad000000-0000-4000-8000-000000000001',b,i);
$$;
set local role service_role;
select is(pg_temp.check_marker(repeat('a',64)),'available','fresh cookie without extension is available');
select throws_ok($$select pg_temp.check_marker(null)$$,'P0001','TRIAL_CONTEXT_REQUIRED','missing cookie is not eligible');
reset role;
select is((select count(*) from public.subscription_trial_activations where user_id='ad000000-0000-4000-8000-000000000001'),0::bigint,'preflight creates no activation');
select is((select count(*) from anidachi_private.trial_marker_claims where marker_hash=repeat('a',64)),0::bigint,'preflight creates no marker claim');
insert into anidachi_private.trial_marker_claims(kind,marker_hash,state,expires_at) values
 ('browser',repeat('b',64),'consumed',now()+interval '1 day'),
 ('installation',repeat('c',64),'consumed',now()+interval '1 day'),
 ('browser',repeat('d',64),'reserved',null),
 ('browser',repeat('e',64),'consumed',now()-interval '1 second');
set local role service_role;
select is(pg_temp.check_marker(repeat('b',64)),'used','consumed cookie blocks even without receipt or owning account');
select is(pg_temp.check_marker(repeat('a',64),repeat('c',64)),'used','same installation catches changed cookie');
select is(pg_temp.check_marker(repeat('d',64)),'busy','unresolved reservation is retryable');
select is(pg_temp.check_marker(repeat('e',64)),'available','expired consumed history is ignored without mutation');
reset role;
select is((select count(*) from anidachi_private.trial_marker_claims where marker_hash in (repeat('b',64),repeat('c',64),repeat('d',64),repeat('e',64))),4::bigint,'read leaves all history intact');
select ok(not has_function_privilege('anon','public.read_trial_marker_status_v1(uuid,text,text)','execute'),'anonymous cannot query arbitrary marker');
select ok(not has_function_privilege('authenticated','public.read_trial_marker_status_v1(uuid,text,text)','execute'),'browser cannot query arbitrary marker');
select ok(has_function_privilege('service_role','public.read_trial_marker_status_v1(uuid,text,text)','execute'),'server may check verified marker');
select ok(not has_table_privilege('service_role','anidachi_private.trial_marker_claims','select'),'marker table remains private');
update public.hosting_commercial_policy set activation_at=now()-interval '1 day',trials_enabled=true,cardless_trials_enabled=true;
set local role service_role;
select public.reserve_cardless_trial_v2('ad000000-0000-4000-8000-000000000001',gen_random_uuid(),'plus','monthly','price_preflight',null,(select revision from public.hosting_commercial_policy where singleton),repeat('a',64),null);
select is(pg_temp.check_marker(repeat('a',64)),'account_changed','own pending activation takes precedence over marker busy');
select ok(public.consume_trial_action_rate_limit_v1('ad000000-0000-4000-8000-000000000001','offer'),'preflight uses a separate browsing bucket');
reset role;
select is((select count(*) from public.subscription_trial_request_limits where user_id='ad000000-0000-4000-8000-000000000001' and action='start'),0::bigint,'preflight does not consume activation attempts');
select * from finish();
rollback;
