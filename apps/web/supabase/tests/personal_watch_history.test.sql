begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='15s';
set local lock_timeout='3s';
select no_plan();
select has_function('public','apply_personal_watch_progress_v1',array['uuid','jsonb'],'personal writer exists');
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
    'duration', 1800,
    'progress', current_seconds / 1800,
    'observedAt', observed_at,
    'kind', event_kind,
    'sharedRoom', shared_room
  );
$$;
insert into users(id,email,display_name) values
 ('a3111111-1111-4111-8111-111111111111','personal-host@example.test','Free Host'),
 ('a3222222-2222-4222-8222-222222222222','personal-a@example.test','Plus Guest'),
 ('a3333333-3333-4333-8333-333333333333','personal-b@example.test','Pro Guest');
insert into account_manual_plan_grants(user_id,plan_code,reason) values
 ('a3222222-2222-4222-8222-222222222222','plus','test'),('a3333333-3333-4333-8333-333333333333','pro','test');
create temporary table personal_test_input(owner uuid primary key,body jsonb);
insert into personal_test_input
 select u.id,jsonb_build_object('captureVersion',1,'accessEpoch',r.a#>'{history,accessEpoch}', 'youtubeConsentEpoch',r.a#>'{history,youtubeConsentEpoch}', 'clientSequence',1,
 'event',pg_temp.watch_v3_event(gen_random_uuid(),'own-player',clock_timestamp(),case when u.display_name='Plus Guest' then 1080 else 1440 end,1,null,
 'crunchyroll:episode:episode-five','crunchyroll:series:series-one',case when u.display_name='Pro Guest' then 'ended' else 'heartbeat' end)-'sharedRoom')
 from users u cross join lateral(select resolve_watch_history_access_v1(u.id) a)r where u.id in ('a3111111-1111-4111-8111-111111111111','a3222222-2222-4222-8222-222222222222','a3333333-3333-4333-8333-333333333333');
