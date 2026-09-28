-- All Free accounts share the same one-trial rule, independent of registration date.
-- Definition-only correction: preserve ledger, subscriptions, history, reservations
-- and the dormant/active policy. Do not activate trials as part of this migration.
set lock_timeout = '5s';
set statement_timeout = '30s';

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
  trial_record public.account_subscription_trials%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
  select plan into mirror_plan from public.users where id=p_user_id;
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
