create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

begin;

set role postgres;
set search_path = public, extensions;
select no_plan();

select has_table(
  'public',
  'refresh_token_families',
  'refresh families have a dedicated durable relation'
);

select has_table(
  'public',
  'refresh_token_lineage',
  'used refresh-token lineage has a dedicated durable relation'
);

select ok(
  (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = pg_catalog.to_regclass('public.refresh_token_families')
  )
  and (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = pg_catalog.to_regclass('public.refresh_token_lineage')
  )
  and not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename in ('refresh_token_families', 'refresh_token_lineage')
  ),
  'both refresh authority relations enable RLS and expose no browser policy'
);

select ok(
  not pg_catalog.has_table_privilege(
    'public',
    'public.refresh_token_families',
    'select'
  )
  and not pg_catalog.has_table_privilege(
    'anon',
    'public.refresh_token_families',
    'select'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.refresh_token_families',
    'select'
  )
  and not pg_catalog.has_table_privilege(
    'public',
    'public.refresh_token_lineage',
    'select'
  )
  and not pg_catalog.has_table_privilege(
    'anon',
    'public.refresh_token_lineage',
    'select'
  )
  and not pg_catalog.has_table_privilege(
    'authenticated',
    'public.refresh_token_lineage',
    'select'
  )
  and pg_catalog.has_table_privilege(
    'service_role',
    'public.refresh_token_families',
    'select,insert,update,delete'
  )
  and pg_catalog.has_table_privilege(
    'service_role',
    'public.refresh_token_lineage',
    'select,insert,update,delete'
  ),
  'only service_role can access refresh family and lineage rows'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.create_refresh_token_family_v1(uuid,text,text,uuid,timestamptz)',
    'execute'
  ),
  'service_role can create refresh families'
);
select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'public.create_refresh_token_family_v1(uuid,text,text,uuid,timestamptz)',
    'execute'
  ),
  'PUBLIC cannot create refresh families'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_refresh_token_family_v1(uuid,text,text,uuid,timestamptz)',
    'execute'
  ),
  'anon cannot create refresh families'
);
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_refresh_token_family_v1(uuid,text,text,uuid,timestamptz)',
    'execute'
  ),
  'authenticated cannot create refresh families'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.resolve_refresh_token_family_v1(text,text,timestamptz)',
    'execute'
  ),
  'service_role can resolve refresh families'
);
select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'public.resolve_refresh_token_family_v1(text,text,timestamptz)',
    'execute'
  ),
  'PUBLIC cannot resolve refresh families'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.resolve_refresh_token_family_v1(text,text,timestamptz)',
    'execute'
  ),
  'anon cannot resolve refresh families'
);
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.resolve_refresh_token_family_v1(text,text,timestamptz)',
    'execute'
  ),
  'authenticated cannot resolve refresh families'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.rotate_refresh_token_family_v1(text,text,text,timestamptz)',
    'execute'
  ),
  'service_role can rotate refresh families'
);
select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'public.rotate_refresh_token_family_v1(text,text,text,timestamptz)',
    'execute'
  ),
  'PUBLIC cannot rotate refresh families'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.rotate_refresh_token_family_v1(text,text,text,timestamptz)',
    'execute'
  ),
  'anon cannot rotate refresh families'
);
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.rotate_refresh_token_family_v1(text,text,text,timestamptz)',
    'execute'
  ),
  'authenticated cannot rotate refresh families'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.revoke_refresh_token_family_v1(text,text,timestamptz)',
    'execute'
  ),
  'service_role can revoke refresh families by channel'
);
select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'public.revoke_refresh_token_family_v1(text,text,timestamptz)',
    'execute'
  ),
  'PUBLIC cannot revoke refresh families by channel'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.revoke_refresh_token_family_v1(text,text,timestamptz)',
    'execute'
  ),
  'anon cannot revoke refresh families by channel'
);
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.revoke_refresh_token_family_v1(text,text,timestamptz)',
    'execute'
  ),
  'authenticated cannot revoke refresh families by channel'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.revoke_refresh_token_families_for_user_v1(uuid,timestamptz)',
    'execute'
  ),
  'service_role can revoke all refresh families for an account'
);
select ok(
  not pg_catalog.has_function_privilege(
    'public',
    'public.revoke_refresh_token_families_for_user_v1(uuid,timestamptz)',
    'execute'
  ),
  'PUBLIC cannot revoke all refresh families for an account'
);
select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.revoke_refresh_token_families_for_user_v1(uuid,timestamptz)',
    'execute'
  ),
  'anon cannot revoke all refresh families for an account'
);
select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.revoke_refresh_token_families_for_user_v1(uuid,timestamptz)',
    'execute'
  ),
  'authenticated cannot revoke all refresh families for an account'
);

