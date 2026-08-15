-- Clean pre-release Watch History v2 cutover.
-- V1 tables remain intact and inert so rollback is an application deploy plus
-- restoration of the previous function definition. Test data is not imported.

drop function if exists public.list_recent_people_evidence(uuid);

create function public.list_recent_people_evidence(
  p_viewer_user_id uuid
)
returns table (
  other_user_id uuid,
  last_room_id text,
  last_watched_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    evidence.other_user_id,
    evidence.last_room_id,
    evidence.last_watched_at
  from public.recent_people_evidence as evidence
  where evidence.user_id = p_viewer_user_id
    and not exists (
      select 1
      from public.recent_people_hidden as hidden_person
      where hidden_person.user_id = p_viewer_user_id
        and hidden_person.hidden_user_id = evidence.other_user_id
    )
    and not exists (
      select 1
      from public.friendships as friendship
      where least(friendship.requester_user_id, friendship.addressee_user_id) =
        least(p_viewer_user_id, evidence.other_user_id)
        and greatest(friendship.requester_user_id, friendship.addressee_user_id) =
          greatest(p_viewer_user_id, evidence.other_user_id)
        and friendship.status in ('pending', 'accepted', 'blocked')
    )
  order by evidence.last_watched_at desc, evidence.other_user_id
  limit 50;
$$;

revoke all on function public.list_recent_people_evidence(uuid)
  from public, anon, authenticated;
grant execute on function public.list_recent_people_evidence(uuid)
  to service_role;
