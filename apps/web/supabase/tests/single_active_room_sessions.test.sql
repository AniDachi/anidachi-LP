create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

begin;

set role postgres;
set search_path = public, extensions;
select no_plan();

create or replace function pg_temp.active_room_waits_for_lock(
  p_application_name text,
  p_timeout_ms integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_deadline timestamptz := pg_catalog.clock_timestamp()
    + p_timeout_ms * interval '1 millisecond';
begin
  loop
    if exists (
      select 1
      from pg_catalog.pg_stat_activity
      where application_name = p_application_name
        and wait_event_type = 'Lock'
    ) then
      return true;
    end if;

    if pg_catalog.clock_timestamp() >= v_deadline then
      return false;
    end if;

    perform pg_catalog.pg_sleep(0.02);
  end loop;
end;
$$;

select has_table(
  'public',
  'active_room_sessions',
  'the database owns one durable active-room assignment per account'
);

select col_is_pk(
  'public',
  'active_room_sessions',
  'user_id',
  'the user primary key is the global one-active-room invariant'
);

select ok(
  (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = 'public.active_room_sessions'::pg_catalog.regclass
  ),
  'active-room assignments have RLS enabled'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policy
    where polrelid = 'public.active_room_sessions'::pg_catalog.regclass
  ),
  0,
  'the server-only assignment table has no browser-facing RLS policy'
);

select ok(
  pg_catalog.has_table_privilege(
    'service_role',
    'public.active_room_sessions',
    'select,insert,update,delete'
  )
  and not pg_catalog.has_table_privilege(
    'public',
    'public.active_room_sessions',
    'select,insert,update,delete'
  )
  and not pg_catalog.has_table_privilege(
    'anon',
    'public.active_room_sessions',
    'select'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.active_room_sessions',
    'select,insert,update,delete'
  )
  and not pg_catalog.has_table_privilege(
    'anon',
    'public.active_room_sessions',
    'select,insert,update,delete'
  ),
  'only the server service role can access active-room assignments'
);

select has_function(
  'public',
  'create_room_with_active_session_v1',
  array[
    'uuid', 'text', 'text', 'text', 'text', 'text', 'text', 'bigint',
    'text', 'text', 'text', 'integer', 'integer', 'boolean', 'boolean'
  ],
  'room creation and host assignment share one atomic RPC'
);

select has_function(
  'public',
  'claim_active_room_session_v1',
  array['uuid', 'text', 'text', 'text'],
  'existing-room admission has one atomic claim RPC'
);

select has_function(
  'public',
  'release_active_room_session_v1',
  array['uuid', 'text', 'text'],
  'departure uses an exact-session release RPC'
);

select has_function(
  'public',
  'end_host_lobby_for_active_session_v1',
  array['uuid', 'text', 'text', 'timestamp with time zone'],
  'a claimed host that never joined can end only its exact lobby session'
);

select ok(
  (
    select pg_catalog.bool_and(
      not procedure.prosecdef
      and procedure.provolatile = 'v'
      and procedure.proconfig @> array['search_path=""']::text[]
      and procedure.proretset
    )
    from pg_catalog.pg_proc as procedure
    where procedure.oid in (
      pg_catalog.to_regprocedure(
        'public.create_room_with_active_session_v1(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean)'
      ),
      pg_catalog.to_regprocedure(
        'public.claim_active_room_session_v1(uuid,text,text,text)'
      ),
      pg_catalog.to_regprocedure(
        'public.release_active_room_session_v1(uuid,text,text)'
      ),
      pg_catalog.to_regprocedure(
        'public.end_host_lobby_for_active_session_v1(uuid,text,text,timestamptz)'
      )
    )
  ),
  'active-room RPCs are volatile security-invoker table functions with an empty search_path'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.create_room_with_active_session_v1(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'service_role',
    'public.claim_active_room_session_v1(uuid,text,text,text)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'service_role',
    'public.end_host_lobby_for_active_session_v1(uuid,text,text,timestamptz)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'service_role',
    'public.release_active_room_session_v1(uuid,text,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'public',
    'public.claim_active_room_session_v1(uuid,text,text,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.claim_active_room_session_v1(uuid,text,text,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.claim_active_room_session_v1(uuid,text,text,text)',
    'execute'
  ),
  'the active-room RPCs are server-only'
);