select ok(
  (
    select pg_catalog.bool_and(
      not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    )
    from pg_catalog.pg_proc as procedure
    where procedure.oid in (
      'public.create_refresh_token_family_v1(uuid,text,text,uuid,timestamptz)'::regprocedure,
      'public.resolve_refresh_token_family_v1(text,text,timestamptz)'::regprocedure,
      'public.rotate_refresh_token_family_v1(text,text,text,timestamptz)'::regprocedure,
      'public.revoke_refresh_token_family_v1(text,text,timestamptz)'::regprocedure,
      'public.revoke_refresh_token_families_for_user_v1(uuid,timestamptz)'::regprocedure
    )
  ),
  'refresh-family RPCs are security invoker with an empty search_path'
);

select ok(
  (
    select procedure.provolatile = 's'
      and pg_catalog.strpos(
        pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid)),
        'pg_catalog.now()'
      ) > 0
      and pg_catalog.strpos(
        pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid)),
        'clock_timestamp'
      ) = 0
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.resolve_refresh_token_family_v1(text,text,timestamptz)'::regprocedure
  ),
  'stable family resolution uses a transaction-stable fallback clock'
);

select is(
  (
    select pg_catalog.string_agg(column_name, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'refresh_token_families'
  ),
  'id,user_id,channel,device_id,current_token_hash,created_at,last_used_at,absolute_expires_at,revoked_at',
  'families store channel, optional device binding, hashes, and lifecycle timestamps only'
);

select is(
  (
    select pg_catalog.string_agg(column_name, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'refresh_token_lineage'
  ),
  'token_hash,family_id,successor_token_hash,used_at',
  'lineage stores only used and successor hashes with family ownership'
);

select ok(
  pg_catalog.to_regclass(
    'public.refresh_token_lineage_successor_hash_idx'
  ) is not null
  and pg_catalog.strpos(
    pg_catalog.lower(
      pg_catalog.pg_get_indexdef(
        pg_catalog.to_regclass(
          'public.refresh_token_lineage_successor_hash_idx'
        )
      )
    ),
    'using btree (successor_token_hash)'
  ) > 0,
  'successor collision checks have a standalone btree index'
);

select is(
  (
    select pg_catalog.string_agg(column_name, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('refresh_token_families', 'refresh_token_lineage')
      and column_name in (
        'token',
        'refresh_token',
        'successor_token',
        'encrypted_token',
        'idle_expires_at'
      )
  ),
  null::text,
  'the new authority stores no raw, encrypted, or redundant idle-expiry token state'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'refresh_tokens'
      and column_name = 'revoked_at'
      and is_nullable = 'YES'
      and column_default is null
  ),
  'legacy rows gain only nullable additive cutover revocation metadata'
);

insert into public.users (id, email, display_name)
values (
  '70000000-0000-4000-8000-000000000001',
  'auth-channel-rotation@example.test',
  'Auth Channel Rotation'
)
on conflict (id) do nothing;

set role service_role;
select lives_ok(
  $$
    insert into public.refresh_tokens (user_id, token_hash, expires_at)
    values (
      '70000000-0000-4000-8000-000000000001',
      repeat('9', 64),
      pg_catalog.clock_timestamp() + interval '90 days'
    )
  $$,
  'the still-running old runtime can insert its unchanged legacy row shape'
);
set role postgres;

select is(
  (
    select revoked_at
    from public.refresh_tokens
    where token_hash = repeat('9', 64)
  ),
  null::timestamptz,
  'a post-migration legacy row is left for bounded Task 8 cleanup'
);

set role service_role;
select is(
  public.resolve_refresh_token_family_v1(
    repeat('9', 64),
    'website',
    pg_catalog.clock_timestamp()
  ),
  null::uuid,
  'the new authority ignores a legacy refresh row'
);

select is(
  public.create_refresh_token_family_v1(
    '70000000-0000-4000-8000-000000000001',
    'website',
    repeat('a', 64),
    null,
    '2100-01-01 00:00:00+00'
  ) is not null,
  true,
  'service_role creates a website refresh family'
);
set role postgres;

select is(
  (
    select absolute_expires_at - created_at
    from public.refresh_token_families
    where current_token_hash = repeat('a', 64)
  ),
  interval '365 days',
  'family absolute expiry is fixed at 365 days from creation'
);

select is(
  (
    select device_id
    from public.refresh_token_families
    where current_token_hash = repeat('a', 64)
  ),
  null::uuid,
  'refresh families do not invent a device identity'
);

create temporary table wrong_channel_last_used_snapshots (
  channel text primary key,
  last_used_at timestamptz not null
) on commit drop;
insert into wrong_channel_last_used_snapshots (channel, last_used_at)
select channel, last_used_at
from public.refresh_token_families
where current_token_hash = repeat('a', 64);

set role service_role;
select is(
  public.resolve_refresh_token_family_v1(
    repeat('a', 64),
    'website',
    '2100-01-01 00:00:01+00'
  ),
  '70000000-0000-4000-8000-000000000001'::uuid,
  'the current token resolves on its website channel'
);
select is(
  public.resolve_refresh_token_family_v1(
    repeat('a', 64),
    'extension',
    '2100-01-01 00:00:01+00'
  ),
  null::uuid,
  'the same refresh token is rejected on the extension channel'
);

select is(
  (
    select rotation_outcome
    from public.rotate_refresh_token_family_v1(
      repeat('a', 64),
      repeat('b', 64),
      'extension',
      '2100-01-01 00:00:01+00'
    )
  ),
  'invalid'::text,
  'an extension rotation cannot consume a website family'
);
set role postgres;
select is(
  (
    select current_token_hash || ':' || (revoked_at is null)::text
    from public.refresh_token_families
    where current_token_hash = repeat('a', 64)
  ),
  repeat('a', 64) || ':true',
  'wrong-channel extension rotation leaves the website family current and active'
);
select is(
  (
    select last_used_at
    from public.refresh_token_families
    where current_token_hash = repeat('a', 64)
  ),
  (
    select last_used_at
    from wrong_channel_last_used_snapshots
    where channel = 'website'
  ),
  'wrong-channel extension rotation does not extend the website family idle lifetime'
);
select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where family_id = (
      select id
      from public.refresh_token_families
      where current_token_hash = repeat('a', 64)
    )
  ),
  0::bigint,
  'wrong-channel extension rotation creates no website lineage'
);
set role service_role;

