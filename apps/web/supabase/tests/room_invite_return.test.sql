-- Run against a disposable local database. All fixture writes roll back.
create extension if not exists pgtap with schema extensions;
begin;
set search_path = public, extensions;
select no_plan();
create function pg_temp.uid(n integer) returns uuid language sql immutable as $$
 select ('a9140000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid
$$;
insert into public.users(id,email,display_name)
select pg_temp.uid(n), 'return-'||n||'@example.test', 'Return '||n from generate_series(1,8) n;
insert into public.friendships(requester_user_id,addressee_user_id,status)
select pg_temp.uid(1),pg_temp.uid(n),'accepted' from generate_series(2,7) n;
insert into public.rooms(room_id,host_user_id,status,title,source_url)
values ('invite-return-test',pg_temp.uid(1),'live','Original title','https://example.test/original');
insert into public.friend_groups(id,owner_user_id,name) values(pg_temp.uid(100),pg_temp.uid(1),'Return group');
insert into public.friend_group_members(group_id,friend_user_id)
select pg_temp.uid(100),pg_temp.uid(n) from generate_series(2,5) n;
create function pg_temp.send(action integer, recipients integer[] default array[2], group_target boolean default false)
returns table(outcome text,invite_id uuid) language sql volatile as $$
 select * from public.create_room_invite_atomic(pg_temp.uid(1),pg_temp.uid(action),'invite-return-test',
 case when group_target then null else array(select pg_temp.uid(n) from unnest(recipients) n) end,
 case when group_target then pg_temp.uid(100) else null end,null)
$$;
create temporary table results(label text primary key, invite_id uuid);
insert into results select 'original',invite_id from pg_temp.send(201);
select is((select outcome from pg_temp.send(201)), 'existing', 'same action replay is existing');
select is((select outcome from pg_temp.send(202)), 'existing', 'new direct action deduplicates pending');
select is((select outcome from public.respond_room_invite_v2(pg_temp.uid(2),(select invite_id from results where label='original'),'accept',now())), 'accepted', 'initial accept');
insert into public.active_room_sessions(user_id,room_id,role,participant_session_id)
values(pg_temp.uid(2),'invite-return-test','member','session-one');
select is((select outcome from pg_temp.send(203)), 'existing', 'accepted active assignment is occupied');
select is((select outcome from public.release_active_room_session_v1(pg_temp.uid(2),'invite-return-test','stale-session')), 'stale', 'stale departure cannot clear assignment');
select is((select outcome from pg_temp.send(204)), 'existing', 'stale departure still blocks resend');
select is((select outcome from public.release_active_room_session_v1(pg_temp.uid(2),'invite-return-test','session-one')), 'released', 'fenced departure releases assignment');
select is((select outcome from pg_temp.send(201)), 'existing', 'original replay after departure cannot send');
create temporary table revision as select revision from public.account_inbox_push_outbox where user_id=pg_temp.uid(2);
insert into results select 'replacement',invite_id from pg_temp.send(205);
select isnt((select invite_id from results where label='replacement'),(select invite_id from results where label='original'),'departure creates fresh invitation identity');
select is((select count(*)::integer from public.room_invite_recipients where recipient_user_id=pg_temp.uid(2)),2,'fresh pending recipient preserves accepted history');
select is((select revision from public.account_inbox_push_outbox where user_id=pg_temp.uid(2)),(select revision+1 from revision),'one replacement INSERT produces exactly one outbox revision');
select is((select outcome from pg_temp.send(205)), 'existing', 'replacement action replay is existing');
select is((select revision from public.account_inbox_push_outbox where user_id=pg_temp.uid(2)),(select revision+1 from revision),'replay sends no second push');
select is((select outcome from public.respond_room_invite_v2(pg_temp.uid(2),(select invite_id from results where label='original'),'accept',now())),'already_resolved','old accepted response cannot resolve replacement');
select has_column('public','room_invite_recipients','superseded_at','additive supersession column exists');
select has_function('public','get_account_inbox_page_v3',array['uuid','timestamp with time zone','timestamp with time zone','text','integer'],'v3 return projection exists');
select ok((select superseded_at is not null and status='accepted' and responded_at is not null from public.room_invite_recipients where invite_id=(select invite_id from results where label='original')),'supersession preserves first accepted history');
select is((select invite_id from pg_temp.send(201)),(select invite_id from results where label='original'),'old action continues returning original identity after supersession');
select is(public.get_account_inbox_page_v3(pg_temp.uid(2),now())->'entries'->0->>'item_state','active','pending replacement wins over old Return');
select is(jsonb_array_length(public.get_account_inbox_page_v3(pg_temp.uid(2),now())->'entries'),1,'replacement appears once');
select is(public.get_account_inbox_page_v2(pg_temp.uid(2),now())->'entries'->0->>'item_state','active','v2 pending response remains compatible');
select is((select outcome from public.respond_room_invite_v2(pg_temp.uid(2),(select invite_id from results where label='replacement'),'accept',now())),'accepted','replacement can be accepted');
update public.rooms set title='Current title',source_url='https://example.test/current',video_fingerprint='current-fingerprint' where room_id='invite-return-test';
create temporary table return_page as select public.get_account_inbox_page_v3(pg_temp.uid(2),now()) as page;
select is((select page->'entries'->0->>'item_state' from return_page),'returnable','accepted invitation remains Return');
select is((select page->'entries'->0->>'room_title' from return_page),'Current title','Return uses current durable room title');
select is((select page->'entries'->0->>'source_url' from return_page),'https://example.test/current','Return uses current source URL');
select is((select page->'entries'->0->>'video_fingerprint' from return_page),'current-fingerprint','Return uses current fingerprint');
select ok((select page->'entries'->0->>'seen_at' is not null from return_page),'Return coerces seen timestamp without requiring mark-seen');
select is((select page->'counts' from return_page),'{"unseen_count":0,"actionable_count":0,"active_room_invite_count":0,"pending_friend_request_count":0}'::jsonb,'Return contributes no unseen or actionable counts');
select is(jsonb_array_length(public.get_account_inbox_page_v2(pg_temp.uid(2),now())->'entries'),0,'old v2 omits accepted Return');
select is(jsonb_array_length(public.get_account_inbox_page_v3(pg_temp.uid(8),now())->'entries'),0,'unrelated account cannot see Return');
select is((select outcome from public.respond_room_invite_v2(pg_temp.uid(8),(select invite_id from results where label='replacement'),'accept',now())),'not_found','foreign account cannot respond');
update public.friendships set status='removed' where addressee_user_id=pg_temp.uid(2);
create temporary table before_denial as select to_jsonb(r) as row from public.room_invite_recipients r where recipient_user_id=pg_temp.uid(2) and superseded_at is null;
select is((select outcome||':'||recipient_status from public.respond_room_invite_v2(pg_temp.uid(2),(select invite_id from results where label='replacement'),'accept',now())),'friendship_required:accepted','accepted replay rechecks friendship');
select is((select to_jsonb(r) from public.room_invite_recipients r where recipient_user_id=pg_temp.uid(2) and superseded_at is null),(select row from before_denial),'failed Return authorization changes no recipient fields');
select is(jsonb_array_length(public.get_account_inbox_page_v3(pg_temp.uid(2),now())->'entries'),0,'removed friendship hides Return');
update public.friendships set status='accepted' where addressee_user_id=pg_temp.uid(2);
insert into public.friend_group_members(group_id,friend_user_id) values(pg_temp.uid(100),pg_temp.uid(2));
-- Mixed group: accepted departed user 2, assigned user 3 with no old invitation,
-- declined user 4, and newly eligible user 5.
insert into public.active_room_sessions(user_id,room_id,role,participant_session_id)
values(pg_temp.uid(3),'invite-return-test','member','admission-in-progress');
select throws_like($$select * from pg_temp.send(206,array[3])$$,'%room_invite_already_in_room%','all assigned with no old invitation raises explicit outcome');
select is((select count(*)::integer from public.room_invite_actions where client_action_id=pg_temp.uid(206)),0,'already-in-room failure creates no action or fake invitation');
insert into results select 'declined',invite_id from pg_temp.send(207,array[4]);
select is((select outcome from public.respond_room_invite_v2(pg_temp.uid(4),(select invite_id from results where label='declined'),'decline',now())),'declined','decline is durable');
insert into results select 'group',invite_id from pg_temp.send(208,null,true);
select results_eq($$select recipient_user_id from public.room_invite_recipients where invite_id=(select invite_id from results where label='group') order by recipient_user_id$$,$$select pg_temp.uid(n) from unnest(array[2,5]) n$$,'mixed group creates only departed accepted and new eligible recipients');
select is((select outcome from pg_temp.send(209,null,true)),'existing','duplicate group deduplicates pending and declined');
select is((select outcome from pg_temp.send(210,array[2,5])),'existing','direct after group deduplicates same current pending rows');
select is((select count(*)::integer from public.room_invite_recipients where recipient_user_id=pg_temp.uid(3)),0,'assigned account has no fabricated invite');
select is((select count(*)::integer from public.room_invite_recipients where recipient_user_id=pg_temp.uid(4)),1,'declined account cannot be reinvited');
select is((select count(*)::integer from public.watch_history_group_invitation_contexts where client_action_id=pg_temp.uid(208)),2,'existing group history capture still records eligible pending contexts');
select is((select outcome from public.respond_room_invite_v2(pg_temp.uid(2),(select invite_id from results where label='replacement'),'accept',now())),'already_resolved','superseded Return cannot accept newer group invitation');
select is((select outcome from public.respond_room_invite_v2(pg_temp.uid(2),(select invite_id from results where label='group'),'accept',now())),'accepted','current group invitation accepts normally');
select ok((select accepted_at is not null from public.watch_history_group_invitation_contexts where client_action_id=pg_temp.uid(208) and recipient_user_id=pg_temp.uid(2)),'acceptance trigger preserves group history evidence');
-- Legacy unresolved state blocks resending; authorization failure does not repair it.
insert into results select 'legacy',invite_id from pg_temp.send(211,array[6]);
update public.room_invite_recipients set status='expired',responded_at=null where recipient_user_id=pg_temp.uid(6);
select is((select outcome from pg_temp.send(212,array[6])),'existing','legacy unresolved recipient cannot be reinvited');
update public.friendships set status='removed' where addressee_user_id=pg_temp.uid(6);
select is((select outcome||':'||recipient_status from public.respond_room_invite_v2(pg_temp.uid(6),(select invite_id from results where label='legacy'),'accept',now())),'friendship_required:expired','failed legacy authorization does not normalize recipient');
select is((select status from public.room_invite_recipients where recipient_user_id=pg_temp.uid(6)),'expired','legacy state unchanged on failed authorization');
-- Historical duplicate accepted rows are represented once, with pending precedence.
insert into public.room_invites(id,room_id,sender_user_id,target_kind) values(pg_temp.uid(300),'invite-return-test',pg_temp.uid(1),'direct');
insert into public.room_invite_recipients(invite_id,recipient_user_id,status,responded_at) values(pg_temp.uid(300),pg_temp.uid(2),'accepted',now());
select is(jsonb_array_length(public.get_account_inbox_page_v3(pg_temp.uid(2),now())->'entries'),1,'historical current accepted duplicates deduplicate per room');
update public.room_invite_recipients set status='pending',responded_at=null where invite_id=pg_temp.uid(300);
select is(public.get_account_inbox_page_v3(pg_temp.uid(2),now())->'entries'->0->>'item_state','active','historical pending takes precedence over accepted');
update public.room_invite_recipients set status='accepted',responded_at=now() where invite_id=pg_temp.uid(300);
-- Add one pending friendship so pagination traverses heterogeneous entries.
insert into public.friendships(requester_user_id,addressee_user_id,status,requested_at) values(pg_temp.uid(8),pg_temp.uid(2),'pending',now()+interval '1 minute');
create temporary table first_page as select public.get_account_inbox_page_v3(pg_temp.uid(2),now(),null,null,1) as page;
select is((select page->'entries'->0->>'item_kind' from first_page),'friend-request','pagination first page retains friend request ordering');
select is((select page->'counts'->>'unseen_count' from first_page),'1','counts span entire coherent candidate set, excluding Return');
select is((select page->'counts'->>'actionable_count' from first_page),'1','only friend request is actionable across pages');
select is((select public.get_account_inbox_page_v3(pg_temp.uid(2),now(),(page->'entries'->0->>'activity_at')::timestamptz,'friend-request:'||(page->'entries'->0->>'item_id'),1)->'entries'->0->>'item_state' from first_page),'returnable','cursor page includes remaining Return without duplication');
set role service_role;
select is((select outcome from pg_temp.send(213,array[7])),'created','service role creates fresh invitation using table grants');
select is((select outcome from public.respond_room_invite_v2(pg_temp.uid(7),(select invite_id from public.room_invite_actions where client_action_id=pg_temp.uid(213)),'accept',now())),'accepted','service role accepts using existing table and history trigger grants');
select is((select outcome from pg_temp.send(214,array[7])),'created','service role can supersede accepted history and insert replacement');
reset role;
update public.rooms set status='ended',ended_at=now() where room_id='invite-return-test';
select is((select outcome||':'||recipient_status from public.respond_room_invite_v2(pg_temp.uid(2),(select invite_id from results where label='group'),'accept',now())),'room_ended:accepted','ended room denies Return without erasing accepted history');
select is(jsonb_array_length(public.get_account_inbox_page_v3(pg_temp.uid(2),now())->'entries'),1,'ended Return disappears while friend request stays');
select is(public.get_account_inbox_page_v3(pg_temp.uid(5),now())->'entries'->0->>'item_state','missed','pending room end retains missed projection');
select is(public.get_account_inbox_page_v3(pg_temp.uid(5),now())->'counts'->>'unseen_count','1','missed invite retains unseen count');
select is(jsonb_array_length(public.get_account_inbox_page_v3(pg_temp.uid(5),now()+interval '24 hours 1 second')->'entries'),0,'missed invite leaves projection after 24 hours');
select ok((select bool_and(not p.prosecdef and p.provolatile='v' and p.proconfig @> array['search_path=""']) from pg_proc p where oid in ('public.create_room_invite_atomic(uuid,uuid,text,uuid[],uuid,text)'::regprocedure,'public.respond_room_invite_v2(uuid,uuid,text,timestamptz)'::regprocedure,'public.get_account_inbox_page_v3(uuid,timestamptz,timestamptz,text,integer)'::regprocedure)),'all changed RPCs are volatile security invoker with empty search_path');
select ok((select bool_and(has_function_privilege('service_role',f,'execute') and not has_function_privilege('anon',f,'execute') and not has_function_privilege('authenticated',f,'execute') and not has_function_privilege('public',f,'execute')) from unnest(array['public.create_room_invite_atomic(uuid,uuid,text,uuid[],uuid,text)','public.respond_room_invite_v2(uuid,uuid,text,timestamptz)','public.get_account_inbox_page_v3(uuid,timestamptz,timestamptz,text,integer)']) f),'only service_role can execute changed invitation RPCs');
set role service_role;
select lives_ok($$select public.get_account_inbox_page_v3('a9140000-0000-4000-8000-000000000002',now())$$,'service role executes v3 through existing table grants');
reset role;

select * from finish();
rollback;
