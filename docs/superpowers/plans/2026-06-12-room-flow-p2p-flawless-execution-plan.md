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
| S7 | False `ROOM_LIMIT_REACHED` for users without an actually-active room | 0 |
| S8 | Ghost participants after reload | 0 |
| S9 | Room survives 2h session and 10+ min idle | yes |
| S10 | TURN relay share of connections | measured and reported (expectation 10–25%) |

## Verified Current Reality (code audit 2026-06-12)

Confirmed working end to end: extension auth exchange/refresh (`apps/extension/src/auth-client.ts`, `apps/web/app/api/extension/auth/*`), authenticated room create (`apps/web/app/api/rooms/route.ts`), invite landing with login redirect and extension detection (`apps/web/app/room/[roomId]/page.tsx`, `extension-check.tsx`), member join + launch URL (`join/route.ts`), room token connect (`connect/route.ts`), Worker token verification + targeted P2P signaling with `serverSeq` replay (`apps/api/src/index.ts`, `p2p-signal-buffer.ts`), client keepalive PING/PONG with pong-timeout and jittered-backoff reconnect that refreshes tokens (`apps/extension/src/room-client.ts`, `room-reconnect.ts`, `overlay-app.tsx`).

Confirmed defects:

1. **CRITICAL — rooms are immortal.** Nothing ever transitions `rooms.status` from `lobby`; `countActiveRoomsForHost` counts everything not `ended` (`apps/web/lib/anidachi-auth/db.ts`), so a `watcher`-plan user permanently hits `ROOM_LIMIT_REACHED` after their first room.
2. **CRITICAL — room create is not idempotent.** Double-click or network retry creates duplicate rooms that all count against the limit.
3. Host loss leaves an orphan room: `hostId` becomes null in `apps/api/src/room-state.ts`, nobody can control playback, no UI explains it, nothing ends the room.
4. Invite dead-ends: a room without `source_url` leaves the guest stranded on the landing page after join.
5. `GET /ice-servers` is unauthenticated (anyone can mint Cloudflare TURN credentials at project cost); CORS is `*`; legacy `/livekit/token` is still exposed.
6. As recorded in the roadmap: no `participantSessionId`, no generations in `ROOM_SNAPSHOT`, Durable Object does not use Hibernation.

## Product Decisions Fixed By This Plan

Owner approved delegating these defaults (change via PR if product evidence disagrees):

- **PD1 — orphaned room:** overlay shows an explicit "Host offline" state; the room auto-ends after 4 hours with no connected participants. Host transfer is deferred to a future plan.
- **PD2 — active-room definition:** a room counts against plan limits only if `last_active_at` is within the past 4 hours (updated on create and every `/connect`).
- **PD3 — participant cap:** the Durable Object rejects a 5th concurrent participant with `ROOM_FULL`. Mesh P2P stays sized for 4.

## Non-Negotiable Rules

- Feature branches from `staging`; PRs into `staging`; never push `main`. Production promotion only after staging acceptance.
- One block = one or a few scoped PRs. No mixed mega-PRs.
- `packages/protocol` changes land before/with both consumers.
- No secrets in git. No broad store permissions. Staging stays gated/noindex.
- Keep P2P ultra-light: ~240px, 10–12fps, ~150kbps, max 4 participants, push-to-talk voice.
- Update this file's Progress Log and `docs/current-development-state.md` in the same PR when behavior or endpoints change.
- A block is done only when its acceptance criteria pass in the harness AND on staging with two real browser profiles.

---

## Block 1 — Measurement Foundation And Two-Browser Harness

**Why first:** "flawless" is unverifiable without numbers; every later block is judged against this baseline.

**Files:** `scripts/p2p-scorecard.mjs` (new), `apps/api/src/index.ts` (Analytics Engine binding), `apps/api/wrangler.toml`, `tests/e2e/` (new Playwright workspace), `.github/workflows/e2e-rooms.yml` (new), `docs/development-environments.md`.

**Steps:**

