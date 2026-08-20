create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

begin;

set role postgres;
set search_path = public, extensions;
select no_plan();

create temporary table auth_cleanup_results (
  extension_auth_codes_deleted integer,
  oauth_login_transactions_deleted integer,
  legacy_refresh_tokens_deleted integer,
  refresh_token_lineage_deleted integer,
  refresh_token_families_deleted integer,
  total_deleted integer
) on commit drop;

grant select, insert on table auth_cleanup_results to service_role;

create or replace function pg_temp.explain_json(p_query text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_plan jsonb;
begin
  execute 'explain (format json, costs off) ' || p_query into v_plan;
  return v_plan;
end;
$$;

create or replace function pg_temp.auth_cleanup_jobs()
returns table (
  jobname text,
  schedule text,
  command text,
  username text,
  active boolean
)
language plpgsql
set search_path = ''
as $$
begin
  if pg_catalog.to_regclass('cron.job') is null then
    return;
  end if;

  return query execute $query$
    select
      job.jobname::text,
      job.schedule::text,
      job.command::text,
      job.username::text,
      job.active
    from cron.job as job
    where job.jobname = 'anidachi-auth-artifact-cleanup-hourly'
  $query$;
end;
$$;

select has_function(
  'public',
  'cleanup_auth_artifacts_v1',
  array['integer'],
  'auth artifact cleanup has one database-owned bounded RPC'
);

select ok(
  (
    select not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc as procedure
    where procedure.oid = pg_catalog.to_regprocedure(
      'public.cleanup_auth_artifacts_v1(integer)'
    )
  ),
  'cleanup is security invoker with an empty search_path'
);

select ok(
  coalesce(pg_catalog.has_function_privilege(
    'service_role',
    pg_catalog.to_regprocedure('public.cleanup_auth_artifacts_v1(integer)'),
    'execute'
  ), false),
  'service_role can execute auth artifact cleanup'
);
select ok(
  not coalesce(pg_catalog.has_function_privilege(
    'public',
    pg_catalog.to_regprocedure('public.cleanup_auth_artifacts_v1(integer)'),
    'execute'
  ), true),
  'PUBLIC cannot execute auth artifact cleanup'
);
select ok(
  not coalesce(pg_catalog.has_function_privilege(
    'anon',
    pg_catalog.to_regprocedure('public.cleanup_auth_artifacts_v1(integer)'),
    'execute'
  ), true),
  'anon cannot execute auth artifact cleanup'
);
select ok(
  not coalesce(pg_catalog.has_function_privilege(
    'authenticated',
    pg_catalog.to_regprocedure('public.cleanup_auth_artifacts_v1(integer)'),
    'execute'
  ), true),
  'authenticated cannot execute auth artifact cleanup'
);

select throws_like(
  $$ select public.cleanup_auth_artifacts_v1(0) $$,
  '%Invalid auth artifact cleanup batch size%',
  'cleanup rejects a zero batch size'
);
select throws_like(
  $$ select public.cleanup_auth_artifacts_v1(101) $$,
  '%Invalid auth artifact cleanup batch size%',
  'cleanup rejects a batch above the hard ceiling'
);
select throws_like(
  $$ select public.cleanup_auth_artifacts_v1(null) $$,
  '%Invalid auth artifact cleanup batch size%',
  'cleanup rejects a null batch size instead of disabling the ceiling'
);

set role authenticated;
select throws_like(
  $$ select public.cleanup_auth_artifacts_v1(1) $$,
  '%permission denied for function cleanup_auth_artifacts_v1%',
  'authenticated callers cannot invoke cleanup through the RLS boundary'
);
set role anon;
select throws_like(
  $$ select public.cleanup_auth_artifacts_v1(1) $$,
  '%permission denied for function cleanup_auth_artifacts_v1%',
  'anonymous callers cannot invoke cleanup through the RLS boundary'
);
set role postgres;

select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes as index_definition
    where index_definition.schemaname = 'public'
      and index_definition.tablename = 'refresh_tokens'
      and index_definition.indexname = 'refresh_tokens_revoked_cleanup_idx'
      and index_definition.indexdef like '%(revoked_at, id)%'
      and index_definition.indexdef like '%WHERE (revoked_at IS NOT NULL)%'
  ),
  'revoked legacy refresh selection has a bounded leading index'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_indexes as index_definition
    where index_definition.schemaname = 'public'
      and index_definition.tablename = 'refresh_token_families'
      and index_definition.indexname = 'refresh_token_families_idle_cleanup_idx'
      and index_definition.indexdef like '%(last_used_at, id)%'
      and index_definition.indexdef like '%WHERE (revoked_at IS NULL)%'
  ),
  'idle-expired family selection has a bounded leading index'
);

