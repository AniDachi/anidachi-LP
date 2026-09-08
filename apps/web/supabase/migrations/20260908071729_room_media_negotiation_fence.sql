begin;
set local statement_timeout='15s';set local lock_timeout='3s';
drop function public.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean);
create function public.create_room_with_active_session_v2(
  p_host_user_id uuid,
  p_participant_session_id text,
  p_show_id text,
  p_episode_id text,
  p_source_provider text,
  p_source_url text,
  p_video_fingerprint text,
  p_source_generation bigint,
  p_title text,
  p_client_request_id text,
  p_host_plan_code text,
  p_max_participants integer,
  p_max_media_seats integer,
  p_can_name_room boolean,
  p_can_send_push_invites boolean,
  p_media_protocol_version integer default 1
)
returns table (
  outcome text,
  room_record jsonb,
  active_room jsonb
)
language plpgsql volatile security definer set search_path='' as $$
declare activated boolean;
begin
 select active into strict activated from public.personal_history_policy where singleton for share;
 if activated and p_media_protocol_version is distinct from 2 then raise exception 'ROOM_UPDATE_REQUIRED';end if;
 return query select * from anidachi_room_private.create_room_with_active_session_v1(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites);
end $$;
revoke all on function public.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer) from public,anon,authenticated;
grant execute on function public.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer) to service_role;
alter function public.claim_active_room_session_v1(uuid,text,text,text) set schema anidachi_room_private;
revoke all on function anidachi_room_private.claim_active_room_session_v1(uuid,text,text,text) from public,anon,authenticated,service_role;
create function public.claim_active_room_session_v1(p_user_id uuid,p_room_id text,p_role text,p_participant_session_id text)
 returns table(outcome text,active_room jsonb) language plpgsql security definer set search_path='' as $$
 begin
 perform 1 from public.personal_history_policy where singleton for share;
 if exists(select 1 from public.rooms where room_id=p_room_id and media_lease is not null) then raise exception 'ROOM_UPDATE_REQUIRED';end if;
 return query select * from anidachi_room_private.claim_active_room_session_v1(p_user_id,p_room_id,p_role,p_participant_session_id);
 end $$;
 revoke all on function public.claim_active_room_session_v1(uuid,text,text,text) from public,anon,authenticated;
 grant execute on function public.claim_active_room_session_v1(uuid,text,text,text) to service_role;
create function public.claim_active_room_session_v2(p_user_id uuid,p_room_id text,p_role text,p_participant_session_id text,p_media_protocol_version integer default 1)
 returns table(outcome text,active_room jsonb) language plpgsql security definer set search_path='' as $$
 begin
 perform 1 from public.personal_history_policy where singleton for share;
 if p_media_protocol_version is distinct from 2 and exists(select 1 from public.rooms where room_id=p_room_id and media_lease is not null) then raise exception 'ROOM_UPDATE_REQUIRED';end if;
 return query select * from anidachi_room_private.claim_active_room_session_v1(p_user_id,p_room_id,p_role,p_participant_session_id);
 end $$;
 revoke all on function public.claim_active_room_session_v2(uuid,text,text,text,integer) from public,anon,authenticated;
 grant execute on function public.claim_active_room_session_v2(uuid,text,text,text,integer) to service_role;
commit;
