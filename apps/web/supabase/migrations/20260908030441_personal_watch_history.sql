begin;
-- Durable rollout prerequisite. Task 9 alone activates this row after all consumers
-- are accepted. A row lock makes cutover atomic with in-flight SQL operations.
create table public.personal_history_policy (
 singleton boolean primary key default true check(singleton),
 policy_version integer not null default 1 check(policy_version=1),
 active boolean not null default false
);
insert into public.personal_history_policy default values;
alter table public.personal_history_policy enable row level security;
revoke all on public.personal_history_policy from public,anon,authenticated,service_role;
grant select on public.personal_history_policy to service_role;
create schema if not exists anidachi_history_private;
revoke all on schema anidachi_history_private from public,anon,authenticated,service_role;

create function public.check_personal_history_operation_v1(p_user_id uuid,p_operation text default 'read') returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare activated boolean; access jsonb;
begin
 select active into strict activated from public.personal_history_policy where singleton for share;
 if p_operation not in ('read','legacy','personal') then raise exception 'HISTORY_ACCESS_UNAVAILABLE'; end if;
 if activated and p_operation='legacy' then raise exception 'HISTORY_CLIENT_UPDATE_REQUIRED'; end if;
 if activated or p_operation='personal' then
  access:=public.resolve_watch_history_access_v1(p_user_id)->'history';
  if access->>'state' is distinct from 'allowed' then raise exception 'HISTORY_PLAN_REQUIRED'; end if;
 end if;
 return jsonb_build_object('active',activated,'policyVersion',1,'access',access);
end $$;
revoke all on function public.check_personal_history_operation_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.check_personal_history_operation_v1(uuid,text) to service_role;

-- Internal core has neither schema usage nor EXECUTE for service_role. Only the
-- security-definer wrappers may delegate to it. No client-controlled bypass flag.
alter function public.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb) set schema anidachi_history_private;
revoke all on function anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.apply_watch_progress_v3_canonical(p_user_id uuid,p_event jsonb,p_room_authority jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform public.check_personal_history_operation_v1(p_user_id,'legacy');
 return anidachi_history_private.apply_watch_progress_v3_canonical(p_user_id,p_event,p_room_authority);
end $$;
revoke all on function public.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb) to service_role;

alter table public.user_watch_settings add column youtube_capture_not_before timestamptz not null default '-infinity';
alter table public.watch_history_receipts add column personal_envelope jsonb;
create table public.personal_watch_sequences (
 user_id uuid not null references public.users(id) on delete cascade,
 history_generation bigint not null, access_epoch bigint not null,
 client_session_key text not null check(length(client_session_key) between 1 and 220),
 sequence bigint not null check(sequence>0),
 primary key(user_id,history_generation,access_epoch,client_session_key)
);
alter table public.personal_watch_sequences enable row level security;
revoke all on public.personal_watch_sequences from public,anon,authenticated,service_role;

