begin;

-- A partial Prime roster is useful inventory, but never an accepted full
-- catalog. Keep it in the existing bounded snapshot and preserve complete data.
do $migration$
declare body text; needle text := $old$  if snap->>'completeness'='partial' then$old$;
begin
  body:=pg_get_functiondef('anidachi_history_private.apply_watch_catalog_v3(uuid,jsonb)'::regprocedure);
  if (length(body)-length(replace(body,needle,'')))<>length(needle) then
    raise exception 'partial catalog anchor changed';
  end if;
  body:=replace(body,needle,needle||$new$
    if c.provider='primevideo' and c.attempt_status='pending'
      and c.snapshot->>'completeness' is distinct from 'complete' then
      update public.watch_catalog_snapshots set snapshot=snap
      where user_id=p_user_id and history_generation=gen and provider=c.provider and title_key=c.title_key;
    end if;
$new$);
  execute body;
end $migration$;

-- Reuse the editor's existing variant selection and progress merge. Observed
-- rows do not enter canonical aliases, totals or completion projections.
create function anidachi_history_private.watch_editor_catalog_variants(
  uid uuid, gen bigint, prov text, titlekey text, complete boolean
) returns setof public.watch_catalog_aliases
language plpgsql stable security invoker set search_path='' as $$
declare c public.watch_catalog_snapshots%rowtype;
begin
  if complete then
    return query select a.* from public.watch_catalog_aliases a
      where a.user_id=uid and a.history_generation=gen and a.provider=prov and a.title_key=titlekey;
    return;
  end if;
  if prov<>'primevideo' then return; end if;
  select * into c from public.watch_catalog_snapshots
    where user_id=uid and history_generation=gen and provider=prov and title_key=titlekey;
  if c.attempt_status is distinct from 'partial' or c.snapshot->>'completeness' is distinct from 'partial'
    or c.context->>'region' is null or c.snapshot->'context' is distinct from c.context then return; end if;
  return query select (jsonb_populate_record(null::public.watch_catalog_aliases,jsonb_build_object(
    'user_id',uid,'history_generation',gen,'provider',prov,'title_key',titlekey,
    'raw_content_id',v->'providerContentId','audio_locale',v->'audioLocale','original',v->'original',
    'variant_order',v->'order','source_url',v->'sourceUrl',
    'season_key',s->'seasonKey','season_order',s->'order','season_title',s->'title','season_number',s->'seasonNumber',
    'episode_key',e->'episodeKey','episode_order',e->'order','episode_title',e->'title','episode_number',e->'episodeNumber',
    'released_at',e->'releasedAt','available',e->'available'))).*
    from jsonb_array_elements(c.snapshot->'seasons') s
    cross join lateral jsonb_array_elements(s->'episodes') e
    cross join lateral jsonb_array_elements(e->'watchVariants') v;
end $$;
revoke all on function anidachi_history_private.watch_editor_catalog_variants(uuid,bigint,text,text,boolean)
  from public,anon,authenticated,service_role;

-- Both entry points retain their exact response shape. Only the opt-in one
-- enriches launch navigation; their catalog inventory must agree.
do $migration$
declare target regprocedure; body text;
  source text := 'from public.watch_catalog_aliases a';
  predicate text := 'where complete and a.user_id=uid';
begin
  foreach target in array array[
    'anidachi_history_private.watch_editor_snapshot(uuid,bigint,text,text)'::regprocedure,
    'anidachi_history_private.watch_editor_snapshot_prime_navigation_v1(uuid,bigint,text,text)'::regprocedure
  ] loop
    body:=pg_get_functiondef(target);
    if (length(body)-length(replace(body,source,'')))<>length(source)
      or (length(body)-length(replace(body,predicate,'')))<>length(predicate) then
      raise exception 'editor catalog anchor changed: %',target;
    end if;
    body:=replace(body,source,'from anidachi_history_private.watch_editor_catalog_variants(uid,gen,prov,titlekey,complete) a');
    body:=replace(body,predicate,'where a.user_id=uid');
    execute body;
  end loop;
end $migration$;
commit;
