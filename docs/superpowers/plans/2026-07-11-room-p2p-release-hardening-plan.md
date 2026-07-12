# Room And P2P Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` or `superpowers:executing-plans` to
> implement this plan task by task. Every behavior change follows red-green-
> refactor and every task ends in an independently reviewable commit.

**Goal:** Remove the confirmed room lifecycle, P2P media, privacy, quota, and
release-gate blockers before AniDachi is promoted beyond controlled staging.

**Architecture:** Supabase remains the durable product and billing source of
truth. The room Durable Object is authoritative for live presence, media seats,
signaling, and exact active-room time. Web and Worker communicate through a
dedicated internal service contract; the extension never receives internal,
service-role, TURN-key, or JWT-signing secrets.

**Tech Stack:** TypeScript, Zod, WXT/MV3, WebRTC, Cloudflare Workers and Durable
Objects with SQLite/Hibernation, Next.js, Supabase/Postgres, Vitest, Node test,
Playwright.

## Global Constraints

- Work from latest `origin/staging` on `codex/room-p2p-release-hardening`.
- Preserve backward compatibility for one deployed extension generation when
  adding protocol fields or moving transport authentication.
- Keep the room participant cap plan-based and media seats fixed at four.
- Direct P2P remains the default; TURN is fallback, not a media proxy.
- Do not store raw SDP, ICE candidates, peer addresses, or device identifiers
  in durable storage or exported logs.
- Do not make client timers, JWT expiry, or page storage authoritative for room
  lifecycle or quota.
- Internal service calls use `ANIDACHI_INTERNAL_API_SECRET`, never
  `ANIDACHI_JWT_SECRET`.
- Empty rooms auto-end after four hours. Rejoin before the alarm cancels end.
- Free usage is metered only while a joined host and at least one joined guest
  are online. Paid plans are not metered by this policy.
- Additive database migration ships before new enforcement; quota first runs in
  shadow mode to avoid dual charging during mixed-version rollout.
- No production promotion until forced TURN, two-device/two-network, camera
  toggle, PTT, reconnect, and full create-invite-end acceptance pass.

---

### Task 1: Fail-Closed Microphone And Capture Ownership

**Files:**
- Modify: `apps/extension/src/hotkeys.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/p2p-media.ts`
- Test: `apps/extension/test/hotkeys.test.ts`
- Test: `apps/extension/test/p2p-media.test.ts`

**Interfaces:**
- `shouldStopVoiceTalkOnWindowBlur(): true` is the explicit fail-closed policy.
- Camera and voice acquisition each use monotonically increasing intent
  generations. A resolved stream is accepted only when its captured generation
  equals the current intent generation and the matching intent is still on.

- [x] Add a failing hotkey test proving visible-window blur while `V` is held
  stops live voice.
- [x] Add failing deferred-promise tests for camera and microphone
  `start -> stop -> start`; resolve the old request last and assert every stale
  track is stopped and cannot replace current media.
- [x] Run `pnpm --filter @anidachi/extension test -- hotkeys.test.ts p2p-media.test.ts`
  and confirm the new assertions fail for the intended reasons.
- [x] Make blur unconditionally call `stopLiveVoiceTalk()` and reset key/UI
  state. Add camera/voice intent generations and reject stale media results.
- [x] Re-run focused tests and `pnpm --filter @anidachi/extension check`.
- [x] Commit as `fix(extension): make live media acquisition fail closed`.

### Task 2: Bounded Protocol And Worker Room Boundary

**Files:**
- Create: `packages/protocol/src/limits.ts`
- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/test/protocol.test.ts`
- Modify: `apps/api/src/auth.ts`
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/src/room-rate-limit.ts`
- Create: `apps/api/test/room-rate-limit.test.ts`
- Modify: `apps/api/test/auth.test.ts`
- Modify: `apps/api/test/routes.test.ts`

**Interfaces:**

```ts
export const MAX_ROOM_FRAME_BYTES = 64 * 1024;
export const MAX_SDP_BYTES = 48 * 1024;
export const MAX_ICE_CANDIDATE_BYTES = 2 * 1024;
export const MAX_ROOM_ID_CHARS = 128;
export const MAX_PARTICIPANT_ID_CHARS = 128;
export const MAX_SESSION_ID_CHARS = 128;

export type RoomEventClass = "ice" | "sdp" | "control";
export interface RoomRateLimitDecision {
  allowed: boolean;
  close: boolean;
  retryAfterMs: number;
}
```

Per-socket windows are fixed at `total=120/10s`, `ice=80/10s`,
`sdp=8/10s`, and `control=40/10s`. A rejected event is not dispatched or
persisted; the third rejection inside the active ten-second window closes the
socket with code `1008`.

