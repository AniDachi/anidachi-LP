create extension if not exists pgtap with schema extensions;

-- Linked tests connect through a NOINHERIT role that is a member of postgres.
set role postgres;
set search_path = public, extensions;
select no_plan();

delete from public.rooms
where room_id = 'watch-v2-room';

delete from public.users
where id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);

insert into public.users (id, email, display_name)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'watch-v2-host@example.test',
    'Watch V2 Host'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'watch-v2-viewer@example.test',
    'Watch V2 Viewer'
  );

create or replace function pg_temp.watch_v2_event(
  event_id uuid,
  session_key text,
  observed_at timestamptz,
  current_seconds double precision,
  account_generation bigint default 1,
  shared_room jsonb default null,
  episode_key text default 'episode-one',
  title_key text default 'series-one',
  event_kind text default 'heartbeat'
)
returns jsonb
language sql
as $$
  select pg_catalog.jsonb_build_object(
    'schemaVersion', 2,
    'clientEventId', event_id,
    'clientSessionKey', session_key,
    'accountGeneration', account_generation,
    'provider', 'crunchyroll',
    'titleKey', title_key,
    'itemKind', 'series',
    'title', case when title_key = 'series-one' then 'Series One' else 'Series Two' end,
    'artworkUrl', null,
    'episodeKey', episode_key,
    'episodeTitle', case when episode_key = 'episode-one' then 'Episode One' else 'Episode Two' end,
    'seasonKey', 'season-one',
    'seasonTitle', 'Season One',
    'seasonNumber', 1,
    'episodeNumber', case when episode_key = 'episode-one' then 1 else 2 end,
    'sourceUrl', 'https://www.crunchyroll.com/watch/' || episode_key || '/demo',
    'currentTime', current_seconds,
    'duration', 1200,
    'progress', current_seconds / 1200,
    'observedAt', observed_at,
    'kind', event_kind,
    'sharedRoom', shared_room
  );
$$;

create or replace function pg_temp.watch_v2_shared_room(
  participant_session_id text,
  source_generation bigint default 1
)
returns jsonb
language sql
as $$
  select pg_catalog.jsonb_build_object(
    'roomId', 'watch-v2-room',
    'participantSessionId', participant_session_id,
    'roomGeneration', 1,
    'sourceGeneration', source_generation
  );
$$;

create or replace function pg_temp.watch_v2_authority(
  user_id uuid,
  participant_session_id text,
  source_generation bigint default 1
)
returns jsonb
language sql
as $$
  select pg_catalog.jsonb_build_object(
    'typ', 'room_history',
    'iss', 'anidachi-worker',
    'aud', 'anidachi-web-history',
    'sub', user_id,
    'roomId', 'watch-v2-room',
    'participantSessionId', participant_session_id,
    'roomGeneration', 1,
    'sourceGeneration', source_generation,
    'iat', extract(epoch from pg_catalog.statement_timestamp())::bigint,
    'exp', extract(epoch from pg_catalog.statement_timestamp())::bigint + 86400,
    'jti', '99999999-9999-4999-8999-999999999999'
  );
$$;

create or replace function pg_temp.watch_v2_legacy_authority(
  user_id uuid,
  participant_session_id text,
  source_generation bigint default 1
)
returns jsonb
language sql
as $$
  select pg_catalog.jsonb_build_object(
    'sub', user_id,
    'roomId', 'watch-v2-room',
    'participantSessionId', participant_session_id,
    'roomGeneration', 1,
    'sourceGeneration', source_generation,
    'iat', extract(epoch from pg_catalog.statement_timestamp())::bigint
  );
$$;

select is(
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'user_watch_settings',
        'watch_episode_progress',
        'watch_history_receipts',
        'watch_history_deletions',
        'recent_people_evidence'
      )
      and relation.relrowsecurity
  ),
  5::bigint,
  'all five v2-owned tables have RLS enabled'
);

select is(
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conname in (
      'watch_sessions_season_number_check',
      'watch_progress_checkpoints_season_number_check'
    )
      and constraint_row.convalidated
  ),
  2::bigint,
  'both low-lock season constraint rollouts finish fully validated'
);

select is(
  (
    select pg_catalog.count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'user_watch_settings',
        'watch_episode_progress',
        'watch_history_receipts',
        'watch_history_deletions',
        'recent_people_evidence'
      )
  ),
  0::bigint,
  'server-only v2 tables expose no browser RLS policies'
);

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.watch_episode_progress',
    'select'
  ),
  'authenticated cannot select v2 progress directly'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.apply_watch_progress_v2(uuid,jsonb,jsonb)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.apply_watch_progress_v2(uuid,jsonb,jsonb)',
    'execute'
  ),
  'only the service role can execute the progress RPC'
);

set role authenticated;
select throws_like(
  $$select pg_catalog.count(*) from public.watch_episode_progress$$,
  '%permission denied%',
  'an authenticated SQL role is denied direct v2 reads'
);
set role postgres;

set role service_role;
select lives_ok(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'solo-session-one',
        pg_catalog.clock_timestamp(),
        600
      ),
      null
    )
  $$,
  'service role can apply a solo progress event'
);
set role postgres;

select is(
  (
    select episode.current_time_seconds::text
    from public.watch_episode_progress as episode
    where episode.user_id = '11111111-1111-4111-8111-111111111111'
      and episode.episode_key = 'episode-one'
  ),
  '600'::text,
  'solo progress persists the canonical current time'
);

select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_receipts as receipt
    where receipt.user_id = '11111111-1111-4111-8111-111111111111'
      and receipt.client_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  1::bigint,
  'solo progress creates one durable receipt'
);

select is(
  (
    select receipt.expires_at - receipt.accepted_at
    from public.watch_history_receipts as receipt
    where receipt.user_id = '11111111-1111-4111-8111-111111111111'
      and receipt.client_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
  ),
  interval '14 days',
  'progress receipt retention is exactly fourteen days'
);

select is(
  (
    public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'solo-session-one',
        pg_catalog.clock_timestamp(),
        999
      ),
      null
    ) ->> 'acceptedEventId'
  ),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::text,
  'a duplicate event returns its stored canonical acknowledgement'
);

