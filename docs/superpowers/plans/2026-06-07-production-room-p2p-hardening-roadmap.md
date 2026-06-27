# Production Room, Realtime, and P2P Hardening Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for implementation tasks and update this file after every completed step. Use `superpowers:systematic-debugging` for regressions. Use the Cloudflare Durable Objects docs before changing hibernation behavior.

**Goal:** Make AniDachi rooms, realtime sync, ultra-light P2P camera/audio, source switching, and durable watch progress reliable enough for normal development and staged releases.

**Architecture:** Keep the three-plane model. `apps/web` and Supabase are the persistent control plane. `apps/api` with Cloudflare Workers and Durable Objects is the realtime live plane. `apps/extension` is the browser runtime/media plane. The Worker derives identity from short-lived room tokens and coordinates live state; it must not trust client-provided identity.

**Current repo:** `/Users/vladyslavhulyi/anidachi-LP-monorepo`

**Git workflow:** develop on `codex/*` or feature branches, open PRs into `staging`, let staging deploy and smoke tests run, then promote allowed site/docs changes to `main` automatically or merge app/API/extension work deliberately through the protected flow.

**Primary external references checked on 2026-06-07:**

- Cloudflare Durable Objects WebSocket hibernation: `https://developers.cloudflare.com/durable-objects/best-practices/websockets/`
- Cloudflare `DurableObjectState` API: `https://developers.cloudflare.com/durable-objects/api/state/`
- Cloudflare Durable Object lifecycle: `https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/`
- MDN WebRTC connectivity: `https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity`
- MDN `RTCPeerConnection.restartIce()`: `https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce`
- MDN `RTCPeerConnection.getStats()`: `https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/getStats`

---

## How To Use This Plan

- Keep this file as the active source of truth for room/P2P hardening.
- Do not mark a task complete unless code, tests, and staging/manual verification match its acceptance criteria.
- After each real implementation step, add one bullet to **Progress Log** with date, branch, commit or PR, verification command, and remaining risk.
- If a task is partially implemented, mark only the exact sub-step as done.
- Do not jump to later tasks just because they are more interesting. Later tasks assume earlier protocol and lifecycle contracts are stable.

## Progress Log

