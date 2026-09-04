# Invitation Delivery Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver existing friend/group room invitations promptly without losing background work, duplicating notifications, or changing room admission/media behavior.

**Architecture:** Keep the authenticated, account-owned inbox authoritative and Web Push as a minimal `inbox_changed` signal. Remove redundant identity round trips from reconciliation, persist bounded client recovery, and add a transactional server delivery outbox with immediate processing and an independent recovery drain. Existing Cloudflare scheduling may invoke the authenticated web drain; Durable Objects and room events are not involved.

**Tech Stack:** Existing TypeScript/WXT/Chrome MV3, Next.js, Supabase Postgres, web-push, Cloudflare Workers, Vitest and pgTAP. No dependency upgrades or new providers.

**Spec:** `docs/superpowers/specs/2026-08-06-account-data-history-social-inbox-design.md`, Notification Delivery and Room Invites; approved 2026-09-04 conversation amendment: saved delivery tasks and bounded retries, unchanged user-facing invitation semantics.

## Global Constraints

- Durable account/invite truth stays in web/Supabase; the extension owns only account-scoped cache, display dedupe, and retry intent.
- Node `22.23.1`, pnpm `11.2.2`; keep lockfile unchanged.
- Payload remains `{ "type": "inbox_changed" }`, with no private invitation data or tokens.
- Keep room lifecycle actionability and 24-hour `Missed` presentation; do not reinstate the legacy 12-hour invite deadline.
- Preserve direct/group recipient dedupe, stable action IDs, explicit notification preference, profile/account isolation, and popup-first notification clicks without auto-join.
- No permanent socket, frequent client inbox polling, extra setting, or delivery/read receipt UI.
- Previous main-pill and Graphify WIP is not part of this fix and must not be staged with it.
- Feature -> PR -> staging only. Main promotion requires the user's later acceptance.

### Task 1: Reconciliation fast path and account races

**Files:** `apps/extension/src/room-invite-notifications.ts`, `apps/extension/src/account-inbox-client.ts`, new `apps/extension/test/room-invite-notification-runtime.test.ts`.

**Interfaces:** Preserve `reconcileRoomInviteNotifications({ notify })` and `handleAuthSessionChanged(previous, current)`. Read local identity for ownership guards; authenticate data through the existing inbox HTTP endpoint. Refresh an expired token once through existing background auth, never by interpreting a transport failure as logout.

- [x] Add integration tests against the real notification module, with browser storage and HTTP boundaries controlled. Assert that same-account token rotation during inbox fetch still creates one notification; a different-account switch creates none for the old account; registration failure cannot prevent inbox/cache/badge processing.
- [x] Run `pnpm --filter @anidachi/extension exec vitest run test/room-invite-notification-runtime.test.ts` and record the expected red results.
- [x] Coalesce concurrent requests into an active pass plus a trailing pass; preserve `notify: true` when combined with a silent refresh. Bound each HTTP fetch plus body read to 10 seconds. Do not place subscription registration ahead of inbox delivery; give it a separate account-fenced serialized lane.
- [x] Run the focused tests and existing inbox/auth tests. Confirm the normal path no longer performs repeated `/api/me` calls.

```ts
await Promise.all([reconcileRoomInviteNotifications({ notify: true }),
  reconcileRoomInviteNotifications({ notify: false })]);
// The real Chrome-notification boundary sees one notification for one unseen item.
// Token changes for this account do not invalidate the pass.
```

### Task 2: Durable client recovery and subscription repair

**Files:** notification runtime above, `apps/extension/entrypoints/background.ts`, runtime tests.

**Interfaces:** Add an account-scoped persisted retry record, a one-shot retry alarm handler, and startup/online restoration. Preference disablement prevents OS notification but does not erase durable inbox content. Subscription registration has a verified-at timestamp and bounded periodic repair.

