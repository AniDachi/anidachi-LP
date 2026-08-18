# Plans

Files in this folder are historical execution plans and work logs. They are kept
because they explain why certain migrations and architecture decisions happened.

Most older files here are not current onboarding documentation. They may contain old local
paths, old repository names, old endpoints, and decisions that were correct at
the time but are no longer current.

Current active execution plans:

1. `2026-08-18-pre-release-security-reliability-readiness-plan.md` — closes the
   validated pre-release security and resource-boundary gaps on staging without
   including production release, `main` promotion, or the remaining UI/UX work.
2. `2026-08-14-watch-history-v2-clean-mvp-implementation.md` — staging runtime
   cut over; Task 10 release closeout remains active pending the bounded-read
   prerequisite rollout, an explicit bound for visible-title episode payloads,
   and the unverified manual acceptance rows.
3. `2026-06-07-production-room-p2p-hardening-roadmap.md`
4. `2026-06-12-room-flow-p2p-flawless-execution-plan.md`
5. `2026-06-20-social-rooms-subscriptions-execution-plan.md`
6. `2026-07-22-source-adapters-architecture.md`
7. `2026-07-22-provider-player-overlay-geometry.md`

For current development guidance, read:

1. `../../project-operating-manual.md`
2. `../../current-development-state.md`
3. `../../extension-release-channels.md`
4. `../../project-architecture-and-development.md`
