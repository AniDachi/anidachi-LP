-- Durable watch library, checkpoints, and shared watch sessions.
--
-- The extension may cache progress locally for speed, but durable history and
-- "continue together" state belong to the server-side control plane.
-- Server APIs use the service-role client; keep RLS enabled without public
-- policies.

create table if not exists public.watch_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id text references public.rooms (room_id) on delete set null,
  host_user_id uuid not null references public.users (id) on delete cascade,
  provider text not null check (provider in ('crunchyroll', 'netflix', 'youtube', 'amazon')),
  item_key text not null,
  item_kind text not null check (item_kind in ('series', 'movie')),
  item_title text not null,
  content_id text,
  series_id text,
  episode_key text not null,
  episode_title text not null,
  source_url text not null,
  artwork_url text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  current_time_seconds integer not null default 0 check (current_time_seconds >= 0),
  progress double precision not null default 0 check (progress >= 0 and progress <= 1),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_checkpoint_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_watch_sessions_host_updated
  on public.watch_sessions (host_user_id, updated_at desc);

create index if not exists idx_watch_sessions_room_updated
  on public.watch_sessions (room_id, updated_at desc)
  where room_id is not null;

create index if not exists idx_watch_sessions_content_lookup
  on public.watch_sessions (provider, item_key, episode_key, updated_at desc);

create table if not exists public.watch_session_participants (
  session_id uuid not null references public.watch_sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('host', 'viewer')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  current_time_seconds integer not null default 0 check (current_time_seconds >= 0),
  progress double precision not null default 0 check (progress >= 0 and progress <= 1),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index if not exists idx_watch_session_participants_user_updated
  on public.watch_session_participants (user_id, updated_at desc);

create table if not exists public.watch_progress_checkpoints (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.watch_sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  room_id text references public.rooms (room_id) on delete set null,
  kind text not null default 'reconcile'
    check (kind in ('local', 'room', 'pause', 'seeked', 'ended', 'pagehide', 'reconcile', 'manual')),
  current_time_seconds integer not null default 0 check (current_time_seconds >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  progress double precision not null default 0 check (progress >= 0 and progress <= 1),
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_watch_progress_checkpoints_session_observed
  on public.watch_progress_checkpoints (session_id, observed_at desc);

create index if not exists idx_watch_progress_checkpoints_user_observed
  on public.watch_progress_checkpoints (user_id, observed_at desc);

create index if not exists idx_watch_progress_checkpoints_room_observed
  on public.watch_progress_checkpoints (room_id, observed_at desc)
  where room_id is not null;

create table if not exists public.user_tracked_titles (
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null check (provider in ('crunchyroll', 'netflix', 'youtube', 'amazon')),
  title_key text not null,
  item_kind text not null check (item_kind in ('series', 'movie')),
  item_title text not null,
  source_url text not null,
  artwork_url text,
  active boolean not null default true,
  archived_reason text,
  latest_session_id uuid references public.watch_sessions (id) on delete set null,
  last_watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, title_key)
);

create index if not exists idx_user_tracked_titles_active_last_watched
  on public.user_tracked_titles (user_id, active, last_watched_at desc);

create index if not exists idx_user_tracked_titles_latest_session
  on public.user_tracked_titles (latest_session_id)
  where latest_session_id is not null;

alter table public.watch_sessions enable row level security;
alter table public.watch_session_participants enable row level security;
alter table public.watch_progress_checkpoints enable row level security;
alter table public.user_tracked_titles enable row level security;
