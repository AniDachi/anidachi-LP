-- Dormant, additive prerequisite. Activation is an operator action after coverage
-- and staging acceptance, never a side effect of deploying this migration.
set lock_timeout = '5s';
set statement_timeout = '30s';

create table public.hosting_commercial_policy (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 1 check (revision > 0),
  activation_at timestamptz check (isfinite(activation_at)),
  trials_enabled boolean not null default false,
  check (not trials_enabled or activation_at is not null)
);
insert into public.hosting_commercial_policy(singleton) values (true);
alter table public.hosting_commercial_policy enable row level security;
revoke all on public.hosting_commercial_policy from public,anon,authenticated,service_role;
grant select on public.hosting_commercial_policy to service_role;

-- A row means a verified trial subscription was created, never merely a checkout.
-- Original identity/end stay immutable, including after cancellation or plan changes.
alter table public.subscriptions add constraint subscriptions_trial_owner_unique
  unique (user_id,stripe_subscription_id);
create table public.account_subscription_trials (
  user_id uuid primary key references public.users(id) on delete cascade,
  stripe_subscription_id text not null unique,
  trial_started_at timestamptz not null check (isfinite(trial_started_at)),
  trial_ends_at timestamptz not null check (isfinite(trial_ends_at)),
  first_invoice_id text unique,
  first_payment_state text not null default 'awaiting'
    check (first_payment_state in ('awaiting','paid','failed','action_required')),
  first_paid_at timestamptz check (isfinite(first_paid_at)),
  created_at timestamptz not null default clock_timestamp(),
  check (trial_ends_at=trial_started_at+interval '72 hours'),
  check ((first_payment_state='paid')=(first_paid_at is not null)),
  check (first_payment_state<>'paid' or first_invoice_id is not null),
  foreign key (user_id,stripe_subscription_id)
    references public.subscriptions(user_id,stripe_subscription_id)
);
alter table public.account_subscription_trials enable row level security;
revoke all on public.account_subscription_trials from public,anon,authenticated,service_role;
grant select,insert,update on public.account_subscription_trials to service_role;

create function public.preserve_subscription_trial_identity_v1()
returns trigger language plpgsql set search_path='' as $$
begin
  if (new.user_id,new.stripe_subscription_id,new.trial_started_at,new.trial_ends_at,new.created_at)
    is distinct from
    (old.user_id,old.stripe_subscription_id,old.trial_started_at,old.trial_ends_at,old.created_at)
  then raise exception 'TRIAL_IDENTITY_IMMUTABLE' using errcode='P0001'; end if;
  if old.first_payment_state='paid' and
    (new.first_payment_state,new.first_invoice_id,new.first_paid_at) is distinct from
    (old.first_payment_state,old.first_invoice_id,old.first_paid_at)
  then raise exception 'TRIAL_PAYMENT_ALREADY_CONFIRMED' using errcode='P0001'; end if;
  return new;
end $$;
revoke all on function public.preserve_subscription_trial_identity_v1() from public,anon,authenticated;
create trigger preserve_subscription_trial_identity before update on public.account_subscription_trials
for each row execute function public.preserve_subscription_trial_identity_v1();