**Bounds:** First recovery after 30 seconds, capped exponential backoff up to 1 hour, at most 8 attempts and 24 hours per intent. New external work may create a new intent; silent registration recovery must not upgrade it into an OS alert. Inbox and registration completion are independent: success in one lane cannot erase pending work in the other. Re-verify a matching subscription after 24 hours; migrate old registrations without a verified timestamp by re-registering.

- [x] Test network failure followed by success after a fresh module instance; retry must survive loss of globals. Test attempt/age bounds, account switch, permission disablement, and duplicate pushes.
- [x] Run red tests before implementing storage/alarm recovery.
- [x] Persist retry ownership and arm its alarm before network work. Use bounded backoff; clear only the matching completed intent. Keep the daily maintenance alarm as a separate safety net.
- [x] Run the notification and background wiring tests; verify no repeated notification for the same item.

### Task 3: Open-popup inbox convergence

**Files:** `apps/extension/src/account-inbox-cache.ts`, `apps/extension/src/popup-app.tsx`, popup and cache tests.

**Interfaces:** Add a validated account-cache subscription. Background writes update an already open popup; account-generation guards reject old-account work. Cache publication returns the canonical snapshot under a short per-account Web Lock; HTTP stays outside it. `serverTime` is request-start metadata, not a database revision: select the newer structural response while merging confirmed seen state by item incarnation. Resolve detected equal-time or seen-page ambiguity with at most one causal reread fenced against intervening publications, never a subscription-driven polling loop.

- [x] Add a component regression for a background inbox cache update arriving while Popup is already open, plus an account-switch rejection case.
- [x] Verify red, subscribe to account-owned cache changes, then verify green.
- [x] Check that marking visible items seen does not cause a refresh/write loop or resurrect older unread state.

### Task 4: Transactional delivery outbox

**Files:** new migration under `apps/web/supabase/migrations/`, new pgTAP test, new `apps/web/lib/anidachi-auth/inbox-push-outbox.ts` and test; `device-push.ts`; invite and friend-request dispatch routes.

**Interfaces:** Enqueue a coalesced account invalidation in the same transaction as a newly created recipient row. Claim bounded due jobs with a lease and revision; acknowledge only the claimed revision. Retry transient failure with capped attempts/age and provider Retry-After; prune permanent endpoints. Failed/missing VAPID configuration must not silently acknowledge pending jobs.

**Storage design:** One `account_inbox_push_outbox` row per recipient account, queued by an INSERT trigger on pending room-invite recipients and an INSERT/UPDATE trigger for genuinely new pending friend requests. A new event increments the revision and resets its retry budget, but does not steal an active lease. Claim at most 8 accounts per batch with a 90-second lease and an opaque lease token. Completion matches both token and revision; if newer work exists, release the old lease without deleting the newer revision. Cap retries at 8 attempts / 24 hours, retaining terminal failure metadata until a new event replaces it. RLS and explicit privileges restrict the table and all RPCs to the service role. No changes to room creation/admission RPCs.

**Dispatch bounds:** Send the existing minimal signal immediately after commit. Immediate drains target the just-committed recipients; the independent scheduler handles globally due work. Neither path bypasses cooldown or enqueues twice. Each provider request keeps the existing 10-second timeout; process at most 8 accounts (5 existing device slots each) concurrently. A drain may process consecutive small batches up to 100 accounts within a 35-second work budget, reserving 18 seconds before a new batch; database operations are bounded to 2 seconds each. Next routes allow 60 seconds total and the Worker callback bounds fetch plus body to 40 seconds. Normal group fan-out must not defer recipient nine onward to the minute-based recovery scheduler merely because of the concurrency cap; test the full 100-recipient fast path with nonzero database latency. Retry network/429/5xx failures with capped Retry-After; 404/410 remove dead endpoints. Other permanent provider/configuration errors must be observable, never counted as recipient delivery. No-device accounts are complete (their inbox remains durable). Existing raw push-summary names may remain for compatibility, but new logs use provider-accepted, not delivered/read.

