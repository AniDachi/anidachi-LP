-- Atomically settle one room's Free-plan usage and mark the room ended.
-- Exact Worker usage is preferred. Null usage fields retain a one-release
-- fallback for an older Worker that only sends the room-end command.

create or replace function public.finalize_room_usage(
  p_room_id text,
  p_ended_at timestamptz,
  p_usage_day date default null,
  p_usage_seconds integer default null
) returns table (
  already_ended boolean,
  finalized_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_first_guest_joined_at timestamptz;
  v_metered_started_at timestamptz;
  v_usage_day date;
  v_usage_seconds integer := 0;
begin
  if p_room_id is null or btrim(p_room_id) = '' or p_ended_at is null then
    raise exception 'Invalid room finalization input'
      using errcode = '22023';
  end if;

  if (p_usage_day is null) <> (p_usage_seconds is null) then
    raise exception 'Usage day and seconds must be provided together'
      using errcode = '22023';
  end if;

  select *
    into v_room
    from public.rooms
   where room_id = p_room_id
   for update;

  if not found then
    raise exception 'Room not found'
      using errcode = 'P0002';
  end if;

  if v_room.status = 'ended' then
    already_ended := true;
    finalized_at := v_room.ended_at;
    return next;
    return;
  end if;

  if v_room.host_plan_code in ('free', 'watcher') then
    if p_usage_seconds is not null then
      if p_usage_seconds < 0 or p_usage_seconds > 24 * 60 * 60 then
        raise exception 'Invalid room usage seconds'
          using errcode = '22023';
      end if;
      v_usage_day := p_usage_day;
      v_usage_seconds := p_usage_seconds;
    else
      select min(joined_at)
        into v_first_guest_joined_at
        from public.room_members
       where room_id = p_room_id;

      if v_room.host_connected_at is not null and v_first_guest_joined_at is not null then
        v_metered_started_at := greatest(
          v_room.host_connected_at,
          v_first_guest_joined_at
        );
        v_usage_day := (v_metered_started_at at time zone 'UTC')::date;
        v_usage_seconds := greatest(
          0,
          least(
            30 * 60,
            floor(extract(epoch from (p_ended_at - v_metered_started_at)))::integer
          )
        );
      end if;
    end if;

    if v_usage_seconds > 0 then
      insert into public.usage_daily (user_id, day, host_seconds, updated_at)
      values (v_room.host_user_id, v_usage_day, v_usage_seconds, now())
      on conflict (user_id, day)
      do update set
        host_seconds = public.usage_daily.host_seconds + excluded.host_seconds,
        updated_at = now();
    end if;
  end if;

  update public.rooms
     set status = 'ended',
         ended_at = p_ended_at,
         host_connected_at = null,
         last_active_at = p_ended_at
   where id = v_room.id;

  already_ended := false;
  finalized_at := p_ended_at;
  return next;
end;
$$;

revoke all on function public.finalize_room_usage(text, timestamptz, date, integer)
  from public, anon, authenticated;
grant execute on function public.finalize_room_usage(text, timestamptz, date, integer)
  to service_role;
