begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='30s';
set local lock_timeout='3s';
select no_plan();
create function pg_temp.p_id(id integer) returns text language sql immutable as $$ select '01234567-1234-4321-9234-'||lpad(id::text,12,'0'); $$;
insert into users(id,email,display_name) values
 ('e1111111-1111-4111-8111-111111111111','hbomax-owner@example.test','HBO Max'),
 ('e2222222-2222-4222-8222-222222222222','hbomax-other@example.test','Other');
insert into account_manual_plan_grants(user_id,plan_code,reason) values ('e1111111-1111-4111-8111-111111111111','plus','test');
select resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111');
create function pg_temp.p_event(movie boolean default false, id text default '01234567-1234-4321-9234-000070196259', series text default '01234567-1234-4321-9234-000070143836') returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','hbomax',
 'titleKey',case when movie then 'hbomax:movie:'||series else 'hbomax:series:'||series end,
 'episodeKey',case when movie then 'hbomax:movie:'||id else 'hbomax:episode:'||id end,
 'seasonKey',case when movie then null else 'hbomax:season:'||series||':2' end,
 'itemKind',case when movie then 'movie' else 'series' end,'title',case when movie then 'Movie' else 'Series' end,
 'episodeTitle',case when movie then 'Movie' else 'Episode' end,
 'seasonTitle',case when movie then null else 'Season 2' end,'seasonNumber',case when movie then null else 2 end,
 'episodeNumber',case when movie then null else 1 end,'artworkUrl','https://images.cdn.prd.api.discomax.com/YJfqK/AZSMHD71Ag5vb-HrQ.jpeg',
 'clientEventId',gen_random_uuid(),'clientSessionKey',gen_random_uuid()::text,'currentTime',300,'duration',1800,'progress',0.1666666667,
 'sourceUrl','https://www.hbomax.com/video/watch/'||id,'kind','pause','observedAt',clock_timestamp(),
 'hbomaxIdentity',case when movie then jsonb_build_object('kind','movie','providerMovieId',series,'providerPlaybackId',id) else
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
select is(apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='series')),(select value from p_calls where name='series_ack'),'HBO Max progress receipt is idempotent');
select lives_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='movie'$$,'standalone HBO Max movie is accepted');
select is((select raw_content_id from watch_episode_progress where provider='hbomax' and item_kind='movie'),'01234567-1234-4321-9234-000081078819','movie stores stable content identity');
select is(get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'hbomax','hbomax:movie:01234567-1234-4321-9234-000070143836')#>>'{episodes,0,episodeKey}','hbomax:movie:01234567-1234-4321-9234-000081078819','movie detail resolves independently to the playable item');
select is(get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'hbomax','hbomax:movie:01234567-1234-4321-9234-000070143836')#>>'{episodes,0,sourceUrl}','https://www.hbomax.com/video/watch/01234567-1234-4321-9234-000081078819','movie editor resumes the playable video');
select is((select season_key from watch_episode_progress where provider='hbomax' and item_kind='movie'),null,'movie has no invented season');
select is((select source_url from watch_episode_progress where provider='hbomax' and item_kind='series'),'https://www.hbomax.com/video/watch/01234567-1234-4321-9234-000070196259','series resume stores canonical actual episode URL');
select throws_ok($$select apply_personal_watch_progress_v1('e2222222-2222-4222-8222-222222222222',value) from p_calls where name='series'$$,'P0001','HISTORY_PLAN_REQUIRED','Free cannot write HBO Max progress');
select throws_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',pg_temp.p_input(pg_temp.p_event())||'{"accessEpoch":0}')$$,'P0001','HISTORY_ACCESS_CHANGED','HBO Max retains epoch fence');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"sourceUrl":"https://www.hbomax.com.evil.test/watch/70196259"}')$$,'22023','watch_history_identity_invalid','lookalike source rejected');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"youtubeVideoId":"abcdef"}')$$,'22023','watch_history_identity_invalid','foreign provider identity rejected');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event(true,'01234567-1234-4321-9234-000081078819')||'{"seasonKey":"hbomax:season:1"}')$$,'22023','watch_history_identity_invalid','movie cannot invent season');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event(false,'01'))$$,'22023','watch_history_identity_invalid','malformed UUID rejected');
select is(get_watch_history_capacity_v1('e1111111-1111-4111-8111-111111111111')->'providers','{"youtube":{"used":0,"limit":100},"crunchyroll":{"used":0,"limit":200}}'::jsonb,'v1 remains exact with HBO Max rows present');
select is(get_watch_history_capacity_v5('e1111111-1111-4111-8111-111111111111')->>'capacityVersion','5','v5 explicit capacity version');
select is(get_watch_history_capacity_v5('e1111111-1111-4111-8111-111111111111')#>>'{providers,hbomax,used}','2','movie and series occupy separate HBO Max slots');
select is(list_watch_history_v3_bounded_page('e1111111-1111-4111-8111-111111111111',1,1)->>'totalTitleCount','0','legacy list filters HBO Max before counting');
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,5)->>'totalTitleCount','2','negotiated list counts HBO Max');
select is(list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,5)->>'hasMore','true','negotiated list pagination includes HBO Max');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1}','titles')->>'totalTitleCount','0','legacy browse filters HBO Max before counting');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1,"providerVersion":5}','titles')->>'totalTitleCount','2','v5 browse counts HBO Max');
select is(browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","limit":1,"provider":"hbomax"}','titles')->>'totalTitleCount','2','explicit HBO Max provider opts in without version');
select throws_ok($$select browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":6}','titles')$$,'22023','watch_history_browse_invalid','SQL rejects unknown provider version');
select throws_ok($$select browse_watch_history_v3('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":null}','titles')$$,'22023','watch_history_browse_invalid','SQL rejects null provider version');
select throws_ok($$select list_watch_history_v3_provider_page('e1111111-1111-4111-8111-111111111111',1,1,6)$$,'22023','watch_history_invalid_page','SQL list rejects unknown provider version');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"artworkUrl":"https://disney.images.edge.bamgrid.com.evil.test/images/a"}')$$,'22023','watch_history_identity_invalid','SQL rejects artwork CDN lookalike');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"artworkUrl":"https://127.0.0.1/a"}')$$,'22023','watch_history_identity_invalid','SQL rejects artwork private host');
select is(list_watch_history_v3_provider_page_prime_navigation_v1('e1111111-1111-4111-8111-111111111111',1,1,4)->>'totalTitleCount','0','previous Disney+-enabled list omits HBO Max before pagination');
select is(browse_watch_history_v3_prime_navigation_v1('e1111111-1111-4111-8111-111111111111','{"mode":"personal","providerVersion":4}','titles')->>'totalTitleCount','0','previous Disney+-enabled browse omits HBO Max');
select ok(not (get_watch_history_capacity_v4('e1111111-1111-4111-8111-111111111111')->'providers' ? 'hbomax'),'capacity v4 remains exact');
select lives_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"seasonKey":null,"seasonTitle":null,"seasonNumber":null}')$$,'episode may have no established season');
select throws_ok($$select validate_watch_identity_v3(pg_temp.p_event()||'{"seasonNumber":3}')$$,'22023','watch_history_identity_invalid','season key must match series and number');
create function pg_temp.p_request() returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','hbomax','titleKey','hbomax:series:01234567-1234-4321-9234-000070143836','providerSeriesId','01234567-1234-4321-9234-000070143836',
 'context',jsonb_build_object('region',null,'requestedLocale','en-US','audioLocale',null,'subtitleLocales','[]'::jsonb,'observedAt',clock_timestamp()),
 'historyAccess',jsonb_build_object('accessVersion',1,'accessEpoch',(resolve_watch_history_access_v1('e1111111-1111-4111-8111-111111111111')#>'{history,accessEpoch}')));
$$;
create function pg_temp.p_snapshot(ctx jsonb) returns jsonb language sql as $$
 select jsonb_build_object('schemaVersion',3,'provider','hbomax','titleKey','hbomax:series:01234567-1234-4321-9234-000070143836','providerSeriesId','01234567-1234-4321-9234-000070143836','title','Series','completeness','partial','context',ctx,
 'seasons',jsonb_build_array(jsonb_build_object('seasonKey','hbomax:season:01234567-1234-4321-9234-000070143836:2','providerSeasonIdentifier','01234567-1234-4321-9234-000070143836:2','title','Season 2','seasonNumber',2,'order',0,
 'episodes',(select jsonb_agg(jsonb_build_object('episodeKey','hbomax:episode:'||pg_temp.p_id(id),'providerEpisodeIdentifier',pg_temp.p_id(id),'title','Episode '||id,'episodeNumber',id-70196258,'order',id-70196259,'releasedAt',null,'available',true,
 'watchVariants',jsonb_build_array(jsonb_build_object('providerContentId',pg_temp.p_id(id),'audioLocale',null,'original',true,'order',0,'sourceUrl','https://www.hbomax.com/video/watch/'||pg_temp.p_id(id))))) from generate_series(70196259,70196260) id))));
$$;
insert into p_calls values('request',pg_temp.p_request());
insert into p_calls select 'begin',begin_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',value) from p_calls where name='request';
select is((select value->>'provider' from p_calls where name='begin'),'hbomax','catalog begin acknowledges actual provider');
insert into p_calls select 'commit',r.value||jsonb_build_object('revision',b.value->'revision','snapshot',pg_temp.p_snapshot(r.value->'context')) from p_calls r,p_calls b where r.name='request' and b.name='begin';
select throws_ok($$select apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',jsonb_set(value,'{snapshot,provider}','"crunchyroll"')) from p_calls where name='commit'$$,'22023','watch_catalog_invalid','commit cannot mix providers');
select throws_ok($$select apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',jsonb_set(value,'{snapshot,seasons,0,episodes,0,watchVariants,0,providerContentId}','"70196260"')) from p_calls where name='commit'$$,'22023','watch_catalog_invalid','HBO Max catalog variant cannot alias a different episode');
select is(apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='commit'))->>'outcome','applied','HBO Max partial catalog commits');
select is(apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',(select value from p_calls where name='commit'))->>'outcome','applied','HBO Max catalog commit replay is idempotent');
-- Partial evidence remains partial and does not manufacture unseen grid rows.
select is(watch_catalog_read_v3('e1111111-1111-4111-8111-111111111111',1,'hbomax','hbomax:series:01234567-1234-4321-9234-000070143836')->>'state','partial','partial catalog never claims completeness');
select is((select snapshot->>'completeness' from watch_catalog_snapshots where user_id='e1111111-1111-4111-8111-111111111111' and provider='hbomax'),'partial','proven partial HBO Max inventory is retained');
select is(jsonb_array_length(get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'hbomax','hbomax:series:01234567-1234-4321-9234-000070143836')->'episodes'),2,'partial editor includes the proven unplayed episode');
select is(get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'hbomax','hbomax:series:01234567-1234-4321-9234-000070143836')->>'catalogComplete','false','observed episodes do not claim a complete series');
select is(jsonb_array_length(get_watch_history_editor_v1_prime_navigation_v1('e1111111-1111-4111-8111-111111111111',1,'hbomax','hbomax:series:01234567-1234-4321-9234-000070143836')->'episodes'),2,'navigation editor exposes the same observed episodes');
select is(apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',(select jsonb_set(value,'{snapshot,seasons,0,episodes}','[]') from p_calls where name='commit'))->>'outcome','applied','partial duplicate remains idempotent');
select is((select jsonb_array_length(snapshot#>'{seasons,0,episodes}') from watch_catalog_snapshots where provider='hbomax'),2,'a duplicate partial attempt cannot overwrite its first inventory');

-- Each begin goes through the paid public RPC and creates a new immutable revision.
create function pg_temp.refresh_hbo(reg text default null, loc text default 'en-US') returns jsonb language plpgsql as $$
declare req jsonb := pg_temp.p_request(); ack jsonb;
begin
  req:=jsonb_set(req,'{context}',req->'context'||jsonb_build_object('region',reg,'requestedLocale',loc));
  ack:=public.begin_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',req);
  return req||jsonb_build_object('revision',ack->'revision');
end $$;
create function pg_temp.commit_hbo(req jsonb, ids integer[], unavailable integer default null, state text default 'partial', season integer default 2)
returns text language plpgsql as $$
declare snap jsonb:=pg_temp.p_snapshot(req->'context'); base jsonb:=snap#>'{seasons,0,episodes,0}'; rows jsonb;
begin
  select coalesce(jsonb_agg(base||jsonb_build_object('episodeKey','hbomax:episode:'||pg_temp.p_id(i),
    'providerEpisodeIdentifier',pg_temp.p_id(i),'episodeNumber',i-70196258,'order',i-70196259,
    'available',i is distinct from unavailable,'watchVariants',jsonb_build_array(base#>'{watchVariants,0}'||
      jsonb_build_object('providerContentId',pg_temp.p_id(i),'sourceUrl','https://www.hbomax.com/video/watch/'||pg_temp.p_id(i))))),'[]'::jsonb)
    into rows from unnest(ids) i;
  snap:=jsonb_set(snap,'{seasons,0}',snap#>'{seasons,0}'||jsonb_build_object('episodes',rows,'seasonNumber',season,
    'title','Season '||season,'order',season-1,'seasonKey','hbomax:season:'||(req->>'providerSeriesId')||':'||season,
    'providerSeasonIdentifier',(req->>'providerSeriesId')||':'||season))||jsonb_build_object('completeness',state);
  return public.apply_watch_catalog_v3('e1111111-1111-4111-8111-111111111111',req||jsonb_build_object('snapshot',snap))->>'outcome';
end $$;
create function pg_temp.hbo_editor() returns jsonb language sql as $$
  select get_watch_history_editor_v1('e1111111-1111-4111-8111-111111111111',1,'hbomax','hbomax:series:01234567-1234-4321-9234-000070143836');
$$;
insert into p_calls values('subset',pg_temp.refresh_hbo());
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),2,'same-context pending refresh retains the published editor inventory');
select is(pg_temp.commit_hbo((select value from p_calls where name='subset'),array[70196259]),'applied','a short native-season refresh is acknowledged');
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),2,'a shorter partial cannot remove another previously observed episode');
select is(pg_temp.hbo_editor()#>>'{episodes,0,currentTime}','300','an inventory refresh preserves the viewer resume position');
select is(pg_temp.commit_hbo(pg_temp.refresh_hbo(),array[70196259,70196260,70196261]),'applied','a superset publishes additional episode IDs');
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),3,'the expanded roster reaches the editor');
select is(pg_temp.commit_hbo(pg_temp.refresh_hbo(),array[70196260],70196260),'applied','a subset can withdraw a specific prior episode');
select is(pg_temp.hbo_editor()#>>'{episodes,1,available}','false','a withdrawn episode cannot retain its former availability');
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),3,'a withdrawal updates only the observed episode');
select is(pg_temp.commit_hbo(pg_temp.refresh_hbo(),array[70196261,70196262]),'applied','incomparable partial membership is handled');
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),3,'incomparable partials are never unioned into a synthetic roster');
select is(pg_temp.hbo_editor()#>>'{episodes,1,available}','false','an unobserved episode cannot regain its withdrawn availability');
insert into p_calls values('region',pg_temp.refresh_hbo('CA'));
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),1,'new territory hides prior inventory immediately, retaining only personal history');
select is(pg_temp.commit_hbo((select value from p_calls where name='region'),array[70196259,70196262]),'applied','new territory may publish its own smaller inventory');
select is(pg_temp.hbo_editor()#>>'{episodes,1,episodeKey}','hbomax:episode:'||pg_temp.p_id(70196262),'new territory does not inherit another territory episode');
select is(pg_temp.commit_hbo((select value from p_calls where name='subset'),array[70196259,70196260]),'superseded','delayed partial cannot restore a previous context');
insert into p_calls values('locale',pg_temp.refresh_hbo('CA','fr-CA'));
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),1,'new locale hides prior partial labels during collection');
-- A directly watched episode is durable even when an unrelated partial cannot
-- prove that the other season's *unplayed* catalog belongs to this market.
select is(pg_temp.commit_hbo(pg_temp.refresh_hbo(),array[70196259,70196260],null,'partial',1),'applied','restore only a confirmed season 1 in unknown territory');
select is(pg_temp.commit_hbo(pg_temp.refresh_hbo(),array[70196270,70196271],null,'partial',2),'applied','a disjoint season 2 fallback cannot establish same market');
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),2,'unplayed episodes from disjoint observations are not synthesized across unknown markets');
select lives_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111',
  pg_temp.p_input(pg_temp.p_event(false,pg_temp.p_id(70196270))||'{"episodeNumber":1,"currentTime":450,"progress":0.25}'))$$,
  'newly watched season 2 episode records its own position despite an inconclusive catalog refresh');
