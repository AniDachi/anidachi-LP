begin;

-- Pre-release cutover: no legacy code may survive without exact client and PKCE
-- bindings. These rows are short-lived test authorization artifacts only.
delete from public.extension_auth_codes;

alter table public.extension_auth_codes
  add column extension_id text not null,
  add column code_challenge text not null,
  add column code_challenge_method text not null,
  add constraint extension_auth_codes_code_hash_check
    check (code_hash ~ '^[0-9a-f]{64}$'),
  add constraint extension_auth_codes_state_hash_check
    check (state_hash ~ '^[0-9a-f]{64}$'),
  add constraint extension_auth_codes_extension_id_check
    check (extension_id ~ '^[a-p]{32}$'),
  add constraint extension_auth_codes_redirect_uri_check
    check (
      redirect_uri = 'https://' || extension_id || '.chromiumapp.org/auth'
    ),
  add constraint extension_auth_codes_code_challenge_check
    check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  add constraint extension_auth_codes_code_challenge_method_check
    check (code_challenge_method = 'S256'),
  add constraint extension_auth_codes_expiry_check
    check (expires_at > created_at),
  add constraint extension_auth_codes_consumed_check
    check (consumed_at is null or consumed_at >= created_at);

alter table public.extension_auth_codes enable row level security;

revoke all on table public.extension_auth_codes
  from public, anon, authenticated;
grant select, insert, update, delete on table public.extension_auth_codes
  to service_role;

create or replace function public.create_extension_auth_code_v1(
  p_user_id uuid,
  p_code_hash text,
  p_state_hash text,
  p_extension_id text,
  p_redirect_uri text,
  p_code_challenge text,
  p_code_challenge_method text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_created_at timestamptz := pg_catalog.clock_timestamp();
begin
  if p_code_hash !~ '^[0-9a-f]{64}$'
    or p_state_hash !~ '^[0-9a-f]{64}$'
    or p_extension_id !~ '^[a-p]{32}$'
    or p_redirect_uri <> 'https://' || p_extension_id || '.chromiumapp.org/auth'
    or p_code_challenge !~ '^[A-Za-z0-9_-]{43}$'
    or p_code_challenge_method <> 'S256'
  then
    raise exception 'Invalid extension authorization code binding';
  end if;

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
  values (
    p_user_id,
    p_code_hash,
    p_state_hash,
    p_extension_id,
    p_redirect_uri,
    p_code_challenge,
    p_code_challenge_method,
    v_created_at,
    v_created_at + interval '5 minutes'
  );
end;
$$;

create or replace function public.consume_extension_auth_code_v1(
  p_code_hash text,
  p_state_hash text,
  p_extension_id text,
  p_redirect_uri text,
  p_code_challenge text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_consumed_at timestamptz := pg_catalog.clock_timestamp();
  v_user_id uuid;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$'
    or p_state_hash !~ '^[0-9a-f]{64}$'
    or p_extension_id !~ '^[a-p]{32}$'
    or p_redirect_uri <> 'https://' || p_extension_id || '.chromiumapp.org/auth'
    or p_code_challenge !~ '^[A-Za-z0-9_-]{43}$'
  then
    return null;
  end if;

  update public.extension_auth_codes as auth_code
  set consumed_at = v_consumed_at
  where auth_code.code_hash = p_code_hash
    and auth_code.state_hash = p_state_hash
    and auth_code.extension_id = p_extension_id
    and auth_code.redirect_uri = p_redirect_uri
    and auth_code.code_challenge = p_code_challenge
    and auth_code.code_challenge_method = 'S256'
    and auth_code.consumed_at is null
    and auth_code.expires_at > v_consumed_at
  returning auth_code.user_id into v_user_id;

  return v_user_id;
end;
$$;

revoke all on function public.create_extension_auth_code_v1(
  uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_extension_auth_code_v1(
  uuid, text, text, text, text, text, text
) to service_role;

revoke all on function public.consume_extension_auth_code_v1(
  text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.consume_extension_auth_code_v1(
  text, text, text, text, text
) to service_role;

commit;
