# Single Active Room Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Use
> `superpowers:test-driven-development` for runtime tasks and
> `superpowers:verification-before-completion` before every completion claim.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce one active AniDachi watch room per authenticated user across
all providers, tabs, profiles, and devices, while making active host-tab close
end the room, active guest-tab close leave the guest, and reload/brief network
loss reconnect safely.

**Architecture:** Supabase stores one server-only active-room assignment per
user. The existing per-room Cloudflare Durable Object owns live sockets,
60-second disconnect grace, hibernation-safe deadlines, and room termination.
The extension prepares one tab-session ID before Web admission and binds that
same ID through the database claim, room token, WebSocket JOIN, and tab-close
departure. Existing extension Web Locks remain a fast local guard, not the
authority.

**Tech Stack:** TypeScript, Zod shared protocol, Next.js App Router, Supabase
PostgreSQL/PostgREST RPC, Cloudflare Workers Durable Objects/WebSocket
Hibernation, WXT Manifest V3 extension, Node test runner, pgTAP, Playwright.

**Spec:**
`docs/superpowers/specs/2026-08-23-single-active-room-session-design.md`

## Global Constraints

- [ ] Start implementation only after explicit user approval of this plan.
- [ ] Re-read current `origin/staging`, the root and plane `AGENTS.md` files,
  canonical project docs, and affected source before changing runtime code.
- [ ] Branch from the latest `staging`; never push directly to `staging` or
  `main`.
- [ ] Do not merge, deploy, apply a linked migration, update test folders, or
  promote to `main` without the user's explicit approval at the relevant stop.
- [ ] Keep the implementation inside the current Supabase, Web, Worker,
  extension, and protocol planes. Do not add Redis, a user Durable Object,
  recurring heartbeat, new queue service, TURN changes, or release work.
- [ ] Define cross-plane contracts in `packages/protocol` before producers and
  consumers.
- [ ] Keep `room_members` as durable membership/history context, not live
  presence.
- [ ] Preserve Watch History v2, room-source durability, usage metering,
  invitation behavior, P2P signaling, and the existing four-hour emergency
  empty-room cleanup.
- [ ] Treat Graphify as navigation only and verify every material decision in
  canonical source.
- [ ] Keep database changes additive and migration-first. No destructive
  down-migration is part of this plan.
- [ ] Use `participantSessionId` exact-match checks on every cleanup path so a
  stale tab cannot release or end a newer session.
- [ ] Record real evidence. Do not describe unrun checks, staging, hibernation,
  loaded-artifact, two-profile, or network behavior as passed.

---

## Task 0: Freeze The Current Baseline And Create The Execution Branch

**Files:**

- Read: `AGENTS.md`
- Read: `apps/web/AGENTS.md`
- Read: `apps/api/AGENTS.md`
- Read: `apps/extension/AGENTS.md`
- Read: `packages/protocol/AGENTS.md`
- Read: `docs/project-operating-manual.md`
- Read: `docs/current-development-state.md`
- Read: `docs/project-architecture-and-development.md`
- Read: `docs/development-quality-gates.md`
- Read:
  `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- Read:
  `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`
- Create during execution:
  `.superpowers/sdd/2026-08-23-single-active-room-session/task-0-baseline.md`

- [x] **Step 1: Verify the planning tree and upstream state without changing it**

```bash
git status --short --branch
git fetch origin
git rev-parse staging
git rev-parse origin/staging
git log --oneline --decorate -8 origin/staging
git worktree list --porcelain
```

Expected: the user-approved design and plan are present, unrelated user WIP is
identified, and the branch point is the current `origin/staging`. If staging
advanced after approval, inspect the diff and amend the plan before continuing.

- [x] **Step 2: Re-run focused Graphify navigation and direct source checks**

```bash
graphify query "Trace room create and connect admission, room token issuance, participantSessionId, WebSocket close, Durable Object alarms, room finalization, and extension tabs.onRemoved."
rg -n "participantSessionId|tabs\.onRemoved|handleClose|alarm\(|finalize_room_usage|createRoom|connect|SESSION_TAKEN_OVER|empty_timeout" \
  packages/protocol apps/web apps/api apps/extension
