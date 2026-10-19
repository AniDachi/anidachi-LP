begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='30s';
set local lock_timeout='3s';
select no_plan();
insert into users(id,email,display_name) values
 ('f1111111-1111-4111-8111-111111111111','netflix-owner@example.test','Netflix'),
 ('f2222222-2222-4222-8222-222222222222','netflix-other@example.test','Other');
insert into account_manual_plan_grants(user_id,plan_code,reason) values ('f1111111-1111-4111-8111-111111111111','plus','test');
select resolve_watch_history_access_v1('f1111111-1111-4111-8111-111111111111');
create function pg_temp.n_event(movie boolean default false, id text default '70196259', series text default '70143836') returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','netflix',
 'titleKey',case when movie then 'netflix:movie:'||id else 'netflix:series:'||series end,
 'episodeKey',case when movie then 'netflix:movie:'||id else 'netflix:episode:'||id end,
 'seasonKey',case when movie then null else 'netflix:season:70114191' end,
 'itemKind',case when movie then 'movie' else 'series' end,'title',case when movie then 'El Camino' else 'Breaking Bad' end,
 'episodeTitle',case when movie then 'El Camino' else 'Seven Thirty-Seven' end,
 'seasonTitle',case when movie then null else 'Season 2' end,'seasonNumber',case when movie then null else 2 end,
 'episodeNumber',case when movie then null else 1 end,'artworkUrl','https://occ-0-123.nflxso.net/poster.jpg',
 'clientEventId',gen_random_uuid(),'clientSessionKey',gen_random_uuid()::text,'currentTime',300,'duration',1800,'progress',0.1666666667,
 'sourceUrl','https://www.netflix.com/watch/'||id,'kind','pause','observedAt',clock_timestamp(),
 'netflixIdentity',case when movie then jsonb_build_object('kind','movie','providerMovieId',id) else
 jsonb_build_object('kind','episode','providerSeriesId',series,'providerSeasonIdentifier','70114191','providerEpisodeIdentifier',id) end);
$$;
create function pg_temp.n_input(e jsonb) returns jsonb language sql as $$
 select jsonb_build_object('captureVersion',1,'accessEpoch',a->'accessEpoch','youtubeConsentEpoch',a->'youtubeConsentEpoch','clientSequence',1,'event',e)
 from (select resolve_watch_history_access_v1('f1111111-1111-4111-8111-111111111111')->'history' a) q;
