-- Room-invite lifecycle authority. Legacy expires_at remains stored and old
-- RPCs remain callable for rollback, but v2 product actionability follows the
-- room lifecycle, recipient state, and current sender/recipient friendship.

-- Preserve the first missed time by default while allowing lifecycle authority
-- to replace a legacy expires_at-derived value with the actual room end.
create or replace function public.prepare_room_invite_recipient_inbox_state()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if new.status = 'expired' then
    if tg_op = 'INSERT' then
      new.missed_at := coalesce(new.missed_at, new.updated_at, now());
    elsif old.status is distinct from 'expired' then
      new.missed_at := coalesce(new.missed_at, new.updated_at, now());
    else
      new.missed_at := coalesce(new.missed_at, old.missed_at, new.updated_at, now());
    end if;
  else
    new.missed_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.reconcile_account_inbox_v2(
  p_user_id uuid,
  p_now timestamptz
)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_updated_count integer := 0;
begin
  if p_user_id is null or p_now is null then
    raise exception 'account_inbox_input_invalid' using errcode = '22023';
  end if;

  update public.room_invite_recipients as recipient
  set
    status = case
      when recipient.status = 'expired' and recipient.responded_at is not null
        then 'declined'
      when room.status = 'ended' then 'expired'
      else 'pending'
    end,
    missed_at = case
      when recipient.status = 'expired' and recipient.responded_at is not null
        then null
      when room.status = 'ended'
        then coalesce(room.ended_at, recipient.missed_at, p_now)
      else null
    end,
    updated_at = p_now
  from public.room_invites as invite
  inner join public.rooms as room on room.room_id = invite.room_id
  where recipient.invite_id = invite.id
    and recipient.recipient_user_id = p_user_id
    and (
      (recipient.status = 'pending' and room.status = 'ended')
      or (
        recipient.status = 'expired'
        and recipient.responded_at is not null
      )
      or (
        recipient.status = 'expired'
        and recipient.responded_at is null
        and room.status <> 'ended'
      )
      or (
        recipient.status = 'expired'
        and recipient.responded_at is null
        and room.status = 'ended'
        and recipient.missed_at is distinct from coalesce(
          room.ended_at,
          recipient.missed_at,
          p_now
        )
      )
    );

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

