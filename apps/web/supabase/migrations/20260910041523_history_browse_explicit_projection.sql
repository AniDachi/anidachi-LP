begin;

-- A table row is not the public history contract. In particular, adding the
-- editor's manual_edited_at fence must not change browse/preview response keys.
-- Keep the projection explicit so later internal columns remain server-only.
create or replace function public.watch_history_browse_progress_row_v3(p public.watch_episode_progress) returns jsonb
language sql stable security invoker set search_path='' as $$
select pg_catalog.jsonb_build_object(
 'user_id',p.user_id,
 'provider',p.provider,
 'title_key',p.title_key,
 'episode_key',p.episode_key,
 'item_kind',p.item_kind,
 'title',p.title,
 'artwork_url',p.artwork_url,
 'episode_title',coalesce(public.watch_catalog_label_v3(p.user_id,p.history_generation,p.provider,p.title_key,p.episode_key)->>'episodeTitle',p.episode_title),
 'season_key',p.season_key,
 'season_title',p.season_title,
 'season_number',p.season_number,
 'episode_number',p.episode_number,
 'source_url',p.source_url,
 'current_time_seconds',p.current_time_seconds,
 'duration',p.duration,
 'progress',p.progress,
 'completed_at',p.completed_at,
 'latest_session_id',p.latest_session_id,
 'observed_at',p.observed_at,
 'server_order',p.server_order,
 'history_generation',p.history_generation
);
$$;

-- CREATE OR REPLACE retains the existing service-role-only execution grants.
-- No saved progress, editor fences, access policy, or client payloads change.
commit;
