# Free20 staging readiness and rehearsal

> Execute with superpowers:subagent-driven-development. This plan continues the owner-authorized November 1 staging task; production promotion and Store publication remain separate.

## Objective and release boundary

Bring staging to working Free20 with truthful entry screens, one warning at 300 seconds, supported host clients, purchase delivery and a documented rehearsal. Preserve accepted trial/payment operations, current subscriptions/manual grants, historical usage, original activation timestamp, room membership and pinned media/participant caps. Keep staging gated and noindex. No LIVE Stripe, campaign/pricing changes, main promotion or Store release.

The owner explicitly selected the warning threshold on November 1: **5 minutes**. Show a small capsule-adjacent notice with View plans and dismiss; no dimming, pause, focus theft or camera/microphone dock changes. Final visual refinement continues on enabled staging.

Predecessor: [trial retirement plan](2026-11-01-free20-trial-retirement.md). Its implementation is committed at `2997ddb6` and independently approved. The existing accounting, account-status, live timer and purchase-delivery blocks are already delivered in staging through PR489. No completed accounting block is reimplemented here.

## Frozen cross-plane constraints

- 1200 shared host seconds per account per UTC day. Meter only with host plus a guest; video pause still counts, solo host does not. No carryover, no client-granted refill, no quota polling/writes on clock ticks.
- Current timers and independent account hosting-status remain the authority for presentation. Legacy HostingAccess, PlanPolicy and quota schemas keep their existing meanings.
- Unknown/stale/mismatched authority is unavailable, never fabricated zero, full allowance or unlimited access.
- New trial issuance is retired atomically; accepted operations recover under their original terms. Do not use historical `activate_paid_hosting_v1` or reset commercial activation_at.
- A confirmed purchase changes time rights of a still-live room, not its pinned capacity. Ended generations never revive.
- Existing unmarked rooms are not adopted into Free20. Existing old host sockets are not forcibly closed by the new-client admission check.
- Keep prices, paid plan limits, history permissions, third-party platform subscriptions/trials and current device/media behavior intact.
- Preexisting `.serena/project.yml` belongs to the user and stays untouched.

## Delivery decision

Prepare a coherent staging candidate in reviewed commits on `codex/free20-staging-readiness`, including the dormant retirement guard. Perform one final cross-plane review, docs/Graphify update and required checks before the staging PR. This avoids repeatedly delivering an incomplete set of mutually dependent entry screens and activation requirements. Public Free20 copy is release-candidate copy: it must not reach main/production before the separately accepted production cutover. Do not introduce a runtime database fetch on every SEO page to select marketing sentences.

The candidate can be deployed with Free20 disabled while build/artifact checks run; do not label this as enabled acceptance. Enable only after all readiness tasks below pass. Actual hosted flags and live acceptance are recorded separately from implementation.

## Task 1: Once-per-budget warning server contract

**Files:** add `packages/protocol/src/free20-warning.ts` and schema tests/export; add `apps/web/lib/anidachi-auth/free20-warning.ts` and tests; add `apps/web/app/api/me/hosting-warning/claim/route.ts`; one additive migration, `apps/web/supabase/tests/free20_warning.test.sql`, and a labeled-local-container-only concurrency harness under `apps/web/supabase/contracts/`. Reuse existing account authority and internal live-status readers. Do not change Worker metering, timers, WS schemas or old public contracts.

Public request: authenticated `POST /api/me/hosting-warning/claim`, JSON strict bounded body `{hostingWarningVersion:1, roomId, roomGeneration, utcDay}`. Require existing `x-anidachi-hosting-owner` equal to the authenticated account. Browser supplies context fences only, never allowance/owner/eligibility. Use `Cache-Control: private, no-store` and vary on Cookie, Authorization and owner header.

Public success is a strict union containing `hostingWarningVersion:1`, `ownerUserId`, `roomId`, `roomGeneration`, `utcDay`, `decision`, `serverTime`, `validUntil`. Decisions: `show`, `already_claimed`, `not_eligible`. Only `show` includes `thresholdSeconds:300` and SQL-generated UUID `claimId`. Positive display authorization expires no later than live authority, UTC reset, conservative exhaustion or serverTime+10 seconds. Expected errors: 400 malformed, 401 unauthenticated, 409 owner/context changed, 404 FREE20_DISABLED, 503 HOSTING_WARNING_UNAVAILABLE on uncertainty. No false successful fallback.

