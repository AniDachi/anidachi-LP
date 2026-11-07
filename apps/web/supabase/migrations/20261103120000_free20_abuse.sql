-- Default-off scoped Free20 accounting. No customer data or flags are changed.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
alter table public.hosting_commercial_policy add column free20_abuse_enabled boolean not null default false;
alter table public.rooms add column free20_abuse_protected boolean not null default false;

-- No cascading FKs: deletion of an account/room must not erase spent allowance
-- or release an unsettled reservation. All writes are through trusted RPCs.
create table anidachi_room_private.free20_marker_days (
 kind text not null check(kind in ('browser','installation')),
 marker_hash text not null check(marker_hash ~ '^[0-9a-f]{64}$'),
 day date not null,
 committed_seconds integer not null check(committed_seconds>=0),
 primary key(kind,marker_hash,day)
);
create table anidachi_room_private.free20_room_bindings (
 room_id text not null,
 owner_user_id uuid not null,
 kind text not null check(kind in ('browser','installation')),
 marker_hash text not null check(marker_hash ~ '^[0-9a-f]{64}$'),
 bound_at timestamptz not null default clock_timestamp(),
 settled_at timestamptz,
 primary key(room_id,kind,marker_hash)
);
create index free20_marker_days_expiry on anidachi_room_private.free20_marker_days(day,kind,marker_hash);
create index free20_completed_bindings_expiry on anidachi_room_private.free20_room_bindings(settled_at) where settled_at is not null;
create unique index free20_one_scope_reservation on anidachi_room_private.free20_room_bindings(kind,marker_hash) where settled_at is null;
-- Unforgeable by the runtime role, unlike a session GUC. A permit exists only
-- while the v5 wrapper is executing, and is removed before returning.
create table anidachi_room_private.free20_admission_context (
 transaction_id bigint primary key,
 owner_user_id uuid not null,
 browser_hash text,
 installation_hash text
);
revoke all on anidachi_room_private.free20_marker_days,anidachi_room_private.free20_room_bindings,anidachi_room_private.free20_admission_context from public,anon,authenticated,service_role;
alter table anidachi_room_private.free20_marker_days enable row level security;
alter table anidachi_room_private.free20_room_bindings enable row level security;
alter table anidachi_room_private.free20_admission_context enable row level security;

create function anidachi_room_private.validate_free20_context(p_browser text,p_installation text)
returns void language plpgsql set search_path='' as $$
begin
 if p_browser is null or p_installation is null then raise exception 'FREE20_CONTEXT_REQUIRED'; end if;
 if p_browser !~ '^[0-9a-f]{64}$' or p_installation !~ '^[0-9a-f]{64}$' then raise exception 'FREE20_CONTEXT_INVALID' using errcode='22023'; end if;
end $$;

-- Every caller first locks its own room (if any). Shared markers are then locked
-- in the SAME total order. Never lock another room or account inside this fence.
create function anidachi_room_private.lock_free20_scopes(p_room_id text,p_browser text,p_installation text)
returns void language plpgsql set search_path='' as $$
declare s record;
begin
 for s in select kind,marker_hash from (
  select b.kind,b.marker_hash from anidachi_room_private.free20_room_bindings b where b.room_id=p_room_id
  union select 'browser',p_browser where p_browser is not null
  union select 'installation',p_installation where p_installation is not null
 ) scopes order by kind collate "C",marker_hash collate "C" loop
  perform pg_advisory_xact_lock(hashtextextended('free20:'||s.kind||':'||s.marker_hash,620));
 end loop;
end $$;

create function public.read_free20_room_usage_v1(p_room_id text,p_day date)
returns integer language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare r public.rooms%rowtype; used integer;
begin
 if p_day is null then raise exception 'ROOM_USAGE_INVALID' using errcode='22023'; end if;
 select * into strict r from public.rooms where room_id=p_room_id for update;
 perform anidachi_room_private.lock_free20_scopes(p_room_id,null,null);
 select greatest(coalesce((select host_seconds from public.usage_daily where user_id=r.host_user_id and day=p_day),0),
  coalesce((select max(d.committed_seconds) from anidachi_room_private.free20_room_bindings b
   join anidachi_room_private.free20_marker_days d using(kind,marker_hash)
   where b.room_id=p_room_id and d.day=p_day),0)) into used;
 return used;
end $$;

