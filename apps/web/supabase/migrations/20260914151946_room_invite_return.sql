-- Fresh invitation identities after departure, and opt-in Return projection.
-- Existing v2 Inbox remains unchanged for old clients.
begin;
alter table public.room_invite_recipients add column superseded_at timestamptz;
comment on column public.room_invite_recipients.superseded_at is
  'Accepted history replaced by a fresh invitation; old action identities stay immutable.';

CREATE OR REPLACE FUNCTION public.create_room_invite_atomic(p_sender_user_id uuid, p_client_action_id uuid, p_room_id text, p_direct_recipient_user_ids uuid[], p_group_id uuid, p_message text)
 RETURNS TABLE(outcome text, invite_id uuid)
 LANGUAGE plpgsql
 VOLATILE
 SECURITY INVOKER
 SET search_path TO ''
AS $function$
declare
  existing_action public.room_invite_actions%rowtype;
  room_record public.rooms%rowtype;
  group_record public.friend_groups%rowtype;
  target_kind_value text;
  normalized_direct_ids uuid[] := '{}'::uuid[];
  requested_recipient_ids uuid[] := '{}'::uuid[];
  eligible_direct_ids uuid[] := '{}'::uuid[];
  existing_recipient_ids uuid[] := '{}'::uuid[];
  new_recipient_ids uuid[] := '{}'::uuid[];
  normalized_message text;
  canonical_invite_id uuid;
  recent_action_count integer;
