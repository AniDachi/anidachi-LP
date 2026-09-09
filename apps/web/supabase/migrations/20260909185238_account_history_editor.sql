begin;

-- Manual edits are canonical personal progress, never invented playback sessions.
alter table public.watch_episode_progress add column manual_edited_at timestamptz;
create table public.watch_history_edit_receipts (
  user_id uuid not null references public.users(id) on delete cascade,
  client_id uuid not null, request jsonb not null, acknowledgement jsonb not null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  primary key(user_id, client_id)
);
alter table public.watch_history_edit_receipts enable row level security;
revoke all on public.watch_history_edit_receipts from public, anon, authenticated;
grant select, insert, delete on public.watch_history_edit_receipts to service_role;
create index watch_history_edit_receipts_expiry on public.watch_history_edit_receipts(expires_at);

-- Called under the existing policy/account lock. The full editor is bounded by
-- the catalog's 2,000 episode contract; no client-supplied labels or media URLs.
create function anidachi_history_private.watch_editor_snapshot(
  uid uuid, gen bigint, prov text, titlekey text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.watch_catalog_snapshots%rowtype; result jsonb; entries jsonb;
  complete boolean; row_count bigint; last_order bigint;
begin
  select count(*), max(server_order) into row_count, last_order
    from public.watch_episode_progress where user_id=uid and history_generation=gen and provider=prov and title_key=titlekey;
  if row_count=0 then raise exception 'HISTORY_TITLE_NOT_FOUND'; end if;
  if row_count>2000 then raise exception 'HISTORY_EDITOR_TOO_LARGE'; end if;
  select * into c from public.watch_catalog_snapshots where user_id=uid and history_generation=gen and provider=prov and title_key=titlekey;
  complete:=coalesce(c.projection is not null and c.accepted_context is not null
    and c.context->>'region'=c.accepted_context->>'region' and c.snapshot->>'completeness'='complete',false);
  with variants as (
    select distinct on(a.episode_key) a.* from public.watch_catalog_aliases a
    left join public.watch_episode_progress p on p.user_id=uid and p.history_generation=gen and p.provider=prov and p.title_key=titlekey and p.episode_key=a.episode_key
    where complete and a.user_id=uid and a.history_generation=gen and a.provider=prov and a.title_key=titlekey
    order by a.episode_key,(a.source_url=p.source_url) desc nulls last,
      (a.audio_locale=c.preferred_audio_locale) desc nulls last,a.original desc,a.variant_order,a.raw_content_id
  ), owned as (
    select * from public.watch_episode_progress where user_id=uid and history_generation=gen and provider=prov and title_key=titlekey
  ), merged as (
    select coalesce(a.episode_key,p.episode_key) key,
      coalesce(a.episode_title,p.episode_title,p.title) label,
      coalesce(a.episode_number,p.episode_number) number,
      coalesce(a.season_key,p.season_key) season_key,
      coalesce(a.season_title,p.season_title) season_title,
      coalesce(a.season_number,p.season_number) season_number,
      coalesce(a.season_order,p.season_number,0) season_order,
      coalesce(a.episode_order,p.episode_number,0) episode_order,
      coalesce(a.source_url,p.source_url) source_url,
      case when a.episode_key is null then not complete else a.available and (a.released_at is null or a.released_at<=clock_timestamp()) end available,
      p.completed_at is not null watched,coalesce(p.current_time_seconds,0) resume_seconds,
      coalesce(p.duration,0) duration,coalesce(p.progress,0) progress
    from variants a full join owned p using(episode_key)
  ) select jsonb_agg(jsonb_build_object(
      'episodeKey',key,'episodeTitle',label,'episodeNumber',number,
      'seasonKey',season_key,'seasonTitle',season_title,'seasonNumber',season_number,
      'seasonOrder',season_order,'order',episode_order,'sourceUrl',source_url,'available',available,
      'watched',watched,'currentTime',resume_seconds,'duration',duration,'progress',progress
    ) order by season_order,episode_order,key) into entries from merged;
  if jsonb_array_length(entries)>2000 then raise exception 'HISTORY_EDITOR_TOO_LARGE'; end if;
  result:=jsonb_build_object('meta',jsonb_build_object('schemaVersion',3,'ownerUserId',uid,'accountGeneration',gen,'serverTime',clock_timestamp()),
    'provider',prov,'titleKey',titlekey,'catalogComplete',complete,'episodes',entries,
    'revision',md5(jsonb_build_array(gen,row_count,last_order,c.accepted_hash,c.context,c.accepted_context,entries)::text));
  return result;
end $$;
revoke all on function anidachi_history_private.watch_editor_snapshot(uuid,bigint,text,text) from public,anon,authenticated,service_role;

create function public.get_watch_history_editor_v1(p_user_id uuid,p_generation bigint,p_provider text,p_title_key text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare access jsonb; actual_generation bigint;
begin
  access:=public.check_personal_history_operation_v1(p_user_id,'read')->'access';
  select history_generation into actual_generation from public.user_watch_settings where user_id=p_user_id;
  if p_provider not in ('crunchyroll','youtube') or p_provider is null or p_title_key is null or length(p_title_key) not between 1 and 220 then raise exception 'HISTORY_EDIT_INVALID'; end if;
  if p_generation is distinct from actual_generation then raise exception 'watch_history_generation_mismatch'; end if;
  return anidachi_history_private.watch_editor_snapshot(p_user_id,p_generation,p_provider,p_title_key);
end $$;
revoke all on function public.get_watch_history_editor_v1(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.get_watch_history_editor_v1(uuid,bigint,text,text) to service_role;

create function public.edit_watch_history_v1(p_user_id uuid,p_request jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='30s' as $$
declare access jsonb; gen bigint; prov text; titlekey text; mutation uuid; snapshot jsonb; ack jsonb;
  receipt public.watch_history_edit_receipts%rowtype; template public.watch_episode_progress%rowtype;
  change jsonb; ep jsonb; stamp timestamptz; next_order bigint; edited integer:=0; previous_bulk text;
begin
  -- Same policy -> account advisory lock -> settings row order as capture/delete.
  access:=public.check_personal_history_operation_v1(p_user_id,'personal')->'access';
  if jsonb_typeof(p_request) is distinct from 'object' or octet_length(p_request::text)>600000
    or not p_request ?& array['provider','titleKey','accountGeneration','clientMutationId','revision','changes']
    or p_request-array['provider','titleKey','accountGeneration','clientMutationId','revision','changes']<>'{}'::jsonb
    or coalesce(p_request->>'provider','') not in ('crunchyroll','youtube')
    or jsonb_typeof(p_request->'titleKey') is distinct from 'string' or length(p_request->>'titleKey') not between 1 and 220
    or coalesce(p_request->>'revision','') !~ '^[a-f0-9]{32}$'
    or jsonb_typeof(p_request->'accountGeneration') is distinct from 'number'
    or coalesce(p_request->>'accountGeneration','') !~ '^[1-9][0-9]*$'
    or coalesce(p_request->>'clientMutationId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(p_request->'changes') is distinct from 'array'
  then raise exception 'HISTORY_EDIT_INVALID'; end if;
  if jsonb_array_length(p_request->'changes') not between 1 and 2000 then raise exception 'HISTORY_EDIT_INVALID'; end if;
  gen:=(access->>'accountGeneration')::bigint; prov:=p_request->>'provider'; titlekey:=p_request->>'titleKey'; mutation:=(p_request->>'clientMutationId')::uuid;
  if (p_request->>'accountGeneration')::bigint is distinct from gen then raise exception 'watch_history_generation_mismatch'; end if;
  delete from public.watch_history_edit_receipts where user_id=p_user_id and expires_at<=clock_timestamp();
  select * into receipt from public.watch_history_edit_receipts where user_id=p_user_id and client_id=mutation;
  if found then
    if receipt.request is distinct from p_request then raise exception 'watch_history_client_id_conflict'; end if;
    return receipt.acknowledgement;
  end if;
  snapshot:=anidachi_history_private.watch_editor_snapshot(p_user_id,gen,prov,titlekey);
  if snapshot->>'revision' is distinct from p_request->>'revision' then raise exception 'HISTORY_EDIT_CONFLICT'; end if;
  if (select count(distinct value->>'episodeKey') from jsonb_array_elements(p_request->'changes'))<>jsonb_array_length(p_request->'changes') then raise exception 'HISTORY_EDIT_INVALID'; end if;
  select * into strict template from public.watch_episode_progress where user_id=p_user_id and history_generation=gen and provider=prov and title_key=titlekey order by server_order desc limit 1;
  previous_bulk:=current_setting('anidachi.history_editor_bulk',true);
  perform set_config('anidachi.history_editor_bulk','on',true);
  for change in select value from jsonb_array_elements(p_request->'changes') loop
    if jsonb_typeof(change) is distinct from 'object' or change-array['episodeKey','watched']<>'{}'::jsonb
      or jsonb_typeof(change->'watched') is distinct from 'boolean' or jsonb_typeof(change->'episodeKey') is distinct from 'string'
    then raise exception 'HISTORY_EDIT_INVALID'; end if;
    select value into ep from jsonb_array_elements(snapshot->'episodes') where value->>'episodeKey'=change->>'episodeKey';
    if ep is null or ((change->>'watched')::boolean and (ep->>'available')::boolean is distinct from true) then raise exception 'HISTORY_EPISODE_UNAVAILABLE'; end if;
    -- No-op unwatch on a catalog-only episode need not create a saved row.
    if change->'watched'=ep->'watched' and ((change->>'watched')::boolean or (ep->>'currentTime')::numeric=0) then continue; end if;
    stamp:=clock_timestamp();
    update public.user_watch_settings set next_server_order=next_server_order+1 where user_id=p_user_id returning next_server_order into next_order;
    insert into public.watch_episode_progress(user_id,provider,title_key,episode_key,item_kind,title,artwork_url,
      episode_title,season_key,season_title,season_number,episode_number,source_url,current_time_seconds,duration,progress,
      completed_at,latest_session_id,last_event_id,observed_at,server_order,history_generation,updated_at,manual_edited_at,raw_content_id,audio_locale)
    values(p_user_id,prov,titlekey,ep->>'episodeKey',template.item_kind,template.title,template.artwork_url,
      ep->>'episodeTitle',ep->>'seasonKey',ep->>'seasonTitle',(ep->>'seasonNumber')::integer,(ep->>'episodeNumber')::double precision,ep->>'sourceUrl',
      case when (change->>'watched')::boolean then (ep->>'duration')::double precision else 0 end,(ep->>'duration')::double precision,
      case when (change->>'watched')::boolean then 1 else 0 end,case when (change->>'watched')::boolean then stamp else null end,
      null,mutation,stamp,next_order,gen,stamp,stamp,
      case when prov='crunchyroll' then substring(ep->>'sourceUrl' from '/watch/([^/?]+)') else template.raw_content_id end,
      (select a.audio_locale from public.watch_catalog_aliases a where a.user_id=p_user_id and a.history_generation=gen and a.provider=prov and a.title_key=titlekey and a.episode_key=ep->>'episodeKey' and a.source_url=ep->>'sourceUrl' order by a.variant_order limit 1))
    on conflict(user_id,provider,title_key,episode_key) do update set
      current_time_seconds=excluded.current_time_seconds,progress=excluded.progress,completed_at=excluded.completed_at,
      latest_session_id=null,last_event_id=excluded.last_event_id,observed_at=greatest(public.watch_episode_progress.observed_at,excluded.observed_at),
      manual_edited_at=greatest(public.watch_episode_progress.observed_at,excluded.manual_edited_at),server_order=excluded.server_order,updated_at=excluded.updated_at;
    edited:=edited+1;
  end loop;
  perform set_config('anidachi.history_editor_bulk',coalesce(previous_bulk,''),true);
  if edited>0 then perform public.refresh_watch_catalog_projection_v3(p_user_id,gen,prov,titlekey); end if;
  snapshot:=anidachi_history_private.watch_editor_snapshot(p_user_id,gen,prov,titlekey);
  ack:=jsonb_build_object('meta',snapshot->'meta','clientMutationId',mutation,'revision',snapshot->'revision');
  insert into public.watch_history_edit_receipts(user_id,client_id,request,acknowledgement) values(p_user_id,mutation,p_request,ack);
  return ack;
end $$;
revoke all on function public.edit_watch_history_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.edit_watch_history_v1(uuid,jsonb) to service_role;

-- A manual batch derives the catalog once at the end. The transaction-local
-- flag is never an HTTP input and is restored before returning. Existing capture
-- and deletion retain their normal per-row projection updates.
do $migration$
declare body text; needle text:='begin';
begin
  body:=pg_get_functiondef('public.sync_watch_catalog_progress_v3()'::regprocedure);
  if strpos(body,needle)=0 then raise exception 'catalog trigger edit anchor missing'; end if;
  body:=replace(body,needle,needle||E'\n  if current_setting(''anidachi.history_editor_bulk'',true)=''on'' then return null; end if;');
  execute body;
end $migration$;

-- Use the same observation-time boundary as deletion. Fence replay before its
-- receipt is returned, including a receipt captured before a manual reset.
do $migration$
declare body text; needle text:=' -- Check deletion BEFORE receipt replay;';
begin
  body:=pg_get_functiondef('public.apply_personal_watch_progress_v1(uuid,jsonb)'::regprocedure);
  if strpos(body,needle)=0 then raise exception 'personal writer edit fence anchor missing'; end if;
  body:=replace(body,needle,$patch$
 if exists(select 1 from public.watch_episode_progress p where p.user_id=p_user_id and p.history_generation=gen
   and p.provider=e->>'provider' and p.title_key=e->>'titleKey' and p.episode_key=e->>'episodeKey' and p.manual_edited_at is not null
   and least(observed,coalesce((select (r.acknowledgement#>>'{episode,lastWatchedAt}')::timestamptz from public.watch_history_receipts r
     where r.user_id=p_user_id and r.client_id=(e->>'clientEventId')::uuid and r.expires_at>clock_timestamp()),clock_timestamp()))<=p.manual_edited_at)
 then raise exception 'watch_history_observation_stale'; end if;
$patch$||needle);
  execute body;
end $migration$;

-- The staging-compatible legacy path uses the same canonical rows. Fence its
-- old observations and receipts too, without changing rollout activation.
do $migration$
declare body text; needle text:=E'  select receipt.*\n  into existing_receipt';
begin
  body:=pg_get_functiondef('anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)'::regprocedure);
  if (length(body)-length(replace(body,needle,'')))<>length(needle) then raise exception 'canonical writer edit fence anchor missing'; end if;
  body:=replace(body,needle,$patch$
  if exists(select 1 from public.watch_episode_progress p where p.user_id=p_user_id and p.history_generation=settings_row.history_generation
    and p.provider=p_event->>'provider' and p.title_key=p_event->>'titleKey' and p.episode_key=p_event->>'episodeKey' and p.manual_edited_at is not null
    and least((p_event->>'observedAt')::timestamptz,server_accepted_at,
      coalesce((select (r.acknowledgement#>>'{episode,lastWatchedAt}')::timestamptz from public.watch_history_receipts r
        where r.user_id=p_user_id and r.client_id=client_event_id and r.expires_at>server_accepted_at),server_accepted_at))<=p.manual_edited_at)
  then raise exception 'watch_history_observation_stale'; end if;
$patch$||needle);
  execute body;
end $migration$;
commit;
