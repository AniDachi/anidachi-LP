-- Additive and dormant. No existing trial, price, customer or subscription is migrated.
set lock_timeout='5s';
set statement_timeout='30s';
alter table public.hosting_commercial_policy add column cardless_trials_enabled boolean not null default false;

create table public.subscription_trial_activations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 request_id uuid not null,
 plan_code text not null check(plan_code in ('plus','pro')),
 billing_period text not null check(billing_period in ('monthly','yearly')),
 price_id text not null check(char_length(price_id) between 1 and 255),
 policy_revision bigint not null check(policy_revision>0),
 stripe_customer_id text check(char_length(stripe_customer_id) between 1 and 255),
 stripe_schedule_id text unique check(char_length(stripe_schedule_id) between 1 and 255),
 stripe_subscription_id text unique check(char_length(stripe_subscription_id) between 1 and 255),
 idempotency_key text generated always as ('cardless-trial-v1:'||id::text) stored,
 state text not null default 'pending' check(state in ('pending','created','committed','failed')),
 trial_started_at timestamptz check(isfinite(trial_started_at)),
 trial_ends_at timestamptz check(isfinite(trial_ends_at)),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(user_id,request_id), unique(user_id,id),
 check((state in ('created','committed'))=(stripe_schedule_id is not null)),
 check(state not in ('created','committed') or stripe_customer_id is not null),
 check((stripe_schedule_id is null)=(stripe_subscription_id is null)),
 check((stripe_schedule_id is null)=(trial_started_at is null)),
 check((trial_started_at is null)=(trial_ends_at is null)),
 check(trial_ends_at=trial_started_at+interval '72 hours')
);
create unique index one_unresolved_trial_activation on public.subscription_trial_activations(user_id) where state<>'failed';
alter table public.subscription_trial_activations enable row level security;
revoke all on public.subscription_trial_activations from public,anon,authenticated,service_role;
grant select on public.subscription_trial_activations to service_role;

create table public.subscription_trial_renewals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 request_id uuid not null,
 stripe_subscription_id text not null,
 generation bigint not null check(generation>0),
 action text not null check(action in ('enable','cancel')),
 terms jsonb not null check(jsonb_typeof(terms)='object' and octet_length(terms::text)<=4096),
 plan_code text check(plan_code in ('plus','pro')),
 billing_period text check(billing_period in ('monthly','yearly')),
 price_id text check(char_length(price_id) between 1 and 255),
 amount bigint check(amount>0), currency text check(currency~'^[a-z]{3}$'),
 terms_revision text check(char_length(terms_revision) between 1 and 255),
 quote_revision text check(char_length(quote_revision) between 1 and 255),
 original_trial_end timestamptz not null check(isfinite(original_trial_end)),
 quote_expires_at timestamptz not null check(isfinite(quote_expires_at)),
 consented_at timestamptz check(isfinite(consented_at)),
 setup_session_id text unique check(char_length(setup_session_id) between 1 and 255),
 setup_intent_id text unique check(char_length(setup_intent_id) between 1 and 255),
 payment_method_id text check(char_length(payment_method_id) between 1 and 255),
 state text not null check(state in ('quoted','setup_pending','applying','applied','canceled','expired','failed')),
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp(),
 unique(user_id,request_id), unique(user_id,generation), unique(user_id,stripe_subscription_id,id),
 foreign key(user_id,stripe_subscription_id) references public.subscriptions(user_id,stripe_subscription_id),
 check(action<>'enable' or (plan_code is not null and billing_period is not null and price_id is not null and amount is not null
  and currency is not null and terms_revision is not null and quote_revision is not null)),
 check(state<>'applied' or (action='enable' and consented_at is not null and setup_session_id is not null and setup_intent_id is not null and payment_method_id is not null)),
 check(quote_expires_at<=original_trial_end)
);
create unique index one_unresolved_trial_mutation on public.subscription_trial_renewals(user_id) where state='applying';
alter table public.subscription_trial_renewals enable row level security;
revoke all on public.subscription_trial_renewals from public,anon,authenticated,service_role;
grant select on public.subscription_trial_renewals to service_role;
alter table public.account_subscription_trials
 add column trial_mode text not null default 'card_required' check(trial_mode in ('card_required','cardless')),
 add column trial_activation_id uuid unique,
 add column stripe_schedule_id text unique,
 add column renewal_operation_id uuid,
 add constraint trial_activation_owner foreign key(user_id,trial_activation_id) references public.subscription_trial_activations(user_id,id),
 add constraint trial_renewal_owner foreign key(user_id,stripe_subscription_id,renewal_operation_id) references public.subscription_trial_renewals(user_id,stripe_subscription_id,id),
 add constraint trial_mode_provenance check((trial_mode='cardless')=(trial_activation_id is not null) and (trial_mode='cardless')=(stripe_schedule_id is not null)
  and (trial_mode='cardless' or renewal_operation_id is null));

