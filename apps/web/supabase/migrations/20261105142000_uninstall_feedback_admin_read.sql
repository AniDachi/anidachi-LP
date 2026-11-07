-- Private, bounded projection for the existing authenticated CRM inbox.
set lock_timeout='5s';
set statement_timeout='30s';
create index uninstall_feedback_created_id_idx
  on public.uninstall_feedback (created_at desc, submission_id desc);

create function public.list_uninstall_feedback_v1(
  p_before_created_at timestamptz default null,
  p_before_submission_id uuid default null
) returns table(submission_id uuid, reason text, note text, created_at timestamptz)
language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
begin
  if (p_before_created_at is null) <> (p_before_submission_id is null)
    or (p_before_created_at is not null and not pg_catalog.isfinite(p_before_created_at)) then
    raise exception 'FEEDBACK_CURSOR_INVALID' using errcode='22023';
  end if;
  return query
    select f.submission_id, f.reason, f.note, f.created_at
    from public.uninstall_feedback f
    where p_before_created_at is null
      or (f.created_at, f.submission_id) < (p_before_created_at, p_before_submission_id)
    order by f.created_at desc, f.submission_id desc
    limit 51;
end $$;
revoke all on function public.list_uninstall_feedback_v1(timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.list_uninstall_feedback_v1(timestamptz,uuid) to service_role;
comment on function public.list_uninstall_feedback_v1(timestamptz,uuid) is
  'CRM read-only feedback projection, 50 rows plus one lookahead. Website must verify its CRM session before calling. No account identifiers or anti-abuse hashes.';
reset lock_timeout;
reset statement_timeout;
