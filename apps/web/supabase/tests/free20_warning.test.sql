-- Synthetic, rollback-only fixture. Never run this against a hosted database.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_function('public','claim_free20_daily_warning_v1',array['uuid','jsonb','jsonb'],'atomic warning claim exists');
select ok(not has_function_privilege('anon','public.claim_free20_daily_warning_v1(uuid,jsonb,jsonb)','EXECUTE'),'anon cannot claim');
select ok(not has_function_privilege('authenticated','public.claim_free20_daily_warning_v1(uuid,jsonb,jsonb)','EXECUTE'),'authenticated cannot claim');
select ok(has_function_privilege('service_role','public.claim_free20_daily_warning_v1(uuid,jsonb,jsonb)','EXECUTE'),'service role can claim');
select ok(not has_table_privilege('authenticated','public.free20_daily_warning_claims','SELECT,INSERT,UPDATE,DELETE'),'browser has no marker access');
select ok(not has_table_privilege('service_role','public.free20_daily_warning_claims','INSERT,UPDATE,DELETE'),'runtime can only claim through RPC');
select ok((select relrowsecurity from pg_class where oid='public.free20_daily_warning_claims'::regclass),'RLS enabled');


insert into public.users(id,email,display_name) values
 ('f6260000-0000-4000-8000-000000000001','warning@example.test','Warning fixture');
update public.personal_history_policy set active=true;
update public.hosting_commercial_policy set activation_at=clock_timestamp()-interval '1 minute',free20_enabled=true,trials_enabled=false;
select room_record->>'room_id' as warning_room from public.create_room_with_active_session_v4(
 'f6260000-0000-4000-8000-000000000001','warning-host',null,null,null,null,null,null,null,'warning-request','free',4,4,false,false,3,1) \gset
create temporary table warning_state(name text primary key,value jsonb);
grant all on warning_state to service_role;
create function pg_temp.context() returns jsonb language sql as $$
 select (a-'enabled'-'committedSeconds'-'serverTime'-'refreshBy'-'resetAt')||jsonb_build_object(
 'utcDay',((a->>'serverTime')::timestamptz at time zone 'UTC')::date::text,
 'serverTime',floor(extract(epoch from (a->>'serverTime')::timestamptz)*1000),
 'refreshBy',floor(extract(epoch from (a->>'refreshBy')::timestamptz)*1000),
 'resetAt',floor(extract(epoch from (a->>'resetAt')::timestamptz)*1000))
 from (select public.read_free20_account_status_v1('f6260000-0000-4000-8000-000000000001') a) q;
$$;
create function pg_temp.live(c jsonb,n integer default 300,m boolean default false) returns jsonb language sql as $$
 select jsonb_build_object('liveStatusVersion',1,'ownerUserId',c->'ownerUserId','roomId',c#>'{assignment,roomId}',
 'roomGeneration',1,'utcDay',c->'utcDay','serverTime',c->'serverTime','validUntil',c->'refreshBy',
 'access',jsonb_build_object('kind','daily_free','budgetSeconds',1200,'usedSeconds',1200-n,'remainingSeconds',n,'metering',m));
$$;
create function pg_temp.claim(c jsonb,l jsonb) returns jsonb language sql as $$
 select public.claim_free20_daily_warning_v1('f6260000-0000-4000-8000-000000000001',c,l);
$$;
create function pg_temp.snapshot() returns jsonb language sql as $$
 select jsonb_build_object(
 'usage',(select jsonb_agg(to_jsonb(t)) from public.usage_daily t),
 'rooms',(select jsonb_agg(to_jsonb(t)) from public.rooms t),
 'assignment',(select jsonb_agg(to_jsonb(t)) from public.active_room_sessions t),
 'subscription',(select jsonb_agg(to_jsonb(t)) from public.subscriptions t),
 'grants',(select jsonb_agg(to_jsonb(t)) from public.account_manual_plan_grants t),
 'users',(select jsonb_agg(to_jsonb(t)) from public.users t),
 'settings',(select jsonb_agg(to_jsonb(t)) from public.user_watch_settings t));
