begin;

-- Migration-first cutover: the old runtime keeps its exact legacy table shape
-- and ignores this nullable metadata. Rows present now are marked revoked for
-- the later bounded cleanup task; rows written by an overlapping old instance
-- remain structurally valid but are never read by the new runtime.
alter table public.refresh_tokens
  add column revoked_at timestamptz;

update public.refresh_tokens
set revoked_at = pg_catalog.clock_timestamp()
where revoked_at is null;

create table public.refresh_token_families (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  channel text not null,
  device_id uuid references public.devices (id) on delete set null,
  current_token_hash text not null,
  created_at timestamptz not null,
  last_used_at timestamptz not null,
  absolute_expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint refresh_token_families_channel_check
    check (channel in ('website', 'extension')),
  constraint refresh_token_families_current_hash_check
    check (current_token_hash ~ '^[0-9a-f]{64}$'),
  constraint refresh_token_families_lifecycle_check
    check (
      last_used_at >= created_at
      and absolute_expires_at = created_at + interval '365 days'
      and (revoked_at is null or revoked_at >= created_at)
    )
);

create table public.refresh_token_lineage (
  token_hash text primary key,
  family_id uuid not null
    references public.refresh_token_families (id) on delete cascade,
  successor_token_hash text not null,
  used_at timestamptz not null,
  constraint refresh_token_lineage_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint refresh_token_lineage_successor_hash_check
    check (successor_token_hash ~ '^[0-9a-f]{64}$'),
  constraint refresh_token_lineage_distinct_hashes_check
    check (token_hash <> successor_token_hash)
);

create unique index refresh_token_families_current_hash_idx
  on public.refresh_token_families (current_token_hash);

create index refresh_token_families_user_channel_active_idx
  on public.refresh_token_families (user_id, channel, id)
  where revoked_at is null;

create index refresh_token_families_absolute_cleanup_idx
  on public.refresh_token_families (absolute_expires_at, id);

create index refresh_token_families_revoked_cleanup_idx
  on public.refresh_token_families (revoked_at, id)
  where revoked_at is not null;

create index refresh_token_lineage_family_idx
  on public.refresh_token_lineage (family_id, used_at, token_hash);

alter table public.refresh_token_families enable row level security;
alter table public.refresh_token_lineage enable row level security;

revoke all on table public.refresh_token_families
  from public, anon, authenticated;
revoke all on table public.refresh_token_lineage
  from public, anon, authenticated;
grant select, insert, update, delete on table public.refresh_token_families
  to service_role;
grant select, insert, update, delete on table public.refresh_token_lineage
  to service_role;

create function public.create_refresh_token_family_v1(
  p_user_id uuid,
  p_channel text,
  p_token_hash text,
  p_device_id uuid default null,
  p_now timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, pg_catalog.clock_timestamp());
  v_family_id uuid;
begin
  if p_channel is null
    or p_channel not in ('website', 'extension')
    or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid refresh family input';
  end if;

  if p_device_id is not null
    and not exists (
      select 1
      from public.devices as device
      where device.id = p_device_id
        and device.user_id = p_user_id
        and device.revoked_at is null
    )
  then
    raise exception 'Invalid refresh family device binding';
  end if;

  if exists (
    select 1
    from public.refresh_token_families as family
    where family.current_token_hash = p_token_hash
  )
    or exists (
      select 1
      from public.refresh_token_lineage as lineage
      where lineage.token_hash = p_token_hash
        or lineage.successor_token_hash = p_token_hash
    )
  then
    raise exception 'Refresh token hash already exists';
  end if;

  insert into public.refresh_token_families (
    user_id,
    channel,
    device_id,
    current_token_hash,
    created_at,
    last_used_at,
    absolute_expires_at
  )
  values (
    p_user_id,
    p_channel,
    p_device_id,
    p_token_hash,
    v_now,
    v_now,
    v_now + interval '365 days'
  )
  returning id into v_family_id;

  return v_family_id;
end;
$$;

create function public.resolve_refresh_token_family_v1(
  p_token_hash text,
  p_channel text,
  p_now timestamptz default null
)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select family.user_id
  from public.refresh_token_families as family
  where family.current_token_hash = p_token_hash
    and family.channel = p_channel
    and family.revoked_at is null
    and coalesce(p_now, pg_catalog.clock_timestamp())
      < family.last_used_at + interval '90 days'
    and coalesce(p_now, pg_catalog.clock_timestamp())
      < family.absolute_expires_at
  limit 1
$$;

create function public.rotate_refresh_token_family_v1(
  p_token_hash text,
  p_successor_token_hash text,
  p_channel text,
  p_now timestamptz default null
)
returns table (
  rotation_outcome text,
  user_id uuid,
  family_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, pg_catalog.clock_timestamp());
  v_family public.refresh_token_families%rowtype;
  v_family_id uuid;
  v_lineage public.refresh_token_lineage%rowtype;
