set lock_timeout='5s';
set statement_timeout='30s';

alter table public.subscription_trial_renewals
 add column setup_origin text check(char_length(setup_origin) between 1 and 2048),
 add column setup_request_id uuid,
 add constraint trial_setup_origin_pair check((setup_origin is null)=(setup_request_id is null));

create function public.begin_trial_setup_v1(p_user_id uuid,p_operation_id uuid,p_generation bigint,p_request_id uuid,p_origin text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare r public.subscription_trial_renewals%rowtype;
begin
 if p_request_id is null or p_origin is null or not (p_origin~'^https://[A-Za-z0-9.-]+(:[0-9]+)?$' or p_origin~'^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$') then raise exception 'TRIAL_SETUP_REQUEST_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into r from public.subscription_trial_renewals where user_id=p_user_id and id=p_operation_id for update;
 if not found or r.generation is distinct from p_generation or r.generation<>(select max(generation) from public.subscription_trial_renewals where user_id=p_user_id) then raise exception 'TRIAL_RENEWAL_STALE'; end if;
 if r.action<>'enable' or r.state not in ('quoted','setup_pending') then raise exception 'TRIAL_RENEWAL_STATE_CONFLICT'; end if;
 if r.setup_origin is not null then
  if r.setup_origin<>p_origin then raise exception 'TRIAL_SETUP_REQUEST_MISMATCH'; end if;
  return to_jsonb(r);
 end if;
 perform public.commit_trial_renewal_v1(p_user_id,p_operation_id,p_generation,'quoted','setup_pending');
 update public.subscription_trial_renewals set setup_origin=p_origin,setup_request_id=p_request_id where id=r.id returning * into r;
 return to_jsonb(r);
end $$;

create function public.record_trial_setup_session_v1(p_user_id uuid,p_operation_id uuid,p_generation bigint,p_session_id text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare r public.subscription_trial_renewals%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into r from public.subscription_trial_renewals where user_id=p_user_id and id=p_operation_id for update;
 if not found or r.generation is distinct from p_generation or r.generation<>(select max(generation) from public.subscription_trial_renewals where user_id=p_user_id) then raise exception 'TRIAL_RENEWAL_STALE'; end if;
 if p_session_id is null or char_length(p_session_id) not between 1 and 255 or r.setup_origin is null or r.consented_at is null or r.action<>'enable' then raise exception 'TRIAL_SETUP_UNVERIFIED'; end if;
 if r.setup_session_id is not null and r.setup_session_id<>p_session_id then raise exception 'TRIAL_SETUP_SESSION_MISMATCH'; end if;
 if r.state not in ('setup_pending','applying','applied') then raise exception 'TRIAL_RENEWAL_STATE_CONFLICT'; end if;
 -- Do not touch updated_at: once applying, it anchors the safe replay window.
 if r.setup_session_id is null then
  if r.state<>'setup_pending' then raise exception 'TRIAL_SETUP_UNVERIFIED'; end if;
  update public.subscription_trial_renewals set setup_session_id=p_session_id where id=r.id returning * into r;
 end if;
 return to_jsonb(r);
end $$;

create function public.commit_trial_renewal_v2(p_user_id uuid,p_operation_id uuid,p_generation bigint,p_expected_state text,p_state text,p_snapshot jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare r public.subscription_trial_renewals%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into r from public.subscription_trial_renewals where user_id=p_user_id and id=p_operation_id for update;
 if not found or r.generation is distinct from p_generation or r.generation<>(select max(generation) from public.subscription_trial_renewals where user_id=p_user_id) then raise exception 'TRIAL_RENEWAL_STALE'; end if;
 if p_state='applying' and r.action='enable' then
  if r.setup_origin is null or r.setup_request_id is null or r.setup_session_id is null then raise exception 'TRIAL_SETUP_UNVERIFIED'; end if;
  if r.setup_session_id is distinct from p_snapshot->>'setupSessionId' then raise exception 'TRIAL_SETUP_SESSION_MISMATCH'; end if;
  if r.state='applying' and (r.setup_intent_id is distinct from p_snapshot->>'setupIntentId' or r.payment_method_id is distinct from p_snapshot->>'paymentMethodId') then raise exception 'TRIAL_SETUP_SESSION_MISMATCH'; end if;
 end if;
 return public.commit_trial_renewal_v1(p_user_id,p_operation_id,p_generation,p_expected_state,p_state,p_snapshot);
end $$;

create function public.settle_expired_trial_renewal_v1(p_user_id uuid,p_operation_id uuid,p_generation bigint,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='15s' as $$
declare r public.subscription_trial_renewals%rowtype; a public.subscription_trial_activations%rowtype;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select * into r from public.subscription_trial_renewals where user_id=p_user_id and id=p_operation_id for update;
 if not found or r.generation is distinct from p_generation or r.generation<>(select max(generation) from public.subscription_trial_renewals where user_id=p_user_id) then raise exception 'TRIAL_RENEWAL_STALE'; end if;
 if r.state='expired' then return to_jsonb(r); end if;
 select * into a from public.subscription_trial_activations where user_id=p_user_id and stripe_subscription_id=r.stripe_subscription_id;
 if r.state<>'applying' or a.id is null or r.original_trial_end>clock_timestamp() or p_snapshot is null
  or p_snapshot->>'scheduleId' is distinct from a.stripe_schedule_id or p_snapshot->>'subscriptionId' is distinct from r.stripe_subscription_id
  or p_snapshot->>'customerId' is distinct from a.stripe_customer_id or (p_snapshot->>'trialEndsAt')::timestamptz is distinct from r.original_trial_end
  or p_snapshot->>'endBehavior' is distinct from 'cancel' or p_snapshot->>'subscriptionStatus' is distinct from 'canceled'
  or coalesce(p_snapshot->>'scheduleStatus','') not in ('completed','canceled')
 then raise exception 'TRIAL_RENEWAL_UNVERIFIED'; end if;
 update public.subscription_trial_renewals set state='expired',updated_at=clock_timestamp() where id=r.id returning * into r;
 update public.account_subscription_trials set renewal_operation_id=null where user_id=p_user_id and stripe_subscription_id=r.stripe_subscription_id;
 return to_jsonb(r);
end $$;

revoke all on function public.begin_trial_setup_v1(uuid,uuid,bigint,uuid,text),public.record_trial_setup_session_v1(uuid,uuid,bigint,text),public.commit_trial_renewal_v2(uuid,uuid,bigint,text,text,jsonb),public.settle_expired_trial_renewal_v1(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.begin_trial_setup_v1(uuid,uuid,bigint,uuid,text),public.record_trial_setup_session_v1(uuid,uuid,bigint,text),public.commit_trial_renewal_v2(uuid,uuid,bigint,text,text,jsonb),public.settle_expired_trial_renewal_v1(uuid,uuid,bigint,jsonb) to service_role;
reset lock_timeout;
reset statement_timeout;
