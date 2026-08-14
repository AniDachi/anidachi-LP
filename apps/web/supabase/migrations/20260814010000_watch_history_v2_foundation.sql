-- Additive Watch History v2 durable foundation.
--
-- V1 checkpoints and runtime remain active during Wave 2. These relations and
-- RPCs are server-only and intentionally have no browser-facing RLS policies.

create table public.user_watch_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  history_generation bigint not null default 1 check (history_generation > 0),
  next_server_order bigint not null default 0 check (next_server_order >= 0),
  youtube_history_enabled boolean not null default false,
  updated_at timestamptz not null default pg_catalog.transaction_timestamp()
);

create table public.watch_episode_progress (
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null check (provider in ('crunchyroll', 'youtube')),
  title_key text not null check (char_length(title_key) between 1 and 220),
  episode_key text not null check (char_length(episode_key) between 1 and 220),
  item_kind text not null check (item_kind in ('series', 'movie')),
  title text not null check (char_length(title) between 1 and 300),
  artwork_url text check (artwork_url is null or char_length(artwork_url) <= 2048),
  episode_title text not null check (char_length(episode_title) between 1 and 300),
  season_key text check (season_key is null or char_length(season_key) between 1 and 220),
  season_title text check (season_title is null or char_length(season_title) between 1 and 300),
  season_number integer check (season_number is null or season_number >= 0),
  episode_number double precision check (episode_number is null or episode_number >= 0),
  source_url text not null check (char_length(source_url) between 1 and 2048),
  current_time double precision not null check (current_time >= 0),
  duration double precision not null check (duration >= 0),
  progress double precision not null check (progress between 0 and 1),
  completed_at timestamptz,
  latest_session_id uuid references public.watch_sessions (id) on delete set null,
  last_event_id uuid not null,
  observed_at timestamptz not null,
  server_order bigint not null check (server_order > 0),
  history_generation bigint not null check (history_generation > 0),
  updated_at timestamptz not null,
  primary key (user_id, provider, title_key, episode_key)
);

-- Receipts are exact canonical acknowledgements retained for exactly 14 days.
-- Cleanup is opportunistic inside later account-locked write transactions.
create table public.watch_history_receipts (
  user_id uuid not null references public.users (id) on delete cascade,
  client_id uuid not null,
  kind text not null check (kind in ('progress', 'delete')),
  acknowledgement jsonb not null check (
    pg_catalog.jsonb_typeof(acknowledgement) = 'object'
    and pg_catalog.pg_column_size(acknowledgement) <= 262144
  ),
  accepted_at timestamptz not null default pg_catalog.transaction_timestamp(),
  expires_at timestamptz not null default (
    pg_catalog.transaction_timestamp() + interval '14 days'
  ),
  primary key (user_id, client_id),
  check (expires_at = accepted_at + interval '14 days')
);

-- Deletion fences survive accepted playback. A later observation must be
-- strictly newer than its applicable fence before history may reappear.
create table public.watch_history_deletions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  scope text not null check (scope in ('all', 'title', 'episode')),
  provider text check (provider is null or provider in ('crunchyroll', 'youtube')),
  title_key text check (title_key is null or char_length(title_key) between 1 and 220),
  episode_key text check (episode_key is null or char_length(episode_key) between 1 and 220),
  history_generation bigint not null check (history_generation > 0),
  deleted_at timestamptz not null,
  last_client_mutation_id uuid not null,
  check (
    (scope = 'all' and provider is null and title_key is null and episode_key is null)
    or
    (scope = 'title' and provider is not null and title_key is not null and episode_key is null)
    or
    (scope = 'episode' and provider is not null and title_key is not null and episode_key is not null)
  )
);

-- Pair-owned product evidence only. It is not a room ledger and deliberately
-- carries neither room/source generations nor a synthesized shared-room count.
create table public.recent_people_evidence (
  user_id uuid not null references public.users (id) on delete cascade,
  other_user_id uuid not null references public.users (id) on delete cascade,
  last_room_id text not null references public.rooms (room_id) on delete cascade,
  last_watched_at timestamptz not null,
  primary key (user_id, other_user_id),
  check (user_id <> other_user_id)
);

create unique index uniq_watch_episode_progress_user_server_order
  on public.watch_episode_progress (user_id, server_order);

create index idx_watch_episode_progress_episode_lookup
  on public.watch_episode_progress (user_id, provider, title_key, episode_key, observed_at desc);

create index idx_watch_episode_progress_title_page
  on public.watch_episode_progress (
    user_id,
    history_generation,
    observed_at desc,
    provider,
    title_key,
    episode_key
  );

create index idx_watch_episode_progress_latest_session
  on public.watch_episode_progress (latest_session_id)
  where latest_session_id is not null;

