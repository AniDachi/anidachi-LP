begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='30s';
set local lock_timeout='3s';
select no_plan();
create function pg_temp.p_id(id integer) returns text language sql immutable as $$ select lpad(id::text,26,'A'); $$;
insert into users(id,email,display_name) values
 ('e1111111-1111-4111-8111-111111111111','primevideo-owner@example.test','Prime Video'),
 ('e2222222-2222-4222-8222-222222222222','primevideo-other@example.test','Other');
insert into account_manual_plan_grants(user_id,plan_code,reason) values ('e1111111-1111-4111-8111-111111111111','plus','test');
select resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111');
create function pg_temp.p_event(movie boolean default false, id text default 'AAAAAAAAAAAAAAAAAA70196259', series text default 'AAAAAAAAAAAAAAAAAA70143836') returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','primevideo',
 'titleKey',case when movie then 'primevideo:movie:'||id else 'primevideo:series:'||series end,
 'episodeKey',case when movie then 'primevideo:movie:'||id else 'primevideo:episode:'||id end,
 'seasonKey',case when movie then null else 'primevideo:season:AAAAAAAAAAAAAAAAAA70114191' end,
 'itemKind',case when movie then 'movie' else 'series' end,'title',case when movie then 'El Camino' else 'Breaking Bad' end,
 'episodeTitle',case when movie then 'El Camino' else 'Seven Thirty-Seven' end,
 'seasonTitle',case when movie then null else 'Season 2' end,'seasonNumber',case when movie then null else 2 end,
 'episodeNumber',case when movie then null else 1 end,'artworkUrl','https://m.media-amazon.com/images/poster.jpg',
 'clientEventId',gen_random_uuid(),'clientSessionKey',gen_random_uuid()::text,'currentTime',300,'duration',1800,'progress',0.1666666667,
 'sourceUrl','https://www.primevideo.com/detail/'||id,'kind','pause','observedAt',clock_timestamp(),
 'primevideoIdentity',case when movie then jsonb_build_object('kind','movie','providerMovieId',id) else
 jsonb_build_object('kind','episode','seriesAnchorSeasonId',series,'providerSeasonIdentifier','AAAAAAAAAAAAAAAAAA70114191','providerEpisodeIdentifier',id) end);
