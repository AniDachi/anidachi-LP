begin;

-- Existing writers take the account settings row before touching progress.
-- Take write-conflicting relation locks in the same order so the count backfill
-- is one exact snapshot and later writes resume against count-aware triggers.
set local lock_timeout = '10s';
lock table public.user_watch_settings, public.watch_episode_progress
  in share row exclusive mode;

alter table public.watch_history_title_summaries
  add column observed_episode_count bigint not null default 0,
  add column completed_episode_count bigint not null default 0;

create or replace function public.refresh_watch_history_title_summary_v2(
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
    last_watched_at,
    observed_episode_count,
    completed_episode_count
  )
  select
    progress.user_id,
    progress.history_generation,
    progress.provider,
    progress.title_key,
    progress.provider || ':' || progress.title_key,
    pg_catalog.max(progress.observed_at),
    pg_catalog.count(*),
    pg_catalog.count(*) filter (where progress.completed_at is not null)
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

create or replace function public.sync_watch_history_title_summary_v2()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  completion_delta bigint;
begin
  if tg_op = 'INSERT' then
    insert into public.watch_history_title_summaries (
      user_id,
      history_generation,
      provider,
      title_key,
      stable_id,
      last_watched_at,
      observed_episode_count,
      completed_episode_count
    )
    values (
      new.user_id,
      new.history_generation,
      new.provider,
      new.title_key,
      new.provider || ':' || new.title_key,
      new.observed_at,
      1,
      case when new.completed_at is null then 0 else 1 end
    )
    on conflict (user_id, history_generation, provider, title_key)
    do update set
      last_watched_at = greatest(
        public.watch_history_title_summaries.last_watched_at,
        excluded.last_watched_at
      ),
      observed_episode_count =
        public.watch_history_title_summaries.observed_episode_count + 1,
      completed_episode_count =
        public.watch_history_title_summaries.completed_episode_count
        + excluded.completed_episode_count;
  elsif old.user_id is not distinct from new.user_id
    and old.history_generation is not distinct from new.history_generation
    and old.provider is not distinct from new.provider
    and old.title_key is not distinct from new.title_key
  then
    completion_delta :=
      case when new.completed_at is null then 0 else 1 end
      - case when old.completed_at is null then 0 else 1 end;

    if new.observed_at >= old.observed_at then
      update public.watch_history_title_summaries as summary
      set
        last_watched_at = greatest(summary.last_watched_at, new.observed_at),
        completed_episode_count = summary.completed_episode_count + completion_delta
      where summary.user_id = new.user_id
        and summary.history_generation = new.history_generation
        and summary.provider = new.provider
        and summary.title_key = new.title_key;

      if not found then
        perform public.refresh_watch_history_title_summary_v2(
          new.user_id,
          new.history_generation,
          new.provider,
          new.title_key
        );
      end if;
    else
      perform public.refresh_watch_history_title_summary_v2(
        new.user_id,
        new.history_generation,
        new.provider,
        new.title_key
      );
    end if;
  else
    perform public.refresh_watch_history_title_summary_v2(
      old.user_id,
      old.history_generation,
      old.provider,
      old.title_key
    );

    insert into public.watch_history_title_summaries (
      user_id,
      history_generation,
      provider,
      title_key,
      stable_id,
      last_watched_at,
      observed_episode_count,
      completed_episode_count
    )
    values (
      new.user_id,
      new.history_generation,
      new.provider,
      new.title_key,
      new.provider || ':' || new.title_key,
      new.observed_at,
      1,
      case when new.completed_at is null then 0 else 1 end
    )
    on conflict (user_id, history_generation, provider, title_key)
    do update set
      last_watched_at = greatest(
        public.watch_history_title_summaries.last_watched_at,
        excluded.last_watched_at
      ),
      observed_episode_count =
        public.watch_history_title_summaries.observed_episode_count + 1,
      completed_episode_count =
        public.watch_history_title_summaries.completed_episode_count
        + excluded.completed_episode_count;
  end if;

  return null;
end;
$$;

