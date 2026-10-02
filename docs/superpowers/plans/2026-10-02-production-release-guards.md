# Production release safeguards

> **For agentic workers:** Use superpowers:executing-plans. Continue the approved
> local preparation; production delivery, Store upload/publication and activation
> remain separate owner decisions.

**Goal:** Prepare a controlled release without changing any existing purchased
subscription or promising an unavailable trial.

**Architecture:** Billing remains authoritative on the server. Public prices stay
immediately visible; trial wording requires a verified offer. Production Worker
delivery requires an explicit operator run after schema and compatible Web have
been verified. Staging retains its existing automated delivery.

**Tech Stack:** Next.js/React, TypeScript, Node test runner, GitHub Actions, WXT.

**Spec:** `2026-09-27-paid-hosting-and-trial-transition.md`, tasks 8–9;
`../../releases/paid-hosting-trial/cutover-operations.md`; owner's October 2
instruction to preserve all purchased subscriptions.

## Global constraints

- Preserve each existing Stripe customer, subscription/item/price, paid plan,
  billing interval, renewal anchor, paid-through date and cancellation setting.
- No subscription update/cancel, forced annual conversion, new trial for an
  existing subscriber, bulk entitlement rewrite or new charge as a release step.
- Normal renewals and explicit customer actions continue. Investigate natural
  changes during a before/after comparison; never restore a stale billing snapshot.
- No production/Stripe mutation, main promotion or Store action in this local block.
- Keep static prices, visible buttons, yearly default, current layout and explicit
  confirmation when an account's offer changes. No price/loading skeletons.
- Existing paid/trial rooms are outside the Free cutover target set.
- Every release claim distinguishes source/test evidence from deployed acceptance.

## Review focus

1. Unknown, pre-T and disabled-trial guest offers must not promise three free days.
2. An existing paid subscriber reaches management without a new checkout or mutation.
3. Expired/offline offers do not restore stale trial promises or hide public prices.
4. A main push cannot race schema/Web readiness by automatically replacing Worker.
5. A production package without an explicit reviewed version must not silently
   reuse the package/CI fallback; no local test ZIP is a release artifact.

## Task 1: Truthful pricing offers

**Files:** `apps/web/lib/pricing-offer.ts`,
`apps/web/lib/anidachi-auth/pricing-offer.ts`, `apps/web/components/pricing.tsx`,
and their existing pricing-offer/pricing-client tests.

**Interfaces:** Add optional `trialAvailable: boolean` to the web-only PricingOffer
response. Missing means unconfirmed. Guest availability requires an active T and
`trials_enabled=true`; signed-in availability follows verified account eligibility.
No checkout, subscription or shared room contract is changed.

- [x] Add regression cases for guest T=NULL, future T, disabled trials, active
  trials, unknown/expired offers and existing paid subscriber management.
- [x] Run focused tests; observe the new unavailable-trial cases fail.
- [x] Implement server flag and neutral `Choose Plus/Pro` CTA until confirmed.
- [x] Run focused tests and web typecheck; 32 focused tests pass.
- [x] Commit implementation: `2d0138fa`; full web suite 966 pass, 6 existing skips;
  corrected paid-plan fixture rechecked separately (7 pass), typecheck/lint pass.

## Task 2: Explicit production delivery and package version

**Files:** `.github/workflows/deploy-api.yml`,
`.github/workflows/build-extension.yml`, `scripts/build-extension-public.sh`,
`scripts/worker-deploy-gate.mjs`, its Node tests, and existing extension build tests.

**Interfaces:** `assertWorkerDeploymentAuthorized({refName,eventName,sha,
confirmedProductionSha})` accepts staging or a manually dispatched main run with
an exact full-SHA acknowledgement. It is an operator gate, not proof that remote
prerequisites are healthy. Runbook must require actual schema/Web verification.

- [x] Add guard regression cases: main push denied, wrong/missing SHA denied,
  other branches denied, exact main dispatch and staging allowed.
- [x] Observe failures, then implement guard and production manual dispatch gate.
- [x] Require explicit WXT_EXTENSION_VERSION for production in local builder/CI;
  retain staging default. Verify missing version fails before artifact writes.
- [x] Run guard and extension build tests/check; 5 guard and 2,163 extension tests
  pass; extension typecheck passes. Keep shared
  test ZIPs separate from immutable release candidates.
- [x] Commit implementation: `0d4001fd`. Workflow YAML parses; shell syntax and
  explicitly identified local staging build/artifact validation pass.

## Task 3: Preservation procedure and recovery constraints

**Files:** `docs/releases/paid-hosting-trial/production-preparation-2026-10-02.md`,
`docs/releases/paid-hosting-trial/cutover-operations.md`,
`docs/extension-release-channels.md`, `docs/current-development-state.md`,
and their canonical operating-manual/architecture command examples.

