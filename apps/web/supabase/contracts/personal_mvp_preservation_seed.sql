begin;
set local statement_timeout='30s'; set local lock_timeout='5s';
insert into public.users(id,email,display_name,plan) values
('a3111111-1111-4111-8111-111111111111','task9-free@example.test','Synthetic Free','free'),
('a3222222-2222-4222-8222-222222222222','task9-plus@example.test','Synthetic Plus','plus'),
('a3333333-3333-4333-8333-333333333333','task9-pro@example.test','Synthetic Pro','pro'),
('a3444444-4444-4444-8444-444444444444','task9-deleted@example.test','Synthetic Cleared','free');
insert into rooms(room_id,host_user_id,created_at) values('task9-preservation-room','a3111111-1111-4111-8111-111111111111',now()-interval '2 hours');
insert into room_members(room_id,user_id,joined_at) values('task9-preservation-room','a3222222-2222-4222-8222-222222222222',now()-interval '2 hours');
insert into friendships(requester_user_id,addressee_user_id,status) values('a3111111-1111-4111-8111-111111111111','a3222222-2222-4222-8222-222222222222','accepted');
insert into friend_groups(id,owner_user_id,name) values('a9555555-5555-4555-8555-555555555555','a3111111-1111-4111-8111-111111111111','Synthetic private group');
insert into friend_group_members(group_id,friend_user_id) values('a9555555-5555-4555-8555-555555555555','a3222222-2222-4222-8222-222222222222');
select create_room_invite_atomic('a3111111-1111-4111-8111-111111111111',gen_random_uuid(),'task9-preservation-room',null,'a9555555-5555-4555-8555-555555555555',null);
update room_invite_recipients set status='accepted',responded_at=now()-interval '1 minute';
update watch_history_group_invitation_contexts set action_at=now()-interval '2 minutes',accepted_at=now()-interval '1 minute';
create or replace function pg_temp.watch_v3_event(
  event_id uuid,
  session_key text,
  observed_at timestamptz,
  current_seconds double precision,
  account_generation bigint default 1,
  shared_room jsonb default null,
  episode_key text default 'crunchyroll:episode:episode-one',
  title_key text default 'crunchyroll:series:series-one',
  event_kind text default 'heartbeat'
)
returns jsonb
language sql
as $$
  select pg_catalog.jsonb_build_object(
    'schemaVersion', 3,
    'clientEventId', event_id,
    'clientSessionKey', session_key,
    'accountGeneration', account_generation,
    'provider', 'crunchyroll',
    'titleKey', title_key,
    'itemKind', 'series',
    'title', case when title_key = 'crunchyroll:series:series-one' then 'Series One' else 'Series Two' end,
    'artworkUrl', null,
    'episodeKey', episode_key,
    'episodeTitle', case when episode_key = 'crunchyroll:episode:episode-one' then 'Episode One' else 'Episode Two' end,
    'seasonKey', 'crunchyroll:season:season-one',
    'seasonTitle', 'Season One',
    'seasonNumber', 1,
    'episodeNumber', case when episode_key = 'crunchyroll:episode:episode-one' then 1 else 2 end,
    'crunchyrollIdentity',jsonb_build_object('providerSeriesId',replace(title_key,'crunchyroll:series:',''),'providerSeasonIdentifier','season-one','providerEpisodeIdentifier',replace(episode_key,'crunchyroll:episode:',''),'providerContentId',replace(episode_key,'crunchyroll:episode:',''),'audioLocale',null),
    'sourceUrl', 'https://www.crunchyroll.com/watch/' || replace(episode_key,'crunchyroll:episode:',''),
    'currentTime', current_seconds,
    'duration', 1200,
    'progress', current_seconds / 1200,
    'observedAt', observed_at,
    'kind', event_kind,
    'sharedRoom', shared_room
  );
$$;

create function pg_temp.legacy_watch(uid uuid, ep text default 'E1', source_gen int default 1, obs timestamptz default clock_timestamp(), title_id text default 'S', room_gen int default 1, event_id uuid default gen_random_uuid(), account_gen bigint default 1, episode_label text default null) returns jsonb language plpgsql as $$
declare e jsonb; a jsonb;
begin
e:=jsonb_build_object('schemaVersion',3,'clientEventId',event_id,'clientSessionKey','browse-'||uid||'-'||ep,'accountGeneration',account_gen,
'provider','crunchyroll','titleKey','crunchyroll:series:'||title_id,'episodeKey','crunchyroll:episode:'||ep,'seasonKey','crunchyroll:season:SS',
'itemKind','series','title','Title '||title_id,'episodeTitle',coalesce(episode_label,'Episode '||ep),'seasonTitle','Season','seasonNumber',1,'episodeNumber',1,'artworkUrl',null,
'sourceUrl','https://www.crunchyroll.com/watch/'||ep,'currentTime',case when uid='a3111111-1111-4111-8111-111111111111'::uuid then 900 else 120 end,'duration',1800,'progress',0.5,'kind','heartbeat','observedAt',obs,
'crunchyrollIdentity',jsonb_build_object('providerSeriesId',title_id,'providerSeasonIdentifier','SS','providerEpisodeIdentifier',ep,'providerContentId',ep,'audioLocale',null),
'sharedRoom',jsonb_build_object('roomId','task9-preservation-room','participantSessionId','browse-'||uid,'roomGeneration',room_gen,'sourceGeneration',source_gen));
a:=jsonb_build_object('sub',uid,'roomId','task9-preservation-room','participantSessionId','browse-'||uid,'roomGeneration',room_gen,'sourceGeneration',source_gen,'iat',floor(extract(epoch from now())));
return public.apply_watch_progress_v3(uid,e,a);
end $$;

select pg_temp.legacy_watch('a3111111-1111-4111-8111-111111111111','SHARED',1,now()-interval '50 seconds');
select pg_temp.legacy_watch('a3222222-2222-4222-8222-222222222222','SHARED',1,now()-interval '40 seconds');
select apply_watch_progress_v3(u.id,pg_temp.watch_v3_event(gen_random_uuid(),'task9-solo-'||u.id,now()-interval '30 seconds',case when plan='pro' then 1200 else 123 end,1,null,'crunchyroll:episode:SOLO-'||plan,'crunchyroll:series:SOLO-'||plan,case when plan='pro' then 'ended' else 'heartbeat' end),null) from users u;
select delete_watch_history_v3('a3444444-4444-4444-8444-444444444444',jsonb_build_object('schemaVersion',3,'clientMutationId',gen_random_uuid(),'accountGeneration',1,'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','all')));
update user_watch_settings set youtube_history_enabled=true where user_id='a3222222-2222-4222-8222-222222222222';
commit;
