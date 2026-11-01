# Free20 trial retirement implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for implementation and independent review. This is the first bounded slice of the owner-authorized staging-readiness work.

**Goal:** Make the switch from new trials to Free20 atomic and safe, preserving every already accepted trial/payment operation.

**Architecture:** Existing SQL commercial policy remains the issuance authority. Additive guards serialize new reservations with policy changes; Web offers use consistent current authority. Recovery and payment synchronization retain their existing contracts.

**Tech Stack:** PostgreSQL/Supabase, Next.js/TypeScript, existing Stripe subscription services, node:test and pgTAP.

**Spec:** [Free20 design](../specs/2026-10-30-daily-free20-design.md), particularly decisions D1/D10 and section8. Parent: [transition plan](2026-10-30-daily-free20-transition.md).

## Authorization and global constraints

- On November1 the owner authorized bringing staging to working Free20, including new-trial retirement, necessary UI/client compatibility, and controlled staging activation/testing. This supersedes historical default-off-only implementation permissions for that staging work. Main, production, Store publication, LIVE Stripe, prices and promotional campaigns remain outside scope.
- The owner selected one host warning at **300 seconds** remaining: small capsule-adjacent message, View plans and dismiss, no dimming/pause, once per account UTC budget. Warning implementation is a later slice; final visual polish remains iterative on staging.
- This slice delivers dormant guards; it does not switch hosted policy or runtime flags. Activation follows compatible client/presentation delivery and the operational readiness checks.
- New trials stop; accepted reservations and started trials retain original identity/deadline/renewal/payment terms. No ledger reset, mass Stripe cancellation, new auth/secret, or hosting activation timestamp reset.
- Keep existing paid-only, monthly/yearly, old request formats and service-only SQL boundaries. Free20 remains1200 host seconds per UTC day with existing accounting.
- Preserve preexisting `.serena/project.yml` changes.

## Review focus

1. A request read old eligibility before cutoff but tries to insert afterward: reject the stale trial reservation under a policy-row lock.
2. A trial reservation committed before cutoff but Stripe result is unknown: replay/recover the original operation, never drop it or create a second trial.
3. Offer reads straddle a policy revision: never combine old trial eligibility with new offer terms.
4. Pending activation or existing paid/trial access during retirement: preserve manage/recovery, original expiry and explicit payment consent.
5. Free20 tests or old paid Checkout paths under the new invariant: keep valid fixtures truthful and preserve ordinary paid reservations and role denial.

## Task1: SQL cutoff and consistent pricing offers

**Files:**
- Modify the new migration `apps/web/supabase/migrations/20261101092311_free20_trial_retirement_guard.sql`.
- Modify `apps/web/lib/anidachi-auth/pricing-offer.ts` and its existing tests.
- Add `apps/web/supabase/tests/free20_trial_retirement.test.sql`.
- Add `apps/web/supabase/contracts/free20_trial_retirement_concurrency.mjs`.
- Update existing SQL fixture policy setup where the new invariant requires `trials_enabled=false` with Free20; do not weaken assertions.
- Add focused existing cardless/Checkout service regression tests when needed; production recovery code changes only if an actual defect is proven.

**Interfaces:** retain current public PricingOffer/HostingAccess shapes, existing trial/Checkout RPC signatures and error contract `CARDLESS_TRIAL_OFFER_CHANGED` (existing409 mapping). No new environment flag or top-level start/recover short circuit.

- [x] Add tests showing the old signed-in offer can advertise a trial despite current trials=false or mismatched hostingPolicyVersion/activation timestamp; ensure pending activation/manage precedence is preserved.
- [x] Add real SQL tests: `free20_enabled=true` with `trials_enabled=true` is invalid; after cutoff fresh v1/v2 cardless requests and stale legacy trial inserts fail; accepted request replay/attempt completion remains possible; plain paid reservations remain possible.
- [x] Add a labeled-local-container-only multi-session test with deterministic transaction barriers. Cover trial reservation holding policy SHARE before cutoff (cutoff waits, accepted request survives), cutoff committing before stale trial INSERT (rejected), cardless accepted replay after cutoff, and rollback. Verify no unsafe account/policy lock-order inversion.
- [x] Run focused RED before implementing; record product assertion failures separately from tool/setup errors.
- [x] Add CHECK `NOT free20_enabled OR NOT trials_enabled`. Replace only the current checkout INSERT guard: preserve activation-busy/account locking and existing cardless check, acquire current singleton policy `FOR SHARE` before permitting `trial_offered`, fail closed if policy missing/disabled/Free20 active. Do not mutate accepted reservations, historical migration files or issuance state in this migration.
- [x] Gate a new trial offer on current `trials_enabled`, active policy and matching authority revision/activation. Invalid/mixed authority cannot produce action=trial or trialAvailable=true. Keep manage/recovery available; use the current subscribe/check-again contract for unavailable offers, with no automatic paid purchase. Update mock fixtures to contain real revision fields; do not accept missing revision as compatible authority.
- [x] Run focused tests, real SQL tests/concurrency and relevant existing billing/trial/Free20 SQL regressions. Run full Web test/check once after final code. Preserve the six existing external-artifact-dependent skips with explanation.
- [x] Self-review and commit only owned implementation/test files. Root owns docs/graph and integration.

## Task2: Independent review, documentation and delivery

- [x] Independently review Task1 for lock ordering, stale authority, accepted-operation recovery, RPC roles and compatibility. Commit `2997ddb6` approved without Critical/Important findings; 463 SQL assertions, five concurrency groups and Web1457 passing tests/six existing artifact skips recorded. Whole-candidate review remains later.
- [ ] Update current state/Free20 contract/transition plan; record that retirement is prepared and actual flags remain unchanged until later staging activation. Run Graphify Codex semantic extraction on complete changed sources through the safe adapter.
- [ ] Integrate this dormant slice into the [coherent staging-readiness candidate](2026-11-01-free20-staging-readiness.md), then run `pnpm dev:check`, applicable checks, PR into staging, CI and post-deploy Web/SQL checks. Source presence alone is not enabled/Sandbox acceptance.
- [ ] Continue the same authorized overall staging task with current-client warning, old-host update admission, truthful public/account copy and operational activation/rehearsal. Freeze separate exact contracts before each cross-plane slice.

## Activation handoff (later slice)

Inventory accepted pending/unknown cardless operations and old trial Checkout URLs without exposing personal data or secrets. Reconcile existing sessions using original idempotency keys; open sessions must expire and be re-read, concurrent completion must sync and preserve its original terms, unknown outcomes remain held. Do not invent a successful cleanup from a DB flag alone.

After compatible runtime and UI acceptance, atomically compare the expected policy revision and set Free20=true/trials=false with one revision increment, preserving activation_at and other flags. Do not reuse historical activate_paid_hosting_v1. Runtime/SQL enabling order and rollback must be documented before changing hosted configuration. Old rooms/usage/assignments remain intact; disabling SQL after active marked rooms exist is not advertised as seamless rollback.

## Rollback

Before activation, additive SQL guards can remain while Web is reverted; no account/payment data rollback. After activation, retain new-trial cutoff, accounting and compatible room readers. Stop new admissions through a separately reviewed procedure or forward-fix; do not erase Free20/trial/Stripe state or re-enable trial offers casually.
