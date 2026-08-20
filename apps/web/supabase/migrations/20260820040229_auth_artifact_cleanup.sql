begin;

create extension if not exists pg_cron;

create index if not exists refresh_tokens_revoked_cleanup_idx
  on public.refresh_tokens (revoked_at, id)
  where revoked_at is not null;

create index if not exists refresh_token_families_idle_cleanup_idx
  on public.refresh_token_families (last_used_at, id)
  where revoked_at is null;

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
  if p_code_hash is null
    or p_code_hash !~ '^[0-9a-f]{64}$'
    or p_state_hash is null
    or p_state_hash !~ '^[0-9a-f]{64}$'
    or p_extension_id is null
    or p_extension_id !~ '^[a-p]{32}$'
    or p_redirect_uri is null
    or p_redirect_uri <> 'https://' || p_extension_id || '.chromiumapp.org/auth'
    or p_code_challenge is null
    or p_code_challenge !~ '^[A-Za-z0-9_-]{43}$'
  then
    return null;
  end if;

  delete from public.extension_auth_codes as auth_code
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

create or replace function public.cleanup_auth_artifacts_v1(
  p_batch_size integer default 100
)
returns table (
  extension_auth_codes_deleted integer,
  oauth_login_transactions_deleted integer,
  legacy_refresh_tokens_deleted integer,
  refresh_token_lineage_deleted integer,
  refresh_token_families_deleted integer,
  total_deleted integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_deleted integer;
  v_deleted_this_cycle boolean;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 100 then
    raise exception 'Invalid auth artifact cleanup batch size'
      using errcode = '22023';
  end if;

  extension_auth_codes_deleted := 0;
  oauth_login_transactions_deleted := 0;
  legacy_refresh_tokens_deleted := 0;
  refresh_token_lineage_deleted := 0;
  refresh_token_families_deleted := 0;
  total_deleted := 0;

  while total_deleted < p_batch_size loop
    v_deleted_this_cycle := false;

    if total_deleted < p_batch_size then
      with candidate as (
        select auth_code.id
        from public.extension_auth_codes as auth_code
        where auth_code.expires_at <= v_now
        order by auth_code.expires_at
        limit 1
        for update of auth_code skip locked
      )
      delete from public.extension_auth_codes as auth_code
      using candidate
      where auth_code.id = candidate.id;

      get diagnostics v_deleted = row_count;
      extension_auth_codes_deleted := extension_auth_codes_deleted + v_deleted;
      total_deleted := total_deleted + v_deleted;
      v_deleted_this_cycle := v_deleted_this_cycle or v_deleted > 0;
    end if;

    if total_deleted < p_batch_size then
      with candidate as (
        select login_transaction.id
        from public.oauth_login_transactions as login_transaction
        where login_transaction.expires_at <= v_now
        order by login_transaction.expires_at, login_transaction.id
        limit 1
        for update of login_transaction skip locked
      )
      delete from public.oauth_login_transactions as login_transaction
      using candidate
      where login_transaction.id = candidate.id;

      get diagnostics v_deleted = row_count;
      oauth_login_transactions_deleted := oauth_login_transactions_deleted + v_deleted;
      total_deleted := total_deleted + v_deleted;
      v_deleted_this_cycle := v_deleted_this_cycle or v_deleted > 0;
    end if;

    if total_deleted < p_batch_size then
      with revoked_candidate as materialized (
        select refresh_token.id, refresh_token.revoked_at as eligible_at
        from public.refresh_tokens as refresh_token
        where refresh_token.revoked_at is not null
        order by refresh_token.revoked_at, refresh_token.id
        limit 1
        for update of refresh_token skip locked
      ),
      expired_candidate as materialized (
        select refresh_token.id, refresh_token.expires_at as eligible_at
        from public.refresh_tokens as refresh_token
        where refresh_token.expires_at <= v_now
        order by refresh_token.expires_at
        limit 1
        for update of refresh_token skip locked
      ),
      candidate as (
        select candidate_pool.id
        from (
          select * from revoked_candidate
          union all
          select * from expired_candidate
        ) as candidate_pool
        order by candidate_pool.eligible_at, candidate_pool.id
        limit 1
      )
      delete from public.refresh_tokens as refresh_token
      using candidate
      where refresh_token.id = candidate.id;

      get diagnostics v_deleted = row_count;
      legacy_refresh_tokens_deleted := legacy_refresh_tokens_deleted + v_deleted;
      total_deleted := total_deleted + v_deleted;
      v_deleted_this_cycle := v_deleted_this_cycle or v_deleted > 0;
    end if;

    if total_deleted < p_batch_size then
      with revoked_candidate as materialized (
        select family.id, family.revoked_at as eligible_at
        from public.refresh_token_families as family
        where family.revoked_at is not null
        order by family.revoked_at, family.id
        limit 1
        for update of family skip locked
      ),
      absolute_candidate as materialized (
        select family.id, family.absolute_expires_at as eligible_at
        from public.refresh_token_families as family
        where family.absolute_expires_at <= v_now
        order by family.absolute_expires_at, family.id
        limit 1
        for update of family skip locked
      ),
      idle_candidate as materialized (
        select
          family.id,
          family.last_used_at + interval '90 days' as eligible_at
        from public.refresh_token_families as family
        where family.revoked_at is null
          and family.last_used_at <= v_now - interval '90 days'
        order by family.last_used_at, family.id
        limit 1
        for update of family skip locked
      ),
      candidate_pool as materialized (
        select distinct on (candidate.id)
          candidate.id,
          candidate.eligible_at
        from (
          select * from revoked_candidate
          union all
          select * from absolute_candidate
          union all
          select * from idle_candidate
        ) as candidate
        order by candidate.id, candidate.eligible_at
      ),
      selected_family as (
        select candidate_pool.id
        from candidate_pool
        cross join lateral (
            select true as has_lineage
            from public.refresh_token_lineage as lineage
            where lineage.family_id = candidate_pool.id
            limit 1
            offset 0
        ) as existing_lineage
        order by candidate_pool.eligible_at, candidate_pool.id
        limit 1
      ),
      candidate as (
        select lineage.token_hash
        from public.refresh_token_lineage as lineage
        join selected_family on selected_family.id = lineage.family_id
        order by lineage.used_at, lineage.token_hash
        limit 1
        for update of lineage skip locked
      )
      delete from public.refresh_token_lineage as lineage
      using candidate
      where lineage.token_hash = candidate.token_hash;

      get diagnostics v_deleted = row_count;
      refresh_token_lineage_deleted := refresh_token_lineage_deleted + v_deleted;
      total_deleted := total_deleted + v_deleted;
      v_deleted_this_cycle := v_deleted_this_cycle or v_deleted > 0;
    end if;

    if total_deleted < p_batch_size then
      with revoked_candidate as materialized (
        select family.id, family.revoked_at as eligible_at
        from public.refresh_token_families as family
        where family.revoked_at is not null
        order by family.revoked_at, family.id
        limit 1
        for update of family skip locked
      ),
      absolute_candidate as materialized (
        select family.id, family.absolute_expires_at as eligible_at
        from public.refresh_token_families as family
        where family.absolute_expires_at <= v_now
        order by family.absolute_expires_at, family.id
        limit 1
        for update of family skip locked
      ),
      idle_candidate as materialized (
        select
          family.id,
          family.last_used_at + interval '90 days' as eligible_at
        from public.refresh_token_families as family
        where family.revoked_at is null
          and family.last_used_at <= v_now - interval '90 days'
        order by family.last_used_at, family.id
        limit 1
        for update of family skip locked
      ),
      candidate_pool as materialized (
        select distinct on (candidate.id)
          candidate.id,
          candidate.eligible_at
        from (
          select * from revoked_candidate
          union all
          select * from absolute_candidate
          union all
          select * from idle_candidate
        ) as candidate
        order by candidate.id, candidate.eligible_at
      ),
      candidate as (
        select candidate_pool.id
        from candidate_pool
        left join lateral (
            select true as has_lineage
            from public.refresh_token_lineage as lineage
            where lineage.family_id = candidate_pool.id
            limit 1
            offset 0
        ) as existing_lineage on true
        where existing_lineage.has_lineage is null
        order by candidate_pool.eligible_at, candidate_pool.id
        limit 1
      )
      delete from public.refresh_token_families as family
      using candidate
      where family.id = candidate.id;

      get diagnostics v_deleted = row_count;
      refresh_token_families_deleted := refresh_token_families_deleted + v_deleted;
      total_deleted := total_deleted + v_deleted;
      v_deleted_this_cycle := v_deleted_this_cycle or v_deleted > 0;
    end if;

    exit when not v_deleted_this_cycle;
  end loop;

  return next;
end;
$$;

revoke all on function public.cleanup_auth_artifacts_v1(integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_auth_artifacts_v1(integer)
  to service_role;

select cron.schedule(
  'anidachi-auth-artifact-cleanup-hourly',
  '0 * * * *',
  'select public.cleanup_auth_artifacts_v1();'
);

commit;
