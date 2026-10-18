set lock_timeout='5s';
set statement_timeout='30s';

-- Preserve the verified SetupIntent as an immutable source. Each reuse records
-- new consent to new terms, without inventing another Checkout or SetupIntent.
alter table public.subscription_trial_renewals
 add column payment_source_operation_id uuid,
 add constraint trial_saved_card_source_owner foreign key(user_id,stripe_subscription_id,payment_source_operation_id)
 references public.subscription_trial_renewals(user_id,stripe_subscription_id,id),
 drop constraint subscription_trial_renewals_check1,
 add constraint trial_applied_payment_proof check(state<>'applied' or (
  action='enable' and consented_at is not null and payment_method_id is not null and (
   (payment_source_operation_id is null and setup_session_id is not null and setup_intent_id is not null)
   or (payment_source_operation_id is not null and payment_source_operation_id<>id and setup_session_id is null and setup_intent_id is null)
  )
 ));

create or replace function public.reserve_trial_renewal_v1(p_user_id uuid,p_request_id uuid,p_subscription_id text,p_action text,p_terms jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare t public.account_subscription_trials%rowtype; r public.subscription_trial_renewals%rowtype; next_generation bigint;
begin
 if p_user_id is null or p_request_id is null or p_action is null or p_action not in ('enable','cancel') or p_terms is null
  or jsonb_typeof(p_terms)<>'object' then raise exception 'TRIAL_RENEWAL_INPUT_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into r from public.subscription_trial_renewals where user_id=p_user_id and request_id=p_request_id for update;
 if found then
  if (r.stripe_subscription_id,r.action,r.terms) is distinct from (p_subscription_id,p_action,p_terms) then raise exception 'TRIAL_REQUEST_MISMATCH'; end if;
  return to_jsonb(r);
 end if;
 select * into t from public.account_subscription_trials where user_id=p_user_id and stripe_subscription_id=p_subscription_id for update;
 if not found or t.trial_mode<>'cardless' or t.first_payment_state='paid' then raise exception 'TRIAL_RENEWAL_UNAVAILABLE'; end if;
 if t.trial_ends_at<=clock_timestamp() then raise exception 'TRIAL_EXPIRED'; end if;
 if not exists(select 1 from public.subscriptions where stripe_subscription_id=p_subscription_id and user_id=p_user_id and status='trialing') then raise exception 'TRIAL_RENEWAL_UNAVAILABLE'; end if;
 if exists(select 1 from public.subscription_trial_renewals where user_id=p_user_id and state='applying') then raise exception 'TRIAL_MUTATION_UNRESOLVED'; end if;
 -- Serialize this check with consent, completion and cancellation. A read or a
 -- different tab's draft must never revoke consented card setup.
 if p_action='enable' and exists(select 1 from public.subscription_trial_renewals where user_id=p_user_id and state='setup_pending') then raise exception 'TRIAL_SETUP_PENDING'; end if;
 if p_action='enable' and (not (p_terms ?& array['planCode','billingPeriod','priceId','amount','currency','termsRevision','quoteRevision'])
  or p_terms->>'planCode' is null or p_terms->>'planCode' not in ('plus','pro') or p_terms->>'billingPeriod' is null or p_terms->>'billingPeriod' not in ('monthly','yearly')
  or p_terms->>'amount' is null or p_terms->>'amount' !~ '^[1-9][0-9]{0,8}$') then raise exception 'TRIAL_RENEWAL_INPUT_INVALID'; end if;
 select coalesce(max(generation),0)+1 into next_generation from public.subscription_trial_renewals where user_id=p_user_id;
 -- Only an explicit cancel can supersede setup_pending.
 update public.subscription_trial_renewals set state='canceled',updated_at=clock_timestamp() where user_id=p_user_id and state in ('quoted','setup_pending');
 insert into public.subscription_trial_renewals(user_id,request_id,stripe_subscription_id,generation,action,terms,plan_code,billing_period,
  price_id,amount,currency,terms_revision,quote_revision,original_trial_end,quote_expires_at,state)
 values(p_user_id,p_request_id,p_subscription_id,next_generation,p_action,p_terms,p_terms->>'planCode',p_terms->>'billingPeriod',
  p_terms->>'priceId',(p_terms->>'amount')::bigint,p_terms->>'currency',p_terms->>'termsRevision',p_terms->>'quoteRevision',t.trial_ends_at,
  least(clock_timestamp()+interval '5 minutes',t.trial_ends_at),case when p_action='enable' then 'quoted' else 'applying' end) returning * into r;
 return to_jsonb(r);
end $$;

create function public.begin_trial_saved_renewal_v1(p_user_id uuid,p_operation_id uuid,p_generation bigint,p_request_id uuid,p_origin text,p_source_operation_id uuid,p_payment_method_id text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare r public.subscription_trial_renewals%rowtype; s public.subscription_trial_renewals%rowtype; t public.account_subscription_trials%rowtype;
begin
 if p_user_id is null or p_request_id is null or p_origin is null or not (p_origin~'^https://[A-Za-z0-9.-]+(:[0-9]+)?$' or p_origin~'^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$') then raise exception 'TRIAL_SETUP_REQUEST_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into r from public.subscription_trial_renewals where user_id=p_user_id and id=p_operation_id for update;
 if not found or r.generation is distinct from p_generation or r.generation<>(select max(generation) from public.subscription_trial_renewals where user_id=p_user_id) then raise exception 'TRIAL_RENEWAL_STALE'; end if;
 if r.action<>'enable' then raise exception 'TRIAL_RENEWAL_STATE_CONFLICT'; end if;
 if r.state in ('applying','applied') then
  if (r.payment_source_operation_id,r.payment_method_id,r.setup_request_id,r.setup_origin) is distinct from
    (p_source_operation_id,p_payment_method_id,p_request_id,p_origin) then raise exception 'TRIAL_SETUP_REQUEST_MISMATCH'; end if;
  return to_jsonb(r);
 end if;
 if r.state<>'quoted' then raise exception 'TRIAL_RENEWAL_STATE_CONFLICT'; end if;
 select * into t from public.account_subscription_trials where user_id=p_user_id and stripe_subscription_id=r.stripe_subscription_id for update;
 if not found or t.trial_mode<>'cardless' or t.first_payment_state='paid' or t.trial_ends_at is distinct from r.original_trial_end
  or not exists(select 1 from public.subscriptions where user_id=p_user_id and stripe_subscription_id=r.stripe_subscription_id and status='trialing') then raise exception 'TRIAL_RENEWAL_UNAVAILABLE'; end if;
 if r.quote_expires_at<=clock_timestamp() or t.trial_ends_at<=clock_timestamp() then raise exception 'TRIAL_QUOTE_EXPIRED'; end if;
 select * into s from public.subscription_trial_renewals where user_id=p_user_id and stripe_subscription_id=r.stripe_subscription_id
  and id=p_source_operation_id and generation<r.generation and action='enable' and state='applied';
 if not found or s.consented_at is null or p_payment_method_id is null or s.payment_method_id is distinct from p_payment_method_id then raise exception 'TRIAL_SETUP_UNVERIFIED'; end if;
 update public.subscription_trial_renewals set state='applying',consented_at=clock_timestamp(),updated_at=clock_timestamp(),
  setup_origin=p_origin,setup_request_id=p_request_id,payment_source_operation_id=s.id,payment_method_id=p_payment_method_id
  where id=r.id returning * into r;
 return to_jsonb(r);
end $$;

revoke all on function public.begin_trial_saved_renewal_v1(uuid,uuid,bigint,uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.begin_trial_saved_renewal_v1(uuid,uuid,bigint,uuid,text,uuid,text) to service_role;
reset lock_timeout;
reset statement_timeout;