$$;
insert into warning_state values ('context',pg_temp.context());
select is((select value->>'accessEpoch' from warning_state where name='context'),'0','real fresh Free account canonical epoch is zero');
insert into warning_state select 'live',pg_temp.live(value) from warning_state where name='context';
insert into warning_state values ('before',pg_temp.snapshot());
set local role service_role;
select is(pg_temp.claim(c.value,pg_temp.live(c.value,301))->>'decision','not_eligible','301 does not claim') from warning_state c where name='context';
select is(pg_temp.claim(c.value,pg_temp.live(c.value,0))->>'decision','not_eligible','zero does not claim') from warning_state c where name='context';
reset role;
select is((select count(*) from public.free20_daily_warning_claims),0::bigint,'ineligible calls leave no marker');
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',jsonb_set(c.value,'{assignment,status}','null'),l.value),'P0001','HOSTING_WARNING_UNAVAILABLE','null assignment status fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value||'{"seconds":300}',l.value),'P0001','HOSTING_WARNING_UNAVAILABLE','unknown context field fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',jsonb_set(c.value,'{serverTime}','"2026-11-01T00:00:00Z"'),l.value),'P0001','HOSTING_WARNING_UNAVAILABLE','raw ISO timestamp fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value #- '{assignment,sessionId}',l.value),'P0001','HOSTING_WARNING_UNAVAILABLE','missing session fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',jsonb_set(c.value,'{grant}','{}'),l.value),'P0001','HOSTING_WARNING_UNAVAILABLE','wrong grant fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value,jsonb_set(jsonb_set(l.value,'{serverTime}',to_jsonb((l.value->>'serverTime')::bigint+200000)),'{validUntil}',to_jsonb((l.value->>'validUntil')::bigint))),'P0001','HOSTING_WARNING_UNAVAILABLE','future measurement fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value,jsonb_set(l.value,'{validUntil}',l.value->'serverTime')),'P0001','HOSTING_WARNING_UNAVAILABLE','expired measurement fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value,'{"pending":true}'::jsonb),'P0001','HOSTING_WARNING_UNAVAILABLE','pending observation fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value,jsonb_set(l.value,'{access,remainingSeconds}','-1')),'P0001','HOSTING_WARNING_UNAVAILABLE','invalid seconds fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value,jsonb_set(l.value,'{access,usedSeconds}','1')),'P0001','HOSTING_WARNING_UNAVAILABLE','inconsistent total fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value,jsonb_set(l.value,'{ownerUserId}','"f6260000-0000-4000-8000-000000000002"')),'P0001','HOSTING_WARNING_UNAVAILABLE','wrong live owner fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value,jsonb_set(l.value,'{roomGeneration}','2')),'P0001','HOSTING_WARNING_UNAVAILABLE','wrong live generation fails closed') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',jsonb_set(c.value,'{accountGeneration}',to_jsonb((c.value->>'accountGeneration')::bigint+1)),l.value),'P0001','HOSTING_WARNING_CONTEXT_CHANGED','accountGeneration fence') from warning_state c,warning_state l where c.name='context' and l.name='live';
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',jsonb_set(c.value,'{accessEpoch}',to_jsonb((c.value->>'accessEpoch')::bigint+1)),l.value),'P0001','HOSTING_WARNING_CONTEXT_CHANGED','accessEpoch fence') from warning_state c,warning_state l where c.name='context' and l.name='live';

select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',jsonb_set(c.value,'{assignment,sessionId}','"other-session"'),l.value),'P0001','HOSTING_WARNING_CONTEXT_CHANGED','participant session fence') from warning_state c,warning_state l where c.name='context' and l.name='live';
-- Build a coherent prior-day observation: UTC rollover is a conflict, not a refill.
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c,pg_temp.live(c)),'P0001','HOSTING_WARNING_CONTEXT_CHANGED','previous UTC day is fenced') from (
 select value||jsonb_build_object('utcDay',((value->>'utcDay')::date-1)::text,'serverTime',(value->>'serverTime')::bigint-86400000,'refreshBy',(value->>'refreshBy')::bigint-86400000,'resetAt',(value->>'resetAt')::bigint-86400000) c from warning_state where name='context') q;
select is(pg_temp.snapshot(),(select value from warning_state where name='before'),'rejected/ineligible reads have no usage, rights, assignment or reconciled cache writes');
savepoint claim_rollback;
set local role service_role;
select is(pg_temp.claim(c.value,pg_temp.live(c.value,1,true))->>'decision','show','one metering second can claim') from warning_state c where name='context';
reset role;
rollback to claim_rollback;
select is((select count(*) from public.free20_daily_warning_claims),0::bigint,'transaction rollback leaves no marker');
-- A prior-day marker cannot suppress a new UTC day.
insert into public.free20_daily_warning_claims(user_id,utc_day) values ('f6260000-0000-4000-8000-000000000001',(clock_timestamp() at time zone 'UTC')::date-1);
set local role service_role;
insert into warning_state select 'first',pg_temp.claim(c.value,l.value) from warning_state c,warning_state l where c.name='context' and l.name='live';
select is((select value->>'decision' from warning_state where name='first'),'show','300 solo seconds grants once despite yesterday marker');
select ok((select value ? 'claimId' and value->>'thresholdSeconds'='300' and (value->>'validUntil')::bigint<=(value->>'serverTime')::bigint+10000 from warning_state where name='first'),'show has UUID and bounded display window');
select is(pg_temp.claim(c.value,l.value)->>'decision','already_claimed','lost response retry cannot reissue show') from warning_state c,warning_state l where c.name='context' and l.name='live';
reset role;
select is((select count(*) from public.free20_daily_warning_claims),2::bigint,'one marker per account UTC day');
select is(pg_temp.snapshot(),(select value from warning_state where name='before'),'successful warning only adds marker');
-- Settlement changed durable split after the DO observation; no double counting.
insert into public.usage_daily(user_id,day,host_seconds) values ('f6260000-0000-4000-8000-000000000001',(clock_timestamp() at time zone 'UTC')::date,950);
select is(pg_temp.claim(c.value,l.value)->>'decision','already_claimed','committedSeconds changes do not invalidate or double-count live total') from warning_state c,warning_state l where c.name='context' and l.name='live';
update public.active_room_sessions set participant_session_id='reconnected' where user_id='f6260000-0000-4000-8000-000000000001';
select is(pg_temp.claim(c,pg_temp.live(c))->>'decision','already_claimed','new participant session same day keeps marker') from (select pg_temp.context() c) q;
savepoint new_room;
update public.rooms set status='ended' where room_id=:'warning_room';
delete from public.active_room_sessions where user_id='f6260000-0000-4000-8000-000000000001';
select room_record->>'room_id' from public.create_room_with_active_session_v4(
 'f6260000-0000-4000-8000-000000000001','warning-next-host',null,null,null,null,null,null,null,'warning-next-request','free',4,4,false,false,3,1);