select is(
  (
    select rotation_outcome
    from public.rotate_refresh_token_family_v1(
      repeat('a', 64),
      repeat('b', 64),
      'website',
      '2100-01-01 00:00:02+00'
    )
  ),
  'rotated'::text,
  'the active token rotates atomically to one successor'
);
set role postgres;

select is(
  (
    select current_token_hash
    from public.refresh_token_families
    where user_id = '70000000-0000-4000-8000-000000000001'
      and channel = 'website'
  ),
  repeat('b', 64),
  'rotation persists only the successor hash as current'
);

select is(
  (
    select token_hash || ':' || successor_token_hash
    from public.refresh_token_lineage
    where family_id = (
      select id
      from public.refresh_token_families
      where user_id = '70000000-0000-4000-8000-000000000001'
        and channel = 'website'
    )
  ),
  repeat('a', 64) || ':' || repeat('b', 64),
  'rotation records hash-only predecessor lineage'
);

select is(
  (
    select absolute_expires_at
    from public.refresh_token_families
    where user_id = '70000000-0000-4000-8000-000000000001'
      and channel = 'website'
  ),
  '2101-01-01 00:00:00+00'::timestamptz,
  'successful rotation never extends absolute expiry'
);

set role service_role;
select is(
  (
    select rotation_outcome
    from public.rotate_refresh_token_family_v1(
      repeat('a', 64),
      repeat('b', 64),
      'website',
      '2100-01-01 00:00:11.999+00'
    )
  ),
  'reused'::text,
  'predecessor reuse at 9.999 seconds returns the current successor non-destructively'
);
set role postgres;

