-- Minimal invalidation only. Durable inbox content and room RPCs are unchanged.
begin;
set local lock_timeout = '5s';

create table public.account_inbox_push_outbox (
  user_id uuid primary key references public.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  attempts integer not null default 0 check (attempts between 0 and 8),
  queued_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '24 hours'),
  next_attempt_at timestamptz not null default clock_timestamp(),
  cooldown_until timestamptz,
  lease_token uuid,
  lease_revision bigint,
  lease_until timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  terminal_at timestamptz,
  check ((lease_token is null and lease_revision is null and lease_until is null)
    or (lease_token is not null and lease_revision is not null and lease_until is not null))
);
create index account_inbox_push_outbox_due on public.account_inbox_push_outbox(next_attempt_at,user_id)
  where terminal_at is null;
alter table public.account_inbox_push_outbox enable row level security;
revoke all on public.account_inbox_push_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.account_inbox_push_outbox to service_role;

create function public.enqueue_account_inbox_push(p_user_id uuid)
returns void language sql volatile security invoker set search_path = '' as $$
  insert into public.account_inbox_push_outbox as q(user_id) values(p_user_id)
  on conflict(user_id) do update set
    revision=q.revision+1, attempts=0, queued_at=clock_timestamp(),
    expires_at=clock_timestamp()+interval '24 hours',
    next_attempt_at=greatest(clock_timestamp(),q.cooldown_until),
    last_error=null, terminal_at=null;
  -- Deliberately preserve the active lease and provider cooldown.
$$;

-- A statement trigger also preserves deterministic lock order for bulk inserts.
create function public.enqueue_room_invite_inbox_push()
returns trigger language plpgsql volatile security invoker set search_path = '' as $$
declare recipient uuid;
begin
  for recipient in select distinct recipient_user_id from inserted_recipients
    where status='pending' order by recipient_user_id
  loop
    perform public.enqueue_account_inbox_push(recipient);
  end loop;
  return null;
end;
$$;
create trigger enqueue_room_invite_inbox_push after insert on public.room_invite_recipients
  referencing new table as inserted_recipients for each statement
  execute function public.enqueue_room_invite_inbox_push();

create function public.enqueue_friend_request_inbox_push()
returns trigger language plpgsql volatile security invoker set search_path = '' as $$
begin
  if new.status='pending' then
    if tg_op='INSERT' then
      perform public.enqueue_account_inbox_push(new.addressee_user_id);
    elsif old.status is distinct from 'pending'
      or old.requester_user_id is distinct from new.requester_user_id
      or old.addressee_user_id is distinct from new.addressee_user_id then
      perform public.enqueue_account_inbox_push(new.addressee_user_id);
    end if;
  end if;
  return null;
end;
$$;
create trigger enqueue_friend_request_inbox_push after insert or update on public.friendships
  for each row execute function public.enqueue_friend_request_inbox_push();

create function public.claim_account_inbox_push_outbox(
  p_limit integer default 8, p_recipient_user_ids uuid[] default null,
  p_now timestamptz default clock_timestamp()
)
returns setof public.account_inbox_push_outbox
language plpgsql volatile security invoker set search_path = '' set statement_timeout = '1500ms' as $$
declare q public.account_inbox_push_outbox%rowtype;
begin
  if p_limit is null or p_limit not between 1 and 8 or p_now is null
    or cardinality(p_recipient_user_ids)>100 then
    raise exception 'inbox_push_claim_input_invalid' using errcode='22023';
  end if;
  -- Maintenance has its own cap: an exhausted prefix must not hide live work.
  with expired as (
    select o.user_id from public.account_inbox_push_outbox o
    where o.terminal_at is null and (o.attempts>=8 or o.expires_at<=p_now)
      and (o.lease_until is null or o.lease_until<=p_now)
      and (p_recipient_user_ids is null or o.user_id=any(p_recipient_user_ids))
    order by o.next_attempt_at,o.user_id limit 8 for update skip locked
  )
  update public.account_inbox_push_outbox o set terminal_at=p_now,
    last_error=coalesce(o.last_error,'retry_budget_exhausted'),
    lease_token=null,lease_revision=null,lease_until=null
    from expired where o.user_id=expired.user_id;
  for q in select o.* from public.account_inbox_push_outbox o
    where o.terminal_at is null
      and o.attempts<8 and o.expires_at>p_now and o.next_attempt_at<=p_now
      and (o.cooldown_until is null or o.cooldown_until<=p_now)
      and (o.lease_until is null or o.lease_until<=p_now)
      and (p_recipient_user_ids is null or o.user_id=any(p_recipient_user_ids))
    order by o.next_attempt_at,o.user_id limit p_limit for update skip locked
  loop
    update public.account_inbox_push_outbox set attempts=attempts+1,
      lease_token=gen_random_uuid(),lease_revision=revision,
      lease_until=p_now+interval '90 seconds',last_attempt_at=p_now
      where user_id=q.user_id returning * into q;
    return next q;
  end loop;
