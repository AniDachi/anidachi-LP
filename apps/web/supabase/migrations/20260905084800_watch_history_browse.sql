begin;

-- Forward-only evidence. Neither current group membership nor old invitations
-- are sufficient to reconstruct historical viewing.
create table public.watch_history_group_invitation_contexts (
  owner_user_id uuid not null references public.users(id) on delete cascade,
  client_action_id uuid not null,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  invite_id uuid not null,
  room_id text not null,
  group_id uuid not null,
  group_name text not null,
  action_at timestamptz not null,
  accepted_at timestamptz,
  room_generation bigint,
  primary key(owner_user_id, client_action_id, recipient_user_id)
);
create index watch_history_invitation_acceptance_idx on public.watch_history_group_invitation_contexts(invite_id, recipient_user_id) where accepted_at is null;
create index watch_history_invitation_room_idx on public.watch_history_group_invitation_contexts(room_id, owner_user_id, recipient_user_id) where accepted_at is not null;

create table public.watch_history_session_observations (
  session_id uuid not null references public.watch_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  history_generation bigint not null,
  first_observed_at timestamptz not null,
  last_observed_at timestamptz not null,
  primary key(session_id,user_id),
  foreign key(session_id,user_id) references public.watch_session_participants(session_id,user_id) on delete cascade,
  check(first_observed_at <= last_observed_at)
);
create index watch_history_observations_owner_idx on public.watch_history_session_observations(user_id,history_generation,last_observed_at desc,session_id);

create table public.watch_history_session_groups (
  owner_user_id uuid not null references public.users(id) on delete cascade,
  history_generation bigint not null,
  session_id uuid not null references public.watch_sessions(id) on delete cascade,
  group_id uuid not null,
  group_name text not null,
  primary key(owner_user_id,history_generation,session_id,group_id),
  foreign key(session_id,owner_user_id) references public.watch_session_participants(session_id,user_id) on delete cascade
);
create index watch_history_groups_filter_idx on public.watch_history_session_groups(owner_user_id,history_generation,group_id,session_id);
alter table public.watch_history_group_invitation_contexts enable row level security;
alter table public.watch_history_session_observations enable row level security;
alter table public.watch_history_session_groups enable row level security;
revoke all on public.watch_history_group_invitation_contexts,public.watch_history_session_observations,public.watch_history_session_groups from public,anon,authenticated;
grant select,insert,update,delete on public.watch_history_group_invitation_contexts,public.watch_history_session_observations,public.watch_history_session_groups to service_role;

-- The existing FK explicitly preserves invitations when a group is deleted.
alter table public.room_invites drop constraint room_invites_check;
alter table public.room_invites add constraint room_invites_check check(target_kind='group' or (target_kind='direct' and target_group_id is null));

create function public.capture_watch_group_acceptance_v3() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='accepted' and old.status is distinct from 'accepted' then
    update public.watch_history_group_invitation_contexts c
    set accepted_at=pg_catalog.clock_timestamp()
    where c.invite_id=new.invite_id and c.recipient_user_id=new.recipient_user_id and c.accepted_at is null;
  end if;
  return null;
end $$;
create trigger capture_watch_group_acceptance_v3 after update of status on public.room_invite_recipients
for each row execute function public.capture_watch_group_acceptance_v3();