create function public.apply_personal_watch_progress_v1(p_user_id uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a jsonb; e jsonb:=p_input->'event'; ack jsonb; receipt public.watch_history_receipts%rowtype;
 gen bigint; epoch bigint; seq bigint; observed timestamptz; sid uuid; prior_sequence bigint;
begin
 a:=public.check_personal_history_operation_v1(p_user_id,'personal')->'access';
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>65536
   or p_input-array['captureVersion','accessEpoch','youtubeConsentEpoch','clientSequence','event']<>'{}'::jsonb
   or p_input->>'captureVersion' is distinct from '1'
   or jsonb_typeof(e) is distinct from 'object' or e?'sharedRoom'
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
  and least(observed,clock_timestamp())<=d.deleted_at and (d.scope='all' or (d.provider=e->>'provider' and d.title_key=e->>'titleKey'
  and (d.scope='title' or (d.scope='episode' and d.episode_key=e->>'episodeKey'))))) then raise exception 'watch_history_deleted'; end if;
 select * into receipt from public.watch_history_receipts where user_id=p_user_id and client_id=(e->>'clientEventId')::uuid and expires_at>clock_timestamp();
 if found then
  if receipt.personal_envelope is distinct from p_input then raise exception 'watch_history_client_id_conflict'; end if;
  return receipt.acknowledgement;
 end if;
 select sequence into prior_sequence from public.personal_watch_sequences where user_id=p_user_id and history_generation=gen and access_epoch=epoch and client_session_key=e->>'clientSessionKey';
 if seq<=prior_sequence then raise exception 'watch_history_observation_stale'; end if;
 -- Always solo owner authority. Existing shared sessions remain immutable data.
 ack:=anidachi_history_private.apply_watch_progress_v3_canonical(p_user_id,e,null);
 update public.watch_history_receipts set personal_envelope=p_input where user_id=p_user_id and client_id=(e->>'clientEventId')::uuid;
 insert into public.personal_watch_sequences values(p_user_id,gen,epoch,e->>'clientSessionKey',seq)
 on conflict(user_id,history_generation,access_epoch,client_session_key) do update set sequence=excluded.sequence;
 select latest_session_id into sid from public.watch_episode_progress where user_id=p_user_id and provider=e->>'provider' and title_key=e->>'titleKey' and episode_key=e->>'episodeKey';
 insert into public.watch_history_session_observations values(sid,p_user_id,gen,least(observed,transaction_timestamp()),least(observed,transaction_timestamp()))
 on conflict(session_id,user_id) do update set first_observed_at=least(public.watch_history_session_observations.first_observed_at,excluded.first_observed_at),last_observed_at=greatest(public.watch_history_session_observations.last_observed_at,excluded.last_observed_at),history_generation=excluded.history_generation;
 return ack;
end $$;
revoke all on function public.apply_personal_watch_progress_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_personal_watch_progress_v1(uuid,jsonb) to service_role;

