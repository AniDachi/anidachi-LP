begin;

-- The player can supply a single season when a public catalog request fails.
-- Keep previous membership for an inconclusive refresh in the same context.
-- Availability and release changes for explicitly observed IDs still take effect.
create function anidachi_history_private.hbomax_partial_catalog(previous jsonb, incoming jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare revised jsonb;
begin
  if previous->>'completeness' is distinct from 'partial'
    or ((previous->'context') - 'observedAt') is distinct from ((incoming->'context') - 'observedAt') then
    return incoming;
  end if;
  if not exists (
    select s->>'seasonKey', e->>'episodeKey' from jsonb_array_elements(previous->'seasons') s
      cross join lateral jsonb_array_elements(s->'episodes') e
    except
    select s->>'seasonKey', e->>'episodeKey' from jsonb_array_elements(incoming->'seasons') s
      cross join lateral jsonb_array_elements(s->'episodes') e
  ) then return incoming; end if;

  with current_rows as materialized (
    select e->>'episodeKey' as key, e->'available' as available, e->'releasedAt' as released_at
    from jsonb_array_elements(incoming->'seasons') s cross join lateral jsonb_array_elements(s->'episodes') e
  ), previous_seasons as (
    select s, n, coalesce((
      select jsonb_agg(case when r.key is null then e
        else e || jsonb_build_object('available',r.available,'releasedAt',r.released_at) end order by i)
      from jsonb_array_elements(s->'episodes') with ordinality episodes(e,i)
      left join current_rows r on r.key=e->>'episodeKey'
    ),'[]'::jsonb) as episodes
    from jsonb_array_elements(previous->'seasons') with ordinality seasons(s,n)
  )
  select jsonb_set(previous,'{seasons}',jsonb_agg(jsonb_set(s,'{episodes}',episodes) order by n))
    into revised from previous_seasons;
  -- Long release timestamps can take a near-limit snapshot over the storage cap.
  if octet_length(public.watch_catalog_json_v3(revised)) <= 1048576 then return revised; end if;
  return incoming;
end $$;
revoke all on function anidachi_history_private.hbomax_partial_catalog(jsonb,jsonb) from public,anon,authenticated,service_role;

do $migration$
declare writer text; editor text;
  old_write text := 'update public.watch_catalog_snapshots set snapshot=snap';
  old_gate text := $old$  if c.attempt_status is distinct from 'partial' or c.snapshot->>'completeness' is distinct from 'partial'
    or (prov='primevideo' and c.context->>'region' is null) or c.snapshot->'context' is distinct from c.context then return; end if;$old$;
begin
  writer:=pg_get_functiondef('anidachi_history_private.apply_watch_catalog_v3(uuid,jsonb)'::regprocedure);
  -- The complete path sets additional accepted fields on this same line. Match
  -- the partial update's line ending so its accepted/projection logic stays intact.
  old_write:=old_write||chr(10);
  if (length(writer)-length(replace(writer,old_write,'')))<>length(old_write) then raise exception 'unexpected partial catalog writer'; end if;
  execute replace(writer,old_write,$new$update public.watch_catalog_snapshots set snapshot=case when c.provider='hbomax'
        then anidachi_history_private.hbomax_partial_catalog(c.snapshot,snap) else snap end
$new$);

  editor:=pg_get_functiondef('anidachi_history_private.watch_editor_catalog_variants(uuid,bigint,text,text,boolean)'::regprocedure);
  if (length(editor)-length(replace(editor,old_gate,'')))<>length(old_gate) then raise exception 'unexpected partial catalog reader'; end if;
  execute replace(editor,old_gate,$new$  if prov='hbomax' then
    if c.attempt_status not in ('pending','partial') or c.snapshot->>'completeness' is distinct from 'partial'
      or ((c.snapshot->'context') - 'observedAt') is distinct from (c.context - 'observedAt') then return; end if;
  else
$new$||old_gate||chr(10)||'  end if;');
end $migration$;
commit;