-- Preserve the existing action validation, sender serialization, recipient
-- deduplication, return values and notification behavior. Snapshot the exact
-- validated recipient set inside that transaction, before the action returns.
do $migration$
declare body text;
begin
  select pg_catalog.pg_get_functiondef('public.create_room_invite_atomic(uuid,uuid,text,uuid[],uuid,text)'::regprocedure) into body;
  if pg_catalog.strpos(body,'  return query select' || chr(10) || '    case when cardinality(new_recipient_ids)')=0 then
    raise exception 'unexpected create_room_invite_atomic definition';
  end if;
  body:=pg_catalog.replace(body,
    '  return query select' || chr(10) || '    case when cardinality(new_recipient_ids)',
    $capture$
  if p_group_id is not null then
    insert into public.watch_history_group_invitation_contexts(owner_user_id,client_action_id,recipient_user_id,invite_id,room_id,group_id,group_name,action_at)
    select p_sender_user_id,p_client_action_id,requested.user_id,recipient.invite_id,p_room_id,p_group_id,group_record.name,pg_catalog.clock_timestamp()
    from pg_catalog.unnest(requested_recipient_ids) requested(user_id)
    cross join lateral (
      select r.invite_id from public.room_invite_recipients r join public.room_invites i on i.id=r.invite_id
      where i.room_id=p_room_id and r.recipient_user_id=requested.user_id and r.status='pending'
      order by r.updated_at desc,i.id limit 1 for update of r
    ) recipient;
  end if;
  return query select
    case when cardinality(new_recipient_ids)$capture$);
  execute body;
end $migration$;

