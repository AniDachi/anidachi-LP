-- Transaction-only regression; random fixtures and every write are rolled back.
-- Also runnable on staging without installing pgTAP or calling Stripe.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $test$
declare
 owner_id uuid:=gen_random_uuid();
 next_owner_id uuid:=gen_random_uuid();
 consumed_owner_id uuid:=gen_random_uuid();
 unknown_owner_id uuid:=gen_random_uuid();
 browser text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 installation text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 consumed_browser text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 unknown_browser text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 activation public.subscription_trial_activations%rowtype;
 attempt_id uuid;
 trial_start timestamptz:=clock_timestamp();
begin
 insert into public.users(id,email,display_name)
 select id,id::text||'@example.test','Trial deletion regression'
 from unnest(array[owner_id,next_owner_id,consumed_owner_id,unknown_owner_id]) id;
 update public.hosting_commercial_policy set activation_at=now()-interval '1 day',
  trials_enabled=true,cardless_trials_enabled=true,trial_abuse_enforced=true;

 perform public.reserve_cardless_trial_v2(owner_id,gen_random_uuid(),'plus','monthly',
  'price_deletion_test',null,(select revision from public.hosting_commercial_policy where singleton),browser,installation);
 select * into strict activation from public.subscription_trial_activations where user_id=owner_id;
 begin
  delete from public.subscription_trial_activations where id=activation.id;
  raise exception 'DIRECT_DELETE_WAS_NOT_BLOCKED';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'TRIAL_ACTIVATION_DELETE_UNRESOLVED' then raise; end if;
 end;
 begin
  delete from public.users where id=owner_id;
  raise exception 'CASCADE_DELETE_WAS_NOT_BLOCKED';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'TRIAL_ACTIVATION_DELETE_UNRESOLVED' then raise; end if;
 end;
 if not exists(select 1 from public.users where id=owner_id)
  or (select count(*) from anidachi_private.trial_marker_claims where activation_id=activation.id and state='reserved')<>2
 then raise exception 'PENDING_ACTIVATION_OR_MARKERS_CHANGED'; end if;

 -- Only evidence-backed no-effect recovery may release pending claims.
 perform anidachi_private.hold_cardless_trial_activation_v1(owner_id,activation.id,activation.idempotency_key,true);
 perform anidachi_private.settle_cardless_trial_activation_v1(owner_id,activation.id,activation.idempotency_key,
  activation.created_at,'Disposable regression: no external attempt was started and no Stripe call was made.');
 delete from public.users where id=owner_id;
 if exists(select 1 from anidachi_private.trial_marker_claims where marker_hash in (browser,installation))
 then raise exception 'SETTLED_MARKERS_NOT_RELEASED'; end if;
 perform public.reserve_cardless_trial_v2(next_owner_id,gen_random_uuid(),'plus','monthly',
  'price_deletion_test',null,(select revision from public.hosting_commercial_policy where singleton),browser,installation);

 -- Deleting a completed activation must keep consumed history and its expiry.
 perform public.reserve_cardless_trial_v2(consumed_owner_id,gen_random_uuid(),'plus','monthly',
  'price_deletion_test',null,(select revision from public.hosting_commercial_policy where singleton),consumed_browser,null);
 select * into strict activation from public.subscription_trial_activations where user_id=consumed_owner_id;
 perform public.record_cardless_trial_customer_v1(consumed_owner_id,activation.id,'cus_deletion_test_'||activation.id::text);
 perform public.record_cardless_trial_created_v1(consumed_owner_id,activation.id,'cus_deletion_test_'||activation.id::text,
  'sched_deletion_test_'||activation.id::text,'sub_deletion_test_'||activation.id::text,'price_deletion_test',trial_start,trial_start+interval '72 hours');
 delete from public.users where id=consumed_owner_id;
 if not exists(select 1 from anidachi_private.trial_marker_claims where marker_hash=consumed_browser
  and state='consumed' and activation_id is null and expires_at>now()+interval '364 days')
 then raise exception 'CONSUMED_HISTORY_NOT_PRESERVED'; end if;
 begin
  perform public.reserve_cardless_trial_v2(unknown_owner_id,gen_random_uuid(),'plus','monthly',
   'price_deletion_test',null,(select revision from public.hosting_commercial_policy where singleton),consumed_browser,null);
  raise exception 'CONSUMED_MARKER_REUSED';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'TRIAL_MARKER_USED' then raise; end if;
 end;

 -- A running or unknown external attempt cannot be cleared through deletion.
 perform public.reserve_cardless_trial_v2(unknown_owner_id,gen_random_uuid(),'plus','monthly',
  'price_deletion_test',null,(select revision from public.hosting_commercial_policy where singleton),unknown_browser,null);
 select * into strict activation from public.subscription_trial_activations where user_id=unknown_owner_id;
 attempt_id:=public.begin_cardless_trial_attempt_v1(unknown_owner_id,activation.id,'customer','trial-customer:'||activation.id::text);
 begin
  delete from public.users where id=unknown_owner_id;
  raise exception 'APPLYING_ATTEMPT_WAS_DELETED';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'TRIAL_ACTIVATION_DELETE_UNRESOLVED' then raise; end if;
 end;
 perform public.finish_cardless_trial_attempt_v1(unknown_owner_id,activation.id,attempt_id,'unknown',null,null);
 begin
  delete from public.subscription_trial_activations where id=activation.id;
  raise exception 'UNKNOWN_ATTEMPT_WAS_DELETED';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'TRIAL_ACTIVATION_DELETE_UNRESOLVED' then raise; end if;
 end;
 perform anidachi_private.hold_cardless_trial_activation_v1(unknown_owner_id,activation.id,activation.idempotency_key,true);
 begin
  perform anidachi_private.settle_cardless_trial_activation_v1(unknown_owner_id,activation.id,activation.idempotency_key,
   activation.created_at,'Disposable regression: unknown outcome is not proof that no external effect occurred.');
  raise exception 'UNKNOWN_ATTEMPT_WAS_RELEASED';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'TRIAL_ATTEMPT_UNRESOLVED' then raise; end if;
 end;
 if not exists(select 1 from public.subscription_trial_activation_attempts where id=attempt_id and outcome='unknown')
  or not exists(select 1 from anidachi_private.trial_marker_claims where activation_id=activation.id and state='reserved')
 then raise exception 'UNKNOWN_RECOVERY_EVIDENCE_LOST'; end if;
end
$test$;
select 'PASS cardless_trial_deletion' as result;
rollback;
