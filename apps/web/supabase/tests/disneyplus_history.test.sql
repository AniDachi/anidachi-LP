begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='30s';
set local lock_timeout='3s';
select no_plan();
create function pg_temp.p_id(id integer) returns text language sql immutable as $$ select '01234567-1234-4321-9234-'||lpad(id::text,12,'0'); $$;
insert into users(id,email,display_name) values
 ('e1111111-1111-4111-8111-111111111111','disneyplus-owner@example.test','Disney+'),
 ('e2222222-2222-4222-8222-222222222222','disneyplus-other@example.test','Other');
insert into account_manual_plan_grants(user_id,plan_code,reason) values ('e1111111-1111-4111-8111-111111111111','plus','test');
select resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111');
create function pg_temp.p_event(movie boolean default false, id text default '01234567-1234-4321-9234-000070196259', series text default '01234567-1234-4321-9234-000070143836') returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','disneyplus',
 'titleKey',case when movie then 'disneyplus:movie:'||id else 'disneyplus:series:'||series end,
 'episodeKey',case when movie then 'disneyplus:movie:'||id else 'disneyplus:episode:'||id end,
 'seasonKey',case when movie then null else 'disneyplus:season:'||series||':2' end,
 'itemKind',case when movie then 'movie' else 'series' end,'title',case when movie then 'Movie' else 'Series' end,
 'episodeTitle',case when movie then 'Movie' else 'Episode' end,
 'seasonTitle',case when movie then null else 'Season 2' end,'seasonNumber',case when movie then null else 2 end,
 'episodeNumber',case when movie then null else 1 end,'artworkUrl','https://disney.images.edge.bamgrid.com/images/poster.jpg',
 'clientEventId',gen_random_uuid(),'clientSessionKey',gen_random_uuid()::text,'currentTime',300,'duration',1800,'progress',0.1666666667,
 'sourceUrl','https://www.disneyplus.com/play/'||id,'kind','pause','observedAt',clock_timestamp(),
 'disneyplusIdentity',case when movie then jsonb_build_object('kind','movie','providerMovieId',id) else
 jsonb_build_object('kind','episode','providerSeriesId',series,'providerEpisodeIdentifier',id) end);
