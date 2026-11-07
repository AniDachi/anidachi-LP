-- TEST-only application issuance; additive durable state, no existing grant reset.
set lock_timeout='5s';
set statement_timeout='30s';
alter table public.uninstall_offer_grants drop constraint uninstall_offer_grants_kind_check;
alter table public.uninstall_offer_grants add constraint uninstall_offer_grants_kind_check check(kind in ('first','renewal','cancellation'));

create table public.cancellation_retention_offers (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.users(id) on delete set null,
 stripe_customer_id text not null check(length(stripe_customer_id) between 1 and 255),
 stripe_subscription_id text not null check(length(stripe_subscription_id) between 1 and 255),
 coupon_id text generated always as ('cancel_retention_'||replace(id::text,'-','')) stored unique,
 price_id text not null check(length(price_id) between 1 and 255),
 product_ids text[] not null check(cardinality(product_ids)=2 and array_ndims(product_ids)=1 and array_lower(product_ids,1)=1
  and product_ids[1]<>product_ids[2] and array_position(product_ids,null) is null
  and length(product_ids[1]) between 1 and 255 and length(product_ids[2]) between 1 and 255),
 target_period_start bigint not null check(target_period_start>0),
 redeem_by bigint not null check(redeem_by>0 and redeem_by<target_period_start),
 state text not null default 'pending' check(state in ('pending','accepted','expired')),
 created_at timestamptz not null default clock_timestamp() check(isfinite(created_at)),
 accepted_at timestamptz check(isfinite(accepted_at)),
 reconciled_at timestamptz check(isfinite(reconciled_at)),
 provider_observed_at bigint,
 provider_times_redeemed integer check(provider_times_redeemed in (0,1)),
 provider_coupon_missing boolean,
 provider_coupon_valid boolean,
 check((state='accepted')=(accepted_at is not null)),
 check(state='pending' or (reconciled_at is not null and provider_observed_at is not null
  and provider_times_redeemed is not null and provider_coupon_missing is not null)),
 check(state<>'accepted' or (provider_times_redeemed=1 and not provider_coupon_missing)),
 check(state<>'expired' or (provider_times_redeemed=0 and provider_observed_at>redeem_by and
  (provider_coupon_missing or provider_coupon_valid=false)))
);
create unique index cancellation_retention_one_pending_user on public.cancellation_retention_offers(user_id) where state='pending';
create unique index cancellation_retention_one_pending_customer on public.cancellation_retention_offers(stripe_customer_id) where state='pending';
alter table public.cancellation_retention_offers enable row level security;
revoke all on public.cancellation_retention_offers from public,anon,authenticated,service_role;
grant select on public.cancellation_retention_offers to service_role;

create function public.preserve_cancellation_retention_identity_v1()
returns trigger language plpgsql set search_path='' as $$
begin
 if (new.id,new.stripe_customer_id,new.stripe_subscription_id,new.price_id,new.product_ids,new.target_period_start,new.redeem_by,new.created_at)
  is distinct from (old.id,old.stripe_customer_id,old.stripe_subscription_id,old.price_id,old.product_ids,old.target_period_start,old.redeem_by,old.created_at)
  or (new.user_id is distinct from old.user_id and not (new.user_id is null and not exists(select 1 from public.users where id=old.user_id)))
 then raise exception 'OFFER_IDENTITY_IMMUTABLE'; end if;
 if old.state<>'pending' and new.state<>old.state then raise exception 'OFFER_OUTCOME_MISMATCH'; end if;
 return new;
end $$;
create trigger cancellation_retention_identity before update on public.cancellation_retention_offers
 for each row execute function public.preserve_cancellation_retention_identity_v1();
revoke all on function public.preserve_cancellation_retention_identity_v1() from public,anon,authenticated,service_role;

create function public.reserve_cancellation_retention_v1(p_user_id uuid,p_customer_id text,p_subscription_id text,
 p_price_id text,p_product_ids text[],p_target_period_start bigint)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare v_customer text; c public.cancellation_retention_offers; v_now bigint:=floor(extract(epoch from clock_timestamp()));