$$;
create temporary table n_calls(name text primary key, value jsonb);
-- Use transaction-start observation for the old event: deletion's existing
-- transaction acceptance clock then simulates a later HTTP transaction.
update user_watch_settings set capture_not_before=transaction_timestamp()-interval '1 day' where user_id='f1111111-1111-4111-8111-111111111111';
insert into n_calls values ('series',pg_temp.n_input(pg_temp.n_event()||jsonb_build_object('observedAt',transaction_timestamp()))),('movie',pg_temp.n_input(pg_temp.n_event(true,'81078819')));
insert into n_calls select 'series_ack',apply_personal_watch_progress_v1('f1111111-1111-4111-8111-111111111111',value) from n_calls where name='series';
select is(apply_personal_watch_progress_v1('f1111111-1111-4111-8111-111111111111',(select value from n_calls where name='series')),(select value from n_calls where name='series_ack'),'Netflix progress receipt is idempotent');
select lives_ok($$select apply_personal_watch_progress_v1('f1111111-1111-4111-8111-111111111111',value) from n_calls where name='movie'$$,'standalone Netflix movie is accepted');
select is((select raw_content_id from watch_episode_progress where provider='netflix' and item_kind='movie'),'81078819','movie stores stable content identity');
select is((select season_key from watch_episode_progress where provider='netflix' and item_kind='movie'),null,'movie has no invented season');
select is((select source_url from watch_episode_progress where provider='netflix' and item_kind='series'),'https://www.netflix.com/watch/70196259','series resume stores canonical actual episode URL');
select throws_ok($$select apply_personal_watch_progress_v1('f2222222-2222-4222-8222-222222222222',value) from n_calls where name='series'$$,'P0001','HISTORY_PLAN_REQUIRED','Free cannot write Netflix progress');
select throws_ok($$select apply_personal_watch_progress_v1('f1111111-1111-4111-8111-111111111111',pg_temp.n_input(pg_temp.n_event())||'{"accessEpoch":0}')$$,'P0001','HISTORY_ACCESS_CHANGED','Netflix retains epoch fence');
select throws_ok($$select validate_watch_identity_v3(pg_temp.n_event()||'{"sourceUrl":"https://www.netflix.com.evil.test/watch/70196259"}')$$,'22023','watch_history_identity_invalid','lookalike source rejected');
select throws_ok($$select validate_watch_identity_v3(pg_temp.n_event()||'{"youtubeVideoId":"abcdef"}')$$,'22023','watch_history_identity_invalid','foreign provider identity rejected');
select throws_ok($$select validate_watch_identity_v3(pg_temp.n_event(true,'81078819')||'{"seasonKey":"netflix:season:1"}')$$,'22023','watch_history_identity_invalid','movie cannot invent season');
select throws_ok($$select validate_watch_identity_v3(pg_temp.n_event(false,'01'))$$,'22023','watch_history_identity_invalid','numeric IDs reject leading zero');
select is(get_watch_history_capacity_v1('f1111111-1111-4111-8111-111111111111')->'providers','{"youtube":{"used":0,"limit":100},"crunchyroll":{"used":0,"limit":200}}'::jsonb,'v1 remains exact with Netflix rows present');
select is(get_watch_history_capacity_v2('f1111111-1111-4111-8111-111111111111')->>'capacityVersion','2','v2 explicit capacity version');
select is(get_watch_history_capacity_v2('f1111111-1111-4111-8111-111111111111')#>>'{providers,netflix,used}','2','movie and series occupy separate Netflix slots');
select is(list_watch_history_v3_bounded_page('f1111111-1111-4111-8111-111111111111',1,1)->>'totalTitleCount','0','legacy list filters Netflix before counting');
select is(list_watch_history_v3_provider_page('f1111111-1111-4111-8111-111111111111',1,1,2)->>'totalTitleCount','2','negotiated list counts Netflix');
select is(list_watch_history_v3_provider_page('f1111111-1111-4111-8111-111111111111',1,1,2)->>'hasMore','true','negotiated list pagination includes Netflix');
select is(browse_watch_history_v3('f1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1}','titles')->>'totalTitleCount','0','legacy browse filters Netflix before counting');
select is(browse_watch_history_v3('f1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1,"providerVersion":2}','titles')->>'totalTitleCount','2','v2 browse counts Netflix');
select is(browse_watch_history_v3('f1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1,"provider":"netflix"}','titles')->>'totalTitleCount','2','explicit Netflix provider opts in without version');
select throws_ok($$select browse_watch_history_v3('f1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":3}','titles')$$,'22023','watch_history_browse_invalid','SQL rejects unknown provider version');
select throws_ok($$select browse_watch_history_v3('f1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":null}','titles')$$,'22023','watch_history_browse_invalid','SQL rejects null provider version');
select throws_ok($$select list_watch_history_v3_provider_page('f1111111-1111-4111-8111-111111111111',1,1,3)$$,'22023','watch_history_invalid_page','SQL list rejects unknown provider version');
select throws_ok($$select validate_watch_identity_v3(pg_temp.n_event()||'{"artworkUrl":"https://occ-0.nflxso.net.evil.test/a"}')$$,'22023','watch_history_identity_invalid','SQL rejects artwork CDN lookalike');
select throws_ok($$select validate_watch_identity_v3(pg_temp.n_event()||'{"artworkUrl":"https://127.0.0.1/a"}')$$,'22023','watch_history_identity_invalid','SQL rejects artwork private host');

create function pg_temp.n_request() returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','netflix','titleKey','netflix:series:70143836','providerSeriesId','70143836',
 'context',jsonb_build_object('region','VN','requestedLocale','en-US','audioLocale',null,'subtitleLocales','[]'::jsonb,'observedAt',clock_timestamp()),
 'historyAccess',jsonb_build_object('accessVersion',1,'accessEpoch',(resolve_watch_history_access_v1('f1111111-1111-4111-8111-111111111111')#>'{history,accessEpoch}')));
$$;
create function pg_temp.n_snapshot(ctx jsonb) returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'provider','netflix','titleKey','netflix:series:70143836','providerSeriesId','70143836','title','Breaking Bad','completeness','complete','context',ctx,
 'seasons',jsonb_build_array(jsonb_build_object('seasonKey','netflix:season:70114191','providerSeasonIdentifier','70114191','title','Season 2','seasonNumber',2,'order',0,
 'episodes',(select jsonb_agg(jsonb_build_object('episodeKey','netflix:episode:'||id,'providerEpisodeIdentifier',id::text,'title','Episode '||id,'episodeNumber',id-70196258,'order',id-70196259,'releasedAt',null,'available',true,
 'watchVariants',jsonb_build_array(jsonb_build_object('providerContentId',id::text,'audioLocale',null,'original',true,'order',0,'sourceUrl','https://www.netflix.com/watch/'||id)))) from generate_series(70196259,70196260) id))));
$$;
insert into n_calls values('request',pg_temp.n_request());
insert into n_calls select 'begin',begin_watch_catalog_v3('f1111111-1111-4111-8111-111111111111',value) from n_calls where name='request';
select is((select value->>'provider' from n_calls where name='begin'),'netflix','catalog begin acknowledges actual provider');
insert into n_calls select 'commit',r.value||jsonb_build_object('revision',b.value->'revision','snapshot',pg_temp.n_snapshot(r.value->'context')) from n_calls r,n_calls b where r.name='request' and b.name='begin';
select throws_ok($$select apply_watch_catalog_v3('f1111111-1111-4111-8111-111111111111',jsonb_set(value,'{snapshot,provider}','"crunchyroll"')) from n_calls where name='commit'$$,'22023','watch_catalog_invalid','commit cannot mix providers');
select throws_ok($$select apply_watch_catalog_v3('f1111111-1111-4111-8111-111111111111',jsonb_set(value,'{snapshot,seasons,0,episodes,0,watchVariants,0,providerContentId}','"70196260"')) from n_calls where name='commit'$$,'22023','watch_catalog_invalid','Netflix catalog variant cannot alias a different episode');
select is(apply_watch_catalog_v3('f1111111-1111-4111-8111-111111111111',(select value from n_calls where name='commit'))->>'outcome','applied','Netflix complete catalog commits');
select is(apply_watch_catalog_v3('f1111111-1111-4111-8111-111111111111',(select value from n_calls where name='commit'))->>'outcome','applied','Netflix catalog commit replay is idempotent');
select is(watch_catalog_read_v3('f1111111-1111-4111-8111-111111111111',1,'netflix','netflix:series:70143836')#>>'{aggregate,availableEpisodes}','2','projection includes both episodes');
select is(list_watch_history_v3_title_episodes_page('f1111111-1111-4111-8111-111111111111',1,'netflix','netflix:series:70143836',50,null)#>>'{catalog,seasons,0,seasonTitle}','Season 2','season/detail read supports Netflix');
select is((get_watch_history_editor_v1('f1111111-1111-4111-8111-111111111111',1,'netflix','netflix:series:70143836')->'episodes')->1->>'sourceUrl','https://www.netflix.com/watch/70196260','editor includes unseen canonical Netflix episode');
select is((get_watch_history_editor_v1('f1111111-1111-4111-8111-111111111111',1,'netflix','netflix:movie:81078819')->'episodes')->0->>'seasonKey',null,'movie editor preserves null season');
insert into n_calls select 'edit',jsonb_build_object('provider','netflix','titleKey','netflix:series:70143836','accountGeneration',1,'clientMutationId',gen_random_uuid(),
 'revision',get_watch_history_editor_v1('f1111111-1111-4111-8111-111111111111',1,'netflix','netflix:series:70143836')->'revision',
 'changes','[{"episodeKey":"netflix:episode:70196260","watched":true}]'::jsonb);
insert into n_calls select 'edit_ack',edit_watch_history_v1('f1111111-1111-4111-8111-111111111111',value) from n_calls where name='edit';
select is(edit_watch_history_v1('f1111111-1111-4111-8111-111111111111',(select value from n_calls where name='edit')),(select value from n_calls where name='edit_ack'),'Netflix edit replay is idempotent');
select is((select raw_content_id from watch_episode_progress where episode_key='netflix:episode:70196260'),'70196260','manual watched unseen episode stores its own ID');
select is(watch_catalog_read_v3('f1111111-1111-4111-8111-111111111111',1,'netflix','netflix:series:70143836')#>>'{aggregate,completedEpisodes}','1','manual edit recomputes completion');
select throws_ok($$select get_watch_history_editor_v1('f2222222-2222-4222-8222-222222222222',1,'netflix','netflix:series:70143836')$$,'P0001','watch_history_generation_mismatch','other owner without settings cannot read title editor');
select lives_ok($$select browse_watch_history_v3('f1111111-1111-4111-8111-111111111111','{"provider":"netflix","limit":20,"mode":"personal"}', 'titles')$$,'provider browse accepts Netflix');
-- Fill Netflix alone to its limit; the existing series keeps admitting episodes.
insert into watch_episode_progress(user_id,provider,title_key,episode_key,item_kind,title,episode_title,source_url,current_time_seconds,duration,progress,last_event_id,observed_at,server_order,history_generation,updated_at)
select 'f1111111-1111-4111-8111-111111111111','netflix','netflix:movie:'||id,'netflix:movie:'||id,'movie','Movie','Movie','https://www.netflix.com/watch/'||id,1,100,0.01,gen_random_uuid(),clock_timestamp()-interval '1 day',id,1,clock_timestamp() from generate_series(1000,1197) id;
select is(get_watch_history_capacity_v2('f1111111-1111-4111-8111-111111111111')#>>'{providers,netflix,used}','200','Netflix capacity counts titles, not episodes');
select throws_ok($$select apply_personal_watch_progress_v1('f1111111-1111-4111-8111-111111111111',pg_temp.n_input(pg_temp.n_event(true,'9999')))$$,'P0001','HISTORY_LIMIT_REACHED','201st Netflix title rejected');
select lives_ok($$select apply_personal_watch_progress_v1('f1111111-1111-4111-8111-111111111111',pg_temp.n_input(pg_temp.n_event(false,'70196261')))$$,'existing Netflix series admits next episode at capacity');
select is(get_watch_history_capacity_v2('f1111111-1111-4111-8111-111111111111')#>>'{providers,crunchyroll,used}','0','Netflix does not consume Crunchyroll slots');
select lives_ok($$select delete_watch_history_v3('f1111111-1111-4111-8111-111111111111',jsonb_build_object('schemaVersion',3,'accountGeneration',1,'clientMutationId',gen_random_uuid(),'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','title','provider','netflix','titleKey','netflix:series:70143836')))$$,'Netflix title deletion accepted');
select is((select count(*) from watch_catalog_snapshots where provider='netflix'),0::bigint,'title deletion removes owned Netflix catalog');
select throws_ok($$select apply_personal_watch_progress_v1('f1111111-1111-4111-8111-111111111111',value) from n_calls where name='series'$$,'P0001','watch_history_deleted','deletion fences receipt replay');
select lives_ok($$select apply_personal_watch_progress_v1('f1111111-1111-4111-8111-111111111111',pg_temp.n_input(pg_temp.n_event(true,'9999')))$$,'fresh movie consumes freed slot');
-- No new direct authenticated access or private-writer bypass.
select ok(not has_function_privilege('authenticated','public.get_watch_history_capacity_v2(uuid,bigint)','EXECUTE'),'authenticated cannot choose a capacity owner');
select ok(not has_function_privilege('anon','public.get_watch_history_capacity_v2(uuid,bigint)','EXECUTE'),'anonymous capacity denied');
select ok(has_function_privilege('service_role','public.get_watch_history_capacity_v2(uuid,bigint)','EXECUTE'),'server capacity role retained');
select ok(not has_function_privilege('service_role','anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)','EXECUTE'),'private writer remains inaccessible to service role');
set local role authenticated;
select throws_ok($$select apply_personal_watch_progress_v1('f1111111-1111-4111-8111-111111111111','{}')$$,'42501',null,'authenticated direct personal writer denied');
select throws_ok($$select begin_watch_catalog_v3('f1111111-1111-4111-8111-111111111111','{}')$$,'42501',null,'authenticated direct catalog writer denied');
reset role;
-- Exercise the actual public -> private creation core, not only table checks.
select is((select room_record->>'source_provider' from create_room_with_active_session_v3(
 'f1111111-1111-4111-8111-111111111111','netflix-create',null,null,'netflix','https://www.netflix.com/watch/81078819','netflix|watch/81078819',1,null,'netflix-create-request','plus',6,6,true,true,3)),
 'netflix','public room creation traverses private core with Netflix source');
-- Canonical room sources, generation conflict and provider pin remain enforced.
insert into rooms(room_id,host_user_id,status,source_provider,source_url,video_fingerprint,source_generation)
values('netflix-local-room','f1111111-1111-4111-8111-111111111111','lobby','netflix','https://www.netflix.com/watch/70196259','netflix|watch/70196259',1);
select is((select outcome from persist_room_source_v1('netflix-local-room','netflix','https://www.netflix.com/watch/70196260','netflix|watch/70196260',2)),'persisted','Netflix room source advances');
select is((select outcome from persist_room_source_v1('netflix-local-room','netflix','https://www.netflix.com/watch/70196259','netflix|watch/70196259',1)),'stale','stale Netflix source cannot replace room');
select throws_ok($$select persist_room_source_v1('netflix-local-room','youtube','https://www.youtube.com/watch?v=abcdef','youtube|abcdef',3)$$,'23514','room_source_provider_conflict','room stays provider-pinned');
select throws_ok($$select persist_room_source_v1('netflix-local-room','netflix','https://www.netflix.com/watch/70196260','netflix|watch/999',3)$$,'22023','room_source_invalid_input','room rejects mismatched fingerprint');
update watch_sessions set room_id='netflix-local-room',client_session_key=null,room_generation=1,source_generation=1 where provider='netflix' and item_key='netflix:movie:81078819';
insert into watch_session_participants(session_id,user_id,role,schema_version)
 select id,'f2222222-2222-4222-8222-222222222222','viewer',3 from watch_sessions where provider='netflix' and item_key='netflix:movie:81078819';
select is(jsonb_array_length(browse_watch_history_v3('f1111111-1111-4111-8111-111111111111','{"mode":"shared"}','options')->'options'),0,'legacy shared facets exclude Netflix participants');
select is(jsonb_array_length(browse_watch_history_v3('f1111111-1111-4111-8111-111111111111','{"mode":"shared","providerVersion":2}','options')->'options'),1,'v2 shared facets include Netflix participant');
select is(browse_watch_history_v3('f1111111-1111-4111-8111-111111111111','{"mode":"shared","provider":"netflix","titleKey":"netflix:movie:81078819","episodeKey":"netflix:movie:81078819"}','sessions')->>'totalSessionCount','1','explicit Netflix session drilldown opts in');
select * from finish();
rollback;
