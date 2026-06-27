# Room Flow And P2P Flawless Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for implementation tasks and update this file after every completed step. Use `superpowers:systematic-debugging` for regressions. This plan is the execution program for the room/realtime/P2P goals in `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`. The roadmap stays authoritative for protocol contracts and task ordering; this plan adds measurable targets, an automated test harness, verified-bug fixes, and concrete media-engine work. When the two documents conflict on ordering or contracts, the roadmap wins unless the Progress Log here records an agreed exception.

**Goal:** Make the complete commercial flow — sign-in, room creation, invite, join, live sync, P2P camera/audio, reconnect, room end — work reliably at the level of mature realtime products, with every claim verified by metrics and automated two-browser tests instead of ad-hoc manual checks.

**Architecture:** unchanged three-plane model. `apps/web` + Supabase own durable rooms/identity, `apps/api` Durable Objects own live state and signaling, `apps/extension` owns media and overlay. Mesh P2P stays the only media topology for rooms of up to 4 people; no SFU, no simulcast, no adaptive quality.

**Created:** 2026-06-12.

**Primary external references checked on 2026-06-12:**

- Cloudflare Durable Objects WebSocket hibernation: `https://developers.cloudflare.com/durable-objects/best-practices/websockets/`
- Cloudflare compat flag `web_socket_auto_reply_to_close` (default for compat dates >= 2026-04-07; this repo uses 2026-05-23, so it is active once Hibernation lands).
- Cloudflare Realtime TURN pricing: 1,000 GB/month free (shared with SFU), then $0.05/GB: `https://developers.cloudflare.com/realtime/sfu/pricing/`
- Workers Analytics Engine (non-blocking writes, 10M writes/month free, SQL API): `https://developers.cloudflare.com/analytics/analytics-engine/`
- Chromium fake media devices for CI WebRTC tests: `https://webrtc.org/getting-started/testing`
- Playwright multiple isolated browser contexts: `https://playwright.dev/docs/browser-contexts`

---

## Service Level Objectives

Every block below is accepted only if these numbers hold (measured by the harness in Block 1 and staging telemetry):

| # | Metric | Target |
| --- | --- | --- |
| S1 | Room creation API latency | p95 < 2s |
| S2 | Time from invite click to guest seeing video (signed-in guest, extension installed) | < 60s including page loads |
| S3 | Time to first remote media (TTFM) after both peers joined | p50 < 2s, p95 < 6s (TURN included) |
| S4 | P2P pair connect success while both online | >= 99% |
| S5 | Recovery after reload or <=30s network loss | >= 99% success, < 10s to restored media |
| S6 | Push-to-talk: V keydown to audio audible at peer | p50 < 300ms (after Block 5) |
| S7 | False quota/limit blocks (free user with remaining daily minutes denied a room) | 0 |
| S8 | Ghost participants after reload | 0 |
| S9 | Room survives 2h session and 10+ min idle | yes |
| S10 | TURN relay share of connections | measured and reported (expectation 10–25%) |

**P2P acceptance matrix:** a local same-machine harness pass is necessary, but
not sufficient for product readiness. Room/P2P work can only be called ready for
real users after all four layers below are green and recorded in the Progress Log:

1. Local direct-first harness: proves negotiation, signaling, decoded media,
   reload recovery, short network-loss recovery, and push-to-talk behavior.
2. Forced relay harness: `HARNESS_FORCE_RELAY=true` with real short-lived TURN
   credentials; selected candidate pairs must be `relay`, not `host`/`srflx`.
3. Staging two-profile/two-device run on different networks: proves extension,
   web auth, Worker, Supabase, TURN, and room lifecycle together.
4. Remote-country tester run before market claim: at least one participant on a
   different ISP/region or VPN-less remote machine, with TTFM, ICE candidate
   type, disconnect/reconnect, audio, and push-to-talk recorded.

## Verified Current Reality (code audit 2026-06-12)

Confirmed working end to end: extension auth exchange/refresh (`apps/extension/src/auth-client.ts`, `apps/web/app/api/extension/auth/*`), authenticated room create (`apps/web/app/api/rooms/route.ts`), invite landing with login redirect and extension detection (`apps/web/app/room/[roomId]/page.tsx`, `extension-check.tsx`), member join + launch URL (`join/route.ts`), room token connect (`connect/route.ts`), Worker token verification + targeted P2P signaling with durable `serverSeq` replay (`apps/api/src/index.ts`, `p2p-signal-buffer.ts`, `room-persistence.ts`), raw hibernation-safe keepalive with JSON `PING/PONG` compatibility, and jittered-backoff reconnect that refreshes tokens (`apps/extension/src/room-client.ts`, `room-reconnect.ts`, `overlay-app.tsx`).

Confirmed defects:

1. **CRITICAL — rooms are immortal.** Nothing ever transitions `rooms.status` from `lobby`; `countActiveRoomsForHost` counts everything not `ended` (`apps/web/lib/anidachi-auth/db.ts`), so a `watcher`-plan user permanently hits `ROOM_LIMIT_REACHED` after their first room.
2. **CRITICAL — room create is not idempotent.** Double-click or network retry creates duplicate rooms that all count against the limit.
3. Host loss leaves an orphan room: `hostId` becomes null in `apps/api/src/room-state.ts`, nobody can control playback, no UI explains it, nothing ends the room.
4. Invite dead-ends: a room without `source_url` leaves the guest stranded on the landing page after join.
5. `GET /ice-servers` is unauthenticated (anyone can mint Cloudflare TURN credentials at project cost); CORS is `*`; legacy `/livekit/token` is still exposed.
6. As recorded in the roadmap: no `participantSessionId`. Generations, the Hibernation core, and forced wake runtime tests are implemented, but staging idle acceptance, DO alarm room end, and precise quota metering are still pending.

## Product Decisions Fixed By This Plan

Owner approved delegating these defaults (change via PR if product evidence disagrees):