create function public.resolve_free20_context_access_v1(p_user_id uuid,p_browser_hash text default null,p_installation_hash text default null)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare policy public.hosting_commercial_policy%rowtype; result jsonb; active_room text; used integer; today date;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 result:=public.resolve_free20_hosting_access_v1(p_user_id);
 result:=result||jsonb_build_object('abuseEnabled',policy.free20_abuse_enabled);
 if not policy.free20_enabled or result->>'planCode'<>'free' then return result; end if;
 -- Canonical resolver holds the account advisory lock. Lock our own active room
 -- before all of its original plus proposed markers; status cannot mint a budget
 -- by presenting fresh markers while a room still owns older restrictions.
 select r.room_id into active_room from public.active_room_sessions a join public.rooms r on r.room_id=a.room_id
 where a.user_id=p_user_id and r.host_user_id=p_user_id and r.free20_abuse_protected and r.status<>'ended' for update of r;
 if policy.free20_abuse_enabled then
  perform anidachi_room_private.validate_free20_context(p_browser_hash,p_installation_hash);
 else
  -- Disabling NEW admission enforcement cannot enlarge a running room budget.
  -- Its original scopes remain authoritative without asking for new proof.
  if active_room is null then return result; end if;
  p_browser_hash:=null; p_installation_hash:=null;
 end if;
 perform anidachi_room_private.lock_free20_scopes(active_room,p_browser_hash,p_installation_hash);
 if exists(select 1 from anidachi_room_private.free20_room_bindings b where b.settled_at is null and b.owner_user_id<>p_user_id and
  ((b.kind='browser' and b.marker_hash=p_browser_hash) or (b.kind='installation' and b.marker_hash=p_installation_hash))) then
  raise exception 'FREE20_CONTEXT_BUSY';
 end if;
 today:=((result->>'serverTime')::timestamptz at time zone 'UTC')::date;
 select greatest((result->>'usedSeconds')::integer,coalesce(max(d.committed_seconds),0)) into used
 from anidachi_room_private.free20_marker_days d where d.day=today and (
  (d.kind='browser' and d.marker_hash=p_browser_hash) or (d.kind='installation' and d.marker_hash=p_installation_hash) or
  exists(select 1 from anidachi_room_private.free20_room_bindings b where b.room_id=active_room and b.kind=d.kind and b.marker_hash=d.marker_hash));
 return result||jsonb_build_object('usedSeconds',used,'remainingSeconds',greatest(0,1200-used),'canHost',used<1200);
end $$;

create function public.read_free20_context_status_v1(p_user_id uuid,p_browser_hash text default null,p_installation_hash text default null)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare policy public.hosting_commercial_policy%rowtype; result jsonb;
 active_room text; used integer; today date; attempt integer;
begin
 policy:=public.lock_hosting_commercial_policy_v1();
 -- Plan, grant/expiry, generation, server time and UTC bucket come from ONE
 -- canonical snapshot. Account locks do not stop expiry or midnight. Retry the
 -- complete snapshot if it expired before/while we waited for room/scope locks.
 for attempt in 1..3 loop
  result:=public.read_free20_account_status_v1(p_user_id);
  result:=result||jsonb_build_object('abuseEnabled',policy.free20_abuse_enabled);
  if result->>'enabled' is distinct from 'true' then return result; end if;
  if (result->>'refreshBy')::timestamptz<=clock_timestamp() then continue; end if;
  if result->>'planCode'='free' then
   select r.room_id into active_room from public.active_room_sessions a join public.rooms r on r.room_id=a.room_id
    where a.user_id=p_user_id and a.role='host' and a.room_id=result#>>'{assignment,roomId}'
     and result#>>'{assignment,role}'='host' and result#>>'{assignment,hostUserId}'=p_user_id::text
     and r.host_user_id=p_user_id and r.free20_abuse_protected and r.status<>'ended' for update of r;
   if policy.free20_abuse_enabled and active_room is null then
    perform anidachi_room_private.validate_free20_context(p_browser_hash,p_installation_hash);
   else
    -- Owned active protected rooms display only their already-bound effective
    -- usage, even when enforcement is on. Proposed context may not change a
    -- live budget before serialized transfer. Disabled admission also ignores
    -- proposed scopes. Idle/member free status still requires complete proof.
    p_browser_hash:=null; p_installation_hash:=null;
   end if;
   perform anidachi_room_private.lock_free20_scopes(active_room,p_browser_hash,p_installation_hash);
   if exists(select 1 from anidachi_room_private.free20_room_bindings b where b.settled_at is null and b.owner_user_id<>p_user_id and
    ((b.kind='browser' and b.marker_hash=p_browser_hash) or (b.kind='installation' and b.marker_hash=p_installation_hash))) then
    raise exception 'FREE20_CONTEXT_BUSY';
   end if;
   today:=((result->>'serverTime')::timestamptz at time zone 'UTC')::date;
   select greatest((result->>'committedSeconds')::integer,coalesce(max(d.committed_seconds),0)) into used
    from anidachi_room_private.free20_marker_days d where d.day=today and (
     (d.kind='browser' and d.marker_hash=p_browser_hash) or (d.kind='installation' and d.marker_hash=p_installation_hash) or
     exists(select 1 from anidachi_room_private.free20_room_bindings b where b.room_id=active_room and b.kind=d.kind and b.marker_hash=d.marker_hash));
   result:=result||jsonb_build_object('committedSeconds',used);
  end if;
  if (result->>'refreshBy')::timestamptz>clock_timestamp() then return result; end if;
 end loop;
 raise exception 'ROOM_AUTHORITY_UNAVAILABLE';
