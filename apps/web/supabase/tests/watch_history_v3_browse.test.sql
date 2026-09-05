begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
select has_function('public', 'browse_watch_history_v3', array['uuid','jsonb','text'], 'browse RPC exists');
insert into public.users(id,email,display_name) values
('bbbbbbbb-1111-4111-8111-111111111111','browse-owner@example.test','Owner'),
('bbbbbbbb-2222-4222-8222-222222222222','browse-viewer@example.test','Viewer'),
('bbbbbbbb-3333-4333-8333-333333333333','browse-link@example.test','Link viewer'),
('bbbbbbbb-4444-4444-8444-444444444444','browse-stranger@example.test','Stranger');
insert into public.friendships(requester_user_id,addressee_user_id,status) values
('bbbbbbbb-1111-4111-8111-111111111111','bbbbbbbb-2222-4222-8222-222222222222','accepted');
insert into public.friend_groups(id,owner_user_id,name) values
('aaaaaaaa-1111-4111-8111-111111111111','bbbbbbbb-1111-4111-8111-111111111111','Original group'),
('aaaaaaaa-2222-4222-8222-222222222222','bbbbbbbb-1111-4111-8111-111111111111','Overlap');
insert into public.friend_group_members(group_id,friend_user_id) values
('aaaaaaaa-1111-4111-8111-111111111111','bbbbbbbb-2222-4222-8222-222222222222'),
('aaaaaaaa-2222-4222-8222-222222222222','bbbbbbbb-2222-4222-8222-222222222222');
insert into public.rooms(room_id,host_user_id,created_at) values('browse-room','bbbbbbbb-1111-4111-8111-111111111111',now()-interval '2 hours');
insert into public.room_members(room_id,user_id,joined_at) values
('browse-room','bbbbbbbb-2222-4222-8222-222222222222',now()-interval '2 hours'),
('browse-room','bbbbbbbb-3333-4333-8333-333333333333',now()-interval '2 hours');
create function pg_temp.watch(uid uuid, ep text default 'E1', source_gen int default 1, obs timestamptz default clock_timestamp(), title_id text default 'S', room_gen int default 1, event_id uuid default gen_random_uuid(), account_gen bigint default 1) returns jsonb language plpgsql as $$
declare e jsonb; a jsonb;
begin
e:=jsonb_build_object('schemaVersion',3,'clientEventId',event_id,'clientSessionKey','browse-'||uid||'-'||ep,'accountGeneration',account_gen,
'provider','crunchyroll','titleKey','crunchyroll:series:'||title_id,'episodeKey','crunchyroll:episode:'||ep,'seasonKey','crunchyroll:season:SS',
'itemKind','series','title','Title '||title_id,'episodeTitle','Episode '||ep,'seasonTitle','Season','seasonNumber',1,'episodeNumber',1,'artworkUrl',null,
'sourceUrl','https://www.crunchyroll.com/watch/'||ep,'currentTime',50,'duration',100,'progress',0.5,'kind','heartbeat','observedAt',obs,
'crunchyrollIdentity',jsonb_build_object('providerSeriesId',title_id,'providerSeasonIdentifier','SS','providerEpisodeIdentifier',ep,'providerContentId',ep,'audioLocale',null),
'sharedRoom',jsonb_build_object('roomId','browse-room','participantSessionId','browse-'||uid,'roomGeneration',room_gen,'sourceGeneration',source_gen));
a:=jsonb_build_object('sub',uid,'roomId','browse-room','participantSessionId','browse-'||uid,'roomGeneration',room_gen,'sourceGeneration',source_gen,'iat',floor(extract(epoch from now())));
return public.apply_watch_progress_v3(uid,e,a);
end $$;
create function pg_temp.browse(q jsonb default '{"mode":"shared"}', scope text default 'titles', uid uuid default 'bbbbbbbb-1111-4111-8111-111111111111') returns jsonb language sql as $$ select public.browse_watch_history_v3(uid,q,scope) $$;
select lives_ok($$select * from public.create_room_invite_atomic('bbbbbbbb-1111-4111-8111-111111111111',gen_random_uuid(),'browse-room',null,'aaaaaaaa-1111-4111-8111-111111111111',null)$$,'group invitation remains compatible');
select lives_ok($$select * from public.create_room_invite_atomic('bbbbbbbb-1111-4111-8111-111111111111',gen_random_uuid(),'browse-room',null,'aaaaaaaa-2222-4222-8222-222222222222',null)$$,'overlapping action preserves deduplication');
select is((select count(*) from public.room_invite_recipients r join public.room_invites i on i.id=r.invite_id where i.room_id='browse-room'),1::bigint,'overlap sends only one recipient invitation');
update public.room_invite_recipients set status='accepted',responded_at=clock_timestamp() where recipient_user_id='bbbbbbbb-2222-4222-8222-222222222222';
-- Each production request has its own transaction clock; this rollback fixture
-- simulates earlier action/acceptance transactions without waiting on time.
update public.watch_history_group_invitation_contexts set action_at=now()-interval '2 minutes',accepted_at=now()-interval '1 minute';
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111');
select is(pg_temp.browse('{"mode":"shared","groupId":"aaaaaaaa-1111-4111-8111-111111111111"}')->>'totalTitleCount','0','accepted but absent is not watching');
select pg_temp.watch('bbbbbbbb-3333-4333-8333-333333333333');
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111');
select is(pg_temp.browse('{"mode":"shared","groupId":"aaaaaaaa-1111-4111-8111-111111111111"}')->>'totalTitleCount','0','ordinary link viewer does not establish group context');
select pg_temp.watch('bbbbbbbb-2222-4222-8222-222222222222');
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111');
select is(pg_temp.browse('{"mode":"shared","groupId":"aaaaaaaa-1111-4111-8111-111111111111"}')->>'totalTitleCount','1','actual overlapping recipient establishes group context');
select is(pg_temp.browse('{"mode":"shared","groupId":"aaaaaaaa-2222-4222-8222-222222222222"}')->>'totalTitleCount','1','overlapping groups find the same distinct title');
select is(pg_temp.browse('{"mode":"shared"}')->>'totalTitleCount','1','overlapping provenance does not duplicate titles');
select is(pg_temp.browse('{"mode":"shared","groupId":"aaaaaaaa-1111-4111-8111-111111111111"}','titles','bbbbbbbb-2222-4222-8222-222222222222')->>'totalTitleCount','0','group owner privacy');
select is(pg_temp.browse('{"mode":"shared"}','titles','bbbbbbbb-4444-4444-8444-444444444444')->>'totalTitleCount','0','stranger cannot read owner history');
update public.friend_groups set name='Renamed' where id='aaaaaaaa-1111-4111-8111-111111111111';
select is((select group_name from public.watch_history_session_groups where group_id='aaaaaaaa-1111-4111-8111-111111111111' limit 1),'Original group','historical name is immutable');
delete from public.friend_groups where id='aaaaaaaa-1111-4111-8111-111111111111';
select is(pg_temp.browse('{"mode":"shared","groupId":"aaaaaaaa-1111-4111-8111-111111111111"}')->>'totalTitleCount','1','deleting group retains history');
select throws_ok($$select pg_temp.browse('{"mode":"solo","groupId":"aaaaaaaa-1111-4111-8111-111111111111"}')$$,'22023','watch_history_browse_invalid','SQL rejects incompatible social filters');
select throws_ok($$select pg_temp.browse('{"mode":"shared","from":"2026-09-05T00:00:00Z","until":"2026-09-04T00:00:00Z"}')$$,'22023','watch_history_browse_invalid','SQL rejects reversed dates');

