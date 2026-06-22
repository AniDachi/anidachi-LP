-- Persist the host plan room-capability snapshot used by the Worker.
-- Plan changes affect newly-created rooms; active rooms keep their snapshot.

alter table public.rooms
  add column if not exists host_plan_code text not null default 'watcher'
    check (host_plan_code in ('watcher', 'nakama', 'junkie')),
  add column if not exists max_participants integer not null default 4
    check (max_participants between 1 and 50),
  add column if not exists max_media_seats integer not null default 4
    check (max_media_seats between 0 and 16),
  add column if not exists can_name_room boolean not null default false,
  add column if not exists can_send_push_invites boolean not null default false;