```

Expected: the baseline report records actual producers/consumers and any drift
from the approved spec. Graphify findings are confirmed against source.

- [x] **Step 3: Create the feature branch only from accepted current staging**

```bash
git switch staging
git pull --ff-only origin staging
git switch -c codex/single-active-room-session
fnm exec --using="$(cat .node-version)" node --version
fnm exec --using="$(cat .node-version)" pnpm --version
```

Expected: Node `22.23.1`, pnpm `11.2.2`, and a clean feature branch containing
the approved docs. Stop rather than moving unrelated dirt.

- [x] **Step 4: Run the unmodified baseline gates**

```bash
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api test:runtime
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm harness:rooms
```

Expected: all baseline gates pass. Record any pre-existing failure verbatim and
stop for a scope decision; do not repair unrelated code inside this task.

- [x] **Step 5: Commit only the approved planning baseline if it is not already committed**

```bash
git add docs/superpowers/specs/2026-08-23-single-active-room-session-design.md \
  docs/superpowers/plans/2026-08-23-single-active-room-session-implementation-plan.md \
  docs/superpowers/plans/README.md
git diff --cached --check
git commit -m "docs(rooms): plan single active room sessions"
```

Expected: one docs-only commit, no runtime/generated/test-profile files.

---

## Task 1: Define The Shared Session And Departure Contracts

**Files:**

- Create: `packages/protocol/src/room-session.ts`
- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/protocol/test/room-session.test.ts`
- Modify: `packages/protocol/test/protocol.test.ts`

- [x] **Step 1: Write failing protocol tests**

Cover:

- bounded create/connect session input;
- `ACTIVE_ROOM_CONFLICT` response with safe active-room summary;
- authenticated departure command and acknowledgement outcomes;
- Worker-to-Web guest release callback;
- `host_disconnected` as a valid room end reason;
- admission requiring a bounded `participantSessionId`, while the legacy JOIN
  field remains compatible until the consumer cutover in Task 5;
- strict-object rejection of extra/unbounded fields.

```bash
pnpm --filter @anidachi/protocol test
```

Expected: new tests fail because the schemas and required JOIN field do not yet
exist.

- [x] **Step 2: Add the minimal shared schemas**

Implement and export:

- `ActiveRoomRoleSchema`;
- `ActiveRoomConflictResponseSchema`;
- `RoomSessionAdmissionInputSchema`;
- `RoomDepartureRequestSchema`;
- `InternalRoomDepartureCommandSchema`;
- `RoomDepartureCallbackSchema`;
- `RoomDepartureAcknowledgementSchema`;
- `ROOM_DISCONNECT_GRACE_MS = 60_000`.

Add `host_disconnected` to `RoomEndReasonSchema`. Keep the existing JOIN field
bounded but optional only for this additive contract task; Task 5 makes it
required in the same TDD change that updates every producer and consumer. Do
not add a second identifier or provider-specific contract.

- [x] **Step 3: Run focused and protocol plane gates**

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/protocol check
git diff --check
```

Expected: all protocol tests/checks pass and the generated public API exposes
only the intended schemas/types.

- [x] **Step 4: Commit the protocol contract**

```bash
git add packages/protocol
git commit -m "feat(protocol): define active room session contracts"
```

---

## Task 2: Add The Atomic Supabase Active-room Authority

**Files:**

- Create:
  `apps/web/supabase/migrations/20260823090624_single_active_room_sessions.sql`
- Create:
  `apps/web/supabase/tests/single_active_room_sessions.test.sql`
- Modify:
  `apps/web/supabase/tests/service_role_explicit_privileges.test.sql`
- Modify: `apps/web/lib/anidachi-auth/db.ts`
- Create: `apps/web/lib/anidachi-auth/active-room-session.ts`
- Create: `apps/web/lib/anidachi-auth/active-room-session.test.ts`
- Modify: `apps/web/lib/anidachi-auth/db-result.test.ts`

- [x] **Step 1: Write pgTAP tests before the migration implementation**

The SQL tests must prove:

1. one `active_room_sessions` row per user;
2. host create plus claim is one transaction;
3. two different-room claims for one user cannot both win;
4. conflicting create leaves no orphan room;
5. same-room retry is idempotent;
6. same-room new session performs deliberate takeover;
7. exact release succeeds once;
8. stale session release changes nothing;
9. an assignment pointing to an ended room is repaired before a new claim;
10. finalization clears every assignment, including its already-ended repair
    path;
11. `anon` and `authenticated` cannot read/write the table or execute
    server-only RPCs;
12. the service role retains the explicit minimum privileges.

```bash
supabase db reset --workdir apps/web
supabase test db --local --workdir apps/web \
  apps/web/supabase/tests/single_active_room_sessions.test.sql
