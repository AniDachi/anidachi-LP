-- A DO room generation is not rooms.source_generation. The first trusted
-- presence delivery binds it once under the room lock, including late delivery.
alter table public.rooms add column presence_room_generation bigint
  check (presence_room_generation > 0);

create function public.record_recent_room_presence_v1(p_evidence jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 r public.rooms%rowtype;
 a uuid; b uuid; observed timestamptz; generation bigint; person jsonb;
begin
 if jsonb_typeof(p_evidence) is distinct from 'object'
   or (select count(*) from jsonb_object_keys(p_evidence)) <> 4
   or not (p_evidence ?& array['roomId','roomGeneration','observedAt','participants'])
   or jsonb_typeof(p_evidence->'roomId') is distinct from 'string'
   or length(p_evidence->>'roomId') not between 1 and 128
   or jsonb_typeof(p_evidence->'roomGeneration') is distinct from 'number'
   or (p_evidence->>'roomGeneration') !~ '^[1-9][0-9]*$'
   or (p_evidence->>'roomGeneration')::numeric > 9007199254740991
   or jsonb_typeof(p_evidence->'observedAt') is distinct from 'number'
   or (p_evidence->>'observedAt') !~ '^[0-9]+$'
   or (p_evidence->>'observedAt')::numeric > 9007199254740991
   or jsonb_typeof(p_evidence->'participants') is distinct from 'array'
   or jsonb_array_length(p_evidence->'participants') <> 2 then
   raise exception using errcode='22023',message='Invalid room presence evidence';
 end if;
 for person in select value from jsonb_array_elements(p_evidence->'participants') loop
   if jsonb_typeof(person) is distinct from 'object'
     or (select count(*) from jsonb_object_keys(person)) <> 2
     or not(person ?& array['userId','sessionId'])
     or jsonb_typeof(person->'userId') is distinct from 'string'
     or (person->>'userId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or jsonb_typeof(person->'sessionId') is distinct from 'string'
     or length(person->>'sessionId') not between 1 and 128 then
     raise exception using errcode='22023',message='Invalid room presence evidence';
   end if;
 end loop;
 a:=(p_evidence#>>'{participants,0,userId}')::uuid;
 b:=(p_evidence#>>'{participants,1,userId}')::uuid;
 if a>=b then raise exception using errcode='22023',message='Invalid room presence evidence'; end if;
 generation:=(p_evidence->>'roomGeneration')::bigint;
 observed:=pg_catalog.to_timestamp((p_evidence->>'observedAt')::double precision/1000);
 select * into r from public.rooms where room_id=p_evidence->>'roomId' for update;
 if not found or observed<r.created_at or observed>clock_timestamp()+interval '30 seconds'
   or observed<clock_timestamp()-interval '24 hours'
   or (r.status='ended' and (r.ended_at is null or observed>r.ended_at))
   or (r.ended_at is not null and observed>r.ended_at)
   or (r.presence_room_generation is not null and r.presence_room_generation<>generation) then
   raise exception using errcode='22023',message='Invalid room presence authority';
 end if;
 if r.presence_room_generation is null then
   update public.rooms set presence_room_generation=generation where room_id=r.room_id;
 end if;
 -- Lock surviving accounts against concurrent deletion. No membership/session
 -- lookup: those mutable HTTP rows are not the authoritative WS observation.
 perform id from public.users where id in(a,b) order by id for key share;
 if (select count(*) from public.users where id in(a,b))<>2 then
   return jsonb_build_object('accepted',true);
 end if;
 insert into public.recent_people_evidence(user_id,other_user_id,last_room_id,last_watched_at)
 values(a,b,r.room_id,observed),(b,a,r.room_id,observed)
 on conflict(user_id,other_user_id) do update
 set last_room_id=excluded.last_room_id,last_watched_at=excluded.last_watched_at
 where excluded.last_watched_at>public.recent_people_evidence.last_watched_at;
 return jsonb_build_object('accepted',true);
end $$;
revoke all on function public.record_recent_room_presence_v1(jsonb) from public,anon,authenticated;
grant execute on function public.record_recent_room_presence_v1(jsonb) to service_role;
