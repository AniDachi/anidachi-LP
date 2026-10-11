-- Analytics never performs Stripe/account mutations. Existing trial records are not backfilled.
set lock_timeout='5s';
set statement_timeout='30s';

create table anidachi_private.trial_event_scheduler (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 environment text check(environment in ('staging','production')),
 last_request_id bigint, last_attempt_at timestamptz,
 last_result_at timestamptz, last_result text,
 check(not enabled or environment is not null)
);
alter table anidachi_private.trial_event_scheduler enable row level security;
revoke all on anidachi_private.trial_event_scheduler from public,anon,authenticated,service_role;
grant all on anidachi_private.trial_event_scheduler to postgres;
insert into anidachi_private.trial_event_scheduler(singleton) values(true);

create table public.trial_conversion_events (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 activation_id uuid not null references public.subscription_trial_activations(id) on delete cascade,
 event_type text not null check(event_type in ('trial_started','trial_renewal_enabled','trial_first_payment_succeeded','trial_first_room_created','trial_first_shared_session')),
 source_id text not null check(char_length(source_id) between 1 and 255),
 trial_mode text not null default 'cardless' check(trial_mode='cardless'),
 plan_code text not null check(plan_code in ('plus','pro')),
 billing_period text not null check(billing_period in ('monthly','yearly')),
 occurred_at timestamptz not null check(isfinite(occurred_at)),
 environment text check(environment in ('staging','production')),
 created_at timestamptz not null default clock_timestamp(),
 attempts integer not null default 0 check(attempts>=0),
 first_attempt_at timestamptz, next_attempt_at timestamptz not null default clock_timestamp(),
 lease_token uuid, lease_until timestamptz,
 delivered_at timestamptz, manual_recovery_at timestamptz,
 unique(event_type,source_id),
 check((lease_token is null)=(lease_until is null))
);
create index trial_conversion_due on public.trial_conversion_events(next_attempt_at) where delivered_at is null and manual_recovery_at is null;
alter table public.trial_conversion_events enable row level security;
revoke all on public.trial_conversion_events from public,anon,authenticated,service_role;
grant select on public.trial_conversion_events to service_role;

create function public.enqueue_trial_conversion_v1(p_event_type text,p_user_id uuid,p_source_id text,p_at timestamptz,p_plan text default null,p_period text default null)
returns void language plpgsql security definer set search_path='' as $$
declare t public.account_subscription_trials%rowtype; a public.subscription_trial_activations%rowtype; r public.subscription_trial_renewals%rowtype; env text;
begin
 select * into t from public.account_subscription_trials where user_id=p_user_id and trial_mode='cardless';
 if not found then return; end if;
 select * into strict a from public.subscription_trial_activations where id=t.trial_activation_id and user_id=p_user_id;
 if p_event_type in ('trial_first_room_created','trial_first_shared_session') and (p_at<t.trial_started_at or p_at>=t.trial_ends_at) then return; end if;
 if p_event_type='trial_first_payment_succeeded' then
  if t.first_payment_state<>'paid' or t.first_invoice_id is null or t.first_paid_at is null then return; end if;
  select * into r from public.subscription_trial_renewals where id=t.renewal_operation_id and state='applied' and action='enable';
 end if;
 select environment into env from anidachi_private.trial_event_scheduler where singleton;
 insert into public.trial_conversion_events(user_id,activation_id,event_type,source_id,plan_code,billing_period,occurred_at,environment)
 values(p_user_id,a.id,p_event_type,p_source_id,coalesce(p_plan,r.plan_code,a.plan_code),coalesce(p_period,r.billing_period,a.billing_period),p_at,env)
 on conflict(event_type,source_id) do nothing;
end $$;
revoke all on function public.enqueue_trial_conversion_v1(text,uuid,text,timestamptz,text,text) from public,anon,authenticated,service_role;

