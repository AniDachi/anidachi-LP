begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- No account rewriting/merging. Abort if historical case variants are ambiguous.
create unique index users_email_normalized_key on public.users (lower(btrim(email)));

create table public.email_login_challenges (
  id uuid primary key,
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 254),
  code_hash text not null check (code_hash ~ '^[a-f0-9]{64}$'),
  browser_hash text not null check (browser_hash ~ '^[a-f0-9]{64}$'),
  return_to text not null default '' check (length(return_to) <= 4096),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp() + interval '10 minutes',
  sent_at timestamptz,
  consumed_at timestamptz,
  attempts integer not null default 0 check (attempts between 0 and 5)
);
create index email_login_challenges_email_idx on public.email_login_challenges(email,created_at desc);
create index email_login_challenges_cleanup_idx on public.email_login_challenges(expires_at);
create table public.email_login_limits (
  key text primary key,
  window_started_at timestamptz not null,
  hits integer not null
);
alter table public.email_login_challenges enable row level security;
alter table public.email_login_limits enable row level security;
revoke all on public.email_login_challenges,public.email_login_limits from public,anon,authenticated;
grant select,insert,update,delete on public.email_login_challenges,public.email_login_limits to service_role;

create function public.consume_email_login_limit_v1(p_key text,p_seconds integer,p_max integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_now timestamptz:=clock_timestamp(); v_row public.email_login_limits;
begin
  if p_key is null or length(p_key)>100 or p_seconds not between 1 and 86400 or p_max not between 1 and 1000 then
    raise exception 'INVALID_EMAIL_LOGIN_LIMIT';
  end if;
  insert into public.email_login_limits as r(key,window_started_at,hits) values(p_key,v_now,1)
  on conflict(key) do update set
    window_started_at=case when r.window_started_at<=v_now-make_interval(secs=>p_seconds) then v_now else r.window_started_at end,
    hits=case when r.window_started_at<=v_now-make_interval(secs=>p_seconds) then 1 else least(r.hits+1,1001) end
  returning * into v_row;
  if v_row.hits>p_max then
    return greatest(1,ceil(extract(epoch from v_row.window_started_at+make_interval(secs=>p_seconds)-v_now))::integer);
  end if;
  return 0;
end $$;

create function public.start_email_login_v1(p_id uuid,p_email text,p_code_hash text,p_browser_hash text,p_email_hash text,p_ip_hash text,p_return_to text)
returns integer language plpgsql security invoker set search_path='' as $$
declare v_wait integer; v_now timestamptz:=clock_timestamp();
begin
  if p_email_hash !~ '^[a-f0-9]{64}$' or p_ip_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_EMAIL_LOGIN_HASH'; end if;
  -- Fixed ordering, durable across serverless instances. Reserve before sending.
  v_wait:=public.consume_email_login_limit_v1('ip:'||p_ip_hash,3600,20);
  if v_wait>0 then return v_wait; end if;
  v_wait:=public.consume_email_login_limit_v1('resend:'||p_email_hash,60,1);
  if v_wait>0 then return v_wait; end if;
  v_wait:=public.consume_email_login_limit_v1('email:'||p_email_hash,3600,5);
  if v_wait>0 then return v_wait; end if;
  -- Staging envelope below the sender's daily free quota; no paid usage implied.
  v_wait:=public.consume_email_login_limit_v1('global',86400,80);
  if v_wait>0 then return v_wait; end if;
  update public.email_login_challenges set consumed_at=v_now where email=p_email and consumed_at is null;
  insert into public.email_login_challenges(id,email,code_hash,browser_hash,return_to,created_at,expires_at)
    values(p_id,p_email,p_code_hash,p_browser_hash,p_return_to,v_now,v_now+interval '10 minutes');
  return 0;
end $$;

create function public.consume_email_login_v1(p_id uuid,p_browser_hash text,p_code_hash text)
returns table(outcome text,user_id uuid,return_to text,is_new boolean)
language plpgsql security invoker set search_path='' as $$
declare v_challenge public.email_login_challenges; v_user public.users; v_new boolean:=false;
begin
  select * into v_challenge from public.email_login_challenges c where c.id=p_id for update;
  if not found or v_challenge.browser_hash<>p_browser_hash or p_browser_hash is null
    or v_challenge.sent_at is null or v_challenge.consumed_at is not null
    or v_challenge.expires_at<=clock_timestamp() or v_challenge.attempts>=5 then
    return query select 'invalid',null::uuid,'',false; return;
  end if;
  update public.email_login_challenges set attempts=attempts+1 where id=p_id;
  if p_code_hash is null or v_challenge.code_hash<>p_code_hash then
    return query select 'invalid',null::uuid,'',false; return;
  end if;
  update public.email_login_challenges set consumed_at=clock_timestamp() where id=p_id;
  -- Unique index also serializes against the existing OAuth account writer.
  perform pg_advisory_xact_lock(hashtextextended('email-login:'||v_challenge.email,0));
  select * into v_user from public.users u where lower(btrim(u.email))=v_challenge.email for update;
  if not found then
    insert into public.users(email,display_name) values(v_challenge.email,'AniDachi user')
      on conflict do nothing returning * into v_user;
    v_new:=found;
    if not v_new then
      select * into v_user from public.users u where lower(btrim(u.email))=v_challenge.email for update;
    end if;
  end if;
  if v_user.id is null then raise exception 'EMAIL_LOGIN_IDENTITY_UNAVAILABLE'; end if;
  if not v_new and not exists(select 1 from public.account_verified_emails v where v.user_id=v_user.id and v.email=v_user.email) then
    return query select 'provider_required',null::uuid,'',false; return;
  end if;
  if v_new then
    insert into public.profiles(user_id,display_name,avatar_url) values(v_user.id,v_user.display_name,v_user.avatar_url);
  end if;
  perform public.record_verified_account_email_v1(v_user.id,v_user.email);
  return query select 'verified',v_user.id,v_challenge.return_to,v_new;
end $$;

create function public.cleanup_email_login_v1()
returns void language plpgsql security invoker set search_path='' as $$
begin
  delete from public.email_login_challenges where id in (
    select id from public.email_login_challenges where expires_at<clock_timestamp()-interval '1 hour' order by expires_at limit 1000);
  delete from public.email_login_limits where key in (
    select key from public.email_login_limits where window_started_at<clock_timestamp()-interval '2 days' order by window_started_at limit 1000);
end $$;

revoke all on function public.consume_email_login_limit_v1(text,integer,integer),public.start_email_login_v1(uuid,text,text,text,text,text,text),public.consume_email_login_v1(uuid,text,text),public.cleanup_email_login_v1() from public,anon,authenticated;
grant execute on function public.consume_email_login_limit_v1(text,integer,integer),public.start_email_login_v1(uuid,text,text,text,text,text,text),public.consume_email_login_v1(uuid,text,text),public.cleanup_email_login_v1() to service_role;
select cron.schedule('anidachi-email-login-cleanup-hourly','17 * * * *','select public.cleanup_email_login_v1();');
commit;
