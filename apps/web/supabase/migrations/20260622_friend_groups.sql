-- Phase 3 personal groups. Groups are owner-owned personal invite lists, not
-- shared communities. Membership is enforced by server APIs against accepted
-- friendships.

create table if not exists public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(name)) between 1 and 80)
);

create index if not exists idx_friend_groups_owner_active
  on public.friend_groups (owner_user_id, archived_at, updated_at desc);

create table if not exists public.friend_group_members (
  group_id uuid not null references public.friend_groups (id) on delete cascade,
  friend_user_id uuid not null references public.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, friend_user_id)
);

create index if not exists idx_friend_group_members_friend
  on public.friend_group_members (friend_user_id);

alter table public.friend_groups enable row level security;
alter table public.friend_group_members enable row level security;