- [x] 2026-06-07: Re-read the old commercial room/P2P/progress plan and found stale repo paths, stale repo names, and over-broad Task 6 completion claims.
- [x] 2026-06-07: Audited current code in `packages/protocol`, `apps/api`, `apps/web`, and `apps/extension` for room lifecycle, P2P signaling, reconnect, and keepalive behavior.
- [x] 2026-06-07: Ran two focused research passes: one repo-local audit for plan/task ordering and one Cloudflare Hibernation migration audit.
- [x] 2026-06-07: Checked current Cloudflare and WebRTC primary docs and folded the findings into this roadmap.
- [x] 2026-06-12: Full code audit of the end-to-end room flow confirmed the Task 2 premise plus two release-blocking defects (immortal rooms break plan limits; non-idempotent create). Created the execution program for this roadmap with SLOs, a two-browser Playwright harness, and fixed product defaults: `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`. Roadmap ordering remains authoritative.
- [x] 2026-06-27: Started the remaining contract hardening on branch `codex/p2p-production-hardening`: `ROOM_SNAPSHOT` now carries generation/sequence fields, server-relayed `P2P_SIGNAL` now carries required authoritative `roomGeneration/sourceGeneration/serverSeq/serverReceivedAt`, P2P replay is scoped by generation, and the extension drops stale-generation P2P media signals. Verified locally with protocol/API/extension checks and tests, room-signaling harness 29/29, and real-WebRTC harness 8/8. Remaining for full Task 3/5: current source descriptor + actual `SOURCE_CHANGED`/`sourceGeneration` bump.
- [x] 2026-06-27: Continued Task 5 on branch `codex/p2p-source-generation`: added `WatchSourceDescriptor`, optional source descriptors on host state and snapshots, `SOURCE_CHANGED`, Worker-owned source-generation increments on host fingerprint changes, and extension-side stale P2P reset on source change. The room-signaling harness now asserts that reconnect replay returns only active-source P2P signals and skips stale-source signals. Verified: protocol/API/extension checks and tests, room-signaling harness 34/34, real-WebRTC harness 8/8, staging extension build + validation. Remaining for Task 5: durable Supabase source fields, room-create source response plumbing, and explicit source-switch UI/commands.
- [x] 2026-06-27: Started Task 6 on branch `codex/p2p-hibernation-core`: Worker room sockets now use Cloudflare WebSocket Hibernation (`state.acceptWebSocket`, `webSocketMessage/Close/Error`), versioned per-socket attachments, constructor rebuild via `getWebSockets()`, SQLite-backed room snapshot + P2P replay/sequence storage, stale-socket close protection, and raw `ping`/`pong` auto-response keepalive with JSON `PING` compatibility for old clients. Verified: API/protocol/extension checks and tests, room-signaling harness twice in a row (35/35 + 35/35, proving durable harness isolation), `pnpm dev:check -- --profile rooms`, and real-WebRTC harness 8/8. Remaining for Task 6: forced hibernation wake tests in the Workers runtime, DO alarm room end, precise quota metering, and staging two-profile acceptance.
- [x] 2026-06-27: Continued Task 6 on branch `codex/p2p-product-hardening-next`: added `@cloudflare/vitest-pool-workers` runtime coverage for forced Durable Object WebSocket hibernation wake via `evictDurableObject(..., { webSockets: "hibernate" })`. The test proves existing sockets still handle raw `ping`/`pong`, `HOST_STATE`, `CAMERA_ON/OFF`, and `P2P_SIGNAL` after forced wake; host state/source survive into snapshots; P2P `serverSeq` remains monotonic; and replay after a second forced wake honors `lastSeenP2PServerSeq`. Verified: `pnpm check`, `pnpm test`, `pnpm --filter @anidachi/api test:runtime`, `pnpm harness:rooms` (35/35), and `npm --prefix tests/e2e run harness:p2p` (8/8). Remaining for Task 6: staging two-profile idle acceptance, DO alarm room end, and precise quota metering.
- [x] 2026-06-27: Continued Task 7 on branch `codex/p2p-product-hardening-followup`: `P2PMediaController` now proactively restarts ICE on `online` and Network Information `change` signals, while skipping ICE churn during offline. The real-WebRTC harness now covers a short Playwright offline/online guest network loss and asserts a real ICE restart plus decoded video recovery in both directions. The harness also supports a relay-only diagnostic mode (`HARNESS_FORCE_RELAY=true`) with explicit `HARNESS_ICE_SERVERS_JSON` or the real Worker-backed `/ice-servers` path (`HARNESS_USE_WORKER_ICE_SERVERS=true`), so real TURN candidate selection can be tested instead of relying only on same-machine `host/host` pairs. Verified: extension check/test, `npm --prefix tests/e2e run harness:p2p` (11/11), full repo check/test, API runtime test, room harness, staging extension build, and staging artifact validation. Remaining real-world risk: run relay mode with short-lived Cloudflare TURN credentials and complete staging two-profile/two-network acceptance.
- [~] 2026-06-27: Relay-only Worker-backed harness was attempted locally after current Cloudflare Realtime TURN + WebRTC doc review. It correctly failed because local Worker `/ice-servers` returned fallback STUN only (`provider=fallback configured=false`, no TURN URLs). This confirms the harness will not falsely pass same-network conditions; next acceptance needs real Cloudflare TURN bindings and a two-network/two-profile staging run.
- [x] 2026-06-27: Continued Task 7 audio hardening on branch `codex/p2p-product-hardening-followup`: remote voice activity now uses WebRTC inbound audio stats (`bytesReceived`, `packetsReceived`, `audioLevel`) to publish/clear active speaker state in addition to `voice-start`/`voice-stop`; `getStats()` exposes `remoteAudioActivity`; and stale audio state is cleared on track end/peer close/disconnect. Verified: extension check/test (155 tests) and real-WebRTC harness 11/11. Remaining: clearer user-facing recovery/status affordance for failed media.
- [x] 2026-06-27: Reviewed `/Users/vladyslavhulyi/Downloads/teleparty-av-teardown.md` and folded the useful findings into this roadmap without changing the MVP topology: Teleparty's production A/V is SFU + hosted media iframe + multi-node TURN, while AniDachi deliberately stays mesh for <=4 lightweight video seats. Borrowed now: stricter TURN/relay acceptance, SDP codec/FEC/RTX observability in debug summaries, and explicit ICE restart throttle tests. Strategic follow-up: SFU/hosted-media is a future paid-scale path, not the current MVP rewrite.
- [x] 2026-06-27: Added controller-level SDP/ICE signal dedupe on branch `codex/p2p-product-hardening-followup`: `P2PMediaController` now fingerprints exact `offer`/`answer` SDP and ICE candidates per sender with TTL/cap bounds and drops duplicate media replays before applying them, while intentionally leaving `voice-start`/`voice-stop`, `restart-ice`, `renegotiate`, and `bye` un-deduped. Verified: extension check/test (164 tests). Remaining: real TURN relay and multi-network acceptance; same-machine harnesses remain smoke tests only.
- [x] 2026-06-27: Tightened TURN readiness on branch `codex/p2p-product-hardening-followup` after current Cloudflare Realtime TURN docs review: Worker `/ice-servers` now returns safe relay diagnostics (`hasTurn`, `hasTurns443`, URL counts), fails closed if configured Cloudflare credentials produce no browser-usable TURN URL after filtering, and the relay-only harness requires a Cloudflare-configured Worker response with `turns:443` instead of accepting STUN-only fallback as proof.
- [x] 2026-06-27: Added WebRTC codec preference hardening on branch `codex/p2p-product-hardening-followup`: audio/video transceivers now apply browser-native `setCodecPreferences()` before offer/answer creation. Audio prefers supported RED first, then Opus fallback; video keeps lightweight stable codecs first and preserves RTX/FEC repair entries when Chrome exposes them. Verified: extension check/test (171 tests). Remaining proof: real TURN/multi-network acceptance must confirm the negotiated SDP and stats under bad-network conditions.
- [x] 2026-06-27: Added automatic remote-audio stall recovery on branch `codex/p2p-product-hardening-followup`: expected remote voice now keeps a separate media-flow state (`not-expected`/`unknown`/`flowing`/`missing`/`stalled`) from inbound WebRTC audio stats; two consecutive missing/stalled samples trigger throttled ICE recovery with a `media-stall:audio-*` reason and no user-facing reconnect button. Verified: extension check/test (177 tests), API check/test/runtime test, room-signaling harness 35/35, and real-WebRTC harness 11/11. Remaining proof: real TURN/multi-network acceptance.
- [x] 2026-06-27: Tightened remote-video health semantics on branch `codex/p2p-media-recovery-harness`: when WebRTC exposes `framesDecoded`, decoded-frame movement is now the authoritative remote-video flow signal; `bytesReceived` only remains a fallback for browsers without frame counters. This prevents "bytes moving but no picture" from being marked healthy and lets automatic media-stall recovery act. The real-WebRTC harness now waits for both peers to see both cameras enabled in the room snapshot before measuring media SLOs, checks camera-flow state, and treats ICE restart counters as diagnostics while asserting the real product outcome: decoded video resumes after reload and short network loss without room recreation. Verified: extension check/test (178 tests), API check/test/runtime test, room-signaling harness 35/35, and real-WebRTC harness twice (12/12 + 12/12). Remaining proof: real TURN relay and multi-network staging acceptance.
- [x] 2026-06-27: Hardened Cloudflare TURN credential resilience on branch `codex/turn-cache-hardening` after current Cloudflare Realtime TURN docs review: configured Workers keep a module-level hot cache of the last valid Cloudflare ICE payload, serve fresh cached credentials without refetching, and serve still-valid cached relay credentials if the Cloudflare credential API temporarily fails. Authenticated extension media setup now reuses its last valid relay cache on refresh failure and no longer silently replaces a failed relay fetch with STUN-only defaults unless the build-time fallback itself contains TURN. Verified: API check/test/runtime test (39 tests), extension check/test (180 tests), room-signaling harness 35/35, and real-WebRTC harness 12/12. Remaining proof: real Cloudflare TURN relay run and two-network staging acceptance.
- [x] 2026-06-27: Added Opus DTX/FEC SDP hardening on branch `codex/opus-dtx-fec`: local P2P offers/answers now guarantee `useinbandfec=1` and `usedtx=1` on the negotiated audio/Opus payload before `setLocalDescription()`, with unit coverage for existing and missing Opus fmtp lines. Verified: extension check/test (182 tests) and real-WebRTC harness 12/12. Remaining proof: real TURN relay and multi-network staging acceptance.
- [x] 2026-06-27: Added Cloudflare STUN to the extension's local unauthenticated ICE fallback on branch `codex/cloudflare-stun-fallback`: `getDefaultP2PIceServers()` now mirrors the documented Cloudflare STUN pair (`stun.cloudflare.com:3478` and `:53`) before Google STUN, while existing ICE prioritization/deduping keeps endpoint STUN before TURN and avoids duplicate URLs when Worker `/ice-servers` already returned Cloudflare STUN. Remaining proof is still the real TURN relay and two-network staging acceptance.

