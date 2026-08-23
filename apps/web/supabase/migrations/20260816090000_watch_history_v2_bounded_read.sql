begin;

-- Both history writers lock/update user_watch_settings before progress or
-- participant rows. Take the same leading lock so in-flight writers drain,
-- later writers wait, and neither projection initializer can resurrect a row
-- deleted from its source snapshot. A timeout rolls the entire migration back;
-- rerunning the database workflow is safe.
set local lock_timeout = '10s';
lock table public.user_watch_settings, public.watch_sessions, public.watch_session_participants, public.watch_episode_progress
  in share row exclusive mode;

-- Bound Watch History v2 title pagination to a canonical one-row-per-title
-- projection inside the same Supabase truth. Existing v2 rows initialize the
-- projection; v1 rows are never imported. Row triggers keep it transactionally
-- aligned for old and new application runtimes.

create table public.watch_history_title_summaries (
  user_id uuid not null references public.users (id) on delete cascade,
  history_generation bigint not null check (history_generation > 0),
  provider text not null check (provider in ('crunchyroll', 'youtube')),
  title_key text not null check (pg_catalog.char_length(title_key) between 1 and 220),
  stable_id text collate "C" not null check (
    stable_id = provider || ':' || title_key
    and pg_catalog.char_length(stable_id) <= 512
  ),
  last_watched_at timestamptz not null,
  primary key (user_id, history_generation, provider, title_key)
);

create index idx_watch_history_title_summaries_page
  on public.watch_history_title_summaries (
    user_id,
    history_generation,
    last_watched_at desc,
    stable_id
  )
  include (provider, title_key);

create table public.watch_history_user_session_summaries (
  user_id uuid not null references public.users (id) on delete cascade,
  session_id uuid not null,
  history_generation bigint not null check (history_generation > 0),
  provider text not null check (provider in ('crunchyroll', 'youtube')),
  title_key text not null check (pg_catalog.char_length(title_key) between 1 and 220),
  last_watched_at timestamptz not null,
  primary key (user_id, session_id),
  foreign key (session_id, user_id)
    references public.watch_session_participants (session_id, user_id)
    on update cascade
    on delete cascade
);

create index idx_watch_history_user_session_summaries_recent
  on public.watch_history_user_session_summaries (
    user_id,
    history_generation,
    provider,
    title_key,
    last_watched_at desc,
    session_id
  );

alter table public.watch_history_title_summaries enable row level security;
revoke all on table public.watch_history_title_summaries from public, anon, authenticated;
grant select, insert, update, delete on table public.watch_history_title_summaries to service_role;

alter table public.watch_history_user_session_summaries enable row level security;
revoke all on table public.watch_history_user_session_summaries
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.watch_history_user_session_summaries to service_role;

