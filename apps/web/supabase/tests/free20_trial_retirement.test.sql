-- Real RPCs and trigger, synthetic accounts, all changes rolled back.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into public.users(id,email,display_name)
 select ('f6270000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'retirement-'||n||'@example.test','Retirement fixture' from generate_series(1,8) n;
create function pg_temp.owner(n integer) returns uuid language sql as $$select ('f6270000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create temporary table retirement_proof(name text primary key,value jsonb);
grant all on retirement_proof to service_role;
create function pg_temp.reserve(n integer,version integer) returns jsonb language plpgsql as $$begin
 if version=1 then return public.reserve_cardless_trial_v1(pg_temp.owner(n),pg_temp.owner(n),'pro','yearly','price_original',null,1); end if;
 return public.reserve_cardless_trial_v2(pg_temp.owner(n),pg_temp.owner(n),'pro','yearly','price_original',null,1,repeat(n::text,64),null);
end$$;
create function pg_temp.stale_checkout(n integer) returns void language sql as $$
 insert into public.subscription_checkout_reservations(user_id,request_id,plan_code,price_id,origin,policy_revision,trial_offered)
 values(pg_temp.owner(n),pg_temp.owner(n),'plus','price_original','https://anidachi.test',1,true);
$$;
update public.hosting_commercial_policy set activation_at=now()-interval '1 day',free20_enabled=false,trials_enabled=true,cardless_trials_enabled=true,revision=1;
select throws_ok($$update public.hosting_commercial_policy set free20_enabled=true$$,'23514',null,'Free20 and new trials cannot be enabled together');
set local role service_role;
insert into retirement_proof values('v1',pg_temp.reserve(1,1)),('v2',pg_temp.reserve(2,2));
insert into retirement_proof values('attempt',to_jsonb(public.begin_cardless_trial_attempt_v1(pg_temp.owner(1),(select (value->>'id')::uuid from retirement_proof where name='v1'),'customer','trial-customer:'||(select value->>'id' from retirement_proof where name='v1'))));
reset role;
-- Accept an old card-required reservation before switching to Free20.
update public.hosting_commercial_policy set cardless_trials_enabled=false;
set local role service_role;
insert into retirement_proof values('checkout',public.reserve_subscription_checkout_v1(pg_temp.owner(3),'plus','price_original','https://anidachi.test',pg_temp.owner(3),'{}'));
reset role;
select is((select value->>'trial_offered' from retirement_proof where name='checkout'),'true','pre-cutoff legacy reservation has original trial terms');
insert into retirement_proof select 'activation-at',to_jsonb(activation_at) from public.hosting_commercial_policy;
update public.hosting_commercial_policy set trials_enabled=false,free20_enabled=true,cardless_trials_enabled=true,revision=2;
select is((select to_jsonb(activation_at) from public.hosting_commercial_policy),(select value from retirement_proof where name='activation-at'),'cutoff preserves original activation timestamp');
set local role service_role;
select throws_ok($$select pg_temp.reserve(4,1)$$,'P0001','CARDLESS_TRIAL_UNAVAILABLE','fresh v1 start is retired');
select throws_ok($$select pg_temp.reserve(5,2)$$,'P0001','CARDLESS_TRIAL_UNAVAILABLE','fresh v2 start is retired');
select is(pg_temp.reserve(1,1),(select value from retirement_proof where name='v1'),'accepted v1 replays exact identity, revision, price and period after cutoff');
select is(pg_temp.reserve(2,2),(select value from retirement_proof where name='v2'),'accepted v2 replays exact identity and markers after cutoff');
select lives_ok($$select public.finish_cardless_trial_attempt_v1(pg_temp.owner(1),(select (value->>'id')::uuid from retirement_proof where name='v1'),(select (value#>>'{}')::uuid from retirement_proof where name='attempt'),'succeeded','cus_retirement_1','req_retirement')$$,'accepted in-flight external response can complete after cutoff');
select lives_ok($$select public.record_cardless_trial_customer_v1(pg_temp.owner(1),(select (value->>'id')::uuid from retirement_proof where name='v1'),'cus_retirement_1')$$,'accepted customer binding is preserved');
select lives_ok($$select public.begin_cardless_trial_attempt_v1(pg_temp.owner(1),(select (value->>'id')::uuid from retirement_proof where name='v1'),'schedule',(select value->>'idempotency_key' from retirement_proof where name='v1'))$$,'accepted activation can continue schedule recovery after cutoff');
select lives_ok($$select public.record_cardless_trial_created_v1(pg_temp.owner(1),(select (value->>'id')::uuid from retirement_proof where name='v1'),'cus_retirement_1','sched_retirement_1','sub_retirement_1','price_original',now(),now()+interval '72 hours')$$,'accepted original trial can be recorded after cutoff');
select is(public.reserve_subscription_checkout_v1(pg_temp.owner(3),'plus','price_original','https://anidachi.test',pg_temp.owner(3),'{}'),(select value from retirement_proof where name='checkout'),'accepted legacy reservation survives unchanged');
select lives_ok($$select public.complete_subscription_checkout_reservation_v1(pg_temp.owner(3),(select (value->>'id')::uuid from retirement_proof where name='checkout'),'cs_retirement','open')$$,'accepted legacy session response can be recorded after cutoff');
select is(public.reserve_subscription_checkout_v1(pg_temp.owner(6),'pro','price_paid_yearly','https://anidachi.test',gen_random_uuid(),'{}')->>'trial_offered','false','ordinary legacy paid Checkout remains available');
select is(public.reserve_subscription_purchase_v1(pg_temp.owner(7),'plus','price_paid_monthly','https://anidachi.test',gen_random_uuid(),'{}')->>'trial_offered','false','explicit paid-only purchase remains available');
select throws_ok($$select public.reserve_subscription_purchase_v1(pg_temp.owner(2),'plus','price_paid','https://anidachi.test',gen_random_uuid(),'{}')$$,'P0001','TRIAL_ACTIVATION_BUSY','paid-only path cannot overtake accepted cardless authority');
reset role;
select throws_ok($$select pg_temp.stale_checkout(8)$$,'P0001','CARDLESS_TRIAL_OFFER_CHANGED','stale eligible legacy snapshot cannot INSERT after cutoff');
delete from public.subscription_checkout_reservations where user_id=pg_temp.owner(8);
insert into retirement_proof select 'policy',to_jsonb(p) from public.hosting_commercial_policy p;
delete from public.hosting_commercial_policy;
select throws_ok($$select pg_temp.stale_checkout(8)$$,'P0001','CARDLESS_TRIAL_OFFER_CHANGED','missing singleton fails closed');
delete from public.subscription_checkout_reservations where user_id=pg_temp.owner(8);
insert into public.hosting_commercial_policy select (jsonb_populate_record(null::public.hosting_commercial_policy,(select value from retirement_proof where name='policy'))).*;
update public.hosting_commercial_policy set free20_enabled=false,activation_at=now()+interval '1 day';
select throws_ok($$select pg_temp.stale_checkout(8)$$,'P0001','CARDLESS_TRIAL_OFFER_CHANGED','inactive policy fails closed');
select is((select count(*) from public.account_subscription_trials where user_id in(select pg_temp.owner(n) from generate_series(1,8) n)),0::bigint,'reservations and created proof alone never mint a trial grant');
select ok(not has_function_privilege('anon','public.reserve_cardless_trial_v1(uuid,uuid,text,text,text,text,bigint)','EXECUTE'),'anon cannot reserve v1');
select ok(not has_function_privilege('authenticated','public.reserve_cardless_trial_v2(uuid,uuid,text,text,text,text,bigint,text,text)','EXECUTE'),'browser cannot reserve v2');
select ok(not has_table_privilege('service_role','public.subscription_checkout_reservations','INSERT'),'service still cannot bypass reservation RPC with INSERT');
select * from finish();
rollback;
