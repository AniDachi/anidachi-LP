-- All HTTP requests stay uncommitted: pg_net cannot send these test requests.
begin;
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
set local search_path = public, extensions;
select no_plan();
select has_function('anidachi_private', 'tick_inbox_push_scheduler', array[]::text[], 'private scheduler exists');
select is((select enabled from anidachi_private.inbox_push_scheduler), false, 'scheduler starts disabled');
select is((select environment from anidachi_private.inbox_push_scheduler), null::text, 'environment requires explicit operator choice');
select throws_ok($$update anidachi_private.inbox_push_scheduler set enabled=true$$, '23514', null, 'cannot enable without environment');
select throws_ok($$update anidachi_private.inbox_push_scheduler set environment='https://attacker.example'$$, '23514', null, 'arbitrary destinations are rejected');
select throws_ok($$insert into anidachi_private.inbox_push_scheduler(singleton) values(false)$$, '23514', null, 'second config row is impossible');
select ok((select not prosecdef and proconfig @> array['search_path=""','statement_timeout=1500ms','lock_timeout=500ms'] from pg_proc where oid='anidachi_private.tick_inbox_push_scheduler()'::regprocedure), 'scheduler is bounded security invoker with empty path');
select is((select count(*) from cron.job where jobname='anidachi-inbox-push-drain'), 1::bigint, 'one named cron job');
select ok((select schedule='* * * * *' and command=$command$set statement_timeout='1500ms'; select anidachi_private.tick_inbox_push_scheduler();$command$ and username='postgres' from cron.job where jobname='anidachi-inbox-push-drain'), 'minute operator job sets an outer SQL timeout before its secret-free private call');

-- Another operator owns the singleton lock. The competing tick must skip it,
-- not block until the SQL timeout or proceed using an unlocked config snapshot.
select extensions.dblink_connect('scheduler_lock',format('hostaddr=%s port=%s dbname=postgres user=postgres password=postgres',inet_server_addr(),inet_server_port()));
select extensions.dblink_exec('scheduler_lock','begin');
select * from extensions.dblink('scheduler_lock','select singleton from anidachi_private.inbox_push_scheduler for update') as locked(singleton boolean);
select lives_ok('select anidachi_private.tick_inbox_push_scheduler()','concurrent singleton owner makes tick a nonblocking no-op');
select extensions.dblink_exec('scheduler_lock','rollback');
select extensions.dblink_exec('scheduler_lock',(select split_part(command,';',1) from cron.job where jobname='anidachi-inbox-push-drain'));
-- pgTAP throws_ok's WHEN OTHERS does not catch query_canceled; catch that exact
-- SQLSTATE explicitly in this test-only helper, never in scheduler production.
create function pg_temp.scheduler_timeout_probe() returns text language plpgsql as $$
begin
  perform * from extensions.dblink('scheduler_lock','select pg_sleep(2)') as probe(result text);
  return 'completed';
exception when query_canceled then return sqlstate;
end$$;
select is(pg_temp.scheduler_timeout_probe(),'57014','cron timeout preamble actually cancels a slow outer SQL statement');
select extensions.dblink_disconnect('scheduler_lock');

create temporary table scheduler_baseline as select count(*) as requests from net.http_request_queue;
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'disabled does not enqueue HTTP');
update anidachi_private.inbox_push_scheduler set environment='staging',enabled=true;
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'no work does not enqueue HTTP');
insert into public.users(id,email,display_name) values ('95100000-0000-4000-8000-000000000001','scheduler@example.test','Scheduler fixture');
insert into public.account_inbox_push_outbox(user_id) values ('95100000-0000-4000-8000-000000000001');
select anidachi_private.tick_inbox_push_scheduler();
select is((select last_result from anidachi_private.inbox_push_scheduler), 'missing_secret', 'missing dedicated Vault secret is safe failure');
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'missing secret sends no HTTP');
do $$begin perform vault.create_secret('scheduler-test-only-credential', 'anidachi_notification_drain_secret'); end$$;

update public.account_inbox_push_outbox set cooldown_until=now()+interval '1 hour' where user_id='95100000-0000-4000-8000-000000000001';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'cooldown prevents HTTP');
update public.account_inbox_push_outbox set cooldown_until=null,next_attempt_at=now()+interval '1 hour' where user_id='95100000-0000-4000-8000-000000000001';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'future retry prevents HTTP');
update public.account_inbox_push_outbox set next_attempt_at=now(),lease_token=gen_random_uuid(),lease_revision=revision,lease_until=now()+interval '1 hour' where user_id='95100000-0000-4000-8000-000000000001';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'live lease prevents HTTP');
update public.account_inbox_push_outbox set lease_until=now()-interval '1 second' where user_id='95100000-0000-4000-8000-000000000001';
savepoint request_rollback;
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests+1 from scheduler_baseline), 'due work queues one HTTP request');
select ok((select q.method='POST' and q.url='https://staging.anidachi.app/api/internal/notifications/drain' and q.timeout_milliseconds=40000 and q.headers=jsonb_build_object('Content-Type','application/json','Authorization','Bearer scheduler-test-only-credential') and convert_from(q.body,'UTF8')::jsonb='{}'::jsonb from net.http_request_queue q join anidachi_private.inbox_push_scheduler s on s.last_request_id=q.id), 'request has exact fixed destination, dedicated auth, empty body and timeout');
select anidachi_private.tick_inbox_push_scheduler();
update anidachi_private.inbox_push_scheduler set last_attempt_at=now()-interval '1 day';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests+1 from scheduler_baseline), 'queued request suppresses ticks indefinitely while pg_net stalled');
rollback to request_rollback;
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'request rollback leaves no HTTP work');
select is((select last_request_id from anidachi_private.inbox_push_scheduler), null::bigint, 'request rollback also restores status');