select is((select e->>'currentTime' from jsonb_array_elements(pg_temp.hbo_editor()->'episodes') e
  where e->>'episodeKey'='hbomax:episode:'||pg_temp.p_id(70196270)),'450','editor combines saved season 1 with real season 2 personal progress');
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),3,'personal season 2 joins exactly once without dropping season 1');
update p_calls set value=pg_temp.refresh_hbo('CA','fr-CA') where name='locale';
select is(pg_temp.commit_hbo((select value from p_calls where name='locale'),array[70196259],null,'complete'),'applied','authoritative complete replaces partial membership');
select is(pg_temp.hbo_editor()->>'catalogComplete','true','a verified regional catalog retains complete semantics');
select is(jsonb_array_length(pg_temp.hbo_editor()->'episodes'),2,'authoritative replacement removes old unplayed IDs and retains cross-season personal progress');
select ok(not has_function_privilege('service_role','anidachi_history_private.hbomax_partial_catalog(jsonb,jsonb)','EXECUTE'),'private partial resolver stays behind the guarded public writer');
select ok(not has_function_privilege('anon','public.get_watch_history_capacity_v5(uuid,bigint)','EXECUTE'),'anonymous capacity denied');
select ok(has_function_privilege('service_role','public.get_watch_history_capacity_v5(uuid,bigint)','EXECUTE'),'server capacity role retained');
select ok(not has_function_privilege('service_role','anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)','EXECUTE'),'private writer remains inaccessible to service role');
set local role authenticated;
select throws_ok($$select apply_personal_watch_progress_v1('e1111111-1111-4111-8111-111111111111','{}')$$,'42501',null,'authenticated direct personal writer denied');
select throws_ok($$select begin_watch_catalog_v3('e1111111-1111-4111-8111-111111111111','{}')$$,'42501',null,'authenticated direct catalog writer denied');
reset role;
-- Exercise the actual public -> private creation core, not only table checks.
select is((select room_record->>'source_provider' from create_room_with_active_session_v3(
 'e1111111-1111-4111-8111-111111111111','hbomax-create',null,null,'hbomax','https://www.hbomax.com/video/watch/01234567-1234-4321-9234-000081078819','hbomax|video/watch/01234567-1234-4321-9234-000081078819',1,null,'hbomax-create-request','plus',6,6,true,true,3)),
 'hbomax','public room creation traverses private core with HBO Max source');
