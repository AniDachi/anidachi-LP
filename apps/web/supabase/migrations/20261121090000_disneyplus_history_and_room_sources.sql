begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- Additive provider admission only. Guard every active definition anchor, retain
-- function ownership, security mode, search path and privileges. No data rewrite.
create function pg_temp.disney_patch(routine regprocedure, needle text, replacement text, expected integer default 1)
returns void language plpgsql as $$
declare body text := pg_get_functiondef(routine);
begin
  if needle = '' or (length(body)-length(replace(body,needle,''))) / length(needle) <> expected then
    raise exception 'Disney+ migration anchor mismatch: %', routine;
  end if;
  execute replace(body,needle,replacement);
end $$;

alter table public.watch_episode_progress drop constraint watch_episode_progress_provider_check, add constraint watch_episode_progress_provider_check check (provider in ('crunchyroll','youtube','netflix','primevideo','disneyplus'));

alter table public.watch_history_deletions drop constraint watch_history_deletions_provider_check, add constraint watch_history_deletions_provider_check check (provider is null or provider in ('crunchyroll','youtube','netflix','primevideo','disneyplus'));

alter table public.watch_history_title_summaries drop constraint watch_history_title_summaries_provider_check, add constraint watch_history_title_summaries_provider_check check (provider in ('crunchyroll','youtube','netflix','primevideo','disneyplus'));

alter table public.watch_history_user_session_summaries drop constraint watch_history_user_session_summaries_provider_check, add constraint watch_history_user_session_summaries_provider_check check (provider in ('crunchyroll','youtube','netflix','primevideo','disneyplus'));

alter table public.watch_catalog_snapshots drop constraint watch_catalog_snapshots_provider_check, add constraint watch_catalog_snapshots_provider_check check (provider in ('crunchyroll','netflix','primevideo','disneyplus'));

alter table public.watch_sessions drop constraint watch_sessions_provider_check, add constraint watch_sessions_provider_check check (provider in ('crunchyroll','netflix','youtube','amazon','primevideo','disneyplus'));
alter table public.user_tracked_titles drop constraint user_tracked_titles_provider_check, add constraint user_tracked_titles_provider_check check (provider in ('crunchyroll','netflix','youtube','amazon','primevideo','disneyplus'));

do $migration$
declare body text; needle text := 'ARRAY[''crunchyroll''::text, ''youtube''::text, ''netflix''::text, ''primevideo''::text]';
begin
 select pg_get_constraintdef(oid) into strict body from pg_constraint where conrelid='public.rooms'::regclass and conname='rooms_source_tuple_check';
 if (length(body)-length(replace(body,needle,'')))/length(needle) <> 1 then raise exception 'Disney+ room tuple anchor mismatch'; end if;
 body:=replace(body,needle,'ARRAY[''crunchyroll''::text, ''youtube''::text, ''netflix''::text, ''primevideo''::text, ''disneyplus''::text]');
 alter table public.rooms drop constraint rooms_source_tuple_check;
 execute 'alter table public.rooms add constraint rooms_source_tuple_check '||body;
 select pg_get_constraintdef(oid) into strict body from pg_constraint where conrelid='public.rooms'::regclass and conname='rooms_source_url_canonical_check';
 if body not like 'CHECK (%' or strpos(body, 'primevideo')=0 or strpos(body,'disneyplus')>0 then raise exception 'Disney+ room URL anchor mismatch'; end if;
 alter table public.rooms drop constraint rooms_source_url_canonical_check;
 execute 'alter table public.rooms add constraint rooms_source_url_canonical_check check ('||substring(body from 8 for length(body)-8)||$clause$
   or (source_provider='disneyplus' and source_url ~ '^https://www[.]disneyplus[.]com/play/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
     and video_fingerprint='disneyplus|play/'||split_part(source_url,'/',5)))$clause$;
end $migration$;


select pg_temp.disney_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix', 'primevideo')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo', 'disneyplus')$new$, 1);

select pg_temp.disney_patch('public.delete_watch_history_v3'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix', 'primevideo')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo', 'disneyplus')$new$, 2);

select pg_temp.disney_patch('public.list_watch_history_v3_title_episodes_page'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix', 'primevideo')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo', 'disneyplus')$new$, 1);

