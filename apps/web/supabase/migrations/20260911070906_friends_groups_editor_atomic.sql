-- Server-only, additive account operations. Existing room invite snapshots stay intact.
create or replace function public.save_friend_group_v1(
  p_owner_user_id uuid, p_group_id uuid, p_name text, p_member_ids uuid[],
  p_expected_updated_at timestamptz, p_create boolean, p_max_groups integer
) returns public.friend_groups
language plpgsql security invoker set search_path = '' as $$
declare
  g public.friend_groups%rowtype;
  saved_ids uuid[];
  member_id uuid;
  result record;
begin
  if p_owner_user_id is null or p_group_id is null or p_create is null
    or p_name is null or char_length(btrim(p_name)) not between 1 and 80
    or p_member_ids is null or array_position(p_member_ids, null) is not null
    or p_owner_user_id = any(p_member_ids)
    or cardinality(p_member_ids) > 100 then
    raise exception 'group_input_invalid' using errcode='22023';
  end if;
  -- Same quota lock as create_friend_group_atomic. The caller resolves the plan.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner_user_id::text, 0));
  -- Lock accepted relationships before the group. Removal waits and subsequently
  -- cleans membership; a removed friend cannot be inserted by a stale editor.
  for member_id in select distinct unnest(p_member_ids) order by 1 loop
    perform 1 from public.friendships f
      where least(f.requester_user_id, f.addressee_user_id)=least(p_owner_user_id,member_id)
        and greatest(f.requester_user_id, f.addressee_user_id)=greatest(p_owner_user_id,member_id)
        and f.status='accepted' for update;
    if not found then raise exception 'group_friend_unavailable' using errcode='P0001'; end if;
  end loop;
  select * into g from public.friend_groups where id=p_group_id for update;
  if found then
    if g.owner_user_id<>p_owner_user_id then raise exception 'group_not_found' using errcode='P0001'; end if;
    if g.archived_at is not null then raise exception 'group_archived' using errcode='P0001'; end if;
    select coalesce(array_agg(friend_user_id order by friend_user_id),'{}'::uuid[])
      into saved_ids from public.friend_group_members where group_id=p_group_id;
    -- A lost response can be retried without creating a duplicate or overwriting
    -- a later edit. Identical current state is already a successful result.
    if g.name=btrim(p_name) and saved_ids=array(select distinct unnest(p_member_ids) order by 1) then return g; end if;
    if p_create then raise exception 'group_request_conflict' using errcode='P0001'; end if;
    if p_expected_updated_at is null or g.updated_at<>p_expected_updated_at then
      raise exception 'group_edit_conflict' using errcode='P0001';
    end if;
  else
    if not p_create then raise exception 'group_not_found' using errcode='P0001'; end if;
    select * into result from public.create_friend_group_atomic(p_group_id,p_owner_user_id,btrim(p_name),p_max_groups);
    if result.outcome='limit_reached' then raise exception 'group_limit_reached' using errcode='P0001'; end if;
  end if;
  delete from public.friend_group_members where group_id=p_group_id and not(friend_user_id=any(p_member_ids));
  insert into public.friend_group_members(group_id,friend_user_id)
    select p_group_id, unnest(p_member_ids) on conflict do nothing;
  update public.friend_groups set name=btrim(p_name),updated_at=clock_timestamp()
    where id=p_group_id returning * into g;
  return g;
