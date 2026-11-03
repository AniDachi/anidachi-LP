# Free20 Abuse Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the accepted shared-browser/installation daily Free20 ceiling without resetting account usage or changing paid/guest behavior.

**Architecture:** Supabase binds server-verified markers to room generations and applies cumulative usage deltas to account and marker ledgers. Web validates a dedicated signed installation challenge and issues an account-bound context; the background supplies it for admission and display. The existing serialized DO computes live remaining time from the effective committed ceiling and its own pending interval.

**Tech Stack:** Existing Postgres RPCs/pgTAP, TypeScript/Zod, Next.js, WXT/MV3, WebCrypto P-256, Cloudflare Durable Objects. No new dependency or secret.

**Spec:** `docs/superpowers/specs/2026-11-03-free20-abuse-design.md`

## Global Constraints

- 1200 seconds per account/browser/installation per UTC day; effective remaining is the smallest of the three.
- Guest time is not consumed; paid/trial/manual precedence and frozen room capacities remain intact.
- No IP linking, fingerprinting, SMS, CAPTCHA, new provider, new permission or new secret.
- No marker/private key/context token in URLs, logs, analytics or public status/room payloads.
- Unknown proof/authority is retryable unavailable, never a fabricated free budget, zero or paid downgrade.
- Marker usage survives account/room deletion. Trial claims and existing usage are never reset.
- Preserve cumulative ACK/terminal/UTC/account identity fences and the pre-existing `.serena/project.yml` edit.
- Default-off additive enforcement. No main, production, Store or real account mutation.

## Review Focus

- Host switches accounts while the first room has uncommitted time: another budget must not be admitted.
- Host changes device or clears one marker: continuing the original room must not lose its original restrictions or charge duplicate history.
- Paid expiry occurs inside admission, or purchase occurs before final ACK: final authority and conserved usage must win over preflight.
- Browser refuses third-party cookies: enrollment must verify cookie round-trip and never issue fresh usable browser identity on every retry.
- Same-owner token refresh versus logout/login/account replacement: presentation survives the first and stale proof/results cannot cross the latter.

### Task 1: Durable scoped accounting and locked admission

**Files:** Create an additive `apps/web/supabase/migrations/20261103*_free20_abuse.sql`, `apps/web/supabase/tests/free20_abuse.test.sql`, `apps/web/supabase/contracts/free20_abuse_concurrency.mjs`.

**Interfaces:**
- Add `hosting_commercial_policy.free20_abuse_enabled boolean not null default false` and `rooms.free20_abuse_protected boolean not null default false`.
- Add service-only `create_room_with_active_session_v5` and `claim_active_room_session_v5`: same existing v4 arguments in order, followed by optional `p_free20_browser_hash text`, `p_free20_installation_hash text`.
- Add service-only `resolve_free20_context_access_v1(p_user_id uuid,p_browser_hash text default null,p_installation_hash text default null)` returning the current access shape, with effective `usedSeconds`/`remainingSeconds` and `abuseEnabled` boolean. Missing required context raises `FREE20_CONTEXT_REQUIRED`, held scopes raise `FREE20_CONTEXT_BUSY`.
- Add service-only `read_free20_context_status_v1(p_user_id uuid,p_browser_hash text default null,p_installation_hash text default null)` returning the existing account authority shape, with effective `committedSeconds`; no marker data in output. The SQL policy decides when context is required. Paid reads succeed without context.
- Add service-only `read_free20_room_usage_v1(p_room_id text,p_day date)` returning integer effective committed usage for the room's immutable/append-only bindings, including when new admission enforcement is later disabled.
- Add service-only `attach_free20_room_context_v1(p_user_id uuid,p_room_id text,p_browser_hash text,p_installation_hash text)` for the trusted serialized DO transfer after spending has stopped and cumulative usage is settled. Returns no private marker data. Ordinary create replay/host claim encountering additional markers must raise `FREE20_CONTEXT_ATTACH_REQUIRED` without changing room/bindings/session; existing subset context can resume. Guests and confirmed unlimited access retain their appropriate exemptions.
- Create private marker-day usage and room binding tables, with no public/service direct writes. Hashes are exactly 64 lowercase hex characters, kinds browser/installation. Room bindings are appended only by trusted admission/claim; never replaced by replay. Aggregate usage has no cascading account/room FK.
- Existing public v1-v4 admission paths must delegate through the new fence or be equivalently guarded. Direct unprotected Free20 room insertion must fail when enabled. No silent bypass via old core, paid preflight, replay or guest-role spoofing.