Server flow: authenticate/header/flag and body -> canonical account authority -> requested current room/day match -> existing authenticated DO projection -> atomic SQL claim. Require current assigned host, pinned daily_free20, live/lobby, Free authority and fresh finite `0 < remainingSeconds <= 300`. The DO projection already includes settled plus unsettled usage: never add SQL committedSeconds again. Before returning show, conservatively bound expiry by elapsed monotonic request time.

SQL table `public.free20_daily_warning_claims`: user_id FK users ON DELETE CASCADE, utc_day date, claimed_at timestamptz, claim_id UUID; primary key(user_id,utc_day). RLS enabled, no browser grants; service-only fixed-search-path security-definer claim RPC `claim_free20_daily_warning_v1(p_user_id uuid,p_expected_context jsonb,p_live jsonb)` with bounded locks/statements. No cleanup cron, usage-row fabrication, quota/room/Stripe mutation or marker deletion on reconnect/new room/logout/dismiss/upgrade.

Claim transaction reuses `read_free20_account_status_v1`, retaining its established locks through INSERT. Compare accountGeneration, accessEpoch, full assignment including participant session, owner/room/generation, current UTC day/reset and Free grant state against the preflight. Obtain fresh server time after waits. Do not require unchanged committedSeconds: settlement may change its storage split without changing the live total. Validate internal context/live DTOs and measurement expiry, subtract elapsed time conservatively only when metering. Unknown/future/malformed/expired observations fail closed. Canonical lazy plan/history-cache reconciliation is explicitly permitted; the only new warning-specific write is the claim marker. Do not duplicate the entitlement resolver.

`INSERT ... ON CONFLICT DO NOTHING RETURNING` grants show only to the inserting caller. All conflicts, including replay of the same HTTP request, yield already_claimed. This provides **at-most-once display authorization**, not exactly-once human visibility: a lost reply/crash can omit the notice. No ack/lease/reissue mechanism. Paid/ended/no-host observations are not_eligible without a marker; context changes/unknown states remain distinct errors. Current room/paid status can change after the DO read; this bounded presentation race grants no time, and the client rechecks immediately before showing.

- [x] Add meaningful RED/GREEN protocol, handler, pgTAP and real two-session concurrency tests.
- [x] Cover owner/auth/body, 301/300/1/0, pending/invalid/stale upstream, session/generation/day/epoch fences, disabled/paid/guest/ended, UTC rollover and expiry while locks wait.
- [x] Prove one winner across simultaneous requests, a prior-day marker does not suppress today, same-day reconnect/new room does, rollback leaves no marker and anonymous/authenticated SQL execution is denied.
- [x] Assert no quota/assignment/subscription/grant writes; distinguish legitimate existing lazy-cache reconciliation from new warning effects.
- [x] Correct the internal Free20 canonical DTO's accessEpoch bound for a real fresh Free account: canonical SQL may return0 while history is disabled. Permit nonnegative accessEpoch in the Free20 authority and warning context only; keep accountGeneration positive and all fences. Prove fresh-account SQL and account-status handler behavior; do not relax historical history-enabled contracts.
- [x] Run protocol and Web checks/tests, relevant existing SQL/authority regressions. Self-review, owned-files commit and report. Root owns docs/Graphify and independent review.

Task1 candidate `6a28f9e0` independently approved. Protocol281, Web1470 passing/six existing artifact skips, SQL211 assertions and five real concurrency groups. Hosted authenticator timeout configuration was checked separately; no hosted activation is implied.

## Task 2: Warning client and capsule notice

**Files:** new extension warning client/controller or hook and component/tests; integrate background bridge, `overlay-app.tsx` and existing styles narrowly. Consume existing `useRoomHostingTime` and logical auth identity; no second timer authority or bearer exposure to page context.

One eligible initial attempt plus at most one retry after at least five seconds for transient failure, while visible/authenticated HOST/connected with fresh finite positive time at or below300. Scope attempt state across source/room changes by account, logical login and server UTC day; normal credential refresh does not reset it. No recurring polling or retry on every render/focus. If the local estimate crosses slightly before the authoritative reading, permit one later trusted crossing after an above-threshold result without creating a loop.

