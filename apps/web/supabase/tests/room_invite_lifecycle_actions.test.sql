create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

begin;

set role postgres;
set search_path = public, extensions;
select no_plan();

select has_function(
  'public',
  'reconcile_account_inbox_v2',
  array['uuid', 'timestamp with time zone'],
  'v2 inbox reconciliation follows room lifecycle instead of invite expiry'
);

select has_function(
  'public',
  'get_account_inbox_page_v2',
  array[
    'uuid',
    'timestamp with time zone',
    'timestamp with time zone',
    'text',
    'integer'
  ],
  'v2 inbox paging exposes lifecycle-consistent invitation state'
);

select has_function(
  'public',
  'respond_room_invite_v2',
  array['uuid', 'uuid', 'text', 'timestamp with time zone'],
  'v2 room-invite responses are atomic and versioned'
);

select ok(
  (
    select not procedure.prosecdef
      and procedure.provolatile = 'v'
      and procedure.proconfig @> array['search_path=""']::text[]
      and procedure.proretset
      and pg_catalog.pg_get_function_result(procedure.oid) =
        'TABLE(outcome text, invite_id uuid, room_id text, recipient_status text, responded_at timestamp with time zone, missed_at timestamp with time zone)'
    from pg_catalog.pg_proc as procedure
    where procedure.oid = pg_catalog.to_regprocedure(
      'public.respond_room_invite_v2(uuid,uuid,text,timestamptz)'
    )
  ),
  'the response RPC is a volatile security-invoker table function with an empty search_path'
);

select ok(
  pg_catalog.has_function_privilege(
    'service_role',
    'public.reconcile_account_inbox_v2(uuid,timestamptz)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'service_role',
    'public.get_account_inbox_page_v2(uuid,timestamptz,timestamptz,text,integer)',
    'execute'
  )
  and pg_catalog.has_function_privilege(
    'service_role',
    'public.respond_room_invite_v2(uuid,uuid,text,timestamptz)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'public',
    'public.respond_room_invite_v2(uuid,uuid,text,timestamptz)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.respond_room_invite_v2(uuid,uuid,text,timestamptz)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.respond_room_invite_v2(uuid,uuid,text,timestamptz)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'public',
    'public.reconcile_account_inbox_v2(uuid,timestamptz)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.reconcile_account_inbox_v2(uuid,timestamptz)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.reconcile_account_inbox_v2(uuid,timestamptz)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'public',
    'public.get_account_inbox_page_v2(uuid,timestamptz,timestamptz,text,integer)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'anon',
    'public.get_account_inbox_page_v2(uuid,timestamptz,timestamptz,text,integer)',
    'execute'
  )
  and not pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_account_inbox_page_v2(uuid,timestamptz,timestamptz,text,integer)',
    'execute'
  ),
  'only service_role can execute the v2 invite lifecycle functions'
);

select has_function(
  'public',
  'reconcile_account_inbox',
  array['uuid', 'timestamp with time zone'],
  'the old inbox reconciliation function remains for rollback'
);

select has_function(
  'public',
  'get_account_inbox_page',
  array[
    'uuid',
    'timestamp with time zone',
    'timestamp with time zone',
    'text',
    'integer'
  ],
  'the old inbox page function remains for rollback'
);

select throws_like(
  $$
    select *
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000001',
      'maybe',
      '2100-01-02 12:00:00+00'
    )
  $$,
  '%room_invite_response_input_invalid%',
  'the response RPC rejects unknown actions before reading durable state'
);

delete from public.room_invite_recipients
where invite_id::text like '81000000-0000-4000-8000-%';
delete from public.room_invites
where id::text like '81000000-0000-4000-8000-%';
delete from public.room_members
where room_id like 'invite-lifecycle-%';
delete from public.rooms
where room_id like 'invite-lifecycle-%';
delete from public.friend_group_members
where group_id = '72000000-0000-4000-8000-000000000001';
delete from public.friend_groups
where id = '72000000-0000-4000-8000-000000000001';
delete from public.friendships
where id::text like '73000000-0000-4000-8000-%';
delete from public.profiles
where user_id::text like '71000000-0000-4000-8000-%';
delete from public.users
where id::text like '71000000-0000-4000-8000-%';

