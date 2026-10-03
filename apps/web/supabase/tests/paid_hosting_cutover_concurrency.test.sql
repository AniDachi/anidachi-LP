-- Disposable local PostgreSQL ONLY. Real cross-transaction commits below.
-- Explicit psql -v anidachi_disposable=true is required; synthetic fixtures are
-- removed at the end. Queued HTTP is deleted BEFORE any activation commit.
\if :{?anidachi_disposable}
\if :anidachi_disposable
\else
\quit 3
\endif
\else
\echo 'Refusing committed cutover test without anidachi_disposable'
\quit 3
\endif
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
begin;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.cutover_waits(app text) returns boolean language plpgsql as $$
declare deadline timestamptz:=clock_timestamp()+interval '5 seconds';
begin loop
 if exists(select 1 from pg_stat_activity where application_name=app and wait_event_type='Lock') then return true; end if;
 if clock_timestamp()>deadline then return false; end if;
 perform pg_sleep(0.02);
end loop; end $$;
select dblink_connect('cutover_a',format('hostaddr=%s port=%s dbname=%L user=postgres password=postgres application_name=cutover_a',inet_server_addr(),inet_server_port(),current_database()));
select dblink_connect('cutover_b',format('hostaddr=%s port=%s dbname=%L user=postgres password=postgres application_name=cutover_b',inet_server_addr(),inet_server_port(),current_database()));
create temporary table original_history as select active from public.personal_history_policy;
select dblink_exec('cutover_a',$q$
 do $$begin
  if exists(select 1 from public.hosting_cutover_operation) or exists(select 1 from public.hosting_commercial_policy where activation_at is not null)
   or exists(select 1 from anidachi_private.hosting_cutover_scheduler where enabled)
   or exists(select 1 from vault.secrets where name='anidachi_hosting_cutover_drain_secret') then raise exception 'test database not dormant'; end if;
 end $$;
 insert into public.users(id,email,display_name) values('fb400000-0000-4000-8000-000000000001','cutover-concurrent@example.test','Concurrent');
 update public.personal_history_policy set active=true;
 update anidachi_private.hosting_cutover_scheduler set enabled=true,environment='staging';
 do $$begin perform vault.create_secret('cutover-concurrent-test-only','anidachi_hosting_cutover_drain_secret');end$$;
 begin;
 set local role service_role;
$q$);
create temporary table concurrent_room as select * from dblink('cutover_a',$q$
 select room_record->>'room_id' from public.create_room_with_active_session_v3(
 'fb400000-0000-4000-8000-000000000001','cutover-session',null,null,null,null,null,null,null,'cutover-concurrent-create','free',3,2,false,false,3)
$q$) as result(room_id text);
select dblink_exec('cutover_b','begin');
select is(dblink_send_query('cutover_b',$q$select anidachi_private.activate_paid_hosting_v1('fb400000-0000-4000-8000-000000000002',1)$q$),1,'activation starts concurrently with creating Free room');
select ok(pg_temp.cutover_waits('cutover_b'),'activation waits for the creation transaction policy lock');
select dblink_exec('cutover_a','commit');
create temporary table first_operation as select * from dblink_get_result('cutover_b') as result(value jsonb);
select * from dblink_get_result('cutover_b') as result(value jsonb);
select is((select total from dblink('cutover_b',format('select count(*) from public.room_hosting_cutover_outbox where room_id=%L',(select room_id from concurrent_room))) as r(total bigint)),1::bigint,'room committed before T is covered exactly once');
select dblink_exec('cutover_b','rollback');
select is((select count(*) from public.room_hosting_cutover_outbox),0::bigint,'aborted activation leaves no executable work');

select dblink_exec('cutover_b','begin');
select * from dblink('cutover_b',$q$select anidachi_private.activate_paid_hosting_v1('fb400000-0000-4000-8000-000000000002',1)$q$) as r(value jsonb);
select is(dblink_send_query('cutover_a',$q$insert into public.rooms(room_id,host_user_id,status,host_plan_code) values('cutover-late','fb400000-0000-4000-8000-000000000001','lobby','free') returning room_id$q$),1,'late insertion starts while activation owns policy lock');
select ok(pg_temp.cutover_waits('cutover_a'),'late insertion waits for activation commit');
-- Never expose this synthetic queued HTTP outside the uncommitted transaction.
select dblink_exec('cutover_b',$q$
 delete from net.http_request_queue where id=(select last_request_id from anidachi_private.hosting_cutover_scheduler);
 update anidachi_private.hosting_cutover_scheduler set enabled=false,last_request_id=null,last_attempt_at=null;
 commit;
$q$);
select * from dblink_get_result('cutover_a',false) as result(room_id text);
select ok(dblink_error_message('cutover_a') like '%HOST_SUBSCRIPTION_REQUIRED%','insert sees the committed cutover and cannot leak a new Free room');
select * from dblink_get_result('cutover_a',false) as result(room_id text);
select is((select count(*) from public.rooms where room_id='cutover-late'),0::bigint,'no late Free room exists');
select is((select count(*) from public.room_hosting_cutover_outbox),1::bigint,'committed target coverage survives across transactions');

select dblink_exec('cutover_a','begin; set local role service_role');
create temporary table lease_one as select * from dblink('cutover_a',$q$select room_id,lease_token from public.claim_room_hosting_cutover_v1(1)$q$) as r(room_id text,lease_token uuid);
select dblink_exec('cutover_b','begin; set local role service_role');
select is((select total from dblink('cutover_b','select count(*) from public.claim_room_hosting_cutover_v1(4)') as r(total bigint)),0::bigint,'competing drain skips locked targets without duplicate claim');
select dblink_exec('cutover_b','commit');
select dblink_exec('cutover_a','commit');
select dblink_exec('cutover_b',$q$update public.room_hosting_cutover_outbox set lease_until=now()-interval '1 second'$q$);
create temporary table lease_two as select * from public.claim_room_hosting_cutover_v1(1);
select isnt((select lease_token from lease_two),(select lease_token from lease_one),'expired claim gets a new fencing token');
select is(public.finish_room_hosting_cutover_v1(2,(select room_id from lease_one),1,(select lease_token from lease_one),null,null),'stale','late response from expired lease cannot clear the new owner');

-- Release main transaction row locks before fixture cleanup on the same session.
delete from public.room_hosting_cutover_outbox;
delete from public.hosting_cutover_operation;
update public.hosting_commercial_policy set activation_at=null,trials_enabled=false,revision=1;
update public.personal_history_policy set active=(select active from original_history);
update anidachi_private.hosting_cutover_scheduler set enabled=false,environment=null,last_request_id=null,last_attempt_at=null,last_result=null,last_result_at=null,last_status_code=null;
delete from vault.secrets where name='anidachi_hosting_cutover_drain_secret';
delete from public.rooms where host_user_id='fb400000-0000-4000-8000-000000000001';
delete from public.users where id='fb400000-0000-4000-8000-000000000001';
select dblink_disconnect('cutover_a');
select dblink_disconnect('cutover_b');
select * from finish();
commit;