select is(pg_temp.claim(c,pg_temp.live(c))->>'decision','already_claimed','new room same day keeps marker') from (select pg_temp.context() c) q;
rollback to new_room;
-- Paid authority after live read is negative without an extra marker.
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values ('f6260000-0000-4000-8000-000000000001','plus',clock_timestamp()+interval '1 hour','warning test');
select is(pg_temp.claim(c.value,l.value)->>'decision','not_eligible','paid transition after projection is not eligible') from warning_state c,warning_state l where c.name='context' and l.name='live';
delete from public.account_manual_plan_grants where user_id='f6260000-0000-4000-8000-000000000001';
-- Existing canonical reconciliation is allowed: compare exact effects via a
-- savepoint, excluding only wall-clock audit timestamps.
create function pg_temp.cache() returns jsonb language sql as $$
 select jsonb_build_object('plan',(select plan from public.users where id='f6260000-0000-4000-8000-000000000001'),
 'settings',(select to_jsonb(t)-'updated_at'-'capture_not_before'-'youtube_capture_not_before' from public.user_watch_settings t where user_id='f6260000-0000-4000-8000-000000000001'));
$$;
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason) values ('f6260000-0000-4000-8000-000000000001','plus',clock_timestamp()-interval '1 hour','expired warning test');
savepoint canonical_only;
select public.read_free20_account_status_v1('f6260000-0000-4000-8000-000000000001')->>'accessEpoch' as canonical_epoch \gset
select pg_temp.cache() as canonical_cache \gset
rollback to canonical_only;
-- Free expected context with the canonical post-reconciliation epoch.
update warning_state set value=jsonb_set(jsonb_set(value,'{accessEpoch}',to_jsonb(:'canonical_epoch'::bigint)),'{assignment,sessionId}','"reconnected"') where name='context';
select is(pg_temp.claim(c.value,l.value)->>'decision','already_claimed','expired grant uses canonical lazy reconciliation') from warning_state c,warning_state l where c.name='context' and l.name='live';
select is(pg_temp.cache(),:'canonical_cache'::jsonb,'warning reconciliation matches canonical resolver alone');
select is((select count(*) from public.free20_daily_warning_claims),2::bigint,'upgrade and reconciliation never remove/reissue marker');
savepoint ended;
update public.rooms set status='ended' where room_id=:'warning_room';
select is(pg_temp.claim(c.value,l.value)->>'decision','not_eligible','ended room does not claim') from warning_state c,warning_state l where c.name='context' and l.name='live';
rollback to ended;
savepoint idle;
delete from public.active_room_sessions where user_id='f6260000-0000-4000-8000-000000000001';
select is(pg_temp.claim(c.value,l.value)->>'decision','not_eligible','no assignment does not claim') from warning_state c,warning_state l where c.name='context' and l.name='live';
rollback to idle;
savepoint guest;
update public.active_room_sessions set role='member' where user_id='f6260000-0000-4000-8000-000000000001';
select is(pg_temp.claim(c.value,l.value)->>'decision','not_eligible','guest assignment does not claim') from warning_state c,warning_state l where c.name='context' and l.name='live';
rollback to guest;
update public.hosting_commercial_policy set free20_enabled=false;
select throws_ok(format('select pg_temp.claim(%L::jsonb,%L::jsonb)',c.value,l.value),'P0001','FREE20_DISABLED','SQL gate remains independent') from warning_state c,warning_state l where c.name='context' and l.name='live';
set local role anon;
select throws_ok($$select public.claim_free20_daily_warning_v1(null,null,null)$$,'42501','permission denied for function claim_free20_daily_warning_v1','anon actual execution denied');
reset role;
set local role authenticated;
select throws_ok($$select public.claim_free20_daily_warning_v1(null,null,null)$$,'42501','permission denied for function claim_free20_daily_warning_v1','authenticated actual execution denied');
reset role;
select * from finish();
rollback;
