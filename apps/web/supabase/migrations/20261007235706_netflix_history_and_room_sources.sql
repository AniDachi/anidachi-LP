begin;
-- Extend provider admission in place. No progress, epochs, grants, receipts or
-- accepted catalogs are rewritten. Each patch fails closed if the active body
-- no longer has exactly the reviewed anchors; function security/ACLs survive.
create function pg_temp.netflix_patch(routine regprocedure, needle text, replacement text, expected integer default 1)
returns void language plpgsql as $$
declare body text := pg_get_functiondef(routine);
begin
  if (length(body)-length(replace(body,needle,''))) / length(needle) <> expected then
    raise exception 'netflix migration anchor mismatch: %', routine;
  end if;
  execute replace(body,needle,replacement);
end $$;

alter table public.watch_episode_progress drop constraint watch_episode_progress_provider_check, add constraint watch_episode_progress_provider_check check (provider in ('crunchyroll','youtube','netflix'));

alter table public.watch_history_deletions drop constraint watch_history_deletions_provider_check, add constraint watch_history_deletions_provider_check check (provider is null or provider in ('crunchyroll','youtube','netflix'));

alter table public.watch_history_title_summaries drop constraint watch_history_title_summaries_provider_check, add constraint watch_history_title_summaries_provider_check check (provider in ('crunchyroll','youtube','netflix'));

alter table public.watch_history_user_session_summaries drop constraint watch_history_user_session_summaries_provider_check, add constraint watch_history_user_session_summaries_provider_check check (provider in ('crunchyroll','youtube','netflix'));

alter table public.watch_catalog_snapshots drop constraint watch_catalog_snapshots_provider_check, add constraint watch_catalog_snapshots_provider_check check (provider in ('crunchyroll','netflix'));

do $migration$
declare body text;
begin
  select pg_get_constraintdef(oid) into strict body from pg_constraint where conrelid='public.rooms'::regclass and conname='rooms_source_tuple_check';
  if strpos(body, 'ARRAY[''crunchyroll''::text, ''youtube''::text]')=0 then raise exception 'netflix room tuple anchor mismatch'; end if;
  body:=replace(body,'ARRAY[''crunchyroll''::text, ''youtube''::text]','ARRAY[''crunchyroll''::text, ''youtube''::text, ''netflix''::text]');
  alter table public.rooms drop constraint rooms_source_tuple_check;
  execute 'alter table public.rooms add constraint rooms_source_tuple_check '||body;
  select pg_get_constraintdef(oid) into strict body from pg_constraint where conrelid='public.rooms'::regclass and conname='rooms_source_url_canonical_check';
  alter table public.rooms drop constraint rooms_source_url_canonical_check;
  execute 'alter table public.rooms add constraint rooms_source_url_canonical_check check ('||substring(body from 8 for length(body)-8)||$clause$
    or (source_provider='netflix' and source_url ~ '^https://www[.]netflix[.]com/watch/[1-9][0-9]{0,19}$'
      and video_fingerprint='netflix|watch/'||substring(source_url from '/watch/([1-9][0-9]{0,19})$')))$clause$;
end $migration$;

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube')$old$, $new$('crunchyroll', 'youtube', 'netflix')$new$, 1);