select pg_temp.disney_patch('public.list_watch_history_v3_title_episodes_page_prime_navigation_v1'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix', 'primevideo')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo', 'disneyplus')$new$, 1);

select pg_temp.disney_patch('public.persist_room_source_v1'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix', 'primevideo')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo', 'disneyplus')$new$, 1);

select pg_temp.disney_patch('public.persist_room_source_v2'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix', 'primevideo')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo', 'disneyplus')$new$, 1);

select pg_temp.disney_patch('public.create_room_with_active_session_v4'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix', 'primevideo')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo', 'disneyplus')$new$, 1);

select pg_temp.disney_patch('anidachi_room_private.create_room_with_active_session_v2'::regproc::oid::regprocedure, $old$('crunchyroll', 'youtube', 'netflix', 'primevideo')$old$, $new$('crunchyroll', 'youtube', 'netflix', 'primevideo', 'disneyplus')$new$, 1);

select pg_temp.disney_patch('public.get_watch_history_editor_v1'::regproc::oid::regprocedure, $old$('crunchyroll','youtube','netflix','primevideo')$old$, $new$('crunchyroll','youtube','netflix','primevideo','disneyplus')$new$, 1);

select pg_temp.disney_patch('public.get_watch_history_editor_v1_prime_navigation_v1'::regproc::oid::regprocedure, $old$('crunchyroll','youtube','netflix','primevideo')$old$, $new$('crunchyroll','youtube','netflix','primevideo','disneyplus')$new$, 1);

select pg_temp.disney_patch('public.edit_watch_history_v1'::regproc::oid::regprocedure, $old$('crunchyroll','youtube','netflix','primevideo')$old$, $new$('crunchyroll','youtube','netflix','primevideo','disneyplus')$new$, 1);

select pg_temp.disney_patch('anidachi_history_private.begin_watch_catalog_v3'::regproc::oid::regprocedure, $old$('crunchyroll','netflix','primevideo')$old$, $new$('crunchyroll','netflix','primevideo','disneyplus')$new$, 1);

select pg_temp.disney_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$('crunchyroll','netflix','primevideo')$old$, $new$('crunchyroll','netflix','primevideo','disneyplus')$new$, 1);

select pg_temp.disney_patch('public.edit_watch_history_v1'::regproc::oid::regprocedure, $old$case when prov='primevideo' then substring$old$, $new$case when prov='disneyplus' then split_part(ep->>'sourceUrl','/',5) when prov='primevideo' then substring$new$, 1);

select pg_temp.disney_patch('public.apply_personal_watch_progress_v1'::regproc::oid::regprocedure, $old$'primevideoIdentity','primeNavigation']$old$, $new$'primevideoIdentity','disneyplusIdentity','primeNavigation']$new$, 1);

select pg_temp.disney_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure, $old$when 'primevideo' then 200 end$old$, $new$when 'primevideo' then 200 when 'disneyplus' then 200 end$new$, 1);

select pg_temp.disney_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure, $old$p_event#>>'{primevideoIdentity,providerMovieId}')$old$, $new$p_event#>>'{primevideoIdentity,providerMovieId}',p_event#>>'{disneyplusIdentity,providerEpisodeIdentifier}',p_event#>>'{disneyplusIdentity,providerMovieId}')$new$, 2);

select pg_temp.disney_patch('public.persist_room_source_v1'::regproc::oid::regprocedure, $old$  elsif p_source_provider = 'primevideo'$old$, $new$  elsif p_source_provider = 'disneyplus'
    and p_source_url ~ '^https://www[.]disneyplus[.]com/play/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    v_expected_video_fingerprint := 'disneyplus|play/' || split_part(p_source_url,'/',5);
  elsif p_source_provider = 'primevideo'$new$, 1);

select pg_temp.disney_patch('public.persist_room_source_v2'::regproc::oid::regprocedure, $old$  elsif p_source_provider = 'primevideo'$old$, $new$  elsif p_source_provider = 'disneyplus'
    and p_source_url ~ '^https://www[.]disneyplus[.]com/play/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    v_expected_video_fingerprint := 'disneyplus|play/' || split_part(p_source_url,'/',5);
  elsif p_source_provider = 'primevideo'$new$, 1);