create or replace function public.get_account_inbox_page_v2(
  p_user_id uuid,
  p_now timestamptz,
  p_cursor_activity_at timestamptz default null,
  p_cursor_key text default null,
  p_limit integer default 51
)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  with reconciled as (
    update public.room_invite_recipients as recipient
    set
      status = case
        when recipient.status = 'expired' and recipient.responded_at is not null
          then 'declined'
        when room.status = 'ended' then 'expired'
        else 'pending'
      end,
      missed_at = case
        when recipient.status = 'expired' and recipient.responded_at is not null
          then null
        when room.status = 'ended'
          then coalesce(room.ended_at, recipient.missed_at, p_now)
        else null
      end,
      updated_at = p_now
    from public.room_invites as invite
    inner join public.rooms as room on room.room_id = invite.room_id
    where recipient.invite_id = invite.id
      and recipient.recipient_user_id = p_user_id
      and (
        (recipient.status = 'pending' and room.status = 'ended')
        or (
          recipient.status = 'expired'
          and recipient.responded_at is not null
        )
        or (
          recipient.status = 'expired'
          and recipient.responded_at is null
          and room.status <> 'ended'
        )
        or (
          recipient.status = 'expired'
          and recipient.responded_at is null
          and room.status = 'ended'
          and recipient.missed_at is distinct from coalesce(
            room.ended_at,
            recipient.missed_at,
            p_now
          )
        )
      )
    returning recipient.invite_id
  ),
  room_invite_candidates as (
    select
      invite.id as item_id,
      case
        when room.status = 'ended' then 'missed'::text
        else 'active'::text
      end as item_state,
      case
        when room.status = 'ended'
          then coalesce(room.ended_at, recipient.missed_at, p_now)
        else recipient.created_at
      end as activity_at,
      invite.created_at,
      recipient.seen_at,
      case
        when room.status = 'ended'
          then coalesce(room.ended_at, recipient.missed_at, p_now)
        else null
      end as missed_at,
      invite.sender_user_id,
      profile.handle as sender_handle,
      coalesce(profile.display_name, sender.display_name, 'AniDachi user')
        as sender_display_name,
      coalesce(profile.avatar_url, sender.avatar_url) as sender_avatar_url,
      invite.room_id,
      invite.target_kind,
      invite.target_group_id,
      friend_group.name as target_group_name,
      invite.message,
      invite.room_title,
      invite.source_url,
      invite.video_fingerprint
    from public.room_invite_recipients as recipient
    inner join public.room_invites as invite on invite.id = recipient.invite_id
    inner join public.rooms as room on room.room_id = invite.room_id
    inner join public.users as sender on sender.id = invite.sender_user_id
    left join public.profiles as profile on profile.user_id = invite.sender_user_id
    left join public.friend_groups as friend_group
      on friend_group.id = invite.target_group_id
    where p_user_id is not null
      and p_now is not null
      and recipient.recipient_user_id = p_user_id
      and (
        recipient.status = 'pending'
        or (
          recipient.status = 'expired'
          and recipient.responded_at is null
        )
      )
  ),
  candidates as (
    select
      'room-invite'::text as item_kind,
      room_invite.item_id,
      room_invite.item_state,
      room_invite.activity_at,
      'room-invite:' || room_invite.item_id::text as stable_key,
      room_invite.created_at,
      room_invite.seen_at,
      room_invite.missed_at,
      room_invite.sender_user_id,
      room_invite.sender_handle,
      room_invite.sender_display_name,
      room_invite.sender_avatar_url,
      room_invite.room_id,
      room_invite.target_kind,
      room_invite.target_group_id,
      room_invite.target_group_name,
      room_invite.message,
      room_invite.room_title,
      room_invite.source_url,
      room_invite.video_fingerprint
    from room_invite_candidates as room_invite
    where (
        room_invite.item_state = 'active'
        or room_invite.missed_at >= p_now - interval '24 hours'
      )
      and exists (
        select 1
        from public.friendships as friendship
        where friendship.status = 'accepted'
          and (
            (
              friendship.requester_user_id = room_invite.sender_user_id
              and friendship.addressee_user_id = p_user_id
            )
            or (
              friendship.requester_user_id = p_user_id
              and friendship.addressee_user_id = room_invite.sender_user_id
            )
          )
      )

    union all

    select
      'friend-request'::text as item_kind,
      friendship.id as item_id,
      'pending'::text as item_state,
      friendship.requested_at as activity_at,
      'friend-request:' || friendship.id::text as stable_key,
      friendship.requested_at as created_at,
      friendship.addressee_seen_at as seen_at,
      null::timestamptz as missed_at,
      friendship.requester_user_id as sender_user_id,
      profile.handle as sender_handle,
      coalesce(profile.display_name, sender.display_name, 'AniDachi user')
        as sender_display_name,
      coalesce(profile.avatar_url, sender.avatar_url) as sender_avatar_url,
      null::text as room_id,
      null::text as target_kind,
      null::uuid as target_group_id,
      null::text as target_group_name,
      null::text as message,
      null::text as room_title,
      null::text as source_url,
      null::text as video_fingerprint
    from public.friendships as friendship
    inner join public.users as sender on sender.id = friendship.requester_user_id
    left join public.profiles as profile on profile.user_id = friendship.requester_user_id
    where p_user_id is not null
      and p_now is not null
      and friendship.addressee_user_id = p_user_id
      and friendship.status = 'pending'
  ),
  inbox_counts as (
    select
      count(*) filter (where candidate.seen_at is null) as unseen_count,
      count(*) filter (
        where candidate.item_kind = 'friend-request'
          or candidate.item_state = 'active'
      ) as actionable_count,
      count(*) filter (
        where candidate.item_kind = 'room-invite'
          and candidate.item_state = 'active'
      ) as active_room_invite_count,
      count(*) filter (where candidate.item_kind = 'friend-request')
        as pending_friend_request_count
    from candidates as candidate
  ),
  inbox_page as (
    select candidate.*
    from candidates as candidate
    where p_cursor_activity_at is null
      or candidate.activity_at < p_cursor_activity_at
      or (
        candidate.activity_at = p_cursor_activity_at
        and candidate.stable_key > p_cursor_key
      )
    order by candidate.activity_at desc, candidate.stable_key
    limit least(greatest(coalesce(p_limit, 51), 1), 101)
  ),
  page_json as (
    select coalesce(
      jsonb_agg(
        to_jsonb(page_row) - 'stable_key'
        order by page_row.activity_at desc, page_row.stable_key
      ),
      '[]'::jsonb
    ) as entries
    from inbox_page as page_row
  )
  select jsonb_build_object(
    'entries', page_json.entries,
    'counts', jsonb_build_object(
      'unseen_count', inbox_counts.unseen_count,
      'actionable_count', inbox_counts.actionable_count,
      'active_room_invite_count', inbox_counts.active_room_invite_count,
      'pending_friend_request_count', inbox_counts.pending_friend_request_count
    )
  )
  from inbox_counts
  cross join page_json
  cross join (select count(*) from reconciled) as reconciliation;
$$;

