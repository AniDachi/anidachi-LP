-- Add account contacts only to the private CRM reader. Keep v1 for web rollback.
set lock_timeout='5s';
set statement_timeout='30s';

create function public.list_uninstall_feedback_v2(
  p_before_created_at timestamptz default null,
  p_before_submission_id uuid default null
) returns table(submission_id uuid, reason text, note text, created_at timestamptz, email text, discord_id text)
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
begin
  if (p_before_created_at is null) <> (p_before_submission_id is null)
    or (p_before_created_at is not null and not pg_catalog.isfinite(p_before_created_at)) then
    raise exception 'FEEDBACK_CURSOR_INVALID' using errcode='22023';
  end if;
  return query
    select f.submission_id, f.reason, f.note, f.created_at,
      nullif(pg_catalog.btrim(u.email), ''), nullif(pg_catalog.btrim(u.discord_id), '')
    from (
      select feedback.submission_id, feedback.reason, feedback.note, feedback.created_at, feedback.user_id
      from public.uninstall_feedback feedback
      where p_before_created_at is null
        or (feedback.created_at, feedback.submission_id) < (p_before_created_at, p_before_submission_id)
      order by feedback.created_at desc, feedback.submission_id desc
      limit 51
    ) f
    left join public.users u on u.id = f.user_id
    order by f.created_at desc, f.submission_id desc;
end $$;
revoke all on function public.list_uninstall_feedback_v2(timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.list_uninstall_feedback_v2(timestamptz,uuid) to service_role;
comment on function public.list_uninstall_feedback_v2(timestamptz,uuid) is
  'CRM-only feedback with current linked account email and Discord ID, nullable when unavailable. Website must verify its CRM session before calling. No internal user IDs or anti-abuse hashes.';

reset lock_timeout;
reset statement_timeout;