set local enable_seqscan = off;
select ok(
  pg_temp.explain_json($query$
    select auth_code.id
    from public.extension_auth_codes as auth_code
    where auth_code.expires_at <= pg_catalog.clock_timestamp()
    order by auth_code.expires_at
    limit 1
  $query$)::text like '%idx_extension_auth_codes_expires_at%',
  'expired extension-code selection uses its expiry index'
);
select ok(
  pg_temp.explain_json($query$
    select login_transaction.id
    from public.oauth_login_transactions as login_transaction
    where login_transaction.expires_at <= pg_catalog.clock_timestamp()
    order by login_transaction.expires_at, login_transaction.id
    limit 1
  $query$)::text like '%oauth_login_transactions_cleanup_idx%',
  'expired OAuth transaction selection uses its bounded cleanup index'
);
select ok(
  pg_temp.explain_json($query$
    select refresh_token.id
    from public.refresh_tokens as refresh_token
    where refresh_token.revoked_at is not null
    order by refresh_token.revoked_at, refresh_token.id
    limit 1
  $query$)::text like '%refresh_tokens_revoked_cleanup_idx%',
  'revoked legacy refresh selection uses its bounded cleanup index'
);
select ok(
  pg_temp.explain_json($query$
    select refresh_token.id
    from public.refresh_tokens as refresh_token
    where refresh_token.expires_at <= current_timestamp
    order by refresh_token.expires_at
    limit 1
  $query$)::text like '%idx_refresh_tokens_expires%',
  'expired legacy refresh selection uses its bounded expiry index'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_index as index_metadata
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_metadata.indexrelid
    join pg_catalog.pg_class as table_relation
      on table_relation.oid = index_metadata.indrelid
    join pg_catalog.pg_namespace as table_namespace
      on table_namespace.oid = table_relation.relnamespace
    where table_namespace.nspname = 'public'
      and table_relation.relname = 'refresh_token_families'
      and index_relation.relname = 'refresh_token_families_idle_cleanup_idx'
      and index_metadata.indisvalid
      and index_metadata.indisready
  ),
  'idle-expired family cleanup index is valid and ready'
);
select ok(
  (
    select pg_catalog.count(*) = 5
    from pg_catalog.pg_index as index_metadata
    join pg_catalog.pg_class as index_relation
      on index_relation.oid = index_metadata.indexrelid
    join pg_catalog.pg_class as table_relation
      on table_relation.oid = index_metadata.indrelid
    join pg_catalog.pg_namespace as table_namespace
      on table_namespace.oid = table_relation.relnamespace
    where table_namespace.nspname = 'public'
      and table_relation.relname in (
        'refresh_token_families',
        'refresh_token_lineage'
      )
      and index_relation.relname in (
        'refresh_token_families_revoked_cleanup_idx',
        'refresh_token_families_absolute_cleanup_idx',
        'refresh_token_families_idle_cleanup_idx',
        'refresh_token_families_pkey',
        'refresh_token_lineage_family_idx'
      )
      and index_metadata.indisvalid
      and index_metadata.indisready
  ),
  'family and lineage cleanup indexes are valid and ready'
);
select ok(
  pg_temp.explain_json($query$
    select lineage.token_hash
    from public.refresh_token_lineage as lineage
    where lineage.family_id = '80000000-0000-4000-8000-000000000001'
    order by lineage.used_at, lineage.token_hash
    limit 1
  $query$)::text like '%refresh_token_lineage_family_idx%',
  'eligible lineage selection uses its bounded family-leading index'
);
set local enable_seqscan = on;

