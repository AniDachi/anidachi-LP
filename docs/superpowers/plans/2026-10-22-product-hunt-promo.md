# Product Hunt monthly promotion

## Goal

Implement ANIHUNT40 in existing Stripe Checkout: 40% off the first three paid
monthly periods for Plus/Pro, once per AniDachi account that has never paid a
subscription. Cardless trials are unchanged. Redemption closes at the start of
November 2, 2026, 00:00 UTC+7 (2026-11-01T17:00:00Z, exclusive).

## Architecture and constraints

Web authenticates the owner and preserves its existing Checkout reservation and
recovery authority. A service-only, durable campaign/customer binding makes one
customer-specific Stripe code per account recoverable across retries. Stripe owns
discount calculation and redemption. No browser promo field, new marketing page,
extension, Worker, entitlement or trial/anti-abuse change. Sandbox and staging
first; production activation requires separate staging acceptance.

Annual Checkout has no promotion entry. Sandbox proof on October 22 established
that Portal `subscription_update_confirm.discounts=[]` becomes null and retains
the subscription discount: annual $76.70 becomes $46.02 before the prorated credit.
It must not be shipped as discount removal. The owner approved delaying annual
conversion until the campaign discount ends. Monthly renewal then continues at
the regular price; annual purchases by other accounts remain unchanged.

Tech stack: Next.js/TypeScript, existing Stripe SDK/API version, Supabase SQL,
node:test. Specification: the approved conversation and constraints above.

## Review focus

1. Annual purchase/Portal/old open sessions must not accept campaign discounts.
2. Owner/customer mapping, concurrent enrollment and unknown Stripe outcomes.
3. Past trial vs prior paid invoice; zero-dollar trial invoices are not purchases.
4. Discount deadline, single redemption, failure recovery and existing subscriptions.
5. Trial activation, consent and Checkout reservation replay remain unchanged.

### Task 1: Durable campaign binding and eligibility

- [x] Add service-only campaign binding with account/customer uniqueness.
- [x] Write and run failing tests for never-paid eligibility, owner/mode checks,
      concurrent/replayed issuance and consumed/inactive codes.
- [x] Implement bounded Stripe validation and customer-specific code provisioning.
- [x] Run focused tests and disposable SQL checks; expected: all pass.

### Task 2: Checkout and annual boundaries

- [x] Freeze a server-owned promotion-policy version in new reservations.
- [x] Add failing tests for annual entry, old sessions, trial exclusion and retries.
- [x] Integrate campaign provisioning without changing frozen legacy replay.
- [x] Apply the owner's chosen annual-conversion behavior and test its boundaries.
- [x] Run checkout/billing tests; expected: all pass.

### Task 3: Acceptance and delivery

- [x] Configure only Sandbox after cutoff is confirmed; retain proof object IDs.
- [x] Exercise monthly redemptions, three renewals, trial/past-paid exclusion,
      annual protection, expiry and failed payment recovery in Sandbox.
- [x] Verify account billing doesn't claim list price is a discounted next charge.
- [x] Run full web check/tests, dev:check and independent branch review.
- [ ] Update domain/runbook docs and Graphify using the safe adapter.
- [ ] Deliver additive schema before runtime through staging PRs and verify deployment.
- [ ] Report remaining human acceptance; do not activate LIVE.

## Evidence / ledger

- Branch `codex/product-hunt-promo` starts at staging `47d53867` in an existing
  clean managed worktree; unrelated primary extension WIP is untouched.
- Baseline web: 1353 passed, 6 skipped, zero failed (1359 tests).
- Sandbox annual proof customer `cus_VUJhwFN0WteMPB`, subscription
  `sub_1UTL4tPQIEOqG7prhP1jDq5B`, coupon `anihunt40_annual_proof_20261022`.
  Test-only first payment was $4.79. No annual change confirmed; no LIVE writes.
- Coupon `anihunt40_monthly_2026_test` exists only in Sandbox, with exact approved
  cutoff and product restriction. Runtime env not activated yet.
- Pinned Basil API proof (`scripts/stripe/product-hunt-proof.ts`) used clock
  `clock_1UTLWjPQIEOqG7prQsUiofjd`. Plus `sub_1UTLX6PQIEOqG7prOCiqA9qB`,
  Pro `sub_1UTLXDPQIEOqG7prLwhF2o6g`: invoices 1–3 are $4.79/$8.99; invoice 4
  is $7.99/$14.99. A real expired three-day test trial qualifies; prior paid
  account does not; repeated provisioning preserves a single one-use code.
- Disposable PostgreSQL: 11 assertions plus 8 concurrent claims return one
  binding. Browser/anonymous access denied; service runtime cannot reset rows.
- Full web suite: 1368 passed, 6 skipped, zero failed (1374 total).
- Local `/dev/billing` visual inspection: discount, next monthly amount, regular
  price after discount, and annual-transition explanation. No live payment action.
- Independent review: 110 focused tests passed and no Critical/Important defect.
  Controller narrowed annual deferral to campaign discounts, preserving unrelated
  coupon behavior; expanded unknown discounts fail verification. Four annual
  tests pass, including the new scope regression.
- Sandbox edge proof (`scripts/stripe/product-hunt-edge-proof.ts`): foreign
  customer redemption rejected; a declined first invoice stays $4.79, then the
  same invoice is paid for $4.79 with the original discount and one redemption.
  Hosted Checkout accepts ANIHUNT40 and displays 40% off for 3 months.
- Schema-only staging PR: https://github.com/AniDachi/anidachi-LP/pull/464.

## Deployment order and acceptance

1. Merge schema-only PR to staging; confirm `Deploy migrations to staging`.
2. Merge runtime PR to staging; check CI and the exact staging deployment.
3. Set TEST coupon variable only for Preview branch `staging`, redeploy that ref.
4. Fresh/expired-trial account: monthly Checkout accepts ANIHUNT40; annual has no
   promo entry; authenticated customer mapping remains stable. Already paid,
   active trial and consumed code cannot gain another discount. Confirm payment
   recovery on the existing invoice and no annual Portal during the discount.
5. Owner accepts staging. Production requires separate explicit authorization,
   fresh LIVE coupon/catalog audit and schema-first promotion; do not copy test IDs.

No new website promotion field is introduced. Guests retain normal login/signup
continuation. A cardless trial continues to require explicit renewal consent;
to use this campaign, let it expire and then choose monthly Checkout. A prior
free trial is allowed; Stripe's `first_time_transaction` restriction is deliberately
not used. Campaign access never changes trial eligibility or hosting entitlement.

## Rollback

Disable new campaign issuance, retain bindings and existing discounts/redemption
history. Keep annual safeguards until all campaign discounts have ended. Do not
restore universal annual promotion entry or replay a consumed code. Existing
trial reservations, renewal consent and anti-abuse records must be preserved.

## Unknown promotion outcomes

An account binding older than 23 hours with no discoverable code deliberately
fails closed. Inspect only that binding's customer, coupon, Stripe request logs
and promotion-code list, including inactive codes. Never delete the binding or
mint a replacement with a new redemption allowance. Recover an already-created
code only after verifying customer, campaign, binding ID and redemption count.
If creation cannot be disproved or the mapping differs, keep issuance blocked
and handle that account explicitly; do not reset trial or paid-history records.