-- Rebuild both counts and the maximum timestamp while writes are excluded.
with canonical as materialized (
  select
    progress.user_id,
    progress.history_generation,
    progress.provider,
    progress.title_key,
    pg_catalog.max(progress.observed_at) as last_watched_at,
    pg_catalog.count(*) as observed_episode_count,
    pg_catalog.count(*) filter (where progress.completed_at is not null)
      as completed_episode_count
  from public.watch_episode_progress as progress
  group by
    progress.user_id,
    progress.history_generation,
    progress.provider,
    progress.title_key
)
update public.watch_history_title_summaries as summary
set
  last_watched_at = canonical.last_watched_at,
  observed_episode_count = canonical.observed_episode_count,
  completed_episode_count = canonical.completed_episode_count
from canonical
where summary.user_id = canonical.user_id
  and summary.history_generation = canonical.history_generation
  and summary.provider = canonical.provider
  and summary.title_key = canonical.title_key;

alter table public.watch_history_title_summaries
  alter column observed_episode_count drop default,
  alter column completed_episode_count drop default,
  add constraint watch_history_title_summaries_observed_count_check
    check (observed_episode_count > 0),
  add constraint watch_history_title_summaries_completed_count_check
    check (
      completed_episode_count >= 0
      and completed_episode_count <= observed_episode_count
    );

create index idx_watch_episode_progress_title_detail
  on public.watch_episode_progress (
    user_id,
    history_generation,
    provider,
    title_key,
    observed_at desc,
    episode_key collate "C"
  );

