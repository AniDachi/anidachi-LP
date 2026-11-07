-- Explicit admission-only capability. No socket, renewal, trigger or mode changes.
-- Full parameterized bodies preserve the deployed v3/v1 source, seat and replay
-- logic (including Netflix); old signatures are unsupported delegates, never aliases.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

CREATE OR REPLACE FUNCTION anidachi_room_private.create_room_with_active_session_v2(p_host_user_id uuid, p_participant_session_id text, p_show_id text, p_episode_id text, p_source_provider text, p_source_url text, p_video_fingerprint text, p_source_generation bigint, p_title text, p_client_request_id text, p_host_plan_code text, p_max_participants integer, p_max_media_seats integer, p_can_name_room boolean, p_can_send_push_invites boolean, p_free20_client_version integer DEFAULT NULL::integer)
 RETURNS TABLE(outcome text, room_record jsonb, active_room jsonb)
 LANGUAGE plpgsql
 SET search_path TO ''
 SET lock_timeout TO '5s'
 SET statement_timeout TO '30s'
AS $function$
declare
  v_policy boolean;
  v_hosting_policy public.hosting_commercial_policy%rowtype;
  v_authority jsonb;
  v_assignment public.active_room_sessions%rowtype;
  v_assignment_room public.rooms%rowtype;
  v_room public.rooms%rowtype;
  v_has_assignment boolean := false;
  v_has_existing_room boolean := false;