-- One effective grant calculation for both hosting and personal history.
-- Legacy paid subscriptions/manual grants retain their existing semantics.
-- p_at is server-owned. This helper does not issue a lease or accept browser input.
create function public.subscription_access_grants_v1(p_user_id uuid,p_at timestamptz)
returns table(plan_code text,expires_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select s.plan_code, boundary.expires_at
  from public.subscriptions s
  left join public.account_subscription_trials t
    on t.user_id=s.user_id and t.stripe_subscription_id=s.stripe_subscription_id
  cross join lateral (
    select case
      when t.user_id is null or t.first_payment_state='paid' then s.current_period_end
      when s.cancel_at_period_end or t.first_payment_state in ('failed','action_required')
        then t.trial_ends_at
      else t.trial_ends_at+interval '2 hours'
    end as expires_at
  ) boundary
  where s.user_id=p_user_id and s.status in ('active','trialing')
    and s.plan_code in ('plus','pro') and boundary.expires_at>p_at;
$$;
revoke all on function public.subscription_access_grants_v1(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.subscription_access_grants_v1(uuid,timestamptz) to service_role;

create or replace function public.resolve_watch_history_access_v1(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '5s' set statement_timeout = '15s' as $$
declare
  s public.user_watch_settings%rowtype;
  at_time timestamptz;
  best_plan text := 'free';
  history_until timestamptz;
  plan_until timestamptz;
  allowed boolean;
  mirror_plan text;
  hosting_policy public.hosting_commercial_policy%rowtype;
  joined_at timestamptz;
  trial_record public.account_subscription_trials%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
  select plan,created_at into mirror_plan,joined_at from public.users where id=p_user_id;
  if not found then raise exception 'HISTORY_ACCESS_UNAVAILABLE' using errcode='P0001'; end if;
  select * into hosting_policy from public.hosting_commercial_policy where singleton;
  if not found then raise exception 'HISTORY_ACCESS_UNAVAILABLE' using errcode='P0001'; end if;
  select * into trial_record from public.account_subscription_trials where user_id=p_user_id;
  -- A post-migration unexplained paid mirror is unavailable, never implicit Free.
  if mirror_plan in ('plus','pro')
    and not exists(select 1 from public.subscriptions where user_id=p_user_id)
    and not exists(select 1 from public.account_manual_plan_grants where user_id=p_user_id)
  then raise exception 'HISTORY_ACCESS_UNAVAILABLE' using errcode='P0001'; end if;
  if exists(select 1 from public.subscriptions where user_id=p_user_id and status in ('active','trialing')
      and (current_period_end is null or plan_code not in ('plus','pro'))) then
    raise exception 'HISTORY_ACCESS_UNAVAILABLE' using errcode='P0001';
  end if;
  insert into public.user_watch_settings(user_id,write_schema_version) values(p_user_id,3) on conflict do nothing;
  select * into strict s from public.user_watch_settings where user_id=p_user_id for update;
  at_time := clock_timestamp();
  -- Notice an elapsed known paid boundary even if renewal arrives before the next read.
  if s.history_access_enabled and s.history_access_expires_at <= at_time then
    update public.user_watch_settings set history_access_enabled=false, access_epoch=access_epoch+1,
      capture_not_before=at_time, history_access_expires_at=null where user_id=p_user_id returning * into s;
  end if;
  with grants as (
    select plan_code,expires_at as expires from public.subscription_access_grants_v1(p_user_id,at_time)
    union all
    select plan_code,coalesce(valid_until,'infinity'::timestamptz) from public.account_manual_plan_grants
      where user_id=p_user_id and (valid_until is null or valid_until>at_time)
  )
  select coalesce(max(plan_code),'free'),max(expires) into best_plan,history_until from grants;
  -- plus < pro lexically; explicit CHECKs constrain all grants to these two values.
  with grants as (
    select plan_code,expires_at as expires from public.subscription_access_grants_v1(p_user_id,at_time)
    union all
    select plan_code,coalesce(valid_until,'infinity'::timestamptz) from public.account_manual_plan_grants
      where user_id=p_user_id and (valid_until is null or valid_until>at_time)
  ) select max(expires) into plan_until from grants where plan_code=best_plan;
  allowed := best_plan <> 'free';
  if s.history_access_enabled <> allowed then
    update public.user_watch_settings set history_access_enabled=allowed,access_epoch=access_epoch+1,
      capture_not_before=at_time where user_id=p_user_id returning * into s;
  end if;
  update public.user_watch_settings set history_access_expires_at=nullif(history_until,'infinity'::timestamptz)
    where user_id=p_user_id;
  update public.users set plan=best_plan where id=p_user_id and plan is distinct from best_plan;
  return jsonb_build_object(
    'hosting',jsonb_build_object(
      'hostingPolicyVersion',hosting_policy.revision,
      'hostingActivationAt',hosting_policy.activation_at,
      'canHost',hosting_policy.activation_at is null or at_time<hosting_policy.activation_at or allowed,
      'trialEligibility',case
        when trial_record.user_id is not null then 'used'
        when hosting_policy.activation_at is null or at_time<hosting_policy.activation_at then 'unavailable'
        when joined_at<hosting_policy.activation_at then 'existing_account'
        when not hosting_policy.trials_enabled or allowed then 'unavailable'
        else 'eligible' end,
      'trialEndsAt',trial_record.trial_ends_at),
    'planCode',best_plan,'paidUntil',nullif(history_until,'infinity'::timestamptz),
    'selectedPlanExpiresAt',nullif(plan_until,'infinity'::timestamptz),
    'history',jsonb_build_object('accessVersion',1,'ownerUserId',p_user_id,
      'accountGeneration',s.history_generation,'accessEpoch',s.access_epoch,
      'youtubeConsentEpoch',s.youtube_consent_epoch,
      'state',case when allowed then 'allowed' else 'plan_required' end,
      'serverTime',at_time,'captureNotBefore',s.capture_not_before,
      'validUntil',case when allowed then least(at_time+interval '5 minutes',history_until) else at_time+interval '5 minutes' end,
      'youtubeHistoryEnabled',s.youtube_history_enabled));
end $$;
revoke all on function public.resolve_watch_history_access_v1(uuid) from public, anon, authenticated;
grant execute on function public.resolve_watch_history_access_v1(uuid) to service_role;


reset lock_timeout;
reset statement_timeout;
