# Uninstall page and one-month offers — staging implementation

Status: authorized implementation, November 4, 2026. Local design source is the
approved uninstall prototype (compact offer card, optional survey, English UI).
The owner requested a real staging implementation after reviewing the complete
flow. This document extends Free20 transition block 8 with the owner's monthly
subscriber offer; production and Store release remain separate.

## Global Constraints

- Deliver only through feature PR -> staging. Do not modify main, production,
  LIVE Stripe, ANIHUNT40, room accounting, auth semantics or extension permissions.
- The extension opens the channel's `/uninstall` URL after removal, without any
  identity, token or installation identifier in the URL. A visit is not proof of
  uninstall. Page/API are noindex, not in sitemap, and respect the staging gate.
- New subscription: 40% off its first monthly Plus or Pro invoice, for both new
  and former subscribers without current access or a pending subscription.
  Owner correction November 5: ordinary paid history does not consume this
  offer. Only the shared lifetime uninstall grant controls prior use/reservation.
- Retention: 40% off exactly the next eligible monthly renewal of the same active
  paid subscription. Current period, renewal date and plan stay unchanged; no
  immediate charge, new subscription, cancellation reversal or trial creation.
- One shared lifetime 40% discount per AniDachi account across both uninstall
  offers (explicit owner decision November 4). A used first-purchase discount
  excludes retention; an accepted renewal excludes a future first discount.
  Distinct coupon IDs may implement these paths but cannot reset the shared right.
  No stacking; yearly, past-due, incomplete, scheduled cancellation, active trial,
  ambiguous ownership, existing discounts and pending subscription changes are
  ineligible. Former subscribers without an active subscription can use their
  unused allowance for a new monthly subscription. A redeemed personal promotion
  cannot be reissued; an unused reservation can resume only the same verified
  customer-bound code. Missing or inconsistent evidence requires reconciliation.
- Campaigns are explicitly enabled for the staging rehearsal, with no invented
  deadline/urgency. LIVE configuration remains absent. Disabling new claims must
  preserve already accepted promises and retry reconciliation.
- Discounts, eligibility, prices, owner and claim state are server-owned. Reload,
  reinstall, account switching, concurrent clicks and lost responses must not
  create duplicate grants/checkouts or expose another owner's information.
- No trial scenario in this new UI. Existing legacy obligations elsewhere remain
  untouched. Retain the project's pinned Stripe API/SDK in this bounded change.
- Survey is optional and independent of purchase, login and reinstall. One reason
  plus optional 500-character note; explicit submit, durable private storage,
  same-origin and input limits, durable rate limit, idempotency; no email/push.
- Use real website Geist/tokens and extension orange CTA. No generic welcome
  slogan, neon, duplicate fine print, fake success, fake prices or mock accounts.
- Reuse existing account sessions, checkout reservation/reconciliation and billing
  management. Default monthly; explicit price review before financial actions.
- Evidence must separate unit/SQL/browser/proof-script checks from owner acceptance.

## Task 1: Server contracts, durable data and billing

Implement server-owned uninstall offer + feedback APIs, additive private schema,
and billing integration. Suggested focused modules: `uninstall-offer.ts` (pure
policy/DTO), `uninstall-offer-server.ts` (DB/Stripe adapter),
`uninstall-promotion.ts` (first-purchase provisioning),
`retention-invoice.ts` (exact renewal fulfillment), `uninstall-routes.ts`, their
tests, API route wrappers, and one additive migration. Keep responsibilities
separate. Reuse existing helpers instead of copying whole billing services.