-- Keep the large canonical writer intact. The wrapper uses only its already
-- validated accepted event and is in the same transaction as the receipt.
alter function public.apply_watch_progress_v3(uuid,jsonb,jsonb) rename to apply_watch_progress_v3_canonical;
create function public.apply_watch_progress_v3(p_user_id uuid,p_event jsonb,p_room_authority jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare ack jsonb; sid uuid; observed timestamptz; generation bigint; ctx record; action_generation bigint; receipt_existed boolean;
begin
  -- The canonical acknowledgement keeps its original duplicate:false on replay.
  -- Check freshness under the exact same account lock used by the canonical
  -- writer and deletion function, before delegating validation/acceptance.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
  select exists(select 1 from public.watch_history_receipts r
    where r.user_id=p_user_id and r.client_id=(p_event->>'clientEventId')::uuid
      and r.expires_at>pg_catalog.transaction_timestamp()) into receipt_existed;
  ack:=public.apply_watch_progress_v3_canonical(p_user_id,p_event,p_room_authority);
  if receipt_existed then return ack; end if;
  generation:=(ack->>'accountGeneration')::bigint;
  -- A delayed event need not be the latest progress. Resolve its actual identity.
  select s.id into sid from public.watch_sessions s join public.watch_session_participants p on p.session_id=s.id and p.user_id=p_user_id
  where s.schema_version=3 and s.provider=p_event->>'provider' and s.item_key=p_event->>'titleKey' and s.episode_key=p_event->>'episodeKey'
    and ((p_room_authority is null and s.host_user_id=p_user_id and s.room_id is null and s.client_session_key=p_event->>'clientSessionKey')
      or (p_room_authority is not null and s.room_id=p_room_authority->>'roomId'
        and s.room_generation=(p_room_authority->>'roomGeneration')::bigint and s.source_generation=(p_room_authority->>'sourceGeneration')::bigint));
  if sid is null then return ack; end if;
  observed:=least((p_event->>'observedAt')::timestamptz,pg_catalog.transaction_timestamp());
  insert into public.watch_history_session_observations values(sid,p_user_id,generation,observed,observed)
  on conflict(session_id,user_id) do update set
    first_observed_at=case when public.watch_history_session_observations.history_generation=excluded.history_generation then least(public.watch_history_session_observations.first_observed_at,excluded.first_observed_at) else excluded.first_observed_at end,
    last_observed_at=case when public.watch_history_session_observations.history_generation=excluded.history_generation then greatest(public.watch_history_session_observations.last_observed_at,excluded.last_observed_at) else excluded.last_observed_at end,
    history_generation=excluded.history_generation;
  for ctx in
    select c.owner_user_id,c.client_action_id,c.recipient_user_id,c.group_id,c.group_name,o.history_generation,s.room_generation
    from public.watch_sessions s
    join public.watch_history_group_invitation_contexts c on c.room_id=s.room_id and c.owner_user_id=s.host_user_id
    join public.watch_history_session_observations o on o.session_id=s.id and o.user_id=c.owner_user_id
    join public.user_watch_settings os on os.user_id=o.user_id and os.history_generation=o.history_generation
    join public.watch_history_session_observations r on r.session_id=s.id and r.user_id=c.recipient_user_id
    join public.user_watch_settings rs on rs.user_id=r.user_id and rs.history_generation=r.history_generation
    where s.id=sid and c.accepted_at is not null
      and (c.room_generation is null or c.room_generation=s.room_generation)
      and greatest(o.first_observed_at,r.first_observed_at,c.action_at,c.accepted_at)<=least(o.last_observed_at,r.last_observed_at)
    order by c.owner_user_id,c.client_action_id,c.recipient_user_id
  loop
    -- Recipients share one immutable action generation. Acquire this lock before
    -- locking any recipient context rows so concurrent recipients cannot bind
    -- independently or deadlock while updating the action's other recipients.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'watch-group-action:'||ctx.owner_user_id::text||':'||ctx.client_action_id::text,0));
    select min(c.room_generation) into action_generation
    from public.watch_history_group_invitation_contexts c
    where c.owner_user_id=ctx.owner_user_id and c.client_action_id=ctx.client_action_id;
    if action_generation is null then
      update public.watch_history_group_invitation_contexts c set room_generation=ctx.room_generation
      where c.owner_user_id=ctx.owner_user_id and c.client_action_id=ctx.client_action_id;
      action_generation:=ctx.room_generation;
    end if;
    if action_generation=ctx.room_generation then
      insert into public.watch_history_session_groups values(ctx.owner_user_id,ctx.history_generation,sid,ctx.group_id,ctx.group_name) on conflict do nothing;
    end if;
  end loop;
  return ack;
end $$;

-- One eligibility relation is shared by every page and options. Conditions are
-- ANDed on one actual session before any title/episode/session LIMIT.
create function public.watch_history_browse_matches_v3(p_user_id uuid,p_generation bigint,p_query jsonb)
returns table(session_id uuid,provider text,title_key text,episode_key text,watched_at timestamptz)
language sql stable security invoker set search_path='' as $$
  select s.id,s.provider,s.item_key,s.episode_key,coalesce(o.last_observed_at,s.last_checkpoint_at)
  from public.watch_history_user_session_summaries us
  join public.watch_sessions s on s.id=us.session_id and s.schema_version=3
  join public.watch_session_participants p on p.session_id=s.id and p.user_id=p_user_id and p.schema_version=3
  join public.watch_episode_progress ep on ep.user_id=p_user_id and ep.history_generation=p_generation and ep.provider=s.provider and ep.title_key=s.item_key and ep.episode_key=s.episode_key
  left join public.watch_history_session_observations o on o.session_id=s.id and o.user_id=p_user_id and o.history_generation=p_generation
  where us.user_id=p_user_id and us.history_generation=p_generation
    and ((p_query->>'mode'='solo' and s.room_id is null and s.client_session_key is not null)
      or (p_query->>'mode'='shared' and s.room_id is not null))
    and (not p_query?'provider' or s.provider=p_query->>'provider')
    and (not p_query?'titleKey' or s.item_key=p_query->>'titleKey')
    and (not p_query?'episodeKey' or s.episode_key=p_query->>'episodeKey')
    and (not p_query?'search' or pg_catalog.strpos(pg_catalog.lower(ep.title),pg_catalog.lower(p_query->>'search'))>0
      or pg_catalog.strpos(pg_catalog.lower(coalesce(public.watch_catalog_read_v3(p_user_id,p_generation,s.provider,s.item_key)->>'title','')),pg_catalog.lower(p_query->>'search'))>0)
    and (not p_query?'from' or coalesce(o.last_observed_at,s.last_checkpoint_at)>=(p_query->>'from')::timestamptz)
    and (not p_query?'until' or coalesce(o.last_observed_at,s.last_checkpoint_at)<(p_query->>'until')::timestamptz)
    and (not p_query?'participantUserId' or exists(select 1 from public.watch_session_participants other where other.session_id=s.id and other.user_id=(p_query->>'participantUserId')::uuid and other.schema_version=3))
    and (not p_query?'groupId' or exists(select 1 from public.watch_history_session_groups g where g.owner_user_id=p_user_id and g.history_generation=p_generation and g.session_id=s.id and g.group_id=(p_query->>'groupId')::uuid));
$$;

create function public.watch_history_browse_cursor_v3(binding text,at_value timestamptz,key_value text) returns text
language sql immutable security invoker set search_path='' as $$
select pg_catalog.encode(pg_catalog.convert_to(pg_catalog.jsonb_build_array(binding,at_value,key_value)::text,'UTF8'),'hex');
$$;

create function public.watch_history_browse_progress_row_v3(p public.watch_episode_progress) returns jsonb
language sql stable security invoker set search_path='' as $$
select (pg_catalog.to_jsonb(p)-'last_event_id'-'updated_at'-'raw_content_id'-'audio_locale') || pg_catalog.jsonb_build_object(
'episode_title',coalesce(public.watch_catalog_label_v3(p.user_id,p.history_generation,p.provider,p.title_key,p.episode_key)->>'episodeTitle',p.episode_title));
$$;

create function public.browse_watch_history_v3(p_user_id uuid,p_query jsonb,p_scope text default 'titles') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare generation bigint; page_limit int:=coalesce((p_query->>'limit')::int,20); binding text; cursor_value jsonb; cursor_at timestamptz; cursor_key text; result jsonb;
begin
  if p_user_id is null or pg_catalog.jsonb_typeof(p_query) is distinct from 'object' or p_scope not in ('titles','episodes','sessions','options')
    or p_query->>'mode' is null or p_query->>'mode' not in ('solo','shared') or page_limit not between 1 and 50
    or (p_query->>'mode'='solo' and (p_query?'groupId' or p_query?'participantUserId' or p_scope='options'))
    or exists(select 1 from pg_catalog.jsonb_object_keys(p_query) k where k not in ('mode','search','groupId','participantUserId','from','until','limit','cursor','provider','titleKey','episodeKey'))
    or (p_query?'from' and p_query?'until' and (p_query->>'from')::timestamptz >= (p_query->>'until')::timestamptz)
    or (p_scope in ('episodes','sessions') and (p_query->>'provider' is null or p_query->>'titleKey' is null))
    or (p_scope='sessions' and p_query->>'episodeKey' is null)
  then raise exception 'watch_history_browse_invalid' using errcode='22023'; end if;
  select coalesce((select history_generation from public.user_watch_settings where user_id=p_user_id),1) into generation;
  binding:=pg_catalog.md5(p_user_id::text||':'||generation||':'||p_scope||':'||(p_query-'cursor')::text);
  if p_query?'cursor' then
    begin
      if char_length(p_query->>'cursor')>512 then raise exception 'invalid'; end if;
      cursor_value:=pg_catalog.convert_from(pg_catalog.decode(p_query->>'cursor','hex'),'UTF8')::jsonb;
      if pg_catalog.jsonb_array_length(cursor_value)<>3 or cursor_value->>0 is distinct from binding then raise exception 'invalid'; end if;
      cursor_at:=(cursor_value->>1)::timestamptz; cursor_key:=cursor_value->>2;
      if cursor_at is null or cursor_key is null then raise exception 'invalid'; end if;
    exception when others then raise exception 'watch_history_browse_cursor_invalid' using errcode='22023'; end;
  end if;

  if p_scope='options' then
    with eligible as materialized(select * from public.watch_history_browse_matches_v3(p_user_id,generation,'{"mode":"shared"}')),
    options as (
      select distinct 'group'::text kind,g.group_id id,g.group_name label from eligible e join public.watch_history_session_groups g on g.session_id=e.session_id and g.owner_user_id=p_user_id and g.history_generation=generation
      union
      select distinct 'participant',u.id,coalesce(nullif(pr.display_name,''),nullif(u.display_name,''),'AniDachi user') from eligible e
      join public.watch_session_participants p on p.session_id=e.session_id and p.schema_version=3 and p.user_id<>p_user_id
      join public.users u on u.id=p.user_id left join public.profiles pr on pr.user_id=u.id
    ), unique_options as (select distinct on(kind,id) kind,id,label from options order by kind,id,label),
    candidates as (select *,kind||':'||id::text k from unique_options where cursor_key is null or kind||':'||id::text>cursor_key order by kind,id limit page_limit+1),
    visible as (select * from candidates order by kind,id limit page_limit)
    select pg_catalog.jsonb_build_object('accountGeneration',generation,'options',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('kind',kind,'id',id,'label',label) order by kind,id) from visible),'[]'::jsonb),
    'nextCursor',case when (select count(*) from candidates)>page_limit then (select public.watch_history_browse_cursor_v3(binding,'1970-01-01'::timestamptz,k) from visible order by kind desc,id desc limit 1) else null end) into result;
    return result;
  end if;

  with matching as materialized(select * from public.watch_history_browse_matches_v3(p_user_id,generation,p_query)),
  entities as (
    select m.provider,m.title_key,case when p_scope='titles' then null else m.episode_key end episode_key,
      case when p_scope='sessions' then m.session_id else null end session_id,
      max(m.watched_at) watched_at,count(distinct m.episode_key) episode_count,count(distinct m.session_id) session_count,
      case when p_scope='titles' then pg_catalog.md5(m.provider||':'||m.title_key) when p_scope='episodes' then pg_catalog.md5(m.episode_key) else m.session_id::text end k
    from matching m group by m.provider,m.title_key,case when p_scope='titles' then null else m.episode_key end,
      case when p_scope='sessions' then m.session_id else null end,
      case when p_scope='titles' then pg_catalog.md5(m.provider||':'||m.title_key) when p_scope='episodes' then pg_catalog.md5(m.episode_key) else m.session_id::text end
  ), candidates as (select * from entities where cursor_at is null or watched_at<cursor_at or (watched_at=cursor_at and k>cursor_key) order by watched_at desc,k limit page_limit+1),
  visible as materialized(select * from candidates order by watched_at desc,k limit page_limit),
  progress_rows as materialized(
    select v.k,v.watched_at,e.* from visible v cross join lateral (
      select ep.* from public.watch_episode_progress ep where ep.user_id=p_user_id and ep.history_generation=generation and ep.provider=v.provider and ep.title_key=v.title_key
      and (p_scope='titles' or ep.episode_key=v.episode_key) order by ep.observed_at desc,ep.episode_key collate "C" limit 8
    ) e
  ), bounded_sessions as materialized(
    select distinct s.session_id from visible v cross join lateral (
      select m.session_id from matching m where m.provider=v.provider and m.title_key=v.title_key
        and (p_scope='titles' or m.episode_key=v.episode_key) and (p_scope<>'sessions' or m.session_id=v.session_id)
      order by m.watched_at desc,m.session_id limit 20
    ) s
  )
  select pg_catalog.jsonb_build_object(
    'accountGeneration',generation,'totalTitleCount',(select count(distinct (provider,title_key)) from matching),
    'totalSessionCount',(select count(*) from matching),
    'hasMore',(select count(*) from candidates)>page_limit,
    'nextCursor',case when (select count(*) from candidates)>page_limit then (select public.watch_history_browse_cursor_v3(binding,watched_at,k) from visible order by watched_at,k desc limit 1) else null end,
    'matches',coalesce((select pg_catalog.jsonb_agg(case when p_scope='titles' then pg_catalog.jsonb_build_object('provider',provider,'titleKey',title_key,'lastWatchedAt',watched_at,'matchingEpisodeCount',episode_count,'matchingSessionCount',session_count)
      else pg_catalog.jsonb_build_object('episodeKey',episode_key,'lastWatchedAt',watched_at,'matchingSessionCount',session_count,'sessionsComplete',session_count<=20) end order by watched_at desc,k) from visible),'[]'::jsonb),
    'progressRows',coalesce((select pg_catalog.jsonb_agg(public.watch_history_browse_progress_row_v3(ep) order by p.watched_at desc,p.k,p.observed_at desc,p.episode_key collate "C") from progress_rows p join public.watch_episode_progress ep on ep.user_id=p.user_id and ep.provider=p.provider and ep.title_key=p.title_key and ep.episode_key=p.episode_key),'[]'::jsonb),
    'sessionIds',coalesce((select pg_catalog.jsonb_agg(b.session_id order by m.watched_at desc,b.session_id) from bounded_sessions b join matching m on m.session_id=b.session_id),'[]'::jsonb),
    'sessionTimes',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('sessionId',b.session_id,'lastWatchedAt',m.watched_at)) from bounded_sessions b join matching m on m.session_id=b.session_id),'[]'::jsonb),
    'groups',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('sessionId',s.session_id,'groups',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',g.group_id,'name',g.group_name) order by g.group_id),'[]'::jsonb) from public.watch_history_session_groups g where g.session_id=s.session_id and g.owner_user_id=p_user_id and g.history_generation=generation))) from bounded_sessions s),'[]'::jsonb),
    'titleSummaries',case when p_scope='titles' then coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('provider',t.provider,'titleKey',t.title_key,'lastWatchedAt',t.last_watched_at,'observedEpisodeCount',t.observed_episode_count,'completedEpisodeCount',t.completed_episode_count,
      'catalog',public.watch_catalog_read_v3(p_user_id,generation,t.provider,t.title_key),
      'episodePage',pg_catalog.jsonb_build_object('complete',t.observed_episode_count<=8,'nextCursor',case when t.observed_episode_count<=8 then null else (
        select pg_catalog.encode(pg_catalog.convert_to(pg_catalog.jsonb_build_object('v',1,'userId',p_user_id,'accountGeneration',generation,'provider',t.provider,'titleKey',t.title_key,'observedAt',e.observed_at,'episodeKey',e.episode_key)::text,'UTF8'),'hex') from progress_rows e where e.provider=t.provider and e.title_key=t.title_key order by e.observed_at desc,e.episode_key collate "C" offset 7 limit 1) end)) order by v.watched_at desc,v.k)
      from visible v join public.watch_history_title_summaries t on t.user_id=p_user_id and t.history_generation=generation and t.provider=v.provider and t.title_key=v.title_key),'[]'::jsonb) else '[]'::jsonb end,
    'catalog',case when p_scope<>'titles' then public.watch_catalog_read_v3(p_user_id,generation,p_query->>'provider',p_query->>'titleKey') else null end,
    'observedEpisodeCount',coalesce((select observed_episode_count from public.watch_history_title_summaries where user_id=p_user_id and history_generation=generation and provider=p_query->>'provider' and title_key=p_query->>'titleKey'),0),
    'completedEpisodeCount',coalesce((select completed_episode_count from public.watch_history_title_summaries where user_id=p_user_id and history_generation=generation and provider=p_query->>'provider' and title_key=p_query->>'titleKey'),0)
  ) into result;
  return result;
end $$;

revoke all on function public.capture_watch_group_acceptance_v3(),public.apply_watch_progress_v3(uuid,jsonb,jsonb),public.watch_history_browse_matches_v3(uuid,bigint,jsonb),public.watch_history_browse_cursor_v3(text,timestamptz,text),public.watch_history_browse_progress_row_v3(public.watch_episode_progress),public.browse_watch_history_v3(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.capture_watch_group_acceptance_v3(),public.apply_watch_progress_v3(uuid,jsonb,jsonb),public.watch_history_browse_matches_v3(uuid,bigint,jsonb),public.watch_history_browse_cursor_v3(text,timestamptz,text),public.watch_history_browse_progress_row_v3(public.watch_episode_progress),public.browse_watch_history_v3(uuid,jsonb,text) to service_role;
commit;
