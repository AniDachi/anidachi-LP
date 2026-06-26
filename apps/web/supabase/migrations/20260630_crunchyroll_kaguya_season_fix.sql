-- Correct Kaguya-sama: Love Is War season metadata that Crunchyroll exposed
-- with ambiguous JSON-LD season data ("?" + position). These watch IDs are
-- first-season episodes and must not be grouped under "?" or Season 2.
with known_crunchyroll_seasons(watch_id, season_key, season_title, season_number) as (
  values
    ('GRKE28PWR', 'season-1', 'Season 1', 1),
    ('GEVUZGE02', 'season-1', 'Season 1', 1),
    ('GJWU2XVK0', 'season-1', 'Season 1', 1)
)
update public.watch_sessions as watch_session
set
  season_key = known.season_key,
  season_title = known.season_title,
  season_number = known.season_number
from known_crunchyroll_seasons as known
where watch_session.provider = 'crunchyroll'
  and upper(substring(watch_session.source_url from '/watch/([^/?#]+)')) = known.watch_id;

with known_crunchyroll_seasons(watch_id, season_key, season_title, season_number) as (
  values
    ('GRKE28PWR', 'season-1', 'Season 1', 1),
    ('GEVUZGE02', 'season-1', 'Season 1', 1),
    ('GJWU2XVK0', 'season-1', 'Season 1', 1)
)
update public.watch_progress_checkpoints as checkpoint
set
  season_key = known.season_key,
  season_title = known.season_title,
  season_number = known.season_number
from public.watch_sessions as watch_session
join known_crunchyroll_seasons as known
  on upper(substring(watch_session.source_url from '/watch/([^/?#]+)')) = known.watch_id
where checkpoint.session_id = watch_session.id;
