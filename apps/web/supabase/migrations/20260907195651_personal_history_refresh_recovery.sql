-- Fenced refresh must be able to heal unavailable prior authority. This replaces
-- only the commit function; no data deletion or activation of history enforcement.
set lock_timeout = '5s';
set statement_timeout = '30s';
create or replace function public.commit_stripe_subscription_refresh_v1(
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
  begin
    perform public.resolve_watch_history_access_v1(p_user_id);
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'HISTORY_ACCESS_UNAVAILABLE'
      or not exists(select 1 from public.users where id=p_user_id) then raise; end if;
    -- A fresh, fenced Stripe snapshot can repair missing/invalid prior billing
    -- authority. Rotate any previously granted capture epoch conservatively;
    -- do not turn the unavailable response into an externally observed Free.
    insert into public.user_watch_settings(user_id,write_schema_version) values(p_user_id,3) on conflict do nothing;
    perform 1 from public.user_watch_settings where user_id=p_user_id for update;
    update public.user_watch_settings set
      access_epoch=access_epoch+case when history_access_enabled then 1 else 0 end,
      history_access_enabled=false,history_access_expires_at=null,capture_not_before=clock_timestamp()
      where user_id=p_user_id;
  end;
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
