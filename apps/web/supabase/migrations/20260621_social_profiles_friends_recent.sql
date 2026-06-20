-- Phase 2 social foundation: profiles, explicit friendships, and recent-person
-- hiding. Server APIs use the service-role client; keep RLS enabled without
-- public policies.

create table if not exists public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  handle text unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (handle is null or handle ~ '^[a-z0-9_]{3,24}$')
);

insert into public.profiles (user_id, display_name, avatar_url)
select id, display_name, avatar_url
from public.users
on conflict (user_id) do update set
  display_name = excluded.display_name,
  avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
  updated_at = now();

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.users (id) on delete cascade,
  addressee_user_id uuid not null references public.users (id) on delete cascade,
  status text not null check (
    status in ('pending', 'accepted', 'declined', 'blocked', 'removed')
  ),
  blocked_by_user_id uuid references public.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (requester_user_id <> addressee_user_id),
  check (
    (status = 'blocked' and blocked_by_user_id is not null) or
    (status <> 'blocked' and blocked_by_user_id is null)
  )
);

create unique index if not exists uniq_friendships_unordered_pair
  on public.friendships (
    least(requester_user_id, addressee_user_id),
    greatest(requester_user_id, addressee_user_id)
  );

create index if not exists idx_friendships_requester_status
  on public.friendships (requester_user_id, status, updated_at desc);

create index if not exists idx_friendships_addressee_status
  on public.friendships (addressee_user_id, status, updated_at desc);

create table if not exists public.recent_people_hidden (
  user_id uuid not null references public.users (id) on delete cascade,
  hidden_user_id uuid not null references public.users (id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, hidden_user_id),
  check (user_id <> hidden_user_id)
);

create index if not exists idx_recent_people_hidden_hidden_user
  on public.recent_people_hidden (hidden_user_id);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.recent_people_hidden enable row level security;
