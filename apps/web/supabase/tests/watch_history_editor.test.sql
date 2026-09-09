begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='30s';
select no_plan();
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
 ('ed111111-1111-4111-8111-111111111111','editor-paid@example.test','Editor'),
 ('ed222222-2222-4222-8222-222222222222','editor-free@example.test','Free');
insert into account_manual_plan_grants(user_id,plan_code,reason) values ('ed111111-1111-4111-8111-111111111111','plus','test');
update personal_history_policy set active=true;
create temporary table editor_calls(name text primary key, body jsonb);
insert into editor_calls select 'capture',jsonb_build_object('captureVersion',1,'accessEpoch',a#>'{history,accessEpoch}',
 'youtubeConsentEpoch',a#>'{history,youtubeConsentEpoch}','clientSequence',1,
 'event',pg_temp.watch_v3_event(gen_random_uuid(),'editor-player',clock_timestamp(),1080)-'sharedRoom')
 from (select resolve_watch_history_access_v1('ed111111-1111-4111-8111-111111111111') a) s;
select lives_ok($$select apply_personal_watch_progress_v1('ed111111-1111-4111-8111-111111111111',body) from editor_calls where name='capture'$$,'seed real playback');
create function pg_temp.editor() returns jsonb language sql as $$
 select get_watch_history_editor_v1('ed111111-1111-4111-8111-111111111111',1,'crunchyroll','crunchyroll:series:series-one');
$$;
create function pg_temp.edit(watched boolean, keys text[] default array['crunchyroll:episode:episode-one']) returns jsonb language sql as $$
 select jsonb_build_object('accountGeneration',1,'provider','crunchyroll','titleKey','crunchyroll:series:series-one','clientMutationId',gen_random_uuid(),
 'revision',pg_temp.editor()->>'revision','changes',(select jsonb_agg(jsonb_build_object('episodeKey',key,'watched',watched)) from unnest(keys) key));
