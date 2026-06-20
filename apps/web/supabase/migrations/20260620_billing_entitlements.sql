-- Billing entitlement foundation for host-based social room plans.
--
-- Stripe remains the billing source of truth. These tables mirror the minimum
-- state needed for fast server-side authorization and idempotent webhook
-- processing.

create table if not exists public.billing_customers (
  user_id uuid primary key references public.users (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  plan_code text not null check (plan_code in ('watcher', 'nakama', 'junkie')),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stripe_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
);

create index if not exists idx_subscriptions_user_status
  on public.subscriptions (user_id, status);

create index if not exists idx_subscriptions_customer
  on public.subscriptions (stripe_customer_id);

create index if not exists idx_billing_customers_customer
  on public.billing_customers (stripe_customer_id);

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;
