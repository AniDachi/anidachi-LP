create extension if not exists pgtap with schema extensions;

begin;

select plan(2);

with legacy_tables(relation_name) as (
  select unnest(array[
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
    from legacy_tables
  ),
  'a fresh migration replay grants service_role CRUD on every legacy application table'
);

with legacy_routines(signature) as (
  select unnest(array[
    'public.increment_host_usage(uuid,date,integer)',
    'public.prepare_friendship_inbox_state()',
    'public.prepare_room_invite_recipient_inbox_state()',
    'public.refresh_watch_history_title_summary_v2(uuid,bigint,text,text)',
    'public.sync_watch_history_session_summaries_v2()',
    'public.sync_watch_history_title_summary_delete_v2()',
    'public.sync_watch_history_title_summary_v2()',
    'public.sync_watch_history_user_session_summary_v2()'
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
    from legacy_routines
  ),
  'a fresh migration replay grants service_role execute on every legacy server routine'
);

select * from finish();

rollback;
