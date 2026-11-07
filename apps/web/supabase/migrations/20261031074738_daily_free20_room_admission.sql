-- Default-off prerequisite. Deploy compatible Web/Worker/client paths and accept
-- them before an operator enables this switch. Never reset the old cutover.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.hosting_commercial_policy
 add column free20_enabled boolean not null default false,
 add constraint free20_requires_hosting_cutover check(not free20_enabled or activation_at is not null);
alter table public.rooms add column hosting_time_mode text
 check(hosting_time_mode is null or hosting_time_mode='daily_free20');

-- Server-only preflight. Live uncommitted usage remains in the single assigned
-- room's DO; admission never releases that assignment or reserves a second budget.
create function public.resolve_free20_hosting_access_v1(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype; authority jsonb;
 t timestamptz; reset_at timestamptz; used integer; plan text;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 if not policy.free20_enabled then return jsonb_build_object('enabled',false); end if;
 if policy.activation_at>clock_timestamp() or
   not (select active from public.personal_history_policy where singleton) then
  raise exception 'ROOM_AUTHORITY_UNAVAILABLE';
 end if;
 authority:=public.resolve_watch_history_access_v1(p_user_id);
 plan:=authority->>'planCode';
 t:=(authority#>>'{history,serverTime}')::timestamptz;
 if plan is null or plan not in ('free','plus','pro') or t is null then
  raise exception 'ROOM_AUTHORITY_UNAVAILABLE';
 end if;
 reset_at:=(((t at time zone 'UTC')::date+1)::timestamp at time zone 'UTC');
 select coalesce(host_seconds,0) into used from public.usage_daily
  where user_id=p_user_id and day=(t at time zone 'UTC')::date;
 used:=coalesce(used,0);
 return jsonb_build_object('enabled',true,'ownerUserId',p_user_id,'planCode',plan,
  'serverTime',t,'resetAt',reset_at,'usedSeconds',used,
  'remainingSeconds',case when plan='free' then greatest(0,1200-used) else null end,
  'canHost',plan<>'free' or used<1200);
end $$;
revoke all on function public.resolve_free20_hosting_access_v1(uuid) from public,anon,authenticated;
grant execute on function public.resolve_free20_hosting_access_v1(uuid) to service_role;

create or replace function public.require_room_hosting_access_v1(p_host_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype; authority jsonb;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 if policy.free20_enabled then
  authority:=public.resolve_free20_hosting_access_v1(p_host_user_id);
  if authority->>'canHost' is distinct from 'true' then raise exception 'QUOTA_EXHAUSTED'; end if;
  return;
 end if;
 if policy.activation_at is null or policy.activation_at>clock_timestamp() then return; end if;
 authority:=public.resolve_watch_history_access_v1(p_host_user_id);
 if authority#>>'{hosting,canHost}' is distinct from 'true' then raise exception 'HOST_SUBSCRIPTION_REQUIRED'; end if;
end $$;

create or replace function public.require_room_hosting_admission_v1(p_room_id text,p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype; r public.rooms%rowtype;
 authority jsonb; account_id uuid;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 select * into r from public.rooms where room_id=p_room_id;
 if not found then return; end if;
 if r.hosting_time_mode is null and (policy.activation_at is null or policy.activation_at>clock_timestamp()) then return; end if;
 -- Match the existing crossed-host/member lock order; quota belongs to the host.
 for account_id in select distinct id from unnest(array[r.host_user_id,p_user_id]) ids(id) where id is not null order by id loop
  perform pg_advisory_xact_lock(hashtextextended(account_id::text,0));
 end loop;
 select * into r from public.rooms where room_id=p_room_id;
 if r.hosting_time_mode='daily_free20' then
  if r.status='ended' then raise exception 'ROOM_ENDED'; end if;
  if r.media_closing_at is not null or not policy.free20_enabled then raise exception 'HOST_SUBSCRIPTION_REQUIRED'; end if;
  authority:=public.resolve_free20_hosting_access_v1(r.host_user_id);
  if authority->>'canHost' is distinct from 'true' then raise exception 'QUOTA_EXHAUSTED'; end if;
  return;
 end if;
 authority:=public.resolve_watch_history_access_v1(r.host_user_id);
 if r.host_plan_code in ('free','watcher') or r.media_closing_at is not null
  or authority#>>'{hosting,canHost}' is distinct from 'true'
  or (r.host_plan_code='pro' and authority->>'planCode'<>'pro') then
  raise exception 'HOST_SUBSCRIPTION_REQUIRED';
 end if;
end $$;

create or replace function public.enforce_room_hosting_insert_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype; access jsonb;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 if new.hosting_time_mode is not null then raise exception 'ROOM_TIME_MODE_INVALID'; end if;
 if policy.free20_enabled then
  access:=public.resolve_free20_hosting_access_v1(new.host_user_id);
  if access->>'canHost' is distinct from 'true' then raise exception 'QUOTA_EXHAUSTED'; end if;
  if access->>'planCode'='free' and new.host_plan_code<>'free' then raise exception 'HOST_SUBSCRIPTION_REQUIRED'; end if;
  if new.host_plan_code='free' then
   if new.max_participants<>4 or new.max_media_seats<>4 or new.can_name_room or new.can_send_push_invites then
    raise exception 'HOST_SUBSCRIPTION_REQUIRED';
   end if;
   new.hosting_time_mode:='daily_free20';
  end if;
 elsif policy.activation_at is not null and policy.activation_at<=clock_timestamp() then
  perform public.require_room_hosting_access_v1(new.host_user_id);
  if new.host_plan_code not in ('plus','pro') then raise exception 'HOST_SUBSCRIPTION_REQUIRED'; end if;
 end if;
 return new;
end $$;

create function public.preserve_room_time_mode_v1()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.hosting_time_mode is distinct from old.hosting_time_mode then raise exception 'ROOM_TIME_MODE_IMMUTABLE'; end if;
 return new;
end $$;
revoke all on function public.preserve_room_time_mode_v1() from public,anon,authenticated,service_role;
create trigger preserve_room_time_mode before update of hosting_time_mode on public.rooms
 for each row execute function public.preserve_room_time_mode_v1();

-- Preserve the mature create/renew bodies and fail atomically if their reviewed
-- anchors changed. No rewrite of source/assignment/media negotiation or settlement.
do $$declare body text; anchor text;
begin
 select pg_get_functiondef('public.create_room_with_active_session_v3(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer)'::regprocedure) into body;
 anchor:=' perform public.require_room_hosting_access_v1(p_host_user_id);';
 if position(anchor in body)=0 then raise exception 'unexpected Free20 create guard'; end if;
 body:=replace(body,anchor,anchor||$patch$
 if p_media_protocol_version<>3 and
   public.resolve_free20_hosting_access_v1(p_host_user_id)->>'planCode'='free' then
  raise exception 'ROOM_UPDATE_REQUIRED';
 end if;
$patch$);
 execute body;

 select pg_get_functiondef('public.renew_room_media_lease_v2(text)'::regprocedure) into body;
 anchor:=' if r.status=''ended'' then raise exception ''ROOM_ENDED''; end if;';
 if position(anchor in body)=0 then raise exception 'unexpected Free20 renewal guard'; end if;
 body:=replace(body,anchor,anchor||$patch$
 if r.hosting_time_mode='daily_free20' then
  if r.media_closing_at is not null then return jsonb_build_object('denied',true,'closingAt',r.media_closing_at); end if;
  if not hosting_policy.free20_enabled or public.resolve_free20_hosting_access_v1(owner_id)->>'canHost' is distinct from 'true' then
   update public.rooms set media_closing_at=clock_timestamp() where room_id=p_room_id returning media_closing_at into closing_deadline;
   return jsonb_build_object('denied',true,'closingAt',closing_deadline);
  end if;
 end if;
$patch$);
 anchor:=' if hosting_policy.activation_at is not null and hosting_policy.activation_at<=clock_timestamp()';
 if position(anchor in body)=0 then raise exception 'unexpected legacy renewal guard'; end if;
 body:=replace(body,anchor,' if r.hosting_time_mode is distinct from ''daily_free20'' and hosting_policy.activation_at is not null and hosting_policy.activation_at<=clock_timestamp()');
 execute body;

 select pg_get_functiondef('public.check_room_hosting_socket_v1(text,uuid)'::regprocedure) into body;
 anchor:=' if denial is null then return result||jsonb_build_object(''allowed'',true); end if;';
 if position(anchor in body)=0 then raise exception 'unexpected Free20 socket response'; end if;
 body:=replace(body,anchor,$patch$
 if r.hosting_time_mode='daily_free20' then result:=result||jsonb_build_object('hostingTimeMode','daily_free20'); end if;
$patch$||anchor);
 anchor:='   if sqlerrm<>''HOST_SUBSCRIPTION_REQUIRED'' then raise; end if;';
 if position(anchor in body)=0 then raise exception 'unexpected Free20 socket error'; end if;
 body:=replace(body,anchor,'   if sqlerrm not in (''HOST_SUBSCRIPTION_REQUIRED'',''QUOTA_EXHAUSTED'',''ROOM_ENDED'') then raise; end if;');
 body:=replace(body,'   denial:=''HOST_SUBSCRIPTION_REQUIRED'';','   denial:=sqlerrm;');
 execute body;
end $$;
commit;
