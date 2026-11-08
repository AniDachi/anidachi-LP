-- Disposable local fixture only; all records roll back.
begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select no_plan();

select ok(not has_function_privilege('anon','public.list_uninstall_feedback_v3(timestamptz,uuid)','EXECUTE'),'anonymous cannot read account names');
select ok(not has_function_privilege('authenticated','public.list_uninstall_feedback_v3(timestamptz,uuid)','EXECUTE'),'website login does not grant CRM access');
select ok(has_function_privilege('service_role','public.list_uninstall_feedback_v3(timestamptz,uuid)','EXECUTE'),'CRM server can read existing names');
select ok(prosecdef and 'search_path=""'=any(proconfig),'reader keeps a fixed search path') from pg_proc where oid='public.list_uninstall_feedback_v3(timestamptz,uuid)'::regprocedure;

insert into public.users(id,email,display_name,discord_id) values
 ('33333333-3333-4333-8333-000000000011','name-first@example.com','  Alex Johnson  ','123456789012345678'),
 ('33333333-3333-4333-8333-000000000012','name-second@example.com','AnimeFox',null);
insert into public.uninstall_feedback(submission_id,actor_hash,user_id,reason,note,created_at)
select ('44444444-4444-4444-8444-'||lpad(n::text,12,'0'))::uuid,repeat('c',64),
  case when n=55 then '33333333-3333-4333-8333-000000000011'::uuid
       when n=54 then '33333333-3333-4333-8333-000000000012'::uuid else null end,
  'other','','2030-01-01T00:00:00.123456Z'::timestamptz
from generate_series(1,55) n;

select is((select count(*)::integer from public.list_uninstall_feedback_v3()),51,'name join preserves page plus lookahead');
select is((select display_name from public.list_uninstall_feedback_v3() limit 1),'Alex Johnson','existing full name is returned without splitting');
select is((select display_name from public.list_uninstall_feedback_v3() offset 1 limit 1),'AnimeFox','existing nickname is returned as the account name');
select is((select display_name from public.list_uninstall_feedback_v3() offset 2 limit 1),null::text,'anonymous response is retained without a name');
select is((select email from public.list_uninstall_feedback_v3() limit 1),'name-first@example.com','email still belongs to the same account');
select is((select discord_id from public.list_uninstall_feedback_v3() limit 1),'123456789012345678','Discord ID is unchanged');
select is((select count(*)::integer from public.list_uninstall_feedback_v3('2030-01-01T00:00:00.123456Z','44444444-4444-4444-8444-000000000006')),5,'tied timestamp pagination remains correct');
select is((select count(*)::integer from public.list_uninstall_feedback_v3('2030-01-01T00:00:00.123455Z','44444444-4444-4444-8444-000000000006')),0,'cursor keeps microsecond precision');
select throws_ok($$select * from public.list_uninstall_feedback_v3(now(),null)$$,'22023','FEEDBACK_CURSOR_INVALID','partial cursor rejected');
select throws_ok($$select * from public.list_uninstall_feedback_v3('infinity','44444444-4444-4444-8444-000000000006')$$,'22023','FEEDBACK_CURSOR_INVALID','infinite cursor rejected');
select is((select array_agg(key order by key)::text from jsonb_object_keys((select to_jsonb(f) from public.list_uninstall_feedback_v3() f limit 1)) key),'{created_at,discord_id,display_name,email,note,reason,submission_id}','only existing display name is added, without internal IDs or new profile fields');
select is((select array_agg(key order by key)::text from jsonb_object_keys((select to_jsonb(f) from public.list_uninstall_feedback_v2() f limit 1)) key),'{created_at,discord_id,email,note,reason,submission_id}','v2 remains compatible for rollback');

update public.users set display_name=repeat('名',201) where id='33333333-3333-4333-8333-000000000011';
select is((select display_name from public.list_uninstall_feedback_v3() limit 1),repeat('名',200),'display length is bounded without breaking Unicode');
update public.users set display_name='Updated name' where id='33333333-3333-4333-8333-000000000011';
select is((select display_name from public.list_uninstall_feedback_v3() limit 1),'Updated name','refresh uses the current account name');
update public.users set display_name='   ' where id='33333333-3333-4333-8333-000000000012';
select is((select display_name from public.list_uninstall_feedback_v3() offset 1 limit 1),null::text,'blank name is unavailable');
delete from public.users where id='33333333-3333-4333-8333-000000000012';
select is((select display_name from public.list_uninstall_feedback_v3() offset 1 limit 1),null::text,'deleted account does not retain a name');
select is((select count(*)::integer from public.list_uninstall_feedback_v3()),51,'account deletion does not remove the response');

set local role anon;
select throws_ok($$select * from public.list_uninstall_feedback_v3()$$,'42501','permission denied for function list_uninstall_feedback_v3','actual anonymous role denied');
reset role;
set local role authenticated;
select throws_ok($$select * from public.list_uninstall_feedback_v3()$$,'42501','permission denied for function list_uninstall_feedback_v3','actual website role denied');
reset role;
set local role service_role;
select is((select display_name from public.list_uninstall_feedback_v3() limit 1),'Updated name','actual server role can read existing name');
reset role;
select * from finish();
rollback;