select throws_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3111111-1111-4111-8111-111111111111'$$,'P0001','HISTORY_PLAN_REQUIRED','Free host cannot write even inactive');
select lives_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3222222-2222-4222-8222-222222222222'$$,'Plus guest independent checkpoint without host session');
select lives_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3333333-3333-4333-8333-333333333333'$$,'Pro guest independent completion without host session');
select is((select current_time_seconds::int from watch_episode_progress where user_id='a3222222-2222-4222-8222-222222222222'),1080,'A own E5 1080');
select ok((select completed_at is not null from watch_episode_progress where user_id='a3333333-3333-4333-8333-333333333333'),'B ended remains completed');
select is((select count(*)::int from watch_episode_progress where user_id='a3111111-1111-4111-8111-111111111111'),0,'H no checkpoints');
select is((select count(*)::int from watch_sessions where host_user_id in(select owner from personal_test_input) and room_id is not null),0,'personal writer never creates shared session');
select lives_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3222222-2222-4222-8222-222222222222'$$,'exact retry accepted');
select lives_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3222222-2222-4222-8222-222222222222'$$,'second retry accepted');
select is((select count(*)::int from watch_history_receipts where user_id='a3222222-2222-4222-8222-222222222222'),1,'one receipt across retries');
select throws_ok($$select apply_personal_watch_progress_v1(owner,jsonb_set(body,'{event,currentTime}','999')) from personal_test_input where owner='a3222222-2222-4222-8222-222222222222'$$,'P0001','watch_history_client_id_conflict','mutated same event id rejected');
select lives_ok($$select apply_personal_watch_progress_v1(owner,jsonb_set(jsonb_set(jsonb_set(jsonb_set(body || jsonb_build_object('event',(body->'event')||jsonb_build_object('kind','heartbeat','progress',0.1)),'{clientSequence}','2'),'{event,clientEventId}',to_jsonb(gen_random_uuid())),'{event,currentTime}','120'),'{event,observedAt}',to_jsonb(clock_timestamp()))) from personal_test_input where owner='a3333333-3333-4333-8333-333333333333'$$,'later own rewatch moves Resume backward');
select is((select current_time_seconds::int from watch_episode_progress where user_id='a3333333-3333-4333-8333-333333333333'),120,'Resume uses latest own time, never max');
select ok((select completed_at is not null from watch_episode_progress where user_id='a3333333-3333-4333-8333-333333333333'),'completion sticky');
select lives_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3333333-3333-4333-8333-333333333333'$$,'old exact receipt after higher sequence remains idempotent');
select throws_ok($$select apply_personal_watch_progress_v1(owner,jsonb_set(body,'{event,clientEventId}',to_jsonb(gen_random_uuid()))) from personal_test_input where owner='a3333333-3333-4333-8333-333333333333'$$,'P0001','watch_history_observation_stale','new id with stale sequence rejected');
-- Historical solo and shared records are preserved; private policy starts inactive.
select is((select active from personal_history_policy),false,'migration prerequisite starts inactive');
create temporary table preserved_rows as select to_jsonb(p) value from watch_episode_progress p where user_id in(select owner from personal_test_input);
update personal_history_policy set active=true;
select is((select count(*)::int from preserved_rows p join watch_episode_progress e on p.value=to_jsonb(e)),2,'activation preserves populated rows exactly');
select throws_ok($$select apply_watch_progress_v3(owner,body->'event',null) from personal_test_input where owner='a3222222-2222-4222-8222-222222222222'$$,'P0001','HISTORY_CLIENT_UPDATE_REQUIRED','legacy wrapper replay terminal after activation');
select throws_ok($$select apply_watch_progress_v3_canonical(owner,body->'event',null) from personal_test_input where owner='a3222222-2222-4222-8222-222222222222'$$,'P0001','HISTORY_CLIENT_UPDATE_REQUIRED','canonical public alias terminal');
select ok(not has_schema_privilege('service_role','anidachi_history_private','USAGE'),'service role cannot reach internal core schema');
select ok(not has_function_privilege('service_role','anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)','EXECUTE'),'service role cannot execute internal core');
select lives_ok($$select browse_watch_history_v3('a3111111-1111-4111-8111-111111111111','{"mode":"personal"}')$$,'Free browse allowed');
select lives_ok($$select list_watch_history_v3_bounded_page('a3111111-1111-4111-8111-111111111111',1,20)$$,'Free bounded list allowed');
select lives_ok($$select list_watch_history_v3_title_episodes_page('a3111111-1111-4111-8111-111111111111',1,'crunchyroll','crunchyroll:series:series-one')$$,'Free detail allowed');
select lives_ok($$select set_watch_preferences_v3('a3111111-1111-4111-8111-111111111111','{"youtubeHistoryEnabled":true}')$$,'Free explicit consent on allowed');
select lives_ok($$select set_watch_preferences_v3('a3111111-1111-4111-8111-111111111111','{"youtubeHistoryEnabled":false}')$$,'Free explicit consent off allowed');
select lives_ok($$select browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal"}')$$,'paid personal browse works');
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal"}')->>'totalTitleCount')::int,1,'personal browse canonical title count');
select lives_ok($$select set_watch_preferences_v3('a3222222-2222-4222-8222-222222222222','{"youtubeHistoryEnabled":true}')$$,'enable YouTube');
select lives_ok($$select set_watch_preferences_v3('a3222222-2222-4222-8222-222222222222','{"youtubeHistoryEnabled":false}')$$,'disable YouTube');
select is((select youtube_consent_epoch::int from user_watch_settings where user_id='a3222222-2222-4222-8222-222222222222'),2,'each consent transition increments epoch');
select lives_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3222222-2222-4222-8222-222222222222'$$,'YouTube changes do not reject eligible Crunchyroll receipt');

select set_watch_preferences_v3('a3222222-2222-4222-8222-222222222222','{"youtubeHistoryEnabled":true}');
create temporary table old_youtube as select owner,body||jsonb_build_object('youtubeConsentEpoch',3,'event',((body->'event')-'crunchyrollIdentity')||jsonb_build_object('provider','youtube','youtubeVideoId','abcdefghijk','titleKey','youtube:video:abcdefghijk','episodeKey','youtube:video:abcdefghijk','sourceUrl','https://www.youtube.com/watch?v=abcdefghijk','itemKind','movie','seasonKey',null,'seasonTitle',null,'seasonNumber',null,'episodeNumber',null,'clientEventId',gen_random_uuid(),'clientSessionKey','youtube-before-consent')) body from personal_test_input where owner='a3222222-2222-4222-8222-222222222222';
select throws_ok($$select apply_personal_watch_progress_v1(owner,body) from old_youtube$$,'P0001','HISTORY_ACCESS_CHANGED','new consent epoch cannot reissue an old pre-consent event');
select throws_ok($$select apply_personal_watch_progress_v1(owner,jsonb_set(jsonb_set(body,'{youtubeConsentEpoch}','0'),'{event,observedAt}',to_jsonb(clock_timestamp()))) from old_youtube$$,'P0001','HISTORY_ACCESS_CHANGED','old consent epoch cannot authorize fresh YouTube capture');
select set_watch_preferences_v3('a3222222-2222-4222-8222-222222222222','{"youtubeHistoryEnabled":true}');
select is((select youtube_consent_epoch::int from user_watch_settings where user_id='a3222222-2222-4222-8222-222222222222'),3,'saving same consent does not rotate epoch');
select lives_ok($$select delete_watch_history_v3('a3222222-2222-4222-8222-222222222222',jsonb_build_object('schemaVersion',3,'clientMutationId',gen_random_uuid(),'accountGeneration',1,'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','episode','provider','crunchyroll','titleKey','crunchyroll:series:series-one','episodeKey','crunchyroll:episode:episode-five')))$$,'delete A E5');
update watch_history_deletions set deleted_at=clock_timestamp() where user_id='a3222222-2222-4222-8222-222222222222';
select throws_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3222222-2222-4222-8222-222222222222'$$,'P0001','watch_history_deleted','old accepted envelope cannot resurrect deleted episode');
select is((select count(*)::int from watch_episode_progress where user_id='a3222222-2222-4222-8222-222222222222'),0,'deleted episode stays absent');
select ok((select count(*)>0 from personal_watch_sequences where user_id='a3222222-2222-4222-8222-222222222222'),'partial delete retains ordering for remaining playback');
delete from account_manual_plan_grants where user_id='a3333333-3333-4333-8333-333333333333';
-- A trusted known Free transition retains the grant row with elapsed validity.
insert into account_manual_plan_grants(user_id,plan_code,reason,valid_until) values('a3333333-3333-4333-8333-333333333333','pro','test',clock_timestamp()-interval '1 second');
select throws_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3333333-3333-4333-8333-333333333333'$$,'P0001','HISTORY_PLAN_REQUIRED','receipt denied after expiry');
select is((select current_time_seconds::int from watch_episode_progress where user_id='a3333333-3333-4333-8333-333333333333'),120,'expiry preserves own history');
select is((browse_watch_history_v3('a3333333-3333-4333-8333-333333333333','{"mode":"personal"}')->>'totalTitleCount')::int,1,'expired subscriber can browse saved title');
select lives_ok($$select list_watch_history_v3_bounded_page('a3333333-3333-4333-8333-333333333333',1,20)$$,'expired subscriber can read canonical saved rows');
select lives_ok($$select list_watch_history_v3_title_episodes_page('a3333333-3333-4333-8333-333333333333',1,'crunchyroll','crunchyroll:series:series-one')$$,'expired subscriber can read saved episode detail');
select is((select current_time_seconds::int from watch_episode_progress where user_id='a3333333-3333-4333-8333-333333333333'),120,'reads do not advance saved progress');