create or replace function public.preserve_subscription_trial_identity_v1()
returns trigger language plpgsql set search_path='' as $$
begin
 if (new.user_id,new.stripe_subscription_id,new.trial_started_at,new.trial_ends_at,new.created_at,new.trial_mode,new.trial_activation_id,new.stripe_schedule_id)
  is distinct from (old.user_id,old.stripe_subscription_id,old.trial_started_at,old.trial_ends_at,old.created_at,old.trial_mode,old.trial_activation_id,old.stripe_schedule_id)
 then raise exception 'TRIAL_IDENTITY_IMMUTABLE'; end if;
 if old.first_payment_state='paid' and (new.first_payment_state,new.first_invoice_id,new.first_paid_at) is distinct from
  (old.first_payment_state,old.first_invoice_id,old.first_paid_at) then raise exception 'TRIAL_PAYMENT_ALREADY_CONFIRMED'; end if;
 return new;
end $$;

create or replace function public.subscription_access_grants_v1(p_user_id uuid,p_at timestamptz)
returns table(plan_code text,expires_at timestamptz) language sql stable security invoker set search_path='' as $$
 select s.plan_code,b.expires_at from public.subscriptions s
 left join public.account_subscription_trials t on t.user_id=s.user_id and t.stripe_subscription_id=s.stripe_subscription_id
 left join public.subscription_trial_renewals r on r.id=t.renewal_operation_id and r.user_id=t.user_id and r.stripe_subscription_id=t.stripe_subscription_id
 cross join lateral(select case
  when t.trial_mode='cardless' and (r.id is null or r.state<>'applied' or r.action<>'enable') then t.trial_ends_at
  when t.user_id is null or t.first_payment_state='paid' then s.current_period_end
  when s.cancel_at_period_end or t.first_payment_state in ('failed','action_required') then t.trial_ends_at
  else t.trial_ends_at+interval '2 hours' end as expires_at) b
 where s.user_id=p_user_id and s.status in ('active','trialing') and s.plan_code in ('plus','pro') and b.expires_at>p_at;
$$;

