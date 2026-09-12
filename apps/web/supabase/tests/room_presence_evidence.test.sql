begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='15s';
set local lock_timeout='3s';
select no_plan();
-- Enforce the final strict history policy only inside this rolled-back fixture.
update personal_history_policy set active=true;
select has_function('public','record_recent_room_presence_v1',array['jsonb'],'presence RPC exists');
insert into users(id,email,display_name) values
 ('a4444444-4444-4444-8444-444444444441','presence-a@example.test','A'),
 ('a4444444-4444-4444-8444-444444444442','presence-b@example.test','B');
insert into rooms(room_id,host_user_id,created_at) values('presence-sql-room','a4444444-4444-4444-8444-444444444441',clock_timestamp()-interval '1 hour');
insert into room_members(room_id,user_id) select 'presence-sql-room',id from users where email in ('presence-a@example.test','presence-b@example.test');
select is((select count(*)::int from recent_people_evidence where last_room_id='presence-sql-room'),0,'HTTP membership alone creates no evidence');
create function pg_temp.evidence(g bigint default 7, at_time timestamptz default now()-interval '1 minute') returns jsonb language sql as $$
 select jsonb_build_object('roomId','presence-sql-room','roomGeneration',g,'observedAt',floor(extract(epoch from at_time)*1000),'participants',jsonb_build_array(
 jsonb_build_object('userId','a4444444-4444-4444-8444-444444444441','sessionId','old-a-session'),
 jsonb_build_object('userId','a4444444-4444-4444-8444-444444444442','sessionId','old-b-session')));
$$;
select ok(not has_function_privilege('anon','public.record_recent_room_presence_v1(jsonb)','EXECUTE'),'anon denied');
select ok(not has_function_privilege('authenticated','public.record_recent_room_presence_v1(jsonb)','EXECUTE'),'authenticated denied');
select ok(has_function_privilege('service_role','public.record_recent_room_presence_v1(jsonb)','EXECUTE'),'service only');
set local role service_role;
select is(record_recent_room_presence_v1(pg_temp.evidence()),'{"accepted":true}'::jsonb,'Free pair accepted by actual service role');
reset role;
select is((select presence_room_generation from rooms where room_id='presence-sql-room'),7::bigint,'first trusted callback atomically binds distinct room generation');
select is((select count(*)::int from recent_people_evidence where last_room_id='presence-sql-room'),2,'private evidence in both directions');
select is(record_recent_room_presence_v1(pg_temp.evidence()),'{"accepted":true}'::jsonb,'replay accepted');
select is((select count(*)::int from recent_people_evidence where last_room_id='presence-sql-room'),2,'no duplicate replay');
select throws_ok($$select record_recent_room_presence_v1(pg_temp.evidence(8))$$,'22023','Invalid room presence authority','wrong bound generation rejected');
select throws_ok($$select record_recent_room_presence_v1(pg_temp.evidence()||'{"position":5}'::jsonb)$$,'22023','Invalid room presence evidence','playback data rejected');
update rooms set status='ended',ended_at=now() where room_id='presence-sql-room';
select is(record_recent_room_presence_v1(pg_temp.evidence(7,now()-interval '30 seconds')),'{"accepted":true}'::jsonb,'late pre-end delivery accepted');
select throws_ok($$select record_recent_room_presence_v1(pg_temp.evidence(7,now()+interval '1 second'))$$,'22023','Invalid room presence authority','post-end observation rejected');
select throws_ok($$select record_recent_room_presence_v1(pg_temp.evidence(7,now()-interval '25 hours'))$$,'22023','Invalid room presence authority','expired delivery rejected');
insert into recent_people_hidden(user_id,hidden_user_id) values('a4444444-4444-4444-8444-444444444441','a4444444-4444-4444-8444-444444444442');
select record_recent_room_presence_v1(pg_temp.evidence(7,now()-interval '20 seconds'));
select is((select count(*)::int from list_recent_people_evidence_v2('a4444444-4444-4444-8444-444444444441')),0,'new evidence never unhides');
select is((select count(*)::int from watch_sessions where room_id='presence-sql-room'),0,'no history sessions');
delete from users where id='a4444444-4444-4444-8444-444444444442';
select is(record_recent_room_presence_v1(pg_temp.evidence()),'{"accepted":true}'::jsonb,'deleted participant retry acknowledged without recreation');
select is((select count(*)::int from recent_people_evidence where last_room_id='presence-sql-room'),0,'deleted account evidence stays gone');
insert into users(id,email,display_name) values('a4444444-4444-4444-8444-444444444442','presence-b2@example.test','B2');
-- A fresh room can receive its first legitimate observation after room end.
insert into rooms(room_id,host_user_id,created_at,status,ended_at) values('presence-late-first','a4444444-4444-4444-8444-444444444441',now()-interval '1 hour','ended',now());
select is(record_recent_room_presence_v1(pg_temp.evidence()||'{"roomId":"presence-late-first","roomGeneration":9}'::jsonb),'{"accepted":true}'::jsonb,'late first delivery binds valid generation');
select is((select presence_room_generation from rooms where room_id='presence-late-first'),9::bigint,'late first immutable binding is separate per room');
select record_recent_room_presence_v1(pg_temp.evidence(7,now()-interval '10 seconds'));
select record_recent_room_presence_v1(pg_temp.evidence(7,now()-interval '50 seconds'));
select is((select last_watched_at from recent_people_evidence where user_id='a4444444-4444-4444-8444-444444444441'),to_timestamp(floor(extract(epoch from (now()-interval '10 seconds'))*1000)::double precision/1000),'older replay never moves date backward');
select ok(not exists(select 1 from watch_episode_progress where user_id in('a4444444-4444-4444-8444-444444444441','a4444444-4444-4444-8444-444444444442')),'Free presence writes no progress');
select * from finish();
rollback;
