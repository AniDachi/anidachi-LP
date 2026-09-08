begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='15s';
set local lock_timeout='3s';
select no_plan();
insert into users(id,email,display_name) values('a3666666-6666-4666-8666-666666666666','catalog-epoch-review@example.test','Catalog epoch');
insert into account_manual_plan_grants(user_id,plan_code,reason) values('a3666666-6666-4666-8666-666666666666','plus','isolated catalog epoch regression');
select resolve_watch_history_access_v1('a3666666-6666-4666-8666-666666666666');
update personal_history_policy set active=true;
create temporary table catalog_epoch_calls(name text primary key,request jsonb,ack jsonb,commit_body jsonb);
create function pg_temp.epoch() returns bigint language sql as $$
 select (resolve_watch_history_access_v1('a3666666-6666-4666-8666-666666666666')#>>'{history,accessEpoch}')::bigint;
$$;
create function pg_temp.issue(name_value text,locale_value text) returns jsonb language plpgsql as $$
declare req jsonb; ack_value jsonb; snap jsonb; epoch_value bigint;
begin
 epoch_value:=pg_temp.epoch();
 req:=jsonb_build_object('schemaVersion',3,'accountGeneration',1,'provider','crunchyroll','titleKey','crunchyroll:series:S','providerSeriesId','S',
 'historyAccess',jsonb_build_object('accessVersion',1,'accessEpoch',epoch_value),
 'context',jsonb_build_object('region','US','requestedLocale',locale_value,'audioLocale','ja-JP','subtitleLocales','[]'::jsonb,'observedAt',clock_timestamp()));
 ack_value:=begin_watch_catalog_v3('a3666666-6666-4666-8666-666666666666',req);
 snap:=jsonb_build_object('schemaVersion',3,'provider','crunchyroll','titleKey','crunchyroll:series:S','providerSeriesId','S','title','Localized '||locale_value,'completeness','complete','context',req->'context',
 'seasons',jsonb_build_array(jsonb_build_object('seasonKey','crunchyroll:season:SS','providerSeasonIdentifier','SS','title','Season','seasonNumber',1,'order',0,
 'episodes',jsonb_build_array(jsonb_build_object('episodeKey','crunchyroll:episode:E','providerEpisodeIdentifier','E','title','Episode','episodeNumber',1,'order',0,'releasedAt',null,'available',true,
 'watchVariants',jsonb_build_array(jsonb_build_object('providerContentId','RAW','audioLocale','ja-JP','original',true,'order',0,'sourceUrl','https://www.crunchyroll.com/watch/RAW')))))));
 insert into catalog_epoch_calls values(name_value,req,ack_value,req||jsonb_build_object('revision',ack_value->'revision','snapshot',snap));
 return ack_value;
end $$;
create function pg_temp.commit_attempt(name_value text,substitute_epoch boolean default false) returns jsonb language plpgsql as $$
declare input jsonb;
begin
 select commit_body into strict input from catalog_epoch_calls where name=name_value;
 if substitute_epoch then input:=jsonb_set(input,'{historyAccess,accessEpoch}',to_jsonb(pg_temp.epoch())); end if;
 return apply_watch_catalog_v3('a3666666-6666-4666-8666-666666666666',input);
end $$;
create function pg_temp.cross_free_period() returns void language plpgsql as $$
begin
 update account_manual_plan_grants set valid_until=clock_timestamp()-interval '1 second' where user_id='a3666666-6666-4666-8666-666666666666';
 perform resolve_watch_history_access_v1('a3666666-6666-4666-8666-666666666666');
 update account_manual_plan_grants set valid_until=null where user_id='a3666666-6666-4666-8666-666666666666';
 perform resolve_watch_history_access_v1('a3666666-6666-4666-8666-666666666666');
end $$;
-- Accepted revision replay after an intervening current-epoch cached begin.
select is(pg_temp.issue('accepted-a','en-US')->>'refreshRequired','true','initial A receives a revision');
select is(pg_temp.commit_attempt('accepted-a')->>'outcome','applied','initial A is accepted');
select pg_temp.cross_free_period();
select is(pg_temp.issue('cached-a-new-epoch','en-US')->>'refreshRequired','false','current epoch A begin keeps real cache-hit semantics');
select is((select ack->>'revision' from catalog_epoch_calls where name='cached-a-new-epoch'),(select ack->>'revision' from catalog_epoch_calls where name='accepted-a'),'cache hit does not issue a revision');
select is((select personal_access_epoch from watch_catalog_snapshots where user_id='a3666666-6666-4666-8666-666666666666'),(select (request#>>'{historyAccess,accessEpoch}')::bigint from catalog_epoch_calls where name='accepted-a'),'cache hit cannot rebind accepted revision epoch');
select throws_ok($$select pg_temp.commit_attempt('accepted-a',true)$$,'P0001','HISTORY_ACCESS_CHANGED','substituted proof cannot replay accepted old revision after cached begin');
select is(pg_temp.issue('fresh-b-current','ja-JP')->>'refreshRequired','true','changed locale genuinely issues current-epoch attempt');
select isnt((select ack->>'revision' from catalog_epoch_calls where name='fresh-b-current'),(select ack->>'revision' from catalog_epoch_calls where name='accepted-a'),'new attempt has new revision');
select is(pg_temp.commit_attempt('fresh-b-current')->>'outcome','applied','genuine current-epoch attempt commits');
-- Accepted A, pending B, pending A, then a cached A begin in a later paid epoch.
select pg_temp.issue('accepted-a-again','en-US');
select pg_temp.commit_attempt('accepted-a-again');
select is(pg_temp.issue('pending-b','ja-JP')->>'refreshRequired','true','A to B creates pending B');
select is(pg_temp.issue('pending-a','en-US')->>'refreshRequired','true','B to A creates pending A without accepting B');
select is((select attempt_status from watch_catalog_snapshots where user_id='a3666666-6666-4666-8666-666666666666'),'pending','A attempt is still uncommitted');
select pg_temp.cross_free_period();
select is(pg_temp.issue('cached-pending-a-new-epoch','en-US')->>'refreshRequired','false','accepted A cache can be hit while newer A is pending');
select is((select ack->>'revision' from catalog_epoch_calls where name='cached-pending-a-new-epoch'),(select ack->>'revision' from catalog_epoch_calls where name='pending-a'),'pending cache hit preserves issued revision');
select is((select personal_access_epoch from watch_catalog_snapshots where user_id='a3666666-6666-4666-8666-666666666666'),(select (request#>>'{historyAccess,accessEpoch}')::bigint from catalog_epoch_calls where name='pending-a'),'cached begin cannot rebind uncommitted old A epoch');
select throws_ok($$select pg_temp.commit_attempt('pending-a',true)$$,'P0001','HISTORY_ACCESS_CHANGED','substituted proof cannot commit old pending A after cached begin');
select throws_ok($$select pg_temp.commit_attempt('pending-b',true)$$,'P0001','HISTORY_ACCESS_CHANGED','old pending B cannot bypass the same epoch boundary');
select is(pg_temp.issue('fresh-c-current','fr-FR')->>'refreshRequired','true','genuine new locale issues current-epoch revision after pending A');
select is((select personal_access_epoch from watch_catalog_snapshots where user_id='a3666666-6666-4666-8666-666666666666'),pg_temp.epoch(),'new revision receives current epoch');
select is(pg_temp.commit_attempt('fresh-c-current')->>'outcome','applied','genuine current-epoch revision commits after pending sequence');
select * from finish();
rollback;
