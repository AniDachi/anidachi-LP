-- Regression: policy locking must work through the actual PostgREST role.
-- All fixtures and expiry changes are rolled back; no existing room is touched.
begin;
set local statement_timeout='20s';
set local lock_timeout='3s';
set local idle_in_transaction_session_timeout='30s';
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(9);
insert into public.users(id,email,display_name) values
 ('a9130000-0000-4000-8000-000000000001','room-policy-free@example.test','Policy Free'),
 ('a9130000-0000-4000-8000-000000000002','room-policy-pro@example.test','Policy Pro');
insert into public.account_manual_plan_grants(user_id,plan_code,valid_until,reason)
 values('a9130000-0000-4000-8000-000000000002','pro',clock_timestamp()+interval '1 hour','Rollback-only room policy regression');
update public.personal_history_policy set active=true where singleton;
create temporary table policy_test_rooms(name text primary key, room_id text, first_renewal jsonb, denial jsonb);
insert into policy_test_rooms(name,room_id)
 select 'free',room_record->>'room_id' from public.create_room_with_active_session_v2('a9130000-0000-4000-8000-000000000001','policy-free-session',null,null,null,null,null,null,null,'policy-free','free',4,4,false,false,2);
insert into policy_test_rooms(name,room_id)
 select 'pro',room_record->>'room_id' from public.create_room_with_active_session_v2('a9130000-0000-4000-8000-000000000002','policy-pro-session',null,null,null,null,null,null,null,'policy-pro','free',4,4,false,false,2);
grant select,update on policy_test_rooms to service_role;

set local role service_role;
select lives_ok($$update policy_test_rooms set first_renewal=public.renew_room_media_lease_v2(room_id) where name='free'$$,'Free renewal succeeds under service_role');
select lives_ok($$update policy_test_rooms set first_renewal=public.renew_room_media_lease_v2(room_id) where name='pro'$$,'Pro renewal succeeds under service_role');
select is((select first_renewal#>>'{capabilities,capabilityRevision}' from policy_test_rooms where name='pro'),'2','renewal increases revision');
select is((select first_renewal#>>'{capabilities,hostPlanCode}' from policy_test_rooms where name='pro'),'pro','Pro authority is retained');
select ok(not has_table_privilege('service_role','public.personal_history_policy','UPDATE'),'runtime still cannot change activation policy');
select ok(not has_function_privilege('authenticated','public.renew_room_media_lease_v2(text)','EXECUTE'),'browser still cannot renew room authority');
reset role;
update public.account_manual_plan_grants set valid_until=clock_timestamp()-interval '1 minute' where user_id='a9130000-0000-4000-8000-000000000002';
set local role service_role;
update policy_test_rooms set denial=public.renew_room_media_lease_v2(room_id) where name='pro';
select is((select denial->>'denied' from policy_test_rooms where name='pro'),'true','real entitlement expiry still denies renewal');
select ok((select (denial->>'closingAt')::timestamptz between clock_timestamp()+interval '4 minutes' and clock_timestamp()+interval '5 minutes 1 second' from policy_test_rooms where name='pro'),'denial retains bounded five-minute grace');
select is((select public.renew_room_media_lease_v2(room_id)->>'closingAt' from policy_test_rooms where name='pro'),(select denial->>'closingAt' from policy_test_rooms where name='pro'),'retry cannot postpone terminal deadline');
do $assert$
declare f jsonb; p jsonb; d jsonb; repeated jsonb;
begin
 select first_renewal into f from policy_test_rooms where name='free';
 select first_renewal,denial into p,d from policy_test_rooms where name='pro';
 if f#>>'{capabilities,hostPlanCode}' is distinct from 'free' or
    p#>>'{capabilities,hostPlanCode}' is distinct from 'pro' or
    p#>>'{capabilities,capabilityRevision}' is distinct from '2' or
    p#>>'{capabilities,maxParticipants}' is distinct from '15' or
    p#>>'{capabilities,maxMicrophones}' is distinct from '8' then
   raise exception 'Runtime-role renewal assertions failed';
 end if;
 if d->>'denied' is distinct from 'true' or not ((d->>'closingAt')::timestamptz between clock_timestamp()+interval '4 minutes' and clock_timestamp()+interval '5 minutes 1 second') then
   raise exception 'Expiry/grace assertions failed';
 end if;
 select public.renew_room_media_lease_v2(room_id) into repeated from policy_test_rooms where name='pro';
 if repeated->>'closingAt' is distinct from d->>'closingAt' or
    has_table_privilege('service_role','public.personal_history_policy','UPDATE') or
    has_function_privilege('authenticated','public.renew_room_media_lease_v2(text)','EXECUTE') then
   raise exception 'Terminal deadline or privilege assertions failed';
 end if;
end $assert$;
reset role;
select * from finish();
rollback;
