begin;

-- One durable assignment per account is the cross-provider room admission
-- authority. room_members remains historical access context, not live presence.
create table public.active_room_sessions (
  user_id uuid primary key references public.users (id) on delete cascade,
  room_id text not null references public.rooms (room_id) on delete cascade,
  role text not null check (role in ('host', 'member')),
  participant_session_id text not null
    check (pg_catalog.char_length(participant_session_id) between 1 and 128),
  claimed_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create index active_room_sessions_room_id_idx
  on public.active_room_sessions (room_id);

alter table public.active_room_sessions enable row level security;
revoke all on table public.active_room_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.active_room_sessions
  to service_role;

-- Lock order for admission RPCs is always:
--   1. the account row;
--   2. the requested room row when one exists;
--   3. the account's active assignment.
-- Room finalization locks only the room before deleting assignments. This keeps
-- same-account claims serial without introducing a second distributed lock.
create function public.create_room_with_active_session_v1(
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
  v_assignment public.active_room_sessions%rowtype;
  v_assignment_room public.rooms%rowtype;
  v_room public.rooms%rowtype;
  v_has_assignment boolean := false;
  v_has_existing_room boolean := false;
begin
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
    or p_host_plan_code not in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie')
    or p_max_participants not between 1 and 50
    or p_max_media_seats not between 0 and 16
    or p_can_name_room is null
    or p_can_send_push_invites is null
    or (
      (p_source_provider is null)
      <> (
        p_source_url is null
        or p_video_fingerprint is null
        or p_source_generation is null
      )
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

create function public.claim_active_room_session_v1(
  p_user_id uuid,
  p_room_id text,
  p_role text,
  p_participant_session_id text
)
returns table (
  outcome text,
  active_room jsonb
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_assignment public.active_room_sessions%rowtype;
  v_assignment_room public.rooms%rowtype;
  v_room public.rooms%rowtype;
  v_has_assignment boolean := false;
begin
  if p_user_id is null
    or p_room_id is null
    or pg_catalog.char_length(p_room_id) not between 1 and 128
    or p_role not in ('host', 'member')
    or p_participant_session_id is null
    or pg_catalog.char_length(p_participant_session_id) not between 1 and 128
  then
    raise exception 'active_room_session_invalid_input' using errcode = '22023';
  end if;

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
$$;

create function public.release_active_room_session_v1(
  p_user_id uuid,
  p_room_id text,
  p_participant_session_id text
)
returns table (outcome text)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_deleted integer := 0;
begin
  if p_user_id is null
    or p_room_id is null
    or pg_catalog.char_length(p_room_id) not between 1 and 128
    or p_participant_session_id is null
    or pg_catalog.char_length(p_participant_session_id) not between 1 and 128
  then
    raise exception 'active_room_session_invalid_input' using errcode = '22023';
  end if;

  delete from public.active_room_sessions as assignment
  where assignment.user_id = p_user_id
    and assignment.room_id = p_room_id
    and assignment.participant_session_id = p_participant_session_id;
  get diagnostics v_deleted = row_count;

  return query select case when v_deleted = 1 then 'released' else 'stale' end;
end;
$$;

-- If a host closes the tab after claiming but before the first Worker JOIN,
-- there is no socket for the Worker to validate. End only an exact host lobby
-- assignment; a live room or a superseded session always returns stale.
create function public.end_host_lobby_for_active_session_v1(
  p_user_id uuid,
  p_room_id text,
  p_participant_session_id text,
  p_ended_at timestamptz
)
returns table (outcome text)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_assignment public.active_room_sessions%rowtype;
  v_room public.rooms%rowtype;
begin
  if p_user_id is null
    or p_room_id is null
    or pg_catalog.char_length(p_room_id) not between 1 and 128
    or p_participant_session_id is null
    or pg_catalog.char_length(p_participant_session_id) not between 1 and 128
    or p_ended_at is null
  then
    raise exception 'active_room_session_invalid_input' using errcode = '22023';
  end if;

  perform 1
  from public.users as account
  where account.id = p_user_id
  for update;
  if not found then
    return query select 'stale'::text;
    return;
  end if;

  select room.*
  into v_room
  from public.rooms as room
  where room.room_id = p_room_id
  for update;
  if not found then
    return query select 'stale'::text;
    return;
  end if;

  select assignment.*
  into v_assignment
  from public.active_room_sessions as assignment
  where assignment.user_id = p_user_id
  for update;

  if not found
    or v_room.status <> 'lobby'
    or v_room.host_user_id <> p_user_id
    or v_assignment.room_id <> p_room_id
    or v_assignment.role <> 'host'
    or v_assignment.participant_session_id <> p_participant_session_id
  then
    return query select 'stale'::text;
    return;
  end if;

  update public.rooms as room
  set
    status = 'ended',
    ended_at = p_ended_at,
    host_connected_at = null,
    last_active_at = p_ended_at
  where room.id = v_room.id;

  delete from public.active_room_sessions as assignment
  where assignment.room_id = p_room_id;

  return query select 'room_ended'::text;
end;
$$;

-- Keep the existing usage settlement behavior while making room finalization
-- the repair boundary for every participant assignment, including retries.
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

    if v_usage_seconds > 0 then
      insert into public.usage_daily (user_id, day, host_seconds, updated_at)
      values (v_room.host_user_id, v_usage_day, v_usage_seconds, pg_catalog.now())
      on conflict (user_id, day)
      do update set
        host_seconds = public.usage_daily.host_seconds + excluded.host_seconds,
        updated_at = pg_catalog.now();
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

revoke all on function
  public.create_room_with_active_session_v1(
    uuid, text, text, text, text, text, text, bigint,
    text, text, text, integer, integer, boolean, boolean
  ),
  public.claim_active_room_session_v1(uuid, text, text, text),
  public.release_active_room_session_v1(uuid, text, text),
  public.end_host_lobby_for_active_session_v1(uuid, text, text, timestamptz),
  public.finalize_room_usage(text, timestamptz, date, integer)
from public, anon, authenticated;

grant execute on function
  public.create_room_with_active_session_v1(
    uuid, text, text, text, text, text, text, bigint,
    text, text, text, integer, integer, boolean, boolean
  ),
  public.claim_active_room_session_v1(uuid, text, text, text),
  public.release_active_room_session_v1(uuid, text, text),
  public.end_host_lobby_for_active_session_v1(uuid, text, text, timestamptz),
  public.finalize_room_usage(text, timestamptz, date, integer)
to service_role;

commit;
