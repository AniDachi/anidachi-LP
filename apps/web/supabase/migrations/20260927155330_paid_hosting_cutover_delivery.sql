-- Dormant delivery foundation. Only an explicit operator activation can create
-- targets; deploying this migration does not change hosting or emit HTTP.
set lock_timeout='5s';
set statement_timeout='30s';

create table public.hosting_cutover_operation (
 singleton boolean primary key default true check(singleton),
 operation_id uuid not null unique,
 revision bigint not null unique check(revision>0),
 activation_at timestamptz not null check(isfinite(activation_at)),
 target_count integer not null default 0 check(target_count>=0)
);
create table public.room_hosting_cutover_outbox (
 revision bigint not null references public.hosting_cutover_operation(revision),
 room_id text not null check(length(room_id) between 1 and 128),
 room_generation bigint not null check(room_generation>0),
 closing_at timestamptz not null check(isfinite(closing_at)),
 attempts integer not null default 0 check(attempts>=0),
 next_attempt_at timestamptz not null default clock_timestamp(),
 lease_token uuid,
 lease_until timestamptz,
 fenced_at timestamptz check(isfinite(fenced_at)),
 finalized_at timestamptz check(isfinite(finalized_at)),
 primary key(revision,room_id,room_generation),
 check((lease_token is null)=(lease_until is null)),
 check(finalized_at is null or (fenced_at is not null and finalized_at>=fenced_at))
);
create index room_hosting_cutover_pending on public.room_hosting_cutover_outbox(next_attempt_at)
 where finalized_at is null;
alter table public.hosting_cutover_operation enable row level security;
alter table public.room_hosting_cutover_outbox enable row level security;
revoke all on public.hosting_cutover_operation,public.room_hosting_cutover_outbox from public,anon,authenticated,service_role;
grant select on public.hosting_cutover_operation,public.room_hosting_cutover_outbox to service_role;

create table anidachi_private.hosting_cutover_scheduler (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 environment text check(environment in ('staging','production')),
 last_request_id bigint,
 last_attempt_at timestamptz,
 last_result_at timestamptz,
 last_result text check(last_result in ('succeeded','invalid_ack','http_error','transport_error','response_missing','missing_secret','transport_stalled')),
 last_status_code integer check(last_status_code between 100 and 599),
 check(not enabled or environment is not null),
 check(last_request_id is null or last_attempt_at is not null)
);
alter table anidachi_private.hosting_cutover_scheduler enable row level security;
revoke all on anidachi_private.hosting_cutover_scheduler from public,anon,authenticated,service_role;
grant all on anidachi_private.hosting_cutover_scheduler to postgres;
insert into anidachi_private.hosting_cutover_scheduler(singleton) values(true);

-- Same private delivery pattern as notifications, with its own narrow key.
-- pg_net transport is unlogged: the logged outbox, never transport, owns work.
create function anidachi_private.tick_hosting_cutover_scheduler()
returns void language plpgsql security invoker set search_path=''
set statement_timeout='1500ms' set lock_timeout='500ms' as $$
declare config anidachi_private.hosting_cutover_scheduler%rowtype;
 response net._http_response%rowtype; tick_at timestamptz:=clock_timestamp();
 drain_secret text; drain_url text; request_id bigint; result text;
begin
 select * into config from anidachi_private.hosting_cutover_scheduler where singleton for update skip locked;
 if not found or not config.enabled then return; end if;
 if config.last_request_id is not null then
  if exists(select 1 from net.http_request_queue where id=config.last_request_id) then
   if tick_at>=config.last_attempt_at+interval '90 seconds' then
    update anidachi_private.hosting_cutover_scheduler set last_result='transport_stalled',last_result_at=tick_at where singleton;
   end if;
   return; -- Do not grow an indefinitely stalled transport queue.
  end if;
  select * into response from net._http_response where id=config.last_request_id order by created desc limit 1;
  if found then
   result:=case when response.timed_out is true or response.error_msg is not null then 'transport_error'
    when response.status_code is distinct from 200 then 'http_error'
    when octet_length(response.content)<=128 and response.content ~ '^[ \t\r\n]*\{[ \t\r\n]*"ok"[ \t\r\n]*:[ \t\r\n]*true[ \t\r\n]*\}[ \t\r\n]*$' then 'succeeded'
    else 'invalid_ack' end;
   update anidachi_private.hosting_cutover_scheduler set last_request_id=null,last_result=result,last_result_at=tick_at,
    last_status_code=case when response.status_code between 100 and 599 then response.status_code else null end where singleton;
  elsif tick_at<config.last_attempt_at+interval '90 seconds' then return;
  else
   update anidachi_private.hosting_cutover_scheduler set last_request_id=null,last_result='response_missing',last_result_at=tick_at,last_status_code=null where singleton;
  end if;
 end if;
 if not exists(select 1 from public.room_hosting_cutover_outbox where finalized_at is null
  and next_attempt_at<=tick_at and (lease_until is null or lease_until<=tick_at)) then return; end if;
 select decrypted_secret into drain_secret from vault.decrypted_secrets where name='anidachi_hosting_cutover_drain_secret';
 if drain_secret is null or length(drain_secret)=0 then
  update anidachi_private.hosting_cutover_scheduler set last_result='missing_secret',last_result_at=tick_at where singleton;
  return;
 end if;
 drain_url:=case config.environment when 'staging' then 'https://staging.anidachi.app/api/internal/rooms/cutover/drain'
  when 'production' then 'https://www.anidachi.app/api/internal/rooms/cutover/drain' end;
 request_id:=net.http_post(url=>drain_url,body=>'{}'::jsonb,params=>'{}'::jsonb,
  headers=>jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||drain_secret),timeout_milliseconds=>40000);
 update anidachi_private.hosting_cutover_scheduler set last_request_id=request_id,last_attempt_at=tick_at where singleton;
