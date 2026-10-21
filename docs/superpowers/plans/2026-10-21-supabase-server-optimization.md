# Supabase Server Optimization Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement and verify these tasks in order.

**Goal:** Reduce unnecessary database work and response bytes without changing the published extension 0.1.4.

**Architecture:** Preserve the existing HTTP/RPC contracts and fresh server authorization. Optimize the access resolver in Postgres and narrow server-side identity reads. Reuse the existing conditional inbox recovery scheduler; keep production cutover separate.

**Tech Stack:** Next.js 15, TypeScript, Supabase Postgres, pgTAP, pg_cron, pg_net.

**Spec:** The owner's October 21 approval of the server-only optimization proposed after the Supabase usage audit. This document records that scope.

## Global Constraints

- No extension source, package, permissions, protocol or Store update.
- No changes to trial eligibility, abuse reservations, paid access, consent, history epochs, five-minute leases or before/after read fences.
- No persistent user/entitlement cache. A loaded identity can only be reused within its current request for the same owner.
- Keep users, watch history, receipts, subscriptions and abuse evidence. Only completed technical cron logs older than 14 days may be pruned.
- Feature branch -> reviewed PR -> staging. Production needs a separate promotion decision.

## Review Focus

1. Overlapping Pro and Plus grants have different expiry times: selected-plan expiry and overall history expiry must remain distinct.
2. An elapsed paid boundary followed by renewal must still advance the access epoch twice and reject stale writes.
3. Profile creation races and custom names/avatars must retain the existing repair behavior without returning OAuth identifiers.
4. Database errors or a missing owner must never become a successful cached identity or an implicit Free entitlement.
5. Notification recovery must remain automatic after interruption; an empty queue must not trigger HTTP. The old production timer stays until conditional recovery is proven and explicitly promoted.

## Task 1: Access resolver writes

Files: a new `apps/web/supabase/migrations/*_history_access_noop_optimization.sql`; `apps/web/supabase/tests/history_access_noop.test.sql`.

Interface: `resolve_watch_history_access_v1(uuid) -> jsonb` remains unchanged.

- [x] Add pgTAP coverage for stable Free/paid reads preserving row `ctid`, overlapping/infinite grants, expiry/renewal epoch transitions and service-only access.
- [x] Run against the previous resolver; only no-op assertions should fail.
- [x] Aggregate grants once and update the stored expiry only when distinct. Preserve locks, time bounds and every response field.
- [x] Run the new suite plus existing personal history, trial and cardless/abuse contracts on an isolated local database; expect zero failed assertions.
- [x] Commit resolver and tests.

## Task 2: Compact identity reads

Files: `apps/web/lib/anidachi-auth/{db,extension-session,social,account-identity}.ts` and identity cost tests.

Interfaces: a typed five-field identity read and four-field public profile read; existing public responses stay identical.

- [x] Make the HTTP fixture honor PostgREST projections; test the existing `/api/me` response, repairs, error propagation and same-owner request reuse.
- [x] Assert no OAuth IDs/timestamps are requested by identity/profile paths; observe failure before implementation.
- [x] Add the narrow typed reader, project social display reads, and pass the already loaded user to profile repair in the account render and invite preview.
- [x] Run web typecheck and full web tests; expect all pass.
- [x] Commit server reads and tests.

## Task 3: Bounded maintenance and delivery

Files: new cron retention migration and pgTAP suite; this delivery record.

Interface: a private operator-only cleanup function, max 5,000 completed rows per hourly invocation, 14-day retention. Existing inbox scheduler and external contracts remain unchanged.

- [x] Test old completed versus recent/unfinished cron rows and denied client execution.
- [x] Create bounded cleanup and a named hourly cron job; do not run cleanup during migration.
- [x] Verify migration replay and pgTAP locally.
- [ ] Run `pnpm dev:check`, checks, review and Graphify update; open a PR to staging.
- [ ] Verify staging migration/Web delivery, resolver no-op and profile/API compatibility. Prove existing conditional inbox recovery with an isolated staging fixture; remove only that fixture.
- [ ] Record exact release identities, tests, measured limits and rollback. Do not disable the production Worker timer or enable production scheduler here.

## Measurement and rollback

Audit: October 20 03:30 to October 21 03:30 UTC contained 53,006 PostgREST calls, including 19,672 access resolutions and 1,439 inbox claims (1,438 empty). Counts do not establish byte attribution. Historical monthly egress includes older extension versions; already consumed quota is not reset by this work.

Measure staging query projections, unchanged payloads, no-op tuple stability and recovery delivery. Compare production daily egress and request totals only after separately accepted promotion, at comparable activity levels. No promised percentage reduction.

Rollback: Web can return to the previous verified build; SQL can restore the preceding resolver definition without touching stored data. Unschedule only the new maintenance job to stop future pruning; deleted technical logs are not recoverable. Keep the old production inbox timer until the conditional replacement is proven, then switch in a separate ordered operation. Neither authority policy nor trial markers may be reset.


## Verification before staging

- Resolver regression: the previous definition failed only the three tuple-write assertions; the optimized definition passed all 24 assertions, including expiry/renewal and infinite overlapping grants.
- Identity regression: the prior readers failed projection and duplicate-read assertions. The final focused suite passes 14 tests with projection-aware PostgREST fixtures, missing users, creation/repair races, errors and custom social display data.
- All migrations replayed on a disposable, network-isolated Supabase Postgres 17 container. All 46 pgTAP suites pass, totaling 1,655 assertions.
- The cardless-trial integration contract passes: durable reservation/deletion recovery, renewal/cancellation races, room admission and concurrent same-browser/installation antiabuse claims retain one winner.
- Web typecheck and lint pass (existing unrelated lint warnings remain). The final full web suite passes 1,338 tests, with six existing skips and no failures.
- `pnpm dev:check` selects web and docs checks. Extension/API/protocol source and configuration remain unchanged.

Staging delivery and the isolated inbox recovery test are pending until the reviewed PR is merged. CI/deployment identities and that acceptance evidence belong in the PR delivery record. Production daily egress remains unmeasured for this patch until a separate promotion.