- [x] Add failing protocol tests for oversized IDs, SDP, ICE, fingerprint, and
  nested reaction room mismatch.
- [x] Add failing API tests proving malformed/unauthenticated room requests are
  rejected before `ROOMS.idFromName()`, oversized frames close with `1009`, and
  `event.roomId !== DO roomId` is rejected before dispatch/persistence.
- [x] Add failing token-bucket tests for SDP, ICE, and total event limits.
- [x] Apply `.max()` limits, strict room scope validation, edge JWT validation
  with defense-in-depth validation inside the DO, and per-socket buckets.
- [x] Make duplicate `clientSignalId` events drop instead of forwarding the
  previously buffered payload.
- [x] Run protocol/API checks and tests, then `pnpm harness:rooms`.
- [x] Commit as `fix(api): enforce bounded room signaling boundaries`.

### Task 3: Terminal Room Lifecycle Across Web And Durable Object

**Files:**
- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/test/protocol.test.ts`
- Create: `apps/api/src/internal-auth.ts`
- Create: `apps/api/src/room-lifecycle.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/room-persistence.ts`
- Modify: `apps/api/src/p2p-signal-buffer.ts`
- Modify: `apps/api/test/routes.test.ts`
- Modify: `apps/api/test/runtime/room-hibernation-runtime.ts`
- Create: `apps/web/lib/internal-service-auth.ts`
- Create: `apps/web/lib/anidachi-auth/room-lifecycle.ts`
- Create: `apps/web/lib/anidachi-auth/room-lifecycle.test.ts`
- Create: `apps/web/app/api/internal/rooms/[roomId]/ended/route.ts`
- Modify: `apps/web/app/api/rooms/[roomId]/end/route.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/test/room-reconnect.test.ts`

**Interfaces:**

```ts
export const RoomEndReasonSchema = z.enum([
  "host_ended",
  "empty_timeout",
  "quota_exhausted",
]);

export type RoomEndedEvent = {
  type: "ROOM_ENDED";
  roomId: string;
  endedAt: number;
  reason: z.infer<typeof RoomEndReasonSchema>;
};

export interface EndRoomCommand {
  endedAt: number;
  reason: "host_ended" | "empty_timeout" | "quota_exhausted";
}
```

- [x] Add failing protocol and runtime tests for one terminal event, socket close
  code `4004`, replay cleanup, idempotent end, and `410` on token reconnect.
- [x] Add failing route tests for missing/wrong internal secret and malformed end
  command.
- [x] Persist an ended tombstone before broadcasting/closing. Clear raw runtime
  state and replay while preserving the tombstone through room-token TTL.
- [x] Keep the current legacy settlement/DB transition single-shot, then always
  call the idempotent Worker end command on first and repeated end requests.
  Return a retryable sync error if the Worker call fails. Task 7 replaces this
  temporary ordering with one atomic lifecycle RPC before quota enforcement.
- [x] Handle `ROOM_ENDED` in the extension as terminal: stop media/reconnect,
  clear room session, and show the existing ended state. Treat close code
  `4004` as the same terminal fallback if the event is lost in transit.
- [x] Run protocol/API/web/extension tests and room harness.
- [x] Commit as `fix(rooms): make room end terminal across control planes`.

### Task 4: Empty-Room Alarm And Idempotent Web Callback

**Files:**
- Create: `packages/protocol/src/room-lifecycle.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/test/protocol.test.ts`
- Modify: `apps/api/src/room-lifecycle.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/room-persistence.ts`
- Modify: `apps/api/test/runtime/room-hibernation-runtime.ts`
- Modify: `apps/web/app/api/internal/rooms/[roomId]/ended/route.ts`
- Modify: `apps/web/lib/anidachi-auth/room-lifecycle.test.ts`

**Interfaces:**
- The last joined participant leaving persists `emptySince` and sets one alarm at
  `emptySince + 4h`.
- An authenticated rejoin atomically returns lifecycle to active and deletes the
  empty alarm.
- Alarm callback uses an idempotency key derived from room ID and `emptySince`.
- The four-hour deadline and privacy-safe callback identity are one shared
  protocol contract consumed by Worker and Web, not duplicated implementations.

- [x] Add failing Workers-runtime tests for alarm scheduling, rejoin
  cancellation, stale alarm no-op, callback retry, and duplicate callback.
- [x] Persist `active | empty | ending | ended` lifecycle state. Transition to
  `ending` before external I/O and retain a retryable outbox entry on failure.
- [x] Implement the internal Web callback as an idempotent host settlement and
  room-end operation.
- [x] Run API runtime tests and room harness twice to prove isolation.
- [x] Commit as `feat(rooms): end abandoned rooms with durable alarms`.

### Task 5: Stable Media Session And Signaling Recovery

**Files:**
- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/test/protocol.test.ts`
- Modify: `apps/extension/src/media-types.ts`
- Modify: `apps/extension/src/room-client.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/ghost-cam.ts`
- Modify: `apps/extension/src/p2p-media.ts`
- Modify: `apps/extension/test/room-client-auth.test.ts`
- Modify: `apps/extension/test/ghost-cam.test.tsx`
- Modify: `apps/extension/test/p2p-media.test.ts`
- Modify: `tests/e2e/harness-entry.ts`
- Modify: `tests/e2e/p2p-media-harness.mjs`

