set lock_timeout='5s';
set statement_timeout='30s';

-- Extends the existing fenced refresh transaction; the legacy function remains
-- callable during a compatible rollout and cannot erase the additive ledger.
create function public.commit_stripe_subscription_refresh_v2(
 p_subscription_id text,p_fence bigint,p_token uuid,p_user_id uuid,p_customer_id text,
 p_price_id text,p_plan_code text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean,
 p_trial jsonb default null)
returns jsonb language plpgsql security definer set search_path=''
set lock_timeout='5s' set statement_timeout='15s' as $$
declare
 lease_expires timestamptz; prior public.account_subscription_trials%rowtype;
 reservation public.subscription_checkout_reservations%rowtype;
 trial_start timestamptz; trial_end timestamptz; payment_state text;
 invoice_id text; paid_at timestamptz; result jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 select expires_at into lease_expires from public.stripe_subscription_refresh_leases
  where subscription_id=p_subscription_id for update;
 -- v1 validates owner/fence, repairs unavailable prior authority, updates the
 -- subscription mirror and rotates history capture fences. Its release remains
 -- locked inside this outer transaction until the trial and final resolver commit.
 perform public.commit_stripe_subscription_refresh_v1(p_subscription_id,p_fence,p_token,p_user_id,p_customer_id,
  p_price_id,p_plan_code,p_status,p_period_end,p_cancel_at_period_end);
 select * into prior from public.account_subscription_trials where user_id=p_user_id for update;
 if p_trial is null then
  if prior.stripe_subscription_id=p_subscription_id then raise exception 'TRIAL_SNAPSHOT_REQUIRED'; end if;
 else
  if jsonb_typeof(p_trial)<>'object' or not (p_trial ?& array[
   'trialStartedAt','trialEndsAt','firstPaymentState','firstInvoiceId','firstPaidAt'])
  then raise exception 'TRIAL_SNAPSHOT_INVALID'; end if;
  trial_start:=(p_trial->>'trialStartedAt')::timestamptz;
  trial_end:=(p_trial->>'trialEndsAt')::timestamptz;
  payment_state:=p_trial->>'firstPaymentState';
  invoice_id:=p_trial->>'firstInvoiceId';
  paid_at:=(p_trial->>'firstPaidAt')::timestamptz;
  if trial_start is null or trial_end is null or not isfinite(trial_start) or not isfinite(trial_end)
   or trial_end<>trial_start+interval '72 hours' or payment_state is null
   or payment_state not in ('awaiting','paid','failed','action_required')
   or (payment_state='paid')<>(paid_at is not null)
   or (paid_at is not null and (not isfinite(paid_at) or paid_at<trial_end or invoice_id is null))
   or (invoice_id is not null and char_length(invoice_id) not between 1 and 255)
  then raise exception 'TRIAL_SNAPSHOT_INVALID'; end if;
  if prior.user_id is not null then
   if prior.stripe_subscription_id<>p_subscription_id then raise exception 'TRIAL_ALREADY_USED'; end if;
   if prior.trial_started_at<>trial_start or prior.trial_ends_at<>trial_end then raise exception 'TRIAL_IDENTITY_IMMUTABLE'; end if;
   if prior.first_invoice_id is not null and prior.first_invoice_id is distinct from invoice_id
    then raise exception 'TRIAL_INVOICE_IDENTITY_IMMUTABLE'; end if;
   if prior.first_payment_state<>'paid' then
    update public.account_subscription_trials set first_invoice_id=invoice_id,
     first_payment_state=case when payment_state='awaiting' and prior.first_payment_state in ('failed','action_required')
      then prior.first_payment_state else payment_state end,
     first_paid_at=paid_at where user_id=p_user_id;
   end if;
  else
   select * into reservation from public.subscription_checkout_reservations where user_id=p_user_id for update;
   if not found or reservation.id::text is distinct from p_trial->>'checkoutReservationId'
    or not reservation.trial_offered or reservation.state='expired'
    or (reservation.stripe_subscription_id is not null and reservation.stripe_subscription_id<>p_subscription_id)
    or trial_start<reservation.created_at-interval '5 minutes'
   then raise exception 'TRIAL_RESERVATION_INVALID'; end if;
   insert into public.account_subscription_trials(user_id,stripe_subscription_id,trial_started_at,trial_ends_at,
    first_invoice_id,first_payment_state,first_paid_at)
   values(p_user_id,p_subscription_id,trial_start,trial_end,invoice_id,payment_state,paid_at);
  end if;
 end if;
 result:=public.resolve_watch_history_access_v1(p_user_id);
 if lease_expires is null or lease_expires<=clock_timestamp() then raise exception 'STRIPE_REFRESH_STALE'; end if;
 return result;
end $$;
revoke all on function public.commit_stripe_subscription_refresh_v2(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean,jsonb)
 from public,anon,authenticated;
grant execute on function public.commit_stripe_subscription_refresh_v2(text,bigint,uuid,uuid,text,text,text,text,timestamptz,boolean,jsonb)
 to service_role;
-- Runtime writes now go through the fenced transaction; it can never mint or
-- mutate a trial in an unrelated direct table request.
revoke insert,update on public.account_subscription_trials from service_role;

reset lock_timeout;
reset statement_timeout;
