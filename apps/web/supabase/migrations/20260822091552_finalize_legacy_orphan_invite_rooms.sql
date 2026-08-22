-- Rooms created before durable empty-room finalization could remain marked
-- active forever after every browser had left. Finalize only that historical
-- cohort when it still owns an unresolved invite. The room lifecycle remains
-- the authority; this does not reintroduce an invite-age deadline.

update public.rooms as room
set status = 'ended',
    ended_at = room.last_active_at,
    host_connected_at = null
where room.status <> 'ended'
  and room.last_active_at < timestamptz '2026-07-12 15:06:06+00'
  and exists (
    select 1
    from public.room_invites as invite
    join public.room_invite_recipients as recipient
      on recipient.invite_id = invite.id
    where invite.room_id = room.room_id
      and recipient.status in ('pending', 'expired')
      and recipient.responded_at is null
  );