## Current Reality Check

### Already Good Enough To Build On

- [x] Monorepo exists and includes `apps/web`, `apps/api`, `apps/extension`, and `packages/protocol`.
- [x] Extension signs in through the website and can create/connect to rooms with extension bearer auth.
- [x] Website issues short-lived room tokens for host/member connections.
- [x] Worker verifies the room token before accepting a WebSocket.
- [x] P2P signaling is targeted, not room-wide broadcast.
- [x] P2P signals include `clientSignalId`, `senderConnectionId`, optional `serverSeq`, and optional generation fields.
- [x] Worker has an in-memory bounded P2P replay buffer.
- [x] Extension tracks `lastSeenP2PServerSeq` across reconnect attempts.
- [x] Extension has direct-first ICE with Cloudflare TURN fallback.
- [x] P2P media is intentionally ultra-light: current video constraints and bitrate stay low; do not add an adaptive upscale profile.
- [x] Extension has debug export and candidate-pair logging hooks.
- [x] API deploy, extension build, CI, and staging smoke workflows exist.

### Partial Or Misleading

- [ ] Room creation is durable, but not idempotent and not lifecycle-complete.
- [ ] Room status exists, but does not have complete draft/lobby/live/stale/ended semantics.
- [~] `roomGeneration` and `sourceGeneration` are first-class room snapshot/source state in the live Worker; durable Supabase source persistence is still pending.
- [~] `ROOM_SNAPSHOT` includes generation fields, current server sequence, and the current source descriptor once the host has reported it; initial room-create source descriptor plumbing is still pending.
- [ ] `JOIN` still sends a full client-provided participant object even though the Worker derives identity from verified token claims.
- [ ] Reconnect exists, but there is no stable `participantSessionId`.
- [ ] Worker socket replacement is by user id, not by participant session.
- [x] P2P replay scope filters by the Worker-owned current room/source generation.
- [x] New extension builds use raw `ping`/`pong` keepalive with Cloudflare `setWebSocketAutoResponse`; JSON `PING`/`PONG` remains only for compatibility with old clients.
- [~] Durable Object room sockets use Cloudflare WebSocket Hibernation APIs and rebuild from attachments/storage; forced wake is covered by Workers-runtime tests, while alarm/quota behavior and staging idle acceptance are still pending.

