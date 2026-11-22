begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Disney supplies a stable season UUID for named shelves such as Exclusives.
-- Keep numeric keys for numbered seasons and preserve unclassified observations.
do $migration$
declare
  routine regprocedure;
  body text;
  needle text;
  replacement text;
begin
  routine := 'public.validate_watch_identity_v3'::regproc::oid::regprocedure;
  body := pg_get_functiondef(routine);
  needle := $old$(p_event->'seasonNumber'='null'::jsonb and (p_event->'seasonKey' is distinct from 'null'::jsonb or p_event->'seasonTitle' is distinct from 'null'::jsonb))$old$;
  replacement := $new$(p_event->'seasonNumber'='null'::jsonb and not coalesce((
          (p_event->'seasonKey'='null'::jsonb and p_event->'seasonTitle'='null'::jsonb) or
          (jsonb_typeof(p_event->'seasonKey')='string' and coalesce(p_event->>'seasonKey','') ~
            ('^disneyplus:season:'||(i->>'providerSeriesId')||':[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))),false))$new$;
  if array_length(string_to_array(body,needle),1) is distinct from 2 then raise exception 'Disney history validator changed'; end if;
  execute replace(body,needle,replacement);

  routine := 'public.validate_watch_catalog_input_v3'::regproc::oid::regprocedure;
  body := pg_get_functiondef(routine);
  needle := $old$not public.watch_catalog_number_valid_v3(s->'seasonNumber',1000,true) or s->'seasonNumber'='0'::jsonb
     or s->>'providerSeasonIdentifier' is distinct from (r->>'providerSeriesId')||':'||(s->>'seasonNumber')$old$;
  replacement := $new$not coalesce((
       (public.watch_catalog_number_valid_v3(s->'seasonNumber',1000,true) and s->'seasonNumber'<>'0'::jsonb and
        s->>'providerSeasonIdentifier' = (r->>'providerSeriesId')||':'||(s->>'seasonNumber')) or
       (s->'seasonNumber'='null'::jsonb and coalesce(s->>'providerSeasonIdentifier','') ~
        ('^'||(r->>'providerSeriesId')||':[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'))),false)$new$;
  if array_length(string_to_array(body,needle),1) is distinct from 2 then raise exception 'Disney catalog validator changed'; end if;
  execute replace(body,needle,replacement);
end $migration$;
commit;