select is(
  (
    select episode.current_time_seconds::text
    from public.watch_episode_progress as episode
    where episode.user_id = '11111111-1111-4111-8111-111111111111'
      and episode.episode_key = 'episode-one'
  ),
  '600'::text,
  'a duplicate event cannot mutate progress'
);

select lives_ok(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
        'solo-session-one',
        pg_catalog.clock_timestamp(),
        900
      ),
      null
    )
  $$,
  'a later solo event is accepted'
);

select is(
  (
    select pg_catalog.concat(episode.server_order, ':', episode.current_time_seconds)
    from public.watch_episode_progress as episode
    where episode.user_id = '11111111-1111-4111-8111-111111111111'
      and episode.episode_key = 'episode-one'
  ),
  '2:900'::text,
  'server order advances exactly once for the later event'
);

insert into public.users (id, email, display_name)
values (
  '33333333-3333-4333-8333-333333333333',
  'watch-v2-page@example.test',
  'Watch V2 Page'
);

select lives_ok(
  $$
    select public.apply_watch_progress_v2(
      '33333333-3333-4333-8333-333333333333',
      pg_temp.watch_v2_event(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
        'page-session-one',
        pg_catalog.clock_timestamp(),
        400
      ),
      null
    );
    select public.apply_watch_progress_v2(
      '33333333-3333-4333-8333-333333333333',
      pg_temp.watch_v2_event(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8',
        'page-session-two',
        pg_catalog.clock_timestamp() - interval '1 minute',
        300,
        1,
        null,
        'episode-two',
        'series-two'
      ),
      null
    )
  $$,
  'a second title is available for server-bounded pagination'
);

select is(
  (
    public.list_watch_history_v2_page(
      '33333333-3333-4333-8333-333333333333',
      1,
      1,
      null,
      null
    ) ->> 'totalTitleCount'
  ),
  '2'::text,
  'the bounded history page reports the exact account title count'
);

select is(
  (
    public.list_watch_history_v2_page(
      '33333333-3333-4333-8333-333333333333',
      1,
      1,
      null,
      null
    ) ->> 'hasMore'
  ),
  'true'::text,
  'the bounded history page reports a following title page'
);

select is(
  (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(
      public.list_watch_history_v2_page(
        '33333333-3333-4333-8333-333333333333',
        1,
        1,
        null,
        null
      ) -> 'progressRows'
    ) as progress_row
  ),
  1::bigint,
  'the bounded history page transfers progress only for the selected title'
);

select is(
  (
    select pg_catalog.array_agg(field.key order by field.key)::text
    from pg_catalog.jsonb_object_keys(
      public.list_watch_history_v2_page(
        '33333333-3333-4333-8333-333333333333',
        1,
        1,
        null,
        null
      ) -> 'progressRows' -> 0
    ) as field(key)
  ),
  array[
    'artwork_url',
    'completed_at',
    'current_time_seconds',
    'duration',
    'episode_key',
    'episode_number',
    'episode_title',
    'history_generation',
    'item_kind',
    'latest_session_id',
    'observed_at',
    'progress',
    'provider',
    'season_key',
    'season_number',
    'season_title',
    'server_order',
    'source_url',
    'title',
    'title_key',
    'user_id'
  ]::text[]::text,
  'the bounded RPC exposes exactly the production progress-row fields'
);

select is(
  (
    public.list_watch_history_v2_page(
      '33333333-3333-4333-8333-333333333333',
      999,
      1,
      null,
      null
    ) ->> 'accountGeneration'
  ),
  '1'::text,
  'the bounded RPC returns the canonical statement-snapshot generation instead of trusting its hint'
);

select ok(
  pg_catalog.to_regclass('public.watch_history_title_summaries') is not null,
  'bounded reads have a canonical one-row-per-title projection'
);

select ok(
  (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = 'public.watch_history_title_summaries'::regclass
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.watch_history_title_summaries',
    'select'
  )
  and pg_catalog.has_table_privilege(
    'service_role',
    'public.watch_history_title_summaries',
    'select'
  )
  and not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'watch_history_title_summaries'
  ),
  'the title projection is RLS-enabled and service-role only'
);

select ok(
  pg_catalog.to_regclass('public.watch_history_user_session_summaries') is not null,
  'bounded session reads have a canonical one-row-per-user-session projection'
);

select ok(
  (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = pg_catalog.to_regclass(
      'public.watch_history_user_session_summaries'
    )
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    pg_catalog.to_regclass('public.watch_history_user_session_summaries'),
    'select'
  )
  and pg_catalog.has_table_privilege(
    'service_role',
    pg_catalog.to_regclass('public.watch_history_user_session_summaries'),
    'select'
  )
  and not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'watch_history_user_session_summaries'
  ),
  'the user-session projection is RLS-enabled and service-role only'
);

select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333333'
      and summary.history_generation = 1
  ),
  2::bigint,
  'the title projection contains exactly one row per observed title'
);

insert into public.watch_episode_progress (
  user_id,
  provider,
  title_key,
  episode_key,
  item_kind,
  title,
  episode_title,
  source_url,
  current_time_seconds,
  duration,
  progress,
  last_event_id,
  observed_at,
  server_order,
  history_generation,
  updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'crunchyroll',
    'A',
    'episode-uppercase',
    'series',
    'Uppercase',
    'Uppercase episode',
    'https://www.crunchyroll.com/watch/episode-uppercase/demo',
    101,
    1200,
    0.1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1',
    '2099-08-16 09:00:00+00',
    101,
    1,
    pg_catalog.clock_timestamp()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'crunchyroll',
    'a-',
    'episode-hyphen',
    'series',
    'Hyphen',
    'Hyphen episode',
    'https://www.crunchyroll.com/watch/episode-hyphen/demo',
    102,
    1200,
    0.1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2',
    '2099-08-16 09:00:00+00',
    102,
    1,
    pg_catalog.clock_timestamp()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'crunchyroll',
    'a_',
    'episode-underscore',
    'series',
    'Underscore',
    'Underscore episode',
    'https://www.crunchyroll.com/watch/episode-underscore/demo',
    103,
    1200,
    0.1,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3',
    '2099-08-16 09:00:00+00',
    103,
    1,
    pg_catalog.clock_timestamp()
  );

select is(
  (
    public.list_watch_history_v2_page(
      '33333333-3333-4333-8333-333333333333',
      1,
      1,
      null,
      null
    ) #>> '{progressRows,0,title_key}'
  ),
  'A'::text,
  'binary title ordering returns uppercase first at an equal timestamp'
);

