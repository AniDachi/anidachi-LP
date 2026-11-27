begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- The HTML video element ends individual Disney+ media segments. The episode
-- clock in the same checkpoint continues across those boundaries. Classify
-- the checkpoint once, for both session lifecycle and completion, while
-- retaining the original receipt for retries from already installed clients.
do $migration$
declare
  writer regprocedure := 'anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)'::regprocedure;
  definition text := pg_get_functiondef(writer);
  anchor text := $anchor$  if (
    provider_value = 'crunchyroll'
    and source_url_value !~$anchor$;
  segment_guard text := $guard$  if provider_value = 'disneyplus' and event_kind_value = 'ended'
     and (p_event ->> 'progress')::double precision < 0.9 then
    event_kind_value := 'pause';
  end if;

$guard$;
begin
  if array_length(string_to_array(definition, anchor), 1) is distinct from 2 then
    raise exception 'Unexpected watch progress writer definition';
  end if;
  execute replace(definition, anchor, segment_guard || anchor);
end $migration$;

commit;
