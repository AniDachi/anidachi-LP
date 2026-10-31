-- Source-labelled display reads only. Does not activate Free20 or stop trials.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Keep the existing eligibility/expiry calculation in one place. The old
-- helper below keeps exactly its two-column contract for every old consumer.
create function public.subscription_access_details_v1(p_user_id uuid,p_at timestamptz)
returns table(plan_code text,expires_at timestamptz,grant_source text)
language sql stable security invoker set search_path='' as $$
 select s.plan_code,b.expires_at,
  case when s.status='trialing' or (t.user_id is not null and
    (p_at<t.trial_ends_at or t.first_payment_state<>'paid')) then 'trial' else 'paid' end
 from public.subscriptions s
 left join public.account_subscription_trials t on t.user_id=s.user_id and t.stripe_subscription_id=s.stripe_subscription_id
 left join public.subscription_trial_renewals r on r.id=t.renewal_operation_id and r.user_id=t.user_id and r.stripe_subscription_id=t.stripe_subscription_id
 cross join lateral(select case
  when t.trial_mode='cardless' and (r.id is null or r.state<>'applied' or r.action<>'enable') then t.trial_ends_at
  when t.user_id is null or t.first_payment_state='paid' then s.current_period_end
  when s.cancel_at_period_end or t.first_payment_state in ('failed','action_required') then t.trial_ends_at
  else t.trial_ends_at+interval '2 hours' end as expires_at) b
 where s.user_id=p_user_id and s.status in ('active','trialing') and s.plan_code in ('plus','pro') and b.expires_at>p_at;
$$;
revoke all on function public.subscription_access_details_v1(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.subscription_access_details_v1(uuid,timestamptz) to service_role;
create or replace function public.subscription_access_grants_v1(p_user_id uuid,p_at timestamptz)
returns table(plan_code text,expires_at timestamptz) language sql stable security invoker set search_path='' as $$
 select d.plan_code,d.expires_at from public.subscription_access_details_v1(p_user_id,p_at) d;
$$;

create function public.read_free20_account_status_v1(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='3s' set statement_timeout='5s' as $$
declare policy public.hosting_commercial_policy%rowtype; authority jsonb;
 at_time timestamptz; reset_at timestamptz; refresh_by timestamptz;
 plan text; consumed integer; selected record; grant_info jsonb; assignment jsonb;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 if not policy.free20_enabled then return jsonb_build_object('enabled',false); end if;
 if policy.activation_at is null or policy.activation_at>clock_timestamp() or
  (select active from public.personal_history_policy where singleton) is distinct from true then
  raise exception 'ROOM_AUTHORITY_UNAVAILABLE';
 end if;
 -- Existing account authority owns entitlement validation, epochs and locks.
 authority:=public.resolve_watch_history_access_v1(p_user_id);
 plan:=authority->>'planCode';
 at_time:=(authority#>>'{history,serverTime}')::timestamptz;
 if plan is null or plan not in ('free','plus','pro') or at_time is null or
  authority#>>'{history,ownerUserId}' is distinct from p_user_id::text then
  raise exception 'ROOM_AUTHORITY_UNAVAILABLE';
 end if;
 reset_at:=(((at_time at time zone 'UTC')::date+1)::timestamp at time zone 'UTC');
 refresh_by:=least((authority#>>'{history,validUntil}')::timestamptz,reset_at,at_time+interval '5 minutes');
 if plan<>'free' then
  with grants as (
   select d.plan_code,d.expires_at,d.grant_source from public.subscription_access_details_v1(p_user_id,at_time) d
   union all
   select m.plan_code,coalesce(m.valid_until,'infinity'::timestamptz),'manual' from public.account_manual_plan_grants m
    where m.user_id=p_user_id and (m.valid_until is null or m.valid_until>at_time)
  ) select * into selected from grants g where g.plan_code=plan
   order by g.expires_at desc,g.grant_source asc limit 1;
  if not found or selected.expires_at is distinct from
   coalesce((authority->>'selectedPlanExpiresAt')::timestamptz,'infinity'::timestamptz) then
   raise exception 'ROOM_AUTHORITY_UNAVAILABLE';
  end if;
  grant_info:=jsonb_build_object('source',selected.grant_source,'validUntil',nullif(selected.expires_at,'infinity'::timestamptz));
  refresh_by:=least(refresh_by,selected.expires_at);
 end if;
 if refresh_by is null or refresh_by<=at_time then raise exception 'ROOM_AUTHORITY_UNAVAILABLE'; end if;
 select u.host_seconds into consumed from public.usage_daily u
  where u.user_id=p_user_id and u.day=(at_time at time zone 'UTC')::date;
 select jsonb_build_object('roomId',a.room_id,'role',a.role,'sessionId',a.participant_session_id,
  'roomGeneration',1,'hostingTimeMode',r.hosting_time_mode,'status',r.status,'hostUserId',r.host_user_id)
  into assignment from public.active_room_sessions a join public.rooms r on r.room_id=a.room_id
  where a.user_id=p_user_id;
 return jsonb_build_object('enabled',true,'ownerUserId',p_user_id,'planCode',plan,
  'serverTime',at_time,'resetAt',reset_at,'refreshBy',refresh_by,
  'accountGeneration',(authority#>>'{history,accountGeneration}')::bigint,
  'accessEpoch',(authority#>>'{history,accessEpoch}')::bigint,
  'committedSeconds',coalesce(consumed,0),'grant',grant_info,'assignment',assignment);
end $$;
revoke all on function public.read_free20_account_status_v1(uuid) from public,anon,authenticated;
grant execute on function public.read_free20_account_status_v1(uuid) to service_role;
commit;