select is(
  (
    public.list_watch_history_v2_page(
      '33333333-3333-4333-8333-333333333333',
      1,
      1,
      '2099-08-16 09:00:00+00',
      'crunchyroll:A'
    ) #>> '{progressRows,0,title_key}'
  ),
  'a-'::text,
  'page two continues after uppercase using binary cursor ordering'
);

select is(
  (
    public.list_watch_history_v2_page(
      '33333333-3333-4333-8333-333333333333',
      1,
      1,
      '2099-08-16 09:00:00+00',
      'crunchyroll:a-'
    ) #>> '{progressRows,0,title_key}'
  ),
  'a_'::text,
  'page three continues after hyphen without a skip or duplicate'
);

insert into public.watch_sessions (
  id,
  host_user_id,
  provider,
  item_key,
  item_kind,
  item_title,
  episode_key,
  episode_title,
  source_url,
  duration_seconds,
  current_time_seconds,
  progress,
  started_at,
  last_checkpoint_at,
  updated_at,
  schema_version,
  history_generation,
  client_session_key
)
select
  ('44444444-4444-4444-8444-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
  '33333333-3333-4333-8333-333333333333',
  'crunchyroll',
  'bounded-sessions',
  'series',
  'Bounded sessions',
  case when series.value % 2 = 0 then 'bounded-episode-two' else 'bounded-episode-one' end,
  'Bounded episode',
  'https://www.crunchyroll.com/watch/bounded/demo',
  1200,
  series.value,
  series.value / 1200.0,
  '2100-08-16 08:00:00+00'::timestamptz + series.value * interval '1 second',
  '2100-08-16 08:00:00+00'::timestamptz + series.value * interval '1 second',
  pg_catalog.clock_timestamp(),
  2,
  1,
  'bounded-session-' || series.value
from pg_catalog.generate_series(1, 25) as series(value);

insert into public.watch_session_participants (
  session_id,
  user_id,
  role,
  joined_at,
  current_time_seconds,
  progress,
  updated_at,
  schema_version
)
select
  session.id,
  '33333333-3333-4333-8333-333333333333',
  'host',
  session.started_at,
  session.current_time_seconds,
  session.progress,
  session.updated_at,
  2
from public.watch_sessions as session
where session.host_user_id = '33333333-3333-4333-8333-333333333333'
  and session.item_key = 'bounded-sessions';

-- A delayed/offline participant heartbeat is not canonical session activity.
-- Reverse participant timestamps so a participant-based candidate projection
-- would select sessions 1..20 instead of canonical checkpoints 6..25.
update public.watch_session_participants as participant
set updated_at = '2200-08-16 08:00:00+00'::timestamptz
  - (
    pg_catalog.regexp_replace(session.client_session_key, '^.*-', '')::integer
    * interval '1 second'
  )
from public.watch_sessions as session
where session.id = participant.session_id
  and session.host_user_id = '33333333-3333-4333-8333-333333333333'
  and session.item_key = 'bounded-sessions';

insert into public.watch_episode_progress (
  user_id,
  provider,
  title_key,
  episode_key,
  item_kind,
  title,
  episode_title,
  source_url,
  current_time_seconds,
  duration,
  progress,
  latest_session_id,
  last_event_id,
  observed_at,
  server_order,
  history_generation,
  updated_at
)
values
  (
    '33333333-3333-4333-8333-333333333333',
    'crunchyroll',
    'bounded-sessions',
    'bounded-episode-one',
    'series',
    'Bounded sessions',
    'Bounded episode one',
    'https://www.crunchyroll.com/watch/bounded-one/demo',
    100,
    1200,
    0.1,
    '44444444-4444-4444-8444-000000000001',
    '55555555-5555-4555-8555-000000000001',
    '2100-08-16 09:00:00+00',
    201,
    1,
    pg_catalog.clock_timestamp()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'crunchyroll',
    'bounded-sessions',
    'bounded-episode-two',
    'series',
    'Bounded sessions',
    'Bounded episode two',
    'https://www.crunchyroll.com/watch/bounded-two/demo',
    200,
    1200,
    0.2,
    '44444444-4444-4444-8444-000000000002',
    '55555555-5555-4555-8555-000000000002',
    '2100-08-16 09:00:00+00',
    202,
    1,
    pg_catalog.clock_timestamp()
  );

select is(
  (
    select pg_catalog.jsonb_array_length(page.value -> 'sessionIds')
    from (
      select public.list_watch_history_v2_page(
        '33333333-3333-4333-8333-333333333333',
        1,
        1,
        null,
        null
      ) as value
    ) as page
  ),
  22,
  'session enrichment is latest 20 per title plus each visible episode latest session'
);

select is(
  (
    select pg_catalog.string_agg(session.value, ',' order by session.value)
    from pg_catalog.jsonb_array_elements_text(
      public.list_watch_history_v2_page(
        '33333333-3333-4333-8333-333333333333',
        1,
        1,
        null,
        null
      ) -> 'sessionIds'
    ) as session(value)
  ),
  '44444444-4444-4444-8444-000000000001,44444444-4444-4444-8444-000000000002,44444444-4444-4444-8444-000000000006,44444444-4444-4444-8444-000000000007,44444444-4444-4444-8444-000000000008,44444444-4444-4444-8444-000000000009,44444444-4444-4444-8444-000000000010,44444444-4444-4444-8444-000000000011,44444444-4444-4444-8444-000000000012,44444444-4444-4444-8444-000000000013,44444444-4444-4444-8444-000000000014,44444444-4444-4444-8444-000000000015,44444444-4444-4444-8444-000000000016,44444444-4444-4444-8444-000000000017,44444444-4444-4444-8444-000000000018,44444444-4444-4444-8444-000000000019,44444444-4444-4444-8444-000000000020,44444444-4444-4444-8444-000000000021,44444444-4444-4444-8444-000000000022,44444444-4444-4444-8444-000000000023,44444444-4444-4444-8444-000000000024,44444444-4444-4444-8444-000000000025'::text,
  'delayed participant writes cannot displace the latest 20 canonical session checkpoints'
);

update public.watch_sessions
set last_checkpoint_at = '2201-08-16 08:00:00+00'
where id = '44444444-4444-4444-8444-000000000001';

select is(
  (
    select summary.last_watched_at
    from public.watch_history_user_session_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333333'
      and summary.session_id = '44444444-4444-4444-8444-000000000001'
  ),
  '2201-08-16 08:00:00+00'::timestamptz,
  'session checkpoint updates maintain the canonical projected ordering timestamp'
);

insert into public.watch_sessions (
  id,
  host_user_id,
  provider,
  item_key,
  item_kind,
  item_title,
  episode_key,
  episode_title,
  source_url,
  started_at,
  last_checkpoint_at,
  updated_at,
  schema_version,
  history_generation,
  room_generation,
  source_generation
)
values (
  '44444444-4444-4444-8444-999999999999',
  '33333333-3333-4333-8333-333333333333',
  'crunchyroll',
  'bounded-sessions',
  'series',
  'Bounded sessions tombstone',
  'bounded-tombstone-episode',
  'Bounded tombstone episode',
  'https://www.crunchyroll.com/watch/bounded-tombstone/demo',
  '2202-08-16 08:00:00+00',
  '2202-08-16 08:00:00+00',
  '2202-08-16 08:00:00+00',
  2,
  1,
  99,
  99
);

insert into public.watch_session_participants (
  session_id,
  user_id,
  role,
  joined_at,
  updated_at,
  schema_version
)
values (
  '44444444-4444-4444-8444-999999999999',
  '33333333-3333-4333-8333-333333333333',
  'host',
  '2202-08-16 08:00:00+00',
  '2202-08-16 08:00:00+00',
  2
);

select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_user_session_summaries as summary
    where summary.session_id = '44444444-4444-4444-8444-999999999999'
  ),
  0::bigint,
  'roomless shared tombstones are excluded from the user-session projection'
);