-- Canonical room sources, generation conflict and provider pin remain enforced.
insert into rooms(room_id,host_user_id,status,source_provider,source_url,video_fingerprint,source_generation)
values('hbomax-local-room','e1111111-1111-4111-8111-111111111111','lobby','hbomax','https://www.hbomax.com/video/watch/01234567-1234-4321-9234-000070196259','hbomax|video/watch/01234567-1234-4321-9234-000070196259',1);
select is((select outcome from persist_room_source_v1('hbomax-local-room','hbomax','https://www.hbomax.com/video/watch/01234567-1234-4321-9234-000070196260','hbomax|video/watch/01234567-1234-4321-9234-000070196260',2)),'persisted','HBO Max room source advances');
select is((select outcome from persist_room_source_v1('hbomax-local-room','hbomax','https://www.hbomax.com/video/watch/01234567-1234-4321-9234-000070196259','hbomax|video/watch/01234567-1234-4321-9234-000070196259',1)),'stale','stale HBO Max source cannot replace room');
select throws_ok($$select persist_room_source_v1('hbomax-local-room','youtube','https://www.youtube.com/watch?v=abcdef','youtube|abcdef',3)$$,'23514','room_source_provider_conflict','room stays provider-pinned');
select throws_ok($$select persist_room_source_v1('hbomax-local-room','hbomax','https://www.hbomax.com/video/watch/01234567-1234-4321-9234-000070196260','hbomax|video/watch/AAAAAAAAAAAAAAAAAAAAAAA999',3)$$,'22023','room_source_invalid_input','room rejects mismatched fingerprint');
select is((select outcome from persist_room_source_v2(null,'hbomax-local-room','hbomax','https://www.hbomax.com/video/watch/01234567-1234-4321-9234-000070196261','hbomax|video/watch/01234567-1234-4321-9234-000070196261',3)),'persisted','current persistence endpoint advances the HBO Max room');
select * from finish();
rollback;
