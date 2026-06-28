-- Season metadata for episode-level watch history.
--
-- Keep tracked titles at the series level; seasons are metadata on sessions and
-- checkpoints so Crunchyroll series do not split into separate paid title slots.

alter table public.watch_sessions
  add column if not exists season_key text,
  add column if not exists season_title text,
  add column if not exists season_number integer;

alter table public.watch_sessions
  drop constraint if exists watch_sessions_season_number_check;

alter table public.watch_sessions
  add constraint watch_sessions_season_number_check
  check (season_number is null or (season_number > 0 and season_number <= 1000));

create index if not exists idx_watch_sessions_season_lookup
  on public.watch_sessions (provider, item_key, season_key, episode_key, updated_at desc)
  where season_key is not null;

alter table public.watch_progress_checkpoints
  add column if not exists season_key text,
  add column if not exists season_title text,
  add column if not exists season_number integer;

alter table public.watch_progress_checkpoints
  drop constraint if exists watch_progress_checkpoints_season_number_check;

alter table public.watch_progress_checkpoints
  add constraint watch_progress_checkpoints_season_number_check
  check (season_number is null or (season_number > 0 and season_number <= 1000));
