create extension if not exists pgtap with schema extensions;

begin;

set role postgres;
set search_path = public, extensions;
select no_plan();

select ok(
  pg_catalog.to_regclass('public.oauth_login_transactions') is not null,
  'OAuth login transactions have a dedicated durable relation'
);

select ok(
  (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = pg_catalog.to_regclass('public.oauth_login_transactions')
  )
  and not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'oauth_login_transactions'
  ),
  'OAuth login transactions enable RLS and expose no browser policy'
);

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.oauth_login_transactions',
    'select'
  )
  and not pg_catalog.has_table_privilege(
    'anon',
    'public.oauth_login_transactions',
    'select'
  )
  and pg_catalog.has_table_privilege(
    'service_role',
    'public.oauth_login_transactions',
    'select,insert,update,delete'
  ),
  'only service_role can access OAuth transaction rows'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.create_oauth_login_transaction_v1(text,text,text,text)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'service_role',
    'public.consume_oauth_login_transaction_v1(text,text,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_oauth_login_transaction_v1(text,text,text,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.consume_oauth_login_transaction_v1(text,text,text)',
    'execute'
  ),
  'only service_role can create or consume OAuth login transactions'
);

select ok(
  (
    select not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.consume_oauth_login_transaction_v1(text,text,text)'::regprocedure
  )
  and (
    select not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.create_oauth_login_transaction_v1(text,text,text,text)'::regprocedure
  ),
  'both OAuth transaction RPCs are security invoker with an empty search_path'
);

select is(
  (
    select pg_catalog.string_agg(column_name, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'oauth_login_transactions'
  ),
  'id,state_hash,browser_correlation_hash,provider,return_to,created_at,expires_at,consumed_at',
  'the table stores hashes and lifecycle metadata, never raw state or PKCE material'
);

delete from public.oauth_login_transactions
where state_hash in (
  repeat('a', 64),
  repeat('b', 64),
  repeat('c', 64),
  repeat('d', 64)
);

set role service_role;
select lives_ok(
  $$
    select public.create_oauth_login_transaction_v1(
      repeat('a', 64),
      repeat('1', 64),
      'google',
      '/account'
    )
  $$,
  'service_role creates a Google login transaction'
);
set role postgres;

select is(
  (
    select expires_at - created_at
    from public.oauth_login_transactions
    where state_hash = repeat('a', 64)
  ),
  interval '10 minutes',
  'the database owns the exact ten-minute transaction lifetime'
);

select is(
  (
    select provider || ':' || return_to
    from public.oauth_login_transactions
    where state_hash = repeat('a', 64)
  ),
  'google:/account',
  'the durable row binds provider and sanitized return path'
);

set role service_role;
select is(
  public.consume_oauth_login_transaction_v1(
    repeat('a', 64),
    repeat('1', 64),
    'discord'
  ),
  null::text,
  'a cross-provider swap cannot consume the transaction'
);
select is(
  public.consume_oauth_login_transaction_v1(
    repeat('a', 64),
    repeat('1', 64),
    'google'
  ),
  '/account'::text,
  'the exact provider, state hash, and browser correlation consume once'
);
select is(
  public.consume_oauth_login_transaction_v1(
    repeat('a', 64),
    repeat('1', 64),
    'google'
  ),
  null::text,
  'a callback replay cannot consume the same transaction again'
);
set role postgres;

set role service_role;
select public.create_oauth_login_transaction_v1(
  repeat('b', 64),
  repeat('2', 64),
  'google',
  '/account/one'
);
select public.create_oauth_login_transaction_v1(
  repeat('c', 64),
  repeat('3', 64),
  'google',
  '/account/two'
);
set role postgres;

select is(
  (
    select pg_catalog.count(*)
    from public.oauth_login_transactions
    where state_hash in (repeat('b', 64), repeat('c', 64))
      and consumed_at is null
  ),
  2::bigint,
  'two concurrent browser tabs keep independent live transactions'
);

insert into public.oauth_login_transactions (
  state_hash,
  browser_correlation_hash,
  provider,
  return_to,
  created_at,
  expires_at
)
values (
  repeat('d', 64),
  repeat('4', 64),
  'discord',
  '/account',
  pg_catalog.clock_timestamp() - interval '11 minutes',
  pg_catalog.clock_timestamp() - interval '1 minute'
);

set role service_role;
select is(
  public.consume_oauth_login_transaction_v1(
    repeat('d', 64),
    repeat('4', 64),
    'discord'
  ),
  null::text,
  'an expired transaction cannot be consumed'
);
set role postgres;

select throws_like(
  $$
    select public.create_oauth_login_transaction_v1(
      'short-state-hash',
      repeat('5', 64),
      'google',
      '/account'
    )
  $$,
  '%OAuth state hash%',
  'malformed hashes are rejected by the database boundary'
);

select finish();
rollback;