-- Late uploads carry their original observed clock; receiving them after an
-- invitation cannot relabel earlier viewing, even when both people watched.
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','EARLY',2,now()-interval '1 hour');
select pg_temp.watch('bbbbbbbb-2222-4222-8222-222222222222','EARLY',2,now()-interval '1 hour');
select is((select count(*) from public.watch_history_session_groups g join public.watch_sessions s on s.id=g.session_id where s.episode_key='crunchyroll:episode:EARLY'),0::bigint,'delayed upload before action and acceptance cannot establish provenance');
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','LATER',3,now()-interval '20 seconds');
select pg_temp.watch('bbbbbbbb-2222-4222-8222-222222222222','LATER',3,now()-interval '20 seconds');
select is((select count(*) from public.watch_history_session_groups g join public.watch_sessions s on s.id=g.session_id where s.episode_key='crunchyroll:episode:LATER'),2::bigint,'later source in same verified generation retains both group contexts');
select is(pg_temp.browse(jsonb_build_object('mode','shared','groupId','aaaaaaaa-1111-4111-8111-111111111111','participantUserId','bbbbbbbb-3333-4333-8333-333333333333','from',now()-interval '21 seconds','until',now()-interval '19 seconds'))->>'totalTitleCount','0','group participant and dates must match the same session');
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','NEWGEN',1,now(),'S',2);
select pg_temp.watch('bbbbbbbb-2222-4222-8222-222222222222','NEWGEN',1,now(),'S',2);
select is((select count(*) from public.watch_history_session_groups g join public.watch_sessions s on s.id=g.session_id where s.episode_key='crunchyroll:episode:NEWGEN'),0::bigint,'bound invitation cannot cross room generation');