begin
  if p_sender_user_id is null
    or p_client_action_id is null
    or p_room_id is null
    or pg_catalog.btrim(p_room_id) = ''
  then
    raise exception 'room_invite_request_invalid' using errcode = '22023';
  end if;

  select coalesce(
    pg_catalog.array_agg(candidate.recipient_user_id order by candidate.recipient_user_id),
    '{}'::uuid[]
  )
  into normalized_direct_ids
  from (
    select distinct recipient_user_id
    from pg_catalog.unnest(coalesce(p_direct_recipient_user_ids, '{}'::uuid[]))
      as requested(recipient_user_id)
    where recipient_user_id is not null
  ) as candidate;

  if (p_direct_recipient_user_ids is null) = (p_group_id is null) then
    raise exception 'room_invite_target_invalid' using errcode = '22023';
  end if;

  target_kind_value := case when p_group_id is null then 'direct' else 'group' end;
  normalized_message := nullif(pg_catalog.btrim(p_message), '');
  if normalized_message is not null and pg_catalog.char_length(normalized_message) > 180 then
    raise exception 'room_invite_message_invalid' using errcode = '22023';
  end if;

  -- Serialize requests for one sender. This makes action replay, the rate
  -- window, and room-recipient deduplication deterministic under concurrency.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('room-invite-sender:' || p_sender_user_id::text, 0)
  );

  select action.*
  into existing_action
  from public.room_invite_actions as action
  where action.sender_user_id = p_sender_user_id
    and action.client_action_id = p_client_action_id;

  if found then
    if existing_action.room_id <> p_room_id
      or existing_action.target_kind <> target_kind_value
      or existing_action.target_group_id is distinct from p_group_id
      or existing_action.direct_recipient_user_ids <> normalized_direct_ids
      or existing_action.message is distinct from normalized_message
    then
      raise exception 'room_invite_request_id_conflict' using errcode = 'P0001';
    end if;

    return query select 'existing'::text, existing_action.invite_id;
    return;
  end if;

  select count(*)::integer
  into recent_action_count
  from public.room_invite_actions as action
  where action.sender_user_id = p_sender_user_id
    and action.created_at >= pg_catalog.clock_timestamp() - interval '1 minute';

  if recent_action_count >= 20 then
    raise exception 'room_invite_rate_limit' using errcode = 'P0001';
  end if;

  select room.*
  into room_record
  from public.rooms as room
  where room.room_id = p_room_id
  for update;

  if not found then
    raise exception 'room_invite_room_not_found' using errcode = 'P0001';
  end if;
  if room_record.host_user_id <> p_sender_user_id then
    raise exception 'room_invite_host_required' using errcode = 'P0001';
  end if;
  if room_record.status = 'ended' then
    raise exception 'room_invite_room_ended' using errcode = 'P0001';
  end if;

  if target_kind_value = 'direct' then
    if cardinality(normalized_direct_ids) = 0 then
      raise exception 'room_invite_no_recipients' using errcode = '22023';
    end if;
    if p_sender_user_id = any(normalized_direct_ids) then
      raise exception 'room_invite_self_recipient' using errcode = '22023';
    end if;

    select coalesce(
      pg_catalog.array_agg(candidate.recipient_user_id order by candidate.recipient_user_id),
      '{}'::uuid[]
    )
    into eligible_direct_ids
    from pg_catalog.unnest(normalized_direct_ids) as candidate(recipient_user_id)
    where exists (
      select 1
      from public.friendships as friendship
      where friendship.status = 'accepted'
        and (
          (friendship.requester_user_id = p_sender_user_id
            and friendship.addressee_user_id = candidate.recipient_user_id)
          or
          (friendship.addressee_user_id = p_sender_user_id
            and friendship.requester_user_id = candidate.recipient_user_id)
        )
    );

    if eligible_direct_ids <> normalized_direct_ids then
      raise exception 'room_invite_recipient_forbidden' using errcode = 'P0001';
    end if;
    requested_recipient_ids := normalized_direct_ids;
  else
    select friend_group.*
    into group_record
    from public.friend_groups as friend_group
    where friend_group.id = p_group_id
      and friend_group.owner_user_id = p_sender_user_id;

    if not found then
      raise exception 'room_invite_group_not_found' using errcode = 'P0001';
    end if;
    if group_record.archived_at is not null then
      raise exception 'room_invite_group_archived' using errcode = 'P0001';
    end if;

    select coalesce(
      pg_catalog.array_agg(member.friend_user_id order by member.friend_user_id),
      '{}'::uuid[]
    )
    into requested_recipient_ids
    from public.friend_group_members as member
    where member.group_id = p_group_id
      and member.friend_user_id <> p_sender_user_id
      and exists (
        select 1
        from public.friendships as friendship
        where friendship.status = 'accepted'
          and (
            (friendship.requester_user_id = p_sender_user_id
              and friendship.addressee_user_id = member.friend_user_id)
            or
            (friendship.addressee_user_id = p_sender_user_id
              and friendship.requester_user_id = member.friend_user_id)
          )
      );
  end if;

  if cardinality(requested_recipient_ids) = 0 then
    raise exception 'room_invite_no_recipients' using errcode = '22023';
  end if;
  if cardinality(requested_recipient_ids) > 100 then
    raise exception 'room_invite_recipient_limit' using errcode = '22023';
  end if;

  select coalesce(
    pg_catalog.array_agg(
      distinct recipient.recipient_user_id order by recipient.recipient_user_id
    ),
    '{}'::uuid[]
  )
  into existing_recipient_ids
  from public.room_invite_recipients as recipient
  inner join public.room_invites as invite on invite.id = recipient.invite_id
  where invite.room_id = p_room_id
    and recipient.recipient_user_id = any(requested_recipient_ids)
    and recipient.superseded_at is null
    and recipient.status <> 'accepted';

  select coalesce(
    pg_catalog.array_agg(candidate.recipient_user_id order by candidate.recipient_user_id),
    '{}'::uuid[]
  )
  into new_recipient_ids
  from pg_catalog.unnest(requested_recipient_ids) as candidate(recipient_user_id)
  where not (candidate.recipient_user_id = any(existing_recipient_ids))
    -- Assignment also covers admission in progress; it is not live presence.
    and not exists (
      select 1 from public.active_room_sessions as assignment
      where assignment.user_id = candidate.recipient_user_id
        and assignment.room_id = p_room_id
    );

  if cardinality(new_recipient_ids) > 0 then
    -- The room lock serializes creation with response/admission. Preserve old
    -- identities and action-ledger replay while fencing their future responses.
    update public.room_invite_recipients as recipient
    set superseded_at = pg_catalog.clock_timestamp()
    from public.room_invites as invite
    where invite.id = recipient.invite_id
      and invite.room_id = p_room_id
      and recipient.recipient_user_id = any(new_recipient_ids)
      and recipient.status = 'accepted'
      and recipient.superseded_at is null;

    insert into public.room_invites (
      room_id,
      sender_user_id,
      target_kind,
      target_group_id,
      message,
      room_title,
      source_url,
      video_fingerprint
    )
    values (
      room_record.room_id,
      p_sender_user_id,
      target_kind_value,
      p_group_id,
      normalized_message,
      room_record.title,
      room_record.source_url,
      room_record.video_fingerprint
    )
    returning id into canonical_invite_id;

    insert into public.room_invite_recipients (invite_id, recipient_user_id)
    select canonical_invite_id, recipient.recipient_user_id
    from pg_catalog.unnest(new_recipient_ids) as recipient(recipient_user_id);
  else
    select invite.id
    into canonical_invite_id
    from public.room_invites as invite
    inner join public.room_invite_recipients as recipient
      on recipient.invite_id = invite.id
    where invite.room_id = p_room_id
      and recipient.recipient_user_id = any(requested_recipient_ids)
      and recipient.superseded_at is null
    -- Historical data can contain more than one invite for the same room and
    -- recipient. Return the most recently changed recipient state without
    -- rewriting those rows during this additive migration.
    order by recipient.updated_at desc, invite.created_at desc, invite.id desc
    limit 1;
  end if;

  if canonical_invite_id is null then
    raise exception 'room_invite_already_in_room' using errcode = 'P0001';
  end if;

  insert into public.room_invite_actions (
    sender_user_id,
    client_action_id,
    room_id,
    target_kind,
    target_group_id,
    direct_recipient_user_ids,
    message,
    invite_id
  )
  values (
    p_sender_user_id,
    p_client_action_id,
    p_room_id,
    target_kind_value,
    p_group_id,
    normalized_direct_ids,
    normalized_message,
    canonical_invite_id
  );


  if p_group_id is not null then
    insert into public.watch_history_group_invitation_contexts(owner_user_id,client_action_id,recipient_user_id,invite_id,room_id,group_id,group_name,action_at)
    select p_sender_user_id,p_client_action_id,requested.user_id,recipient.invite_id,p_room_id,p_group_id,group_record.name,pg_catalog.clock_timestamp()
    from pg_catalog.unnest(requested_recipient_ids) requested(user_id)
    cross join lateral (
      select r.invite_id from public.room_invite_recipients r join public.room_invites i on i.id=r.invite_id
      where i.room_id=p_room_id and r.recipient_user_id=requested.user_id and r.status='pending'
      order by r.updated_at desc,i.id limit 1 for update of r
    ) recipient;
  end if;
  return query select
    case when cardinality(new_recipient_ids) > 0 then 'created' else 'existing' end,
    canonical_invite_id;