```

Expected: the new test fails because the table/functions do not exist.

- [x] **Step 2: Implement the additive migration**

Create `public.active_room_sessions` exactly as specified, plus a
`room_id` index. Enable RLS, add no public policies, revoke table/function
access from `public`, `anon`, and `authenticated`, and grant only the
server role used by the existing Supabase service client.

Implement:

- `create_room_with_active_session_v1`;
- `claim_active_room_session_v1`;
- `release_active_room_session_v1`;
- assignment cleanup inside `finalize_room_usage`.

Every function must:

- use fully-qualified identifiers or `set search_path = ''`;
- validate bounded session IDs and role values;
- return a structured outcome instead of leaking raw database errors;
- preserve current room source, entitlement snapshot, quota, and
  `client_request_id` behavior;
- serialize same-user claims and document lock order;
- leave no partial room/assignment state.

Do not expose the table through a client policy and do not use application-side
“check then insert” as enforcement.

- [x] **Step 3: Add typed Web database parsers and helpers**

Keep raw Supabase result parsing in a narrow module. Represent outcomes as:

```txt
claimed | reused | conflict | released | stale
```

A conflict parser returns only room ID, role, safe provider, and title. Treat an
unexpected RPC shape as a server error, never as permission to continue.

- [x] **Step 4: Run all local database and Web helper tests**

```bash
supabase db reset --workdir apps/web
supabase test db --local --workdir apps/web
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
git diff --check
```

Expected: migrations apply from zero, every pgTAP test passes, and Web helpers
pass without a linked/staging mutation.

- [x] **Step 5: Review migration safety and commit**

Record:

- additive migration order;
- old runtime behavior before consumer deploy;
- runtime rollback path;
- why destructive down-migration is not used.

```bash
git add apps/web/supabase apps/web/lib/anidachi-auth
git commit -m "feat(web): add atomic active room authority"
```

Implementation note: Supabase CLI generated the migration timestamp above. The
migration is additive for the old runtime: it creates a server-only assignment
table and versioned RPCs while leaving the existing direct room create/connect
paths intact until Task 3 cuts consumers over. A runtime rollback therefore
switches consumers back without destroying the table or room data; no
destructive down-migration is used. The same migration also includes the narrow
exact-session host-lobby fallback required when a tab closes after claiming but
before its first Worker JOIN; it cannot end a live or superseded session. Local
replay, all 461 pgTAP assertions,
the database linter, all 336 Web tests, and Web type-check passed before commit.

---

## Task 3: Enforce Admission And Exact Departure In The Web Plane

**Files:**

- Modify: `apps/web/lib/anidachi-auth/jwt.ts`
- Modify: `apps/web/lib/anidachi-auth/jwt.test.ts`
- Modify: `apps/web/lib/anidachi-auth/room-create.ts`
- Modify: `apps/web/lib/anidachi-auth/room-create.test.ts`
- Modify: `apps/web/lib/anidachi-auth/room-lifecycle.ts`
- Modify: `apps/web/lib/anidachi-auth/room-lifecycle.test.ts`
- Modify: `apps/web/app/api/rooms/route.ts`
- Modify: `apps/web/app/api/rooms/[roomId]/connect/route.ts`
- Create: `apps/web/app/api/rooms/[roomId]/depart/route.ts`
- Create:
  `apps/web/app/api/internal/rooms/[roomId]/participants/[userId]/departed/route.ts`
- Create:
  `apps/web/lib/anidachi-auth/active-room-session-routes.test.ts`

- [x] **Step 1: Write failing route and JWT tests**

Cover:

- create/connect reject missing or invalid `participantSessionId`;
- create/connect use the atomic RPC and return HTTP `409` with the shared
  conflict shape;
- cross-provider room metadata is informational only and does not change
  enforcement;
- same-room create retry/connect succeeds;
- room token contains the exact bounded session ID;
- internal and public departure reject bad auth/body;
- public departure derives user ID from auth, never request JSON;
- stale departure is idempotent;
- guest callback releases only an exact assignment;
- `host_disconnected` is accepted only through the internal lifecycle path;
- existing host explicit end and quota paths remain valid.

```bash
pnpm --filter @anidachi/web test
```

Expected: focused tests fail before route/token implementation.

- [x] **Step 2: Bind the session ID into room tokens**

Extend `RoomTokenPayload`, signing, verification, and tests. Apply the existing
room-token algorithm/audience/TTL constraints. Do not place access tokens or
extension auth artifacts inside room tokens.

- [x] **Step 3: Switch create/connect to atomic admission**

Create:

1. validates session input;
2. performs existing auth/quota/source/capability validation;
3. invokes `create_room_with_active_session_v1`;
4. returns `409` on a different active room;
5. signs a token only after a successful/reused claim.

Connect:

1. validates auth, membership/host role, room state, quota, and session input;
2. invokes `claim_active_room_session_v1`;
3. returns the same `409` contract;
4. updates room activity and signs the bound token only after success.

Keep invite acceptance and `room_members` durable membership separate from
live admission. Never use a UI preflight as authority.

- [x] **Step 4: Add exact public/internal departure paths**

The authenticated public endpoint forwards an internal command to the current
room Durable Object using the existing internal service authorization. It must
not release the database claim before the Worker checks the current/pending
socket session.

The Worker callback endpoint validates internal auth and invokes
`release_active_room_session_v1` with exact user/room/session values. Repeated
or stale callbacks return a safe idempotent acknowledgement.

Handle the rare claim-before-WebSocket case explicitly: if the Worker reports
that no matching socket/pending session ever existed, release a guest only by
exact database match; end a host lobby only through an atomic exact-session
fallback. Do not end a live room based only on a stale client request.

- [x] **Step 5: Make finalization repair active assignments**

Update Web lifecycle parsing and tests for `host_disconnected`. Confirm every
end path reaches the updated database finalization, and the already-ended path
still clears leaked assignments.

- [x] **Step 6: Run Web and protocol gates**

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
git diff --check
```

