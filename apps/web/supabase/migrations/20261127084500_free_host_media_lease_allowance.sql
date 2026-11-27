-- Lease renewal runs as the calling service role. Its locked commercial policy
-- already contains the allowance used for this decision.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';

do $migration$
declare
  definition text := pg_get_functiondef('public.renew_room_media_lease_v2(text)'::regprocedure);
  old_comparison constant text := '>=anidachi_room_private.free_daily_budget_seconds()';
begin
  if cardinality(string_to_array(definition, old_comparison)) <> 2 then
    raise exception 'Unexpected media lease allowance comparison';
  end if;
  execute replace(definition, old_comparison, '>=hosting_policy.free_daily_host_seconds');
end $migration$;
commit;
