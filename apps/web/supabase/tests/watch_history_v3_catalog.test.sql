begin;
create extension if not exists pgtap with schema extensions;
set role postgres;
set search_path = public, extensions;
select no_plan();
select has_function('public', 'begin_watch_catalog_v3', array['uuid','jsonb'], 'v3 issues account-scoped catalog revisions');
select has_function('public', 'apply_watch_catalog_v3', array['uuid','jsonb'], 'v3 commits a fenced catalog');
select has_function('public', 'apply_watch_progress_v3', array['uuid','jsonb','jsonb'], 'v3 records canonical progress');
select throws_ok($$select public.apply_watch_progress_v2('11111111-1111-4111-8111-111111111111', '{"schemaVersion":2}', null)$$, '22023', 'watch_history_upgrade_required', 'late schema 2 writer is terminal');
insert into public.users(id,email,display_name) values('99999999-1111-4111-8111-111111111111','catalog-v3@example.test','Catalog');
create function pg_temp.request() returns jsonb language sql as $$
select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','crunchyroll','titleKey','crunchyroll:series:S','providerSeriesId','S',
  'context',jsonb_build_object('region','US','requestedLocale','ja-JP','audioLocale','ja-JP','subtitleLocales','[]'::jsonb,'observedAt',statement_timestamp()));
$$;
create function pg_temp.event(raw_id text,seconds integer,kind text default 'heartbeat') returns jsonb language sql as $$
select jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','crunchyroll','titleKey','crunchyroll:series:S',
  'seasonKey','crunchyroll:season:SS','episodeKey','crunchyroll:episode:E','itemKind','series','title','Observed English',
  'episodeTitle','Episode','seasonTitle','Season','seasonNumber',1,'episodeNumber',1,'artworkUrl',null,
  'clientEventId',gen_random_uuid(),'clientSessionKey','catalog-session','currentTime',seconds,'duration',100,'progress',seconds::double precision/100,
  'sourceUrl','https://www.crunchyroll.com/watch/'||raw_id,'kind',kind,'sharedRoom',null,'observedAt',clock_timestamp(),
  'crunchyrollIdentity',jsonb_build_object('providerSeriesId','S','providerSeasonIdentifier','SS','providerEpisodeIdentifier','E','providerContentId',raw_id,'audioLocale',case when raw_id='RAW_EN' then 'en-US' else 'ja-JP' end));
$$;
create function pg_temp.snapshot(ctx jsonb) returns jsonb language sql as $$
select jsonb_build_object('schemaVersion',3,'provider','crunchyroll','titleKey','crunchyroll:series:S','providerSeriesId','S','title','Localized catalog','completeness','complete','context',ctx,
  'seasons',jsonb_build_array(jsonb_build_object('seasonKey','crunchyroll:season:SS','providerSeasonIdentifier','SS','title','Localized season','seasonNumber',1,'order',0,
    'episodes',jsonb_build_array(jsonb_build_object('episodeKey','crunchyroll:episode:E','providerEpisodeIdentifier','E','title','Localized episode','episodeNumber',1,'order',0,'releasedAt',null,'available',true,
      'watchVariants',jsonb_build_array(jsonb_build_object('providerContentId','RAW_JA','audioLocale','ja-JP','original',true,'order',0,'sourceUrl','https://www.crunchyroll.com/watch/RAW_JA'),
        jsonb_build_object('providerContentId','RAW_EN','audioLocale','en-US','original',false,'order',1,'sourceUrl','https://www.crunchyroll.com/watch/RAW_EN')))))));
