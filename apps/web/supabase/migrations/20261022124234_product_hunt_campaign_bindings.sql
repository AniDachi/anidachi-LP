-- Additive, service-only campaign identity. Never reset after cancellation,
-- redemption, a lost Stripe response, or customer mapping replacement.
create table public.subscription_campaign_bindings (
 id uuid primary key default gen_random_uuid(),
 campaign text not null check (campaign = 'product_hunt_2026'),
 user_id uuid references public.users(id) on delete set null,
 stripe_customer_id text not null check (length(stripe_customer_id) between 1 and 255),
 coupon_id text not null check (length(coupon_id) between 1 and 255),
 created_at timestamptz not null default now(),
 unique (campaign,user_id),
 unique (campaign,stripe_customer_id)
);
alter table public.subscription_campaign_bindings enable row level security;
revoke all on table public.subscription_campaign_bindings from public,anon,authenticated,service_role;
grant select on table public.subscription_campaign_bindings to service_role;

create function public.claim_product_hunt_promotion_v1(p_user_id uuid,p_customer_id text,p_coupon_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_customer text; v_binding public.subscription_campaign_bindings;
begin
 if p_user_id is null or p_customer_id is null or p_coupon_id is null or
    length(p_customer_id) not between 1 and 255 or length(p_coupon_id) not between 1 and 255 then
  raise exception 'PROMOTION_INVALID_INPUT';
 end if;
 select stripe_customer_id into v_customer from public.billing_customers where user_id=p_user_id for update;
 if v_customer is distinct from p_customer_id then raise exception 'PROMOTION_CUSTOMER_MISMATCH'; end if;
 insert into public.subscription_campaign_bindings(campaign,user_id,stripe_customer_id,coupon_id)
 values('product_hunt_2026',p_user_id,p_customer_id,p_coupon_id)
 on conflict (campaign,user_id) do nothing;
 select * into strict v_binding from public.subscription_campaign_bindings
 where campaign='product_hunt_2026' and user_id=p_user_id;
 if v_binding.stripe_customer_id<>p_customer_id or v_binding.coupon_id<>p_coupon_id then
  raise exception 'PROMOTION_BINDING_MISMATCH';
 end if;
 return to_jsonb(v_binding);
end;
$$;
revoke all on function public.claim_product_hunt_promotion_v1(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_product_hunt_promotion_v1(uuid,text,text) to service_role;
comment on table public.subscription_campaign_bindings is
 'Server-only Product Hunt redemption identity. Account deletion unlinks its user; opaque Stripe identity is retained to avoid accidental reissue.';
