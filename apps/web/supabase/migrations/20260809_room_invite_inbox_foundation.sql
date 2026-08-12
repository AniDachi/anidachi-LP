-- Durable account inbox foundation. Existing invite create/respond APIs remain
-- unchanged in this rollout; this migration only adds compatible inbox state
-- and server-side read/seen primitives.

alter table public.friendships
  add column if not exists addressee_seen_at timestamptz;

alter table public.room_invite_recipients
  add column if not exists seen_at timestamptz,
  add column if not exists missed_at timestamptz;

-- Preserve the first known transition time for legacy expired recipients.
update public.room_invite_recipients
set missed_at = updated_at
where status = 'expired'
  and missed_at is null;

create or replace function public.prepare_friendship_inbox_state()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    if tg_op = 'INSERT' then
      new.addressee_seen_at := null;
    elsif old.status is distinct from 'pending'
      or old.requester_user_id is distinct from new.requester_user_id
      or old.addressee_user_id is distinct from new.addressee_user_id
      or old.requested_at is distinct from new.requested_at
    then
      new.addressee_seen_at := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_friendship_inbox_state on public.friendships;
create trigger prepare_friendship_inbox_state
before insert or update of status, requester_user_id, addressee_user_id, requested_at
on public.friendships
for each row
execute function public.prepare_friendship_inbox_state();

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
      new.missed_at := coalesce(old.missed_at, new.missed_at, new.updated_at, now());
    end if;
  else
    new.missed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_room_invite_recipient_inbox_state
  on public.room_invite_recipients;
create trigger prepare_room_invite_recipient_inbox_state
before insert or update of status, missed_at, updated_at
on public.room_invite_recipients
for each row
execute function public.prepare_room_invite_recipient_inbox_state();

create index if not exists idx_room_invite_recipients_user_inbox
  on public.room_invite_recipients (
    recipient_user_id,
    status,
    missed_at desc,
    created_at desc
  )
  where status in ('pending', 'expired');

create index if not exists idx_friendships_addressee_pending_seen
  on public.friendships (addressee_user_id, requested_at desc, id)
  where status = 'pending';

create or replace function public.reconcile_account_inbox(
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
  updated_count integer := 0;
begin
  if p_user_id is null or p_now is null then
    raise exception 'account_inbox_input_invalid' using errcode = '22023';
  end if;

  update public.room_invite_recipients as recipient
  set
    status = 'expired',
    missed_at = coalesce(
      recipient.missed_at,
      case
        when room.status = 'ended'
          then least(coalesce(room.ended_at, p_now), invite.expires_at)
        else invite.expires_at
      end
    ),
    updated_at = p_now
  from public.room_invites as invite
  inner join public.rooms as room on room.room_id = invite.room_id
  where recipient.invite_id = invite.id
    and recipient.recipient_user_id = p_user_id
    and recipient.status = 'pending'
    and (room.status = 'ended' or invite.expires_at <= p_now);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.get_account_inbox_page(
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
      status = 'expired',
      missed_at = coalesce(
        recipient.missed_at,
        case
          when room.status = 'ended'
            then least(coalesce(room.ended_at, p_now), invite.expires_at)
          else invite.expires_at
        end
      ),
      updated_at = p_now
    from public.room_invites as invite
    inner join public.rooms as room on room.room_id = invite.room_id
    where recipient.invite_id = invite.id
      and recipient.recipient_user_id = p_user_id
      and recipient.status = 'pending'
      and (room.status = 'ended' or invite.expires_at <= p_now)
    returning recipient.invite_id
  ),
  room_invite_candidates as (
    select
      invite.id as item_id,
      case
        when recipient.status = 'expired'
          or room.status = 'ended'
          or invite.expires_at <= p_now
        then 'missed'::text
        else 'active'::text
      end as item_state,
      case
        when recipient.status = 'expired'
          or room.status = 'ended'
          or invite.expires_at <= p_now
        then coalesce(
          recipient.missed_at,
          case
            when room.status = 'ended'
              then least(coalesce(room.ended_at, p_now), invite.expires_at)
            else invite.expires_at
          end
        )
        else recipient.created_at
      end as activity_at,
      invite.created_at,
      recipient.seen_at,
      case
        when recipient.status = 'expired'
          or room.status = 'ended'
          or invite.expires_at <= p_now
        then coalesce(
          recipient.missed_at,
          case
            when room.status = 'ended'
              then least(coalesce(room.ended_at, p_now), invite.expires_at)
            else invite.expires_at
          end
        )
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
    left join public.friend_groups as friend_group on friend_group.id = invite.target_group_id
    where p_user_id is not null
      and p_now is not null
      and recipient.recipient_user_id = p_user_id
      and recipient.status in ('pending', 'expired')
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
      and (
        room_invite.item_state = 'missed'
        or exists (
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

create or replace function public.mark_account_inbox_seen(
  p_user_id uuid,
  p_room_invite_ids uuid[],
  p_friendship_ids uuid[],
  p_seen_at timestamptz
)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  invite_count integer := 0;
  friendship_count integer := 0;
begin
  if p_user_id is null or p_seen_at is null then
    raise exception 'account_inbox_seen_input_invalid' using errcode = '22023';
  end if;

  update public.room_invite_recipients
  set seen_at = p_seen_at
  where recipient_user_id = p_user_id
    and invite_id = any(coalesce(p_room_invite_ids, '{}'::uuid[]))
    and status in ('pending', 'expired')
    and seen_at is null;
  get diagnostics invite_count = row_count;

  update public.friendships
  set addressee_seen_at = p_seen_at
  where addressee_user_id = p_user_id
    and id = any(coalesce(p_friendship_ids, '{}'::uuid[]))
    and status = 'pending'
    and addressee_seen_at is null;
  get diagnostics friendship_count = row_count;

  return invite_count + friendship_count;
end;
$$;

revoke all on function public.prepare_friendship_inbox_state()
  from public, anon, authenticated;
revoke all on function public.prepare_room_invite_recipient_inbox_state()
  from public, anon, authenticated;
revoke all on function public.reconcile_account_inbox(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_account_inbox_page(uuid, timestamptz, timestamptz, text, integer)
  from public, anon, authenticated;
revoke all on function public.mark_account_inbox_seen(uuid, uuid[], uuid[], timestamptz)
  from public, anon, authenticated;

grant execute on function public.reconcile_account_inbox(uuid, timestamptz)
  to service_role;
grant execute on function public.get_account_inbox_page(uuid, timestamptz, timestamptz, text, integer)
  to service_role;
grant execute on function public.mark_account_inbox_seen(uuid, uuid[], uuid[], timestamptz)
  to service_role;
