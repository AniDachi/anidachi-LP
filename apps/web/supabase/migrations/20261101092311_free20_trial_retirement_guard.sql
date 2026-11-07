-- Dormant issuance guard: no policy values, accepted operations or ledgers change.
set lock_timeout='5s';
set statement_timeout='30s';

alter table public.hosting_commercial_policy
 add constraint free20_retires_new_trials check(not free20_enabled or not trials_enabled);

create or replace function public.guard_checkout_cardless_trial_v1() returns trigger
language plpgsql set search_path='' as $$
declare policy public.hosting_commercial_policy%rowtype;
begin
 -- Match both reservation RPCs: account authority precedes policy SHARE.
 -- Policy-only cutoff must never acquire account locks after locking policy.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,0));
 if exists(select 1 from public.subscription_trial_activations a where a.user_id=new.user_id and
  (a.state in ('pending','created') or (a.state='committed' and exists(select 1 from public.subscriptions s where s.stripe_subscription_id=a.stripe_subscription_id and s.status not in ('canceled','incomplete_expired')))))
 then raise exception 'TRIAL_ACTIVATION_BUSY'; end if;
 if new.trial_offered then
  -- Held through commit: either this reservation is accepted before cutoff,
  -- or the guard reads the committed cutoff and rejects the stale offer.
  select * into policy from public.hosting_commercial_policy where singleton for share;
  if not found or not policy.trials_enabled or policy.free20_enabled
   or policy.activation_at is null or policy.activation_at>clock_timestamp()
   or policy.cardless_trials_enabled
  then raise exception 'CARDLESS_TRIAL_OFFER_CHANGED'; end if;
 end if;
 return new;
end $$;

reset lock_timeout;
reset statement_timeout;
