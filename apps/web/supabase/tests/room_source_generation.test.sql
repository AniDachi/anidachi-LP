create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

begin;

set role postgres;
set search_path = public, extensions;
select no_plan();

select has_column(
  'public',
  'rooms',
  'source_provider',
  'rooms persist the pinned canonical source provider'
);

select has_column(
  'public',
  'rooms',
  'source_generation',
  'rooms persist a monotonic source generation'
);

select col_type_is(
  'public',
  'rooms',
  'source_provider',
  'text',
  'the room source provider uses the existing text-backed provider convention'
);

select col_type_is(
  'public',
  'rooms',
  'source_generation',
  'bigint',
  'the source generation can represent every JavaScript-safe positive integer'
);

select ok(
  (
    select not attribute.attnotnull
      and not attribute.atthasdef
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.rooms'::pg_catalog.regclass
      and attribute.attname = 'source_provider'
      and not attribute.attisdropped
  )
  and (
    select not attribute.attnotnull
      and not attribute.atthasdef
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.rooms'::pg_catalog.regclass
      and attribute.attname = 'source_generation'
      and not attribute.attisdropped
  ),
  'both additive source columns stay nullable and default-free for historical rooms'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.rooms'::pg_catalog.regclass
      and constraint_row.contype = 'c'
      and constraint_row.conname = 'rooms_source_tuple_check'
  ),
  'rooms enforce an all-null or fully populated source tuple'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.rooms'::pg_catalog.regclass
      and constraint_row.contype = 'c'
      and constraint_row.conname = 'rooms_source_url_canonical_check'
  ),
  'populated room sources enforce the narrow canonical provider URL forms'
);

select has_function(
  'public',
  'persist_room_source_v1',
  array['text', 'text', 'text', 'bigint'],
  'the additive monotonic room-source RPC exists'
);

select ok(
  (
    select not procedure.prosecdef
      and procedure.provolatile = 'v'
      and procedure.proconfig @> array['search_path=""']::text[]
      and procedure.proretset
      and pg_catalog.pg_get_function_result(procedure.oid)
        = 'TABLE(outcome text, source_generation bigint)'
    from pg_catalog.pg_proc as procedure
    where procedure.oid = pg_catalog.to_regprocedure(
      'public.persist_room_source_v1(text,text,text,bigint)'
    )
  ),
  'room-source persistence is a volatile security-invoker table RPC with an empty search_path'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.persist_room_source_v1(text,text,text,bigint)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'public',
    'public.persist_room_source_v1(text,text,text,bigint)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.persist_room_source_v1(text,text,text,bigint)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.persist_room_source_v1(text,text,text,bigint)',
    'execute'
  ),
  'only service_role can execute room-source persistence'
);

delete from public.room_members
where room_id in (
  'source-primary',
  'source-legacy',
  'source-ended',
  'source-youtube-boundary',
  'source-crunchyroll-boundary',
  'source-constraint'
);

delete from public.rooms
where host_user_id = '5a000000-0000-4000-8000-000000000001';

delete from public.users
where id = '5a000000-0000-4000-8000-000000000001';

insert into public.users (id, email, display_name)
values (
  '5a000000-0000-4000-8000-000000000001',
  'room-source-owner@example.test',
  'Room Source Owner'
);

insert into public.rooms (
  room_id,
  host_user_id,
  source_url,
  status
)
values
  (
    'source-primary',
    '5a000000-0000-4000-8000-000000000001',
    null,
    'live'
  ),
  (
    'source-legacy',
    '5a000000-0000-4000-8000-000000000001',
    'https://legacy.example.test/not-canonical',
    'lobby'
  ),
  (
    'source-ended',
    '5a000000-0000-4000-8000-000000000001',
    null,
    'ended'
  ),
  (
    'source-youtube-boundary',
    '5a000000-0000-4000-8000-000000000001',
    null,
    'lobby'
  ),
  (
    'source-crunchyroll-boundary',
    '5a000000-0000-4000-8000-000000000001',
    null,
    'lobby'
  ),
  (
    'source-constraint',
    '5a000000-0000-4000-8000-000000000001',
    null,
    'lobby'
  );