end $$;
revoke all on function anidachi_private.tick_hosting_cutover_scheduler() from public,anon,authenticated,service_role;
grant execute on function anidachi_private.tick_hosting_cutover_scheduler() to postgres;
select cron.schedule('anidachi-hosting-cutover-drain','* * * * *',
 $command$set statement_timeout='1500ms'; select anidachi_private.tick_hosting_cutover_scheduler();$command$);

create function anidachi_private.activate_paid_hosting_v1(p_operation_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype;
 op public.hosting_cutover_operation%rowtype; active_history boolean; config_ready boolean;
begin
 if p_operation_id is null or p_expected_revision is null or p_expected_revision<1 then raise exception 'HOSTING_ACTIVATION_INVALID'; end if;
 -- Admission holds these locks through its commit; take the same order.
 select active into strict active_history from public.personal_history_policy where singleton for share;
 select * into strict policy from public.hosting_commercial_policy where singleton for update;
 select * into op from public.hosting_cutover_operation where singleton;
 if found then
  if op.operation_id<>p_operation_id then raise exception 'HOSTING_ALREADY_ACTIVATED'; end if;
 else
  if policy.activation_at is not null then raise exception 'HOSTING_ALREADY_ACTIVATED'; end if;
  if policy.revision<>p_expected_revision then raise exception 'HOSTING_REVISION_CONFLICT'; end if;
  select enabled and environment is not null into config_ready from anidachi_private.hosting_cutover_scheduler where singleton for share;
  if config_ready is distinct from true or not exists(select 1 from vault.decrypted_secrets where name='anidachi_hosting_cutover_drain_secret' and length(decrypted_secret)>0) then
   raise exception 'HOSTING_DELIVERY_NOT_READY';
  end if;
  if active_history is distinct from true then raise exception 'HOSTING_HISTORY_NOT_READY'; end if;
  insert into public.hosting_cutover_operation(operation_id,revision,activation_at)
   values(p_operation_id,policy.revision+1,clock_timestamp()) returning * into op;
  insert into public.room_hosting_cutover_outbox(revision,room_id,room_generation,closing_at)
   select op.revision,r.room_id,coalesce(r.presence_room_generation,(r.media_lease->>'roomGeneration')::bigint,1),op.activation_at
   from public.rooms r where r.status<>'ended' and r.host_plan_code in ('free','watcher');
  update public.hosting_cutover_operation set target_count=(select count(*) from public.room_hosting_cutover_outbox where revision=op.revision)
   where singleton returning * into op;
  update public.hosting_commercial_policy set revision=op.revision,activation_at=op.activation_at,trials_enabled=true where singleton;
  -- The queued HTTP cannot execute until this activation transaction commits.
  perform anidachi_private.tick_hosting_cutover_scheduler();
 end if;
 return jsonb_build_object('operationId',op.operation_id,'revision',op.revision,'activationAt',op.activation_at,'targetCount',op.target_count);
end $$;
revoke all on function anidachi_private.activate_paid_hosting_v1(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function anidachi_private.activate_paid_hosting_v1(uuid,bigint) to postgres;

create function public.claim_room_hosting_cutover_v1(p_limit integer default 8)
returns setof public.room_hosting_cutover_outbox language plpgsql security definer set search_path='' as $$
begin
 if p_limit is null or p_limit<1 or p_limit>32 then raise exception 'HOSTING_CLAIM_INVALID'; end if;
 return query with due as (
  select revision,room_id,room_generation from public.room_hosting_cutover_outbox
  where finalized_at is null and next_attempt_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp())
  order by next_attempt_at,room_id for update skip locked limit p_limit
 ) update public.room_hosting_cutover_outbox o set lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '60 seconds',attempts=o.attempts+1
 from due where (o.revision,o.room_id,o.room_generation)=(due.revision,due.room_id,due.room_generation) returning o.*;
end $$;
revoke all on function public.claim_room_hosting_cutover_v1(integer) from public,anon,authenticated;
grant execute on function public.claim_room_hosting_cutover_v1(integer) to service_role;

create function public.finish_room_hosting_cutover_v1(p_revision bigint,p_room_id text,p_room_generation bigint,p_lease_token uuid,p_fenced_at timestamptz,p_finalized_at timestamptz)
returns text language plpgsql security definer set search_path='' as $$
declare job public.room_hosting_cutover_outbox%rowtype; complete boolean;
begin
 select * into job from public.room_hosting_cutover_outbox
  where (revision,room_id,room_generation)=(p_revision,p_room_id,p_room_generation) for update;
 if not found then return 'stale'; end if;
 if job.finalized_at is not null then return 'completed'; end if;
 if p_lease_token is null or job.lease_token is distinct from p_lease_token or job.lease_until<=clock_timestamp() then return 'stale'; end if;
 if (p_fenced_at is not null and (not isfinite(p_fenced_at) or p_fenced_at>clock_timestamp()+interval '1 minute'))
  or (p_finalized_at is not null and (p_fenced_at is null or not isfinite(p_finalized_at) or p_finalized_at<p_fenced_at or p_finalized_at>clock_timestamp()+interval '1 minute')) then
  raise exception 'HOSTING_ACK_INVALID';
 end if;
 complete:=p_finalized_at is not null
  and not exists(select 1 from public.rooms where room_id=p_room_id and status<>'ended')
  and not exists(select 1 from public.active_room_sessions where room_id=p_room_id);
 update public.room_hosting_cutover_outbox set fenced_at=coalesce(job.fenced_at,p_fenced_at),
  finalized_at=case when complete then p_finalized_at else null end,lease_token=null,lease_until=null,
  next_attempt_at=clock_timestamp()+make_interval(secs=>least(60,power(2,least(job.attempts,6)))::double precision)
  where (revision,room_id,room_generation)=(p_revision,p_room_id,p_room_generation);
 return case when complete then 'completed' else 'retry' end;
end $$;
revoke all on function public.finish_room_hosting_cutover_v1(bigint,text,bigint,uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.finish_room_hosting_cutover_v1(bigint,text,bigint,uuid,timestamptz,timestamptz) to service_role;

create function public.check_room_hosting_socket_v1(p_room_id text,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rooms%rowtype; target public.room_hosting_cutover_outbox%rowtype;
 result jsonb; denial text;
begin
 perform public.lock_hosting_commercial_policy_v1();
 select * into r from public.rooms where room_id=p_room_id;
 result:=jsonb_build_object('roomId',p_room_id,'roomGeneration',coalesce(r.presence_room_generation,(r.media_lease->>'roomGeneration')::bigint,1));
 if not found or r.status='ended' then denial:='ROOM_ENDED';
 else
  begin
   perform public.require_room_hosting_admission_v1(p_room_id,p_user_id);
  exception when raise_exception then
   if sqlerrm<>'HOST_SUBSCRIPTION_REQUIRED' then raise; end if;
   denial:='HOST_SUBSCRIPTION_REQUIRED';
  end;
 end if;
 if denial is null then return result||jsonb_build_object('allowed',true); end if;
 result:=result||jsonb_build_object('allowed',false,'code',denial);
 select * into target from public.room_hosting_cutover_outbox where room_id=p_room_id order by revision desc limit 1;
 if found then
  result:=result||jsonb_build_object('roomGeneration',target.room_generation,'cutover',jsonb_build_object(
   'revision',target.revision,'roomId',target.room_id,'roomGeneration',target.room_generation,
   'closingAt',floor(extract(epoch from target.closing_at)*1000)::bigint));
 end if;
 return result;
end $$;
revoke all on function public.check_room_hosting_socket_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.check_room_hosting_socket_v1(text,uuid) to service_role;

-- Legacy aliases remain allowed in storage, so frozen watcher must behave as Free.
do $$declare body text; target regprocedure;
begin
 foreach target in array array['public.require_room_hosting_admission_v1(text,uuid)'::regprocedure,'public.renew_room_media_lease_v2(text)'::regprocedure] loop
  select pg_get_functiondef(target) into body;
  if position('r.host_plan_code=''free''' in body)=0 then raise exception 'unexpected frozen plan guard'; end if;
  execute replace(body,'r.host_plan_code=''free''','r.host_plan_code in (''free'',''watcher'')');
 end loop;
end $$;
reset lock_timeout;
reset statement_timeout;
