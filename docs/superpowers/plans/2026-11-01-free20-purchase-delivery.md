# Free20 purchase delivery — block 4B

Status: default-off implementation candidate; exact verification and staging
delivery receipts are recorded in its PR. Enabled acceptance remains separate.

Spec: [daily Free20 design](../specs/2026-10-30-daily-free20-design.md).
Parent: [transition block 4](2026-10-30-daily-free20-transition.md).

## Global Constraints

- A delivery is a request to revalidate current account authority, never a paid grant.
- Preserve the room link, participants, generation and pinned seats/media limits.
- Preserve cumulative Free accounting, pending ACKs, UTC boundaries and existing
  fail-closed behavior. Payment never revives a terminal room or extends its quota deadline.
- Existing trial, manual, paid, renewal, Checkout idempotency and owner checks remain.
- Additive internal contracts only; existing Store/client payloads remain compatible.
- Deliver only to staging. Do not enable Free20, retire new trials, change prices,
  create live payments, promote main/production or release the Store extension.
- Do not change pre-existing `.serena/project.yml` edits or read secrets/private env files.

## Task 1: Authenticated Worker refresh command

Create an additive protocol contract `Free20RoomRefreshRequestSchema` and receipt.
Strict request: `refreshVersion: 1`, `ownerUserId` (existing UUID schema), `roomId`,
`roomGeneration`, `revision` (positive safe integer). Strict receipt: `request`
(the complete bound request) and `outcome: applied | terminal | stale`.
There is no entitlement, allowance or client timestamp in the command.

Add `POST /internal/rooms/:roomId/free20-refresh`, forwarded to DO
`/internal/free20-refresh`. Authenticate and validate at both boundaries, require
exact existing `ANIDACHI_FREE20_ACCOUNTING_ENABLED=true`, check URL/room binding.
Serialize in `runRoomEndExclusively`. Only an existing marked Free20 room can
refresh. Known owner/generation mismatch is stale; terminal/closing is terminal;
unknown/missing authority is retryable 503, not a successful receipt.

Force existing `serviceRoomPolicy` / `refreshFree20RoomPolicy` without rewriting
policy deadlines, duplicating accounting logic or weakening pre/post-I/O fences.
Reuse its snapshot and negotiated HOSTING_TIME broadcast. Existing authority
failure still fails closed with durable settlement.

Persist the last completed bound revision so retry of the same/older revision
does not perform another authority refresh. Persist only after successful service
and durable ACK/policy state. A crash between those commits can safely repeat the
existing idempotent cumulative settlement. Keep this receipt independent of quota.

TDD: strict schemas; auth/flag/path/owner/generation; immediate refresh before due;
duplicate/concurrent/lost-ACK recovery; pinned caps/participants; quota before/during
I/O, UTC, terminal no revival; unavailable authority. Use real workerd fixtures.
Run protocol/API checks and focused runtime tests, then API suite once.
Commit only Task 1 files; leave docs/graph to final integration.

## Task 2: Atomic SQL outbox and post-commit Web delivery

Add migration and real SQL tests. New outbox is keyed by owner/room/generation;
monotonic positive safe `revision`/`lease_revision`, lease token, lease expiry,
attempts, next-attempt and completed revision. Keep an active lease across a
coalescing enqueue. A stale ACK cannot consume a newer revision. Claims use
SKIP LOCKED and bounded limits; lease is 60s, retries have capped 60s backoff with
no attempt/age abandonment. Completed rows preserve the revision fence.

Add `commit_stripe_subscription_refresh_v4` with existing v3 signature. Delegate
the existing v3 (which delegates non-cardless to v2), then enqueue the exact active
host assignment joined to a non-ended `daily_free20` room in the SAME transaction.
Do not infer paid access from Stripe event type/status/plan: the Worker revalidates.
Use current authority generation, never a guessed new generation. No job for
unmarked, ended, guest-only or mismatched host assignments. Preserve old RPCs.

Web uses v4 only with exact existing server Free20 flag. With the flag off it
retains current v2/v3 dispatch, so asynchronous migration/Web delivery is safe.
No fallback from missing v4 after activation. RLS and service-only scoped RPCs;
no client enqueue API and no new secrets.

Add a bounded delivery module modeled on room-hosting-cutover: DB operations 2s,
Worker delivery <=28s, drain <=35s, <=4 parallel claims. Validate full receipt
binding before fenced finish. Timeout/HTTP/malformed/lost-ACK retains work.
Offer owner-scoped immediate drain after durable subscription sync commit through
existing deferred-work pattern. It is best effort only because SQL owns recovery;
it must not make successful payment sync fail when Worker transport is unavailable.
Dependency injection keeps tests free of real network. Existing expectedUserId,
fresh Stripe retrieve and subscription lease ordering remain.

Add `POST /api/internal/rooms/free20-refresh/drain` authenticated ONLY by existing
internal service authorization (never notification/cutover drain-only secret),
exact Free20 flag, bounded drain and minimal `{ok:true}` acknowledgement. Ignore
caller targeting; the scheduled route drains only committed SQL work.

TDD: SQL rollback/commit-before-drain, role denial, superseded ACK/expired lease,
duplicate and concurrent claims, real host/mode/generation selection, trial ledger
finalization; Web delivery receipts/timeouts and sync commit/owner/failure ordering.
Run relevant SQL, Web checks/tests and preserve existing billing regression suite.
Commit Task 2 files only; root will integrate scheduler/docs/graph.

## Task 3: Independent recovery scheduler

Add a separate bounded Worker recovery request to the new Web drain via the
existing internal secret and canonical environment origin. No secret migration.
Route a distinct `*/2 * * * *` cron to Free20 recovery only; retain the existing
`* * * * *` notification handler unchanged. Configure only the new expression in
staging, whose notification recovery is already owned by Supabase Cron. Production
configuration includes both expressions for a future separately accepted promotion.
The coarse two-minute recovery is a fallback to immediate owner-scoped delivery.
With Free20 off it makes no Free20 network requests.
Test maintenance, disabled flag, origins, auth header, timeout/redirect/body bounds
and non-duplication of staging notifications. Do not add room-tick polling.

## Task 4: Integration, delivery and evidence

Review task diffs and whole branch; run quality gates, room harness and applicable
runtime/SQL/billing tests. Update canonical status/contract/plan and Graphify via
safe adapter. PR must record migration-first activation dependency, deployment
evidence, current off flags and rollback. Deploy through PR -> staging only.
Real Sandbox checkout and enabled-room acceptance are separate evidence: report
any missing account/setup honestly; never label mock or default-off tests as those.

## Rollback

Keep additive SQL and durable queue/ACK data. Disable new admission/flags before
runtime rollback and retain a runtime that understands existing Free20 rooms.
No rollback of payments, trial records, accounting or terminal generations.
The new queue may remain pending while disabled; this cannot grant access.

## External evidence

[Stripe webhooks](https://docs.stripe.com/webhooks) documents duplicate/out-of-order
events and recommends asynchronous processing. Existing fresh authoritative
subscription sync remains; this block adds durable room revalidation after commit.
[Cloudflare scheduled handlers](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/)
expose the exact configured cron expression, used to keep recovery owners separate.
