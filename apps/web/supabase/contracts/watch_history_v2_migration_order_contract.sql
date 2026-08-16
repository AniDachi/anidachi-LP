begin;

insert into public.users (id, email, display_name)
values (
  '88888888-8888-4888-8888-888888888888',
  'watch-v2-migration-order@example.test',
  'Watch V2 Migration Order'
);

insert into public.user_watch_settings (user_id)
values ('88888888-8888-4888-8888-888888888888');

alter table public.watch_episode_progress
  disable trigger sync_watch_history_title_summary_v2;

insert into public.watch_episode_progress (
  user_id,
  provider,
  title_key,
  episode_key,
  item_kind,
  title,
  episode_title,
  source_url,
  current_time_seconds,
  duration,
  progress,
  last_event_id,
  observed_at,
  server_order,
  history_generation,
  updated_at
)
values (
  '88888888-8888-4888-8888-888888888888',
  'crunchyroll',
  'migration-order-title',
  'episode-before-trigger',
  'series',
  'Migration order title',
  'Episode before trigger',
  'https://www.crunchyroll.com/watch/migration-order-before/demo',
  100,
  1200,
  0.1,
  '88888888-8888-4888-8888-888888888801',
  '2102-01-01 00:00:00+00',
  1,
  1,
  pg_catalog.clock_timestamp()
);

alter table public.watch_episode_progress
  enable trigger sync_watch_history_title_summary_v2;

insert into public.watch_episode_progress (
  user_id,
  provider,
  title_key,
  episode_key,
  item_kind,
  title,
  episode_title,
  source_url,
  current_time_seconds,
  duration,
  progress,
  last_event_id,
  observed_at,
  server_order,
  history_generation,
  updated_at
)
values (
  '88888888-8888-4888-8888-888888888888',
  'crunchyroll',
  'migration-order-title',
  'episode-between-trigger-and-initialization',
  'series',
  'Migration order title',
  'Episode between trigger and initialization',
  'https://www.crunchyroll.com/watch/migration-order-between/demo',
  200,
  1200,
  0.2,
  '88888888-8888-4888-8888-888888888802',
  '2102-01-02 00:00:00+00',
  2,
  1,
  pg_catalog.clock_timestamp()
);

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
where progress.user_id = '88888888-8888-4888-8888-888888888888'
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

do $$
begin
  if (
    select pg_catalog.concat(pg_catalog.count(*), ':', pg_catalog.max(summary.last_watched_at))
    from public.watch_history_title_summaries as summary
    where summary.user_id = '88888888-8888-4888-8888-888888888888'
      and summary.provider = 'crunchyroll'
      and summary.title_key = 'migration-order-title'
  ) <> '1:2102-01-02 00:00:00+00'
  then
    raise exception 'watch_history_migration_order_contract_failed';
  end if;
end;
$$;

insert into public.watch_sessions (
  id,
  host_user_id,
  provider,
  item_key,
  item_kind,
  item_title,
  episode_key,
  episode_title,
  source_url,
  duration_seconds,
  current_time_seconds,
  progress,
  started_at,
  last_checkpoint_at,
  updated_at,
  schema_version,
  history_generation,
  client_session_key
)
values (
  '88888888-8888-4888-8888-888888888803',
  '88888888-8888-4888-8888-888888888888',
  'crunchyroll',
  'migration-order-title',
  'series',
  'Migration order title',
  'migration-order-session-episode',
  'Migration order session episode',
  'https://www.crunchyroll.com/watch/migration-order-session/demo',
  1200,
  100,
  0.1,
  '2102-02-01 00:00:00+00',
  '2102-02-01 00:00:00+00',
  '2102-02-01 00:00:00+00',
  2,
  1,
  'migration-order-session'
);

insert into public.watch_sessions (
  id,
  host_user_id,
  provider,
  item_key,
  item_kind,
  item_title,
  episode_key,
  episode_title,
  source_url,
  started_at,
  last_checkpoint_at,
  updated_at,
  schema_version,
  history_generation,
  room_generation,
  source_generation
)
values (
  '88888888-8888-4888-8888-888888888804',
  '88888888-8888-4888-8888-888888888888',
  'crunchyroll',
  'migration-order-title',
  'series',
  'Migration order tombstone',
  'migration-order-tombstone-episode',
  'Migration order tombstone episode',
  'https://www.crunchyroll.com/watch/migration-order-tombstone/demo',
  '2102-04-01 00:00:00+00',
  '2102-04-01 00:00:00+00',
  '2102-04-01 00:00:00+00',
  2,
  1,
  1,
  1
);

alter table public.watch_session_participants
  disable trigger sync_watch_history_user_session_summary_v2;

insert into public.watch_session_participants (
  session_id,
  user_id,
  role,
  joined_at,
  current_time_seconds,
  progress,
  updated_at,
  schema_version
)
values
  (
    '88888888-8888-4888-8888-888888888803',
    '88888888-8888-4888-8888-888888888888',
    'host',
    '2102-02-01 00:00:00+00',
    100,
    0.1,
    '2102-02-01 00:00:00+00',
    2
  ),
  (
    '88888888-8888-4888-8888-888888888804',
    '88888888-8888-4888-8888-888888888888',
    'host',
    '2102-04-01 00:00:00+00',
    100,
    0.1,
    '2102-04-01 00:00:00+00',
    2
  );

alter table public.watch_session_participants
  enable trigger sync_watch_history_user_session_summary_v2;

update public.watch_sessions
set last_checkpoint_at = '2102-02-02 00:00:00+00'
where id = '88888888-8888-4888-8888-888888888803';

update public.watch_session_participants
set updated_at = '2102-03-01 00:00:00+00'
where session_id = '88888888-8888-4888-8888-888888888803'
  and user_id = '88888888-8888-4888-8888-888888888888';

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
where participant.user_id = '88888888-8888-4888-8888-888888888888'
  and participant.schema_version = 2
  and session.schema_version = 2
  and (session.room_id is not null or session.client_session_key is not null)
on conflict (user_id, session_id)
do update set
  history_generation = excluded.history_generation,
  provider = excluded.provider,
  title_key = excluded.title_key,
  last_watched_at = excluded.last_watched_at;

do $$
begin
  if (
    select pg_catalog.concat(pg_catalog.count(*), ':', pg_catalog.max(summary.last_watched_at))
    from public.watch_history_user_session_summaries as summary
    where summary.user_id = '88888888-8888-4888-8888-888888888888'
      and summary.session_id = '88888888-8888-4888-8888-888888888803'
  ) <> '1:2102-02-02 00:00:00+00'
  then
    raise exception 'watch_history_user_session_migration_order_contract_failed';
  end if;
  if exists (
    select 1
    from public.watch_history_user_session_summaries as summary
    where summary.user_id = '88888888-8888-4888-8888-888888888888'
      and summary.session_id = '88888888-8888-4888-8888-888888888804'
  ) then
    raise exception 'watch_history_user_session_tombstone_initialization_contract_failed';
  end if;
end;
$$;

delete from public.watch_session_participants
where session_id = '88888888-8888-4888-8888-888888888803'
  and user_id = '88888888-8888-4888-8888-888888888888';

do $$
begin
  if exists (
    select 1
    from public.watch_history_user_session_summaries as summary
    where summary.user_id = '88888888-8888-4888-8888-888888888888'
      and summary.session_id = '88888888-8888-4888-8888-888888888803'
  ) then
    raise exception 'watch_history_user_session_delete_contract_failed';
  end if;
end;
$$;

rollback;