### Not Done Yet

- [ ] First-class source switching UI/commands and durable source persistence.
- [ ] Durable shared watch progress backend.
- [x] Hibernation-safe room state rebuild core.
- [x] SQLite-backed P2P replay state in the Durable Object.
- [~] Hibernation-aware integration tests cover forced wake/replay; alarm/quota/staging idle acceptance is still pending.
- [ ] Release gates that require manual two-browser room/P2P acceptance before marking P2P work complete.

## Non-Negotiable Order

1. Baseline and progress tracking.
2. Room lifecycle and idempotent create.
3. Protocol contract: identity, generations, server sequence, source descriptor.
4. Reconnect/resume with `participantSessionId`.
5. Source generation and source switching contract.
6. Cloudflare WebSocket Hibernation migration.
7. Remaining ultra-light P2P stability work.
8. Durable watch progress.
9. Observability and release gates.

Cloudflare WebSocket Hibernation is intentionally Task 6, not Task 10. It is useful for cost and long-lived room stability, but it must not be implemented before the state that has to survive wake/rebuild is explicitly modeled.

## Product Constraints

- Keep P2P camera extremely light. Do not add a higher-quality adaptive profile as a feature goal.
- Keep remote P2P participant limit small. Current limit of 3 remote participants is acceptable until product evidence says otherwise.
- Do not proxy, host, record, or redistribute source video.
- Do not put Supabase service role keys, JWT signing secrets, TURN secrets, Google OAuth secrets, or Discord OAuth secrets in the extension.
- Do not make staging public-indexable. Staging must remain gated and noindexed.
- Do not treat room/P2P work as finished without manual staging verification on at least two browser profiles or machines.

---

## Task 0: Baseline And Progress Tracking

**Status:** In progress for documentation; product code not changed by this task.

**Files:**

