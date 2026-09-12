begin;

-- Reuse the existing eligibility relation and legacy projection unchanged.
-- These guarded edits fail closed if the preceding browse definition changes.
do $migration$
declare body text; before_body text;
begin
select pg_catalog.pg_get_functiondef('public.browse_watch_history_v3(uuid,jsonb,text)'::regprocedure) into body;
before_body:=body;
body:=pg_catalog.replace(body,
  '''cursor'',''provider'',''titleKey'',''episodeKey''))',
  '''cursor'',''provider'',''titleKey'',''episodeKey'',''includeEpisodePreviews''))
    or (p_query?''includeEpisodePreviews'' and (p_scope<>''titles'' or p_query->''includeEpisodePreviews'' is distinct from ''true''::jsonb))');
if body=before_body then raise exception 'unexpected browse query validation'; end if;
before_body:=body;
body:=pg_catalog.replace(body,'  progress_rows as materialized(', $cte$
  preview_entities as materialized(
    select m.provider,m.title_key,m.episode_key,max(m.watched_at) watched_at,
      count(*) session_count,pg_catalog.md5(m.episode_key) k
    from matching m join visible v on v.provider=m.provider and v.title_key=m.title_key
    where p_scope='titles' and p_query->'includeEpisodePreviews'='true'::jsonb
    group by m.provider,m.title_key,m.episode_key
  ), preview_ranked as (
    select *,row_number() over(partition by provider,title_key order by watched_at desc,k) rn,
      count(*) over(partition by provider,title_key) episode_count from preview_entities
  ), preview_visible as materialized(select * from preview_ranked where rn<=8),
  preview_sessions as materialized(
    select p.provider,p.title_key,p.episode_key,s.session_id from preview_visible p cross join lateral (
      select m.session_id from matching m where m.provider=p.provider and m.title_key=p.title_key and m.episode_key=p.episode_key
      order by m.watched_at desc,m.session_id limit 2
    ) s
  ),
  progress_rows as materialized($cte$);
if body=before_body then raise exception 'unexpected browse progress relation'; end if;
before_body:=body;
body:=pg_catalog.replace(body,'  ), bounded_sessions as materialized(', '  ), legacy_bounded_sessions as materialized(');
if body=before_body then raise exception 'unexpected browse session relation'; end if;
before_body:=body;
body:=pg_catalog.replace(body,$old$
    ) s
  )
  select pg_catalog.jsonb_build_object($old$,$new$
    ) s
  ), bounded_sessions as materialized(
    select session_id from legacy_bounded_sessions union select session_id from preview_sessions
  )
  select pg_catalog.jsonb_build_object($new$);
if body=before_body then raise exception 'unexpected browse projection'; end if;
before_body:=body;
body:=pg_catalog.replace(body,'  ) into result;', $projection$
  ) || case when p_scope='titles' and p_query->'includeEpisodePreviews'='true'::jsonb then pg_catalog.jsonb_build_object(
    'episodePreviews',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'provider',v.provider,'titleKey',v.title_key,
      'catalog',public.watch_catalog_read_v3(p_user_id,generation,v.provider,v.title_key),
      'progressRows',(select pg_catalog.jsonb_agg(public.watch_history_browse_progress_row_v3(ep) order by p.rn)
        from preview_visible p join public.watch_episode_progress ep on ep.user_id=p_user_id and ep.history_generation=generation and ep.provider=p.provider and ep.title_key=p.title_key and ep.episode_key=p.episode_key
        where p.provider=v.provider and p.title_key=v.title_key),
      'matches',(select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('episodeKey',p.episode_key,'lastWatchedAt',p.watched_at,'matchingSessionCount',p.session_count,'sessionsComplete',p.session_count<=2) order by p.rn)
        from preview_visible p where p.provider=v.provider and p.title_key=v.title_key),
      'sessionIds',(select pg_catalog.jsonb_agg(s.session_id order by m.watched_at desc,s.session_id) from preview_sessions s join matching m on m.session_id=s.session_id where s.provider=v.provider and s.title_key=v.title_key),
      'complete',v.episode_count<=8,
      -- An initial preview is not an ordinary limit=8 episode request. Its
      -- continuation binds to the UI's ordinary detail query with default20.
      'nextCursor',case when v.episode_count>8 then (
        select public.watch_history_browse_cursor_v3(
          pg_catalog.md5(p_user_id::text||':'||generation||':episodes:'||
            ((p_query-'cursor'-'includeEpisodePreviews'-'limit')||pg_catalog.jsonb_build_object('provider',v.provider,'titleKey',v.title_key,'limit',20))::text),
          p.watched_at,p.k) from preview_visible p where p.provider=v.provider and p.title_key=v.title_key and p.rn=8
      ) else null end
    ) order by v.watched_at desc,v.k) from visible v),'[]'::jsonb)
  ) else '{}'::jsonb end into result;$projection$);
if body=before_body then raise exception 'unexpected browse result assignment'; end if;
execute body;
end $migration$;

-- No new public RPC or privilege surface. SECURITY INVOKER and existing
-- service-role-only grants are retained by CREATE OR REPLACE FUNCTION.
commit;