Expected: new route/JWT tests and all existing auth, invite, room-source, quota,
and Watch History tests pass.

- [x] **Step 7: Commit the Web admission plane**

```bash
git add apps/web packages/protocol
git commit -m "feat(web): enforce one active room per user"
```

Implementation note: production room creation, direct connection, and Watch
History v2 room recreation now use the atomic assignment RPCs. Invite
acceptance remains durable membership only and issues no live room token; the
extension must pass through the same connect admission path. Room tokens bind
the exact participant session, and public/internal departure endpoints preserve
Worker-first ordering with exact-session-only database fallbacks. Direct source
search found the older `createRoomFromWatchSession` helper to be unreferenced by
any live route; it remains only as additive rollback-era code and cannot bypass
the production endpoints. Protocol tests passed 138/138, Web tests passed
347/347 with 3 existing skips, Web type-check passed, and `git diff --check`
passed before commit. No linked database, staging environment, extension test
folder, deployment, or remote branch was mutated.

---

## Task 4: Add Hibernation-safe Disconnect Grace To The Room Worker

**Files:**

- Modify: `apps/api/src/auth.ts`
- Modify: `apps/api/test/auth.test.ts`
- Create: `apps/api/src/participant-disconnect.ts`
- Create: `apps/api/test/participant-disconnect.test.ts`
- Modify: `apps/api/src/room-socket-attachment.ts`
- Modify: `apps/api/test/room-socket-attachment.test.ts`
- Modify: `apps/api/src/internal-web-client.ts`
- Modify: `apps/api/test/internal-web-client.test.ts`
- Modify: `apps/api/src/room-lifecycle.ts`
- Modify: `apps/api/test/room-lifecycle.test.ts`
- Modify: `apps/api/src/room-persistence.ts`
- Modify: `apps/api/test/room-persistence.test.ts`
- Modify: `apps/api/src/room-source-persistence.ts`
- Modify: `apps/api/test/room-source-persistence.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/test/routes.test.ts`
- Modify: `apps/api/test/runtime/room-hibernation-runtime.ts`
- Modify: `scripts/room-signaling-harness.mjs`

- [x] **Step 1: Write failing pure state-machine tests**

Cover:

- disconnect record creation with the canonical 60-second deadline;
- same user/room/session reconnect cancellation;
- different-session takeover leaving the old close stale;
- due guest callback claim/ack/retry;
- due host decision to end the room;
- explicit departure before or after WebSocket close;
- exact-session stale outcomes;
- bounded records by room participant cap;
- restore after constructor eviction;
- retry backoff without deadline loss.

```bash
pnpm --filter @anidachi/api test
```

Expected: new state-machine tests fail before the module exists.

- [x] **Step 2: Require token-bound session IDs at Worker admission**

Extend `VerifiedRoomToken` and token tests. The JOIN handler must reject a
missing/mismatched session ID before mutating participant state. Persist the
verified ID in the socket attachment so hibernation restore has the same
authority.

- [x] **Step 3: Persist pending disconnects**

On WebSocket close:

1. remove the participant from visible live presence immediately;
2. persist the exact pending record;
3. broadcast the updated participant state;
4. reconcile the single alarm.

On same-session JOIN, cancel the record before accepting presence. On
same-room different-session JOIN, keep existing last-wins takeover behavior and
make any later old-session close stale.

- [x] **Step 4: Add the internal explicit-departure command**

Add the authenticated Worker route and per-DO internal handler. It must handle
both event orderings:

- command while exact socket is still attached; and
- command after the exact socket has become pending.

