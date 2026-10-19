-- Display-only check. Atomic reservation/consumption remains in reserve_cardless_trial_v2.
set lock_timeout='5s';
set statement_timeout='30s';
create function public.read_trial_marker_status_v1(p_user_id uuid,p_browser_hash text,p_installation_hash text default null)
returns text language plpgsql stable security definer set search_path='' as $$
declare marker_state text;
begin
 if p_user_id is null or p_browser_hash is null or p_browser_hash !~ '^[a-f0-9]{64}$'
  or (p_installation_hash is not null and p_installation_hash !~ '^[a-f0-9]{64}$') then raise exception 'TRIAL_CONTEXT_REQUIRED'; end if;
 -- A concurrent activation for this account must be recovered, never replaced.
 if exists(select 1 from public.subscription_trial_activations where user_id=p_user_id and state<>'failed')
 then return 'account_changed'; end if;
 select case when bool_or(c.state='reserved') then 'busy'
             when bool_or(c.state='consumed') then 'used' else 'available' end
 into marker_state
 from anidachi_private.trial_marker_claims c
 join (values ('browser',p_browser_hash),('installation',p_installation_hash)) m(kind,digest)
  on c.kind=m.kind and c.marker_hash=m.digest
 where c.state='reserved' or c.expires_at>statement_timestamp();
 return marker_state;
end $$;
revoke all on function public.read_trial_marker_status_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function public.read_trial_marker_status_v1(uuid,text,text) to service_role;

-- Browsing/confirmation must not consume the activation/renewal action buckets.
alter table public.subscription_trial_request_limits drop constraint subscription_trial_request_limits_action_check;
alter table public.subscription_trial_request_limits add constraint subscription_trial_request_limits_action_check
 check(action in ('start','quote','setup','complete','cancel','offer'));
create or replace function public.consume_trial_action_rate_limit_v1(p_user_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare bucket timestamptz:=date_trunc('minute',clock_timestamp()); used integer;
begin
 if p_user_id is null or p_action is null or p_action not in ('start','quote','setup','complete','cancel','offer') then raise exception 'TRIAL_RATE_LIMIT_INPUT_INVALID'; end if;
 insert into public.subscription_trial_request_limits(user_id,action,window_started_at,request_count) values(p_user_id,p_action,bucket,1)
 on conflict(user_id,action) do update set window_started_at=bucket,request_count=case
  when subscription_trial_request_limits.window_started_at=bucket then least(subscription_trial_request_limits.request_count+1,21) else 1 end
 returning request_count into used;
 return used<=20;
end $$;


reset lock_timeout;
reset statement_timeout;
