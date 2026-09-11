-- Synthetic records only. This file is guarded by the disposable rehearsal.
begin;
insert into public.users(id,email,display_name,plan)
 select md5('task3-user-'||n)::uuid,'task3-'||n||'@example.invalid','Transition fixture '||n,
 case when n=1 then 'pro' when n in (2,3) then 'plus' else 'free' end from generate_series(1,11) n;
insert into public.user_watch_settings(user_id,history_generation,next_server_order,youtube_history_enabled,updated_at)
 select md5('task3-user-'||n)::uuid,1+n%3,n*7,n%2=0,'2026-08-20T00:00:00Z' from generate_series(1,11) n;
insert into public.rooms(room_id,host_user_id,status,host_plan_code,max_participants,max_media_seats)
 values('task3-shared-room',md5('task3-user-1')::uuid,'ended','pro',4,4),
 ('task3-deleted-room',md5('task3-user-2')::uuid,'ended','plus',4,4);
insert into public.room_members(room_id,user_id) values('task3-shared-room',md5('task3-user-1')::uuid),('task3-shared-room',md5('task3-user-2')::uuid);
insert into public.watch_sessions(id,room_id,host_user_id,provider,item_key,item_kind,item_title,content_id,series_id,episode_key,episode_title,source_url,duration_seconds,current_time_seconds,progress,season_key,season_title,season_number,started_at,last_checkpoint_at,updated_at)
 select md5('task3-session-'||n)::uuid,case when n=1 then 'task3-shared-room' when n=2 then 'task3-deleted-room' else null end,
 md5('task3-user-'||n)::uuid,case n when 3 then 'youtube' when 4 then 'netflix' when 5 then 'amazon' else 'crunchyroll' end,
 case when n<3 then 'reused-legacy-title' else 'raw-title-'||n end,'series','Original legacy '||n,'RAW_CONTENT_'||n,null,'raw-episode-'||n,'Legacy episode '||n,
 case when n=3 then 'https://youtu.be/abcdefghijk?t=42' else 'https://example.invalid/watch/'||n end,
 1200,case n when 1 then 900 when 2 then 42 else 100*n end,0.5,'season:1','Synthetic Season 1',1,
 '2026-08-20T00:00:00Z','2026-08-20T00:20:00Z','2026-08-20T00:20:00Z' from generate_series(1,6) n;
-- One shared session has two distinct observations; one legacy session has none.
insert into public.watch_session_participants(session_id,user_id,role,current_time_seconds,progress)
 select md5('task3-session-'||case when n=2 then 1 else n end)::uuid,md5('task3-user-'||n)::uuid,
 case when n=2 then 'viewer' else 'host' end,n*31,n::float/10 from generate_series(1,6) n;
insert into public.watch_progress_checkpoints(id,session_id,user_id,room_id,kind,current_time_seconds,duration_seconds,progress,observed_at,created_at)
 select md5('task3-checkpoint-'||n)::uuid,md5('task3-session-'||(1+(n-1)%6))::uuid,md5('task3-user-'||(1+(n-1)%6))::uuid,
 case when n%6=1 then 'task3-shared-room' else null end,case when n%3=0 then 'seeked' else 'local' end,
 case when n%3=0 then 10 else n*20 end,1200,n::float/30,
 '2026-08-20T00:00:00Z'::timestamptz+n*interval '1 minute','2026-08-21T00:00:00Z' from generate_series(1,21) n;
insert into public.user_tracked_titles(user_id,provider,title_key,item_kind,item_title,source_url,active,archived_reason,latest_session_id)
 select md5('task3-user-'||n)::uuid,case when n=3 then 'youtube' else 'crunchyroll' end,'raw-title-'||n,'series','Legacy tracked '||n,
 case when n=3 then 'https://www.youtube.com/watch?v=abcdefghijk' else 'https://example.invalid/title/'||n end,n<>2,case when n=2 then 'user_archived' end,md5('task3-session-'||n)::uuid from generate_series(1,3) n;
delete from public.rooms where room_id='task3-deleted-room';
insert into public.billing_customers(user_id,stripe_customer_id) values(md5('task3-user-2')::uuid,'cus_task3_fixture');
insert into public.subscriptions(user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,plan_code,status,current_period_end,cancel_at_period_end)
 values(md5('task3-user-2')::uuid,'cus_task3_fixture','sub_task3_fixture','price_task3_fixture','plus','active','2027-01-01',true),
 (md5('task3-user-3')::uuid,'cus_task3_expired','sub_task3_expired','price_task3_fixture','plus','canceled','2026-08-01',false);
insert into public.friendships(requester_user_id,addressee_user_id,status) values(md5('task3-user-1')::uuid,md5('task3-user-2')::uuid,'accepted');
insert into public.friend_groups(id,owner_user_id,name) values(md5('task3-group')::uuid,md5('task3-user-1')::uuid,'Retained group');
insert into public.friend_group_members(group_id,friend_user_id) values(md5('task3-group')::uuid,md5('task3-user-2')::uuid);
insert into public.usage_daily(user_id,day,host_seconds) values(md5('task3-user-4')::uuid,'2026-08-20',123);
insert into public.room_invites(id,room_id,sender_user_id,target_kind,target_group_id)
 values(md5('task3-invite')::uuid,'task3-shared-room',md5('task3-user-1')::uuid,'group',md5('task3-group')::uuid);
insert into public.room_invite_recipients(invite_id,recipient_user_id)
 values(md5('task3-invite')::uuid,md5('task3-user-2')::uuid);
insert into public.friend_invite_links(sender_user_id,token_hash)
 values(md5('task3-user-1')::uuid,repeat('a',64));
commit;