-- Simulate pg_net consuming the request inside this same uncommitted transaction.
select anidachi_private.tick_inbox_push_scheduler();
delete from net.http_request_queue where id=(select last_request_id from anidachi_private.inbox_push_scheduler);
update anidachi_private.inbox_push_scheduler set last_attempt_at=clock_timestamp()-interval '89 seconds';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'in-flight request gets at least ninety seconds');
update anidachi_private.inbox_push_scheduler set last_attempt_at=clock_timestamp()-interval '91 seconds';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests+1 from scheduler_baseline), 'lost in-flight HTTP can retry after grace');

-- Responses are reduced to fixed metadata; bodies, headers and error text never persist.
create function pg_temp.scheduler_response(code integer, body text, timeout boolean default false, error_text text default null)
returns void language plpgsql as $$
begin
  if (select last_request_id is null from anidachi_private.inbox_push_scheduler) then
    update public.account_inbox_push_outbox set next_attempt_at=now() where user_id='95100000-0000-4000-8000-000000000001';
    perform anidachi_private.tick_inbox_push_scheduler();
  end if;
  delete from net.http_request_queue where id=(select last_request_id from anidachi_private.inbox_push_scheduler);
  delete from net._http_response where id=(select last_request_id from anidachi_private.inbox_push_scheduler);
  insert into net._http_response(id,status_code,content,timed_out,error_msg,headers)
    select last_request_id,code,body,timeout,error_text,'{"private":"never-retain"}'::jsonb from anidachi_private.inbox_push_scheduler;
  update public.account_inbox_push_outbox set next_attempt_at=now()+interval '1 hour' where user_id='95100000-0000-4000-8000-000000000001';
  perform anidachi_private.tick_inbox_push_scheduler();
end$$;
select pg_temp.scheduler_response(200,'{"ok":true}');
select is((select last_result from anidachi_private.inbox_push_scheduler),'succeeded','exact acknowledgement succeeds');
select is((select last_request_id from anidachi_private.inbox_push_scheduler), null::bigint, 'completed response is consumed only once');
update anidachi_private.inbox_push_scheduler set last_result_at='2000-01-01T00:00:00Z';
select anidachi_private.tick_inbox_push_scheduler();
select is((select last_result_at from anidachi_private.inbox_push_scheduler),'2000-01-01T00:00:00Z'::timestamptz,'idle ticks do not refresh the old successful result timestamp');
select pg_temp.scheduler_response(200,E' \n{ "ok" : true }\r\t');
select is((select last_result from anidachi_private.inbox_push_scheduler),'succeeded','JSON whitespace around literal acknowledgement succeeds');
select pg_temp.scheduler_response(200,E'\v{"ok":true}');
select is((select last_result from anidachi_private.inbox_push_scheduler),'invalid_ack','non-JSON whitespace is not a valid acknowledgement');
select pg_temp.scheduler_response(200,'{"ok":false,"ok":true}');
select is((select last_result from anidachi_private.inbox_push_scheduler),'invalid_ack','duplicate JSON keys are rejected');
select pg_temp.scheduler_response(200,'{"ok":true,"private":"never-retain"}');
select is((select last_result from anidachi_private.inbox_push_scheduler),'invalid_ack','extra acknowledgement fields rejected');
select pg_temp.scheduler_response(200,'not-json-never-retain');
select is((select last_result from anidachi_private.inbox_push_scheduler),'invalid_ack','malformed body safely rejected');
select pg_temp.scheduler_response(200,repeat('never-retain',1000));
select is((select last_result from anidachi_private.inbox_push_scheduler),'invalid_ack','oversized body rejected before parsing');
select pg_temp.scheduler_response(200,'{"ok":false}');
select is((select last_result from anidachi_private.inbox_push_scheduler),'invalid_ack','negative acknowledgement rejected');
select pg_temp.scheduler_response(201,'{"ok":true}');
select is((select last_result from anidachi_private.inbox_push_scheduler),'http_error','only HTTP 200 is accepted');
select pg_temp.scheduler_response(302,'{"ok":true}');
select is((select last_result from anidachi_private.inbox_push_scheduler),'http_error','redirect response is not success');
select pg_temp.scheduler_response(null,null,true,'private provider error never-retain');
select is((select last_result from anidachi_private.inbox_push_scheduler),'transport_error','transport failure stores only fixed category');
select ok((select row_to_json(s)::text not like '%never-retain%' and row_to_json(s)::text not like '%scheduler-test-only-credential%' from anidachi_private.inbox_push_scheduler s),'status retains neither secrets nor raw response data');
update public.account_inbox_push_outbox set next_attempt_at=now() where user_id='95100000-0000-4000-8000-000000000001';
select anidachi_private.tick_inbox_push_scheduler();
select is((select last_result from anidachi_private.inbox_push_scheduler),'transport_error','a new attempt retains the previous safe response result');
delete from net.http_request_queue where id=(select last_request_id from anidachi_private.inbox_push_scheduler);