select extensions.dblink_connect(
  'auth_cleanup_setup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_cleanup_setup'
);
select extensions.dblink_exec(
  'auth_cleanup_setup',
  $setup$
    delete from public.users
    where id = '80000000-0000-4000-8000-000000000003';

    insert into public.users (id, email, display_name)
    values (
      '80000000-0000-4000-8000-000000000003',
      'auth-cleanup-lock@example.test',
      'Auth Cleanup Lock'
    );

    insert into public.refresh_token_families (
      id,
      user_id,
      channel,
      current_token_hash,
      created_at,
      last_used_at,
      absolute_expires_at,
      revoked_at
    )
    values
      (
        '80000000-0000-4000-8000-000000000031',
        '80000000-0000-4000-8000-000000000003',
        'extension', repeat('2', 64),
        current_timestamp - interval '2 days',
        current_timestamp - interval '1 day',
        current_timestamp + interval '363 days',
        current_timestamp - interval '2 hours'
      ),
      (
        '80000000-0000-4000-8000-000000000032',
        '80000000-0000-4000-8000-000000000003',
        'extension', repeat('4', 64),
        current_timestamp - interval '2 days',
        current_timestamp - interval '1 day',
        current_timestamp + interval '363 days',
        current_timestamp - interval '1 hour'
      );

    insert into public.refresh_token_lineage (
      token_hash, family_id, successor_token_hash, used_at
    )
    values
      (
        repeat('1', 64),
        '80000000-0000-4000-8000-000000000031',
        repeat('2', 64),
        current_timestamp - interval '1 day'
      ),
      (
        repeat('3', 64),
        '80000000-0000-4000-8000-000000000032',
        repeat('4', 64),
        current_timestamp - interval '1 day'
      );
  $setup$
);
select extensions.dblink_disconnect('auth_cleanup_setup');

select extensions.dblink_connect(
  'auth_cleanup_lock',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_cleanup_lock'
);
select extensions.dblink_exec('auth_cleanup_lock', 'begin');
select extensions.dblink_exec(
  'auth_cleanup_lock',
  $lock$
    update public.refresh_token_families
    set revoked_at = revoked_at
    where id = '80000000-0000-4000-8000-000000000031'
  $lock$
);

select extensions.dblink_connect(
  'auth_cleanup_worker',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_cleanup_worker'
);
select extensions.dblink_exec('auth_cleanup_worker', 'set role service_role');
select is(
  (
    select refresh_token_lineage_deleted
    from extensions.dblink(
      'auth_cleanup_worker',
      'select refresh_token_lineage_deleted from public.cleanup_auth_artifacts_v1(1)'
    ) as result(refresh_token_lineage_deleted integer)
  ),
  1,
  'cleanup skips a locked eligible family and deletes one unlocked lineage row'
);

select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where family_id = '80000000-0000-4000-8000-000000000031'
  ),
  1::bigint,
  'cleanup leaves lineage under the concurrently locked family untouched'
);
select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where family_id = '80000000-0000-4000-8000-000000000032'
  ),
  0::bigint,
  'cleanup counts one lineage deletion from the unlocked eligible family'
);

select extensions.dblink_exec('auth_cleanup_lock', 'commit');
select extensions.dblink_disconnect('auth_cleanup_lock');
select extensions.dblink_exec('auth_cleanup_worker', 'reset role');
select extensions.dblink_exec(
  'auth_cleanup_worker',
  $$
    delete from public.users
    where id = '80000000-0000-4000-8000-000000000003'
  $$
);
select extensions.dblink_disconnect('auth_cleanup_worker');