select is(
  (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements_text(
      public.list_watch_history_v2_page(
        '33333333-3333-4333-8333-333333333333',
        1,
        1,
        null,
        null
      ) -> 'sessionIds'
    ) as session(value)
    where session.value = '44444444-4444-4444-8444-999999999999'
  ),
  0::bigint,
  'roomless shared tombstones cannot consume a bounded session candidate slot'
);

insert into public.users (id, email, display_name)
values
  (
    '66666666-6666-4666-8666-666666666666',
    'watch-v2-generation-host@example.test',
    'Watch V2 Generation Host'
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    'watch-v2-generation-viewer@example.test',
    'Watch V2 Generation Viewer'
  );

insert into public.user_watch_settings (user_id, history_generation)
values
  ('66666666-6666-4666-8666-666666666666', 1),
  ('77777777-7777-4777-8777-777777777777', 2)
on conflict (user_id) do update set
  history_generation = excluded.history_generation;

insert into public.rooms (
  room_id,
  host_user_id,
  status,
  created_at,
  source_url,
  title
)
values (
  'watch-v2-generation-room',
  '66666666-6666-4666-8666-666666666666',
  'live',
  '2101-08-16 08:00:00+00',
  'https://www.crunchyroll.com/watch/generation/demo',
  'Generation Room'
);

insert into public.room_members (room_id, user_id, joined_at)
values (
  'watch-v2-generation-room',
  '77777777-7777-4777-8777-777777777777',
  '2101-08-16 08:00:00+00'
);

insert into public.watch_sessions (
  id,
  room_id,
  host_user_id,
  provider,
  item_key,
  item_kind,
  item_title,
  episode_key,
  episode_title,
  source_url,
  duration_seconds,
  current_time_seconds,
  progress,
  started_at,
  last_checkpoint_at,
  updated_at,
  schema_version,
  history_generation,
  room_generation,
  source_generation
)
select
  ('66666666-6666-4666-8666-' || pg_catalog.lpad(series.value::text, 12, '0'))::uuid,
  'watch-v2-generation-room',
  '66666666-6666-4666-8666-666666666666',
  'crunchyroll',
  'generation-title',
  'series',
  'Generation title',
  'generation-episode-' || series.value,
  'Generation episode ' || series.value,
  'https://www.crunchyroll.com/watch/generation-' || series.value || '/demo',
  1200,
  series.value * 100,
  series.value / 10.0,
  '2101-08-16 08:00:00+00'::timestamptz + series.value * interval '1 minute',
  '2101-08-16 08:00:00+00'::timestamptz + series.value * interval '1 minute',
  '2101-08-16 08:00:00+00'::timestamptz + series.value * interval '1 minute',
  2,
  1,
  1,
  series.value
from pg_catalog.generate_series(1, 3) as series(value);

insert into public.watch_session_participants (
  session_id,
  user_id,
  role,
  joined_at,
  current_time_seconds,
  progress,
  updated_at,
  schema_version
)
select
  session.id,
  participant.user_id,
  participant.role,
  session.started_at,
  session.current_time_seconds,
  session.progress,
  session.last_checkpoint_at,
  2
from public.watch_sessions as session
cross join (
  values
    ('66666666-6666-4666-8666-666666666666'::uuid, 'host'::text),
    ('77777777-7777-4777-8777-777777777777'::uuid, 'viewer'::text)
) as participant(user_id, role)
where session.room_id = 'watch-v2-generation-room';

insert into public.watch_episode_progress (
  user_id,
  provider,
  title_key,
  episode_key,
  item_kind,
  title,
  episode_title,
  source_url,
  current_time_seconds,
  duration,
  progress,
  last_event_id,
  observed_at,
  server_order,
  history_generation,
  updated_at
)
values (
  '77777777-7777-4777-8777-777777777777',
  'crunchyroll',
  'generation-title',
  'generation-viewer-episode',
  'series',
  'Generation title',
  'Generation viewer episode',
  'https://www.crunchyroll.com/watch/generation-viewer/demo',
  400,
  1200,
  0.3,
  '77777777-7777-4777-8777-777777777701',
  '2101-08-16 09:00:00+00',
  1,
  2,
  pg_catalog.clock_timestamp()
);

select is(
  (
    select pg_catalog.string_agg(session.value, ',' order by session.value)
    from pg_catalog.jsonb_array_elements_text(
      public.list_watch_history_v2_page(
        '77777777-7777-4777-8777-777777777777',
        2,
        1,
        null,
        null
      ) -> 'sessionIds'
    ) as session(value)
  ),
  '66666666-6666-4666-8666-000000000001,66666666-6666-4666-8666-000000000002,66666666-6666-4666-8666-000000000003'::text,
  'viewer generation does not filter host-owned shared session generations'
);

