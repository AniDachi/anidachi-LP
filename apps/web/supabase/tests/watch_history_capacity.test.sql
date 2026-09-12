begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
set local statement_timeout = '20s';
set local lock_timeout = '3s';
select no_plan();

create function pg_temp.capacity_seed(owner uuid, provider_name text, total integer) returns void language plpgsql as $$
begin
  insert into public.watch_episode_progress(user_id,provider,title_key,episode_key,item_kind,title,episode_title,
    source_url,current_time_seconds,duration,progress,last_event_id,observed_at,server_order,history_generation,updated_at)
  select owner,provider_name,
    case when provider_name='youtube' then 'youtube:video:v'||lpad(i::text,10,'0') else 'crunchyroll:series:series'||i end,
    case when provider_name='youtube' then 'youtube:video:v'||lpad(i::text,10,'0') else 'crunchyroll:episode:episode'||i end,
    case when provider_name='youtube' then 'movie' else 'series' end,'Title '||i,'Episode '||i,
    case when provider_name='youtube' then 'https://www.youtube.com/watch?v=v'||lpad(i::text,10,'0') else 'https://www.crunchyroll.com/watch/episode'||i end,
    10,1000,0.01,gen_random_uuid(),clock_timestamp()-interval '1 day',
    i + case when provider_name='youtube' then 0 else 1000 end,1,clock_timestamp()
  from generate_series(1,total) i;
end $$;
create function pg_temp.capacity_event(provider_name text, title_no integer, episode_no integer default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'schemaVersion',3,'clientEventId',gen_random_uuid(),'clientSessionKey',gen_random_uuid()::text,
    'accountGeneration',1,'provider',provider_name,
    'titleKey',case when provider_name='youtube' then 'youtube:video:v'||lpad(title_no::text,10,'0') else 'crunchyroll:series:series'||title_no end,
    'episodeKey',case when provider_name='youtube' then 'youtube:video:v'||lpad(title_no::text,10,'0') else 'crunchyroll:episode:episode'||coalesce(episode_no,title_no) end,
    'itemKind',case when provider_name='youtube' then 'movie' else 'series' end,
    'title','Title','artworkUrl',null,'episodeTitle','Episode',
    'seasonKey',case when provider_name='youtube' then null else 'crunchyroll:season:season-one' end,
    'seasonTitle',null,'seasonNumber',null,'episodeNumber',null,
    'sourceUrl',case when provider_name='youtube' then 'https://www.youtube.com/watch?v=v'||lpad(title_no::text,10,'0') else 'https://www.crunchyroll.com/watch/episode'||coalesce(episode_no,title_no) end,
    'currentTime',50,'duration',1000,'progress',0.05,'observedAt',clock_timestamp(),'kind','heartbeat'
  ) || case when provider_name='youtube' then jsonb_build_object('youtubeVideoId','v'||lpad(title_no::text,10,'0'))
    else jsonb_build_object('crunchyrollIdentity',jsonb_build_object('providerSeriesId','series'||title_no,
      'providerSeasonIdentifier','season-one','providerEpisodeIdentifier','episode'||coalesce(episode_no,title_no),
      'providerContentId','episode'||coalesce(episode_no,title_no),'audioLocale',null)) end;
$$;
create function pg_temp.capacity_personal(owner uuid, event jsonb) returns jsonb language plpgsql as $$
declare a jsonb;
begin
  a:=public.resolve_watch_history_access_v1(owner)->'history';
  return public.apply_personal_watch_progress_v1(owner,jsonb_build_object('captureVersion',1,
    'accessEpoch',a->'accessEpoch','youtubeConsentEpoch',a->'youtubeConsentEpoch','clientSequence',1,'event',event));
end $$;
create function pg_temp.capacity_delete(owner uuid, provider_name text, title_no integer) returns jsonb language sql as $$
  select public.delete_watch_history_v3(owner,jsonb_build_object('schemaVersion',3,'clientMutationId',gen_random_uuid(),
    'accountGeneration',1,'requestedAt',clock_timestamp(),'target',jsonb_build_object('scope','title','provider',provider_name,
    'titleKey',case when provider_name='youtube' then 'youtube:video:v'||lpad(title_no::text,10,'0') else 'crunchyroll:series:series'||title_no end)));
