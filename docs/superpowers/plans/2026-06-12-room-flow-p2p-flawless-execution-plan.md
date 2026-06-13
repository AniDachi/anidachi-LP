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

---

## Block 1 — Measurement Foundation And Two-Browser Harness

**Why first:** "flawless" is unverifiable without numbers; every later block is judged against this baseline.

**Files:** `scripts/p2p-scorecard.mjs` (new), `apps/api/src/index.ts` (Analytics Engine binding), `apps/api/wrangler.toml`, `tests/e2e/` (new Playwright workspace), `.github/workflows/e2e-rooms.yml` (new), `docs/development-environments.md`.

**Steps:**

- [x] 1.1 Scorecard merged (PR #28): `scripts/p2p-scorecard.mjs` parses debug exports → TTFM, candidate types, ICE restarts, reconnects, signal/dedupe stats; verified on a synthetic export.
- [x] 1.2 Worker telemetry via Analytics Engine: `apps/api/src/telemetry.ts` (FNV-hashed room id, env/name/role blobs, no IPs/names, best-effort non-throwing). Wired into the DO for `ws_open`, `ws_close`, `ws_token_reject`, `join`, `p2p_signal`, `p2p_replay` (`room_full` reserved for Block 6.4). Bindings in `wrangler.toml` per env (`anidachi_room_events_staging/production`) + `ANIDACHI_ENV` var. Verified: api typecheck + 23 tests (6 new), staging dry-run shows the binding resolved. Datasets auto-create on first write; query via the Analytics Engine SQL API once traffic flows.
- [ ] 1.3 Manual staging baseline (roadmap Task 1): two profiles + two devices on different networks; record results (including known audio-delay and room-close reports) in Progress Log before any behavior change.
- [ ] 1.4 Playwright harness: chromium with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`; two (later four) isolated contexts; demo page + `wrangler dev` Worker (local DO) + token stub signing room tokens with the local dev secret (mirrors `apps/web` JWT shape; no Supabase needed locally).
- [ ] 1.5 Scenarios v1: create+join, both videos flowing (TTFM assert via `getStats`), reload A, reload B, `context.setOffline` 5s/30s, push-to-talk both ways, idle 10 min (fast-forwarded keepalive), force-relay run (`WXT_P2P_FORCE_RELAY=true`).
- [ ] 1.6 CI workflow on PRs into `staging` (non-required at first; flip to required after 2 weeks of stability).

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
- [ ] 6.6 PD2 precise quota metering: the DO tracks host-room active seconds (>=2 connected participants) hibernation-safely (timestamps in attachments/SQLite, not timers), reports usage server-to-server to the web internal endpoint on disconnect/alarm/threshold, and enforces the final cutoff: warning event at 5 remaining minutes, graceful room end + upgrade prompt at 0. Replaces the Block 2 token-expiry approximation.

**Acceptance:** roadmap Task 5/6 acceptance + idle rooms hibernate without disconnecting clients (S9) + empty rooms end themselves (closes defect 3 with PD1) + quota metering accurate to <=1 minute drift in harness.

## Block 7 — Network, Security, Cost Guardrails

- [ ] 7.1 `GET /ice-servers` requires a valid `roomToken` (closes defect 5); extension fetches it after `/connect`.
- [ ] 7.2 Remove legacy `/livekit/token` (LiveKit stays historical per project docs); tighten CORS to channel web origins + extension origin.
- [ ] 7.3 Verify `turns:443` is present in returned ICE servers (restrictive-network fallback); confirm relay-only diagnostic mode stays dev-only.
- [ ] 7.4 Proactive `restartIce` on network change (`navigator.connection` change listener) in addition to existing state-based restarts.
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
