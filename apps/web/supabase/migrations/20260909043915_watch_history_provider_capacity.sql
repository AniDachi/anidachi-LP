-- Admission limits only. Never trim existing history, episodes, or receipts.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';

-- Both the personal writer and the still-enabled legacy writer enter this core.
-- Preserve its identity, receipt, deletion, and ordering checks before admission.
-- The user advisory lock and settings FOR UPDATE above this point serialize the
-- last available slot with other writes and manual deletions for this account.
do $migration$
declare
  body text;
  anchor text := E'  if found and normalized_observed_at < existing_progress.observed_at then\n    raise exception \'watch_history_observation_stale\' using errcode = \'P0001\';\n  end if;';
  guard text := $guard$

  -- Every episode of an existing Crunchyroll title shares its existing slot.
  -- Accounts already above the limit may keep updating every retained title.
  if not exists (
    select 1 from public.watch_episode_progress p
    where p.user_id = p_user_id and p.history_generation = account_generation
      and p.provider = provider_value and p.title_key = title_key_value
  ) and (
    select count(distinct p.title_key) from public.watch_episode_progress p
    where p.user_id = p_user_id and p.history_generation = account_generation
      and p.provider = provider_value
  ) >= (case provider_value when 'youtube' then 100 when 'crunchyroll' then 200 end)
  then
    raise exception 'HISTORY_LIMIT_REACHED' using errcode = 'P0001';
  end if;
$guard$;
begin
  body := pg_get_functiondef('anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)'::regprocedure);
  if position('HISTORY_LIMIT_REACHED' in body) <> 0
    or (length(body) - length(replace(body, anchor, ''))) <> length(anchor)
    or position('pg_catalog.pg_advisory_xact_lock' in body) = 0
    or position('for update;' in body) = 0
  then
    raise exception 'watch_history_capacity_core_anchor_mismatch';
  end if;
  execute replace(body, anchor, anchor || guard);
end $migration$;
revoke all on function anidachi_history_private.apply_watch_progress_v3_canonical(uuid,jsonb,jsonb,timestamptz)
  from public, anon, authenticated, service_role;

-- Server-authenticated identity only. A snapshot is available on every plan,
-- including Free and legacy over-limit accounts; counts are never capped.
create function public.get_watch_history_capacity_v1(
  p_user_id uuid,
  p_history_generation bigint default null
) returns jsonb
language plpgsql security invoker set search_path = ''
set lock_timeout = '5s' set statement_timeout = '15s' as $$
declare
  generation bigint;
  youtube_used bigint;
  crunchyroll_used bigint;
begin
  if p_user_id is null or not exists(select 1 from public.users where id = p_user_id)
    then raise exception 'HISTORY_ACCESS_UNAVAILABLE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  -- One snapshot binds current generation and both provider counts. No settings
  -- row is created just because an account opens its capacity display.
  select coalesce(s.history_generation, 1),
    count(distinct p.title_key) filter (where p.provider = 'youtube'),
    count(distinct p.title_key) filter (where p.provider = 'crunchyroll')
  into generation, youtube_used, crunchyroll_used
  from (select 1) singleton
  left join public.user_watch_settings s on s.user_id = p_user_id
  left join public.watch_episode_progress p on p.user_id = p_user_id
    and p.history_generation = coalesce(s.history_generation, 1)
  group by s.history_generation;
  if p_history_generation is not null and p_history_generation is distinct from generation
    then raise exception 'watch_history_generation_mismatch'; end if;
  return jsonb_build_object(
    'capacityVersion', 1, 'ownerUserId', p_user_id, 'accountGeneration', generation,
    'serverTime', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'providers', jsonb_build_object(
      'youtube', jsonb_build_object('used', youtube_used, 'limit', 100),
      'crunchyroll', jsonb_build_object('used', crunchyroll_used, 'limit', 200)
    )
  );
end $$;
revoke all on function public.get_watch_history_capacity_v1(uuid,bigint) from public, anon, authenticated;
grant execute on function public.get_watch_history_capacity_v1(uuid,bigint) to service_role;
commit;
