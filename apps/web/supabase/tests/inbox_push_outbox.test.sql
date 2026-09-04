create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;
begin;
set search_path = public, extensions;
select no_plan();
select has_table('public', 'account_inbox_push_outbox', 'committed invitations have a durable delivery queue');
insert into public.users (id,email,display_name) values
 ('94100000-0000-4000-8000-000000000001','outbox-host@example.test','Outbox host'),
 ('94100000-0000-4000-8000-000000000002','outbox-recipient@example.test','Outbox recipient'),
 ('94100000-0000-4000-8000-000000000003','outbox-friend@example.test','Outbox friend');
insert into public.rooms(room_id,host_user_id,status) values
 ('outbox-test-room','94100000-0000-4000-8000-000000000001','live');
insert into public.room_invites(id,room_id,sender_user_id,target_kind) values
 ('94200000-0000-4000-8000-000000000001','outbox-test-room','94100000-0000-4000-8000-000000000001','direct');
savepoint invitation_write;
insert into public.room_invite_recipients(invite_id,recipient_user_id) values
 ('94200000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000002');
rollback to invitation_write;
select is((select count(*) from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),0::bigint,'rollback rolls back the outbox too');
insert into public.room_invite_recipients(invite_id,recipient_user_id) values
 ('94200000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000002');
select is((select revision from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),1::bigint,'insert enqueues revision one');
insert into public.room_invite_recipients(invite_id,recipient_user_id) values
 ('94200000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000002') on conflict do nothing;
update public.room_invite_recipients set seen_at=now() where invite_id='94200000-0000-4000-8000-000000000001';
select is((select revision from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),1::bigint,'duplicate and seen update do not enqueue');
insert into public.friendships(id,requester_user_id,addressee_user_id,status) values
 ('94300000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000003','pending');
