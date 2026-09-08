begin;
-- Canonical personal progress outlives historical session enrichment. An orphan
-- is still a title/episode, but is not a fictitious session or social result.
do $migration$
declare body text;
begin
 body:=pg_get_functiondef('public.browse_watch_history_v3(uuid,jsonb,text)'::regprocedure);
 body:=replace(body,'with matching as materialized(select * from public.watch_history_browse_matches_v3(p_user_id,generation,p_query))',
  'with matching as materialized(select * from public.watch_history_browse_matches_v3(p_user_id,generation,p_query) where p_scope<>''sessions'' or session_id is not null)');
 body:=replace(body,'''totalSessionCount'',(select count(*) from matching)', '''totalSessionCount'',(select count(session_id) from matching)');
 body:=replace(body,'count(*) session_count,pg_catalog.md5(m.episode_key)', 'count(m.session_id) session_count,pg_catalog.md5(m.episode_key)');
 body:=replace(body,'''sessionIds'',(select pg_catalog.jsonb_agg(s.session_id order by m.watched_at desc,s.session_id) from preview_sessions s join matching m on m.session_id=s.session_id where s.provider=v.provider and s.title_key=v.title_key)',
  '''sessionIds'',coalesce((select pg_catalog.jsonb_agg(s.session_id order by m.watched_at desc,s.session_id) from preview_sessions s join matching m on m.session_id=s.session_id where s.provider=v.provider and s.title_key=v.title_key),''[]''::jsonb)');
 execute body;
end $migration$;
commit;
