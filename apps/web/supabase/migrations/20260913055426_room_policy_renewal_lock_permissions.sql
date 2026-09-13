-- Repair service_role room renewal without broadening table privileges.
-- SELECT FOR SHARE needs UPDATE rights; the runtime intentionally has SELECT
-- only on personal_history_policy. Keep renewal SECURITY INVOKER.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';
create or replace function public.renew_room_media_lease_v2(p_room_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.rooms%rowtype; owner_id uuid; authority jsonb; t timestamptz; expiry timestamptz; paid_until timestamptz; caps jsonb; revision bigint;
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
 t:=pg_catalog.clock_timestamp();
 if r.media_closing_at is not null then return pg_catalog.jsonb_build_object('denied',true,'closingAt',r.media_closing_at); end if;
 if (r.host_plan_code='pro' and authority->>'planCode'<>'pro') or (r.host_plan_code='plus' and authority->>'planCode' not in ('plus','pro')) then
 update public.rooms set media_closing_at=t+interval '5 minutes' where room_id=p_room_id;
 return pg_catalog.jsonb_build_object('denied',true,'closingAt',t+interval '5 minutes');
 end if;
 paid_until:=case when r.host_plan_code='free' then null else (authority->>'selectedPlanExpiresAt')::timestamptz end;
 expiry:=least(t+interval '30 minutes',coalesce(paid_until,'infinity'::timestamptz));
 revision:=coalesce((r.media_lease->'capabilities'->>'capabilityRevision')::bigint,0)+1;
 caps:=pg_catalog.jsonb_build_object('mediaProtocolVersion',2,'hostPlanCode',r.host_plan_code,'maxParticipants',r.max_participants,'maxCameras',4,'maxMicrophones',case r.host_plan_code when 'pro' then 8 when 'plus' then 6 else 4 end,'capabilityRevision',revision,'capabilitiesValidUntil',expiry);
 update public.rooms set media_lease=pg_catalog.jsonb_build_object('roomId',p_room_id,'roomGeneration',1,'issuedAt',t,'paidUntil',paid_until,'capabilities',caps) where room_id=p_room_id returning * into r;
 return r.media_lease;
end $$;
revoke all on function public.renew_room_media_lease_v2(text) from public,anon,authenticated;
grant execute on function public.renew_room_media_lease_v2(text) to service_role;
commit;
