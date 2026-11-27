begin;
set local search_path = public, extensions;
select no_plan();

insert into public.users (id,email,display_name) values
  ('dd000000-0000-4000-8000-000000000001','room-list-host@example.test','Host'),
  ('dd000000-0000-4000-8000-000000000002','room-list-guest@example.test','Guest'),
  ('dd000000-0000-4000-8000-000000000003','room-list-other@example.test','Other');
insert into public.rooms (room_id,host_user_id,status,created_at,ended_at,lobby_provider) values
  ('list-test-a','dd000000-0000-4000-8000-000000000001','ended',now()-interval '2 hours',now(),'youtube'),
  ('list-test-b','dd000000-0000-4000-8000-000000000001','ended',now()-interval '1 hour',now(),'netflix'),
  ('list-test-live','dd000000-0000-4000-8000-000000000001','live',now(),null,'disneyplus');
create function pg_temp.evidence() returns jsonb language sql as $$
  select jsonb_build_object('roomId','list-test-b','roomGeneration',1,'observedAt',floor(extract(epoch from (now()-interval '1 minute'))*1000),
    'participants',jsonb_build_array(
      jsonb_build_object('userId','dd000000-0000-4000-8000-000000000001','sessionId','h'),
      jsonb_build_object('userId','dd000000-0000-4000-8000-000000000002','sessionId','g')));
$$;
select ok(not has_function_privilege('authenticated','public.list_completed_rooms_v1(uuid,timestamptz,text,integer)','execute'),'read requires the authenticated server endpoint');
set local role service_role;
select public.record_recent_room_presence_v1(pg_temp.evidence());
select public.record_recent_room_presence_v1(pg_temp.evidence());
select is((select count(*)::int from public.room_companion_pairs where room_id='list-test-b'),1,'reconnect and retry preserve one pair');
select is((select jsonb_agg(row->>'roomId' order by ord) from public.list_completed_rooms_v1('dd000000-0000-4000-8000-000000000001',null,null,25) with ordinality as rows(row,ord)),
  '["list-test-b","list-test-a"]'::jsonb,'owned completed rooms only, stable tie order');
select is((select row->>'roomId' from public.list_completed_rooms_v1('dd000000-0000-4000-8000-000000000001',now(),'list-test-b',25) as row),'list-test-a','cursor excludes its own row');
select is((select row->>'provider' from public.list_completed_rooms_v1('dd000000-0000-4000-8000-000000000002',null,null,25) row),'netflix','guest sees the shared room');
select is((select row#>>'{companions,0,name}' from public.list_completed_rooms_v1('dd000000-0000-4000-8000-000000000002',null,null,25) row),'Host','guest sees their confirmed companion');
select is((select count(*)::int from public.list_completed_rooms_v1('dd000000-0000-4000-8000-000000000003',null,null,25)),0,'unrelated account cannot read these rooms');
reset role;
insert into public.friendships(requester_user_id,addressee_user_id,status,blocked_by_user_id) values
  ('dd000000-0000-4000-8000-000000000001','dd000000-0000-4000-8000-000000000002','blocked','dd000000-0000-4000-8000-000000000001');
select is((select row->'companions' from public.list_completed_rooms_v1('dd000000-0000-4000-8000-000000000002',null,null,25) row),'[]'::jsonb,'blocking hides companion details');
select * from finish();
rollback;
