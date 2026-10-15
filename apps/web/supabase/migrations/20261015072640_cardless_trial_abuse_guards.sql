-- Additive, dormant enforcement for older servers. New v2 callers always claim markers.
set lock_timeout='5s';
set statement_timeout='30s';
alter table public.hosting_commercial_policy add column trial_abuse_enforced boolean not null default false;
alter table public.subscription_trial_activations
 add column browser_hash text check(browser_hash ~ '^[a-f0-9]{64}$'),
 add column installation_hash text check(installation_hash ~ '^[a-f0-9]{64}$'),
 add constraint trial_installation_requires_browser check(installation_hash is null or browser_hash is not null);

create table anidachi_private.trial_marker_claims (
 kind text not null check(kind in ('browser','installation')),
 marker_hash text not null check(marker_hash ~ '^[a-f0-9]{64}$'),
 activation_id uuid references public.subscription_trial_activations(id) on delete set null,
 state text not null check(state in ('reserved','consumed')),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz,
 primary key(kind,marker_hash),
 check((state='consumed')=(expires_at is not null))
);
create index trial_marker_claim_activation on anidachi_private.trial_marker_claims(activation_id);
alter table anidachi_private.trial_marker_claims enable row level security;
revoke all on anidachi_private.trial_marker_claims from public,anon,authenticated,service_role;

create function anidachi_private.guard_trial_markers_v1() returns trigger
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare m record; prior anidachi_private.trial_marker_claims%rowtype;
begin
 if tg_op='UPDATE' and (new.browser_hash,new.installation_hash) is distinct from (old.browser_hash,old.installation_hash)
 then raise exception 'TRIAL_MARKERS_IMMUTABLE'; end if;
 if new.browser_hash is null then
  if tg_op='INSERT' and (select trial_abuse_enforced from public.hosting_commercial_policy where singleton)
  then raise exception 'TRIAL_CONTEXT_REQUIRED'; end if;
  return new;
 end if;
 for m in select * from (values ('browser',new.browser_hash),('installation',new.installation_hash)) as markers(kind,digest)
  where digest is not null order by kind,digest loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trial-marker:'||m.kind||':'||m.digest,4311));
  if tg_op='INSERT' then
   select * into prior from anidachi_private.trial_marker_claims where kind=m.kind and marker_hash=m.digest for update;
   if found and (prior.state='reserved' or prior.expires_at>clock_timestamp()) then
    if prior.state='consumed' then raise exception 'TRIAL_MARKER_USED'; end if;
    raise exception 'TRIAL_MARKER_BUSY';
   end if;
   delete from anidachi_private.trial_marker_claims where kind=m.kind and marker_hash=m.digest;
   insert into anidachi_private.trial_marker_claims(kind,marker_hash,activation_id,state,expires_at)
   values(m.kind,m.digest,new.id,case when new.state in ('created','committed') then 'consumed' else 'reserved' end,
    case when new.state in ('created','committed') then clock_timestamp()+interval '365 days' else null end);
  elsif new.state in ('created','committed') then
   update anidachi_private.trial_marker_claims set state='consumed',expires_at=clock_timestamp()+interval '365 days'
    where activation_id=new.id and kind=m.kind and marker_hash=m.digest and state='reserved';
  elsif new.state='failed' then
   -- Only the existing privileged, evidence-backed settlement can fail an activation.
   delete from anidachi_private.trial_marker_claims where activation_id=new.id and kind=m.kind and marker_hash=m.digest and state='reserved';
  end if;
 end loop;
 return new;
end $$;
revoke all on function anidachi_private.guard_trial_markers_v1() from public,anon,authenticated,service_role;
create trigger cardless_trial_marker_guard after insert or update of state,browser_hash,installation_hash
 on public.subscription_trial_activations for each row execute function anidachi_private.guard_trial_markers_v1();

create function public.reserve_cardless_trial_v2(p_user_id uuid,p_request_id uuid,p_plan_code text,p_billing_period text,p_price_id text,p_customer_id text,p_policy_revision bigint,p_browser_hash text,p_installation_hash text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare a public.subscription_trial_activations%rowtype; p public.hosting_commercial_policy%rowtype; authority jsonb; owned_customer text;
begin
 if p_user_id is null or p_request_id is null or p_plan_code is null or p_plan_code not in ('plus','pro')
  or p_billing_period is null or p_billing_period not in ('monthly','yearly') or p_price_id is null or char_length(p_price_id) not between 1 and 255
  or (p_customer_id is not null and char_length(p_customer_id) not between 1 and 255)
  or p_policy_revision is null then raise exception 'TRIAL_INPUT_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into a from public.subscription_trial_activations where user_id=p_user_id and request_id=p_request_id for update;
 if found then
  if (a.plan_code,a.billing_period,a.price_id,a.policy_revision) is distinct from
   (p_plan_code,p_billing_period,p_price_id,p_policy_revision)
   or (p_customer_id is not null and a.stripe_customer_id is distinct from p_customer_id)
   then raise exception 'TRIAL_REQUEST_MISMATCH'; end if;
  return to_jsonb(a);
 end if;
 if exists(select 1 from public.subscription_trial_activations where user_id=p_user_id and state<>'failed') then raise exception 'TRIAL_ACTIVATION_BUSY'; end if;
 if exists(select 1 from public.subscription_checkout_reservations c where c.user_id=p_user_id and
  (c.state in ('pending','open') or (c.state='complete' and not exists(select 1 from public.subscriptions s where s.stripe_subscription_id=c.stripe_subscription_id and s.status in ('canceled','incomplete_expired')))))
 then raise exception 'TRIAL_CHECKOUT_UNRESOLVED'; end if;
 select * into p from public.hosting_commercial_policy where singleton for share;
 if not found or not p.cardless_trials_enabled or not p.trials_enabled or p.activation_at is null or p.activation_at>clock_timestamp() then raise exception 'CARDLESS_TRIAL_UNAVAILABLE'; end if;
 if p.revision<>p_policy_revision then raise exception 'TRIAL_OFFER_CHANGED'; end if;
 select stripe_customer_id into owned_customer from public.billing_customers where user_id=p_user_id;
 if p_customer_id is not null and owned_customer is distinct from p_customer_id then raise exception 'TRIAL_CUSTOMER_MISMATCH'; end if;
 authority:=public.resolve_watch_history_access_v1(p_user_id);
 if authority#>>'{hosting,trialEligibility}' is distinct from 'eligible' then raise exception 'TRIAL_INELIGIBLE'; end if;
 if p_browser_hash is null or p_browser_hash !~ '^[a-f0-9]{64}$'
  or (p_installation_hash is not null and p_installation_hash !~ '^[a-f0-9]{64}$') then raise exception 'TRIAL_CONTEXT_REQUIRED'; end if;
 insert into public.subscription_trial_activations(user_id,request_id,plan_code,billing_period,price_id,stripe_customer_id,policy_revision,browser_hash,installation_hash)
 values(p_user_id,p_request_id,p_plan_code,p_billing_period,p_price_id,owned_customer,p_policy_revision,p_browser_hash,p_installation_hash) returning * into a;
 return to_jsonb(a);
end $$;


revoke all on function public.reserve_cardless_trial_v2(uuid,uuid,text,text,text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.reserve_cardless_trial_v2(uuid,uuid,text,text,text,text,bigint,text,text) to service_role;
