-- Add negotiated v3 without converting any existing room. Compatible Worker
-- must be present before the Web v3 create path is deployed.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

create or replace function public.renew_room_media_lease_v2(p_room_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.rooms%rowtype; owner_id uuid; authority jsonb; t timestamptz; expiry timestamptz; paid_until timestamptz; caps jsonb; revision bigint; protocol integer; pinned_protocol text;
begin
 select host_user_id into strict owner_id from public.rooms where room_id=p_room_id;
 -- This existing server-only definer helper locks policy without granting the
 -- service role UPDATE on the operator-controlled activation flag. It does
 -- not require paid history access. Retain policy -> account -> room order.
 perform public.check_personal_history_operation_v1(owner_id,'privacy');
 authority:=public.resolve_watch_history_access_v1(owner_id);
 select * into strict r from public.rooms where room_id=p_room_id for update;
 if r.status='ended' then raise exception 'ROOM_ENDED'; end if;
 if r.media_lease is null then return null; end if;
 -- The unchanged private create core uses {} only while creating a v2 lease.
 -- Every already issued lease must retain its pinned protocol.
 pinned_protocol:=case when r.media_lease='{}'::jsonb then '2' else r.media_lease#>>'{capabilities,mediaProtocolVersion}' end;
 if pinned_protocol is null or pinned_protocol not in ('2','3') then raise exception 'ROOM_UPDATE_REQUIRED'; end if;
 protocol:=pinned_protocol::integer;
 t:=pg_catalog.clock_timestamp();
 if r.media_closing_at is not null then return pg_catalog.jsonb_build_object('denied',true,'closingAt',r.media_closing_at); end if;
 if (r.host_plan_code='pro' and authority->>'planCode'<>'pro') or (r.host_plan_code='plus' and authority->>'planCode' not in ('plus','pro')) then
 update public.rooms set media_closing_at=t+interval '5 minutes' where room_id=p_room_id;
 return pg_catalog.jsonb_build_object('denied',true,'closingAt',t+interval '5 minutes');
 end if;
 paid_until:=case when r.host_plan_code='free' then null else (authority->>'selectedPlanExpiresAt')::timestamptz end;
 expiry:=least(t+interval '30 minutes',coalesce(paid_until,'infinity'::timestamptz));
 revision:=coalesce((r.media_lease->'capabilities'->>'capabilityRevision')::bigint,0)+1;
 caps:=pg_catalog.jsonb_build_object('mediaProtocolVersion',protocol,'hostPlanCode',r.host_plan_code,'maxParticipants',r.max_participants,'maxCameras',4,case when protocol=3 then 'maxMediaSeats' else 'maxMicrophones' end,case r.host_plan_code when 'pro' then 8 when 'plus' then 6 else 4 end,'capabilityRevision',revision,'capabilitiesValidUntil',expiry);
 update public.rooms set media_lease=pg_catalog.jsonb_build_object('roomId',p_room_id,'roomGeneration',1,'issuedAt',t,'paidUntil',paid_until,'capabilities',caps) where room_id=p_room_id returning * into r;
 return r.media_lease;
end $$;
revoke all on function public.renew_room_media_lease_v2(text) from public,anon,authenticated;
grant execute on function public.renew_room_media_lease_v2(text) to service_role;

create function public.renew_room_media_lease_v3(p_room_id text)
returns jsonb language sql security invoker set search_path = '' as $$
 select public.renew_room_media_lease_v2(p_room_id);
$$;
revoke all on function public.renew_room_media_lease_v3(text) from public,anon,authenticated;
grant execute on function public.renew_room_media_lease_v3(text) to service_role;

create function public.create_room_with_active_session_v3(
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
declare
 activated boolean;
 existing_room public.rooms%rowtype;
 had_existing_room boolean;
 admitted record;
 pinned text;
 new_room public.rooms%rowtype;
begin
 select active into strict activated from public.personal_history_policy where singleton for share;
 if p_media_protocol_version is null or p_media_protocol_version not in (1,2,3)
    or (activated and p_media_protocol_version=1) then
   raise exception 'ROOM_UPDATE_REQUIRED';
 end if;
 -- Preserve the private core's complete input guard before our earlier
 -- authority lookup. This is the guard from 20260908065520; creation and
 -- entitlement logic remain exclusively in the unchanged private core.
  if p_host_user_id is null
    or p_participant_session_id is null
    or pg_catalog.char_length(p_participant_session_id) not between 1 and 128
    or (p_show_id is not null and pg_catalog.char_length(p_show_id) > 200)
    or (p_episode_id is not null and pg_catalog.char_length(p_episode_id) > 200)
    or (p_title is not null and pg_catalog.char_length(p_title) > 300)
    or (
      p_client_request_id is not null
      and (
        p_client_request_id <> pg_catalog.btrim(p_client_request_id)
        or pg_catalog.char_length(p_client_request_id) not between 1 and 100
      )
    )
    or p_host_plan_code is null
    or p_host_plan_code not in ('free', 'plus', 'pro', 'watcher', 'nakama', 'junkie')
    or p_max_participants is null
    or p_max_participants not between 1 and 50
    or p_max_media_seats is null
    or p_max_media_seats not between 0 and 16
    or p_can_name_room is null
    or p_can_send_push_invites is null
    or (
      (p_source_provider is null) <> (p_source_url is null)
      or (p_source_provider is null) <> (p_video_fingerprint is null)
      or (p_source_provider is null) <> (p_source_generation is null)
    )
    or (
      p_source_provider is not null
      and (
        p_source_provider not in ('crunchyroll', 'youtube')
        or pg_catalog.char_length(p_source_url) not between 1 and 2048
        or pg_catalog.char_length(p_video_fingerprint) not between 1 and 400
        or p_source_generation not between 1 and 9007199254740991
      )
    )
  then
    raise exception 'active_room_session_invalid_input' using errcode = '22023';
  end if;
 -- Match the private core's policy -> account -> room lock order. All creates
 -- serialize on this account; the lookup is identical to the core's reuse test.
 perform public.resolve_watch_history_access_v1(p_host_user_id);
 perform 1 from public.users where id=p_host_user_id for update;
 select room.* into existing_room from public.rooms room
 where room.host_user_id=p_host_user_id and room.client_request_id=p_client_request_id
   and room.status<>'ended'
 order by room.created_at asc limit 1 for update;
 had_existing_room:=found;
 if had_existing_room and existing_room.media_lease is not null then
   pinned:=existing_room.media_lease#>>'{capabilities,mediaProtocolVersion}';
   if pinned is null or pinned not in ('2','3')
      or (pinned='3' and p_media_protocol_version<>3)
      or (pinned='2' and p_media_protocol_version not in (2,3)) then
     raise exception 'ROOM_UPDATE_REQUIRED';
   end if;
 end if;
 -- Outcome 'claimed' can also mean a replacement session on an existing room.
 -- Newness comes only from the locked lookup, never the outcome value.
 select * into admitted from anidachi_room_private.create_room_with_active_session_v1(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites);
 if not had_existing_room and admitted.room_record is not null and activated and p_media_protocol_version=3 then
   -- The core has already resolved the durable plan and minted the initial
   -- lease. Select v3 before returning or releasing locks, retaining its bounds.
   update public.rooms
   set max_media_seats=(media_lease#>>'{capabilities,maxMicrophones}')::integer,
       media_lease=pg_catalog.jsonb_set(media_lease,'{capabilities}',
     ((media_lease->'capabilities') - 'maxMicrophones') ||
     pg_catalog.jsonb_build_object('mediaProtocolVersion',3,'maxMediaSeats',
       (media_lease#>>'{capabilities,maxMicrophones}')::integer))
   where room_id=admitted.room_record->>'room_id'
   returning * into strict new_room;
   admitted.room_record:=pg_catalog.to_jsonb(new_room);
 end if;
 return query select admitted.outcome,admitted.room_record,admitted.active_room;
end $$;
revoke all on function public.create_room_with_active_session_v3(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer) from public,anon,authenticated;
grant execute on function public.create_room_with_active_session_v3(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer) to service_role;

create or replace function public.create_room_with_active_session_v2(
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
begin
 if p_media_protocol_version is null or p_media_protocol_version not in (1,2) then raise exception 'ROOM_UPDATE_REQUIRED'; end if;
 return query select * from public.create_room_with_active_session_v3(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites,p_media_protocol_version);
end $$;

create function public.claim_active_room_session_v3(p_user_id uuid,p_room_id text,p_role text,p_participant_session_id text,p_media_protocol_version integer default 1)
returns table(outcome text,active_room jsonb) language plpgsql security definer set search_path='' as $$
declare lease jsonb; pinned text;
begin
 perform 1 from public.personal_history_policy where singleton for share;
 if p_media_protocol_version is null or p_media_protocol_version not in (1,2,3) then raise exception 'ROOM_UPDATE_REQUIRED'; end if;
 select media_lease into lease from public.rooms where room_id=p_room_id;
 if lease is not null then
   pinned:=lease#>>'{capabilities,mediaProtocolVersion}';
   if pinned is null or pinned not in ('2','3')
      or (pinned='3' and p_media_protocol_version<>3)
      or (pinned='2' and p_media_protocol_version not in (2,3)) then
     raise exception 'ROOM_UPDATE_REQUIRED';
   end if;
 end if;
 return query select * from anidachi_room_private.claim_active_room_session_v1(p_user_id,p_room_id,p_role,p_participant_session_id);
end $$;
revoke all on function public.claim_active_room_session_v3(uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.claim_active_room_session_v3(uuid,text,text,text,integer) to service_role;

create or replace function public.claim_active_room_session_v2(p_user_id uuid,p_room_id text,p_role text,p_participant_session_id text,p_media_protocol_version integer default 1)
returns table(outcome text,active_room jsonb) language plpgsql security definer set search_path='' as $$
begin
 if p_media_protocol_version is null or p_media_protocol_version not in (1,2) then raise exception 'ROOM_UPDATE_REQUIRED'; end if;
 return query select * from public.claim_active_room_session_v3(p_user_id,p_room_id,p_role,p_participant_session_id,p_media_protocol_version);
end $$;
-- Retain inactive legacy creation, but never let the v1 RPC reuse a negotiated
-- room if an operator later deactivates the personal-history policy.
create or replace function public.create_room_with_active_session_v1(
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
begin
 return query select * from public.create_room_with_active_session_v3(p_host_user_id,p_participant_session_id,p_show_id,p_episode_id,p_source_provider,p_source_url,p_video_fingerprint,p_source_generation,p_title,p_client_request_id,p_host_plan_code,p_max_participants,p_max_media_seats,p_can_name_room,p_can_send_push_invites,1);
end $$;

commit;