Public contract: `GET /api/uninstall/offer` returns an owner-bound discriminated
DTO with `ownerUserId: string|null`, `validForMs`, and kind `sign_in`, `first_month`,
`renewal`, `claimed`, `manage`, `former`, `unavailable` or `disabled`; price fields
are integer cents, currency USD, plan plus/pro, monthly. Include clear reason for
ineligibility, management link and renewal timestamp only as applicable.
First-month includes both verified plan prices and their 40% discounted amounts.
Renewal includes current plan, ordinary and discounted renewal price, next date,
and an opaque review revision binding exact owner/subscription/period/price.
`POST /api/uninstall/checkout` accepts selected plan, expected owner and displayed
price/offer revision, UUID request ID; rechecks and uses existing shared Checkout
reservation, returns verified Stripe URL. Never silently drops a discount.
`POST /api/uninstall/claim` accepts expected owner/revision and reserves the exact
next renewal; repeat identical claim restores existing result. `POST
/api/uninstall/feedback` accepts UUID submission ID, fixed reason and optional
note; can be anonymous, no PII in URL. DTOs live outside server-only modules.

First purchase must integrate into the existing reservation/recovery machinery:
frozen campaign identity in reservation attribution, correct policy matching,
retire incompatible sessions before exposing a new URL, reconcile ambiguous
creation. Use an account-bound one-redemption Stripe promotion (no public code
required), apply it automatically to Checkout, disable manual stacking, validate
Stripe ownership/metadata/catalog and the durable grant plus promotion redemption
state. Prior ordinary invoices do not exclude returning subscribers. Do not reuse the
Product Hunt campaign or leak coupon/promo IDs to client. Both old and new
reservation recovery paths must preserve frozen terms, including normal checkout
after an abandoned offer and vice versa. No browser-supplied Stripe IDs.

Retention design: reserve an exact future monthly period; at signed
`invoice.created`, apply the isolated campaign coupon to the matching draft
renewal invoice only. Never attach a broad coupon to the subscription/customer.
Validate customer/subscription, mode, billing_reason=subscription_cycle, exact
period start, single eligible monthly price/quantity and no proration/other
discounts. Persist invoice binding atomically before external I/O. Stripe writes
use a stable idempotency key and verified readback; duplicate/delayed events and
lost replies reconcile the same invoice. Transient failures return retryable
webhook failure. Finalized-without-discount outcomes are explicit errors requiring
reconciliation, never claimed successful. Cancellation/annual/pending changes
before the target invoice must not receive discounts or get reversed. Do not
delay or mutate unrelated invoices. Skip near-boundary claims where an invoice
may already be issued; verify no target draft/open invoice before acceptance.
Ensure claim reads restore accepted/applied state and billing overview can show
the correct pending discounted next renewal without confusing ANIHUNT40.

Additive migration: service-role-only tables/RPCs, fixed search_path, ACL/RLS;
shared lifetime account uniqueness across both paths, immutable owner/customer,
  atomic invoice claim,
idempotent feedback with durable per-window admission. Retain existing data.
No secrets/env reads in output. Use existing environment's Stripe client with
new explicit TEST campaign opt-ins; no unsuffixed/LIVE fallback for campaigns.
Persist coupon identity in claims so stopping new issuance doesn't break promises.

Test behavior: anonymous; never-paid/former/active monthly/yearly; no-active-trial
new UI; positive/zero/refunded history; foreign/multiple mapping; missing catalog;
already discounted/past_due/cancellation/schedule; two simultaneous claims;
wrong owner/revision/amount; expiry; repeats after reload; checkout replay and
normal/offer replacement; webhook duplication, manual/proration/annual invoice,
wrong period/subscription, network/DB failure after Stripe commit; feedback
rate-limit/idempotency/oversize/foreign-origin. Run focused tests and web check,
then full web test once before report. SQL should be replayed in disposable DB.
Report all API shapes and SQL/deployment dependencies for Task 2 and operator.

## Task 2: Real uninstall page

Port the accepted prototype into `apps/web/app/uninstall` using actual site
components/tokens; GET server offer, no mock scenario selector. Preserve compact
layout, 14px readable one-line terms, paid cancellation notice with short Manage
action; eligible former users share the new-subscription offer. Render no
wrong-account/free flash during refresh.
Show honest retry state on unavailable; no purchase when unverified.

