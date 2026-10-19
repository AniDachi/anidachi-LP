-- Fenced admission and explicit operator recovery; no timeout releases account authority.
set lock_timeout='5s';
set statement_timeout='30s';
alter table public.subscription_trial_activations add column recovery_hold_at timestamptz;
create table public.subscription_trial_activation_attempts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 activation_id uuid not null,
 kind text not null check(kind in ('customer','schedule')),
 idempotency_key text not null,
 outcome text not null default 'applying' check(outcome in ('applying','unknown','succeeded','no_effect')),
 object_id text check(char_length(object_id) between 1 and 255),
 request_id text check(request_id~'^req_[A-Za-z0-9_]+$' and char_length(request_id)<=255),
 created_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz,
 foreign key(user_id,activation_id) references public.subscription_trial_activations(user_id,id) on delete cascade,
 check((outcome='succeeded')=(object_id is not null)),
 check((outcome='applying')=(finished_at is null))
);
create unique index one_applying_trial_create on public.subscription_trial_activation_attempts(activation_id) where outcome='applying';
alter table public.subscription_trial_activation_attempts enable row level security;
revoke all on public.subscription_trial_activation_attempts from public,anon,authenticated,service_role;
grant select on public.subscription_trial_activation_attempts to service_role;
create table anidachi_private.trial_activation_recovery_audit (
 id uuid primary key default gen_random_uuid(),
 activation_id uuid not null references public.subscription_trial_activations(id) on delete cascade,
 attempt_id uuid references public.subscription_trial_activation_attempts(id) on delete cascade,
 action text not null check(action in ('hold','resume','reconcile','failed')),
 actor text not null default session_user,
 provider_evidence text,
 executor_evidence text,
 occurred_at timestamptz not null default clock_timestamp()
);
alter table anidachi_private.trial_activation_recovery_audit enable row level security;
revoke all on anidachi_private.trial_activation_recovery_audit from public,anon,authenticated,service_role;
grant select,insert on anidachi_private.trial_activation_recovery_audit to postgres;

create function public.begin_cardless_trial_attempt_v1(p_user_id uuid,p_activation_id uuid,p_kind text,p_key text)
returns uuid language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a public.subscription_trial_activations%rowtype; attempt uuid;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into a from public.subscription_trial_activations where user_id=p_user_id and id=p_activation_id for update;
 if not found or a.state<>'pending' then raise exception 'TRIAL_ACTIVATION_STALE'; end if;
 if a.recovery_hold_at is not null then raise exception 'TRIAL_RECOVERY_HELD'; end if;
 if p_kind is null or p_kind not in ('customer','schedule') or p_key is distinct from
  (case when p_kind='customer' then 'trial-customer:'||a.id::text else a.idempotency_key end)
  or (p_kind='customer' and a.stripe_customer_id is not null) or (p_kind='schedule' and a.stripe_customer_id is null)
 then raise exception 'TRIAL_ATTEMPT_INPUT_INVALID'; end if;
 if a.created_at<=clock_timestamp()-interval '23 hours' then raise exception 'TRIAL_REPLAY_WINDOW_ENDED'; end if;
 if exists(select 1 from public.subscription_trial_activation_attempts where activation_id=a.id and outcome='applying') then raise exception 'TRIAL_ATTEMPT_BUSY'; end if;
 insert into public.subscription_trial_activation_attempts(user_id,activation_id,kind,idempotency_key) values(p_user_id,a.id,p_kind,p_key) returning id into attempt;
 return attempt;
end $$;
create function public.finish_cardless_trial_attempt_v1(p_user_id uuid,p_activation_id uuid,p_attempt_id uuid,p_outcome text,p_object_id text,p_request_id text)
returns void language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a public.subscription_trial_activation_attempts%rowtype;
begin
 if p_outcome is null or p_outcome not in ('unknown','succeeded') or ((p_outcome='succeeded') is distinct from (p_object_id is not null)) then raise exception 'TRIAL_ATTEMPT_INPUT_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into a from public.subscription_trial_activation_attempts where user_id=p_user_id and activation_id=p_activation_id and id=p_attempt_id for update;
 if not found then raise exception 'TRIAL_ATTEMPT_STALE'; end if;
 if a.outcome<>'applying' then
  if (a.outcome,a.object_id,a.request_id) is distinct from (p_outcome,p_object_id,p_request_id) then raise exception 'TRIAL_ATTEMPT_STALE'; end if;
  return;
 end if;
 -- A held operation still records an already-issued response; hold never means no external effect.
 update public.subscription_trial_activation_attempts set outcome=p_outcome,object_id=p_object_id,request_id=p_request_id,finished_at=clock_timestamp() where id=a.id;