- [x] Add database regressions: transaction rollback leaves no job; duplicate invite creates no extra revision; concurrent claim cannot own the same revision; a newer invalidation survives acknowledgement of an older claim; anonymous/authenticated clients cannot claim jobs.
- [x] Add real dispatcher behavior tests with fake external delivery: successful jobs retire, temporary failures reschedule, one failed recipient does not starve successful recipients, provider acceptance is not reported as user receipt.
- [x] Implement the smallest service-role-only outbox and bounded drain. Keep old rows/contracts readable; no destructive migration and no room RPC rewrite.
- [x] Run pgTAP and web checks/tests before changing deployment state.

```ts
// Contract: an old completion never deletes newer work.
const claimed = await repository.claimDue();
await repository.enqueueForUser(claimed[0].userId);
await repository.complete(claimed[0]);
// A subsequent claim still returns the newer revision.
```

### Task 5: Independent recovery and observability

**Files:** new authenticated `/api/internal/notifications/drain` route and route test, isolated Worker scheduler module/test, `apps/api/src/index.ts`, `apps/api/wrangler.toml`.

**Interfaces:** Reuse existing `ANIDACHI_WEB_INTERNAL_BASE_URL` and server-only `ANIDACHI_INTERNAL_API_SECRET`. A once-per-minute scheduled callback invokes only the bounded outbox drain. Immediate delivery remains post-commit; cron is recovery only. Request failures never touch room state.

**Runtime constraint:** The installed Worker runtime does not implement Fetch
`redirect: "error"`. Its scheduler uses `redirect: "manual"` and explicitly
rejects all non-2xx responses, including redirects, without following their
Location. The Node/web sender keeps `redirect: "error"`. Validate this boundary
in the real Workers runtime, not only Node mocks.

- [x] Check current Cloudflare scheduler docs and existing internal-service authentication before implementation.
- [x] Test missing/wrong internal authorization, exact allowlisted environment URL, bounded network failure, and independent scheduled invocation.
- [x] Wire the scheduled handler without changing `app.fetch` or Durable Objects. Add privacy-safe aggregate timing/result events for send, reconcile, and notification creation.
- [x] Run API check/unit/runtime tests and room harness as regression protection.

### Task 6: Integration, documentation, and acceptance

- [x] Run extension/web/API checks and tests, `pnpm dev:check`, whitespace checks, and the staging extension build/validation.
- [ ] Update the canonical invitation-delivery documentation with implemented behavior and remaining acceptance. Refresh Graphify once at this meaningful checkpoint, preserving prior WIP ownership.
- [ ] Review only this task's diff. Deploy additive migration before web consumer, then scheduler, through the staging workflow.
- [ ] Synchronize the validated artifact to the user's two verified test folders without renaming/removing those folders; verify file hashes.
- [ ] Record two-account acceptance for direct/group invites, suspended worker, token refresh, offline retry, account switch, closed room, disabled notifications, and repeated send. Do not claim manual acceptance from unit tests.

## Progress / evidence

### Approved recovery-scheduler amendment (2026-09-04)

The user approved replacing the unverified Cloudflare timer with one Supabase
Cron + pg_net trigger after reviewing current documentation and implementation
examples. Immediate sending, the existing transactional outbox, all retry bounds,
and client behavior stay unchanged. This is staging-only; main is not authorized.

### Task 7: Narrow drain authority and private database scheduler

**Files:** existing notification drain route and test; one CLI-created additive
migration and `apps/web/supabase/tests/inbox_push_scheduler.test.sql`.

- [ ] Add a dedicated `ANIDACHI_NOTIFICATION_DRAIN_SECRET` accepted only by the
  notification drain. Keep the existing internal bearer accepted temporarily for
  ordered cutover/rollback; never accept the new bearer at room callbacks.
- [ ] Create an operator-only private scheduler function, using SECURITY INVOKER,
  an empty search_path, and a short SQL timeout. Enable pg_net if absent without
  pinning an extension version. Deny clients access to our private scheduler and
  Vault. Preserve platform-owned pg_net permissions; verify that net, Vault and
  the private scheduler schema are not exposed through the Data API, client
  roles remain NOLOGIN, and no client-callable public function bridges to them.
