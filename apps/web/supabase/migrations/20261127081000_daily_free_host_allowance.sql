-- Prepare both budget sizes. Switch the staging policy only after compatible
-- Worker, Web and extension builds are available. Existing usage is cumulative.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.hosting_commercial_policy
  add column free_daily_host_seconds integer not null default 1200
    check (free_daily_host_seconds in (1200, 1800));

create function anidachi_room_private.free_daily_budget_seconds()
returns integer language sql stable set search_path = '' as $$
  select free_daily_host_seconds from public.hosting_commercial_policy where singleton
$$;
create function anidachi_room_private.accepts_daily_host_client(client_version integer)
returns boolean language sql stable set search_path = '' as $$
  select coalesce(client_version = 2 or
    (client_version = 1 and anidachi_room_private.free_daily_budget_seconds() = 1200), false)
$$;
revoke all on function anidachi_room_private.free_daily_budget_seconds(),
  anidachi_room_private.accepts_daily_host_client(integer) from public, anon, authenticated;

-- Grandfather today's 20-minute claim. A distinct allowance gets its own
-- warning once. Original claims, claims' IDs and consumption stay intact.
alter table public.free20_daily_warning_claims
  add column budget_seconds integer not null default 1200 check (budget_seconds in (1200,1800)),
  drop constraint free20_daily_warning_claims_pkey,
  add primary key (user_id, utc_day, budget_seconds);

-- Patch the current function bodies in place. These functions also have
-- independently released room/admission changes. Assert every edited anchor.
do $migration$
declare
  edit record;
  definition text;
  policy_value constant text := 'anidachi_room_private.free_daily_budget_seconds()';
  supported constant text := 'not anidachi_room_private.accepts_daily_host_client(p_free20_client_version)';
  create_core constant text := 'anidachi_room_private.create_room_with_active_session_v2(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer)';
  create_entry constant text := 'public.create_room_with_active_session_v4(uuid,text,text,text,text,text,text,bigint,text,text,text,integer,integer,boolean,boolean,integer,integer)';
  warning constant text := 'public.claim_free20_daily_warning_v1(uuid,jsonb,jsonb)';
begin
  for edit in select * from (values
    ('public.resolve_free20_hosting_access_v1(uuid)', '1200', 'policy.free_daily_host_seconds', 2),
    ('public.resolve_free20_hosting_access_v1(uuid)', '''usedSeconds'',used,', '''usedSeconds'',used,''budgetSeconds'',policy.free_daily_host_seconds,', 1),
    ('public.resolve_free20_context_access_v1(uuid,text,text)', '1200', 'policy.free_daily_host_seconds', 2),
    ('public.require_room_hosting_admission_v1(text,uuid)', '>=1200', '>='||policy_value, 1),
    ('public.renew_room_media_lease_v2(text)', '>=1200', '>='||policy_value, 1),
    ('anidachi_room_private.require_free20_admission_context(uuid,text)', '>=1200', '>='||policy_value, 2),
    -- Preserve the original strict account DTO while running the 20-minute policy.
    ('public.read_free20_account_status_v1(uuid)', '''assignment'',assignment);',
      '''assignment'',assignment) || case when policy.free_daily_host_seconds = 1200 then ''{}''::jsonb else jsonb_build_object(''budgetSeconds'',policy.free_daily_host_seconds) end;', 1),
    (create_core, 'p_free20_client_version is distinct from 1', supported, 1),
    (create_entry, 'p_free20_client_version is distinct from 1', supported, 1),
    ('anidachi_room_private.claim_active_room_session_v2(uuid,text,text,text,integer)', 'p_free20_client_version is distinct from 1', supported, 1),
    (warning, '''1200''::jsonb', 'to_jsonb('||policy_value||')', 1),
    (warning, 'not between 0 and 1200', 'not between 0 and (live_access->>''budgetSeconds'')::integer', 1),
    (warning, '::numeric<>1200', '::numeric<>(live_access->>''budgetSeconds'')::integer', 1),
    (warning, 'utc_day,claimed_at)', 'utc_day,claimed_at,budget_seconds)', 1),
    (warning, 'values(p_user_id,day,at_time) on conflict(user_id,utc_day)',
      'values(p_user_id,day,at_time,(live_access->>''budgetSeconds'')::integer) on conflict(user_id,utc_day,budget_seconds)', 1)
  ) as edits(signature, anchor, replacement, expected)
  loop
    definition := pg_get_functiondef(edit.signature::regprocedure);
    if (length(definition) - length(replace(definition,edit.anchor,''))) / length(edit.anchor) <> edit.expected then
      raise exception 'Unexpected definition of % for daily allowance migration (%)',edit.signature,edit.anchor;
    end if;
    execute replace(definition,edit.anchor,edit.replacement);
  end loop;
end $migration$;
commit;