end $$;

create function anidachi_private.hold_cardless_trial_activation_v1(p_user_id uuid,p_activation_id uuid,p_key text,p_hold boolean)
returns void language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a public.subscription_trial_activations%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into a from public.subscription_trial_activations where user_id=p_user_id and id=p_activation_id for update;
 if not found or a.state<>'pending' or a.idempotency_key is distinct from p_key or p_hold is null then raise exception 'TRIAL_ACTIVATION_MISMATCH'; end if;
 update public.subscription_trial_activations set recovery_hold_at=case when p_hold then coalesce(a.recovery_hold_at,clock_timestamp()) else null end where id=a.id;
 insert into anidachi_private.trial_activation_recovery_audit(activation_id,action) values(a.id,case when p_hold then 'hold' else 'resume' end);
end $$;

-- Trusted operator attestation is necessary. Age, process termination, HTTP 400,
-- or an empty object search alone never establish no external effect.
create function anidachi_private.reconcile_cardless_trial_attempt_v1(
 p_user_id uuid,p_activation_id uuid,p_attempt_id uuid,p_outcome text,p_object_id text,p_request_id text,p_provider_evidence text,p_executor_evidence text)
returns void language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a public.subscription_trial_activations%rowtype; x public.subscription_trial_activation_attempts%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into a from public.subscription_trial_activations where user_id=p_user_id and id=p_activation_id for update;
 if not found or a.state<>'pending' or a.recovery_hold_at is null then raise exception 'TRIAL_RECOVERY_HOLD_REQUIRED'; end if;
 if a.recovery_hold_at>clock_timestamp()-interval '5 minutes' then raise exception 'TRIAL_RECOVERY_DRAIN_REQUIRED'; end if;
 if p_outcome is null or p_outcome not in ('succeeded','no_effect') or ((p_outcome='succeeded') is distinct from (p_object_id is not null))
  or p_provider_evidence is null or char_length(p_provider_evidence) not between 32 and 2000
  or p_executor_evidence is null or char_length(p_executor_evidence) not between 32 and 2000
 then raise exception 'TRIAL_RECOVERY_EVIDENCE_REQUIRED'; end if;
 select * into x from public.subscription_trial_activation_attempts where user_id=p_user_id and activation_id=a.id and id=p_attempt_id for update;
 if not found or x.outcome not in ('applying','unknown') or (x.request_id is not null and x.request_id is distinct from p_request_id) then raise exception 'TRIAL_ATTEMPT_STALE'; end if;
 update public.subscription_trial_activation_attempts set outcome=p_outcome,object_id=p_object_id,request_id=p_request_id,finished_at=clock_timestamp() where id=x.id;
 insert into anidachi_private.trial_activation_recovery_audit(activation_id,attempt_id,action,provider_evidence,executor_evidence)
 values(a.id,x.id,'reconcile',p_provider_evidence,p_executor_evidence);
end $$;
create function anidachi_private.settle_cardless_trial_activation_v1(p_user_id uuid,p_activation_id uuid,p_key text,p_created_at timestamptz,p_evidence text)
returns void language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a public.subscription_trial_activations%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into a from public.subscription_trial_activations where user_id=p_user_id and id=p_activation_id for update;
 if not found or a.state<>'pending' or a.idempotency_key is distinct from p_key or a.created_at is distinct from p_created_at then raise exception 'TRIAL_ACTIVATION_MISMATCH'; end if;
 if a.recovery_hold_at is null then raise exception 'TRIAL_RECOVERY_HOLD_REQUIRED'; end if;
 if p_evidence is null or char_length(p_evidence) not between 32 and 2000 then raise exception 'TRIAL_RECOVERY_EVIDENCE_REQUIRED'; end if;
 if exists(select 1 from public.subscription_trial_activation_attempts where activation_id=a.id and outcome in ('applying','unknown')) then raise exception 'TRIAL_ATTEMPT_UNRESOLVED'; end if;
 if a.stripe_schedule_id is not null or a.stripe_subscription_id is not null
  or exists(select 1 from public.account_subscription_trials where user_id=p_user_id)
  or exists(select 1 from public.subscription_trial_activation_attempts where activation_id=a.id and kind='schedule' and outcome='succeeded')
 then raise exception 'TRIAL_EXTERNAL_EFFECT_EXISTS'; end if;
 if exists(select 1 from public.subscription_trial_activation_attempts x where x.activation_id=a.id and x.kind='customer' and x.outcome='succeeded'
  and (a.stripe_customer_id is distinct from x.object_id or not exists(select 1 from public.billing_customers b where b.user_id=p_user_id and b.stripe_customer_id=x.object_id)))
 then raise exception 'TRIAL_CUSTOMER_RECONCILIATION_REQUIRED'; end if;
 update public.subscription_trial_activations set state='failed',updated_at=clock_timestamp() where id=a.id;
 insert into anidachi_private.trial_activation_recovery_audit(activation_id,action,provider_evidence) values(a.id,'failed',p_evidence);