create or replace function public.respond_room_invite_v2(
  p_user_id uuid,
  p_invite_id uuid,
  p_action text,
  p_now timestamptz
)
returns table (
  outcome text,
  invite_id uuid,
  room_id text,
  recipient_status text,
  responded_at timestamptz,
  missed_at timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_recipient public.room_invite_recipients%rowtype;
  v_invite public.room_invites%rowtype;
  v_room public.rooms%rowtype;
  v_friendship_status text;
begin
  if p_user_id is null
    or p_invite_id is null
    or p_action not in ('accept', 'decline')
    or p_now is null
  then
    raise exception 'room_invite_response_input_invalid' using errcode = '22023';
  end if;

  select recipient.*
  into v_recipient
  from public.room_invite_recipients as recipient
  where recipient.invite_id = p_invite_id
    and recipient.recipient_user_id = p_user_id
  for update;

  if not found then
    return query
    select
      'not_found'::text,
      p_invite_id,
      null::text,
      null::text,
      null::timestamptz,
      null::timestamptz;
    return;
  end if;

  select invite.*
  into strict v_invite
  from public.room_invites as invite
  where invite.id = p_invite_id;

  select room.*
  into strict v_room
  from public.rooms as room
  where room.room_id = v_invite.room_id
  for update;

  if v_recipient.status = 'expired' and v_recipient.responded_at is not null then
    update public.room_invite_recipients as recipient
    set
      status = 'declined',
      missed_at = null,
      updated_at = p_now
    where recipient.invite_id = p_invite_id
      and recipient.recipient_user_id = p_user_id
    returning recipient.* into v_recipient;
  elsif v_recipient.status = 'expired' and v_room.status <> 'ended' then
    update public.room_invite_recipients as recipient
    set
      status = 'pending',
      missed_at = null,
      updated_at = p_now
    where recipient.invite_id = p_invite_id
      and recipient.recipient_user_id = p_user_id
    returning recipient.* into v_recipient;
  elsif v_recipient.status = 'expired'
    and v_room.status = 'ended'
    and v_recipient.missed_at is distinct from coalesce(
      v_room.ended_at,
      v_recipient.missed_at,
      p_now
    )
  then
    update public.room_invite_recipients as recipient
    set
      missed_at = coalesce(v_room.ended_at, recipient.missed_at, p_now),
      updated_at = p_now
    where recipient.invite_id = p_invite_id
      and recipient.recipient_user_id = p_user_id
    returning recipient.* into v_recipient;
  end if;

  if v_recipient.status = 'accepted' then
    return query
    select
      case when p_action = 'accept' then 'accepted' else 'already_resolved' end,
      v_invite.id,
      v_invite.room_id,
      v_recipient.status,
      v_recipient.responded_at,
      v_recipient.missed_at;
    return;
  end if;

  if v_recipient.status = 'declined' then
    return query
    select
      case when p_action = 'decline' then 'declined' else 'already_resolved' end,
      v_invite.id,
      v_invite.room_id,
      v_recipient.status,
      v_recipient.responded_at,
      v_recipient.missed_at;
    return;
  end if;

  if v_recipient.status = 'expired' then
    return query
    select
      case when v_room.status = 'ended' then 'room_ended' else 'already_resolved' end,
      v_invite.id,
      v_invite.room_id,
      v_recipient.status,
      v_recipient.responded_at,
      v_recipient.missed_at;
    return;
  end if;

  if v_room.status = 'ended' then
    update public.room_invite_recipients as recipient
    set
      status = 'expired',
      missed_at = coalesce(v_room.ended_at, recipient.missed_at, p_now),
      updated_at = p_now
    where recipient.invite_id = p_invite_id
      and recipient.recipient_user_id = p_user_id
    returning recipient.* into v_recipient;

    return query
    select
      'room_ended'::text,
      v_invite.id,
      v_invite.room_id,
      v_recipient.status,
      v_recipient.responded_at,
      v_recipient.missed_at;
    return;
  end if;

  if p_action = 'accept' then
    select friendship.status
    into v_friendship_status
    from public.friendships as friendship
    where (
        friendship.requester_user_id = v_invite.sender_user_id
        and friendship.addressee_user_id = p_user_id
      )
      or (
        friendship.requester_user_id = p_user_id
        and friendship.addressee_user_id = v_invite.sender_user_id
      )
    for share;

    if v_friendship_status is distinct from 'accepted' then
      return query
      select
        'friendship_required'::text,
        v_invite.id,
        v_invite.room_id,
        v_recipient.status,
        v_recipient.responded_at,
        v_recipient.missed_at;
      return;
    end if;
  end if;

  update public.room_invite_recipients as recipient
  set
    status = case when p_action = 'accept' then 'accepted' else 'declined' end,
    responded_at = p_now,
    updated_at = p_now
  where recipient.invite_id = p_invite_id
    and recipient.recipient_user_id = p_user_id
  returning recipient.* into v_recipient;

  return query
  select
    v_recipient.status,
    v_invite.id,
    v_invite.room_id,
    v_recipient.status,
    v_recipient.responded_at,
    v_recipient.missed_at;
end;
$$;

revoke all on function public.reconcile_account_inbox_v2(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_account_inbox_page_v2(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer
) from public, anon, authenticated;
revoke all on function public.respond_room_invite_v2(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.reconcile_account_inbox_v2(uuid, timestamptz)
  to service_role;
grant execute on function public.get_account_inbox_page_v2(
  uuid,
  timestamptz,
  timestamptz,
  text,
  integer
) to service_role;
grant execute on function public.respond_room_invite_v2(uuid, uuid, text, timestamptz)
  to service_role;