$$;
create function pg_temp.p_input(e jsonb) returns jsonb language sql as $$
 select jsonb_build_object('captureVersion',1,'accessEpoch',a->'accessEpoch','youtubeConsentEpoch',a->'youtubeConsentEpoch','clientSequence',1,'event',e)
 from (select resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111')->'history' a) q;
$$;
create temporary table p_calls(name text primary key, value jsonb);
-- Use transaction-start observation for the old event: deletion's existing
-- transaction acceptance clock then simulates a later HTTP transaction.
update user_watch_settings set capture_not_before=transaction_timestamp()-interval '1 day' where user_id='e1111111-1111-4111-8111-111111111111';
insert into p_calls values ('series',pg_temp.p_input(pg_temp.p_event()||jsonb_build_object('observedAt',transaction_timestamp()))),('movie',pg_temp.p_input(pg_temp.p_event(true,'AAAAAAAAAAAAAAAAAA81078819')));
insert into p_calls select 'series_ack',apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='series';
select is(apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='series')),(select value from p_calls where name='series_ack'),'Prime Video progress receipt is idempotent');
select lives_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='movie'$$,'standalone Prime Video movie is accepted');
select is((select raw_content_id from watch_episode_progress where provider='primevideo' and item_kind='movie'),'AAAAAAAAAAAAAAAAAA81078819','movie stores stable content identity');
select is((select season_key from watch_episode_progress where provider='primevideo' and item_kind='movie'),null,'movie has no invented season');
select is((select source_url from watch_episode_progress where provider='primevideo' and item_kind='series'),'https://www.primevideo.com/detail/AAAAAAAAAAAAAAAAAA70196259','series resume stores canonical actual episode URL');
select throws_ok($$select apply_personal_watch_progress_v1('e2222222-2222-4222-8222-222222222222',value) from p_calls where name='series'$$,'P0001','HISTORY_PLAN_REQUIRED','Free cannot write Prime Video progress');
select throws_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event())||'{"accessEpoch":0}')$$,'P0001','HISTORY_ACCESS_CHANGED','Prime Video retains epoch fence');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"sourceUrl":"https://www.primevideo.com.evil.test/watch/70196259"}')$$,'22023','watch_history_identity_invalid','lookalike source rejected');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"youtubeVideoId":"abcdef"}')$$,'22023','watch_history_identity_invalid','foreign provider identity rejected');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event(true,'AAAAAAAAAAAAAAAAAA81078819')||'{"seasonKey":"primevideo:season:1"}')$$,'22023','watch_history_identity_invalid','movie cannot invent season');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event(false,'01'))$$,'22023','watch_history_identity_invalid','malformed compactGTI rejected');
select is(get_watch_history_capacity_v1('e1111111-1111-4111-8111-111111111111')->'providers','{"youtube":{"used":0,"limit":100},"crunchyroll":{"used":0,"limit":200}}'::jsonb,'v1 remains exact with Prime Video rows present');
select is(get_watch_history_capacity_v3('e1111111-1111-4111-8111-111111111111')->>'capacityVersion','3','v3 explicit capacity version');
select is(get_watch_history_capacity_v3('e1111111-1111-4111-8111-111111111111')#>>'{providers,primevideo,used}','2','movie and series occupy separate Prime Video slots');
select is(list_watch_history_v3_bounded_page('e1111111-1111-4111-8111-111111111111',1,1)->>'totalTitleCount','0','legacy list filters Prime Video before counting');
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,3)->>'totalTitleCount','2','negotiated list counts Prime Video');
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,3)->>'hasMore','true','negotiated list pagination includes Prime Video');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1}','titles')->>'totalTitleCount','0','legacy browse filters Prime Video before counting');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1,"providerVersion":3}','titles')->>'totalTitleCount','2','v3 browse counts Prime Video');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1,"provider":"primevideo"}','titles')->>'totalTitleCount','2','explicit Prime Video provider opts in without version');
select throws_ok($$select browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":4}','titles')$$,'22023','watch_history_browse_invalid','SQL rejects unknown provider version');
select throws_ok($$select browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":null}','titles')$$,'22023','watch_history_browse_invalid','SQL rejects null provider version');
select throws_ok($$select list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,4)$$,'22023','watch_history_invalid_page','SQL list rejects unknown provider version');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"artworkUrl":"https://m.media-amazon.com.evil.test/images/a"}')$$,'22023','watch_history_identity_invalid','SQL rejects artwork CDN lookalike');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"artworkUrl":"https://127.0.0.1/a"}')$$,'22023','watch_history_identity_invalid','SQL rejects artwork private host');

-- The capability sets are exact even when multiple new providers coexist.
insert into watch_episode_progress(user_id,provider,title_key,episode_key,item_kind,title,episode_title,source_url,current_time_seconds,duration,progress,last_event_id,observed_at,server_order,history_generation,updated_at)
values('e1111111-1111-4111-8111-111111111111','netflix','netflix:movie:123','netflix:movie:123','movie','Netflix preserved','Netflix preserved','https://www.netflix.com/watch/123',1,100,0.01,gen_random_uuid(),clock_timestamp()-interval '1 day',800,1,clock_timestamp());
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,2)->>'totalTitleCount','1','v2 list includes Netflix and excludes Prime before count');
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,2)#>>'{titleSummaries,0,provider}','netflix','v2 pagination cannot be occupied by Prime');
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,3)->>'totalTitleCount','3','v3 list includes both Netflix and Prime');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":2,"limit":1}','titles')->>'totalTitleCount','1','v2 browse count excludes Prime');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":3,"provider":"netflix"}','titles')->>'totalTitleCount','1','explicit provider still restricts v3 to itself');
select is(get_watch_history_capacity_v2('e1111111-1111-4111-8111-111111111111')->'providers','{"youtube":{"used":0,"limit":100},"crunchyroll":{"used":0,"limit":200},"netflix":{"used":1,"limit":200}}'::jsonb,'v2 capacity remains exact with Prime present');
select is(jsonb_array_length(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,2)->'sessionIds'),0,'v2 session enrichment cannot expose Prime sessions');
select throws_ok(format('select validate_watch_identity_v3(%L::jsonb)',pg_temp.p_event()||jsonb_build_object('artworkUrl',url)),'22023','watch_history_identity_invalid','SQL rejects hostile Prime artwork: '||url)
from (values ('http://m.media-amazon.com/images/a'),('https://user@m.media-amazon.com/images/a'),('https://m.media-amazon.com:443/images/a'),('https://m.media-amazon.com/images/a#f'),('https://m.media-amazon.com/outside/a'),('https://m.media-amazon.com/images/%2e%2e/outside')) q(url);
select throws_ok(format('select validate_watch_identity_v3(%L::jsonb)',pg_temp.p_event()||jsonb_build_object('primevideoIdentity',identity)),'22023','watch_history_identity_invalid','SQL requires explicit strict anchor identity')
from (values ('{"kind":"episode","providerSeriesId":"AAAAAAAAAAAAAAAAAA70143836","providerSeasonIdentifier":"AAAAAAAAAAAAAAAAAA70114191","providerEpisodeIdentifier":"AAAAAAAAAAAAAAAAAA70196259"}'::jsonb),('{"kind":"episode","seriesAnchorSeasonId":"aaaaaaaaaaaaaaaaaaaaaaaaaa","providerSeasonIdentifier":"AAAAAAAAAAAAAAAAAA70114191","providerEpisodeIdentifier":"AAAAAAAAAAAAAAAAAA70196259"}'::jsonb)) q(identity);