select extensions.dblink_connect(
  'auth_cleanup_lineage_setup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_cleanup_lineage_setup'
);
select extensions.dblink_exec(
  'auth_cleanup_lineage_setup',
  $setup$
    delete from public.users
    where id = '80000000-0000-4000-8000-000000000004';

    insert into public.users (id, email, display_name)
    values (
      '80000000-0000-4000-8000-000000000004',
      'auth-cleanup-lineage-lock@example.test',
      'Auth Cleanup Lineage Lock'
    );

    insert into public.refresh_token_families (
      id,
      user_id,
      channel,
      current_token_hash,
      created_at,
      last_used_at,
      absolute_expires_at,
      revoked_at
    )
    values
      (
        '80000000-0000-4000-8000-000000000041',
        '80000000-0000-4000-8000-000000000004',
        'extension', repeat('6', 64),
        current_timestamp - interval '2 days',
        current_timestamp - interval '1 day',
        current_timestamp + interval '363 days',
        current_timestamp - interval '2 hours'
      ),
      (
        '80000000-0000-4000-8000-000000000042',
        '80000000-0000-4000-8000-000000000004',
        'extension', repeat('8', 64),
        current_timestamp - interval '2 days',
        current_timestamp - interval '1 day',
        current_timestamp + interval '363 days',
        current_timestamp - interval '1 hour'
      );

    insert into public.refresh_token_lineage (
      token_hash, family_id, successor_token_hash, used_at
    )
    values
      (
        repeat('5', 64),
        '80000000-0000-4000-8000-000000000041',
        repeat('6', 64),
        current_timestamp - interval '1 day'
      ),
      (
        repeat('7', 64),
        '80000000-0000-4000-8000-000000000042',
        repeat('8', 64),
        current_timestamp - interval '1 day'
      );
  $setup$
);
select extensions.dblink_disconnect('auth_cleanup_lineage_setup');

select extensions.dblink_connect(
  'auth_cleanup_lineage_lock',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_cleanup_lineage_lock'
);
select extensions.dblink_exec('auth_cleanup_lineage_lock', 'begin');
select extensions.dblink_exec(
  'auth_cleanup_lineage_lock',
  $lock$
    update public.refresh_token_lineage
    set used_at = used_at
    where token_hash = repeat('5', 64)
  $lock$
);

select extensions.dblink_connect(
  'auth_cleanup_lineage_worker',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_cleanup_lineage_worker'
);
select extensions.dblink_exec('auth_cleanup_lineage_worker', 'set role service_role');
select is(
  (
    select refresh_token_lineage_deleted
    from extensions.dblink(
      'auth_cleanup_lineage_worker',
      'select refresh_token_lineage_deleted from public.cleanup_auth_artifacts_v1(1)'
    ) as result(refresh_token_lineage_deleted integer)
  ),
  1,
  'cleanup skips a locked lineage row and deletes lineage from another eligible family'
);

select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where family_id = '80000000-0000-4000-8000-000000000041'
  ),
  1::bigint,
  'cleanup leaves the concurrently locked lineage row untouched'
);
select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where family_id = '80000000-0000-4000-8000-000000000042'
  ),
  0::bigint,
  'cleanup drains the unlocked second eligible family lineage'
);

select extensions.dblink_exec('auth_cleanup_lineage_lock', 'commit');
select extensions.dblink_disconnect('auth_cleanup_lineage_lock');
select extensions.dblink_exec('auth_cleanup_lineage_worker', 'reset role');
select extensions.dblink_exec(
  'auth_cleanup_lineage_worker',
  $$
    delete from public.users
    where id = '80000000-0000-4000-8000-000000000004'
  $$
);
select extensions.dblink_disconnect('auth_cleanup_lineage_worker');