$$;
create function pg_temp.p_input(e jsonb) returns jsonb language sql as $$
 select jsonb_build_object('captureVersion',1,'accessEpoch',a->'accessEpoch','youtubeConsentEpoch',a->'youtubeConsentEpoch','clientSequence',1,'event',e)
 from (select resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111')->'history' a) q;
$$;
create temporary table p_calls(name text primary key, value jsonb);
-- Use transaction-start observation for the old event: deletion's existing
-- transaction acceptance clock then simulates a later HTTP transaction.
update user_watch_settings set capture_not_before=transaction_timestamp()-interval '1 day' where user_id='e1111111-1111-4111-8111-111111111111';
insert into p_calls values ('series',pg_temp.p_input(pg_temp.p_event()||jsonb_build_object('observedAt',transaction_timestamp()))),('movie',pg_temp.p_input(pg_temp.p_event(true,'01234567-1234-4321-9234-000081078819')));
insert into p_calls select 'series_ack',apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='series';
select is(apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='series')),(select value from p_calls where name='series_ack'),'Disney+ progress receipt is idempotent');
select lives_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='movie'$$,'standalone Disney+ movie is accepted');
select is((select raw_content_id from watch_episode_progress where provider='disneyplus' and item_kind='movie'),'01234567-1234-4321-9234-000081078819','movie stores stable content identity');
select is((select season_key from watch_episode_progress where provider='disneyplus' and item_kind='movie'),null,'movie has no invented season');
select is((select source_url from watch_episode_progress where provider='disneyplus' and item_kind='series'),'https://www.disneyplus.com/play/01234567-1234-4321-9234-000070196259','series resume stores canonical actual episode URL');
select throws_ok($$select apply_personal_watch_progress_v1('e2222222-2222-4222-8222-222222222222',value) from p_calls where name='series'$$,'P0001','HISTORY_PLAN_REQUIRED','Free cannot write Disney+ progress');
select throws_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event())||'{"accessEpoch":0}')$$,'P0001','HISTORY_ACCESS_CHANGED','Disney+ retains epoch fence');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"sourceUrl":"https://www.disneyplus.com.evil.test/watch/70196259"}')$$,'22023','watch_history_identity_invalid','lookalike source rejected');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"youtubeVideoId":"abcdef"}')$$,'22023','watch_history_identity_invalid','foreign provider identity rejected');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event(true,'01234567-1234-4321-9234-000081078819')||'{"seasonKey":"disneyplus:season:1"}')$$,'22023','watch_history_identity_invalid','movie cannot invent season');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event(false,'01'))$$,'22023','watch_history_identity_invalid','malformed UUID rejected');
select is(get_watch_history_capacity_v1('e1111111-1111-4111-8111-111111111111')->'providers','{"youtube":{"used":0,"limit":100},"crunchyroll":{"used":0,"limit":200}}'::jsonb,'v1 remains exact with Disney+ rows present');
select is(get_watch_history_capacity_v4('e1111111-1111-4111-8111-111111111111')->>'capacityVersion','4','v4 explicit capacity version');
select is(get_watch_history_capacity_v4('e1111111-1111-4111-8111-111111111111')#>>'{providers,disneyplus,used}','2','movie and series occupy separate Disney+ slots');
select is(list_watch_history_v3_bounded_page('e1111111-1111-4111-8111-111111111111',1,1)->>'totalTitleCount','0','legacy list filters Disney+ before counting');
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,4)->>'totalTitleCount','2','negotiated list counts Disney+');
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,4)->>'hasMore','true','negotiated list pagination includes Disney+');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1}','titles')->>'totalTitleCount','0','legacy browse filters Disney+ before counting');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1,"providerVersion":4}','titles')->>'totalTitleCount','2','v4 browse counts Disney+');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1,"provider":"disneyplus"}','titles')->>'totalTitleCount','2','explicit Disney+ provider opts in without version');
select throws_ok($$select browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":6}','titles')$$,'22023','watch_history_browse_invalid','SQL rejects unknown provider version');
select throws_ok($$select browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":null}','titles')$$,'22023','watch_history_browse_invalid','SQL rejects null provider version');
select throws_ok($$select list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,6)$$,'22023','watch_history_invalid_page','SQL list rejects unknown provider version');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"artworkUrl":"https://disney.images.edge.bamgrid.com.evil.test/images/a"}')$$,'22023','watch_history_identity_invalid','SQL rejects artwork CDN lookalike');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"artworkUrl":"https://127.0.0.1/a"}')$$,'22023','watch_history_identity_invalid','SQL rejects artwork private host');
select is(list_watch_history_v3_provider_page_prime_navigation_v1('e1111111-1111-4111-8111-111111111111',1,1,3)->>'totalTitleCount','0','previous Prime-enabled list omits Disney+ before pagination');
select is(browse_watch_history_v3_prime_navigation_v1('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":3}','titles')->>'totalTitleCount','0','previous Prime-enabled browse omits Disney+');
select ok(not (get_watch_history_capacity_v3('e1111111-1111-4111-8111-111111111111')->'providers' ? 'disneyplus'),'capacity v3 remains exact');
select lives_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"seasonKey":null,"seasonTitle":null,"seasonNumber":null}')$$,'episode may have no established season');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"seasonNumber":3}')$$,'22023','watch_history_identity_invalid','season key must match series and number');
select lives_ok($$select validate_watch_identity_v3(pg_temp.p_event()||jsonb_build_object('seasonNumber',null,'seasonTitle','Exclusives',
 'seasonKey','disneyplus:season:'||pg_temp.p_id(70143836)||':'||pg_temp.p_id(55)))$$,'named season keeps its Disney UUID');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||jsonb_build_object('seasonNumber',null,'seasonTitle','Exclusives',
 'seasonKey','disneyplus:season:'||pg_temp.p_id(123)||':'||pg_temp.p_id(55)))$$,'22023','watch_history_identity_invalid','named season cannot belong to another title');
