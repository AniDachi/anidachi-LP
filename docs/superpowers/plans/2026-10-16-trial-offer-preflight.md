# Trial Offer Preflight Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, TDD, and a final independent review.

**Goal:** Show a confirmed trial or explicit priced purchase before any activation, with existing abuse protection.
**Architecture:** Existing account offer plus cookie/optional installation proof feeds a read-only marker RPC. Start still uses atomic reservation. Website consumers share one preflight client; extension uses neutral navigation.
**Tech Stack:** TypeScript, Next.js, PostgreSQL, React, WXT.
**Spec:** ../specs/2026-10-16-trial-offer-preflight-design.md

## Global Constraints
- Staging only; preserve root design checkout and all paid/current/recovery behavior.
- No marker claims, Stripe writes or trial starts from preflight. Missing extension is cookie-only; malformed supplied proof is retry.
- No identifiers in logs/URLs, new secrets, broad permissions, polling or weaker final reservation.

## Review Focus
- Account/visibility change during proof or response must retire stale confirmation.
- Pending own activation takes precedence even if cookies disappear; another pending marker is never paid-only.
- A consumed marker remains denied after receipt expiry; clearing only cookie is caught when the extension responds.
- Paid confirmation cannot be inherited from the free-trial click after a race or expiry.
- Old clients remain protected by atomic start and guard; RPC migration must precede new Web for availability.

### Task 1: Server preflight
**Files:** additive migration, supabase/tests/trial_offer_preflight.test.sql, lib/anidachi-auth/trial-offer-preflight.ts and .test.ts, app/api/billing/trial/offer/route.ts.
**Interfaces:** read_trial_marker_status_v1(user,browser,installation) -> available|used|busy|account_changed; POST offer -> owner-bound ready + PricingOffer, or retryable state.
- [x] Write route/SQL tests for no claims, account priority, expired/consumed/reserved markers, ACL, invalid proof and failures. Run: pnpm --filter @anidachi/web exec tsx --test lib/anidachi-auth/trial-offer-preflight.test.ts; Expected FAIL missing implementation.
- [x] Add service-only read RPC and same-origin owner-bound route reusing marker verifier and purchase denial receipt.
- [x] Run route and real PostgreSQL contracts; Expected PASS. Commit server change.

### Task 2: Shared website flow
**Files:** lib/trial-offer-client.ts and .test.ts, checkout-continuation.tsx and tests, pricing.tsx and tests, pricing-offer.ts.
**Interfaces:** resolveBrowserTrialOffer(offer,signal,requestId) -> {offer,context?,extensionProof?}; uses Task 1 endpoint.
- [x] Add failing tests for used marker before trial display, pending/error, owner fencing, no automatic purchase and new request/proof reuse. Expected FAIL before implementation.
- [x] Integrate preflight, loading indicator and explicit ordinary purchase. Remove recurring pricing polling; retain expiry/focus/action freshness.
- [x] Run affected web tests/check; Expected PASS. Commit website change.

### Task 3: Extension entry points
**Files:** hosting-paywall.tsx, hosting-offer-link.ts, player-onboarding.tsx and respective tests.
**Interfaces:** View plans -> /pricing?plan=plus&billing=monthly; website owns full eligibility.
- [x] Add failing tests for neutral notice/onboarding and preserved selection. Expected FAIL.
- [x] Update entry points, keep current access/error/ended states. Run extension check/tests; Expected PASS. Commit.

### Task 4: Review and staging
- [ ] Update current-state/domain docs; perform Graphify update or record precise exception.
- [ ] Run full web/extension checks/tests, SQL, build/validate staging extension, local UI and dev:check.
- [ ] Independent whole-branch review; fix Important/Critical findings with regression tests.
- [ ] Two ordered PRs to staging (DB, then runtime), wait CI, merge; verify migration/web/artifact/smoke and hand off exact ZIP. No main promotion.