insert into public.users (id, email, display_name)
values
  ('71000000-0000-4000-8000-000000000001', 'invite-host@example.test', 'Invite Host'),
  ('71000000-0000-4000-8000-000000000002', 'invite-old@example.test', 'Old Invite Recipient'),
  ('71000000-0000-4000-8000-000000000003', 'invite-full@example.test', 'Full Room Recipient'),
  ('71000000-0000-4000-8000-000000000004', 'invite-ended@example.test', 'Ended Room Recipient'),
  ('71000000-0000-4000-8000-000000000005', 'invite-removed@example.test', 'Removed Friend Recipient'),
  ('71000000-0000-4000-8000-000000000006', 'invite-group@example.test', 'Group Recipient'),
  ('71000000-0000-4000-8000-000000000007', 'invite-decline@example.test', 'Decline Recipient'),
  ('71000000-0000-4000-8000-000000000008', 'invite-outsider@example.test', 'Invite Outsider'),
  ('71000000-0000-4000-8000-000000000009', 'invite-stale@example.test', 'Stale Missed Recipient'),
  ('71000000-0000-4000-8000-000000000010', 'invite-legacy-declined@example.test', 'Legacy Declined Recipient'),
  ('71000000-0000-4000-8000-000000000011', 'invite-blocked-missed@example.test', 'Blocked Missed Recipient'),
  ('71000000-0000-4000-8000-000000000012', 'invite-page-repair@example.test', 'Page Repair Recipient'),
  ('71000000-0000-4000-8000-000000000013', 'invite-ended-repair@example.test', 'Ended Repair Recipient'),
  ('71000000-0000-4000-8000-000000000014', 'invite-response-repair@example.test', 'Response Repair Recipient'),
  ('71000000-0000-4000-8000-000000000015', 'invite-response-declined@example.test', 'Response Declined Recipient');

insert into public.profiles (user_id, handle, display_name)
select
  user_row.id,
  'invite_' || right(user_row.id::text, 4),
  user_row.display_name
from public.users as user_row
where user_row.id::text like '71000000-0000-4000-8000-%';

insert into public.friendships (
  id,
  requester_user_id,
  addressee_user_id,
  status,
  requested_at,
  responded_at,
  updated_at
)
values
  (
    '73000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000003',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000003',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000004',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000004',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000005',
    'removed',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000005',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000006',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000006',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000007',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000007',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000009',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000008',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000010',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000010',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000012',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000011',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000013',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000012',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000014',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  ),
  (
    '73000000-0000-4000-8000-000000000013',
    '71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000015',
    'accepted',
    '2099-01-01 00:00:00+00',
    '2099-01-01 00:00:01+00',
    '2099-01-01 00:00:01+00'
  );

insert into public.friendships (
  id,
  requester_user_id,
  addressee_user_id,
  status,
  blocked_by_user_id,
  requested_at,
  responded_at,
  updated_at
)
values (
  '73000000-0000-4000-8000-000000000009',
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000011',
  'blocked',
  '71000000-0000-4000-8000-000000000011',
  '2099-01-01 00:00:00+00',
  '2099-01-01 00:00:01+00',
  '2099-01-01 00:00:01+00'
);

insert into public.friend_groups (
  id,
  owner_user_id,
  name,
  created_at,
  updated_at
)
values (
  '72000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'Lifecycle Group',
  '2099-01-01 00:00:00+00',
  '2099-01-01 00:00:00+00'
);

insert into public.friend_group_members (group_id, friend_user_id, added_at)
values (
  '72000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000006',
  '2099-01-01 00:00:00+00'
);

insert into public.rooms (
  room_id,
  host_user_id,
  status,
  ended_at,
  max_participants,
  created_at
)
values
  ('invite-lifecycle-old', '71000000-0000-4000-8000-000000000001', 'live', null, 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-full', '71000000-0000-4000-8000-000000000001', 'live', null, 1, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-ended', '71000000-0000-4000-8000-000000000001', 'ended', '2100-01-02 11:30:00+00', 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-removed', '71000000-0000-4000-8000-000000000001', 'live', null, 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-group', '71000000-0000-4000-8000-000000000001', 'lobby', null, 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-decline', '71000000-0000-4000-8000-000000000001', 'live', null, 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-stale', '71000000-0000-4000-8000-000000000001', 'ended', '2100-01-01 12:00:00+00', 4, '2099-12-29 00:00:00+00'),
  ('invite-lifecycle-legacy-declined', '71000000-0000-4000-8000-000000000001', 'live', null, 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-blocked-missed', '71000000-0000-4000-8000-000000000001', 'ended', '2100-01-02 11:45:00+00', 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-page-repair', '71000000-0000-4000-8000-000000000001', 'live', null, 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-ended-repair', '71000000-0000-4000-8000-000000000001', 'ended', '2100-01-02 11:40:00+00', 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-response-repair', '71000000-0000-4000-8000-000000000001', 'live', null, 4, '2099-12-31 00:00:00+00'),
  ('invite-lifecycle-response-declined', '71000000-0000-4000-8000-000000000001', 'live', null, 4, '2099-12-31 00:00:00+00');

