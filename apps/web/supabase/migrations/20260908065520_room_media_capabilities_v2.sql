begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
alter table public.rooms add column media_lease jsonb, add column media_closing_at timestamptz;
create table public.room_usage_days_v1 (
 room_id text not null references public.rooms(room_id) on delete cascade,
 day date not null,
 cumulative_seconds integer not null check(cumulative_seconds between 0 and 86400),
 primary key(room_id,day)
);
alter table public.room_usage_days_v1 enable row level security;
revoke all on public.room_usage_days_v1 from public,anon,authenticated,service_role;
-- Only the trusted lifecycle callback may submit cumulative actual-socket time.
create function public.commit_room_usage_day_v1(p_room_id text,p_day date,p_cumulative_seconds integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.rooms%rowtype; old_seconds integer:=0; accepted integer;
begin
 if p_day is null or p_cumulative_seconds is null or p_cumulative_seconds not between 0 and 86400 or p_day > (pg_catalog.clock_timestamp() at time zone 'UTC')::date then raise exception 'ROOM_USAGE_INVALID' using errcode='22023'; end if;
 select * into strict r from public.rooms where room_id=p_room_id for update;
 if r.host_plan_code not in ('free','watcher') then raise exception 'ROOM_USAGE_NOT_METERED'; end if;
 if p_day < (r.created_at at time zone 'UTC')::date then raise exception 'ROOM_USAGE_INVALID_DAY'; end if;
 select cumulative_seconds into old_seconds from public.room_usage_days_v1 where room_id=p_room_id and day=p_day;
 old_seconds:=coalesce(old_seconds,0);
 -- Ended rooms accept exact or older replay only; never append after terminal ACK.
 if r.status='ended' and p_cumulative_seconds>old_seconds then raise exception 'ROOM_USAGE_ENDED'; end if;
 accepted:=greatest(old_seconds,p_cumulative_seconds);
 insert into public.room_usage_days_v1 values(p_room_id,p_day,accepted) on conflict(room_id,day) do update set cumulative_seconds=excluded.cumulative_seconds;
 if accepted>old_seconds then
 insert into public.usage_daily(user_id,day,host_seconds,updated_at) values(r.host_user_id,p_day,accepted-old_seconds,pg_catalog.now())
 on conflict(user_id,day) do update set host_seconds=public.usage_daily.host_seconds+excluded.host_seconds,updated_at=excluded.updated_at;
 end if;
 return pg_catalog.jsonb_build_object('day',p_day,'seconds',accepted);
end $$;
revoke all on function public.commit_room_usage_day_v1(text,date,integer) from public,anon,authenticated;
grant execute on function public.commit_room_usage_day_v1(text,date,integer) to service_role;

-- Policy -> account -> room, matching the history/account lock order. Room caps
-- are frozen at creation; this RPC renews authority but cannot increase them.
create function public.renew_room_media_lease_v2(p_room_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.rooms%rowtype; owner_id uuid; authority jsonb; t timestamptz; expiry timestamptz; paid_until timestamptz; caps jsonb; revision bigint;
begin
 perform 1 from public.personal_history_policy where singleton for share;
 select host_user_id into strict owner_id from public.rooms where room_id=p_room_id;
 authority:=public.resolve_watch_history_access_v1(owner_id);
 select * into strict r from public.rooms where room_id=p_room_id for update;
 if r.status='ended' then raise exception 'ROOM_ENDED'; end if;
 if r.media_lease is null then return null; end if;
 t:=pg_catalog.clock_timestamp();
 if r.media_closing_at is not null then return pg_catalog.jsonb_build_object('denied',true,'closingAt',r.media_closing_at); end if;
 if (r.host_plan_code='pro' and authority->>'planCode'<>'pro') or (r.host_plan_code='plus' and authority->>'planCode' not in ('plus','pro')) then
 update public.rooms set media_closing_at=t+interval '5 minutes' where room_id=p_room_id;
 return pg_catalog.jsonb_build_object('denied',true,'closingAt',t+interval '5 minutes');
 end if;
 paid_until:=case when r.host_plan_code='free' then null else (authority->>'selectedPlanExpiresAt')::timestamptz end;
 expiry:=least(t+interval '30 minutes',coalesce(paid_until,'infinity'::timestamptz));
 revision:=coalesce((r.media_lease->'capabilities'->>'capabilityRevision')::bigint,0)+1;
 caps:=pg_catalog.jsonb_build_object('mediaProtocolVersion',2,'hostPlanCode',r.host_plan_code,'maxParticipants',r.max_participants,'maxCameras',4,'maxMicrophones',case r.host_plan_code when 'pro' then 8 when 'plus' then 6 else 4 end,'capabilityRevision',revision,'capabilitiesValidUntil',expiry);
 update public.rooms set media_lease=pg_catalog.jsonb_build_object('roomId',p_room_id,'roomGeneration',1,'issuedAt',t,'paidUntil',paid_until,'capabilities',caps) where room_id=p_room_id returning * into r;
 return r.media_lease;
end $$;
revoke all on function public.renew_room_media_lease_v2(text) from public,anon,authenticated;
grant execute on function public.renew_room_media_lease_v2(text) to service_role;
create or replace function public.create_room_with_active_session_v1(
  p_host_user_id uuid,
  p_participant_session_id text,
  p_show_id text,
  p_episode_id text,
  p_source_provider text,
  p_source_url text,
  p_video_fingerprint text,
  p_source_generation bigint,
  p_title text,
  p_client_request_id text,
  p_host_plan_code text,
  p_max_participants integer,
  p_max_media_seats integer,
  p_can_name_room boolean,
  p_can_send_push_invites boolean
)
returns table (
  outcome text,
  room_record jsonb,
  active_room jsonb
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_policy boolean;
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
        p_source_provider not in ('crunchyroll', 'youtube')
        or pg_catalog.char_length(p_source_url) not between 1 and 2048
        or pg_catalog.char_length(p_video_fingerprint) not between 1 and 400
        or p_source_generation not between 1 and 9007199254740991
      )
    )
  then
    raise exception 'active_room_session_invalid_input' using errcode = '22023';
  end if;

  v_authority:=public.resolve_watch_history_access_v1(p_host_user_id);
  p_host_plan_code:=v_authority->>'planCode';
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
$$;

create or replace function public.finalize_room_usage(
  p_room_id text,
  p_ended_at timestamptz,
  p_usage_day date default null,
  p_usage_seconds integer default null
) returns table (
  already_ended boolean,
  finalized_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_first_guest_joined_at timestamptz;
  v_metered_started_at timestamptz;
  v_usage_day date;
  v_usage_seconds integer := 0;
begin
  if p_room_id is null or pg_catalog.btrim(p_room_id) = '' or p_ended_at is null then
    raise exception 'Invalid room finalization input'
      using errcode = '22023';
  end if;

  if (p_usage_day is null) <> (p_usage_seconds is null) then
    raise exception 'Usage day and seconds must be provided together'
      using errcode = '22023';
  end if;

  select room.*
    into v_room
    from public.rooms as room
   where room.room_id = p_room_id
   for update;

  if not found then
    raise exception 'Room not found'
      using errcode = 'P0002';
  end if;

  if v_room.status = 'ended' then
    delete from public.active_room_sessions as assignment
    where assignment.room_id = p_room_id;
    already_ended := true;
    finalized_at := v_room.ended_at;
    return next;
    return;
  end if;

  if v_room.host_plan_code in ('free', 'watcher') then
    if p_usage_seconds is not null then
      if p_usage_seconds < 0 or p_usage_seconds > 24 * 60 * 60 then
        raise exception 'Invalid room usage seconds'
          using errcode = '22023';
      end if;
      v_usage_day := p_usage_day;
      v_usage_seconds := p_usage_seconds;
    else
      select pg_catalog.min(member.joined_at)
        into v_first_guest_joined_at
        from public.room_members as member
       where member.room_id = p_room_id;

      if v_room.host_connected_at is not null and v_first_guest_joined_at is not null then
        v_metered_started_at := greatest(
          v_room.host_connected_at,
          v_first_guest_joined_at
        );
        v_usage_day := (v_metered_started_at at time zone 'UTC')::date;
        v_usage_seconds := greatest(
          0,
          least(
            30 * 60,
            pg_catalog.floor(
              extract(epoch from (p_ended_at - v_metered_started_at))
            )::integer
          )
        );
      end if;
    end if;

    if rtrim(coalesce(v_room.media_lease::text,''))<>'' and p_usage_seconds is null then
      raise exception 'ROOM_USAGE_ACK_REQUIRED';
    end if;
    if v_usage_day is not null then
      perform public.commit_room_usage_day_v1(p_room_id,v_usage_day,v_usage_seconds);
    end if;
  end if;

  update public.rooms as room
     set status = 'ended',
         ended_at = p_ended_at,
         host_connected_at = null,
         last_active_at = p_ended_at
   where room.id = v_room.id;

  delete from public.active_room_sessions as assignment
  where assignment.room_id = p_room_id;

  already_ended := false;
  finalized_at := p_ended_at;
  return next;
end;
$$;
commit;