end;
$$;

create function public.finish_account_inbox_push_outbox(
  p_user_id uuid,p_revision bigint,p_lease_token uuid,p_outcome text,
  p_error_code text default null,p_retry_after_seconds integer default 0,
  p_now timestamptz default clock_timestamp()
)
returns text language plpgsql volatile security invoker set search_path = '' set statement_timeout = '1500ms' as $$
declare q public.account_inbox_push_outbox%rowtype; retry_at timestamptz;
begin
  if p_outcome is null or p_outcome not in ('complete','retry','permanent')
    or p_now is null or p_retry_after_seconds is null or p_retry_after_seconds<0
    or (p_error_code is not null and p_error_code !~ '^[a-z0-9_]{1,64}$') then
    raise exception 'inbox_push_completion_input_invalid' using errcode='22023';
  end if;
  select * into q from public.account_inbox_push_outbox where user_id=p_user_id for update;
  if not found or q.lease_token is distinct from p_lease_token
    or q.lease_revision is distinct from p_revision or p_lease_token is null then return 'stale'; end if;
  retry_at := greatest(q.cooldown_until,
    p_now+make_interval(secs=>least(p_retry_after_seconds,86400)));
  if q.revision<>p_revision then
    update public.account_inbox_push_outbox set lease_token=null,lease_revision=null,lease_until=null,
      cooldown_until=case when p_retry_after_seconds>0 then retry_at else cooldown_until end,
      next_attempt_at=greatest(next_attempt_at,retry_at)
      where user_id=p_user_id;
    return 'superseded';
  end if;
  if p_outcome='complete' then
    delete from public.account_inbox_push_outbox where user_id=p_user_id;
    return 'completed';
  end if;
  retry_at := greatest(retry_at,p_now+make_interval(secs=>least(3600,30*power(2,q.attempts-1)::integer)));
  update public.account_inbox_push_outbox set lease_token=null,lease_revision=null,lease_until=null,
    last_error=coalesce(p_error_code,'delivery_unavailable'),
    cooldown_until=case when p_retry_after_seconds>0 then greatest(cooldown_until,p_now+make_interval(secs=>least(p_retry_after_seconds,86400))) else cooldown_until end,
    next_attempt_at=least(retry_at,expires_at),
    terminal_at=case when p_outcome='permanent' or attempts>=8 or retry_at>=expires_at then p_now else null end
    where user_id=p_user_id returning * into q;
  return case when q.terminal_at is not null then 'terminal' else 'retry' end;
end;
$$;

revoke all on function public.enqueue_account_inbox_push(uuid), public.enqueue_room_invite_inbox_push(),
  public.enqueue_friend_request_inbox_push(),public.claim_account_inbox_push_outbox(integer,uuid[],timestamptz),
  public.finish_account_inbox_push_outbox(uuid,bigint,uuid,text,text,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.enqueue_account_inbox_push(uuid), public.enqueue_room_invite_inbox_push(),
  public.enqueue_friend_request_inbox_push(),public.claim_account_inbox_push_outbox(integer,uuid[],timestamptz),
  public.finish_account_inbox_push_outbox(uuid,bigint,uuid,text,text,integer,timestamptz) to service_role;
commit;
