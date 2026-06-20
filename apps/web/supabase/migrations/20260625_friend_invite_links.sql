-- Friend invite links are separate from room invite links. They let one
-- logged-in user send a short-lived one-time friendship link to another user.
-- Server APIs use the service-role client; keep RLS enabled without public
-- policies.

create table if not exists public.friend_invite_links (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_at timestamptz,
  accepted_by_user_id uuid references public.users (id) on delete set null,
  revoked_at timestamptz,
  check (token_hash ~ '^[a-f0-9]{64}$'),
  check (
    (accepted_at is null and accepted_by_user_id is null) or
    (accepted_at is not null and accepted_by_user_id is not null)
  ),
  check (accepted_by_user_id is null or accepted_by_user_id <> sender_user_id)
);

create index if not exists idx_friend_invite_links_sender_created
  on public.friend_invite_links (sender_user_id, created_at desc);

create index if not exists idx_friend_invite_links_expirable
  on public.friend_invite_links (expires_at)
  where accepted_at is null and revoked_at is null;

create index if not exists idx_friend_invite_links_accepted_by
  on public.friend_invite_links (accepted_by_user_id, accepted_at desc)
  where accepted_by_user_id is not null;

alter table public.friend_invite_links enable row level security;
