begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
set local statement_timeout='30s';
select no_plan();
insert into users(id,email,display_name) values
 ('fa111111-1111-4111-8111-111111111111','social-owner@example.test','Owner'),
 ('fa222222-2222-4222-8222-222222222222','social-friend@example.test','Friend'),
 ('fa333333-3333-4333-8333-333333333333','social-stranger@example.test','Stranger');
insert into friendships(requester_user_id,addressee_user_id,status) values
 ('fa111111-1111-4111-8111-111111111111','fa222222-2222-4222-8222-222222222222','accepted');
create function pg_temp.save_group(n text, members uuid[] default '{fa222222-2222-4222-8222-222222222222}',creating boolean default true, revision timestamptz default null)
 returns public.friend_groups language sql as $$
 select public.save_friend_group_v1('fa111111-1111-4111-8111-111111111111','fa444444-4444-4444-8444-444444444444',n,members,revision,creating,1);
$$;
select lives_ok($$select pg_temp.save_group('Friday anime')$$,'create saves name and membership together');
select is((select count(*)::int from friend_group_members where group_id='fa444444-4444-4444-8444-444444444444'),1,'member saved');
select lives_ok($$select pg_temp.save_group('Friday anime')$$,'lost create response retry is idempotent at quota');
select throws_ok($$select pg_temp.save_group('Renamed')$$,'P0001','group_request_conflict','create retry cannot overwrite a later state');
select throws_ok($$select pg_temp.save_group('Renamed','{}',false,'2020-01-01')$$,'P0001','group_edit_conflict','stale edit rejected');
select is((select count(*)::int from friend_group_members where group_id='fa444444-4444-4444-8444-444444444444'),1,'conflict preserves members');
select throws_ok($$select pg_temp.save_group('Renamed','{fa333333-3333-4333-8333-333333333333}',false,clock_timestamp())$$,'P0001','group_friend_unavailable','stranger cannot be added');
select is((select name from friend_groups where id='fa444444-4444-4444-8444-444444444444'),'Friday anime','invalid membership cannot partially rename');
select throws_ok($$select save_friend_group_v1('fa222222-2222-4222-8222-222222222222','fa444444-4444-4444-8444-444444444444','Stolen','{}',null,true,2)$$,'P0001','group_not_found','another owner cannot overwrite the group');
select throws_ok($$select save_friend_group_v1('fa111111-1111-4111-8111-111111111111','fa555555-5555-4555-8555-555555555555','Too many','{}',null,true,1)$$,'P0001','group_limit_reached','quota enforced');
select lives_ok($$select pg_temp.save_group('Saturday anime','{}',false,(select updated_at from friend_groups where id='fa444444-4444-4444-8444-444444444444'))$$,'edit name and remove membership together');
select lives_ok($$select pg_temp.save_group('Saturday anime','{}',false,'2020-01-01')$$,'lost update response accepts identical current result');
select is((select count(*)::int from friend_group_members where group_id='fa444444-4444-4444-8444-444444444444'),0,'empty groups supported');
select lives_ok($$select pg_temp.save_group('Saturday anime','{fa222222-2222-4222-8222-222222222222}',false,(select updated_at from friend_groups where id='fa444444-4444-4444-8444-444444444444'))$$,'add member again');
update friendships set status='removed' where requester_user_id='fa111111-1111-4111-8111-111111111111';
select is((select count(*)::int from friend_group_members where group_id='fa444444-4444-4444-8444-444444444444'),0,'removing friendship clears group membership in same transaction');
select throws_ok($$insert into friend_group_members(group_id,friend_user_id) values('fa444444-4444-4444-8444-444444444444','fa222222-2222-4222-8222-222222222222')$$,'P0001','group_friend_unavailable','legacy member endpoint cannot reinsert a removed friend');
update friend_groups set archived_at=clock_timestamp() where id='fa444444-4444-4444-8444-444444444444';
select throws_ok($$select pg_temp.save_group('Saturday anime','{}',false,clock_timestamp())$$,'P0001','group_archived','archived group cannot be edited');
insert into friend_invite_links(sender_user_id,token_hash) values('fa111111-1111-4111-8111-111111111111',repeat('a',64));
select throws_ok($$select accept_friend_link_v1(repeat('a',64),'fa111111-1111-4111-8111-111111111111')$$,'P0001','friend_link_self','cannot accept own link');
select lives_ok($$select accept_friend_link_v1(repeat('a',64),'fa222222-2222-4222-8222-222222222222')$$,'accept reestablishes removed friendship');
select is((select status from friendships where requester_user_id='fa111111-1111-4111-8111-111111111111'),'accepted','friendship accepted');
select lives_ok($$select accept_friend_link_v1(repeat('a',64),'fa222222-2222-4222-8222-222222222222')$$,'same recipient retry succeeds');
select throws_ok($$select accept_friend_link_v1(repeat('a',64),'fa333333-3333-4333-8333-333333333333')$$,'P0001','friend_link_used','other recipient cannot reuse');
update friendships set status='removed' where requester_user_id='fa111111-1111-4111-8111-111111111111';
select throws_ok($$select accept_friend_link_v1(repeat('a',64),'fa222222-2222-4222-8222-222222222222')$$,'P0001','friend_link_used','old link cannot undo unfriend');
insert into friend_invite_links(sender_user_id,token_hash,expires_at) values('fa111111-1111-4111-8111-111111111111',repeat('b',64),now()-interval '1 day');
select throws_ok($$select accept_friend_link_v1(repeat('b',64),'fa222222-2222-4222-8222-222222222222')$$,'P0001','friend_link_expired','expired link fails');
select ok((select accepted_at is null from friend_invite_links where token_hash=repeat('b',64)),'failure does not consume link');
-- Force failure after friendship mutation; the token and relationship both roll back.
insert into friend_invite_links(sender_user_id,token_hash) values('fa111111-1111-4111-8111-111111111111',repeat('c',64));
create function pg_temp.reject_link() returns trigger language plpgsql as $$ begin raise exception 'simulated_write_failure'; end; $$;
create trigger test_reject_link before update on friend_invite_links for each row execute function pg_temp.reject_link();
select throws_ok($$select accept_friend_link_v1(repeat('c',64),'fa333333-3333-4333-8333-333333333333')$$,'P0001','simulated_write_failure','write failure rolls back transaction');
select is((select count(*)::int from friendships where addressee_user_id='fa333333-3333-4333-8333-333333333333'),0,'no friendship left by failed acceptance');
select ok((select accepted_at is null from friend_invite_links where token_hash=repeat('c',64)),'link remains usable after failed acceptance');
drop trigger test_reject_link on friend_invite_links;
select lives_ok($$select accept_friend_link_v1(repeat('c',64),'fa333333-3333-4333-8333-333333333333')$$,'retry after transient write failure succeeds');
select ok(not has_function_privilege('anon','public.accept_friend_link_v1(text,uuid)','EXECUTE'),'anon cannot accept links directly');
select ok(not has_function_privilege('authenticated','public.save_friend_group_v1(uuid,uuid,text,uuid[],timestamptz,boolean,integer)','EXECUTE'),'authenticated cannot spoof group owner through RPC');
select ok(has_function_privilege('service_role','public.save_friend_group_v1(uuid,uuid,text,uuid[],timestamptz,boolean,integer)','EXECUTE'),'server can save groups');
select * from finish();
rollback;