For a current host, trigger the existing durable room-end/source-finalization
flow with `host_disconnected`. For a guest, call the exact Web release callback.
Return `stale` for superseded sessions.

- [x] **Step 5: Extend the one-alarm scheduler**

Refactor alarm reconciliation to choose the earliest deadline across room source
retry, participant disconnects, and room lifecycle. Do not call a competing
`setAlarm` from independent modules.

The alarm handler must:

1. preserve current source-delivery-before-finalization guarantees;
2. process all bounded due guest releases idempotently;
3. end on a due host disconnect even when guests remain;
4. retain failed callbacks for retry;
5. re-read/reconcile storage before scheduling the next earliest alarm;
6. preserve the existing four-hour empty-room emergency behavior.

- [x] **Step 6: Prove hibernation and at-least-once behavior**

```bash
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api test:runtime
pnpm --filter @anidachi/api check
pnpm harness:rooms
git diff --check
```

Expected: hibernation tests reconstruct socket/session authority and pending
deadlines; duplicate alarms/callbacks do not duplicate finalization or release.

- [x] **Step 7: Commit Worker lifecycle changes**

```bash
git add apps/api scripts/room-signaling-harness.mjs \
  docs/superpowers/plans/2026-08-23-single-active-room-session-implementation-plan.md
git commit -m "feat(api): finalize rooms from authoritative tab departure"
```

Implementation note: the Worker now binds every joined socket to the exact
session from the Web-issued token, persists a bounded 60-second disconnect
deadline, and serializes JOIN, close, explicit departure, and alarm handling
through the existing room operation queue. Same-session reconnect and
different-session same-room takeover cancel the pending deadline atomically.
Guest expiry calls the exact-session Web release callback; host expiry reuses
the existing durable `host_disconnected` finalization path. Source retry, room
lifecycle, and participant disconnect work share one Durable Object alarm, and
the four-hour empty-room fallback remains intact. API unit tests passed 159/159,
runtime hibernation tests passed 27/27, API type-check passed, the real Worker
room harness passed 39/39, and `git diff --check` passed. The harness token
fixture was updated to the production issuer/session contract after its old
sessionless token correctly failed with `401`. No linked database, staging
environment, extension test folder, deployment, or remote branch was mutated.

---

## Task 5: Prepare And Persist The Extension Session Before Admission

**Files:**

- Modify: `apps/extension/src/room-session-storage.ts`
- Modify: `apps/extension/test/room-session-storage.test.ts`
- Modify: `apps/extension/src/room-client.ts`
- Modify: `apps/extension/test/room-client-auth.test.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/test/room-reconnect.test.ts`
- Modify: `apps/extension/test/overlay-room-action-feedback.test.ts`
- Modify: `apps/extension/src/room-tab-lock.ts`
- Modify: `apps/extension/test/room-tab-lock.test.ts`

- [x] **Step 1: Write failing session-preparation tests**

Cover:

- prepare a bounded candidate before create/connect;
- same tab + same room reuses the exact ID;
- deliberate same-room takeover uses a new candidate;
- different room never silently overwrites a confirmed active record;
- failed admission discards only the unconfirmed candidate;
- stale in-flight create/connect cannot overwrite the winning record;
- create/connect bridge messages include the candidate;
- room token/JOIN uses that same candidate.
- the shared JOIN schema rejects a missing session only after every current
  producer and consumer has moved to the bound candidate;

```bash
pnpm --filter @anidachi/extension test -- room-session-storage room-client-auth room-reconnect
```

Expected: focused tests fail because the current ID is persisted only after Web
admission.

- [x] **Step 2: Split session preparation from confirmation**

Add narrow storage operations:

```txt
prepareRoomSessionForTab
confirmRoomSessionForTab
discardPreparedRoomSessionIfMatch
```

Use `chrome.storage.session` and existing tab ownership. Do not introduce
localStorage, a second durable account authority, or a recurring cleanup timer.

- [x] **Step 3: Send the session ID through create/connect**

Update the privileged room-client messages and HTTP bodies. After a successful
Web response, confirm exactly the candidate that received the token, then open
the WebSocket and send the required JOIN field.

Treat missing-ID/old-client responses as terminal and readable. Do not retry
them indefinitely.

- [x] **Step 4: Surface one stable active-room conflict**

Parse the shared HTTP `409` response in one place. The overlay must:

- stop the in-flight create/join cleanly;
- keep current playback untouched;
- show “You already have an active watch room”;
- offer only safe existing-room recovery actions;
- avoid popup/overlay blinking, polling, or fake “synchronizing” states.