**Interfaces:**

```ts
export type RoomSendDisposition = "sent" | "queued" | "dropped";

export interface SignalingTransportReady {
  senderConnectionId: string;
  reconnect: boolean;
}
```

- Add optional `senderMediaSessionId` to P2P envelopes for one-release backward
  compatibility. It is created with the media controller, survives WebSocket
  reconnect, and changes on controller/reload replacement.

- [x] Add failing tests for stable media-session identity across transport
  reconnect, camera/voice republish, dropped offer, dropped answer, rollback,
  and healthy-peer no-churn.
- [x] Make `RoomClient.send()` return a disposition and expose one ready callback
  per socket after its first authoritative snapshot.
- [x] Republish current camera and voice intent after transport ready.
- [x] Serialize incoming signaling per peer and only retain SDP/ICE dedupe
  fingerprints after WebRTC accepts the corresponding operation.
- [x] Recover a stale `have-local-offer` with rollback and bounded fresh offer;
  replace the peer only if rollback fails.
- [x] Publish an explicit closed transport status so page lifecycle restoration
  cannot retain a stale connected state.
- [x] Extend real-WebRTC harness with dropped-offer/answer and reconnect cases.
- [x] Run extension/protocol/API tests and real-WebRTC harness.
- [x] Commit as `fix(extension): recover media sessions across signaling loss`.

### Task 6: Privacy-Safe Storage, Replay, Logs, And TURN

**Files:**
- Modify: `apps/api/src/room-persistence.ts`
- Modify: `apps/api/src/p2p-signal-buffer.ts`
- Modify: `apps/api/src/ice-servers.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/test/room-persistence.test.ts`
- Modify: `apps/api/test/ice-servers.test.ts`
- Modify: `apps/extension/entrypoints/background.ts`
- Modify: `apps/extension/src/room-session-storage.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/debug-log.ts`
- Modify: `apps/extension/src/diagnostic-log.ts`
- Modify: `apps/extension/src/ghost-cam.ts`
- Modify: `apps/extension/src/media-types.ts`
- Modify: `apps/extension/src/p2p-ice.ts`
- Modify: `apps/extension/src/p2p-media.ts`
- Modify: `apps/extension/src/room-client.ts`
- Modify: `packages/protocol/src/types.ts`
- Modify: `scripts/room-signaling-harness.mjs`
- Modify: `scripts/smoke-worker.mjs`
- Modify: `tests/e2e/p2p-media-harness.mjs`
- Modify: associated extension tests

**Interfaces:**
- Raw SDP/ICE replay remains memory-only. Durable storage keeps sequence and
  privacy-safe replay metadata only; an optional `ROOM_SNAPSHOT` resync flag
  bridges one mixed-version release and triggers fresh negotiation after a
  hibernation replay gap.
- Room session state is tab-scoped and owned by the background service worker in
  `chrome.storage.session`; content script uses typed runtime messages.
- `createIceServersPayload(env, { roomId, userId, now })` generates a distinct
  short-lived credential per room/user scope. Default TTL is 15 minutes, max 30
  minutes, with an HMAC `customIdentifier` that exposes no raw identifier.

- [x] Add failing persistence tests proving replay rows and exported logs contain
  no SDP, candidate, peer IP/address, device/track/stream ID, raw room/user/session
  identifiers, or malformed raw frames. Operational room state and socket
  attachments may retain the minimum participant identity needed for hibernation.
- [x] Add failing tab-isolation, account-switch, legacy-migration, and browser-
  session cleanup tests, including ACK-before-page-delete migration behavior.
- [x] Add failing TURN tests for cross-scope isolation, bounded cache, 15-minute
  default TTL, custom identifier, and refresh via `setConfiguration()`.
- [x] Implement storage/replay migration and remove legacy page entries only
  after background ACK.
- [x] Move ICE authorization to `Authorization` on a room-scoped route; keep a
  one-release query fallback only where old clients require it, update CORS and
  harness callers, and measure fallback use without logging token data.