select extensions.dblink_connect(
  'auth_cleanup_family_lineage_setup',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_cleanup_family_lineage_setup'
);
select extensions.dblink_exec(
  'auth_cleanup_family_lineage_setup',
  $setup$
    delete from public.users
    where id = '80000000-0000-4000-8000-000000000005';

    insert into public.users (id, email, display_name)
    values (
      '80000000-0000-4000-8000-000000000005',
      'auth-cleanup-family-lineage-lock@example.test',
      'Auth Cleanup Family Lineage Lock'
    );

    insert into public.refresh_token_families (
      id,
      user_id,
      channel,
      current_token_hash,
      created_at,
      last_used_at,
      absolute_expires_at,
      revoked_at
    )
    values (
      '80000000-0000-4000-8000-000000000051',
      '80000000-0000-4000-8000-000000000005',
      'extension', repeat('b', 64),
      current_timestamp - interval '2 days',
      current_timestamp - interval '1 day',
      current_timestamp + interval '363 days',
      current_timestamp - interval '2 hours'
    );

    insert into public.refresh_token_lineage (
      token_hash, family_id, successor_token_hash, used_at
    )
    values
      (
        repeat('9', 64),
        '80000000-0000-4000-8000-000000000051',
        repeat('a', 64),
        current_timestamp - interval '2 hours'
      ),
      (
        repeat('a', 64),
        '80000000-0000-4000-8000-000000000051',
        repeat('b', 64),
        current_timestamp - interval '1 hour'
      );
  $setup$
);
select extensions.dblink_disconnect('auth_cleanup_family_lineage_setup');

select extensions.dblink_connect(
  'auth_cleanup_family_lineage_lock',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_cleanup_family_lineage_lock'
);
select extensions.dblink_exec('auth_cleanup_family_lineage_lock', 'begin');
select extensions.dblink_exec(
  'auth_cleanup_family_lineage_lock',
  $lock$
    update public.refresh_token_lineage
    set used_at = used_at
    where token_hash = repeat('9', 64)
  $lock$
);

select extensions.dblink_connect(
  'auth_cleanup_family_lineage_worker',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres application_name=auth_cleanup_family_lineage_worker'
);
select extensions.dblink_exec(
  'auth_cleanup_family_lineage_worker',
  'set role service_role'
);
select is(
  (
    select refresh_token_lineage_deleted
    from extensions.dblink(
      'auth_cleanup_family_lineage_worker',
      'select refresh_token_lineage_deleted from public.cleanup_auth_artifacts_v1(1)'
    ) as result(refresh_token_lineage_deleted integer)
  ),
  1,
  'cleanup skips a locked older lineage row and deletes the next row in the same family'
);

select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where token_hash = repeat('9', 64)
  ),
  1::bigint,
  'cleanup leaves the locked older lineage row untouched'
);
select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where token_hash = repeat('a', 64)
  ),
  0::bigint,
  'cleanup drains the unlocked newer lineage row in the same family'
);

select extensions.dblink_exec('auth_cleanup_family_lineage_lock', 'commit');
select extensions.dblink_disconnect('auth_cleanup_family_lineage_lock');
select extensions.dblink_exec('auth_cleanup_family_lineage_worker', 'reset role');
select extensions.dblink_exec(
  'auth_cleanup_family_lineage_worker',
  $$
    delete from public.users
    where id = '80000000-0000-4000-8000-000000000005'
  $$
);
select extensions.dblink_disconnect('auth_cleanup_family_lineage_worker');

insert into public.users (id, email, display_name)
values (
  '80000000-0000-4000-8000-000000000001',
  'auth-cleanup-small@example.test',
  'Auth Cleanup Small'
)
on conflict (id) do nothing;

