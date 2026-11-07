# Stripe cancellation retention — staging design

Status: approved owner behavior, implementation in progress. Native Stripe offer;
40% off one monthly renewal, one lifetime allowance shared with uninstall.
Owner explicitly requires annual conversion to remain available without this
monthly discount. TEST/staging only; no production changes.

## Behavior

- Eligible active paid monthly Plus/Pro subscribers see the retention offer in
  Stripe's cancellation flow. Accepting preserves renewal and charges nothing
  immediately. Declining cancels normally at period end.
- Opening, abandoning, or declining does not consume the lifetime allowance.
  A short-lived issuance hold prevents simultaneous discounts through two tabs;
  expired unredeemed holds are reconciled and released before another offer.
- Accepting consumes the existing shared lifetime allowance. Refunds, later
  cancellation, payment failure, and changing billing period do not reset it.
- Annual subscribers do not receive the monthly offer. Switching to annual stays
  available and the annual invoice never receives this coupon's reduction.
- No discount stacking, new trials, changes to plan benefits, prices, renewal
  dates, or existing paid periods. Optional offer failures never block cancellation. Preparation has a five-second aggregate wait limit before ordinary cancellation fallback; late preparation may leave an unused temporary hold, never a consumed lifetime allowance.
- Existing uninstall invoice-only promises continue unchanged.

## Stripe enforcement

Stripe API remains `2025-08-27.basil`, current installed SDK. Coupon scoping is
by Product, not Price interval. Monthly and annual currently share products.
Separate annual Plus/Pro products and prices therefore provide the restriction
inside Stripe's invoice calculation. Existing monthly prices stay unchanged.
New annual prices have exactly the existing currency/amount/interval/tax settings.
Old annual prices are retained as recognized legacy IDs for existing subscribers,
but archived against new conversions before any native retention offer is enabled.
No existing subscription is migrated or repriced.

Yearly confirmation accepts the explicitly configured annual price regardless
of whether its product equals the monthly product. It still verifies ownership,
plan mapping, currency, recurring shape, portal allowlist and paid status. Native
coupon issuance verifies the full active price inventory of eligible products:
only the configured monthly price may be active, no annual or other active price.

Verified in AniDachi TEST on November 5 with isolated resources:
- The existing coupon discounts annual 7670 -> 4602 cents: same-product scoping
  is unsafe.
- Explicit empty `flow_data.subscription_update_confirm.discounts` is rejected
  with `parameter_invalid_empty` on the pinned API.
- An annual portal session created before coupon attachment displayed the annual
  discount. Archiving that synthetic annual price while its page was open caused
  confirmation to fail; readback remained active on the original monthly price.
- Confirmed native annual conversion with separate product: annual line 7670 cents, normal remaining monthly credit -799, paid invoice 6871, coupon reduction 0.
- A stale monthly cancellation page can still accept its monthly-only coupon after annual conversion. Provider records one redemption and keeps the coupon attached; annual price is unchanged. This explicit acceptance consumes the shared allowance as agreed; do not restore it or promise a future monthly benefit. On return, show the actual annual price and explain monthly-only applicability. Fresh annual subscriptions receive no offer.
- Native monthly acceptance and paid renewals were verified for Plus (799 -> 479 -> 799 cents) and Pro (1499 -> 899 -> 1499); no immediate invoice on acceptance. Declining leaves zero redemptions and schedules normal period-end cancellation.
- An ordinary non-clock customer cannot redeem an expired offer even from a page opened before expiry. For TEST-clock customers, global coupon validity and wall-clock expiry alone are insufficient: the clock must be ready and strictly past the deadline before the final coupon read can authorize release.

Sources: https://docs.stripe.com/billing/subscriptions/coupons and
https://docs.stripe.com/customer-management/portal-deep-links.

## Shared account authority

Keep `uninstall_offer_grants` authoritative, adding kind `cancellation`. New
private `cancellation_retention_offers` rows store immutable ownership, subscription,
price, product scope, coupon ID, redemption deadline, and outcome. One pending
row per user/customer. All three issuance paths lock the same billing-customer
row; neither uninstall claim RPC may succeed while a native offer is pending.
Do not insert a lifetime grant simply to show a portal.

Reserve before any Stripe coupon creation. Use a deterministic unpredictable ID
from the durable offer, `percent_off=40`, `duration=once`, `max_redemptions=1`,
monthly-only products, finite `redeem_by`, and owner/offer/campaign metadata.
Opening again reuses the same pending coupon. Never mint replacements after an
uncertain response. Issuance holds last 10 minutes, never beyond the target
monthly renewal. Require more than one hour until renewal as uninstall already does.

Reconcile coupon `times_redeemed` using a fresh authoritative read, validating its
identity and immutable terms. One redemption atomically records acceptance and
inserts the shared grant. Release only after Stripe redemption deadline has passed
and fresh provider evidence proves zero redemptions (or absent never-created
expired coupon); never infer release from missing subscription discount, a browser
return, query string, or missing webhook. Keep expired row evidence. Repeat calls
and events are idempotent. Uncertainty blocks another discount, not cancellation.

Signed subscription/invoice events, billing refresh and uninstall offer access
reconcile outstanding offers, including with issuance disabled. Already accepted
native coupons remain attached and Stripe applies them once; do not invoke the
separate uninstall invoice-only fulfillment for native offers.

## Delivery and verification

Feature -> PR -> staging. Additive private migration before dependent runtime,
TEST issuance off until catalog isolation and native proofs pass. No global
retention coupon on the default portal: it would bypass per-account eligibility.
Use owner-specific cancellation deep links from AniDachi billing Cancel. Generic Stripe manage links remain usable, but do not automatically receive this personalized offer. Do not claim every cancellation inside an already-open generic Stripe portal is intercepted; global retention is deliberately not enabled because it bypasses the shared allowance.

Cover free/annual/used/stacked/failed-payment exclusions, ordinary cancellation
fallback, shared-limit races, lost responses, duplicate/delayed events, abandoned
holds, stale annual/cancel links, first discounted and following full monthly
invoice, annual conversion with zero coupon reduction, and feature disabled.
Record native UI and provider proofs separately from unit/SQL checks. Rollback
turns off new issuance; preserves accepted grants and coupons. Existing annual
subscriptions remain valid on legacy IDs throughout deployment and rollback.
