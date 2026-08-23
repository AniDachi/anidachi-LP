create extension if not exists pgtap with schema extensions;

begin;

select plan(2);

with server_tables(relation_name) as (
  select unnest(array[
    'active_room_sessions',
    'billing_customers',
    'devices',
    'friend_group_members',
    'friend_groups',
    'friend_invite_links',
    'friendships',
    'profiles',
    'recent_people_hidden',
    'refresh_tokens',
    'room_invite_recipients',
    'room_invites',
    'room_members',
    'rooms',
    'stripe_events',
    'subscriptions',
    'usage_daily',
    'user_tracked_titles',
    'users',
    'watch_progress_checkpoints',
    'watch_session_participants',
    'watch_sessions'
  ]::text[])
)
select ok(
  (
    select bool_and(
      pg_catalog.has_table_privilege(
        'service_role',
        pg_catalog.format('public.%I', relation_name),
        'SELECT'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        pg_catalog.format('public.%I', relation_name),
        'INSERT'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        pg_catalog.format('public.%I', relation_name),
        'UPDATE'
      )
      and pg_catalog.has_table_privilege(
        'service_role',
        pg_catalog.format('public.%I', relation_name),
        'DELETE'
      )
    )
    from server_tables
  ),
  'a fresh migration replay grants service_role CRUD on every server application table'
);

with server_routines(signature) as (
  select unnest(array[
    'public.claim_active_room_session_v1(uuid,text,text,text)',
    'public.create_room_with_active_session_v1(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean)',
    'public.end_host_lobby_for_active_session_v1(uuid,text,text,timestamptz)',
    'public.increment_host_usage(uuid,date,integer)',
    'public.prepare_friendship_inbox_state()',
    'public.prepare_room_invite_recipient_inbox_state()',
    'public.refresh_watch_history_title_summary_v2(uuid,bigint,text,text)',
    'public.sync_watch_history_session_summaries_v2()',
    'public.sync_watch_history_title_summary_delete_v2()',
    'public.sync_watch_history_title_summary_v2()',
    'public.sync_watch_history_user_session_summary_v2()',
    'public.release_active_room_session_v1(uuid,text,text)'
  ]::text[])
)
select ok(
  (
    select bool_and(
      pg_catalog.has_function_privilege(
        'service_role',
        signature,
        'EXECUTE'
      )
    )
    from server_routines
  ),
  'a fresh migration replay grants service_role execute on every required server routine'
);

select * from finish();

rollback;
