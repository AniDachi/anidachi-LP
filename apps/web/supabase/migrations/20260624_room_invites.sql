-- Phase 5 invite inbox foundation. Push delivery is intentionally separate:
-- these tables are the durable source of truth for direct/group room invites.

create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (room_id) on delete cascade,
  sender_user_id uuid not null references public.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('direct', 'group')),
  target_group_id uuid references public.friend_groups (id) on delete set null,
  message text,
  room_title text,
  source_url text,
  video_fingerprint text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  check (
    (target_kind = 'direct' and target_group_id is null) or
    (target_kind = 'group' and target_group_id is not null)
  ),
  check (message is null or char_length(message) <= 180)
);

create index if not exists idx_room_invites_room_created
  on public.room_invites (room_id, created_at desc);

create index if not exists idx_room_invites_sender_created
  on public.room_invites (sender_user_id, created_at desc);

create index if not exists idx_room_invites_group_created
  on public.room_invites (target_group_id, created_at desc)
  where target_group_id is not null;

create table if not exists public.room_invite_recipients (
  invite_id uuid not null references public.room_invites (id) on delete cascade,
  recipient_user_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (invite_id, recipient_user_id)
);

create index if not exists idx_room_invite_recipients_user_status
  on public.room_invite_recipients (recipient_user_id, status, updated_at desc);

create index if not exists idx_room_invite_recipients_invite_status
  on public.room_invite_recipients (invite_id, status);

alter table public.room_invites enable row level security;
alter table public.room_invite_recipients enable row level security;
