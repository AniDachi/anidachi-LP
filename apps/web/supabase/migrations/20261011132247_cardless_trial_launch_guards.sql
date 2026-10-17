set lock_timeout='5s';
set statement_timeout='30s';

create table public.subscription_trial_request_limits (
 user_id uuid not null references public.users(id) on delete cascade,
 action text not null check(action in ('start','quote','setup','complete','cancel')),
 window_started_at timestamptz not null,
 request_count integer not null check(request_count between 1 and 21),
 primary key(user_id,action)
);
alter table public.subscription_trial_request_limits enable row level security;
revoke all on public.subscription_trial_request_limits from public,anon,authenticated,service_role;
create function public.consume_trial_action_rate_limit_v1(p_user_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare bucket timestamptz:=date_trunc('minute',clock_timestamp()); used integer;
begin
 if p_user_id is null or p_action is null or p_action not in ('start','quote','setup','complete','cancel') then raise exception 'TRIAL_RATE_LIMIT_INPUT_INVALID'; end if;
 insert into public.subscription_trial_request_limits(user_id,action,window_started_at,request_count) values(p_user_id,p_action,bucket,1)
 on conflict(user_id,action) do update set window_started_at=bucket,request_count=case
  when subscription_trial_request_limits.window_started_at=bucket then least(subscription_trial_request_limits.request_count+1,21) else 1 end
 returning request_count into used;
 return used<=20;
end $$;

-- OAuth providers attest this email during a fresh login. No historical proof
-- is invented, and an unverified legacy session keeps its ordinary account access.
create table public.account_verified_emails (
 user_id uuid primary key references public.users(id) on delete cascade,
 email text not null check(char_length(email) between 3 and 320),
 verified_at timestamptz not null default clock_timestamp()
);
alter table public.account_verified_emails enable row level security;
revoke all on public.account_verified_emails from public,anon,authenticated,service_role;
grant select on public.account_verified_emails to service_role;
create function public.record_verified_account_email_v1(p_user_id uuid,p_email text)
returns void language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
begin
 if p_user_id is null or p_email is null or not exists(select 1 from public.users where id=p_user_id and email=p_email)
 then raise exception 'VERIFIED_EMAIL_OWNER_MISMATCH'; end if;
 insert into public.account_verified_emails(user_id,email) values(p_user_id,p_email)
 on conflict(user_id) do update set email=excluded.email,verified_at=clock_timestamp();
end $$;

create or replace function public.guard_checkout_cardless_trial_v1() returns trigger language plpgsql set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
 if exists(select 1 from public.subscription_trial_activations a where a.user_id=new.user_id and
  (a.state in ('pending','created') or (a.state='committed' and exists(select 1 from public.subscriptions s where s.stripe_subscription_id=a.stripe_subscription_id and s.status not in ('canceled','incomplete_expired')))))
 then raise exception 'TRIAL_ACTIVATION_BUSY'; end if;
 if new.trial_offered and exists(select 1 from public.hosting_commercial_policy where singleton and cardless_trials_enabled
  and trials_enabled and activation_at<=clock_timestamp()) then raise exception 'CARDLESS_TRIAL_OFFER_CHANGED'; end if;
 return new;
end $$;
revoke all on function public.consume_trial_action_rate_limit_v1(uuid,text),public.record_verified_account_email_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.consume_trial_action_rate_limit_v1(uuid,text),public.record_verified_account_email_v1(uuid,text) to service_role;
reset lock_timeout;
reset statement_timeout;