select is(
  (
    select pg_catalog.concat_ws(
      ':',
      coalesce(source_provider, '<null>'),
      coalesce(source_generation::text, '<null>'),
      source_url
    )
    from public.rooms
    where room_id = 'source-legacy'
  ),
  '<null>:<null>:https://legacy.example.test/not-canonical',
  'an old runtime row keeps its source URL without receiving a fabricated tuple'
);

select throws_like(
  $$
    update public.rooms
    set source_provider = 'youtube', source_generation = null
    where room_id = 'source-constraint'
  $$,
  '%rooms_source_tuple_check%',
  'the provider cannot be populated without a generation'
);

select throws_like(
  $$
    update public.rooms
    set source_provider = null, source_generation = 1
    where room_id = 'source-constraint'
  $$,
  '%rooms_source_tuple_check%',
  'the generation cannot be populated without a provider'
);

select throws_like(
  $$
    update public.rooms
    set source_provider = 'youtube', source_generation = 1, source_url = null
    where room_id = 'source-constraint'
  $$,
  '%rooms_source_tuple_check%',
  'a populated provider and generation require a source URL'
);

select throws_like(
  $$
    update public.rooms
    set
      source_provider = 'generic',
      source_generation = 1,
      source_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    where room_id = 'source-constraint'
  $$,
  '%rooms_source_tuple_check%',
  'the durable tuple rejects a provider outside the MVP pair'
);

select throws_like(
  $$
    update public.rooms
    set
      source_provider = 'youtube',
      source_generation = 0,
      source_url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    where room_id = 'source-constraint'
  $$,
  '%rooms_source_tuple_check%',
  'the durable tuple rejects a non-positive generation'
);

select throws_like(
  $$
    update public.rooms
    set
      source_provider = 'youtube',
      source_generation = 1,
      source_url = 'https://m.youtube.com/watch?v=dQw4w9WgXcQ'
    where room_id = 'source-constraint'
  $$,
  '%rooms_source_url_canonical_check%',
  'the durable tuple rejects a noncanonical YouTube host'
);

select throws_like(
  $$
    update public.rooms
    set
      source_provider = 'crunchyroll',
      source_generation = 1,
      source_url = 'https://www.crunchyroll.com/watch/GOLD22222/episode-two'
    where room_id = 'source-constraint'
  $$,
  '%rooms_source_url_canonical_check%',
  'the durable tuple rejects a noncanonical Crunchyroll slug path'
);

set role service_role;

select is(
  (
    select outcome || ':' || source_generation::text
    from public.persist_room_source_v1(
      'source-legacy',
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      2
    )
  ),
  'persisted:2',
  'the first valid callback populates a legacy null tuple'
);

select is(
  (
    select source_provider || ':' || source_generation::text || ':' || source_url
    from public.rooms
    where room_id = 'source-legacy'
  ),
  'youtube:2:https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'the legacy room stores the exact first canonical source tuple'
);

select is(
  (
    select outcome || ':' || source_generation::text
    from public.persist_room_source_v1(
      'source-primary',
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      2
    )
  ),
  'persisted:2',
  'a first live-room source callback is persisted'
);

select is(
  (
    select outcome || ':' || source_generation::text
    from public.persist_room_source_v1(
      'source-primary',
      'youtube',
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      3
    )
  ),
  'persisted:3',
  'a higher generation advances the same pinned provider'
);

select is(
  (
    select outcome || ':' || source_generation::text
    from public.persist_room_source_v1(
      'source-primary',
      'youtube',
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      3
    )
  ),
  'persisted:3',
  'an exact duplicate callback is idempotently acknowledged as persisted'
);

select is(
  (
    select outcome || ':' || source_generation::text
    from public.persist_room_source_v1(
      'source-primary',
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      2
    )
  ),
  'stale:2',
  'a lower generation is acknowledged as stale'
);

select is(
  (
    select source_provider || ':' || source_generation::text || ':' || source_url
    from public.rooms
    where room_id = 'source-primary'
  ),
  'youtube:3:https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  'a stale callback cannot mutate the newest durable tuple'
);

select throws_like(
  $$
    select *
    from public.persist_room_source_v1(
      'source-primary',
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      3
    )
  $$,
  '%room_source_generation_conflict%',
  'the same generation with a different URL is rejected'
);