end $$;

-- Caller owns policy/account/user/room locks before entry. Binding is append-only.
create function anidachi_room_private.bind_free20_context(p_owner uuid,p_room text,p_browser text,p_installation text,p_append boolean)
returns void language plpgsql set search_path='' as $$
declare s record; today date:=(clock_timestamp() at time zone 'UTC')::date; used integer;
begin
 perform anidachi_room_private.validate_free20_context(p_browser,p_installation);
 perform anidachi_room_private.lock_free20_scopes(p_room,p_browser,p_installation);
 if exists(select 1 from anidachi_room_private.free20_room_bindings b where b.settled_at is null and b.room_id<>p_room and
  ((b.kind='browser' and b.marker_hash=p_browser) or (b.kind='installation' and b.marker_hash=p_installation))) then raise exception 'FREE20_CONTEXT_BUSY'; end if;
 if not p_append and exists(select 1 from (values('browser',p_browser),('installation',p_installation)) proposed(kind,marker_hash)
  where not exists(select 1 from anidachi_room_private.free20_room_bindings b where b.room_id=p_room and b.kind=proposed.kind and b.marker_hash=proposed.marker_hash)) then
  raise exception 'FREE20_CONTEXT_ATTACH_REQUIRED';
 end if;
 select coalesce(host_seconds,0) into used from public.usage_daily where user_id=p_owner and day=today;
 select greatest(coalesce(used,0),coalesce(max(d.committed_seconds),0)) into used
 from anidachi_room_private.free20_marker_days d where d.day=today and (
  (d.kind='browser' and d.marker_hash=p_browser) or (d.kind='installation' and d.marker_hash=p_installation) or
  exists(select 1 from anidachi_room_private.free20_room_bindings b where b.room_id=p_room and b.kind=d.kind and b.marker_hash=d.marker_hash));
 for s in select * from (values('browser',p_browser),('installation',p_installation)) x(kind,marker_hash) order by kind collate "C",marker_hash collate "C" loop
  if not exists(select 1 from anidachi_room_private.free20_room_bindings b where b.room_id=p_room and b.kind=s.kind and b.marker_hash=s.marker_hash) then
   insert into anidachi_room_private.free20_room_bindings(room_id,owner_user_id,kind,marker_hash) values(p_room,p_owner,s.kind,s.marker_hash);
   insert into anidachi_room_private.free20_marker_days(kind,marker_hash,day,committed_seconds) values(s.kind,s.marker_hash,today,used)
    on conflict(kind,marker_hash,day) do update set committed_seconds=greatest(free20_marker_days.committed_seconds,excluded.committed_seconds);
  end if;
 end loop;
 if p_append then
  -- Only admission / explicitly serialized stopped-host transfer may raise all
  -- retained scopes to a newly learned higher floor. Never do this on status or
  -- ordinary reconnect: the active DO may still own an unsettled interval.
  insert into anidachi_room_private.free20_marker_days(kind,marker_hash,day,committed_seconds)
   select b.kind,b.marker_hash,today,used from anidachi_room_private.free20_room_bindings b where b.room_id=p_room
   order by b.kind collate "C",b.marker_hash collate "C"
   on conflict(kind,marker_hash,day) do update set committed_seconds=greatest(free20_marker_days.committed_seconds,excluded.committed_seconds);
 end if;