create function public.reserve_cardless_trial_v1(p_user_id uuid,p_request_id uuid,p_plan_code text,p_billing_period text,p_price_id text,p_customer_id text,p_policy_revision bigint)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a public.subscription_trial_activations%rowtype; p public.hosting_commercial_policy%rowtype; authority jsonb; owned_customer text;
begin
 if p_user_id is null or p_request_id is null or p_plan_code is null or p_plan_code not in ('plus','pro')
  or p_billing_period is null or p_billing_period not in ('monthly','yearly') or p_price_id is null or char_length(p_price_id) not between 1 and 255
  or (p_customer_id is not null and char_length(p_customer_id) not between 1 and 255)
  or p_policy_revision is null then raise exception 'TRIAL_INPUT_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into a from public.subscription_trial_activations where user_id=p_user_id and request_id=p_request_id for update;
 if found then
  if (a.plan_code,a.billing_period,a.price_id,a.policy_revision) is distinct from
   (p_plan_code,p_billing_period,p_price_id,p_policy_revision)
   or (p_customer_id is not null and a.stripe_customer_id is distinct from p_customer_id)
   then raise exception 'TRIAL_REQUEST_MISMATCH'; end if;
  return to_jsonb(a);
 end if;
 if exists(select 1 from public.subscription_trial_activations where user_id=p_user_id and state<>'failed') then raise exception 'TRIAL_ACTIVATION_BUSY'; end if;
 if exists(select 1 from public.subscription_checkout_reservations c where c.user_id=p_user_id and
  (c.state in ('pending','open') or (c.state='complete' and not exists(select 1 from public.subscriptions s where s.stripe_subscription_id=c.stripe_subscription_id and s.status in ('canceled','incomplete_expired')))))
 then raise exception 'TRIAL_CHECKOUT_UNRESOLVED'; end if;
 select * into p from public.hosting_commercial_policy where singleton for share;
 if not found or not p.cardless_trials_enabled or not p.trials_enabled or p.activation_at is null or p.activation_at>clock_timestamp() then raise exception 'CARDLESS_TRIAL_UNAVAILABLE'; end if;
 if p.revision<>p_policy_revision then raise exception 'TRIAL_OFFER_CHANGED'; end if;
 select stripe_customer_id into owned_customer from public.billing_customers where user_id=p_user_id;
 if p_customer_id is not null and owned_customer is distinct from p_customer_id then raise exception 'TRIAL_CUSTOMER_MISMATCH'; end if;
 authority:=public.resolve_watch_history_access_v1(p_user_id);
 if authority#>>'{hosting,trialEligibility}' is distinct from 'eligible' then raise exception 'TRIAL_INELIGIBLE'; end if;
 insert into public.subscription_trial_activations(user_id,request_id,plan_code,billing_period,price_id,stripe_customer_id,policy_revision)
 values(p_user_id,p_request_id,p_plan_code,p_billing_period,p_price_id,owned_customer,p_policy_revision) returning * into a;
 return to_jsonb(a);
end $$;

