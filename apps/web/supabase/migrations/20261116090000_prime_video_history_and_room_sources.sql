begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- Additive provider admission only. Guard every active definition anchor, retain
-- function ownership, security mode, search path and privileges. No data rewrite.
create function pg_temp.prime_patch(routine regprocedure, needle text, replacement text, expected integer default 1)
returns void language plpgsql as $$
declare body text := pg_get_functiondef(routine);
begin
  if needle = '' or (length(body)-length(replace(body,needle,''))) / length(needle) <> expected then
    raise exception 'prime migration anchor mismatch: %', routine;
  end if;
  execute replace(body,needle,replacement);
end $$;

alter table public.watch_episode_progress drop constraint watch_episode_progress_provider_check, add constraint watch_episode_progress_provider_check check (provider in ('crunchyroll','youtube','netflix','primevideo'));

alter table public.watch_history_deletions drop constraint watch_history_deletions_provider_check, add constraint watch_history_deletions_provider_check check (provider is null or provider in ('crunchyroll','youtube','netflix','primevideo'));

alter table public.watch_history_title_summaries drop constraint watch_history_title_summaries_provider_check, add constraint watch_history_title_summaries_provider_check check (provider in ('crunchyroll','youtube','netflix','primevideo'));

alter table public.watch_history_user_session_summaries drop constraint watch_history_user_session_summaries_provider_check, add constraint watch_history_user_session_summaries_provider_check check (provider in ('crunchyroll','youtube','netflix','primevideo'));

alter table public.watch_catalog_snapshots drop constraint watch_catalog_snapshots_provider_check, add constraint watch_catalog_snapshots_provider_check check (provider in ('crunchyroll','netflix','primevideo'));

alter table public.watch_sessions drop constraint watch_sessions_provider_check, add constraint watch_sessions_provider_check check (provider in ('crunchyroll','netflix','youtube','amazon','primevideo'));
alter table public.user_tracked_titles drop constraint user_tracked_titles_provider_check, add constraint user_tracked_titles_provider_check check (provider in ('crunchyroll','netflix','youtube','amazon','primevideo'));

do $migration$
declare body text; needle text := 'ARRAY[''crunchyroll''::text, ''youtube''::text, ''netflix''::text]';
begin
 select pg_get_constraintdef(oid) into strict body from pg_constraint where conrelid='public.rooms'::regclass and conname='rooms_source_tuple_check';
 if (length(body)-length(replace(body,needle,'')))/length(needle) <> 1 then raise exception 'prime room tuple anchor mismatch'; end if;
 body:=replace(body,needle,'ARRAY[''crunchyroll''::text, ''youtube''::text, ''netflix''::text, ''primevideo''::text]');
 alter table public.rooms drop constraint rooms_source_tuple_check;
 execute 'alter table public.rooms add constraint rooms_source_tuple_check '||body;
 select pg_get_constraintdef(oid) into strict body from pg_constraint where conrelid='public.rooms'::regclass and conname='rooms_source_url_canonical_check';
 if body not like 'CHECK (%' or strpos(body, 'netflix')=0 or strpos(body,'primevideo')>0 then raise exception 'prime room URL anchor mismatch'; end if;
 alter table public.rooms drop constraint rooms_source_url_canonical_check;
 execute 'alter table public.rooms add constraint rooms_source_url_canonical_check check ('||substring(body from 8 for length(body)-8)||$clause$
   or (source_provider='primevideo' and source_url ~ '^https://www[.]primevideo[.]com/detail/[A-Z0-9]{26}$'
     and video_fingerprint='primevideo|detail/'||substring(source_url from '/detail/([A-Z0-9]{26})$')))$clause$;
end $migration$;

select pg_temp.prime_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo')$new$, 1);