update public.friendships set addressee_seen_at=now(),requested_at=now() where id='94300000-0000-4000-8000-000000000001';
select is((select revision from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000003'),1::bigint,'friend metadata updates do not create new work');
update public.friendships set status='declined' where id='94300000-0000-4000-8000-000000000001';
update public.friendships set status='pending' where id='94300000-0000-4000-8000-000000000001';
select is((select revision from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000003'),2::bigint,'a renewed friend request enqueues');
set role service_role;
create temporary table claimed as select * from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000002']::uuid[]);
reset role;
select is((select count(*) from claimed),1::bigint,'targeted claim excludes unrelated work');
select is((select attempts from claimed),1,'claim consumes an attempt');
select is((select extract(epoch from (lease_until-last_attempt_at))::integer from claimed),90,'lease lasts ninety seconds');
select is((select count(*) from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000002']::uuid[])),0::bigint,'active lease cannot be claimed twice');
select public.enqueue_account_inbox_push('94100000-0000-4000-8000-000000000002');
select is((select lease_token from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),(select lease_token from claimed),'new invalidation does not steal lease');
select is(public.finish_account_inbox_push_outbox(c.user_id,c.revision,c.lease_token,'complete'),'superseded','older acknowledgement only releases its lease') from claimed c;
select is((select revision from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),2::bigint,'new revision survives acknowledgement');
truncate claimed;
insert into claimed select * from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000002']::uuid[]);
select is(public.finish_account_inbox_push_outbox(c.user_id,c.revision,gen_random_uuid(),'complete'),'stale','wrong lease cannot acknowledge') from claimed c;
select is(public.finish_account_inbox_push_outbox(c.user_id,c.revision,c.lease_token,'retry','http_429',3600),'retry','429 reschedules') from claimed c;
select public.enqueue_account_inbox_push('94100000-0000-4000-8000-000000000002');
select is((select count(*) from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000002']::uuid[])),0::bigint,'new work cannot bypass a 429 cooldown');
select is((select attempts from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),0,'new invalidation resets attempt budget');
update public.account_inbox_push_outbox set next_attempt_at=now(),cooldown_until=null,attempts=7 where user_id='94100000-0000-4000-8000-000000000002';
truncate claimed;
insert into claimed select * from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000002']::uuid[]);
select is(public.finish_account_inbox_push_outbox(c.user_id,c.revision,c.lease_token,'retry','network_error'),'terminal','eighth failure is terminal') from claimed c;
select is((select last_error from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),'network_error','terminal failure metadata is retained');
select public.enqueue_account_inbox_push('94100000-0000-4000-8000-000000000002');
update public.account_inbox_push_outbox set expires_at=now()-interval '1 second' where user_id='94100000-0000-4000-8000-000000000002';
select is((select count(*) from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000002']::uuid[])),0::bigint,'expired work is never sent');
select ok((select terminal_at is not null from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),'expired work retains terminal state');
select ok((select relrowsecurity from pg_class where oid='public.account_inbox_push_outbox'::regclass),'outbox has RLS');
select ok(not has_table_privilege('anon','public.account_inbox_push_outbox','select') and not has_table_privilege('authenticated','public.account_inbox_push_outbox','insert'),'clients have no table privileges');
select ok(bool_and(not p.prosecdef and p.proconfig @> array['search_path=""']::text[] and not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute')),'all outbox functions are service-only security invokers') from pg_proc p where p.proname in ('enqueue_account_inbox_push','enqueue_room_invite_inbox_push','enqueue_friend_request_inbox_push','claim_account_inbox_push_outbox','finish_account_inbox_push_outbox');
set role anon;
select throws_ok('select * from public.claim_account_inbox_push_outbox()', '42501', null, 'anonymous claim denied');
reset role;
set role authenticated;
select throws_ok('select * from public.claim_account_inbox_push_outbox()', '42501', null, 'authenticated claim denied');
reset role;
-- A late 429 on the old lease still gates the newer coalesced revision.
select public.enqueue_account_inbox_push('94100000-0000-4000-8000-000000000002');
truncate claimed;
insert into claimed select * from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000002']::uuid[]);
select public.enqueue_account_inbox_push('94100000-0000-4000-8000-000000000002');
select is(public.finish_account_inbox_push_outbox(c.user_id,c.revision,c.lease_token,'retry','http_429',600),'superseded','late 429 preserves newer revision') from claimed c;
select is((select count(*) from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000002']::uuid[])),0::bigint,'late 429 blocks new revision until cooldown');
select is((select attempts from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),0,'late 429 does not charge the new revision');
select ok((select cooldown_until>=clock_timestamp()+interval '590 seconds' from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),'late 429 retains provider deadline');
update public.account_inbox_push_outbox set next_attempt_at=now(),cooldown_until=null where user_id='94100000-0000-4000-8000-000000000002';
truncate claimed;
insert into claimed select * from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000002']::uuid[]);
select is(public.finish_account_inbox_push_outbox(c.user_id,c.revision,c.lease_token,'complete'),'completed','successful current revision retires') from claimed c;
select is((select count(*) from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000002'),0::bigint,'completed job is removed');
-- Two real sessions: one holds row locks; the other must skip rather than wait.
select extensions.dblink_connect('outbox_a','host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres');
select extensions.dblink_connect('outbox_b','host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres');
select extensions.dblink_exec('outbox_a',$sql$
  insert into public.users(id,email,display_name) values('94900000-0000-4000-8000-000000000001','outbox-concurrent@example.test','Outbox concurrent');
  insert into public.account_inbox_push_outbox(user_id) values('94900000-0000-4000-8000-000000000001');
  begin; set role service_role;
$sql$);
select is((select n from extensions.dblink('outbox_a',$sql$select count(*) from public.claim_account_inbox_push_outbox(8,array['94900000-0000-4000-8000-000000000001']::uuid[])$sql$) as t(n bigint)),1::bigint,'first concurrent session owns one revision');
select extensions.dblink_exec('outbox_b','set role service_role');
select is((select n from extensions.dblink('outbox_b',$sql$select count(*) from public.claim_account_inbox_push_outbox(8,array['94900000-0000-4000-8000-000000000001']::uuid[])$sql$) as t(n bigint)),0::bigint,'concurrent claim skips locked revision');
select extensions.dblink_exec('outbox_a','commit');
select is((select n from extensions.dblink('outbox_b',$sql$select count(*) from public.claim_account_inbox_push_outbox(8,array['94900000-0000-4000-8000-000000000001']::uuid[])$sql$) as t(n bigint)),0::bigint,'committed active lease is still exclusive');
select extensions.dblink_exec('outbox_a',$sql$reset role; delete from public.users where id='94900000-0000-4000-8000-000000000001';$sql$);
select extensions.dblink_disconnect('outbox_a');
select extensions.dblink_disconnect('outbox_b');
update public.friendships set status='accepted' where id='94300000-0000-4000-8000-000000000001';
select is((select outcome from public.create_room_invite_atomic('94100000-0000-4000-8000-000000000001','94400000-0000-4000-8000-000000000001','outbox-test-room',array['94100000-0000-4000-8000-000000000003']::uuid[],null,null)),'created','unchanged invite RPC creates a new recipient');
select is((select revision from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000003'),3::bigint,'atomic invite RPC adds one revision');
select is((select outcome from public.create_room_invite_atomic('94100000-0000-4000-8000-000000000001','94400000-0000-4000-8000-000000000001','outbox-test-room',array['94100000-0000-4000-8000-000000000003']::uuid[],null,null)),'existing','action replay is unchanged');
select is((select outcome from public.create_room_invite_atomic('94100000-0000-4000-8000-000000000001','94400000-0000-4000-8000-000000000002','outbox-test-room',array['94100000-0000-4000-8000-000000000003']::uuid[],null,null)),'existing','semantic duplicate is unchanged');
select is((select revision from public.account_inbox_push_outbox where user_id='94100000-0000-4000-8000-000000000003'),3::bigint,'both duplicate paths leave the outbox revision alone');
truncate claimed;
insert into claimed select * from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000003']::uuid[]);
update public.account_inbox_push_outbox set lease_until=now()-interval '1 second' where user_id='94100000-0000-4000-8000-000000000003';
create temporary table replacement as select * from public.claim_account_inbox_push_outbox(8,array['94100000-0000-4000-8000-000000000003']::uuid[]);
select is(public.finish_account_inbox_push_outbox(c.user_id,c.revision,c.lease_token,'complete'),'stale','expired token cannot complete the replacement lease') from claimed c;
select is(public.finish_account_inbox_push_outbox(c.user_id,c.revision,c.lease_token,'retry','http_429',86400),'terminal','Retry-After beyond remaining lifetime is terminal, never sent early') from replacement c;
insert into public.users(id,email,display_name)
 select ('94500000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'outbox-cap-'||i||'@example.test','Outbox cap' from generate_series(1,9) i;
insert into public.account_inbox_push_outbox(user_id)
 select ('94500000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(1,9) i;
select is((select count(*) from public.claim_account_inbox_push_outbox(8,(select array_agg(('94500000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid) from generate_series(1,9) i))),8::bigint,'claim caps concurrent accounts at eight');
select is((select count(*) from public.claim_account_inbox_push_outbox(8,(select array_agg(('94500000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid) from generate_series(1,9) i))),1::bigint,'ninth account remains claimable by the next batch');
select throws_ok('select * from public.claim_account_inbox_push_outbox(9)','22023',null,'service callers cannot exceed batch cap');
update public.account_inbox_push_outbox set lease_token=null,lease_revision=null,lease_until=null,
  next_attempt_at=now()-interval '1 minute',expires_at=now()-interval '1 second'
  where user_id between '94500000-0000-4000-8000-000000000001' and '94500000-0000-4000-8000-000000000008';
update public.account_inbox_push_outbox set lease_token=null,lease_revision=null,lease_until=null
  where user_id='94500000-0000-4000-8000-000000000009';
select is((select count(*) from public.claim_account_inbox_push_outbox(8,(select array_agg(('94500000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid) from generate_series(1,9) i))),1::bigint,'eight expired jobs cannot starve a healthy due recipient');
select is((select count(*) from public.account_inbox_push_outbox where terminal_at is not null and user_id between '94500000-0000-4000-8000-000000000001' and '94500000-0000-4000-8000-000000000008'),8::bigint,'maintenance retires a bounded eight expired jobs');
select * from finish();
rollback;