begin
  select active into strict v_policy from public.personal_history_policy where singleton for share;
  if p_host_user_id is null
    or p_participant_session_id is null
    or pg_catalog.char_length(p_participant_session_id) not between 1 and 128
    or (p_show_id is not null and pg_catalog.char_length(p_show_id) > 200)
    or (p_episode_id is not null and pg_catalog.char_length(p_episode_id) > 200)
    or (p_title is not null and pg_catalog.char_length(p_title) > 300)
    or (
      p_client_request_id is not null
      and (
        p_client_request_id <> pg_catalog.btrim(p_client_request_id)
        or pg_catalog.char_length(p_client_request_id) not between 1 and 100
      )
    )
    or p_host_plan_code is null
    or p_host_plan_code not in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie')
    or p_max_participants is null
    or p_max_participants not between 1 and 50
    or p_max_media_seats is null
    or p_max_media_seats not between 0 and 16
    or p_can_name_room is null
    or p_can_send_push_invites is null
    or (
      (p_source_provider is null) <> (p_source_url is null)
      or (p_source_provider is null) <> (p_video_fingerprint is null)
      or (p_source_provider is null) <> (p_source_generation is null)
    )
    or (
      p_source_provider is not null
      and (
        p_source_provider not in ('crunchyroll', 'youtube', 'netflix')
        or pg_catalog.char_length(p_source_url) not between 1 and 2048
        or pg_catalog.char_length(p_video_fingerprint) not between 1 and 400
        or p_source_generation not between 1 and 9007199254740991
      )
    )
  then
    raise exception 'active_room_session_invalid_input' using errcode = '22023';
  end if;

  v_hosting_policy:=public.lock_hosting_commercial_policy_v1();
  v_authority:=public.resolve_watch_history_access_v1(p_host_user_id);
  p_host_plan_code:=v_authority->>'planCode';
  if p_host_plan_code is null or p_host_plan_code not in ('free','plus','pro') then
    raise exception 'ROOM_AUTHORITY_UNAVAILABLE';
  end if;
  p_max_participants:=case p_host_plan_code when 'pro' then 15 when 'plus' then 6 else 4 end;
  p_max_media_seats:=4;
  p_can_name_room:=p_host_plan_code<>'free';
  p_can_send_push_invites:=p_host_plan_code<>'free';
  perform 1
  from public.users as account
  where account.id = p_host_user_id
  for update;
  if not found then
    raise exception 'active_room_session_user_not_found' using errcode = 'P0002';
  end if;

  if p_client_request_id is not null then
    select room.*
    into v_room
    from public.rooms as room
    where room.host_user_id = p_host_user_id
      and room.client_request_id = p_client_request_id
      and room.status <> 'ended'
    order by room.created_at asc
    limit 1
    for update;
    v_has_existing_room := found;
  end if;

  -- Final authority fence: time may expire between the outer resolver and this
  -- core's own canonical plan selection, even while all transaction locks hold.
  -- Deny before touching any room or active assignment, including stale cleanup.
  if p_free20_client_version is distinct from 1 and (
    (v_has_existing_room and v_room.hosting_time_mode='daily_free20') or
    (not v_has_existing_room and v_hosting_policy.free20_enabled and p_host_plan_code='free')
  ) then raise exception 'ROOM_UPDATE_REQUIRED_FREE20'; end if;

  select assignment.*
  into v_assignment
  from public.active_room_sessions as assignment
  where assignment.user_id = p_host_user_id
  for update;
  v_has_assignment := found;

  if v_has_assignment then
    select room.*
    into v_assignment_room
    from public.rooms as room
    where room.room_id = v_assignment.room_id;

    if not found or v_assignment_room.status = 'ended' then
      delete from public.active_room_sessions as assignment
      where assignment.user_id = p_host_user_id
        and assignment.room_id = v_assignment.room_id
        and assignment.participant_session_id = v_assignment.participant_session_id;
      v_has_assignment := false;
    elsif not v_has_existing_room or v_assignment.room_id <> v_room.room_id then
      return query select
        'conflict'::text,
        null::jsonb,
        pg_catalog.jsonb_build_object(
          'roomId', v_assignment.room_id,
          'role', v_assignment.role,
          'provider', v_assignment_room.source_provider,
          'title', pg_catalog.left(
            nullif(pg_catalog.btrim(v_assignment_room.title), ''),
            300
          )
        );
      return;
    end if;
  end if;

  if v_has_existing_room then
    if v_has_assignment
      and v_assignment.participant_session_id = p_participant_session_id
      and v_assignment.role = 'host'
    then
      update public.active_room_sessions as assignment
      set updated_at = pg_catalog.now()
      where assignment.user_id = p_host_user_id;
    else
      insert into public.active_room_sessions (
        user_id,
        room_id,
        role,
        participant_session_id,
        claimed_at,
        updated_at
      )
      values (
        p_host_user_id,
        v_room.room_id,
        'host',
        p_participant_session_id,
        pg_catalog.now(),
        pg_catalog.now()
      )
      on conflict (user_id) do update
      set
        room_id = excluded.room_id,
        role = excluded.role,
        participant_session_id = excluded.participant_session_id,
        claimed_at = excluded.claimed_at,
        updated_at = excluded.updated_at;
    end if;

    return query select
      'reused'::text,
      pg_catalog.to_jsonb(v_room),
      null::jsonb;
    return;
  end if;

  insert into public.rooms (
    host_user_id,
    show_id,
    episode_id,
    source_provider,
    source_url,
    video_fingerprint,
    source_generation,
    title,
    client_request_id,
    host_connected_at,
    host_plan_code,
    max_participants,
    max_media_seats,
    can_name_room,
    can_send_push_invites
  )
  values (
    p_host_user_id,
    p_show_id,
    p_episode_id,
    p_source_provider,
    p_source_url,
    p_video_fingerprint,
    p_source_generation,
    p_title,
    p_client_request_id,
    pg_catalog.now(),
    p_host_plan_code,
    p_max_participants,
    p_max_media_seats,
    p_can_name_room,
    p_can_send_push_invites
  )
  returning * into v_room;
  if v_policy then
    update public.rooms set media_lease='{}'::jsonb where room_id=v_room.room_id;
    perform public.renew_room_media_lease_v2(v_room.room_id);
    select * into v_room from public.rooms where room_id=v_room.room_id;
  end if;

  insert into public.active_room_sessions (
    user_id,
    room_id,
    role,
    participant_session_id
  )
  values (
    p_host_user_id,
    v_room.room_id,
    'host',
    p_participant_session_id
  );

  return query select
    'claimed'::text,
    pg_catalog.to_jsonb(v_room),
    null::jsonb;
