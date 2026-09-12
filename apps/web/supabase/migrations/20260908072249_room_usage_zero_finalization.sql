begin;
set local statement_timeout='15s';set local lock_timeout='3s';
-- Zero usage has no ledger delta. Preserve legacy terminal cleanup even when a
-- synthetic/client clock supplied a day outside the actual metering interval.
do $$
declare definition text;
begin
 definition:=pg_catalog.pg_get_functiondef('public.finalize_room_usage(text,timestamptz,date,integer)'::regprocedure);
 if position('if v_usage_day is not null then' in definition)=0 then raise exception 'Unexpected room finalization definition';end if;
 definition:=replace(definition,'if v_usage_day is not null then','if v_usage_day is not null and v_usage_seconds > 0 then');
 execute definition;
end $$;
commit;