update anidachi_private.inbox_push_scheduler set last_request_id=null,last_attempt_at=null,environment='production';
update public.account_inbox_push_outbox set next_attempt_at=now() where user_id='95100000-0000-4000-8000-000000000001';
select anidachi_private.tick_inbox_push_scheduler();
select is((select url from net.http_request_queue where id=(select last_request_id from anidachi_private.inbox_push_scheduler)), 'https://www.anidachi.app/api/internal/notifications/drain','production destination is canonical');
delete from net.http_request_queue where id=(select last_request_id from anidachi_private.inbox_push_scheduler);
update anidachi_private.inbox_push_scheduler set last_request_id=null,last_attempt_at=null;
update public.account_inbox_push_outbox set next_attempt_at=now()+interval '1 hour',cooldown_until=now()+interval '1 hour',expires_at=now()-interval '1 second' where user_id='95100000-0000-4000-8000-000000000001';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests+1 from scheduler_baseline), 'expired-only future cooldown work still invokes bounded maintenance');
delete from net.http_request_queue where id=(select last_request_id from anidachi_private.inbox_push_scheduler);
update anidachi_private.inbox_push_scheduler set last_request_id=null,last_attempt_at=null;
update public.account_inbox_push_outbox set expires_at=now()+interval '1 day',attempts=8 where user_id='95100000-0000-4000-8000-000000000001';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests+1 from scheduler_baseline), 'exhausted-only future cooldown work still invokes maintenance');
delete from net.http_request_queue where id=(select last_request_id from anidachi_private.inbox_push_scheduler);
update anidachi_private.inbox_push_scheduler set last_request_id=null,last_attempt_at=null;
update public.account_inbox_push_outbox set lease_until=now()+interval '1 hour' where user_id='95100000-0000-4000-8000-000000000001';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'maintenance also respects live lease');
update public.account_inbox_push_outbox set lease_until=now()-interval '1 second',terminal_at=now() where user_id='95100000-0000-4000-8000-000000000001';
select anidachi_private.tick_inbox_push_scheduler();
select is((select count(*) from net.http_request_queue), (select requests from scheduler_baseline), 'terminal rows do not trigger HTTP');

select ok(not has_schema_privilege(r,'anidachi_private','usage') and not has_table_privilege(r,'anidachi_private.inbox_push_scheduler','select') and not has_function_privilege(r,'anidachi_private.tick_inbox_push_scheduler()','execute'), r || ' cannot read or invoke scheduler') from unnest(array['anon','authenticated','service_role']) r;
-- Supabase intentionally owns pg_net PUBLIC grants. Its supported boundary is
-- NOLOGIN API roles + a nonexposed net schema, not client SQL ACL revocation.
-- Remote Data API schema exposure is a separate activation gate verified by the
-- operator; these local SQL tests do not claim to verify PostgREST configuration.
select ok(not rolcanlogin,rolname || ' cannot log into Postgres directly') from pg_roles where rolname in ('anon','authenticated');
select ok(not has_table_privilege(r,'vault.decrypted_secrets','select'),r || ' cannot read decrypted Vault secrets') from unnest(array['anon','authenticated']) r;
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','graphql_public')
    and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))
    and p.prosrc ~* '(net\.|vault\.|anidachi_private\.|decrypted_secrets|\mEXECUTE\M)'),0::bigint,'client-callable exposed functions contain no transport, Vault or dynamic SQL bridge');
set local role anon;
select throws_ok('select anidachi_private.tick_inbox_push_scheduler()', '42501', null, 'anonymous scheduler execution denied');
select throws_ok('select * from vault.decrypted_secrets', '42501', null, 'anonymous decrypted secret read denied');
reset role;
set local role authenticated;
select throws_ok('select * from anidachi_private.inbox_push_scheduler', '42501', null, 'authenticated status read denied');
select throws_ok('select * from vault.decrypted_secrets', '42501', null, 'authenticated decrypted secret read denied');
reset role;
select * from finish();
rollback;