create index idx_watch_history_receipts_expiry
  on public.watch_history_receipts (user_id, expires_at);

create index idx_watch_history_deletions_lookup
  on public.watch_history_deletions (
    user_id,
    history_generation,
    provider,
    title_key,
    episode_key,
    deleted_at desc
  );

create unique index uniq_watch_history_deletions_all
  on public.watch_history_deletions (user_id)
  where scope = 'all';

create unique index uniq_watch_history_deletions_title
  on public.watch_history_deletions (user_id, provider, title_key)
  where scope = 'title';

create unique index uniq_watch_history_deletions_episode
  on public.watch_history_deletions (user_id, provider, title_key, episode_key)
  where scope = 'episode';

create index idx_recent_people_evidence_order
  on public.recent_people_evidence (user_id, last_watched_at desc, other_user_id);

create index idx_recent_people_evidence_other_user
  on public.recent_people_evidence (other_user_id);

create index idx_recent_people_evidence_room
  on public.recent_people_evidence (last_room_id);

alter table public.watch_sessions
  add column if not exists schema_version smallint not null default 1,
  add column if not exists history_generation bigint not null default 1,
  add column if not exists client_session_key text,
  add column if not exists room_generation bigint,
  add column if not exists source_generation bigint;

alter table public.watch_sessions
  add constraint watch_sessions_schema_version_check
    check (schema_version in (1, 2)),
  add constraint watch_sessions_history_generation_check
    check (history_generation > 0),
  add constraint watch_sessions_client_session_key_check
    check (client_session_key is null or char_length(client_session_key) between 1 and 220),
  add constraint watch_sessions_room_generation_check
    check (room_generation is null or room_generation > 0),
  add constraint watch_sessions_source_generation_check
    check (source_generation is null or source_generation > 0),
  add constraint watch_sessions_v2_identity_check
    check (
      schema_version = 1
      or (
        room_id is null
        and client_session_key is not null
        and room_generation is null
        and source_generation is null
      )
      or (
        room_id is not null
        and client_session_key is null
        and room_generation is not null
        and source_generation is not null
      )
      or (
        room_id is null
        and client_session_key is null
        and room_generation is not null
        and source_generation is not null
        and ended_at is not null
      )
    );

alter table public.user_tracked_titles
  add column if not exists schema_version smallint not null default 1,
  add column if not exists history_generation bigint not null default 1;

alter table public.user_tracked_titles
  add constraint user_tracked_titles_schema_version_check
    check (schema_version in (1, 2)),
  add constraint user_tracked_titles_history_generation_check
    check (history_generation > 0);

create unique index uniq_watch_sessions_v2_solo
  on public.watch_sessions (host_user_id, client_session_key)
  where schema_version = 2 and room_id is null;

create unique index uniq_watch_sessions_v2_shared
  on public.watch_sessions (room_id, room_generation, source_generation)
  where schema_version = 2 and room_id is not null;

alter table public.user_watch_settings enable row level security;
alter table public.watch_episode_progress enable row level security;
alter table public.watch_history_receipts enable row level security;
alter table public.watch_history_deletions enable row level security;
alter table public.recent_people_evidence enable row level security;

revoke all on table public.user_watch_settings from public, anon, authenticated;
revoke all on table public.watch_episode_progress from public, anon, authenticated;
revoke all on table public.watch_history_receipts from public, anon, authenticated;
revoke all on table public.watch_history_deletions from public, anon, authenticated;
revoke all on table public.recent_people_evidence from public, anon, authenticated;