- `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- `docs/superpowers/plans/README.md`
- `docs/current-development-state.md`

**Steps:**

- [x] Create this active roadmap.
- [x] Mark the old 2026-06-03 commercial plan as historical/superseded.
- [ ] Keep this roadmap updated after every future implementation PR.
- [ ] Add PR numbers and commits to the Progress Log as work lands.

**Acceptance Criteria:**

- Another AI or developer can start from this file and understand what is done, what is partial, and what must happen next.
- The old plan remains available as history, but is not the active execution source.

## Task 1: Confirm Current Staging Baseline

**Why this comes first:** We need one clean reference point before changing protocol and Durable Object behavior.

**Files:**

- `docs/development-environments.md`
- `docs/current-development-state.md`
- GitHub Actions runs for `staging`
- Latest extension staging artifact

**Steps:**

- [ ] Confirm latest `staging` commit and extension artifact hash.
- [ ] Install the latest staging extension zip on a clean browser profile.
- [ ] Sign in through Google or Discord from a clean profile.
- [ ] Create a room from the extension.
- [ ] Join from a second profile or second machine.
- [ ] Confirm video sync, P2P camera, and push-to-talk audio.
- [ ] Leave the room idle for at least 10 minutes and confirm it does not close unexpectedly.
- [ ] Reload one participant and confirm reconnect does not require manual room recreation.
- [ ] Export debug logs from both participants and attach the relevant summary to the Progress Log.

**Acceptance Criteria:**

- Current baseline bugs are documented before refactors start.
- If audio delay or room auto-close reproduces, the reproduction steps are captured before code changes.

## Task 2: Durable Room Lifecycle And Idempotent Create

**Why this matters:** Room creation currently works, but repeated clicks/reloads/new profiles can create confusing duplicate rooms or stale active rooms.

**Files:**

- `apps/web/app/api/rooms/route.ts`
- `apps/web/app/api/rooms/[roomId]/connect/route.ts`
- `apps/web/app/api/rooms/[roomId]/join/route.ts`
- `apps/web/lib/anidachi-auth/db.ts`
- `apps/web/supabase/migrations/*`
- `packages/protocol/src/types.ts`
- `apps/extension/src/room-client.ts`
- `apps/extension/src/overlay-app.tsx`

**Schema Target:**

- Add room lifecycle fields:
  - `status`: keep existing values and add any required lifecycle states deliberately.
  - `client_request_id`: idempotency key from extension/website create action.
  - `canonical_url`
  - `provider`
  - `source_descriptor` or explicit normalized columns.
  - `room_generation`
  - `source_generation`
  - `last_active_at`
  - `ended_at`
  - `stale_after`
- Add uniqueness for host + `client_request_id`.
- Add indexes for host active rooms and stale cleanup queries.

**Steps:**

- [ ] Define the exact Supabase migration.
- [ ] Add idempotent `createRoom()` behavior.
- [ ] Add `clientRequestId` from extension room creation.
- [ ] Ensure room create retry returns the same active room for the same idempotency key.
- [ ] Add stale room cleanup helper or route-level stale filtering.
- [ ] Ensure active room count excludes ended/stale rooms.
- [ ] Add tests for duplicate create, stale exclusion, and room limit behavior.

**Acceptance Criteria:**

- Double-clicking create or retrying after network failure does not create duplicate active rooms.
- A room does not count forever against the host after all participants disappear.
- Room tokens are still short-lived, but the durable room record remains valid according to lifecycle rules.

## Task 3: Protocol Contract Cleanup

**Why this must happen before Hibernation:** The Durable Object can only restore and validate state after wake if room identity, session identity, source generation, and server ordering are explicit.

**Files:**

- `packages/protocol/src/types.ts`
- `packages/protocol/test/protocol.test.ts`
- `apps/api/src/index.ts`
- `apps/api/src/room-state.ts`
- `apps/api/test/*`
- `apps/extension/src/room-client.ts`
- `apps/extension/src/overlay-app.tsx`
- `apps/extension/test/*`

**Contract Target:**

```ts
interface RoomEventEnvelope<TPayload> {
  schemaVersion: 1;
  eventId: string;
  roomId: string;
  roomGeneration: number;
  sourceGeneration: number;
  serverSeq: number;
  clientSeq?: number;
  senderUserId: string;
  senderConnectionId: string;
  participantSessionId: string;
  sentAt: number;
  serverReceivedAt: number;
  payload: TPayload;
}
```

**Practical near-term target:**

- [~] `ROOM_SNAPSHOT` includes `roomGeneration`, `sourceGeneration`, `serverSeq`, and current source descriptor when the host has reported it. Remaining: source descriptor from room create/durable DB state before first host tick.
- [x] `P2P_SIGNAL` generation fields become required after extension and Worker both send them.
- [ ] `JOIN` stops trusting a full client-provided participant object. It may send local capabilities, but identity comes from token claims.
- [ ] Every room-scoped event is rejected if top-level `roomId` does not match the Durable Object room id.
- [~] Server-generated events include enough sequence/generation data for the extension to drop stale P2P media events and reset on `SOURCE_CHANGED`. Remaining: broaden generation fencing to source/playback command events.

**Acceptance Criteria:**

- Protocol tests fail for stale/missing generation fields once migration compatibility is removed.
- Worker tests cover room-id mismatch rejection.
- Extension drops stale events based on snapshot generation, not optional P2P-only fields.

## Task 4: Reconnect, Resume, And Session Identity

**Why this matters:** Current reconnect can refresh room tokens, but it cannot cleanly distinguish a browser tab lifetime from a WebSocket lifetime.

**Files:**

- `apps/extension/src/room-client.ts`
- `apps/extension/src/overlay-app.tsx`
- `apps/api/src/index.ts`
- `apps/api/src/room-state.ts`
- `packages/protocol/src/types.ts`

**Target Identity Model:**

- `userId`: durable user identity from auth.
- `participantSessionId`: one extension overlay/tab room session.
- `connectionId`: one WebSocket connection lifetime.
- `senderConnectionId`: can become the same as `connectionId` or remain as a P2P-specific alias, but must be consistent.

**Steps:**

- [ ] Generate and persist `participantSessionId` for the current room session in the extension.
- [ ] Send `participantSessionId` during join/resume.
- [ ] Replace stale sockets by user + participant session, not only by user id.
- [ ] Use jittered backoff for reconnect.
- [ ] Resume with `lastSeenServerSeq` and `lastSeenP2PServerSeq`.
- [ ] Confirm P2P starts only after `ROOM_SNAPSHOT` is received and generation is known.
- [ ] Add tests for reconnect, duplicate sockets, stale socket close, and replay after reconnect.

**Acceptance Criteria:**

- Reloading a participant does not create ghost participants.
- Two different browser profiles for the same user are not accidentally treated as the same socket unless product intentionally forbids that.
- Reconnect after token expiry refreshes token and rejoins without manual sign-in.

## Task 5: Source Descriptor, Source Generation, And Source Switching Contract

**Why this must happen before Hibernation:** Waking a room without current source state would make replay and stale P2P filtering unreliable.

**Files:**

- `packages/protocol/src/types.ts`
- `apps/api/src/room-state.ts`
- `apps/api/src/index.ts`
- `apps/web/lib/anidachi-auth/db.ts`
- `apps/web/app/api/rooms/route.ts`
- `apps/extension/src/source-adapters/*`
- `apps/extension/src/overlay-app.tsx`
- `docs/crunchyroll-adapter-notes.md`

**Target Descriptor:**

```ts
interface WatchSourceDescriptor {
  provider: "crunchyroll" | "youtube" | "generic";
  sourceUrl: string;
  canonicalUrl: string;
  videoFingerprint: string;
  title: string;
  seriesTitle?: string;
  episodeTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  duration?: number;
  posterUrl?: string;
}
```

**Steps:**

- [x] Add protocol schema for `WatchSourceDescriptor`.
- [~] Add `SOURCE_CHANGED` server event and host-only source change client event. Implemented via host-only `HOST_STATE` carrying `source`; a dedicated source-change command/UI remains pending.
- [x] Increment `sourceGeneration` on source change.
- [~] Add source descriptor to room create response/snapshot. Implemented for live `ROOM_SNAPSHOT` after host state; room-create response and durable source fields remain pending.
- [ ] Persist normalized source fields in Supabase.
- [ ] Extension applies source changes through adapter navigation only after validating provider/fingerprint.
- [x] P2P replay only replays signals from the current room/source generation.

**Acceptance Criteria:**

- Switching episode/provider cannot replay stale P2P offer/answer/ICE from the previous source.
- `ROOM_SNAPSHOT` gives a freshly reconnected extension everything needed to know the active source.
- Source switching remains host-controlled.

## Task 6: Cloudflare WebSocket Hibernation Migration

**Why now:** Once protocol/session/source state is explicit, Hibernation should be implemented before further large realtime features. This avoids building more code on the standard WebSocket API that will be replaced.

**Files:**

- `apps/api/src/index.ts`
- `apps/api/src/room-state.ts`
- `apps/api/src/p2p-signal-buffer.ts`
- `apps/api/wrangler.toml` or `apps/api/wrangler.jsonc`
- `apps/api/test/*`
- `apps/extension/src/room-client.ts`
- `packages/protocol/src/types.ts`

**Cloudflare Requirements From Current Docs:**

- Use `state.acceptWebSocket(server)` or `ctx.acceptWebSocket(server)`, not `server.accept()`.
- Implement Durable Object methods `webSocketMessage`, `webSocketClose`, and `webSocketError`.
- Expect the constructor to run again after hibernation.
- Expect in-memory state to be reset after hibernation.
- Use `serializeAttachment()` and `deserializeAttachment()` for small per-socket connection state.
- Use `getWebSockets()` in the constructor to rebuild in-memory maps.
- Keep serialized WebSocket attachments below Cloudflare's current 16,384 byte limit (Cloudflare docs re-checked 2026-06-27).
- Use `state.setWebSocketAutoResponse()` for static app-level keepalive if browser WebSocket protocol ping frames are not available.
- Avoid frequent app-level JSON pings that wake the Durable Object.
- Use WebSocket protocol ping/pong or Cloudflare auto-response behavior where practical.
- Avoid Durable Object `setTimeout`/`setInterval` loops that prevent hibernation.

**Attachment Target:**

Store only trusted, small state:

- attachment schema version;
- room id;
- user id from verified token;
- role;
- display name;
- avatar URL;
- participant session id;
- connection id;
- joined at;
- last seen at;
- current camera status;
- sync status if needed;
- current room/source generation at join.

Do not store raw room tokens in attachments.

**Durable Storage Target:**

- room generation;
- source generation;
- current source descriptor;
- host playback state or latest small host state snapshot;
- monotonic `nextServerSeq`;
- monotonic `nextP2PServerSeq`;
- recent targeted P2P replay buffer with TTL and max count;
- dedupe keys for recent P2P signals.

**Steps:**

- [x] Introduce versioned attachment schema and validators.
- [x] Convert upgrade path to `state.acceptWebSocket(server)`.
- [x] Move message/close/error handling to hibernation handlers.
- [x] Rebuild `verifiedBySocket`, `participantsBySocket`, `socketsByParticipant`, and `RoomState` from attachments in constructor.
- [x] Deterministically close duplicate stale sockets after rebuild.
- [x] Persist P2P server sequence and replay buffer in Durable Object SQLite storage.
- [x] Keep an in-memory hot cache loaded from storage for active operation.
- [x] Replace JSON keepalive with hibernation-safe keepalive.
- [x] Keep compatibility with existing JSON `PING`/`PONG` only if it does not defeat hibernation in normal operation.
- [x] Add Workers-runtime integration tests, preferably using `@cloudflare/vitest-pool-workers`.

**Required Tests:**

- [x] Missing/invalid room token is rejected before WebSocket accept.
- [x] Existing socket can send `HOST_STATE`, `CAMERA_ON/OFF`, and `P2P_SIGNAL` after forced hibernation wake.
- [x] Constructor rebuilds participants and socket maps from attachments.
- [x] Duplicate same-session socket replacement closes the stale socket.
- [x] Host state survives forced hibernation wake and appears in `ROOM_SNAPSHOT`.
- [x] P2P `serverSeq` remains monotonic across stored state.
- [x] P2P replay honors `lastSeenP2PServerSeq`, `roomGeneration`, and `sourceGeneration`.
- [x] Raw keepalive does not go through normal JSON parsing.
- [x] Corrupt attachment is ignored or closed safely.

**Acceptance Criteria:**

- Idle connected rooms can hibernate without disconnecting clients.
- The first message after idle does not lose participants, host state, P2P sequence, or current source.
- Frequent app-level keepalive no longer wakes the object every 20 seconds in normal operation for new extension builds.

## Task 7: Ultra-Light P2P Reliability Polish

**Important product decision:** Do not add adaptive video upscaling. The value is extremely lightweight presence, not video-call quality.

**Files:**

- `apps/extension/src/p2p-media.ts`
- `apps/extension/src/overlay-app.tsx`
- `apps/extension/src/media-types.ts`
- `apps/extension/src/debug-log.ts`
- `apps/api/src/ice-servers.ts`
- `apps/api/src/index.ts`
- `packages/protocol/src/types.ts`

**Keep:**

- 240-ish square camera target.
- Low frame rate.
- Low bitrate.
- Small remote participant cap.
- Direct/STUN first and TURN fallback.
- Push-to-talk as the primary voice interaction.

**Steps:**

- [ ] Keep current low video constraints unless real staging logs prove they are too high.
- [~] Add explicit local/remote audio state machine so delayed or missing audio is diagnosable. Remote voice activity now self-corrects from WebRTC `audioInbound` stats, expected remote voice has a media-flow state (`not-expected`/`unknown`/`flowing`/`missing`/`stalled`) exposed in `getStats()`, and audio codec preferences also prefer browser-supported RED before Opus fallback. Remaining polish is richer local/remote status presentation in the overlay.
- [x] Use WebRTC `getStats()` for actual audio packet/activity state where it helps debug real failures.
- [~] Keep voice UI tied to real track/connection state, not only local button events. Active speaker state now clears/updates from inbound audio stats in addition to `voice-start`/`voice-stop`; a clearer user-facing recovery/status affordance remains.
- [x] Add ICE restart counters and reason codes to debug export.
- [x] Add an automatic lightweight recovery path when P2P media stalls without recreating the room. Manual "reconnect media" buttons are deliberately not part of the product UX; the controller detects missing/stalled expected remote video and expected remote audio from WebRTC inbound stats, treats decoded-frame movement as authoritative when available, restarts ICE with cooldown, and logs the recovery reason.
- [x] Prefer robust browser-supported codecs without SDP munging. The extension applies `setCodecPreferences()` to audio/video transceivers and logs the actual SDP codec/FEC/RTX summary for verification.
- [~] Verify relay-only diagnostic mode remains dev-only. Harness support exists and fails fast without TURN credentials from either explicit JSON or the Worker `/ice-servers` path; Worker-backed relay mode now also requires a Cloudflare-configured response with `turns:443`. Real Cloudflare TURN relay run still pending.
- [x] Cache last valid Cloudflare TURN credentials so transient credential-API failures do not degrade authenticated room media to STUN-only. Worker hot-cache covers server-side generation failures inside credential TTL; extension relay-cache covers client refresh failures before ICE restart.
- [x] Keep the local unauthenticated STUN fallback aligned with Cloudflare Realtime docs instead of Google-only STUN.
- [x] Add tests around perfect negotiation helpers, ICE restart request throttling, signal dedupe, and media-flow classification. Perfect negotiation helpers, network-triggered ICE restart, restart-throttling decisions, SDP/ICE media-signal dedupe, and decoded-frame-first remote-video health are covered by unit tests.

**Acceptance Criteria:**

- Two users can reload in either order and recover P2P without manually recreating the room.
- Audio state can be debugged from exported logs.
- P2P failures degrade gracefully and do not close the room.

## Task 8: First-Class Source Switching

**Files:**

- `apps/extension/src/source-adapters/*`
- `apps/extension/src/overlay-app.tsx`
- `packages/protocol/src/types.ts`
- `apps/api/src/index.ts`
- `apps/api/src/room-state.ts`
- `apps/web/app/room/*`
- `docs/crunchyroll-adapter-notes.md`

**Steps:**

- [ ] Add host source switch UI or internal command path.
- [ ] Host emits source change request with normalized descriptor.
- [x] Worker validates host role and increments `sourceGeneration`.
- [x] Worker broadcasts `SOURCE_CHANGED`.
- [ ] Extension navigates or prompts safely according to provider adapter.
- [ ] Reset or fence host playback state on source change.
- [x] Drop stale P2P/media signals from previous source generation.

**Acceptance Criteria:**

- Host can switch episode without forcing everyone to create a new room.
- Guests do not process stale playback/P2P messages from the previous source.

## Task 9: Durable Shared Watch Progress

**Files:**

- `apps/web/supabase/migrations/*`
- `apps/web/app/api/watch-progress/*`
- `apps/web/lib/anidachi-auth/db.ts`
- `apps/extension/src/watch-progress.ts`
- `apps/extension/src/overlay-app.tsx`
- `docs/shared-watch-progress-tracker.md`

**Steps:**

- [ ] Define durable watch session tables.
- [ ] Add per-user progress checkpoint route.
- [ ] Add room/group progress aggregation route.
- [ ] Extension emits low-frequency progress checkpoints.
- [ ] Website exposes current-user progress and shared progress.
- [ ] Add privacy and membership checks.
- [ ] Add backfill/cleanup policy.

**Acceptance Criteria:**

- Progress survives browser reload and machine switch.
- User can continue from durable progress, not only local extension storage.
- Shared progress is visible only to authorized room/group members.

## Task 10: Observability, QA, And Release Gates

**Files:**

- `.github/workflows/*`
- `docs/development-environments.md`
- `docs/extension-release-channels.md`
- `docs/current-development-state.md`
- `apps/extension/src/debug-log.ts`
- `apps/api/src/index.ts`

**Steps:**

- [ ] Add a required room/P2P manual test checklist to release docs.
- [ ] Add API logs for room lifecycle transitions.
- [ ] Add structured logs for WebSocket reconnect, hibernation rebuild, and P2P replay.
- [ ] Add staging smoke coverage for auth gate and room connect route.
- [ ] Require `pnpm check`, `pnpm test`, API tests, extension tests, and relevant web tests before merging app/API/extension changes.
- [ ] Keep docs-only and site-only auto-promotion separate from API/extension promotion.
- [ ] Document exact rollback steps for website, API Worker, and extension artifact.

**Acceptance Criteria:**

- A developer can tell whether a room failure is auth, room lifecycle, WebSocket, hibernation rebuild, signaling, ICE, media track, or UI state.
- Release promotion does not depend on guessing from a single local browser.

---

## Definition Of Done For The Whole Roadmap

- Clean sign-in and room creation works from a new browser profile.
- Two participants can join, reload, reconnect, and continue the same room.
- Room does not close after a few idle minutes.
- P2P camera and push-to-talk audio recover from reload and short disconnects.
- Durable Object can hibernate and wake without losing room state.
- Source generation prevents stale events after source switch.
- Watch progress is persisted server-side and scoped by membership.
- Staging has noindex/private gate behavior.
- GitHub Actions and manual staging checks clearly separate site/docs work from API/extension work.