**Interfaces:** Operational evidence identifies exact schema/Web/Worker/ZIP
versions; no document supplies authority to mutate production.

- [x] Record paid-subscription preservation and read-only before/after verification.
- [x] Correct rollback guidance: old Worker may lose terminal intent even before T.
- [x] Record the compatible pre-T Web/public-content requirement, LIVE price/Portal/
  webhook/open-Checkout review, production push-key match and privacy/Store gates.
- [x] Keep final promotion, compatible bridge deployment, LIVE setup and first
  post-trial invoice observation open until performed and accepted.
- [x] Run web suite, appropriate tooling checks and dev:check. Local browser
  inspection confirms immediate static prices, yearly default and neutral CTA.
- [x] Independent final review: no critical/important findings. Address its queue
  note by allowing push-triggered Worker delivery only from staging, preserving
  pending manual production runs as well as active runs.
- [x] Reconcile canonical manual/current-state deployment guidance and production
  build examples with the new local gate and explicit version requirement.
- [x] Complete graph semantic update and record final local status. The safe
  adapter refreshed all seven changed documentation sources and the affected
  code; graph integrity checks found no duplicate IDs or dangling endpoints.
  Implementation and preparation stay local on `codex/production-release-guards`;
  staging delivery and production execution remain separate open release gates.

Verification scope: no API, SQL, room/P2P or checkout mutation is changed here;
the broad `dev:check` all-profile recommendation comes from workflow edits.
Room/media harness and remote deployment runs are intentionally deferred. Guard
tests, real channel builds and YAML/shell checks cover the changed tooling;
successful target GitHub workflow execution remains required after staging delivery.

## Task 4: Staging delivery and final release candidate, October 2

The owner authorized this follow-up after the Sandbox lifecycle verification.
No new public-copy rewrite or production deployment is part of staging delivery.

- [x] Refresh origin refs, confirm clean candidate and no automatic main promotion.
- [x] Re-run affected checks: extension 2,163/2,163 and web 966 passing/6 existing
  skips; both typechecks and all 5 Worker deployment gate tests pass.
- [x] Record Sandbox first-payment failure/recovery, exhaustion and monthly renewal
  results, with actual webhook/application states and explicit remaining gaps.
- [x] Reconcile the owner's Store-first review decision with the release order;
  existing subscribers and current production remain preserved.
- [ ] Refresh semantic graph, complete final independent review and dev:check.
- [ ] Open PR into staging, wait for required CI, merge and verify actual Web/Worker
  delivery. Keep the standing staging-to-main PR without auto-merge.
- [ ] Build/validate the exact merged staging artifact, record SHA-256 and hand off
  the remaining loaded-extension/3DS/open-room user acceptance.
- [ ] Prepare the separately gated production Store artifact after exact dashboard
  version, production public-key and current-server compatibility verification.

Ruling: the existing implementation Tasks 1–3 are already committed and verified;
do not reimplement them. The rejected pre-Store marketing rewrite is not revived.
The usual main-first packaging order must not trigger premature public deployment:
the Store review ZIP can be built from accepted frozen staging source, with exact
identity, checks and a later recorded source promotion. Production mutations and
publication still require the owner's separate release decision.

## Task 5: Separately authorized LIVE annual catalog preparation

The owner approved this explained block after reconnecting AniDachi LIVE with
write access. It does not broaden Task 4 into production deployment.

- [x] Recheck the LIVE account, catalog and purchased-subscription baseline.
- [x] Create Plus $76.70/year and Pro $143.90/year on their existing products.
- [x] Create/read back a non-default yearly confirmation Portal with immediate
  proration, only the annual targets, fixed quantity and preserved trial end.
- [x] Compare existing subscriptions, monthly prices/products, default Portal and
  webhook before/after; no differences.
- [x] Record public IDs, private evidence location and the legacy-product limit in
  [the LIVE catalog receipt](../../releases/paid-hosting-trial/live-annual-setup-2026-10-02.md).
- [ ] Connect production yearly env IDs and verify checkout/Portal after compatible
  deployment in the separately agreed launch window.
- [ ] Explain and complete the webhook action-required preparation.
- [ ] Agree/verify a voluntary annual conversion path for the old Crunchyroll Fan
  product; retain its existing subscription until explicit customer action.

## Current evidence and decisions

- Baseline: staging `3998250d`; two local welcome commits end at `89eb1deb`.
- Production Web/main remains `a5a0134e`; no new paid-hosting schema in production.
- LIVE annual prices and the separate Portal are prepared (Task 5); production
  annual env and the cutover drain secret remain unconfigured.
- Public Store shows 0.1.1; dashboard highest-uploaded version must be checked
  before selecting the next version. CI production version variable is absent.
- The owner rejected a separate pre-Store marketing bridge. Preserve current
  production during review and follow the coordinated launch order in the
  preparation record. Prepare compatibility proof without changing public copy.
- Native execution; keep checks proportional, preserve all existing user changes.