end;
$function$;

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
    or p_action is null
    or p_action not in ('accept', 'decline')
    or p_now is null
  then
    raise exception 'room_invite_response_input_invalid' using errcode = '22023';
  end if;

  -- Read only authorized identity before taking locks. All mutating invitation
  -- paths lock the room before recipient rows, matching create/admission.
  select invite.* into v_invite
  from public.room_invites as invite
  inner join public.room_invite_recipients as recipient on recipient.invite_id = invite.id
  where invite.id = p_invite_id and recipient.recipient_user_id = p_user_id;
  if not found then
    return query select 'not_found'::text, p_invite_id, null::text,
      null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  select room.* into strict v_room
  from public.rooms as room where room.room_id = v_invite.room_id for update;
  select recipient.* into v_recipient
  from public.room_invite_recipients as recipient
  where recipient.invite_id = p_invite_id and recipient.recipient_user_id = p_user_id
  for update;
  if not found then
    return query select 'not_found'::text, p_invite_id, null::text,
      null::text, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_recipient.superseded_at is not null then
    return query select 'already_resolved'::text, v_invite.id, v_invite.room_id,
      v_recipient.status, v_recipient.responded_at, v_recipient.missed_at;
    return;
  end if;

  if p_action = 'accept' and v_recipient.status = 'accepted' and v_room.status = 'ended' then
    return query select 'room_ended'::text, v_invite.id, v_invite.room_id,
      v_recipient.status, v_recipient.responded_at, v_recipient.missed_at;
    return;
  end if;

  -- Check authorization before even repairing legacy state. A Return retry
  -- rechecks friendship just like the first accept, without changing history.
  if p_action = 'accept' and (
    v_recipient.status in ('pending', 'accepted')
    or (v_recipient.status = 'expired' and v_recipient.responded_at is null)
  ) then
    select friendship.status into v_friendship_status
    from public.friendships as friendship
    where (friendship.requester_user_id = v_invite.sender_user_id and friendship.addressee_user_id = p_user_id)
       or (friendship.requester_user_id = p_user_id and friendship.addressee_user_id = v_invite.sender_user_id)
    for share;
    if v_friendship_status is distinct from 'accepted' then
      return query select 'friendship_required'::text, v_invite.id, v_invite.room_id,
        v_recipient.status, v_recipient.responded_at, v_recipient.missed_at;
      return;
    end if;
  end if;

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