set local role service_role;
select lives_ok($$select delete_watch_history_v3('a3333333-3333-4333-8333-333333333333',jsonb_build_object('schemaVersion',3,'clientMutationId',gen_random_uuid(),'accountGeneration',1,'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','all')))$$,'Free delete-all permitted');
set local role postgres;
select is((select count(*)::int from personal_watch_sequences where user_id='a3333333-3333-4333-8333-333333333333'),0,'delete-all removes own ordering keys');
select ok((select count(*)>0 from personal_watch_sequences where user_id='a3222222-2222-4222-8222-222222222222'),'delete-all preserves other owner ordering');
insert into users(id,email,display_name) values('a3444444-4444-4444-8444-444444444444','personal-cascade@example.test','Cascade');
insert into personal_watch_sequences values('a3444444-4444-4444-8444-444444444444',1,1,'cascade-ordering',1);
delete from users where id='a3444444-4444-4444-8444-444444444444';
select is((select count(*)::int from personal_watch_sequences where user_id='a3444444-4444-4444-8444-444444444444'),0,'account FK cascade removes ordering keys');


-- Mixed historical data: populate via real inactive legacy RPCs, then activate.
update personal_history_policy set active=false;
insert into rooms(room_id,host_user_id,created_at) values('personal-old-room','a3111111-1111-4111-8111-111111111111',now()-interval '2 hours');
insert into room_members(room_id,user_id,joined_at) values('personal-old-room','a3222222-2222-4222-8222-222222222222',now()-interval '2 hours');
create function pg_temp.legacy_watch(uid uuid, ep text default 'E1', source_gen int default 1, obs timestamptz default clock_timestamp(), title_id text default 'S', room_gen int default 1, event_id uuid default gen_random_uuid(), account_gen bigint default 1, episode_label text default null) returns jsonb language plpgsql as $$
declare e jsonb; a jsonb;
begin
e:=jsonb_build_object('schemaVersion',3,'clientEventId',event_id,'clientSessionKey','browse-'||uid||'-'||ep,'accountGeneration',account_gen,
'provider','crunchyroll','titleKey','crunchyroll:series:'||title_id,'episodeKey','crunchyroll:episode:'||ep,'seasonKey','crunchyroll:season:SS',
'itemKind','series','title','Title '||title_id,'episodeTitle',coalesce(episode_label,'Episode '||ep),'seasonTitle','Season','seasonNumber',1,'episodeNumber',1,'artworkUrl',null,
'sourceUrl','https://www.crunchyroll.com/watch/'||ep,'currentTime',case when uid='a3111111-1111-4111-8111-111111111111'::uuid then 900 else 120 end,'duration',1800,'progress',0.5,'kind','heartbeat','observedAt',obs,
'crunchyrollIdentity',jsonb_build_object('providerSeriesId',title_id,'providerSeasonIdentifier','SS','providerEpisodeIdentifier',ep,'providerContentId',ep,'audioLocale',null),
'sharedRoom',jsonb_build_object('roomId','personal-old-room','participantSessionId','browse-'||uid,'roomGeneration',room_gen,'sourceGeneration',source_gen));
a:=jsonb_build_object('sub',uid,'roomId','personal-old-room','participantSessionId','browse-'||uid,'roomGeneration',room_gen,'sourceGeneration',source_gen,'iat',floor(extract(epoch from now())));
return public.apply_watch_progress_v3(uid,e,a);
end $$;
select pg_temp.legacy_watch('a3111111-1111-4111-8111-111111111111','OLD',1,now()-interval '50 seconds','HISTORICAL');
select pg_temp.legacy_watch('a3222222-2222-4222-8222-222222222222','OLD',1,now()-interval '50 seconds','HISTORICAL');
select pg_temp.legacy_watch('a3111111-1111-4111-8111-111111111111','OLD',1,now()-interval '10 seconds','HISTORICAL');
select pg_temp.legacy_watch('a3111111-1111-4111-8111-111111111111','NEXT',2,now(),'HISTORICAL');
select apply_watch_progress_v3('a3222222-2222-4222-8222-222222222222',pg_temp.watch_v3_event(gen_random_uuid(),'historical-solo',now(),200,1,null,'crunchyroll:episode:solo','crunchyroll:series:solo'),null);
create temporary table saved_mixed as select to_jsonb(ep) value from watch_episode_progress ep where user_id='a3222222-2222-4222-8222-222222222222';
update personal_history_policy set active=true;
select is((select count(*)::int from saved_mixed m join watch_episode_progress ep on m.value=to_jsonb(ep)),2,'mixed history activation byte-for-byte preservation');
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal","limit":1}')->>'totalTitleCount')::int,2,'both sources selected before limit one');
create temporary table mixed_page as select browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal","limit":1}') value;
select ok((select value->>'nextCursor' is not null from mixed_page),'mixed page has continuation');
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222',jsonb_build_object('mode','personal','limit',1,'cursor',(select value->>'nextCursor' from mixed_page)))->>'totalTitleCount')::int,2,'second page retains both-source count');
select isnt(browse_watch_history_v3('a3222222-2222-4222-8222-222222222222',jsonb_build_object('mode','personal','limit',1,'cursor',(select value->>'nextCursor' from mixed_page)))#>>'{matches,0,titleKey}',(select value#>>'{matches,0,titleKey}' from mixed_page),'stable cursor visits another title');
select throws_ok($$select browse_watch_history_v3('a3222222-2222-4222-8222-222222222222',jsonb_build_object('mode','personal','search','different','limit',1,'cursor',(select value->>'nextCursor' from mixed_page)))$$,'22023','watch_history_browse_cursor_invalid','cursor bound to filters');
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222',jsonb_build_object('mode','personal','from',now()-interval '51 seconds','until',now()-interval '49 seconds')))->>'totalTitleCount','1','date filter follows own shared observation');
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222',jsonb_build_object('mode','personal','from',now()-interval '11 seconds','until',now()-interval '9 seconds')))->>'totalTitleCount','0','host later checkpoint does not change guest date');
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal","search":"ePiSoDe OLD"}')->>'totalTitleCount')::int,1,'episode title search before pagination');
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal","search":"HISTORICAL"}')->>'totalTitleCount')::int,1,'title search before pagination');
select is((list_watch_history_v3_title_episodes_page('a3222222-2222-4222-8222-222222222222',1,'crunchyroll','crunchyroll:series:HISTORICAL')#>>'{progressRows,0,current_time_seconds}')::int,120,'detail Resume is guest own historical position');
select is((list_watch_history_v3_bounded_page('a3222222-2222-4222-8222-222222222222',1,50)->>'totalTitleCount')::int,2,'ordinary list and browse agree across sources');
-- No reconstructed host date when pre-observation historical rows lack ledger.
delete from watch_history_session_observations where user_id='a3222222-2222-4222-8222-222222222222';
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222',jsonb_build_object('mode','personal','from',now()-interval '11 seconds','until',now()-interval '9 seconds')))->>'totalTitleCount','0','older historical fallback never uses host clock');
create function pg_temp.request() returns jsonb language sql as $$
select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','crunchyroll','titleKey','crunchyroll:series:S','providerSeriesId','S',
  'context',jsonb_build_object('region','US','requestedLocale','ja-JP','audioLocale','ja-JP','subtitleLocales','[]'::jsonb,'observedAt',clock_timestamp()));
$$;
create function pg_temp.snapshot(ctx jsonb) returns jsonb language sql as $$
select jsonb_build_object('schemaVersion',3,'provider','crunchyroll','titleKey','crunchyroll:series:S','providerSeriesId','S','title','Localized catalog','completeness','complete','context',ctx,
  'seasons',jsonb_build_array(jsonb_build_object('seasonKey','crunchyroll:season:SS','providerSeasonIdentifier','SS','title','Localized season','seasonNumber',1,'order',0,
    'episodes',jsonb_build_array(jsonb_build_object('episodeKey','crunchyroll:episode:E','providerEpisodeIdentifier','E','title','Localized episode','episodeNumber',1,'order',0,'releasedAt',null,'available',true,
      'watchVariants',jsonb_build_array(jsonb_build_object('providerContentId','RAW_JA','audioLocale','ja-JP','original',true,'order',0,'sourceUrl','https://www.crunchyroll.com/watch/RAW_JA'),
        jsonb_build_object('providerContentId','RAW_EN','audioLocale','en-US','original',false,'order',1,'sourceUrl','https://www.crunchyroll.com/watch/RAW_EN')))))));
$$;
create temporary table personal_catalog(name text primary key,body jsonb);
insert into personal_catalog values('request',pg_temp.request()||jsonb_build_object('historyAccess',jsonb_build_object('accessVersion',1,'accessEpoch',(resolve_watch_history_access_v1('a3222222-2222-4222-8222-222222222222')#>>'{history,accessEpoch}')::bigint)));
select throws_ok($$select begin_watch_catalog_v3('a3111111-1111-4111-8111-111111111111',(select body from personal_catalog where name='request'))$$,'P0001','HISTORY_PLAN_REQUIRED','Free catalog begin denied');
select throws_ok($$select apply_watch_catalog_v3('a3111111-1111-4111-8111-111111111111',(select body from personal_catalog where name='request'))$$,'P0001','HISTORY_PLAN_REQUIRED','Free catalog commit denied');
select throws_ok($$select begin_watch_catalog_v3('a3222222-2222-4222-8222-222222222222',(select body-'historyAccess' from personal_catalog where name='request'))$$,'P0001','HISTORY_CLIENT_UPDATE_REQUIRED','active old catalog request terminal');
insert into personal_catalog values('ack',begin_watch_catalog_v3('a3222222-2222-4222-8222-222222222222',(select body from personal_catalog where name='request')));
insert into personal_catalog values('commit',(select body from personal_catalog where name='request')||jsonb_build_object('revision',(select body->'revision' from personal_catalog where name='ack'),'snapshot',pg_temp.snapshot((select body->'context' from personal_catalog where name='request'))));
select lives_ok($$select apply_watch_catalog_v3('a3222222-2222-4222-8222-222222222222',(select body from personal_catalog where name='commit'))$$,'paid epoch-bound actual catalog commit');
update account_manual_plan_grants set valid_until=clock_timestamp()-interval '1 second' where user_id='a3222222-2222-4222-8222-222222222222';
select resolve_watch_history_access_v1('a3222222-2222-4222-8222-222222222222');
update account_manual_plan_grants set valid_until=null where user_id='a3222222-2222-4222-8222-222222222222';
select resolve_watch_history_access_v1('a3222222-2222-4222-8222-222222222222');
select throws_ok($$select apply_watch_catalog_v3('a3222222-2222-4222-8222-222222222222',(select body from personal_catalog where name='commit'))$$,'P0001','HISTORY_ACCESS_CHANGED','old catalog proof rejected after Free then paid');
select throws_ok($$select apply_watch_catalog_v3('a3222222-2222-4222-8222-222222222222',jsonb_set((select body from personal_catalog where name='commit'),'{historyAccess,accessEpoch}',resolve_watch_history_access_v1('a3222222-2222-4222-8222-222222222222')#>'{history,accessEpoch}'))$$,'P0001','HISTORY_ACCESS_CHANGED','replacing client proof cannot reauthorize old durable attempt');
select throws_ok($$select apply_personal_watch_progress_v1(owner,body) from personal_test_input where owner='a3222222-2222-4222-8222-222222222222'$$,'P0001','HISTORY_ACCESS_CHANGED','old progress epoch stays invalid after paid return');

-- Bounded personal title: 56 accepted owner episodes, never a whole-history fetch.
do $$declare n int; access jsonb; input jsonb; begin
 access:=resolve_watch_history_access_v1('a3222222-2222-4222-8222-222222222222')->'history';
 for n in 1..56 loop
  input:=jsonb_build_object('captureVersion',1,'accessEpoch',access->'accessEpoch','youtubeConsentEpoch',access->'youtubeConsentEpoch','clientSequence',n,
   'event',pg_temp.watch_v3_event(gen_random_uuid(),'bounded-personal',clock_timestamp(),n,1,null,'crunchyroll:episode:bounded-'||n,'crunchyroll:series:bounded')-'sharedRoom');
  perform apply_personal_watch_progress_v1('a3222222-2222-4222-8222-222222222222',input);
 end loop;
end $$;
select is(jsonb_array_length(list_watch_history_v3_title_episodes_page('a3222222-2222-4222-8222-222222222222',1,'crunchyroll','crunchyroll:series:bounded',50)->'progressRows'),50,'personal detail retains 50 episode bound');
select is((list_watch_history_v3_title_episodes_page('a3222222-2222-4222-8222-222222222222',1,'crunchyroll','crunchyroll:series:bounded',50)->>'observedEpisodeCount')::int,56,'personal aggregate covers all 56 without full detail fetch');
select is(jsonb_array_length(browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal","provider":"crunchyroll","titleKey":"crunchyroll:series:bounded","limit":50}','episodes')->'progressRows'),50,'personal browse same bounded slice');
select throws_ok($$select browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal","provider":"crunchyroll","titleKey":"crunchyroll:series:bounded","limit":51}','episodes')$$,'22023','watch_history_browse_invalid','personal cannot expand episode page beyond 50');

-- A surviving canonical row with no session must not disappear at pagination.
delete from watch_session_participants p using watch_sessions ws where p.session_id=ws.id and p.user_id='a3222222-2222-4222-8222-222222222222' and ws.item_key='crunchyroll:series:solo';
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal","search":"Series Two","includeEpisodePreviews":true}')->>'totalTitleCount')::int,2,'canonical sessionless title remains in personal search');
select is(browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal","provider":"crunchyroll","titleKey":"crunchyroll:series:solo","includeEpisodePreviews":true}')#>'{episodePreviews,0,sessionIds}','[]'::jsonb,'orphan preview returns empty session IDs');
select is((browse_watch_history_v3('a3222222-2222-4222-8222-222222222222','{"mode":"personal","provider":"crunchyroll","titleKey":"crunchyroll:series:solo"}')->>'totalSessionCount')::int,0,'orphan canonical row invents no session');
select * from finish();
rollback;
