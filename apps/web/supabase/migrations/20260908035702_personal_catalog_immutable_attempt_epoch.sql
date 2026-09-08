begin;
-- Catalog authority belongs to the issued revision, not to the latest caller.
-- A cache hit returns an existing (possibly still pending) revision and must
-- never reauthorize it across a paid epoch, even with a fresh request context.
do $migration$
declare body text;
  old_binding text := $old$ update public.watch_catalog_snapshots set personal_access_epoch=case when proof is null then null else (a->>'accessEpoch')::bigint end
 where user_id=p_user_id and history_generation=(p_request->>'accountGeneration')::bigint and provider='crunchyroll' and title_key=p_request->>'titleKey';$old$;
begin
  body:=pg_get_functiondef('public.begin_watch_catalog_v3(uuid,jsonb)'::regprocedure);
  if strpos(body,old_binding)=0 then raise exception 'unexpected catalog attempt epoch binding'; end if;
  body:=replace(body,old_binding,$new$
 if (ack->>'refreshRequired')::boolean is true then
  update public.watch_catalog_snapshots
  set personal_access_epoch=case when proof is null then null else (a->>'accessEpoch')::bigint end
  where user_id=p_user_id and history_generation=(p_request->>'accountGeneration')::bigint
    and provider='crunchyroll' and title_key=p_request->>'titleKey'
    and revision=(ack->>'revision')::bigint;
 end if;$new$);
  execute body;
end $migration$;
commit;