November 5 local UX correction (awaiting owner review, not deployed): periodic
offer refresh preserves the open step and selected plan when owner and displayed
terms match. Focus/visibility changes temporarily hide account-specific details
and invalidate actions, then restore the same step after verification. A changed
owner, price, eligibility or renewal date closes financial review; reinstall
instructions remain open. Failed reads preserve a retryable step without old
prices. Periodic reads must not discard an in-flight action result. The action's
own fresh read still validates the reviewed token/expiry and displayed terms;
server ownership, snapshot and idempotency checks remain authoritative.
Signed-out CTA goes directly to login with the selected plan in the return URL.
Management appears once for subscribers, with no duplicate action on restricted
offers or irrelevant management link on verified new-subscription offers.
Anonymous/unverified users retain account management access. Restriction copy
distinguishes overdue/incomplete payment, paused billing, canceled renewal,
yearly plans, existing discounts and pending changes without changing eligibility.

First purchase: two monthly plan choices with server price, then explicit
continue to real Stripe checkout. Signed-out selection survives OAuth at
`/uninstall?plan=plus|pro`; authenticate through existing login, re-evaluate
status after login, route existing subscriber to current subscription offer.
Never create a second subscription. Selection and survey draft survive auth;
draft stays local until explicit send. Use same-tab sessionStorage with bounded
schema for draft only, clear after send. Return from billing/checkout to valid
same-origin destinations. Do not automatically perform a financial action when
returning from OAuth. Real owner/revision guards before action and navigation;
stale/background responses cannot overwrite another account or imply success.

Monthly renewal opens a confirmation with actual next amount/date and ordinary
price. Explicit Apply to next renewal invokes claim; button disappears only after
verified accepted response; refreshing restores claim. Management always remains
available. Annual/existing discount/cancellation/past_due/used allowance get truthful
management/regular pricing with no invented discount. No legacy trial UI.

Optional survey reason list matches prototype, 500-char optional note, disabled
submit until selected, accessible status/error, preserve form height on thanks.
Real reinstall destination comes from approved channel installation config;
staging build must not pretend Store installation restores staging. Keep
management accessible. Native dialog keyboard/escape/focus, responsive 390px,
reduced motion. Test actual component owner transitions, failed actions/retries,
double submits, auth continuation and successful feedback. Run check/focused
tests, visual desktop/mobile inspection; controller handles hosted acceptance.

## Task 3: Extension uninstall URL

Register channel-specific `/uninstall` using Chrome runtime.setUninstallURL when
background starts and on installation/update. No query/hash identifiers or new
permissions. Failures should be observable and not break auth/background. Use
existing WEB_HTTP_BASE/environment validation. Cover correct staging/production
target and invalid origins in focused test, extension check/full tests once,
staging build/validation. Do not uninstall the owner's loaded extension; controller
refreshes the same two known unpacked folders after reviewed staging delivery.

## Task 4: Evidence, delivery and owner test

Controller: full branch review; Graphify semantic update; pnpm dev:check and
required checks. Prove actual first-month and exact renewal discounts in AniDachi
Sandbox with disposable test customers/test clocks, including following month
full price and duplicate/proration/annual cases. Reuse repository safe Stripe
proof transport. Before enabling claims verify existing staging webhook receives
invoice.created; preserve its other event types/API version. Schema-first delivery
from frozen reviewed feature SHA; PR into staging; CI/READY web validation;
staging-only campaign configuration and fresh deployment; smoke endpoints and
private SQL ACLs. Keep production unchanged. Build validated staging extension,
backup and refresh established folders, hashes and build identity. UI/API smoke
with authorized disposable normally authenticated account where possible; do not
use real user credentials. Clearly leave owner login/Checkout/Chrome visual
acceptance for user if not available, with URLs and exact steps.

Rollback: disable new offers using staging env gates; retain invoice fulfillment
for already accepted claims. Stop new client entry with prior extension if needed.
Do not drop claims, surveys or revert to a webhook that loses promises. Existing
production is outside this delivery. Tax settings are unchanged; display USD
before tax and use Stripe's actual Checkout total.