select is(
  (
    public.delete_watch_history_v2(
      '77777777-7777-4777-8777-777777777777',
      pg_catalog.jsonb_build_object(
        'schemaVersion', 2,
        'clientMutationId', '77777777-7777-4777-8777-777777777702',
        'accountGeneration', 2,
        'requestedAt', pg_catalog.clock_timestamp(),
        'target', pg_catalog.jsonb_build_object('scope', 'all')
      )
    ) ->> 'accountGeneration'
  ),
  '3'::text,
  'viewer full clear advances only the viewer generation'
);

select is(
  (
    select pg_catalog.concat(
      pg_catalog.count(*) filter (
        where summary.user_id = '77777777-7777-4777-8777-777777777777'
      ),
      ':',
      pg_catalog.count(*) filter (
        where summary.user_id = '66666666-6666-4666-8666-666666666666'
      )
    )
    from public.watch_history_user_session_summaries as summary
    where summary.session_id in (
      '66666666-6666-4666-8666-000000000001',
      '66666666-6666-4666-8666-000000000002',
      '66666666-6666-4666-8666-000000000003'
    )
  ),
  '0:3'::text,
  'viewer full clear removes only viewer session projections and retains host rows'
);

delete from public.rooms where room_id = 'watch-v2-generation-room';
delete from public.users
where id in (
  '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777'
);

delete from public.watch_episode_progress
where user_id = '33333333-3333-4333-8333-333333333333'
  and provider = 'crunchyroll'
  and title_key = 'bounded-sessions'
  and episode_key = 'bounded-episode-one';

select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333333'
      and summary.history_generation = 1
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-sessions'
  ),
  1::bigint,
  'deleting one episode transactionally retains its title projection'
);

delete from public.watch_episode_progress
where user_id = '33333333-3333-4333-8333-333333333333'
  and provider = 'crunchyroll'
  and title_key = 'bounded-sessions'
  and episode_key = 'bounded-episode-two';

select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_title_summaries as summary
    where summary.user_id = '33333333-3333-4333-8333-333333333333'
      and summary.history_generation = 1
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'bounded-sessions'
  ),
  0::bigint,
  'deleting the final episode transactionally removes its title projection'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.list_watch_history_v2_page(uuid,bigint,integer,timestamptz,text)',
    'EXECUTE'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.list_watch_history_v2_page(uuid,bigint,integer,timestamptz,text)',
    'EXECUTE'
  ),
  'only the service role can execute the bounded history page RPC'
);

delete from public.users
where id = '33333333-3333-4333-8333-333333333333';

create or replace function pg_temp.watch_v2_force_receipt_failure()
returns trigger
language plpgsql
as $$
begin
  raise exception 'watch_v2_forced_receipt_failure';
end;
$$;

create trigger watch_v2_force_receipt_failure
before insert on public.watch_history_receipts
for each row
when (new.user_id = '11111111-1111-4111-8111-111111111111'::uuid)
execute function pg_temp.watch_v2_force_receipt_failure();

select throws_like(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9',
        'rollback-session',
        pg_catalog.clock_timestamp(),
        450,
        1,
        null,
        'rollback-episode'
      ),
      null
    )
  $$,
  '%watch_v2_forced_receipt_failure%',
  'a late receipt failure aborts the entire progress transaction'
);

drop trigger watch_v2_force_receipt_failure on public.watch_history_receipts;

select is(
  (
    select pg_catalog.count(*)
    from public.watch_episode_progress as episode
    where episode.user_id = '11111111-1111-4111-8111-111111111111'
      and episode.episode_key = 'rollback-episode'
  ),
  0::bigint,
  'a late failure rolls back the canonical progress mutation'
);

select is(
  (
    select summary.last_watched_at::text
    from public.watch_history_title_summaries as summary
    where summary.user_id = '11111111-1111-4111-8111-111111111111'
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'series-one'
  ),
  (
    select pg_catalog.max(progress.observed_at)::text
    from public.watch_episode_progress as progress
    where progress.user_id = '11111111-1111-4111-8111-111111111111'
      and progress.provider = 'crunchyroll'
      and progress.title_key = 'series-one'
  ),
  'a late failure also rolls back the title projection timestamp'
);

select is(
  (
    select pg_catalog.concat(settings.next_server_order, ':', pg_catalog.count(session.id))
    from public.user_watch_settings as settings
    left join public.watch_sessions as session
      on session.host_user_id = settings.user_id
      and session.episode_key = 'rollback-episode'
    where settings.user_id = '11111111-1111-4111-8111-111111111111'
    group by settings.next_server_order
  ),
  '2:0'::text,
  'a late failure rolls back server ordering and session creation'
);

select is(
  (
    public.delete_watch_history_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_catalog.jsonb_build_object(
        'schemaVersion', 2,
        'clientMutationId', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        'accountGeneration', 1,
        'requestedAt', pg_catalog.clock_timestamp(),
        'target', pg_catalog.jsonb_build_object(
          'scope', 'episode',
          'provider', 'crunchyroll',
          'titleKey', 'series-one',
          'episodeKey', 'episode-one'
        )
      )
    ) #>> '{target,scope}'
  ),
  'episode'::text,
  'episode deletion returns its canonical target'
);

select is(
  (
    select pg_catalog.count(*)
    from public.watch_episode_progress as episode
    where episode.user_id = '11111111-1111-4111-8111-111111111111'
  ),
  0::bigint,
  'episode deletion removes only the user progress row'
);

select throws_like(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
        'solo-session-after-delete',
        '2026-08-14T00:00:00Z',
        300
      ),
      null
    )
  $$,
  '%watch_history_deleted%',
  'the deletion fence rejects an older offline event'
);

select pg_catalog.pg_sleep(0.01);
select lives_ok(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
        'solo-session-after-delete',
        pg_catalog.clock_timestamp() + interval '1 hour',
        300
      ),
      null
    )
  $$,
  'a genuinely later event recreates episode history without clearing its fence'
);

select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_deletions as deletion
    where deletion.user_id = '11111111-1111-4111-8111-111111111111'
      and deletion.scope = 'episode'
  ),
  1::bigint,
  'accepted playback preserves the deletion fence'
);

