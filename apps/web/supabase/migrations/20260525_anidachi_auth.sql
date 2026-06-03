-- Anidachi user auth schema
-- Run this against your Supabase project via the SQL editor or CLI:
--   supabase db push  (local)
--   or paste into the Supabase dashboard SQL editor

-- Users: one row per real person regardless of OAuth provider
create table if not exists public.users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  discord_id     text unique,
  google_id      text unique,
  display_name   text not null,
  avatar_url     text,
  plan           text not null default 'watcher'
                   check (plan in ('watcher', 'nakama', 'junkie')),
  created_at     timestamptz not null default now()
);

-- Refresh tokens: hashed opaque tokens, one per session
create table if not exists public.refresh_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

-- Rooms: one per watch-party session
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  room_id      text not null unique default gen_random_uuid()::text,
  host_user_id uuid not null references public.users (id),
  show_id      text,
  episode_id   text,
  status       text not null default 'lobby'
                 check (status in ('lobby', 'live', 'ended')),
  created_at   timestamptz not null default now()
);

-- Room members: who has joined a room
create table if not exists public.room_members (
  room_id   text not null references public.rooms (room_id) on delete cascade,
  user_id   uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Indexes for common lookups
create index if not exists idx_refresh_tokens_user_id  on public.refresh_tokens (user_id);
create index if not exists idx_refresh_tokens_expires  on public.refresh_tokens (expires_at);
create index if not exists idx_rooms_host_user_id      on public.rooms (host_user_id);
create index if not exists idx_room_members_user_id    on public.room_members (user_id);

-- RLS: all auth operations go through the service-role client (server-side only),
-- so we enable RLS with no public policies — the anon/authenticated roles have no access.
alter table public.users         enable row level security;
alter table public.refresh_tokens enable row level security;
alter table public.rooms         enable row level security;
alter table public.room_members  enable row level security;