The local Web Lock remains an immediate same-browser guard but the Web response
is authoritative.

- [x] **Step 5: Run focused and full extension gates**

```bash
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
git diff --check
```

Expected: all extension tests pass, including invite, room-source, history,
voice/media, and provider behavior.

- [x] **Step 6: Commit extension admission changes**

```bash
git add apps/extension apps/api/test/runtime/room-hibernation-runtime.ts \
  packages/protocol/src/types.ts packages/protocol/test/protocol.test.ts \
  docs/superpowers/plans/2026-08-23-single-active-room-session-implementation-plan.md
git commit -m "feat(extension): bind room admission to tab sessions"
```

Implementation note: the background now prepares a bounded tab candidate before
either Web admission request, confirms only the latest exact candidate after the
Web response, and opens the Worker socket with that same required session ID.
A different-room candidate does not alter the confirmed local record before
admission; exact successful admission is the only point allowed to replace it.
The shared JOIN contract now rejects a missing session ID. The extension parses
the structured Web `409` once, stops reconnect loops, keeps playback untouched,
and shows one stable message with one safe `Open active room` action. The Web
Lock remains the immediate local guard for competing creates; connect requests
go to the authoritative Web admission path so a deliberate same-room tab
takeover remains possible while a different room is rejected consistently
across providers, profiles, and devices.

Verification: protocol tests passed 138/138 and type-check passed; extension
tests passed 1286/1286 and type-check passed; API tests passed 159/159, Worker
runtime tests passed 27/27, API type-check passed, the room harness passed 39/39,
and `git diff --check` passed. No linked database, staging environment,
extension test folder, deployment, or remote branch was mutated.

---

## Task 6: Notify Exact Departure From The Extension Background

**Files:**

- Create: `apps/extension/src/room-departure.ts`
- Create: `apps/extension/test/room-departure.test.ts`
- Modify: `apps/extension/entrypoints/background.ts`
- Modify: `apps/extension/test/background-privileged-room-route.test.ts`
- Modify: `apps/extension/src/room-session-storage.ts`
- Modify: `apps/extension/test/room-session-storage.test.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/test/room-reconnect.test.ts`

- [x] **Step 1: Write failing background-close tests**

Cover:

- load the tab record before deletion;
- send authenticated room/user/session departure through the privileged
  background path;
- never accept a page-supplied user ID or access token;
- serialize departure then exact local cleanup;
- bound the request duration and tolerate MV3 termination;
- stale/no-auth/network failure still clears the closed tab locally;
- reload/pagehide does not call the tab-removed departure path;
- duplicate old tab close cannot affect the new same-room session.

```bash
pnpm --filter @anidachi/extension test -- room-departure background-privileged-room-route room-session-storage
```

Expected: tests fail because `tabs.onRemoved` currently deletes local state
without a server notification.

- [x] **Step 2: Implement a bounded best-effort departure accelerator**

The background handler must:

1. read the exact tab session;
2. use existing extension auth storage internally;
3. POST the bounded departure request;
4. clear room-history/privileged authority and tab-session state exactly once;
5. never block browser shutdown indefinitely.

Do not add a keepalive hack or heartbeat. The Durable Object 60-second deadline
is the reliable fallback when MV3 terminates the background worker or the
network is unavailable.

- [x] **Step 3: Preserve reload and BFCache behavior**

Keep `pagehide` as socket cleanup only. Keep `pageshow`, visibility, and online
reconnect paths. Confirm that only real `tabs.onRemoved` requests immediate
departure.

- [x] **Step 4: Run full extension gates and commit**

```bash
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
git diff --check
git add apps/extension
git commit -m "feat(extension): depart rooms when the active tab closes"
```

Implementation note: only `chrome.tabs.onRemoved` invokes immediate departure.
The background reads the confirmed tab-owned session before cleanup, derives
identity and access only from extension auth storage, sends only the exact
`participantSessionId` to the authenticated Web route, refreshes once only
after `401`, and bounds the whole best-effort attempt to four seconds. Missing
auth, another account, network failure, timeout, or MV3 termination cannot turn
page data into authority; the Worker's persisted 60-second deadline remains the
reliable fallback. Closed-tab cleanup matches room, user, and participant
session, so a stale old close cannot erase a same-room takeover, while revision
or voice-mode changes inside the same exact session do not leave a ghost local
record. Existing `pagehide`, `pageshow`, visibility, online, and BFCache paths
were left unchanged and continue to mean reconnect, not departure.

Verification: the failing close/session/background tests were observed before
implementation; focused tests passed 36/36; the full extension suite passed
1297/1297 across 99 files; extension type-check and `git diff --check` passed.
No linked database, staging environment, extension test folder, deployment, or
remote branch was mutated.

