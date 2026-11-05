-- Isolated, rollback-only feedback inbox contracts.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

select ok(not has_table_privilege('anon','public.uninstall_feedback','SELECT'),'anonymous cannot read feedback table');
select ok(not has_table_privilege('authenticated','public.uninstall_feedback','SELECT'),'website users cannot read feedback table');
select ok(not has_table_privilege('service_role','public.uninstall_feedback','SELECT'),'CRM has no direct table access');
select ok(not has_function_privilege('anon','public.list_uninstall_feedback_v1(timestamptz,uuid)','EXECUTE'),'anonymous cannot list responses');
select ok(not has_function_privilege('authenticated','public.list_uninstall_feedback_v1(timestamptz,uuid)','EXECUTE'),'website login is not CRM access');
select ok(has_function_privilege('service_role','public.list_uninstall_feedback_v1(timestamptz,uuid)','EXECUTE'),'server can read bounded projection');
select ok(prosecdef and 'search_path=""'=any(proconfig),'reader has a fixed search path') from pg_proc where oid='public.list_uninstall_feedback_v1(timestamptz,uuid)'::regprocedure;
select is((select count(*)::integer from public.list_uninstall_feedback_v1()),0,'empty inbox is explicit');

insert into public.uninstall_feedback(submission_id,actor_hash,user_id,reason,note,created_at)
select ('22222222-2222-4222-8222-'||lpad(n::text,12,'0'))::uuid,repeat('a',64),null,
  case when n=55 then 'technical_issues' else 'other' end,
  case when n=55 then '<script>user text</script>' else '' end,
  '2030-01-01T00:00:00.123456Z'::timestamptz
from generate_series(1,55) n;
select is((select count(*)::integer from public.list_uninstall_feedback_v1()),51,'page bounded to 50 plus one lookahead');
select is((select submission_id::text from public.list_uninstall_feedback_v1() limit 1),'22222222-2222-4222-8222-000000000055','ties have deterministic ID order');
select is((select note from public.list_uninstall_feedback_v1() limit 1),'<script>user text</script>','comment returned as text, presentation must escape it');
select is((select count(*)::integer from public.list_uninstall_feedback_v1('2030-01-01T00:00:00.123456Z','22222222-2222-4222-8222-000000000006')),5,'second UI page does not skip tied timestamps');
select is((select max(submission_id::text) from public.list_uninstall_feedback_v1('2030-01-01T00:00:00.123456Z','22222222-2222-4222-8222-000000000006')),'22222222-2222-4222-8222-000000000005','cursor row is excluded');
select is((select count(*)::integer from public.list_uninstall_feedback_v1('2030-01-01T00:00:00.123455Z','22222222-2222-4222-8222-000000000006')),0,'microsecond precision is retained');
select throws_ok($$select * from public.list_uninstall_feedback_v1(now(),null)$$,'22023','FEEDBACK_CURSOR_INVALID','timestamp without ID rejected');
select throws_ok($$select * from public.list_uninstall_feedback_v1(null,'22222222-2222-4222-8222-000000000006')$$,'22023','FEEDBACK_CURSOR_INVALID','ID without timestamp rejected');
select throws_ok($$select * from public.list_uninstall_feedback_v1('infinity','22222222-2222-4222-8222-000000000006')$$,'22023','FEEDBACK_CURSOR_INVALID','infinite cursor rejected');
select is((select array_agg(key order by key)::text from jsonb_object_keys((select to_jsonb(f) from public.list_uninstall_feedback_v1() f limit 1)) key),'{created_at,note,reason,submission_id}','reader exposes no actor hash or account identifiers');
set local role service_role;
select is((select count(*)::integer from public.list_uninstall_feedback_v1()),51,'real service role can execute the private reader');
reset role;
select * from finish();
rollback;