$$;
select is(jsonb_array_length(pg_temp.editor()->'episodes'),1,'partial catalog exposes saved episode');
select is(pg_temp.editor()->>'catalogComplete','false','partial catalog is labeled honestly');
insert into editor_calls values('mark',pg_temp.edit(true));
select lives_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',body) from editor_calls where name='mark'$$,'mark watched');
select is(pg_temp.editor()#>>'{episodes,0,watched}','true','completion saved');
select is(pg_temp.editor()#>>'{episodes,0,currentTime}','1800','known duration used');
select is((select count(*)::int from watch_sessions where host_user_id='ed111111-1111-4111-8111-111111111111'),1,'manual marking creates no playback session');
select ok((select latest_session_id is null from watch_episode_progress where user_id='ed111111-1111-4111-8111-111111111111'),'manual row is independent of playback session');
select lives_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',body) from editor_calls where name='mark'$$,'exact retry is idempotent');
select is((select count(*)::int from watch_history_edit_receipts where user_id='ed111111-1111-4111-8111-111111111111'),1,'one receipt');
select throws_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',jsonb_set(body,'{changes,0,watched}','false')) from editor_calls where name='mark'$$,'P0001','watch_history_client_id_conflict','id cannot change payload');
select throws_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',jsonb_set(body,'{clientMutationId}',to_jsonb(gen_random_uuid()))) from editor_calls where name='mark'$$,'P0001','HISTORY_EDIT_CONFLICT','old editor revision conflicts');
select throws_ok($$select apply_personal_watch_progress_v1('ed111111-1111-4111-8111-111111111111',body) from editor_calls where name='capture'$$,'P0001','watch_history_observation_stale','old playback receipt cannot overwrite manual mark');
select lives_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',pg_temp.edit(false))$$,'unwatch explicitly clears sticky completion');
select is(pg_temp.editor()#>>'{episodes,0,watched}','false','unwatched saved');
select is(pg_temp.editor()#>>'{episodes,0,currentTime}','0','unwatch resets Resume');
select is(get_watch_history_capacity_v1('ed111111-1111-4111-8111-111111111111')#>>'{providers,crunchyroll,used}','1','reset keeps library slot');
select throws_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',pg_temp.edit(true,array['crunchyroll:episode:episode-one','not-in-catalog']))$$,'P0001','HISTORY_EPISODE_UNAVAILABLE','whole batch fails on unknown episode');
select is(pg_temp.editor()#>>'{episodes,0,watched}','false','failed batch rolls back earlier mark');
select throws_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',pg_temp.edit(true,array['crunchyroll:episode:episode-one','crunchyroll:episode:episode-one']))$$,'P0001','HISTORY_EDIT_INVALID','duplicate changes rejected');
select throws_ok($$select edit_watch_history_v1('ed222222-2222-4222-8222-222222222222',pg_temp.edit(true))$$,'P0001','HISTORY_PLAN_REQUIRED','Free cannot edit');
select throws_ok($$select get_watch_history_editor_v1('ed222222-2222-4222-8222-222222222222',1,'crunchyroll','crunchyroll:series:series-one')$$,'P0001','HISTORY_TITLE_NOT_FOUND','other account cannot read title');
select lives_ok($$select apply_personal_watch_progress_v1('ed111111-1111-4111-8111-111111111111',jsonb_set(jsonb_set(jsonb_set(body,'{clientSequence}','2'),'{event,clientEventId}',to_jsonb(gen_random_uuid())),'{event,observedAt}',to_jsonb(clock_timestamp()))) from editor_calls where name='capture'$$,'new playback continues after edit');
select is(pg_temp.editor()#>>'{episodes,0,currentTime}','1080','new capture gets current position');

-- Use the real catalog commit path, with two seasons and an unreleased entry.
create function pg_temp.editor_catalog(total integer default 61) returns void language plpgsql as $$
declare req jsonb; ack jsonb; snap jsonb; eps jsonb;
begin
 req:=jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','crunchyroll','titleKey','crunchyroll:series:series-one','providerSeriesId','series-one',
   'historyAccess',jsonb_build_object('accessVersion',1,'accessEpoch',resolve_watch_history_access_v1('ed111111-1111-4111-8111-111111111111')#>'{history,accessEpoch}'),
   'context',jsonb_build_object('region','US','requestedLocale','en-US','audioLocale','ja-JP','subtitleLocales','[]'::jsonb,'observedAt',clock_timestamp()));
 ack:=begin_watch_catalog_v3('ed111111-1111-4111-8111-111111111111',req);
 select jsonb_agg(jsonb_build_object('episodeKey','crunchyroll:episode:E'||i,'providerEpisodeIdentifier','E'||i,'title','Episode '||i,'episodeNumber',i,'order',i-1,
   'releasedAt',case when i=total then clock_timestamp()+interval '1 day' else null end,'available',true,
   'watchVariants',jsonb_build_array(jsonb_build_object('providerContentId','RAW'||i,'audioLocale','ja-JP','original',true,'order',0,'sourceUrl','https://www.crunchyroll.com/watch/RAW'||i))) order by i) into eps from generate_series(1,total) i;
 snap:=jsonb_build_object('schemaVersion',3,'provider','crunchyroll','titleKey','crunchyroll:series:series-one','providerSeriesId','series-one','title','Series One','completeness','complete','context',req->'context',
   'seasons',jsonb_build_array(jsonb_build_object('seasonKey','crunchyroll:season:season-one','providerSeasonIdentifier','season-one','title','Season One','seasonNumber',1,'order',0,'episodes',eps)));
 perform apply_watch_catalog_v3('ed111111-1111-4111-8111-111111111111',req||jsonb_build_object('revision',ack->'revision','snapshot',snap));
end $$;
select lives_ok($$select pg_temp.editor_catalog()$$,'accept full title catalog');
select is(pg_temp.editor()->>'catalogComplete','true','full editor uses accepted catalog');
select is(jsonb_array_length(pg_temp.editor()->'episodes'),62,'all catalog episodes and retained observation are represented');
select is((select value->>'available' from jsonb_array_elements(pg_temp.editor()->'episodes') where value->>'episodeKey'='crunchyroll:episode:E61'),'false','future release disabled');
select throws_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',pg_temp.edit(true,array['crunchyroll:episode:E61']))$$,'P0001','HISTORY_EPISODE_UNAVAILABLE','future release cannot be marked');
select lives_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',pg_temp.edit(true,array(select 'crunchyroll:episode:E'||i from generate_series(1,60) i)))$$,'save 60 catalog episodes in one batch');
select is((select count(*)::int from watch_episode_progress where user_id='ed111111-1111-4111-8111-111111111111' and completed_at is not null),60,'all 60 marks persisted');
select is((select projection#>>'{aggregate,completedEpisodes}' from watch_catalog_snapshots where user_id='ed111111-1111-4111-8111-111111111111'),'60','extension aggregate sees manual marks');
select is((select count(*)::int from watch_sessions where host_user_id='ed111111-1111-4111-8111-111111111111'),1,'bulk marks did not invent sessions');
select is(get_watch_history_capacity_v1('ed111111-1111-4111-8111-111111111111')#>>'{providers,crunchyroll,used}','1','new catalog episodes do not consume title slots');
select ok((select value->>'sourceUrl'='https://www.crunchyroll.com/watch/RAW1' and value->>'episodeTitle'='Episode 1' from jsonb_array_elements(pg_temp.editor()->'episodes') where value->>'episodeKey'='crunchyroll:episode:E1'),'manual entry uses trusted canonical metadata');
-- Same editor is usable before rollout activation. Both capture paths respect
-- its fence; enabling the account UI must not force a room/runtime cutover.
update personal_history_policy set active=false;
select lives_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',pg_temp.edit(false))$$,'paid edits work before runtime activation');
select throws_ok($$select public.apply_watch_progress_v3_canonical('ed111111-1111-4111-8111-111111111111',body->'event',null) from editor_calls where name='capture'$$,'P0001','watch_history_observation_stale','legacy receipt cannot replay over manual reset');
select throws_ok($$select public.apply_watch_progress_v3_canonical('ed111111-1111-4111-8111-111111111111',jsonb_set(body->'event','{clientEventId}',to_jsonb(gen_random_uuid())),null) from editor_calls where name='capture'$$,'P0001','watch_history_observation_stale','queued legacy observation cannot overwrite reset');
select throws_ok($$select edit_watch_history_v1('ed222222-2222-4222-8222-222222222222',pg_temp.edit(true))$$,'P0001','HISTORY_PLAN_REQUIRED','Free edits remain denied before activation');
-- Simulate a later request: the legacy writer normalizes to transaction start,
-- while this pgTAP fixture deliberately keeps all operations in one transaction.
update watch_episode_progress set manual_edited_at=transaction_timestamp()-interval '1 second',observed_at=transaction_timestamp()-interval '1 second'
 where user_id='ed111111-1111-4111-8111-111111111111' and episode_key='crunchyroll:episode:episode-one';
select lives_ok($$select public.apply_watch_progress_v3_canonical('ed111111-1111-4111-8111-111111111111',jsonb_set(jsonb_set(body->'event','{clientEventId}',to_jsonb(gen_random_uuid())),'{observedAt}',to_jsonb(clock_timestamp())),null) from editor_calls where name='capture'$$,'later legacy playback continues after manual edit');
update personal_history_policy set active=true;
update account_manual_plan_grants set valid_until=clock_timestamp()-interval '1 second' where user_id='ed111111-1111-4111-8111-111111111111';
select lives_ok($$select pg_temp.editor()$$,'after downgrade Free reads retained history');
select throws_ok($$select edit_watch_history_v1('ed111111-1111-4111-8111-111111111111',pg_temp.edit(true))$$,'P0001','HISTORY_PLAN_REQUIRED','downgrade blocks saved draft');
select ok(not has_function_privilege('anon','public.edit_watch_history_v1(uuid,jsonb)','EXECUTE'),'anonymous cannot edit');
select ok(not has_function_privilege('authenticated','public.edit_watch_history_v1(uuid,jsonb)','EXECUTE'),'browser database identity cannot bypass web authority');
select ok(has_function_privilege('service_role','public.edit_watch_history_v1(uuid,jsonb)','EXECUTE'),'server may call edit');
select * from finish();
rollback;