insert into public.room_members (room_id, user_id, joined_at)
values
  ('invite-lifecycle-full', '71000000-0000-4000-8000-000000000001', '2100-01-02 11:00:00+00'),
  ('invite-lifecycle-full', '71000000-0000-4000-8000-000000000008', '2100-01-02 11:01:00+00');

insert into public.room_invites (
  id,
  room_id,
  sender_user_id,
  target_kind,
  target_group_id,
  room_title,
  created_at,
  expires_at
)
values
  ('81000000-0000-4000-8000-000000000001', 'invite-lifecycle-old', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Old Active Invite', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000002', 'invite-lifecycle-full', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Temporarily Full', '2100-01-02 10:00:00+00', '2100-01-02 11:00:00+00'),
  ('81000000-0000-4000-8000-000000000003', 'invite-lifecycle-ended', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Ended Invite', '2100-01-02 10:00:00+00', '2100-01-03 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000004', 'invite-lifecycle-removed', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Removed Friendship', '2100-01-02 10:00:00+00', '2100-01-03 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000005', 'invite-lifecycle-group', '71000000-0000-4000-8000-000000000001', 'group', '72000000-0000-4000-8000-000000000001', 'Group Invite', '2100-01-02 10:00:00+00', '2100-01-03 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000006', 'invite-lifecycle-decline', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Decline Invite', '2100-01-02 10:00:00+00', '2100-01-03 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000007', 'invite-lifecycle-stale', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Old Missed Invite', '2099-12-29 00:00:00+00', '2099-12-29 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000008', 'invite-lifecycle-legacy-declined', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Legacy Declined Invite', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000009', 'invite-lifecycle-blocked-missed', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Blocked Missed Invite', '2100-01-02 10:00:00+00', '2100-01-03 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000010', 'invite-lifecycle-page-repair', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Page Repair Invite', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000011', 'invite-lifecycle-ended-repair', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Ended Repair Invite', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000012', 'invite-lifecycle-response-repair', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Response Repair Invite', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000013', 'invite-lifecycle-response-declined', '71000000-0000-4000-8000-000000000001', 'direct', null, 'Response Declined Invite', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00');

insert into public.room_invite_recipients (
  invite_id,
  recipient_user_id,
  status,
  created_at,
  updated_at,
  responded_at,
  missed_at
)
values
  ('81000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000002', 'expired', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00', null, '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000003', 'pending', '2100-01-02 10:00:00+00', '2100-01-02 10:00:00+00', null, null),
  ('81000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000004', 'pending', '2100-01-02 10:00:00+00', '2100-01-02 10:00:00+00', null, null),
  ('81000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000005', 'pending', '2100-01-02 10:00:00+00', '2100-01-02 10:00:00+00', null, null),
  ('81000000-0000-4000-8000-000000000005', '71000000-0000-4000-8000-000000000006', 'pending', '2100-01-02 10:00:00+00', '2100-01-02 10:00:00+00', null, null),
  ('81000000-0000-4000-8000-000000000006', '71000000-0000-4000-8000-000000000007', 'pending', '2100-01-02 10:00:00+00', '2100-01-02 10:00:00+00', null, null),
  ('81000000-0000-4000-8000-000000000007', '71000000-0000-4000-8000-000000000009', 'expired', '2099-12-29 00:00:00+00', '2100-01-01 12:00:00+00', null, '2100-01-01 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000008', '71000000-0000-4000-8000-000000000010', 'expired', '2099-12-31 00:00:00+00', '2100-01-02 10:30:00+00', '2100-01-02 10:30:00+00', '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000009', '71000000-0000-4000-8000-000000000011', 'pending', '2100-01-02 10:00:00+00', '2100-01-02 10:00:00+00', null, null),
  ('81000000-0000-4000-8000-000000000010', '71000000-0000-4000-8000-000000000012', 'expired', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00', null, '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000011', '71000000-0000-4000-8000-000000000013', 'expired', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00', null, '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000012', '71000000-0000-4000-8000-000000000014', 'expired', '2099-12-31 00:00:00+00', '2099-12-31 12:00:00+00', null, '2099-12-31 12:00:00+00'),
  ('81000000-0000-4000-8000-000000000013', '71000000-0000-4000-8000-000000000015', 'expired', '2099-12-31 00:00:00+00', '2100-01-02 10:35:00+00', '2100-01-02 10:35:00+00', '2099-12-31 12:00:00+00');

set role service_role;

select is(
  (
    select (entry->>'item_state') || ':' || (page->'counts'->>'active_room_invite_count')
    from (
      select public.get_account_inbox_page_v2(
        '71000000-0000-4000-8000-000000000012',
        '2100-01-02 12:00:00+00',
        null,
        null,
        51
      ) as page
    ) as inbox
    cross join lateral jsonb_array_elements(page->'entries') as entry
    where entry->>'item_id' = '81000000-0000-4000-8000-000000000010'
  ),
  'active:1',
  'the page RPC projects a legacy auto-expired active invite correctly in its repair statement'
);

select is(
  (
    select status || ':' || coalesce(missed_at::text, '<null>')
    from public.room_invite_recipients
    where invite_id = '81000000-0000-4000-8000-000000000010'
      and recipient_user_id = '71000000-0000-4000-8000-000000000012'
  ),
  'pending:<null>',
  'the page RPC durably repairs the legacy active recipient after projecting it'
);

select is(
  (
    select (entry->>'item_state') || ':' || (entry->>'missed_at')
    from jsonb_array_elements(
      public.get_account_inbox_page_v2(
        '71000000-0000-4000-8000-000000000013',
        '2100-01-02 12:00:00+00',
        null,
        null,
        51
      )->'entries'
    ) as entry
    where entry->>'item_id' = '81000000-0000-4000-8000-000000000011'
  ),
  'missed:2100-01-02T11:40:00+00:00',
  'the page RPC anchors a legacy auto-expired ended invite to the room end'
);

select is(
  (
    select status || ':' || missed_at::text
    from public.room_invite_recipients
    where invite_id = '81000000-0000-4000-8000-000000000011'
      and recipient_user_id = '71000000-0000-4000-8000-000000000013'
  ),
  'expired:2100-01-02 11:40:00+00',
  'the page RPC durably replaces the legacy expiry timestamp with room end time'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || responded_at::text
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000014',
      '81000000-0000-4000-8000-000000000012',
      'accept',
      '2100-01-02 12:00:00+00'
    )
  ),
  'accepted:accepted:2100-01-02 12:00:00+00',
  'the response RPC repairs and accepts a legacy auto-expired active invite directly'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || responded_at::text
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000015',
      '81000000-0000-4000-8000-000000000013',
      'decline',
      '2100-01-02 12:00:00+00'
    )
  ),
  'declined:declined:2100-01-02 10:35:00+00',
  'the response RPC normalizes a legacy explicit decline directly and idempotently'
);