- **PD1 — orphaned room:** overlay shows an explicit "Host offline" state; the room auto-ends after 4 hours with no connected participants. Host transfer is deferred to a future plan.
- **PD2 — free plan quota (owner decision 2026-06-12):** the free (`watcher`) plan gets **30 host-minutes per day** instead of an active-room-count limit. Zoom-style semantics: the quota burns only while the user's *own* room has **2 or more connected participants** (solo testing is free); joining someone else's room never burns the guest's quota, whatever their plan — paid hosts can always invite free friends. Quota resets per UTC day. At 5 remaining minutes the room receives a warning event; at 0 the room ends gracefully with an upgrade prompt. Paid plans (`nakama`, `junkie`) stay unmetered. The 4-hour `last_active_at` staleness rule remains for room lifecycle hygiene (zombie cleanup, dashboards), but is no longer the plan-limit mechanism.
- **PD3 — participant cap:** the Durable Object rejects a 5th concurrent participant with `ROOM_FULL`. Mesh P2P stays sized for 4.
- **PD4 — free-account farming resistance (owner decision 2026-06-12):** layered and observability-first, no hard IP bans. (1) OAuth-only signup via Google/Discord stays — already the strongest single barrier to mass account creation. (2) App-level rate limits on signup, extension auth exchange, and room create, keyed by IP and /24 subnet. (3) Signup/recent IPs stored only as HMAC hashes (dedicated secret, ~30-day retention) — never raw IPs. (4) A *soft* combined per-IP daily cap on free host-minutes (3x a single user's quota): one household or campus NAT is never falsely blocked, but a farm of free accounts behind one IP stops scaling. (5) Cloudflare Turnstile challenge only when a rate limit trips, not on every signup. Heavier device fingerprinting is deliberately deferred until telemetry shows real abuse.

## Non-Negotiable Rules

- Feature branches from `staging`; PRs into `staging`; never push `main`. Production promotion only after staging acceptance.
- One block = one or a few scoped PRs. No mixed mega-PRs.
- `packages/protocol` changes land before/with both consumers.
- No secrets in git. No broad store permissions. Staging stays gated/noindex.
- Keep P2P ultra-light: ~240px, 10–12fps, ~150kbps, max 4 participants, push-to-talk voice.
- Update this file's Progress Log and `docs/current-development-state.md` in the same PR when behavior or endpoints change.
- A block is done only when its acceptance criteria pass in the harness AND on staging with two real browser profiles.

## Development-Flow Gate Before Block 6

Before starting remaining Block 6 implementation, use the development quality
system from
`docs/superpowers/plans/2026-06-17-development-flow-quality-system-plan.md`.
Minimum startup for the next room/P2P PR:

- read `AGENTS.md`, `docs/current-development-state.md`, this plan, and the
  hardening roadmap;
- run `pnpm dev:check -- --profile rooms` and record the selected checks in the
  PR;
- keep `graphify-out/` local if Graphify is used, and update only curated docs;
- use the PR template's room/P2P section, staging acceptance section, and
  rollback section;
- let CodeRabbit review the PR with the Anidachi-specific path instructions.

---

## Block 1 — Measurement Foundation And Two-Browser Harness

**Why first:** "flawless" is unverifiable without numbers; every later block is judged against this baseline.

**Files:** `scripts/p2p-scorecard.mjs` (new), `apps/api/src/index.ts` (Analytics Engine binding), `apps/api/wrangler.toml`, `tests/e2e/` (new Playwright workspace), `.github/workflows/e2e-rooms.yml` (new), `docs/development-environments.md`.

**Steps:**

- [x] 1.1 Scorecard merged (PR #28): `scripts/p2p-scorecard.mjs` parses debug exports → TTFM, candidate types, ICE restarts, reconnects, signal/dedupe stats; verified on a synthetic export.
- [x] 1.2 Worker telemetry via Analytics Engine: `apps/api/src/telemetry.ts` (FNV-hashed room id, env/name/role blobs, no IPs/names, best-effort non-throwing). Wired into the DO for `ws_open`, `ws_close`, `ws_token_reject`, `join`, `p2p_signal`, `p2p_replay` (`room_full` reserved for Block 6.4). Bindings in `wrangler.toml` per env (`anidachi_room_events_staging/production`) + `ANIDACHI_ENV` var. Verified: api typecheck + 23 tests (6 new), staging dry-run shows the binding resolved. Datasets auto-create on first write; query via the Analytics Engine SQL API once traffic flows.
- [ ] 1.3 Manual staging baseline (roadmap Task 1): two profiles + two devices on different networks; record results (including known audio-delay and room-close reports) in Progress Log before any behavior change. This baseline must not be replaced by same-machine harness results.
- [x] 1.4 Signaling harness shipped: `scripts/room-signaling-harness.mjs` boots the real Worker via `wrangler dev --local` (workerd + real Durable Object) and drives it with multiple WebSocket clients + node:crypto-signed room tokens (dependency-free). 11/11 scenarios green locally. This is the WebRTC-free layer of the two-browser harness.
- [x] 1.5 Real-WebRTC two-browser harness shipped: `tests/e2e/p2p-media-harness.mjs` bundles the *actual* `P2PMediaController` + `RoomClient` (esbuild) into a page, boots the real Worker (`wrangler dev`), and drives two Chromium contexts with a fake camera. Asserts both peers receive **decoded** video with TTFM via `getStats` (S3/S4) and that reload/short-network-loss recovery restores media without recreating the room (S5). The harness also has an explicit relay diagnostic mode (`HARNESS_FORCE_RELAY=true`) that compiles the real media engine with `iceTransportPolicy: "relay"` and asserts that selected candidate pairs use relay candidates. Relay mode can use explicit `HARNESS_ICE_SERVERS_JSON` or fetch short-lived TURN servers through the Worker `/ice-servers` path with `HARNESS_USE_WORKER_ICE_SERVERS=true`. Default direct-first runs still usually select `host/host` on one machine, so relay mode and staging multi-network acceptance are required before claiming real-world network coverage. Signaling-layer coverage (token reject, join/snapshot, relay+serverSeq, replay, ghost, keepalive, cap, takeover, clean-leave, ICE-auth) lives in `scripts/room-signaling-harness.mjs`.
- [x] 1.5-CI `.github/workflows/e2e-p2p-media.yml` runs the real-WebRTC harness on PRs touching p2p-media/room-client/p2p-ice/api/protocol/tests (installs Playwright Chromium; non-required initially).
- [x] 1.6 CI workflow `.github/workflows/e2e-rooms.yml` runs `pnpm harness:rooms` on PRs touching api/protocol/harness (Node 22, non-required initially per plan).

**Acceptance:** harness runs locally and in CI; baseline SLO numbers recorded in Progress Log; scorecard committed and documented.

## Block 2 — Room Lifecycle And Idempotent Create (roadmap Task 2)

**Why hotfix priority:** defects 1–2 block commercial use for free-plan users.

**Files:** `apps/web/supabase/migrations/2026xxxx_room_lifecycle.sql` (new), `apps/web/lib/anidachi-auth/db.ts`, `apps/web/app/api/rooms/route.ts`, `apps/web/app/api/rooms/[roomId]/connect/route.ts`, `apps/web/app/api/rooms/[roomId]/end/route.ts` (new), `apps/extension/src/room-client.ts`, `apps/extension/src/overlay-app.tsx`, `packages/protocol` (only if event shapes change), web/api tests.

**Steps:**

- [x] 2.1 Migration applied + verified on staging: `client_request_id`, `last_active_at`, `ended_at`, `host_connected_at`; partial unique index `uniq_rooms_host_client_request`; `(host_user_id, status, last_active_at)` index; `usage_daily` table + `increment_host_usage` RPC.
- [x] 2.2 Idempotent create: per-click `clientRequestId` from the extension; conflict returns the existing non-ended room (`reused=true`). Verified 14/14 on staging.
- [x] 2.3 Lifecycle transitions: `/connect` bumps `last_active_at` and promotes `lobby -> live` on first host connect; old active-room-count limit removed. Verified on staging.
- [x] 2.4 `POST /api/rooms/:roomId/end` (host only) sets `ended`/`ended_at`, settles the segment, idempotent; ended rooms 404 on connect; overlay has a host "End room" control. Verified on staging.
- [x] 2.5 PD2 quota v1 (web-side): create and `/connect` return `QUOTA_EXHAUSTED` + `resetAt` at zero quota; free-host tokens capped to remaining quota. Verified on staging.
- [~] 2.6 Quota UX: overlay shows remaining free minutes and a graceful exhausted message with reset time. REMAINING: distinct <=5-minute warning state and explicit upgrade-prompt CTA (final cut still enforced by Block 6 DO alarm).
- [~] 2.7 Tests: done — quota math across UTC day boundary, blocked-at-0 with reset time, solo-host-never-meters, end-room + idempotency, idempotent create (unit + staging). REMAINING: parallel-create race and an explicit guest-join-never-meters unit test (guest path covered indirectly; lands with the Block 1 harness).

**Acceptance:** S7 = 0 in tests; free host can create rooms every day (quota resets); double-click creates one room; paid plans unmetered; harness scenarios "create twice, join once" and "quota exhausted" green.

## Block 3 — Invite Flow Without Dead Ends

**Files:** `apps/web/app/room/[roomId]/page.tsx`, `apps/web/app/api/rooms/[roomId]/join/route.ts`, `apps/web/app/room/[roomId]/extension-check.tsx`, harness scenarios.

**Steps:**

- [x] 3.1 Room without `source_url`: joined guests now get a "Waiting for host" state (`waiting-refresh.tsx` polls via `router.refresh()` while visible) that auto-upgrades to "Open watchroom" once a source URL appears — no silent dead end.
- [x] 3.2 Returning member / source present: landing detects membership and shows an "Open watchroom" CTA (the join POST is idempotent and redirects to the launch URL), with a note that it relaunches the video tab.
- [x] 3.3 Ended (or missing) room: friendly "This watchroom has ended" page with a back-to-AniDachi action instead of a bare 404; the join route redirects browser posts to that page (JSON callers still get 404).
- [~] 3.4 Harness: full invite e2e (host creates → guest landing → join → launch → video both ways, S2) is the Playwright browser slice, tracked with 1.5. Web typecheck green; web tests 21/21.

**Acceptance:** no guest path terminates without a next action; S2 met in harness.

## Block 4 — Sessions, Reconnect Identity, Tab Lifecycle (roadmap Tasks 3–4)

Implements the roadmap contract exactly; protocol shapes follow the roadmap's Task 3 target. Additions on top:

- [x] 4.1 `participantSessionId` generated per overlay room session, persisted in `sessionStorage`, sent on JOIN/resume; Worker tracks session id per socket and distinguishes a same-session reconnect (silent 4000 replace) from a different-session takeover (displaced socket gets `ERROR SESSION_TAKEN_OVER` + close 4002 + `session_taken_over` telemetry). The extension treats `SESSION_TAKEN_OVER` as terminal (suppress reconnect, teardown, message) — this also kills the two-tab reconnect ping-pong. Owner decision 2026-06-13: one active session. Verified: protocol/api/extension typecheck, api 24 tests, harness 17/17 (takeover vs silent same-session reconnect both asserted).
- [~] 4.2 `ROOM_SNAPSHOT` carries `roomGeneration`, `sourceGeneration`, `serverSeq`, and the current live source descriptor when known; client drops stale P2P/media events by generation; P2P controller starts only after snapshot. Implemented across `codex/p2p-production-hardening` and `codex/p2p-source-generation`, verified locally. Remaining: broaden generation fencing to source/playback commands beyond P2P media.
- [x] 4.3 Multi-tab guard: `apps/extension/src/room-tab-lock.ts` holds an exclusive Web Lock (`anidachi-room-session`) for the room session. The first tab owns it; a second tab in the same profile is blocked before connecting and shown "already open in another tab" (first-wins locally). A reconnect of the owning tab re-acquires instantly; the lock releases on End room, sign-out, terminal ROOM_FULL/SESSION_TAKEN_OVER, and unmount. Degrades to allowing when Web Locks are unavailable. The 4.1 server takeover still covers cross-device (last-wins) where Web Locks can't reach. Verified: 4 unit tests (mock LockManager) + extension typecheck.
- [x] 4.4 Page lifecycle: `pagehide` closes the room socket so the Worker drops the participant promptly (deterministic leave — no ghost until keepalive timeout); `pageshow` with `event.persisted` reconnects after a back/forward-cache restore (the stable `participantSessionId` makes it a same-session resume). The protocol has no separate LEAVE event — the WS close is the leave signal, so closing the socket is the polite bye. Verified: harness asserts a clean close broadcasts `PARTICIPANT_LEFT` and removes the participant from the snapshot (19/19); the DOM lifecycle wiring itself is browser-only (covered by typecheck + the Playwright slice). SPA/full-nav teardown already handled by content-script remount; not separately needed here.
- [ ] 4.5 Tests: reload either side without ghosts (S8), duplicate-socket replacement, resume replays only missed signals, two tabs same room, token-expiry reconnect (>30 min session). — signaling-level coverage now lives in the harness (S5/S8, takeover, clean leave); the browser-level reload/two-tab/token-expiry checks ride with the Playwright slice (1.5).

**Acceptance:** roadmap Task 3/4 acceptance criteria + S5/S8 green in harness.

## Block 5 — P2P Media Engine Polish (roadmap Task 7, client-only)

**Parallelization note:** files here (`apps/extension/src/p2p-media.ts`, `ghost-cam.ts`, `media-types.ts`, `overlay-app.tsx` media sections) do not overlap Blocks 2–4 server work; may run in parallel by agreement recorded in the Progress Log.

**Steps:**

- [x] 5.1 Push-to-talk without renegotiation: already in place — the audio transceiver is created `sendrecv` once (`P2P_AUDIO_TRANSCEIVER_DIRECTION`) and voice toggles via `replaceTrack`, so a press no longer flips direction / renegotiates. Confirmed by the real-WebRTC harness (audio reaches the peer with no offer/answer round-trip on press).
- [x] 5.2 Microphone caching: the mic track is now kept warm between presses (`track.enabled` toggled instead of stopping the stream + replaceTrack), released after a 60s idle timeout for privacy and on disconnect. Repeat push-to-talk no longer pays the `getUserMedia` spin-up. Measured in the harness: repeat press **459ms → 226ms** (under the S6 <300ms target); first/cold press unchanged (~520ms, unavoidable getUserMedia). On real hardware the win is larger (real mic spin-up is hundreds of ms). Added `audioInbound`/`audioOutbound` to `getStats` for the measurement + future health monitor.
- [x] 5.3 Reconciliation loop: a 5s timer (`reconcile()`) restarts ICE for down peers and otherwise re-runs the idempotent `syncPeerMediaAndNegotiate` (renegotiates only on real drift), so a lost renegotiate/signal self-heals instead of leaving a peer stuck. `recoverDisconnectedPeers` now delegates to `reconcile`. Pure decision extracted as `reconcilePeerAction(connectionState, iceConnectionState)` and unit-tested. Verified no steady-state churn: the real-WebRTC harness stays 7/7 with the loop running the whole session (push-to-talk repeat 220ms, reload recovery intact). Follow-up: an explicit dropped-signal harness scenario once signal interception is added.
- [x] 5.4 Peer health monitor: the 5s loop samples `getStats` and classifies each peer good/degraded/recovering via the pure `classifyPeerHealth(connectionState, rtt)` (recovering = not connected; degraded = connected but RTT > 0.4s; good otherwise). Health is exposed per peer in `getStats` and transitions are logged (`p2p.health`) for the scorecard/telemetry (feeds S10). Verified: unit tests + harness asserts a live connection classifies "good" (8/8). REMAINING (cosmetic, needs visual check): the subtle bubble indicator in the overlay — thin follow-up consuming the exposed health.
- [x] 5.5 Device edge cases: `degradationPreference: "maintain-framerate"` on the video sender (Ghost Cam is low-fps motion presence — keep frame rate, drop resolution under pressure); a `devicechange` listener re-acquires the camera when the current track is dead (unplug / camera switch / Bluetooth handoff), guarded so a spurious event never churns a healthy camera; listener removed on disconnect. The mic already re-acquires a dead warm track on the next press (5.2), and the camera already re-acquires on `track.ended`. Verified: extension typecheck + tests; real-WebRTC harness 8/8 (no regression with the listener active). OS sleep/wake recovery is covered by the reconcile loop (5.3) + bfcache reconnect (4.4).
- [x] 5.6 Unit tests for negotiation/role helpers, reconciliation decision, audio-swap, stats-backed remote audio activity, ICE restart throttling, SDP/ICE signal dedupe, and health classification (`p2p-media.test.ts`); the real-WebRTC harness asserts S3 (TTFM both ways) and S6 (push-to-talk), the signaling harness covers S5/S8 + relay/replay/cap/takeover.
- [x] 5.7 Remote voice activity is now corrected from real WebRTC inbound audio stats, not only `voice-start`/`voice-stop`: the controller samples `audioInbound` bytes/packets/audioLevel, publishes active-speaker changes when actual media arrives, clears stale voice state after quiet samples, exposes `remoteAudioActivity` from `getStats()`, and cleans state on track end/peer close/disconnect. Verified: extension check/test and real-WebRTC harness 11/11.
- [x] 5.8 Automatic media-stall recovery: no user-facing reconnect button. `P2PMediaController` now samples inbound remote-video stats, treats expected connected video with missing/stalled frames/bytes as a media stall after two health samples, and triggers throttled ICE recovery with debug reason `media-stall:*`. Remote-video expectation follows participant camera state so chat-only or camera-off peers do not churn recovery.
- [x] 5.9 Codec preference layer: before offer/answer creation, audio/video transceivers apply browser-native `setCodecPreferences()` from current WebRTC capabilities. Audio prefers supported RED first, then Opus fallback; video keeps lightweight stable codecs first while preserving RTX/FEC repair codecs when exposed by the browser. This deliberately avoids SDP munging. Verified: extension check/test (171 tests).
- [x] 5.10 Automatic remote-audio stall recovery: when a remote participant has sent `voice-start`, the controller expects inbound audio flow and classifies it from WebRTC `audioInbound` stats as `not-expected`, `unknown`, `flowing`, `missing`, or `stalled`. Two consecutive missing/stalled samples on a connected peer trigger throttled ICE recovery with a `media-stall:audio-*` reason. This keeps recovery automatic and invisible to the user. Verified: extension check/test (177 tests), room-signaling harness 35/35, and real-WebRTC harness 11/11.

**Acceptance:** S3, S6 green; both-order reload recovery without room recreation; audio failures diagnosable from exported logs (explicit audio state machine).

## Block 6 — Source Switching, Hibernation, Room-End Alarms (roadmap Tasks 5–6)

Follow the roadmap's task lists verbatim; additions:

- [~] 6.1 (Task 5) `WatchSourceDescriptor` + `SOURCE_CHANGED` + live `sourceGeneration` bump are implemented in protocol/API/extension for host-state source changes; P2P replay is scoped by current room/source generation; clients reset stale P2P queues on source change. Verified locally by protocol/API/extension checks, room-signaling harness 34/34, and real-WebRTC harness 8/8. Remaining: Supabase-persisted normalized source fields, room-create source response plumbing, and first-class source-change UI/commands beyond implicit host state.
- [~] 6.2 (Task 6) Hibernation migration per roadmap: `acceptWebSocket`, `webSocketMessage/Close/Error`, versioned attachments under Cloudflare's current 16,384-byte serialized attachment limit, rebuild from `getWebSockets()`, SQLite-backed room snapshot + `serverSeq` replay buffer, and `setWebSocketAutoResponse` for raw `ping`/`pong` are implemented. A Workers-runtime forced wake test now covers existing sockets, host state/source snapshots, raw keepalive, monotonic P2P seq, and replay after hibernation. Note: `web_socket_auto_reply_to_close` is already active via compat date — rely on clean CLOSED transitions. Remaining: staging idle-session acceptance.
- [ ] 6.3 DO Alarm room end (PD1): when the last participant disconnects, set an alarm for +4h; on fire with the room still empty, call a server-to-server web endpoint (`POST /api/internal/rooms/:roomId/ended`, authenticated by a dedicated shared secret/Worker service binding — never the user JWT secret) to set `ended`. Cancels on rejoin.
- [x] 6.4 (PD3) DO join enforces `MAX_ROOM_PARTICIPANTS = 4` via `RoomState.canAdmit` (checked before stale-socket replacement, so reconnecting members are never falsely rejected); the 5th distinct user gets an `ERROR ROOM_FULL` + close 4003 and a `room_full` telemetry event. The overlay treats `ROOM_FULL` as terminal: suppresses reconnect, tears down room state, and shows the message. Pulled forward from Block 6 (independent of Hibernation). Verified: room-state unit test + harness scenario (4 admitted, 5th rejected with 4003, existing member reconnect still admitted) — harness 14/14.
- [~] 6.5 `@cloudflare/vitest-pool-workers` integration tests: forced wake/rebuild keeps participants, host state, source snapshot, raw keepalive, and monotonic P2P replay. Remaining: alarm ends empty room, full-room rejection in Workers runtime, and any quota-metering runtime cases from the roadmap Task 6 list.
- [ ] 6.6 PD2 precise quota metering: the DO tracks host-room active seconds (>=2 connected participants) hibernation-safely (timestamps in attachments/SQLite, not timers), reports usage server-to-server to the web internal endpoint on disconnect/alarm/threshold, and enforces the final cutoff: warning event at 5 remaining minutes, graceful room end + upgrade prompt at 0. Replaces the Block 2 token-expiry approximation.

**Acceptance:** roadmap Task 5/6 acceptance + idle rooms hibernate without disconnecting clients (S9) + empty rooms end themselves (closes defect 3 with PD1) + quota metering accurate to <=1 minute drift in harness.

## Block 7 — Network, Security, Cost Guardrails

- [x] 7.1 `GET /ice-servers` requires `roomToken` + `roomId` and verifies them with `verifyRoomToken` (closes defect 5 — no anonymous minting of Cloudflare TURN credentials). The extension threads the current room token/id from `useGhostCam` → `loadP2PIceServers`/`refreshP2PIceServers` (read from a ref so token rotation doesn't churn the P2P connect). Backward compatible: an old extension (no token) gets 401 and falls back to default STUN — graceful, not a hard break. Verified: harness asserts no-token→401, valid-token→200 with iceServers, wrong-room→401; api/extension typecheck.
- [ ] 7.2 Remove legacy `/livekit/token` (LiveKit stays historical per project docs); tighten CORS to channel web origins + extension origin.
- [~] 7.3 Verify `turns:443` is present in returned ICE servers (restrictive-network fallback); confirm relay-only diagnostic mode stays dev-only. The local WebRTC harness now supports a relay-only diagnostic run with explicit TURN credentials or the Worker-backed `/ice-servers` path and asserts relay candidate-pair selection. Worker `/ice-servers` exposes safe relay diagnostics and fails closed if configured Cloudflare credentials return no browser-usable TURN URL after filtering; Worker-backed relay mode requires `provider=cloudflare`, `configured=true`, and `turns:443`. Remaining: run it against real short-lived Cloudflare TURN credentials and record staging/multi-network results.
- [x] 7.4 Proactive `restartIce` on network change (`online` +
  `navigator.connection` change listener) in addition to existing state-based
  restarts. Verified by the real-WebRTC harness: a short Playwright
  offline/online transition triggers a throttled ICE restart and restores
  decoded video both directions without recreating the room.
- [ ] 7.5 Cost guardrails: Analytics Engine alert query for abnormal TURN/signal volume; document budget math (TURN free tier 1TB/month; ~150kbps relay leg ≈ 67MB/hour).
- [ ] 7.6 Document (do not build) a future relay-only privacy mode: P2P exposes peer IPs; acceptable for friends-rooms, revisit for public rooms.
- [ ] 7.7 PD4 anti-farming layer 1: app-level rate limits (small KV/Upstash-style counter) on signup/OAuth callback, extension auth exchange, and room create, keyed by IP and /24 subnet; generous limits, log-before-block rollout (observe a week, then enforce).
- [ ] 7.8 PD4 layer 2: store HMAC-hashed signup/recent IPs (dedicated `ANIDACHI_IP_HASH_SECRET`, ~30-day retention) on `users`; soft combined per-IP daily free host-minutes cap = 3x single quota; exceeding it returns the same `QUOTA_EXHAUSTED` shape with a distinct internal reason code for telemetry.
- [ ] 7.9 PD4 layer 3: Cloudflare Turnstile only on rate-limit trip (invisible mode); abuse dashboard query in Analytics Engine (accounts/IP-hash/day, free minutes/IP-hash/day) so heavier measures are built only on evidence.

**Acceptance:** unauthorized `/ice-servers` request returns 401 in staging; CORS verified; cost dashboard query saved; rate limits and per-IP soft cap covered by tests (shared-NAT false-positive test included: 3 distinct users behind one IP all get full quota).

## Block 8 — Release Gates And Rollback

- [ ] 8.1 Staging acceptance = harness run against staging endpoints + the manual checklist in `docs/development-environments.md`; both required before `staging -> main` promotion of room/P2P work.
- [ ] 8.2 Per-PR gate: scorecard metrics not worse than baseline (attach to PR description).
- [ ] 8.3 Documented rollback: Vercel rollback, `wrangler rollback`/redeploy previous, previous extension zip re-upload; one-page runbook in `docs/`.
- [ ] 8.4 Update `docs/current-development-state.md` Known Fragile Areas as items genuinely harden.

## Execution Order

```
Week 1   Block 1 (1.1–1.3 baseline)  +  Block 2 (hotfix PR)            [parallel]
Week 2   Block 1 (1.4–1.6 harness)   +  Block 3 (invite)               [parallel]
Weeks 3–4 Block 4 (sessions/contract) ∥ Block 5 (media, client-only)
Weeks 5–6 Block 6 (source switching → hibernation + alarms)
Week 7   Block 7 (network/security)  +  Block 8 (gates), full staging acceptance
```

Rules: Block 6 never starts before Block 4 is merged (roadmap order). Block 5 parallelism is allowed only while it touches no protocol/API files. Any deviation is recorded in the Progress Log.

## Definition Of Done (whole plan)

- All SLOs S1–S10 met on staging, measured, recorded.
- Clean profile → sign in → create → invite → join → watch → reload → continue → end room: zero dead ends, zero ghosts, zero false limits.
- Empty rooms end themselves; the free-plan daily quota meters only real host time and never falsely blocks; account farming does not scale behind one IP while shared-NAT users are unaffected.
- DO hibernates on idle without dropping rooms; keepalive does not wake it.
- P2P recovers from reload/network loss in either order without recreating the room.
- Harness green in CI and required for `staging` merges of room/P2P paths.
- Roadmap Progress Log and `current-development-state.md` reflect reality.

## Progress Log

- [x] 2026-06-12: Full end-to-end code audit of auth/room/invite/connect/reconnect flow in this monorepo; defects 1–6 verified against source (see Verified Current Reality). External references re-checked. Plan created. No product code changed yet.
- [x] 2026-06-12: Owner set the free-plan business model: 30 free host-minutes per day plus resistance to free-account farming. Replaced the active-room-count limit with the PD2 quota model (Zoom-style host metering, guests always free), added PD4 layered anti-farming, extended Blocks 2/6/7 accordingly (usage_daily metering, DO-precise cutoff in 6.6, rate limits + hashed-IP soft caps in 7.7–7.9). Still docs-only.
- [ ] 2026-06-13: Block 2 PR-1 (web side) merged via PR #27: migration `20260612_room_lifecycle_quota.sql` (lifecycle columns, partial unique idempotency index, `usage_daily` + `increment_host_usage`), pure quota math in `apps/web/lib/room-quota.ts` (12 node:test cases), orchestration in `lib/anidachi-auth/room-usage.ts`, idempotent `createRoom`, quota-aware create/connect with capped host token TTL, `lobby -> live` promotion, new host-only `POST /api/rooms/:roomId/end`, `last_active_at` bumps on connect/join. Verified: `pnpm check` and `pnpm test` green (33 web tests).
- [x] 2026-06-13: Supabase migration applied to project `cyppqpprkygjloyfvvvj` via session pooler with before/after schema verification (4 new room columns, `usage_daily`, `increment_host_usage`, idempotency index all present; 23 existing rooms untouched). Re-run confirmed idempotent.
- [ ] 2026-06-13: Block 1.1 scorecard merged via PR #28: `scripts/p2p-scorecard.mjs` + usage docs; verified against a synthetic export. Block 2 PR-2 (extension) on `codex/extension-quota-ux` (PR #29): per-click `clientRequestId` idempotency key, structured `RoomApiError` across the background bridge, `QUOTA_EXHAUSTED` message with local reset time, remaining-minutes quota note in the panel, host-only "End room" button (settles quota, clears room state/hash/persisted id). Verified: extension typecheck green, 14/14 room-client tests (5 new). Known pre-existing local failure: `debug-log.test.ts` under Node 26 (CI Node 22 green) — tracked separately. Staging acceptance for all of Block 2 still pending.
- [x] 2026-06-13: Block 2 staging acceptance PASSED 14/14 against the live `staging.anidachi.app` deployment (owner-authorized, disposable test user, full cleanup verified — 0 users/rooms left). Covered: fresh-quota create (1800s summary), idempotent retry (`reused=true`, same room), no false limits (S7), `lobby -> live` + host segment on connect, host End room + idempotent end + ended-room connect 404, `QUOTA_EXHAUSTED` with `resetAt` on both create and connect at zero quota, `usage_daily` persistence. Block 2 acceptance criteria met; checkboxes 2.1–2.7 satisfied on staging. Production promotion is a separate gated step.
- [ ] 2026-06-13: First Block 2 acceptance attempt was 11/14 — create with 30-min quota summary, idempotent retry returns the same room (`reused=true`), no false limits (S7), `lobby -> live` + host segment on connect, `QUOTA_EXHAUSTED` with `resetAt` on create and connect at zero quota, `usage_daily` persisted. The 3 failures were all `POST /api/rooms/:id/end` blocked with 401 by the staging gate's bearer-path allowlist — fixed in this PR. Re-run to 14/14 pending after merge. Note: the stable preview alias from `development-environments.md` (`git-3b9ab6`) serves a stale pre-Block-2 deployment; current staging is the `git-staging` branch alias — docs follow-up needed.
- [ ] 2026-06-15: Live-test bug fixes on `codex/fix-live-test-bugs` (extension-only). (1) Invite-login pickup: the content script never runs on the website, so a guest who signed in there (cookie session) and was redirected to the video page showed signed-out in the overlay until a manual "Sign in"/reload. Added a non-interactive `launchWebAuthFlow` pass (`sign-in-silent` in `auth-client.ts`, `trySilentSignIn` in `user-identity.ts`) attempted on overlay mount — reuses the existing one-time-code flow, so an existing website session is adopted with no UI and the pending invite auto-joins. (2) Quota timer: was a static snapshot that only refreshed on reconnect, and at expiry the room token lapsed into a `QUOTA_EXHAUSTED` reconnect loop that jittered the panel. Now ticks down once/second while actually metering (host + ≥1 guest, mirroring `room-quota.ts`), re-anchors on each server snapshot, displays m:ss; metered host ends gracefully at zero via a shared `terminateRoomSession()` (also reused for `ROOM_FULL`/`SESSION_TAKEN_OVER`); `QUOTA_EXHAUSTED` is terminal on auto-reconnect and initial invite join (stale room pointer dropped). (3) Slow re-mount: content script runs at `document_start` before any `<video>` and otherwise re-checked only every 1.5s, so the overlay + ghost-cam bubbles lagged on reload/episode-switch. Added a `MutationObserver` that mounts/swaps the instant a `<video>` is inserted/replaced (1.5s poll kept as safety net; scan skipped when a check is already queued). Verified: `pnpm check` green across all 5 packages; extension vitest 101 pass (only the documented Node-26-local `debug-log.test.ts` failure). Staging build + live retest pending owner.
- [x] 2026-06-27: Block 6.1 live source-generation slice on branch `codex/p2p-source-generation`: protocol now has `WatchSourceDescriptor` and `SOURCE_CHANGED`; `HOST_STATE` may carry the current source descriptor; Worker stores the current source, increments `sourceGeneration` when the host fingerprint changes, broadcasts `SOURCE_CHANGED`, and scopes P2P replay to the current room/source generation; extension resets stale P2P queues on `SOURCE_CHANGED` and sends cleaned source descriptors without `anidachiRoom` URL hash noise. Verified: `pnpm --filter @anidachi/protocol check`, `pnpm --filter @anidachi/protocol test`, `pnpm --filter @anidachi/api check`, `pnpm --filter @anidachi/api test`, `pnpm --filter @anidachi/extension check`, `pnpm --filter @anidachi/extension test`, `pnpm harness:rooms` (34/34), `npm --prefix tests/e2e run harness:p2p` (8/8), `pnpm build:extension:staging`, `pnpm validate:extension:staging`. Remaining: staging two-profile acceptance, persisted source metadata in Supabase, and Hibernation migration.
- [x] 2026-06-27: Block 6.2 Hibernation core slice on branch `codex/p2p-hibernation-core`: Worker room sockets now use Cloudflare WebSocket Hibernation, versioned attachments, constructor rebuild from `getWebSockets()`, SQLite-backed room snapshot + P2P replay/sequence storage, stale-socket close protection, and raw `ping`/`pong` auto-response keepalive with JSON `PING` compatibility. Verified: `pnpm --filter @anidachi/protocol check`, `pnpm --filter @anidachi/protocol test`, `pnpm --filter @anidachi/api check`, `pnpm --filter @anidachi/api test`, `pnpm --filter @anidachi/extension check`, `pnpm --filter @anidachi/extension test`, `pnpm dev:check -- --profile rooms`, `pnpm harness:rooms` twice in a row (35/35 + 35/35), and `npm --prefix tests/e2e run harness:p2p` (8/8). Remaining: forced hibernation wake tests, staging two-profile idle acceptance, DO alarm room end, and precise quota metering.
- [x] 2026-06-27: Block 6.2 forced hibernation runtime test on branch `codex/p2p-product-hardening-next`: added `@cloudflare/vitest-pool-workers` and a Workers runtime test that forces Durable Object WebSocket hibernation with `evictDurableObject(..., { webSockets: "hibernate" })`, then verifies raw keepalive, post-wake `HOST_STATE`, `CAMERA_ON/OFF`, P2P signaling, persisted host state/source snapshots, monotonic P2P `serverSeq`, and replay after a second forced wake. Wired `pnpm --filter @anidachi/api test:runtime` into `dev-check`, CI, Deploy API, and E2E Rooms. Verified locally with `pnpm check`, `pnpm test`, `pnpm --filter @anidachi/api test:runtime`, `pnpm harness:rooms` (35/35), and `npm --prefix tests/e2e run harness:p2p` (8/8).
- [x] 2026-06-27: Block 7.4 proactive network recovery on branch `codex/p2p-product-hardening-followup`: `P2PMediaController` now listens for `online`, `offline`, and Network Information `change` signals, logs network context, skips churn while offline, and proactively restarts ICE for every live peer when the browser comes back online or the network route changes. The real-WebRTC harness now stores/replays `lastSeenP2PServerSeq`, reconnects the RoomClient on online recovery, uses Playwright `BrowserContext.setOffline(true/false)` for a short guest network loss, and asserts ICE restart plus decoded video recovery in both directions. The harness also has a relay-only mode (`HARNESS_FORCE_RELAY=true`) for real TURN validation; it can use explicit `HARNESS_ICE_SERVERS_JSON` or fetch short-lived TURN servers through the Worker `/ice-servers` path with `HARNESS_USE_WORKER_ICE_SERVERS=true`. Without a successful relay run, direct-first local runs still prove only host/host behavior. Verified: `pnpm --filter @anidachi/extension check`, `pnpm --filter @anidachi/extension test`, `npm --prefix tests/e2e run harness:p2p` (11/11), `pnpm check`, `pnpm test`, `pnpm --filter @anidachi/api test:runtime`, `pnpm harness:rooms` (35/35), `pnpm build:extension:staging`, and `pnpm validate:extension:staging`.
- [~] 2026-06-27: Tightened the relay-only harness after reviewing current Cloudflare Realtime TURN and MDN WebRTC docs: `HARNESS_FORCE_RELAY=true HARNESS_USE_WORKER_ICE_SERVERS=true` now fetches ICE servers from the local Worker `/ice-servers` route with a valid room token and fails unless selected WebRTC candidate pairs are relay candidates. Local attempt correctly failed before browser launch because the Worker returned `provider=fallback configured=false` (`stun=2 turn=0 turns=0`), proving local Cloudflare TURN secrets are not currently available in the harness environment. Remaining: run the same command with real local/staging TURN bindings and then complete two-network/two-profile staging acceptance.
- [x] 2026-06-27: Added stats-backed remote voice activity on branch `codex/p2p-product-hardening-followup`: `P2PMediaController` now samples inbound WebRTC audio bytes/packets/audioLevel, exposes `remoteAudioActivity` in `getStats()`, uses stats to publish/clear active-speaker state in addition to `voice-start`/`voice-stop`, and clears audio state on track end/peer close/disconnect. This makes delayed/missing/stuck voice diagnosable from real media flow rather than only local button events. Verified: extension check/test (155 tests) and real-WebRTC harness 11/11.
- [x] 2026-06-27: Applied actionable lessons from the Teleparty A/V teardown: no topology rewrite for MVP mesh, but debug SDP summaries now expose negotiated codec/FEC/RTX signals (`opus useinbandfec`, audio RED, video RTX/ULPFEC/FlexFEC, codec list), and ICE restart behavior has an explicit pure throttling decision with unit coverage so network-change storms cannot silently spam restarts. Verified: extension check/test (159 tests). Remaining: real TURN/multi-network acceptance.
- [x] 2026-06-27: Added controller-level media signal dedupe on branch `codex/p2p-product-hardening-followup`: exact duplicate `offer`/`answer` SDP and ICE candidates are fingerprinted per sender with TTL/cap bounds and dropped before touching `RTCPeerConnection`, while voice/control signals are still processed normally. This complements Worker/source-generation replay fencing and protects future delivery paths from duplicate SDP/ICE application. Verified: `pnpm --filter @anidachi/extension check` and `pnpm --filter @anidachi/extension test` (164 tests). Still not a market-readiness proof until forced TURN relay and two-network/remote acceptance are recorded.
- [x] 2026-06-27: Added automatic remote-video stall recovery on branch `codex/p2p-product-hardening-followup`: expected remote video is now classified from WebRTC inbound `framesDecoded`/`bytesReceived`; two consecutive missing/stalled samples trigger throttled ICE recovery without asking the user to click a reconnect button. Verified: extension check/test (169 tests). Remaining proof is still forced TURN and real multi-network acceptance.
- [x] 2026-06-27: Tightened TURN readiness after current Cloudflare Realtime TURN docs review: `/ice-servers` now returns safe relay diagnostics (`hasTurn`, `hasTurns443`, URL counts), rejects configured Cloudflare responses that collapse to STUN-only after browser-blocked TURN URL filtering, extension debug logs include the relay summary, and Worker-backed relay-only harness runs require Cloudflare-configured TURN with `turns:443`. Remaining proof is still a real Cloudflare TURN forced-relay run plus two-network/remote staging acceptance.
- [x] 2026-06-27: Added a browser-native codec preference layer on branch `codex/p2p-product-hardening-followup`: audio transceivers now prefer supported RED before Opus fallback, video transceivers keep lightweight broadly-supported codecs first while preserving RTX/FEC entries, and SDP summaries still record what actually negotiated. This avoids SDP munging and stays inside standard WebRTC APIs. Verified: `pnpm --filter @anidachi/extension check` and `pnpm --filter @anidachi/extension test` (171 tests). Remaining proof is the real TURN/multi-network run.
- [x] 2026-06-27: Added automatic remote-audio stall recovery on branch `codex/p2p-product-hardening-followup`: expected remote voice is now tracked separately from active-speaker UI state and classified from WebRTC inbound packets/bytes/audioLevel. Two consecutive missing/stalled samples on a connected peer restart ICE with cooldown and debug reason `media-stall:audio-*`, without adding a reconnect button. Verified: `pnpm --filter @anidachi/extension check`, `pnpm --filter @anidachi/extension test` (177 tests), `pnpm --filter @anidachi/api check`, `pnpm --filter @anidachi/api test`, `pnpm --filter @anidachi/api test:runtime`, `pnpm harness:rooms` (35/35), and `npm --prefix tests/e2e run harness:p2p` (11/11). Remaining proof is still forced TURN and real multi-network acceptance.
- [x] 2026-06-17: Development-flow gate added before remaining Block 6 work. Next room/P2P PR must use `AGENTS.md`, `.coderabbit.yaml`, the PR template, `pnpm dev:check -- --profile rooms`, the env/secrets matrix, and the staging acceptance checklist before promotion.
- [x] 2026-06-27: First production hardening slice on `codex/p2p-production-hardening`: split client/server P2P protocol envelopes, made server-relayed P2P generation fields required, added `roomGeneration/sourceGeneration/serverSeq` to `ROOM_SNAPSHOT`, scoped Worker P2P replay by current generation, and made the extension/Ghost Cam drop stale P2P media signals. Verification: `pnpm --filter @anidachi/protocol check`, `pnpm --filter @anidachi/protocol test`, `pnpm --filter @anidachi/api check`, `pnpm --filter @anidachi/api test`, `pnpm --filter @anidachi/extension check`, `pnpm --filter @anidachi/extension test`, `pnpm harness:rooms` (29/29), `npm --prefix tests/e2e run harness:p2p` (8/8).
