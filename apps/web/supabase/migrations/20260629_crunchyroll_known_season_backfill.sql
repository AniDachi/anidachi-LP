-- Backfill season metadata for Crunchyroll watch IDs that were recorded before
-- the extension started extracting seasons reliably.
with known_crunchyroll_seasons(watch_id, season_key, season_title, season_number) as (
  values
    ('G31UVXQPG', 'season-1', 'Season 1', 1),
    ('GPWU8KEQG', 'season-1', 'Season 1', 1),
    ('G2XUN0J2D', 'season-1', 'Season 1', 1),
    ('G8WU7NEDG', 'season-1', 'Season 1', 1),
    ('GRP8P9XGR', 'season-2', 'Season 2', 2),
    ('GWDU78GG3', 'season-2', 'Season 2', 2),
    ('G68VM8X86', 'season-2', 'Season 2', 2),
    ('GG1UX2002', 'season-2', 'Season 2', 2),
    ('GYDQVZNG6', 'season-2', 'Season 2', 2)
)
update public.watch_sessions as watch_session
set
  season_key = coalesce(watch_session.season_key, known.season_key),
  season_title = coalesce(watch_session.season_title, known.season_title),
  season_number = coalesce(watch_session.season_number, known.season_number)
from known_crunchyroll_seasons as known
where watch_session.provider = 'crunchyroll'
  and upper(substring(watch_session.source_url from '/watch/([^/?#]+)')) = known.watch_id
  and (
    watch_session.season_key is null
    or watch_session.season_title is null
    or watch_session.season_number is null
  );

update public.watch_progress_checkpoints as checkpoint
set
  season_key = coalesce(checkpoint.season_key, watch_session.season_key),
  season_title = coalesce(checkpoint.season_title, watch_session.season_title),
  season_number = coalesce(checkpoint.season_number, watch_session.season_number)
from public.watch_sessions as watch_session
where checkpoint.session_id = watch_session.id
  and watch_session.season_key is not null
  and (
    checkpoint.season_key is null
    or checkpoint.season_title is null
    or checkpoint.season_number is null
  );