select is(
  public.reconcile_account_inbox_v2(
    '71000000-0000-4000-8000-000000000002',
    '2100-01-02 12:00:00+00'
  ),
  1,
  'v2 repairs one legacy auto-expired recipient while its room is active'
);

select is(
  (
    select status || ':' || coalesce(missed_at::text, '<null>') || ':'
      || coalesce(responded_at::text, '<null>')
    from public.room_invite_recipients
    where invite_id = '81000000-0000-4000-8000-000000000001'
      and recipient_user_id = '71000000-0000-4000-8000-000000000002'
  ),
  'pending:<null>:<null>',
  'repair clears the false missed state without inventing a user response'
);

select is(
  (
    select page->'counts'->>'active_room_invite_count'
    from (
      select public.get_account_inbox_page_v2(
        '71000000-0000-4000-8000-000000000002',
        '2100-01-02 12:00:00+00',
        null,
        null,
        51
      ) as page
    ) as inbox
  ),
  '1',
  'the v2 inbox keeps the repaired legacy invite actionable'
);

select is(
  (
    select entry->>'item_state'
    from jsonb_array_elements(
      public.get_account_inbox_page_v2(
        '71000000-0000-4000-8000-000000000002',
        '2100-01-02 12:00:00+00',
        null,
        null,
        51
      )->'entries'
    ) as entry
    where entry->>'item_id' = '81000000-0000-4000-8000-000000000001'
  ),
  'active',
  'legacy expires_at is compatibility data rather than a v2 product deadline'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || responded_at::text
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000001',
      'accept',
      '2100-01-02 12:00:01+00'
    )
  ),
  'accepted:accepted:2100-01-02 12:00:01+00',
  'an accepted friendship can accept the old still-active invite'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || responded_at::text
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000001',
      'accept',
      '2100-01-02 12:00:02+00'
    )
  ),
  'accepted:accepted:2100-01-02 12:00:01+00',
  'a duplicate accept is idempotent and preserves the first response time'
);