- [x] Write pgTAP cases: A consumes 720, fresh B sees 480; same account on fresh markers still sees 480; forged/missing hashes reject; one marker retained preserves 480; old used-trial marker does not deny Free20; missing proof paid/guest paths retain behavior.
- [x] Run on a disposable local fixture before migration; verify intended missing-feature failures.
- [x] Implement marker bindings, atomic delta accounting and admission/claim RPCs. Preserve locked canonical authority and legacy behavior while disabled. Existing active unprotected Free20 rooms prevent activation; do not rewrite their budgets. Keep bound scope reservations through terminal settlement (including paid-upgraded marked rooms), because early release could conflict on later expiry. Newly admitted ordinary paid rooms do not reserve scopes.
- [x] The dedicated trusted attach RPC appends verified context under the original owner/room, retaining originals. Initialize newly paired markers to the maximum current-day consumption of account and all supplied/original bound markers, then charge subsequent accepted deltas once. Test alternating one-marker replacements: browser720 + fresh install/account -> install floor720; fresh browser on that install still has480. Do not re-add an entire room's past usage on refresh. Lock room before sorted markers; conflicting scope lookup must not acquire the other room/account lock. Preserve existing lock prefixes, and document any necessary full-entrypoint lock-order correction.
- [x] Add actual two-connection races: competing accounts sharing marker; create versus final settlement; reconnect attachment versus ACK; duplicate ACK; crossed marker order. Assert one reservation, no duplicate spending and no deadlock. Include UTC late ACK, deletion survival, paid upgrade/expiry, disable-after-bind and exact/older ended-room replay.
- [x] Add bounded cleanup for completed marker history older than 7 UTC days, retaining markers with an unsettled active room. Use one shared daily cleanup, not per-account jobs.
- [x] Run new SQL cases/concurrency and existing Free20, trial and admission suites. Record exact results; commit only task files.

### Task 2: Proof contract, Web authority and budget integration

**Files:** New shared `packages/protocol/src/free20-abuse.ts` and tests/export; Web `lib/anidachi-auth/free20-abuse*.ts` and tests; new `app/api/me/free20-context/route.ts`; existing `db.ts`, `free20-admission.ts`, `free20-room-budget.ts`, `account-hosting-status.ts`, create/connect routes, staging gate and relevant tests.

