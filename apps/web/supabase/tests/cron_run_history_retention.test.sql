begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_function('anidachi_private','prune_cron_run_history',array[]::text[],'private cleanup exists');

-- Rollback-only technical fixtures, with IDs outside cron's positive sequence.
insert into cron.job_run_details(jobid,runid,database,username,command,status,start_time,end_time)
select -81021,-n,current_database(),current_user,'select 1','succeeded',now()-interval '21 days',now()-interval '20 days'
from generate_series(1,5002) n;
insert into cron.job_run_details(jobid,runid,database,username,command,status,start_time,end_time) values
 (-81021,-6001,current_database(),current_user,'select 1','failed',now()-interval '16 days',now()-interval '15 days'),
 (-81021,-6002,current_database(),current_user,'select 1','succeeded',now()-interval '2 days',now()-interval '1 day'),
 (-81021,-6003,current_database(),current_user,'select 1','running',now()-interval '20 days',null),
 (-81021,-6004,current_database(),current_user,'select 1','running',now()-interval '20 days',now()-interval '19 days');

select is(anidachi_private.prune_cron_run_history(),5000,'one invocation removes at most 5000 old completed runs');
select is((select count(*) from cron.job_run_details where jobid=-81021),6::bigint,'bounded first batch leaves remaining old and protected runs');
select is(anidachi_private.prune_cron_run_history(),3,'next invocation finishes the old succeeded/failed batch');
select is((select count(*) from cron.job_run_details where jobid=-81021),3::bigint,'recent and unfinished runs survive cleanup');
select is(anidachi_private.prune_cron_run_history(),0,'no old completed rows means a no-op');
select ok((select count(*)=1 and bool_and(schedule='37 * * * *' and username='postgres' and active) from cron.job where jobname='anidachi-cron-run-history-cleanup'),'one named hourly operator job');
select ok((select not prosecdef and proconfig @> array['search_path=""','statement_timeout=5s','lock_timeout=1s'] from pg_proc where oid='anidachi_private.prune_cron_run_history()'::regprocedure),'cleanup is a bounded invoker with an empty search path');
select ok(not has_function_privilege('anon','anidachi_private.prune_cron_run_history()','execute'),'anon cannot execute cleanup');
select ok(not has_function_privilege('authenticated','anidachi_private.prune_cron_run_history()','execute'),'browser cannot execute cleanup');
select ok(not has_function_privilege('service_role','anidachi_private.prune_cron_run_history()','execute'),'application service role cannot delete cron logs');
select * from finish();
rollback;
