# Plans

## Daily Free20: local inactive contract, October 30, 2026

- [Approved rules](../specs/2026-10-30-daily-free20-design.md) — account-wide 20 minutes per UTC day; existing trial/paid rights preserved.
- [Implementation plan](2026-10-30-daily-free20-transition.md) — only local Block 1A authorized; later implementation and delivery remain separately approved.
- [Contract and verification record](../../daily-free20-contract.md) — new standalone format, legacy compatibility and remaining gates.
- [Original handoff](2026-10-30-daily-free20-handoff.md) — historical planning checkpoint.

Active integrated release preparation:

1. [Vercel request-cost optimization](2026-10-14-vercel-cost-optimization.md) — approved isolated fixes and staging delivery; production unchanged.
2. [Request-cost follow-up](2026-10-14-vercel-request-followup.md) — approved startup/session/finalization corrections; candidate verification and staging delivery.
3. [Combined product release](2026-10-14-integrated-product-release.md) — source inventory, approved UI preservation, Netflix/trial acceptance, coordinated backend and Chrome Store gates.
4. [Approved drawer and hosting notices](2026-10-14-extension-drawer-staging.md) — selective staging integration; drawer delivery completed through PR422; PR423 adds transient room-end feedback.

5. [Approved player onboarding](2026-10-10-player-onboarding-local.md) — October 14 selective staging integration of the accepted six-step practice tour and rolling-logo finish; production excluded.

Active cardless trial work:

1. [2026-10-11-cardless-trial.md](2026-10-11-cardless-trial.md) — approved
   staging-first execution; the native Schedule mechanism passed 14 sandbox
   capability cases plus the already-open Portal check. Product code and UI are
   on staging through PRs410–415; the integrated release plan above records newer
   acceptance receipts and remaining proof boundaries. Production rollout is not authorized.

Files in this folder are historical execution plans and work logs. They are kept
because they explain why certain migrations and architecture decisions happened.

Most older files here are not current onboarding documentation. They may contain old local
paths, old repository names, old endpoints, and decisions that were correct at
the time but are no longer current.

Completed public-product recovery record:

1. `2026-08-23-waitlist-crm-durable-storage-recovery.md` — restored the durable
   waitlist counter and survey/contact/feature-request persistence through the
   existing private CRM store. Code, lossless data reconciliation, recovery of
   three failed leads, and fresh-deployment acceptance are complete. PR `#240`
   promoted the repair to `main` as
   `8cc5e4e6641ca55f0b62a320e8726de67900ce34`; Production remained at 685
   survey leads after a full redeploy, then durably accepted a distinct live
   signup and advanced to 686 during docs closeout.

Completed technical `main`-baseline promotion record:

1. `2026-08-22-safe-staging-main-foundation-promotion.md` — records the
   database-first PR `#227` and runtime-second PR `#228` reconciliation of the
   accepted `staging` foundation into `main` on 2026-08-23. The technical
   baseline is verified; it did not authorize public launch, Chrome Web Store
   publication, new product work, or changes to deferred Private Blob/TURN
   surfaces. Its final docs-only closeout continues through the normal
   `feature -> staging -> main` workflow with fresh approval before each merge.

Core-foundation closeout record:

1. `2026-08-21-core-foundation-ui-handoff-plan.md` — its Watch History,
   canonical/durable room-source, and room-lifecycle-invite blocks are accepted
   and fully closed on `staging` through
   `3a442b7f76992a5e48b387740bf9cc31a565235e`. It hands off to normal UI/UX
   work. The later 2026-08-22 plan promoted that exact technical foundation to
   `main`, without establishing authenticated production, release, store,
   Bloü/OpenClaw, legal, billing, public-form, or new-provider readiness.

Single-active-room follow-up closeout record:

1. `2026-08-23-single-active-room-session-implementation-plan.md` — records the
   server-enforced one-active-room invariant, exact host/guest tab-close
   behavior, reconnect grace, staging acceptance, and the later database-first
   production promotion through migration PR `#234` and runtime PR `#236`.
   The technical `main` baseline is deployed; Chrome Web Store publication,
   authenticated production extension acceptance, two-network/TURN proof, and
   UI/UX polish remain explicitly outside that claim.

Parallel long-running room/P2P and product execution plans:

1. `2026-06-07-production-room-p2p-hardening-roadmap.md`
2. `2026-06-12-room-flow-p2p-flawless-execution-plan.md`
3. `2026-06-20-social-rooms-subscriptions-execution-plan.md`
4. `2026-07-22-source-adapters-architecture.md`
5. `2026-07-22-provider-player-overlay-geometry.md`

Recently closed/superseded execution programs:

1. `2026-08-18-pre-release-security-reliability-readiness-plan.md` — closed by
   explicit scope disposition on 2026-08-21. Waves 1-3 retain their staging
   evidence; remaining items were transferred or visibly deferred, not treated
   as implemented.
2. `2026-08-14-watch-history-v2-clean-mvp-implementation.md` — historical v2
   foundation/cutover plan. PRs #189 and #190 completed its ordered bounded-title
   prerequisite and consumer rollout; the per-title episode resource boundary
   moved to the active foundation plan.

For current development guidance, read:

1. `../../project-operating-manual.md`
2. `../../current-development-state.md`
3. `../../extension-release-channels.md`
4. `../../project-architecture-and-development.md`
