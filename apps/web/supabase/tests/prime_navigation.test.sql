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

create function pg_temp.nav(id text default '0IUGS56V361WRU60PCC5XH5D8Z') returns jsonb language sql as $$
select jsonb_build_object('contentId',id,'routes',jsonb_build_array(jsonb_build_object('url','https://www.amazon.com/gp/video/detail/B0FX2ZCPFK','observedAt','2026-11-16T00:00:00Z'))); $$;
select ok(prime_navigation_valid_v1(pg_temp.nav(),'primevideo','https://www.primevideo.com/detail/0IUGS56V361WRU60PCC5XH5D8Z'),'exact observed ASIN route accepted alongside canonical source');
select ok(not prime_navigation_valid_v1(pg_temp.nav(),'youtube','https://www.primevideo.com/detail/0IUGS56V361WRU60PCC5XH5D8Z'),'foreign provider rejects hints');
select ok(not prime_navigation_valid_v1(pg_temp.nav(),'primevideo','https://www.primevideo.com/detail/0GS9E1N0I97ENRMJPEH38ZYO1J'),'wrong canonical content rejects hints');
select ok(not prime_navigation_valid_v1(jsonb_set(pg_temp.nav(),'{routes,0,url}',to_jsonb(url)),'primevideo','https://www.primevideo.com/detail/0IUGS56V361WRU60PCC5XH5D8Z'),'reject raw unsafe route '||url)
from (values ('https://www.amazon.com:443/gp/video/detail/B0FX2ZCPFK'),('https://www.amazon.com.evil.test/gp/video/detail/B0FX2ZCPFK'),('https://user@www.amazon.com/gp/video/detail/B0FX2ZCPFK'),('https://www.amazon.com/gp/video/../video/detail/B0FX2ZCPFK'),('https://www.amazon.com/gp/video/detail/B0FX2ZCPFK?token=secret'),('https://www.amazon.com/gp/video/detail/B0FX2ZCPFK#token'),('https://www.amazon.com/gp/video/detail/%252e%252e')) v(url);
select ok(not prime_navigation_valid_v1(jsonb_set(pg_temp.nav(),'{routes}',(pg_temp.nav()->'routes')||(pg_temp.nav()->'routes')),'primevideo','https://www.primevideo.com/detail/0IUGS56V361WRU60PCC5XH5D8Z'),'duplicate marketplace rejected');
create temporary table result(value jsonb);
insert into result select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event(true,'0IUGS56V361WRU60PCC5XH5D8Z')||jsonb_build_object('primeNavigation',pg_temp.nav())));
select is((select value#>'{episode,primeNavigation}' from result),pg_temp.nav(),'progress acknowledgement retains exact observed route');
select is((select prime_navigation from watch_episode_progress where user_id='e1111111-1111-4111-8111-111111111111'),pg_temp.nav(),'progress writes route durably');
select lives_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event(true,'0IUGS56V361WRU60PCC5XH5D8Z')))$$,'legacy same-content write remains accepted');
select is((select prime_navigation from watch_episode_progress where user_id='e1111111-1111-4111-8111-111111111111'),pg_temp.nav(),'legacy same-content update preserves prior route');
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,10,3)#>'{progressRows,0,prime_navigation}',pg_temp.nav(),'other device history read roundtrips exact route');
insert into rooms(room_id,host_user_id,status,source_provider,source_url,video_fingerprint,source_generation,prime_navigation) values('prime-nav-room','e1111111-1111-4111-8111-111111111111','live','primevideo','https://www.primevideo.com/detail/0IUGS56V361WRU60PCC5XH5D8Z','primevideo|detail/0IUGS56V361WRU60PCC5XH5D8Z',1,pg_temp.nav());
select lives_ok($$select persist_room_source_v2(pg_temp.nav(),'prime-nav-room','primevideo','https://www.primevideo.com/detail/0IUGS56V361WRU60PCC5XH5D8Z','primevideo|detail/0IUGS56V361WRU60PCC5XH5D8Z',1)$$,'same generation replay accepted');
select lives_ok($$select persist_room_source_v1('prime-nav-room','primevideo','https://www.primevideo.com/detail/0GS9E1N0I97ENRMJPEH38ZYO1J','primevideo|detail/0GS9E1N0I97ENRMJPEH38ZYO1J',2)$$,'legacy source switching stays accepted');
select is((select prime_navigation from rooms where room_id='prime-nav-room'),null,'different source clears old hint in same transaction');
select ok(not has_function_privilege('authenticated','public.persist_room_source_v2(jsonb,text,text,text,text,bigint)','execute'),'authenticated cannot call internal durable source writer');
select ok(not has_function_privilege('anon','public.prime_navigation_valid_v1(jsonb,text,text)','execute'),'navigation helper is not public RPC');
select lives_ok($$select persist_room_source_v2(jsonb_set(pg_temp.nav('0GS9E1N0I97ENRMJPEH38ZYO1J'),'{routes,0,observedAt}','"2026-11-16T01:00:00Z"'),'prime-nav-room','primevideo','https://www.primevideo.com/detail/0GS9E1N0I97ENRMJPEH38ZYO1J','primevideo|detail/0GS9E1N0I97ENRMJPEH38ZYO1J',2)$$,'same-content route can be supplied to existing legacy generation');
select lives_ok($$select persist_room_source_v2(pg_temp.nav('0GS9E1N0I97ENRMJPEH38ZYO1J'),'prime-nav-room','primevideo','https://www.primevideo.com/detail/0GS9E1N0I97ENRMJPEH38ZYO1J','primevideo|detail/0GS9E1N0I97ENRMJPEH38ZYO1J',2)$$,'observation timestamp cannot change same generation authority');
select ok(prime_navigation_valid_v1(jsonb_set(pg_temp.nav(),'{routes,0,url}','"https://www.amazon.de/gp/video/detail/Gr%C3%BC%C3%9Fe/B0FX2ZCPFK"'),'primevideo','https://www.primevideo.com/detail/0IUGS56V361WRU60PCC5XH5D8Z'),'percent encoded Unicode title slug is admitted without URL rewriting');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":3}','titles')#>'{progressRows,0,prime_navigation}',pg_temp.nav(),'browse projection preserves exact route');
select is(get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:movie:0IUGS56V361WRU60PCC5XH5D8Z')#>'{episodes,0,primeNavigation}',pg_temp.nav(),'editor Resume movie keeps durable exact route');
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

select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event()));
create temporary table p_calls(name text primary key,value jsonb);
insert into p_calls values('request',pg_temp.p_request());
insert into p_calls select 'begin',begin_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='request';
insert into p_calls select 'commit',r.value||jsonb_build_object('revision',b.value->'revision','snapshot',
 jsonb_set(jsonb_set(jsonb_set(pg_temp.p_snapshot(r.value->'context'),'{completeness}','"complete"'),'{seasons,0,episodes,0,watchVariants,0,primeNavigation}',pg_temp.nav('AAAAAAAAAAAAAAAAAA70196259')),
 '{seasons,0,episodes,1,watchVariants,0,primeNavigation}',jsonb_set(pg_temp.nav('AAAAAAAAAAAAAAAAAA70196260'),'{routes,0,url}','"https://www.amazon.com/gp/video/detail/B000000002"')))
 from p_calls r,p_calls b where r.name='request' and b.name='begin';