select pg_temp.prime_patch('public.delete_watch_history_v3'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo')$new$, 2);

select pg_temp.prime_patch('public.list_watch_history_v3_title_episodes_page'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo')$new$, 1);

select pg_temp.prime_patch('public.persist_room_source_v1'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo')$new$, 1);

select pg_temp.prime_patch('public.create_room_with_active_session_v4'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo')$new$, 1);

select pg_temp.prime_patch('anidachi_room_private.create_room_with_active_session_v2'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo')$new$, 1);

select pg_temp.prime_patch('public.get_watch_history_editor_v1'::regproc::oid::regprocedure, $old$('crunchyroll','youtube','netflix')$old$, $new$('crunchyroll','youtube','netflix','primevideo')$new$, 1);

select pg_temp.prime_patch('public.edit_watch_history_v1'::regproc::oid::regprocedure, $old$('crunchyroll','youtube','netflix')$old$, $new$('crunchyroll','youtube','netflix','primevideo')$new$, 1);

select pg_temp.prime_patch('anidachi_history_private.begin_watch_catalog_v3'::regproc::oid::regprocedure, $old$('crunchyroll','netflix')$old$, $new$('crunchyroll','netflix','primevideo')$new$, 1);

select pg_temp.prime_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$('crunchyroll','netflix')$old$, $new$('crunchyroll','netflix','primevideo')$new$, 1);

select pg_temp.prime_patch('public.edit_watch_history_v1'::regproc::oid::regprocedure, $old$case when prov in ('crunchyroll','netflix') then$old$, $new$case when prov='primevideo' then substring(ep->>'sourceUrl' from '/detail/([A-Z0-9]{26})$') when prov in ('crunchyroll','netflix') then$new$, 1);

select pg_temp.prime_patch('public.apply_personal_watch_progress_v1'::regproc::oid::regprocedure, $old$'kind','crunchyrollIdentity','youtubeVideoId','netflixIdentity'$old$, $new$'kind','crunchyrollIdentity','youtubeVideoId','netflixIdentity','primevideoIdentity'$new$, 1);

select pg_temp.prime_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure, $old$when 'netflix' then 200 end$old$, $new$when 'netflix' then 200 when 'primevideo' then 200 end$new$, 1);

select pg_temp.prime_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure, $old$p_event#>>'{netflixIdentity,providerMovieId}')$old$, $new$p_event#>>'{netflixIdentity,providerMovieId}',p_event#>>'{primevideoIdentity,providerEpisodeIdentifier}',p_event#>>'{primevideoIdentity,providerMovieId}')$new$, 2);

select pg_temp.prime_patch('public.persist_room_source_v1'::regproc::oid::regprocedure, $old$  else
    raise exception 'room_source_invalid_input'$old$, $new$  elsif p_source_provider = 'primevideo'
    and p_source_url ~ '^https://www[.]primevideo[.]com/detail/[A-Z0-9]{26}$'
  then
    v_expected_video_fingerprint := 'primevideo|detail/' || substring(p_source_url from '/detail/([A-Z0-9]{26})$');
  else
    raise exception 'room_source_invalid_input'$new$, 1);

select pg_temp.prime_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$('https://www.'||(p_request->>'provider')||'.com/watch/')$old$, $new$(case when p_request->>'provider'='primevideo' then 'https://www.primevideo.com/detail/' else 'https://www.'||(p_request->>'provider')||'.com/watch/' end)$new$, 1);

select pg_temp.prime_patch('public.validate_watch_identity_v3'::regproc::oid::regprocedure, $old$  if p_event->>'provider' = 'netflix' then$old$, $new$  if (p_event->>'provider'<>'primevideo' and (p_event ? 'primevideoIdentity'
      or p_event->>'titleKey' like 'primevideo:%' or p_event->>'episodeKey' like 'primevideo:%'
      or p_event->>'seasonKey' like 'primevideo:%'
      or p_event->>'sourceUrl' ~* '^https?://([^/@]+@)?([^/]*[.])?primevideo[.]com([/:?#]|$)'))
    or (p_event->>'provider'='primevideo' and p_event ?| array['crunchyrollIdentity','youtubeVideoId','netflixIdentity'])
  then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
  if p_event->>'provider' = 'primevideo' then
    i:=p_event->'primevideoIdentity';
    if jsonb_typeof(i) is distinct from 'object' or coalesce(i->>'kind','') not in ('movie','episode')
      or not coalesce((p_event->'artworkUrl'='null'::jsonb or (jsonb_typeof(p_event->'artworkUrl')='string'
        and length(p_event->>'artworkUrl')<=2048 and p_event->>'artworkUrl' ~ '^https://(images-na[.]ssl-images-amazon[.]com|m[.]media-amazon[.]com)/images/[^#[:space:]\\]*$'
        and p_event->>'artworkUrl' !~* '(%2e|/[.]{1,2}(/|[?]|$))')),false)
    then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
    if i->>'kind'='movie' then
      if i-array['kind','providerMovieId']<>'{}'::jsonb
        or jsonb_typeof(i->'providerMovieId') is distinct from 'string'
        or coalesce(i->>'providerMovieId','') !~ '^[A-Z0-9]{26}$'
        or p_event->>'itemKind' is distinct from 'movie'
        or p_event->>'titleKey' is distinct from 'primevideo:movie:'||(i->>'providerMovieId')
        or p_event->>'episodeKey' is distinct from p_event->>'titleKey'
        or p_event->'seasonKey' is distinct from 'null'::jsonb
        or p_event->'seasonTitle' is distinct from 'null'::jsonb
        or p_event->'seasonNumber' is distinct from 'null'::jsonb
        or p_event->'episodeNumber' is distinct from 'null'::jsonb
        or p_event->>'sourceUrl' is distinct from 'https://www.primevideo.com/detail/'||(i->>'providerMovieId')
      then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
    else
      if i-array['kind','seriesAnchorSeasonId','providerSeasonIdentifier','providerEpisodeIdentifier']<>'{}'::jsonb
        or jsonb_typeof(i->'seriesAnchorSeasonId') is distinct from 'string'
        or jsonb_typeof(i->'providerSeasonIdentifier') is distinct from 'string'
        or jsonb_typeof(i->'providerEpisodeIdentifier') is distinct from 'string'
        or coalesce(i->>'seriesAnchorSeasonId','') !~ '^[A-Z0-9]{26}$'
        or coalesce(i->>'providerSeasonIdentifier','') !~ '^[A-Z0-9]{26}$'
        or coalesce(i->>'providerEpisodeIdentifier','') !~ '^[A-Z0-9]{26}$'
        or p_event->>'itemKind' is distinct from 'series'
        or p_event->>'titleKey' is distinct from 'primevideo:series:'||(i->>'seriesAnchorSeasonId')
        or p_event->>'seasonKey' is distinct from 'primevideo:season:'||(i->>'providerSeasonIdentifier')
        or p_event->>'episodeKey' is distinct from 'primevideo:episode:'||(i->>'providerEpisodeIdentifier')
        or p_event->>'sourceUrl' is distinct from 'https://www.primevideo.com/detail/'||(i->>'providerEpisodeIdentifier')
      then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
    end if;

  elsif p_event->>'provider' = 'netflix' then$new$, 1);

select pg_temp.prime_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$   or not public.watch_catalog_text_valid_v3(r->'titleKey',1,220)$old$, $new$   or (r->>'provider'='primevideo' and (jsonb_typeof(r->'providerSeriesId') is distinct from 'string'
     or coalesce(r->>'providerSeriesId','') !~ '^[A-Z0-9]{26}$'
     or r->>'titleKey' is distinct from 'primevideo:series:'||(r->>'providerSeriesId')))
   or not public.watch_catalog_text_valid_v3(r->'titleKey',1,220)$new$, 1);

select pg_temp.prime_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$   or not public.watch_catalog_text_valid_v3(snap->'title',1,300)$old$, $new$   or (r->>'provider'='primevideo' and (snap->'providerSeriesId' is distinct from r->'providerSeriesId'
     or snap->'titleKey' is distinct from r->'titleKey' or snap->'context' is distinct from r->'context'))
   or not public.watch_catalog_text_valid_v3(snap->'title',1,300)$new$, 1);

