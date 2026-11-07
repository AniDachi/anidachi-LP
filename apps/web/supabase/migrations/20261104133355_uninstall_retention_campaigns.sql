-- Additive private state. Coupon identity and account ownership never reset.
set lock_timeout='5s';
set statement_timeout='30s';
-- One lifetime uninstall allowance shared by the two fulfillment paths. A first
-- purchase reservation is not proof of payment; it remains reserved for safe
-- reconciliation and cannot simultaneously promise a retention discount.
create table public.uninstall_offer_grants (
 user_id uuid references public.users(id) on delete set null unique,
 stripe_customer_id text primary key check (length(stripe_customer_id) between 1 and 255),
 kind text not null check (kind in ('first','renewal')),
 created_at timestamptz not null default clock_timestamp()
);
create table public.uninstall_first_bindings (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.users(id) on delete set null unique,
 stripe_customer_id text not null unique check (length(stripe_customer_id) between 1 and 255),
 coupon_id text not null check (length(coupon_id) between 1 and 255),
 created_at timestamptz not null default clock_timestamp()
);
create table public.uninstall_retention_claims (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references public.users(id) on delete set null unique,
 stripe_customer_id text not null unique check (length(stripe_customer_id) between 1 and 255),
 stripe_subscription_id text not null unique check (length(stripe_subscription_id) between 1 and 255),
 coupon_id text not null check (length(coupon_id) between 1 and 255),
 product_ids text[] not null check (cardinality(product_ids)=2 and product_ids[1]<>product_ids[2]),
 price_id text not null check (length(price_id) between 1 and 255),
 plan_code text not null check (plan_code in ('plus','pro')),
 unit_amount integer not null check (unit_amount>0),
 target_period_start bigint not null check (target_period_start>0),
 review_revision text not null check (length(review_revision) between 1 and 128),
 state text not null default 'accepted' check (state in ('accepted','applied','ineligible','reconciliation')),
 stripe_invoice_id text unique check (length(stripe_invoice_id) between 1 and 255),
 reason text not null default 'Reserved for your next eligible monthly renewal.',
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check (state<>'applied' or stripe_invoice_id is not null)
);
create table public.uninstall_feedback (
 submission_id uuid primary key,
 actor_hash text not null check (actor_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid references public.users(id) on delete set null,
 reason text not null check (reason in ('not_using','technical_issues','too_expensive','missing_features','other')),
 note text not null default '' check (char_length(note)<=500 and octet_length(note)<=2000),
 created_at timestamptz not null default clock_timestamp()
);
create table public.uninstall_feedback_windows (
 actor_hash text not null check (actor_hash ~ '^[a-f0-9]{64}$'),
 window_start timestamptz not null,
 admissions integer not null check (admissions between 1 and 5),
 primary key(actor_hash,window_start)
);
alter table public.uninstall_first_bindings enable row level security;
alter table public.uninstall_offer_grants enable row level security;
alter table public.uninstall_retention_claims enable row level security;
alter table public.uninstall_feedback enable row level security;
alter table public.uninstall_feedback_windows enable row level security;
revoke all on public.uninstall_first_bindings,public.uninstall_retention_claims,public.uninstall_feedback,public.uninstall_feedback_windows from public,anon,authenticated,service_role;
revoke all on public.uninstall_offer_grants from public,anon,authenticated,service_role;
grant select on public.uninstall_offer_grants,public.uninstall_first_bindings,public.uninstall_retention_claims to service_role;

create function public.claim_uninstall_first_v1(p_user_id uuid,p_customer_id text,p_coupon_id text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare v_customer text; b public.uninstall_first_bindings;
begin
 if p_user_id is null or p_customer_id is null or p_coupon_id is null then raise exception 'OFFER_INVALID_INPUT'; end if;
 select stripe_customer_id into v_customer from public.billing_customers where user_id=p_user_id for update;
 if v_customer is distinct from p_customer_id then raise exception 'OFFER_CUSTOMER_MISMATCH'; end if;
 insert into public.uninstall_offer_grants(user_id,stripe_customer_id,kind) values(p_user_id,p_customer_id,'first') on conflict(user_id) do nothing;
 if not exists(select 1 from public.uninstall_offer_grants where user_id=p_user_id and stripe_customer_id=p_customer_id and kind='first')
 then raise exception 'OFFER_LIFETIME_LIMIT'; end if;
 insert into public.uninstall_first_bindings(user_id,stripe_customer_id,coupon_id) values(p_user_id,p_customer_id,p_coupon_id)
 on conflict(user_id) do nothing;
 select * into strict b from public.uninstall_first_bindings where user_id=p_user_id;
 if b.stripe_customer_id<>p_customer_id or b.coupon_id<>p_coupon_id then raise exception 'OFFER_BINDING_MISMATCH'; end if;
 return to_jsonb(b);
end $$;

create function public.reserve_uninstall_retention_v1(p_user_id uuid,p_customer_id text,p_subscription_id text,p_coupon_id text,
 p_product_ids text[],p_price_id text,p_plan_code text,p_unit_amount integer,p_target_period_start bigint,p_review_revision text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare v_customer text; c public.uninstall_retention_claims;
begin
 if p_user_id is null or p_customer_id is null then raise exception 'OFFER_INVALID_INPUT'; end if;
 select stripe_customer_id into v_customer from public.billing_customers where user_id=p_user_id for update;
 if v_customer is distinct from p_customer_id then raise exception 'OFFER_CUSTOMER_MISMATCH'; end if;
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

-- Bind before any Stripe write. The only mutable fields are outcome evidence.
create function public.bind_uninstall_retention_invoice_v1(p_claim_id uuid,p_invoice_id text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare c public.uninstall_retention_claims;
begin
 if p_invoice_id is null or length(p_invoice_id) not between 1 and 255 then raise exception 'OFFER_INVALID_INPUT'; end if;
 select * into strict c from public.uninstall_retention_claims where id=p_claim_id for update;
 if c.state='ineligible' or (c.stripe_invoice_id is not null and c.stripe_invoice_id<>p_invoice_id) then raise exception 'OFFER_INVOICE_MISMATCH'; end if;
 update public.uninstall_retention_claims set stripe_invoice_id=p_invoice_id,updated_at=clock_timestamp() where id=p_claim_id returning * into c;
 return to_jsonb(c);
end $$;
create function public.finish_uninstall_retention_v1(p_claim_id uuid,p_invoice_id text,p_state text,p_reason text)
returns void language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare c public.uninstall_retention_claims;
begin
 select * into strict c from public.uninstall_retention_claims where id=p_claim_id for update;
 if p_state is null or p_state not in ('applied','ineligible','reconciliation') or p_reason is null or length(p_reason)>500
  or c.stripe_invoice_id is distinct from p_invoice_id or (c.state in ('applied','ineligible') and c.state<>p_state)
 then raise exception 'OFFER_OUTCOME_MISMATCH'; end if;
 update public.uninstall_retention_claims set state=p_state,reason=p_reason,updated_at=clock_timestamp() where id=p_claim_id;
end $$;

-- Durable per-hour admission; an identical retry does not consume quota again.
create function public.submit_uninstall_feedback_v1(p_submission_id uuid,p_actor_hash text,p_user_id uuid,p_reason text,p_note text)
returns text language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='10s' as $$
declare f public.uninstall_feedback; v_window timestamptz:=date_trunc('hour',clock_timestamp()); v_count integer;
begin
 if p_submission_id is null or p_actor_hash is null or p_actor_hash !~ '^[a-f0-9]{64}$' or p_reason is null
  or p_reason not in ('not_using','technical_issues','too_expensive','missing_features','other') or p_note is null or char_length(p_note)>500 or octet_length(p_note)>2000
 then raise exception 'FEEDBACK_INVALID_INPUT'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('uninstall-feedback:'||p_submission_id::text,0));
 select * into f from public.uninstall_feedback where submission_id=p_submission_id;
 if found then
  if f.actor_hash<>p_actor_hash or f.user_id is distinct from p_user_id or f.reason<>p_reason or f.note<>p_note then raise exception 'FEEDBACK_IDENTITY_MISMATCH'; end if;
  return 'saved';
 end if;
 insert into public.uninstall_feedback_windows(actor_hash,window_start,admissions) values(p_actor_hash,v_window,1)
 on conflict(actor_hash,window_start) do update set admissions=public.uninstall_feedback_windows.admissions+1
 where public.uninstall_feedback_windows.admissions<5 returning admissions into v_count;
 if v_count is null then return 'rate_limited'; end if;
 insert into public.uninstall_feedback(submission_id,actor_hash,user_id,reason,note) values(p_submission_id,p_actor_hash,p_user_id,p_reason,p_note);
 return 'saved';
end $$;
revoke all on function public.claim_uninstall_first_v1(uuid,text,text),public.reserve_uninstall_retention_v1(uuid,text,text,text,text[],text,text,integer,bigint,text),public.bind_uninstall_retention_invoice_v1(uuid,text),public.finish_uninstall_retention_v1(uuid,text,text,text),public.submit_uninstall_feedback_v1(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_uninstall_first_v1(uuid,text,text),public.reserve_uninstall_retention_v1(uuid,text,text,text,text[],text,text,integer,bigint,text),public.bind_uninstall_retention_invoice_v1(uuid,text),public.finish_uninstall_retention_v1(uuid,text,text,text),public.submit_uninstall_feedback_v1(uuid,text,uuid,text,text) to service_role;
comment on table public.uninstall_retention_claims is 'TEST uninstall retention campaign, once per account, frozen exact renewal invoice promise. No direct client access.';
reset lock_timeout;
reset statement_timeout;
