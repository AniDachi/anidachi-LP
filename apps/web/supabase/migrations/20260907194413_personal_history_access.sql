-- Additive prerequisite only: no legacy history RPC/capture activation here.
set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.user_watch_settings
  add column access_epoch bigint not null default 0 check (access_epoch >= 0),
  add column youtube_consent_epoch bigint not null default 0 check (youtube_consent_epoch >= 0),
  add column history_access_enabled boolean not null default false,
  add column history_access_expires_at timestamptz,
  add column capture_not_before timestamptz not null default clock_timestamp();

-- Preserve existing explicit paid mirrors without inventing a Stripe subscription.
-- Operators can inspect/revoke these grants explicitly; a billing refresh never erases them.
create table public.account_manual_plan_grants (
  user_id uuid primary key references public.users(id) on delete cascade,
  plan_code text not null check (plan_code in ('plus','pro')),
  valid_until timestamptz,
  reason text not null check (char_length(reason) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.account_manual_plan_grants enable row level security;
revoke all on table public.account_manual_plan_grants from public, anon, authenticated;
grant all on table public.account_manual_plan_grants to service_role;
insert into public.account_manual_plan_grants(user_id,plan_code,reason)
select u.id,u.plan,'Migration: existing paid user mirror with no subscription history; explicit legacy/manual grant'
from public.users u where u.plan in ('plus','pro')
  and not exists (select 1 from public.subscriptions s where s.user_id=u.id);

create table public.stripe_subscription_refresh_leases (
  subscription_id text primary key check (char_length(subscription_id) between 1 and 255),
  fence bigint not null default 0 check (fence >= 0),
  token uuid,
  expires_at timestamptz not null default '-infinity'
);
alter table public.stripe_subscription_refresh_leases enable row level security;
revoke all on table public.stripe_subscription_refresh_leases from public, anon, authenticated;
grant all on table public.stripe_subscription_refresh_leases to service_role;

create function public.resolve_watch_history_access_v1(p_user_id uuid)
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
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
  select plan into mirror_plan from public.users where id=p_user_id;
  if not found then raise exception 'HISTORY_ACCESS_UNAVAILABLE' using errcode='P0001'; end if;
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
    select plan_code, current_period_end as expires from public.subscriptions
      where user_id=p_user_id and status in ('active','trialing') and current_period_end>at_time
    union all
    select plan_code,coalesce(valid_until,'infinity'::timestamptz) from public.account_manual_plan_grants
      where user_id=p_user_id and (valid_until is null or valid_until>at_time)
  )
  select coalesce(max(plan_code),'free'),max(expires) into best_plan,history_until from grants;
  -- plus < pro lexically; explicit CHECKs constrain all grants to these two values.
  with grants as (
    select plan_code,current_period_end as expires from public.subscriptions
      where user_id=p_user_id and status in ('active','trialing') and current_period_end>at_time
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

-- Acquire and commit BEFORE Stripe retrieval. Busy callers must retry delivery.
create function public.begin_stripe_subscription_refresh_v1(p_subscription_id text)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '5s' set statement_timeout = '15s' as $$
declare r public.stripe_subscription_refresh_leases%rowtype;
begin
  insert into public.stripe_subscription_refresh_leases(subscription_id) values(p_subscription_id) on conflict do nothing;
  select * into strict r from public.stripe_subscription_refresh_leases where subscription_id=p_subscription_id for update;
  if r.expires_at>clock_timestamp() then return null; end if;
  update public.stripe_subscription_refresh_leases set fence=fence+1,token=gen_random_uuid(),
    expires_at=clock_timestamp()+interval '30 seconds' where subscription_id=p_subscription_id returning * into r;
  return jsonb_build_object('fence',r.fence,'token',r.token);
end $$;
revoke all on function public.begin_stripe_subscription_refresh_v1(text) from public, anon, authenticated;
grant execute on function public.begin_stripe_subscription_refresh_v1(text) to service_role;

create function public.release_stripe_subscription_refresh_v1(p_subscription_id text,p_fence bigint,p_token uuid)
returns void language sql security definer set search_path = ''
set lock_timeout = '5s' set statement_timeout = '15s' as $$
  update public.stripe_subscription_refresh_leases set expires_at='-infinity',token=null
    where subscription_id=p_subscription_id and fence=p_fence and token=p_token;
$$;
revoke all on function public.release_stripe_subscription_refresh_v1(text,bigint,uuid) from public, anon, authenticated;
grant execute on function public.release_stripe_subscription_refresh_v1(text,bigint,uuid) to service_role;

create function public.commit_stripe_subscription_refresh_v1(
 p_subscription_id text,p_fence bigint,p_token uuid,p_user_id uuid,p_customer_id text,
 p_price_id text,p_plan_code text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean)
returns jsonb language plpgsql security definer set search_path = ''
set lock_timeout = '5s' set statement_timeout = '15s' as $$
declare r public.stripe_subscription_refresh_leases%rowtype; result jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
  select * into strict r from public.stripe_subscription_refresh_leases where subscription_id=p_subscription_id for update;
  if r.fence<>p_fence or r.token is distinct from p_token or r.expires_at<=clock_timestamp() then
    raise exception 'STRIPE_REFRESH_STALE' using errcode='P0001';
  end if;
  if exists(select 1 from public.subscriptions where stripe_subscription_id=p_subscription_id
    and (user_id<>p_user_id or stripe_customer_id<>p_customer_id))
    or exists(select 1 from public.billing_customers where stripe_customer_id=p_customer_id and user_id<>p_user_id)
    or exists(select 1 from public.billing_customers where user_id=p_user_id and stripe_customer_id<>p_customer_id)
  then raise exception 'STRIPE_OWNER_MISMATCH' using errcode='P0001'; end if;
  if p_plan_code not in ('plus','pro') then raise exception 'STRIPE_PLAN_INVALID'; end if;
  -- Resolve prior expiry before replacing the previous period boundary.
  perform public.resolve_watch_history_access_v1(p_user_id);
  insert into public.billing_customers(user_id,stripe_customer_id) values(p_user_id,p_customer_id)
    on conflict(user_id) do update set updated_at=clock_timestamp();
  insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,
    plan_code,status,current_period_end,cancel_at_period_end)
  values(p_user_id,p_customer_id,p_subscription_id,p_price_id,p_plan_code,p_status,p_period_end,p_cancel_at_period_end)
  on conflict(stripe_subscription_id) do update set stripe_price_id=excluded.stripe_price_id,
    plan_code=excluded.plan_code,status=excluded.status,current_period_end=excluded.current_period_end,
    cancel_at_period_end=excluded.cancel_at_period_end,updated_at=clock_timestamp();
  result := public.resolve_watch_history_access_v1(p_user_id);
  -- No expired holder may commit even if it spent its entire lease waiting on work.
  if r.expires_at<=clock_timestamp() then raise exception 'STRIPE_REFRESH_STALE' using errcode='P0001'; end if;
  perform public.release_stripe_subscription_refresh_v1(p_subscription_id,p_fence,p_token);
  return result;
end $$;
revoke all on function public.commit_stripe_subscription_refresh_v1(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.commit_stripe_subscription_refresh_v1(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean) to service_role;

reset lock_timeout;
reset statement_timeout;
