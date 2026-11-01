-- Additive, dormant until the existing server Free20 flag selects v4.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.free20_room_refresh_outbox (
 owner_user_id uuid not null references public.users(id) on delete cascade,
 room_id text not null,
 room_generation bigint not null check(room_generation between 1 and 9007199254740991),
 revision bigint not null default 1 check(revision between 1 and 9007199254740991),
 completed_revision bigint not null default 0 check(completed_revision between 0 and revision),
 attempts bigint not null default 0 check(attempts between 0 and 9007199254740991),
 queued_at timestamptz not null default clock_timestamp(),
 next_attempt_at timestamptz not null default clock_timestamp(),
 lease_revision bigint check(lease_revision between 1 and revision),
 lease_token uuid,
 lease_until timestamptz,
 primary key(owner_user_id,room_id,room_generation),
 check ((lease_token is null and lease_revision is null and lease_until is null)
  or (lease_token is not null and lease_revision is not null and lease_until is not null))
);
-- Completed rows remain revision tombstones. No age/attempt limit abandons work.
create index free20_room_refresh_due on public.free20_room_refresh_outbox(next_attempt_at,owner_user_id)
 where completed_revision<revision;
alter table public.free20_room_refresh_outbox enable row level security;
revoke all on public.free20_room_refresh_outbox from public,anon,authenticated,service_role;
grant select on public.free20_room_refresh_outbox to service_role;

create function public.commit_stripe_subscription_refresh_v4(
 p_subscription_id text,p_fence bigint,p_token uuid,p_user_id uuid,p_customer_id text,
 p_price_id text,p_plan_code text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean,
 p_trial jsonb default null)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='5s' set statement_timeout='15s' as $$
declare result jsonb;
begin
 -- v3 owns current Stripe fence, owner checks, cardless/v2 dispatch and the
 -- FINAL trial ledger. Never enqueue from v1's earlier mirror upsert.
 result:=public.commit_stripe_subscription_refresh_v3(p_subscription_id,p_fence,p_token,p_user_id,p_customer_id,
  p_price_id,p_plan_code,p_status,p_period_end,p_cancel_at_period_end,p_trial);
 insert into public.free20_room_refresh_outbox as q(owner_user_id,room_id,room_generation)
 select a.user_id,r.room_id,coalesce(r.presence_room_generation,(r.media_lease->>'roomGeneration')::bigint,1)
 from public.active_room_sessions a join public.rooms r on r.room_id=a.room_id
 where a.user_id=p_user_id and a.role='host' and r.host_user_id=p_user_id
  and r.status<>'ended' and r.hosting_time_mode='daily_free20'
 on conflict(owner_user_id,room_id,room_generation) do update set
  revision=q.revision+1,queued_at=clock_timestamp(),next_attempt_at=clock_timestamp();
 -- Keep lease token/revision/expiry while coalescing. A late finish may only
 -- complete its leased revision; it cannot consume this newer committed one.
 return result;
end $$;

create or replace function public.claim_free20_room_refresh_v1(p_limit integer default 4,p_owner_user_id uuid default null)
returns setof public.free20_room_refresh_outbox
language plpgsql security definer set search_path='' set statement_timeout='1500ms' as $$
declare q public.free20_room_refresh_outbox%rowtype; at_time timestamptz:=clock_timestamp();
begin
 if p_limit is null or p_limit not between 1 and 4 then
  raise exception 'FREE20_REFRESH_CLAIM_INVALID' using errcode='22023';
 end if;
 -- A room can end before its DO is ever initialized. Confirmed obsolete DB
 -- targets need no live ACK; retain their revision fence. Missing assignment
 -- alone is NOT terminal. Cleanup has its own bound and never steals a lease.
 with obsolete as (
  select o.owner_user_id,o.room_id,o.room_generation from public.free20_room_refresh_outbox o
  where o.completed_revision<o.revision and (o.lease_until is null or o.lease_until<=at_time)
   and (p_owner_user_id is null or o.owner_user_id=p_owner_user_id)
   and not exists(select 1 from public.rooms r where r.room_id=o.room_id
    and r.status<>'ended' and r.host_user_id=o.owner_user_id and r.hosting_time_mode='daily_free20'
    and coalesce(r.presence_room_generation,(r.media_lease->>'roomGeneration')::bigint,1)=o.room_generation)
  order by o.next_attempt_at,o.owner_user_id,o.room_id,o.room_generation
  limit 4 for update skip locked
 ) update public.free20_room_refresh_outbox o set completed_revision=revision,
   lease_token=null,lease_revision=null,lease_until=null
  from obsolete d where (o.owner_user_id,o.room_id,o.room_generation)=(d.owner_user_id,d.room_id,d.room_generation);
 for q in select o.* from public.free20_room_refresh_outbox o
  where o.completed_revision<o.revision and o.next_attempt_at<=at_time
   and (o.lease_until is null or o.lease_until<=at_time)
   and (p_owner_user_id is null or o.owner_user_id=p_owner_user_id)
  order by o.next_attempt_at,o.owner_user_id,o.room_id,o.room_generation
  limit p_limit for update skip locked
 loop
  update public.free20_room_refresh_outbox set attempts=least(attempts+1,9007199254740991),
   lease_token=gen_random_uuid(),lease_revision=revision,lease_until=at_time+interval '60 seconds'
   where (owner_user_id,room_id,room_generation)=(q.owner_user_id,q.room_id,q.room_generation)
   returning * into q;
  return next q;
 end loop;
end $$;

create or replace function public.finish_free20_room_refresh_v1(
 p_owner_user_id uuid,p_room_id text,p_room_generation bigint,p_revision bigint,p_lease_token uuid,p_outcome text)
returns text language plpgsql security definer set search_path='' set statement_timeout='1500ms' as $$
declare q public.free20_room_refresh_outbox%rowtype; at_time timestamptz:=clock_timestamp();
begin
 if p_outcome is not null and p_outcome not in ('applied','terminal','stale') then
  raise exception 'FREE20_REFRESH_ACK_INVALID' using errcode='22023';
 end if;
 select * into q from public.free20_room_refresh_outbox
  where (owner_user_id,room_id,room_generation)=(p_owner_user_id,p_room_id,p_room_generation) for update;
 at_time:=clock_timestamp();
 if not found or p_lease_token is null or q.lease_token is distinct from p_lease_token
  or q.lease_revision is distinct from p_revision or q.lease_until<=clock_timestamp() then return 'stale'; end if;
 update public.free20_room_refresh_outbox set
  completed_revision=case when p_outcome is not null then greatest(completed_revision,p_revision) else completed_revision end,
  lease_token=null,lease_revision=null,lease_until=null,
  next_attempt_at=case when q.revision<>p_revision then at_time
   else at_time+make_interval(secs=>least(60,power(2,least(q.attempts,6)))::double precision) end
  where (owner_user_id,room_id,room_generation)=(p_owner_user_id,p_room_id,p_room_generation);
 if q.revision<>p_revision then return 'superseded'; end if;
 return case when p_outcome is not null then 'completed' else 'retry' end;
end $$;
revoke all on function public.commit_stripe_subscription_refresh_v4(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean,jsonb),
 public.claim_free20_room_refresh_v1(integer,uuid),public.finish_free20_room_refresh_v1(uuid,text,bigint,bigint,uuid,text)
 from public,anon,authenticated;
grant execute on function public.commit_stripe_subscription_refresh_v4(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean,jsonb),
 public.claim_free20_room_refresh_v1(integer,uuid),public.finish_free20_room_refresh_v1(uuid,text,bigint,bigint,uuid,text) to service_role;
commit;
