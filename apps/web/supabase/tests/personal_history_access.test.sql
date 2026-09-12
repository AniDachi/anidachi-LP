begin;
create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
select no_plan();
insert into public.users(id,email,display_name) values
 ('a2111111-1111-4111-8111-111111111111','access-one@example.test','Access One'),
 ('a2222222-2222-4222-8222-222222222222','access-two@example.test','Access Two');
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
    'duration', 1200,
    'progress', current_seconds / 1200,
    'observedAt', observed_at,
    'kind', event_kind,
    'sharedRoom', shared_room
  );
$$;


create temporary table access_results(name text primary key, value jsonb);
insert into access_results values('free',public.resolve_watch_history_access_v1('a2111111-1111-4111-8111-111111111111'));
select is((select value#>>'{history,state}' from access_results where name='free'),'plan_required','Free denied without history disclosure');
select is((select value#>>'{history,accessEpoch}' from access_results where name='free'),'0','Free epoch starts stable');
select is((select value#>>'{history,accountGeneration}' from access_results where name='free'),'1','generation unchanged');
select throws_ok($$select public.resolve_watch_history_access_v1('a2333333-3333-4333-8333-333333333333')$$,'P0001','HISTORY_ACCESS_UNAVAILABLE','missing owner is not Free');
select ok(not has_function_privilege('anon','public.resolve_watch_history_access_v1(uuid)','execute'),'anon cannot resolve');
select ok(not has_function_privilege('authenticated','public.resolve_watch_history_access_v1(uuid)','execute'),'authenticated cannot resolve arbitrary owners');
select ok(has_function_privilege('service_role','public.resolve_watch_history_access_v1(uuid)','execute'),'server can resolve');

create function pg_temp.refresh_access(plan text,status text,ending timestamptz,subscription text default 'sub_access_one',canceling boolean default false)
returns jsonb language plpgsql as $$
declare l jsonb;
begin
 l:=public.begin_stripe_subscription_refresh_v1(subscription);
 return public.commit_stripe_subscription_refresh_v1(subscription,(l->>'fence')::bigint,(l->>'token')::uuid,
 'a2111111-1111-4111-8111-111111111111','cus_access_one','price_access',plan,status,ending,canceling);
end $$;
insert into access_results values('plus',pg_temp.refresh_access('plus','active',clock_timestamp()+interval '1 day'));
select is((select value->>'planCode' from access_results where name='plus'),'plus','paid mirror grants Plus');
select is((select value#>>'{history,state}' from access_results where name='plus'),'allowed','paid history enabled');
select is((select value#>>'{history,accessEpoch}' from access_results where name='plus'),'1','regain increments epoch');
select is((select plan from users where id='a2111111-1111-4111-8111-111111111111'),'plus','user mirror commits with access');
insert into access_results values('canceling',pg_temp.refresh_access('plus','active',clock_timestamp()+interval '1 day','sub_access_one',true));
select is((select value#>>'{history,accessEpoch}' from access_results where name='canceling'),'1','cancel at period end does not revoke early');
insert into access_results values('pro',pg_temp.refresh_access('pro','active',clock_timestamp()+interval '1 hour','sub_access_pro'));
select is((select value->>'planCode' from access_results where name='pro'),'pro','highest of multiple subscriptions wins');
select is((select value#>>'{history,accessEpoch}' from access_results where name='pro'),'1','Plus to Pro retains epoch');
select ok((select (value->>'selectedPlanExpiresAt')::timestamptz < (value->>'paidUntil')::timestamptz from access_results where name='pro'),'Pro expiry separate from longer Plus history');
insert into access_results values('pro_expired',pg_temp.refresh_access('pro','active',clock_timestamp()-interval '1 second','sub_access_pro'));
select is((select value->>'planCode' from access_results where name='pro_expired'),'plus','expired Pro falls back to unexpired Plus');
select is((select value#>>'{history,accessEpoch}' from access_results where name='pro_expired'),'1','expiry of Pro keeps paid history epoch');
update user_watch_settings set history_generation=7,next_server_order=42,youtube_history_enabled=true where user_id='a2111111-1111-4111-8111-111111111111';
select lives_ok($$select public.apply_watch_progress_v3('a2111111-1111-4111-8111-111111111111',
 pg_temp.watch_v3_event('a2444444-4444-4444-8444-444444444444','access-preserved',clock_timestamp(),123,7),null)$$,'populate actual canonical progress before downgrade');
create temporary table saved_progress as select to_jsonb(p) as value from watch_episode_progress p where user_id='a2111111-1111-4111-8111-111111111111';
create temporary table saved_order as select next_server_order as value from user_watch_settings where user_id='a2111111-1111-4111-8111-111111111111';
insert into access_results values('failed',pg_temp.refresh_access('plus','past_due',clock_timestamp()+interval '1 day'));
select is((select value->>'planCode' from access_results where name='failed'),'free','current failed payment status revokes');
select is((select value#>>'{history,accessEpoch}' from access_results where name='failed'),'2','loss increments epoch atomically');
select is((select history_generation from user_watch_settings where user_id='a2111111-1111-4111-8111-111111111111'),7::bigint,'loss preserves generation');
select is((select next_server_order from user_watch_settings where user_id='a2111111-1111-4111-8111-111111111111'),(select value from saved_order),'loss preserves progress order');
select ok((select youtube_history_enabled from user_watch_settings where user_id='a2111111-1111-4111-8111-111111111111'),'loss preserves saved YouTube preference');
select is((select count(*) from saved_progress),1::bigint,'preservation proof contains populated progress');
select is((select to_jsonb(p) from watch_episode_progress p where user_id='a2111111-1111-4111-8111-111111111111'),(select value from saved_progress),'paid loss preserves exact durable progress row');
insert into access_results values('short',pg_temp.refresh_access('plus','active',clock_timestamp()+interval '100 milliseconds'));
select ok((select (value#>>'{history,validUntil}')::timestamptz <= (value->>'paidUntil')::timestamptz from access_results where name='short'),'lease clamped to actual paid end');
select pg_sleep(0.15);
insert into access_results values('expired',public.resolve_watch_history_access_v1('a2111111-1111-4111-8111-111111111111'));
select is((select value#>>'{history,state}' from access_results where name='expired'),'plan_required','actual expiry applies without webhook');
select is((select value#>>'{history,accessEpoch}' from access_results where name='expired'),'4','actual expiry increments once');
select is(public.resolve_watch_history_access_v1('a2111111-1111-4111-8111-111111111111')#>>'{history,accessEpoch}','4','duplicate expiry read stable');
insert into access_results values('renewed',pg_temp.refresh_access('plus','active',clock_timestamp()+interval '1 day'));
select is((select value#>>'{history,accessEpoch}' from access_results where name='renewed'),'5','renew after Free creates new epoch');
select ok((select (value#>>'{history,captureNotBefore}')::timestamptz > (select (value#>>'{history,captureNotBefore}')::timestamptz from access_results where name='short') from access_results where name='renewed'),'capture boundary excludes the Free gap');

-- Expired holder loses authority even if it retrieved an older paid snapshot.
insert into access_results values('lease',public.begin_stripe_subscription_refresh_v1('sub_access_one'));
select is(public.begin_stripe_subscription_refresh_v1('sub_access_one'),null::jsonb,'simultaneous refresh is busy');
update stripe_subscription_refresh_leases set expires_at=clock_timestamp()-interval '1 second' where subscription_id='sub_access_one';
insert into access_results values('new_lease',public.begin_stripe_subscription_refresh_v1('sub_access_one'));
select ok((select (value->>'fence')::bigint from access_results where name='new_lease') > (select (value->>'fence')::bigint from access_results where name='lease'),'new holder increments durable fence');
select throws_ok(format('select public.commit_stripe_subscription_refresh_v1(%L,%s,%L,%L,%L,%L,%L,%L,clock_timestamp()+interval ''1 day'',false)',
 'sub_access_one',(select value->>'fence' from access_results where name='lease'),(select value->>'token' from access_results where name='lease'),
 'a2111111-1111-4111-8111-111111111111','cus_access_one','price_access','pro','active'),
 'P0001','STRIPE_REFRESH_STALE','superseded retrieved snapshot cannot commit');
select public.release_stripe_subscription_refresh_v1('sub_access_one',(select (value->>'fence')::bigint from access_results where name='lease'),(select (value->>'token')::uuid from access_results where name='lease'));
select is(public.begin_stripe_subscription_refresh_v1('sub_access_one'),null::jsonb,'old release cannot unlock newer holder');
select throws_ok(format('select public.commit_stripe_subscription_refresh_v1(%L,%s,%L,%L,%L,%L,%L,%L,clock_timestamp()+interval ''1 day'',false)',
 'sub_access_one',(select value->>'fence' from access_results where name='new_lease'),(select value->>'token' from access_results where name='new_lease'),
 'a2222222-2222-4222-8222-222222222222','cus_access_one','price_access','pro','active'),
 'P0001','STRIPE_OWNER_MISMATCH','subscription/customer cannot be reassigned');
select is((select plan from users where id='a2111111-1111-4111-8111-111111111111'),'plus','failed stale or owner commit preserves actual plan');

insert into account_manual_plan_grants(user_id,plan_code,reason) values('a2222222-2222-4222-8222-222222222222','pro','explicit test grant');
select is(public.resolve_watch_history_access_v1('a2222222-2222-4222-8222-222222222222')->>'planCode','pro','explicit manual grant independent of Stripe rows');
select is(public.resolve_watch_history_access_v1('a2222222-2222-4222-8222-222222222222')->>'paidUntil',null::text,'indefinite manual grant has no invented Stripe expiry');
update account_manual_plan_grants set valid_until=clock_timestamp()-interval '1 second' where user_id='a2222222-2222-4222-8222-222222222222';
select is(public.resolve_watch_history_access_v1('a2222222-2222-4222-8222-222222222222')->>'planCode','free','manual grant expiry is explicit Free authority');
select public.release_stripe_subscription_refresh_v1('sub_access_one',(select (value->>'fence')::bigint from access_results where name='new_lease'),(select (value->>'token')::uuid from access_results where name='new_lease'));
-- No read between expiry and renewal: commit must still record both transitions.
select pg_temp.refresh_access('plus','active',clock_timestamp()+interval '100 milliseconds');
select pg_sleep(0.15);
insert into access_results values('missed_gap',pg_temp.refresh_access('plus','active',clock_timestamp()+interval '1 day','sub_access_gap'));
select is((select value#>>'{history,accessEpoch}' from access_results where name='missed_gap'),'7','renewal transaction observes missed expiry before grant');
select is((select to_jsonb(p) from watch_episode_progress p where user_id='a2111111-1111-4111-8111-111111111111'),(select value from saved_progress),'expiry and return preserve exact progress');
update subscriptions set current_period_end=null where stripe_subscription_id='sub_access_gap';
select throws_ok($$select public.resolve_watch_history_access_v1('a2111111-1111-4111-8111-111111111111')$$,'P0001','HISTORY_ACCESS_UNAVAILABLE','missing active billing expiry is unavailable, not Free');
insert into access_results values('healed',pg_temp.refresh_access('plus','active',clock_timestamp()+interval '1 day','sub_access_gap'));
select is((select value->>'planCode' from access_results where name='healed'),'plus','fresh fenced snapshot heals missing prior expiry');
select is((select value#>>'{history,accessEpoch}' from access_results where name='healed'),'9','unknown prior authority rotates capture boundary on recovery');
select is((select to_jsonb(p) from watch_episode_progress p where user_id='a2111111-1111-4111-8111-111111111111'),(select value from saved_progress),'authority repair preserves progress');
select * from finish();
rollback;
