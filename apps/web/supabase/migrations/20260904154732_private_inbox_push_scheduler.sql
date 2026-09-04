begin;
set local lock_timeout = '5s';

-- Hosted Supabase selects the supported version; do not pin pg_net here.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create schema if not exists anidachi_private;
revoke all on schema anidachi_private from public, anon, authenticated, service_role;
grant usage on schema anidachi_private to postgres;

-- Leave platform-owned pg_net ACLs untouched. Supabase documents PUBLIC grants
-- with nonexposed net schema + NOLOGIN client roles as its supported boundary:
-- https://supabase.com/docs/guides/database/extensions/pg_net#permissions
-- Before activation, verify net/vault/anidachi_private are not Data API schemas
-- and no client-callable exposed function bridges to these objects. The private
-- scheduler's own objects below still require strict operator-only ACLs.

create table anidachi_private.inbox_push_scheduler (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  environment text check (environment in ('staging','production')),
  last_request_id bigint,
  last_attempt_at timestamptz,
  last_result_at timestamptz,
  last_result text check (last_result in ('succeeded','invalid_ack','http_error','transport_error','response_missing','missing_secret')),
  last_status_code integer check (last_status_code between 100 and 599),
  check (not enabled or environment is not null),
  check ((last_request_id is null) or last_attempt_at is not null)
);
alter table anidachi_private.inbox_push_scheduler enable row level security;
revoke all on anidachi_private.inbox_push_scheduler from public, anon, authenticated, service_role;
grant all on anidachi_private.inbox_push_scheduler to postgres;
insert into anidachi_private.inbox_push_scheduler(singleton) values(true);

create or replace function anidachi_private.tick_inbox_push_scheduler()
returns void language plpgsql volatile security invoker
set search_path = '' set statement_timeout = '1500ms' set lock_timeout = '500ms'
as $$
declare
  config anidachi_private.inbox_push_scheduler%rowtype;
  response net._http_response%rowtype;
  tick_at timestamptz;
  drain_secret text;
  drain_url text;
  request_id bigint;
  result text;
begin
  -- SKIP LOCKED makes concurrent cron/manual invocations no-ops, not a second
  -- transport queue. pg_net sees requests only after this transaction commits.
  select * into config from anidachi_private.inbox_push_scheduler
    where singleton for update skip locked;
  if not found or not config.enabled then return; end if;
  tick_at := clock_timestamp();

  if config.last_request_id is not null then
    if exists(select 1 from net.http_request_queue where id=config.last_request_id) then
      return;
    end if;
    select * into response from net._http_response
      where id=config.last_request_id order by created desc limit 1;
    if found then
      -- Never parse or retain arbitrary response JSON/error/header data. This
      -- accepts only the small literal acknowledgement, with JSON whitespace.
      result := case
        when response.timed_out is true or response.error_msg is not null then 'transport_error'
        when response.status_code is distinct from 200 then 'http_error'
        when octet_length(response.content)<=128 and response.content ~
          '^[ \t\r\n]*\{[ \t\r\n]*"ok"[ \t\r\n]*:[ \t\r\n]*true[ \t\r\n]*\}[ \t\r\n]*$' then 'succeeded'
        else 'invalid_ack' end;
      update anidachi_private.inbox_push_scheduler set last_request_id=null,last_result=result,
        last_result_at=tick_at,
        last_status_code=case when response.status_code between 100 and 599 then response.status_code else null end
        where singleton;
    elsif tick_at < config.last_attempt_at+interval '90 seconds' then
      return;
    else
      update anidachi_private.inbox_push_scheduler set last_request_id=null,last_result='response_missing',
        last_result_at=tick_at,last_status_code=null where singleton;
    end if;
  end if;

  if not exists (
    select 1 from public.account_inbox_push_outbox o
    where o.terminal_at is null and (o.lease_until is null or o.lease_until<=tick_at)
      and (
        -- Existing claim RPC performs bounded maintenance independent of retry
        -- timing; expired/exhausted-only backlogs must still wake that RPC.
        o.expires_at<=tick_at or o.attempts>=8
        or (o.next_attempt_at<=tick_at and (o.cooldown_until is null or o.cooldown_until<=tick_at))
      )
  ) then return; end if;

  select decrypted_secret into drain_secret from vault.decrypted_secrets
    where name='anidachi_notification_drain_secret';
  if drain_secret is null or length(drain_secret)=0 then
    update anidachi_private.inbox_push_scheduler set last_result='missing_secret',
      last_result_at=tick_at,last_status_code=null where singleton;
    return;
  end if;
  drain_url := case config.environment
    when 'staging' then 'https://staging.anidachi.app/api/internal/notifications/drain'
    when 'production' then 'https://www.anidachi.app/api/internal/notifications/drain'
  end;
  -- pg_net may follow redirects and buffers the body. This is NOT transport
  -- equivalence with the old Worker: fixed owned URL + narrow secret + timeout
  -- and strict acknowledgement are the mitigations. Outbox remains durable.
  request_id := net.http_post(
    url=>drain_url, body=>'{}'::jsonb, params=>'{}'::jsonb,
    headers=>jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||drain_secret),
    timeout_milliseconds=>40000
  );
  update anidachi_private.inbox_push_scheduler set last_request_id=request_id,
    last_attempt_at=tick_at
    where singleton;
end;
$$;
revoke all on function anidachi_private.tick_inbox_push_scheduler() from public, anon, authenticated, service_role;
grant execute on function anidachi_private.tick_inbox_push_scheduler() to postgres;

-- The timeout must be set before the outer SELECT starts; a function's SET
-- statement_timeout alone does not arm the timer for an already-started call.
-- No URL, credential or response body is stored in cron command/history.
select cron.schedule('anidachi-inbox-push-drain','* * * * *',
  $command$set statement_timeout='1500ms'; select anidachi_private.tick_inbox_push_scheduler();$command$);
commit;
