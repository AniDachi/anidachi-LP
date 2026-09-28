-- All transport and Vault fixtures roll back; no HTTP is committed.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temporary table transport_baseline as select count(*) requests from net.http_request_queue;
select anidachi_private.tick_hosting_cutover_scheduler();
select is((select count(*) from net.http_request_queue),(select requests from transport_baseline),'disabled recovery emits no requests');
update anidachi_private.hosting_cutover_scheduler set enabled=true,environment='staging';
select anidachi_private.tick_hosting_cutover_scheduler();
select is((select count(*) from net.http_request_queue),(select requests from transport_baseline),'enabled recovery without targets emits no requests');
insert into public.hosting_cutover_operation(operation_id,revision,activation_at,target_count) values('fb300000-0000-4000-8000-000000000001',2,now(),1);
insert into public.room_hosting_cutover_outbox(revision,room_id,room_generation,closing_at) values(2,'scheduler-target',1,now());
select anidachi_private.tick_hosting_cutover_scheduler();
select is((select last_result from anidachi_private.hosting_cutover_scheduler),'missing_secret','missing dedicated key fails safely');
do $$begin perform vault.create_secret('cutover-scheduler-test-only','anidachi_hosting_cutover_drain_secret');end$$;
update public.room_hosting_cutover_outbox set lease_token=gen_random_uuid(),lease_until=now()+interval '1 minute';
select anidachi_private.tick_hosting_cutover_scheduler();
select is((select count(*) from net.http_request_queue),(select requests from transport_baseline),'live lease avoids redundant HTTP');
update public.room_hosting_cutover_outbox set lease_token=null,lease_until=null;
select anidachi_private.tick_hosting_cutover_scheduler();
select ok((select q.method='POST' and q.url='https://staging.anidachi.app/api/internal/rooms/cutover/drain'
 and q.timeout_milliseconds=40000 and q.headers=jsonb_build_object('Content-Type','application/json','Authorization','Bearer cutover-scheduler-test-only')
 and convert_from(q.body,'UTF8')::jsonb='{}'::jsonb from net.http_request_queue q join anidachi_private.hosting_cutover_scheduler s on s.last_request_id=q.id),'exact owned URL, empty payload, dedicated auth and bounded timeout');
update anidachi_private.hosting_cutover_scheduler set last_attempt_at=now()-interval '1 day';
select anidachi_private.tick_hosting_cutover_scheduler();
select is((select last_result from anidachi_private.hosting_cutover_scheduler),'transport_stalled','stalled transport remains visible');
select is((select count(*) from net.http_request_queue),(select requests+1 from transport_baseline),'stalled pg_net queue cannot accumulate duplicate requests');
delete from net.http_request_queue where id=(select last_request_id from anidachi_private.hosting_cutover_scheduler);
select anidachi_private.tick_hosting_cutover_scheduler();
select is((select last_result from anidachi_private.hosting_cutover_scheduler),'response_missing','lost transport response is observable');
select is((select count(*) from net.http_request_queue),(select requests+1 from transport_baseline),'lost transport recovers work from durable outbox');
create function pg_temp.cutover_response(code integer,body text) returns void language plpgsql as $$
begin
 if (select last_request_id is null from anidachi_private.hosting_cutover_scheduler) then
  update public.room_hosting_cutover_outbox set next_attempt_at=now();
  perform anidachi_private.tick_hosting_cutover_scheduler();
 end if;
 delete from net.http_request_queue where id=(select last_request_id from anidachi_private.hosting_cutover_scheduler);
 insert into net._http_response(id,status_code,content,timed_out) select last_request_id,code,body,false from anidachi_private.hosting_cutover_scheduler;
 update public.room_hosting_cutover_outbox set next_attempt_at=now()+interval '1 hour';
 perform anidachi_private.tick_hosting_cutover_scheduler();
end $$;
select pg_temp.cutover_response(200,'{"ok":true}');
select is((select last_result from anidachi_private.hosting_cutover_scheduler),'succeeded','only explicit health acknowledgement succeeds');
select pg_temp.cutover_response(200,'{"ok":false,"ok":true}');
select is((select last_result from anidachi_private.hosting_cutover_scheduler),'invalid_ack','duplicate keys do not fake health');
select pg_temp.cutover_response(200,'{"ok":true,"private":"never-retain"}');
select is((select last_result from anidachi_private.hosting_cutover_scheduler),'invalid_ack','unexpected private payload is discarded');
select pg_temp.cutover_response(302,'{"ok":true}');
select is((select last_result from anidachi_private.hosting_cutover_scheduler),'http_error','redirect is not acknowledged');
select ok((select row_to_json(s)::text not like '%never-retain%' and row_to_json(s)::text not like '%test-only%' from anidachi_private.hosting_cutover_scheduler s),'diagnostics retain no credential or response content');
select ok(not has_schema_privilege(r,'anidachi_private','usage')
 and not has_table_privilege(r,'anidachi_private.hosting_cutover_scheduler','select')
 and not has_function_privilege(r,'anidachi_private.tick_hosting_cutover_scheduler()','execute'),r||' has no scheduler authority')
 from unnest(array['anon','authenticated','service_role']) r;
select ok((select command like 'set statement_timeout=''1500ms'';%' from cron.job where jobname='anidachi-hosting-cutover-drain'),'cron SQL has an outer deadline');
select * from finish();
rollback;