-- Add a proof to the existing v3 catalog requests without changing read/ACK
-- shapes. Store the issue epoch on the attempt, never trust only current plan.
alter table public.watch_catalog_snapshots add column personal_access_epoch bigint;
alter function public.begin_watch_catalog_v3(uuid,jsonb) set schema anidachi_history_private;
alter function public.apply_watch_catalog_v3(uuid,jsonb) set schema anidachi_history_private;
revoke all on function anidachi_history_private.begin_watch_catalog_v3(uuid,jsonb),anidachi_history_private.apply_watch_catalog_v3(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.begin_watch_catalog_v3(p_user_id uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare gate jsonb; a jsonb; ack jsonb; proof jsonb:=p_request->'historyAccess';
begin
 gate:=public.check_personal_history_operation_v1(p_user_id,case when proof is null then 'read' else 'personal' end); a:=gate->'access';
 if (gate->>'active')::boolean and proof is null then raise exception 'HISTORY_CLIENT_UPDATE_REQUIRED'; end if;
 if proof is not null then
  if proof-array['accessVersion','accessEpoch']<>'{}'::jsonb or proof->>'accessVersion' is distinct from '1' then raise exception 'watch_catalog_invalid'; end if;
  if (proof->>'accessEpoch')::bigint is distinct from (a->>'accessEpoch')::bigint
    or (p_request#>>'{context,observedAt}')::timestamptz < (a->>'captureNotBefore')::timestamptz then raise exception 'HISTORY_ACCESS_CHANGED'; end if;
 end if;
 ack:=anidachi_history_private.begin_watch_catalog_v3(p_user_id,p_request-'historyAccess');
 update public.watch_catalog_snapshots set personal_access_epoch=case when proof is null then null else (a->>'accessEpoch')::bigint end
 where user_id=p_user_id and history_generation=(p_request->>'accountGeneration')::bigint and provider='crunchyroll' and title_key=p_request->>'titleKey';
 return ack;
end $$;
create function public.apply_watch_catalog_v3(p_user_id uuid,p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare gate jsonb; a jsonb; issued bigint; proof jsonb:=p_request->'historyAccess';
begin
 gate:=public.check_personal_history_operation_v1(p_user_id,case when proof is null then 'read' else 'personal' end); a:=gate->'access';
 if (gate->>'active')::boolean and proof is null then raise exception 'HISTORY_CLIENT_UPDATE_REQUIRED'; end if;
 if proof is not null then
  if proof-array['accessVersion','accessEpoch']<>'{}'::jsonb or proof->>'accessVersion' is distinct from '1' then raise exception 'watch_catalog_invalid'; end if;
  select personal_access_epoch into issued from public.watch_catalog_snapshots where user_id=p_user_id and history_generation=(p_request->>'accountGeneration')::bigint and provider='crunchyroll' and title_key=p_request->>'titleKey';
  if (proof->>'accessEpoch')::bigint is distinct from (a->>'accessEpoch')::bigint or issued is distinct from (a->>'accessEpoch')::bigint then raise exception 'HISTORY_ACCESS_CHANGED'; end if;
 end if;
 return anidachi_history_private.apply_watch_catalog_v3(p_user_id,p_request-'historyAccess');
end $$;
revoke all on function public.begin_watch_catalog_v3(uuid,jsonb),public.apply_watch_catalog_v3(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.begin_watch_catalog_v3(uuid,jsonb),public.apply_watch_catalog_v3(uuid,jsonb) to service_role;

do $migration$
declare body text; signature text;
begin
 foreach signature in array array[
  'public.list_watch_history_v3_bounded_page(uuid,bigint,integer,timestamptz,text)',
  'public.list_watch_history_v3_title_episodes_page(uuid,bigint,text,text,integer,text)',
  'public.browse_watch_history_v3(uuid,jsonb,text)',
  'public.set_watch_preferences_v3(uuid,jsonb)',
  'public.apply_watch_progress_v3(uuid,jsonb,jsonb)'
 ] loop
  body:=pg_get_functiondef(signature::regprocedure);
  if strpos(body,E'begin\n')=0 then raise exception 'missing gate insertion anchor: %',signature; end if;
  body:=replace(body,E'begin\n',E'begin\n  perform public.check_personal_history_operation_v1(p_user_id,\'read\');\n');
  if signature like '%apply_watch_progress_v3%' then body:=replace(body,'''read''','''legacy'''); end if;
  body:=replace(body,' STABLE',' VOLATILE');
  if signature like '%browse_watch_history_v3%' then
   body:=replace(body,'''mode'' not in (''solo'',''shared'')','''mode'' not in (''solo'',''shared'',''personal'')');
   body:=replace(body,'''mode''=''solo'' and','''mode'' in (''solo'',''personal'') and');
  end if;
  if signature like '%set_watch_preferences_v3%' then
   body:=replace(body,'youtube_history_enabled = (p_preferences',E'youtube_capture_not_before = case when settings.youtube_history_enabled is distinct from (p_preferences ->> \'youtubeHistoryEnabled\')::boolean then clock_timestamp() else settings.youtube_capture_not_before end,\n    youtube_consent_epoch = settings.youtube_consent_epoch + case when settings.youtube_history_enabled is distinct from (p_preferences ->> \'youtubeHistoryEnabled\')::boolean then 1 else 0 end,\n    youtube_history_enabled = (p_preferences');
  end if;
  execute body;
 end loop;
 -- Delete-all stays available to Free. Individual deletions require paid access
 -- while active and remain compatible with old fixtures while inactive.
 body:=pg_get_functiondef('public.delete_watch_history_v3(uuid,jsonb)'::regprocedure);
 body:=replace(body,E'begin\n',E'begin\n  if p_request->>\'scope\' is distinct from \'all\' then perform public.check_personal_history_operation_v1(p_user_id,\'read\'); end if;\n');
 execute body;
end $migration$;
create or replace function public.watch_history_browse_matches_v3(p_user_id uuid,p_generation bigint,p_query jsonb)
returns table(session_id uuid,provider text,title_key text,episode_key text,watched_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select s.id,s.provider,s.item_key,s.episode_key,coalesce(o.last_observed_at,s.last_checkpoint_at)
  from public.watch_history_user_session_summaries us
  join public.watch_sessions s on s.id=us.session_id and s.schema_version=3
  join public.watch_session_participants p on p.session_id=s.id and p.user_id=p_user_id and p.schema_version=3
  join public.watch_episode_progress ep on ep.user_id=p_user_id and ep.history_generation=p_generation and ep.provider=s.provider and ep.title_key=s.item_key and ep.episode_key=s.episode_key
  left join public.watch_history_session_observations o on o.session_id=s.id and o.user_id=p_user_id and o.history_generation=p_generation
  where p_query->>'mode'<>'personal' and us.user_id=p_user_id and us.history_generation=p_generation
    and ((p_query->>'mode'='solo' and s.room_id is null and s.client_session_key is not null)
      or (p_query->>'mode'='shared' and s.room_id is not null))
    and (not p_query?'provider' or s.provider=p_query->>'provider')
    and (not p_query?'titleKey' or s.item_key=p_query->>'titleKey')
    and (not p_query?'episodeKey' or s.episode_key=p_query->>'episodeKey')
    and (not p_query?'search' or pg_catalog.strpos(pg_catalog.lower(ep.title),pg_catalog.lower(p_query->>'search'))>0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(public.watch_catalog_read_v3(p_user_id,p_generation,s.provider,s.item_key)->>'title','')),pg_catalog.lower(p_query->>'search'))>0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(public.watch_catalog_label_v3(p_user_id,p_generation,s.provider,s.item_key,s.episode_key)->>'episodeTitle',ep.episode_title,'')),pg_catalog.lower(p_query->>'search'))>0)
    and (not p_query?'from' or coalesce(o.last_observed_at,s.last_checkpoint_at)>=(p_query->>'from')::timestamptz)
    and (not p_query?'until' or coalesce(o.last_observed_at,s.last_checkpoint_at)<(p_query->>'until')::timestamptz)
    and (not p_query?'participantUserId' or exists(select 1 from public.watch_session_participants other where other.session_id=s.id and other.user_id=(p_query->>'participantUserId')::uuid and other.schema_version=3))
    and (not p_query?'groupId' or exists(select 1 from public.watch_history_session_groups g where g.owner_user_id=p_user_id and g.history_generation=p_generation and g.session_id=s.id and g.group_id=(p_query->>'groupId')::uuid))
 union all
 select s.id,ep.provider,ep.title_key,ep.episode_key,coalesce(o.last_observed_at,ep.observed_at)
 from public.watch_episode_progress ep
 left join lateral (
  select ws.id from public.watch_sessions ws join public.watch_session_participants p on p.session_id=ws.id and p.user_id=p_user_id and p.schema_version=3
  where ws.schema_version=3 and ws.provider=ep.provider and ws.item_key=ep.title_key and ws.episode_key=ep.episode_key
 ) s on true
 left join public.watch_history_session_observations o on o.session_id=s.id and o.user_id=p_user_id and o.history_generation=p_generation
 where p_query->>'mode'='personal' and ep.user_id=p_user_id and ep.history_generation=p_generation
  and (not p_query?'provider' or ep.provider=p_query->>'provider')
  and (not p_query?'titleKey' or ep.title_key=p_query->>'titleKey')
  and (not p_query?'episodeKey' or ep.episode_key=p_query->>'episodeKey')
  and (not p_query?'search' or strpos(lower(ep.title),lower(p_query->>'search'))>0 or strpos(lower(ep.episode_title),lower(p_query->>'search'))>0
    or strpos(lower(coalesce(public.watch_catalog_read_v3(p_user_id,p_generation,ep.provider,ep.title_key)->>'title','')),lower(p_query->>'search'))>0
    or strpos(lower(coalesce(public.watch_catalog_label_v3(p_user_id,p_generation,ep.provider,ep.title_key,ep.episode_key)->>'episodeTitle','')),lower(p_query->>'search'))>0)
  and (not p_query?'from' or coalesce(o.last_observed_at,ep.observed_at)>=(p_query->>'from')::timestamptz)
  and (not p_query?'until' or coalesce(o.last_observed_at,ep.observed_at)<(p_query->>'until')::timestamptz);
$$;


commit;