select is(
  (
    public.set_watch_preferences_v2(
      '11111111-1111-4111-8111-111111111111',
      '{"youtubeHistoryEnabled":true}'::jsonb
    ) #>> '{preferences,youtubeHistoryEnabled}'
  ),
  'true'::text,
  'preferences RPC persists the YouTube opt-in'
);

insert into public.rooms (
  room_id,
  host_user_id,
  status,
  created_at,
  source_url,
  title
)
values (
  'watch-v2-room',
  '11111111-1111-4111-8111-111111111111',
  'live',
  pg_catalog.clock_timestamp() - interval '2 days',
  'https://www.crunchyroll.com/watch/episode-one/demo',
  'Watch V2 Room'
);

insert into public.room_members (room_id, user_id, joined_at)
values (
  'watch-v2-room',
  '22222222-2222-4222-8222-222222222222',
  pg_catalog.clock_timestamp() - interval '30 minutes'
);

select lives_ok(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc0',
        'host-participant-session',
        pg_catalog.clock_timestamp(),
        390,
        1,
        pg_temp.watch_v2_shared_room('host-participant-session')
      ),
      pg_temp.watch_v2_legacy_authority(
        '11111111-1111-4111-8111-111111111111',
        'host-participant-session'
      )
    )
  $$,
  'migration-first accepts a fresh old-runtime authority with the same derived expiry'
);

select lives_ok(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'host-participant-session',
        pg_catalog.clock_timestamp(),
        400,
        1,
        pg_temp.watch_v2_shared_room('host-participant-session')
      ),
      pg_temp.watch_v2_authority(
        '11111111-1111-4111-8111-111111111111',
        'host-participant-session'
      )
    )
  $$,
  'the host creates the authoritative shared session'
);

select is(
  (select pg_catalog.count(*) from public.recent_people_evidence),
  0::bigint,
  'one shared writer alone cannot create Recent People evidence'
);

select lives_ok(
  $$
    select public.apply_watch_progress_v2(
      '22222222-2222-4222-8222-222222222222',
      pg_temp.watch_v2_event(
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
        'viewer-participant-session',
        pg_catalog.clock_timestamp(),
        420,
        1,
        pg_temp.watch_v2_shared_room('viewer-participant-session')
      ),
      pg_temp.watch_v2_authority(
        '22222222-2222-4222-8222-222222222222',
        'viewer-participant-session'
      )
    )
  $$,
  'a durable room member can attach to the host session'
);

select is(
  (
    select pg_catalog.count(*)
    from public.watch_session_participants as participant
    join public.watch_sessions as session on session.id = participant.session_id
    where session.room_id = 'watch-v2-room'
      and session.schema_version = 2
      and participant.schema_version = 2
  ),
  2::bigint,
  'the shared session contains exactly the two accepted writers'
);

select is(
  (select pg_catalog.count(*) from public.recent_people_evidence),
  2::bigint,
  'two accepted shared writers derive both directional evidence rows'
);

select throws_like(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc7',
        'host-participant-session',
        pg_catalog.clock_timestamp(),
        425,
        1,
        pg_temp.watch_v2_shared_room('host-participant-session')
      ),
      pg_temp.watch_v2_authority(
        '11111111-1111-4111-8111-111111111111',
        'host-participant-session'
      ) || pg_catalog.jsonb_build_object(
        'iat', pg_catalog.floor(extract(epoch from pg_catalog.transaction_timestamp()))::bigint - 86400,
        'exp', pg_catalog.floor(extract(epoch from pg_catalog.transaction_timestamp()))::bigint
      )
    )
  $$,
  '%watch_history_authority_expired%',
  'authority rejects exactly at its exp boundary'
);

select lives_ok(
  $$
    do $watch_v2_boundary$
    begin
      perform public.apply_watch_progress_v2(
        '11111111-1111-4111-8111-111111111111',
        pg_temp.watch_v2_event(
          'cccccccc-cccc-4ccc-8ccc-ccccccccccc8',
          'host-participant-session',
          pg_catalog.clock_timestamp(),
          425,
          1,
          pg_temp.watch_v2_shared_room('host-participant-session')
        ),
        pg_temp.watch_v2_authority(
          '11111111-1111-4111-8111-111111111111',
          'host-participant-session'
        ) || pg_catalog.jsonb_build_object(
          'iat', pg_catalog.floor(extract(epoch from pg_catalog.transaction_timestamp()))::bigint - 86399,
          'exp', pg_catalog.floor(extract(epoch from pg_catalog.transaction_timestamp()))::bigint + 1
        )
      );
      raise exception 'watch_v2_boundary_rollback';
    exception when raise_exception then
      if sqlerrm <> 'watch_v2_boundary_rollback' then
        raise;
      end if;
    end;
    $watch_v2_boundary$
  $$,
  'authority remains valid in the adjacent second before exp'
);

select is(
  (
    public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        'host-participant-session',
        pg_catalog.clock_timestamp(),
        999,
        1,
        pg_temp.watch_v2_shared_room('host-participant-session')
      ),
      pg_temp.watch_v2_authority(
        '11111111-1111-4111-8111-111111111111',
        'host-participant-session'
      ) || pg_catalog.jsonb_build_object(
        'iat', extract(epoch from pg_catalog.statement_timestamp())::bigint - 86401,
        'exp', extract(epoch from pg_catalog.statement_timestamp())::bigint - 1
      )
    ) ->> 'acceptedEventId'
  ),
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'::text,
  'an already-receipted duplicate succeeds after its authority expires'
);

create temporary table watch_v2_recent_people_before_expired
as
select
  evidence.user_id,
  evidence.other_user_id,
  evidence.last_room_id,
  evidence.last_watched_at
from public.recent_people_evidence as evidence;

select throws_like(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc4',
        'host-participant-session',
        pg_catalog.clock_timestamp(),
        999,
        1,
        pg_temp.watch_v2_shared_room('host-participant-session')
      ),
      pg_temp.watch_v2_authority(
        '11111111-1111-4111-8111-111111111111',
        'host-participant-session'
      ) || pg_catalog.jsonb_build_object(
        'iat', extract(epoch from pg_catalog.statement_timestamp())::bigint - 86401,
        'exp', extract(epoch from pg_catalog.statement_timestamp())::bigint - 1
      )
    )
  $$,
  '%watch_history_authority_expired%',
  'an expired authority cannot authorize a new shared event'
);