select throws_like(
  $$
    select *
    from public.claim_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-one',
      'member',
      repeat('x', 129)
    )
  $$,
  '%active_room_session_invalid_input%',
  'admission rejects an unbounded participant session identifier'
);

select throws_like(
  $$
    select *
    from public.claim_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-one',
      'viewer',
      'valid-session'
    )
  $$,
  '%active_room_session_invalid_input%',
  'admission rejects an unknown room role'
);

select throws_like(
  $$
    select *
    from public.create_room_with_active_session_v1(
      'a1000000-0000-4000-8000-000000000001',
      'null-plan-session',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'null-plan-request',
      null,
      4,
      4,
      false,
      false
    )
  $$,
  '%active_room_session_invalid_input%',
  'room creation rejects a null host plan with the stable input error'
);

select throws_like(
  $$
    select *
    from public.create_room_with_active_session_v1(
      'a1000000-0000-4000-8000-000000000001',
      'null-participant-cap-session',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'null-participant-cap-request',
      'free',
      null,
      4,
      false,
      false
    )
  $$,
  '%active_room_session_invalid_input%',
  'room creation rejects a null participant cap with the stable input error'
);

select throws_like(
  $$
    select *
    from public.create_room_with_active_session_v1(
      'a1000000-0000-4000-8000-000000000001',
      'null-media-cap-session',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      'null-media-cap-request',
      'free',
      4,
      null,
      false,
      false
    )
  $$,
  '%active_room_session_invalid_input%',
  'room creation rejects a null media cap with the stable input error'
);

select throws_like(
  $$
    select *
    from public.claim_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-one',
      null,
      'null-role-session'
    )
  $$,
  '%active_room_session_invalid_input%',
  'admission rejects a null role before authorization or writes'
);

select throws_like(
  $$
    select *
    from public.create_room_with_active_session_v1(
      'a1000000-0000-4000-8000-000000000001',
      'partial-source-session',
      null,
      null,
      null,
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      null,
      null,
      null,
      'partial-source-request',
      'free',
      4,
      4,
      false,
      false
    )
  $$,
  '%active_room_session_invalid_input%',
  'room creation rejects every partial source tuple'
);

delete from public.active_room_sessions
where user_id::text like 'a1000000-0000-4000-8000-%';
delete from public.room_members
where room_id like 'active-room-%';
delete from public.rooms
where room_id like 'active-room-%'
   or host_user_id::text like 'a1000000-0000-4000-8000-%';
delete from public.users
where id::text like 'a1000000-0000-4000-8000-%';

insert into public.users (id, email, display_name)
values
  ('a1000000-0000-4000-8000-000000000001', 'active-host-one@example.test', 'Active Host One'),
  ('a1000000-0000-4000-8000-000000000002', 'active-host-two@example.test', 'Active Host Two'),
  ('a1000000-0000-4000-8000-000000000003', 'active-member@example.test', 'Active Member'),
  ('a1000000-0000-4000-8000-000000000004', 'active-repair@example.test', 'Active Repair'),
  ('a1000000-0000-4000-8000-000000000005', 'active-finalize@example.test', 'Active Finalize');

insert into public.users (id, email, display_name)
values (
  'a1000000-0000-4000-8000-000000000006',
  'active-lobby-fallback@example.test',
  'Active Lobby Fallback'
);

insert into public.rooms (room_id, host_user_id, status, title)
values
  ('active-room-one', 'a1000000-0000-4000-8000-000000000001', 'live', 'First room'),
  ('active-room-two', 'a1000000-0000-4000-8000-000000000002', 'live', 'Second room'),
  ('active-room-ended', 'a1000000-0000-4000-8000-000000000002', 'ended', 'Ended room'),
  ('active-room-finalize', 'a1000000-0000-4000-8000-000000000005', 'live', 'Finalize room');

insert into public.rooms (room_id, host_user_id, status, title)
values (
  'active-room-lobby-fallback',
  'a1000000-0000-4000-8000-000000000006',
  'lobby',
  'Lobby fallback room'
);

insert into public.active_room_sessions (
  user_id,
  room_id,
  role,
  participant_session_id
)
values (
  'a1000000-0000-4000-8000-000000000006',
  'active-room-lobby-fallback',
  'host',
  'lobby-fallback-session'
);

