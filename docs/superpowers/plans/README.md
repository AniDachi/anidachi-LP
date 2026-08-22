# Plans

Files in this folder are historical execution plans and work logs. They are kept
because they explain why certain migrations and architecture decisions happened.

Most older files here are not current onboarding documentation. They may contain old local
paths, old repository names, old endpoints, and decisions that were correct at
the time but are no longer current.

Active `main`-baseline promotion plan:

1. `2026-08-22-safe-staging-main-foundation-promotion.md` — prepares a
   database-first, runtime-second reconciliation of the accepted `staging`
   foundation into `main`. It requires fresh user approval before every merge
   and does not authorize public launch, Chrome Web Store publication, new
   product work, or changes to deferred Private Blob/TURN surfaces.

Core-foundation closeout record:

1. `2026-08-21-core-foundation-ui-handoff-plan.md` — its Watch History,
   canonical/durable room-source, and room-lifecycle-invite blocks are accepted
   and fully closed on `staging` through
   `3a442b7f76992a5e48b387740bf9cc31a565235e`. It hands off to normal UI/UX
   work, without establishing production, `main`, release, store, Bloü/OpenClaw,
   legal, billing, public-form, or new-provider readiness.

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