-- This RPC is additive. The deployed list_watch_history_v2_page signature and
-- body remain unchanged until the bounded consumer is deployed separately.
create function public.list_watch_history_v2_bounded_page(
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
    or (
      p_cursor_stable_id is not null
      and pg_catalog.char_length(p_cursor_stable_id) > 512
    )
  then
    raise exception 'watch_history_invalid_page' using errcode = '22023';
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
        summary.stable_id,
        summary.observed_episode_count,
        summary.completed_episode_count
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
      select page.*
      from page_titles as page
      order by page.last_watched_at desc, page.stable_id
      limit p_limit
    ),
    visible_progress as materialized (
      select
        title.last_watched_at,
        title.stable_id,
        title.provider,
        title.title_key,
        progress.observed_at,
        progress.episode_key,
        progress.latest_session_id,
        progress.row_json
      from visible_titles as title
      cross join lateral (
        select
          episode.observed_at,
          episode.episode_key,
          episode.latest_session_id,
          pg_catalog.jsonb_build_object(
            'user_id', episode.user_id,
            'provider', episode.provider,
            'title_key', episode.title_key,
            'episode_key', episode.episode_key,
            'item_kind', episode.item_kind,
            'title', episode.title,
            'artwork_url', episode.artwork_url,
            'episode_title', episode.episode_title,
            'season_key', episode.season_key,
            'season_title', episode.season_title,
            'season_number', episode.season_number,
            'episode_number', episode.episode_number,
            'source_url', episode.source_url,
            'current_time_seconds', episode.current_time_seconds,
            'duration', episode.duration,
            'progress', episode.progress,
            'completed_at', episode.completed_at,
            'latest_session_id', episode.latest_session_id,
            'observed_at', episode.observed_at,
            'server_order', episode.server_order,
            'history_generation', episode.history_generation
          ) as row_json
        from public.watch_episode_progress as episode
        where episode.user_id = p_user_id
          and episode.history_generation = (
            select settings.history_generation from canonical_settings as settings
          )
          and episode.provider = title.provider
          and episode.title_key = title.title_key
        order by episode.observed_at desc, episode.episode_key collate "C"
        limit 8
      ) as progress
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
      'accountGeneration', (
        select settings.history_generation from canonical_settings as settings
      ),
      'totalTitleCount', (select count.value from title_count as count),
      'hasMore', (select pg_catalog.count(*) > p_limit from page_titles),
      'titleSummaries', coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'provider', title.provider,
              'titleKey', title.title_key,
              'lastWatchedAt', title.last_watched_at,
              'observedEpisodeCount', title.observed_episode_count,
              'completedEpisodeCount', title.completed_episode_count,
              'episodePage', pg_catalog.jsonb_build_object(
                'complete', title.observed_episode_count <= 8,
                'nextCursor', case
                  when title.observed_episode_count <= 8 then null
                  else (
                    select pg_catalog.encode(
                      pg_catalog.convert_to(
                        pg_catalog.jsonb_build_object(
                          'v', 1,
                          'provider', cursor_row.provider,
                          'titleKey', cursor_row.title_key,
                          'observedAt', cursor_row.observed_at,
                          'episodeKey', cursor_row.episode_key
                        )::text,
                        'UTF8'
                      ),
                      'hex'
                    )
                    from visible_progress as cursor_row
                    where cursor_row.provider = title.provider
                      and cursor_row.title_key = title.title_key
                    order by
                      cursor_row.observed_at desc,
                      cursor_row.episode_key collate "C"
                    offset 7
                    limit 1
                  )
                end
              )
            )
            order by title.last_watched_at desc, title.stable_id
          )
          from visible_titles as title
        ),
        '[]'::jsonb
      ),
      'progressRows', coalesce(
        (
          select pg_catalog.jsonb_agg(
            progress.row_json
            order by
              progress.last_watched_at desc,
              progress.stable_id,
              progress.observed_at desc,
              progress.episode_key collate "C"
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

create function public.list_watch_history_v2_title_episodes_page(
  p_user_id uuid,
  p_history_generation bigint,
  p_provider text,
  p_title_key text,
  p_limit integer default 50,
  p_cursor text default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  cursor_value jsonb;
  cursor_observed_at timestamptz;
  cursor_episode_key text;
begin
  if p_user_id is null
    or p_history_generation is null
    or p_history_generation < 1
    or p_provider is null
    or p_provider not in ('crunchyroll', 'youtube')
    or p_title_key is null
    or pg_catalog.char_length(p_title_key) not between 1 and 220
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
    or (p_cursor is not null and pg_catalog.char_length(p_cursor) > 2048)
  then
    raise exception 'watch_history_invalid_episode_page' using errcode = '22023';
  end if;

  if p_cursor is not null then
    begin
      cursor_value := pg_catalog.convert_from(
        pg_catalog.decode(p_cursor, 'hex'),
        'UTF8'
      )::jsonb;
    exception when others then
      raise exception 'watch_history_invalid_episode_cursor' using errcode = '22023';
    end;

    if pg_catalog.jsonb_typeof(cursor_value) <> 'object' then
      raise exception 'watch_history_invalid_episode_cursor' using errcode = '22023';
    end if;

    if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(cursor_value)) <> 5
      or not (cursor_value ? 'v')
      or not (cursor_value ? 'provider')
      or not (cursor_value ? 'titleKey')
      or not (cursor_value ? 'observedAt')
      or not (cursor_value ? 'episodeKey')
      or cursor_value ->> 'v' <> '1'
      or pg_catalog.jsonb_typeof(cursor_value -> 'provider') <> 'string'
      or pg_catalog.jsonb_typeof(cursor_value -> 'titleKey') <> 'string'
      or pg_catalog.jsonb_typeof(cursor_value -> 'observedAt') <> 'string'
      or pg_catalog.jsonb_typeof(cursor_value -> 'episodeKey') <> 'string'
      or pg_catalog.char_length(cursor_value ->> 'episodeKey') not between 1 and 220
    then
      raise exception 'watch_history_invalid_episode_cursor' using errcode = '22023';
    end if;

    if cursor_value ->> 'provider' <> p_provider
      or cursor_value ->> 'titleKey' <> p_title_key
    then
      raise exception 'watch_history_cursor_target_mismatch' using errcode = '22023';
    end if;

    begin
      cursor_observed_at := (cursor_value ->> 'observedAt')::timestamptz;
      cursor_episode_key := cursor_value ->> 'episodeKey';
    exception when others then
      raise exception 'watch_history_invalid_episode_cursor' using errcode = '22023';
    end;
  end if;

  return (
    with canonical_settings as materialized (
      select settings.history_generation
      from public.user_watch_settings as settings
      where settings.user_id = p_user_id
    ),
    title_summary as materialized (
      select
        summary.observed_episode_count,
        summary.completed_episode_count
      from public.watch_history_title_summaries as summary
      where summary.user_id = p_user_id
        and summary.history_generation = (
          select settings.history_generation from canonical_settings as settings
        )
        and summary.provider = p_provider
        and summary.title_key = p_title_key
    ),
    candidates as materialized (
      select episode.*
      from public.watch_episode_progress as episode
      where episode.user_id = p_user_id
        and episode.history_generation = (
          select settings.history_generation from canonical_settings as settings
        )
        and episode.provider = p_provider
        and episode.title_key = p_title_key
        and (
          cursor_observed_at is null
          or episode.observed_at < cursor_observed_at
          or (
            episode.observed_at = cursor_observed_at
            and episode.episode_key > cursor_episode_key collate "C"
          )
        )
      order by episode.observed_at desc, episode.episode_key collate "C"
      limit p_limit + 1
    ),
    visible as materialized (
      select candidate.*
      from candidates as candidate
      order by candidate.observed_at desc, candidate.episode_key collate "C"
      limit p_limit
    )
    select pg_catalog.jsonb_build_object(
      'accountGeneration', (
        select settings.history_generation from canonical_settings as settings
      ),
      'provider', p_provider,
      'titleKey', p_title_key,
      'observedEpisodeCount', coalesce(
        (select summary.observed_episode_count from title_summary as summary),
        0
      ),
      'completedEpisodeCount', coalesce(
        (select summary.completed_episode_count from title_summary as summary),
        0
      ),
      'complete', (select pg_catalog.count(*) <= p_limit from candidates),
      'nextCursor', case
        when (select pg_catalog.count(*) <= p_limit from candidates) then null
        else (
          select pg_catalog.encode(
            pg_catalog.convert_to(
              pg_catalog.jsonb_build_object(
                'v', 1,
                'provider', p_provider,
                'titleKey', p_title_key,
                'observedAt', row.observed_at,
                'episodeKey', row.episode_key
              )::text,
              'UTF8'
            ),
            'hex'
          )
          from visible as row
          order by row.observed_at, row.episode_key collate "C" desc
          limit 1
        )
      end,
      'progressRows', coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'user_id', row.user_id,
              'provider', row.provider,
              'title_key', row.title_key,
              'episode_key', row.episode_key,
              'item_kind', row.item_kind,
              'title', row.title,
              'artwork_url', row.artwork_url,
              'episode_title', row.episode_title,
              'season_key', row.season_key,
              'season_title', row.season_title,
              'season_number', row.season_number,
              'episode_number', row.episode_number,
              'source_url', row.source_url,
              'current_time_seconds', row.current_time_seconds,
              'duration', row.duration,
              'progress', row.progress,
              'completed_at', row.completed_at,
              'latest_session_id', row.latest_session_id,
              'observed_at', row.observed_at,
              'server_order', row.server_order,
              'history_generation', row.history_generation
            )
            order by row.observed_at desc, row.episode_key collate "C"
          )
          from visible as row
        ),
        '[]'::jsonb
      )
    )
  );
