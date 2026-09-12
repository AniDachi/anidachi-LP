begin;
set local statement_timeout='15s';
set local lock_timeout='3s';
create schema anidachi_room_private;
revoke all on schema anidachi_room_private from public,anon,authenticated,service_role;
alter function public.create_room_with_active_session_v1(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean) set schema anidachi_room_private;
revoke all on function anidachi_room_private.create_room_with_active_session_v1(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean) from public,anon,authenticated,service_role;
create function public.create_room_with_active_session_v1(
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
  p_can_send_push_invites boolean
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
 if activated then raise exception 'ROOM_UPDATE_REQUIRED' using errcode='P0001';end if;
 return query select * from anidachi_room_private.create_room_with_active_session_v1(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites);
end $$;
revoke all on function public.create_room_with_active_session_v1(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.create_room_with_active_session_v1(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean) to service_role;
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
  p_can_send_push_invites boolean
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
 return query select * from anidachi_room_private.create_room_with_active_session_v1(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites);
end $$;
revoke all on function public.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean) from public,anon,authenticated;
grant execute on function public.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean) to service_role;
commit;