- [x] Run API/extension tests, runtime hibernation test, and forced-relay harness
  when staging credentials are available.
- [x] Commit as `fix(p2p): harden media privacy and turn credentials`.

Validation completed locally with protocol/API/extension/root checks and tests,
Worker hibernation runtime tests, two room harness runs, the direct-first real
WebRTC harness, and staging extension build validation. Forced-relay validation
remains a staging gate because no Cloudflare TURN credentials are present in the
local environment.

### Task 7: Precise Free-Plan Metering In Shadow Mode

**Files:**
- Create: `apps/web/supabase/migrations/20260711_room_quota_transactions.sql`
- Create: `apps/api/src/room-metering.ts`
- Create: `apps/api/src/internal-web-client.ts`
- Create: `apps/api/test/room-metering.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/room-persistence.ts`
- Create: `apps/web/app/api/internal/rooms/[roomId]/lifecycle/route.ts`
- Modify: `apps/web/lib/anidachi-auth/db.ts`
- Modify: `apps/web/lib/anidachi-auth/room-lifecycle.ts`
- Modify: room create/connect/end routes and quota tests

**Interfaces:**
- Add `room_meter_sessions` with one active Free lease per host/day.
- Add `room_lifecycle_events` keyed by event ID and `(meter_session_id,
  event_seq)`.
- Add service-role-only `apply_room_lifecycle_event(...)` RPC that locks room,
  usage row, and lease; accepts monotonic cumulative seconds; returns the same
  saved result for retries.
- DO meters only `host socket present && guest socket present && !ended`, stores
  millisecond remainder, and sends cumulative checkpoints through a durable
  outbox.

- [ ] Write pgTAP/SQL assertions for duplicate events, payload conflict,
  monotonic cumulative usage, over-grant rejection, concurrent starts, UTC
  midnight, stop/release, and atomic cutoff/end.
- [ ] Add failing DO unit/runtime tests for presence transitions, hibernation,
  warning, cutoff, and outbox retries.
- [ ] Ship additive schema and internal endpoint with enforcement disabled.
- [ ] Implement DO cumulative metering and compare it with legacy usage in
  shadow telemetry; do not charge both systems.
- [ ] Validate staging drift is within 60 seconds across reconnect and guest
  churn before enabling lease enforcement.
- [ ] Commit schema/shadow runtime as `feat(rooms): add precise quota shadow metering`.
- [ ] Enable enforcement only in a later reviewed deployment after shadow
  acceptance; then remove legacy settlement in a separate commit.

### Task 8: Required Release Evidence And Documentation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/e2e-p2p-media.yml`
- Modify: `.github/workflows/e2e-rooms.yml`
- Modify: `scripts/p2p-scorecard.mjs`
- Modify: `docs/staging-acceptance-checklist.md`
- Modify: `docs/current-development-state.md`
- Modify: `docs/environment-and-secrets-matrix.md`
- Modify: active P2P plans
- Refresh approved Graphify artifacts

- [ ] Make room and P2P jobs produce stable required check names and fail on
  configured SLOs instead of always exiting zero.
- [ ] Add create -> invite -> join -> camera/PTT -> reconnect -> end coverage and
  media-seat request/grant/revoke cases.
- [ ] Add forced `turns:443`, four-media-seat, camera-off receive-only, PTT without
  camera, dropped signaling, and two-network evidence fields.
- [ ] Run `pnpm dev:check`, `pnpm check`, `pnpm test`, API runtime, room harness
  twice, direct P2P harness, forced relay, staging smoke, and extension staging
  build/validation.
- [ ] Update docs with exact SHA/artifact/evidence and run `pnpm graph:update`.
- [ ] Commit as `chore(release): require room and p2p acceptance gates`.

## Rollout And Rollback

1. Merge additive protocol/API/extension fixes to staging and deploy Worker/Web.
2. Test the matching staging extension artifact on two devices and networks.
3. Deploy lifecycle alarms with internal service secret configured on both
   Worker and Web. Roll back by disabling alarm scheduling, not by deleting the
   tombstone schema.
4. Deploy quota schema and shadow metering with charging disabled. Compare with
   legacy usage before enabling enforcement.
5. Require stable E2E checks only after repeated green runs; keep a manual
   emergency dispatch path with documented approval and rollback.

## Done Means

- No confirmed Critical or High audit finding remains unaddressed or explicitly
  deferred with owner, reason, and release impact.
- All automated checks pass from a clean checkout.
- Forced relay selects a relay candidate and survives credential refresh.
- Two real clients on different networks pass the complete room lifecycle.
- Staging records the exact extension artifact SHA and Worker/Web deployments.
- The promotion PR includes rollback instructions and current evidence.
