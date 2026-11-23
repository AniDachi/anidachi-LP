alter table public.rooms
  add column lobby_marketplace text,
  drop constraint rooms_lobby_provider_check,
  add constraint rooms_lobby_provider_check check (lobby_provider in ('disneyplus', 'netflix', 'primevideo')),
  add constraint rooms_lobby_marketplace_check check (
    lobby_marketplace is null or (lobby_provider is not distinct from 'primevideo' and
      lobby_marketplace in ('primevideo.com', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.co.jp',
                           'amazon.ca', 'amazon.in', 'amazon.com.mx'))
  );

create or replace function public.create_catalog_room_v2(
  p_lobby_provider text, p_lobby_marketplace text, p_host_user_id uuid, p_participant_session_id text,
  p_title text, p_client_request_id text, p_host_plan_code text,
  p_max_participants integer, p_max_media_seats integer, p_can_name_room boolean,
  p_can_send_push_invites boolean, p_media_protocol_version integer,
  p_free20_client_version integer, p_abuse_enabled boolean,
  p_free20_browser_hash text, p_free20_installation_hash text
) returns table(outcome text, room_record jsonb, active_room jsonb)
language plpgsql security invoker set search_path = '' as $$
declare
  admitted record;
  created public.rooms%rowtype;
begin
  if (p_lobby_provider is null or p_lobby_provider not in ('disneyplus', 'netflix', 'primevideo')) or p_abuse_enabled is null or p_client_request_id is null then
    raise exception 'invalid catalog room' using errcode = '22023';
  end if;

  if p_abuse_enabled then
    select * into strict admitted from public.create_room_with_active_session_v5(
      p_host_user_id, p_participant_session_id, null, null, null, null, null, null,
      p_title, p_client_request_id, p_host_plan_code, p_max_participants, p_max_media_seats,
      p_can_name_room, p_can_send_push_invites, p_media_protocol_version, p_free20_client_version,
      p_free20_browser_hash, p_free20_installation_hash);
  else
    select * into strict admitted from public.create_room_with_active_session_v4(
      p_host_user_id, p_participant_session_id, null, null, null, null, null, null,
      p_title, p_client_request_id, p_host_plan_code, p_max_participants, p_max_media_seats,
      p_can_name_room, p_can_send_push_invites, p_media_protocol_version, p_free20_client_version);
  end if;

  if admitted.outcome in ('claimed', 'reused') and
     (admitted.room_record->>'lobby_provider') is distinct from p_lobby_provider then
    -- Admission can claim an existing session. Only attach the catalog to an
    -- empty room from this host and this creation intent, never a playing room.
    update public.rooms set lobby_provider = p_lobby_provider, lobby_marketplace = p_lobby_marketplace
    where room_id = admitted.room_record->>'room_id' and host_user_id = p_host_user_id
      and client_request_id = p_client_request_id and lobby_provider is null
      and source_url is null and source_provider is null and status <> 'ended'
    returning * into strict created;
    admitted.room_record := to_jsonb(created);
  end if;
  return query select admitted.outcome, admitted.room_record, admitted.active_room;
end;
$$;

revoke all on function public.create_catalog_room_v2(text,text,uuid,text,text,text,text,integer,integer,boolean,boolean,integer,integer,boolean,text,text) from public, anon, authenticated;
grant execute on function public.create_catalog_room_v2(text,text,uuid,text,text,text,text,integer,integer,boolean,boolean,integer,integer,boolean,text,text) to service_role;

create or replace function public.create_catalog_room_v1(
  p_lobby_provider text, p_host_user_id uuid, p_participant_session_id text,
  p_title text, p_client_request_id text, p_host_plan_code text,
  p_max_participants integer, p_max_media_seats integer, p_can_name_room boolean,
  p_can_send_push_invites boolean, p_media_protocol_version integer,
  p_free20_client_version integer, p_abuse_enabled boolean,
  p_free20_browser_hash text, p_free20_installation_hash text
) returns table(outcome text, room_record jsonb, active_room jsonb)
language sql security invoker set search_path = '' as $$
  select * from public.create_catalog_room_v2(
    p_lobby_provider, null, p_host_user_id, p_participant_session_id, p_title, p_client_request_id,
    p_host_plan_code, p_max_participants, p_max_media_seats, p_can_name_room,
    p_can_send_push_invites, p_media_protocol_version, p_free20_client_version, p_abuse_enabled,
    p_free20_browser_hash, p_free20_installation_hash);
$$;
