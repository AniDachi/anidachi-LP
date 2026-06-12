-- Room lifecycle and free-plan daily host quota.
-- Block 2 of docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md
--
-- Adds:
--   * idempotent room creation (client_request_id),
--   * lifecycle columns (last_active_at, ended_at),
--   * host segment tracking for quota metering (host_connected_at),
--   * usage_daily metering table + atomic increment function (PD2).

alter table public.rooms
  add column if not exists client_request_id text,
  add column if not exists last_active_at timestamptz not null default now(),
  add column if not exists ended_at timestamptz,
  add column if not exists host_connected_at timestamptz;

-- Idempotent create: at most one non-ended room per host per client request id.
create unique index if not exists uniq_rooms_host_client_request
  on public.rooms (host_user_id, client_request_id)
  where client_request_id is not null and status <> 'ended';

create index if not exists idx_rooms_host_status_active
  on public.rooms (host_user_id, status, last_active_at desc);

create index if not exists idx_rooms_host_open_segment
  on public.rooms (host_user_id)
  where host_connected_at is not null and status <> 'ended';

-- Daily host-minutes metering (PD2: free plan gets 30 host-minutes per UTC day).
create table if not exists public.usage_daily (
  user_id      uuid not null references public.users (id) on delete cascade,
  day          date not null,
  host_seconds integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, day)
);

-- Same access model as the auth tables: RLS on, no public policies,
-- all access goes through the server-side service-role client.
alter table public.usage_daily enable row level security;

create or replace function public.increment_host_usage(
  p_user_id uuid,
  p_day date,
  p_seconds integer
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.usage_daily (user_id, day, host_seconds, updated_at)
  values (p_user_id, p_day, greatest(p_seconds, 0), now())
  on conflict (user_id, day)
  do update set
    host_seconds = public.usage_daily.host_seconds + greatest(p_seconds, 0),
    updated_at = now();
$$;

revoke all on function public.increment_host_usage(uuid, date, integer) from public;
revoke all on function public.increment_host_usage(uuid, date, integer) from anon;
revoke all on function public.increment_host_usage(uuid, date, integer) from authenticated;