select is(
  (
    select pg_catalog.concat(
      episode.current_time_seconds,
      ':',
      (
        select pg_catalog.count(*)
        from public.watch_session_participants as participant
        inner join public.watch_sessions as session on session.id = participant.session_id
        where session.room_id = 'watch-v2-room'
          and session.schema_version = 2
          and participant.schema_version = 2
      ),
      ':',
      (select pg_catalog.count(*) from public.recent_people_evidence)
    )
    from public.watch_episode_progress as episode
    where episode.user_id = '11111111-1111-4111-8111-111111111111'
      and episode.episode_key = 'episode-one'
  ),
  '400:2:2'::text,
  'expired replay fails before progress, participant, or Recent People mutation'
);

select is(
  (
    select pg_catalog.count(*)
    from (
      (
        select user_id, other_user_id, last_room_id, last_watched_at
        from public.recent_people_evidence
        except all
        select user_id, other_user_id, last_room_id, last_watched_at
        from watch_v2_recent_people_before_expired
      )
      union all
      (
        select user_id, other_user_id, last_room_id, last_watched_at
        from watch_v2_recent_people_before_expired
        except all
        select user_id, other_user_id, last_room_id, last_watched_at
        from public.recent_people_evidence
      )
    ) as directional_difference
  ),
  0::bigint,
  'expired rejection preserves both exact directional Recent People rows'
);

select is(
  (
    select pg_catalog.count(*)
    from public.list_recent_people_evidence_v2(
      '11111111-1111-4111-8111-111111111111'
    ) as evidence
    inner join public.recent_people_evidence as stored
      on stored.user_id = '11111111-1111-4111-8111-111111111111'
      and stored.other_user_id = evidence.other_user_id
      and stored.last_room_id = evidence.last_room_id
      and stored.last_watched_at = evidence.last_watched_at
    where evidence.other_user_id = '22222222-2222-4222-8222-222222222222'
      and evidence.last_room_id = 'watch-v2-room'
  ),
  1::bigint,
  'Recent People reads the exact pair-owned v2 evidence row'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.list_recent_people_evidence_v2(uuid)',
    'EXECUTE'
  ),
  'service_role can execute the v2 Recent People evidence function'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.list_recent_people_evidence_v2(uuid)',
    'EXECUTE'
  ),
  'anon cannot execute the v2 Recent People evidence function'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.list_recent_people_evidence_v2(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute the v2 Recent People evidence function'
);

select throws_like(
  $$
    select public.apply_watch_progress_v2(
      '22222222-2222-4222-8222-222222222222',
      pg_temp.watch_v2_event(
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc3',
        'viewer-mismatch-session',
        pg_catalog.clock_timestamp(),
        430,
        1,
        pg_temp.watch_v2_shared_room('viewer-mismatch-session', 2)
      ),
      pg_temp.watch_v2_authority(
        '22222222-2222-4222-8222-222222222222',
        'viewer-mismatch-session',
        2
      )
    )
  $$,
  '%watch_history_shared_session_pending%',
  'a viewer cannot create a new shared source generation before its host'
);

update public.rooms
set ended_at = pg_catalog.statement_timestamp() - interval '5 minutes'
where room_id = 'watch-v2-room';

select lives_ok(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc5',
        'host-participant-session',
        pg_catalog.statement_timestamp(),
        450,
        1,
        pg_temp.watch_v2_shared_room('host-participant-session'),
        'episode-one',
        'series-one',
        'room_end'
      ),
      pg_temp.watch_v2_authority(
        '11111111-1111-4111-8111-111111111111',
        'host-participant-session'
      ) || pg_catalog.jsonb_build_object(
        'iat', extract(epoch from pg_catalog.statement_timestamp())::bigint - 600,
        'exp', extract(epoch from pg_catalog.statement_timestamp())::bigint + 85800,
        'jti', '88888888-8888-4888-8888-888888888888'
      )
    )
  $$,
  'a terminal attested before room end remains valid when delivered later inside grace'
);

create temporary table watch_v2_recent_people_before_post_end
as
select
  evidence.user_id,
  evidence.other_user_id,
  evidence.last_room_id,
  evidence.last_watched_at
from public.recent_people_evidence as evidence;

select throws_like(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc6',
        'host-participant-session',
        pg_catalog.statement_timestamp(),
        500,
        1,
        pg_temp.watch_v2_shared_room('host-participant-session')
      ),
      pg_temp.watch_v2_authority(
        '11111111-1111-4111-8111-111111111111',
        'host-participant-session'
      )
    )
  $$,
  '%watch_history_authority_after_end%',
  'authority issued after room end cannot authorize delayed shared work'
);

select is(
  (
    select pg_catalog.concat(
      episode.current_time_seconds,
      ':',
      (select pg_catalog.count(*) from public.recent_people_evidence)
    )
    from public.watch_episode_progress as episode
    where episode.user_id = '11111111-1111-4111-8111-111111111111'
      and episode.episode_key = 'episode-one'
  ),
  '450:2'::text,
  'post-end rejection cannot mutate progress or refresh Recent People'
);

select is(
  (
    select pg_catalog.count(*)
    from (
      (
        select user_id, other_user_id, last_room_id, last_watched_at
        from public.recent_people_evidence
        except all
        select user_id, other_user_id, last_room_id, last_watched_at
        from watch_v2_recent_people_before_post_end
      )
      union all
      (
        select user_id, other_user_id, last_room_id, last_watched_at
        from watch_v2_recent_people_before_post_end
        except all
        select user_id, other_user_id, last_room_id, last_watched_at
        from public.recent_people_evidence
      )
    ) as directional_difference
  ),
  0::bigint,
  'post-end rejection preserves both exact directional Recent People rows'
);

select is(
  (
    public.delete_watch_history_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_catalog.jsonb_build_object(
        'schemaVersion', 2,
        'clientMutationId', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
        'accountGeneration', 1,
        'requestedAt', pg_catalog.clock_timestamp(),
        'target', pg_catalog.jsonb_build_object('scope', 'all')
      )
    ) ->> 'accountGeneration'
  ),
  '2'::text,
  'full clear atomically advances the account generation'
);

