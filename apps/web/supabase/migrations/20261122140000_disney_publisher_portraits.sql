-- Public title metadata only. Clients cannot read or seed this cache directly.
create table public.disney_publisher_portraits (
  title_key text primary key check (title_key ~ '^disneyplus:(series|movie):[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'),
  artwork_url text not null check (length(artwork_url) <= 2048 and artwork_url ~
    '^https://(img[1-4][.]hulu[.]com/user/v3/artwork/|press[.]hulu[.]com/storage/uploads/|lumiere-a[.]akamaihd[.]net/v1/images/)')
);
alter table public.disney_publisher_portraits enable row level security;
revoke all on public.disney_publisher_portraits from public, anon, authenticated;
grant select, insert on public.disney_publisher_portraits to service_role;