select throws_like(
  $$
    select *
    from public.persist_room_source_v1(
      'source-primary',
      'crunchyroll',
      'https://www.crunchyroll.com/watch/GOLD22222',
      3
    )
  $$,
  '%room_source_generation_conflict%',
  'the same generation with a different provider is rejected as conflicting data'
);

select throws_like(
  $$
    select *
    from public.persist_room_source_v1(
      'source-primary',
      'crunchyroll',
      'https://www.crunchyroll.com/watch/GOLD22222',
      4
    )
  $$,
  '%room_source_provider_conflict%',
  'a higher generation cannot change the pinned provider'
);

select is(
  (
    select outcome || ':' || source_generation::text
    from public.persist_room_source_v1(
      'source-primary',
      'crunchyroll',
      'https://www.crunchyroll.com/watch/GOLD22222',
      1
    )
  ),
  'stale:1',
  'a lower generation stays stale even when its provider differs from the current tuple'
);

select throws_like(
  $$
    select *
    from public.persist_room_source_v1(
      'source-ended',
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      2
    )
  $$,
  '%room_source_ended%',
  'an ended room rejects source persistence'
);

select throws_like(
  $$
    select *
    from public.persist_room_source_v1(
      'source-missing',
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      2
    )
  $$,
  '%room_source_not_found%',
  'a missing room rejects source persistence'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 2) $$,
  '%room_source_invalid_input%',
  'an empty room id is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1(repeat('r', 129), 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 2) $$,
  '%room_source_invalid_input%',
  'a room id above the protocol bound is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'generic', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 4) $$,
  '%room_source_invalid_input%',
  'an unsupported provider is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'YouTube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 4) $$,
  '%room_source_invalid_input%',
  'a provider with noncanonical casing is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'youtube', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 4) $$,
  '%room_source_invalid_input%',
  'a noncanonical YouTube source URL is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share', 4) $$,
  '%room_source_invalid_input%',
  'a YouTube tracking query is rejected instead of recanonicalized in SQL'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'crunchyroll', 'https://www.crunchyroll.com/watch/GOLD22222/episode-two', 4) $$,
  '%room_source_invalid_input%',
  'a Crunchyroll slug path is rejected instead of recanonicalized in SQL'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'youtube', 'https://www.youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 4) $$,
  '%room_source_invalid_input%',
  'a deceptive provider hostname is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'youtube', 'http://www.youtube.com/watch?v=dQw4w9WgXcQ', 4) $$,
  '%room_source_invalid_input%',
  'an HTTP downgrade is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'youtube', 'https://www.youtube.com/watch?v=short', 4) $$,
  '%room_source_invalid_input%',
  'a YouTube id below the canonical lower bound is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'youtube', 'https://www.youtube.com/watch?v=' || repeat('a', 393), 4) $$,
  '%room_source_invalid_input%',
  'a YouTube id above the descriptor bound is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'crunchyroll', 'https://www.crunchyroll.com/watch/' || repeat('b', 383), 4) $$,
  '%room_source_invalid_input%',
  'a Crunchyroll id above the descriptor bound is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 0) $$,
  '%room_source_invalid_input%',
  'a zero generation is rejected'
);

select throws_like(
  $$ select * from public.persist_room_source_v1('source-primary', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 9007199254740992) $$,
  '%room_source_invalid_input%',
  'a generation above the JavaScript-safe bound is rejected'
);

select is(
  (
    select outcome || ':' || source_generation::text
    from public.persist_room_source_v1(
      'source-youtube-boundary',
      'youtube',
      'https://www.youtube.com/watch?v=' || repeat('a', 392),
      9007199254740991
    )
  ),
  'persisted:9007199254740991',
  'the exact YouTube identity and generation bounds are accepted'
);

select is(
  (
    select outcome || ':' || source_generation::text
    from public.persist_room_source_v1(
      'source-crunchyroll-boundary',
      'crunchyroll',
      'https://www.crunchyroll.com/watch/' || repeat('b', 382),
      1
    )
  ),
  'persisted:1',
  'the exact Crunchyroll identity bound is accepted'
);

reset role;

set role anon;
select throws_like(
  $$
    select *
    from public.persist_room_source_v1(
      'source-primary',
      'youtube',
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      4
    )
  $$,
  '%permission denied for function persist_room_source_v1%',
  'anon cannot call the room-source RPC'
);
reset role;