select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_title_summaries as summary
    where summary.user_id = '11111111-1111-4111-8111-111111111111'
  ),
  0::bigint,
  'full clear transactionally removes every current-generation title projection'
);

select throws_like(
  $$
    select public.apply_watch_progress_v2(
      '11111111-1111-4111-8111-111111111111',
      pg_temp.watch_v2_event(
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
        'stale-generation-session',
        pg_catalog.clock_timestamp(),
        100,
        1
      ),
      null
    )
  $$,
  '%watch_history_generation_mismatch%',
  'full clear permanently rejects events from the old generation'
);

select lives_ok(
  $$
    delete from public.rooms
    where room_id = 'watch-v2-room'
  $$,
  'hard room deletion invalidates authority without violating v2 session constraints'
);

select is(
  (
    select pg_catalog.count(*)
    from public.watch_sessions as session
    where session.schema_version = 2
      and session.room_id is null
      and session.client_session_key is null
      and session.room_generation is not null
      and session.source_generation is not null
  ),
  1::bigint,
  'hard room deletion leaves only an internal shared-session tombstone'
);

delete from public.users
where id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);

select is(
  (
    select pg_catalog.count(*)
    from public.watch_history_receipts as receipt
    where receipt.user_id in (
      '11111111-1111-4111-8111-111111111111'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid
    )
  ),
  0::bigint,
  'account deletion cascades all v2 receipts'
);

select ok(
  pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        'public.list_watch_history_v2_page(uuid,bigint,integer,timestamp with time zone,text)'::regprocedure
      )
    ),
    'page_titles as materialized'
  ) > 0
  and pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        'public.list_watch_history_v2_page(uuid,bigint,integer,timestamp with time zone,text)'::regprocedure
      )
    ),
    'all_titles as materialized'
  ) = 0
  and pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        'public.list_watch_history_v2_page(uuid,bigint,integer,timestamp with time zone,text)'::regprocedure
      )
    ),
    'eligible_titles as'
  ) = 0,
  'title keyset pagination limits a direct projection query before downstream work'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = 'public.watch_episode_progress'::regclass
      and trigger.tgname = 'sync_watch_history_title_summary_delete_v2'
      and not trigger.tgisinternal
      and pg_catalog.strpos(
        pg_catalog.pg_get_triggerdef(trigger.oid),
        'FOR EACH STATEMENT'
      ) > 0
      and pg_catalog.strpos(
        pg_catalog.pg_get_triggerdef(trigger.oid),
        'REFERENCING OLD TABLE AS deleted_progress'
      ) > 0
  ),
  'episode deletes recompute each affected title through one statement trigger'
);

select ok(
  pg_catalog.to_regclass('public.idx_watch_history_user_session_summaries_recent') is not null
  and pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_indexdef(
        pg_catalog.to_regclass(
          'public.idx_watch_history_user_session_summaries_recent'
        )
      )
    ),
    '(user_id, history_generation, provider, title_key, last_watched_at desc, session_id)'
  ) > 0
  and pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        'public.list_watch_history_v2_page(uuid,bigint,integer,timestamp with time zone,text)'::regprocedure
      )
    ),
    'from public.watch_history_user_session_summaries as summary'
  ) > 0
  and pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        'public.list_watch_history_v2_page(uuid,bigint,integer,timestamp with time zone,text)'::regprocedure
      )
    ),
    'cross join lateral'
  ) > 0
  and pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        'public.list_watch_history_v2_page(uuid,bigint,integer,timestamp with time zone,text)'::regprocedure
      )
    ),
    'session.history_generation ='
  ) = 0,
  'session enrichment uses a requester-leading indexed projection without host-generation filtering'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_trigger as trigger
    where trigger.tgrelid = 'public.watch_sessions'::regclass
      and trigger.tgname = 'sync_watch_history_session_summaries_v2'
      and not trigger.tgisinternal
  ),
  'canonical session checkpoint and identity writes maintain user-session summaries'
);

select ok(
  pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_functiondef(
        'public.list_watch_history_v2_page(uuid,bigint,integer,timestamp with time zone,text)'::regprocedure
      )
    ),
    'summary.last_watched_at <= p_cursor_watched_at'
  ) > 0,
  'deep title cursors expose an indexable timestamp upper bound'
);

insert into public.users (id, email, display_name)
values (
  '99999999-9999-4999-8999-999999999999',
  'watch-v2-deep-cursor@example.test',
  'Watch V2 Deep Cursor'
);

insert into public.user_watch_settings (user_id)
values ('99999999-9999-4999-8999-999999999999');

insert into public.watch_episode_progress (
  user_id,
  provider,
  title_key,
  episode_key,
  item_kind,
  title,
  episode_title,
  source_url,
  current_time_seconds,
  duration,
  progress,
  last_event_id,
  observed_at,
  server_order,
  history_generation,
  updated_at
)
select
  '99999999-9999-4999-8999-999999999999',
  'crunchyroll',
  'deep-title-' || pg_catalog.lpad(series.value::text, 3, '0'),
  'deep-episode-' || pg_catalog.lpad(series.value::text, 3, '0'),
  'series',
  'Deep title ' || series.value,
  'Deep episode ' || series.value,
  'https://www.crunchyroll.com/watch/deep-' || series.value || '/demo',
  100,
  1200,
  0.1,
  pg_catalog.md5('deep-' || series.value)::uuid,
  '2103-01-01 00:00:00+00'::timestamptz - series.value * interval '1 minute',
  series.value,
  1,
  pg_catalog.clock_timestamp()
from pg_catalog.generate_series(1, 130) as series(value);

select is(
  (
    select pg_catalog.string_agg(row.value ->> 'title_key', ',' order by row.ordinality)
    from pg_catalog.jsonb_array_elements(
      public.list_watch_history_v2_page(
        '99999999-9999-4999-8999-999999999999',
        1,
        3,
        '2103-01-01 00:00:00+00'::timestamptz - 100 * interval '1 minute',
        'crunchyroll:deep-title-100'
      ) -> 'progressRows'
    ) with ordinality as row(value, ordinality)
  ),
  'deep-title-101,deep-title-102,deep-title-103'::text,
  'a deep timestamp cursor returns the next exact title page without skips'
);

delete from public.users
where id = '99999999-9999-4999-8999-999999999999';

select finish();