create function public.refresh_watch_history_title_summary_v2(
  p_user_id uuid,
  p_history_generation bigint,
  p_provider text,
  p_title_key text
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  delete from public.watch_history_title_summaries as summary
  where summary.user_id = p_user_id
    and summary.history_generation = p_history_generation
    and summary.provider = p_provider
    and summary.title_key = p_title_key;

  insert into public.watch_history_title_summaries (
    user_id,
    history_generation,
    provider,
    title_key,
    stable_id,
    last_watched_at
  )
  select
    progress.user_id,
    progress.history_generation,
    progress.provider,
    progress.title_key,
    progress.provider || ':' || progress.title_key,
    pg_catalog.max(progress.observed_at)
  from public.watch_episode_progress as progress
  where progress.user_id = p_user_id
    and progress.history_generation = p_history_generation
    and progress.provider = p_provider
    and progress.title_key = p_title_key
  group by
    progress.user_id,
    progress.history_generation,
    progress.provider,
    progress.title_key;
end;
$$;

create function public.sync_watch_history_title_summary_v2()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.watch_history_title_summaries (
      user_id,
      history_generation,
      provider,
      title_key,
      stable_id,
      last_watched_at
    )
    values (
      new.user_id,
      new.history_generation,
      new.provider,
      new.title_key,
      new.provider || ':' || new.title_key,
      new.observed_at
    )
    on conflict (user_id, history_generation, provider, title_key)
    do update set last_watched_at = case
      when watch_history_title_summaries.last_watched_at < excluded.last_watched_at
        then excluded.last_watched_at
      else watch_history_title_summaries.last_watched_at
    end;
  elsif old.user_id is not distinct from new.user_id
    and old.history_generation is not distinct from new.history_generation
    and old.provider is not distinct from new.provider
    and old.title_key is not distinct from new.title_key
    and new.observed_at >= old.observed_at
  then
    insert into public.watch_history_title_summaries (
      user_id,
      history_generation,
      provider,
      title_key,
      stable_id,
      last_watched_at
    )
    values (
      new.user_id,
      new.history_generation,
      new.provider,
      new.title_key,
      new.provider || ':' || new.title_key,
      new.observed_at
    )
    on conflict (user_id, history_generation, provider, title_key)
    do update set last_watched_at = case
      when watch_history_title_summaries.last_watched_at < excluded.last_watched_at
        then excluded.last_watched_at
      else watch_history_title_summaries.last_watched_at
    end;
  else
    perform public.refresh_watch_history_title_summary_v2(
      old.user_id,
      old.history_generation,
      old.provider,
      old.title_key
    );
    if old.user_id is distinct from new.user_id
      or old.history_generation is distinct from new.history_generation
      or old.provider is distinct from new.provider
      or old.title_key is distinct from new.title_key
    then
      insert into public.watch_history_title_summaries (
        user_id,
        history_generation,
        provider,
        title_key,
        stable_id,
        last_watched_at
      )
      values (
        new.user_id,
        new.history_generation,
        new.provider,
        new.title_key,
        new.provider || ':' || new.title_key,
        new.observed_at
      )
      on conflict (user_id, history_generation, provider, title_key)
      do update set last_watched_at = case
        when watch_history_title_summaries.last_watched_at < excluded.last_watched_at
          then excluded.last_watched_at
        else watch_history_title_summaries.last_watched_at
      end;
    end if;
  end if;

  return null;
end;
$$;

create trigger sync_watch_history_title_summary_v2
after insert or update on public.watch_episode_progress
for each row execute function public.sync_watch_history_title_summary_v2();

create function public.sync_watch_history_title_summary_delete_v2()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  affected record;
begin
  for affected in
    select distinct
      progress.user_id,
      progress.history_generation,
      progress.provider,
      progress.title_key
    from deleted_progress as progress
  loop
    perform public.refresh_watch_history_title_summary_v2(
      affected.user_id,
      affected.history_generation,
      affected.provider,
      affected.title_key
    );
  end loop;

  return null;
end;
$$;

create trigger sync_watch_history_title_summary_delete_v2
after delete on public.watch_episode_progress
referencing old table as deleted_progress
for each statement execute function public.sync_watch_history_title_summary_delete_v2();

revoke all on function public.refresh_watch_history_title_summary_v2(uuid, bigint, text, text)
  from public, anon, authenticated;
revoke all on function public.sync_watch_history_title_summary_v2()
  from public, anon, authenticated;
revoke all on function public.sync_watch_history_title_summary_delete_v2()
  from public, anon, authenticated;

create function public.sync_watch_history_user_session_summary_v2()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    old.user_id is distinct from new.user_id
    or old.session_id is distinct from new.session_id
    or old.schema_version is distinct from new.schema_version
  ) then
    delete from public.watch_history_user_session_summaries as summary
    where summary.user_id = old.user_id
      and summary.session_id = old.session_id;
  end if;

  if new.schema_version = 2 then
    insert into public.watch_history_user_session_summaries (
      user_id,
      session_id,
      history_generation,
      provider,
      title_key,
      last_watched_at
    )
    select
      new.user_id,
      new.session_id,
      settings.history_generation,
      session.provider,
      session.item_key,
      session.last_checkpoint_at
    from public.watch_sessions as session
    inner join public.user_watch_settings as settings
      on settings.user_id = new.user_id
    where session.id = new.session_id
      and session.schema_version = 2
      and (session.room_id is not null or session.client_session_key is not null)
    on conflict (user_id, session_id)
    do update set
      history_generation = excluded.history_generation,
      provider = excluded.provider,
      title_key = excluded.title_key,
      last_watched_at = excluded.last_watched_at;

    if not found then
      delete from public.watch_history_user_session_summaries as summary
      where summary.user_id = new.user_id
        and summary.session_id = new.session_id;
    end if;
  end if;

  return null;
end;
$$;

