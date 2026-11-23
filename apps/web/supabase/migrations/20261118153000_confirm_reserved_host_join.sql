begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Previously creation filled host_connected_at before issuing the first ticket.
-- Leave historical rows alone. The private core is shared by all create RPCs.
do $$
declare
  definition text;
  previous text := E'    p_client_request_id,\n    pg_catalog.now(),\n    p_host_plan_code,';
  admission text := ' if denial is null then return result||jsonb_build_object(''allowed'',true); end if;';
begin
  select pg_get_functiondef('anidachi_room_private.create_room_with_active_session_v2'::regproc)
    into definition;
  if strpos(definition, previous) = 0 then raise exception 'Unexpected room create definition'; end if;
  execute replace(definition, previous, replace(previous, 'pg_catalog.now()', 'null'));
  select pg_get_functiondef('public.check_room_hosting_socket_v1(text,uuid)'::regprocedure) into definition;
  if strpos(definition, admission) = 0 then raise exception 'Unexpected socket admission definition'; end if;
  execute replace(definition, admission, $patch$
 if denial is null and r.status = 'lobby' and r.host_user_id = p_user_id then
   result := result || jsonb_build_object('confirmHostJoin', true);
 end if;
$patch$ || admission);

  -- Keep the exact existing host/room/session/lobby guards. Use the standard
  -- finalizer so Free20 reservations are released alongside room assignments.
  select pg_get_functiondef('public.end_host_lobby_for_active_session_v1(uuid,text,text,timestamptz)'::regprocedure)
    into definition;
  previous := substring(definition from '(  update public[.]rooms as room.*?)(?=  return query select ''room_ended'')');
  if previous is null or strpos(previous, 'delete from public.active_room_sessions') = 0 then
    raise exception 'Unexpected host lobby finalization definition';
  end if;
  definition := replace(definition,
    E'where account.id = p_user_id\n  for update;',
    E'where account.id = p_user_id\n  for no key update;');
  execute replace(definition, previous,
    E'  perform public.finalize_room_usage(p_room_id,p_ended_at,(v_room.created_at at time zone ''UTC'')::date,0);\n\n');
end $$;

-- Serialize with create, takeover and depart on the account. Only the exact
-- current host can activate a lobby. An idempotent JOIN preserves the start time.
create function public.confirm_reserved_host_join_v1(p_user_id uuid, p_room_id text, p_participant_session_id text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.users where id = p_user_id for no key update;
  if not exists (select 1 from public.active_room_sessions
    where user_id = p_user_id and room_id = p_room_id and role = 'host'
      and participant_session_id = p_participant_session_id) then return false; end if;
  update public.rooms set status='live', host_connected_at=now(), last_active_at=now()
    where room_id=p_room_id and host_user_id=p_user_id and status='lobby';
  return found or exists(select 1 from public.rooms
    where room_id=p_room_id and host_user_id=p_user_id and status='live');
end $$;

create index rooms_unconfirmed_host_lobby_idx on public.rooms (created_at)
  where status='lobby' and host_connected_at is null;

-- The browser may disappear before it can send /depart. Recheck the latest
-- claim under the same account lock, so a concurrent reconnect gets its grace.
create function anidachi_room_private.expire_unjoined_host_lobbies()
returns integer language plpgsql security invoker set search_path='' as $$
declare
  candidate record;
  ended integer := 0;
  cutoff timestamptz := now() - interval '60 seconds';
begin
  for candidate in
    select a.user_id, a.room_id, a.participant_session_id
    from public.rooms r join public.active_room_sessions a
      on a.room_id=r.room_id and a.user_id=r.host_user_id and a.role='host'
    join public.users u on u.id=a.user_id
    where r.status='lobby' and r.host_connected_at is null and r.created_at <= cutoff and a.updated_at <= cutoff
    order by r.created_at, r.room_id limit 100 for no key update of u skip locked
  loop
    if exists(select 1 from public.active_room_sessions a where a.user_id=candidate.user_id
      and a.room_id=candidate.room_id and a.participant_session_id=candidate.participant_session_id
      and a.updated_at <= cutoff)
    and exists(select 1 from public.rooms where room_id=candidate.room_id and host_connected_at is null and status='lobby')
    then
      perform 1 from public.end_host_lobby_for_active_session_v1(candidate.user_id,candidate.room_id,
        candidate.participant_session_id,now()) where outcome='room_ended';
      if found then ended := ended + 1; end if;
    end if;
  end loop;
  return ended;
end $$;
revoke all on function public.confirm_reserved_host_join_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function public.confirm_reserved_host_join_v1(uuid,text,text) to service_role;
revoke all on function anidachi_room_private.expire_unjoined_host_lobbies() from public,anon,authenticated,service_role;
select cron.schedule('anidachi-expire-unjoined-host-lobbies','* * * * *',
  'select anidachi_room_private.expire_unjoined_host_lobbies()');
commit;
