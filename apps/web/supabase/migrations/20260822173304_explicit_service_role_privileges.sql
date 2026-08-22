-- Supabase's current clean-project defaults no longer expose new public-schema
-- objects to Data API roles automatically. Existing AniDachi projects already
-- grant these privileges, but a fresh migration replay must establish the
-- server-only access model explicitly instead of relying on project defaults.
grant select, insert, update, delete on table
  public.billing_customers,
  public.devices,
  public.friend_group_members,
  public.friend_groups,
  public.friend_invite_links,
  public.friendships,
  public.profiles,
  public.recent_people_hidden,
  public.refresh_tokens,
  public.room_invite_recipients,
  public.room_invites,
  public.room_members,
  public.rooms,
  public.stripe_events,
  public.subscriptions,
  public.usage_daily,
  public.user_tracked_titles,
  public.users,
  public.watch_progress_checkpoints,
  public.watch_session_participants,
  public.watch_sessions
to service_role;

-- Current clean-project defaults also revoke implicit routine execution. Keep
-- the legacy server RPC and trigger helpers aligned with the existing staging
-- authority instead of depending on project-creation-era defaults.
grant execute on function
  public.increment_host_usage(uuid, date, integer),
  public.prepare_friendship_inbox_state(),
  public.prepare_room_invite_recipient_inbox_state(),
  public.refresh_watch_history_title_summary_v2(uuid, bigint, text, text),
  public.sync_watch_history_session_summaries_v2(),
  public.sync_watch_history_title_summary_delete_v2(),
  public.sync_watch_history_title_summary_v2(),
  public.sync_watch_history_user_session_summary_v2()
to service_role;