end;
$function$;

CREATE OR REPLACE FUNCTION anidachi_room_private.claim_active_room_session_v2(p_user_id uuid, p_room_id text, p_role text, p_participant_session_id text, p_free20_client_version integer DEFAULT NULL::integer)
 RETURNS TABLE(outcome text, active_room jsonb)
 LANGUAGE plpgsql
 SET search_path TO ''
 SET lock_timeout TO '5s'
 SET statement_timeout TO '30s'
AS $function$
declare
  v_assignment public.active_room_sessions%rowtype;
  v_assignment_room public.rooms%rowtype;
  v_room public.rooms%rowtype;
  v_has_assignment boolean := false;
  v_preliminary_host uuid;
  v_account_id uuid;
begin
  if p_user_id is null
    or p_room_id is null
    or pg_catalog.char_length(p_room_id) not between 1 and 128
    or p_role is null
    or p_role not in ('host', 'member')
    or p_participant_session_id is null
    or pg_catalog.char_length(p_participant_session_id) not between 1 and 128
  then
    raise exception 'active_room_session_invalid_input' using errcode = '22023';
  end if;

  perform public.lock_hosting_commercial_policy_v1();
  select host_user_id into v_preliminary_host from public.rooms where room_id=p_room_id;
  -- Match shared admission's policy -> sorted accounts -> user -> room order.
  for v_account_id in select distinct id
    from unnest(array[v_preliminary_host,p_user_id]) ids(id)
    where id is not null order by id loop
    perform pg_advisory_xact_lock(hashtextextended(v_account_id::text,0));
  end loop;

  perform 1
  from public.users as account
  where account.id = p_user_id
  for update;
  if not found then
    raise exception 'active_room_session_user_not_found' using errcode = 'P0002';
  end if;

  select room.*
  into v_room
  from public.rooms as room
  where room.room_id = p_room_id
  for update;
  if not found or v_room.status = 'ended' then
    raise exception 'active_room_session_room_not_found' using errcode = 'P0002';
  end if;

  -- Never acquire a newly discovered host lock after locking the room.
  if v_room.host_user_id is distinct from v_preliminary_host then
    raise exception 'ROOM_AUTHORITY_UNAVAILABLE';
  end if;

  if (p_role = 'host' and v_room.host_user_id <> p_user_id)
    or (
      p_role = 'member'
      and not exists (
        select 1
        from public.room_members as member
        where member.room_id = p_room_id
          and member.user_id = p_user_id
      )
    )
  then
    raise exception 'active_room_session_role_invalid' using errcode = '42501';
  end if;

  if v_room.host_user_id=p_user_id and v_room.hosting_time_mode='daily_free20'
    and p_free20_client_version is distinct from 1 then
    raise exception 'ROOM_UPDATE_REQUIRED_FREE20';
  end if;
  perform public.require_room_hosting_admission_v1(p_room_id,p_user_id);

  select assignment.*
  into v_assignment
  from public.active_room_sessions as assignment
  where assignment.user_id = p_user_id
  for update;
  v_has_assignment := found;

  if v_has_assignment then
    select room.*
    into v_assignment_room
    from public.rooms as room
    where room.room_id = v_assignment.room_id;

    if not found or v_assignment_room.status = 'ended' then
      delete from public.active_room_sessions as assignment
      where assignment.user_id = p_user_id
        and assignment.room_id = v_assignment.room_id
        and assignment.participant_session_id = v_assignment.participant_session_id;
      v_has_assignment := false;
    elsif v_assignment.room_id <> p_room_id then
      return query select
        'conflict'::text,
        pg_catalog.jsonb_build_object(
          'roomId', v_assignment.room_id,
          'role', v_assignment.role,
          'provider', v_assignment_room.source_provider,
          'title', pg_catalog.left(
            nullif(pg_catalog.btrim(v_assignment_room.title), ''),
            300
          )
        );
      return;
    elsif v_assignment.participant_session_id = p_participant_session_id
      and v_assignment.role = p_role
    then
      update public.active_room_sessions as assignment
      set updated_at = pg_catalog.now()
      where assignment.user_id = p_user_id;
      return query select 'reused'::text, null::jsonb;
      return;
    end if;
  end if;

  insert into public.active_room_sessions (
    user_id,
    room_id,
    role,
    participant_session_id,
    claimed_at,
    updated_at
  )
  values (
    p_user_id,
    p_room_id,
    p_role,
    p_participant_session_id,
    pg_catalog.now(),
    pg_catalog.now()
  )
  on conflict (user_id) do update
  set
    room_id = excluded.room_id,
    role = excluded.role,
    participant_session_id = excluded.participant_session_id,
    claimed_at = excluded.claimed_at,
    updated_at = excluded.updated_at;

  return query select 'claimed'::text, null::jsonb;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_room_with_active_session_v4(p_host_user_id uuid, p_participant_session_id text, p_show_id text, p_episode_id text, p_source_provider text, p_source_url text, p_video_fingerprint text, p_source_generation bigint, p_title text, p_client_request_id text, p_host_plan_code text, p_max_participants integer, p_max_media_seats integer, p_can_name_room boolean, p_can_send_push_invites boolean, p_media_protocol_version integer DEFAULT 1, p_free20_client_version integer DEFAULT NULL::integer)
 RETURNS TABLE(outcome text, room_record jsonb, active_room jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '5s'
 SET statement_timeout TO '30s'
AS $function$
declare
 activated boolean;
 hosting_policy public.hosting_commercial_policy%rowtype;
 authority jsonb;
 existing_room public.rooms%rowtype;
 had_existing_room boolean;
 admitted record;
 pinned text;
 new_room public.rooms%rowtype;
begin
 select active into strict activated from public.personal_history_policy where singleton for share;
 if p_media_protocol_version is null or p_media_protocol_version not in (1,2,3)
    or (activated and p_media_protocol_version=1) then
   raise exception 'ROOM_UPDATE_REQUIRED';
 end if;
 -- Preserve the private core's complete input guard before our earlier
 -- authority lookup. This is the guard from 20260908065520; creation and
 -- entitlement logic remain exclusively in the unchanged private core.
  if p_host_user_id is null
    or p_participant_session_id is null
    or pg_catalog.char_length(p_participant_session_id) not between 1 and 128
    or (p_show_id is not null and pg_catalog.char_length(p_show_id) > 200)
    or (p_episode_id is not null and pg_catalog.char_length(p_episode_id) > 200)
    or (p_title is not null and pg_catalog.char_length(p_title) > 300)
    or (
      p_client_request_id is not null
      and (
        p_client_request_id <> pg_catalog.btrim(p_client_request_id)
        or pg_catalog.char_length(p_client_request_id) not between 1 and 100
      )
    )
    or p_host_plan_code is null
    or p_host_plan_code not in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie')
    or p_max_participants is null
    or p_max_participants not between 1 and 50
    or p_max_media_seats is null
    or p_max_media_seats not between 0 and 16
    or p_can_name_room is null
    or p_can_send_push_invites is null
    or (
      (p_source_provider is null) <> (p_source_url is null)
      or (p_source_provider is null) <> (p_video_fingerprint is null)
      or (p_source_provider is null) <> (p_source_generation is null)
    )
    or (
      p_source_provider is not null
      and (
        p_source_provider not in ('crunchyroll', 'youtube', 'netflix')
        or pg_catalog.char_length(p_source_url) not between 1 and 2048
        or pg_catalog.char_length(p_video_fingerprint) not between 1 and 400
        or p_source_generation not between 1 and 9007199254740991
      )
    )
  then
    raise exception 'active_room_session_invalid_input' using errcode = '22023';
  end if;
 -- Match the private core's policy -> account -> room lock order. All creates
 -- serialize on this account; the lookup is identical to the core's reuse test.
 hosting_policy:=public.lock_hosting_commercial_policy_v1();
 authority:=public.resolve_watch_history_access_v1(p_host_user_id);
 if authority->>'planCode' is null or authority->>'planCode' not in ('free','plus','pro') then
  raise exception 'ROOM_AUTHORITY_UNAVAILABLE';
 end if;
 perform 1 from public.users where id=p_host_user_id for update;
 select room.* into existing_room from public.rooms room
 where room.host_user_id=p_host_user_id and room.client_request_id=p_client_request_id
   and room.status<>'ended'
 order by room.created_at asc limit 1 for update;
 had_existing_room:=found;
 -- Capability takes precedence over finite quota and active-room conflict, but
 -- only for the actual marked target or a new canonically Free20 target.
 if p_free20_client_version is distinct from 1 and (
   (had_existing_room and existing_room.hosting_time_mode='daily_free20') or
   (not had_existing_room and hosting_policy.free20_enabled and authority->>'planCode'='free')
 ) then raise exception 'ROOM_UPDATE_REQUIRED_FREE20'; end if;
 perform public.require_room_hosting_access_v1(p_host_user_id);
 if p_media_protocol_version<>3 and
   public.resolve_free20_hosting_access_v1(p_host_user_id)->>'planCode'='free' then
  raise exception 'ROOM_UPDATE_REQUIRED';
 end if;
 if had_existing_room then perform public.require_room_hosting_admission_v1(existing_room.room_id,p_host_user_id); end if;
 if had_existing_room and existing_room.media_lease is not null then
   pinned:=existing_room.media_lease#>>'{capabilities,mediaProtocolVersion}';
   if pinned is null or pinned not in ('2','3')
      or (pinned='3' and p_media_protocol_version<>3)
      or (pinned='2' and p_media_protocol_version not in (2,3)) then
     raise exception 'ROOM_UPDATE_REQUIRED';
   end if;
 end if;
 -- Outcome 'claimed' can also mean a replacement session on an existing room.
 -- Newness comes only from the locked lookup, never the outcome value.
 select * into admitted from anidachi_room_private.create_room_with_active_session_v2(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites,p_free20_client_version);
 if not had_existing_room and admitted.room_record is not null and activated and p_media_protocol_version=3 then
   -- The core has already resolved the durable plan and minted the initial
   -- lease. Select v3 before returning or releasing locks, retaining its bounds.
   update public.rooms
   set max_media_seats=(media_lease#>>'{capabilities,maxMicrophones}')::integer,
       media_lease=pg_catalog.jsonb_set(media_lease,'{capabilities}',
     ((media_lease->'capabilities') - 'maxMicrophones') ||
     pg_catalog.jsonb_build_object('mediaProtocolVersion',3,'maxMediaSeats',
       (media_lease#>>'{capabilities,maxMicrophones}')::integer))
   where room_id=admitted.room_record->>'room_id'
   returning * into strict new_room;
   admitted.room_record:=pg_catalog.to_jsonb(new_room);
 end if;
 return query select admitted.outcome,admitted.room_record,admitted.active_room;
end $function$;

CREATE OR REPLACE FUNCTION public.claim_active_room_session_v4(p_user_id uuid, p_room_id text, p_role text, p_participant_session_id text, p_media_protocol_version integer DEFAULT 1, p_free20_client_version integer DEFAULT NULL::integer)
 RETURNS TABLE(outcome text, active_room jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '5s'
 SET statement_timeout TO '30s'
AS $function$
declare lease jsonb; pinned text;
begin
 perform 1 from public.personal_history_policy where singleton for share;
 if p_media_protocol_version is null or p_media_protocol_version not in (1,2,3) then raise exception 'ROOM_UPDATE_REQUIRED'; end if;
 select media_lease into lease from public.rooms where room_id=p_room_id;
 if lease is not null then
   pinned:=lease#>>'{capabilities,mediaProtocolVersion}';
   if pinned is null or pinned not in ('2','3')
      or (pinned='3' and p_media_protocol_version<>3)
      or (pinned='2' and p_media_protocol_version not in (2,3)) then
     raise exception 'ROOM_UPDATE_REQUIRED';
   end if;
 end if;
 return query select * from anidachi_room_private.claim_active_room_session_v2(p_user_id,p_room_id,p_role,p_participant_session_id,p_free20_client_version);
end $function$;

CREATE OR REPLACE FUNCTION public.create_room_with_active_session_v3(p_host_user_id uuid, p_participant_session_id text, p_show_id text, p_episode_id text, p_source_provider text, p_source_url text, p_video_fingerprint text, p_source_generation bigint, p_title text, p_client_request_id text, p_host_plan_code text, p_max_participants integer, p_max_media_seats integer, p_can_name_room boolean, p_can_send_push_invites boolean, p_media_protocol_version integer DEFAULT 1)
 RETURNS TABLE(outcome text, room_record jsonb, active_room jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 return query select * from public.create_room_with_active_session_v4(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites,p_media_protocol_version,null);
end;
$function$;

CREATE OR REPLACE FUNCTION public.claim_active_room_session_v3(p_user_id uuid, p_room_id text, p_role text, p_participant_session_id text, p_media_protocol_version integer DEFAULT 1)
 RETURNS TABLE(outcome text, active_room jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 return query select * from public.claim_active_room_session_v4(p_user_id,p_room_id,p_role,p_participant_session_id,p_media_protocol_version,null);
end;
$function$;

CREATE OR REPLACE FUNCTION anidachi_room_private.create_room_with_active_session_v1(p_host_user_id uuid, p_participant_session_id text, p_show_id text, p_episode_id text, p_source_provider text, p_source_url text, p_video_fingerprint text, p_source_generation bigint, p_title text, p_client_request_id text, p_host_plan_code text, p_max_participants integer, p_max_media_seats integer, p_can_name_room boolean, p_can_send_push_invites boolean)
 RETURNS TABLE(outcome text, room_record jsonb, active_room jsonb)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 return query select * from anidachi_room_private.create_room_with_active_session_v2(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites,null);
end;
$function$;

CREATE OR REPLACE FUNCTION anidachi_room_private.claim_active_room_session_v1(p_user_id uuid, p_room_id text, p_role text, p_participant_session_id text)
 RETURNS TABLE(outcome text, active_room jsonb)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 return query select * from anidachi_room_private.claim_active_room_session_v2(p_user_id,p_room_id,p_role,p_participant_session_id,null);
end;
$function$;

revoke all on function anidachi_room_private.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer) from public,anon,authenticated,service_role;
revoke all on function anidachi_room_private.claim_active_room_session_v2(uuid,text,text,text,integer) from public,anon,authenticated,service_role;
revoke all on function public.create_room_with_active_session_v4(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.create_room_with_active_session_v4(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer,integer) to service_role;
revoke all on function public.claim_active_room_session_v4(uuid,text,text,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_active_room_session_v4(uuid,text,text,text,integer,integer) to service_role;
revoke all on function public.create_room_with_active_session_v3(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer) from public,anon,authenticated,service_role;
grant execute on function public.create_room_with_active_session_v3(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer) to service_role;
revoke all on function public.claim_active_room_session_v3(uuid,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_active_room_session_v3(uuid,text,text,text,integer) to service_role;
revoke all on function anidachi_room_private.create_room_with_active_session_v1(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean) from public,anon,authenticated,service_role;
revoke all on function anidachi_room_private.claim_active_room_session_v1(uuid,text,text,text) from public,anon,authenticated,service_role;
commit;