create trigger sync_watch_history_user_session_summary_v2
after insert or update on public.watch_session_participants
for each row execute function public.sync_watch_history_user_session_summary_v2();

revoke all on function public.sync_watch_history_user_session_summary_v2()
  from public, anon, authenticated;

create function public.sync_watch_history_session_summaries_v2()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if new.schema_version = 2
    and (new.room_id is not null or new.client_session_key is not null)
  then
    insert into public.watch_history_user_session_summaries (
      user_id,
      session_id,
      history_generation,
      provider,
      title_key,
      last_watched_at
    )
    select
      participant.user_id,
      new.id,
      settings.history_generation,
      new.provider,
      new.item_key,
      new.last_checkpoint_at
    from public.watch_session_participants as participant
    inner join public.user_watch_settings as settings
      on settings.user_id = participant.user_id
    where participant.session_id = new.id
      and participant.schema_version = 2
    on conflict (user_id, session_id)
    do update set
      history_generation = excluded.history_generation,
      provider = excluded.provider,
      title_key = excluded.title_key,
      last_watched_at = excluded.last_watched_at;
  else
    delete from public.watch_history_user_session_summaries as summary
    where summary.session_id = new.id;
  end if;

  return null;
end;
$$;

create trigger sync_watch_history_session_summaries_v2
after insert or update of
  schema_version,
  provider,
  item_key,
  last_checkpoint_at,
  room_id,
  client_session_key
on public.watch_sessions
for each row execute function public.sync_watch_history_session_summaries_v2();

revoke all on function public.sync_watch_history_session_summaries_v2()
  from public, anon, authenticated;

-- Initialize the projection after write maintenance is active. A concurrent
-- insert/update can create or advance the summary before this statement reaches
-- the same title; the idempotent merge preserves whichever timestamp is newer.
insert into public.watch_history_title_summaries (
  user_id,
  history_generation,
  provider,
  title_key,
  stable_id,
  last_watched_at
)
select
  progress.user_id,
  progress.history_generation,
  progress.provider,
  progress.title_key,
  progress.provider || ':' || progress.title_key,
  pg_catalog.max(progress.observed_at)
from public.watch_episode_progress as progress
group by
  progress.user_id,
  progress.history_generation,
  progress.provider,
  progress.title_key
on conflict (user_id, history_generation, provider, title_key)
do update set last_watched_at = case
  when watch_history_title_summaries.last_watched_at < excluded.last_watched_at
    then excluded.last_watched_at
  else watch_history_title_summaries.last_watched_at
end;

-- Initialize the user-session projection after write maintenance is active.
-- The explicit migration transaction and leading write-conflicting source locks
-- exclude insert/update/delete interleaving. The exact conflict update makes a
-- retried initialization converge to canonical session checkpoint and identity.
insert into public.watch_history_user_session_summaries (
  user_id,
  session_id,
  history_generation,
  provider,
  title_key,
  last_watched_at
)
select
  participant.user_id,
  participant.session_id,
  settings.history_generation,
  session.provider,
  session.item_key,
  session.last_checkpoint_at
from public.watch_session_participants as participant
inner join public.watch_sessions as session
  on session.id = participant.session_id
inner join public.user_watch_settings as settings
  on settings.user_id = participant.user_id
where participant.schema_version = 2
  and session.schema_version = 2
  and (session.room_id is not null or session.client_session_key is not null)
on conflict (user_id, session_id)
do update set
  history_generation = excluded.history_generation,
  provider = excluded.provider,
  title_key = excluded.title_key,
  last_watched_at = excluded.last_watched_at;

