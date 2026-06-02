-- Extension auth bridge for Chrome extension login.
-- The extension never reads website HttpOnly cookies. Instead, the website
-- creates a short-lived one-time code and the extension exchanges it server-side.

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null default 'Chrome extension',
  extension_installation_id text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.extension_auth_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  code_hash text not null unique,
  state_hash text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_devices_user_id
  on public.devices (user_id);

create index if not exists idx_devices_installation_id
  on public.devices (extension_installation_id)
  where extension_installation_id is not null;

create index if not exists idx_extension_auth_codes_user_id
  on public.extension_auth_codes (user_id);

create index if not exists idx_extension_auth_codes_expires_at
  on public.extension_auth_codes (expires_at);

create index if not exists idx_extension_auth_codes_unconsumed
  on public.extension_auth_codes (code_hash)
  where consumed_at is null;

alter table public.devices enable row level security;
alter table public.extension_auth_codes enable row level security;
