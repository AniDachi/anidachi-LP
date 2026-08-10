-- Atomic, idempotent room invite creation. The durable action ledger protects
-- retries while the RPC keeps invite and recipient writes in one transaction.

create table if not exists public.room_invite_actions (
  sender_user_id uuid not null references public.users (id) on delete cascade,
  client_action_id uuid not null,
  room_id text not null references public.rooms (room_id) on delete cascade,
  target_kind text not null check (target_kind in ('direct', 'group')),
  target_group_id uuid references public.friend_groups (id) on delete cascade,
  direct_recipient_user_ids uuid[] not null default '{}'::uuid[],
  message text,
  invite_id uuid not null references public.room_invites (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sender_user_id, client_action_id),
  check (
    (target_kind = 'direct'
      and target_group_id is null
      and cardinality(direct_recipient_user_ids) > 0)
    or
    (target_kind = 'group'
      and target_group_id is not null
      and cardinality(direct_recipient_user_ids) = 0)
  ),
  check (message is null or char_length(message) <= 180)
);

create index if not exists idx_room_invite_actions_sender_created
  on public.room_invite_actions (sender_user_id, created_at desc);

alter table public.room_invite_actions enable row level security;

revoke all on table public.room_invite_actions from public, anon, authenticated;
grant select, insert on table public.room_invite_actions to service_role;

create or replace function public.create_room_invite_atomic(
  p_sender_user_id uuid,
  p_client_action_id uuid,
  p_room_id text,
  p_direct_recipient_user_ids uuid[],
  p_group_id uuid,
  p_message text
)
returns table (
  outcome text,
  invite_id uuid
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
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
    and recipient.recipient_user_id = any(requested_recipient_ids);

  select coalesce(
    pg_catalog.array_agg(candidate.recipient_user_id order by candidate.recipient_user_id),
    '{}'::uuid[]
  )
  into new_recipient_ids
  from pg_catalog.unnest(requested_recipient_ids) as candidate(recipient_user_id)
  where not (candidate.recipient_user_id = any(existing_recipient_ids));

  if cardinality(new_recipient_ids) > 0 then
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
    -- Historical data can contain more than one invite for the same room and
    -- recipient. Return the most recently changed recipient state without
    -- rewriting those rows during this additive migration.
    order by recipient.updated_at desc, invite.created_at desc, invite.id desc
    limit 1;
  end if;

  if canonical_invite_id is null then
    raise exception 'room_invite_canonical_missing' using errcode = 'P0001';
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

  return query select
    case when cardinality(new_recipient_ids) > 0 then 'created' else 'existing' end,
    canonical_invite_id;
end;
$$;

revoke all on function public.create_room_invite_atomic(
  uuid,
  uuid,
  text,
  uuid[],
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.create_room_invite_atomic(
  uuid,
  uuid,
  text,
  uuid[],
  uuid,
  text
) to service_role;
