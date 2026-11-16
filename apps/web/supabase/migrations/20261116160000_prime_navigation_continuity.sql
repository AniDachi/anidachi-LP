begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create function pg_temp.navigation_patch(routine regprocedure, needle text, replacement text, expected integer default 1)
returns void language plpgsql as $$
declare body text:=pg_get_functiondef(routine);
begin
 if needle='' or (length(body)-length(replace(body,needle,'')))/length(needle)<>expected then raise exception 'prime navigation anchor mismatch: %',routine; end if;
 execute replace(body,needle,replacement);
end $$;
-- Keep legacy RPC definitions byte-for-byte; new Web opts into copied read functions.
create temporary table prime_legacy_read_defs on commit drop as
select p.oid, n.nspname, p.proname, pg_get_functiondef(p.oid) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and p.proname in ('list_watch_history_v3_provider_page','list_watch_history_v3_title_episodes_page','watch_history_browse_progress_row_v3','browse_watch_history_v3','get_watch_history_editor_v1'))
 or (n.nspname='anidachi_history_private' and p.proname='watch_editor_snapshot');
-- Navigation hints carry no identity authority. Reject raw authority/path hazards before parsing.
create function public.prime_navigation_valid_v1(n jsonb, provider text, source text) returns boolean
language plpgsql immutable set search_path='' as $$
declare r jsonb; u text; host text; family text; families text[]:='{}'; path text; decoded bytea; pos integer;
begin
 if n is null then return true; end if;
 if provider is distinct from 'primevideo' or jsonb_typeof(n) is distinct from 'object'
  or n-array['contentId','routes']<>'{}' or jsonb_typeof(n->'contentId') is distinct from 'string'
  or n->>'contentId' !~ '^[A-Z0-9]{26}$' or source is distinct from 'https://www.primevideo.com/detail/'||(n->>'contentId')
  or jsonb_typeof(n->'routes') is distinct from 'array' or octet_length(n::text)>16384 then return false; end if;
 if jsonb_array_length(n->'routes') not between 1 and 8 then return false; end if;
 for r in select value from jsonb_array_elements(n->'routes') loop
  if jsonb_typeof(r) is distinct from 'object' or r-array['url','observedAt']<>'{}' or jsonb_typeof(r->'url') is distinct from 'string'
   or not public.watch_catalog_timestamp_valid_v3(r->'observedAt') then return false; end if;
  u:=r->>'url';
  if length(u)>2048 or u !~ '^https://' or u ~ '[[:space:][:cntrl:]\\?#]' or u ~* '%(2e|2f|5c|25)' then return false; end if;
  host:=substring(u from '^https://([^/]+)/'); path:=substring(u from '^https://[^/]+(/.*)$');
  if host is null or length(host)>253 or host !~ '^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$'
   or exists(select 1 from unnest(string_to_array(host,'.')) label where label !~ '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$') then return false; end if;
  family:=substring(lower(host) from '(primevideo[.]com|amazon[.]com[.]mx|amazon[.]co[.]uk|amazon[.]co[.]jp|amazon[.]com|amazon[.]de|amazon[.]ca|amazon[.]in)$');
  if family is null or (lower(host)<>family and right(lower(host),length(family)+1)<>'.'||family) or family=any(families) then return false; end if;
  families:=array_append(families,family);
  if path ~ '(^|/)[.]{1,2}(/|$)' or path ~ '/ref=' or right(path,1)='/' then return false; end if;
  decoded:=''::bytea; pos:=1;
  while pos<=length(path) loop
   if substring(path from pos for 1)='%' then
    decoded:=decoded||decode(substring(path from pos+1 for 2),'hex');pos:=pos+3;
   else decoded:=decoded||convert_to(substring(path from pos for 1),'UTF8');pos:=pos+1; end if;
  end loop;
  path:=convert_from(decoded,'UTF8');
  if path ~ '[[:space:][:cntrl:]\\]' then return false; end if;
  path:=regexp_replace(path,'^/region/[a-z0-9-]{2,16}(/)','\1');
  path:=regexp_replace(path,'^(/-/[a-z]{2,3}([_-][A-Z]{2})?|/[a-z]{2,3}[_-][A-Z]{2})(/)','\3');
  if substring(path from '/([A-Z0-9]{26})$') is not null and substring(path from '/([A-Z0-9]{26})$')<>n->>'contentId' then return false; end if;
  if family='primevideo.com' then
   if path !~ '^/detail/([[:alnum:]_-]{1,200}/)?([A-Z0-9]{26}|[A-Z0-9]{10}|amzn1[.]dv[.]gti[.][a-z0-9-]{1,100})$' then return false; end if;
  elsif path !~ '^/(gp/video/detail/([[:alnum:]_-]{1,200}/)?|([[:alnum:]_-]{1,200}/)?dp/)([A-Z0-9]{26}|[A-Z0-9]{10}|amzn1[.]dv[.]gti[.][a-z0-9-]{1,100})$' then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.prime_navigation_valid_v1(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.prime_navigation_valid_v1(jsonb,text,text) to service_role;
alter table public.rooms add column prime_navigation jsonb,
 add constraint rooms_prime_navigation_check check(public.prime_navigation_valid_v1(prime_navigation,source_provider,source_url));
alter table public.watch_episode_progress add column prime_navigation jsonb,
 add constraint watch_progress_prime_navigation_check check(public.prime_navigation_valid_v1(prime_navigation,provider,source_url));
-- Clear hints atomically on every source change, including legacy source RPCs.
create function public.clear_stale_prime_navigation_v1() returns trigger language plpgsql set search_path='' as $$
begin
 if new.source_url is distinct from old.source_url and new.prime_navigation is not distinct from old.prime_navigation then new.prime_navigation:=null; end if;
 return new;
end $$;
revoke all on function public.clear_stale_prime_navigation_v1() from public,anon,authenticated;
create trigger rooms_clear_stale_prime_navigation before update on public.rooms for each row execute function public.clear_stale_prime_navigation_v1();
create trigger progress_clear_stale_prime_navigation before update on public.watch_episode_progress for each row execute function public.clear_stale_prime_navigation_v1();

select pg_temp.navigation_patch('public.validate_watch_identity_v3'::regproc::oid::regprocedure,$old$begin
$old$,$new$begin
 if not public.prime_navigation_valid_v1(p_event->'primeNavigation',p_event->>'provider',p_event->>'sourceUrl') then raise exception 'watch_history_event_invalid' using errcode='22023'; end if;
$new$,1);

select pg_temp.navigation_patch('public.apply_personal_watch_progress_v1'::regproc::oid::regprocedure,$old$'netflixIdentity','primevideoIdentity']$old$,$new$'netflixIdentity','primevideoIdentity','primeNavigation']$new$,1);

