-- Durable recent-person evidence and atomic, idempotent friend-group creation.
-- Both functions are called only through server APIs using the service role.

create or replace function public.list_recent_people_evidence(
  p_viewer_user_id uuid
)
returns table (
  user_id uuid,
  last_watched_at timestamptz,
  shared_room_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with viewer_sessions as (
    select
      checkpoint.session_id,
      checkpoint.room_id,
      max(checkpoint.observed_at) as observed_at
    from public.watch_progress_checkpoints as checkpoint
    where checkpoint.user_id = p_viewer_user_id
      and checkpoint.room_id is not null
    group by checkpoint.session_id, checkpoint.room_id
  ),
  shared_rooms as (
    select
      other_checkpoint.user_id,
      viewer_session.room_id,
      max(
        greatest(viewer_session.observed_at, other_checkpoint.observed_at)
      ) as last_watched_at
    from viewer_sessions as viewer_session
    inner join public.watch_progress_checkpoints as other_checkpoint
      on other_checkpoint.session_id = viewer_session.session_id
      and other_checkpoint.room_id = viewer_session.room_id
      and other_checkpoint.user_id <> p_viewer_user_id
    group by other_checkpoint.user_id, viewer_session.room_id
  )
  select
    shared_room.user_id,
    max(shared_room.last_watched_at) as last_watched_at,
    count(*)::integer as shared_room_count
  from shared_rooms as shared_room
  where not exists (
    select 1
    from public.recent_people_hidden as hidden_person
    where hidden_person.user_id = p_viewer_user_id
      and hidden_person.hidden_user_id = shared_room.user_id
  )
    and not exists (
      select 1
      from public.friendships as friendship
      where least(friendship.requester_user_id, friendship.addressee_user_id) =
        least(p_viewer_user_id, shared_room.user_id)
        and greatest(friendship.requester_user_id, friendship.addressee_user_id) =
          greatest(p_viewer_user_id, shared_room.user_id)
        and friendship.status in ('pending', 'accepted', 'blocked')
    )
  group by shared_room.user_id
  order by max(shared_room.last_watched_at) desc
  limit 50;
$$;

revoke all on function public.list_recent_people_evidence(uuid)
  from public, anon, authenticated;
grant execute on function public.list_recent_people_evidence(uuid)
  to service_role;

create or replace function public.create_friend_group_atomic(
  p_group_id uuid,
  p_owner_user_id uuid,
  p_name text,
  p_max_groups integer
)
returns table (
  outcome text,
  group_id uuid,
  group_owner_user_id uuid,
  group_name text,
  group_archived_at timestamptz,
  group_created_at timestamptz,
  group_updated_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  existing_group public.friend_groups%rowtype;
  active_group_count integer;
  archived_at_value timestamptz := clock_timestamp();
begin
  if p_max_groups is null or p_max_groups < 0 then
    raise exception 'friend_group_limit_invalid' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_user_id::text, 0)
  );

  with ranked_groups as (
    select
      friend_group.id,
      row_number() over (
        order by friend_group.updated_at desc, friend_group.created_at desc, friend_group.id
      ) as position
    from public.friend_groups as friend_group
    where friend_group.owner_user_id = p_owner_user_id
      and friend_group.archived_at is null
  )
  update public.friend_groups as friend_group
  set
    archived_at = archived_at_value,
    updated_at = archived_at_value
  where friend_group.id in (
    select ranked_group.id
    from ranked_groups as ranked_group
    where ranked_group.position > p_max_groups
  );

  select friend_group.*
  into existing_group
  from public.friend_groups as friend_group
  where friend_group.id = p_group_id;

  if found then
    if existing_group.owner_user_id <> p_owner_user_id or existing_group.name <> p_name then
      raise exception 'friend_group_request_id_conflict' using errcode = 'P0001';
    end if;
    return query select
      'existing'::text,
      existing_group.id,
      existing_group.owner_user_id,
      existing_group.name,
      existing_group.archived_at,
      existing_group.created_at,
      existing_group.updated_at;
    return;
  end if;

  select count(*)::integer
  into active_group_count
  from public.friend_groups as friend_group
  where friend_group.owner_user_id = p_owner_user_id
    and friend_group.archived_at is null;

  if active_group_count >= p_max_groups then
    return query select
      'limit_reached'::text,
      null::uuid,
      null::uuid,
      null::text,
      null::timestamptz,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  insert into public.friend_groups (id, owner_user_id, name)
  values (p_group_id, p_owner_user_id, p_name)
  returning * into existing_group;

  return query select
    'created'::text,
    existing_group.id,
    existing_group.owner_user_id,
    existing_group.name,
    existing_group.archived_at,
    existing_group.created_at,
    existing_group.updated_at;
end;
$$;

revoke all on function public.create_friend_group_atomic(uuid, uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.create_friend_group_atomic(uuid, uuid, text, integer)
  to service_role;