$$;
insert into users(id,email,display_name) values
  ('c1111111-1111-4111-8111-111111111111','capacity-plus@example.test','Capacity Plus'),
  ('c2222222-2222-4222-8222-222222222222','capacity-pro@example.test','Capacity Pro'),
  ('c3333333-3333-4333-8333-333333333333','capacity-free@example.test','Capacity Free');
insert into account_manual_plan_grants(user_id,plan_code,reason) values
  ('c1111111-1111-4111-8111-111111111111','plus','test'),
  ('c2222222-2222-4222-8222-222222222222','pro','test');

select is(get_watch_history_capacity_v1('c3333333-3333-4333-8333-333333333333')#>>'{providers,youtube,used}','0','Free empty capacity available');
select is((select count(*)::integer from user_watch_settings where user_id='c3333333-3333-4333-8333-333333333333'),0,'capacity read does not create settings');
select set_watch_preferences_v3(id,'{"youtubeHistoryEnabled":true}') from users where id in ('c1111111-1111-4111-8111-111111111111','c2222222-2222-4222-8222-222222222222');
select resolve_watch_history_access_v1(id) from users where id in ('c1111111-1111-4111-8111-111111111111','c2222222-2222-4222-8222-222222222222');
update user_watch_settings set next_server_order=10000 where user_id in ('c1111111-1111-4111-8111-111111111111','c2222222-2222-4222-8222-222222222222');
select pg_temp.capacity_seed('c1111111-1111-4111-8111-111111111111','youtube',99);
select pg_temp.capacity_seed('c1111111-1111-4111-8111-111111111111','crunchyroll',199);
select lives_ok($$select pg_temp.capacity_personal('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('youtube',100))$$,'100th YouTube title accepted');
select lives_ok($$select pg_temp.capacity_personal('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('crunchyroll',200))$$,'200th Crunchyroll title accepted independently');
create temporary table capacity_before as select
  (select count(*) from watch_sessions where host_user_id='c1111111-1111-4111-8111-111111111111') sessions,
  (select count(*) from watch_history_receipts where user_id='c1111111-1111-4111-8111-111111111111') receipts;
select throws_ok($$select pg_temp.capacity_personal('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('youtube',101))$$,'P0001','HISTORY_LIMIT_REACHED','101st YouTube rejected');
select throws_ok($$select pg_temp.capacity_personal('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('crunchyroll',201))$$,'P0001','HISTORY_LIMIT_REACHED','201st Crunchyroll rejected');
select is((select count(*) from watch_sessions where host_user_id='c1111111-1111-4111-8111-111111111111'),(select sessions from capacity_before),'rejected capture creates no session');
select is((select count(*) from watch_history_receipts where user_id='c1111111-1111-4111-8111-111111111111'),(select receipts from capacity_before),'rejected capture creates no accepted receipt');
select lives_ok($$select pg_temp.capacity_personal('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('youtube',1))$$,'existing YouTube progress continues at full');
select lives_ok($$select pg_temp.capacity_personal('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('crunchyroll',1,999))$$,'new episode in existing Crunchyroll title allowed at full');
select is(get_watch_history_capacity_v1('c1111111-1111-4111-8111-111111111111')#>>'{providers,crunchyroll,used}','200','multiple episodes use one title slot');
select lives_ok($$select apply_watch_progress_v3('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('youtube',2),null)$$,'inactive legacy writer retains existing-title access');
select throws_ok($$select apply_watch_progress_v3('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('youtube',101),null)$$,'P0001','HISTORY_LIMIT_REACHED','legacy writer cannot bypass capacity');
select throws_ok($$select apply_watch_progress_v3_canonical('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('crunchyroll',201),null)$$,'P0001','HISTORY_LIMIT_REACHED','canonical public alias cannot bypass capacity');

-- Existing over-limit Pro data remains intact and is reported without clamping.
select pg_temp.capacity_seed('c2222222-2222-4222-8222-222222222222','youtube',102);
select pg_temp.capacity_seed('c2222222-2222-4222-8222-222222222222','crunchyroll',202);
select is(get_watch_history_capacity_v1('c2222222-2222-4222-8222-222222222222')#>>'{providers,youtube,used}','102','real over-limit YouTube count retained');
select is(get_watch_history_capacity_v1('c2222222-2222-4222-8222-222222222222')#>>'{providers,crunchyroll,used}','202','real over-limit Crunchyroll count retained');
select lives_ok($$select pg_temp.capacity_personal('c2222222-2222-4222-8222-222222222222',pg_temp.capacity_event('youtube',102))$$,'over-limit retained YouTube progress continues');
select lives_ok($$select pg_temp.capacity_personal('c2222222-2222-4222-8222-222222222222',pg_temp.capacity_event('crunchyroll',202,999))$$,'over-limit title accepts new episode');
select throws_ok($$select pg_temp.capacity_personal('c2222222-2222-4222-8222-222222222222',pg_temp.capacity_event('youtube',103))$$,'P0001','HISTORY_LIMIT_REACHED','Pro shares the same limit');
select pg_temp.capacity_delete('c2222222-2222-4222-8222-222222222222','youtube',1);
select pg_temp.capacity_delete('c2222222-2222-4222-8222-222222222222','youtube',2);
select throws_ok($$select pg_temp.capacity_personal('c2222222-2222-4222-8222-222222222222',pg_temp.capacity_event('youtube',103))$$,'P0001','HISTORY_LIMIT_REACHED','deleting to exactly the limit still blocks new titles');
select pg_temp.capacity_delete('c2222222-2222-4222-8222-222222222222','youtube',3);
select lives_ok($$select pg_temp.capacity_personal('c2222222-2222-4222-8222-222222222222',pg_temp.capacity_event('youtube',103))$$,'deleting enough titles frees a slot for fresh capture');
select is(get_watch_history_capacity_v1('c2222222-2222-4222-8222-222222222222')#>>'{providers,youtube,used}','100','fresh capture consumes only the freed slot');
select throws_ok($$select get_watch_history_capacity_v1('c2222222-2222-4222-8222-222222222222',2)$$,'P0001','watch_history_generation_mismatch','capacity generation fence rejects stale caller');
update user_watch_settings set history_generation=2 where user_id='c2222222-2222-4222-8222-222222222222';
select is(get_watch_history_capacity_v1('c2222222-2222-4222-8222-222222222222',2)#>>'{providers,youtube,used}','0','old-generation rows consume no current-generation slots');
select is((select count(*)::integer from watch_episode_progress where user_id='c2222222-2222-4222-8222-222222222222' and provider='youtube'),100,'capacity snapshot does not trim retained old-generation rows');

update personal_history_policy set active=true;
select throws_ok($$select pg_temp.capacity_personal('c3333333-3333-4333-8333-333333333333',pg_temp.capacity_event('youtube',1))$$,'P0001','HISTORY_PLAN_REQUIRED','Free write gate is unchanged');
select lives_ok($$select get_watch_history_capacity_v1('c3333333-3333-4333-8333-333333333333')$$,'Free still reads after rollout activation');
select pg_temp.capacity_seed('c3333333-3333-4333-8333-333333333333','youtube',1);
select is(get_watch_history_capacity_v1('c3333333-3333-4333-8333-333333333333')#>>'{providers,youtube,used}','1','Free capacity includes saved historical rows');
select throws_ok($$select apply_watch_progress_v3('c1111111-1111-4111-8111-111111111111',pg_temp.capacity_event('youtube',1),null)$$,'P0001','HISTORY_CLIENT_UPDATE_REQUIRED','legacy activation gate is unchanged');
select ok(not has_function_privilege('anon','public.get_watch_history_capacity_v1(uuid,bigint)','EXECUTE'),'anon cannot call capacity');
select ok(not has_function_privilege('authenticated','public.get_watch_history_capacity_v1(uuid,bigint)','EXECUTE'),'authenticated cannot choose another owner through RPC');
select ok(has_function_privilege('service_role','public.get_watch_history_capacity_v1(uuid,bigint)','EXECUTE'),'service role can call capacity');
select ok(not has_function_privilege('service_role','anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)','EXECUTE'),'internal core remains inaccessible');
set local role service_role;
select is(public.get_watch_history_capacity_v1('c1111111-1111-4111-8111-111111111111')#>>'{providers,youtube,used}','100','capacity works with real service role permissions');
reset role;
select * from finish();
rollback;
