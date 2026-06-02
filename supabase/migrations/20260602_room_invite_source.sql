-- Store enough source metadata for website invite pages to route users back
-- to the same video page after joining a watchroom.

alter table public.rooms
  add column if not exists source_url text,
  add column if not exists video_fingerprint text,
  add column if not exists title text;

create index if not exists idx_rooms_status_created_at
  on public.rooms (status, created_at desc);