begin
  if p_channel is null
    or p_channel not in ('website', 'extension')
    or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_successor_token_hash is null
    or p_successor_token_hash !~ '^[0-9a-f]{64}$'
  then
    return query select 'invalid'::text, null::uuid, null::uuid;
    return;
  end if;

  select family.id
  into v_family_id
  from public.refresh_token_families as family
  where family.channel = p_channel
    and (
      family.current_token_hash = p_token_hash
      or exists (
        select 1
        from public.refresh_token_lineage as lineage
        where lineage.family_id = family.id
          and lineage.token_hash = p_token_hash
      )
    )
  limit 1;

  if v_family_id is null then
    return query select 'invalid'::text, null::uuid, null::uuid;
    return;
  end if;

  select family.*
  into v_family
  from public.refresh_token_families as family
  where family.id = v_family_id
  for update;

  if v_family.revoked_at is not null then
    return query select 'invalid'::text, null::uuid, v_family.id;
    return;
  end if;

  if v_now >= v_family.last_used_at + interval '90 days'
    or v_now >= v_family.absolute_expires_at
  then
    update public.refresh_token_families as family
    set revoked_at = v_now
    where family.id = v_family.id
      and family.revoked_at is null;

    return query select 'invalid'::text, null::uuid, v_family.id;
    return;
  end if;

  if v_family.current_token_hash = p_token_hash then
    if p_successor_token_hash = p_token_hash
      or exists (
        select 1
        from public.refresh_token_families as family
        where family.current_token_hash = p_successor_token_hash
      )
      or exists (
        select 1
        from public.refresh_token_lineage as lineage
        where lineage.token_hash = p_successor_token_hash
          or lineage.successor_token_hash = p_successor_token_hash
      )
    then
      return query select 'invalid'::text, null::uuid, v_family.id;
      return;
    end if;

    insert into public.refresh_token_lineage (
      token_hash,
      family_id,
      successor_token_hash,
      used_at
    )
    values (
      p_token_hash,
      v_family.id,
      p_successor_token_hash,
      v_now
    );

    update public.refresh_token_families as family
    set
      current_token_hash = p_successor_token_hash,
      last_used_at = v_now
    where family.id = v_family.id;

    return query select 'rotated'::text, v_family.user_id, v_family.id;
    return;
  end if;

  select lineage.*
  into v_lineage
  from public.refresh_token_lineage as lineage
  where lineage.family_id = v_family.id
    and lineage.token_hash = p_token_hash;

  if v_lineage.token_hash is null then
    return query select 'invalid'::text, null::uuid, v_family.id;
    return;
  end if;

  if v_now < v_lineage.used_at + interval '10 seconds'
    and v_lineage.successor_token_hash = v_family.current_token_hash
    and p_successor_token_hash = v_lineage.successor_token_hash
  then
    return query select 'reused'::text, v_family.user_id, v_family.id;
    return;
  end if;

  update public.refresh_token_families as family
  set revoked_at = v_now
  where family.id = v_family.id
    and family.revoked_at is null;

  return query select 'replayed'::text, null::uuid, v_family.id;
end;
$$;

create function public.revoke_refresh_token_family_v1(
  p_token_hash text,
  p_channel text,
  p_now timestamptz default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := coalesce(p_now, pg_catalog.clock_timestamp());
  v_family_id uuid;
begin
  if p_channel is null
    or p_channel not in ('website', 'extension')
    or p_token_hash is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
  then
    return false;
  end if;

  select family.id
  into v_family_id
  from public.refresh_token_families as family
  where family.channel = p_channel
    and (
      family.current_token_hash = p_token_hash
      or exists (
        select 1
        from public.refresh_token_lineage as lineage
        where lineage.family_id = family.id
          and lineage.token_hash = p_token_hash
      )
    )
  limit 1
  for update;

  if v_family_id is null then
    return false;
  end if;

  update public.refresh_token_families as family
  set revoked_at = coalesce(family.revoked_at, v_now)
  where family.id = v_family_id;

  return true;
end;
$$;

create function public.revoke_refresh_token_families_for_user_v1(
  p_user_id uuid,
  p_now timestamptz default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.refresh_token_families as family
  set revoked_at = coalesce(
    family.revoked_at,
    coalesce(p_now, pg_catalog.clock_timestamp())
  )
  where family.user_id = p_user_id
    and family.revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.create_refresh_token_family_v1(
  uuid, text, text, uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.create_refresh_token_family_v1(
  uuid, text, text, uuid, timestamptz
) to service_role;

revoke all on function public.resolve_refresh_token_family_v1(
  text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.resolve_refresh_token_family_v1(
  text, text, timestamptz
) to service_role;

revoke all on function public.rotate_refresh_token_family_v1(
  text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.rotate_refresh_token_family_v1(
  text, text, text, timestamptz
) to service_role;

revoke all on function public.revoke_refresh_token_family_v1(
  text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.revoke_refresh_token_family_v1(
  text, text, timestamptz
) to service_role;

revoke all on function public.revoke_refresh_token_families_for_user_v1(
  uuid, timestamptz
) from public, anon, authenticated;
grant execute on function public.revoke_refresh_token_families_for_user_v1(
  uuid, timestamptz
) to service_role;

commit;