- [ ] Use one private singleton config/status row, initially disabled, with
  explicit staging/production environment. Derive the exact canonical drain URL
  from that environment (no caller-provided URL). Read only a dedicated drain
  secret from Vault. No secret values in migrations, status, logs, or cron text.
- [ ] Schedule one named once-minute job. Disabled or no due outbox work performs
  no HTTP request. Respect cooldown and active leases; include expired/exhausted
  rows for existing bounded outbox maintenance. HTTP timeout is 40 seconds. Set
  the short SQL statement timeout before the private call in the cron command;
  a function-level SET alone does not bound an already started outer statement.
- [ ] Prevent repeated ticks from accumulating HTTP requests while pg_net is
  stalled: retain the last request ID, skip while it is queued, and allow at least
  90 seconds for an in-flight request before retry. Serialize scheduler calls via
  the singleton row. The singleton is operational metadata, not a delivery queue.
- [ ] Retain only safe last-attempt/result metadata; accept only status 200 and
  the exact small `{ "ok": true }` acknowledgement as a successful HTTP drain.
  pg_net transport can follow redirects and buffers response bodies; unlike the
  previous Worker caller it cannot enforce redirect rejection or a streaming
  response-size cap. The mitigation is a fixed owned endpoint, a drain-only
  credential, bounded timeout, and rejection of invalid acknowledgements. Do not
  claim transport equivalence. The outbox remains durable if HTTP work is lost.
- [ ] TDD: observe failures before implementation. Test route authorization and
  room-secret isolation, disabled/no-work no-op, due work, cooldown/lease guards,
  missing secret, pending-request suppression, exact request shape, invalid/safe
  response metadata, rollback, and low-privilege denial. Run real local pgTAP and
  full web check/tests. Do not reset an existing database or touch user data.

### Task 8: Ordered staging cutover and acceptance

- [ ] Review Task 7 and merge its PR into staging after gates. The migration is
  dormant by default, so the existing runtime remains compatible during deploy.
- [ ] Provision one new random drain-only secret in Vercel Preview `staging`
  and staging Vault without printing/persisting it locally. Enable the private
  scheduler only after the matching web deployment is READY and ACLs are checked.
- [ ] Observe a real automatic cron tick and HTTP acknowledgement, then recovery
  of an isolated no-device technical outbox fixture without invoking the drain
  manually. Never send fake invitations to real users. Remove only that fixture.
- [ ] Disable the old staging Cloudflare schedule only after successful recovery;
  reflect the disabled staging cron in source via a reviewed follow-up PR. Keep
  production config unchanged. Preserve all room bindings and alarms.
- [ ] Update canonical docs, env matrix, execution evidence, and Graphify, keeping
  earlier unrelated WIP out of commits. Real two-account OS notification timing
  and manual acceptance remain separate and require the user's test accounts.

Rollback: disable only the new named cron/config, retain outbox data, and restore
the preceding web deployment if needed. Retained Cloudflare caller and legacy
internal bearer allow an explicit rollback, but its automatic timing remains
unproven and must not be presented as a validated recovery mechanism.