end $$;
revoke all on function public.begin_cardless_trial_attempt_v1(uuid,uuid,text,text),public.finish_cardless_trial_attempt_v1(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.begin_cardless_trial_attempt_v1(uuid,uuid,text,text),public.finish_cardless_trial_attempt_v1(uuid,uuid,uuid,text,text,text) to service_role;
revoke all on function anidachi_private.hold_cardless_trial_activation_v1(uuid,uuid,text,boolean),
 anidachi_private.reconcile_cardless_trial_attempt_v1(uuid,uuid,uuid,text,text,text,text,text),
 anidachi_private.settle_cardless_trial_activation_v1(uuid,uuid,text,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function anidachi_private.hold_cardless_trial_activation_v1(uuid,uuid,text,boolean),
 anidachi_private.reconcile_cardless_trial_attempt_v1(uuid,uuid,uuid,text,text,text,text,text),
 anidachi_private.settle_cardless_trial_activation_v1(uuid,uuid,text,timestamptz,text) to postgres;

-- Access settlement and cash conversion are distinct. Historical rows stay unchanged.
alter table public.account_subscription_trials
 add column first_cash_invoice_id text,
 add column first_cash_paid_at timestamptz,
 add column first_cash_amount_paid bigint,
 add constraint trial_cash_proof check(
  (first_cash_invoice_id is null and first_cash_paid_at is null and first_cash_amount_paid is null)
  or (first_cash_invoice_id is not null and char_length(first_cash_invoice_id) between 1 and 255
   and first_cash_paid_at is not null and isfinite(first_cash_paid_at) and first_cash_paid_at>=trial_ends_at
   and first_cash_amount_paid is not null and first_cash_amount_paid>0 and first_payment_state='paid' and trial_mode='cardless'));
create function public.preserve_trial_cash_proof_v1() returns trigger language plpgsql set search_path='' as $$
begin
 if old.first_cash_invoice_id is not null and (new.first_cash_invoice_id,new.first_cash_paid_at,new.first_cash_amount_paid) is distinct from (old.first_cash_invoice_id,old.first_cash_paid_at,old.first_cash_amount_paid)
 then raise exception 'TRIAL_CASH_PROOF_IMMUTABLE'; end if;
 return new;
end $$;
create trigger preserve_trial_cash_proof before update on public.account_subscription_trials for each row execute function public.preserve_trial_cash_proof_v1();
revoke all on function public.preserve_trial_cash_proof_v1() from public,anon,authenticated,service_role;
create or replace function public.commit_stripe_subscription_refresh_v3(
 p_subscription_id text,p_fence bigint,p_token uuid,p_user_id uuid,p_customer_id text,
 p_price_id text,p_plan_code text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean,p_trial jsonb default null)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare t public.account_subscription_trials%rowtype; a public.subscription_trial_activations%rowtype; lease_expires timestamptz;
 cash_id text; cash_at timestamptz; cash_amount bigint; trial_start timestamptz; trial_end timestamptz; payment_state text; invoice_id text; paid_at timestamptz; result jsonb;
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
 cash_id:=p_trial->>'firstCashInvoiceId'; cash_at:=(p_trial->>'firstCashPaidAt')::timestamptz; cash_amount:=(p_trial->>'firstCashAmountPaid')::bigint;
 if (cash_id is null and (cash_at is not null or cash_amount is not null))
  or (cash_id is not null and (payment_state<>'paid' or char_length(cash_id) not between 1 and 255 or cash_at is null or not isfinite(cash_at) or cash_at<trial_end or cash_amount is null or cash_amount<=0))
 then raise exception 'TRIAL_CASH_PROOF_INVALID'; end if;
 if t.first_cash_invoice_id is not null and cash_id is not null and (t.first_cash_invoice_id,t.first_cash_paid_at,t.first_cash_amount_paid) is distinct from (cash_id,cash_at,cash_amount)
 then raise exception 'TRIAL_CASH_PROOF_IMMUTABLE'; end if;
 select expires_at into lease_expires from public.stripe_subscription_refresh_leases where subscription_id=p_subscription_id for update;
 perform public.commit_stripe_subscription_refresh_v1(p_subscription_id,p_fence,p_token,p_user_id,p_customer_id,p_price_id,p_plan_code,p_status,p_period_end,p_cancel_at_period_end);
 if t.user_id is null then
  insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at,first_invoice_id,first_payment_state,first_paid_at,trial_mode,trial_activation_id,stripe_schedule_id,first_cash_invoice_id,first_cash_paid_at,first_cash_amount_paid)
  values(p_user_id,p_subscription_id,trial_start,trial_end,invoice_id,payment_state,paid_at,'cardless',a.id,a.stripe_schedule_id,cash_id,cash_at,cash_amount);
 else
  if (t.trial_started_at,t.trial_ends_at) is distinct from (trial_start,trial_end) then raise exception 'TRIAL_IDENTITY_IMMUTABLE'; end if;
  if t.first_invoice_id is not null and t.first_invoice_id is distinct from invoice_id then raise exception 'TRIAL_INVOICE_IDENTITY_IMMUTABLE'; end if;
  if t.first_payment_state<>'paid' then
   update public.account_subscription_trials set first_invoice_id=invoice_id,first_paid_at=paid_at,
    first_payment_state=case when payment_state='awaiting' and t.first_payment_state in ('failed','action_required') then t.first_payment_state else payment_state end where user_id=p_user_id;
  end if;
 end if;
 if cash_id is not null and t.first_cash_invoice_id is null then
  update public.account_subscription_trials set first_cash_invoice_id=cash_id,first_cash_paid_at=cash_at,first_cash_amount_paid=cash_amount where user_id=p_user_id and first_cash_invoice_id is null;
 end if;
 update public.subscription_trial_activations set state='committed' ,updated_at=clock_timestamp() where id=a.id and state='created';
 result:=public.resolve_watch_history_access_v1(p_user_id);
 if lease_expires is null or lease_expires<=clock_timestamp() then raise exception 'STRIPE_REFRESH_STALE'; end if;
 return result;
end $$;

create or replace function public.enqueue_trial_conversion_v1(p_event_type text,p_user_id uuid,p_source_id text,p_at timestamptz,p_plan text default null,p_period text default null)
returns void language plpgsql security definer set search_path='' as $$
declare t public.account_subscription_trials%rowtype; a public.subscription_trial_activations%rowtype; r public.subscription_trial_renewals%rowtype; env text;
begin
 select * into t from public.account_subscription_trials where user_id=p_user_id and trial_mode='cardless';
 if not found then return; end if;
 select * into strict a from public.subscription_trial_activations where id=t.trial_activation_id and user_id=p_user_id;
 if p_event_type in ('trial_first_room_created','trial_first_shared_session') and (p_at<t.trial_started_at or p_at>=t.trial_ends_at) then return; end if;
 if p_event_type='trial_first_payment_succeeded' then
  if t.first_payment_state<>'paid' or t.first_cash_invoice_id is null or t.first_cash_paid_at is null or coalesce(t.first_cash_amount_paid,0)<=0 or p_source_id is distinct from t.first_cash_invoice_id or p_at is distinct from t.first_cash_paid_at then return; end if;
  select * into r from public.subscription_trial_renewals where id=t.renewal_operation_id and state='applied' and action='enable';
 end if;
 select environment into env from anidachi_private.trial_event_scheduler where singleton;
 insert into public.trial_conversion_events(user_id,activation_id,event_type,source_id,plan_code,billing_period,occurred_at,environment)
 values(p_user_id,a.id,p_event_type,p_source_id,coalesce(p_plan,r.plan_code,a.plan_code),coalesce(p_period,r.billing_period,a.billing_period),p_at,env)
 on conflict(event_type,source_id) do nothing;
end $$;
revoke all on function public.enqueue_trial_conversion_v1(text,uuid,text,timestamptz,text,text) from public,anon,authenticated,service_role;

create or replace function public.record_trial_ledger_conversion_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.trial_mode<>'cardless' then return new; end if;
 if tg_op='INSERT' then
  perform public.enqueue_trial_conversion_v1('trial_started',new.user_id,new.trial_activation_id::text,new.trial_started_at);
 end if;
 if new.first_cash_invoice_id is not null and (tg_op='INSERT' or old.first_cash_invoice_id is null) then
  perform public.enqueue_trial_conversion_v1('trial_first_payment_succeeded',new.user_id,new.first_cash_invoice_id,new.first_cash_paid_at);
 end if;
 return new;
end $$;