end $$;

-- Enforcement in the final canonical core prevents a paid preflight expiring
-- into a free admission. The permit cannot be supplied via SQL session settings.
create function anidachi_room_private.require_free20_admission_context(p_owner uuid,p_room text default null)
returns void language plpgsql set search_path='' as $$
declare c anidachi_room_private.free20_admission_context%rowtype; access jsonb;
begin
 select * into c from anidachi_room_private.free20_admission_context where transaction_id=txid_current() and owner_user_id=p_owner;
 perform anidachi_room_private.validate_free20_context(c.browser_hash,c.installation_hash);
 if p_room is not null then
  perform anidachi_room_private.bind_free20_context(p_owner,p_room,c.browser_hash,c.installation_hash,false);
  -- bind already owns room/markers; no newly discovered account/room locks.
  if public.read_free20_room_usage_v1(p_room,(clock_timestamp() at time zone 'UTC')::date)>=1200 then raise exception 'QUOTA_EXHAUSTED'; end if;
 else
  -- The caller already owns the account lock. Check markers without resolving or
  -- locking another room. An owned active assignment may still return the mature
  -- conflict result. Actual exclusive reservation is enforced by the insert bind.
  perform anidachi_room_private.lock_free20_scopes(null,c.browser_hash,c.installation_hash);
  if exists(select 1 from anidachi_room_private.free20_room_bindings b where b.settled_at is null and b.owner_user_id<>p_owner and
   ((b.kind='browser' and b.marker_hash=c.browser_hash) or (b.kind='installation' and b.marker_hash=c.installation_hash))) then raise exception 'FREE20_CONTEXT_BUSY'; end if;
  if greatest(coalesce((select host_seconds from public.usage_daily where user_id=p_owner and day=(clock_timestamp() at time zone 'UTC')::date),0),
   coalesce((select max(committed_seconds) from anidachi_room_private.free20_marker_days where day=(clock_timestamp() at time zone 'UTC')::date and
    ((kind='browser' and marker_hash=c.browser_hash) or (kind='installation' and marker_hash=c.installation_hash))),0))>=1200 then raise exception 'QUOTA_EXHAUSTED'; end if;
 end if;
end $$;

