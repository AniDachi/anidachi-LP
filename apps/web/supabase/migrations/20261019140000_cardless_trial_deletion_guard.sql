-- Unknown Stripe outcomes must retain their activation and recovery evidence.
-- Do not release orphaned reservations merely because their account was deleted.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create function anidachi_private.guard_trial_activation_deletion_v1() returns trigger
language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
begin
 if exists(select 1 from anidachi_private.trial_marker_claims
  where activation_id=old.id and state='reserved') then
  raise exception 'TRIAL_ACTIVATION_DELETE_UNRESOLVED';
 end if;
 return old;
end $$;
revoke all on function anidachi_private.guard_trial_activation_deletion_v1()
 from public,anon,authenticated,service_role;
create trigger cardless_trial_activation_deletion_guard
 before delete on public.subscription_trial_activations
 for each row execute function anidachi_private.guard_trial_activation_deletion_v1();

commit;