-- Already accepted recipient stays deduplicated and cannot acquire a later
-- group association merely because the host sends another action.
insert into public.friend_groups(id,owner_user_id,name) values('aaaaaaaa-3333-4333-8333-333333333333','bbbbbbbb-1111-4111-8111-111111111111','Too late');
insert into public.friend_group_members values('aaaaaaaa-3333-4333-8333-333333333333','bbbbbbbb-2222-4222-8222-222222222222',now());
select * from public.create_room_invite_atomic('bbbbbbbb-1111-4111-8111-111111111111',gen_random_uuid(),'browse-room',null,'aaaaaaaa-3333-4333-8333-333333333333',null);
select is((select count(*) from public.watch_history_group_invitation_contexts where group_id='aaaaaaaa-3333-4333-8333-333333333333'),0::bigint,'repeated accepted recipient has no retroactive action context');

select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','OLD',30,now()-interval '50 seconds');
select pg_temp.watch('bbbbbbbb-3333-4333-8333-333333333333','OLD',30,now()-interval '50 seconds');
do $$begin for n in 31..55 loop perform pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','OLD',n,now()-interval '10 seconds'); end loop; end $$;
select is(pg_temp.browse('{"mode":"shared","provider":"crunchyroll","titleKey":"crunchyroll:series:S","episodeKey":"crunchyroll:episode:OLD","participantUserId":"bbbbbbbb-3333-4333-8333-333333333333"}','sessions')->>'totalSessionCount','1','matching session older than twenty is discoverable');
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','OLD',30,now()-interval '5 seconds');
do $$begin for n in 60..71 loop perform pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','E'||n,n); end loop; end $$;
select ok(exists(select 1 from jsonb_array_elements(pg_temp.browse('{"mode":"shared","provider":"crunchyroll","titleKey":"crunchyroll:series:S","groupId":"aaaaaaaa-1111-4111-8111-111111111111"}','episodes')->'matches') m where m->>'episodeKey'='crunchyroll:episode:LATER'),'matching episode older than eight is discoverable');
do $$begin for n in 100..125 loop perform pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','E'||n,n,now(),'T'||n); end loop; end $$;
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','TARGET',130,now()-interval '30 seconds','TARGET');
select pg_temp.watch('bbbbbbbb-2222-4222-8222-222222222222','TARGET',130,now()-interval '30 seconds','TARGET');
select is(pg_temp.browse('{"mode":"shared","search":"Title TARGET","limit":1}')->>'totalTitleCount','1','search finds matching title beyond the first page');
select is(pg_temp.browse('{"mode":"shared","search":"%"}')->>'totalTitleCount','0','search treats SQL wildcards literally');