select is(
  (
    select outcome || ':' || recipient_status
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000001',
      'decline',
      '2100-01-02 12:00:03+00'
    )
  ),
  'already_resolved:accepted',
  'the opposite action cannot overwrite an accepted invite'
);

select is(
  (
    select outcome || ':' || recipient_status
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000003',
      '81000000-0000-4000-8000-000000000002',
      'accept',
      '2100-01-02 12:00:00+00'
    )
  ),
  'accepted:accepted',
  'historical room_members and temporary live capacity do not expire an invite'
);

select is(
  public.reconcile_account_inbox_v2(
    '71000000-0000-4000-8000-000000000004',
    '2100-01-02 12:00:00+00'
  ),
  1,
  'room end reconciles one pending recipient exactly once'
);

select is(
  (
    select status || ':' || missed_at::text || ':' || coalesce(responded_at::text, '<null>')
    from public.room_invite_recipients
    where invite_id = '81000000-0000-4000-8000-000000000003'
      and recipient_user_id = '71000000-0000-4000-8000-000000000004'
  ),
  'expired:2100-01-02 11:30:00+00:<null>',
  'room end creates one stable missed transition without pretending the user responded'
);

select is(
  public.reconcile_account_inbox_v2(
    '71000000-0000-4000-8000-000000000004',
    '2100-01-02 12:30:00+00'
  ),
  0,
  'repeated reconciliation does not rewrite a terminal recipient'
);

select is(
  (
    select (entry->>'item_state') || ':' || (entry->>'missed_at')
    from jsonb_array_elements(
      public.get_account_inbox_page_v2(
        '71000000-0000-4000-8000-000000000004',
        '2100-01-02 12:30:00+00',
        null,
        null,
        51
      )->'entries'
    ) as entry
    where entry->>'item_id' = '81000000-0000-4000-8000-000000000003'
  ),
  'missed:2100-01-02T11:30:00+00:00',
  'an ended room appears once as a recent missed invite'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || missed_at::text
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000004',
      '81000000-0000-4000-8000-000000000003',
      'accept',
      '2100-01-02 12:31:00+00'
    )
  ),
  'room_ended:expired:2100-01-02 11:30:00+00',
  'an ended room cannot be accepted and keeps its first missed time'
);

select is(
  (
    select page->'counts'->>'active_room_invite_count'
    from (
      select public.get_account_inbox_page_v2(
        '71000000-0000-4000-8000-000000000005',
        '2100-01-02 12:00:00+00',
        null,
        null,
        51
      ) as page
    ) as inbox
  ),
  '0',
  'a pending invite is not shown as actionable after friendship removal'
);

select is(
  (
    select outcome || ':' || recipient_status
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000005',
      '81000000-0000-4000-8000-000000000004',
      'accept',
      '2100-01-02 12:00:00+00'
    )
  ),
  'friendship_required:pending',
  'friendship removal prevents acceptance without silently resolving the invite'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || responded_at::text
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000005',
      '81000000-0000-4000-8000-000000000004',
      'decline',
      '2100-01-02 12:00:01+00'
    )
  ),
  'declined:declined:2100-01-02 12:00:01+00',
  'the authorized recipient can decline even after friendship removal'
);