select is(
  (
    select outcome
    from public.end_host_lobby_for_active_session_v1(
      'a1000000-0000-4000-8000-000000000006',
      'active-room-lobby-fallback',
      'stale-session',
      '2100-01-01 00:00:00+00'
    )
  ),
  'stale',
  'an old tab cannot end a newer host lobby session'
);

select is(
  (
    select outcome
    from public.end_host_lobby_for_active_session_v1(
      'a1000000-0000-4000-8000-000000000006',
      'active-room-lobby-fallback',
      'lobby-fallback-session',
      '2100-01-01 00:00:00+00'
    )
  ),
  'room_ended',
  'the exact never-connected host session ends its lobby atomically'
);

select is(
  (
    select room.status || ':' || count(assignment.user_id)::text
    from public.rooms as room
    left join public.active_room_sessions as assignment
      on assignment.room_id = room.room_id
    where room.room_id = 'active-room-lobby-fallback'
    group by room.status
  ),
  'ended:0',
  'the atomic lobby fallback ends the room and clears assignments together'
);

insert into public.room_members (room_id, user_id)
values
  ('active-room-one', 'a1000000-0000-4000-8000-000000000003'),
  ('active-room-two', 'a1000000-0000-4000-8000-000000000003'),
  ('active-room-one', 'a1000000-0000-4000-8000-000000000004');

set role service_role;

select is(
  (
    select outcome
    from public.claim_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-one',
      'member',
      'member-session-one'
    )
  ),
  'claimed',
  'a member claims the first active room'
);

select is(
  (
    select outcome
    from public.claim_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-two',
      'member',
      'member-session-two'
    )
  ),
  'conflict',
  'the same account cannot claim a different live room'
);

select is(
  (
    select active_room->>'roomId'
    from public.claim_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-two',
      'member',
      'member-session-two'
    )
  ),
  'active-room-one',
  'a conflict returns only the safe current-room summary needed by the UX'
);

select is(
  (
    select outcome
    from public.create_room_with_active_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'member-create-session',
      null,
      null,
      null,
      null,
      null,
      null,
      'Must not replace guest room',
      'member-create-conflict-request',
      'free',
      4,
      4,
      false,
      false
    )
  ),
  'conflict',
  'a guest cannot create a room while the account is active in another room'
);

select is(
  (
    select room_id || ':' || role || ':' || participant_session_id
    from public.active_room_sessions
    where user_id = 'a1000000-0000-4000-8000-000000000003'
  ),
  'active-room-one:member:member-session-one',
  'a rejected guest create leaves the live room assignment unchanged'
);

select is(
  (
    select count(*)::integer
    from public.rooms
    where host_user_id = 'a1000000-0000-4000-8000-000000000003'
      and client_request_id = 'member-create-conflict-request'
  ),
  0,
  'a rejected guest create leaves no orphan host room'
);

select is(
  (
    select outcome
    from public.claim_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-one',
      'member',
      'member-session-one'
    )
  ),
  'reused',
  'an exact same-room and same-session retry is idempotent'
);

select is(
  (
    select outcome
    from public.claim_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-one',
      'member',
      'member-session-takeover'
    )
  ),
  'claimed',
  'a same-room new session performs a deliberate takeover'
);

select is(
  (
    select participant_session_id
    from public.active_room_sessions
    where user_id = 'a1000000-0000-4000-8000-000000000003'
  ),
  'member-session-takeover',
  'the deliberate takeover persists only the new tab session'
);

select is(
  (
    select outcome
    from public.release_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-one',
      'member-session-one'
    )
  ),
  'stale',
  'a delayed close from an older tab cannot release the current session'
);

select is(
  (
    select outcome
    from public.release_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-one',
      'member-session-takeover'
    )
  ),
  'released',
  'the exact current session releases once'
);

select is(
  (
    select outcome
    from public.release_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000003',
      'active-room-one',
      'member-session-takeover'
    )
  ),
  'stale',
  'repeating an exact release is safely idempotent'
);

insert into public.active_room_sessions (
  user_id,
  room_id,
  role,
  participant_session_id
)
values (
  'a1000000-0000-4000-8000-000000000004',
  'active-room-ended',
  'member',
  'ended-session'
);

select is(
  (
    select outcome
    from public.claim_active_room_session_v1(
      'a1000000-0000-4000-8000-000000000004',
      'active-room-one',
      'member',
      'repaired-session'
    )
  ),
  'claimed',
  'a committed ended-room assignment is repaired before a new claim'
);

