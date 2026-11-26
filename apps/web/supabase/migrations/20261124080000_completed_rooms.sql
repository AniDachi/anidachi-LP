-- One row per confirmed pair per room, independent of how often they reconnect.
create table public.room_companion_pairs (
  room_id text not null references public.rooms(room_id) on delete cascade,
  first_user_id uuid not null references public.users(id) on delete cascade,
  second_user_id uuid not null references public.users(id) on delete cascade,
  primary key (room_id, first_user_id, second_user_id),
  check (first_user_id < second_user_id)
);
create index room_companions_first on public.room_companion_pairs(first_user_id, room_id);
create index room_companions_second on public.room_companion_pairs(second_user_id, room_id);
alter table public.room_companion_pairs enable row level security;
revoke all on public.room_companion_pairs from public, anon, authenticated;
grant select, insert on public.room_companion_pairs to service_role;

-- Catalog room creation shipped after the legacy watch-checkpoint writer
-- was retired. Only import evidence from this unambiguous cohort.
insert into public.room_companion_pairs(room_id, first_user_id, second_user_id)
select distinct e.last_room_id, least(e.user_id,e.other_user_id), greatest(e.user_id,e.other_user_id)
from public.recent_people_evidence e join public.rooms r on r.room_id=e.last_room_id
where r.lobby_provider is not null and r.presence_room_generation is not null
on conflict do nothing;

create or replace function public.record_recent_room_presence_v1(p_evidence jsonb)
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
 -- Only this validated WS evidence proves concurrent host/guest presence.
 -- Watch-history and HTTP member rows deliberately do not create this milestone.
 if r.host_user_id in (a,b) then
   perform public.enqueue_trial_conversion_v1('trial_first_shared_session',r.host_user_id,t.trial_activation_id::text,observed)
   from public.account_subscription_trials t where t.user_id=r.host_user_id and t.trial_mode='cardless';
 end if;
 -- Keep the room-specific pair even after the same people meet again.
 insert into public.room_companion_pairs(room_id, first_user_id, second_user_id)
 values (r.room_id, a, b) on conflict do nothing;
 insert into public.recent_people_evidence(user_id,other_user_id,last_room_id,last_watched_at)
 values(a,b,r.room_id,observed),(b,a,r.room_id,observed)
 on conflict(user_id,other_user_id) do update
 set last_room_id=excluded.last_room_id,last_watched_at=excluded.last_watched_at
 where excluded.last_watched_at>public.recent_people_evidence.last_watched_at;
 return jsonb_build_object('accepted',true);
end $$;
revoke all on function public.record_recent_room_presence_v1(jsonb) from public,anon,authenticated;
grant execute on function public.record_recent_room_presence_v1(jsonb) to service_role;

create function public.list_completed_rooms_v1(
  p_owner uuid, p_before timestamptz, p_before_id text, p_limit integer
) returns setof jsonb language sql stable security invoker set search_path='' as $$
  with mine as (
    select room_id from public.rooms where host_user_id = p_owner
    union select room_id from public.room_companion_pairs where first_user_id = p_owner
    union select room_id from public.room_companion_pairs where second_user_id = p_owner
  ), page as (
    select r.room_id, r.created_at, r.ended_at, coalesce(r.lobby_provider, r.source_provider) as provider
    from mine join public.rooms r using(room_id)
    where r.status = 'ended' and r.ended_at is not null
      and (p_before is null or (r.ended_at,r.room_id) < (p_before,p_before_id))
    order by r.ended_at desc, r.room_id desc
    limit greatest(1,least(p_limit,25))
  )
  select jsonb_build_object(
    'roomId', page.room_id, 'createdAt', page.created_at, 'endedAt', page.ended_at,
    'provider', page.provider, 'companions', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'name', coalesce(p.display_name,u.display_name),
        'avatar',coalesce(p.avatar_url,u.avatar_url)) order by coalesce(p.display_name,u.display_name), u.id)
      from public.room_companion_pairs pair
      join public.users u on u.id = case when pair.first_user_id=p_owner then pair.second_user_id else pair.first_user_id end
      left join public.profiles p on p.user_id=u.id
      where pair.room_id=page.room_id and p_owner in (pair.first_user_id,pair.second_user_id)
        and not exists (select from public.friendships f where f.status='blocked'
          and least(f.requester_user_id,f.addressee_user_id)=pair.first_user_id
          and greatest(f.requester_user_id,f.addressee_user_id)=pair.second_user_id)
    ),'[]'::jsonb)
  ) from page order by page.ended_at desc,page.room_id desc;
$$;
revoke all on function public.list_completed_rooms_v1(uuid,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function public.list_completed_rooms_v1(uuid,timestamptz,text,integer) to service_role;