select is(
  (
    select current_token_hash
    from public.refresh_token_families
    where user_id = '70000000-0000-4000-8000-000000000001'
      and channel = 'website'
  ),
  repeat('b', 64),
  'reuse inside the interval does not rotate again'
);

select is(
  (
    select last_used_at
    from public.refresh_token_families
    where user_id = '70000000-0000-4000-8000-000000000001'
      and channel = 'website'
  ),
  '2100-01-01 00:00:02+00'::timestamptz,
  'reuse inside the interval does not move family idle lifetime'
);

set role service_role;
select is(
  (
    select rotation_outcome
    from public.rotate_refresh_token_family_v1(
      repeat('a', 64),
      repeat('b', 64),
      'website',
      '2100-01-01 00:00:12+00'
    )
  ),
  'replayed'::text,
  'predecessor reuse at the exact ten-second boundary revokes the family'
);
set role postgres;

select isnt(
  (
    select revoked_at
    from public.refresh_token_families
    where user_id = '70000000-0000-4000-8000-000000000001'
      and channel = 'website'
  ),
  null::timestamptz,
  'boundary replay records durable family revocation'
);

-- A used token remains known after later rotations. Replaying T0 after T1 -> T2
-- revokes even inside T0's ten-second interval because T0 no longer points to
-- the family's current successor.
set role service_role;
select public.create_refresh_token_family_v1(
  '70000000-0000-4000-8000-000000000001',
  'extension',
  repeat('c', 64),
  null,
  '2100-02-01 00:00:00+00'
);
set role postgres;
insert into wrong_channel_last_used_snapshots (channel, last_used_at)
select channel, last_used_at
from public.refresh_token_families
where current_token_hash = repeat('c', 64);
set role service_role;
select is(
  (
    select rotation_outcome
    from public.rotate_refresh_token_family_v1(
      repeat('c', 64),
      repeat('d', 64),
      'website',
      '2100-02-01 00:00:00.5+00'
    )
  ),
  'invalid'::text,
  'a website rotation cannot consume an extension family'
);
set role postgres;
select is(
  (
    select current_token_hash || ':' || (revoked_at is null)::text
    from public.refresh_token_families
    where current_token_hash = repeat('c', 64)
  ),
  repeat('c', 64) || ':true',
  'wrong-channel website rotation leaves the extension family current and active'
);
select is(
  (
    select last_used_at
    from public.refresh_token_families
    where current_token_hash = repeat('c', 64)
  ),
  (
    select last_used_at
    from wrong_channel_last_used_snapshots
    where channel = 'extension'
  ),
  'wrong-channel website rotation does not extend the extension family idle lifetime'
);
select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where family_id = (
      select id
      from public.refresh_token_families
      where current_token_hash = repeat('c', 64)
    )
  ),
  0::bigint,
  'wrong-channel website rotation creates no extension lineage'
);
set role service_role;
select rotation_outcome
from public.rotate_refresh_token_family_v1(
  repeat('c', 64), repeat('d', 64), 'extension', '2100-02-01 00:00:01+00'
);
select rotation_outcome
from public.rotate_refresh_token_family_v1(
  repeat('d', 64), repeat('e', 64), 'extension', '2100-02-01 00:00:02+00'
);
select is(
  (
    select rotation_outcome
    from public.rotate_refresh_token_family_v1(
      repeat('c', 64),
      repeat('d', 64),
      'extension',
      '2100-02-01 00:00:03+00'
    )
  ),
  'replayed'::text,
  'T0 replay after T1 to T2 revokes the live family instead of becoming unknown'
);
set role postgres;