select pg_temp.navigation_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure,$old$    source_url,
    raw_content_id,$old$,$new$    source_url,
    prime_navigation,
    raw_content_id,$new$,1);

select pg_temp.navigation_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure,$old$    source_url_value,
    coalesce(coalesce(p_event$old$,$new$    source_url_value,
    p_event->'primeNavigation',
    coalesce(coalesce(p_event$new$,1);

select pg_temp.navigation_patch('anidachi_history_private.apply_watch_progress_v3_canonical'::regproc::oid::regprocedure,$old$    source_url = excluded.source_url,
    current_time_seconds$old$,$new$    source_url = excluded.source_url,
    prime_navigation = case when excluded.source_url=public.watch_episode_progress.source_url then coalesce(excluded.prime_navigation,public.watch_episode_progress.prime_navigation) else excluded.prime_navigation end,
    current_time_seconds$new$,1);


select pg_temp.navigation_patch('anidachi_history_private.apply_watch_catalog_v3'::regproc::oid::regprocedure,$old$'original','order','sourceUrl']$old$,$new$'original','order','sourceUrl','primeNavigation']$new$,1);

select pg_temp.navigation_patch('public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure,$old$or jsonb_typeof(v) is distinct from 'object'$old$,$new$or not public.prime_navigation_valid_v1(v->'primeNavigation',r->>'provider',v->>'sourceUrl') or jsonb_typeof(v) is distinct from 'object'$new$,1);

select pg_temp.navigation_patch('public.list_watch_history_v3_provider_page'::regproc::oid::regprocedure,$old$'source_url', episode.source_url,$old$,$new$'source_url', episode.source_url,
              'prime_navigation', episode.prime_navigation,$new$,1);

select pg_temp.navigation_patch('public.list_watch_history_v3_title_episodes_page'::regproc::oid::regprocedure,$old$'source_url', row.source_url,$old$,$new$'source_url', row.source_url,
              'prime_navigation', row.prime_navigation,$new$,1);

CREATE OR REPLACE FUNCTION public.persist_room_source_v2(p_prime_navigation jsonb, p_room_id text, p_source_provider text, p_source_url text, p_video_fingerprint text, p_source_generation bigint)
 RETURNS TABLE(outcome text, source_generation bigint)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_room public.rooms%rowtype;
  v_expected_video_fingerprint text;
begin
 if not public.prime_navigation_valid_v1(p_prime_navigation,p_source_provider,p_source_url) then raise exception 'room_source_invalid_input' using errcode='22023'; end if;
  if p_room_id is null
    or p_room_id <> pg_catalog.btrim(p_room_id)
    or pg_catalog.char_length(p_room_id) not between 1 and 128
    or p_source_provider is null
    or p_source_provider not in ('crunchyroll', 'youtube', 'netflix', 'primevideo')
    or p_source_url is null
    or p_source_url <> pg_catalog.btrim(p_source_url)
    or pg_catalog.char_length(p_source_url) not between 1 and 2048
    or p_video_fingerprint is null
    or p_video_fingerprint <> pg_catalog.btrim(p_video_fingerprint)
    or pg_catalog.char_length(p_video_fingerprint) not between 1 and 400
    or p_source_generation is null
    or p_source_generation not between 1 and 9007199254740991
  then
    raise exception 'room_source_invalid_input' using errcode = '22023';
  end if;

  if p_source_provider = 'youtube'
    and p_source_url
      ~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]+$'
    and pg_catalog.char_length(
      pg_catalog.substring(
        p_source_url,
        '^https://www[.]youtube[.]com/watch[?]v=([A-Za-z0-9_-]+)$'
      )
    ) between 6 and 392
  then
    v_expected_video_fingerprint := 'youtube|' || pg_catalog.substring(
      p_source_url,
      '^https://www[.]youtube[.]com/watch[?]v=([A-Za-z0-9_-]+)$'
    );
  elsif p_source_provider = 'crunchyroll'
    and p_source_url
      ~ '^https://www[.]crunchyroll[.]com/watch/[A-Za-z0-9_-]+$'
    and pg_catalog.char_length(
      pg_catalog.substring(
        p_source_url,
        '^https://www[.]crunchyroll[.]com/watch/([A-Za-z0-9_-]+)$'
      )
    ) between 1 and 382
  then
    v_expected_video_fingerprint := 'crunchyroll|watch/' || pg_catalog.substring(
      p_source_url,
      '^https://www[.]crunchyroll[.]com/watch/([A-Za-z0-9_-]+)$'
    );
  elsif p_source_provider = 'netflix'
    and p_source_url ~ '^https://www[.]netflix[.]com/watch/[1-9][0-9]{0,19}$'
  then
    v_expected_video_fingerprint := 'netflix|watch/' || substring(p_source_url from '/watch/([1-9][0-9]{0,19})$');
  elsif p_source_provider = 'primevideo'
    and p_source_url ~ '^https://www[.]primevideo[.]com/detail/[A-Z0-9]{26}$'
  then
    v_expected_video_fingerprint := 'primevideo|detail/' || substring(p_source_url from '/detail/([A-Z0-9]{26})$');
  else
    raise exception 'room_source_invalid_input' using errcode = '22023';
  end if;

  if p_video_fingerprint <> v_expected_video_fingerprint then
    raise exception 'room_source_invalid_input' using errcode = '22023';
  end if;

  select room.*
  into v_room
  from public.rooms as room
  where room.room_id = p_room_id
  for update;

  if not found then
    raise exception 'room_source_not_found' using errcode = 'P0002';
  end if;

  if v_room.status = 'ended' then
    raise exception 'room_source_ended' using errcode = '55000';
  end if;

  if v_room.source_generation is null then
    update public.rooms as room
    set
      source_provider = p_source_provider,
      source_url = p_source_url,
      prime_navigation = p_prime_navigation,
      video_fingerprint = p_video_fingerprint,
      source_generation = p_source_generation
    where room.id = v_room.id;

    return query select 'persisted'::text, p_source_generation;
    return;
  end if;

  if p_source_generation < v_room.source_generation then
    return query select 'stale'::text, p_source_generation;
    return;
  end if;

  if p_source_generation = v_room.source_generation then
    if p_source_provider <> v_room.source_provider
      or p_source_url <> v_room.source_url
      or p_video_fingerprint <> v_room.video_fingerprint
    then
      raise exception 'room_source_generation_conflict' using errcode = '23514';
    end if;

    if p_prime_navigation is not null then
      if v_room.prime_navigation is not null and (v_room.prime_navigation->'contentId' is distinct from p_prime_navigation->'contentId' or (select jsonb_agg(r->>'url' order by r->>'url') from jsonb_array_elements(v_room.prime_navigation->'routes') r) is distinct from (select jsonb_agg(r->>'url' order by r->>'url') from jsonb_array_elements(p_prime_navigation->'routes') r)) then raise exception 'room_source_generation_conflict' using errcode='23514'; end if;
      update public.rooms set prime_navigation=p_prime_navigation where id=v_room.id;
    end if;
    return query select 'persisted'::text, p_source_generation;
    return;
  end if;

  if p_source_provider <> v_room.source_provider then
    raise exception 'room_source_provider_conflict' using errcode = '23514';
  end if;

  update public.rooms as room
  set
    source_url = p_source_url,
      prime_navigation = p_prime_navigation,
    video_fingerprint = p_video_fingerprint,
    source_generation = p_source_generation
  where room.id = v_room.id;

  return query select 'persisted'::text, p_source_generation;
end;
$function$
;
revoke all on function public.persist_room_source_v2(jsonb,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.persist_room_source_v2(jsonb,text,text,text,text,bigint) to service_role;

create function public.create_room_with_prime_navigation_v1(p_prime_navigation jsonb,p_abuse_enabled boolean,p_host_user_id uuid, p_participant_session_id text, p_show_id text, p_episode_id text, p_source_provider text, p_source_url text, p_video_fingerprint text, p_source_generation bigint, p_title text, p_client_request_id text, p_host_plan_code text, p_max_participants integer, p_max_media_seats integer, p_can_name_room boolean, p_can_send_push_invites boolean, p_media_protocol_version integer, p_free20_client_version integer, p_free20_browser_hash text, p_free20_installation_hash text)
returns table(outcome text,room_record jsonb,active_room jsonb) language plpgsql security definer set search_path='' as $$
declare admitted record; r public.rooms%rowtype;
begin
 if not public.prime_navigation_valid_v1(p_prime_navigation,p_source_provider,p_source_url) then raise exception 'room_source_invalid_input' using errcode='22023'; end if;
 if p_abuse_enabled then
  select * into admitted from public.create_room_with_active_session_v5(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites,p_media_protocol_version,p_free20_client_version,p_free20_browser_hash,p_free20_installation_hash);
 else
  select * into admitted from public.create_room_with_active_session_v4(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites,p_media_protocol_version,p_free20_client_version);
 end if;
 if admitted.outcome in ('claimed','reused') and p_prime_navigation is not null then
  select * into strict r from public.rooms where room_id=admitted.room_record->>'room_id' for update;
  if r.source_provider=p_source_provider and r.source_url=p_source_url and r.source_generation=p_source_generation and r.prime_navigation is null then
   update public.rooms set prime_navigation=p_prime_navigation where id=r.id returning * into r;
   admitted.room_record:=to_jsonb(r);
  end if;
 end if;
 return query select admitted.outcome,admitted.room_record,admitted.active_room;
end $$;
revoke all on function public.create_room_with_prime_navigation_v1(jsonb,boolean,uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.create_room_with_prime_navigation_v1(jsonb,boolean,uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer,integer,text,text) to service_role;

create function public.prime_navigation_map_v1(snap jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(v->>'sourceUrl',v->'primeNavigation'),'{}') from jsonb_array_elements(coalesce(snap->'seasons','[]')) s
 cross join lateral jsonb_array_elements(s->'episodes') e cross join lateral jsonb_array_elements(e->'watchVariants') v
 where public.prime_navigation_valid_v1(v->'primeNavigation','primevideo',v->>'sourceUrl') and v ? 'primeNavigation'
$$;
create function public.enrich_prime_projection_v1(payload jsonb,hints jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb; pair record; hint jsonb;
begin
 if jsonb_typeof(payload)='array' then
  select coalesce(jsonb_agg(public.enrich_prime_projection_v1(value,hints)),'[]') into result from jsonb_array_elements(payload); return result;
 elsif jsonb_typeof(payload)='object' then
  result:='{}'; for pair in select * from jsonb_each(payload) loop result:=result||jsonb_build_object(pair.key,public.enrich_prime_projection_v1(pair.value,hints)); end loop;
  if payload ? 'sourceUrl' and not payload ? 'primeNavigation' then
   hint:=hints->(payload->>'sourceUrl');
   if hint is not null then result:=result||jsonb_build_object('primeNavigation',hint); end if;
  end if; return result;
 end if;
 return payload;
end $$;
alter table public.watch_catalog_snapshots add column prime_navigation jsonb;
create function public.strip_prime_navigation_v1(payload jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb; pair record;
begin
 if jsonb_typeof(payload)='array' then
  select coalesce(jsonb_agg(public.strip_prime_navigation_v1(value)),'[]') into result from jsonb_array_elements(payload);return result;
 elsif jsonb_typeof(payload)='object' then
  result:='{}';for pair in select * from jsonb_each(payload) where key not in ('primeNavigation','prime_navigation') loop result:=result||jsonb_build_object(pair.key,public.strip_prime_navigation_v1(pair.value));end loop;return result;
 end if;return payload;
end $$;
revoke all on function public.strip_prime_navigation_v1(jsonb) from public,anon,authenticated;
grant execute on function public.strip_prime_navigation_v1(jsonb) to service_role;
create function public.enrich_prime_catalog_projection_v1() returns trigger language plpgsql set search_path='' as $$
begin
 if new.provider='primevideo' then
  if tg_op='INSERT' or new.snapshot is distinct from old.snapshot then
   new.prime_navigation:=coalesce((select jsonb_object_agg(v->>'sourceUrl',coalesce(v->'primeNavigation',old.prime_navigation->(v->>'sourceUrl')))
    from jsonb_array_elements(coalesce(new.snapshot->'seasons','[]')) season
    cross join lateral jsonb_array_elements(season->'episodes') episode
    cross join lateral jsonb_array_elements(episode->'watchVariants') v
    where coalesce(v->'primeNavigation',old.prime_navigation->(v->>'sourceUrl')) is not null),'{}'::jsonb);
   new.snapshot:=public.strip_prime_navigation_v1(new.snapshot);
  end if;
  new.projection:=public.strip_prime_navigation_v1(new.projection);
 end if; return new;
end $$;
revoke all on function public.prime_navigation_map_v1(jsonb),public.enrich_prime_projection_v1(jsonb,jsonb),public.enrich_prime_catalog_projection_v1() from public,anon,authenticated;
grant execute on function public.prime_navigation_map_v1(jsonb),public.enrich_prime_projection_v1(jsonb,jsonb) to service_role;
create trigger prime_catalog_projection before insert or update on public.watch_catalog_snapshots for each row execute function public.enrich_prime_catalog_projection_v1();
select pg_temp.navigation_patch('public.watch_history_browse_progress_row_v3'::regproc::oid::regprocedure,$old$'source_url',p.source_url,$old$,$new$'source_url',p.source_url,'prime_navigation',p.prime_navigation,$new$);
select pg_temp.navigation_patch('anidachi_history_private.watch_editor_snapshot'::regproc::oid::regprocedure,$old$  return result;$old$,$new$  if prov='primevideo' then
    result:=public.enrich_prime_projection_v1(result,coalesce(c.prime_navigation,'{}'::jsonb)||coalesce((select jsonb_object_agg(p.source_url,p.prime_navigation) from public.watch_episode_progress p where p.user_id=uid and p.history_generation=gen and p.provider=prov and p.title_key=titlekey and p.prime_navigation is not null),'{}'::jsonb));
  end if;
  return result;$new$);
-- New runtime acknowledgements enrich after receipt storage; old RPC/receipt JSON is unchanged.
create function public.prime_navigation_progress_ack_v1(p_user_id uuid,p_ack jsonb) returns jsonb
language sql stable set search_path='' as $$
 select case when p.prime_navigation is null then p_ack else jsonb_set(p_ack,'{episode}',(p_ack->'episode')||jsonb_build_object('primeNavigation',p.prime_navigation)) end
 from (select 1) x left join public.watch_episode_progress p on p.user_id=p_user_id
 and p.history_generation=(p_ack->>'accountGeneration')::bigint and p.episode_key=p_ack#>>'{episode,episodeKey}'
 and p.source_url=p_ack#>>'{episode,sourceUrl}'
$$;
create function public.apply_personal_watch_progress_prime_navigation_v1(p_user_id uuid,p_input jsonb) returns jsonb
language sql volatile security definer set search_path='' as $$
 select public.prime_navigation_progress_ack_v1(p_user_id,public.apply_personal_watch_progress_v1(p_user_id,p_input))
$$;
create function public.apply_watch_progress_prime_navigation_v1(p_user_id uuid,p_event jsonb,p_room_authority jsonb) returns jsonb
language sql volatile security definer set search_path='' as $$
 select public.prime_navigation_progress_ack_v1(p_user_id,public.apply_watch_progress_v3(p_user_id,p_event,p_room_authority))
$$;
revoke all on function public.prime_navigation_progress_ack_v1(uuid,jsonb),public.apply_personal_watch_progress_prime_navigation_v1(uuid,jsonb),public.apply_watch_progress_prime_navigation_v1(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.prime_navigation_progress_ack_v1(uuid,jsonb),public.apply_personal_watch_progress_prime_navigation_v1(uuid,jsonb),public.apply_watch_progress_prime_navigation_v1(uuid,jsonb,jsonb) to service_role;

-- Publish explicit opt-in read RPCs, then restore every legacy entry/helper.
do $$
declare r record; body text; new_name text; args text;
begin
 for r in select * from prime_legacy_read_defs loop
  new_name:=r.proname||'_prime_navigation_v1';
  body:=replace(pg_get_functiondef(r.oid),'FUNCTION '||r.nspname||'.'||r.proname||'(','FUNCTION '||r.nspname||'.'||new_name||'(');
  if r.proname='browse_watch_history_v3' then body:=replace(body,'public.watch_history_browse_progress_row_v3(','public.watch_history_browse_progress_row_v3_prime_navigation_v1(');end if;
  if r.proname='get_watch_history_editor_v1' then body:=replace(body,'anidachi_history_private.watch_editor_snapshot(','anidachi_history_private.watch_editor_snapshot_prime_navigation_v1(');end if;
  execute body;
  args:=pg_get_function_identity_arguments(r.oid);
  execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',r.nspname,new_name,args);
  execute format('grant execute on function %I.%I(%s) to service_role',r.nspname,new_name,args);
 end loop;
 for r in select * from prime_legacy_read_defs loop execute r.definition;end loop;
end $$;
commit;