set role authenticated;
select throws_like(
  $$
    select *
    from public.persist_room_source_v1(
      'source-primary',
      'youtube',
      'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      4
    )
  $$,
  '%permission denied for function persist_room_source_v1%',
  'authenticated cannot call the room-source RPC'
);
reset role;

-- Real PostgreSQL concurrency: the higher-generation writer holds the room row
-- lock. A lower-generation writer must wait, then observe the committed winner
-- and return stale without overwriting it.
select extensions.dblink_connect(
  'room_source_setup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=room_source_setup'
);
select extensions.dblink_exec(
  'room_source_setup',
  $setup$
    delete from public.room_members where room_id = 'source-concurrent';
    delete from public.rooms where room_id = 'source-concurrent';
    delete from public.rooms where host_user_id = '5a000000-0000-4000-8000-000000000002';
    delete from public.users where id = '5a000000-0000-4000-8000-000000000002';
    insert into public.users (id, email, display_name)
    values (
      '5a000000-0000-4000-8000-000000000002',
      'room-source-concurrency@example.test',
      'Room Source Concurrency'
    );
    insert into public.rooms (
      room_id,
      host_user_id,
      status,
      source_provider,
      source_generation,
      source_url
    )
    values (
      'source-concurrent',
      '5a000000-0000-4000-8000-000000000002',
      'live',
      'youtube',
      1,
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
  $setup$
);
select extensions.dblink_disconnect('room_source_setup');

select extensions.dblink_connect(
  'room_source_high',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=room_source_high'
);
select extensions.dblink_connect(
  'room_source_low',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=room_source_low'
);
select extensions.dblink_exec('room_source_high', 'begin');
select extensions.dblink_exec('room_source_high', 'set role service_role');
select is(
  (
    select outcome || ':' || source_generation::text
    from extensions.dblink(
      'room_source_high',
      $sql$
        select outcome, source_generation
        from public.persist_room_source_v1(
          'source-concurrent',
          'youtube',
          'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
          3
        )
      $sql$
    ) as result(outcome text, source_generation bigint)
  ),
  'persisted:3',
  'the first database session advances the room to the higher generation'
);

select extensions.dblink_exec('room_source_low', 'begin');
select extensions.dblink_exec('room_source_low', 'set role service_role');
select ok(
  extensions.dblink_send_query(
    'room_source_low',
    $sql$
      select outcome, source_generation
      from public.persist_room_source_v1(
        'source-concurrent',
        'youtube',
        'https://www.youtube.com/watch?v=BaW_jenozKc',
        2
      )
    $sql$
  ) = 1,
  'the second database session starts a competing lower-generation write'
);
select pg_catalog.pg_sleep(0.1);

select ok(
  exists (
    select 1
    from pg_catalog.pg_stat_activity
    where application_name = 'room_source_low'
      and wait_event_type = 'Lock'
  ),
  'the competing room-source writer waits on the real room row lock'
);

select extensions.dblink_exec('room_source_high', 'commit');
select is(
  (
    select outcome || ':' || source_generation::text
    from extensions.dblink_get_result('room_source_low')
      as result(outcome text, source_generation bigint)
  ),
  'stale:2',
  'the concurrent loser observes the committed winner and returns stale'
);
select *
from extensions.dblink_get_result('room_source_low')
  as drained(outcome text, source_generation bigint);
select extensions.dblink_exec('room_source_low', 'commit');
select extensions.dblink_disconnect('room_source_high');
select extensions.dblink_disconnect('room_source_low');

select is(
  (
    select source_provider || ':' || source_generation::text || ':' || source_url
    from public.rooms
    where room_id = 'source-concurrent'
  ),
  'youtube:3:https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  'concurrent persistence leaves the highest valid source tuple durable'
);

select extensions.dblink_connect(
  'room_source_cleanup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=room_source_cleanup'
);
select extensions.dblink_exec(
  'room_source_cleanup',
  $cleanup$
    delete from public.room_members where room_id = 'source-concurrent';
    delete from public.rooms where room_id = 'source-concurrent';
    delete from public.rooms where host_user_id = '5a000000-0000-4000-8000-000000000002';
    delete from public.users where id = '5a000000-0000-4000-8000-000000000002';
  $cleanup$
);
select extensions.dblink_disconnect('room_source_cleanup');

select * from finish();
rollback;