begin
 if p_user_id is null or p_customer_id is null or p_subscription_id is null or p_price_id is null or p_product_ids is null
  or p_target_period_start is null then raise exception 'OFFER_INVALID_INPUT'; end if;
 -- Shared serialization point for all three issuance paths and reconciliation.
 select stripe_customer_id into v_customer from public.billing_customers where user_id=p_user_id for update;
 if v_customer is distinct from p_customer_id then raise exception 'OFFER_CUSTOMER_MISMATCH'; end if;
 if exists(select 1 from public.uninstall_offer_grants where user_id=p_user_id or stripe_customer_id=p_customer_id)
 then raise exception 'OFFER_LIFETIME_LIMIT'; end if;
 select * into c from public.cancellation_retention_offers where (user_id=p_user_id or stripe_customer_id=p_customer_id) and state='pending';
 if found then
  if (c.user_id,c.stripe_customer_id,c.stripe_subscription_id,c.price_id,c.product_ids,c.target_period_start)
   is distinct from (p_user_id,p_customer_id,p_subscription_id,p_price_id,p_product_ids,p_target_period_start)
  then raise exception 'OFFER_ALREADY_RESERVED'; end if;
  -- An expired pending row is deliberately not reclaimed without Stripe proof.
  return to_jsonb(c);
 end if;
 if p_target_period_start<=v_now+3600 or not exists(select 1 from public.subscriptions
  where user_id=p_user_id and stripe_customer_id=p_customer_id and stripe_subscription_id=p_subscription_id
  and stripe_price_id=p_price_id and status='active' and extract(epoch from current_period_end)::bigint=p_target_period_start)
 then raise exception 'OFFER_RENEWAL_CHANGED'; end if;
 insert into public.cancellation_retention_offers(user_id,stripe_customer_id,stripe_subscription_id,price_id,product_ids,target_period_start,redeem_by)
 values(p_user_id,p_customer_id,p_subscription_id,p_price_id,p_product_ids,p_target_period_start,v_now+600) returning * into c;
 return to_jsonb(c);
end $$;

-- Evidence is supplied only by the server after fresh exact-coupon validation.
-- No subscription discount, browser callback or payment result releases a hold.
create function public.reconcile_cancellation_retention_v1(p_user_id uuid,p_customer_id text,p_offer_id uuid,p_coupon_id text,
 p_observed_at bigint,p_times_redeemed integer,p_coupon_missing boolean,p_coupon_valid boolean,p_expiry_authoritative boolean)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare v_customer text; c public.cancellation_retention_offers; v_now bigint:=floor(extract(epoch from clock_timestamp()));
begin
 if p_user_id is null or p_customer_id is null then raise exception 'OFFER_INVALID_INPUT'; end if;
 select stripe_customer_id into v_customer from public.billing_customers where user_id=p_user_id for update;
 if v_customer is distinct from p_customer_id then raise exception 'OFFER_CUSTOMER_MISMATCH'; end if;
 select * into c from public.cancellation_retention_offers where id=p_offer_id for update;
 if not found or c.user_id is distinct from p_user_id or c.stripe_customer_id is distinct from p_customer_id or c.coupon_id is distinct from p_coupon_id
 then raise exception 'OFFER_BINDING_MISMATCH'; end if;
 if p_observed_at is null or p_observed_at>v_now+60 or p_observed_at<floor(extract(epoch from c.created_at))-1
  or p_expiry_authoritative is null or p_times_redeemed is null or p_times_redeemed not in (0,1) or p_coupon_missing is null
  or (p_coupon_missing and (p_times_redeemed<>0 or p_coupon_valid is not null))
  or (not p_coupon_missing and p_coupon_valid is null)
 then raise exception 'OFFER_INVALID_EVIDENCE'; end if;
 if c.state='accepted' then return to_jsonb(c); end if;
 if c.state='expired' then
  if p_times_redeemed<>0 then raise exception 'OFFER_OUTCOME_MISMATCH'; end if;
  return to_jsonb(c);
 end if;
 if p_times_redeemed=1 then
  insert into public.uninstall_offer_grants(user_id,stripe_customer_id,kind) values(p_user_id,p_customer_id,'cancellation')
   on conflict do nothing;
  if not exists(select 1 from public.uninstall_offer_grants where user_id=p_user_id and stripe_customer_id=p_customer_id and kind='cancellation')
  then raise exception 'OFFER_LIFETIME_LIMIT'; end if;
  update public.cancellation_retention_offers set state='accepted',accepted_at=clock_timestamp(),reconciled_at=clock_timestamp(),
   provider_observed_at=p_observed_at,provider_times_redeemed=1,provider_coupon_missing=false,provider_coupon_valid=p_coupon_valid where id=c.id returning * into c;
 elsif p_expiry_authoritative and p_observed_at>c.redeem_by and v_now>c.redeem_by and (p_coupon_missing or not p_coupon_valid) then
  update public.cancellation_retention_offers set state='expired',reconciled_at=clock_timestamp(),provider_observed_at=p_observed_at,
   provider_times_redeemed=0,provider_coupon_missing=p_coupon_missing,provider_coupon_valid=p_coupon_valid where id=c.id returning * into c;
 else raise exception 'OFFER_REDEMPTION_UNRESOLVED';
 end if;
 return to_jsonb(c);
end $$;
revoke all on function public.reserve_cancellation_retention_v1(uuid,text,text,text,text[],bigint),
 public.reconcile_cancellation_retention_v1(uuid,text,uuid,text,bigint,integer,boolean,boolean,boolean) from public,anon,authenticated;