insert into public.extension_auth_codes (
  user_id,
  code_hash,
  state_hash,
  extension_id,
  redirect_uri,
  code_challenge,
  code_challenge_method,
  created_at,
  expires_at
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    repeat('1', 64), repeat('2', 64),
    'ndkfphbchhfephdodcpehdcoclojagje',
    'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
    repeat('A', 43), 'S256',
    current_timestamp - interval '6 minutes',
    current_timestamp - interval '1 minute'
  ),
  (
    '80000000-0000-4000-8000-000000000001',
    repeat('3', 64), repeat('4', 64),
    'ndkfphbchhfephdodcpehdcoclojagje',
    'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
    repeat('B', 43), 'S256',
    current_timestamp,
    current_timestamp + interval '5 minutes'
  );

insert into public.oauth_login_transactions (
  state_hash,
  browser_correlation_hash,
  provider,
  created_at,
  expires_at
)
values
  (
    repeat('5', 64), repeat('6', 64), 'google',
    pg_catalog.clock_timestamp() - interval '11 minutes',
    pg_catalog.clock_timestamp() - interval '1 minute'
  ),
  (
    repeat('7', 64), repeat('8', 64), 'discord',
    pg_catalog.clock_timestamp(),
    pg_catalog.clock_timestamp() + interval '10 minutes'
  );

insert into public.refresh_tokens (
  user_id, token_hash, expires_at, revoked_at
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    repeat('9', 64),
    pg_catalog.clock_timestamp() - interval '1 minute',
    null
  ),
  (
    '80000000-0000-4000-8000-000000000001',
    repeat('a', 64),
    pg_catalog.clock_timestamp() + interval '1 day',
    pg_catalog.clock_timestamp() - interval '1 minute'
  ),
  (
    '80000000-0000-4000-8000-000000000001',
    repeat('b', 64),
    pg_catalog.clock_timestamp() + interval '1 day',
    null
  );

insert into public.refresh_token_families (
  id,
  user_id,
  channel,
  current_token_hash,
  created_at,
  last_used_at,
  absolute_expires_at,
  revoked_at
)
values
  (
    '80000000-0000-4000-8000-000000000011',
    '80000000-0000-4000-8000-000000000001',
    'website', repeat('c', 64),
    current_timestamp - interval '100 days',
    current_timestamp - interval '91 days',
    current_timestamp + interval '265 days',
    null
  ),
  (
    '80000000-0000-4000-8000-000000000012',
    '80000000-0000-4000-8000-000000000001',
    'extension', repeat('d', 64),
    current_timestamp - interval '1 day',
    current_timestamp - interval '1 hour',
    current_timestamp + interval '364 days',
    current_timestamp - interval '1 minute'
  ),
  (
    '80000000-0000-4000-8000-000000000013',
    '80000000-0000-4000-8000-000000000001',
    'website', repeat('e', 64),
    current_timestamp - interval '10 days',
    current_timestamp - interval '1 day',
    current_timestamp + interval '355 days',
    null
  ),
  (
    '80000000-0000-4000-8000-000000000014',
    '80000000-0000-4000-8000-000000000001',
    'website', repeat('1', 64),
    current_timestamp - interval '366 days',
    current_timestamp - interval '365 days',
    current_timestamp - interval '1 day',
    null
  );

insert into public.refresh_token_lineage (
  token_hash, family_id, successor_token_hash, used_at
)
values
  (
    repeat('f', 64),
    '80000000-0000-4000-8000-000000000012',
    repeat('d', 64),
    pg_catalog.clock_timestamp() - interval '1 hour'
  ),
  (
    repeat('0', 64),
    '80000000-0000-4000-8000-000000000013',
    repeat('e', 64),
    pg_catalog.clock_timestamp() - interval '1 day'
  );

truncate table auth_cleanup_results;
set role service_role;
select lives_ok(
  $$
    insert into auth_cleanup_results
    select * from public.cleanup_auth_artifacts_v1(100)
  $$,
  'service_role runs one bounded cleanup call'
);
set role postgres;