select lives_ok($$select apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='commit'$$,'complete catalog accepts individually mapped unseen episodes');
select is((select snapshot#>>'{seasons,0,episodes,1,watchVariants,0,primeNavigation,routes,0,url}' from watch_catalog_snapshots where provider='primevideo'),'https://www.amazon.com/gp/video/detail/B000000002','unseen episode exact link survives durable catalog snapshot');
select is(get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:series:AAAAAAAAAAAAAAAAAA70143836')#>>'{episodes,1,primeNavigation,routes,0,url}','https://www.amazon.com/gp/video/detail/B000000002','zero-progress editor episode keeps its own route');
select is(get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'primevideo','primevideo:series:AAAAAAAAAAAAAAAAAA70143836')#>>'{episodes,1,currentTime}','0','unseen launch remains zero time');
-- Linear map traversal at the existing maximum episode bound; no per-row snapshot rescan.
create temporary table large_map as select public.prime_navigation_map_v1(jsonb_build_object('seasons',jsonb_build_array(jsonb_build_object('episodes',(select jsonb_agg(jsonb_build_object('watchVariants',jsonb_build_array(jsonb_build_object('sourceUrl','https://www.primevideo.com/detail/'||lpad(i::text,26,'A'),'primeNavigation',pg_temp.nav(lpad(i::text,26,'A')))))) from generate_series(1,2000) i))))) hints;
select is((select count(*)::integer from large_map,jsonb_object_keys(hints)),2000,'2000 exact episode mappings remain bounded and complete in the projection map');
select is(public.enrich_prime_projection_v1('{"sourceUrl":"https://www.primevideo.com/detail/AAAAAAAAAAAAAAAAAAAAAA2000"}',(select hints from large_map))#>>'{primeNavigation,contentId}','AAAAAAAAAAAAAAAAAAAAAA2000','projection finds the last episode without rescanning catalog per source');
select * from finish();
rollback;