---

## Task 7: Prove Cross-plane Races And Regressions Locally

**Files:**

- Modify: `scripts/room-signaling-harness.mjs`
- Modify: `tests/e2e/p2p-media-harness.mjs` only if lifecycle assertions need
  the real-browser transport
- Modify: `tests/e2e/README.md`
- Create:
  `.superpowers/sdd/2026-08-23-single-active-room-session/task-7-local-evidence.md`

- [x] **Step 1: Extend the deterministic room harness**

Add scenarios for:

1. simultaneous different-room claims by one account;
2. same-room retry;
3. same-room takeover;
4. token/JOIN session mismatch;
5. guest close and reconnect within grace;
6. guest expiry and exact callback;
7. host close and reconnect within grace;
8. host expiry while guests remain;
9. stale close after takeover;
10. source retry and disconnect deadline sharing one alarm;
11. duplicate alarm/callback delivery;
12. hibernation reconstruction.

Use injected clocks where possible; do not make unit tests sleep for 60 seconds.

Implementation note: the required matrix was traced to its authoritative
deterministic layers instead of duplicating PostgreSQL concurrency inside a
Worker-only harness. Existing pgTAP, Web, Worker unit/runtime, extension, and
live WebSocket scenarios already cover the twelve cases. The real P2P harness
fixture was updated to carry the production issuer and the exact session bound
to JOIN; Worker verification stayed strict.

- [x] **Step 2: Run the focused matrix**

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api test:runtime
pnpm --filter @anidachi/extension test
pnpm harness:rooms
```

Expected: every lifecycle/race case is deterministic and green.

- [x] **Step 3: Run repository quality gates**

```bash
pnpm check
pnpm test
pnpm dev:check
pnpm build:extension:staging
pnpm validate:extension:staging
git diff --check
git status --short
```

Expected: all gates pass; only intentional source/docs/team Graphify artifacts
are changed. The build retains narrow staging permissions and no secrets.

- [x] **Step 4: Run the real WebRTC regression harness**

```bash
npm --prefix tests/e2e install
npm --prefix tests/e2e exec playwright install chromium
npm --prefix tests/e2e run harness:p2p
```

Expected: existing direct-first media/signaling flows stay green. Forced TURN is
not required because ICE/TURN behavior is unchanged; any P2P regression blocks
the task.

- [x] **Step 5: Review the exact diff and commit harness/evidence**

```bash
git diff --stat origin/staging...HEAD
git diff --check
git status --short
git add scripts tests/e2e .superpowers/sdd/2026-08-23-single-active-room-session/task-7-local-evidence.md
git commit -m "test(rooms): cover global active session lifecycle"
```

Stop if the evidence reveals a product/architecture mismatch. Amend the spec and
obtain approval instead of patching around it.

---

## Task 8: Review, Migration-first Staging, And Two-profile Acceptance

**Files:**

- Modify after verified implementation:
  `docs/current-development-state.md`
- Modify after verified implementation:
  `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- Modify after verified implementation:
  `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`
- Modify:
  `docs/superpowers/specs/2026-08-23-single-active-room-session-design.md`
- Modify:
  `docs/superpowers/plans/2026-08-23-single-active-room-session-implementation-plan.md`
- Modify intentionally only if refreshed:
  `graphify-out/graph.json`
- Modify intentionally only if refreshed:
  `graphify-out/GRAPH_REPORT.md`
- Modify intentionally only if refreshed:
  `graphify-out/manifest.json`

- [x] **Step 1: Perform source review before opening a PR**

Review:

- database concurrency and privilege boundaries;
- room-token/session binding;
- every producer and consumer of JOIN, end reason, and departure contracts;
- one-alarm scheduling and hibernation restore;
- stale-session comparisons;
- Web callback idempotency;
- extension auth and tab lifecycle;
- Watch History authority continuity;
- absence of unrelated provider/release/infrastructure changes.

Run a current Graphify path/query only as a cross-check, then verify in source.

Source review completed locally on 2026-08-23. Database lock/privilege paths,
exact session comparisons, JOIN/end/departure producers and consumers, the
single reconciled alarm, hibernation restore, callback idempotency, tab/auth
lifecycle, and Watch History authority continuity were verified in source.
The review found and fixed four bounded integration gaps before any PR:

1. Web's real room-token issuer differed from the Worker and local harness
   expectation (`3a4814b`); protocol, Web, Worker, and harnesses now share the
   production contract.
2. Pending disconnect storage incorrectly reused the simultaneous live seat
   cap during rapid turnover (`e482eb4`); it now uses the existing fixed safety
   bound while retaining one alarm.
