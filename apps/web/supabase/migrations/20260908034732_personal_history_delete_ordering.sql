begin;
-- Ordering keys are unnecessary after an account generation increment. Existing
-- generation fences still reject old envelopes before receipt replay. Retain
-- partial-delete sequence authority and every other owner's ordering state.
do $migration$
declare body text; anchor text := '  if scope_value = ''all'' then';
begin
 body:=pg_get_functiondef('public.delete_watch_history_v3(uuid,jsonb)'::regprocedure);
 if strpos(body,anchor)=0 then raise exception 'missing delete-all ordering cleanup anchor'; end if;
 body:=replace(body,anchor,anchor||E'\n    delete from public.personal_watch_sequences where user_id=p_user_id;');
 execute body;
end $migration$;
-- Ordering table remains inaccessible to service_role directly. This existing
-- service-role-only RPC performs the cleanup under its fixed empty search path.
alter function public.delete_watch_history_v3(uuid,jsonb) security definer;
revoke all on function public.delete_watch_history_v3(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.delete_watch_history_v3(uuid,jsonb) to service_role;
commit;