**Interfaces:**
- `FREE20_CONTEXT_HEADER = "x-anidachi-free20-context"`; distinct `FREE20_INSTALLATION_SIGNING_PREFIX = "anidachi-free20-installation-v1\n"`.
- Strict challenge/proof/enrollment response schemas. Challenge TTL 300 seconds; context TTL 1800 seconds; bounded request/proof sizes. Signature binds authenticated owner, signed browser digest, exact site origin, request UUID and nonce; context additionally carries verified installation digest and explicit Free20 purpose/version.
- `POST /api/me/free20-context` uses discriminated `action:"challenge"|"complete"`. Authenticated Bearer or website session, expected-owner header, configured site/extension origin allowlist, no-store, bounded rate limiter. `complete` requires the same valid HttpOnly cookie received on request and a valid P-256 proof. Never accept supplied marker hashes or a missing cookie/proof.
- Reuse the existing trial browser cookie and key semantics, but not trial eligibility or signing purpose. Return only challenge or opaque signed context with expiry; set a same-purpose HttpOnly context cookie on completed enrollment for first-party status reads. Neither token grants identity/hosting authority by itself.
- Gate new endpoint and v5 callers with exact `ANIDACHI_FREE20_ABUSE_ENABLED=true`; SQL fence independently denies old unguarded free admission. No enabled env edits in this task.
- `FREE20_CONTEXT_REQUIRED` maps to HTTP 428; `FREE20_CONTEXT_BUSY` maps to neutral HTTP 409 without another account's room data; invalid/expired context maps to 428 for one bounded client retry; infrastructure errors stay 503. Paid and guest calls bypass context requirements based on canonical server authority.
- HTTP header context must match the authenticated owner and origin; SSR can use a verified owner-matching HttpOnly context cookie. Without complete context, finite free display is unavailable rather than account-only fallback. Active-room display uses existing bound room authority.
- Keep `readFree20StatusAuthority(owner)` as the existing internal identity/grant/assignment read for warning and paid provenance. Public status selects a separate contextual authority read; do not break internal warning/display callers by globally requiring browser proof. SSR welcome catches unavailable status honestly as today.
- In the contextual status SQL reader, an owned active protected host uses only already-bound scope usage without requiring/applying proposed markers. Keep one coherent canonical snapshot and bounded expiry/UTC retry; avoid an extra Web identity read on every idle request. Idle/member display still requires context when enabled, and actual admission remains strict. Task 2 may amend this status function and its focused SQL regressions only.
- Guest connect reads the hosted room's bound effective usage, never the guest's markers or a context token for the host. Add a dedicated bound-room admission read rather than routing guest quota reads through an owner-context enrollment check.
- Internal room budget uses `read_free20_room_usage_v1` for protected rooms. The existing checkpoint `committedSeconds` now means effective scope total (>= this room's ACK); update comments/contracts and test current Worker computation with 720 prior marker seconds + 480 in-room seconds. No client-selected scope enters the DO.
- For `FREE20_CONTEXT_ATTACH_REQUIRED`, derive the original owned room from the authenticated request/replay lookup, perform Task 3's server-to-server transfer, and retry admission exactly once. Never attach directly in HTTP claim or silently continue on failed transfer.
- Task 2 defines the shared internal transfer request/receipt schema and real bounded Web HTTP client; Task 3 implements its receiving Worker/Web handlers. The client fails closed until compatible handlers exist. Request identity is stable for the exact owner/room/generation/marker payload; completed receipt replay cannot detach a newly connected host.

- [x] Add RED tests for genuine crypto proof, forged challenge/cookie/public key, wrong owner/origin/request, expiry, omission, cookie round-trip and unavailable context.
- [x] Implement the shared schemas and pure crypto helpers, endpoint and context resolver with bounded execution/rate limiting; verify GREEN.
- [x] Add RED Web cases for scoped create/claim, old caller fence, paid expiry after preflight, neutral busy error, guest exemption, SSR unknown, public payload privacy and protected room effective accounting.
- [x] Integrate wrappers/context with existing access/status/settlement functions without broad refactors or unsafe fallback. Update affected schemas/consumers together.
- [x] Run protocol/Web checks and full tests; API tests/runtime/room harness for the budget semantic regression. Commit scoped files.

### Task 3: Serialized live-room scope transfer

**Files:** Protocol scope-transfer request/receipt schemas and tests; Web internal attach route/client helper; API dedicated `free20-scope-transfer.ts`, `index.ts` integration and workerd tests.

**Interfaces:**
- Authenticated internal `POST /internal/rooms/:roomId/free20-context` accepts a strict versioned owner/room/generation/request-ID plus two server-verified marker digests. No public caller or client-selected room identity may invoke it.
- Web internal `POST /api/internal/rooms/:roomId/free20-context` uses existing internal authorization, calls only Task 1's attach RPC for the bound owner/room, and returns a bounded idempotent receipt.
- The DO serializes transfer with admission, alarms, purchase refresh and terminal settlement. Save a durable transfer intent before external I/O; detach any old host socket using existing presence semantics, materialize/settle its cumulative metering, call Web attach, force fresh effective budget, persist it and retire the intent before admitting a host. Replay after a lost ACK resumes the same work; no terminal resurrection.
- Same-context reconnect bypasses transfer. During pending transfer no host admission/spending can use the old checkpoint. On restart pending intent must be recovered or fail closed through existing terminal/recovery semantics; unknown results cannot release scopes.
- Use a transfer-aware wrapper around `beginParticipantDisconnect`, not `handleParticipantDetach` (host forbidden) or host `handleParticipantDeparture` (terminal). Persist intent + materialized frozen meter atomically; load the fence before restoring host socket attachments. Retain the original 60-second host-disconnect deadline for bounded recovery; retries do not extend it. Use direct `settleRoomUsage` with existing `settleOnly` semantics and direct forced budget refresh within the current serialized queue (no recursive self-fetch/queue).
- Persist a completed exact-payload transfer receipt. Replaying an applied transfer must not detach the replacement host. Any changed payload with reused request ID is rejected.
- Recover a genuinely empty DO for a SQL-created room before its first JOIN through existing authenticated admission and signed policy renewal. Derive owner/frozen media lease from verified server authority, ignore legacy quota in that renewal, then enter the same fenced transfer and forced effective-budget sequence. A concurrent first admission must be preserved, never overwritten. Unknown partial persisted state fails closed; do not reset meter/history to manufacture an empty room.

- [x] Add RED runtime tests for host present and spending, additional marker with only 60 seconds remaining, aborted HTTP claimant, lost SQL ACK, duplicate after replacement host joins, changed payload replay, restart before/after detach/SQL attach/checkpoint/receipt, grace deadline without extension and UTC rollover.
- [x] Cover SQL-created-before-first-JOIN recovery, first admission racing bootstrap, and denied/wrong-owner bootstrap authority without invented capabilities or stale budget.
- [x] Implement the dedicated serialized operation and internal handlers. Preserve current guest presence, room link, caps, paid-refresh ordering and terminal rules.
- [x] Assert no stale original allowance can continue after attachment; final receipt means the effective checkpoint is durably installed. Test failures produce no free allowance or premature reservation release.
- [x] Run protocol/API/Web focused tests, API runtime, room harness and checks; commit scoped files.

### Task 4: Background enrollment and extension lifecycle

**Files:** New `apps/extension/src/free20-abuse-client.ts` and tests; reuse/extract `trial-installation.ts` signer; update `account-hosting-status-client.ts`, `room-client.ts`, background wiring, existing privacy sanitizer and their tests. A focused Web-side integration contract test is allowed for the real endpoint/client chain.

**Interfaces:**
- Background-only account/session-bound context cache and single-flight enrollment, using the existing persistent installation key with the new signing prefix. The signer must not rotate/delete that key on signout.
- Context lookup returns a header only for the current authenticated owner/session. On HTTP 428, enroll once and retry exactly once with the context. Cached context can be sent on first request. A 409 busy or 503 never triggers a fresh marker/key or account-only fallback.
- Send the existing expected-owner header alongside context on create/connect/status. Let the browser set Origin. An absent Origin is supported only with the owner-bound context/expected-owner pair; enrollment without Origin additionally requires a verified extension Bearer session, never cookie-auth fallback.
- Enrollment fetches use credentials include and exact configured website URL; completion proves the returned cookie survived. Cookie-blocked failure is explicit and retryable, never new allowance. Check whether existing noninteractive auth flow can supply an equivalent first-party enrollment fallback without tokens/markers in URLs; if not, record the exact limitation and preserve fail-closed behavior.
- Create/connect calls and hosting-status requests share this path. Guest/paid calls do not enroll unnecessarily; the server's 428 initiates enrollment. Keep account/lifecycle revision checks across every await.

- [x] Add RED tests for same marker across A/B switch, context cache ownership, refresh continuity, clear-cookie/reinstall survivor, stale delayed A result after B login, abort/deadline, single-flight and bounded retry.
- [x] Implement context handling and request integration in background. Keep raw keys out of content scripts/messages; no new Chrome permissions. Preserve current stable Free/paid/guest UI transitions.
- [x] Cover the new context header, enrollment response `context` and marker field names in diagnostic redaction; never add raw context/proof/marker logging. Preserve useful unrelated diagnostic context.
- [x] Test actual server response -> background -> status/room consumer using synthetic authenticated/crypto fixtures. Rerun paid layout, token-refresh, quota, end-room, UTC and guest-entry regressions.
- [x] Run extension full check/test, build narrow staging artifact and validate it. Record exact build ID and paths; do not overwrite the user's working folder with a candidate requiring missing server endpoints.
- [x] Commit scoped files.

### Task 5: Review, documentation, graph and delivery readiness

**Files:** Current-state/Free20/P2P plan notes, architecture and environment documentation, factual daily-quota disclosure in `apps/web/app/privacy/page.tsx`, this plan/spec, Graphify team artifacts, execution evidence under ignored `artifacts/free20-abuse-20261103/`.

- [x] Run `pnpm dev:check` and required affected-plane checks; rerun only changed/failing areas after fixes. Record gaps separately from passes.
- [x] Independent whole-branch review of auth, accounting, concurrency, paid/guest compatibility and UI continuity. Fix material findings with targeted regression tests.
- [x] Update canonical docs and semantic Graphify through the safe fragment adapter; preserve unrelated graph/user changes.
- [x] Describe the reused daily-quota markers, shared allowance and bounded retention in privacy copy, separately from unchanged historical trial rules; no new consent or legal interpretation.
- [x] Prepare a reviewable staging PR/delivery packet with schema-before-runtime order, default-off flags, activation preconditions, artifact replacement and rollback retaining all usage/bindings. Do not activate/deploy an incompletely verified candidate.
- [x] Report concrete completed behavior, tests, exact local/staging state and remaining loaded/two-user acceptance. No production-readiness claim from local fixtures.


## Execution evidence and remaining delivery gates, November 3, 2026

Tasks 1–4 are implemented through `b219bf49` and independently reviewed after
scoped fixes: SQL `0632721a`/`69223f29`, Web `31e8bdcf`/`fdccf2d7`, Worker
`31b7b51a`, extension `b219bf49`. Checkboxes above record local implementation,
not hosted activation or loaded-client acceptance. Full reports and the execution
ledger will be archived under ignored `artifacts/free20-abuse-20261103/sdd-record/`
before execution-workspace cleanup; review receipts and other evidence remain in
`artifacts/free20-abuse-20261103/`. Counts below overlap and must not be summed.

| Slice | Completed local evidence | Remaining boundary |
| --- | --- | --- |
| SQL | Initial 724 assertions/21 suites, eight actual two-connection race groups and existing admission/purchase/trial/warning/client contracts; review fix 104/104 abuse + 36 status; Task 2 status integration and fresh full-file replay 109/109 abuse | No hosted migration or policy change; orphan unsettled reservations intentionally hold |
| Proof/Web/protocol | Protocol 285, Web 1552 pass/6 existing skips, API 326, workerd 158 and room harness 39 at Task 2; cancellation fix 15/15 plus Web check | Real crypto/handlers use synthetic auth/SQL boundaries; actual browser cookie delivery unverified |
| DO transfer | Task 3 final focused 24/24 workerd transfer and API check; its preceding full runtime 181, API 329, Web 1561 pass/6 existing skips, protocol 285 and harness 39; later CI full Worker runtime 182 passed | The earlier 181-case pass predates the final three-line UTC fix; the later 182-case pass closes that local full-suite gap. External Web/SQL HTTP authority is simulated; hosted acceptance remains pending |
| Extension | Final check; 2759 tests/166 files; icon check; narrow candidate build/validator; actual handler/P-256 client fixture; unchanged stable folder receipt | Loaded Chrome cookie-policy, A/B account switching and hosted compatible runtime still pending |
| Media regression | Root legacy real-WebRTC 26/26; all four-participant v3 scenarios, 12/12 decoded first frames, p95 1931.8 ms | Actual source engine/local Worker/isolated Chromium/fake media, no external TURN; not physical-network or hosted transfer acceptance |

Task 2's passing runtime emitted one workerd overdue-alarm diagnostic; it did not
recur in Task 3's required runtime logs. Task 4 build output contains ineffective
dynamic-import and oversized-chunk warnings; baseline ancestry was not independently
verified. Do not describe the bundle output as pristine. The current silent PKCE
auth flow has no equivalent first-party proof POST/context result path. Cookie
blocking remains retryable unavailable; no cookie-only bypass or auth redesign.

The historical Task 4 ignored extension candidate is
`artifacts/free20-abuse-20261103/task4/candidate-31b7b51-staging-task4-20261103T182700Z/`,
build ID `31b7b51-staging-task4-20261103T182700Z` (base plus dirty-source fingerprint,
not a committed-source build claim); `task4/candidate-receipt.json` records exact
archive/hash identity. `task4/stable-preservation.json` records the unchanged
working folder. Owner reload/inspection remains his separate step.

Task 5 canonical docs/privacy slice records the shared allowance, replacement
floors, strict proof, separate unchanged trial rules, seven-UTC-day eligible
cleanup, retained unsettled evidence and compatible rollback. Semantic Graphify,
whole-branch review, final check aggregation and draft PR preparation are complete
as recorded below. Hosted delivery and acceptance remain pending. The approved
spec requires no behavioral amendment for this documentation slice.

Documentation-slice verification: `pnpm dev:check` passes and recommends
`api`, `rooms`, `extension`, `web`, `docs`. `pnpm --filter @anidachi/web check`
passes after the factual privacy JSX edit; 19 new local links and seven evidence
paths resolve, and `git diff --check` passes. Logs and link/path receipt are in
`artifacts/free20-abuse-20261103/task5/`. Full affected-plane evidence is recorded
above; this copy-only slice does not rerun or relabel those earlier suites.

Read-only preflight `2026-11-03T11:12:34Z` observed staging `3eeea8bc`, Web READY
`dpl_C3D1yExdG6bbscBv2Xjmbx5NxAvw`, Worker `db322fb7`, 89 migrations through
`20261101102723`, no new migration, policy revision 4/free20 true/trials false,
and one nonterminal unprotected daily room. It is a historical preflight snapshot,
not delivery or activation; re-inventory before any change. Actual accounts/grants/
usage, user's stable artifact, main, production and Store remain unchanged here.

The [delivery packet](2026-11-03-free20-abuse-staging-runbook.md) preserves schema
before runtime, exact Preview/staging Web gate, normal room drain and SQL policy
last. Completed readiness checkboxes do not represent merge, deployment or
activation. Actual two-account/loaded-cookie acceptance, two-participant spending,
purchase during spending and real UTC rollover remain pending unless observed;
local fixtures do not establish production readiness.

## Historical local/readiness receipt, November 3, 2026

Final candidate source is `c367453c5d15aacf2ee447b10e0aed2907cdf7c7`.
[PR502](https://github.com/AniDachi/anidachi-LP/pull/502) was draft and not
merged, deployed or activated at this preparation snapshot. The later authorized
delivery below supersedes those delivery-pending statements, not their original
test or review scope.

- Whole-branch review at `78ae94a9` found no Critical/Important issue; one P3
  test-maintenance issue about fault-injection boundaries is parked. The test-only
  CI lint correction `df8c047e` was independently approved with 45/45 focused tests,
  full Web lint and Web check. Graphify import resolution was restored at
  `c367453c`. These corrections make no product behavior change.
- [CI 41635669181](https://github.com/AniDachi/anidachi-LP/actions/runs/41635669181),
  [E2E Rooms 41635669420](https://github.com/AniDachi/anidachi-LP/actions/runs/41635669420),
  [P2P 41635669076](https://github.com/AniDachi/anidachi-LP/actions/runs/41635669076)
  and Vercel preview succeeded. A full 182-case Worker runtime pass now closes
  the earlier local full-suite source gap; the historical 181/24-case evidence
  above retains its original scope.
- The exact final narrow candidate is
  `artifacts/free20-abuse-20261103/candidate-c367453c/`, build ID
  `c367453c5d15aacf2ee447b10e0aed2907cdf7c7-staging-abuse-candidate`.
  `final-candidate-receipt.json` records all 13 file hashes, preserved identity/
  permissions and `delivered:false`. Validation passed; the stable working folder
  remains unchanged. The old Task 4 candidate is historical evidence only.
- Graphify completed 62 changed AST sources and nine semantic sources plus one
  unchanged protocol dependency needed to resolve both context/owner header
  imports. `artifacts/free20-abuse-20261103/graph/validation-final.json` records
  source hashes, preserved unrelated content and no duplicate/dangling endpoints.
- Read-only refresh `2026-11-03T12:06:26Z` observed policy revision 4/Free20 true/
  trials false, new migration absent and zero nonterminal Free20 rooms. This is
  preparation evidence, not current activation proof or permission to skip fresh
  room/deployment inventory before any later gate change.

Reports and ledger will be archived to
`artifacts/free20-abuse-20261103/sdd-record/` before their execution workspace is
removed. This final two-document receipt update postdates the source/CI/review
receipts above; it does not claim its own commit is already reviewed or CI-tested.
Root owns its commit and final semantic refresh. Actual Chrome cookie policy,
two-account switching, two-participant spending, purchase during spending, live
UTC rollover and all hosted delivery remain pending.

## Authorized staging delivery, November 3, 2026

The owner authorized compatible delivery and updating the same extension folder.
PR502 merged as `03efd89983ff06cbba1651f63e073f5f21b06fe1` after schema-first
workflow `41640338430` from frozen head `8a4e479c`. Hosted schema comparison
matched all 30 checked functions, three private tables, default-false columns
and cleanup schedule. Web `dpl_GgJ8Gdzf1afeeFBaAS6VVdWBVKzY` and Worker
`f39a67e5-8a95-4e47-8916-cea88b720361` are delivered; CI, extension build,
staging Web smoke and Worker smoke passed.

Artifact `13231299833`, build
`03efd89983ff06cbba1651f63e073f5f21b06fe1-staging-246`, replaced the same primary
unpacked folder and worktree mirror after separate backups. All 13 files match
the validated CI build; extension identity and narrow permissions are preserved.
The implementation ledger was archived to `artifacts/free20-abuse-20261103/sdd-record/`.
Exact deployment, schema, artifact and backup receipts are under
`artifacts/free20-abuse-staging-delivery-20261103/` and summarized in the
[delivery runbook](2026-11-03-free20-abuse-staging-runbook.md#authorized-delivery-receipt-november-3-2026).

Base Free20 remains enabled. The new SQL gate is false and Web gate absent;
policy revision 4 and original trial/activation flags are preserved. Activation
waits for the owner's Chrome reload, a fresh room inventory and the runbook's
ordered Web/SQL gates. No actual account/grant/usage reset or production/Store
promotion occurred. Loaded-cookie behavior, actual A/B switching, two-participant
spending, purchase during spending and live UTC reset remain acceptance work.
