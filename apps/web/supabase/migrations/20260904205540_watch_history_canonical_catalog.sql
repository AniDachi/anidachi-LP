begin;
CREATE OR REPLACE FUNCTION public.apply_watch_progress_v3(p_user_id uuid, p_event jsonb, p_room_authority jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  perform public.validate_watch_identity_v3(p_event);
  if p_user_id is null or pg_catalog.jsonb_typeof(p_event) <> 'object' then
    raise exception 'watch_history_event_invalid' using errcode = '22023';
  end if;

  client_event_id := (p_event ->> 'clientEventId')::uuid;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  insert into public.user_watch_settings (user_id, write_schema_version)
  values (p_user_id, 3)
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

  if exists(select 1 from public.watch_catalog_aliases a where a.user_id=p_user_id and a.history_generation=account_generation
    and a.provider=provider_value and a.raw_content_id=p_event#>>'{crunchyrollIdentity,providerContentId}'
    and (a.title_key<>title_key_value or a.episode_key<>episode_key_value or a.season_key<>p_event->>'seasonKey'))
  then raise exception 'watch_history_identity_conflict' using errcode='22023'; end if;

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
    where session.schema_version = 3
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
        3,
        account_generation,
        null,
        (p_room_authority ->> 'roomGeneration')::bigint,
        (p_room_authority ->> 'sourceGeneration')::bigint
      )
      on conflict (room_id, room_generation, source_generation)
        where schema_version = 3 and room_id is not null
      do nothing
      returning id into session_id_value;

      if not found then
        select session.*
        into shared_session_row
        from public.watch_sessions as session
        where session.schema_version = 3
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
      3,
      account_generation,
      client_session_key_value,
      null,
      null
    )
    on conflict (host_user_id, client_session_key)
      where schema_version = 3 and room_id is null
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
    3
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
      and current_participant.schema_version = 3
  ) then
    for other_user_id_value in
      select other_participant.user_id
      from public.watch_session_participants as other_participant
      where other_participant.session_id = session_id_value
        and other_participant.user_id <> p_user_id
        and other_participant.schema_version = 3
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
    raw_content_id,
    audio_locale,
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
    coalesce(p_event#>>'{crunchyrollIdentity,providerContentId}',p_event->>'youtubeVideoId'),
    p_event#>>'{crunchyrollIdentity,audioLocale}',
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
    raw_content_id = excluded.raw_content_id,
    audio_locale = excluded.audio_locale,
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
                  and participant.schema_version = 3
                order by participant.joined_at, participant.user_id
                limit 15
              ) as bounded_participant
            ), '[]'::jsonb)
          ) as payload
        from public.watch_sessions as session
        inner join public.watch_session_participants as owner_participant
          on owner_participant.session_id = session.id
          and owner_participant.user_id = p_user_id
          and owner_participant.schema_version = 3
        where session.schema_version = 3
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
      'schemaVersion', 3,
      'ownerUserId', p_user_id,
      'accountGeneration', account_generation
    ),
    'schemaVersion', 3,
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_watch_history_v3(p_user_id uuid, p_request jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  server_accepted_at timestamptz := pg_catalog.transaction_timestamp();
  settings_row public.user_watch_settings%rowtype;
  existing_receipt public.watch_history_receipts%rowtype;
  client_mutation_id uuid;
  requested_generation bigint;
  resulting_generation bigint;
  scope_value text;
  provider_value text;
  title_key_value text;
  episode_key_value text;
  acknowledgement_value jsonb;
begin
  if p_request->>'schemaVersion' is distinct from '3' then
    raise exception 'watch_history_upgrade_required' using errcode='22023'; end if;
  if p_user_id is null or pg_catalog.jsonb_typeof(p_request) <> 'object' then
    raise exception 'watch_history_delete_invalid' using errcode = '22023';
  end if;

  client_mutation_id := (p_request ->> 'clientMutationId')::uuid;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  insert into public.user_watch_settings (user_id, write_schema_version)
  values (p_user_id, 3)
  on conflict (user_id) do nothing;

  select settings.*
  into strict settings_row
  from public.user_watch_settings as settings
  where settings.user_id = p_user_id
  for update;

  delete from public.watch_history_receipts as expired_receipt
  where expired_receipt.user_id = p_user_id
    and expired_receipt.expires_at <= server_accepted_at;

  select receipt.*
  into existing_receipt
  from public.watch_history_receipts as receipt
  where receipt.user_id = p_user_id
    and receipt.client_id = client_mutation_id;

  if found then
    if existing_receipt.kind <> 'delete' then
      raise exception 'watch_history_client_id_conflict' using errcode = '23505';
    end if;
    return existing_receipt.acknowledgement;
  end if;

  if (p_request ->> 'accountGeneration') is null
    or (p_request ->> 'accountGeneration') !~ '^[1-9][0-9]*$'
  then
    raise exception 'watch_history_delete_invalid' using errcode = '22023';
  end if;
  requested_generation := (p_request ->> 'accountGeneration')::bigint;
  if requested_generation <> settings_row.history_generation then
    raise exception 'watch_history_generation_mismatch' using errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(p_request -> 'target') <> 'object' then
    raise exception 'watch_history_delete_invalid' using errcode = '22023';
  end if;

  scope_value := p_request #>> '{target,scope}';
  provider_value := p_request #>> '{target,provider}';
  title_key_value := p_request #>> '{target,titleKey}';
  episode_key_value := p_request #>> '{target,episodeKey}';

  if scope_value = 'all' then
    if provider_value is not null or title_key_value is not null or episode_key_value is not null then
      raise exception 'watch_history_delete_invalid' using errcode = '22023';
    end if;

    update public.user_watch_settings as settings
    set
      history_generation = settings.history_generation + 1,
      updated_at = server_accepted_at
    where settings.user_id = p_user_id
    returning settings.history_generation into resulting_generation;

    delete from public.watch_episode_progress as episode
    where episode.user_id = p_user_id;

    delete from public.watch_session_participants as participant
    using public.watch_sessions as session
    where participant.session_id = session.id
      and participant.user_id = p_user_id
      and participant.schema_version = 3
      and session.schema_version = 3;

    delete from public.watch_history_deletions as old_deletion
    where old_deletion.user_id = p_user_id
      and old_deletion.history_generation < resulting_generation;

    insert into public.watch_history_deletions (
      user_id,
      scope,
      provider,
      title_key,
      episode_key,
      history_generation,
      deleted_at,
      last_client_mutation_id
    ) values (
      p_user_id,
      'all',
      null,
      null,
      null,
      resulting_generation,
      server_accepted_at,
      client_mutation_id
    )
    on conflict (user_id) where scope = 'all' do update set
      history_generation = excluded.history_generation,
      deleted_at = greatest(public.watch_history_deletions.deleted_at, excluded.deleted_at),
      last_client_mutation_id = excluded.last_client_mutation_id;
  elsif scope_value = 'title' then
    if provider_value not in ('crunchyroll', 'youtube')
      or title_key_value is null
      or char_length(title_key_value) not between 1 and 220
      or episode_key_value is not null
    then
      raise exception 'watch_history_delete_invalid' using errcode = '22023';
    end if;
    resulting_generation := requested_generation;

    insert into public.watch_history_deletions (
      user_id,
      scope,
      provider,
      title_key,
      episode_key,
      history_generation,
      deleted_at,
      last_client_mutation_id
    ) values (
      p_user_id,
      'title',
      provider_value,
      title_key_value,
      null,
      resulting_generation,
      server_accepted_at,
      client_mutation_id
    )
    on conflict (user_id, provider, title_key) where scope = 'title' do update set
      history_generation = excluded.history_generation,
      deleted_at = greatest(public.watch_history_deletions.deleted_at, excluded.deleted_at),
      last_client_mutation_id = excluded.last_client_mutation_id;

    delete from public.watch_episode_progress as episode
    where episode.user_id = p_user_id
      and episode.provider = provider_value
      and episode.title_key = title_key_value;

    delete from public.watch_session_participants as participant
    using public.watch_sessions as session
    where participant.session_id = session.id
      and participant.user_id = p_user_id
      and participant.schema_version = 3
      and session.schema_version = 3
      and session.provider = provider_value
      and session.item_key = title_key_value;

  elsif scope_value = 'episode' then
    if provider_value not in ('crunchyroll', 'youtube')
      or title_key_value is null
      or char_length(title_key_value) not between 1 and 220
      or episode_key_value is null
      or char_length(episode_key_value) not between 1 and 220
    then
      raise exception 'watch_history_delete_invalid' using errcode = '22023';
    end if;
    resulting_generation := requested_generation;

    insert into public.watch_history_deletions (
      user_id,
      scope,
      provider,
      title_key,
      episode_key,
      history_generation,
      deleted_at,
      last_client_mutation_id
    ) values (
      p_user_id,
      'episode',
      provider_value,
      title_key_value,
      episode_key_value,
      resulting_generation,
      server_accepted_at,
      client_mutation_id
    )
    on conflict (user_id, provider, title_key, episode_key)
      where scope = 'episode'
    do update set
      history_generation = excluded.history_generation,
      deleted_at = greatest(public.watch_history_deletions.deleted_at, excluded.deleted_at),
      last_client_mutation_id = excluded.last_client_mutation_id;

    delete from public.watch_episode_progress as episode
    where episode.user_id = p_user_id
      and episode.provider = provider_value
      and episode.title_key = title_key_value
      and episode.episode_key = episode_key_value;

    delete from public.watch_session_participants as participant
    using public.watch_sessions as session
    where participant.session_id = session.id
      and participant.user_id = p_user_id
      and participant.schema_version = 3
      and session.schema_version = 3
      and session.provider = provider_value
      and session.item_key = title_key_value
      and session.episode_key = episode_key_value;

  else
    raise exception 'watch_history_delete_invalid' using errcode = '22023';
  end if;

  delete from public.watch_sessions as orphan_session
  where orphan_session.schema_version = 3
    and not exists (
      select 1
      from public.watch_session_participants as participant
      where participant.session_id = orphan_session.id
    )
    and not exists (
      select 1
      from public.watch_episode_progress as episode
      where episode.latest_session_id = orphan_session.id
    );

  if scope_value in ('all','title') then
    delete from public.watch_catalog_snapshots where user_id=p_user_id
      and (scope_value='all' or (provider=provider_value and title_key=title_key_value));
  end if;

  acknowledgement_value := pg_catalog.jsonb_build_object(
    'meta', pg_catalog.jsonb_build_object(
      'serverTime', server_accepted_at,
      'schemaVersion', 3,
      'ownerUserId', p_user_id,
      'accountGeneration', resulting_generation
    ),
    'schemaVersion', 3,
    'clientMutationId', client_mutation_id,
    'accountGeneration', resulting_generation,
    'target', p_request -> 'target',
    'deletedAt', server_accepted_at
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
    client_mutation_id,
    'delete',
    acknowledgement_value,
    server_accepted_at,
    server_accepted_at + interval '14 days'
  );

  return acknowledgement_value;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_watch_history_session_summaries_v3()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.schema_version = 3
    and (new.room_id is not null or new.client_session_key is not null)
  then
    insert into public.watch_history_user_session_summaries (
      user_id,
      session_id,
      history_generation,
      provider,
      title_key,
      last_watched_at
    )
    select
      participant.user_id,
      new.id,
      settings.history_generation,
      new.provider,
      new.item_key,
      new.last_checkpoint_at
    from public.watch_session_participants as participant
    inner join public.user_watch_settings as settings
      on settings.user_id = participant.user_id
    where participant.session_id = new.id
      and participant.schema_version = 3
    on conflict (user_id, session_id)
    do update set
      history_generation = excluded.history_generation,
      provider = excluded.provider,
      title_key = excluded.title_key,
      last_watched_at = excluded.last_watched_at;
  else
    delete from public.watch_history_user_session_summaries as summary
    where summary.session_id = new.id;
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_watch_history_title_summary_delete_v3()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  affected record;
begin
  for affected in
    select distinct
      progress.user_id,
      progress.history_generation,
      progress.provider,
      progress.title_key
    from deleted_progress as progress
  loop
    perform public.refresh_watch_history_title_summary_v3(
      affected.user_id,
      affected.history_generation,
      affected.provider,
      affected.title_key
    );
  end loop;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_watch_history_v3_bounded_page(p_user_id uuid, p_history_generation bigint, p_limit integer, p_cursor_watched_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_stable_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin
  if p_user_id is null
    or p_history_generation is null
    or p_history_generation < 1
    or p_limit is null
    or p_limit < 1
    or p_limit > 100
    or ((p_cursor_watched_at is null) <> (p_cursor_stable_id is null))
    or (
      p_cursor_stable_id is not null
      and pg_catalog.char_length(p_cursor_stable_id) > 512
    )
  then
    raise exception 'watch_history_invalid_page' using errcode = '22023';
  end if;

  return (
    with canonical_settings as materialized (
      select settings.history_generation
      from public.user_watch_settings as settings
      where settings.user_id = p_user_id
    ),
    title_count as materialized (
      select pg_catalog.count(*) as value
      from public.watch_history_title_summaries as summary
      where summary.user_id = p_user_id
        and summary.history_generation = (
          select settings.history_generation from canonical_settings as settings
        )
    ),
    page_titles as materialized (
      select
        summary.provider,
        summary.title_key,
        summary.last_watched_at,
        summary.stable_id,
        summary.observed_episode_count,
        summary.completed_episode_count
      from public.watch_history_title_summaries as summary
      where summary.user_id = p_user_id
        and summary.history_generation = (
          select settings.history_generation from canonical_settings as settings
        )
        and (
          p_cursor_watched_at is null
          or summary.last_watched_at <= p_cursor_watched_at
        )
        and (
          p_cursor_watched_at is null
          or summary.last_watched_at < p_cursor_watched_at
          or (
            summary.last_watched_at = p_cursor_watched_at
            and summary.stable_id > p_cursor_stable_id collate "C"
          )
        )
      order by summary.last_watched_at desc, summary.stable_id
      limit p_limit + 1
    ),
    visible_titles as materialized (
      select page.*
      from page_titles as page
      order by page.last_watched_at desc, page.stable_id
      limit p_limit
    ),
    visible_progress as materialized (
      select
        title.last_watched_at,
        title.stable_id,
        title.provider,
        title.title_key,
        progress.observed_at,
        progress.episode_key,
        progress.latest_session_id,
        progress.row_json
      from visible_titles as title
      cross join lateral (
        select
          episode.observed_at,
          episode.episode_key,
          episode.latest_session_id,
          pg_catalog.jsonb_build_object(
            'user_id', episode.user_id,
            'provider', episode.provider,
            'title_key', episode.title_key,
            'episode_key', episode.episode_key,
            'item_kind', episode.item_kind,
            'title', episode.title,
            'artwork_url', episode.artwork_url,
            'episode_title', coalesce(public.watch_catalog_label_v3(p_user_id,episode.history_generation,episode.provider,episode.title_key,episode.episode_key)->>'episodeTitle',episode.episode_title),
            'season_key', episode.season_key,
            'season_title', episode.season_title,
            'season_number', episode.season_number,
            'episode_number', episode.episode_number,
            'source_url', episode.source_url,
            'current_time_seconds', episode.current_time_seconds,
            'duration', episode.duration,
            'progress', episode.progress,
            'completed_at', episode.completed_at,
            'latest_session_id', episode.latest_session_id,
            'observed_at', episode.observed_at,
            'server_order', episode.server_order,
            'history_generation', episode.history_generation
          ) as row_json
        from public.watch_episode_progress as episode
        where episode.user_id = p_user_id
          and episode.history_generation = (
            select settings.history_generation from canonical_settings as settings
          )
          and episode.provider = title.provider
          and episode.title_key = title.title_key
        order by episode.observed_at desc, episode.episode_key collate "C"
        limit 8
      ) as progress
    ),
    bounded_title_sessions as (
      select candidate.session_id
      from visible_titles as title
      cross join lateral (
        select summary.session_id
        from public.watch_history_user_session_summaries as summary
        where summary.user_id = p_user_id
          and summary.history_generation = (
            select settings.history_generation from canonical_settings as settings
          )
          and summary.provider = title.provider
          and summary.title_key = title.title_key
        order by summary.last_watched_at desc, summary.session_id
        limit 20
      ) as candidate
    ),
    bounded_sessions as (
      select session.session_id as id
      from bounded_title_sessions as session
      union
      select progress.latest_session_id
      from visible_progress as progress
      where progress.latest_session_id is not null
    )
    select pg_catalog.jsonb_build_object(
      'accountGeneration', (
        select settings.history_generation from canonical_settings as settings
      ),
      'totalTitleCount', (select count.value from title_count as count),
      'hasMore', (select pg_catalog.count(*) > p_limit from page_titles),
      'titleSummaries', coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'provider', title.provider,
              'titleKey', title.title_key,
              'lastWatchedAt', title.last_watched_at,
              'observedEpisodeCount', title.observed_episode_count,
              'completedEpisodeCount', title.completed_episode_count,
              'catalog', public.watch_catalog_read_v3(p_user_id,(select settings.history_generation from canonical_settings settings),title.provider,title.title_key),
              'episodePage', pg_catalog.jsonb_build_object(
                'complete', title.observed_episode_count <= 8,
                'nextCursor', case
                  when title.observed_episode_count <= 8 then null
                  else (
                    select pg_catalog.encode(
                      pg_catalog.convert_to(
                        pg_catalog.jsonb_build_object(
                          'v', 1,
                          'userId', p_user_id,
                          'accountGeneration', (
                            select settings.history_generation
                            from canonical_settings as settings
                          ),
                          'provider', cursor_row.provider,
                          'titleKey', cursor_row.title_key,
                          'observedAt', cursor_row.observed_at,
                          'episodeKey', cursor_row.episode_key
                        )::text,
                        'UTF8'
                      ),
                      'hex'
                    )
                    from visible_progress as cursor_row
                    where cursor_row.provider = title.provider
                      and cursor_row.title_key = title.title_key
                    order by
                      cursor_row.observed_at desc,
                      cursor_row.episode_key collate "C"
                    offset 7
                    limit 1
                  )
                end
              )
            )
            order by title.last_watched_at desc, title.stable_id
          )
          from visible_titles as title
        ),
        '[]'::jsonb
      ),
      'progressRows', coalesce(
        (
          select pg_catalog.jsonb_agg(
            progress.row_json
            order by
              progress.last_watched_at desc,
              progress.stable_id,
              progress.observed_at desc,
              progress.episode_key collate "C"
          )
          from visible_progress as progress
        ),
        '[]'::jsonb
      ),
      'sessionIds', coalesce(
        (
          select pg_catalog.jsonb_agg(session.id order by session.id)
          from bounded_sessions as session
        ),
        '[]'::jsonb
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_watch_history_v3_title_episodes_page(p_user_id uuid, p_history_generation bigint, p_provider text, p_title_key text, p_limit integer DEFAULT 50, p_cursor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  cursor_value jsonb;
  cursor_user_id uuid;
  cursor_history_generation bigint;
  cursor_observed_at timestamptz;
  cursor_episode_key text;
  canonical_history_generation bigint;
begin
  if p_user_id is null
    or p_history_generation is null
    or p_history_generation < 1
    or p_provider is null
    or p_provider not in ('crunchyroll', 'youtube')
    or p_title_key is null
    or pg_catalog.char_length(p_title_key) not between 1 and 220
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
    or (p_cursor is not null and pg_catalog.char_length(p_cursor) > 2048)
  then
    raise exception 'watch_history_invalid_episode_page' using errcode = '22023';
  end if;

  select settings.history_generation
  into canonical_history_generation
  from public.user_watch_settings as settings
  where settings.user_id = p_user_id;

  if p_cursor is not null then
    begin
      cursor_value := pg_catalog.convert_from(
        pg_catalog.decode(p_cursor, 'hex'),
        'UTF8'
      )::jsonb;
    exception when others then
      raise exception 'watch_history_invalid_episode_cursor' using errcode = '22023';
    end;

    if pg_catalog.jsonb_typeof(cursor_value) <> 'object' then
      raise exception 'watch_history_invalid_episode_cursor' using errcode = '22023';
    end if;

    if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(cursor_value)) <> 7
      or not (cursor_value ? 'v')
      or not (cursor_value ? 'userId')
      or not (cursor_value ? 'accountGeneration')
      or not (cursor_value ? 'provider')
      or not (cursor_value ? 'titleKey')
      or not (cursor_value ? 'observedAt')
      or not (cursor_value ? 'episodeKey')
      or pg_catalog.jsonb_typeof(cursor_value -> 'v') <> 'number'
      or cursor_value -> 'v' <> pg_catalog.to_jsonb(1)
      or pg_catalog.jsonb_typeof(cursor_value -> 'userId') <> 'string'
      or pg_catalog.jsonb_typeof(cursor_value -> 'accountGeneration') <> 'number'
      or pg_catalog.jsonb_typeof(cursor_value -> 'provider') <> 'string'
      or pg_catalog.jsonb_typeof(cursor_value -> 'titleKey') <> 'string'
      or pg_catalog.jsonb_typeof(cursor_value -> 'observedAt') <> 'string'
      or pg_catalog.jsonb_typeof(cursor_value -> 'episodeKey') <> 'string'
      or pg_catalog.char_length(cursor_value ->> 'episodeKey') not between 1 and 220
    then
      raise exception 'watch_history_invalid_episode_cursor' using errcode = '22023';
    end if;

    begin
      cursor_user_id := (cursor_value ->> 'userId')::uuid;
      cursor_history_generation := (cursor_value ->> 'accountGeneration')::bigint;
      cursor_observed_at := (cursor_value ->> 'observedAt')::timestamptz;
      cursor_episode_key := cursor_value ->> 'episodeKey';
    exception when others then
      raise exception 'watch_history_invalid_episode_cursor' using errcode = '22023';
    end;

    if cursor_user_id is distinct from p_user_id
      or cursor_history_generation is distinct from canonical_history_generation
      or (cursor_value ->> 'provider') is distinct from p_provider
      or (cursor_value ->> 'titleKey') is distinct from p_title_key
    then
      raise exception 'watch_history_cursor_target_mismatch' using errcode = '22023';
    end if;
  end if;

  return (
    with canonical_settings as materialized (
      select settings.history_generation
      from public.user_watch_settings as settings
      where settings.user_id = p_user_id
    ),
    title_summary as materialized (
      select
        summary.observed_episode_count,
        summary.completed_episode_count
      from public.watch_history_title_summaries as summary
      where summary.user_id = p_user_id
        and summary.history_generation = (
          select settings.history_generation from canonical_settings as settings
        )
        and summary.provider = p_provider
        and summary.title_key = p_title_key
    ),
    candidates as materialized (
      select episode.*
      from public.watch_episode_progress as episode
      where episode.user_id = p_user_id
        and episode.history_generation = (
          select settings.history_generation from canonical_settings as settings
        )
        and episode.provider = p_provider
        and episode.title_key = p_title_key
        and (
          cursor_observed_at is null
          or episode.observed_at < cursor_observed_at
          or (
            episode.observed_at = cursor_observed_at
            and episode.episode_key > cursor_episode_key collate "C"
          )
        )
      order by episode.observed_at desc, episode.episode_key collate "C"
      limit p_limit + 1
    ),
    visible as materialized (
      select candidate.*
      from candidates as candidate
      order by candidate.observed_at desc, candidate.episode_key collate "C"
      limit p_limit
    )
    select pg_catalog.jsonb_build_object(
      'accountGeneration', (
        select settings.history_generation from canonical_settings as settings
      ),
      'provider', p_provider,
      'titleKey', p_title_key,
      'observedEpisodeCount', coalesce(
        (select summary.observed_episode_count from title_summary as summary),
        0
      ),
      'completedEpisodeCount', coalesce(
        (select summary.completed_episode_count from title_summary as summary),
        0
      ),
      'catalog',public.watch_catalog_read_v3(p_user_id,canonical_history_generation,p_provider,p_title_key,(select array_agg(distinct season_key) from visible)),
      'complete', (select pg_catalog.count(*) <= p_limit from candidates),
      'nextCursor', case
        when (select pg_catalog.count(*) <= p_limit from candidates) then null
        else (
          select pg_catalog.encode(
            pg_catalog.convert_to(
              pg_catalog.jsonb_build_object(
                'v', 1,
                'userId', p_user_id,
                'accountGeneration', canonical_history_generation,
                'provider', p_provider,
                'titleKey', p_title_key,
                'observedAt', row.observed_at,
                'episodeKey', row.episode_key
              )::text,
              'UTF8'
            ),
            'hex'
          )
          from visible as row
          order by row.observed_at, row.episode_key collate "C" desc
          limit 1
        )
      end,
      'progressRows', coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'user_id', row.user_id,
              'provider', row.provider,
              'title_key', row.title_key,
              'episode_key', row.episode_key,
              'item_kind', row.item_kind,
              'title', row.title,
              'artwork_url', row.artwork_url,
              'episode_title', coalesce(public.watch_catalog_label_v3(p_user_id,row.history_generation,row.provider,row.title_key,row.episode_key)->>'episodeTitle',row.episode_title),
              'season_key', row.season_key,
              'season_title', row.season_title,
              'season_number', row.season_number,
              'episode_number', row.episode_number,
              'source_url', row.source_url,
              'current_time_seconds', row.current_time_seconds,
              'duration', row.duration,
              'progress', row.progress,
              'completed_at', row.completed_at,
              'latest_session_id', row.latest_session_id,
              'observed_at', row.observed_at,
              'server_order', row.server_order,
              'history_generation', row.history_generation
            )
            order by row.observed_at desc, row.episode_key collate "C"
          )
          from visible as row
        ),
        '[]'::jsonb
      )
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_watch_preferences_v3(p_user_id uuid, p_preferences jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  server_accepted_at timestamptz := pg_catalog.transaction_timestamp();
  settings_row public.user_watch_settings%rowtype;
begin
  if p_user_id is null
    or pg_catalog.jsonb_typeof(p_preferences) <> 'object'
    or pg_catalog.jsonb_typeof(p_preferences -> 'youtubeHistoryEnabled') <> 'boolean'
  then
    raise exception 'watch_history_preferences_invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  insert into public.user_watch_settings (user_id, write_schema_version)
  values (p_user_id, 3)
  on conflict (user_id) do nothing;

  select settings.*
  into strict settings_row
  from public.user_watch_settings as settings
  where settings.user_id = p_user_id
  for update;

  update public.user_watch_settings as settings
  set
    youtube_history_enabled = (p_preferences ->> 'youtubeHistoryEnabled')::boolean,
    updated_at = server_accepted_at
  where settings.user_id = p_user_id
  returning settings.* into settings_row;

  return pg_catalog.jsonb_build_object(
    'meta', pg_catalog.jsonb_build_object(
      'serverTime', server_accepted_at,
      'schemaVersion', 3,
      'ownerUserId', p_user_id,
      'accountGeneration', settings_row.history_generation
    ),
    'preferences', pg_catalog.jsonb_build_object(
      'youtubeHistoryEnabled', settings_row.youtube_history_enabled
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_watch_history_title_summary_v3(p_user_id uuid, p_history_generation bigint, p_provider text, p_title_key text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  delete from public.watch_history_title_summaries as summary
  where summary.user_id = p_user_id
    and summary.history_generation = p_history_generation
    and summary.provider = p_provider
    and summary.title_key = p_title_key;

  insert into public.watch_history_title_summaries (
    user_id,
    history_generation,
    provider,
    title_key,
    stable_id,
    last_watched_at,
    observed_episode_count,
    completed_episode_count
  )
  select
    progress.user_id,
    progress.history_generation,
    progress.provider,
    progress.title_key,
    progress.provider || ':' || progress.title_key,
    pg_catalog.max(progress.observed_at),
    pg_catalog.count(*),
    pg_catalog.count(*) filter (where progress.completed_at is not null)
  from public.watch_episode_progress as progress
  where progress.user_id = p_user_id
    and progress.history_generation = p_history_generation
    and progress.provider = p_provider
    and progress.title_key = p_title_key
  group by
    progress.user_id,
    progress.history_generation,
    progress.provider,
    progress.title_key;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_watch_history_title_summary_v3()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  completion_delta bigint;
begin
  if tg_op = 'INSERT' then
    insert into public.watch_history_title_summaries (
      user_id,
      history_generation,
      provider,
      title_key,
      stable_id,
      last_watched_at,
      observed_episode_count,
      completed_episode_count
    )
    values (
      new.user_id,
      new.history_generation,
      new.provider,
      new.title_key,
      new.provider || ':' || new.title_key,
      new.observed_at,
      1,
      case when new.completed_at is null then 0 else 1 end
    )
    on conflict (user_id, history_generation, provider, title_key)
    do update set
      last_watched_at = greatest(
        public.watch_history_title_summaries.last_watched_at,
        excluded.last_watched_at
      ),
      observed_episode_count =
        public.watch_history_title_summaries.observed_episode_count + 1,
      completed_episode_count =
        public.watch_history_title_summaries.completed_episode_count
        + excluded.completed_episode_count;
  elsif old.user_id is not distinct from new.user_id
    and old.history_generation is not distinct from new.history_generation
    and old.provider is not distinct from new.provider
    and old.title_key is not distinct from new.title_key
  then
    completion_delta :=
      case when new.completed_at is null then 0 else 1 end
      - case when old.completed_at is null then 0 else 1 end;

    if new.observed_at >= old.observed_at then
      update public.watch_history_title_summaries as summary
      set
        last_watched_at = greatest(summary.last_watched_at, new.observed_at),
        completed_episode_count = summary.completed_episode_count + completion_delta
      where summary.user_id = new.user_id
        and summary.history_generation = new.history_generation
        and summary.provider = new.provider
        and summary.title_key = new.title_key;

      if not found then
        perform public.refresh_watch_history_title_summary_v3(
          new.user_id,
          new.history_generation,
          new.provider,
          new.title_key
        );
      end if;
    else
      perform public.refresh_watch_history_title_summary_v3(
        new.user_id,
        new.history_generation,
        new.provider,
        new.title_key
      );
    end if;
  else
    perform public.refresh_watch_history_title_summary_v3(
      old.user_id,
      old.history_generation,
      old.provider,
      old.title_key
    );

    insert into public.watch_history_title_summaries (
      user_id,
      history_generation,
      provider,
      title_key,
      stable_id,
      last_watched_at,
      observed_episode_count,
      completed_episode_count
    )
    values (
      new.user_id,
      new.history_generation,
      new.provider,
      new.title_key,
      new.provider || ':' || new.title_key,
      new.observed_at,
      1,
      case when new.completed_at is null then 0 else 1 end
    )
    on conflict (user_id, history_generation, provider, title_key)
    do update set
      last_watched_at = greatest(
        public.watch_history_title_summaries.last_watched_at,
        excluded.last_watched_at
      ),
      observed_episode_count =
        public.watch_history_title_summaries.observed_episode_count + 1,
      completed_episode_count =
        public.watch_history_title_summaries.completed_episode_count
        + excluded.completed_episode_count;
  end if;

  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.sync_watch_history_user_session_summary_v3()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'UPDATE' and (
    old.user_id is distinct from new.user_id
    or old.session_id is distinct from new.session_id
    or old.schema_version is distinct from new.schema_version
  ) then
    delete from public.watch_history_user_session_summaries as summary
    where summary.user_id = old.user_id
      and summary.session_id = old.session_id;
  end if;

  if new.schema_version = 3 then
    insert into public.watch_history_user_session_summaries (
      user_id,
      session_id,
      history_generation,
      provider,
      title_key,
      last_watched_at
    )
    select
      new.user_id,
      new.session_id,
      settings.history_generation,
      session.provider,
      session.item_key,
      session.last_checkpoint_at
    from public.watch_sessions as session
    inner join public.user_watch_settings as settings
      on settings.user_id = new.user_id
    where session.id = new.session_id
      and session.schema_version = 3
      and (session.room_id is not null or session.client_session_key is not null)
    on conflict (user_id, session_id)
    do update set
      history_generation = excluded.history_generation,
      provider = excluded.provider,
      title_key = excluded.title_key,
      last_watched_at = excluded.last_watched_at;

    if not found then
      delete from public.watch_history_user_session_summaries as summary
      where summary.user_id = new.user_id
        and summary.session_id = new.session_id;
    end if;
  end if;

  return null;
end;
$function$;


set local lock_timeout = '10s';
-- Drain old history writers in their existing settings -> progress order.
lock table public.user_watch_settings, public.watch_episode_progress,
  public.watch_sessions, public.watch_session_participants in share row exclusive mode;
-- Explicit history-only reset: never CASCADE into surrounding product data.
delete from public.watch_progress_checkpoints;
delete from public.user_tracked_titles;
delete from public.watch_episode_progress;
delete from public.watch_session_participants;
delete from public.watch_history_user_session_summaries;
delete from public.watch_sessions;
delete from public.watch_history_title_summaries;
delete from public.watch_history_receipts;
delete from public.watch_history_deletions;
update public.user_watch_settings set history_generation = history_generation + 1;
alter table public.user_watch_settings add column write_schema_version smallint;
update public.user_watch_settings set write_schema_version=3;
alter table public.user_watch_settings alter column write_schema_version set not null;
alter table public.user_watch_settings add constraint user_watch_settings_write_schema check(write_schema_version=3);

alter table public.watch_sessions drop constraint watch_sessions_schema_version_check;
alter table public.watch_sessions add constraint watch_sessions_schema_version_check check (schema_version = 3);
alter table public.watch_sessions alter column schema_version set default 3;
alter table public.watch_session_participants drop constraint watch_session_participants_schema_version_check;
alter table public.watch_session_participants add constraint watch_session_participants_schema_version_check check (schema_version = 3);
alter table public.watch_session_participants alter column schema_version set default 3;
alter table public.user_tracked_titles drop constraint user_tracked_titles_schema_version_check;
alter table public.user_tracked_titles add constraint user_tracked_titles_schema_version_check check (schema_version = 3);
drop index public.uniq_watch_sessions_v2_solo;
drop index public.uniq_watch_sessions_v2_shared;
create unique index uniq_watch_sessions_v3_solo on public.watch_sessions(host_user_id, client_session_key) where schema_version = 3 and room_id is null;
create unique index uniq_watch_sessions_v3_shared on public.watch_sessions(room_id, room_generation, source_generation) where schema_version = 3 and room_id is not null;

alter table public.watch_episode_progress add column raw_content_id text, add column audio_locale text;
create index watch_episode_progress_latest_audio_v3 on public.watch_episode_progress
  (user_id,history_generation,provider,title_key,observed_at desc,server_order desc) include(audio_locale);

create function public.watch_catalog_json_v3(value jsonb) returns text
language plpgsql immutable security invoker set search_path='' as $$
begin
  case jsonb_typeof(value)
  when 'object' then return '{'||coalesce((select string_agg(to_jsonb(key)::text||':'||public.watch_catalog_json_v3(v),',' order by key collate "C") from jsonb_each(value) e(key,v)),'')||'}';
  when 'array' then return '['||coalesce((select string_agg(public.watch_catalog_json_v3(v),',' order by n) from jsonb_array_elements(value) with ordinality e(v,n)),'')||']';
  else return value::text;
  end case;
end; $$;

create table public.watch_catalog_snapshots (
  user_id uuid not null references public.users(id) on delete cascade,
  history_generation bigint not null check(history_generation > 0),
  provider text not null check(provider = 'crunchyroll'),
  title_key text not null check(char_length(title_key) between 1 and 220),
  revision bigint not null check(revision > 0),
  context jsonb not null,
  attempt_status text not null check(attempt_status in ('pending','partial','complete')),
  accepted_context jsonb,
  accepted_hash text,
  accepted_title text,
  availability_context_hash text,
  presentation_context_hash text,
  accepted_at timestamptz,
  accepted_revision bigint,
  snapshot jsonb check(octet_length(public.watch_catalog_json_v3(snapshot)) <= 1048576),
  projection jsonb check(octet_length(projection::text) <= 262144),
  preferred_audio_locale text,
  primary key(user_id, history_generation, provider, title_key)
);
create table public.watch_catalog_aliases (
  user_id uuid not null,
  history_generation bigint not null,
  provider text not null,
  title_key text not null,
  raw_content_id text not null,
  season_key text not null,
  episode_key text not null,
  audio_locale text,
  original boolean not null,
  variant_order bigint not null,
  source_url text not null,
  available boolean not null,
  season_order bigint not null,
  episode_order bigint not null,
  season_title text not null,
  season_number integer,
  episode_title text not null,
  episode_number double precision,
  released_at timestamptz,
  availability_context_hash text not null,
  primary key(user_id, history_generation, provider, raw_content_id),
  foreign key(user_id, history_generation, provider, title_key)
    references public.watch_catalog_snapshots on delete cascade
);
create index watch_catalog_aliases_episode on public.watch_catalog_aliases(user_id, history_generation, provider, title_key, episode_key, variant_order);
create index watch_catalog_aliases_order on public.watch_catalog_aliases(user_id, history_generation, provider, title_key, season_order, episode_order);
alter table public.watch_catalog_snapshots enable row level security;
alter table public.watch_catalog_aliases enable row level security;
revoke all on public.watch_catalog_snapshots, public.watch_catalog_aliases from public, anon, authenticated;
grant select, insert, update, delete on public.watch_catalog_snapshots, public.watch_catalog_aliases to service_role;

create function public.watch_catalog_key_valid_v3(value text) returns boolean
language sql immutable security invoker set search_path='' as $$
  select coalesce(value=btrim(value) and (select sum(case when ascii(c)>65535 then 2 else 1 end) from unnest(string_to_array(value,null)) c) between 1 and 220,false);
$$;
-- These JSON guards run before casts, persistence and hashing, independently of
-- the HTTP parser. Missing nullable properties are not JSON null.
create function public.watch_catalog_text_valid_v3(value jsonb, minimum integer, maximum integer, nullable boolean default false) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce((nullable and value='null'::jsonb) or (jsonb_typeof(value)='string'
   and value#>>'{}' !~ U&'^[\0009\000A\000B\000C\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]|[\0009\000A\000B\000C\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]$' and
   (select coalesce(sum(case when ascii(c)>65535 then 2 else 1 end),0) from unnest(string_to_array(value#>>'{}',null)) c) between minimum and maximum),false);
$$;
create function public.watch_catalog_number_valid_v3(value jsonb, maximum numeric, integral boolean, nullable boolean default false) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
begin
 if nullable and value='null'::jsonb then return true; end if;
 if jsonb_typeof(value) is distinct from 'number' then return false; end if;
 return (value::text)::numeric between 0 and maximum and (not integral or trunc((value::text)::numeric)=(value::text)::numeric);
end; $$;
create function public.watch_catalog_timestamp_valid_v3(value jsonb, nullable boolean default false) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
begin
 if nullable and value='null'::jsonb then return true; end if;
 if jsonb_typeof(value) is distinct from 'string' or value#>>'{}' !~ '^\d{4}-\d{2}-\d{2}T([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9](\.\d+)?)?(Z|[+-]\d{2}:\d{2})$' then return false; end if;
 perform (value#>>'{}')::timestamptz;
 return true;
exception when others then return false;
end; $$;
create function public.validate_watch_catalog_input_v3(r jsonb, committing boolean) returns void
language plpgsql immutable security invoker set search_path='' as $$
declare ctx jsonb:=r->'context'; snap jsonb:=r->'snapshot'; s jsonb; e jsonb; v jsonb;
begin
 if jsonb_typeof(r) is distinct from 'object' or r->'schemaVersion' is distinct from '3'::jsonb
   or not public.watch_catalog_number_valid_v3(r->'accountGeneration',9007199254740991,true) or r->'accountGeneration'='0'::jsonb
   or r->'provider' is distinct from '"crunchyroll"'::jsonb
   or not public.watch_catalog_text_valid_v3(r->'titleKey',1,220)
   or not public.watch_catalog_text_valid_v3(r->'providerSeriesId',1,220)
   or jsonb_typeof(ctx) is distinct from 'object'
   or not ctx ?& array['region','requestedLocale','audioLocale','subtitleLocales','observedAt']
   or ctx-array['region','requestedLocale','audioLocale','subtitleLocales','observedAt']<>'{}'::jsonb
   or not (ctx->'region'='null'::jsonb or (jsonb_typeof(ctx->'region')='string' and ctx->>'region' ~ '^[A-Z]{2}$'))
   or not public.watch_catalog_text_valid_v3(ctx->'requestedLocale',2,35)
   or not public.watch_catalog_text_valid_v3(ctx->'audioLocale',2,35,true)
   or not public.watch_catalog_timestamp_valid_v3(ctx->'observedAt')
   or jsonb_typeof(ctx->'subtitleLocales') is distinct from 'array'
 then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
 if jsonb_array_length(ctx->'subtitleLocales')>32 or exists(select 1 from jsonb_array_elements(ctx->'subtitleLocales') x where not public.watch_catalog_text_valid_v3(x,2,35))
 then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
 if not committing then return; end if;
 if not public.watch_catalog_number_valid_v3(r->'revision',9007199254740991,true) or r->'revision'='0'::jsonb
   or jsonb_typeof(snap) is distinct from 'object' or snap->'schemaVersion' is distinct from '3'::jsonb
   or not public.watch_catalog_text_valid_v3(snap->'title',1,300)
   or not public.watch_catalog_text_valid_v3(snap->'titleKey',1,220)
   or not public.watch_catalog_text_valid_v3(snap->'providerSeriesId',1,220)
   or jsonb_typeof(snap->'completeness') is distinct from 'string'
   or snap->>'completeness' not in ('complete','partial')
   or jsonb_typeof(snap->'seasons') is distinct from 'array'
 then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
 if jsonb_array_length(snap->'seasons')>100 or octet_length(public.watch_catalog_json_v3(snap))>1048576
 then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
 for s in select value from jsonb_array_elements(snap->'seasons') loop
   if jsonb_typeof(s) is distinct from 'object' or not public.watch_catalog_text_valid_v3(s->'title',1,300)
     or not public.watch_catalog_text_valid_v3(s->'seasonKey',1,220) or not public.watch_catalog_text_valid_v3(s->'providerSeasonIdentifier',1,220)
     or not public.watch_catalog_number_valid_v3(s->'seasonNumber',1000,true,true)
     or not public.watch_catalog_number_valid_v3(s->'order',9007199254740991,true)
     or jsonb_typeof(s->'episodes') is distinct from 'array'
   then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
   for e in select value from jsonb_array_elements(s->'episodes') loop
     if jsonb_typeof(e) is distinct from 'object' or not public.watch_catalog_text_valid_v3(e->'title',1,300)
       or not public.watch_catalog_text_valid_v3(e->'episodeKey',1,220) or not public.watch_catalog_text_valid_v3(e->'providerEpisodeIdentifier',1,220)
       or not public.watch_catalog_number_valid_v3(e->'episodeNumber',1.7976931348623157e308,false,true)
       or not public.watch_catalog_number_valid_v3(e->'order',9007199254740991,true)
       or not public.watch_catalog_timestamp_valid_v3(e->'releasedAt',true)
       or jsonb_typeof(e->'available') is distinct from 'boolean'
       or jsonb_typeof(e->'watchVariants') is distinct from 'array'
     then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
     for v in select value from jsonb_array_elements(e->'watchVariants') loop
       if jsonb_typeof(v) is distinct from 'object' or not public.watch_catalog_text_valid_v3(v->'providerContentId',1,220)
         or not public.watch_catalog_text_valid_v3(v->'audioLocale',2,35,true)
         or jsonb_typeof(v->'original') is distinct from 'boolean'
         or not public.watch_catalog_number_valid_v3(v->'order',9007199254740991,true)
         or not public.watch_catalog_text_valid_v3(v->'sourceUrl',1,2048)
       then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
     end loop;
   end loop;
 end loop;
end; $$;
create function public.validate_watch_identity_v3(p_event jsonb) returns void
language plpgsql immutable security invoker set search_path = '' as $$
declare i jsonb := p_event->'crunchyrollIdentity';
begin
  if p_event->>'schemaVersion' is distinct from '3' then
    raise exception 'watch_history_upgrade_required' using errcode='22023';
  end if;
  if p_event->>'provider' = 'crunchyroll' then
    if jsonb_typeof(i) is distinct from 'object'
      or not public.watch_catalog_key_valid_v3(p_event->>'titleKey')
      or not public.watch_catalog_key_valid_v3(p_event->>'seasonKey')
      or not public.watch_catalog_key_valid_v3(p_event->>'episodeKey')
      or i-array['providerSeriesId','providerSeasonIdentifier','providerEpisodeIdentifier','providerContentId','audioLocale']<>'{}'::jsonb
      or p_event->>'titleKey' is distinct from 'crunchyroll:series:'||(i->>'providerSeriesId')
      or p_event->>'seasonKey' is distinct from 'crunchyroll:season:'||(i->>'providerSeasonIdentifier')
      or p_event->>'episodeKey' is distinct from 'crunchyroll:episode:'||(i->>'providerEpisodeIdentifier')
      or p_event->>'sourceUrl' is distinct from 'https://www.crunchyroll.com/watch/'||(i->>'providerContentId')
      or coalesce(i->>'providerContentId','') !~ '^[A-Za-z0-9_-]+$'
      or coalesce(i->>'providerSeriesId','') = ''
      or coalesce(i->>'providerSeasonIdentifier','') = ''
      or coalesce(i->>'providerEpisodeIdentifier','') = ''
    then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
  elsif p_event->>'provider' = 'youtube' then
    if p_event->>'titleKey' is distinct from 'youtube:video:'||(p_event->>'youtubeVideoId')
      or p_event->>'episodeKey' is distinct from p_event->>'titleKey'
      or p_event->>'sourceUrl' is distinct from 'https://www.youtube.com/watch?v='||(p_event->>'youtubeVideoId')
    then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
  end if;
end;
$$;

create function public.watch_catalog_state_v3(p_context jsonb, p_accepted_context jsonb)
returns text language sql immutable security invoker set search_path = '' as $$
  select case when p_accepted_context is not null
    and p_context->>'region' is not distinct from p_accepted_context->>'region'
    then 'complete' else 'partial' end;
$$;

create function public.watch_catalog_ack_v3(p_user_id uuid, p_request jsonb)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'meta', jsonb_build_object('serverTime',statement_timestamp(),'ownerUserId',p_user_id,'schemaVersion',3,'accountGeneration',(p_request->>'accountGeneration')::numeric::bigint),
    'schemaVersion',3,'provider','crunchyroll','titleKey',p_request->>'titleKey',
    'accountGeneration',(p_request->>'accountGeneration')::numeric::bigint,
    'revision',coalesce(c.revision,(p_request->>'revision')::numeric::bigint),
    'effectiveCatalogState',case when c.user_id is null then 'unavailable' else public.watch_catalog_state_v3(c.context,case when c.projection is not null then c.accepted_context end) end,
    'projectionRevision', c.accepted_revision,'acceptedHash',c.accepted_hash,'acceptedAt',c.accepted_at)
  from (select 1) singleton left join public.watch_catalog_snapshots c
    on c.user_id=p_user_id and c.history_generation=(p_request->>'accountGeneration')::numeric::bigint
    and c.provider='crunchyroll' and c.title_key=p_request->>'titleKey';
$$;

create function public.begin_watch_catalog_v3(p_user_id uuid, p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare s public.user_watch_settings%rowtype; c public.watch_catalog_snapshots%rowtype;
  changed boolean; fresh boolean; rev bigint;
begin
  if p_request->>'schemaVersion' is distinct from '3' then
    raise exception 'watch_history_upgrade_required' using errcode='22023'; end if;
  perform public.validate_watch_catalog_input_v3(p_request,false);
  if p_user_id is null or p_request->>'provider' is distinct from 'crunchyroll'
    or p_request-array['schemaVersion','accountGeneration','provider','titleKey','providerSeriesId','context']<>'{}'::jsonb
    or not public.watch_catalog_key_valid_v3(p_request->>'titleKey')
    or p_request->>'titleKey' is distinct from 'crunchyroll:series:'||(p_request->>'providerSeriesId')
    or coalesce(length(p_request->>'titleKey'),0) not between 20 and 220
    or jsonb_typeof(p_request->'context') is distinct from 'object'
    or (p_request->'context')-array['region','requestedLocale','audioLocale','subtitleLocales','observedAt']<>'{}'::jsonb
    or jsonb_typeof(p_request#>'{context,subtitleLocales}') is distinct from 'array'
    or jsonb_array_length(p_request#>'{context,subtitleLocales}')>32
    or coalesce(length(p_request#>>'{context,requestedLocale}'),0) not between 2 and 35
    or p_request#>>'{context,observedAt}' is null
    or (p_request#>>'{context,region}' is not null and p_request#>>'{context,region}' !~ '^[A-Z]{2}$')
  then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  insert into public.user_watch_settings(user_id,write_schema_version) values(p_user_id,3) on conflict do nothing;
  select * into strict s from public.user_watch_settings where user_id=p_user_id for update;
  if (p_request->>'accountGeneration')::numeric::bigint is distinct from s.history_generation then
    raise exception 'watch_history_generation_mismatch' using errcode='P0001'; end if;
  if exists(select 1 from public.watch_history_deletions d where d.user_id=p_user_id
    and d.history_generation=s.history_generation and d.scope in ('all','title')
    and (d.scope='all' or (d.provider='crunchyroll' and d.title_key=p_request->>'titleKey'))
    and (p_request#>>'{context,observedAt}')::timestamptz <= d.deleted_at)
  then raise exception 'watch_history_deleted' using errcode='P0001'; end if;
  select * into c from public.watch_catalog_snapshots where user_id=p_user_id
    and history_generation=s.history_generation and provider='crunchyroll' and title_key=p_request->>'titleKey';
  changed := c.accepted_context is not null and c.context->>'region' is distinct from p_request#>>'{context,region}';
  fresh := c.projection is not null and c.accepted_at > statement_timestamp()-interval '24 hours'
    and c.accepted_context->>'region' is not distinct from p_request#>>'{context,region}'
    and c.accepted_context->>'requestedLocale' is not distinct from p_request#>>'{context,requestedLocale}'
    and c.context->>'region' is not distinct from p_request#>>'{context,region}'
    and c.context->>'requestedLocale' is not distinct from p_request#>>'{context,requestedLocale}';
  if coalesce(fresh,false) then
    return public.watch_catalog_ack_v3(p_user_id,p_request)||jsonb_build_object('refreshRequired',false,'availabilityChanged',false);
  end if;
  update public.user_watch_settings set next_server_order=next_server_order+1 where user_id=p_user_id returning next_server_order into rev;
  insert into public.watch_catalog_snapshots(user_id,history_generation,provider,title_key,revision,context,attempt_status,preferred_audio_locale)
    values(p_user_id,s.history_generation,'crunchyroll',p_request->>'titleKey',rev,p_request->'context','pending',
      (select p.audio_locale from public.watch_episode_progress p where p.user_id=p_user_id and p.history_generation=s.history_generation
        and p.provider='crunchyroll' and p.title_key=p_request->>'titleKey' order by p.observed_at desc,p.server_order desc limit 1))
    on conflict(user_id,history_generation,provider,title_key) do update
      set revision=excluded.revision, context=excluded.context, attempt_status='pending';
  return public.watch_catalog_ack_v3(p_user_id,p_request)||jsonb_build_object('refreshRequired',true,'availabilityChanged',coalesce(changed,false));
end;
$$;

-- Derived compact aggregates: only catalog replacement, completion/delete or audio
-- preference changes call this. Resume heartbeats never read the snapshot.
create function public.refresh_watch_catalog_projection_v3(p_user_id uuid,p_generation bigint,p_provider text,p_title text)
returns void language plpgsql volatile security invoker set search_path = '' as $$
declare result jsonb;
begin
  with episodes as materialized (
    select distinct on (a.episode_key) a.*, p.completed_at
    from public.watch_catalog_aliases a
    join public.watch_catalog_snapshots c using(user_id,history_generation,provider,title_key)
    left join public.watch_episode_progress p on p.user_id=a.user_id and p.history_generation=a.history_generation
      and p.provider=a.provider and p.title_key=a.title_key and p.episode_key=a.episode_key
    where a.user_id=p_user_id and a.history_generation=p_generation and a.provider=p_provider and a.title_key=p_title
    order by a.episode_key, (a.audio_locale=c.preferred_audio_locale) desc nulls last,a.original desc,a.variant_order,a.raw_content_id
  ), seasons as (
    select season_key, min(season_title) title, min(season_number) season_number,min(season_order) season_order,
      count(*) filter(where available) available_count,
      count(*) filter(where available and completed_at is not null) completed_count
    from episodes group by season_key
  )
  select jsonb_build_object(
    'aggregate',jsonb_build_object('availableEpisodes',(select count(*) from episodes where available),
      'completedEpisodes',(select count(*) from episodes where available and completed_at is not null),
      'progress',coalesce((select count(*) filter(where available and completed_at is not null)::double precision/nullif(count(*) filter(where available),0) from episodes),0)),
    'seasons',coalesce((select jsonb_agg(jsonb_build_object('seasonKey',s.season_key,'seasonTitle',s.title,
      'seasonNumber',s.season_number,'order',s.season_order,
      'aggregate',jsonb_build_object('availableEpisodes',s.available_count,'completedEpisodes',s.completed_count,'progress',coalesce(s.completed_count::double precision/nullif(s.available_count,0),0)),
      'nextEpisode',(select jsonb_build_object('episodeKey',e.episode_key,'episodeTitle',e.episode_title,'seasonKey',e.season_key,'seasonTitle',e.season_title,'seasonNumber',e.season_number,'episodeNumber',e.episode_number,'sourceUrl',e.source_url,'releasedAt',e.released_at)
        from episodes e where e.season_key=s.season_key and e.available and e.completed_at is null order by e.episode_order,e.episode_key limit 1)) order by s.season_order,s.season_key) from seasons s),'[]'::jsonb)) into result;
  -- A derived view must never make a valid progress/deletion transaction fail.
  -- Retain inventory and accepted provenance, but suppress exact reads until a
  -- subsequent derivation fits. Commit handles candidate overflow atomically.
  if octet_length(result::text)>262144 then result:=null; end if;
  update public.watch_catalog_snapshots set projection=result,
    attempt_status=case when result is null then 'partial' else attempt_status end
    where user_id=p_user_id and history_generation=p_generation and provider=p_provider and title_key=p_title;
end;
$$;

create function public.apply_watch_catalog_v3(p_user_id uuid,p_request jsonb)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare c public.watch_catalog_snapshots%rowtype; gen bigint; snap jsonb:=p_request->'snapshot';
  season jsonb; episode jsonb; variant jsonb; ec integer:=0; vc integer:=0; hash text;
  season_keys text[]:='{}'::text[]; episode_keys text[]:='{}'::text[]; raw_ids text[]:='{}'::text[]; original_count integer;
begin
  if p_request->>'schemaVersion' is distinct from '3' then
    raise exception 'watch_history_upgrade_required' using errcode='22023'; end if;
  perform public.validate_watch_catalog_input_v3(p_request,true);
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select history_generation into gen from public.user_watch_settings where user_id=p_user_id for update;
  if gen is null or gen is distinct from (p_request->>'accountGeneration')::numeric::bigint then
    raise exception 'watch_history_generation_mismatch' using errcode='P0001'; end if;
  select * into c from public.watch_catalog_snapshots where user_id=p_user_id and history_generation=gen
    and provider='crunchyroll' and title_key=p_request->>'titleKey';
  if not found or c.revision is distinct from (p_request->>'revision')::numeric::bigint then
    return public.watch_catalog_ack_v3(p_user_id,p_request)||jsonb_build_object('revision',(p_request->>'revision')::numeric::bigint,'outcome','superseded'); end if;
  if p_request-array['schemaVersion','accountGeneration','provider','titleKey','providerSeriesId','context','revision','snapshot']<>'{}'::jsonb
    or snap-array['schemaVersion','provider','titleKey','providerSeriesId','title','completeness','context','seasons']<>'{}'::jsonb
    or c.context is distinct from p_request->'context' or snap->'context' is distinct from c.context
    or snap->>'titleKey' is distinct from c.title_key
    or snap->>'providerSeriesId' is distinct from p_request->>'providerSeriesId'
    or snap->>'titleKey' is distinct from 'crunchyroll:series:'||(snap->>'providerSeriesId')
    or snap->>'schemaVersion' is distinct from '3' or snap->>'provider' is distinct from 'crunchyroll'
    or coalesce(length(snap->>'title'),0) not between 1 and 300
    or jsonb_typeof(snap->'seasons') is distinct from 'array'
    or jsonb_array_length(snap->'seasons')>100 or octet_length(public.watch_catalog_json_v3(snap))>1048576
    or snap->>'completeness' not in ('complete','partial')
  then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
  if snap->>'completeness'='complete' and (c.context->>'region' is null or jsonb_array_length(snap->'seasons')=0) then
    raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
  for season in select value from jsonb_array_elements(snap->'seasons') loop
    if season->>'seasonKey' is distinct from 'crunchyroll:season:'||(season->>'providerSeasonIdentifier')
      or season-array['seasonKey','providerSeasonIdentifier','title','seasonNumber','order','episodes']<>'{}'::jsonb
      or not public.watch_catalog_key_valid_v3(season->>'seasonKey')
      or season->>'seasonKey'=any(season_keys) or coalesce(length(season->>'seasonKey'),0) not between 20 and 220
      or coalesce(length(season->>'title'),0) not between 1 and 300
      or jsonb_typeof(season->'episodes') is distinct from 'array' or (snap->>'completeness'='complete' and jsonb_array_length(season->'episodes')=0)
    then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
    season_keys:=array_append(season_keys,season->>'seasonKey');
    for episode in select value from jsonb_array_elements(season->'episodes') loop
      ec:=ec+1;
      if ec>2000 or episode->>'episodeKey' is distinct from 'crunchyroll:episode:'||(episode->>'providerEpisodeIdentifier')
        or episode-array['episodeKey','providerEpisodeIdentifier','title','episodeNumber','order','releasedAt','available','watchVariants']<>'{}'::jsonb
        or not public.watch_catalog_key_valid_v3(episode->>'episodeKey')
        or episode->>'episodeKey'=any(episode_keys) or coalesce(length(episode->>'episodeKey'),0) not between 21 and 220
        or coalesce(length(episode->>'title'),0) not between 1 and 300
        or jsonb_typeof(episode->'available') is distinct from 'boolean'
        or jsonb_typeof(episode->'watchVariants') is distinct from 'array'
        or jsonb_array_length(episode->'watchVariants') not between 1 and 32
      then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
      episode_keys:=array_append(episode_keys,episode->>'episodeKey'); original_count:=0;
      for variant in select value from jsonb_array_elements(episode->'watchVariants') loop
        vc:=vc+1;
        if (variant->>'original')::boolean then original_count:=original_count+1; end if;
        if vc>10000 or original_count>1 or coalesce(variant->>'providerContentId','') !~ '^[A-Za-z0-9_-]+$'
          or variant-array['providerContentId','audioLocale','original','order','sourceUrl']<>'{}'::jsonb
          or length(variant->>'providerContentId')>220 or variant->>'providerContentId'=any(raw_ids)
          or variant->>'sourceUrl' is distinct from 'https://www.crunchyroll.com/watch/'||(variant->>'providerContentId')
          or exists(select 1 from public.watch_catalog_aliases a where a.user_id=p_user_id and a.history_generation=gen
            and a.provider='crunchyroll' and a.raw_content_id=variant->>'providerContentId' and a.title_key<>c.title_key)
        then raise exception 'watch_catalog_alias_conflict' using errcode='22023'; end if;
        raw_ids:=array_append(raw_ids,variant->>'providerContentId');
      end loop;
    end loop;
  end loop;
  if snap->>'completeness'='partial' then
    update public.watch_catalog_snapshots set attempt_status='partial' where user_id=p_user_id and history_generation=gen and provider='crunchyroll' and title_key=c.title_key;
    return public.watch_catalog_ack_v3(p_user_id,p_request)||jsonb_build_object('outcome','applied'); end if;
  -- Sort provider order with stable identity tie breakers independently of the client.
  snap:=jsonb_set(snap,'{seasons}',(select jsonb_agg(jsonb_set(s,'{episodes}',
    (select jsonb_agg(jsonb_set(e,'{watchVariants}',(select jsonb_agg(v order by (v->>'order')::numeric::bigint,v->>'providerContentId') from jsonb_array_elements(e->'watchVariants') v)) order by (e->>'order')::numeric::bigint,e->>'episodeKey') from jsonb_array_elements(s->'episodes') e)) order by (s->>'order')::numeric::bigint,s->>'seasonKey') from jsonb_array_elements(snap->'seasons') s));
  hash:=encode(extensions.digest(public.watch_catalog_json_v3(snap),'sha256'),'hex');
  -- Duplicate delivery of the same issued commit cannot extend freshness.
  if c.accepted_revision=c.revision then
    if c.accepted_hash is distinct from hash then raise exception 'watch_catalog_revision_conflict' using errcode='22023'; end if;
    return public.watch_catalog_ack_v3(p_user_id,p_request)||jsonb_build_object('outcome','applied'); end if;
  begin
  delete from public.watch_catalog_aliases where user_id=p_user_id and history_generation=gen and provider='crunchyroll' and title_key=c.title_key;
  insert into public.watch_catalog_aliases
  select p_user_id,gen,'crunchyroll',c.title_key,v->>'providerContentId',s->>'seasonKey',e->>'episodeKey',
    v->>'audioLocale',(v->>'original')::boolean,(v->>'order')::numeric::bigint,v->>'sourceUrl',(e->>'available')::boolean,
    (s->>'order')::numeric::bigint,(e->>'order')::numeric::bigint,s->>'title',(s->>'seasonNumber')::numeric::integer,e->>'title',(e->>'episodeNumber')::double precision,
    (e->>'releasedAt')::timestamptz,encode(extensions.digest(coalesce(c.context->>'region','')||':3','sha256'),'hex')
  from jsonb_array_elements(snap->'seasons') s cross join lateral jsonb_array_elements(s->'episodes') e
    cross join lateral jsonb_array_elements(e->'watchVariants') v;
  update public.watch_catalog_snapshots set snapshot=snap,accepted_title=snap->>'title',accepted_context=c.context,accepted_hash=hash,
    availability_context_hash=encode(extensions.digest((c.context->>'region')||':3','sha256'),'hex'),
    presentation_context_hash=encode(extensions.digest(c.context->>'requestedLocale','sha256'),'hex'),
    accepted_at=statement_timestamp(),accepted_revision=c.revision,attempt_status='complete'
    where user_id=p_user_id and history_generation=gen and provider='crunchyroll' and title_key=c.title_key;
  perform public.refresh_watch_catalog_projection_v3(p_user_id,gen,'crunchyroll',c.title_key);
  if exists(select 1 from public.watch_catalog_snapshots where user_id=p_user_id and history_generation=gen and provider='crunchyroll' and title_key=c.title_key and projection is null) then
    raise exception 'watch_catalog_projection_overflow' using errcode='PWC01';
  end if;
  exception when sqlstate 'PWC01' then
    -- Roll back only the candidate bundle, preserving a prior accepted bundle.
    update public.watch_catalog_snapshots set attempt_status='partial'
      where user_id=p_user_id and history_generation=gen and provider='crunchyroll' and title_key=c.title_key;
  end;
  return public.watch_catalog_ack_v3(p_user_id,p_request)||jsonb_build_object('outcome','applied');
end;
$$;

create function public.watch_catalog_label_v3(p_user_id uuid,p_generation bigint,p_provider text,p_title text,p_episode text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('episodeTitle',a.episode_title,'seasonTitle',a.season_title,'seasonNumber',a.season_number,'episodeNumber',a.episode_number)
  from public.watch_catalog_aliases a join public.watch_catalog_snapshots c using(user_id,history_generation,provider,title_key)
  where a.user_id=p_user_id and a.history_generation=p_generation and a.provider=p_provider and a.title_key=p_title and a.episode_key=p_episode
    and public.watch_catalog_state_v3(c.context,case when c.projection is not null then c.accepted_context end)='complete'
  order by a.variant_order,a.raw_content_id limit 1;
$$;
create function public.watch_catalog_read_v3(p_user_id uuid,p_generation bigint,p_provider text,p_title text,p_season_keys text[] default null)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('state',case when c.user_id is null then 'unavailable' else public.watch_catalog_state_v3(c.context,case when c.projection is not null then c.accepted_context end) end,
    'title',case when public.watch_catalog_state_v3(c.context,case when c.projection is not null then c.accepted_context end)='complete' then c.accepted_title end,
    'aggregate',case when public.watch_catalog_state_v3(c.context,case when c.projection is not null then c.accepted_context end)='complete' then c.projection->'aggregate' end,
    'seasons',case when public.watch_catalog_state_v3(c.context,case when c.projection is not null then c.accepted_context end)='complete' then
      coalesce((select jsonb_agg(s order by (s->>'order')::numeric::bigint,s->>'seasonKey') from jsonb_array_elements(c.projection->'seasons') s
        where (p_season_keys is not null and s->>'seasonKey'=any(p_season_keys)) or (p_season_keys is null and s->>'seasonKey' in (select p.season_key from public.watch_episode_progress p where p.user_id=p_user_id and p.history_generation=p_generation
          and p.provider=p_provider and p.title_key=p_title order by p.observed_at desc,p.episode_key collate "C" limit 8))),'[]'::jsonb)
      else '[]'::jsonb end)
  from (select 1) singleton left join public.watch_catalog_snapshots c on c.user_id=p_user_id and c.history_generation=p_generation and c.provider=p_provider and c.title_key=p_title;
$$;

create function public.sync_watch_catalog_progress_v3() returns trigger
language plpgsql volatile security invoker set search_path = '' as $$
declare uid uuid; gen bigint; prov text; titlekey text; latest_audio text; previous_audio text; accepted boolean;
begin
  uid:=coalesce(new.user_id,old.user_id); gen:=coalesce(new.history_generation,old.history_generation);
  prov:=coalesce(new.provider,old.provider); titlekey:=coalesce(new.title_key,old.title_key);
  select preferred_audio_locale,accepted_context is not null into previous_audio,accepted
    from public.watch_catalog_snapshots where user_id=uid and history_generation=gen and provider=prov and title_key=titlekey;
  if not found then return null; end if;
  -- Indexed latest observed row, not the current episode's previous locale.
  -- Server order breaks timestamp ties; delayed older episodes cannot take over.
  select audio_locale into latest_audio from public.watch_episode_progress
    where user_id=uid and history_generation=gen and provider=prov and title_key=titlekey
    order by observed_at desc,server_order desc limit 1;
  if latest_audio is distinct from previous_audio then
    update public.watch_catalog_snapshots set preferred_audio_locale=latest_audio
      where user_id=uid and history_generation=gen and provider=prov and title_key=titlekey;
  elsif tg_op='UPDATE' and new.completed_at is not distinct from old.completed_at then
    return null;
  end if;
  if accepted then
    perform public.refresh_watch_catalog_projection_v3(uid,gen,prov,titlekey);
  end if;
  return null;
end;
$$;
create trigger sync_watch_catalog_progress_v3 after insert or update or delete on public.watch_episode_progress
for each row execute function public.sync_watch_catalog_progress_v3();

drop trigger sync_watch_history_title_summary_v2 on public.watch_episode_progress;
drop trigger sync_watch_history_title_summary_delete_v2 on public.watch_episode_progress;
drop trigger sync_watch_history_user_session_summary_v2 on public.watch_session_participants;
drop trigger sync_watch_history_session_summaries_v2 on public.watch_sessions;
create trigger sync_watch_history_title_summary_v3 after insert or update on public.watch_episode_progress
for each row execute function public.sync_watch_history_title_summary_v3();
create trigger sync_watch_history_title_summary_delete_v3 after delete on public.watch_episode_progress
referencing old table as deleted_progress for each statement execute function public.sync_watch_history_title_summary_delete_v3();
create trigger sync_watch_history_user_session_summary_v3 after insert or update on public.watch_session_participants
for each row execute function public.sync_watch_history_user_session_summary_v3();
create trigger sync_watch_history_session_summaries_v3 after insert or update of schema_version,provider,item_key,last_checkpoint_at,room_id,client_session_key on public.watch_sessions
for each row execute function public.sync_watch_history_session_summaries_v3();

create or replace function public.apply_watch_progress_v2(p_user_id uuid,p_event jsonb,p_room_authority jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin raise exception 'watch_history_upgrade_required' using errcode='22023'; end; $$;
create or replace function public.delete_watch_history_v2(p_user_id uuid,p_request jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin raise exception 'watch_history_upgrade_required' using errcode='22023'; end; $$;
create or replace function public.set_watch_preferences_v2(p_user_id uuid,p_preferences jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin raise exception 'watch_history_upgrade_required' using errcode='22023'; end; $$;

-- The existing bounded receipt cleanup and its scheduled job remain unchanged.
do $$ declare fn record; begin
  for fn in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like '%watch%v3%' loop
    execute format('revoke all on function %s from public, anon, authenticated',fn.signature);
    execute format('grant execute on function %s to service_role',fn.signature);
  end loop;
end; $$;
CREATE OR REPLACE FUNCTION public.list_watch_history_v2_bounded_page(p_user_id uuid, p_history_generation bigint, p_limit integer, p_cursor_watched_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_stable_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin raise exception 'watch_history_upgrade_required' using errcode='22023'; end;
$function$;

CREATE OR REPLACE FUNCTION public.list_watch_history_v2_title_episodes_page(p_user_id uuid, p_history_generation bigint, p_provider text, p_title_key text, p_limit integer DEFAULT 50, p_cursor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin raise exception 'watch_history_upgrade_required' using errcode='22023'; end;
$function$;

CREATE OR REPLACE FUNCTION public.list_watch_history_v2_page(p_user_id uuid, p_history_generation bigint, p_limit integer, p_cursor_watched_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_stable_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
begin raise exception 'watch_history_upgrade_required' using errcode='22023'; end;
$function$;
notify pgrst, 'reload schema';
commit;