Background owns serialized attempt state in existing-permission `chrome.storage.session`, so MV3 suspension does not restart the budget. Store only bounded owner/logical-login/day/attempt metadata, never bearer tokens; prune stale entries. A not_eligible result can arm one later trusted crossing within the same maximum of two logical attempts, not extra retries on every tick. Do not fabricate a server already_claimed response for local suppression; use an explicit local bridge outcome. An authenticated401 may refresh credentials through the existing guarded path, never across a changed logical login.

Do not coalesce a successful claim promise across tabs: one show result must reach one requesting document only. SQL handles concurrency across restarts/devices. Fence completion by current owner/logical login/credential context/room/generation/day and fresh clock. Abort on scope changes; an old request cannot show in a later login, even for the same account. Show on first eligible below-threshold observation, not only exact301->300. Hide on zero, unknown, disconnect, hidden state, new day, paid transition, room end, dismiss or View plans; never resurrect the same consumed notice.

Place notice beside capsule, outside panelOpen/sliding clipped wrappers; preserve camera/microphone layout and provider interaction boundary. English text: `Free hosting time is running low`, `View plans`, dismiss accessible label. Explain reset in local time if shown, using existing server UTC reset; no hardcoded local reset or fake remaining count. Polite status announcement once, no focus steal or live countdown announcement. Keyboard focus rings and sensible dismiss focus restoration; Escape only when focus is inside notice.

- [x] Test racing tabs, reply loss/retry, first below300, hidden/sleep/reconnect/new room/day, refresh versus real relogin, paid/guest/unknown/zero, bounded retry and no tick network.
- [x] Verify capsule-closed visibility, View plans/dismiss, keyboard/provider isolation and dock stability in component/integration tests.
- [x] Run extension check/test and initial staging build/validation. Loaded-artifact visual acceptance remains a separate later gate.

Task2 candidate `2a0090f0` passed2581 extension tests/check and staging build.
Independent review found room-local sequence comparisons crossing room boundaries;
fix `7ce01f48` passed45 focused tests/check and scoped re-review. The daily
two-attempt budget survives room/generation changes. Final reviewed artifact
must be rebuilt after this fix; actual Chrome/provider acceptance is still open.

## Task 3: Supported Free20 host admission

The exact contract is frozen in [Free20 host client admission](../specs/2026-11-01-free20-client-admission-design.md); read it for signatures, source-preserving call graph, lock order and required race tests. New capability is `X-Anidachi-Free20-Client: 1`; unsupported marked Free20 hosts receive existing HTTP426 / ROOM_UPDATE_REQUIRED before room/assignment side effects. Include marked rooms temporarily upgraded to paid. Ordinary unmarked paid/trial/manual hosts and old guests retain their behavior. Old mediaProtocol3 alone is insufficient. Preserve old public RPC signatures through unsupported wrappers, close old-version bypasses, and check final canonical authority inside the same locked transaction, including expiry between preflight and create. Do not close existing sockets or backfill room mode.

- [x] Record exact RPC versions/call graph, input/error mapping and owner/role locking before code. Public v4 delegates into parameterized private v2; old public/private signatures remain unsupported wrappers. Final create-core guard is mandatory after its own canonical plan selection, before assignment cleanup/room insert. Ongoing socket/renew helpers remain unchanged.
- [x] Test no mutation on426, replay/replacement, old guest and paid paths, real policy/paid expiry races, role denial and input compatibility.
- [x] Verify new header on create/connect/restore and source-level frozen0.1.4 error behavior; run affected protocol/Web/extension/API/room checks as required.

Task3 candidate `14997bf6` independently approved. Protocol283, Web1486/six
existing skips, API325, extension2588 plus61 focused bridge tests, SQL539,
eight new real concurrency groups and room harness39 pass. Exact final build,
loaded old/current mixed-client behavior and hosted activation remain Task6 gates.

## Task 4: Truthful pricing, onboarding and account entry screens

Read sections A/B and the verification section of the
[presentation design](../specs/2026-11-01-free20-presentation-design.md) for the
exact source boundaries. The website identity ruling there is binding: owner,
local lifecycle and expiry are observable; a stable web logical-login ID is not.
Do not broaden this task into auth-family changes. Verify the mapped source
before editing. Public page-local copy belongs to Task5.