end;
$$;

revoke all on function public.list_watch_history_v2_bounded_page(
  uuid,
  bigint,
  integer,
  timestamptz,
  text
) from public, anon, authenticated;
grant execute on function public.list_watch_history_v2_bounded_page(
  uuid,
  bigint,
  integer,
  timestamptz,
  text
) to service_role;

revoke all on function public.list_watch_history_v2_title_episodes_page(
  uuid,
  bigint,
  text,
  text,
  integer,
  text
) from public, anon, authenticated;
grant execute on function public.list_watch_history_v2_title_episodes_page(
  uuid,
  bigint,
  text,
  text,
  integer,
  text
) to service_role;

create index idx_watch_history_receipts_global_expiry
  on public.watch_history_receipts (expires_at, user_id, client_id);

create function public.cleanup_watch_history_receipts_v2(
  p_batch_size integer default 100
)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 100 then
    raise exception 'watch_history_invalid_cleanup_batch' using errcode = '22023';
  end if;

  with candidates as materialized (
    select receipt.user_id, receipt.client_id
    from public.watch_history_receipts as receipt
    where receipt.expires_at <= pg_catalog.transaction_timestamp()
    order by receipt.expires_at, receipt.user_id, receipt.client_id
    limit p_batch_size
    for update of receipt skip locked
  )
  delete from public.watch_history_receipts as receipt
  using candidates
  where receipt.user_id = candidates.user_id
    and receipt.client_id = candidates.client_id;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_watch_history_receipts_v2(integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_watch_history_receipts_v2(integer)
  to service_role;

select cron.schedule(
  'anidachi-watch-history-receipt-cleanup-hourly',
  '0 * * * *',
  'select public.cleanup_watch_history_receipts_v2();'
);

commit;