create or replace function public.get_account_inbox_page_v3(
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
      and recipient.superseded_at is null
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
    select distinct on (invite.room_id)
      invite.id as item_id,
      case
        when recipient.status = 'accepted' then 'returnable'::text
        when room.status = 'ended' then 'missed'::text
        else 'active'::text
      end as item_state,
      case
        when room.status = 'ended'
          then coalesce(room.ended_at, recipient.missed_at, p_now)
        else recipient.created_at
      end as activity_at,
      invite.created_at,
      case when recipient.status = 'accepted'
        then coalesce(recipient.seen_at, recipient.responded_at, recipient.created_at)
        else recipient.seen_at end as seen_at,
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
      case when recipient.status = 'accepted' then room.title else invite.room_title end as room_title,
      case when recipient.status = 'accepted' then room.source_url else invite.source_url end as source_url,
      case when recipient.status = 'accepted' then room.video_fingerprint else invite.video_fingerprint end as video_fingerprint
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
      and recipient.superseded_at is null
      and (
        recipient.status = 'pending'
        or (recipient.status = 'accepted' and room.status <> 'ended')
        or (
          recipient.status = 'expired'
          and recipient.responded_at is null
        )
      )
    -- Pending replacement wins over historical accepted rows, then choose a
    -- deterministic latest current identity for each room.
    order by invite.room_id, (recipient.status = 'accepted'),
      recipient.updated_at desc, invite.created_at desc, invite.id desc
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
        room_invite.item_state in ('active', 'returnable')
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


revoke all on function public.create_room_invite_atomic(uuid,uuid,text,uuid[],uuid,text),
  public.respond_room_invite_v2(uuid,uuid,text,timestamptz),
  public.get_account_inbox_page_v3(uuid,timestamptz,timestamptz,text,integer)
  from public, anon, authenticated;
grant execute on function public.create_room_invite_atomic(uuid,uuid,text,uuid[],uuid,text),
  public.respond_room_invite_v2(uuid,uuid,text,timestamptz),
  public.get_account_inbox_page_v3(uuid,timestamptz,timestamptz,text,integer)
  to service_role;
commit;
