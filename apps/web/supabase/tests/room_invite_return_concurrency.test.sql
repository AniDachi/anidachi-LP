-- Disposable local PostgreSQL only; run via TCP as the local test administrator
-- so dblink can open its synthetic sessions. Committed fixtures are removed below.
create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
begin;
set search_path = public, extensions;
select no_plan();
create function pg_temp.return_waits(app text) returns boolean language plpgsql as $$
declare deadline timestamptz := clock_timestamp()+interval '5 seconds';
begin
  loop
    if exists(select 1 from pg_stat_activity where application_name=app and wait_event_type='Lock') then return true; end if;
    if clock_timestamp()>deadline then return false; end if;
    perform pg_sleep(0.02);
  end loop;
end;
$$;
select dblink_connect('return_a',format('host=%s port=%s dbname=%L user=postgres password=postgres application_name=return_a',inet_server_addr(),inet_server_port(),current_database()));
select dblink_connect('return_b',format('host=%s port=%s dbname=%L user=postgres password=postgres application_name=return_b',inet_server_addr(),inet_server_port(),current_database()));
select dblink_connect('return_probe',format('host=%s port=%s dbname=%L user=postgres password=postgres application_name=return_probe',inet_server_addr(),inet_server_port(),current_database()));
select dblink_exec('return_a',$sql$
 insert into public.users(id,email,display_name) values
 ('a9141000-0000-4000-8000-000000000001','return-concurrent-host@example.test','Host'),
 ('a9141000-0000-4000-8000-000000000002','return-concurrent-guest@example.test','Guest');
 insert into public.friendships(requester_user_id,addressee_user_id,status) values('a9141000-0000-4000-8000-000000000001','a9141000-0000-4000-8000-000000000002','accepted');
 insert into public.rooms(room_id,host_user_id,status) values('invite-return-concurrent','a9141000-0000-4000-8000-000000000001','live');
 insert into public.friend_groups(id,owner_user_id,name) values('a9141000-0000-4000-8000-000000000003','a9141000-0000-4000-8000-000000000001','Concurrent');
 insert into public.friend_group_members(group_id,friend_user_id) values('a9141000-0000-4000-8000-000000000003','a9141000-0000-4000-8000-000000000002');
 insert into public.room_invites(id,room_id,sender_user_id,target_kind) values('a9141000-0000-4000-8000-000000000004','invite-return-concurrent','a9141000-0000-4000-8000-000000000001','direct');
 insert into public.room_invite_recipients(invite_id,recipient_user_id,status,responded_at) values('a9141000-0000-4000-8000-000000000004','a9141000-0000-4000-8000-000000000002','accepted',now());
$sql$);
select dblink_exec('return_a','begin; set role service_role');
create temporary table first_send as select * from dblink('return_a',$sql$
 select * from public.create_room_invite_atomic('a9141000-0000-4000-8000-000000000001','a9141000-0000-4000-8000-000000000101','invite-return-concurrent',array['a9141000-0000-4000-8000-000000000002']::uuid[],null,null)
$sql$) as r(outcome text,invite_id uuid);
select is((select outcome from first_send),'created','first transaction creates replacement while holding sender and room locks');
select dblink_exec('return_b','begin; set role service_role');
select is(dblink_send_query('return_b',$sql$
 select * from public.create_room_invite_atomic('a9141000-0000-4000-8000-000000000001','a9141000-0000-4000-8000-000000000102','invite-return-concurrent',null,'a9141000-0000-4000-8000-000000000003',null)
$sql$),1,'competing group send begins');
select ok(pg_temp.return_waits('return_b'),'competing sender action waits for serialization');
select dblink_exec('return_a','commit');
create temporary table second_send as select * from dblink_get_result('return_b') as r(outcome text,invite_id uuid);
select is((select outcome from second_send),'existing','competing group action cannot create duplicate pending');
select is((select invite_id from second_send),(select invite_id from first_send),'concurrent direct and group share one fresh identity');
select * from dblink_get_result('return_b') as r(outcome text,invite_id uuid);
select dblink_exec('return_b','commit');
select is((select revision from public.account_inbox_push_outbox where user_id='a9141000-0000-4000-8000-000000000002'),1::bigint,'concurrent sends enqueue only one replacement revision');
select is((select r.outcome from dblink('return_a',format('select outcome from public.respond_room_invite_v2(%L,%L,%L,now())','a9141000-0000-4000-8000-000000000002',(select invite_id from first_send),'accept')) as r(outcome text)),'accepted','replacement accepts before lock-order test');
-- Hold only the room. A responding session must not acquire the recipient first.
select dblink_exec('return_a','begin');
select * from dblink('return_a',$$select room_id from public.rooms where room_id='invite-return-concurrent' for update$$) as r(room_id text);
select is(dblink_send_query('return_b',format('select outcome from public.respond_room_invite_v2(%L,%L,%L,now())','a9141000-0000-4000-8000-000000000002',(select invite_id from first_send),'accept')),1,'Return replay starts behind a room lock');
select ok(pg_temp.return_waits('return_b'),'Return replay waits for room');
select dblink_exec('return_probe','begin');
select lives_ok(format($q$select * from extensions.dblink('return_probe',%L) as r(invite_id uuid)$q$,format('select invite_id from public.room_invite_recipients where invite_id=%L for update nowait',(select invite_id from first_send))),'waiting Return holds no recipient lock before acquiring room');
select dblink_exec('return_probe','rollback');
select dblink_exec('return_a','commit');
select is((select outcome from dblink_get_result('return_b') as r(outcome text)),'accepted','Return succeeds after room lock releases');
select * from dblink_get_result('return_b') as r(outcome text);
-- New replacement racing with an old Return response fences that stale reply.
select dblink_exec('return_a','begin; set role service_role');
select * from dblink('return_a',$sql$
 select * from public.create_room_invite_atomic('a9141000-0000-4000-8000-000000000001','a9141000-0000-4000-8000-000000000103','invite-return-concurrent',array['a9141000-0000-4000-8000-000000000002']::uuid[],null,null)
$sql$) as r(outcome text,invite_id uuid);
select is(dblink_send_query('return_b',format('select outcome from public.respond_room_invite_v2(%L,%L,%L,now())','a9141000-0000-4000-8000-000000000002',(select invite_id from first_send),'accept')),1,'old Return races with new invitation');
select ok(pg_temp.return_waits('return_b'),'old Return waits for replacement commit');
select dblink_exec('return_a','commit');
select is((select outcome from dblink_get_result('return_b') as r(outcome text)),'already_resolved','racing old Return sees supersession after room serialization');
select * from dblink_get_result('return_b') as r(outcome text);
select dblink_exec('return_a',$sql$
 reset role;
 delete from public.rooms where room_id='invite-return-concurrent';
 delete from public.users where id in ('a9141000-0000-4000-8000-000000000001','a9141000-0000-4000-8000-000000000002');
$sql$);
select dblink_disconnect('return_a');
select dblink_disconnect('return_b');
select dblink_disconnect('return_probe');
select * from finish();
rollback;
