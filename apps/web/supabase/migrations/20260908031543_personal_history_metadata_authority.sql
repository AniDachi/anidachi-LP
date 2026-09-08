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
  if p_operation<>'metadata' and access->>'state' is distinct from 'allowed' then raise exception 'HISTORY_PLAN_REQUIRED'; end if;
 end if;
 return jsonb_build_object('active',activated,'policyVersion',1,'access',access);
end $$;
do $migration$
declare body text;
begin
 body:=pg_get_functiondef('public.set_watch_preferences_v3(uuid,jsonb)'::regprocedure);
 body:=replace(body,'''read''','''privacy''');
 execute body;
 body:=pg_get_functiondef('public.delete_watch_history_v3(uuid,jsonb)'::regprocedure);
 body:=replace(body,'p_request->>''scope''','p_request#>>''{target,scope}''');
 body:=replace(body,E'begin\n',E'begin\n  perform public.check_personal_history_operation_v1(p_user_id,\'privacy\');\n');
 execute body;
end $migration$;
commit;