select is(
  public.reconcile_account_inbox_v2(
    '71000000-0000-4000-8000-000000000011',
    '2100-01-02 12:00:00+00'
  ),
  1,
  'room end still durably reconciles a blocked sender invite'
);

select is(
  (
    select jsonb_array_length(page->'entries') || ':'
      || (page->'counts'->>'unseen_count')
    from (
      select public.get_account_inbox_page_v2(
        '71000000-0000-4000-8000-000000000011',
        '2100-01-02 12:00:00+00',
        null,
        null,
        51
      ) as page
    ) as inbox
  ),
  '0:0',
  'a blocked sender never reappears through missed details or unseen counts'
);

select is(
  (
    select outcome || ':' || coalesce(room_id, '<null>')
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000008',
      '81000000-0000-4000-8000-000000000004',
      'accept',
      '2100-01-02 12:00:00+00'
    )
  ),
  'not_found:<null>',
  'a foreign recipient receives a privacy-safe not-found outcome'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || room_id
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000006',
      '81000000-0000-4000-8000-000000000005',
      'accept',
      '2100-01-02 12:00:00+00'
    )
  ),
  'accepted:accepted:invite-lifecycle-group',
  'group recipients use the same atomic acceptance authority as direct recipients'
);

select is(
  public.reconcile_account_inbox_v2(
    '71000000-0000-4000-8000-000000000010',
    '2100-01-02 12:00:00+00'
  ),
  1,
  'v2 normalizes one legacy explicit decline without resurrecting it'
);

select is(
  (
    select status || ':' || responded_at::text || ':'
      || coalesce(missed_at::text, '<null>')
    from public.room_invite_recipients
    where invite_id = '81000000-0000-4000-8000-000000000008'
      and recipient_user_id = '71000000-0000-4000-8000-000000000010'
  ),
  'declined:2100-01-02 10:30:00+00:<null>',
  'legacy explicit decline preserves its response time and clears false missed state'
);

select is(
  jsonb_array_length(
    public.get_account_inbox_page_v2(
      '71000000-0000-4000-8000-000000000010',
      '2100-01-02 12:00:00+00',
      null,
      null,
      51
    )->'entries'
  ),
  0,
  'a normalized legacy decline is not shown as active or missed'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || responded_at::text
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000010',
      '81000000-0000-4000-8000-000000000008',
      'decline',
      '2100-01-02 12:00:01+00'
    )
  ),
  'declined:declined:2100-01-02 10:30:00+00',
  'retrying a legacy decline is idempotent after normalization'
);

select is(
  (
    select outcome || ':' || recipient_status
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000010',
      '81000000-0000-4000-8000-000000000008',
      'accept',
      '2100-01-02 12:00:02+00'
    )
  ),
  'already_resolved:declined',
  'an accept cannot resurrect a legacy explicit decline'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || responded_at::text
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000007',
      '81000000-0000-4000-8000-000000000006',
      'decline',
      '2100-01-02 12:00:10+00'
    )
  ),
  'declined:declined:2100-01-02 12:00:10+00',
  'a pending direct invite can be declined atomically'
);

select is(
  (
    select outcome || ':' || recipient_status || ':' || responded_at::text
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000007',
      '81000000-0000-4000-8000-000000000006',
      'decline',
      '2100-01-02 12:00:11+00'
    )
  ),
  'declined:declined:2100-01-02 12:00:10+00',
  'a duplicate decline is idempotent and preserves the first response time'
);

select is(
  (
    select outcome || ':' || recipient_status
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000007',
      '81000000-0000-4000-8000-000000000006',
      'accept',
      '2100-01-02 12:00:12+00'
    )
  ),
  'already_resolved:declined',
  'accept cannot overwrite a previously declined invite'
);

select is(
  jsonb_array_length(
    public.get_account_inbox_page_v2(
      '71000000-0000-4000-8000-000000000009',
      '2100-01-02 12:00:00+00',
      null,
      null,
      51
    )->'entries'
  ),
  1,
  'a missed invite is still present at the inclusive 24-hour boundary'
);

select is(
  jsonb_array_length(
    public.get_account_inbox_page_v2(
      '71000000-0000-4000-8000-000000000009',
      '2100-01-02 12:00:01+00',
      null,
      null,
      51
    )->'entries'
  ),
  0,
  'a missed invite leaves the inbox immediately after the 24-hour window'
);

reset role;