$$;
create temporary table calls(name text primary key,payload jsonb);
insert into calls values('request',pg_temp.request());
select throws_ok($$select public.begin_watch_catalog_v3('99999999-1111-4111-8111-111111111111',pg_temp.request()||'{"contentHash":"untrusted"}')$$,'22023','watch_catalog_invalid','client cannot supply accepted hashes');
select throws_ok($$select public.begin_watch_catalog_v3('99999999-1111-4111-8111-111111111111',pg_temp.request()||jsonb_build_object('titleKey','crunchyroll:series:'||repeat('😀',110),'providerSeriesId',repeat('😀',110)))$$,'22023','watch_catalog_invalid','stable key bounds count UTF16 units');
select lives_ok($$select public.begin_watch_catalog_v3('99999999-1111-4111-8111-111111111111',jsonb_set(pg_temp.request(),'{context,observedAt}','"2026-09-05T01:02Z"'))$$,'shared schema accepts minute-precision ISO timestamps');
insert into calls select 'begin', public.begin_watch_catalog_v3('99999999-1111-4111-8111-111111111111',payload) from calls where name='request';
select is((select payload->>'refreshRequired' from calls where name='begin'),'true','first interaction issues refresh');
select is((select count(*) from public.watch_history_title_summaries where user_id='99999999-1111-4111-8111-111111111111'),0::bigint,'catalog begin never creates watched card');
insert into calls select 'commit',r.payload||jsonb_build_object('revision',b.payload->'revision','snapshot',pg_temp.snapshot(r.payload->'context')) from calls r,calls b where r.name='request' and b.name='begin';
select throws_ok(format('select public.apply_watch_catalog_v3(%L,%L::jsonb)','99999999-1111-4111-8111-111111111111',payload#-'{snapshot,completeness}'),'22023','watch_catalog_invalid','missing completeness is not complete') from calls where name='commit';
select throws_ok(format('select public.apply_watch_catalog_v3(%L,%L::jsonb)','99999999-1111-4111-8111-111111111111',jsonb_set(payload,'{snapshot,completeness}','null')),'22023','watch_catalog_invalid','null completeness is not complete') from calls where name='commit';
select throws_ok(format('select public.begin_watch_catalog_v3(%L,%L::jsonb)','99999999-1111-4111-8111-111111111111',jsonb_set(pg_temp.request(),path,value)),'22023','watch_catalog_invalid',label)
from (values ('{context,subtitleLocales}'::text[],'[12]'::jsonb,'subtitle elements must be strings'),('{context,audioLocale}',to_jsonb(repeat('a',36)),'audio locale is bounded'),('{context,requestedLocale}','123','requested locale must be string'),('{context,observedAt}','"yesterday"','context timestamp is strict'),('{accountGeneration}','"1"','generation is a number')) invalid(path,value,label);
select throws_ok(format('select public.begin_watch_catalog_v3(%L,%L::jsonb)','99999999-1111-4111-8111-111111111111',pg_temp.request()#-array['context',field]),'22023','watch_catalog_invalid','context requires '||field) from unnest(array['region','requestedLocale','audioLocale','subtitleLocales','observedAt']) field;
select throws_ok(format('select public.begin_watch_catalog_v3(%L,%L::jsonb)','99999999-1111-4111-8111-111111111111',jsonb_set(pg_temp.request(),'{context,requestedLocale}',to_jsonb(chr(160)||'en-US'))),'22023','watch_catalog_invalid','locale must arrive normalized before persistence');
select throws_ok(format('select public.apply_watch_catalog_v3(%L,%L::jsonb)','99999999-1111-4111-8111-111111111111',jsonb_set(jsonb_set(payload,'{snapshot,completeness}','"partial"'),'{snapshot,seasons,0,episodes,0,episodeNumber}','-1')),'22023','watch_catalog_invalid','partial inventory still validates nested types and bounds') from calls where name='commit';
select throws_ok(format('select public.apply_watch_catalog_v3(%L,%L::jsonb)','99999999-1111-4111-8111-111111111111',jsonb_set(payload,path,value)),'22023','watch_catalog_invalid',label)
from calls cross join (values ('{snapshot,title}'::text[],'123'::jsonb,'catalog title is a string'),('{snapshot,seasons,0,seasonNumber}','-1','season number nonnegative'),('{snapshot,seasons,0,episodes,0,episodeNumber}','-1','episode number nonnegative'),('{snapshot,seasons,0,episodes,0,watchVariants,0,original}','"true"','original is boolean'),('{snapshot,seasons,0,episodes,0,releasedAt}','"yesterday"','release timestamp strict'),('{snapshot,seasons,0,episodes,0,order}','"1"','order is numeric'),('{snapshot,seasons,0,episodes,0,watchVariants,0,audioLocale}',to_jsonb(repeat('a',36)),'variant locale bounded')) invalid(path,value,label) where name='commit';
select is(public.apply_watch_catalog_v3('99999999-1111-4111-8111-111111111111',(select payload from calls where name='commit'))->>'outcome','applied','complete catalog commits');
select is((select count(*) from public.watch_catalog_aliases where user_id='99999999-1111-4111-8111-111111111111'),2::bigint,'server derives two variants');
select is((select projection#>>'{aggregate,availableEpisodes}' from public.watch_catalog_snapshots where user_id='99999999-1111-4111-8111-111111111111'),'1','two audio variants count once');
select is(public.apply_watch_catalog_v3('99999999-1111-4111-8111-111111111111',(select jsonb_set(payload,'{snapshot,seasons,0,episodes,0,watchVariants}',jsonb_build_array(payload#>'{snapshot,seasons,0,episodes,0,watchVariants,1}',payload#>'{snapshot,seasons,0,episodes,0,watchVariants,0}')) from calls where name='commit'))->>'acceptedHash',(select accepted_hash from public.watch_catalog_snapshots where user_id='99999999-1111-4111-8111-111111111111'),'server normalizes variant ordering before hashing');
select is(public.begin_watch_catalog_v3('99999999-1111-4111-8111-111111111111',(select payload from calls where name='request'))->>'refreshRequired','false','matching catalog stays fresh');
insert into calls values('event',pg_temp.event('RAW_JA',95));
select is(public.apply_watch_progress_v3('99999999-1111-4111-8111-111111111111',(select payload from calls where name='event'),null)#>>'{episode,episodeKey}','crunchyroll:episode:E','progress keeps logical identity');
select is((select projection#>>'{aggregate,completedEpisodes}' from public.watch_catalog_snapshots where user_id='99999999-1111-4111-8111-111111111111'),'1','first completion updates numerator');
select lives_ok($$select public.apply_watch_progress_v3('99999999-1111-4111-8111-111111111111',pg_temp.event('RAW_EN',12),null)$$,'second audio variant resumes independently');
select is((select count(*) from public.watch_episode_progress where user_id='99999999-1111-4111-8111-111111111111'),1::bigint,'only one canonical progress row');
select is((select raw_content_id||':'||current_time_seconds::text from public.watch_episode_progress where user_id='99999999-1111-4111-8111-111111111111'),'RAW_EN:12','resume uses actual variant and position');
select ok((select completed_at is not null from public.watch_episode_progress where user_id='99999999-1111-4111-8111-111111111111'),'completion is sticky');
select is(public.list_watch_history_v3_bounded_page('99999999-1111-4111-8111-111111111111',1,100)#>>'{titleSummaries,0,catalog,title}','Localized catalog','bounded read prefers accepted catalog title');
select is(public.list_watch_history_v3_bounded_page('99999999-1111-4111-8111-111111111111',999,100)#>>'{titleSummaries,0,catalog,title}','Localized catalog','catalog read uses actual account generation instead of caller hint');
select is(public.list_watch_history_v3_bounded_page('99999999-1111-4111-8111-111111111111',1,100)#>>'{progressRows,0,episode_title}','Localized episode','bounded read prefers accepted episode labels');
select is(public.list_watch_history_v3_title_episodes_page('99999999-1111-4111-8111-111111111111',1,'crunchyroll','crunchyroll:series:S',50,null)#>>'{catalog,seasons,0,seasonTitle}','Localized season','detail page includes catalog metadata for visible seasons');
select lives_ok($$select public.delete_watch_history_v3('99999999-1111-4111-8111-111111111111',jsonb_build_object('schemaVersion',3,'accountGeneration',1,'clientMutationId',gen_random_uuid(),'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','episode','provider','crunchyroll','titleKey','crunchyroll:series:S','episodeKey','crunchyroll:episode:E')))$$,'episode deletion succeeds');
select is((select projection#>>'{aggregate,completedEpisodes}' from public.watch_catalog_snapshots where user_id='99999999-1111-4111-8111-111111111111'),'0','episode delete recomputes numerator and retains catalog');
select is((select count(*) from public.watch_catalog_aliases where user_id='99999999-1111-4111-8111-111111111111'),2::bigint,'episode delete preserves aliases');
select throws_ok($$select public.apply_watch_progress_v3('99999999-1111-4111-8111-111111111111',pg_temp.event('RAW_EN',12)||'{"episodeKey":"crunchyroll:episode:OTHER"}',null)$$,'22023','watch_history_identity_invalid','key must derive from evidence');
select throws_ok($$insert into public.user_watch_settings(user_id) values('99999999-1111-4111-8111-111111111111') on conflict do nothing$$,'23502',null,'old initializer fails even on existing account');
insert into public.users(id,email,display_name) values('99999999-2222-4222-8222-222222222222','catalog-other@example.test','Other');
select throws_ok($$insert into public.user_watch_settings(user_id) values('99999999-2222-4222-8222-222222222222') on conflict do nothing$$,'23502',null,'old initializer fails without prior settings');
select is((select count(*) from public.watch_catalog_snapshots where user_id='99999999-2222-4222-8222-222222222222'),0::bigint,'catalog account isolation');
select ok(not has_table_privilege('authenticated','public.watch_catalog_snapshots','SELECT'),'browser cannot read catalog tables');
select ok(not has_function_privilege('authenticated','public.apply_watch_catalog_v3(uuid,jsonb)','EXECUTE'),'browser cannot execute privileged catalog commit');
insert into calls select 'region-request',jsonb_set(payload,'{context,region}','"CA"') from calls where name='request';
select is(public.begin_watch_catalog_v3('99999999-1111-4111-8111-111111111111',(select payload from calls where name='region-request'))->>'effectiveCatalogState','partial','region change suppresses exact totals immediately');
select is(public.begin_watch_catalog_v3('99999999-1111-4111-8111-111111111111',(select payload from calls where name='request'))->>'availabilityChanged','true','returning to accepted region invalidates the pending partial view');
select is(public.apply_watch_catalog_v3('99999999-1111-4111-8111-111111111111',(select payload from calls where name='commit'))->>'outcome','superseded','older commit cannot replace active context');
select lives_ok($$select public.delete_watch_history_v3('99999999-1111-4111-8111-111111111111',jsonb_build_object('schemaVersion',3,'accountGeneration',1,'clientMutationId',gen_random_uuid(),'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','title','provider','crunchyroll','titleKey','crunchyroll:series:S')))$$,'title deletion succeeds');
select is((select count(*) from public.watch_catalog_snapshots where user_id='99999999-1111-4111-8111-111111111111'),0::bigint,'title deletion removes catalog');
select is(public.apply_watch_catalog_v3('99999999-1111-4111-8111-111111111111',(select payload from calls where name='commit'))->>'outcome','superseded','deleted attempt is superseded');
select throws_ok($$select public.apply_watch_progress_v3('99999999-1111-4111-8111-111111111111',(select payload from calls where name='event')||jsonb_build_object('clientEventId',gen_random_uuid()),null)$$,'P0001','watch_history_deleted','delayed original observation cannot recreate title');
insert into calls values('recreated',public.begin_watch_catalog_v3('99999999-1111-4111-8111-111111111111',pg_temp.request()));
select ok((select (payload->>'revision')::bigint from calls where name='recreated')>(select (payload->>'revision')::bigint from calls where name='begin'),'title recreation never reuses revision');
select is(public.apply_watch_catalog_v3('99999999-1111-4111-8111-111111111111',(select payload from calls where name='commit'))->>'outcome','superseded','old commit cannot enter recreated title');
insert into public.users(id,email,display_name) values('99999999-2222-4222-8222-222222222222','catalog-review@example.test','Review') on conflict do nothing;
select lives_ok($$select public.apply_watch_progress_v3('99999999-2222-4222-8222-222222222222',pg_temp.event('RAW_EN',12),null)$$,'pre-catalog English progress');
insert into calls values('audio_begin',public.begin_watch_catalog_v3('99999999-2222-4222-8222-222222222222',(select payload from calls where name='request')));
select is((select preferred_audio_locale from public.watch_catalog_snapshots where user_id='99999999-2222-4222-8222-222222222222'),'en-US','begin seeds actual observed audio, not context audio');
select lives_ok($$select public.apply_watch_progress_v3('99999999-2222-4222-8222-222222222222',jsonb_set(jsonb_set(pg_temp.event('B_JA',12),'{episodeKey}','"crunchyroll:episode:B"'),'{crunchyrollIdentity,providerEpisodeIdentifier}','"B"'),null)$$,'another episode in Japanese');
select lives_ok($$select public.apply_watch_progress_v3('99999999-2222-4222-8222-222222222222',pg_temp.event('RAW_EN',15),null)$$,'return to unchanged per-episode English');
select is((select preferred_audio_locale from public.watch_catalog_snapshots where user_id='99999999-2222-4222-8222-222222222222'),'en-US','title audio follows A EN to B JA to A EN');
create function pg_temp.large_snapshot(ctx jsonb, overflow boolean) returns jsonb language sql as $$
select pg_temp.snapshot(ctx)||jsonb_build_object('seasons',(select jsonb_agg(jsonb_build_object('seasonKey','crunchyroll:season:L'||n,'providerSeasonIdentifier','L'||n,'title',repeat('界',300),'seasonNumber',n,'order',n,
 'episodes',(select jsonb_agg(jsonb_build_object('episodeKey','crunchyroll:episode:L'||n||'E'||i,'providerEpisodeIdentifier','L'||n||'E'||i,'title',case when overflow or i=2 then repeat('界',300) else 'Short' end,'episodeNumber',i,'order',i,'releasedAt',null,'available',true,
 'watchVariants',jsonb_build_array(jsonb_build_object('providerContentId','L'||n||'E'||i,'audioLocale','ja-JP','original',true,'order',0,'sourceUrl','https://www.crunchyroll.com/watch/L'||n||'E'||i)))) from generate_series(1,2) i))) from generate_series(1,100) n));
$$;
insert into calls select 'large_commit',r.payload||jsonb_build_object('revision',b.payload->'revision','snapshot',pg_temp.large_snapshot(r.payload->'context',true)) from calls r,calls b where r.name='request' and b.name='audio_begin';
select lives_ok($$select public.apply_watch_catalog_v3('99999999-2222-4222-8222-222222222222',(select payload from calls where name='large_commit'))$$,'initial projection overflow records partial without SQL failure');
select is((select attempt_status from public.watch_catalog_snapshots where user_id='99999999-2222-4222-8222-222222222222'),'partial','initial overflow records failed attempt');
select is((select count(*) from public.watch_catalog_aliases where user_id='99999999-2222-4222-8222-222222222222'),0::bigint,'overflow publishes no aliases');
update calls set payload=jsonb_set(payload,'{snapshot}',pg_temp.large_snapshot(payload->'context',false)) where name='large_commit';
select lives_ok($$select public.apply_watch_catalog_v3('99999999-2222-4222-8222-222222222222',(select payload from calls where name='large_commit'))$$,'bounded initial projection commits');
insert into calls select 'prior_hash',to_jsonb(accepted_hash) from public.watch_catalog_snapshots where user_id='99999999-2222-4222-8222-222222222222';
insert into calls select 'replacement_request',jsonb_set(payload-array['revision','snapshot'],'{context,requestedLocale}','"en-US"') from calls where name='large_commit';
insert into calls select 'replacement_begin',public.begin_watch_catalog_v3('99999999-2222-4222-8222-222222222222',payload) from calls where name='replacement_request';
select lives_ok($$select public.apply_watch_catalog_v3('99999999-2222-4222-8222-222222222222',r.payload||jsonb_build_object('revision',b.payload->'revision','snapshot',pg_temp.large_snapshot(r.payload->'context',true))) from calls r,calls b where r.name='replacement_request' and b.name='replacement_begin'$$,'replacement overflow does not discard prior accepted bundle');
select is((select to_jsonb(accepted_hash) from public.watch_catalog_snapshots where user_id='99999999-2222-4222-8222-222222222222'),(select payload from calls where name='prior_hash'),'prior accepted hash survives failed replacement');
select is((select count(*) from public.watch_catalog_aliases where user_id='99999999-2222-4222-8222-222222222222'),200::bigint,'prior aliases survive failed replacement');
select is(public.watch_catalog_read_v3('99999999-2222-4222-8222-222222222222',1,'crunchyroll','crunchyroll:series:S')->>'state','complete','same-region overflow retains appropriate complete view');
select lives_ok($$select public.apply_watch_progress_v3('99999999-2222-4222-8222-222222222222',pg_temp.event('L'||n||'E1',95)||jsonb_build_object('episodeKey','crunchyroll:episode:L'||n||'E1','seasonKey','crunchyroll:season:L'||n,'crunchyrollIdentity',jsonb_build_object('providerSeriesId','S','providerSeasonIdentifier','L'||n,'providerEpisodeIdentifier','L'||n||'E1','providerContentId','L'||n||'E1','audioLocale','ja-JP')),null) from generate_series(1,100) n$$,'growing next-episode projection never rolls back progress');
select is((select count(*) from public.watch_episode_progress where user_id='99999999-2222-4222-8222-222222222222' and completed_at is not null),100::bigint,'all valid completions survive projection overflow');
select is((select count(*) from public.watch_history_receipts where user_id='99999999-2222-4222-8222-222222222222'),103::bigint,'all event receipts survive projection overflow');
select is(public.watch_catalog_read_v3('99999999-2222-4222-8222-222222222222',1,'crunchyroll','crunchyroll:series:S')->>'state','partial','oversized derived view hides exact totals');
select lives_ok($$select public.delete_watch_history_v3('99999999-2222-4222-8222-222222222222',jsonb_build_object('schemaVersion',3,'accountGeneration',1,'clientMutationId',gen_random_uuid(),'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','episode','provider','crunchyroll','titleKey','crunchyroll:series:S','episodeKey','crunchyroll:episode:L1E1')))$$,'deletion remains valid while projection oversized');
select * from finish();
rollback;