end; $$;
revoke all on function public.save_friend_group_v1(uuid,uuid,text,uuid[],timestamptz,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_friend_group_v1(uuid,uuid,text,uuid[],timestamptz,boolean,integer) to service_role;

-- Also protect the existing single-member API against concurrent unfriend.
create or replace function public.validate_friend_group_member_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid;
begin
  select owner_user_id into owner_id from public.friend_groups where id=new.group_id;
  perform 1 from public.friendships f where f.status='accepted'
    and least(f.requester_user_id,f.addressee_user_id)=least(owner_id,new.friend_user_id)
    and greatest(f.requester_user_id,f.addressee_user_id)=greatest(owner_id,new.friend_user_id) for update;
  if not found then raise exception 'group_friend_unavailable' using errcode='P0001'; end if;
  perform 1 from public.friend_groups where id=new.group_id and archived_at is null for update;
  if not found then raise exception 'group_archived' using errcode='P0001'; end if;
  return new;
end; $$;
revoke all on function public.validate_friend_group_member_v1() from public,anon,authenticated;
grant execute on function public.validate_friend_group_member_v1() to service_role;
create trigger validate_friend_group_member_v1 before insert or update on public.friend_group_members
  for each row execute function public.validate_friend_group_member_v1();

create or replace function public.cleanup_removed_friend_memberships_v1() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='accepted' or old.status is not distinct from new.status then return new; end if;
  -- A group is private to its owner. Remove the pair from either owner's lists,
  -- including archived lists, without changing already-sent invitation recipients.
  with affected as (
    delete from public.friend_group_members m using public.friend_groups g
      where g.id=m.group_id and (
        (g.owner_user_id=new.requester_user_id and m.friend_user_id=new.addressee_user_id) or
        (g.owner_user_id=new.addressee_user_id and m.friend_user_id=new.requester_user_id))
      returning m.group_id
  ) update public.friend_groups set updated_at=clock_timestamp() where id in (select group_id from affected);
  return new;
end; $$;
revoke all on function public.cleanup_removed_friend_memberships_v1() from public,anon,authenticated;
grant execute on function public.cleanup_removed_friend_memberships_v1() to service_role;
create trigger cleanup_removed_friend_memberships_v1 after update of status on public.friendships
  for each row execute function public.cleanup_removed_friend_memberships_v1();

create or replace function public.accept_friend_link_v1(p_token_hash text,p_viewer_user_id uuid)
returns public.friendships language plpgsql security invoker set search_path='' as $$
declare invite public.friend_invite_links%rowtype; friendship public.friendships%rowtype;
begin
  select * into invite from public.friend_invite_links where token_hash=p_token_hash for update;
  if not found or invite.revoked_at is not null then raise exception 'friend_link_not_found' using errcode='P0001'; end if;
  if invite.sender_user_id=p_viewer_user_id then raise exception 'friend_link_self' using errcode='P0001'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    least(invite.sender_user_id,p_viewer_user_id)::text || ':' || greatest(invite.sender_user_id,p_viewer_user_id)::text, 1));
  select * into friendship from public.friendships f
    where least(f.requester_user_id,f.addressee_user_id)=least(invite.sender_user_id,p_viewer_user_id)
      and greatest(f.requester_user_id,f.addressee_user_id)=greatest(invite.sender_user_id,p_viewer_user_id) for update;
  if invite.accepted_at is not null then
    if invite.accepted_by_user_id=p_viewer_user_id and friendship.status='accepted' then return friendship; end if;
    raise exception 'friend_link_used' using errcode='P0001';
  end if;
  if invite.expires_at<=clock_timestamp() then raise exception 'friend_link_expired' using errcode='P0001'; end if;
  if friendship.status='blocked' then raise exception 'friend_link_blocked' using errcode='P0001'; end if;
  if friendship.id is null then
    -- A legacy request can race this insert. Lock and re-check the canonical row.
    insert into public.friendships(requester_user_id,addressee_user_id,status,responded_at)
      values(invite.sender_user_id,p_viewer_user_id,'accepted',clock_timestamp()) on conflict do nothing;
    select * into friendship from public.friendships f
      where least(f.requester_user_id,f.addressee_user_id)=least(invite.sender_user_id,p_viewer_user_id)
        and greatest(f.requester_user_id,f.addressee_user_id)=greatest(invite.sender_user_id,p_viewer_user_id) for update;
  end if;
  if friendship.status='blocked' then raise exception 'friend_link_blocked' using errcode='P0001'; end if;
  if friendship.status<>'accepted' then
    update public.friendships set status='accepted',blocked_by_user_id=null,responded_at=clock_timestamp(),updated_at=clock_timestamp()
      where id=friendship.id returning * into friendship;
  end if;
  update public.friend_invite_links set accepted_at=clock_timestamp(),accepted_by_user_id=p_viewer_user_id where id=invite.id;
  return friendship;
end; $$;
revoke all on function public.accept_friend_link_v1(text,uuid) from public,anon,authenticated;
grant execute on function public.accept_friend_link_v1(text,uuid) to service_role;
