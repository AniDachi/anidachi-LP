-- Additive preparation for the trial-flow UI. Deploy before runtime uses context.
-- Both public read endpoints stay bounded; activation/renewal budgets are unchanged.
set lock_timeout='5s';
set statement_timeout='30s';
alter table public.subscription_trial_request_limits drop constraint subscription_trial_request_limits_action_check;
alter table public.subscription_trial_request_limits add constraint subscription_trial_request_limits_action_check
 check(action in ('start','quote','setup','complete','cancel','offer','context'));
create or replace function public.consume_trial_action_rate_limit_v1(p_user_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare bucket timestamptz:=date_trunc('minute',clock_timestamp()); used integer;
begin
 if p_user_id is null or p_action is null or p_action not in ('start','quote','setup','complete','cancel','offer','context') then raise exception 'TRIAL_RATE_LIMIT_INPUT_INVALID'; end if;
 insert into public.subscription_trial_request_limits(user_id,action,window_started_at,request_count) values(p_user_id,p_action,bucket,1)
 on conflict(user_id,action) do update set window_started_at=bucket,request_count=case
  when subscription_trial_request_limits.window_started_at=bucket then least(subscription_trial_request_limits.request_count+1,21) else 1 end
 returning request_count into used;
 return used<=20;
end $$;
revoke all on function public.consume_trial_action_rate_limit_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.consume_trial_action_rate_limit_v1(uuid,text) to service_role;
reset lock_timeout;
reset statement_timeout;
