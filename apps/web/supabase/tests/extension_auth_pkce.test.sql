create extension if not exists pgtap with schema extensions;

begin;

set role postgres;
set search_path = public, extensions;
select no_plan();

select ok(
  (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = pg_catalog.to_regclass('public.extension_auth_codes')
  )
  and not exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'extension_auth_codes'
  ),
  'extension authorization codes enable RLS and expose no browser policy'
);

select ok(
  not pg_catalog.has_table_privilege(
    'authenticated',
    'public.extension_auth_codes',
    'select'
  )
  and not pg_catalog.has_table_privilege(
    'anon',
    'public.extension_auth_codes',
    'select'
  )
  and pg_catalog.has_table_privilege(
    'service_role',
    'public.extension_auth_codes',
    'select,insert,update,delete'
  ),
  'only service_role can access extension authorization code rows'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.create_extension_auth_code_v1(uuid,text,text,text,text,text,text)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'service_role',
    'public.consume_extension_auth_code_v1(text,text,text,text,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_extension_auth_code_v1(uuid,text,text,text,text,text,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.consume_extension_auth_code_v1(text,text,text,text,text)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.consume_extension_auth_code_v1(text,text,text,text,text)',
    'execute'
  ),
  'both extension authorization RPCs are service-role-only'
);

select ok(
  (
    select not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.create_extension_auth_code_v1(uuid,text,text,text,text,text,text)'::regprocedure
  )
  and (
    select not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']::text[]
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'public.consume_extension_auth_code_v1(text,text,text,text,text)'::regprocedure
  ),
  'both extension authorization RPCs are security invoker with an empty search_path'
);