grant select, insert, update, delete on table public.user_watch_settings to service_role;
grant select, insert, update, delete on table public.watch_episode_progress to service_role;
grant select, insert, update, delete on table public.watch_history_receipts to service_role;
grant select, insert, update, delete on table public.watch_history_deletions to service_role;
grant select, insert, update, delete on table public.recent_people_evidence to service_role;

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
  room_row public.rooms%rowtype;
  member_joined_at timestamptz;
  authority_issued_at timestamptz;
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
  other_user_id uuid;
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

  delete from public.watch_history_receipts as expired_receipt
  where expired_receipt.user_id = p_user_id
    and expired_receipt.expires_at <= server_accepted_at;

  select receipt.*
  into existing_receipt
  from public.watch_history_receipts as receipt
  where receipt.user_id = p_user_id
    and receipt.client_id = client_event_id;

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
      or (p_room_authority ->> 'iat') !~ '^[0-9]+$'
    then
      raise exception 'watch_history_authority_mismatch' using errcode = '22023';
    end if;

    if (p_room_authority ->> 'roomGeneration')::bigint
        <> (p_event #>> '{sharedRoom,roomGeneration}')::bigint
      or (p_room_authority ->> 'sourceGeneration')::bigint
        <> (p_event #>> '{sharedRoom,sourceGeneration}')::bigint
      or (p_room_authority ->> 'roomGeneration')::bigint
        <= 0
      or (p_room_authority ->> 'sourceGeneration')::bigint <= 0
    then
      raise exception 'watch_history_authority_mismatch' using errcode = '22023';
    end if;

    authority_issued_at := pg_catalog.to_timestamp(
      (p_room_authority ->> 'iat')::double precision
    );

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
      history_generation = public.watch_sessions.history_generation
    returning id into session_id_value;
  end if;

  insert into public.watch_session_participants (
    session_id,
    user_id,
    role,
    joined_at,
    left_at,
    current_time_seconds,
    progress,
    updated_at
  ) values (
    session_id_value,
    p_user_id,
    participant_role,
    server_accepted_at,
    case when event_kind_value in ('room_leave', 'room_end', 'ended')
      then server_accepted_at else null end,
    least(pg_catalog.floor((p_event ->> 'currentTime')::double precision), 2147483647)::integer,
    (p_event ->> 'progress')::double precision,
    server_accepted_at
  )
  on conflict (session_id, user_id) do update set
    role = excluded.role,
    left_at = excluded.left_at,
    current_time_seconds = excluded.current_time_seconds,
    progress = excluded.progress,
    updated_at = excluded.updated_at;

  if room_row.room_id is not null then
    for other_user_id in
      select other_participant.user_id
      from public.watch_session_participants as other_participant
      where other_participant.session_id = session_id_value
        and other_participant.user_id <> p_user_id
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
        values (p_user_id, other_user_id), (other_user_id, p_user_id)
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
    current_time,
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
    current_time = excluded.current_time,
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
    'currentTime', episode.current_time,
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
                    'handle', profile.handle,
                    'displayName', coalesce(profile.display_name, participant_user.display_name),
                    'avatarUrl', coalesce(profile.avatar_url, participant_user.avatar_url)
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
                order by participant.joined_at, participant.user_id
                limit 15
              ) as bounded_participant
            ), '[]'::jsonb)
          ) as payload
        from public.watch_sessions as session
        inner join public.watch_session_participants as owner_participant
          on owner_participant.session_id = session.id
          and owner_participant.user_id = p_user_id
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

create or replace function public.set_watch_preferences_v2(
  p_user_id uuid,
  p_preferences jsonb
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

  insert into public.user_watch_settings (user_id)
  values (p_user_id)
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
      'schemaVersion', 2,
      'ownerUserId', p_user_id,
      'accountGeneration', settings_row.history_generation
    ),
    'preferences', pg_catalog.jsonb_build_object(
      'youtubeHistoryEnabled', settings_row.youtube_history_enabled
    )
  );
end;
$$;

create or replace function public.delete_watch_history_v2(
  p_user_id uuid,
  p_request jsonb
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
  client_mutation_id uuid;
  requested_generation bigint;
  resulting_generation bigint;
  scope_value text;
  provider_value text;
  title_key_value text;
  episode_key_value text;
  acknowledgement_value jsonb;
begin
  if p_user_id is null or pg_catalog.jsonb_typeof(p_request) <> 'object' then
    raise exception 'watch_history_delete_invalid' using errcode = '22023';
  end if;

  client_mutation_id := (p_request ->> 'clientMutationId')::uuid;

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
      and session.schema_version = 2;

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
      and session.schema_version = 2
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
      and session.schema_version = 2
      and session.provider = provider_value
      and session.item_key = title_key_value
      and session.episode_key = episode_key_value;

  else
    raise exception 'watch_history_delete_invalid' using errcode = '22023';
  end if;

  delete from public.watch_sessions as orphan_session
  where orphan_session.schema_version = 2
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

  acknowledgement_value := pg_catalog.jsonb_build_object(
    'meta', pg_catalog.jsonb_build_object(
      'serverTime', server_accepted_at,
      'schemaVersion', 2,
      'ownerUserId', p_user_id,
      'accountGeneration', resulting_generation
    ),
    'schemaVersion', 2,
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
$$;

revoke all on function public.apply_watch_progress_v2(uuid, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.set_watch_preferences_v2(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.delete_watch_history_v2(uuid, jsonb)
  from public, anon, authenticated;

grant execute on function public.apply_watch_progress_v2(uuid, jsonb, jsonb)
  to service_role;
grant execute on function public.set_watch_preferences_v2(uuid, jsonb)
  to service_role;
grant execute on function public.delete_watch_history_v2(uuid, jsonb)
  to service_role;
