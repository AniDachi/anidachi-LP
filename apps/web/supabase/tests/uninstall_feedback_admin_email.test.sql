-- Disposable local fixture only; all rows and account changes roll back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

select ok(not has_function_privilege('anon','public.list_uninstall_feedback_v2(timestamptz,uuid)','EXECUTE'),'anonymous cannot read feedback emails');
select ok(not has_function_privilege('authenticated','public.list_uninstall_feedback_v2(timestamptz,uuid)','EXECUTE'),'website login cannot read feedback emails');
select ok(has_function_privilege('service_role','public.list_uninstall_feedback_v2(timestamptz,uuid)','EXECUTE'),'CRM server can read email projection');
select ok(not has_table_privilege('service_role','public.uninstall_feedback','SELECT'),'no direct feedback table grant');
select ok(prosecdef and 'search_path=""'=any(proconfig),'email reader has a fixed search path') from pg_proc where oid='public.list_uninstall_feedback_v2(timestamptz,uuid)'::regprocedure;

insert into public.users(id,email,display_name,discord_id) values
 ('33333333-3333-4333-8333-000000000001','feedback-first@example.com','First','123456789012345678'),
 ('33333333-3333-4333-8333-000000000002','feedback-second@example.com','Second',null),
 ('33333333-3333-4333-8333-000000000003','unrelated@example.com','Unrelated','987654321098765432');
insert into public.uninstall_feedback(submission_id,actor_hash,user_id,reason,note,created_at)
select ('44444444-4444-4444-8444-'||lpad(n::text,12,'0'))::uuid,repeat('b',64),
  case when n=55 then '33333333-3333-4333-8333-000000000001'::uuid
       when n=54 then '33333333-3333-4333-8333-000000000002'::uuid else null end,
  'other', '', '2030-01-01T00:00:00.123456Z'::timestamptz
from generate_series(1,55) n;

select is((select count(*)::integer from public.list_uninstall_feedback_v2()),51,'email join preserves 50 plus lookahead bound');
select is((select email from public.list_uninstall_feedback_v2() limit 1),'feedback-first@example.com','newest feedback maps to its actual account');
select is((select email from public.list_uninstall_feedback_v2() offset 1 limit 1),'feedback-second@example.com','another feedback maps to its own account');
select is((select email from public.list_uninstall_feedback_v2() offset 2 limit 1),null::text,'anonymous feedback remains visible without email');
select is((select count(*)::integer from public.list_uninstall_feedback_v2() where email='unrelated@example.com'),0,'unrelated account email is excluded');
select is((select count(*)::integer from public.list_uninstall_feedback_v2('2030-01-01T00:00:00.123456Z','44444444-4444-4444-8444-000000000006')),5,'email join preserves tied timestamp pagination');
select is((select count(*)::integer from public.list_uninstall_feedback_v2('2030-01-01T00:00:00.123455Z','44444444-4444-4444-8444-000000000006')),0,'cursor keeps microsecond precision');
select throws_ok($$select * from public.list_uninstall_feedback_v2(now(),null)$$,'22023','FEEDBACK_CURSOR_INVALID','partial cursor rejected');
select throws_ok($$select * from public.list_uninstall_feedback_v2(null,'44444444-4444-4444-8444-000000000006')$$,'22023','FEEDBACK_CURSOR_INVALID','ID-only cursor rejected');
select throws_ok($$select * from public.list_uninstall_feedback_v2('infinity','44444444-4444-4444-8444-000000000006')$$,'22023','FEEDBACK_CURSOR_INVALID','infinite cursor rejected');
select is((select array_agg(key order by key)::text from jsonb_object_keys((select to_jsonb(f) from public.list_uninstall_feedback_v2() f limit 1)) key),'{created_at,discord_id,email,note,reason,submission_id}','only contact fields added; internal account IDs and hashes stay private');
select is((select array_agg(key order by key)::text from jsonb_object_keys((select to_jsonb(f) from public.list_uninstall_feedback_v1() f limit 1)) key),'{created_at,note,reason,submission_id}','legacy reader remains compatible for rollback');

select is((select discord_id from public.list_uninstall_feedback_v2() limit 1),'123456789012345678','linked Discord ID is returned as text');
select is((select discord_id from public.list_uninstall_feedback_v2() offset 1 limit 1),null::text,'Google-only account has no invented Discord ID');
select is((select discord_id from public.list_uninstall_feedback_v2() offset 2 limit 1),null::text,'anonymous feedback has no Discord ID');

update public.users set email='feedback-updated@example.com' where id='33333333-3333-4333-8333-000000000001';
select is((select email from public.list_uninstall_feedback_v2() limit 1),'feedback-updated@example.com','reader uses current account email without a duplicate snapshot');
delete from public.users where id='33333333-3333-4333-8333-000000000002';
select is((select email from public.list_uninstall_feedback_v2() offset 1 limit 1),null::text,'deleted account leaves feedback readable without email');
select is((select count(*)::integer from public.list_uninstall_feedback_v2()),51,'account deletion does not remove feedback');

set local role anon;
select throws_ok($$select * from public.list_uninstall_feedback_v2()$$,'42501','permission denied for function list_uninstall_feedback_v2','real anonymous role denied');
reset role;
set local role authenticated;
select throws_ok($$select * from public.list_uninstall_feedback_v2()$$,'42501','permission denied for function list_uninstall_feedback_v2','real website role denied');
reset role;
set local role service_role;
select is((select email from public.list_uninstall_feedback_v2() limit 1),'feedback-updated@example.com','real server role reads the bounded email projection');
reset role;
select * from finish();
rollback;
