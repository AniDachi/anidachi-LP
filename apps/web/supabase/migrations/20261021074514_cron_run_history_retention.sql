begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Only technical pg_cron logs, never account/history/billing/idempotency data.
-- Bound each pass so an accumulated backlog drains without one large DELETE.
create function anidachi_private.prune_cron_run_history()
returns integer language plpgsql security invoker
set search_path='' set statement_timeout='5s' set lock_timeout='1s'
as $$
declare removed integer;
begin
  with expired as (
    select runid from cron.job_run_details
    where status in ('succeeded','failed')
      and end_time < statement_timestamp()-interval '14 days'
    order by end_time,runid
    limit 5000
    for update skip locked
  )
  delete from cron.job_run_details r using expired e where r.runid=e.runid;
  get diagnostics removed=row_count;
  return removed;
end $$;
revoke all on function anidachi_private.prune_cron_run_history() from public,anon,authenticated,service_role;
grant execute on function anidachi_private.prune_cron_run_history() to postgres;

select cron.schedule(
  'anidachi-cron-run-history-cleanup',
  '37 * * * *',
  $job$set statement_timeout='5s'; select anidachi_private.prune_cron_run_history();$job$
);
commit;