create function public.attach_free20_room_context_v1(p_user_id uuid,p_room_id text,p_browser_hash text,p_installation_hash text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare r public.rooms%rowtype; at_time timestamptz;
begin
 perform public.lock_hosting_commercial_policy_v1();
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 perform 1 from public.users where id=p_user_id for no key update;
 select * into strict r from public.rooms where room_id=p_room_id for update;
 if r.host_user_id is distinct from p_user_id then raise exception 'active_room_session_role_invalid' using errcode='42501'; end if;
 if r.status='ended' or r.media_closing_at is not null then raise exception 'ROOM_ENDED'; end if;
 if not r.free20_abuse_protected then raise exception 'FREE20_CONTEXT_NOT_BOUND'; end if;
 perform anidachi_room_private.bind_free20_context(p_user_id,p_room_id,p_browser_hash,p_installation_hash,true);
 at_time:=clock_timestamp();
 return jsonb_build_object('roomId',p_room_id,'committedSeconds',public.read_free20_room_usage_v1(p_room_id,(at_time at time zone 'UTC')::date),'serverTime',at_time);
end $$;

-- Entry wrappers carry context only; all mature media/source/role/replay validation
-- remains in v4 and its final private core. Old public wrappers have no permit.
create function public.create_room_with_active_session_v5(p_host_user_id uuid,p_participant_session_id text,p_show_id text,p_episode_id text,p_source_provider text,p_source_url text,p_video_fingerprint text,p_source_generation bigint,p_title text,p_client_request_id text,p_host_plan_code text,p_max_participants integer,p_max_media_seats integer,p_can_name_room boolean,p_can_send_push_invites boolean,p_media_protocol_version integer default 1,p_free20_client_version integer default null,p_free20_browser_hash text default null,p_free20_installation_hash text default null)
returns table(outcome text,room_record jsonb,active_room jsonb) language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='30s' as $$
begin
 if p_host_user_id is null then raise exception 'active_room_session_invalid_input' using errcode='22023'; end if;
 insert into anidachi_room_private.free20_admission_context values(txid_current(),p_host_user_id,p_free20_browser_hash,p_free20_installation_hash);
 return query select * from public.create_room_with_active_session_v4(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites,p_media_protocol_version,p_free20_client_version);
 delete from anidachi_room_private.free20_admission_context where transaction_id=txid_current();
end $$;
create function public.claim_active_room_session_v5(p_user_id uuid,p_room_id text,p_role text,p_participant_session_id text,p_media_protocol_version integer default 1,p_free20_client_version integer default null,p_free20_browser_hash text default null,p_free20_installation_hash text default null)
returns table(outcome text,active_room jsonb) language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='30s' as $$
begin
 if p_user_id is null then raise exception 'active_room_session_invalid_input' using errcode='22023'; end if;
 insert into anidachi_room_private.free20_admission_context values(txid_current(),p_user_id,p_free20_browser_hash,p_free20_installation_hash);
 return query select * from public.claim_active_room_session_v4(p_user_id,p_room_id,p_role,p_participant_session_id,p_media_protocol_version,p_free20_client_version);
 delete from anidachi_room_private.free20_admission_context where transaction_id=txid_current();
end $$;

-- Room-first settlement, preserving cumulative/UTC/ended-room rules. Accepted
-- delta is charged once to the account and every immutable/append-only binding.
create or replace function public.commit_room_usage_day_v1(p_room_id text,p_day date,p_cumulative_seconds integer)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare r public.rooms%rowtype; old_seconds integer; accepted integer;
begin
 if p_day is null or p_cumulative_seconds is null or p_cumulative_seconds not between 0 and 86400 or p_day>(clock_timestamp() at time zone 'UTC')::date then raise exception 'ROOM_USAGE_INVALID' using errcode='22023'; end if;
 select * into strict r from public.rooms where room_id=p_room_id for update;
 if r.host_plan_code not in ('free','watcher') and not r.free20_abuse_protected then raise exception 'ROOM_USAGE_NOT_METERED'; end if;
 if p_day<(r.created_at at time zone 'UTC')::date then raise exception 'ROOM_USAGE_INVALID_DAY'; end if;
 select cumulative_seconds into old_seconds from public.room_usage_days_v1 where room_id=p_room_id and day=p_day;
 old_seconds:=coalesce(old_seconds,0);
 if r.status='ended' and p_cumulative_seconds>old_seconds then raise exception 'ROOM_USAGE_ENDED'; end if;
 accepted:=greatest(old_seconds,p_cumulative_seconds);
 perform anidachi_room_private.lock_free20_scopes(p_room_id,null,null);
 insert into public.room_usage_days_v1 values(p_room_id,p_day,accepted) on conflict(room_id,day) do update set cumulative_seconds=excluded.cumulative_seconds;
 if accepted>old_seconds then
  insert into public.usage_daily(user_id,day,host_seconds,updated_at) values(r.host_user_id,p_day,accepted-old_seconds,now())
   on conflict(user_id,day) do update set host_seconds=public.usage_daily.host_seconds+excluded.host_seconds,updated_at=excluded.updated_at;
  insert into anidachi_room_private.free20_marker_days(kind,marker_hash,day,committed_seconds)
   select kind,marker_hash,p_day,accepted-old_seconds from anidachi_room_private.free20_room_bindings where room_id=p_room_id
   order by kind collate "C",marker_hash collate "C"
   on conflict(kind,marker_hash,day) do update set committed_seconds=free20_marker_days.committed_seconds+excluded.committed_seconds;
 end if;
 return jsonb_build_object('day',p_day,'seconds',accepted);
end $$;

-- Admission must not block the KEY SHARE user FK check performed by a
-- room-first first usage INSERT. FOR UPDATE here creates user -> room -> user
-- deadlocks. NO KEY UPDATE still serializes admission/user updates while keeping
-- that FK check compatible. Correct the entire entrypoint prefix, not just v5.
do $locks$ declare body text; signature text; anchor text;
begin
 for signature,anchor in select * from (values
  ('public.create_room_with_active_session_v4(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer,integer)',
   ' perform 1 from public.users where id=p_host_user_id for update;'),
  ('anidachi_room_private.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer)',
   E'  where account.id = p_host_user_id\n  for update;'),
  ('anidachi_room_private.claim_active_room_session_v2(uuid,text,text,text,integer)',
   E'  where account.id = p_user_id\n  for update;')
 ) patches(signature,anchor) loop
  body:=pg_get_functiondef(signature::regprocedure);
  if position(anchor in body)=0 then raise exception 'unexpected admission user lock: %',signature; end if;
  execute replace(body,anchor,replace(anchor,'for update;','for no key update;'));
 end loop;
end $locks$;

-- Checked patches preserve mature full entrypoint bodies. Any changed upstream
-- anchor aborts the migration instead of silently dropping an admission fence.
do $patches$
declare body text; anchor text;
begin
 select pg_get_functiondef('anidachi_room_private.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer)'::regprocedure) into body;
 anchor:='  select assignment.*';
 if length(body)-length(replace(body,anchor,''))<>length(anchor) then raise exception 'unexpected abuse create core'; end if;
 body:=replace(body,anchor,$patch$
  if v_hosting_policy.free20_enabled and v_hosting_policy.free20_abuse_enabled and p_host_plan_code='free' then
   perform anidachi_room_private.require_free20_admission_context(p_host_user_id,case when v_has_existing_room then v_room.room_id else null end);
  end if;
$patch$||anchor);
 execute body;

 select pg_get_functiondef('anidachi_room_private.claim_active_room_session_v2(uuid,text,text,text,integer)'::regprocedure) into body;
 anchor:='  perform public.require_room_hosting_admission_v1(p_room_id,p_user_id);';
 if position(anchor in body)=0 then raise exception 'unexpected abuse claim core'; end if;
 body:=replace(body,anchor,$patch$
  if v_room.host_user_id=p_user_id and v_room.free20_abuse_protected
   and (select free20_abuse_enabled from public.hosting_commercial_policy where singleton)
   and public.resolve_watch_history_access_v1(p_user_id)->>'planCode'='free' then
   perform anidachi_room_private.require_free20_admission_context(p_user_id,p_room_id);
  end if;
$patch$||anchor);
 execute body;

 select pg_get_functiondef('public.enforce_room_hosting_insert_v1()'::regprocedure) into body;
 anchor:=' if new.hosting_time_mode is not null then';
 if position(anchor in body)=0 then raise exception 'unexpected abuse insert guard'; end if;
 body:=replace(body,anchor,' if new.free20_abuse_protected then raise exception ''FREE20_CONTEXT_REQUIRED''; end if;'||chr(10)||anchor);
 anchor:='   new.hosting_time_mode:=''daily_free20'';';
 if position(anchor in body)=0 then raise exception 'unexpected abuse insert assignment'; end if;
 body:=replace(body,anchor,anchor||$patch$
   if policy.free20_abuse_enabled then
    perform anidachi_room_private.require_free20_admission_context(new.host_user_id);
    perform anidachi_room_private.bind_free20_context(new.host_user_id,new.room_id,
     (select browser_hash from anidachi_room_private.free20_admission_context where transaction_id=txid_current() and owner_user_id=new.host_user_id),
     (select installation_hash from anidachi_room_private.free20_admission_context where transaction_id=txid_current() and owner_user_id=new.host_user_id),true);
    new.free20_abuse_protected:=true;
   end if;
$patch$);
 execute body;

 select pg_get_functiondef('public.require_room_hosting_admission_v1(text,uuid)'::regprocedure) into body;
 anchor:='  if authority->>''canHost'' is distinct from ''true'' then raise exception ''QUOTA_EXHAUSTED''; end if;';
 if position(anchor in body)=0 then raise exception 'unexpected abuse room quota'; end if;
 body:=replace(body,anchor,anchor||$patch$
  if r.free20_abuse_protected and authority->>'planCode'='free'
   and public.read_free20_room_usage_v1(p_room_id,(clock_timestamp() at time zone 'UTC')::date)>=1200 then raise exception 'QUOTA_EXHAUSTED'; end if;
$patch$);
 execute body;

 select pg_get_functiondef('public.renew_room_media_lease_v2(text)'::regprocedure) into body;
 anchor:='  if not hosting_policy.free20_enabled or public.resolve_free20_hosting_access_v1(owner_id)->>''canHost'' is distinct from ''true'' then';
 if position(anchor in body)=0 then raise exception 'unexpected abuse renewal quota'; end if;
 body:=replace(body,anchor,'  if not hosting_policy.free20_enabled or public.resolve_free20_hosting_access_v1(owner_id)->>''canHost'' is distinct from ''true'' or (r.free20_abuse_protected and public.resolve_free20_hosting_access_v1(owner_id)->>''planCode''=''free'' and public.read_free20_room_usage_v1(p_room_id,(clock_timestamp() at time zone ''UTC'')::date)>=1200) then');
 execute body;

 select pg_get_functiondef('public.finalize_room_usage(text,timestamptz,date,integer)'::regprocedure) into body;
 -- A protected room must settle even after a durable plan upgrade.
 anchor:='  if v_room.host_plan_code in (''free'', ''watcher'') then';
 if position(anchor in body)=0 then raise exception 'unexpected abuse finalize mode'; end if;
 body:=replace(body,anchor,'  if v_room.host_plan_code in (''free'', ''watcher'') or v_room.free20_abuse_protected then');
 anchor:='  update public.rooms as room';
 if position(anchor in body)=0 then raise exception 'unexpected abuse finalize terminal'; end if;
 body:=replace(body,anchor,$patch$
  perform anidachi_room_private.lock_free20_scopes(p_room_id,null,null);
  update anidachi_room_private.free20_room_bindings set settled_at=clock_timestamp() where room_id=p_room_id and settled_at is null;
$patch$||anchor);
 execute body;
 alter function public.finalize_room_usage(text,timestamptz,date,integer) security definer;
end $patches$;

create function anidachi_room_private.protect_free20_binding_identity()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.free20_abuse_protected is distinct from old.free20_abuse_protected or
  (old.free20_abuse_protected and (new.host_user_id is distinct from old.host_user_id or new.room_id is distinct from old.room_id)) then
  raise exception 'FREE20_BINDING_IMMUTABLE';
 end if;
 return new;
end $$;
create trigger protect_free20_binding_identity before update of free20_abuse_protected,host_user_id,room_id on public.rooms for each row execute function anidachi_room_private.protect_free20_binding_identity();

create function anidachi_room_private.guard_free20_abuse_activation()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.free20_abuse_enabled and not old.free20_abuse_enabled and exists(
  select 1 from public.rooms where hosting_time_mode='daily_free20' and not free20_abuse_protected and status<>'ended') then
  raise exception 'FREE20_UNPROTECTED_ACTIVE_ROOMS';
 end if;
 return new;
end $$;
create trigger guard_free20_abuse_activation before update of free20_abuse_enabled on public.hosting_commercial_policy for each row execute function anidachi_room_private.guard_free20_abuse_activation();

-- One bounded shared daily job. Unsettled rooms retain ALL marker evidence.
-- SKIP LOCKED avoids competing with an ACK/attach; a later daily run catches up.
create function public.cleanup_free20_marker_history_v1(p_limit integer default 10000)
returns integer language plpgsql security definer set search_path='' set lock_timeout='3s' set statement_timeout='30s' as $$
declare removed integer;
begin
 if p_limit is null or p_limit not between 1 and 10000 then raise exception 'FREE20_CLEANUP_INVALID' using errcode='22023'; end if;
 with expired as (
  select d.ctid from anidachi_room_private.free20_marker_days d
  where d.day<(clock_timestamp() at time zone 'UTC')::date-7 and not exists(
   select 1 from anidachi_room_private.free20_room_bindings b where b.kind=d.kind and b.marker_hash=d.marker_hash and b.settled_at is null)
  order by d.day,d.kind,d.marker_hash limit p_limit for update skip locked
 ) delete from anidachi_room_private.free20_marker_days d using expired e where d.ctid=e.ctid;
 get diagnostics removed=row_count;
 with expired as (
  select b.ctid from anidachi_room_private.free20_room_bindings b where b.settled_at<clock_timestamp()-interval '7 days'
   and not exists(select 1 from anidachi_room_private.free20_marker_days d where d.kind=b.kind and d.marker_hash=b.marker_hash)
  order by b.settled_at limit p_limit for update skip locked
 ) delete from anidachi_room_private.free20_room_bindings b using expired e where b.ctid=e.ctid;
 return removed;
end $$;
select cron.schedule('free20-marker-history-cleanup','17 3 * * *','select public.cleanup_free20_marker_history_v1();');

-- Private helpers and storage are inaccessible to runtime/browser roles.
do $$declare f record;
begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='anidachi_room_private' and (p.proname like '%free20%' or p.proname='protect_free20_binding_identity') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('read_free20_room_usage_v1','resolve_free20_context_access_v1','read_free20_context_status_v1','attach_free20_room_context_v1','create_room_with_active_session_v5','claim_active_room_session_v5','cleanup_free20_marker_history_v1') loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;
commit;
