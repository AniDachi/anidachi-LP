begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
insert into public.users(id,email,display_name) values
('eeeeeeee-1111-4111-8111-111111111111','preview-owner@example.test','Preview owner'),
('eeeeeeee-2222-4222-8222-222222222222','preview-viewer@example.test','Preview viewer');
insert into public.rooms(room_id,host_user_id) values('preview-room','eeeeeeee-1111-4111-8111-111111111111');
insert into public.room_members(room_id,user_id) values('preview-room','eeeeeeee-2222-4222-8222-222222222222');
create function pg_temp.preview_watch(ep text,title_id text,shared boolean,at_time timestamptz,uid uuid default 'eeeeeeee-1111-4111-8111-111111111111',source_gen int default 1) returns void language plpgsql as $$
declare e jsonb; a jsonb;
begin
e:=jsonb_build_object('schemaVersion',3,'clientEventId',gen_random_uuid(),'clientSessionKey','preview-'||uid||'-'||ep,'accountGeneration',1,
'provider','crunchyroll','titleKey','crunchyroll:series:'||title_id,'episodeKey','crunchyroll:episode:'||ep,'seasonKey','crunchyroll:season:SS',
'itemKind','series','title','Preview '||title_id,'episodeTitle',ep,'seasonTitle','Season','seasonNumber',1,'episodeNumber',1,'artworkUrl',null,
'sourceUrl','https://www.crunchyroll.com/watch/'||ep,'currentTime',50,'duration',100,'progress',0.5,'kind','heartbeat','observedAt',at_time,
'crunchyrollIdentity',jsonb_build_object('providerSeriesId',title_id,'providerSeasonIdentifier','SS','providerEpisodeIdentifier',ep,'providerContentId',ep,'audioLocale',null));
if shared then
e:=e||jsonb_build_object('sharedRoom',jsonb_build_object('roomId','preview-room','participantSessionId','preview-'||uid,'roomGeneration',1,'sourceGeneration',source_gen));
a:=jsonb_build_object('sub',uid,'roomId','preview-room','participantSessionId','preview-'||uid,'roomGeneration',1,'sourceGeneration',source_gen,'iat',floor(extract(epoch from now())));
end if;
perform public.apply_watch_progress_v3(uid,e,a);
end $$;
select pg_temp.preview_watch('eligible-old-episode','MIX',true,now()-interval '1 minute');
select pg_temp.preview_watch('eligible-old-episode','MIX',true,now()-interval '1 minute','eeeeeeee-2222-4222-8222-222222222222');
do $$begin for n in 1..12 loop
perform pg_temp.preview_watch('SOLO'||n,'MIX',false,now());
perform pg_temp.preview_watch('MANY'||n,'MANY',true,now()-n*interval '1 second','eeeeeeee-1111-4111-8111-111111111111',100+n);
end loop; end $$;
insert into public.watch_history_session_groups(owner_user_id,history_generation,session_id,group_id,group_name)
select 'eeeeeeee-1111-4111-8111-111111111111',1,id,'eeeeeeee-3333-4333-8333-333333333333','Preview group' from public.watch_sessions where episode_key='crunchyroll:episode:eligible-old-episode';
create function pg_temp.preview(q jsonb) returns jsonb language plpgsql as $$
begin return public.browse_watch_history_v3('eeeeeeee-1111-4111-8111-111111111111',q,'titles');
exception when invalid_parameter_value then return '{}'::jsonb; end $$;
-- Assertions below this marker are also exercised by the production-parser test.
select is(jsonb_array_length(pg_temp.preview('{"mode":"shared","search":"MIX","includeEpisodePreviews":true}')->'episodePreviews'),1,'opt-in returns one preview per matching title');
select is(pg_temp.preview('{"mode":"shared","search":"MIX","includeEpisodePreviews":true}')#>>'{episodePreviews,0,progressRows,0,episode_key}','crunchyroll:episode:eligible-old-episode','preview finds matching episode outside canonical latest eight');
select is(pg_temp.preview('{"mode":"shared","search":"MIX","includeEpisodePreviews":true}')#>>'{episodePreviews,0,complete}','true','one matching episode is complete despite larger canonical count');
select is(pg_temp.preview('{"mode":"shared","search":"MIX","includeEpisodePreviews":true}')#>>'{titleSummaries,0,observedEpisodeCount}','13','canonical aggregates are unchanged');
select ok(not pg_temp.preview('{"mode":"solo"}')?'episodePreviews','old caller has exact old response keys');
select is(pg_temp.preview('{"mode":"shared","search":"MIX","includeEpisodePreviews":true}')-'episodePreviews',pg_temp.preview('{"mode":"shared","search":"MIX"}'),'opt-in leaves canonical legacy projection identical when evidence fits existing bound');
select is(jsonb_array_length(pg_temp.preview('{"mode":"solo","search":"MIX","includeEpisodePreviews":true}')#>'{episodePreviews,0,progressRows}'),8,'solo preview is bounded to eight');
select is(pg_temp.preview(jsonb_build_object('mode','shared','includeEpisodePreviews',true,'groupId','eeeeeeee-3333-4333-8333-333333333333','participantUserId','eeeeeeee-2222-4222-8222-222222222222','from',now()-interval '61 seconds','until',now()-interval '59 seconds'))#>>'{episodePreviews,0,progressRows,0,episode_key}','crunchyroll:episode:eligible-old-episode','group date participant filters combine before preview selection');
select is(jsonb_array_length(pg_temp.preview(jsonb_build_object('mode','shared','includeEpisodePreviews',true,'groupId','eeeeeeee-3333-4333-8333-333333333333','from',now()-interval '10 seconds'))->'episodePreviews'),0,'nonmatching date cannot leak canonical episodes');
create temp table preview_pages as select pg_temp.preview('{"mode":"shared","search":"MANY","limit":1,"includeEpisodePreviews":true}') p;
select is(jsonb_array_length(p#>'{episodePreviews,0,progressRows}'),8,'title limit does not shrink matching episode preview') from preview_pages;
select is(p#>>'{episodePreviews,0,complete}','false','matching ninth episode discloses continuation') from preview_pages;
create function pg_temp.preview_tail() returns jsonb language plpgsql as $$
declare c text; begin select p#>>'{episodePreviews,0,nextCursor}' into c from preview_pages;
if c is null then return '{}'::jsonb; end if;
return public.browse_watch_history_v3('eeeeeeee-1111-4111-8111-111111111111',jsonb_build_object('mode','shared','search','MANY','provider','crunchyroll','titleKey','crunchyroll:series:MANY','limit',20,'cursor',c),'episodes'); end $$;
select is(jsonb_array_length(pg_temp.preview_tail()->'progressRows'),4,'ordinary default20 episode request continues the initial eight');
select is((select count(distinct e->>'episode_key') from (select jsonb_array_elements(p#>'{episodePreviews,0,progressRows}') e from preview_pages union all select jsonb_array_elements(pg_temp.preview_tail()->'progressRows')) all_episodes),12::bigint,'continuation has no gaps or duplicates');
select throws_ok(format('select public.browse_watch_history_v3(%L::uuid,%L::jsonb,%L)','eeeeeeee-2222-4222-8222-222222222222',jsonb_build_object('mode','shared','search','MANY','provider','crunchyroll','titleKey','crunchyroll:series:MANY','limit',20,'cursor',p#>>'{episodePreviews,0,nextCursor}'),'episodes'),'22023','watch_history_browse_cursor_invalid','preview continuation is owner-bound') from preview_pages where p?'episodePreviews';
select throws_ok($$select public.browse_watch_history_v3('eeeeeeee-1111-4111-8111-111111111111','{"mode":"shared","includeEpisodePreviews":false}','titles')$$,'22023','watch_history_browse_invalid','SQL rejects a nontrue opt-in');
select throws_ok($$select public.browse_watch_history_v3('eeeeeeee-1111-4111-8111-111111111111','{"mode":"shared","includeEpisodePreviews":true,"provider":"crunchyroll","titleKey":"crunchyroll:series:MANY"}','episodes')$$,'22023','watch_history_browse_invalid','SQL rejects flag on episode requests');
do $$begin for n in 1..25 loop perform pg_temp.preview_watch('MANY1','MANY',true,now(),'eeeeeeee-1111-4111-8111-111111111111',200+n); end loop; end $$;
select is(jsonb_array_length(pg_temp.preview('{"mode":"shared","search":"MANY"}')->'sessionIds'),20,'legacy canonical session load stays bounded20 per title');
select is(jsonb_array_length(pg_temp.preview('{"mode":"shared","search":"MANY","includeEpisodePreviews":true}')->'sessionIds'),27,'only opt-in enriches evidence for seven otherwise-unrepresented preview episodes');
select is(pg_temp.preview('{"mode":"shared","search":"MANY","includeEpisodePreviews":true}')#>>'{episodePreviews,0,matches,0,sessionsComplete}','false','two-session preview never claims all26 matching sessions complete');
-- Worst-shape evidence: the legacy top20 are all one episode, while seven
-- other preview episodes need two separate older sessions each, for 34/title.
do $$begin for t in 1..50 loop
for e in 1..8 loop for s in 1..2 loop
perform pg_temp.preview_watch('BOUND'||t||'E'||e,'BOUND'||t,true,now()-e*interval '1 minute','eeeeeeee-1111-4111-8111-111111111111',10000+t*1000+e*10+s);
end loop; end loop;
for s in 1..24 loop
perform pg_temp.preview_watch('BOUND'||t||'E1','BOUND'||t,true,now(),'eeeeeeee-1111-4111-8111-111111111111',10000+t*1000+500+s);
end loop; end loop; end $$;
create temp table bounded_preview as select pg_temp.preview('{"mode":"shared","search":"BOUND","limit":50,"includeEpisodePreviews":true}') p;
select is(jsonb_array_length(p->'episodePreviews'),50,'largest title page returns50 previews') from bounded_preview;
select is((select sum(jsonb_array_length(v->'progressRows')) from jsonb_array_elements(p->'episodePreviews') v),400::bigint,'largest title page adds only400 canonical preview rows') from bounded_preview;
select is(jsonb_array_length(p->'sessionIds'),1700,'largest adversarial page remains under1800 session ceiling') from bounded_preview;
select is(jsonb_array_length(pg_temp.preview('{"mode":"shared","search":"BOUND","limit":50}')->'sessionIds'),1000,'same legacy request retains1000 session ceiling');
select diag('PREVIEW_BOUND_BYTES='||octet_length(p::text)||'; sessions='||jsonb_array_length(p->'sessionIds')) from bounded_preview;
update public.user_watch_settings set history_generation=2 where user_id='eeeeeeee-1111-4111-8111-111111111111';
select throws_ok($$select pg_temp.preview_tail()$$,'22023','watch_history_browse_cursor_invalid','preview continuation is generation-bound') where exists(select 1 from preview_pages where p?'episodePreviews');
select * from finish();
rollback;
