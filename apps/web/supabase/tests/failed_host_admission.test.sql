begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into public.users(id,email,display_name) values
 ('862fd891-c05b-46e8-bc2e-8abb2458b2bd','host-admission@example.test','Host admission');
create function pg_temp.make_room(request_id text) returns jsonb language sql as $$
  select jsonb_build_object('outcome',outcome,'id',room_record->>'room_id')
  from public.create_room_with_active_session_v5('862fd891-c05b-46e8-bc2e-8abb2458b2bd','host-tab',
    null,null,null,null,null,null,null,request_id,'free',4,4,false,false,3,1,repeat('3',64),repeat('4',64));
$$;
create temp table attempt as select pg_temp.make_room('first') as result;
select is((select result->>'outcome' from attempt),'claimed','initial create succeeds');
select is((select status from public.rooms,attempt where room_id=result->>'id'),'lobby','pending host starts in lobby');
select ok((select host_connected_at is null from public.rooms,attempt where room_id=result->>'id'),'issue no connection time before JOIN');
select is((select outcome from attempt, lateral public.end_host_lobby_for_active_session_v1(
 '862fd891-c05b-46e8-bc2e-8abb2458b2bd',result->>'id','host-tab',now())),'room_ended','failed host departs immediately');
select is(pg_temp.make_room('second')->>'outcome','claimed','same account immediately creates another room');
update attempt set result=pg_temp.make_room('second');
select ok(not public.confirm_reserved_host_join_v1('862fd891-c05b-46e8-bc2e-8abb2458b2bd',
 (select result->>'id' from attempt),'superseded'),'wrong tab cannot confirm');
update public.rooms set created_at=now()-interval '2 minutes' where room_id=(select result->>'id' from attempt);
select anidachi_room_private.expire_unjoined_host_lobbies();
select is((select status from public.rooms,attempt where room_id=result->>'id'),'lobby','fresh claim keeps its connection window');
update public.active_room_sessions set updated_at=now()-interval '2 minutes' where room_id=(select result->>'id' from attempt);
select anidachi_room_private.expire_unjoined_host_lobbies();
select is((select status from public.rooms,attempt where room_id=result->>'id'),'ended','offline host reservation expires');
select ok(not public.confirm_reserved_host_join_v1('862fd891-c05b-46e8-bc2e-8abb2458b2bd',
 (select result->>'id' from attempt),'host-tab'),'late JOIN cannot revive expired room');
update attempt set result=pg_temp.make_room('third');
select is((select result->>'outcome' from attempt),'claimed','account released after offline expiry');
select ok(public.confirm_reserved_host_join_v1('862fd891-c05b-46e8-bc2e-8abb2458b2bd',
 (select result->>'id' from attempt),'host-tab'),'matching host JOIN succeeds');
update public.rooms set created_at=now()-interval '2 minutes' where room_id=(select result->>'id' from attempt);
update public.active_room_sessions set updated_at=now()-interval '2 minutes' where room_id=(select result->>'id' from attempt);
select anidachi_room_private.expire_unjoined_host_lobbies();
select is((select status from public.rooms,attempt where room_id=result->>'id'),'live','completed host JOIN survives expiry');
select is(pg_temp.make_room('fourth')->>'outcome','conflict','second real room stays forbidden');
select * from finish();
rollback;