select pg_temp.disney_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$(case when p_request->>'provider'='primevideo' then$old$, $new$(case when p_request->>'provider'='disneyplus' then 'https://www.disneyplus.com/play/' when p_request->>'provider'='primevideo' then$new$, 1);

select pg_temp.disney_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure, $old$if c.provider='primevideo' and c.attempt_status='pending'$old$, $new$if c.provider in ('primevideo','disneyplus') and c.attempt_status='pending'$new$, 1);

select pg_temp.disney_patch('anidachi_history_private.watch_editor_catalog_variants'::regproc::oid::regprocedure, $old$if prov<>'primevideo' then return;$old$, $new$if prov not in ('primevideo','disneyplus') then return;$new$, 1);

select pg_temp.disney_patch('anidachi_history_private.watch_editor_catalog_variants'::regproc::oid::regprocedure, $old$or c.context->>'region' is null or c.snapshot$old$, $new$or (prov='primevideo' and c.context->>'region' is null) or c.snapshot$new$, 1);

select pg_temp.disney_patch('public.validate_watch_identity_v3'::regproc::oid::regprocedure, $old$  if p_event->>'provider' = 'primevideo' then$old$, $new$  if (p_event->>'provider'<>'disneyplus' and (p_event ? 'disneyplusIdentity'
      or p_event->>'titleKey' like 'disneyplus:%' or p_event->>'episodeKey' like 'disneyplus:%'
      or p_event->>'seasonKey' like 'disneyplus:%'
      or p_event->>'sourceUrl' ~* '^https?://([^/@]+@)?([^/]*[.])?disneyplus[.]com[.]?([/:?#]|$)'))
    or (p_event->>'provider'='disneyplus' and p_event ?| array['crunchyrollIdentity','youtubeVideoId','netflixIdentity','primevideoIdentity'])
  then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
  if p_event->>'provider'='disneyplus' then
    i:=p_event->'disneyplusIdentity';
    if jsonb_typeof(i) is distinct from 'object' or coalesce(i->>'kind','') not in ('movie','episode')
      or not coalesce(p_event->'artworkUrl'='null'::jsonb or
        (jsonb_typeof(p_event->'artworkUrl')='string' and length(p_event->>'artworkUrl')<=2048
        and p_event->>'artworkUrl' ~ '^https://disney[.]images[.]edge[.]bamgrid[.]com/[^?#[:space:]\\]+([?][^#[:space:]\\]*)?$'
        and p_event->>'artworkUrl' !~* '(%2e|/[.]{1,2}(/|[?]|$))'),false)
    then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
    if i->>'kind'='movie' then
      if i-array['kind','providerMovieId']<>'{}'::jsonb
        or jsonb_typeof(i->'providerMovieId') is distinct from 'string' or coalesce(i->>'providerMovieId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
        or p_event->>'itemKind' is distinct from 'movie'
        or p_event->>'titleKey' is distinct from 'disneyplus:movie:'||(i->>'providerMovieId')
        or p_event->>'episodeKey' is distinct from p_event->>'titleKey'
        or p_event->>'sourceUrl' is distinct from 'https://www.disneyplus.com/play/'||(i->>'providerMovieId')
        or p_event->'seasonKey' is distinct from 'null'::jsonb or p_event->'seasonNumber' is distinct from 'null'::jsonb
        or p_event->'seasonTitle' is distinct from 'null'::jsonb or p_event->'episodeNumber' is distinct from 'null'::jsonb
      then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
    else
      if i-array['kind','providerSeriesId','providerEpisodeIdentifier']<>'{}'::jsonb
        or jsonb_typeof(i->'providerSeriesId') is distinct from 'string' or coalesce(i->>'providerSeriesId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
        or jsonb_typeof(i->'providerEpisodeIdentifier') is distinct from 'string' or coalesce(i->>'providerEpisodeIdentifier','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
        or p_event->>'itemKind' is distinct from 'series'
        or p_event->>'titleKey' is distinct from 'disneyplus:series:'||(i->>'providerSeriesId')
        or p_event->>'episodeKey' is distinct from 'disneyplus:episode:'||(i->>'providerEpisodeIdentifier')
        or p_event->>'sourceUrl' is distinct from 'https://www.disneyplus.com/play/'||(i->>'providerEpisodeIdentifier')
        or not public.watch_catalog_number_valid_v3(p_event->'seasonNumber',1000,true,true)
        or p_event->'seasonNumber'='0'::jsonb
        or (p_event->'seasonNumber'='null'::jsonb and (p_event->'seasonKey' is distinct from 'null'::jsonb or p_event->'seasonTitle' is distinct from 'null'::jsonb))
        or (p_event->'seasonNumber'<>'null'::jsonb and p_event->>'seasonKey' is distinct from
          'disneyplus:season:'||(i->>'providerSeriesId')||':'||(p_event->>'seasonNumber')::numeric::integer::text)
      then raise exception 'watch_history_identity_invalid' using errcode='22023'; end if;
    end if;
  elsif p_event->>'provider' = 'primevideo' then$new$, 1);

select pg_temp.disney_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$   or not public.watch_catalog_text_valid_v3(r->'titleKey',1,220)$old$, $new$   or (r->>'provider'='disneyplus' and (jsonb_typeof(r->'providerSeriesId') is distinct from 'string'
     or coalesce(r->>'providerSeriesId','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' or r->>'titleKey' is distinct from 'disneyplus:series:'||(r->>'providerSeriesId')))
   or not public.watch_catalog_text_valid_v3(r->'titleKey',1,220)$new$, 1);

select pg_temp.disney_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$   or not public.watch_catalog_text_valid_v3(snap->'title',1,300)$old$, $new$   or (r->>'provider'='disneyplus' and (snap->'providerSeriesId' is distinct from r->'providerSeriesId'
     or snap->'titleKey' is distinct from r->'titleKey' or snap->'context' is distinct from r->'context'))
   or not public.watch_catalog_text_valid_v3(snap->'title',1,300)$new$, 1);

select pg_temp.disney_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$
   if (r->>'provider'='primevideo'$old$, $new$
   if (r->>'provider'='disneyplus' and (jsonb_typeof(s->'providerSeasonIdentifier') is distinct from 'string'
     or not public.watch_catalog_number_valid_v3(s->'seasonNumber',1000,true) or s->'seasonNumber'='0'::jsonb
     or s->>'providerSeasonIdentifier' is distinct from (r->>'providerSeriesId')||':'||(s->>'seasonNumber')
     or s->>'seasonKey' is distinct from 'disneyplus:season:'||(s->>'providerSeasonIdentifier')))
     or (r->>'provider'='primevideo'$new$, 1);

select pg_temp.disney_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$
     if (r->>'provider'='primevideo'$old$, $new$
     if (r->>'provider'='disneyplus' and (jsonb_typeof(e->'providerEpisodeIdentifier') is distinct from 'string'
       or coalesce(e->>'providerEpisodeIdentifier','') !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
       or e->>'episodeKey' is distinct from 'disneyplus:episode:'||(e->>'providerEpisodeIdentifier')))
       or (r->>'provider'='primevideo'$new$, 1);

select pg_temp.disney_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$
       if (r->>'provider'='primevideo'$old$, $new$
       if (r->>'provider'='disneyplus' and (v->'providerContentId' is distinct from e->'providerEpisodeIdentifier'
         or v->>'sourceUrl' is distinct from 'https://www.disneyplus.com/play/'||(e->>'providerEpisodeIdentifier')))
         or (r->>'provider'='primevideo'$new$, 1);

select pg_temp.disney_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure, $old$r->>'provider' in ('netflix','primevideo') and jsonb_array_length$old$, $new$r->>'provider' in ('netflix','primevideo','disneyplus') and jsonb_array_length$new$, 1);

select pg_temp.disney_patch('public.watch_history_browse_matches_v3'::regproc::oid::regprocedure, $old$(s.provider='netflix' and p_query->'providerVersion' in ('2'::jsonb,'3'::jsonb)) or (s.provider='primevideo' and p_query->'providerVersion'='3'::jsonb)$old$, $new$(s.provider='netflix' and p_query->'providerVersion' in ('2'::jsonb,'3'::jsonb,'4'::jsonb)) or (s.provider='primevideo' and p_query->'providerVersion' in ('3'::jsonb,'4'::jsonb)) or (s.provider='disneyplus' and p_query->'providerVersion'='4'::jsonb)$new$, 1);

select pg_temp.disney_patch('public.watch_history_browse_matches_v3'::regproc::oid::regprocedure, $old$(ep.provider='netflix' and p_query->'providerVersion' in ('2'::jsonb,'3'::jsonb)) or (ep.provider='primevideo' and p_query->'providerVersion'='3'::jsonb)$old$, $new$(ep.provider='netflix' and p_query->'providerVersion' in ('2'::jsonb,'3'::jsonb,'4'::jsonb)) or (ep.provider='primevideo' and p_query->'providerVersion' in ('3'::jsonb,'4'::jsonb)) or (ep.provider='disneyplus' and p_query->'providerVersion'='4'::jsonb)$new$, 1);

select pg_temp.disney_patch('public.browse_watch_history_v3'::regproc::oid::regprocedure, $old$not in ('1'::jsonb,'2'::jsonb,'3'::jsonb)$old$, $new$not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb)$new$, 1);

select pg_temp.disney_patch('public.list_watch_history_v3_provider_page'::regproc::oid::regprocedure, $old$p_provider_version not in (1,2,3)$old$, $new$p_provider_version not in (1,2,3,4)$new$, 1);

select pg_temp.disney_patch('public.list_watch_history_v3_provider_page'::regproc::oid::regprocedure, $old$(p_provider_version=3 and summary.provider='primevideo')$old$, $new$(p_provider_version>=3 and summary.provider='primevideo') or (p_provider_version=4 and summary.provider='disneyplus')$new$, 3);

select pg_temp.disney_patch('public.browse_watch_history_v3_prime_navigation_v1'::regproc::oid::regprocedure, $old$not in ('1'::jsonb,'2'::jsonb,'3'::jsonb)$old$, $new$not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb)$new$, 1);

select pg_temp.disney_patch('public.list_watch_history_v3_provider_page_prime_navigation_v1'::regproc::oid::regprocedure, $old$p_provider_version not in (1,2,3)$old$, $new$p_provider_version not in (1,2,3,4)$new$, 1);

select pg_temp.disney_patch('public.list_watch_history_v3_provider_page_prime_navigation_v1'::regproc::oid::regprocedure, $old$(p_provider_version=3 and summary.provider='primevideo')$old$, $new$(p_provider_version>=3 and summary.provider='primevideo') or (p_provider_version=4 and summary.provider='disneyplus')$new$, 3);

CREATE OR REPLACE FUNCTION public.get_watch_history_capacity_v4(p_user_id uuid, p_history_generation bigint DEFAULT NULL::bigint)
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
  disneyplus_used bigint;
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
    count(distinct p.title_key) filter (where p.provider = 'primevideo'),
    count(distinct p.title_key) filter (where p.provider = 'disneyplus')
  into generation, youtube_used, crunchyroll_used, netflix_used, primevideo_used, disneyplus_used
  from (select 1) singleton
  left join public.user_watch_settings s on s.user_id = p_user_id
  left join public.watch_episode_progress p on p.user_id = p_user_id
    and p.history_generation = coalesce(s.history_generation, 1)
  group by s.history_generation;
  if p_history_generation is not null and p_history_generation is distinct from generation
    then raise exception 'watch_history_generation_mismatch'; end if;
  return jsonb_build_object(
    'capacityVersion', 4, 'ownerUserId', p_user_id, 'accountGeneration', generation,
    'serverTime', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'providers', jsonb_build_object(
      'youtube', jsonb_build_object('used', youtube_used, 'limit', 100),
      'crunchyroll', jsonb_build_object('used', crunchyroll_used, 'limit', 200),
      'netflix', jsonb_build_object('used', netflix_used, 'limit', 200),
      'primevideo', jsonb_build_object('used', primevideo_used, 'limit', 200),
      'disneyplus', jsonb_build_object('used', disneyplus_used, 'limit', 200)
    )
  );
end $function$;
revoke all on function public.get_watch_history_capacity_v4(uuid,bigint) from public,anon,authenticated;
grant execute on function public.get_watch_history_capacity_v4(uuid,bigint) to service_role;



drop function pg_temp.disney_patch(regprocedure,text,text,integer);
commit;
