begin;

create table public.oauth_login_transactions (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  browser_correlation_hash text not null,
  provider text not null,
  return_to text not null default '',
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint oauth_login_transactions_state_hash_check
    check (state_hash ~ '^[0-9a-f]{64}$'),
  constraint oauth_login_transactions_correlation_hash_check
    check (browser_correlation_hash ~ '^[0-9a-f]{64}$'),
  constraint oauth_login_transactions_provider_check
    check (provider in ('discord', 'google')),
  constraint oauth_login_transactions_return_to_check
    check (
      return_to = ''
      or (
        pg_catalog.left(return_to, 1) = '/'
        and pg_catalog.left(return_to, 2) <> '//'
        and return_to not like '/api/%'
        and return_to not like '/_next/%'
        and return_to not like '/__anidachi/%'
      )
    ),
  constraint oauth_login_transactions_expiry_check
    check (expires_at > created_at),
  constraint oauth_login_transactions_consumed_check
    check (consumed_at is null or consumed_at >= created_at)
);

create index oauth_login_transactions_cleanup_idx
  on public.oauth_login_transactions (expires_at, id);

alter table public.oauth_login_transactions enable row level security;

revoke all on table public.oauth_login_transactions
  from public, anon, authenticated;
grant select, insert, update, delete on table public.oauth_login_transactions
  to service_role;

create or replace function public.create_oauth_login_transaction_v1(
  p_state_hash text,
  p_browser_correlation_hash text,
  p_provider text,
  p_return_to text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_created_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_state_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid OAuth state hash';
  end if;
  if p_browser_correlation_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid OAuth browser correlation hash';
  end if;
  if p_provider not in ('discord', 'google') then
    raise exception 'Invalid OAuth provider';
  end if;

  insert into public.oauth_login_transactions (
    state_hash,
    browser_correlation_hash,
    provider,
    return_to,
    created_at,
    expires_at
  )
  values (
    p_state_hash,
    p_browser_correlation_hash,
    p_provider,
    p_return_to,
    v_created_at,
    v_created_at + interval '10 minutes'
  );
end;
$$;

create or replace function public.consume_oauth_login_transaction_v1(
  p_state_hash text,
  p_browser_correlation_hash text,
  p_provider text
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_consumed_at timestamptz := pg_catalog.clock_timestamp();
  v_return_to text;
begin
  if p_state_hash !~ '^[0-9a-f]{64}$'
    or p_browser_correlation_hash !~ '^[0-9a-f]{64}$'
    or p_provider not in ('discord', 'google')
  then
    return null;
  end if;

  update public.oauth_login_transactions as login_transaction
  set consumed_at = v_consumed_at
  where login_transaction.state_hash = p_state_hash
    and login_transaction.browser_correlation_hash = p_browser_correlation_hash
    and login_transaction.provider = p_provider
    and login_transaction.consumed_at is null
    and login_transaction.expires_at > v_consumed_at
  returning login_transaction.return_to into v_return_to;

  return v_return_to;
end;
$$;

revoke all on function public.create_oauth_login_transaction_v1(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_oauth_login_transaction_v1(text, text, text, text)
  to service_role;

revoke all on function public.consume_oauth_login_transaction_v1(text, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_oauth_login_transaction_v1(text, text, text)
  to service_role;

commit;