select pg_temp.netflix_patch('public.delete_watch_history_v3'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube')$old$, $new$('crunchyroll', 'youtube', 'netflix')$new$, 2);

select pg_temp.netflix_patch('public.list_watch_history_v3_title_episodes_page'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube')$old$, $new$('crunchyroll', 'youtube', 'netflix')$new$, 1);

select pg_temp.netflix_patch('public.persist_room_source_v1'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube')$old$, $new$('crunchyroll', 'youtube', 'netflix')$new$, 1);

select pg_temp.netflix_patch('public.create_room_with_active_session_v3'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube')$old$, $new$('crunchyroll', 'youtube', 'netflix')$new$, 1);

select pg_temp.netflix_patch('anidachi_room_private.create_room_with_active_session_v1'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube')$old$, $new$('crunchyroll', 'youtube', 'netflix')$new$, 1);

select pg_temp.netflix_patch('public.get_watch_history_editor_v1'::regproc::oid::regprocedure, $old$('crunchyroll','youtube')$old$, $new$('crunchyroll','youtube','netflix')$new$, 1);

select pg_temp.netflix_patch('public.edit_watch_history_v1'::regproc::oid::regprocedure, $old$('crunchyroll','youtube')$old$, $new$('crunchyroll','youtube','netflix')$new$, 1);

select pg_temp.netflix_patch('public.edit_watch_history_v1'::regproc::oid::regprocedure, $old$when prov='crunchyroll' then$old$, $new$when prov in ('crunchyroll','netflix') then$new$, 1);

select pg_temp.netflix_patch('public.apply_personal_watch_progress_v1'::regproc::oid::regprocedure, $old$'kind','crunchyrollIdentity','youtubeVideoId'$old$, $new$'kind','crunchyrollIdentity','youtubeVideoId','netflixIdentity'$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure, $old$when 'crunchyroll' then 200 end$old$, $new$when 'crunchyroll' then 200 when 'netflix' then 200 end$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure, $old$p_event#>>'{crunchyrollIdentity,providerContentId}'$old$, $new$coalesce(p_event#>>'{crunchyrollIdentity,providerContentId}',p_event#>>'{netflixIdentity,providerEpisodeIdentifier}',p_event#>>'{netflixIdentity,providerMovieId}')$new$, 2);

select pg_temp.netflix_patch('public.persist_room_source_v1'::regproc::oid::regprocedure, $old$  else
    raise exception 'room_source_invalid_input'$old$, $new$  elsif p_source_provider = 'netflix'
    and p_source_url ~ '^https://www[.]netflix[.]com/watch/[1-9][0-9]{0,19}$'
  then
    v_expected_video_fingerprint := 'netflix|watch/' || substring(p_source_url from '/watch/([1-9][0-9]{0,19})$');
  else
    raise exception 'room_source_invalid_input'$new$, 1);

select pg_temp.netflix_patch('public.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$'crunchyroll'$old$, $new$(p_request->>'provider')$new$, 1);

select pg_temp.netflix_patch('public.begin_watch_catalog_v3'::regproc::oid::regprocedure, $old$'crunchyroll'$old$, $new$(p_request->>'provider')$new$, 1);

select pg_temp.netflix_patch('public.watch_catalog_ack_v3'::regproc::oid::regprocedure, $old$'crunchyroll'$old$, $new$(p_request->>'provider')$new$, 2);

select pg_temp.netflix_patch('anidachi_history_private.begin_watch_catalog_v3'::regproc::oid::regprocedure, $old$'crunchyroll:series:'$old$, $new$((p_request->>'provider')||':series:')$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.begin_watch_catalog_v3'::regproc::oid::regprocedure, $old$'crunchyroll'$old$, $new$(p_request->>'provider')$new$, 5);

select pg_temp.netflix_patch('anidachi_history_private.begin_watch_catalog_v3'::regproc::oid::regprocedure, $old$p_request->>'provider' is distinct from (p_request->>'provider')$old$, $new$coalesce(p_request->>'provider','') not in ('crunchyroll','netflix')$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.begin_watch_catalog_v3'::regproc::oid::regprocedure, $old$not between 20 and 220$old$, $new$not between (case when p_request->>'provider'='netflix' then 16 else 20 end) and 220$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$'crunchyroll:series:'$old$, $new$((p_request->>'provider')||':series:')$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$'crunchyroll:season:'$old$, $new$((p_request->>'provider')||':season:')$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$'crunchyroll:episode:'$old$, $new$((p_request->>'provider')||':episode:')$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$'crunchyroll'$old$, $new$(p_request->>'provider')$new$, 10);

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$not between 20 and 220$old$, $new$not between (case when p_request->>'provider'='netflix' then 16 else 20 end) and 220$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$not between 21 and 220$old$, $new$not between (case when p_request->>'provider'='netflix' then 17 else 21 end) and 220$new$, 1);

select pg_temp.netflix_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$'https://www.crunchyroll.com/watch/'$old$, $new$('https://www.'||(p_request->>'provider')||'.com/watch/')$new$, 1);

select pg_temp.netflix_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$r->'provider' is distinct from '"crunchyroll"'::jsonb$old$, $new$coalesce(r->>'provider','') not in ('crunchyroll','netflix')
   or (r->>'provider'='netflix' and (jsonb_typeof(r->'providerSeriesId') is distinct from 'string' or coalesce(r->>'providerSeriesId','') !~ '^[1-9][0-9]{0,19}$'))$new$, 1);

select pg_temp.netflix_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$or snap->'schemaVersion' is distinct from '3'::jsonb$old$, $new$or snap->'schemaVersion' is distinct from '3'::jsonb
   or snap->'provider' is distinct from r->'provider'$new$, 1);

select pg_temp.netflix_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$if jsonb_typeof(s) is distinct from 'object'$old$, $new$if (r->>'provider'='netflix' and (jsonb_typeof(s->'providerSeasonIdentifier') is distinct from 'string' or coalesce(s->>'providerSeasonIdentifier','') !~ '^[1-9][0-9]{0,19}$'))
     or jsonb_typeof(s) is distinct from 'object'$new$, 1);

select pg_temp.netflix_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$if jsonb_typeof(e) is distinct from 'object'$old$, $new$if (r->>'provider'='netflix' and (jsonb_typeof(e->'providerEpisodeIdentifier') is distinct from 'string' or coalesce(e->>'providerEpisodeIdentifier','') !~ '^[1-9][0-9]{0,19}$'))
       or jsonb_typeof(e) is distinct from 'object'$new$, 1);

select pg_temp.netflix_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$     for v in select$old$, $new$     if r->>'provider'='netflix' and jsonb_array_length(e->'watchVariants')<>1 then raise exception 'watch_catalog_invalid' using errcode='22023'; end if;
     for v in select$new$, 1);

select pg_temp.netflix_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$if jsonb_typeof(v) is distinct from 'object'$old$, $new$if (r->>'provider'='netflix' and (v->'providerContentId' is distinct from e->'providerEpisodeIdentifier'
           or v->>'sourceUrl' is distinct from 'https://www.netflix.com/watch/'||(e->>'providerEpisodeIdentifier')))
         or jsonb_typeof(v) is distinct from 'object'$new$, 1);

select pg_temp.netflix_patch('public.validate_watch_identity_v3'::regproc::oid::regprocedure, $old$  if p_event->>'provider' = 'crunchyroll' then$old$, $new$  if (p_event->>'provider'<>'netflix' and p_event ? 'netflixIdentity')
    or (p_event->>'provider'='netflix' and p_event ?| array['crunchyrollIdentity','youtubeVideoId'])
  then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
  if p_event->>'provider' = 'netflix' then
    i:=p_event->'netflixIdentity';
    if jsonb_typeof(i) is distinct from 'object' or coalesce(i->>'kind','') not in ('movie','episode')
      or not coalesce((p_event->'artworkUrl'='null'::jsonb or (jsonb_typeof(p_event->'artworkUrl')='string'
        and length(p_event->>'artworkUrl')<=2048 and p_event->>'artworkUrl' ~ '^https://([a-z0-9]([a-z0-9-]*[a-z0-9])?[.])+nflxso[.]net/[^#[:space:]]*$')),false)
    then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
    if i->>'kind'='movie' then
      if i-array['kind','providerMovieId']<>'{}'::jsonb
        or jsonb_typeof(i->'providerMovieId') is distinct from 'string'
        or coalesce(i->>'providerMovieId','') !~ '^[1-9][0-9]{0,19}$'
        or p_event->>'itemKind' is distinct from 'movie'
        or p_event->>'titleKey' is distinct from 'netflix:movie:'||(i->>'providerMovieId')
        or p_event->>'episodeKey' is distinct from p_event->>'titleKey'
        or p_event->'seasonKey' is distinct from 'null'::jsonb
        or p_event->'seasonTitle' is distinct from 'null'::jsonb
        or p_event->'seasonNumber' is distinct from 'null'::jsonb
        or p_event->'episodeNumber' is distinct from 'null'::jsonb
        or p_event->>'sourceUrl' is distinct from 'https://www.netflix.com/watch/'||(i->>'providerMovieId')
      then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
    else
      if i-array['kind','providerSeriesId','providerSeasonIdentifier','providerEpisodeIdentifier']<>'{}'::jsonb
        or jsonb_typeof(i->'providerSeriesId') is distinct from 'string'
        or jsonb_typeof(i->'providerSeasonIdentifier') is distinct from 'string'
        or jsonb_typeof(i->'providerEpisodeIdentifier') is distinct from 'string'
        or coalesce(i->>'providerSeriesId','') !~ '^[1-9][0-9]{0,19}$'
        or coalesce(i->>'providerSeasonIdentifier','') !~ '^[1-9][0-9]{0,19}$'
        or coalesce(i->>'providerEpisodeIdentifier','') !~ '^[1-9][0-9]{0,19}$'
        or p_event->>'itemKind' is distinct from 'series'
        or p_event->>'titleKey' is distinct from 'netflix:series:'||(i->>'providerSeriesId')
        or p_event->>'seasonKey' is distinct from 'netflix:season:'||(i->>'providerSeasonIdentifier')
        or p_event->>'episodeKey' is distinct from 'netflix:episode:'||(i->>'providerEpisodeIdentifier')
        or p_event->>'sourceUrl' is distinct from 'https://www.netflix.com/watch/'||(i->>'providerEpisodeIdentifier')
      then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
    end if;
  elsif p_event->>'provider' = 'crunchyroll' then$new$, 1);

select pg_temp.netflix_patch('public.watch_history_browse_matches_v3'::regproc::oid::regprocedure, $old$and (not p_query?'provider' or s.provider=p_query->>'provider')$old$, $new$and (not p_query?'provider' or s.provider=p_query->>'provider')
    and (s.provider in ('crunchyroll','youtube') or p_query->'providerVersion'='2'::jsonb or p_query->>'provider'='netflix')$new$, 1);

select pg_temp.netflix_patch('public.watch_history_browse_matches_v3'::regproc::oid::regprocedure, $old$and (not p_query?'provider' or ep.provider=p_query->>'provider')$old$, $new$and (not p_query?'provider' or ep.provider=p_query->>'provider')
    and (ep.provider in ('crunchyroll','youtube') or p_query->'providerVersion'='2'::jsonb or p_query->>'provider'='netflix')$new$, 1);

select pg_temp.netflix_patch('public.browse_watch_history_v3'::regproc::oid::regprocedure, $old$'episodeKey','includeEpisodePreviews'$old$, $new$'episodeKey','includeEpisodePreviews','providerVersion'$new$, 1);

select pg_temp.netflix_patch('public.browse_watch_history_v3'::regproc::oid::regprocedure, $old$    or (p_query?'includeEpisodePreviews'$old$, $new$    or (p_query?'providerVersion' and p_query->'providerVersion' not in ('1'::jsonb,'2'::jsonb))
    or (p_query?'includeEpisodePreviews'$new$, 1);

select pg_temp.netflix_patch('public.browse_watch_history_v3'::regproc::oid::regprocedure, $old$generation,'{"mode":"shared"}'$old$, $new$generation,jsonb_build_object('mode','shared') || (p_query-array['mode','limit','cursor'])$new$, 1);

CREATE OR REPLACE FUNCTION public.list_watch_history_v3_provider_page(p_user_id uuid, p_history_generation bigint, p_limit integer, p_provider_version integer, p_cursor_watched_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_stable_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform public.check_personal_history_operation_v1(p_user_id,'read');
  if p_provider_version is null or p_provider_version not in (1,2) or p_user_id is null
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
        and (p_provider_version=2 or summary.provider in ('crunchyroll','youtube'))
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
        and (p_provider_version=2 or summary.provider in ('crunchyroll','youtube'))
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
            'episode_title', coalesce(public.watch_catalog_label_v3(p_user_id,episode.history_generation,episode.provider,episode.title_key,episode.episode_key)->>'episodeTitle',episode.episode_title),
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
        and (p_provider_version=2 or summary.provider in ('crunchyroll','youtube'))
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
              'catalog', public.watch_catalog_read_v3(p_user_id,(select settings.history_generation from canonical_settings settings),title.provider,title.title_key),
              'episodePage', pg_catalog.jsonb_build_object(
                'complete', title.observed_episode_count <= 8,
                'nextCursor', case
                  when title.observed_episode_count <= 8 then null
                  else (
                    select pg_catalog.encode(
                      pg_catalog.convert_to(
                        pg_catalog.jsonb_build_object(
                          'v', 1,
                          'userId', p_user_id,
                          'accountGeneration', (
                            select settings.history_generation
                            from canonical_settings as settings
                          ),
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
$function$;
revoke all on function public.list_watch_history_v3_provider_page(uuid,bigint,integer,integer,timestamptz,text) from public,anon,authenticated;
grant execute on function public.list_watch_history_v3_provider_page(uuid,bigint,integer,integer,timestamptz,text) to service_role;

create or replace function public.list_watch_history_v3_bounded_page(p_user_id uuid,p_history_generation bigint,p_limit integer,p_cursor_watched_at timestamptz default null,p_cursor_stable_id text default null)
returns jsonb language sql security invoker set search_path='' as $$
  select public.list_watch_history_v3_provider_page(p_user_id,p_history_generation,p_limit,1,p_cursor_watched_at,p_cursor_stable_id);
$$;

-- Explicit opt-in: the existing v1 function and wire shape are unchanged.
CREATE OR REPLACE FUNCTION public.get_watch_history_capacity_v2(p_user_id uuid, p_history_generation bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
 SET lock_timeout TO '5s'
 SET statement_timeout TO '15s'
AS $function$
declare
  generation bigint;
  youtube_used bigint;
  crunchyroll_used bigint;
  netflix_used bigint;
begin
  if p_user_id is null or not exists(select 1 from public.users where id = p_user_id)
    then raise exception 'HISTORY_ACCESS_UNAVAILABLE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  -- One snapshot binds current generation and all provider counts. No settings
  -- row is created just because an account opens its capacity display.
  select coalesce(s.history_generation, 1),
    count(distinct p.title_key) filter (where p.provider = 'youtube'),
    count(distinct p.title_key) filter (where p.provider = 'crunchyroll'),
    count(distinct p.title_key) filter (where p.provider = 'netflix')
  into generation, youtube_used, crunchyroll_used, netflix_used
  from (select 1) singleton
  left join public.user_watch_settings s on s.user_id = p_user_id
  left join public.watch_episode_progress p on p.user_id = p_user_id
    and p.history_generation = coalesce(s.history_generation, 1)
  group by s.history_generation;
  if p_history_generation is not null and p_history_generation is distinct from generation
    then raise exception 'watch_history_generation_mismatch'; end if;
  return jsonb_build_object(
    'capacityVersion', 2, 'ownerUserId', p_user_id, 'accountGeneration', generation,
    'serverTime', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'providers', jsonb_build_object(
      'youtube', jsonb_build_object('used', youtube_used, 'limit', 100),
      'crunchyroll', jsonb_build_object('used', crunchyroll_used, 'limit', 200),
      'netflix', jsonb_build_object('used', netflix_used, 'limit', 200)
    )
  );
end $function$;
revoke all on function public.get_watch_history_capacity_v2(uuid,bigint) from public,anon,authenticated;
grant execute on function public.get_watch_history_capacity_v2(uuid,bigint) to service_role;

drop function pg_temp.netflix_patch(regprocedure,text,text,integer);
commit;
