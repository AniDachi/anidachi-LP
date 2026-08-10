-- Add account-scoped Web Push delivery to the existing extension device model.

alter table public.devices
  add column if not exists push_endpoint text,
  add column if not exists push_p256dh text,
  add column if not exists push_auth text,
  add column if not exists push_expiration_at timestamptz,
  add column if not exists push_subscription_updated_at timestamptz,
  add column if not exists notifications_enabled boolean not null default false,
  add column if not exists revoked_at timestamptz,
  add column if not exists last_delivery_error text;

-- Installation ids were previously advisory. Preserve every device row while
-- detaching older duplicates before making registration idempotent.
with duplicate_installations as (
  select id
  from (
    select
      id,
      row_number() over (
        partition by extension_installation_id
        order by last_seen_at desc, created_at desc, id desc
      ) as installation_rank
    from public.devices
    where extension_installation_id is not null
  ) ranked
  where installation_rank > 1
)
update public.devices
set extension_installation_id = null
where id in (select id from duplicate_installations);

drop index if exists public.idx_devices_installation_id;

create unique index if not exists idx_devices_installation_id
  on public.devices (extension_installation_id)
  where extension_installation_id is not null;

create unique index if not exists idx_devices_push_endpoint
  on public.devices (push_endpoint)
  where push_endpoint is not null;

create index if not exists idx_devices_push_delivery
  on public.devices (user_id)
  where notifications_enabled = true
    and revoked_at is null
    and push_endpoint is not null;

alter table public.devices
  drop constraint if exists devices_enabled_push_subscription_check;

alter table public.devices
  add constraint devices_enabled_push_subscription_check
  check (
    notifications_enabled = false
    or (
      push_endpoint is not null
      and push_p256dh is not null
      and push_auth is not null
      and push_subscription_updated_at is not null
    )
  );