select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where family_id = (
      select id
      from public.refresh_token_families
      where user_id = '70000000-0000-4000-8000-000000000001'
        and channel = 'extension'
    )
  ),
  2::bigint,
  'all used token hashes remain linked until family cleanup'
);

-- Idle expiry is derived from last_used_at and successful rotation is the only
-- operation that moves it.
set role service_role;
select public.create_refresh_token_family_v1(
  '70000000-0000-4000-8000-000000000001',
  'website',
  repeat('f', 64),
  null,
  '2100-03-01 00:00:00+00'
);
select is(
  (
    select rotation_outcome
    from public.rotate_refresh_token_family_v1(
      repeat('f', 64),
      repeat('1', 64),
      'website',
      '2100-05-30 00:00:00+00'
    )
  ),
  'invalid'::text,
  'a family expires at ninety consecutive days without refresh'
);
set role postgres;

-- Absolute expiry is checked at its exact boundary and never slides.
set role service_role;
select public.create_refresh_token_family_v1(
  '70000000-0000-4000-8000-000000000001',
  'website',
  repeat('2', 64),
  null,
  '2100-04-01 00:00:00+00'
);
update public.refresh_token_families
set last_used_at = '2101-03-31 23:59:59+00'
where current_token_hash = repeat('2', 64);
select is(
  (
    select rotation_outcome
    from public.rotate_refresh_token_family_v1(
      repeat('2', 64),
      repeat('3', 64),
      'website',
      '2101-03-31 23:59:59.999999+00'
    )
  ),
  'rotated'::text,
  'refresh succeeds immediately before the fixed absolute boundary'
);
select is(
  (
    select rotation_outcome
    from public.rotate_refresh_token_family_v1(
      repeat('3', 64),
      repeat('4', 64),
      'website',
      '2101-04-01 00:00:00+00'
    )
  ),
  'invalid'::text,
  'refresh fails at the exact 365-day absolute boundary'
);
set role postgres;

-- Logout is channel-bound and revokes the whole family.
set role service_role;
select public.create_refresh_token_family_v1(
  '70000000-0000-4000-8000-000000000001',
  'extension',
  repeat('5', 64),
  null,
  '2100-05-01 00:00:00+00'
);
select is(
  public.revoke_refresh_token_family_v1(
    repeat('5', 64), 'website', '2100-05-01 00:00:01+00'
  ),
  false,
  'logout on the wrong channel cannot revoke another channel family'
);
select is(
  public.revoke_refresh_token_family_v1(
    repeat('5', 64), 'extension', '2100-05-01 00:00:02+00'
  ),
  true,
  'extension logout revokes the matching refresh family'
);
select is(
  public.resolve_refresh_token_family_v1(
    repeat('5', 64), 'extension', '2100-05-01 00:00:03+00'
  ),
  null::uuid,
  'a logged-out family no longer resolves'
);
set role postgres;

-- User deletion removes both the family and its used-token lineage.
insert into public.users (id, email, display_name)
values (
  '70000000-0000-4000-8000-000000000002',
  'auth-channel-delete@example.test',
  'Auth Channel Delete'
);
set role service_role;
select public.create_refresh_token_family_v1(
  '70000000-0000-4000-8000-000000000002',
  'website',
  repeat('6', 64),
  null,
  '2100-06-01 00:00:00+00'
);
select rotation_outcome
from public.rotate_refresh_token_family_v1(
  repeat('6', 64), repeat('7', 64), 'website', '2100-06-01 00:00:01+00'
);
set role postgres;
delete from public.users
where id = '70000000-0000-4000-8000-000000000002';

select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_families
    where user_id = '70000000-0000-4000-8000-000000000002'
  ),
  0::bigint,
  'user deletion removes every refresh family'
);

select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage as lineage
    where lineage.token_hash = repeat('6', 64)
  ),
  0::bigint,
  'user deletion cascades through family lineage'
);