select is(
  (
    select pg_catalog.string_agg(column_name, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'extension_auth_codes'
      and column_name in ('code', 'state', 'code_verifier', 'verifier')
  ),
  null::text,
  'the durable relation stores no raw code, state, or PKCE verifier'
);

insert into public.users (id, email, display_name)
values (
  '00000000-0000-4000-8000-000000000006',
  'extension-pkce-test@example.com',
  'Extension PKCE Test'
)
on conflict (id) do nothing;

set role service_role;
select lives_ok(
  $$
    insert into public.extension_auth_codes (
      user_id, code_hash, state_hash, redirect_uri, expires_at
    ) values (
      '00000000-0000-4000-8000-000000000006',
      repeat('1', 64), repeat('2', 64),
      'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
      pg_catalog.clock_timestamp() + interval '5 minutes'
    )
  $$,
  'migration-first cutover preserves the legacy direct-insert shape'
);
select is(
  public.consume_extension_auth_code_v1(
    repeat('1', 64), repeat('2', 64),
    'ndkfphbchhfephdodcpehdcoclojagje',
    'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
    repeat('c', 43)
  ),
  null::uuid,
  'the bound RPC cannot consume a preserved legacy row'
);
set role postgres;

select is(
  (
    select pg_catalog.count(*)
    from public.extension_auth_codes
    where code_hash = repeat('1', 64)
      and extension_id is null
      and code_challenge is null
      and code_challenge_method is null
  ),
  1::bigint,
  'the legacy row survives with nullable binding fields'
);

set role service_role;
select throws_like(
  $$
    insert into public.extension_auth_codes (
      user_id, code_hash, state_hash, extension_id, redirect_uri,
      code_challenge, code_challenge_method, created_at, expires_at
    ) values (
      '00000000-0000-4000-8000-000000000006',
      repeat('3', 64), repeat('4', 64),
      'ndkfphbchhfephdodcpehdcoclojagje',
      'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
      repeat('c', 43), 'S256',
      '2100-01-01 00:00:00+00', '2100-01-01 00:06:00+00'
    )
  $$,
  '%extension_auth_codes_expiry_check%',
  'a fully bound row cannot exceed the database-owned five-minute lifetime'
);
select lives_ok(
  $$
    insert into public.extension_auth_codes (
      user_id, code_hash, state_hash, extension_id, redirect_uri,
      code_challenge, code_challenge_method, created_at, expires_at
    ) values (
      '00000000-0000-4000-8000-000000000006',
      repeat('5', 64), repeat('6', 64),
      'ndkfphbchhfephdodcpehdcoclojagje',
      'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
      repeat('d', 43), 'S256',
      '2000-01-01 00:00:00+00', '2000-01-01 00:05:00+00'
    )
  $$,
  'an already-expired bound fixture remains structurally valid'
);
select is(
  public.consume_extension_auth_code_v1(
    repeat('5', 64), repeat('6', 64),
    'ndkfphbchhfephdodcpehdcoclojagje',
    'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
    repeat('d', 43)
  ),
  null::uuid,
  'an expired fully bound code cannot be consumed'
);
set role postgres;

set role service_role;
select lives_ok(
  $$
    select public.create_extension_auth_code_v1(
      '00000000-0000-4000-8000-000000000006',
      repeat('a', 64),
      repeat('b', 64),
      'ndkfphbchhfephdodcpehdcoclojagje',
      'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
      repeat('c', 43),
      'S256'
    )
  $$,
  'service_role creates one exactly-bound S256 authorization code'
);
set role postgres;

select is(
  (
    select expires_at - created_at
    from public.extension_auth_codes
    where code_hash = repeat('a', 64)
  ),
  interval '5 minutes',
  'the database owns the exact five-minute authorization code lifetime'
);

select is(
  (
    select extension_id || ':' || redirect_uri || ':' || code_challenge_method
    from public.extension_auth_codes
    where code_hash = repeat('a', 64)
  ),
  'ndkfphbchhfephdodcpehdcoclojagje:https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth:S256',
  'the row binds the exact client, redirect URI, and S256 method'
);

set role service_role;
select is(
  public.consume_extension_auth_code_v1(
    repeat('a', 64), repeat('b', 64),
    'nkinhhgigcflmfhilmcakbkongcpkfnl',
    'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
    repeat('c', 43)
  ),
  null::uuid,
  'the wrong client cannot consume the code'
);
select is(
  public.consume_extension_auth_code_v1(
    repeat('a', 64), repeat('b', 64),
    'ndkfphbchhfephdodcpehdcoclojagje',
    'https://nkinhhgigcflmfhilmcakbkongcpkfnl.chromiumapp.org/auth',
    repeat('c', 43)
  ),
  null::uuid,
  'the wrong redirect cannot consume the code'
);
select is(
  public.consume_extension_auth_code_v1(
    repeat('a', 64), repeat('z', 64),
    'ndkfphbchhfephdodcpehdcoclojagje',
    'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
    repeat('c', 43)
  ),
  null::uuid,
  'the wrong state cannot consume the code'
);
select is(
  public.consume_extension_auth_code_v1(
    repeat('a', 64), repeat('b', 64),
    'ndkfphbchhfephdodcpehdcoclojagje',
    'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
    repeat('d', 43)
  ),
  null::uuid,
  'the wrong PKCE challenge cannot consume the code'
);
select is(
  public.consume_extension_auth_code_v1(
    repeat('a', 64), repeat('b', 64),
    'ndkfphbchhfephdodcpehdcoclojagje',
    'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
    repeat('c', 43)
  ),
  '00000000-0000-4000-8000-000000000006'::uuid,
  'the exact client, redirect, state, and challenge consume atomically'
);
select is(
  public.consume_extension_auth_code_v1(
    repeat('a', 64), repeat('b', 64),
    'ndkfphbchhfephdodcpehdcoclojagje',
    'https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org/auth',
    repeat('c', 43)
  ),
  null::uuid,
  'authorization code replay is rejected'
);
set role postgres;

select is(
  (
    select pg_catalog.count(*)
    from public.extension_auth_codes
    where code_hash = repeat('a', 64)
      and consumed_at is not null
  ),
  1::bigint,
  'paired consume attempts leave exactly one durable consumed row'
);

select throws_like(
  $$
    select public.create_extension_auth_code_v1(
      '00000000-0000-4000-8000-000000000006',
      repeat('e', 64), repeat('f', 64),
      'ndkfphbchhfephdodcpehdcoclojagje',
      'https://attacker.chromiumapp.org/auth',
      repeat('g', 43), 'S256'
    )
  $$,
  '%Invalid extension authorization code binding%',
  'the database rejects a mismatched redirect binding'
);

select finish();
rollback;