create function public.record_trial_ledger_conversion_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.trial_mode<>'cardless' then return new; end if;
 if tg_op='INSERT' then
  perform public.enqueue_trial_conversion_v1('trial_started',new.user_id,new.trial_activation_id::text,new.trial_started_at);
 end if;
 if new.first_payment_state='paid' and (tg_op='INSERT' or old.first_payment_state is distinct from 'paid') then
  perform public.enqueue_trial_conversion_v1('trial_first_payment_succeeded',new.user_id,new.first_invoice_id,new.first_paid_at);
 end if;
 return new;
end $$;
create trigger trial_ledger_conversion after insert or update on public.account_subscription_trials for each row execute function public.record_trial_ledger_conversion_v1();
revoke all on function public.record_trial_ledger_conversion_v1() from public,anon,authenticated,service_role;

create function public.record_trial_renewal_conversion_v1() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.state='applied' and new.action='enable' and (tg_op='INSERT' or old.state is distinct from 'applied') then
  perform public.enqueue_trial_conversion_v1('trial_renewal_enabled',new.user_id,new.id::text,new.updated_at,new.plan_code,new.billing_period);
 end if;
 return new;
end $$;
create trigger trial_renewal_conversion after insert or update on public.subscription_trial_renewals for each row execute function public.record_trial_renewal_conversion_v1();
revoke all on function public.record_trial_renewal_conversion_v1() from public,anon,authenticated,service_role;

create function public.record_trial_room_conversion_v1() returns trigger language plpgsql security definer set search_path='' as $$
declare activation uuid;
begin
 select trial_activation_id into activation from public.account_subscription_trials where user_id=new.host_user_id and trial_mode='cardless';
 if activation is not null then perform public.enqueue_trial_conversion_v1('trial_first_room_created',new.host_user_id,activation::text,new.created_at); end if;
 return new;
end $$;
create trigger trial_room_conversion after insert on public.rooms for each row execute function public.record_trial_room_conversion_v1();
revoke all on function public.record_trial_room_conversion_v1() from public,anon,authenticated,service_role;

create function public.claim_trial_conversion_events_v1(p_environment text,p_limit integer default 8)
returns setof public.trial_conversion_events language plpgsql security definer set search_path='' set lock_timeout='1s' set statement_timeout='2500ms' as $$
declare tick timestamptz:=clock_timestamp();
begin
 if p_environment is null or p_environment not in ('staging','production') or p_limit is null or p_limit<1 or p_limit>8 then raise exception 'TRIAL_ANALYTICS_INPUT_INVALID'; end if;
 if not exists(select 1 from anidachi_private.trial_event_scheduler where singleton and enabled and environment=p_environment) then return; end if;
 -- Amplitude deduplicates for seven days. Stop blind replay at six days since
 -- the first attempt; retain the record for operator reconciliation.
 with old_events as (
  select id from public.trial_conversion_events where delivered_at is null and manual_recovery_at is null
   and (environment is null or environment=p_environment) and (lease_until is null or lease_until<=tick)
   and first_attempt_at<=tick-interval '6 days' order by first_attempt_at limit 64 for update skip locked
 ) update public.trial_conversion_events e set manual_recovery_at=tick,lease_token=null,lease_until=null from old_events o where e.id=o.id;
 return query with due as (
  select id from public.trial_conversion_events where delivered_at is null and manual_recovery_at is null
   and (environment is null or environment=p_environment) and next_attempt_at<=tick and (lease_until is null or lease_until<=tick)
   and (first_attempt_at is null or first_attempt_at>tick-interval '6 days')
   order by next_attempt_at,created_at,id limit p_limit for update skip locked
 ) update public.trial_conversion_events e set environment=p_environment,attempts=attempts+1,
  first_attempt_at=coalesce(first_attempt_at,tick),lease_token=gen_random_uuid(),lease_until=tick+interval '60 seconds'
 from due where e.id=due.id returning e.*;
end $$;
revoke all on function public.claim_trial_conversion_events_v1(text,integer) from public,anon,authenticated;
grant execute on function public.claim_trial_conversion_events_v1(text,integer) to service_role;