select results_eq(
  $$
    select
      extension_auth_codes_deleted,
      oauth_login_transactions_deleted,
      legacy_refresh_tokens_deleted,
      refresh_token_lineage_deleted,
      refresh_token_families_deleted,
      total_deleted
    from auth_cleanup_results
  $$,
  $$ values (1, 1, 2, 1, 3, 8) $$,
  'cleanup reports physical deletions from every eligible auth relation'
);

select is(
  (
    select pg_catalog.count(*)
    from public.extension_auth_codes
    where user_id = '80000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'cleanup deletes only the expired extension authorization code'
);
select is(
  (
    select pg_catalog.count(*)
    from public.oauth_login_transactions
    where state_hash in (repeat('5', 64), repeat('7', 64))
  ),
  1::bigint,
  'cleanup deletes only the expired OAuth login transaction'
);
select is(
  (
    select pg_catalog.count(*)
    from public.refresh_tokens
    where user_id = '80000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'cleanup deletes only expired or revoked legacy refresh rows'
);
select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_families
    where user_id = '80000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'cleanup preserves the active refresh family'
);
select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_families
    where id in (
      '80000000-0000-4000-8000-000000000011',
      '80000000-0000-4000-8000-000000000012',
      '80000000-0000-4000-8000-000000000014'
    )
  ),
  0::bigint,
  'cleanup deletes idle-expired, revoked, and absolute-expired families'
);
select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_lineage
    where family_id = '80000000-0000-4000-8000-000000000013'
  ),
  1::bigint,
  'cleanup preserves lineage belonging to an active refresh family'
);

insert into public.users (id, email, display_name)
values (
  '80000000-0000-4000-8000-000000000002',
  'auth-cleanup-bound@example.test',
  'Auth Cleanup Bound'
)
on conflict (id) do nothing;

insert into public.extension_auth_codes (
  user_id,
  code_hash,
  state_hash,
  extension_id,
  redirect_uri,
  code_challenge,
  code_challenge_method,
  created_at,
  expires_at
)
select
  '80000000-0000-4000-8000-000000000002',
  pg_catalog.lpad(pg_catalog.to_hex(100000 + item), 64, 'c'),
  pg_catalog.lpad(pg_catalog.to_hex(200000 + item), 64, 'd'),
  'ndkfphbchhfephdodcpehdcoclojagje',
  'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
  repeat('C', 43),
  'S256',
  current_timestamp - interval '6 minutes',
  current_timestamp - interval '1 minute'
from pg_catalog.generate_series(1, 25) as item;

insert into public.oauth_login_transactions (
  state_hash,
  browser_correlation_hash,
  provider,
  created_at,
  expires_at
)
select
  pg_catalog.lpad(pg_catalog.to_hex(300000 + item), 64, 'a'),
  pg_catalog.lpad(pg_catalog.to_hex(400000 + item), 64, 'b'),
  'google',
  pg_catalog.clock_timestamp() - interval '11 minutes',
  pg_catalog.clock_timestamp() - interval '1 minute'
from pg_catalog.generate_series(1, 25) as item;

insert into public.refresh_tokens (
  user_id, token_hash, expires_at, revoked_at
)
select
  '80000000-0000-4000-8000-000000000002',
  pg_catalog.lpad(pg_catalog.to_hex(500000 + item), 64, 'e'),
  pg_catalog.clock_timestamp() + interval '1 day',
  pg_catalog.clock_timestamp() - interval '1 minute'
from pg_catalog.generate_series(1, 25) as item;

insert into public.refresh_token_families (
  id,
  user_id,
  channel,
  current_token_hash,
  created_at,
  last_used_at,
  absolute_expires_at,
  revoked_at
)
select
  ('80000000-0000-4000-8000-' || pg_catalog.lpad(item::text, 12, '0'))::uuid,
  '80000000-0000-4000-8000-000000000002',
  'extension',
  pg_catalog.lpad(pg_catalog.to_hex(600000 + item), 64, 'f'),
  current_timestamp - interval '1 day',
  current_timestamp - interval '1 hour',
  current_timestamp + interval '364 days',
  current_timestamp - interval '1 minute'