create function pg_temp.p_request() returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','disneyplus','titleKey','disneyplus:series:01234567-1234-4321-9234-000070143836','providerSeriesId','01234567-1234-4321-9234-000070143836',
 'context',jsonb_build_object('region',null,'requestedLocale','en-US','audioLocale',null,'subtitleLocales','[]'::jsonb,'observedAt',clock_timestamp()),
 'historyAccess',jsonb_build_object('accessVersion',1,'accessEpoch',(resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111')#>'{history,accessEpoch}')));
$$;
create function pg_temp.p_snapshot(ctx jsonb) returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'provider','disneyplus','titleKey','disneyplus:series:01234567-1234-4321-9234-000070143836','providerSeriesId','01234567-1234-4321-9234-000070143836','title','Series','completeness','partial','context',ctx,
 'seasons',jsonb_build_array(jsonb_build_object('seasonKey','disneyplus:season:01234567-1234-4321-9234-000070143836:2','providerSeasonIdentifier','01234567-1234-4321-9234-000070143836:2','title','Season 2','seasonNumber',2,'order',0,
 'episodes',(select jsonb_agg(jsonb_build_object('episodeKey','disneyplus:episode:'||pg_temp.p_id(id),'providerEpisodeIdentifier',pg_temp.p_id(id),'title','Episode '||id,'episodeNumber',id-70196258,'order',id-70196259,'releasedAt',null,'available',true,
 'watchVariants',jsonb_build_array(jsonb_build_object('providerContentId',pg_temp.p_id(id),'audioLocale',null,'original',true,'order',0,'sourceUrl','https://www.disneyplus.com/play/'||pg_temp.p_id(id))))) from generate_series(70196259,70196260) id))));
$$;
insert into p_calls values('request',pg_temp.p_request());
insert into p_calls select 'begin',begin_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='request';
select is((select value->>'provider' from p_calls where name='begin'),'disneyplus','catalog begin acknowledges actual provider');
insert into p_calls select 'commit',r.value||jsonb_build_object('revision',b.value->'revision','snapshot',pg_temp.p_snapshot(r.value->'context')) from p_calls r,p_calls b where r.name='request' and b.name='begin';
select throws_ok($$select apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',jsonb_set(value,'{snapshot,provider}','"crunchyroll"')) from p_calls where name='commit'$$,'22023','watch_catalog_invalid','commit cannot mix providers');
select throws_ok($$select apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',jsonb_set(value,'{snapshot,seasons,0,episodes,0,watchVariants,0,providerContentId}','"70196260"')) from p_calls where name='commit'$$,'22023','watch_catalog_invalid','Disney+ catalog variant cannot alias a different episode');
select is(apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='commit'))->>'outcome','applied','Disney+ partial catalog commits');
select is(apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='commit'))->>'outcome','applied','Disney+ catalog commit replay is idempotent');
-- Partial evidence remains partial and does not manufacture unseen grid rows.
select is(watch_catalog_read_v3('e1111111-1111-4111-8111-111111111111',1,'disneyplus','disneyplus:series:01234567-1234-4321-9234-000070143836')->>'state','partial','partial catalog never claims completeness');
select is((select snapshot->>'completeness' from watch_catalog_snapshots where user_id='e1111111-1111-4111-8111-111111111111' and provider='disneyplus'),'partial','proven partial Disney+ inventory is retained');
select is(jsonb_array_length(get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'disneyplus','disneyplus:series:01234567-1234-4321-9234-000070143836')->'episodes'),2,'partial editor includes the proven unplayed episode');
select is(get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'disneyplus','disneyplus:series:01234567-1234-4321-9234-000070143836')->>'catalogComplete','false','observed episodes do not claim a complete series');
select is(jsonb_array_length(get_watch_history_editor_v1_prime_navigation_v1('e1111111-1111-4111-8111-111111111111',1,'disneyplus','disneyplus:series:01234567-1234-4321-9234-000070143836')->'episodes'),2,'navigation editor exposes the same observed episodes');
select is(apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',(select jsonb_set(value,'{snapshot,seasons,0,episodes}','[]') from p_calls where name='commit'))->>'outcome','applied','partial duplicate remains idempotent');
select is((select jsonb_array_length(snapshot#>'{seasons,0,episodes}') from watch_catalog_snapshots where provider='disneyplus'),2,'a duplicate partial attempt cannot overwrite its first inventory');
select ok(not has_function_privilege('anon','public.get_watch_history_capacity_v4(uuid,bigint)','EXECUTE'),'anonymous capacity denied');
select ok(has_function_privilege('service_role','public.get_watch_history_capacity_v4(uuid,bigint)','EXECUTE'),'server capacity role retained');
select ok(not has_function_privilege('service_role','anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)','EXECUTE'),'private writer remains inaccessible to service role');
set local role authenticated;
select throws_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111','{}')$$,'42501',null,'authenticated direct personal writer denied');
select throws_ok($$select begin_watch_catalog_v3('e1111111-1111-4111-8111-111111111111','{}')$$,'42501',null,'authenticated direct catalog writer denied');
reset role;
-- Exercise the actual public -> private creation core, not only table checks.
select is((select room_record->>'source_provider' from create_room_with_active_session_v3(
 'e1111111-1111-4111-8111-111111111111','disneyplus-create',null,null,'disneyplus','https://www.disneyplus.com/play/01234567-1234-4321-9234-000081078819','disneyplus|play/01234567-1234-4321-9234-000081078819',1,null,'disneyplus-create-request','plus',6,6,true,true,3)),
 'disneyplus','public room creation traverses private core with Disney+ source');
-- Canonical room sources, generation conflict and provider pin remain enforced.
insert into rooms(room_id,host_user_id,status,source_provider,source_url,video_fingerprint,source_generation)
values('disneyplus-local-room','e1111111-1111-4111-8111-111111111111','lobby','disneyplus','https://www.disneyplus.com/play/01234567-1234-4321-9234-000070196259','disneyplus|play/01234567-1234-4321-9234-000070196259',1);
select is((select outcome from persist_room_source_v1('disneyplus-local-room','disneyplus','https://www.disneyplus.com/play/01234567-1234-4321-9234-000070196260','disneyplus|play/01234567-1234-4321-9234-000070196260',2)),'persisted','Disney+ room source advances');
select is((select outcome from persist_room_source_v1('disneyplus-local-room','disneyplus','https://www.disneyplus.com/play/01234567-1234-4321-9234-000070196259','disneyplus|play/01234567-1234-4321-9234-000070196259',1)),'stale','stale Disney+ source cannot replace room');
select throws_ok($$select persist_room_source_v1('disneyplus-local-room','youtube','https://www.youtube.com/watch?v=abcdef','youtube|abcdef',3)$$,'23514','room_source_provider_conflict','room stays provider-pinned');
select throws_ok($$select persist_room_source_v1('disneyplus-local-room','disneyplus','https://www.disneyplus.com/play/01234567-1234-4321-9234-000070196260','disneyplus|play/AAAAAAAAAAAAAAAAAAAAAAA999',3)$$,'22023','room_source_invalid_input','room rejects mismatched fingerprint');
select is((select outcome from persist_room_source_v2(null,'disneyplus-local-room','disneyplus','https://www.disneyplus.com/play/01234567-1234-4321-9234-000070196261','disneyplus|play/01234567-1234-4321-9234-000070196261',3)),'persisted','current persistence endpoint advances the Disney+ room');
-- Both checkpoint kinds are real native 'ended' events. Only the content
-- position distinguishes a short Disney+ segment from a completed title.
insert into p_calls values ('segment_end', pg_temp.p_input(pg_temp.p_event(false,pg_temp.p_id(907)) ||
 jsonb_build_object('currentTime',5,'duration',2795,'progress',5.0/2795,'kind','ended')));
insert into p_calls select 'segment_ack',apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',value)
 from p_calls where name='segment_end';
select is((select current_time_seconds from watch_episode_progress where raw_content_id=pg_temp.p_id(907)),5::double precision,'segment checkpoint retains the content position');
select ok((select completed_at is null from watch_episode_progress where raw_content_id=pg_temp.p_id(907)),'early native ended leaves the episode in progress');
select is(apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='segment_end')),
 (select value from p_calls where name='segment_ack'),'an unmodified early-ended envelope can be replayed');
select lives_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event(false,pg_temp.p_id(907)) ||
 jsonb_build_object('currentTime',2795,'duration',2795,'progress',1,'kind','ended')))$$,'real end of the title is accepted');
select ok((select completed_at is not null from watch_episode_progress where raw_content_id=pg_temp.p_id(907)),'the completed title is marked watched');
select * from finish();
rollback;
