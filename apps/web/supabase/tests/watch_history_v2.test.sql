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
  episode_key text default 'episode-one'
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
    'titleKey', 'series-one',
    'itemKind', 'series',
    'title', 'Series One',
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
    'kind', 'heartbeat',
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
    'sub', user_id,
    'roomId', 'watch-v2-room',
    'participantSessionId', participant_session_id,
    'roomGeneration', 1,
    'sourceGeneration', source_generation,
    'iat', extract(epoch from pg_catalog.clock_timestamp())::bigint
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
  pg_catalog.clock_timestamp() - interval '1 hour',
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

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.list_recent_people_evidence(uuid)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.list_recent_people_evidence(uuid)',
    'execute'
  ),
  'only the service role can execute the v2 Recent People RPC'
);

set role service_role;
select is(
  (
    select pg_catalog.concat(evidence.other_user_id, ':', evidence.last_room_id)
    from public.list_recent_people_evidence(
      '11111111-1111-4111-8111-111111111111'
    ) as evidence
  ),
  '22222222-2222-4222-8222-222222222222:watch-v2-room'::text,
  'the cutover RPC returns only v2 two-writer evidence'
);
set role postgres;

insert into public.friendships (
  requester_user_id,
  addressee_user_id,
  status,
  responded_at
)
values (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  'accepted',
  pg_catalog.clock_timestamp()
);

select is(
  (
    select pg_catalog.count(*)
    from public.list_recent_people_evidence(
      '11111111-1111-4111-8111-111111111111'
    )
  ),
  0::bigint,
  'the cutover RPC excludes an existing friendship'
);

delete from public.friendships
where least(requester_user_id, addressee_user_id) =
    '11111111-1111-4111-8111-111111111111'::uuid
  and greatest(requester_user_id, addressee_user_id) =
    '22222222-2222-4222-8222-222222222222'::uuid;

insert into public.recent_people_hidden (user_id, hidden_user_id)
values (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
);

select is(
  (
    select pg_catalog.count(*)
    from public.list_recent_people_evidence(
      '11111111-1111-4111-8111-111111111111'
    )
  ),
  0::bigint,
  'the cutover RPC excludes a hidden recent person'
);

delete from public.recent_people_hidden
where user_id = '11111111-1111-4111-8111-111111111111'
  and hidden_user_id = '22222222-2222-4222-8222-222222222222';

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

select finish();