- [x] Add explicit public pricing mode from current SQL Free20 policy plus exact server flag, retaining paidHostingActive meaning and personal availability only in authenticated hosting-status. Unknown offers remain neutral. Do not redefine legacy1800 policy.
- [x] Use existing accountHostingTime for extension onboarding: available, exhausted, active room and unavailable states; preserve old mode, paid/trial/manual and native player behavior. Popup plan badge and guest join need no incidental redesign.
- [x] Update billing Free/ended-trial and explicit install welcome from current owner-bound status. Preserve active trial/renewal/pending recovery, dates and prices. No invented quota on503; bounded activation/return refresh only.
- [x] Verify focused presentation/session tests and Web/extension checks/tests. Preserve active trial/paid/manual and history behavior, prices and dock layout; authenticated display is not admission authority.
- [ ] Inspect loaded/staging screens as part of Task6 acceptance.

Task4 candidate `f78d3a1b` plus fixes `3e25376a` and `17274faf` independently
reviewed. Full Web1502/six existing skips and extension2590 pass; later welcome
fixes pass29 focused tests, all three reviewer probes and Web check. Departure
fences, explicit idle retry and a ten-second pending presentation deadline
cover missing refresh props without polling. Final loaded/staging proof remains
Task6; a passing component test is not hosted acceptance.

## Task 5: Consistent public Free20 copy

- [x] Replace public AniDachi paid-only-host, 30-minute Free and new-trial sales copy across shared constants, visible text, metadata and JSON-LD. Preserve third-party trials and genuine larger-than-Free room-size examples. Use existing layout, no SEO redesign or global database polling.
- [x] Use the exact inventory in the [presentation audit](../specs/2026-11-01-free20-presentation-design.md), including page-local clauses that shared constants do not replace. Keep provider access requirements, the five-person paid-size example, existing-trial protections and real legacy diagnostics properly qualified.
- [x] Extend focused pricing/copy consistency checks and run Web check/test/lint. Do not write a snapshot test for every sentence or globally replace all1800/30/trial occurrences.
- [ ] Inspect representative staging pages as part of Task6.

Task5 `4c3f33e6` plus correction `6ae739b6` independently reviewed: all105
audited pages plus two same-scope guide clauses, ten shared sources and one
semantic guard. Full Web1518/six existing skips, check and lint pass; after
review, five focused tests and Web check pass. The fix preserves a paid host
for a five-person example and catches interpolated paid-only creation copy.
Existing87 lint warnings are disclosed; no unrelated cleanup or provider edits.

## Task 6: Review, staging delivery and controlled activation

- [ ] Review every task and final branch. Update current state, Free20 contract/spec/transition/environment docs and complete source-hashed Graphify semantic fragments through safe adapter.
- [ ] Run dev:check and required profile, PR into staging, all required CI/deployment checks; keep production promotion manual.
- [ ] Inventory current policy, old room modes/usage, pending trial/Checkout operations and correct Stripe Sandbox account. Resolve verified terminal Checkout statuses through existing guards, preserve unknown/in-flight accepted operations. Never recreate an expired-idempotency operation or clear a held record to unblock testing.
- [ ] Document exact runtime-enable order, expected SQL revision and rollback before mutation. Compatible Worker/Web configuration first with SQL admission still off; then atomic policy-only update sets trials_enabled=false and free20_enabled=true with one revision increment, preserving activation_at and other flags. Verify exact deployment versions and both gates. Do not acquire account locks after locking policy in the cutover transaction.
- [ ] Confirm current-client free create/solo/guest metering/pause/end/reconnect, exhaustion/reset, once/day warning and old-client host/guest handling. Exercise actual Sandbox purchase while room remains live and terminal purchase behavior; distinguish synthetic/local proof from authenticated staging evidence.
- [ ] Build/validate exact reviewed staging extension, back up and update the user's existing unpacked folder, compare every file and record version. Chrome reload and actual user acceptance are separate evidence.
- [ ] Verify main/production unchanged, record remaining design polish and provide a plain-language result. Continue final design work on this enabled functional base; production remains unapproved.

## Rollback limits

Before activation the additive guards and warning table can remain while runtime/UI revert. After activation do not casually flip SQL off: active marked rooms still require compatible accounting/renewal. Preserve accepted trial operations, usage, markers and room state. Prefer forward fix or a separately reviewed new-admission stop/drain; no ledger reset, mass cancellation or new-trial reopening.
