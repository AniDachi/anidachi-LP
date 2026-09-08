begin;
-- The explicit internal acceptance clock preserves inactive legacy timing while
-- personal calls obtain their clock after policy/account locks. No client can
-- call this schema or supply the acceptance timestamp.
do $migration$
declare body text;
begin
 body:=pg_get_functiondef('anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb)'::regprocedure);
 body:=replace(body,'p_room_authority jsonb)','p_room_authority jsonb, p_accepted_at timestamptz)');
 body:=replace(body,'server_accepted_at timestamptz := pg_catalog.transaction_timestamp();','server_accepted_at timestamptz := p_accepted_at;');
 execute body;
 revoke all on function anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz) from public,anon,authenticated,service_role;
 body:=pg_get_functiondef('public.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb)'::regprocedure);
 body:=replace(body,'(p_user_id,p_event,p_room_authority);','(p_user_id,p_event,p_room_authority,transaction_timestamp());');
 execute body;
 drop function anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb);
end $migration$;
create or replace function public.apply_personal_watch_progress_v1(p_user_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a jsonb; e jsonb:=p_input->'event'; ack jsonb; receipt public.watch_history_receipts%rowtype;
 gen bigint; epoch bigint; seq bigint; observed timestamptz; sid uuid; prior_sequence bigint; previous_observed timestamptz;
begin
 a:=public.check_personal_history_operation_v1(p_user_id,'personal')->'access';
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>65536
   or p_input-array['captureVersion','accessEpoch','youtubeConsentEpoch','clientSequence','event']<>'{}'::jsonb
   or p_input->'captureVersion' is distinct from '1'::jsonb
   or not public.watch_catalog_number_valid_v3(p_input->'accessEpoch',9007199254740991,true)
   or not public.watch_catalog_number_valid_v3(p_input->'youtubeConsentEpoch',9007199254740991,true)
   or not public.watch_catalog_number_valid_v3(p_input->'clientSequence',9007199254740991,true)
   or jsonb_typeof(e) is distinct from 'object' or e?'sharedRoom'
   or not e ?& array['schemaVersion','clientEventId','clientSessionKey','accountGeneration','provider','titleKey','itemKind','title','artworkUrl','episodeKey','episodeTitle','seasonKey','seasonTitle','seasonNumber','episodeNumber','sourceUrl','currentTime','duration','progress','observedAt','kind']
   or e-array['schemaVersion','clientEventId','clientSessionKey','accountGeneration','provider','titleKey','itemKind','title','artworkUrl','episodeKey','episodeTitle','seasonKey','seasonTitle','seasonNumber','episodeNumber','sourceUrl','currentTime','duration','progress','observedAt','kind','crunchyrollIdentity','youtubeVideoId']<>'{}'::jsonb
   or e->'schemaVersion' is distinct from '3'::jsonb
   or coalesce(p_input->>'clientSequence','') !~ '^[1-9][0-9]*$'
   or coalesce(p_input->>'accessEpoch','') !~ '^[0-9]+$'
   or coalesce(p_input->>'youtubeConsentEpoch','') !~ '^[0-9]+$'
 then raise exception 'watch_history_event_invalid'; end if;
 gen:=(a->>'accountGeneration')::bigint; epoch:=(a->>'accessEpoch')::bigint;
 seq:=(p_input->>'clientSequence')::bigint;
 if seq>9007199254740991 then raise exception 'watch_history_event_invalid'; end if;
 if (e->>'accountGeneration')::bigint is distinct from gen then raise exception 'watch_history_generation_mismatch'; end if;
 if (p_input->>'accessEpoch')::bigint is distinct from epoch then raise exception 'HISTORY_ACCESS_CHANGED'; end if;
 if e->>'provider'='youtube' and ((p_input->>'youtubeConsentEpoch')::bigint is distinct from (a->>'youtubeConsentEpoch')::bigint
   or (a->>'youtubeHistoryEnabled')::boolean is distinct from true) then raise exception 'HISTORY_ACCESS_CHANGED'; end if;
 perform public.validate_watch_identity_v3(e);
 if e->>'provider'='youtube' and (e->>'observedAt')::timestamptz < (select youtube_capture_not_before from public.user_watch_settings where user_id=p_user_id) then raise exception 'HISTORY_ACCESS_CHANGED'; end if;
 observed:=(e->>'observedAt')::timestamptz;
 if observed is null or observed < (a->>'captureNotBefore')::timestamptz or observed>clock_timestamp()+interval '5 minutes'
 then raise exception 'HISTORY_ACCESS_CHANGED'; end if;
 -- Check deletion BEFORE receipt replay; canonical legacy replay intentionally
 -- predates that rule and cannot be the personal authorization boundary.
 if exists(select 1 from public.watch_history_deletions d where d.user_id=p_user_id and d.history_generation=gen
  and least(observed,coalesce((select (r.acknowledgement#>>'{episode,lastWatchedAt}')::timestamptz from public.watch_history_receipts r where r.user_id=p_user_id and r.client_id=(e->>'clientEventId')::uuid and r.expires_at>clock_timestamp()),clock_timestamp()))<=d.deleted_at and (d.scope='all' or (d.provider=e->>'provider' and d.title_key=e->>'titleKey'
  and (d.scope='title' or (d.scope='episode' and d.episode_key=e->>'episodeKey'))))) then raise exception 'watch_history_deleted'; end if;
 select * into receipt from public.watch_history_receipts where user_id=p_user_id and client_id=(e->>'clientEventId')::uuid and expires_at>clock_timestamp();
 if found then
  if receipt.personal_envelope is distinct from p_input then raise exception 'watch_history_client_id_conflict'; end if;
  return receipt.acknowledgement;
 end if;
 select sequence into prior_sequence from public.personal_watch_sequences where user_id=p_user_id and history_generation=gen and access_epoch=epoch and client_session_key=e->>'clientSessionKey';
 if seq<=prior_sequence then raise exception 'watch_history_observation_stale'; end if;
 -- Sequence is authoritative within one playback session, including a corrected
 -- client clock; cross-session ordering still uses the observed timestamp.
 select ep.observed_at into previous_observed from public.watch_episode_progress ep
 join public.watch_sessions ws on ws.id=ep.latest_session_id and ws.host_user_id=p_user_id and ws.room_id is null and ws.client_session_key=e->>'clientSessionKey'
 where ep.user_id=p_user_id and ep.provider=e->>'provider' and ep.title_key=e->>'titleKey' and ep.episode_key=e->>'episodeKey';
 if previous_observed>observed then
  e:=jsonb_set(e,'{observedAt}',to_jsonb(previous_observed));
 end if;
 -- Always solo owner authority. Existing shared sessions remain immutable data.
 ack:=anidachi_history_private.apply_watch_progress_v3_canonical(p_user_id,e,null,clock_timestamp());
 observed:=(ack#>>'{episode,lastWatchedAt}')::timestamptz;
 update public.watch_history_receipts set personal_envelope=p_input where user_id=p_user_id and client_id=(e->>'clientEventId')::uuid;
 insert into public.personal_watch_sequences values(p_user_id,gen,epoch,e->>'clientSessionKey',seq)
 on conflict(user_id,history_generation,access_epoch,client_session_key) do update set sequence=excluded.sequence;
 select latest_session_id into sid from public.watch_episode_progress where user_id=p_user_id and provider=e->>'provider' and title_key=e->>'titleKey' and episode_key=e->>'episodeKey';
 insert into public.watch_history_session_observations values(sid,p_user_id,gen,least(observed,clock_timestamp()),least(observed,clock_timestamp()))
 on conflict(session_id,user_id) do update set first_observed_at=least(public.watch_history_session_observations.first_observed_at,excluded.first_observed_at),last_observed_at=greatest(public.watch_history_session_observations.last_observed_at,excluded.last_observed_at),history_generation=excluded.history_generation;
 return ack;
end $$;
create or replace function public.begin_watch_catalog_v3(p_user_id uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare gate jsonb; a jsonb; ack jsonb; proof jsonb:=p_request->'historyAccess';
begin
 gate:=public.check_personal_history_operation_v1(p_user_id,case when proof is null then 'read' else 'personal' end); a:=gate->'access';
 if (gate->>'active')::boolean and proof is null then raise exception 'HISTORY_CLIENT_UPDATE_REQUIRED'; end if;
 if proof is not null then
  if jsonb_typeof(proof) is distinct from 'object' or not public.watch_catalog_number_valid_v3(proof->'accessEpoch',9007199254740991,true) or proof->'accessVersion' is distinct from '1'::jsonb or proof-array['accessVersion','accessEpoch']<>'{}'::jsonb or proof->>'accessVersion' is distinct from '1' then raise exception 'watch_catalog_invalid'; end if;
  if (proof->>'accessEpoch')::bigint is distinct from (a->>'accessEpoch')::bigint
    or (p_request#>>'{context,observedAt}')::timestamptz < (a->>'captureNotBefore')::timestamptz or (p_request#>>'{context,observedAt}')::timestamptz>clock_timestamp()+interval '5 minutes' then raise exception 'HISTORY_ACCESS_CHANGED'; end if;
 end if;
 ack:=anidachi_history_private.begin_watch_catalog_v3(p_user_id,p_request-'historyAccess');
 update public.watch_catalog_snapshots set personal_access_epoch=case when proof is null then null else (a->>'accessEpoch')::bigint end
 where user_id=p_user_id and history_generation=(p_request->>'accountGeneration')::bigint and provider='crunchyroll' and title_key=p_request->>'titleKey';
 return ack;
end $$;
create or replace function public.apply_watch_catalog_v3(p_user_id uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare gate jsonb; a jsonb; issued bigint; proof jsonb:=p_request->'historyAccess';
begin
 gate:=public.check_personal_history_operation_v1(p_user_id,case when proof is null then 'read' else 'personal' end); a:=gate->'access';
 if (gate->>'active')::boolean and proof is null then raise exception 'HISTORY_CLIENT_UPDATE_REQUIRED'; end if;
 if proof is not null then
  if jsonb_typeof(proof) is distinct from 'object' or not public.watch_catalog_number_valid_v3(proof->'accessEpoch',9007199254740991,true) or proof->'accessVersion' is distinct from '1'::jsonb or proof-array['accessVersion','accessEpoch']<>'{}'::jsonb or proof->>'accessVersion' is distinct from '1' then raise exception 'watch_catalog_invalid'; end if;
  select personal_access_epoch into issued from public.watch_catalog_snapshots where user_id=p_user_id and history_generation=(p_request->>'accountGeneration')::bigint and provider='crunchyroll' and title_key=p_request->>'titleKey';
  if (proof->>'accessEpoch')::bigint is distinct from (a->>'accessEpoch')::bigint or issued is distinct from (a->>'accessEpoch')::bigint then raise exception 'HISTORY_ACCESS_CHANGED'; end if;
 end if;
 return anidachi_history_private.apply_watch_catalog_v3(p_user_id,p_request-'historyAccess');
end $$;

-- Keep owner fallback dates independent of host/shared session time.
do $migration$
declare body text;
begin
 body:=pg_get_functiondef('public.watch_history_browse_matches_v3(uuid,bigint,jsonb)'::regprocedure);
 body:=replace(body,'select ws.id from public.watch_sessions','select ws.id,p.updated_at as owner_updated_at from public.watch_sessions');
 body:=replace(body,'coalesce(o.last_observed_at,ep.observed_at)','coalesce(o.last_observed_at,least(s.owner_updated_at,ep.observed_at),ep.observed_at)');
 execute body;
end $migration$;
commit;
