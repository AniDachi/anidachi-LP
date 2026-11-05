# Stripe Cancellation Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a monthly-only native Stripe cancellation offer sharing the existing one-per-account uninstall allowance.

**Architecture:** Separate new annual products from existing monthly products so Stripe enforces coupon scope. Reserve a short-lived private offer before native issuance, reconcile provider redemption, and serialize all discount paths on the same account lock.

**Tech Stack:** Next.js/TypeScript, Stripe pinned API/SDK, Supabase PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-05-cancellation-retention-design.md`

## Global Constraints

- TEST/staging only. Stripe API `2025-08-27.basil`; no SDK upgrade or production changes.
- 40% on one monthly renewal; one lifetime allowance shared with uninstall.
- Annual conversion remains available and receives zero reduction from this coupon.
- Opening/declining/abandoning must not consume the lifetime allowance.
- Optional offer errors must not prevent ordinary end-of-period cancellation.
- Existing subscriptions, accepted uninstall promises, plan benefits and prices remain unchanged.
- Preserve unrelated `.serena/project.yml`; no secrets, artifacts or env files committed.
- User already authorized implementation and staging delivery; routine reversible implementation does not need another approval.

## Review Focus

- Archived annual price IDs must still resolve paid entitlements and billing history.
- Already-open Stripe annual/cancel tabs must not circumvent monthly scoping.
- Cross-entry-point concurrent requests must not create two redeemable discounts.
- A redeemed once coupon may disappear from subscription discounts; permanent allowance must survive.
- Optional dependency/provider failures must preserve ordinary cancellation.

### Task 1: Separate annual catalog compatibility

**Files:** Modify `apps/web/lib/anidachi-auth/stripe-plans.ts`, `yearly-billing.ts`, corresponding tests; add `cancellation-retention-catalog.ts` and test; update relevant catalog/env docs.

**Interfaces:** Keep existing price lookup functions. Add `verifyCancellationCatalog(stripe: Stripe): Promise<{productIds: [string,string]; monthlyPriceIds: [string,string]}>` in the new module. It is TEST-only, obtains configured Plus/Pro monthly and yearly IDs, retrieves all four prices, verifies exact shapes and plan pairing, requires annual products distinct from either monthly product, and lists active prices for each monthly product with `limit:100`/fail closed on `has_more`; only its configured monthly price is allowed active.

- [x] Add failing tests for cross-product annual conversion, same-product legacy compatibility, unknown/wrong currency/interval targets, and old annual IDs resolving entitlements.
- [x] Recognize comma-separated `STRIPE_PRICE_IDS_PLUS_YEARLY_LEGACY_TEST`, `_LIVE` and corresponding PRO variables, excluding empty tokens. These are recognition-only and never selected for a new purchase. Preserve all current mappings.
- [x] Allow yearly conversion to explicitly configured annual target on a different product; preserve all existing guards and unrelated coupon behavior. Do not add a cancellation-retention annual block.
- [x] Implement catalog verifier including rejection of shared monthly/annual products, any active alternate price on monthly products, missing/ambiguous/paginated inventories, and live mode.
- [x] Run focused tests then web check/full web tests. Commit only task files; report exact commands and evidence.

### Task 2: Durable lifetime reservation and reconciliation

**Files:** Add `apps/web/supabase/migrations/20261105120000_cancellation_retention.sql`; corresponding SQL test under existing Supabase tests layout; add `apps/web/lib/anidachi-auth/cancellation-retention-store.ts`, `cancellation-retention.ts`, optional focused `cancellation-retention-stripe.ts` with tests; modify `uninstall-store.ts` and existing shared claim RPCs through the new migration.

**Interfaces:** Export `prepareCancellationRetention(userId: string, customerId: string, subscriptionId: string, stripe: Stripe): Promise<string | null>` (coupon ID or no offer); `reconcileCancellationRetention(userId: string, stripe: Stripe): Promise<void>`; TEST-only env gate `STRIPE_CANCELLATION_RETENTION_ENABLED_TEST === '1'` (no unsuffixed/LIVE fallback). Export types/store helpers as needed within these modules. Import `verifyCancellationCatalog` from Task 1. Dependency-inject service/store to allow real behavioral unit tests.

- [x] Create private offer rows with immutable UUID/coupon identity, user/customer/subscription/price/products, target renewal, deadline, state `pending|accepted|expired`, timestamps. Partial unique pending constraints on user and customer. Add `cancellation` shared grant kind. Preserve old rows and privileges/RLS.
- [x] Add reserve/reconcile RPCs locking the same `billing_customers` row as both existing claim RPCs. Reserve rejects existing grant; reuses pending row. Existing uninstall first/renewal RPCs reject pending native offers under that lock. Reconcile records accepted+shared grant atomically; expired only after deadline with explicit server-supplied provider evidence. Never delete a grant. Test races, retries, ownership, permissions, deadlines and conflicts.
- [x] Build service: reconcile outstanding row first (even gate off). Fresh TEST customer/subscription ownership, current local mapping, no other active subscription, paid monthly invoice, no stacking/pending changes/cancel/legacy trial, verified catalog, target >1 hour. Reserve 10-minute hold before coupon creation, immutable deterministic coupon ID, metadata binding, 40% once/max1/monthly products/redeem_by. Retry exact coupon ID/terms, reuse and verify retrieved object; no replacement on timeout.
- [x] Reconcile using fresh coupon `times_redeemed` and full immutable-field checks, not current sub discounts. Redeemed -> accepted permanent grant; expired zero-use or provider-confirmed missing expired coupon -> expired row; uncertainty retains hold. No late creation/redemption beyond deadline. Existing accepted grants remain when issuance disabled.
- [x] If an old monthly cancellation page redeems after annual conversion, still record the explicit redemption once; no allowance restoration or coupon revocation. The coupon is monthly-product-scoped and yields zero annual discount. The integration task displays the actual annual price with monthly-only applicability.
- [x] Before reading uninstall offer history, reconcile pending TEST offers; update grant type to include cancellation. SQL remains final race guard. Surface pending as retryable unavailable, never permanent used; current UI can reuse ordinary retry behavior.
- [x] Run meaningful SQL and unit tests, full web tests/check, commit task files. Report published store interfaces for integration.

### Task 3: Native portal integration and staging delivery

**Files:** Modify `billing.ts`, `billing-server.ts` (or actual dependency assembly), `stripe-webhook-events.ts`/webhook route integration, `uninstall-billing-server.ts`, `apps/web/lib/billing-view.ts`, `apps/web/app/account/billing/billing-client.tsx`; add targeted integration tests. Update spec/current-state/env docs and graph after final behavior.

**Interfaces:** Task 2 prepare/reconcile functions; existing billing portal and signed Stripe sync callbacks.

- [ ] Inject optional coupon preparation into owner-checked cancellation deep link; on eligible success set `flow_data.subscription_cancel.retention={type:'coupon_offer',coupon_offer:{coupon:id}}`. Keep default config without global offer. If preparation fails or exceeds a five-second aggregate optional wait, omit offer; if native offer session fails, retry normal cancellation without retention. A late preparation may leave only a finite unused hold/coupon; handle its promise without unhandled rejection and never change the already-returned ordinary flow. Do not swallow owner/auth/config failures of ordinary cancellation.
- [ ] Add `cancellation_retention` BillingPromotion campaign, authoritative next monthly discounted price only while the verified native coupon is pending on a monthly subscription. Keep canSwitchToYearly enabled for this campaign; replace generic promotion-block text with `This discount applies to monthly billing only.` No ANIHUNT fallback text for this campaign. Once coupon is consumed or subscription annual, show ordinary next price. Add service/UI regression tests.
- [ ] Keep a pending native offer from blocking annual conversion in read-only billing presentation: `readUninstallAccount` now rejects unresolved pending native holds for issuance. Add a bounded presentation-only reader/option (default issuance remains strict) or equivalent separate native presentation path; preserve existing Product Hunt/uninstall guards. Merely opening a cancel offer must not hide the annual button.
- [ ] Reconcile after signed subscription/invoice sync and during billing refresh/uninstall access, including issuance off. Do not create offer merely to refresh state, and do not double-fulfill native coupon via uninstall invoice path.
- [ ] Test eligible/annual/used/failed/canceled/owner mismatch, normal restore, provider fallback, repeated portal requests, accepted grant after coupon disappears, duplicate/delayed events and annual conversion.
- [ ] Complete full web checks/tests, dev:check and relevant SQL tests; perform task and whole-branch review.
- [ ] Root delivery: create new annual TEST products/prices with identical commercial settings, keep old annual IDs as recognized legacy env values, update nondefault annual portal allowlist and staging env. Archive old annual prices before enabling offers; existing subscriptions keep old prices. Read back all changes. Migration before dependent deployment, issue gate off until full proof.
- [ ] Prove new annual target has zero coupon reduction, stale old annual confirm rejected, stale cancel behavior after annual change, native accept/decline, next monthly discount then ordinary invoice, lifetime coordination and rollback. Only disposable TEST resources.
- [ ] Feature PR -> staging CI/deployment verification, enable TEST issuance only after proofs. Report known native UI limits accurately; production untouched.


## Staging cutover and rollback

All actions below target AniDachi TEST and Preview branch `staging`; production
and LIVE remain untouched. Keep issuance disabled until the last step.

1. Review/merge compatibility and reconciliation only after applying additive
   migration `20261105120000` from the frozen feature ref with `db-staging.yml`.
   Verify hosted function definitions/ACLs and private table RLS.
2. Add recognition-only aliases for old annual Plus
   `price_1ULJ4FPQIEOqG7prxAO9Ju9I` and Pro
   `price_1ULJ4XPQIEOqG7prMHFwXHus` in exact branch scope.
3. Prepared inactive TEST annual targets: Plus `price_1UYOX7PQIEOqG7prIzN7uHLa`
   on `prod_VZXcHsKfpWie5i`, USD7670; Pro `price_1UYOX9PQIEOqG7pr94aORVJe`
   on `prod_VZXc6DiBkHmN0k`, USD14390. Copy existing exclusive tax treatment,
   licensed year/1, product tax code `txcd_10103000`; activate these targets.
4. Switch only the nondefault yearly portal `bpc_1ULJAFPQIEOqG7prMqpyZip0` to
   the two new annual products/prices. Keep `price` as the sole allowed update,
   `always_invoice`, unchanged anchor and empty scheduled conditions. Do not
   include monthly prices or alter the default cancellation portal.
5. Change configured annual purchase targets and deploy the compatible source
   as Preview branch `staging`. Verify READY and the staging alias. Do not use a
   custom `target: staging` or alter the production alias.
6. Once that runtime is active, archive the two old annual sale prices. Existing
   subscribers remain on their original prices and recognized legacy mappings.
   Verify each monthly product has exactly one active configured monthly price,
   new annual targets are active/separate, and provider/default portal state.
7. Enable `STRIPE_CANCELLATION_RETENTION_ENABLED_TEST=1` only in Preview branch
   `staging`, redeploy that same reviewed source, and record final readbacks,
   webhook/smoke and production-isolation evidence.

Primary rollback: set the new issuance gate off and redeploy the compatible
runtime. Keep reconciliation, accepted grants/coupons, legacy IDs and additive
schema. Do not delete redeemed offers or reset allowance. After any native coupon has been issued, keep the separated annual catalog
and old annual prices archived: restoring same-product annual sales could make
already-issued monthly coupons discount a year. A code rollback must therefore
retain catalog compatibility and legacy mappings. Before the first issuance, a
verified no-coupon rollback may restore prior env/config/price activity in reverse
order; once issuance begins, this is not the normal rollback. Never widen coupon
product scope or apply these coupons to annual invoices.

Provider receipts are in ignored `artifacts/cancellation-retention-20261105/`.
Session URLs, credentials, TEST fixture identities and generated artifacts are
not committed. Existing `.serena/project.yml` changes are excluded.