- [ ] 1.1 Scorecard: script that parses extension debug exports and prints TTFM, ICE candidate types, restarts, reconnects, signal loss/dedupe counts.
- [ ] 1.2 Worker telemetry via Workers Analytics Engine dataset `anidachi_room_events`: room connects, joins, closes, P2P signal volume, replay hits, token rejects, `ROOM_FULL`. Blobs: env/channel/event/roomId-hash; doubles: counts/latency. No IPs, no display names.
- [ ] 1.3 Manual staging baseline (roadmap Task 1): two profiles + two devices on different networks; record results (including known audio-delay and room-close reports) in Progress Log before any behavior change.
- [ ] 1.4 Playwright harness: chromium with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`; two (later four) isolated contexts; demo page + `wrangler dev` Worker (local DO) + token stub signing room tokens with the local dev secret (mirrors `apps/web` JWT shape; no Supabase needed locally).
- [ ] 1.5 Scenarios v1: create+join, both videos flowing (TTFM assert via `getStats`), reload A, reload B, `context.setOffline` 5s/30s, push-to-talk both ways, idle 10 min (fast-forwarded keepalive), force-relay run (`WXT_P2P_FORCE_RELAY=true`).
- [ ] 1.6 CI workflow on PRs into `staging` (non-required at first; flip to required after 2 weeks of stability).

**Acceptance:** harness runs locally and in CI; baseline SLO numbers recorded in Progress Log; scorecard committed and documented.

## Block 2 — Room Lifecycle And Idempotent Create (roadmap Task 2)

**Why hotfix priority:** defects 1–2 block commercial use for free-plan users.

**Files:** `apps/web/supabase/migrations/2026xxxx_room_lifecycle.sql` (new), `apps/web/lib/anidachi-auth/db.ts`, `apps/web/app/api/rooms/route.ts`, `apps/web/app/api/rooms/[roomId]/connect/route.ts`, `apps/web/app/api/rooms/[roomId]/end/route.ts` (new), `apps/extension/src/room-client.ts`, `apps/extension/src/overlay-app.tsx`, `packages/protocol` (only if event shapes change), web/api tests.

**Steps:**

- [ ] 2.1 Migration: add `client_request_id text`, `last_active_at timestamptz not null default now()`, `ended_at timestamptz`; unique index `(host_user_id, client_request_id)`; index `(host_user_id, status, last_active_at)`.
- [ ] 2.2 Idempotent create: extension sends a per-click UUID `clientRequestId`; on conflict return the existing active room (same `roomId`/`roomToken` semantics). Retry after network failure returns the same room.
- [ ] 2.3 Active definition (PD2): `countActiveRoomsForHost` counts rooms with `status != 'ended'` AND `last_active_at > now() - interval '4 hours'`. `/connect` updates `last_active_at` and promotes `lobby -> live` on first host connect.
- [ ] 2.4 `POST /api/rooms/:roomId/end` (host only): sets `status='ended'`, `ended_at=now()`. Overlay gets an explicit "End room" control for hosts; ended rooms return 404/410 on `connect`/`join`.
- [ ] 2.5 Tests: duplicate create (same key), parallel create race, limit excludes stale/ended, end-room flow, `last_active_at` bump on connect.

**Acceptance:** S7 = 0 in tests; create → close tab → create again works for watcher plan; double-click creates one room; harness scenario "create twice, join once" green.

## Block 3 — Invite Flow Without Dead Ends

**Files:** `apps/web/app/room/[roomId]/page.tsx`, `apps/web/app/api/rooms/[roomId]/join/route.ts`, `apps/web/app/room/[roomId]/extension-check.tsx`, harness scenarios.

**Steps:**

- [ ] 3.1 Room without `source_url`: after join, landing shows "Host has not opened a video yet" with auto-refresh/poll instead of a silent dead end; when `source_url` appears, show/redirect to the launch URL.
- [ ] 3.2 Returning member: landing offers "Open watchroom" (re-issues launch URL) without re-posting join.
- [ ] 3.3 Ended room: friendly "This watchroom has ended" page instead of bare 404.
- [ ] 3.4 Harness: full invite e2e — host context creates room on demo page, guest context walks landing → join → launch URL → video both ways (S2 measured).

**Acceptance:** no guest path terminates without a next action; S2 met in harness.

## Block 4 — Sessions, Reconnect Identity, Tab Lifecycle (roadmap Tasks 3–4)

Implements the roadmap contract exactly; protocol shapes follow the roadmap's Task 3 target. Additions on top:

- [ ] 4.1 `participantSessionId` generated per overlay room session, persisted in `sessionStorage`, sent on JOIN/resume; Worker replaces stale sockets by `(userId, participantSessionId)` instead of userId only.
- [ ] 4.2 `ROOM_SNAPSHOT` carries `roomGeneration`, `sourceGeneration`, `serverSeq`; client drops stale events by generation; P2P controller starts only after snapshot.
- [ ] 4.3 Multi-tab guard: Web Locks (`navigator.locks`) — one tab owns the room; other tabs show "Room is open in another tab" instead of fighting over the socket.
- [ ] 4.4 Page lifecycle: `pagehide` sends polite `bye`/leave; bfcache restore resumes by `participantSessionId`; SPA navigation (YouTube) and full navigation (Crunchyroll) perform controlled teardown/resume.
- [ ] 4.5 Tests: reload either side without ghosts (S8), duplicate-socket replacement, resume replays only missed signals, two tabs same room, token-expiry reconnect (>30 min session).

**Acceptance:** roadmap Task 3/4 acceptance criteria + S5/S8 green in harness.

## Block 5 — P2P Media Engine Polish (roadmap Task 7, client-only)

**Parallelization note:** files here (`apps/extension/src/p2p-media.ts`, `ghost-cam.ts`, `media-types.ts`, `overlay-app.tsx` media sections) do not overlap Blocks 2–4 server work; may run in parallel by agreement recorded in the Progress Log.

**Steps:**

- [ ] 5.1 Push-to-talk without renegotiation: negotiate the audio transceiver `sendrecv` once, then toggle `track.enabled` (Opus DTX keeps silence near zero bandwidth). Target S6 (<300ms). Remove per-press direction flips.
- [ ] 5.2 Microphone caching: keep the mic stream for ~60s after V release (instant repeat talk), release after idle timeout. Never hold the mic outside an active room.
- [ ] 5.3 Reconciliation loop: every ~5s and on connection-state events, compare desired media state (camera/voice intents) against actual transceiver `currentDirection`/tracks/connection; on mismatch re-run sync/negotiation or request ICE restart. Lost signals become self-healing instead of stuck states.
- [ ] 5.4 Peer health monitor: sample `getStats` every 3–5s (RTT, packet loss, available bitrate, candidate-pair type) → per-peer state good/degraded/recovering → subtle bubble indicator + scorecard aggregation (feeds S10).
- [ ] 5.5 Device edge cases: `devicechange`, camera unplug, OS sleep/wake, Bluetooth headset switch; handle `track.muted`/`ended` with re-acquire; `degradationPreference: "maintain-framerate"` on video sender.
- [ ] 5.6 Unit tests for negotiation helpers, reconciliation decisions, throttles; harness asserts S3/S6.

**Acceptance:** S3, S6 green; both-order reload recovery without room recreation; audio failures diagnosable from exported logs (explicit audio state machine).

## Block 6 — Source Switching, Hibernation, Room-End Alarms (roadmap Tasks 5–6)

Follow the roadmap's task lists verbatim; additions:

- [ ] 6.1 (Task 5) `WatchSourceDescriptor` + `SOURCE_CHANGED` + `sourceGeneration` bump; replay scoped by generation (buffer already supports scope); client drops stale-generation media signals.
- [ ] 6.2 (Task 6) Hibernation migration per roadmap: `acceptWebSocket`, `webSocketMessage/Close/Error`, versioned attachments <2KB, rebuild from `getWebSockets()`, SQLite-backed `serverSeq` + replay buffer, `setWebSocketAutoResponse` for PING/PONG so keepalive no longer wakes the DO. Note: `web_socket_auto_reply_to_close` is already active via compat date — rely on clean CLOSED transitions.
- [ ] 6.3 DO Alarm room end (PD1): when the last participant disconnects, set an alarm for +4h; on fire with the room still empty, call a server-to-server web endpoint (`POST /api/internal/rooms/:roomId/ended`, authenticated by a dedicated shared secret/Worker service binding — never the user JWT secret) to set `ended`. Cancels on rejoin.
- [ ] 6.4 (PD3) DO join enforces max 4 concurrent participants → `ROOM_FULL` error event; overlay shows "Room is full".
- [ ] 6.5 `@cloudflare/vitest-pool-workers` integration tests: wake/rebuild keeps participants, host state, monotonic seq; alarm ends empty room; full-room rejection; the roadmap Task 6 required-test list.

**Acceptance:** roadmap Task 5/6 acceptance + idle rooms hibernate without disconnecting clients (S9) + empty rooms end themselves (closes defect 3 with PD1).

## Block 7 — Network, Security, Cost Guardrails

- [ ] 7.1 `GET /ice-servers` requires a valid `roomToken` (closes defect 5); extension fetches it after `/connect`.
- [ ] 7.2 Remove legacy `/livekit/token` (LiveKit stays historical per project docs); tighten CORS to channel web origins + extension origin.
- [ ] 7.3 Verify `turns:443` is present in returned ICE servers (restrictive-network fallback); confirm relay-only diagnostic mode stays dev-only.
- [ ] 7.4 Proactive `restartIce` on network change (`navigator.connection` change listener) in addition to existing state-based restarts.
- [ ] 7.5 Cost guardrails: Analytics Engine alert query for abnormal TURN/signal volume; document budget math (TURN free tier 1TB/month; ~150kbps relay leg ≈ 67MB/hour).
- [ ] 7.6 Document (do not build) a future relay-only privacy mode: P2P exposes peer IPs; acceptable for friends-rooms, revisit for public rooms.

**Acceptance:** unauthorized `/ice-servers` request returns 401 in staging; CORS verified; cost dashboard query saved.

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
- Empty rooms end themselves; plan limits never block users without an active room.
- DO hibernates on idle without dropping rooms; keepalive does not wake it.
- P2P recovers from reload/network loss in either order without recreating the room.
- Harness green in CI and required for `staging` merges of room/P2P paths.
- Roadmap Progress Log and `current-development-state.md` reflect reality.

## Progress Log

- [x] 2026-06-12: Full end-to-end code audit of auth/room/invite/connect/reconnect flow in this monorepo; defects 1–6 verified against source (see Verified Current Reality). External references re-checked. Plan created. No product code changed yet.
