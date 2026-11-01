-- Dormant presentation authorization only. Never grants or consumes host time.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.free20_daily_warning_claims (
 user_id uuid not null references public.users(id) on delete cascade,
 utc_day date not null,
 claimed_at timestamptz not null default clock_timestamp(),
 claim_id uuid not null default gen_random_uuid(),
 primary key(user_id,utc_day)
);
alter table public.free20_daily_warning_claims enable row level security;
revoke all on public.free20_daily_warning_claims from public,anon,authenticated,service_role;

create function public.claim_free20_daily_warning_v1(p_user_id uuid,p_expected_context jsonb,p_live jsonb)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='3s' set statement_timeout='5s' as $$
declare
 authority jsonb; expected_assignment jsonb; live_access jsonb; item jsonb;
 field text; day date; reset_ms numeric; at_time timestamptz; now_ms numeric;
 server_ms bigint; until_ms bigint; remaining_ms numeric; inserted_id uuid;
 result jsonb;
begin
 -- Strict internal DTO validation, including JSON types, bounded counters and
 -- all keys. The browser never supplies either DTO. Raw ISO authority dates
 -- are normalized to integer epoch-ms by Web; SQL truncates identically.
 begin
  if p_user_id is null or jsonb_typeof(p_expected_context) is distinct from 'object' or
   pg_column_size(p_expected_context)>8192 or
   not p_expected_context ?& array['ownerUserId','accountGeneration','accessEpoch','planCode','grant','utcDay','serverTime','refreshBy','resetAt','assignment'] or
   p_expected_context-array['ownerUserId','accountGeneration','accessEpoch','planCode','grant','utcDay','serverTime','refreshBy','resetAt','assignment']<>'{}'::jsonb or
   p_expected_context->'ownerUserId' is distinct from to_jsonb(p_user_id::text) or
   p_expected_context->'planCode' is distinct from '"free"'::jsonb or p_expected_context->'grant' is distinct from 'null'::jsonb or
   jsonb_typeof(p_expected_context->'utcDay') is distinct from 'string' or
   (p_expected_context->>'utcDay')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid context'; end if;
  day:=(p_expected_context->>'utcDay')::date;
  if day::text<>p_expected_context->>'utcDay' then raise exception 'invalid day'; end if;
  reset_ms:=extract(epoch from ((day+1)::timestamp at time zone 'UTC'))*1000;
  foreach field in array array['accountGeneration','accessEpoch','serverTime','refreshBy','resetAt'] loop
   item:=p_expected_context->field;
   if jsonb_typeof(item) is distinct from 'number' or (item::text)::numeric<>trunc((item::text)::numeric) or
    (item::text)::numeric<0 or (item::text)::numeric>8640000000000000 then raise exception 'invalid number'; end if;
  end loop;
  if (p_expected_context->>'accountGeneration')::numeric<1 or (p_expected_context->>'accessEpoch')::numeric<0 or
   (p_expected_context->>'resetAt')::numeric<>reset_ms or
   (p_expected_context->>'serverTime')::numeric<reset_ms-86400000 or (p_expected_context->>'serverTime')::numeric>=reset_ms or
   (p_expected_context->>'refreshBy')::numeric<=(p_expected_context->>'serverTime')::numeric or
   (p_expected_context->>'refreshBy')::numeric>least(reset_ms,(p_expected_context->>'serverTime')::numeric+300000) then raise exception 'invalid window'; end if;
  expected_assignment:=p_expected_context->'assignment';
  if jsonb_typeof(expected_assignment) is distinct from 'object' or
   not expected_assignment ?& array['roomId','roomGeneration','role','sessionId','hostingTimeMode','status','hostUserId'] or
   expected_assignment-array['roomId','roomGeneration','role','sessionId','hostingTimeMode','status','hostUserId']<>'{}'::jsonb or
   expected_assignment->'hostUserId' is distinct from to_jsonb(p_user_id::text) or
   expected_assignment->'roomGeneration' is distinct from '1'::jsonb or
   expected_assignment->'role' is distinct from '"host"'::jsonb or
   expected_assignment->'hostingTimeMode' is distinct from '"daily_free20"'::jsonb or
   jsonb_typeof(expected_assignment->'status') is distinct from 'string' or
   expected_assignment->'status' not in ('"lobby"'::jsonb,'"live"'::jsonb) then raise exception 'invalid assignment'; end if;
  foreach field in array array['roomId','sessionId'] loop
   if jsonb_typeof(expected_assignment->field) is distinct from 'string' or length(expected_assignment->>field) not between 1 and 128 then raise exception 'invalid assignment string'; end if;
  end loop;
  if jsonb_typeof(p_live) is distinct from 'object' or pg_column_size(p_live)>8192 or
   not p_live ?& array['liveStatusVersion','ownerUserId','roomId','roomGeneration','utcDay','serverTime','validUntil','access'] or
   p_live-array['liveStatusVersion','ownerUserId','roomId','roomGeneration','utcDay','serverTime','validUntil','access']<>'{}'::jsonb or
   p_live->'liveStatusVersion' is distinct from '1'::jsonb or
   p_live->'ownerUserId' is distinct from p_expected_context->'ownerUserId' or
   p_live->'roomId' is distinct from expected_assignment->'roomId' or
   p_live->'roomGeneration' is distinct from expected_assignment->'roomGeneration' or
   p_live->'utcDay' is distinct from p_expected_context->'utcDay' then raise exception 'invalid live binding'; end if;
  foreach field in array array['serverTime','validUntil'] loop
   item:=p_live->field;
   if jsonb_typeof(item) is distinct from 'number' or (item::text)::numeric<>trunc((item::text)::numeric) or
    (item::text)::numeric<0 or (item::text)::numeric>8640000000000000 then raise exception 'invalid live number'; end if;
  end loop;
  if (p_live->>'serverTime')::numeric<(p_expected_context->>'serverTime')::numeric or
   (p_live->>'validUntil')::numeric<=(p_live->>'serverTime')::numeric or
   (p_live->>'validUntil')::numeric>least(reset_ms,(p_live->>'serverTime')::numeric+300000) then raise exception 'invalid live window'; end if;
  live_access:=p_live->'access';
  if jsonb_typeof(live_access) is distinct from 'object' or
   not live_access ?& array['kind','budgetSeconds','usedSeconds','remainingSeconds','metering'] or
   live_access-array['kind','budgetSeconds','usedSeconds','remainingSeconds','metering']<>'{}'::jsonb or
   live_access->'kind' is distinct from '"daily_free"'::jsonb or live_access->'budgetSeconds' is distinct from '1200'::jsonb or
   jsonb_typeof(live_access->'metering') is distinct from 'boolean' then raise exception 'invalid access'; end if;
  foreach field in array array['usedSeconds','remainingSeconds'] loop
   item:=live_access->field;
   if jsonb_typeof(item) is distinct from 'number' or (item::text)::numeric<>trunc((item::text)::numeric) or
    (item::text)::numeric not between 0 and 1200 then raise exception 'invalid seconds'; end if;
  end loop;
  if (live_access->>'usedSeconds')::numeric+(live_access->>'remainingSeconds')::numeric<>1200 then raise exception 'invalid total'; end if;
 exception when others then raise exception 'HOSTING_WARNING_UNAVAILABLE';
 end;

 -- Canonical resolver holds the existing policy/account locks until this
 -- transaction ends. Its established lazy plan/history reconciliation is
 -- allowed; it is not new warning-specific entitlement or quota mutation.
 authority:=public.read_free20_account_status_v1(p_user_id);
 if authority='{"enabled":false}'::jsonb then raise exception 'FREE20_DISABLED'; end if;
 at_time:=clock_timestamp(); -- after all lock waits, never transaction now()
 now_ms:=extract(epoch from at_time)*1000;
 server_ms:=floor(now_ms)::bigint;
 if authority->'ownerUserId' is distinct from p_expected_context->'ownerUserId' or
  authority->'accountGeneration' is distinct from p_expected_context->'accountGeneration' or
  (at_time at time zone 'UTC')::date<>day or
  floor(extract(epoch from (authority->>'resetAt')::timestamptz)*1000)<>reset_ms then
  raise exception 'HOSTING_WARNING_CONTEXT_CHANGED';
 end if;
 if (p_expected_context->>'serverTime')::numeric>now_ms or (p_live->>'serverTime')::numeric>now_ms or
  (p_expected_context->>'refreshBy')::numeric<=now_ms or (p_live->>'validUntil')::numeric<=now_ms or
  (authority->>'refreshBy')::timestamptz<=at_time then raise exception 'HOSTING_WARNING_UNAVAILABLE'; end if;
 until_ms:=floor(least(now_ms+10000,reset_ms,(p_expected_context->>'refreshBy')::numeric,
  extract(epoch from (authority->>'refreshBy')::timestamptz)*1000,(p_live->>'validUntil')::numeric))::bigint;
 result:=jsonb_build_object('hostingWarningVersion',1,'ownerUserId',p_user_id,
  'roomId',p_live->>'roomId','roomGeneration',1,'utcDay',day::text,
  'serverTime',server_ms,'validUntil',until_ms);
 -- Authoritatively ineligible after the DO read: no marker, even when a paid
 -- change advanced accessEpoch. Unknown authority still raises, never Free.
 if authority->>'planCode' in ('plus','pro') or authority->'assignment'='null'::jsonb or
  authority#>>'{assignment,role}'='member' or authority#>>'{assignment,status}'='ended' or
  authority#>'{assignment,hostingTimeMode}'='null'::jsonb then
  return result||jsonb_build_object('decision','not_eligible');
 end if;
 if authority->'planCode' is distinct from '"free"'::jsonb or authority->'grant' is distinct from 'null'::jsonb then
  raise exception 'HOSTING_WARNING_UNAVAILABLE';
 end if;
 if authority->'accessEpoch' is distinct from p_expected_context->'accessEpoch' or
  authority->'assignment' is distinct from expected_assignment then raise exception 'HOSTING_WARNING_CONTEXT_CHANGED'; end if;
 -- Never compare/add committedSeconds: the authenticated DO projection already
 -- includes its checkpoint plus unsettled use. Age only an actively running meter.
 remaining_ms:=(live_access->>'remainingSeconds')::numeric*1000;
 if (live_access->>'metering')::boolean then remaining_ms:=remaining_ms-(now_ms-(p_live->>'serverTime')::numeric); end if;
 if (live_access->>'remainingSeconds')::numeric>300 or (live_access->>'remainingSeconds')::numeric=0 then
  return result||jsonb_build_object('decision','not_eligible');
 end if;
 if remaining_ms<=0 then raise exception 'HOSTING_WARNING_UNAVAILABLE'; end if;
 if (live_access->>'metering')::boolean then until_ms:=least(until_ms,floor(now_ms+remaining_ms)::bigint); end if;
 if until_ms<=server_ms then raise exception 'HOSTING_WARNING_UNAVAILABLE'; end if;
 insert into public.free20_daily_warning_claims(user_id,utc_day,claimed_at)
  values(p_user_id,day,at_time) on conflict(user_id,utc_day) do nothing returning claim_id into inserted_id;
 if inserted_id is null then return result||jsonb_build_object('decision','already_claimed'); end if;
 return result||jsonb_build_object('decision','show','thresholdSeconds',300,'claimId',inserted_id,'validUntil',until_ms);
end $$;
revoke all on function public.claim_free20_daily_warning_v1(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.claim_free20_daily_warning_v1(uuid,jsonb,jsonb) to service_role;
commit;
