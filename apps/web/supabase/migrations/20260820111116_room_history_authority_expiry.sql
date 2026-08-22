-- ROOM_HISTORY_GRACE_AMENDMENT_REQUIRED
-- Reviewed Task 9 amendment: room-history authority has exactly 86,400 seconds
-- of offline grace. The legacy six-claim branch preserves migration-first
-- compatibility while deriving and enforcing the same boundary.

create or replace function public.apply_watch_progress_v2(
  p_user_id uuid,
  p_event jsonb,
  p_room_authority jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  server_accepted_at timestamptz := pg_catalog.transaction_timestamp();
  settings_row public.user_watch_settings%rowtype;
  existing_receipt public.watch_history_receipts%rowtype;
  existing_progress public.watch_episode_progress%rowtype;
  shared_session_row public.watch_sessions%rowtype;
  room_row public.rooms%rowtype;
  member_joined_at timestamptz;
  authority_issued_at timestamptz;
  authority_expires_at timestamptz;
  legacy_authority boolean;
  client_event_id uuid;
  account_generation bigint;
  provider_value text;
  title_key_value text;
  episode_key_value text;
  source_url_value text;
  client_session_key_value text;
  event_kind_value text;
  normalized_observed_at timestamptz;
  server_order_value bigint;
  session_id_value uuid;
  participant_role text;
  other_user_id_value uuid;
  completion_value timestamptz;
  episode_payload jsonb;
  acknowledgement_value jsonb;
begin
  if p_user_id is null or pg_catalog.jsonb_typeof(p_event) <> 'object' then
    raise exception 'watch_history_event_invalid' using errcode = '22023';
  end if;

  client_event_id := (p_event ->> 'clientEventId')::uuid;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  insert into public.user_watch_settings (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select settings.*
  into strict settings_row
  from public.user_watch_settings as settings
  where settings.user_id = p_user_id
  for update;

  select receipt.*
  into existing_receipt
  from public.watch_history_receipts as receipt
  where receipt.user_id = p_user_id
    and receipt.client_id = client_event_id
    and receipt.expires_at > server_accepted_at;

  if found then
    if existing_receipt.kind <> 'progress' then
      raise exception 'watch_history_client_id_conflict' using errcode = '23505';
    end if;
    return existing_receipt.acknowledgement;
  end if;

  if (p_event ->> 'accountGeneration') is null
    or (p_event ->> 'accountGeneration') !~ '^[1-9][0-9]*$'
  then
    raise exception 'watch_history_event_invalid' using errcode = '22023';
  end if;
  account_generation := (p_event ->> 'accountGeneration')::bigint;
  if account_generation <> settings_row.history_generation then
    raise exception 'watch_history_generation_mismatch' using errcode = 'P0001';
  end if;

  provider_value := p_event ->> 'provider';
  title_key_value := p_event ->> 'titleKey';
  episode_key_value := p_event ->> 'episodeKey';
  source_url_value := p_event ->> 'sourceUrl';
  client_session_key_value := p_event ->> 'clientSessionKey';
  event_kind_value := p_event ->> 'kind';

  if provider_value not in ('crunchyroll', 'youtube')
    or provider_value is null
    or title_key_value is null
    or char_length(title_key_value) not between 1 and 220
    or episode_key_value is null
    or char_length(episode_key_value) not between 1 and 220
    or client_session_key_value is null
    or char_length(client_session_key_value) not between 1 and 220
    or source_url_value is null
    or event_kind_value not in (
      'heartbeat', 'pause', 'seek', 'source_change', 'pagehide',
      'room_leave', 'room_end', 'ended'
    )
  then
    raise exception 'watch_history_event_invalid' using errcode = '22023';
  end if;

  if (p_event ->> 'itemKind') not in ('series', 'movie')
    or char_length(p_event ->> 'title') not between 1 and 300
    or char_length(p_event ->> 'episodeTitle') not between 1 and 300
    or (p_event ->> 'currentTime')::double precision < 0
    or (p_event ->> 'duration')::double precision < 0
    or (p_event ->> 'progress')::double precision not between 0 and 1
  then
    raise exception 'watch_history_event_invalid' using errcode = '22023';
  end if;

  if (
    provider_value = 'crunchyroll'
    and source_url_value !~ '^https://(www[.])?crunchyroll[.]com/'
  ) or (
    provider_value = 'youtube'
    and source_url_value !~ '^https://(www[.])?youtube[.]com/watch([/?#]|$)'
  ) then
    raise exception 'watch_history_provider_domain_mismatch' using errcode = '22023';
  end if;

  normalized_observed_at := least(
    (p_event ->> 'observedAt')::timestamptz,
    server_accepted_at
  );

  if p_event -> 'sharedRoom' is null
    or pg_catalog.jsonb_typeof(p_event -> 'sharedRoom') = 'null'
  then
    if p_room_authority is not null then
      raise exception 'watch_history_authority_unexpected' using errcode = '22023';
    end if;
    participant_role := 'host';
  else
    if pg_catalog.jsonb_typeof(p_event -> 'sharedRoom') <> 'object'
      or pg_catalog.jsonb_typeof(p_room_authority) <> 'object'
      or p_room_authority ->> 'sub' is null
      or p_room_authority ->> 'sub' <> p_user_id::text
      or p_room_authority ->> 'roomId' is null
      or p_room_authority ->> 'roomId' <> p_event #>> '{sharedRoom,roomId}'
      or p_room_authority ->> 'participantSessionId' is null
      or char_length(p_room_authority ->> 'participantSessionId') = 0
      or p_room_authority ->> 'participantSessionId'
        <> p_event #>> '{sharedRoom,participantSessionId}'
      or p_room_authority ->> 'roomGeneration' is null
      or p_room_authority ->> 'sourceGeneration' is null
      or (p_room_authority ->> 'roomGeneration') !~ '^[1-9][0-9]*$'
      or (p_room_authority ->> 'sourceGeneration') !~ '^[1-9][0-9]*$'
      or p_event #>> '{sharedRoom,roomGeneration}' is null
      or p_event #>> '{sharedRoom,sourceGeneration}' is null
      or (p_event #>> '{sharedRoom,roomGeneration}') !~ '^[1-9][0-9]*$'
      or (p_event #>> '{sharedRoom,sourceGeneration}') !~ '^[1-9][0-9]*$'
      or p_room_authority ->> 'iat' is null
      or (p_room_authority ->> 'iat') !~ '^[0-9]{1,10}$'
    then
      raise exception 'watch_history_authority_mismatch' using errcode = '22023';
    end if;

    if (p_room_authority ->> 'roomGeneration')::bigint
        <> (p_event #>> '{sharedRoom,roomGeneration}')::bigint
      or (p_room_authority ->> 'sourceGeneration')::bigint
        <> (p_event #>> '{sharedRoom,sourceGeneration}')::bigint
      or (p_room_authority ->> 'roomGeneration')::bigint <= 0
      or (p_room_authority ->> 'sourceGeneration')::bigint <= 0
    then
      raise exception 'watch_history_authority_mismatch' using errcode = '22023';
    end if;

    legacy_authority :=
      not (p_room_authority ? 'exp')
      and not (p_room_authority ? 'jti')
      and (
        select pg_catalog.count(*)
        from pg_catalog.jsonb_object_keys(p_room_authority)
      ) = 6;

    if legacy_authority then
      authority_expires_at := pg_catalog.to_timestamp(
        ((p_room_authority ->> 'iat')::bigint + 86400)::double precision
      );
    else
      if (
        select pg_catalog.count(*)
        from pg_catalog.jsonb_object_keys(p_room_authority)
      ) <> 11
        or p_room_authority ->> 'typ' <> 'room_history'
        or p_room_authority ->> 'iss' <> 'anidachi-worker'
        or p_room_authority ->> 'aud' <> 'anidachi-web-history'
        or p_room_authority ->> 'exp' is null
        or (p_room_authority ->> 'exp') !~ '^[0-9]{1,10}$'
        or (p_room_authority ->> 'jti') is null
        or (p_room_authority ->> 'jti')
          !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        or (p_room_authority ->> 'exp')::bigint
          <> (p_room_authority ->> 'iat')::bigint + 86400
      then
        raise exception 'watch_history_authority_mismatch' using errcode = '22023';
      end if;
      authority_expires_at := pg_catalog.to_timestamp(
        (p_room_authority ->> 'exp')::double precision
      );
    end if;

    authority_issued_at := pg_catalog.to_timestamp(
      (p_room_authority ->> 'iat')::double precision
    );

    if authority_expires_at <= server_accepted_at then
      raise exception 'watch_history_authority_expired' using errcode = 'P0001';
    end if;

    select room.*
    into room_row
    from public.rooms as room
    where room.room_id = p_room_authority ->> 'roomId';

    if not found then
      raise exception 'watch_history_room_unknown' using errcode = 'P0001';
    end if;

    if room_row.host_user_id = p_user_id then
      participant_role := 'host';
      if authority_issued_at < pg_catalog.date_trunc('second', room_row.created_at) then
        raise exception 'watch_history_authority_before_room' using errcode = 'P0001';
      end if;
    else
      select member.joined_at
      into member_joined_at
      from public.room_members as member
      where member.room_id = room_row.room_id
        and member.user_id = p_user_id;

      if not found then
        raise exception 'watch_history_room_member_required' using errcode = 'P0001';
      end if;
      participant_role := 'viewer';
      if authority_issued_at < pg_catalog.date_trunc('second', member_joined_at) then
        raise exception 'watch_history_authority_before_join' using errcode = 'P0001';
      end if;
    end if;

    if room_row.ended_at is not null
      and authority_issued_at > pg_catalog.date_trunc('second', room_row.ended_at)
    then
      raise exception 'watch_history_authority_after_end' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1
    from public.watch_history_deletions as deletion
    where deletion.user_id = p_user_id
      and deletion.history_generation = account_generation
      and normalized_observed_at <= deletion.deleted_at
      and (
        deletion.scope = 'all'
        or (
          deletion.scope = 'title'
          and deletion.provider = provider_value
          and deletion.title_key = title_key_value
        )
        or (
          deletion.scope = 'episode'
          and deletion.provider = provider_value
          and deletion.title_key = title_key_value
          and deletion.episode_key = episode_key_value
        )
      )
  ) then
    raise exception 'watch_history_deleted' using errcode = 'P0001';
  end if;

  select episode.*
  into existing_progress
  from public.watch_episode_progress as episode
  where episode.user_id = p_user_id
    and episode.provider = provider_value
    and episode.title_key = title_key_value
    and episode.episode_key = episode_key_value;

  if found and normalized_observed_at < existing_progress.observed_at then
    raise exception 'watch_history_observation_stale' using errcode = 'P0001';
  end if;

  if p_event -> 'sharedRoom' is not null
    and pg_catalog.jsonb_typeof(p_event -> 'sharedRoom') <> 'null'
  then
    select session.*
    into shared_session_row
    from public.watch_sessions as session
    where session.schema_version = 2
      and session.room_id = room_row.room_id
      and session.room_generation = (p_room_authority ->> 'roomGeneration')::bigint
      and session.source_generation = (p_room_authority ->> 'sourceGeneration')::bigint
    for update;

    if found then
      if shared_session_row.provider <> provider_value
        or shared_session_row.item_key <> title_key_value
        or shared_session_row.episode_key <> episode_key_value
        or shared_session_row.source_url <> source_url_value
      then
        raise exception 'watch_history_shared_source_mismatch' using errcode = 'P0001';
      end if;
      session_id_value := shared_session_row.id;
    elsif participant_role = 'viewer' then
      raise exception 'watch_history_shared_session_pending' using errcode = 'P0001';
    else
      insert into public.watch_sessions (
        room_id,
        host_user_id,
        provider,
        item_key,
        item_kind,
        item_title,
        episode_key,
        episode_title,
        season_key,
        season_title,
        season_number,
        source_url,
        artwork_url,
        duration_seconds,
        current_time_seconds,
        progress,
        started_at,
        ended_at,
        last_checkpoint_at,
        updated_at,
        schema_version,
        history_generation,
        client_session_key,
        room_generation,
        source_generation
      ) values (
        room_row.room_id,
        room_row.host_user_id,
        provider_value,
        title_key_value,
        p_event ->> 'itemKind',
        p_event ->> 'title',
        episode_key_value,
        p_event ->> 'episodeTitle',
        nullif(p_event ->> 'seasonKey', ''),
        nullif(p_event ->> 'seasonTitle', ''),
        (p_event ->> 'seasonNumber')::integer,
        source_url_value,
        nullif(p_event ->> 'artworkUrl', ''),
        least(pg_catalog.floor((p_event ->> 'duration')::double precision), 2147483647)::integer,
        least(pg_catalog.floor((p_event ->> 'currentTime')::double precision), 2147483647)::integer,
        (p_event ->> 'progress')::double precision,
        normalized_observed_at,
        case when event_kind_value in ('source_change', 'room_end', 'ended')
          then server_accepted_at else null end,
        normalized_observed_at,
        server_accepted_at,
        2,
        account_generation,
        null,
        (p_room_authority ->> 'roomGeneration')::bigint,
        (p_room_authority ->> 'sourceGeneration')::bigint
      )
      on conflict (room_id, room_generation, source_generation)
        where schema_version = 2 and room_id is not null
      do nothing
      returning id into session_id_value;

      if not found then
        select session.*
        into shared_session_row
        from public.watch_sessions as session
        where session.schema_version = 2
          and session.room_id = room_row.room_id
          and session.room_generation = (p_room_authority ->> 'roomGeneration')::bigint
          and session.source_generation = (p_room_authority ->> 'sourceGeneration')::bigint
        for update;

        if not found then
          raise exception 'watch_history_shared_session_pending' using errcode = 'P0001';
        end if;
        if shared_session_row.provider <> provider_value
          or shared_session_row.item_key <> title_key_value
          or shared_session_row.episode_key <> episode_key_value
          or shared_session_row.source_url <> source_url_value
        then
          raise exception 'watch_history_shared_source_mismatch' using errcode = 'P0001';
        end if;
        session_id_value := shared_session_row.id;
      end if;
    end if;
  end if;

  delete from public.watch_history_receipts as expired_receipt
  where expired_receipt.user_id = p_user_id
    and expired_receipt.expires_at <= server_accepted_at;

  update public.user_watch_settings as settings
  set
    next_server_order = settings.next_server_order + 1,
    updated_at = server_accepted_at
  where settings.user_id = p_user_id
  returning settings.next_server_order into server_order_value;

  if p_event -> 'sharedRoom' is null
    or pg_catalog.jsonb_typeof(p_event -> 'sharedRoom') = 'null'
  then
    insert into public.watch_sessions (
      room_id,
      host_user_id,
      provider,
      item_key,
      item_kind,
      item_title,
      episode_key,
      episode_title,
      season_key,
      season_title,
      season_number,
      source_url,
      artwork_url,
      duration_seconds,
      current_time_seconds,
      progress,
      started_at,
      ended_at,
      last_checkpoint_at,
      updated_at,
      schema_version,
      history_generation,
      client_session_key,
      room_generation,
      source_generation
    ) values (
      null,
      p_user_id,
      provider_value,
      title_key_value,
      p_event ->> 'itemKind',
      p_event ->> 'title',
      episode_key_value,
      p_event ->> 'episodeTitle',
      nullif(p_event ->> 'seasonKey', ''),
      nullif(p_event ->> 'seasonTitle', ''),
      (p_event ->> 'seasonNumber')::integer,
      source_url_value,
      nullif(p_event ->> 'artworkUrl', ''),
      least(pg_catalog.floor((p_event ->> 'duration')::double precision), 2147483647)::integer,
      least(pg_catalog.floor((p_event ->> 'currentTime')::double precision), 2147483647)::integer,
      (p_event ->> 'progress')::double precision,
      normalized_observed_at,
      case when event_kind_value in ('source_change', 'room_leave', 'room_end', 'ended')
        then server_accepted_at else null end,
      normalized_observed_at,
      server_accepted_at,
      2,
      account_generation,
      client_session_key_value,
      null,
      null
    )
    on conflict (host_user_id, client_session_key)
      where schema_version = 2 and room_id is null
    do update set
      provider = excluded.provider,
      item_key = excluded.item_key,
      item_kind = excluded.item_kind,
      item_title = excluded.item_title,
      episode_key = excluded.episode_key,
      episode_title = excluded.episode_title,
      season_key = excluded.season_key,
      season_title = excluded.season_title,
      season_number = excluded.season_number,
      source_url = excluded.source_url,
      artwork_url = coalesce(excluded.artwork_url, public.watch_sessions.artwork_url),
      duration_seconds = excluded.duration_seconds,
      current_time_seconds = excluded.current_time_seconds,
      progress = excluded.progress,
      ended_at = coalesce(excluded.ended_at, public.watch_sessions.ended_at),
      last_checkpoint_at = excluded.last_checkpoint_at,
      updated_at = excluded.updated_at,
      history_generation = excluded.history_generation
    returning id into session_id_value;
  else
    if participant_role = 'host' then
      update public.watch_sessions as session
      set
        duration_seconds = least(
          pg_catalog.floor((p_event ->> 'duration')::double precision),
          2147483647
        )::integer,
        current_time_seconds = least(
          pg_catalog.floor((p_event ->> 'currentTime')::double precision),
          2147483647
        )::integer,
        progress = (p_event ->> 'progress')::double precision,
        ended_at = coalesce(
          case when event_kind_value in ('source_change', 'room_end', 'ended')
            then server_accepted_at else null end,
          session.ended_at
        ),
        last_checkpoint_at = normalized_observed_at,
        updated_at = server_accepted_at
      where session.id = session_id_value;
    end if;
  end if;

  insert into public.watch_session_participants (
    session_id,
    user_id,
    role,
    joined_at,
    left_at,
    current_time_seconds,
    progress,
    updated_at,
    schema_version
  ) values (
    session_id_value,
    p_user_id,
    participant_role,
    server_accepted_at,
    case when event_kind_value in ('room_leave', 'room_end', 'ended')
      then server_accepted_at else null end,
    least(pg_catalog.floor((p_event ->> 'currentTime')::double precision), 2147483647)::integer,
    (p_event ->> 'progress')::double precision,
    server_accepted_at,
    2
  )
  on conflict (session_id, user_id) do update set
    role = excluded.role,
    left_at = excluded.left_at,
    current_time_seconds = excluded.current_time_seconds,
    progress = excluded.progress,
    updated_at = excluded.updated_at,
    schema_version = excluded.schema_version;

  if room_row.room_id is not null and exists (
    select 1
    from public.watch_session_participants as current_participant
    where current_participant.session_id = session_id_value
      and current_participant.user_id = p_user_id
      and current_participant.schema_version = 2
  ) then
    for other_user_id_value in
      select other_participant.user_id
      from public.watch_session_participants as other_participant
      where other_participant.session_id = session_id_value
        and other_participant.user_id <> p_user_id
        and other_participant.schema_version = 2
      order by
        least(p_user_id, other_participant.user_id),
        greatest(p_user_id, other_participant.user_id)
    loop
      insert into public.recent_people_evidence (
        user_id,
        other_user_id,
        last_room_id,
        last_watched_at
      )
      select
        directional_pair.user_id,
        directional_pair.other_user_id,
        room_row.room_id,
        server_accepted_at
      from (
        values
          (p_user_id, other_user_id_value),
          (other_user_id_value, p_user_id)
      ) as directional_pair(user_id, other_user_id)
      order by directional_pair.user_id, directional_pair.other_user_id
      on conflict (user_id, other_user_id) do update set
        last_room_id = case
          when excluded.last_watched_at > public.recent_people_evidence.last_watched_at
            then excluded.last_room_id
          else public.recent_people_evidence.last_room_id
        end,
        last_watched_at = greatest(
          public.recent_people_evidence.last_watched_at,
          excluded.last_watched_at
        );
    end loop;
  end if;

  completion_value := case
    when existing_progress.completed_at is not null then existing_progress.completed_at
    when event_kind_value = 'ended' or (p_event ->> 'progress')::double precision >= 0.9
      then server_accepted_at
    else null
  end;

  insert into public.watch_episode_progress (
    user_id,
    provider,
    title_key,
    episode_key,
    item_kind,
    title,
    artwork_url,
    episode_title,
    season_key,
    season_title,
    season_number,
    episode_number,
    source_url,
    current_time_seconds,
    duration,
    progress,
    completed_at,
    latest_session_id,
    last_event_id,
    observed_at,
    server_order,
    history_generation,
    updated_at
  ) values (
    p_user_id,
    provider_value,
    title_key_value,
    episode_key_value,
    p_event ->> 'itemKind',
    p_event ->> 'title',
    nullif(p_event ->> 'artworkUrl', ''),
    p_event ->> 'episodeTitle',
    nullif(p_event ->> 'seasonKey', ''),
    nullif(p_event ->> 'seasonTitle', ''),
    (p_event ->> 'seasonNumber')::integer,
    (p_event ->> 'episodeNumber')::double precision,
    source_url_value,
    (p_event ->> 'currentTime')::double precision,
    (p_event ->> 'duration')::double precision,
    (p_event ->> 'progress')::double precision,
    completion_value,
    session_id_value,
    client_event_id,
    normalized_observed_at,
    server_order_value,
    account_generation,
    server_accepted_at
  )
  on conflict (user_id, provider, title_key, episode_key) do update set
    item_kind = excluded.item_kind,
    title = excluded.title,
    artwork_url = coalesce(excluded.artwork_url, public.watch_episode_progress.artwork_url),
    episode_title = excluded.episode_title,
    season_key = excluded.season_key,
    season_title = excluded.season_title,
    season_number = excluded.season_number,
    episode_number = excluded.episode_number,
    source_url = excluded.source_url,
    current_time_seconds = excluded.current_time_seconds,
    duration = excluded.duration,
    progress = excluded.progress,
    completed_at = coalesce(public.watch_episode_progress.completed_at, excluded.completed_at),
    latest_session_id = excluded.latest_session_id,
    last_event_id = excluded.last_event_id,
    observed_at = excluded.observed_at,
    server_order = excluded.server_order,
    history_generation = excluded.history_generation,
    updated_at = excluded.updated_at;

  select pg_catalog.jsonb_build_object(
    'episodeKey', episode.episode_key,
    'episodeTitle', episode.episode_title,
    'seasonKey', episode.season_key,
    'seasonTitle', episode.season_title,
    'seasonNumber', episode.season_number,
    'episodeNumber', episode.episode_number,
    'sourceUrl', episode.source_url,
    'currentTime', episode.current_time_seconds,
    'duration', episode.duration,
    'progress', episode.progress,
    'completedAt', episode.completed_at,
    'lastWatchedAt', episode.observed_at,
    'sessions', coalesce((
      select pg_catalog.jsonb_agg(session_data.payload order by session_data.last_watched_at desc)
      from (
        select
          session.last_checkpoint_at as last_watched_at,
          pg_catalog.jsonb_build_object(
            'id', session.id,
            'roomId', session.room_id,
            'roomGeneration', session.room_generation,
            'hostUserId', session.host_user_id,
            'kind', case when session.room_id is null then 'solo' else 'shared' end,
            'sourceGeneration', session.source_generation,
            'currentTime', session.current_time_seconds,
            'duration', session.duration_seconds,
            'progress', session.progress,
            'startedAt', session.started_at,
            'endedAt', session.ended_at,
            'lastWatchedAt', session.last_checkpoint_at,
            'participants', coalesce((
              select pg_catalog.jsonb_agg(
                bounded_participant.payload
                order by bounded_participant.joined_at, bounded_participant.user_id
              )
              from (
                select
                  participant.joined_at,
                  participant.user_id,
                  pg_catalog.jsonb_build_object(
                  'user', pg_catalog.jsonb_build_object(
                    'userId', participant.user_id,
                    'handle', case
                      when profile.handle is not null
                        and pg_catalog.btrim(profile.handle) ~ '^[a-z0-9_]{3,24}$'
                      then pg_catalog.btrim(profile.handle)
                      else null
                    end,
                    'displayName', case
                      when profile.display_name is not null
                        and char_length(pg_catalog.btrim(profile.display_name)) between 1 and 80
                        and pg_catalog.octet_length(
                          pg_catalog.btrim(profile.display_name)
                        ) <= 80
                        and pg_catalog.btrim(profile.display_name)
                          ~ U&'[^\0009\000A\000B\000C\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'
                      then pg_catalog.btrim(profile.display_name)
                      when participant_user.display_name is not null
                        and char_length(pg_catalog.btrim(participant_user.display_name)) between 1 and 80
                        and pg_catalog.octet_length(
                          pg_catalog.btrim(participant_user.display_name)
                        ) <= 80
                        and pg_catalog.btrim(participant_user.display_name)
                          ~ U&'[^\0009\000A\000B\000C\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'
                      then pg_catalog.btrim(participant_user.display_name)
                      else 'AniDachi user'
                    end,
                    'avatarUrl', case
                      when profile.avatar_url is not null
                        and char_length(profile.avatar_url) <= 2048
                        and pg_catalog.octet_length(profile.avatar_url)
                          = char_length(profile.avatar_url)
                        and profile.avatar_url ~* '^https?://[A-Za-z0-9][A-Za-z0-9-]{0,62}([.][A-Za-z0-9][A-Za-z0-9-]{0,62})*[.][A-Za-z]{2,63}(/[A-Za-z0-9._~!$&()*+,;=:@%/?#-]*)?$'
                        and profile.avatar_url !~* '^https?://([A-Za-z0-9-]+[.])*xn--'
                      then profile.avatar_url
                      when participant_user.avatar_url is not null
                        and char_length(participant_user.avatar_url) <= 2048
                        and pg_catalog.octet_length(participant_user.avatar_url)
                          = char_length(participant_user.avatar_url)
                        and participant_user.avatar_url ~* '^https?://[A-Za-z0-9][A-Za-z0-9-]{0,62}([.][A-Za-z0-9][A-Za-z0-9-]{0,62})*[.][A-Za-z]{2,63}(/[A-Za-z0-9._~!$&()*+,;=:@%/?#-]*)?$'
                        and participant_user.avatar_url !~* '^https?://([A-Za-z0-9-]+[.])*xn--'
                      then participant_user.avatar_url
                      else null
                    end
                  ),
                  'role', participant.role,
                  'currentTime', participant.current_time_seconds,
                  'progress', participant.progress,
                  'joinedAt', participant.joined_at,
                  'leftAt', participant.left_at,
                  'updatedAt', participant.updated_at
                  ) as payload
                from public.watch_session_participants as participant
                inner join public.users as participant_user
                  on participant_user.id = participant.user_id
                left join public.profiles as profile
                  on profile.user_id = participant.user_id
                where participant.session_id = session.id
                  and participant.schema_version = 2
                order by participant.joined_at, participant.user_id
                limit 15
              ) as bounded_participant
            ), '[]'::jsonb)
          ) as payload
        from public.watch_sessions as session
        inner join public.watch_session_participants as owner_participant
          on owner_participant.session_id = session.id
          and owner_participant.user_id = p_user_id
          and owner_participant.schema_version = 2
        where session.schema_version = 2
          and (
            session.room_id is not null
            or session.client_session_key is not null
          )
          and session.provider = provider_value
          and session.item_key = title_key_value
          and session.episode_key = episode_key_value
        order by session.last_checkpoint_at desc
        limit 20
      ) as session_data
    ), '[]'::jsonb)
  )
  into episode_payload
  from public.watch_episode_progress as episode
  where episode.user_id = p_user_id
    and episode.provider = provider_value
    and episode.title_key = title_key_value
    and episode.episode_key = episode_key_value;

  acknowledgement_value := pg_catalog.jsonb_build_object(
    'meta', pg_catalog.jsonb_build_object(
      'serverTime', server_accepted_at,
      'schemaVersion', 2,
      'ownerUserId', p_user_id,
      'accountGeneration', account_generation
    ),
    'schemaVersion', 2,
    'acceptedEventId', client_event_id,
    'acceptedAt', server_accepted_at,
    'accountGeneration', account_generation,
    'duplicate', false,
    'episode', episode_payload
  );

  insert into public.watch_history_receipts (
    user_id,
    client_id,
    kind,
    acknowledgement,
    accepted_at,
    expires_at
  ) values (
    p_user_id,
    client_event_id,
    'progress',
    acknowledgement_value,
    server_accepted_at,
    server_accepted_at + interval '14 days'
  );

  return acknowledgement_value;
end;
$$;

revoke all on function public.apply_watch_progress_v2(uuid, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function public.apply_watch_progress_v2(uuid, jsonb, jsonb)
  to service_role;