select pg_temp.prime_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$
   if (r->>'provider'='netflix'$old$, $new$
   if (r->>'provider'='primevideo' and (jsonb_typeof(s->'providerSeasonIdentifier') is distinct from 'string'
     or coalesce(s->>'providerSeasonIdentifier','') !~ '^[A-Z0-9]{26}$'
     or s->>'seasonKey' is distinct from 'primevideo:season:'||(s->>'providerSeasonIdentifier')))
     or (r->>'provider'='netflix'$new$, 1);

select pg_temp.prime_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$
     if (r->>'provider'='netflix'$old$, $new$
     if (r->>'provider'='primevideo' and (jsonb_typeof(e->'providerEpisodeIdentifier') is distinct from 'string'
       or coalesce(e->>'providerEpisodeIdentifier','') !~ '^[A-Z0-9]{26}$'
       or e->>'episodeKey' is distinct from 'primevideo:episode:'||(e->>'providerEpisodeIdentifier')))
       or (r->>'provider'='netflix'$new$, 1);

select pg_temp.prime_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$r->>'provider'='netflix' and jsonb_array_length(e->'watchVariants')<>1$old$, $new$r->>'provider' in ('netflix','primevideo') and jsonb_array_length(e->'watchVariants')<>1$new$, 1);

select pg_temp.prime_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$
       if (r->>'provider'='netflix'$old$, $new$
       if (r->>'provider'='primevideo' and (v->'providerContentId' is distinct from e->'providerEpisodeIdentifier'
         or v->>'sourceUrl' is distinct from 'https://www.primevideo.com/detail/'||(e->>'providerEpisodeIdentifier')))
         or (r->>'provider'='netflix'$new$, 1);

select pg_temp.prime_patch('public.watch_history_browse_matches_v3'::regproc::oid::regprocedure, $old$(s.provider in ('crunchyroll','youtube') or p_query->'providerVersion'='2'::jsonb or p_query->>'provider'='netflix')$old$, $new$(s.provider in ('crunchyroll','youtube') or (s.provider='netflix' and p_query->'providerVersion' in ('2'::jsonb,'3'::jsonb)) or (s.provider='primevideo' and p_query->'providerVersion'='3'::jsonb) or s.provider=p_query->>'provider')$new$, 1);

select pg_temp.prime_patch('public.watch_history_browse_matches_v3'::regproc::oid::regprocedure, $old$(ep.provider in ('crunchyroll','youtube') or p_query->'providerVersion'='2'::jsonb or p_query->>'provider'='netflix')$old$, $new$(ep.provider in ('crunchyroll','youtube') or (ep.provider='netflix' and p_query->'providerVersion' in ('2'::jsonb,'3'::jsonb)) or (ep.provider='primevideo' and p_query->'providerVersion'='3'::jsonb) or ep.provider=p_query->>'provider')$new$, 1);

select pg_temp.prime_patch('public.browse_watch_history_v3'::regproc::oid::regprocedure, $old$not in ('1'::jsonb,'2'::jsonb)$old$, $new$not in ('1'::jsonb,'2'::jsonb,'3'::jsonb)$new$, 1);

select pg_temp.prime_patch('public.list_watch_history_v3_provider_page'::regproc::oid::regprocedure, $old$p_provider_version not in (1,2)$old$, $new$p_provider_version not in (1,2,3)$new$, 1);

select pg_temp.prime_patch('public.list_watch_history_v3_provider_page'::regproc::oid::regprocedure, $old$(p_provider_version=2 or summary.provider in ('crunchyroll','youtube'))$old$, $new$(summary.provider in ('crunchyroll','youtube') or (p_provider_version>=2 and summary.provider='netflix') or (p_provider_version=3 and summary.provider='primevideo'))$new$, 3);

CREATE OR REPLACE FUNCTION public.get_watch_history_capacity_v3(p_user_id uuid, p_history_generation bigint DEFAULT NULL::bigint)
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
  primevideo_used bigint;
begin
  if p_user_id is null or not exists(select 1 from public.users where id = p_user_id)
    then raise exception 'HISTORY_ACCESS_UNAVAILABLE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  -- One snapshot binds current generation and all provider counts. No settings
  -- row is created just because an account opens its capacity display.
  select coalesce(s.history_generation, 1),
    count(distinct p.title_key) filter (where p.provider = 'youtube'),
    count(distinct p.title_key) filter (where p.provider = 'crunchyroll'),
    count(distinct p.title_key) filter (where p.provider = 'netflix'),
    count(distinct p.title_key) filter (where p.provider = 'primevideo')
  into generation, youtube_used, crunchyroll_used, netflix_used, primevideo_used
  from (select 1) singleton
  left join public.user_watch_settings s on s.user_id = p_user_id
  left join public.watch_episode_progress p on p.user_id = p_user_id
    and p.history_generation = coalesce(s.history_generation, 1)
  group by s.history_generation;
  if p_history_generation is not null and p_history_generation is distinct from generation
    then raise exception 'watch_history_generation_mismatch'; end if;
  return jsonb_build_object(
    'capacityVersion', 3, 'ownerUserId', p_user_id, 'accountGeneration', generation,
    'serverTime', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'providers', jsonb_build_object(
      'youtube', jsonb_build_object('used', youtube_used, 'limit', 100),
      'crunchyroll', jsonb_build_object('used', crunchyroll_used, 'limit', 200),
      'netflix', jsonb_build_object('used', netflix_used, 'limit', 200),
      'primevideo', jsonb_build_object('used', primevideo_used, 'limit', 200)
    )
  );
end $function$;
revoke all on function public.get_watch_history_capacity_v3(uuid,bigint) from public,anon,authenticated;
grant execute on function public.get_watch_history_capacity_v3(uuid,bigint) to service_role;


drop function pg_temp.prime_patch(regprocedure,text,text,integer);
commit;