set role anon;
select throws_like(
  $$
    select *
    from public.respond_room_invite_v2(
      '71000000-0000-4000-8000-000000000002',
      '81000000-0000-4000-8000-000000000001',
      'accept',
      '2100-01-02 12:00:00+00'
    )
  $$,
  '%permission denied for function respond_room_invite_v2%',
  'anon cannot call the room-invite response authority'
);
reset role;

create or replace function pg_temp.invite_response_waits_for_lock(
  p_application_name text,
  p_timeout_ms integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_deadline timestamptz := pg_catalog.clock_timestamp()
    + p_timeout_ms * interval '1 millisecond';
begin
  loop
    if exists (
      select 1
      from pg_catalog.pg_stat_activity
      where application_name = p_application_name
        and wait_event_type = 'Lock'
    ) then
      return true;
    end if;

    if pg_catalog.clock_timestamp() >= v_deadline then
      return false;
    end if;

    perform pg_catalog.pg_sleep(0.02);
  end loop;
end;
$$;

select extensions.dblink_connect(
  'invite_response_setup',
  pg_catalog.format('host=%s port=%s dbname=%L user=postgres password=postgres application_name=invite_response_setup', pg_catalog.inet_server_addr(), pg_catalog.inet_server_port(), pg_catalog.current_database())
);
select extensions.dblink_exec(
  'invite_response_setup',
  $setup$
    delete from public.room_invite_recipients
    where invite_id = '81900000-0000-4000-8000-000000000001';
    delete from public.room_invites
    where id = '81900000-0000-4000-8000-000000000001';
    delete from public.room_members where room_id = 'invite-lifecycle-concurrent';
    delete from public.rooms where room_id = 'invite-lifecycle-concurrent';
    delete from public.friendships
    where id = '73900000-0000-4000-8000-000000000001';
    delete from public.profiles
    where user_id in (
      '71900000-0000-4000-8000-000000000001',
      '71900000-0000-4000-8000-000000000002'
    );
    delete from public.users
    where id in (
      '71900000-0000-4000-8000-000000000001',
      '71900000-0000-4000-8000-000000000002'
    );

    insert into public.users (id, email, display_name)
    values
      ('71900000-0000-4000-8000-000000000001', 'invite-concurrent-host@example.test', 'Concurrent Host'),
      ('71900000-0000-4000-8000-000000000002', 'invite-concurrent-recipient@example.test', 'Concurrent Recipient');
    insert into public.friendships (
      id,
      requester_user_id,
      addressee_user_id,
      status,
      requested_at,
      responded_at,
      updated_at
    ) values (
      '73900000-0000-4000-8000-000000000001',
      '71900000-0000-4000-8000-000000000001',
      '71900000-0000-4000-8000-000000000002',
      'accepted',
      '2099-01-01 00:00:00+00',
      '2099-01-01 00:00:01+00',
      '2099-01-01 00:00:01+00'
    );
    insert into public.rooms (room_id, host_user_id, status, created_at)
    values (
      'invite-lifecycle-concurrent',
      '71900000-0000-4000-8000-000000000001',
      'live',
      '2099-12-31 00:00:00+00'
    );
    insert into public.room_invites (
      id,
      room_id,
      sender_user_id,
      target_kind,
      created_at,
      expires_at
    ) values (
      '81900000-0000-4000-8000-000000000001',
      'invite-lifecycle-concurrent',
      '71900000-0000-4000-8000-000000000001',
      'direct',
      '2100-01-02 10:00:00+00',
      '2100-01-03 00:00:00+00'
    );
    insert into public.room_invite_recipients (
      invite_id,
      recipient_user_id,
      status,
      created_at,
      updated_at
    ) values (
      '81900000-0000-4000-8000-000000000001',
      '71900000-0000-4000-8000-000000000002',
      'pending',
      '2100-01-02 10:00:00+00',
      '2100-01-02 10:00:00+00'
    );
  $setup$
);
select extensions.dblink_disconnect('invite_response_setup');

select extensions.dblink_connect(
  'invite_response_accept',
  pg_catalog.format('host=%s port=%s dbname=%L user=postgres password=postgres application_name=invite_response_accept', pg_catalog.inet_server_addr(), pg_catalog.inet_server_port(), pg_catalog.current_database())
);
select extensions.dblink_connect(
  'invite_response_decline',
  pg_catalog.format('host=%s port=%s dbname=%L user=postgres password=postgres application_name=invite_response_decline', pg_catalog.inet_server_addr(), pg_catalog.inet_server_port(), pg_catalog.current_database())
);
select extensions.dblink_exec('invite_response_accept', 'begin');
select extensions.dblink_exec('invite_response_accept', 'set role service_role');
select is(
  (
    select outcome || ':' || recipient_status
    from extensions.dblink(
      'invite_response_accept',
      $sql$
        select outcome, invite_id, room_id, recipient_status, responded_at, missed_at
        from public.respond_room_invite_v2(
          '71900000-0000-4000-8000-000000000002',
          '81900000-0000-4000-8000-000000000001',
          'accept',
          '2100-01-02 12:00:00+00'
        )
      $sql$
    ) as result(
      outcome text,
      invite_id uuid,
      room_id text,
      recipient_status text,
      responded_at timestamptz,
      missed_at timestamptz
    )
  ),
  'accepted:accepted',
  'the first response transaction accepts while retaining its row lock'
);

select extensions.dblink_exec('invite_response_decline', 'begin');
select extensions.dblink_exec('invite_response_decline', 'set role service_role');
select ok(
  extensions.dblink_send_query(
    'invite_response_decline',
    $sql$
      select outcome, invite_id, room_id, recipient_status, responded_at, missed_at
      from public.respond_room_invite_v2(
        '71900000-0000-4000-8000-000000000002',
        '81900000-0000-4000-8000-000000000001',
        'decline',
        '2100-01-02 12:00:00+00'
      )
    $sql$
  ) = 1,
  'a second device starts a concurrent opposite response'
);
select ok(
  pg_temp.invite_response_waits_for_lock('invite_response_decline', 5000),
  'the competing response waits on the recipient row lock'
);

select extensions.dblink_exec('invite_response_accept', 'commit');
select is(
  (
    select outcome || ':' || recipient_status
    from extensions.dblink_get_result('invite_response_decline')
      as result(
        outcome text,
        invite_id uuid,
        room_id text,
        recipient_status text,
        responded_at timestamptz,
        missed_at timestamptz
      )
  ),
  'already_resolved:accepted',
  'the concurrent loser observes the committed terminal winner'
);
select *
from extensions.dblink_get_result('invite_response_decline')
  as drained(
    outcome text,
    invite_id uuid,
    room_id text,
    recipient_status text,
    responded_at timestamptz,
    missed_at timestamptz
  );
select extensions.dblink_exec('invite_response_decline', 'commit');
select extensions.dblink_disconnect('invite_response_accept');
select extensions.dblink_disconnect('invite_response_decline');

select is(
  (
    select status || ':' || responded_at::text
    from public.room_invite_recipients
    where invite_id = '81900000-0000-4000-8000-000000000001'
      and recipient_user_id = '71900000-0000-4000-8000-000000000002'
  ),
  'accepted:2100-01-02 12:00:00+00',
  'concurrent accept versus decline leaves exactly one durable terminal response'
);

select extensions.dblink_connect(
  'invite_response_cleanup',
  pg_catalog.format('host=%s port=%s dbname=%L user=postgres password=postgres application_name=invite_response_cleanup', pg_catalog.inet_server_addr(), pg_catalog.inet_server_port(), pg_catalog.current_database())
);
select extensions.dblink_exec(
  'invite_response_cleanup',
  $cleanup$
    delete from public.room_invite_recipients
    where invite_id = '81900000-0000-4000-8000-000000000001';
    delete from public.room_invites
    where id = '81900000-0000-4000-8000-000000000001';
    delete from public.room_members where room_id = 'invite-lifecycle-concurrent';
    delete from public.rooms where room_id = 'invite-lifecycle-concurrent';
    delete from public.friendships
    where id = '73900000-0000-4000-8000-000000000001';
    delete from public.profiles
    where user_id in (
      '71900000-0000-4000-8000-000000000001',
      '71900000-0000-4000-8000-000000000002'
    );
    delete from public.users
    where id in (
      '71900000-0000-4000-8000-000000000001',
      '71900000-0000-4000-8000-000000000002'
    );
  $cleanup$
);
select extensions.dblink_disconnect('invite_response_cleanup');

select * from finish();
rollback;
