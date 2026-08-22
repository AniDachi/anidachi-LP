begin;

-- Task 4 caps video fingerprints at 400 characters. The canonical identity
-- bounds below subtract the fixed `youtube|` and `crunchyroll|watch/` prefixes.
-- SQL validates only those already-canonical forms; it does not normalize URLs.
alter table public.rooms
  add column source_provider text,
  add column source_generation bigint,
  add constraint rooms_source_tuple_check
    check (
      (
        source_provider is null
        and source_generation is null
      )
      or (
        source_provider in ('crunchyroll', 'youtube')
        and source_generation between 1 and 9007199254740991
        and source_url is not null
        and source_url = pg_catalog.btrim(source_url)
        and pg_catalog.char_length(source_url) between 1 and 2048
      )
    ),
  add constraint rooms_source_url_canonical_check
    check (
      source_provider is null
      or (
        source_provider = 'youtube'
        and source_url
          ~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]+$'
        and pg_catalog.char_length(
          pg_catalog.substring(
            source_url,
            '^https://www[.]youtube[.]com/watch[?]v=([A-Za-z0-9_-]+)$'
          )
        ) between 6 and 392
      )
      or (
        source_provider = 'crunchyroll'
        and source_url
          ~ '^https://www[.]crunchyroll[.]com/watch/[A-Za-z0-9_-]+$'
        and pg_catalog.char_length(
          pg_catalog.substring(
            source_url,
            '^https://www[.]crunchyroll[.]com/watch/([A-Za-z0-9_-]+)$'
          )
        ) between 1 and 382
      )
    );

create function public.persist_room_source_v1(
  p_room_id text,
  p_source_provider text,
  p_source_url text,
  p_source_generation bigint
)
returns table (
  -- This is the database form of RoomSourcePersistenceAcknowledgementSchema.
  -- The generation always echoes the callback so Task 5B can clear only the
  -- matching pending Worker snapshot, including a stale acknowledgement.
  outcome text,
  source_generation bigint
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
begin
  if p_room_id is null
    or p_room_id <> pg_catalog.btrim(p_room_id)
    or pg_catalog.char_length(p_room_id) not between 1 and 128
    or p_source_provider is null
    or p_source_provider not in ('crunchyroll', 'youtube')
    or p_source_url is null
    or p_source_url <> pg_catalog.btrim(p_source_url)
    or pg_catalog.char_length(p_source_url) not between 1 and 2048
    or p_source_generation is null
    or p_source_generation not between 1 and 9007199254740991
  then
    raise exception 'room_source_invalid_input' using errcode = '22023';
  end if;

  if not (
    (
      p_source_provider = 'youtube'
      and p_source_url
        ~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]+$'
      and pg_catalog.char_length(
        pg_catalog.substring(
          p_source_url,
          '^https://www[.]youtube[.]com/watch[?]v=([A-Za-z0-9_-]+)$'
        )
      ) between 6 and 392
    )
    or (
      p_source_provider = 'crunchyroll'
      and p_source_url
        ~ '^https://www[.]crunchyroll[.]com/watch/[A-Za-z0-9_-]+$'
      and pg_catalog.char_length(
        pg_catalog.substring(
          p_source_url,
          '^https://www[.]crunchyroll[.]com/watch/([A-Za-z0-9_-]+)$'
        )
      ) between 1 and 382
    )
  ) then
    raise exception 'room_source_invalid_input' using errcode = '22023';
  end if;

  select room.*
  into v_room
  from public.rooms as room
  where room.room_id = p_room_id
  for update;

  if not found then
    raise exception 'room_source_not_found' using errcode = 'P0002';
  end if;

  if v_room.status = 'ended' then
    raise exception 'room_source_ended' using errcode = '55000';
  end if;

  if v_room.source_generation is null then
    update public.rooms as room
    set
      source_provider = p_source_provider,
      source_url = p_source_url,
      source_generation = p_source_generation
    where room.id = v_room.id;

    return query select 'persisted'::text, p_source_generation;
    return;
  end if;

  if p_source_generation < v_room.source_generation then
    return query select 'stale'::text, p_source_generation;
    return;
  end if;

  if p_source_generation = v_room.source_generation then
    if p_source_provider <> v_room.source_provider
      or p_source_url <> v_room.source_url
    then
      raise exception 'room_source_generation_conflict' using errcode = '23514';
    end if;

    return query select 'persisted'::text, p_source_generation;
    return;
  end if;

  if p_source_provider <> v_room.source_provider then
    raise exception 'room_source_provider_conflict' using errcode = '23514';
  end if;

  update public.rooms as room
  set
    source_url = p_source_url,
    source_generation = p_source_generation
  where room.id = v_room.id;

  return query select 'persisted'::text, p_source_generation;
end;
$$;

revoke all on function public.persist_room_source_v1(text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.persist_room_source_v1(text, text, text, bigint)
  to service_role;

commit;