-- Reserve account authority before creating a Customer; bind only the verified
-- Customer returned by this activation's stable Stripe idempotency key.
create function public.record_cardless_trial_customer_v1(p_user_id uuid,p_activation_id uuid,p_customer_id text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a public.subscription_trial_activations%rowtype;
begin
 if p_user_id is null or p_activation_id is null or p_customer_id is null or char_length(p_customer_id) not between 1 and 255
 then raise exception 'TRIAL_INPUT_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into a from public.subscription_trial_activations where user_id=p_user_id and id=p_activation_id for update;
 if not found or a.state='failed' then raise exception 'TRIAL_ACTIVATION_STALE'; end if;
 if (a.stripe_customer_id is not null and a.stripe_customer_id<>p_customer_id)
  or exists(select 1 from public.billing_customers where
   (user_id=p_user_id and stripe_customer_id<>p_customer_id) or (stripe_customer_id=p_customer_id and user_id<>p_user_id))
 then raise exception 'TRIAL_CUSTOMER_MISMATCH'; end if;
 insert into public.billing_customers(user_id,stripe_customer_id) values(p_user_id,p_customer_id) on conflict(user_id) do nothing;
 if not exists(select 1 from public.billing_customers where user_id=p_user_id and stripe_customer_id=p_customer_id)
 then raise exception 'TRIAL_CUSTOMER_MISMATCH'; end if;
 if a.stripe_customer_id is null then
  update public.subscription_trial_activations set stripe_customer_id=p_customer_id,updated_at=clock_timestamp() where id=a.id returning * into a;
 end if;
 return to_jsonb(a);
exception when unique_violation then raise exception 'TRIAL_CUSTOMER_MISMATCH';
end $$;

-- This guard also protects old application versions using the existing RPC.
create function public.guard_checkout_cardless_trial_v1() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
 if exists(select 1 from public.subscription_trial_activations a where a.user_id=new.user_id and
  (a.state in ('pending','created') or (a.state='committed' and exists(select 1 from public.subscriptions s where s.stripe_subscription_id=a.stripe_subscription_id and s.status not in ('canceled','incomplete_expired')))))
 then raise exception 'TRIAL_ACTIVATION_BUSY'; end if;
 return new;
end $$;
create trigger checkout_cardless_trial_guard before insert on public.subscription_checkout_reservations for each row execute function public.guard_checkout_cardless_trial_v1();

create function public.record_cardless_trial_created_v1(p_user_id uuid,p_activation_id uuid,p_customer_id text,p_schedule_id text,p_subscription_id text,p_price_id text,p_trial_start timestamptz,p_trial_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a public.subscription_trial_activations%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into a from public.subscription_trial_activations where user_id=p_user_id and id=p_activation_id for update;
 if not found or a.state='failed' then raise exception 'TRIAL_ACTIVATION_STALE'; end if;
 if a.stripe_customer_id is null or (a.stripe_customer_id,a.price_id) is distinct from (p_customer_id,p_price_id)
  or p_schedule_id is null or char_length(p_schedule_id) not between 1 and 255 or p_subscription_id is null or char_length(p_subscription_id) not between 1 and 255
  or p_trial_start is null or p_trial_end is null or not isfinite(p_trial_start) or not isfinite(p_trial_end)
  or p_trial_end<>p_trial_start+interval '72 hours' or p_trial_start<a.created_at-interval '5 minutes'
 then raise exception 'TRIAL_ACTIVATION_MISMATCH'; end if;
 if a.state in ('created','committed') then
  if (a.stripe_schedule_id,a.stripe_subscription_id,a.trial_started_at,a.trial_ends_at) is distinct from (p_schedule_id,p_subscription_id,p_trial_start,p_trial_end)
   then raise exception 'TRIAL_IDENTITY_IMMUTABLE'; end if;
 else
  update public.subscription_trial_activations set state='created',stripe_schedule_id=p_schedule_id,stripe_subscription_id=p_subscription_id,
   trial_started_at=p_trial_start,trial_ends_at=p_trial_end,updated_at=clock_timestamp() where id=a.id returning * into a;
 end if;
 return to_jsonb(a);
end $$;

create function public.reserve_trial_renewal_v1(p_user_id uuid,p_request_id uuid,p_subscription_id text,p_action text,p_terms jsonb)
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
 if p_action='enable' and (not (p_terms ?& array['planCode','billingPeriod','priceId','amount','currency','termsRevision','quoteRevision'])
  or p_terms->>'planCode' is null or p_terms->>'planCode' not in ('plus','pro') or p_terms->>'billingPeriod' is null or p_terms->>'billingPeriod' not in ('monthly','yearly')
  or p_terms->>'amount' is null or p_terms->>'amount' !~ '^[1-9][0-9]{0,8}$') then raise exception 'TRIAL_RENEWAL_INPUT_INVALID'; end if;
 select coalesce(max(generation),0)+1 into next_generation from public.subscription_trial_renewals where user_id=p_user_id;
 -- No external subscription mutation has begun in these states; safely supersede them.
 update public.subscription_trial_renewals set state='canceled',updated_at=clock_timestamp() where user_id=p_user_id and state in ('quoted','setup_pending');
 insert into public.subscription_trial_renewals(user_id,request_id,stripe_subscription_id,generation,action,terms,plan_code,billing_period,
  price_id,amount,currency,terms_revision,quote_revision,original_trial_end,quote_expires_at,state)
 values(p_user_id,p_request_id,p_subscription_id,next_generation,p_action,p_terms,p_terms->>'planCode',p_terms->>'billingPeriod',
  p_terms->>'priceId',(p_terms->>'amount')::bigint,p_terms->>'currency',p_terms->>'termsRevision',p_terms->>'quoteRevision',t.trial_ends_at,
  least(clock_timestamp()+interval '5 minutes',t.trial_ends_at),case when p_action='enable' then 'quoted' else 'applying' end) returning * into r;
 return to_jsonb(r);
end $$;

create function public.commit_trial_renewal_v1(p_user_id uuid,p_operation_id uuid,p_generation bigint,p_expected_state text,p_state text,p_snapshot jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare r public.subscription_trial_renewals%rowtype; t public.account_subscription_trials%rowtype; a public.subscription_trial_activations%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into r from public.subscription_trial_renewals where user_id=p_user_id and id=p_operation_id for update;
 if not found or r.generation is distinct from p_generation or r.generation<>(select max(generation) from public.subscription_trial_renewals where user_id=p_user_id)
 then raise exception 'TRIAL_RENEWAL_STALE'; end if;
 select * into strict t from public.account_subscription_trials where user_id=p_user_id and stripe_subscription_id=r.stripe_subscription_id for update;
 select * into strict a from public.subscription_trial_activations where user_id=p_user_id and id=t.trial_activation_id;
 if r.state=p_state then return to_jsonb(r); end if;
 if r.state is distinct from p_expected_state then raise exception 'TRIAL_RENEWAL_STATE_CONFLICT'; end if;
 if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' then raise exception 'TRIAL_RENEWAL_INPUT_INVALID'; end if;
 if r.state='quoted' and p_state='setup_pending' and r.action='enable' then
  if r.quote_expires_at<=clock_timestamp() or t.trial_ends_at<=clock_timestamp() then raise exception 'TRIAL_QUOTE_EXPIRED'; end if;
  update public.subscription_trial_renewals set consented_at=clock_timestamp() where id=r.id;
 elsif r.state='setup_pending' and p_state='applying' and r.action='enable' then
  if t.trial_ends_at<=clock_timestamp() then raise exception 'TRIAL_EXPIRED'; end if;
  if r.consented_at is null or not (p_snapshot ?& array['setupSessionId','setupIntentId','paymentMethodId'])
   or nullif(p_snapshot->>'setupSessionId','') is null or nullif(p_snapshot->>'setupIntentId','') is null or nullif(p_snapshot->>'paymentMethodId','') is null
   then raise exception 'TRIAL_SETUP_UNVERIFIED'; end if;
  update public.subscription_trial_renewals set setup_session_id=p_snapshot->>'setupSessionId',setup_intent_id=p_snapshot->>'setupIntentId',payment_method_id=p_snapshot->>'paymentMethodId' where id=r.id;
 elsif r.state='applying' and ((p_state='applied' and r.action='enable') or (p_state='canceled' and r.action='cancel')) then
  if p_snapshot->>'scheduleId' is distinct from a.stripe_schedule_id or p_snapshot->>'subscriptionId' is distinct from r.stripe_subscription_id
   or p_snapshot->>'customerId' is distinct from a.stripe_customer_id or (p_snapshot->>'trialEndsAt')::timestamptz is distinct from t.trial_ends_at
   or p_snapshot->>'endBehavior' is distinct from (case when p_state='applied' then 'release' else 'cancel' end)
   or (p_state='applied' and (p_snapshot->>'priceId' is distinct from r.price_id or p_snapshot->>'paymentMethodId' is distinct from r.payment_method_id))
  then raise exception 'TRIAL_RENEWAL_UNVERIFIED'; end if;
  update public.account_subscription_trials set renewal_operation_id=case when p_state='applied' then r.id else null end where user_id=p_user_id;
 elsif r.state in ('quoted','setup_pending') and p_state in ('canceled','expired','failed') then
  null; -- No subscription mutation was permitted yet.
 else raise exception 'TRIAL_RENEWAL_STATE_CONFLICT'; end if;
 update public.subscription_trial_renewals set state=p_state,updated_at=clock_timestamp() where id=r.id returning * into r;
 return to_jsonb(r);
end $$;

create function public.commit_stripe_subscription_refresh_v3(
 p_subscription_id text,p_fence bigint,p_token uuid,p_user_id uuid,p_customer_id text,
 p_price_id text,p_plan_code text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean,p_trial jsonb default null)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare t public.account_subscription_trials%rowtype; a public.subscription_trial_activations%rowtype; lease_expires timestamptz;
 trial_start timestamptz; trial_end timestamptz; payment_state text; invoice_id text; paid_at timestamptz; result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into t from public.account_subscription_trials where user_id=p_user_id for update;
 if coalesce(p_trial->>'trialMode','card_required')<>'cardless' and not (coalesce(t.trial_mode,'card_required')='cardless' and t.stripe_subscription_id=p_subscription_id) then
  return public.commit_stripe_subscription_refresh_v2(p_subscription_id,p_fence,p_token,p_user_id,p_customer_id,p_price_id,p_plan_code,p_status,p_period_end,p_cancel_at_period_end,p_trial);
 end if;
 if p_trial is null or jsonb_typeof(p_trial)<>'object' or p_trial->>'trialMode' is distinct from 'cardless'
  or not (p_trial ?& array['trialActivationId','stripeScheduleId','scheduleStatus','scheduleEndBehavior','trialStartedAt','trialEndsAt','firstPaymentState','firstInvoiceId','firstPaidAt'])
 then raise exception 'TRIAL_SNAPSHOT_INVALID'; end if;
 select * into a from public.subscription_trial_activations where user_id=p_user_id and id::text=p_trial->>'trialActivationId' for update;
 trial_start:=(p_trial->>'trialStartedAt')::timestamptz; trial_end:=(p_trial->>'trialEndsAt')::timestamptz;
 if not found or a.state not in ('created','committed')
  or (a.stripe_customer_id,a.stripe_subscription_id,a.stripe_schedule_id,a.trial_started_at,a.trial_ends_at) is distinct from
   (p_customer_id,p_subscription_id,p_trial->>'stripeScheduleId',trial_start,trial_end)
  or p_trial->>'scheduleStatus' is null or p_trial->>'scheduleStatus' not in ('active','completed','released','canceled')
  or p_trial->>'scheduleEndBehavior' is null or p_trial->>'scheduleEndBehavior' not in ('cancel','release')
 then raise exception 'TRIAL_ACTIVATION_MISMATCH'; end if;
 if t.user_id is not null and (t.trial_mode,t.stripe_subscription_id,t.trial_activation_id) is distinct from ('cardless',p_subscription_id,a.id) then raise exception 'TRIAL_ALREADY_USED'; end if;
 if (a.price_id,a.plan_code) is distinct from (p_price_id,p_plan_code) and coalesce(t.first_payment_state,'awaiting')<>'paid'
  and not exists(select 1 from public.subscription_trial_renewals r where r.user_id=p_user_id and r.stripe_subscription_id=p_subscription_id
   and r.state in ('applying','applied') and r.action='enable' and r.price_id=p_price_id and r.plan_code=p_plan_code)
 then raise exception 'TRIAL_ACTIVATION_MISMATCH'; end if;
 payment_state:=p_trial->>'firstPaymentState'; invoice_id:=p_trial->>'firstInvoiceId'; paid_at:=(p_trial->>'firstPaidAt')::timestamptz;
 if payment_state is null or payment_state not in ('awaiting','paid','failed','action_required') or (payment_state='paid')<>(paid_at is not null)
  or (paid_at is not null and (not isfinite(paid_at) or paid_at<trial_end or invoice_id is null))
  or (invoice_id is not null and char_length(invoice_id) not between 1 and 255) then raise exception 'TRIAL_SNAPSHOT_INVALID'; end if;
 if payment_state='paid' and not exists(select 1 from public.subscription_trial_renewals r where r.id=t.renewal_operation_id and r.user_id=p_user_id and r.stripe_subscription_id=p_subscription_id and r.state='applied' and r.action='enable')
 then raise exception 'TRIAL_RENEWAL_UNVERIFIED'; end if;
 select expires_at into lease_expires from public.stripe_subscription_refresh_leases where subscription_id=p_subscription_id for update;
 perform public.commit_stripe_subscription_refresh_v1(p_subscription_id,p_fence,p_token,p_user_id,p_customer_id,p_price_id,p_plan_code,p_status,p_period_end,p_cancel_at_period_end);
 if t.user_id is null then
  insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at,first_invoice_id,first_payment_state,first_paid_at,trial_mode,trial_activation_id,stripe_schedule_id)
  values(p_user_id,p_subscription_id,trial_start,trial_end,invoice_id,payment_state,paid_at,'cardless',a.id,a.stripe_schedule_id);
 else
  if (t.trial_started_at,t.trial_ends_at) is distinct from (trial_start,trial_end) then raise exception 'TRIAL_IDENTITY_IMMUTABLE'; end if;
  if t.first_invoice_id is not null and t.first_invoice_id is distinct from invoice_id then raise exception 'TRIAL_INVOICE_IDENTITY_IMMUTABLE'; end if;
  if t.first_payment_state<>'paid' then
   update public.account_subscription_trials set first_invoice_id=invoice_id,first_paid_at=paid_at,
    first_payment_state=case when payment_state='awaiting' and t.first_payment_state in ('failed','action_required') then t.first_payment_state else payment_state end where user_id=p_user_id;
  end if;
 end if;
 update public.subscription_trial_activations set state='committed',updated_at=clock_timestamp() where id=a.id and state='created';
 result:=public.resolve_watch_history_access_v1(p_user_id);
 if lease_expires is null or lease_expires<=clock_timestamp() then raise exception 'STRIPE_REFRESH_STALE'; end if;
 return result;
end $$;

revoke all on function public.reserve_cardless_trial_v1(uuid,uuid,text,text,text,text,bigint),
 public.record_cardless_trial_customer_v1(uuid,uuid,text),
 public.record_cardless_trial_created_v1(uuid,uuid,text,text,text,text,timestamptz,timestamptz),
 public.reserve_trial_renewal_v1(uuid,uuid,text,text,jsonb),public.commit_trial_renewal_v1(uuid,uuid,bigint,text,text,jsonb),
 public.commit_stripe_subscription_refresh_v3(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean,jsonb),
 public.guard_checkout_cardless_trial_v1() from public,anon,authenticated;
grant execute on function public.reserve_cardless_trial_v1(uuid,uuid,text,text,text,text,bigint),
 public.record_cardless_trial_customer_v1(uuid,uuid,text),
 public.record_cardless_trial_created_v1(uuid,uuid,text,text,text,text,timestamptz,timestamptz),
 public.reserve_trial_renewal_v1(uuid,uuid,text,text,jsonb),public.commit_trial_renewal_v1(uuid,uuid,bigint,text,text,jsonb),
 public.commit_stripe_subscription_refresh_v3(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean,jsonb) to service_role;

-- The compatible v2 definition with a cardless guard is appended below.
create or replace function public.commit_stripe_subscription_refresh_v2(
 p_subscription_id text,p_fence bigint,p_token uuid,p_user_id uuid,p_customer_id text,
 p_price_id text,p_plan_code text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean,
 p_trial jsonb default null)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='5s' set statement_timeout='15s' as $$
declare
 lease_expires timestamptz; prior public.account_subscription_trials%rowtype;
 reservation public.subscription_checkout_reservations%rowtype;
 trial_start timestamptz; trial_end timestamptz; payment_state text;
 invoice_id text; paid_at timestamptz; result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 if p_trial->>'trialMode'='cardless' or p_trial ? 'trialActivationId'
  or exists(select 1 from public.account_subscription_trials where user_id=p_user_id and stripe_subscription_id=p_subscription_id and trial_mode='cardless')
  or exists(select 1 from public.subscription_trial_activations where user_id=p_user_id and stripe_subscription_id=p_subscription_id)
 then raise exception 'TRIAL_REFRESH_V3_REQUIRED'; end if;
 select expires_at into lease_expires from public.stripe_subscription_refresh_leases
  where subscription_id=p_subscription_id for update;
 -- v1 validates owner/fence, repairs unavailable prior authority, updates the
 -- subscription mirror and rotates history capture fences. Its release remains
 -- locked inside this outer transaction until the trial and final resolver commit.
 perform public.commit_stripe_subscription_refresh_v1(p_subscription_id,p_fence,p_token,p_user_id,p_customer_id,
  p_price_id,p_plan_code,p_status,p_period_end,p_cancel_at_period_end);
 select * into prior from public.account_subscription_trials where user_id=p_user_id for update;
 if p_trial is null then
  if prior.stripe_subscription_id=p_subscription_id then raise exception 'TRIAL_SNAPSHOT_REQUIRED'; end if;
 else
  if jsonb_typeof(p_trial)<>'object' or not (p_trial ?& array[
   'trialStartedAt','trialEndsAt','firstPaymentState','firstInvoiceId','firstPaidAt'])
  then raise exception 'TRIAL_SNAPSHOT_INVALID'; end if;
  trial_start:=(p_trial->>'trialStartedAt')::timestamptz;
  trial_end:=(p_trial->>'trialEndsAt')::timestamptz;
  payment_state:=p_trial->>'firstPaymentState';
  invoice_id:=p_trial->>'firstInvoiceId';
  paid_at:=(p_trial->>'firstPaidAt')::timestamptz;
  if trial_start is null or trial_end is null or not isfinite(trial_start) or not isfinite(trial_end)
   or trial_end<>trial_start+interval '72 hours' or payment_state is null
   or payment_state not in ('awaiting','paid','failed','action_required')
   or (payment_state='paid')<>(paid_at is not null)
   or (paid_at is not null and (not isfinite(paid_at) or paid_at<trial_end or invoice_id is null))
   or (invoice_id is not null and char_length(invoice_id) not between 1 and 255)
  then raise exception 'TRIAL_SNAPSHOT_INVALID'; end if;
  if prior.user_id is not null then
   if prior.stripe_subscription_id<>p_subscription_id then raise exception 'TRIAL_ALREADY_USED'; end if;
   if prior.trial_started_at<>trial_start or prior.trial_ends_at<>trial_end then raise exception 'TRIAL_IDENTITY_IMMUTABLE'; end if;
   if prior.first_invoice_id is not null and prior.first_invoice_id is distinct from invoice_id
    then raise exception 'TRIAL_INVOICE_IDENTITY_IMMUTABLE'; end if;
   if prior.first_payment_state<>'paid' then
    update public.account_subscription_trials set first_invoice_id=invoice_id,
     first_payment_state=case when payment_state='awaiting' and prior.first_payment_state in ('failed','action_required')
      then prior.first_payment_state else payment_state end,
     first_paid_at=paid_at where user_id=p_user_id;
   end if;
  else
   select * into reservation from public.subscription_checkout_reservations where user_id=p_user_id for update;
   if not found or reservation.id::text is distinct from p_trial->>'checkoutReservationId'
    or not reservation.trial_offered or reservation.state='expired'
    or (reservation.stripe_subscription_id is not null and reservation.stripe_subscription_id<>p_subscription_id)
    or trial_start<reservation.created_at-interval '5 minutes'
   then raise exception 'TRIAL_RESERVATION_INVALID'; end if;
   insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at,
    first_invoice_id,first_payment_state,first_paid_at)
   values(p_user_id,p_subscription_id,trial_start,trial_end,invoice_id,payment_state,paid_at);
  end if;
 end if;
 result:=public.resolve_watch_history_access_v1(p_user_id);
 if lease_expires is null or lease_expires<=clock_timestamp() then raise exception 'STRIPE_REFRESH_STALE'; end if;
 return result;
end $$;
revoke all on function public.commit_stripe_subscription_refresh_v2(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean,jsonb)
 from public,anon,authenticated;
grant execute on function public.commit_stripe_subscription_refresh_v2(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean,jsonb)
 to service_role;

reset lock_timeout;
reset statement_timeout;
