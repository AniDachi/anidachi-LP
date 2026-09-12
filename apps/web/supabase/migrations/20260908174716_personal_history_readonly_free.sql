-- Free retains read and deletion access to already saved history.
-- Recording, catalog proofs, epochs, and rollout activation are unchanged.
begin;
create or replace function public.check_personal_history_operation_v1(p_user_id uuid,p_operation text default 'read') returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare activated boolean; access jsonb;
begin
 select active into strict activated from public.personal_history_policy where singleton for share;
 if p_operation not in ('read','legacy','personal','metadata','privacy') then raise exception 'HISTORY_ACCESS_UNAVAILABLE'; end if;
 if activated and p_operation='legacy' then raise exception 'HISTORY_CLIENT_UPDATE_REQUIRED'; end if;
 if (activated and p_operation<>'privacy') or p_operation='personal' then
  access:=public.resolve_watch_history_access_v1(p_user_id)->'history';
  if p_operation in ('personal','legacy') and access->>'state' is distinct from 'allowed' then raise exception 'HISTORY_PLAN_REQUIRED'; end if;
 end if;
 return jsonb_build_object('active',activated,'policyVersion',1,'access',access);
end $$;
-- Preserve the existing server-only execution boundary.
revoke all on function public.check_personal_history_operation_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.check_personal_history_operation_v1(uuid,text) to service_role;
commit;