create function pg_temp.p_request() returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','primevideo','titleKey','primevideo:series:AAAAAAAAAAAAAAAAAA70143836','providerSeriesId','AAAAAAAAAAAAAAAAAA70143836',
 'context',jsonb_build_object('region','VN','requestedLocale','en-US','audioLocale',null,'subtitleLocales','[]'::jsonb,'observedAt',clock_timestamp()),
 'historyAccess',jsonb_build_object('accessVersion',1,'accessEpoch',(resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111')#>'{history,accessEpoch}')));
$$;
create function pg_temp.p_snapshot(ctx jsonb) returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'provider','primevideo','titleKey','primevideo:series:AAAAAAAAAAAAAAAAAA70143836','providerSeriesId','AAAAAAAAAAAAAAAAAA70143836','title','Breaking Bad','completeness','partial','context',ctx,
 'seasons',jsonb_build_array(jsonb_build_object('seasonKey','primevideo:season:AAAAAAAAAAAAAAAAAA70114191','providerSeasonIdentifier','AAAAAAAAAAAAAAAAAA70114191','title','Season 2','seasonNumber',2,'order',0,
 'episodes',(select jsonb_agg(jsonb_build_object('episodeKey','primevideo:episode:'||pg_temp.p_id(id),'providerEpisodeIdentifier',pg_temp.p_id(id),'title','Episode '||id,'episodeNumber',id-70196258,'order',id-70196259,'releasedAt',null,'available',true,
 'watchVariants',jsonb_build_array(jsonb_build_object('providerContentId',pg_temp.p_id(id),'audioLocale',null,'original',true,'order',0,'sourceUrl','https://www.primevideo.com/detail/'||pg_temp.p_id(id))))) from generate_series(70196259,70196260) id))));
$$;
insert into p_calls values('request',pg_temp.p_request());
insert into p_calls select 'begin',begin_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='request';
select is((select value->>'provider' from p_calls where name='begin'),'primevideo','catalog begin acknowledges actual provider');
insert into p_calls select 'commit',r.value||jsonb_build_object('revision',b.value->'revision','snapshot',pg_temp.p_snapshot(r.value->'context')) from p_calls r,p_calls b where r.name='request' and b.name='begin';
select throws_ok($$select apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',jsonb_set(value,'{snapshot,provider}','"crunchyroll"')) from p_calls where name='commit'$$,'22023','watch_catalog_invalid','commit cannot mix providers');
select throws_ok($$select apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',jsonb_set(value,'{snapshot,seasons,0,episodes,0,watchVariants,0,providerContentId}','"70196260"')) from p_calls where name='commit'$$,'22023','watch_catalog_invalid','Prime Video catalog variant cannot alias a different episode');
select is(apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='commit'))->>'outcome','applied','Prime Video partial catalog commits');
select is(apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='commit'))->>'outcome','applied','Prime Video catalog commit replay is idempotent');
-- Partial evidence remains partial and does not manufacture unseen grid rows.
select is(watch_catalog_read_v3('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:series:AAAAAAAAAAAAAAAAAA70143836')->>'state','partial','partial catalog never claims completeness');
-- A later explicit complete fixture proves the existing complete-catalog editor.
insert into p_calls select 'complete_begin',begin_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='request';
update p_calls set value=jsonb_set(jsonb_set(value,'{snapshot,completeness}','"complete"'),'{revision}',(select value->'revision' from p_calls where name='complete_begin')) where name='commit';
select is(apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='commit'))->>'outcome','applied','explicit complete catalog fixture commits');
select is(watch_catalog_read_v3('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:series:AAAAAAAAAAAAAAAAAA70143836')#>>'{aggregate,availableEpisodes}','2','projection includes both episodes');
select is(list_watch_history_v3_title_episodes_page('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:series:AAAAAAAAAAAAAAAAAA70143836',50,null)#>>'{catalog,seasons,0,seasonTitle}','Season 2','season/detail read supports Prime Video');
select is((get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:series:AAAAAAAAAAAAAAAAAA70143836')->'episodes')->1->>'sourceUrl','https://www.primevideo.com/detail/AAAAAAAAAAAAAAAAAA70196260','editor includes unseen canonical Prime Video episode');
select is((get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:movie:AAAAAAAAAAAAAAAAAA81078819')->'episodes')->0->>'seasonKey',null,'movie editor preserves null season');
insert into p_calls select 'edit',jsonb_build_object('provider','primevideo','titleKey','primevideo:series:AAAAAAAAAAAAAAAAAA70143836','accountGeneration',1,'clientMutationId',gen_random_uuid(),
 'revision',get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:series:AAAAAAAAAAAAAAAAAA70143836')->'revision',
 'changes','[{"episodeKey":"primevideo:episode:AAAAAAAAAAAAAAAAAA70196260","watched":true}]'::jsonb);
insert into p_calls select 'edit_ack',edit_watch_history_v1('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='edit';
select is(edit_watch_history_v1('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='edit')),(select value from p_calls where name='edit_ack'),'Prime Video edit replay is idempotent');
select is((select raw_content_id from watch_episode_progress where episode_key='primevideo:episode:AAAAAAAAAAAAAAAAAA70196260'),'AAAAAAAAAAAAAAAAAA70196260','manual watched unseen episode stores its own ID');
select is(watch_catalog_read_v3('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:series:AAAAAAAAAAAAAAAAAA70143836')#>>'{aggregate,completedEpisodes}','1','manual edit recomputes completion');
select throws_ok($$select get_watch_history_editor_v1('e2222222-2222-4222-8222-222222222222',1,'primevideo','primevideo:series:AAAAAAAAAAAAAAAAAA70143836')$$,'P0001','watch_history_generation_mismatch','other owner without settings cannot read title editor');
select lives_ok($$select browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"provider":"primevideo","limit":20,"mode":"personal"}', 'titles')$$,'provider browse accepts Prime Video');
-- Fill Prime Video alone to its limit; the existing series keeps admitting episodes.
insert into watch_episode_progress(user_id,provider,title_key,episode_key,item_kind,title,episode_title,source_url,current_time_seconds,duration,progress,last_event_id,observed_at,server_order,history_generation,updated_at)
select 'e1111111-1111-4111-8111-111111111111','primevideo','primevideo:movie:'||pg_temp.p_id(id),'primevideo:movie:'||pg_temp.p_id(id),'movie','Movie','Movie','https://www.primevideo.com/detail/'||pg_temp.p_id(id),1,100,0.01,gen_random_uuid(),clock_timestamp()-interval '1 day',id,1,clock_timestamp() from generate_series(1000,1197) id;
select is(get_watch_history_capacity_v3('e1111111-1111-4111-8111-111111111111')#>>'{providers,primevideo,used}','200','Prime Video capacity counts titles, not episodes');
select throws_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event(true,'AAAAAAAAAAAAAAAAAAAAAA9999')))$$,'P0001','HISTORY_LIMIT_REACHED','201st Prime Video title rejected');
select lives_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event(false,'AAAAAAAAAAAAAAAAAA70196261')))$$,'existing Prime Video series admits next episode at capacity');
select is(get_watch_history_capacity_v3('e1111111-1111-4111-8111-111111111111')#>>'{providers,crunchyroll,used}','0','Prime Video does not consume Crunchyroll slots');
select lives_ok($$select delete_watch_history_v3('e1111111-1111-4111-8111-111111111111',jsonb_build_object('schemaVersion',3,'accountGeneration',1,'clientMutationId',gen_random_uuid(),'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','title','provider','primevideo','titleKey','primevideo:series:AAAAAAAAAAAAAAAAAA70143836')))$$,'Prime Video title deletion accepted');
select is((select count(*) from watch_catalog_snapshots where provider='primevideo'),0::bigint,'title deletion removes owned Prime Video catalog');
select throws_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='series'$$,'P0001','watch_history_deleted','deletion fences receipt replay');
select lives_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event(true,'AAAAAAAAAAAAAAAAAAAAAA9999')))$$,'fresh movie consumes freed slot');
-- No new direct authenticated access or private-writer bypass.
select ok(not has_function_privilege('authenticated','public.get_watch_history_capacity_v3(uuid,bigint)','EXECUTE'),'authenticated cannot choose a capacity owner');
select ok(not has_function_privilege('anon','public.get_watch_history_capacity_v3(uuid,bigint)','EXECUTE'),'anonymous capacity denied');
select ok(has_function_privilege('service_role','public.get_watch_history_capacity_v3(uuid,bigint)','EXECUTE'),'server capacity role retained');
select ok(not has_function_privilege('service_role','anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)','EXECUTE'),'private writer remains inaccessible to service role');
set local role authenticated;
select throws_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111','{}')$$,'42501',null,'authenticated direct personal writer denied');
select throws_ok($$select begin_watch_catalog_v3('e1111111-1111-4111-8111-111111111111','{}')$$,'42501',null,'authenticated direct catalog writer denied');
reset role;
-- Exercise the actual public -> private creation core, not only table checks.
select is((select room_record->>'source_provider' from create_room_with_active_session_v3(
 'e1111111-1111-4111-8111-111111111111','primevideo-create',null,null,'primevideo','https://www.primevideo.com/detail/AAAAAAAAAAAAAAAAAA81078819','primevideo|detail/AAAAAAAAAAAAAAAAAA81078819',1,null,'primevideo-create-request','plus',6,6,true,true,3)),
 'primevideo','public room creation traverses private core with Prime Video source');
-- Canonical room sources, generation conflict and provider pin remain enforced.
insert into rooms(room_id,host_user_id,status,source_provider,source_url,video_fingerprint,source_generation)
values('primevideo-local-room','e1111111-1111-4111-8111-111111111111','lobby','primevideo','https://www.primevideo.com/detail/AAAAAAAAAAAAAAAAAA70196259','primevideo|detail/AAAAAAAAAAAAAAAAAA70196259',1);
select is((select outcome from persist_room_source_v1('primevideo-local-room','primevideo','https://www.primevideo.com/detail/AAAAAAAAAAAAAAAAAA70196260','primevideo|detail/AAAAAAAAAAAAAAAAAA70196260',2)),'persisted','Prime Video room source advances');
select is((select outcome from persist_room_source_v1('primevideo-local-room','primevideo','https://www.primevideo.com/detail/AAAAAAAAAAAAAAAAAA70196259','primevideo|detail/AAAAAAAAAAAAAAAAAA70196259',1)),'stale','stale Prime Video source cannot replace room');
select throws_ok($$select persist_room_source_v1('primevideo-local-room','youtube','https://www.youtube.com/watch?v=abcdef','youtube|abcdef',3)$$,'23514','room_source_provider_conflict','room stays provider-pinned');
select throws_ok($$select persist_room_source_v1('primevideo-local-room','primevideo','https://www.primevideo.com/detail/AAAAAAAAAAAAAAAAAA70196260','primevideo|detail/AAAAAAAAAAAAAAAAAAAAAAA999',3)$$,'22023','room_source_invalid_input','room rejects mismatched fingerprint');
update watch_sessions set room_id='primevideo-local-room',client_session_key=null,room_generation=1,source_generation=1 where provider='primevideo' and item_key='primevideo:movie:AAAAAAAAAAAAAAAAAA81078819';
insert into watch_session_participants(session_id,user_id,role,schema_version)
 select id,'e2222222-2222-4222-8222-222222222222','viewer',3 from watch_sessions where provider='primevideo' and item_key='primevideo:movie:AAAAAAAAAAAAAAAAAA81078819';
select is(jsonb_array_length(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"shared"}','options')->'options'),0,'legacy shared facets exclude Prime Video participants');
select is(jsonb_array_length(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"shared","providerVersion":3}','options')->'options'),1,'v3 shared facets include Prime Video participant');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"shared","provider":"primevideo","titleKey":"primevideo:movie:AAAAAAAAAAAAAAAAAA81078819","episodeKey":"primevideo:movie:AAAAAAAAAAAAAAAAAA81078819"}','sessions')->>'totalSessionCount','1','explicit Prime Video session drilldown opts in');
select is(jsonb_array_length(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"shared","providerVersion":2}','options')->'options'),0,'v2 shared facets exclude Prime');
select is((select count(*) from watch_episode_progress where provider='netflix' and title_key='netflix:movie:123'),1::bigint,'Prime deletion and capacity preserve unrelated Netflix progress');
select * from finish();
rollback;