-- Real PostgreSQL concurrency: two independent dblink sessions present the
-- same current token. Session one holds the family lock after rotating; session
-- two must wait, then return the already-issued current successor.
select extensions.dblink_connect(
  'auth_rotation_setup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_rotation_setup'
);
select extensions.dblink_exec(
  'auth_rotation_setup',
  $sql$
    delete from public.users
    where id = '70000000-0000-4000-8000-000000000003';
    insert into public.users (id, email, display_name)
    values (
      '70000000-0000-4000-8000-000000000003',
      'auth-channel-concurrency@example.test',
      'Auth Channel Concurrency'
    );
    set role service_role;
    select public.create_refresh_token_family_v1(
      '70000000-0000-4000-8000-000000000003',
      'website',
      repeat('8', 64),
      null,
      '2100-07-01 00:00:00+00'
    );
    reset role;
  $sql$
);
select extensions.dblink_disconnect('auth_rotation_setup');

select extensions.dblink_connect(
  'auth_rotation_one',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_rotation_one'
);
select extensions.dblink_connect(
  'auth_rotation_two',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_rotation_two'
);
select extensions.dblink_exec('auth_rotation_one', 'begin');
select extensions.dblink_exec('auth_rotation_one', 'set role service_role');
select is(
  (
    select rotation_outcome
    from extensions.dblink(
      'auth_rotation_one',
      $sql$
        select rotation_outcome, user_id, family_id
        from public.rotate_refresh_token_family_v1(
          repeat('8', 64),
          repeat('0', 64),
          'website',
          '2100-07-01 00:00:01+00'
        )
      $sql$
    ) as result(rotation_outcome text, user_id uuid, family_id uuid)
  ),
  'rotated'::text,
  'the first database session wins the current-token rotation'
);

select extensions.dblink_exec('auth_rotation_two', 'begin');
select extensions.dblink_exec('auth_rotation_two', 'set role service_role');
select ok(
  extensions.dblink_send_query(
    'auth_rotation_two',
    $sql$
      select rotation_outcome, user_id, family_id
      from public.rotate_refresh_token_family_v1(
        repeat('8', 64),
        repeat('0', 64),
        'website',
        '2100-07-01 00:00:01+00'
      )
    $sql$
  ) = 1,
  'the second database session starts a competing refresh'
);
select pg_catalog.pg_sleep(0.1);

select ok(
  exists (
    select 1
    from pg_catalog.pg_stat_activity
    where application_name = 'auth_rotation_two'
      and wait_event_type = 'Lock'
  ),
  'the competing refresh waits on the real family row lock'
);

select extensions.dblink_exec('auth_rotation_one', 'commit');
select is(
  (
    select rotation_outcome
    from extensions.dblink_get_result('auth_rotation_two')
      as result(rotation_outcome text, user_id uuid, family_id uuid)
  ),
  'reused'::text,
  'the concurrent loser receives the already-issued successor outcome'
);
-- libpq async mode requires draining the terminal empty result before the
-- connection can accept the following COMMIT.
select *
from extensions.dblink_get_result('auth_rotation_two')
  as drained(rotation_outcome text, user_id uuid, family_id uuid);
select extensions.dblink_exec('auth_rotation_two', 'commit');
select extensions.dblink_disconnect('auth_rotation_one');
select extensions.dblink_disconnect('auth_rotation_two');

select is(
  (
    select current_token_hash
    from public.refresh_token_families
    where user_id = '70000000-0000-4000-8000-000000000003'
  ),
  repeat('0', 64),
  'concurrent refresh leaves exactly one current successor hash'
);

select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where family_id = (
      select id
      from public.refresh_token_families
      where user_id = '70000000-0000-4000-8000-000000000003'
    )
  ),
  1::bigint,
  'concurrent refresh performs exactly one durable rotation'
);

select extensions.dblink_connect(
  'auth_rotation_cleanup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_rotation_cleanup'
);
select extensions.dblink_exec(
  'auth_rotation_cleanup',
  $$
    delete from public.users
    where id = '70000000-0000-4000-8000-000000000003'
  $$
);
select extensions.dblink_disconnect('auth_rotation_cleanup');

select finish();
rollback;