select is(
  (
    select room_id || ':' || participant_session_id
    from public.active_room_sessions
    where user_id = 'a1000000-0000-4000-8000-000000000004'
  ),
  'active-room-one:repaired-session',
  'repair replaces the stale assignment without creating a second row'
);

select is(
  (
    select outcome
    from public.create_room_with_active_session_v1(
      'a1000000-0000-4000-8000-000000000001',
      'host-create-session',
      null,
      null,
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'youtube|dQw4w9WgXcQ',
      1,
      'Atomic create',
      'atomic-create-request',
      'free',
      4,
      4,
      false,
      false
    )
  ),
  'claimed',
  'host room creation and active assignment commit as one operation'
);

select is(
  (
    select assignment.room_id
    from public.active_room_sessions as assignment
    join public.rooms as room on room.room_id = assignment.room_id
    where assignment.user_id = 'a1000000-0000-4000-8000-000000000001'
      and room.client_request_id = 'atomic-create-request'
  ),
  (
    select room_id
    from public.rooms
    where host_user_id = 'a1000000-0000-4000-8000-000000000001'
      and client_request_id = 'atomic-create-request'
  ),
  'the newly created room and host assignment are committed together'
);

select is(
  (
    select outcome
    from public.create_room_with_active_session_v1(
      'a1000000-0000-4000-8000-000000000001',
      'host-create-session',
      null,
      null,
      'youtube',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'youtube|dQw4w9WgXcQ',
      1,
      'Atomic create',
      'atomic-create-request',
      'free',
      4,
      4,
      false,
      false
    )
  ),
  'reused',
  'an exact idempotent host-create retry reuses the same room and assignment'
);

select is(
  (
    select count(*)::integer
    from public.rooms
    where host_user_id = 'a1000000-0000-4000-8000-000000000001'
      and client_request_id = 'atomic-create-request'
      and status <> 'ended'
  ),
  1,
  'idempotent creation leaves exactly one non-ended room'
);

select is(
  (
    select outcome
    from public.create_room_with_active_session_v1(
      'a1000000-0000-4000-8000-000000000001',
      'host-conflicting-session',
      null,
      null,
      null,
      null,
      null,
      null,
      'Must not exist',
      'conflicting-create-request',
      'free',
      4,
      4,
      false,
      false
    )
  ),
  'conflict',
  'a different-room host create returns the structured active-room conflict'
);

select is(
  (
    select count(*)::integer
    from public.rooms
    where host_user_id = 'a1000000-0000-4000-8000-000000000001'
      and client_request_id = 'conflicting-create-request'
  ),
  0,
  'a conflicting host create leaves no orphan room'
);

insert into public.active_room_sessions (
  user_id,
  room_id,
  role,
  participant_session_id
)
values (
  'a1000000-0000-4000-8000-000000000005',
  'active-room-finalize',
  'host',
  'finalize-session'
);

select *
from public.finalize_room_usage(
  'active-room-finalize',
  '2100-01-01 00:00:00+00',
  '2100-01-01',
  0
);

select is(
  (
    select count(*)::integer
    from public.active_room_sessions
    where room_id = 'active-room-finalize'
  ),
  0,
  'room finalization clears every active assignment in the same transaction'
);

insert into public.active_room_sessions (
  user_id,
  room_id,
  role,
  participant_session_id
)
values (
  'a1000000-0000-4000-8000-000000000005',
  'active-room-finalize',
  'host',
  'leaked-ended-session'
);

select *
from public.finalize_room_usage(
  'active-room-finalize',
  '2100-01-01 00:00:00+00',
  '2100-01-01',
  0
);

select is(
  (
    select count(*)::integer
    from public.active_room_sessions
    where room_id = 'active-room-finalize'
  ),
  0,
  'the already-ended finalization path repairs leaked assignments too'
);

reset role;