-- The generation hint preserves the separately deployable pre-runtime function
-- signature. The result reads and returns the canonical generation in the same
-- SQL statement snapshot; it never shapes data from the caller's stale hint.
create or replace function public.list_watch_history_v2_page(
  p_user_id uuid,
  p_history_generation bigint,
  p_limit integer,
  p_cursor_watched_at timestamptz default null,
  p_cursor_stable_id text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_user_id is null
    or p_history_generation is null
    or p_history_generation < 1
    or p_limit is null
    or p_limit < 1
    or p_limit > 100
    or ((p_cursor_watched_at is null) <> (p_cursor_stable_id is null))
    or (p_cursor_stable_id is not null and pg_catalog.char_length(p_cursor_stable_id) > 512)
  then
    raise exception 'watch_history_invalid_page';
  end if;

  return (
    with canonical_settings as materialized (
      select settings.history_generation
      from public.user_watch_settings as settings
      where settings.user_id = p_user_id
    ),
    title_count as materialized (
      select pg_catalog.count(*) as value
      from public.watch_history_title_summaries as summary
      where summary.user_id = p_user_id
        and summary.history_generation = (
          select settings.history_generation from canonical_settings as settings
        )
    ),
    page_titles as materialized (
      select
        summary.provider,
        summary.title_key,
        summary.last_watched_at,
        summary.stable_id
      from public.watch_history_title_summaries as summary
      where summary.user_id = p_user_id
        and summary.history_generation = (
          select settings.history_generation from canonical_settings as settings
        )
        and (
          p_cursor_watched_at is null
          or summary.last_watched_at <= p_cursor_watched_at
        )
        and (
          p_cursor_watched_at is null
          or summary.last_watched_at < p_cursor_watched_at
          or (
            summary.last_watched_at = p_cursor_watched_at
            and summary.stable_id > p_cursor_stable_id collate "C"
          )
        )
      order by summary.last_watched_at desc, summary.stable_id
      limit p_limit + 1
    ),
    visible_titles as materialized (
      select
        page.provider,
        page.title_key,
        page.last_watched_at,
        page.stable_id
      from page_titles as page
      order by page.last_watched_at desc, page.stable_id
      limit p_limit
    ),
    visible_progress as (
      select
        pg_catalog.jsonb_build_object(
          'user_id', progress.user_id,
          'provider', progress.provider,
          'title_key', progress.title_key,
          'episode_key', progress.episode_key,
          'item_kind', progress.item_kind,
          'title', progress.title,
          'artwork_url', progress.artwork_url,
          'episode_title', progress.episode_title,
          'season_key', progress.season_key,
          'season_title', progress.season_title,
          'season_number', progress.season_number,
          'episode_number', progress.episode_number,
          'source_url', progress.source_url,
          'current_time_seconds', progress.current_time_seconds,
          'duration', progress.duration,
          'progress', progress.progress,
          'completed_at', progress.completed_at,
          'latest_session_id', progress.latest_session_id,
          'observed_at', progress.observed_at,
          'server_order', progress.server_order,
          'history_generation', progress.history_generation
        ) as row_json,
        progress.latest_session_id,
        title.last_watched_at,
        title.stable_id,
        progress.observed_at,
        progress.server_order
      from public.watch_episode_progress as progress
      inner join visible_titles as title
        on title.provider = progress.provider
        and title.title_key = progress.title_key
      where progress.user_id = p_user_id
        and progress.history_generation = (
          select settings.history_generation from canonical_settings as settings
        )
    ),
    bounded_title_sessions as (
      select candidate.session_id
      from visible_titles as title
      cross join lateral (
        select summary.session_id
        from public.watch_history_user_session_summaries as summary
        where summary.user_id = p_user_id
          and summary.history_generation = (
            select settings.history_generation from canonical_settings as settings
          )
          and summary.provider = title.provider
          and summary.title_key = title.title_key
        order by summary.last_watched_at desc, summary.session_id
        limit 20
      ) as candidate
    ),
    bounded_sessions as (
      select session.session_id as id
      from bounded_title_sessions as session
      union
      select progress.latest_session_id
      from visible_progress as progress
      where progress.latest_session_id is not null
    )
    select pg_catalog.jsonb_build_object(
      'accountGeneration', (select settings.history_generation from canonical_settings as settings),
      'totalTitleCount', (select count.value from title_count as count),
      'hasMore', (select pg_catalog.count(*) > p_limit from page_titles),
      'progressRows', coalesce(
        (
          select pg_catalog.jsonb_agg(
            progress.row_json
            order by
              progress.last_watched_at desc,
              progress.stable_id,
              progress.observed_at desc,
              progress.server_order desc
          )
          from visible_progress as progress
        ),
        '[]'::jsonb
      ),
      'sessionIds', coalesce(
        (
          select pg_catalog.jsonb_agg(session.id order by session.id)
          from bounded_sessions as session
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.list_watch_history_v2_page(
  uuid,
  bigint,
  integer,
  timestamptz,
  text
) from public, anon, authenticated;
grant execute on function public.list_watch_history_v2_page(
  uuid,
  bigint,
  integer,
  timestamptz,
  text
) to service_role;

commit;