from pg_catalog.generate_series(101, 125) as item;

insert into public.refresh_token_lineage (
  token_hash, family_id, successor_token_hash, used_at
)
select
  pg_catalog.lpad(pg_catalog.to_hex(700000 + item), 64, '0'),
  ('80000000-0000-4000-8000-' || pg_catalog.lpad(item::text, 12, '0'))::uuid,
  pg_catalog.lpad(pg_catalog.to_hex(600000 + item), 64, 'f'),
  pg_catalog.clock_timestamp() - interval '1 hour'
from pg_catalog.generate_series(101, 125) as item;

truncate table auth_cleanup_results;
set role service_role;
select lives_ok(
  $$
    insert into auth_cleanup_results
    select * from public.cleanup_auth_artifacts_v1()
  $$,
  'the scheduled no-input/default cleanup signature runs'
);
set role postgres;

select results_eq(
  $$
    select
      extension_auth_codes_deleted,
      oauth_login_transactions_deleted,
      legacy_refresh_tokens_deleted,
      refresh_token_lineage_deleted,
      refresh_token_families_deleted,
      total_deleted
    from auth_cleanup_results
  $$,
  $$ values (20, 20, 20, 20, 20, 100) $$,
  'one call fairly fills but never exceeds the 100-physical-row ceiling'
);

select is(
  (
    select
      (select pg_catalog.count(*) from public.extension_auth_codes
        where user_id = '80000000-0000-4000-8000-000000000002')
      + (select pg_catalog.count(*) from public.oauth_login_transactions
        where pg_catalog.left(state_hash, 55) = repeat('a', 55))
      + (select pg_catalog.count(*) from public.refresh_tokens
        where user_id = '80000000-0000-4000-8000-000000000002')
      + (select pg_catalog.count(*) from public.refresh_token_lineage
        where family_id in (
          select id from public.refresh_token_families
          where user_id = '80000000-0000-4000-8000-000000000002'
        ))
      + (select pg_catalog.count(*) from public.refresh_token_families
        where user_id = '80000000-0000-4000-8000-000000000002')
  ),
  25::bigint,
  'exactly 25 of the 125 eligible physical artifacts remain after the bounded call'
);

select is(
  (
    select pg_catalog.count(*)
    from public.refresh_token_families as family
    where family.user_id = '80000000-0000-4000-8000-000000000002'
      and not exists (
        select 1
        from public.refresh_token_lineage as lineage
        where lineage.family_id = family.id
      )
  ),
  0::bigint,
  'cleanup never deletes a family through an uncounted lineage cascade'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_extension as extension
    join pg_catalog.pg_available_extensions as available
      on available.name = extension.extname
    where extension.extname = 'pg_cron'
      and extension.extversion = available.default_version
  ),
  'pg_cron is installed at the project-supported default version'
);

select results_eq(
  $$
    select jobname, schedule, command, username, active
    from pg_temp.auth_cleanup_jobs()
  $$,
  $$
    values (
      'anidachi-auth-artifact-cleanup-hourly'::text,
      '0 * * * *'::text,
      'select public.cleanup_auth_artifacts_v1();'::text,
      'postgres'::text,
      true
    )
  $$,
  'one active hourly postgres-owned job calls the default bounded function'
);

select lives_ok(
  $$
    select cron.schedule(
      'anidachi-auth-artifact-cleanup-hourly',
      '0 * * * *',
      'select public.cleanup_auth_artifacts_v1();'
    )
  $$,
  'rescheduling the stable job name is repeatable'
);

select is(
  (
    select pg_catalog.count(*)
    from pg_temp.auth_cleanup_jobs()
  ),
  1::bigint,
  'repeat scheduling keeps exactly one same-named cleanup job'
);

select finish();
rollback;