grant execute on function public.reserve_cancellation_retention_v1(uuid,text,text,text,text[],bigint),
 public.reconcile_cancellation_retention_v1(uuid,text,uuid,text,bigint,integer,boolean,boolean,boolean) to service_role;

-- Existing uninstall promises and their retry behavior remain intact. Only new
-- competing issuance is rejected while a native hold awaits provider evidence.
create or replace function public.claim_uninstall_first_v1(p_user_id uuid,p_customer_id text,p_coupon_id text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare v_customer text; b public.uninstall_first_bindings;
begin
 if p_user_id is null or p_customer_id is null or p_coupon_id is null then raise exception 'OFFER_INVALID_INPUT'; end if;
 select stripe_customer_id into v_customer from public.billing_customers where user_id=p_user_id for update;
 if v_customer is distinct from p_customer_id then raise exception 'OFFER_CUSTOMER_MISMATCH'; end if;
 if exists(select 1 from public.cancellation_retention_offers where (user_id=p_user_id or stripe_customer_id=p_customer_id) and state='pending')
 then raise exception 'OFFER_CANCELLATION_PENDING'; end if;
 insert into public.uninstall_offer_grants(user_id,stripe_customer_id,kind) values(p_user_id,p_customer_id,'first') on conflict(user_id) do nothing;
 if not exists(select 1 from public.uninstall_offer_grants where user_id=p_user_id and stripe_customer_id=p_customer_id and kind='first')
 then raise exception 'OFFER_LIFETIME_LIMIT'; end if;
 insert into public.uninstall_first_bindings(user_id,stripe_customer_id,coupon_id) values(p_user_id,p_customer_id,p_coupon_id)
 on conflict(user_id) do nothing;
 select * into strict b from public.uninstall_first_bindings where user_id=p_user_id;
 if b.stripe_customer_id<>p_customer_id or b.coupon_id<>p_coupon_id then raise exception 'OFFER_BINDING_MISMATCH'; end if;
 return to_jsonb(b);
end $$;

create or replace function public.reserve_uninstall_retention_v1(p_user_id uuid,p_customer_id text,p_subscription_id text,p_coupon_id text,
 p_product_ids text[],p_price_id text,p_plan_code text,p_unit_amount integer,p_target_period_start bigint,p_review_revision text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare v_customer text; c public.uninstall_retention_claims;
begin
 if p_user_id is null or p_customer_id is null then raise exception 'OFFER_INVALID_INPUT'; end if;
 select stripe_customer_id into v_customer from public.billing_customers where user_id=p_user_id for update;
 if v_customer is distinct from p_customer_id then raise exception 'OFFER_CUSTOMER_MISMATCH'; end if;
 if exists(select 1 from public.cancellation_retention_offers where (user_id=p_user_id or stripe_customer_id=p_customer_id) and state='pending')
 then raise exception 'OFFER_CANCELLATION_PENDING'; end if;
 select * into c from public.uninstall_retention_claims where user_id=p_user_id;
 if found then
  if c.stripe_customer_id<>p_customer_id or c.stripe_subscription_id<>p_subscription_id or c.review_revision<>p_review_revision then raise exception 'OFFER_ALREADY_RESERVED'; end if;
  return to_jsonb(c);
 end if;
 if p_target_period_start<=extract(epoch from clock_timestamp())+3600 or not exists(
  select 1 from public.subscriptions where user_id=p_user_id and stripe_customer_id=p_customer_id and stripe_subscription_id=p_subscription_id
 ) then raise exception 'OFFER_RENEWAL_CHANGED'; end if;
 insert into public.uninstall_offer_grants(user_id,stripe_customer_id,kind) values(p_user_id,p_customer_id,'renewal') on conflict(user_id) do nothing;
 if not exists(select 1 from public.uninstall_offer_grants where user_id=p_user_id and stripe_customer_id=p_customer_id and kind='renewal')
 then raise exception 'OFFER_LIFETIME_LIMIT'; end if;
 insert into public.uninstall_retention_claims(user_id,stripe_customer_id,stripe_subscription_id,coupon_id,product_ids,price_id,plan_code,unit_amount,target_period_start,review_revision)
 values(p_user_id,p_customer_id,p_subscription_id,p_coupon_id,p_product_ids,p_price_id,p_plan_code,p_unit_amount,p_target_period_start,p_review_revision) returning * into c;
 return to_jsonb(c);
end $$;

comment on table public.cancellation_retention_offers is 'Private native Stripe TEST cancellation holds. Issuance never grants allowance; verified coupon redemption does. Expiry requires fresh provider evidence.';
reset lock_timeout;
reset statement_timeout;