create temporary table pages(name text primary key,payload jsonb);
insert into pages values('titles',pg_temp.browse('{"mode":"shared","limit":1}'));
insert into pages select 'titles2',pg_temp.browse(jsonb_build_object('mode','shared','limit',1,'cursor',payload->>'nextCursor')) from pages where name='titles';
select isnt((select payload#>>'{matches,0,titleKey}' from pages where name='titles'),(select payload#>>'{matches,0,titleKey}' from pages where name='titles2'),'keyset title continuation has no duplicate');
select throws_ok(format('select pg_temp.browse(%L::jsonb)',jsonb_build_object('mode','shared','search','different','limit',1,'cursor',payload->>'nextCursor')),'22023','watch_history_browse_cursor_invalid','cursor is filter-bound') from pages where name='titles';
select throws_ok(format('select pg_temp.browse(%L::jsonb,''titles'',''bbbbbbbb-2222-4222-8222-222222222222'')',jsonb_build_object('mode','shared','limit',1,'cursor',payload->>'nextCursor')),'22023','watch_history_browse_cursor_invalid','cursor is owner-bound') from pages where name='titles';
insert into pages values('episodes',pg_temp.browse('{"mode":"shared","provider":"crunchyroll","titleKey":"crunchyroll:series:S","limit":1}','episodes'));
select isnt(payload#>>'{matches,0,episodeKey}',pg_temp.browse(jsonb_build_object('mode','shared','provider','crunchyroll','titleKey','crunchyroll:series:S','limit',1,'cursor',payload->>'nextCursor'),'episodes')#>>'{matches,0,episodeKey}','episode continuation has no duplicate') from pages where name='episodes';
insert into pages values('sessions',pg_temp.browse('{"mode":"shared","provider":"crunchyroll","titleKey":"crunchyroll:series:S","episodeKey":"crunchyroll:episode:OLD","limit":20}','sessions'));
select is(jsonb_array_length(payload->'sessionIds'),20,'session page is bounded') from pages where name='sessions';
select is(jsonb_array_length(pg_temp.browse(jsonb_build_object('mode','shared','provider','crunchyroll','titleKey','crunchyroll:series:S','episodeKey','crunchyroll:episode:OLD','limit',20,'cursor',payload->>'nextCursor'),'sessions')->'sessionIds'),6,'session continuation exposes remaining older sessions') from pages where name='sessions';
select ok(not exists(select 1 from pages p,jsonb_array_elements_text(p.payload->'sessionIds') a,jsonb_array_elements_text(pg_temp.browse(jsonb_build_object('mode','shared','provider','crunchyroll','titleKey','crunchyroll:series:S','episodeKey','crunchyroll:episode:OLD','limit',20,'cursor',p.payload->>'nextCursor'),'sessions')->'sessionIds') b where p.name='sessions' and a=b),'session pages do not duplicate');
insert into pages values('options',pg_temp.browse('{"mode":"shared","limit":1}','options'));
select ok(payload->>'nextCursor' is not null,'options disclose bounded continuation') from pages where name='options';
select ok(exists(select 1 from jsonb_array_elements(pg_temp.browse('{"mode":"shared"}','options')->'options') o where o->>'id'='aaaaaaaa-1111-4111-8111-111111111111' and o->>'label'='Original group'),'options retain deleted historical group independently of cards');
select is((pg_temp.browse('{"mode":"shared","groupId":"aaaaaaaa-1111-4111-8111-111111111111"}')->'titleSummaries'->0->>'observedEpisodeCount'),(select observed_episode_count::text from public.watch_history_title_summaries where user_id='bbbbbbbb-1111-4111-8111-111111111111' and title_key='crunchyroll:series:S'),'filters preserve global observed count');

-- SQL permission checks are independent of API authentication.

-- Receipt acknowledgements are returned unchanged by the canonical writer,
-- including their originally false duplicate flag. Replays must add no evidence.
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','REPLAY',777,now()-interval '90 seconds','S',1,'cccccccc-1111-4111-8111-111111111111');
select pg_temp.watch('bbbbbbbb-2222-4222-8222-222222222222','REPLAY',777,now()-interval '90 seconds','S',1,'cccccccc-2222-4222-8222-222222222222');
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','REPLAY',777,now()-interval '30 seconds');
select is(pg_temp.watch('bbbbbbbb-2222-4222-8222-222222222222','REPLAY',777,now()-interval '30 seconds','S',1,'cccccccc-2222-4222-8222-222222222222')->>'duplicate','false','canonical replay acknowledgement stays compatible');
select is((select o.last_observed_at from public.watch_history_session_observations o join public.watch_sessions s on s.id=o.session_id where o.user_id='bbbbbbbb-2222-4222-8222-222222222222' and s.episode_key='crunchyroll:episode:REPLAY'),now()-interval '90 seconds','changed observedAt replay cannot extend original observation bounds');
select is((select count(*) from public.watch_history_session_groups g join public.watch_sessions s on s.id=g.session_id where s.episode_key='crunchyroll:episode:REPLAY'),0::bigint,'changed observedAt replay cannot create group provenance');
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','REPLAY_DEST',778,now()-interval '80 seconds');
select pg_temp.watch('bbbbbbbb-2222-4222-8222-222222222222','REPLAY_DEST',778,now()-interval '80 seconds');
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','REPLAY_DEST',778,now()-interval '20 seconds');
select pg_temp.watch('bbbbbbbb-2222-4222-8222-222222222222','REPLAY_DEST',778,now()-interval '20 seconds','S',1,'cccccccc-2222-4222-8222-222222222222');
select is((select o.last_observed_at from public.watch_history_session_observations o join public.watch_sessions s on s.id=o.session_id where o.user_id='bbbbbbbb-2222-4222-8222-222222222222' and s.episode_key='crunchyroll:episode:REPLAY_DEST'),now()-interval '80 seconds','changed session identity replay cannot modify another session evidence');
select is((select count(*) from public.watch_history_session_groups g join public.watch_sessions s on s.id=g.session_id where s.episode_key='crunchyroll:episode:REPLAY_DEST'),0::bigint,'changed session identity replay cannot attribute another session');

-- One action has one verified generation, even when different recipients first
-- provide real evidence in different room generations.
insert into public.users(id,email,display_name) values
('bbbbbbbb-5555-4555-8555-555555555555','browse-action-a@example.test','Action A'),
('bbbbbbbb-6666-4666-8666-666666666666','browse-action-b@example.test','Action B');
insert into public.friendships(requester_user_id,addressee_user_id,status) values
('bbbbbbbb-1111-4111-8111-111111111111','bbbbbbbb-5555-4555-8555-555555555555','accepted'),
('bbbbbbbb-1111-4111-8111-111111111111','bbbbbbbb-6666-4666-8666-666666666666','accepted');
insert into public.friend_groups(id,owner_user_id,name) values('aaaaaaaa-4444-4444-8444-444444444444','bbbbbbbb-1111-4111-8111-111111111111','One action');
insert into public.friend_group_members(group_id,friend_user_id) values
('aaaaaaaa-4444-4444-8444-444444444444','bbbbbbbb-5555-4555-8555-555555555555'),
('aaaaaaaa-4444-4444-8444-444444444444','bbbbbbbb-6666-4666-8666-666666666666');
insert into public.room_members(room_id,user_id,joined_at) values
('browse-room','bbbbbbbb-5555-4555-8555-555555555555',now()-interval '2 hours'),
('browse-room','bbbbbbbb-6666-4666-8666-666666666666',now()-interval '2 hours');
select * from public.create_room_invite_atomic('bbbbbbbb-1111-4111-8111-111111111111','dddddddd-1111-4111-8111-111111111111','browse-room',null,'aaaaaaaa-4444-4444-8444-444444444444',null);
update public.room_invite_recipients set status='accepted',responded_at=now() where recipient_user_id in ('bbbbbbbb-5555-4555-8555-555555555555','bbbbbbbb-6666-4666-8666-666666666666');
update public.watch_history_group_invitation_contexts set action_at=now()-interval '2 minutes',accepted_at=now()-interval '1 minute' where group_id='aaaaaaaa-4444-4444-8444-444444444444';
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','MULTI_A',1001,now(),'S',10);
select pg_temp.watch('bbbbbbbb-5555-4555-8555-555555555555','MULTI_A',1001,now(),'S',10);
select is((select count(*) from public.watch_history_group_invitation_contexts where client_action_id='dddddddd-1111-4111-8111-111111111111' and room_generation=10),2::bigint,'first qualifying recipient binds every context of the action');
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','MULTI_B',1001,now(),'S',11);
select pg_temp.watch('bbbbbbbb-6666-4666-8666-666666666666','MULTI_B',1001,now(),'S',11);
select is((select count(*) from public.watch_history_session_groups g join public.watch_sessions s on s.id=g.session_id where g.group_id='aaaaaaaa-4444-4444-8444-444444444444' and s.room_generation=11),0::bigint,'another recipient cannot qualify the same action in another generation');
select is((select count(distinct room_generation) from public.watch_history_group_invitation_contexts where client_action_id='dddddddd-1111-4111-8111-111111111111'),1::bigint,'action generation remains immutable across recipients');

select ok(not has_function_privilege('authenticated','public.browse_watch_history_v3(uuid,jsonb,text)','EXECUTE'),'authenticated cannot impersonate RPC owner');
select ok(not has_table_privilege('anon','public.watch_history_session_groups','SELECT'),'anonymous cannot read provenance');
select ok((select not prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid='public.browse_watch_history_v3(uuid,jsonb,text)'::regprocedure),'browse uses invoker and empty search_path');
set local role service_role;
select lives_ok($$select public.browse_watch_history_v3('bbbbbbbb-1111-4111-8111-111111111111','{"mode":"shared"}','titles')$$,'real service role can execute browse');
select lives_ok($$select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','SERVICE',999)$$,'real service role can record observed evidence through canonical wrapper');
reset role;

select public.delete_watch_history_v3('bbbbbbbb-1111-4111-8111-111111111111',jsonb_build_object('schemaVersion',3,'accountGeneration',1,'clientMutationId',gen_random_uuid(),'requestedAt',now(),'target',jsonb_build_object('scope','all')));
select is((select count(*) from public.watch_history_session_groups where owner_user_id='bbbbbbbb-1111-4111-8111-111111111111'),0::bigint,'clearing owner history deletes only owner associations');
select throws_ok(format('select pg_temp.browse(%L::jsonb)',jsonb_build_object('mode','shared','limit',1,'cursor',payload->>'nextCursor')),'22023','watch_history_browse_cursor_invalid','cursor is generation-bound') from pages where name='titles';
select throws_ok($$select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','LATER',3,now()-interval '20 seconds')$$,'P0001','watch_history_generation_mismatch','old delayed checkpoints cannot resurrect cleared provenance');
-- Simulate a fresh request after the preceding deletion transaction while the
-- pgTAP fixture keeps all its changes in one rollback transaction.
update public.watch_history_deletions set deleted_at=now()-interval '1 second' where user_id='bbbbbbbb-1111-4111-8111-111111111111';
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','REPLAY_DEST',778,now(),'S',1,gen_random_uuid(),2);
select pg_temp.watch('bbbbbbbb-1111-4111-8111-111111111111','REPLAY_DEST',778,now()-interval '10 seconds','S',1,'cccccccc-1111-4111-8111-111111111111',2);
select is((select o.history_generation from public.watch_history_session_observations o join public.watch_sessions s on s.id=o.session_id where o.user_id='bbbbbbbb-1111-4111-8111-111111111111' and s.episode_key='crunchyroll:episode:REPLAY_DEST'),2::bigint,'pre-deletion receipt cannot replace fresh generation evidence');
select is((select o.last_observed_at from public.watch_history_session_observations o join public.watch_sessions s on s.id=o.session_id where o.user_id='bbbbbbbb-1111-4111-8111-111111111111' and s.episode_key='crunchyroll:episode:REPLAY_DEST'),now(),'pre-deletion replay leaves fresh observation bounds intact');
select * from finish();
rollback;