Permission amendment: local pg_net 0.20.0 objects are owned by supabase_admin;
postgres cannot revoke their PUBLIC grants (REVOKE only warns). The supported
[Supabase permission boundary](https://supabase.com/docs/guides/database/extensions/pg_net#permissions)
is the non-exposed net schema and NOLOGIN client roles, not an unsupported owner
escalation. Preserve those platform ACLs. Before activation, verify Data API
schema rejection, private/Vault ACLs, and absence of public callable bridges.
On staging, publishable-key requests for net, vault and anidachi_private each
returned 406/PGRST106; anon/authenticated are NOLOGIN and the public/graphql_public
function audit found no net/Vault/dynamic-SQL bridge. Repeat after deployment.

- 2026-09-04: Started from current `origin/staging` `396bb41` on `codex/invite-notification-delivery`; previous unrelated WIP remains unstaged. Frozen install did not change dependencies. Baseline notification/inbox suites: 3 files, 22 tests passed.
- Task 1 (`e0f4d9b`): independent review approved; 83 focused and 1531 full extension tests passed, typecheck passed. Normal inbox reconciliation makes zero `/api/me` round trips.
- Task 2 (`d20b58d`): independent review approved; 109 focused and 1557 full extension tests passed, typecheck passed. Recovery survives fresh module instances with independent account-owned inbox/subscription intents. Browser wakeup/OS delivery acceptance is not inferred from these tests.
- Task 3 (`04c1cbd`, `415c76c`): production Popup/cache integration and canonical notification publication; 1575 full extension tests/check passed before the final scoped fix, then 86 focused tests passed for inverse seen-page overlap. Independent review and fix re-review approved. Real Chrome cross-context acceptance remains pending.
- Task 4 (`11f4318`): local web gate passed (404 tests passed, 3 existing skips), typecheck passed, 97 pgTAP assertions passed, security advisors clean. The real dispatcher handled 100 fake recipients with 200ms database-stage delays in approximately 10.5 seconds, in 13 batches with at most eight active accounts. Native transport cancellation was tested separately. Independent review approved; no provider or remote acceptance is inferred. The `pruned` diagnostic counts successful fenced prune operations, which can affect zero rows after endpoint rotation, rather than an exact removed-device count.
- Remaining deployment risk: staged schema, web and scheduled consumer must be verified together before tester readiness; no production promotion is authorized.
- Task 5 (`0c8e5b6`, `a47768a`, `7078508`): internal route and scheduler implemented, with 35 scheduler unit tests, 41 Workers runtime tests and 39 room-harness scenarios passing; staging and production bundle dry-runs passed without deployment. Real workerd confirmed one initial and zero redirected requests. The integrated check found test-context typing added after an earlier check; the separate test-only correction passed fresh web check and 5 route tests. Independent review approved without findings.
- Final combined `pnpm check` and `pnpm test` at `7078508` passed. Fresh suites: extension 1578, API 201, web 409 passed with 3 existing skips; protocol 141 passed separately and was cache-reused in the combined command. Demo has no tests. Web lint exits zero with existing unrelated warnings; changed invitation runtime files have no ESLint warnings/errors. No dependency upgrade or unrelated lint cleanup was included.
- Staging extension `7078508-staging-20260904193636` built and passed artifact validation with unchanged narrow host permissions. The local candidate also retains the previous main-pill work; those separate changes are deliberately excluded from invitation commits. The build reports existing ineffective dynamic-import warnings, not build errors. Real loaded-artifact acceptance remains separate.

## Staging acceptance checklist

Local tests establish retry, ownership and concurrency behavior. The following
remain explicit acceptance checks against the deployed web/Worker and the exact
loaded extension build:

- [ ] The additive migration is listed in staging history; web is READY before the Worker cron is deployed.
- [ ] Unauthorized drain requests fail; an actual scheduled invocation receives the small successful acknowledgement without touching room state.
- [ ] Two signed-in test accounts receive direct and group invitations; an already open Popup updates without reopening it. Record send-to-appearance time, not only provider acceptance.
- [ ] Repeated send and overlapping catch-up create no duplicate OS alerts; disabled notifications leave the inbox available without an OS alert.
- [ ] Worker suspension, temporary offline operation and same-account token refresh recover; switching accounts cannot publish the previous account's data or notification.
- [ ] A room closed before an invitation is opened is not joinable; the existing Missed lifecycle remains unchanged.
- [ ] Both tester folders match the validated artifact by relative file names and SHA-256 hashes. Record remaining manual checks instead of labeling the entire release accepted.

## Rollback

Keep additive outbox data and functions. Disable the scheduled trigger and restore the preceding web/extension artifacts if acceptance fails; do not delete invitations, inbox records, or account/device state. Old web versions can still send the compatible minimal invalidation, so extension display dedupe remains required during a mixed-version rollout.