create function public.finish_trial_conversion_event_v1(p_id uuid,p_lease_token uuid,p_environment text,p_delivered boolean)
returns boolean language plpgsql security definer set search_path='' set lock_timeout='1s' set statement_timeout='2500ms' as $$
begin
 if p_delivered is null then return false; end if;
 update public.trial_conversion_events set
  delivered_at=case when p_delivered then clock_timestamp() else null end,
  next_attempt_at=clock_timestamp()+make_interval(secs=>least(21600,60*power(2,least(attempts,9)))::integer),
  lease_token=null,lease_until=null
 where id=p_id and lease_token=p_lease_token and environment=p_environment and delivered_at is null and manual_recovery_at is null;
 return found;
end $$;
revoke all on function public.finish_trial_conversion_event_v1(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_trial_conversion_event_v1(uuid,uuid,text,boolean) to service_role;

create or replace function public.record_recent_room_presence_v1(p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 r public.rooms%rowtype;
 a uuid; b uuid; observed timestamptz; generation bigint; person jsonb;
begin
 if jsonb_typeof(p_evidence) is distinct from 'object'
   or (select count(*) from jsonb_object_keys(p_evidence)) <> 4
   or not (p_evidence ?& array['roomId','roomGeneration','observedAt','participants'])
   or jsonb_typeof(p_evidence->'roomId') is distinct from 'string'
   or length(p_evidence->>'roomId') not between 1 and 128
   or jsonb_typeof(p_evidence->'roomGeneration') is distinct from 'number'
   or (p_evidence->>'roomGeneration') !~ '^[1-9][0-9]*$'
   or (p_evidence->>'roomGeneration')::numeric > 9007199254740991
   or jsonb_typeof(p_evidence->'observedAt') is distinct from 'number'
   or (p_evidence->>'observedAt') !~ '^[0-9]+$'
   or (p_evidence->>'observedAt')::numeric > 9007199254740991
   or jsonb_typeof(p_evidence->'participants') is distinct from 'array'
   or jsonb_array_length(p_evidence->'participants') <> 2 then
   raise exception using errcode='22023',message='Invalid room presence evidence';
 end if;
 for person in select value from jsonb_array_elements(p_evidence->'participants') loop
   if jsonb_typeof(person) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(person)) <> 2
     or not(person ?& array['userId','sessionId'])
     or jsonb_typeof(person->'userId') is distinct from 'string'
     or (person->>'userId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or jsonb_typeof(person->'sessionId') is distinct from 'string'
     or length(person->>'sessionId') not between 1 and 128 then
     raise exception using errcode='22023',message='Invalid room presence evidence';
   end if;
 end loop;
 a:=(p_evidence#>>'{participants,0,userId}')::uuid;
 b:=(p_evidence#>>'{participants,1,userId}')::uuid;
 if a>=b then raise exception using errcode='22023',message='Invalid room presence evidence'; end if;
 generation:=(p_evidence->>'roomGeneration')::bigint;
 observed:=pg_catalog.to_timestamp((p_evidence->>'observedAt')::double precision/1000);
 select * into r from public.rooms where room_id=p_evidence->>'roomId' for update;
 if not found or observed<r.created_at or observed>clock_timestamp()+interval '30 seconds'
   or observed<clock_timestamp()-interval '24 hours'
   or (r.status='ended' and (r.ended_at is null or observed>r.ended_at))
   or (r.ended_at is not null and observed>r.ended_at)
   or (r.presence_room_generation is not null and r.presence_room_generation<>generation) then
   raise exception using errcode='22023',message='Invalid room presence authority';
 end if;
 if r.presence_room_generation is null then
   update public.rooms set presence_room_generation=generation where room_id=r.room_id;
 end if;
 -- Lock surviving accounts against concurrent deletion. No membership/session
 -- lookup: those mutable HTTP rows are not the authoritative WS observation.
 perform id from public.users where id in(a,b) order by id for key share;
 if (select count(*) from public.users where id in(a,b))<>2 then
   return jsonb_build_object('accepted',true);
 end if;
 -- Only this validated WS evidence proves concurrent host/guest presence.
 -- Watch-history and HTTP member rows deliberately do not create this milestone.
 if r.host_user_id in (a,b) then
   perform public.enqueue_trial_conversion_v1('trial_first_shared_session',r.host_user_id,t.trial_activation_id::text,observed)
   from public.account_subscription_trials t where t.user_id=r.host_user_id and t.trial_mode='cardless';
 end if;
 insert into public.recent_people_evidence(user_id,other_user_id,last_room_id,last_watched_at)
 values(a,b,r.room_id,observed),(b,a,r.room_id,observed)
 on conflict(user_id,other_user_id) do update
 set last_room_id=excluded.last_room_id,last_watched_at=excluded.last_watched_at
 where excluded.last_watched_at>public.recent_people_evidence.last_watched_at;
 return jsonb_build_object('accepted',true);
end $$;
revoke all on function public.record_recent_room_presence_v1(jsonb) from public,anon,authenticated;
grant execute on function public.record_recent_room_presence_v1(jsonb) to service_role;

-- This scheduler owns a separate drain-only bearer, never a room/notification key.
create function anidachi_private.tick_trial_event_scheduler() returns void language plpgsql security invoker
set search_path='' set statement_timeout='1500ms' set lock_timeout='500ms' as $$
declare cfg anidachi_private.trial_event_scheduler%rowtype; tick timestamptz:=clock_timestamp(); response net._http_response%rowtype; bearer text; endpoint text; request_id bigint; result text;
begin
 select * into cfg from anidachi_private.trial_event_scheduler where singleton for update skip locked;
 if not found or not cfg.enabled then return; end if;
 if cfg.last_request_id is not null then
  if exists(select 1 from net.http_request_queue where id=cfg.last_request_id) then return; end if;
  select * into response from net._http_response where id=cfg.last_request_id order by created desc limit 1;
  if found then
   result:=case when response.timed_out is true or response.error_msg is not null then 'transport_error'
    when response.status_code is distinct from 200 then 'http_error'
    when octet_length(response.content)<=128 and response.content ~ '^[ \t\r\n]*\{[ \t\r\n]*"ok"[ \t\r\n]*:[ \t\r\n]*true[ \t\r\n]*\}[ \t\r\n]*$' then 'succeeded' else 'invalid_ack' end;
  elsif tick<cfg.last_attempt_at+interval '90 seconds' then return;
  else result:='response_missing'; end if;
  update anidachi_private.trial_event_scheduler set last_request_id=null,last_result_at=tick,last_result=result where singleton;
 end if;
 if not exists(select 1 from public.trial_conversion_events where delivered_at is null and manual_recovery_at is null
   and (environment is null or environment=cfg.environment) and next_attempt_at<=tick and (lease_until is null or lease_until<=tick)) then return; end if;
 select decrypted_secret into bearer from vault.decrypted_secrets where name='anidachi_trial_event_drain_secret';
 if bearer is null or length(bearer)=0 then
  update anidachi_private.trial_event_scheduler set last_result='missing_secret',last_result_at=tick where singleton; return;
 end if;
 endpoint:=case cfg.environment when 'staging' then 'https://staging.anidachi.app/api/internal/billing/trial-events/drain'
  when 'production' then 'https://www.anidachi.app/api/internal/billing/trial-events/drain' end;
 request_id:=net.http_post(url=>endpoint,body=>'{}'::jsonb,params=>'{}'::jsonb,
  headers=>jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||bearer),timeout_milliseconds=>20000);
 update anidachi_private.trial_event_scheduler set last_request_id=request_id,last_attempt_at=tick where singleton;
end $$;
revoke all on function anidachi_private.tick_trial_event_scheduler() from public,anon,authenticated,service_role;
grant execute on function anidachi_private.tick_trial_event_scheduler() to postgres;
select cron.schedule('anidachi-trial-event-drain','* * * * *',$command$set statement_timeout='1500ms'; select anidachi_private.tick_trial_event_scheduler();$command$);
reset lock_timeout;
reset statement_timeout;
