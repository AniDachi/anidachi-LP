set lock_timeout='5s';
set statement_timeout='30s';

create table public.subscription_checkout_reservations (
 user_id uuid primary key references public.users(id) on delete cascade,
 id uuid not null unique default gen_random_uuid(),
 request_id uuid not null,
 plan_code text not null check (plan_code in ('plus','pro')),
 price_id text not null check (char_length(price_id) between 1 and 255),
 origin text not null check (char_length(origin) between 1 and 2048),
 attribution jsonb not null default '{}' check (jsonb_typeof(attribution)='object' and octet_length(attribution::text)<=4096),
 policy_revision bigint not null check (policy_revision>0),
 trial_offered boolean not null,
 created_at timestamptz not null default clock_timestamp(),
 stripe_session_id text unique,
 stripe_subscription_id text references public.subscriptions(stripe_subscription_id),
 state text not null default 'pending' check (state in ('pending','open','complete','expired')),
 check ((state='pending')=(stripe_session_id is null)),
 check (state<>'complete' or stripe_subscription_id is not null)
);
alter table public.subscription_checkout_reservations enable row level security;
revoke all on public.subscription_checkout_reservations from public,anon,authenticated,service_role;
grant select on public.subscription_checkout_reservations to service_role;

create function public.reserve_subscription_checkout_v1(
 p_user_id uuid,p_plan_code text,p_price_id text,p_origin text,p_request_id uuid,p_attribution jsonb)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='5s' set statement_timeout='15s' as $$
declare r public.subscription_checkout_reservations%rowtype; authority jsonb;
begin
 if p_plan_code is null or p_plan_code not in ('plus','pro') or p_request_id is null then
  raise exception 'CHECKOUT_INPUT_INVALID' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 authority:=public.resolve_watch_history_access_v1(p_user_id);
 select * into r from public.subscription_checkout_reservations where user_id=p_user_id for update;
 if found then
  if r.state='expired' or (r.state='complete' and exists(
    select 1 from public.subscriptions where stripe_subscription_id=r.stripe_subscription_id
     and user_id=p_user_id and status in ('canceled','incomplete_expired')
  )) then
   delete from public.subscription_checkout_reservations where user_id=p_user_id and id=r.id;
  else return to_jsonb(r); end if;
 end if;
 insert into public.subscription_checkout_reservations(user_id,request_id,plan_code,price_id,origin,attribution,policy_revision,trial_offered)
 values(p_user_id,p_request_id,p_plan_code,p_price_id,p_origin,p_attribution,
   (authority#>>'{hosting,hostingPolicyVersion}')::bigint,
   authority#>>'{hosting,trialEligibility}'='eligible') returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.reserve_subscription_checkout_v1(uuid,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_subscription_checkout_v1(uuid,text,text,text,uuid,jsonb) to service_role;

-- Only verified Stripe outcomes reach this RPC. There is no timeout-based release.
create function public.complete_subscription_checkout_reservation_v1(
 p_user_id uuid,p_reservation_id uuid,p_session_id text,p_state text,p_subscription_id text default null)
returns void language plpgsql security definer set search_path=''
set lock_timeout='5s' set statement_timeout='15s' as $$
declare r public.subscription_checkout_reservations%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into r from public.subscription_checkout_reservations where user_id=p_user_id for update;
 if not found or r.id<>p_reservation_id then raise exception 'CHECKOUT_RESERVATION_STALE'; end if;
 if p_session_id is null or char_length(p_session_id) not between 1 and 255
   or p_state is null or p_state not in ('open','complete','expired')
 then raise exception 'CHECKOUT_INPUT_INVALID' using errcode='22023'; end if;
 if r.stripe_session_id is not null and r.stripe_session_id<>p_session_id then raise exception 'CHECKOUT_SESSION_MISMATCH'; end if;
 if r.state in ('expired','complete') and r.state<>p_state then raise exception 'CHECKOUT_RESERVATION_TERMINAL'; end if;
 if r.stripe_subscription_id is not null and r.stripe_subscription_id is distinct from p_subscription_id
 then raise exception 'CHECKOUT_SUBSCRIPTION_MISMATCH'; end if;
 if p_state='complete' and not exists(select 1 from public.subscriptions
   where user_id=p_user_id and stripe_subscription_id=p_subscription_id)
 then raise exception 'CHECKOUT_SUBSCRIPTION_UNVERIFIED'; end if;
 update public.subscription_checkout_reservations set stripe_session_id=p_session_id,state=p_state,
   stripe_subscription_id=case when p_state='complete' then p_subscription_id else stripe_subscription_id end
 where user_id=p_user_id and id=p_reservation_id;
end $$;
revoke all on function public.complete_subscription_checkout_reservation_v1(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_subscription_checkout_reservation_v1(uuid,uuid,text,text,text) to service_role;

reset lock_timeout;
reset statement_timeout;