3. A duplicated legacy page could reuse one participant session in two tabs,
   malformed stored authority was under-bounded, and lost terminal ERROR frames
   could reconnect after takeover (`c7e4c7b`).
4. “Open active room” could take over a correct tab from a different provider;
   cross-provider conflicts now keep the current tab disconnected and direct
   the user back to the already active provider (`c7e4c7b`).

No new service, lease, heartbeat, queue, env variable, secret, TURN, Blob,
Stripe, release, `main`, production, or Chrome Web Store change was introduced.

- [ ] **Step 2: Open the feature PR to staging**

The PR must include:

- spec and plan links;
- migration-first order;
- test evidence;
- no env/secret/TURN/Blob/Stripe impact;
- rollback/forward-recovery path;
- staging acceptance checklist;
- explicit statement that `main`, production, launch, and Chrome Web Store are
  out of scope.

Wait for CI and review. Do not merge yet.

- [ ] **Step 3: Stop for explicit user approval before staging mutation/merge**

Ask permission to:

1. merge the reviewed feature PR to `staging`;
2. apply the additive staging Supabase migration before its runtime depends on
   it;
3. verify Web and Worker staging deployments;
4. update the two established test folders with the validated artifact.

No linked database write or staging merge occurs before this approval.

- [ ] **Step 4: Apply migration first and verify deployment health**

After approval, use the established staging Supabase/Vercel/Cloudflare workflow.
Never print secrets. Verify migration history and a read-only RPC/table shape
check before the new runtime is exercised.

Expected: database prerequisite is present, Web and Worker health/smoke checks
pass, and old artifacts fail explicitly rather than bypassing enforcement.

- [ ] **Step 5: Build, validate, and synchronize the exact artifact**

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
rsync -a --delete anidachi-extension-staging/ \
  /Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging/
rsync -a --delete anidachi-extension-staging/ \
  /Users/vladyslavhulyi/anidachi-extension-staging2/
diff -qr anidachi-extension-staging \
  /Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging
diff -qr anidachi-extension-staging \
  /Users/vladyslavhulyi/anidachi-extension-staging2
```

Expected: both folders are byte-identical to the validated staging output. Do
not change Chrome flags or replace browser profiles.

- [ ] **Step 6: Run the manual two-profile acceptance matrix**

With two authenticated staging profiles, verify:

1. host creates on YouTube;
2. same host account is blocked from a different Crunchyroll room;
3. guest joins and is blocked from another room/invite live connection;
4. host/guest play, pause, seek, and rate sync remain correct;
5. host and guest reload reconnect within grace;
6. brief offline/online reconnects;
7. guest tab close removes only the guest;
8. host tab close ends the room for everyone;
9. deliberate same-room takeover works;
10. closing the stale old tab changes nothing;
11. fresh normal provider tab does not restore the closed session;
12. popup/Together/People/Inbox state does not retain a false active room;
13. Watch History v2 remains correct for both solo and shared observation.

Record only observed outcomes.

- [ ] **Step 7: Update canonical docs after acceptance**

Only after the evidence passes:

- mark the prior global-lease deferral as superseded by the implemented rule;
- record exact commit/PR/deployment/artifact evidence;
- record any residual limitation honestly;
- keep the plan open if any required scenario is unproven.

- [ ] **Step 8: Refresh Graphify using the project-required semantic update**

Because code and docs changed, use the installed Graphify skill for
`$graphify . --update`, then review only approved team artifacts. Exclude
`cost.json`, HTML/wiki/cache/scoped scratch output.

- [ ] **Step 9: Run final verification and close the staging task**

```bash
pnpm dev:check
pnpm harness:rooms
pnpm smoke:worker:staging
pnpm build:extension:staging
pnpm validate:extension:staging
git diff --check
git status --short --branch
```

Expected: local/CI/staging/loaded-artifact evidence is green, branch/worktree
state is understood, and no claim is made about `main`, production, public
launch, TURN, or Chrome Web Store.

- [ ] **Step 10: Commit only the verified closeout and stop**

```bash
git add docs/current-development-state.md \
  docs/superpowers/specs/2026-08-23-single-active-room-session-design.md \
  docs/superpowers/plans/2026-08-23-single-active-room-session-implementation-plan.md \
  docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md \
  docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md
git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json
git diff --cached --check
git commit -m "docs(rooms): record single active session acceptance"
```

If Graphify produced no intentional approved artifact change, omit its files.
Stop after the staging closeout. A later promotion to `main` requires a
separate reviewed decision and explicit user approval.