select extensions.dblink_connect(
  'active_room_setup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=active_room_setup'
);
select extensions.dblink_exec(
  'active_room_setup',
  $setup$
    delete from public.active_room_sessions
    where user_id = 'a1000000-0000-4000-8000-000000000010';
    delete from public.room_members
    where room_id in ('active-room-concurrent-one', 'active-room-concurrent-two');
    delete from public.rooms
    where room_id in ('active-room-concurrent-one', 'active-room-concurrent-two');
    delete from public.users
    where id in (
      'a1000000-0000-4000-8000-000000000010',
      'a1000000-0000-4000-8000-000000000011',
      'a1000000-0000-4000-8000-000000000012'
    );
    insert into public.users (id, email, display_name)
    values
      ('a1000000-0000-4000-8000-000000000010', 'active-concurrent-member@example.test', 'Concurrent Member'),
      ('a1000000-0000-4000-8000-000000000011', 'active-concurrent-host-one@example.test', 'Concurrent Host One'),
      ('a1000000-0000-4000-8000-000000000012', 'active-concurrent-host-two@example.test', 'Concurrent Host Two');
    insert into public.rooms (room_id, host_user_id, status)
    values
      ('active-room-concurrent-one', 'a1000000-0000-4000-8000-000000000011', 'live'),
      ('active-room-concurrent-two', 'a1000000-0000-4000-8000-000000000012', 'live');
    insert into public.room_members (room_id, user_id)
    values
      ('active-room-concurrent-one', 'a1000000-0000-4000-8000-000000000010'),
      ('active-room-concurrent-two', 'a1000000-0000-4000-8000-000000000010');
  $setup$
);
select extensions.dblink_disconnect('active_room_setup');

select extensions.dblink_connect(
  'active_room_winner',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=active_room_winner'
);
select extensions.dblink_connect(
  'active_room_loser',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=active_room_loser'
);
select extensions.dblink_exec('active_room_winner', 'begin');
select extensions.dblink_exec('active_room_winner', 'set role service_role');
select is(
  (
    select outcome
    from extensions.dblink(
      'active_room_winner',
      $sql$
        select outcome
        from public.claim_active_room_session_v1(
          'a1000000-0000-4000-8000-000000000010',
          'active-room-concurrent-one',
          'member',
          'concurrent-session-one'
        )
      $sql$
    ) as result(outcome text)
  ),
  'claimed',
  'the first concurrent transaction claims one room'
);

select extensions.dblink_exec('active_room_loser', 'begin');
select extensions.dblink_exec('active_room_loser', 'set role service_role');
select ok(
  extensions.dblink_send_query(
    'active_room_loser',
    $sql$
      select outcome
      from public.claim_active_room_session_v1(
        'a1000000-0000-4000-8000-000000000010',
        'active-room-concurrent-two',
        'member',
        'concurrent-session-two'
      )
    $sql$
  ) = 1,
  'a second transaction starts a competing different-room claim'
);
select ok(
  pg_temp.active_room_waits_for_lock('active_room_loser', 5000),
  'the competing same-user claim waits on the database serialization lock'
);

select extensions.dblink_exec('active_room_winner', 'commit');
select is(
  (
    select outcome
    from extensions.dblink_get_result('active_room_loser')
      as result(outcome text)
  ),
  'conflict',
  'after serialization the concurrent loser observes the committed assignment'
);
select *
from extensions.dblink_get_result('active_room_loser')
  as drained(outcome text);
select extensions.dblink_exec('active_room_loser', 'commit');
select extensions.dblink_disconnect('active_room_winner');
select extensions.dblink_disconnect('active_room_loser');

select is(
  (
    select room_id
    from public.active_room_sessions
    where user_id = 'a1000000-0000-4000-8000-000000000010'
  ),
  'active-room-concurrent-one',
  'genuinely concurrent claims still leave exactly the winner room assigned'
);

select extensions.dblink_connect(
  'active_room_cleanup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=active_room_cleanup'
);
select extensions.dblink_exec(
  'active_room_cleanup',
  $cleanup$
    delete from public.active_room_sessions
    where user_id = 'a1000000-0000-4000-8000-000000000010';
    delete from public.room_members
    where room_id in ('active-room-concurrent-one', 'active-room-concurrent-two');
    delete from public.rooms
    where room_id in ('active-room-concurrent-one', 'active-room-concurrent-two');
    delete from public.users
    where id in (
      'a1000000-0000-4000-8000-000000000010',
      'a1000000-0000-4000-8000-000000000011',
      'a1000000-0000-4000-8000-000000000012'
    );
  $cleanup$
);
select extensions.dblink_disconnect('active_room_cleanup');

select * from finish();

rollback;
