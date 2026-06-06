# Commercial Room, P2P, and Watch Progress Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current Anidachi prototype into a commercial-grade architecture where website auth, room creation, realtime rooms, P2P media, and watch-progress persistence work as one coherent system.

**Architecture:** Use a three-plane architecture: website/Supabase as the persistent control plane, Cloudflare Worker + Durable Objects as the realtime live plane, and the Chrome extension as the runtime/media plane. The Worker owns volatile presence, playback sync, P2P signaling, reactions, and live chat; the website owns users, room records, invites, memberships, plans, and durable watch history.

**Tech Stack:** WXT + React + TypeScript extension, Next.js/Vercel website, Supabase Postgres, Cloudflare Workers + Durable Objects + WebSockets, WebRTC P2P with Cloudflare TURN fallback, Zod protocol schemas, Vitest, Playwright/Chrome manual verification.

---

## Current Status

- [x] Local monorepo exists at `/Users/vladyslavhulyi/anidachi`.
- [x] Extension prototype exists in `apps/extension`.
- [x] Worker + Durable Object prototype exists in `apps/api`.
- [x] Shared Zod protocol package exists in `packages/protocol`.
- [x] P2P media experiment exists in `apps/extension/src/p2p-media.ts`.
- [x] ICE server endpoint exists in `apps/api/src/ice-servers.ts`.
- [x] Cloudflare Worker is deployed at `https://anidachi-api.vladislav-gul7.workers.dev`.
- [x] Cloudflare TURN is wired through server-side Worker secrets.
- [x] Website repo `George-Kreatli/anidachi-LP` was inspected.
- [x] Auth integration worktree exists at `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration`.
- [x] Website auth bridge work exists in `apps/web` inside the auth integration worktree.
- [x] Existing docs cover MVP architecture, site/extension integration, LiveKit/AWS notes, and shared watch progress.
- [x] Baseline tests were previously checked for protocol, api, extension, and web.
- [ ] Current working state is not yet locked with a clean branch/tag/commit for the commercial architecture work.
- [ ] Website repo and monorepo are not yet fully synchronized as one source of truth.
- [ ] Room lifecycle is not yet robust enough for commercial use.
- [ ] P2P signaling is functional but not yet hardened around reconnect, source generation, stale messages, and asymmetric join timing.
- [ ] Watch progress is still mostly prototype/local-cache driven and not yet backed by durable social sessions.

## Architecture Boundaries

### Website / Control Plane

Responsible for durable business data:

- user auth and sessions;
- profiles and avatars;
- subscription/plan/entitlements;
- durable room metadata;
- room invites and membership;
- source metadata for a room;
- watch sessions and progress history;
- extension auth handoff.

The website must not run live playback sync. It only creates durable records and grants short-lived tokens.

### Cloudflare Worker + Durable Object / Live Plane

Responsible for live state:

- WebSocket connection;
- room snapshot;
- participant presence;
- host playback state;
- source switch events;
- P2P signaling;
- chat/reaction broadcast;
- camera and voice status;
- short-lived ICE server credentials.

The Worker must not trust client-provided identity. It derives participant identity from a verified room token.

### Extension / Runtime Plane

Responsible for browser behavior:

- adapter detection;
- Crunchyroll/YouTube/generic video control;
- overlay UI;
- P2P camera/audio;
- local media permissions;
- keyboard shortcuts;
- reactions/chat rendering;
- source navigation;
- progress checkpoint emission.

The extension must not contain service-role keys, TURN secrets, Supabase service keys, or JWT signing secrets.

---

## Target Data Contracts

### Room State Envelope

All realtime messages should move toward this envelope shape:

```ts
export interface RoomEventEnvelope<TPayload> {
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

Rules:

- `roomGeneration` changes when the room is reset or recreated.
- `sourceGeneration` changes when host switches anime, episode, movie, or provider URL.
- `serverSeq` is assigned only by the Durable Object.
- Extension drops any event with stale `roomGeneration` or stale `sourceGeneration`.
- P2P offers, answers, ICE candidates, reactions, and host state all use the same ordering model.

### Durable Room Lifecycle

Commercial room lifecycle:

```txt
draft -> lobby -> live -> ended
draft -> cancelled
lobby/live -> stale -> ended
```

Rules:

- `draft`: durable record exists, host has not connected to Worker.
- `lobby`: at least host has created/joined, source is known, room can accept members.
- `live`: host playback has started or host is actively present.
- `ended`: no longer counts toward active room limit.
- `stale`: derived cleanup state for rooms with no live activity after the configured timeout.

### Source Descriptor

Every room and source switch should carry a normalized source descriptor:

```ts
export interface WatchSourceDescriptor {
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

Rules:

- `canonicalUrl` is used for identity and room handoff.
- `sourceUrl` is the URL the extension should open.
- `videoFingerprint` is used only for sync compatibility checks.
- Crunchyroll adapter owns provider-specific extraction.

---

## Task 0: Lock The Current Working Baseline

**Files:**

- Read: `/Users/vladyslavhulyi/anidachi`
- Read: `/Users/vladyslavhulyi/anidachi/.worktrees/auth-integration`
- Modify: no product files

- [ ] **Step 0.1: Inspect dirty state in both worktrees**

Run:

```bash
git -C /Users/vladyslavhulyi/anidachi status --short
git -C /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration status --short
```

Expected:

- root worktree shows only known local files or planned docs changes;
- auth worktree is clean or has intentional auth-integration changes.

- [ ] **Step 0.2: Create a safety branch for commercial architecture work**

Run:

```bash
git -C /Users/vladyslavhulyi/anidachi switch -c codex/commercial-room-p2p-architecture
```

Expected:

- branch is created from the current working state;
- no user changes are reverted.

- [ ] **Step 0.3: Commit only documentation plan changes first**

Run:

```bash
git -C /Users/vladyslavhulyi/anidachi add docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md
git -C /Users/vladyslavhulyi/anidachi commit -m "docs: add commercial room architecture plan"
```

Expected:

- first commit contains only this plan;
- code remains untouched.

- [ ] **Step 0.4: Create a restore tag after the current working product is confirmed**

Run after user confirms the current extension/site build is the version to preserve:

```bash
git -C /Users/vladyslavhulyi/anidachi tag anidachi-working-p2p-before-commercial-architecture
```

Expected:

- there is a named restore point before room/P2P/auth refactors.

---

## Task 1: Establish One Source Of Truth For Website And Extension

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi/apps/web`
- Modify: `/Users/vladyslavhulyi/anidachi/package.json`
- Modify: `/Users/vladyslavhulyi/anidachi/pnpm-workspace.yaml`
- Modify: `/Users/vladyslavhulyi/anidachi/docs/site-extension-integration-notes.md`
- Compare: `George-Kreatli/anidachi-LP`

- [ ] **Step 1.1: Decide the canonical code location**

Decision:

```txt
Canonical product monorepo: /Users/vladyslavhulyi/anidachi
Canonical website app: /Users/vladyslavhulyi/anidachi/apps/web
External deploy repo: George-Kreatli/anidachi-LP until Vercel is moved to the monorepo
```

Expected:

- all new shared contracts and tests are written in the monorepo first;
- deploy repo receives mirrored website changes only while Vercel still points there.

- [ ] **Step 1.2: Diff website code against the deployed repo before changes**

Run:

```bash
git -C /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration status --short
git -C /Users/vladyslavhulyi/anidachi/.worktrees/auth-integration log --oneline -5 -- apps/web
```

Expected:

- identify whether `apps/web` is ahead or behind the deployed repo;
- record the deployed commit in `/Users/vladyslavhulyi/anidachi/docs/site-extension-integration-notes.md`.

- [ ] **Step 1.3: Add a repository sync rule to docs**

Modify `/Users/vladyslavhulyi/anidachi/docs/site-extension-integration-notes.md` with this rule:

```txt
Until Vercel deploys directly from the monorepo, any website API/auth/room change must be mirrored into George-Kreatli/anidachi-LP in the same development session. Extension and Worker changes remain in the monorepo.
```

Expected:

- future changes do not silently diverge between the installed extension and live website.

- [ ] **Step 1.4: Verify workspace package coverage**

Run:

```bash
pnpm -C /Users/vladyslavhulyi/anidachi -r list --depth -1
```

Expected:

- `@anidachi/api`, `@anidachi/extension`, `@anidachi/protocol`, and `@anidachi/web` appear when web is part of the active worktree.

---

## Task 2: Harden Auth And Extension Sessions

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/lib/anidachi-auth/session.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/lib/anidachi-auth/extension-session.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/extension/auth/exchange/route.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/extension/auth/refresh/route.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/extension/auth/logout/route.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/me/route.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/auth-client.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/auth-tokens.ts`
- Test: `/Users/vladyslavhulyi/anidachi/apps/extension/test/auth-client.test.ts`

- [ ] **Step 2.1: Make authenticated identity mandatory in the extension**

Rule:

```txt
No guest participant is allowed to create, join, signal P2P media, or send room events in commercial mode.
```

Expected extension behavior:

- signed-out user can see the overlay;
- signed-out user cannot create a room;
- signed-out user sees a sign-in call to action;
- all room APIs require an extension access token.

- [ ] **Step 2.2: Normalize user shape returned by `/api/me`**

Expected JSON:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "displayName": "Vladyslav",
    "avatarUrl": "https://example.com/avatar.png",
    "plan": "watcher"
  }
}
```

Expected:

- website nav and extension render the same display name/avatar;
- extension never guesses initials from a local guest identity when signed in.

- [ ] **Step 2.3: Ensure logout revokes extension refresh tokens**

Expected:

- `/api/extension/auth/logout` invalidates the current extension refresh token;
- extension clears `chrome.storage.local` auth tokens;
- next create-room attempt returns signed-out UI, not a stale "Signed in" card.

- [ ] **Step 2.4: Test auth client transitions**

Run:

```bash
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/extension test -- auth-client
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/web test
```

Expected:

- auth-client tests cover signed-in, signed-out, refresh success, refresh failure, and logout;
- website tests cover `/api/me`, extension exchange, refresh, and logout.

---

## Task 3: Make Room Creation Durable And Idempotent

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/lib/anidachi-auth/db.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/rooms/route.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/rooms/[roomId]/join/route.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/rooms/[roomId]/connect/route.ts`
- Create/Modify: `/Users/vladyslavhulyi/anidachi/apps/web/supabase/migrations/*_commercial_rooms.sql`
- Test: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/rooms/*.test.ts`

- [ ] **Step 3.1: Add commercial room columns**

Migration should add or verify:

```sql
alter table public.rooms
  add column if not exists status text not null default 'lobby',
  add column if not exists source_url text,
  add column if not exists canonical_url text,
  add column if not exists video_fingerprint text,
  add column if not exists title text,
  add column if not exists provider text,
  add column if not exists source_generation integer not null default 1,
  add column if not exists room_generation integer not null default 1,
  add column if not exists last_active_at timestamptz,
  add column if not exists ended_at timestamptz;
```

Expected:

- active room counts use `status in ('lobby', 'live') and ended_at is null`;
- stale rooms can be ended without deleting historical data.

- [ ] **Step 3.2: Make create-room idempotent from the extension**

Expected request body:

```json
{
  "clientRequestId": "uuid-generated-on-click",
  "source": {
    "provider": "crunchyroll",
    "sourceUrl": "https://www.crunchyroll.com/watch/...",
    "canonicalUrl": "https://www.crunchyroll.com/watch/...",
    "videoFingerprint": "crunchyroll:series:episode",
    "title": "Episode title",
    "seriesTitle": "Series title",
    "episodeTitle": "Episode title",
    "duration": 1430
  }
}
```

Expected:

- double-clicking Create room does not create two active DB rooms;
- repeated request with the same `clientRequestId` returns the same room.

- [ ] **Step 3.3: End previous active room only by explicit user action or stale cleanup**

Expected:

- creating a new room does not silently close unrelated active rooms;
- user can explicitly leave/end room;
- stale cleanup ends rooms with no live activity after the configured timeout.

- [ ] **Step 3.4: Room limit must not block due to stale rooms**

Test case:

```txt
Given user has one stale lobby room with last_active_at older than timeout
When user creates a new room
Then stale room is ended
And new room is created
And response status is 200
```

Run:

```bash
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/web test -- rooms
```

Expected:

- room limit failures happen only for genuinely active rooms.

---

## Task 4: Version The Room Protocol And Snapshot Handshake

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi/packages/protocol/src/types.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/packages/protocol/src/index.ts`
- Test: `/Users/vladyslavhulyi/anidachi/packages/protocol/test/protocol.test.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/api/src/room-state.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/api/src/index.ts`
- Test: `/Users/vladyslavhulyi/anidachi/apps/api/test/room-state.test.ts`

- [ ] **Step 4.1: Add protocol fields**

Add these fields to room snapshot and live events:

```ts
roomGeneration: number;
sourceGeneration: number;
serverSeq: number;
```

Expected:

- `ROOM_SNAPSHOT` gives the extension enough information to reject stale P2P and playback events.

- [ ] **Step 4.2: Server assigns participant identity**

Rule:

```txt
JOIN may include client capabilities, but it must not define participant id, role, displayName, or avatarUrl.
```

Expected:

- Durable Object uses room token claims for user identity;
- participant spoofing is impossible through client JSON.

- [ ] **Step 4.3: Validate event room identity**

Expected:

- WebSocket path room id, room token room id, top-level event room id, and nested payload room id match;
- mismatch returns `ERROR` and does not broadcast.

- [ ] **Step 4.4: Test stale source event rejection**

Test case:

```txt
Given room sourceGeneration is 3
When a P2P_SIGNAL arrives with sourceGeneration 2
Then the Durable Object drops it
And receiver does not get the stale signal
```

Run:

```bash
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/protocol test
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/api test
```

Expected:

- protocol and DO tests pass.

---

## Task 5: Add WebSocket Reconnect And Resume

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/room-client.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/api/src/index.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/api/src/room-state.ts`
- Test: `/Users/vladyslavhulyi/anidachi/apps/extension/test/room-client-auth.test.ts`
- Test: `/Users/vladyslavhulyi/anidachi/apps/api/test/room-state.test.ts`

- [ ] **Step 5.1: Add connection/session identity**

Expected client values:

```ts
participantSessionId: string; // one browser tab lifetime
connectionId: string; // one WebSocket lifetime
lastSeenServerSeq: number;
```

Expected:

- reconnect can resume the same tab session;
- new WebSocket replaces the previous socket for the same user/session;
- stale socket close does not remove the newer participant.

- [ ] **Step 5.2: Add reconnect strategy**

Expected timings:

```txt
Attempt 1: 250 ms
Attempt 2: 500 ms
Attempt 3: 1000 ms
Attempt 4+: 2000-5000 ms jittered
```

Expected:

- transient network loss does not permanently close room state;
- outgoing non-idempotent events are not replayed blindly;
- latest host state is refreshed from `ROOM_SNAPSHOT`.

- [ ] **Step 5.3: Gate room UI by snapshot readiness**

Expected:

- extension room state becomes `connected` only after WebSocket open and `ROOM_SNAPSHOT` received;
- P2P starts after snapshot, not after `roomId` alone.

- [ ] **Step 5.4: Test reconnect behavior**

Run:

```bash
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/extension test -- room-client
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/api test -- room-state
```

Expected:

- tests cover close, reconnect, duplicate socket replacement, snapshot after resume, and stale close ignore.

---

## Task 6: Harden Ultra-Light P2P Media Reliability

Product decision:

```txt
P2P media is intentionally ultra-light. Do not add adaptive upscaling,
HD profiles, always-on voice, or quality improvements that increase bitrate.
The goal is stable tiny Ghost Cam bubbles and push-to-talk audio, not a video-call product.
```

Primary references checked on 2026-06-07:

- MDN perfect negotiation: `https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation`
- MDN ICE restart: `https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce`
- MDN ICE server refresh: `https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setConfiguration`
- MDN WebRTC connectivity and candidate types: `https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Connectivity`
- WebRTC peer connections and trickle ICE: `https://webrtc.org/getting-started/peer-connections`
- Cloudflare TURN credentials: `https://developers.cloudflare.com/realtime/turn/generate-credentials/`
- Cloudflare Durable Object WebSocket hibernation: `https://developers.cloudflare.com/durable-objects/best-practices/websockets/`

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/packages/protocol/src/types.ts`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/packages/protocol/test/protocol.test.ts`
- Create: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api/src/p2p-signal-buffer.ts`
- Test: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api/test/p2p-signal-buffer.test.ts`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api/src/index.ts`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api/src/room-state.ts`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/api/test/room-state.test.ts`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/extension/src/room-client.ts`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/extension/src/overlay-app.tsx`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/extension/src/ghost-cam.ts`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/extension/src/p2p-media.ts`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/extension/src/p2p-ice.ts`
- Test: `/Users/vladyslavhulyi/anidachi-LP-monorepo/apps/extension/test/p2p-ice.test.ts`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/docs/experimental-features.md`
- Modify: `/Users/vladyslavhulyi/anidachi-LP-monorepo/docs/development-environments.md`

- [x] **Step 6.1: Lock the ultra-light media contract before changing reliability code**

Expected constants:

```txt
P2P_MAX_REMOTE_PARTICIPANTS stays 3.
Video stays tiny: target 160-240px square, 8-10fps preferred, never above the current 320px max.
Video sender bitrate must not increase above 150kbps.
Future automatic behavior may only degrade or disable video under bad network conditions; it must not upscale.
Audio remains push-to-talk, mono, echo-cancelled, noise-suppressed, and off when the key is released.
```

Expected:

- P2P work does not turn AniDachi into a full video-call app;
- no task raises the default camera resolution, framerate, or bitrate;
- any later quality increase requires a separate explicit product decision.

- [x] **Step 6.2: Extend protocol events with stable P2P delivery metadata**

Expected protocol additions:

```ts
clientSignalId: string;
senderConnectionId: string;
roomGeneration?: number;
sourceGeneration?: number;
serverSeq?: number;
serverReceivedAt?: number;
```

Rules:

- `clientSignalId` is generated by the sender for every `P2P_SIGNAL`;
- `senderConnectionId` is generated once per WebSocket connection;
- `serverSeq` and `serverReceivedAt` are assigned only by the Durable Object;
- `roomGeneration` and `sourceGeneration` start optional for backward compatibility, then become required after Task 4 and Task 7 are complete;
- clients drop duplicate `clientSignalId` values from the same sender.

Run:

```bash
pnpm --filter @anidachi/protocol test
```

Expected:

- existing room event tests still pass;
- new tests accept enriched P2P signal envelopes;
- malformed P2P signals without `clientSignalId` are rejected after the extension sender is updated.

- [x] **Step 6.3: Add a bounded Durable Object P2P signal replay buffer**

Implementation shape:

```txt
apps/api/src/p2p-signal-buffer.ts

RecentP2PSignalBuffer:
- stores only targeted P2P signaling events, not media;
- keeps at most 80 events per room;
- keeps events for 45 seconds;
- dedupes by roomId + fromUserId + toUserId + clientSignalId;
- indexes replay by toUserId and serverSeq;
- never writes every ICE candidate to SQLite;
- exposes add(event), replayFor(toUserId, afterServerSeq), prune(now).
```

Rules:

- Buffer is for short reconnect/asymmetric join windows only.
- Do not persist raw SDP or ICE to long-term storage.
- Do not broadcast P2P signals to the room; delivery remains targeted.
- Do not replay stale signals across `roomGeneration` or `sourceGeneration`.

Run:

```bash
pnpm --filter @anidachi/api test -- p2p-signal-buffer
```

Expected:

- buffer dedupes repeated client signals;
- buffer prunes old signals;
- buffer replays only events targeted to the reconnecting participant;
- buffer does not replay stale generation events.

- [x] **Step 6.4: Relay P2P signals through Durable Object with server sequencing**

Expected Worker behavior:

```txt
1. Verify sender identity from room token and joined participant state.
2. Verify target is a joined participant.
3. Assign serverSeq and serverReceivedAt.
4. Store the event in RecentP2PSignalBuffer.
5. Send immediately if target socket is online.
6. If target socket is temporarily offline, keep it only inside the bounded replay buffer.
7. On JOIN, after ROOM_SNAPSHOT, replay buffered P2P signals newer than lastSeenP2PServerSeq.
```

Expected:

- a reload/rejoin during negotiation no longer silently loses the last offer/answer/ICE burst;
- target-offline behavior is visible in Worker logs;
- invalid sender/target pairs still return `INVALID_P2P_SIGNAL`.

Run:

```bash
pnpm --filter @anidachi/api test
```

Expected:

- existing auth, room-state, and ICE server tests pass;
- new room-state tests cover signal permission and replay eligibility.

- [x] **Step 6.5: Add extension-side P2P signal dedupe and stale-generation drops**

Expected extension behavior:

```txt
1. RoomClient creates senderConnectionId per WebSocket connection.
2. overlay-app creates clientSignalId per P2P signal.
3. overlay-app records the highest handled serverSeq per room.
4. ghost-cam/p2p-media ignore duplicate clientSignalId from the same sender.
5. P2P controller ignores signals from stale roomGeneration/sourceGeneration.
6. Pending ICE before remoteDescription stays bounded.
```

Expected:

- replayed signals do not create duplicate offers or duplicate ICE candidates;
- stale signals from a previous source switch do not disturb the active peer connection;
- asymmetric join timing is handled without manually recreating the room.

- [ ] **Step 6.6: Keep and test the perfect negotiation model**

Current good behavior to preserve:

```txt
makingOffer / ignoreOffer / isSettingRemoteAnswerPending stay in the controller.
Polite/impolite peer role stays deterministic per participant pair.
Audio/video transceivers stay pre-created by the deterministic offerer.
Renegotiate and restart-ice signals stay lightweight control messages.
```

Expected:

- do not replace this with ad hoc offer/answer branching;
- do not allow both sides to become permanent offerers;
- do not close and recreate peers for every camera toggle unless the peer is unrecoverable.

- [x] **Step 6.7: Harden ICE/TURN without making TURN the default**

Expected:

```txt
1. Keep iceTransportPolicy = "all" by default.
2. Keep STUN/direct candidates before TURN servers.
3. Keep Cloudflare TURN credentials server-generated through GET /ice-servers.
4. Filter browser-blocked TURN port 53 URLs for browser clients.
5. Remove OpenRelay from production fallback.
6. Keep WXT_P2P_FORCE_RELAY=true only as a diagnostic build/runtime mode.
7. Before ICE restart, force-refresh ICE servers if cached credentials are near expiry.
8. Apply refreshed servers with RTCPeerConnection.setConfiguration().
9. Then call restartIce() and renegotiate through the existing signaling path.
```

Expected:

- normal sessions prefer direct/STUN;
- restricted networks can still fall back to Cloudflare TURN;
- expired TURN credentials do not leave the room stuck in `checking` or `failed`;
- production does not depend on public demo TURN credentials.

Run:

```bash
pnpm --filter @anidachi/extension test -- p2p-ice
pnpm --filter @anidachi/api test -- ice-servers
```

Expected:

- STUN-first ordering remains covered;
- TURN credential TTL handling remains covered;
- production fallback tests prove OpenRelay is opt-in only.

- [ ] **Step 6.8: Add privacy-safe P2P diagnostics**

Progress 2026-06-07:

- `clientSignalId`, `senderConnectionId`, and `serverSeq` are now included in compact room debug
  snapshots.
- Remaining work: normalize/hash P2P user identifiers consistently across all `p2p.*` logs.

Log fields:

```ts
{
  roomId: string;
  localUserIdHash: string;
  remoteUserIdHash: string;
  senderConnectionId: string;
  serverSeq?: number;
  signalKind?: "offer" | "answer" | "ice" | "renegotiate" | "restart-ice" | "bye";
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  signalingState: RTCSignalingState;
  selectedCandidateType: "host" | "srflx" | "relay" | "prflx" | "unknown";
  selectedProtocol: "udp" | "tcp" | "unknown";
  usedTurn: boolean;
  iceRestartCount: number;
}
```

Rules:

- Do not log raw SDP.
- Do not log raw ICE candidate IP addresses in normal logs.
- Debug export may include event summaries, sequence numbers, and candidate types.
- Logs must answer: signaling lost, TURN missing, TURN selected, autoplay blocked, track missing, or stale signal dropped.

- [ ] **Step 6.9: Add room and browser lifecycle recovery hooks**

Progress 2026-06-07:

- `online` and `visibilitychange:visible` now reconnect the room WebSocket when the room is
  closed/error and the room token is still available.
- P2P now starts only when the WebSocket is connected and a fresh `ROOM_SNAPSHOT` has arrived.
- Remaining work: pagehide/beforeunload `bye` handling and manual sleep/wake verification.

Expected:

```txt
visibilitychange visible:
- if room socket is closed, reconnect through RoomClient;
- if peer is disconnected/failed, request ICE restart.

online:
- reconnect room socket if needed;
- refresh ICE servers before restart.

pagehide/beforeunload:
- send bye when possible;
- do not persist media data.
```

Expected:

- laptop sleep/wake and network switch recover more often without creating a new room;
- reconnect is rate-limited with jitter;
- non-idempotent room actions are not blindly replayed.

- [x] **Step 6.10: Keep voice simple and push-to-talk only**

Expected:

```txt
No always-on microphone.
No active speaker visualizer based on continuous audio level sampling in this milestone.
Keep voice-start/voice-stop as push-to-talk UI state.
Use WebRTC stats only for diagnostics if needed, not for a new visible feature.
```

Expected:

- voice remains lightweight;
- no background audio processing loop is added for UI polish;
- user privacy expectations stay simple.

- [x] **Step 6.11: Defer Durable Object WebSocket hibernation until replay metadata is stable**

Expected future migration:

```txt
1. Move from server.accept() event listeners to ctx.acceptWebSocket(server).
2. Store participant identity, connectionId, and lastSeenP2PServerSeq with serializeAttachment().
3. Rebuild in-memory socket maps from ctx.getWebSockets() after constructor wake.
4. Keep constructor work minimal.
5. Do not use setTimeout/setInterval loops that prevent hibernation.
```

Expected:

- hibernation is treated as a scale/cost hardening step, not the first reliability fix;
- when adopted, Durable Object wake-up does not lose connection identity;
- no media payload is ever routed through Durable Object.

- [ ] **Step 6.12: Run the P2P acceptance matrix before marking complete**

Manual scenario:

```txt
1. Mac host on Wi-Fi A creates a staging room.
2. Second Chrome profile joins the same machine.
3. Second physical device joins on the same Wi-Fi.
4. Second physical device joins through mobile hotspot.
5. One side reloads during camera negotiation.
6. One side sleeps/wakes the laptop or toggles Wi-Fi.
7. Both sides switch episode/source after P2P has connected.
8. Diagnostic build runs once with WXT_P2P_FORCE_RELAY=true.
9. Both sides export debug logs.
```

Expected:

- both sides see tiny remote camera bubbles in normal two-device cases;
- both sides hear push-to-talk audio;
- reload/rejoin does not require a new room;
- direct/STUN/TURN path is visible in debug export;
- no test requires video quality above the ultra-light contract;
- failures produce enough logs to classify the cause without guessing.

---

## Task 7: Make Source Switching First-Class

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi/packages/protocol/src/types.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/api/src/room-state.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/crunchyroll-control.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/crunchyroll-launcher.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/video-adapter.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/overlay-app.tsx`

- [ ] **Step 7.1: Add `SOURCE_CHANGED` server event**

Payload:

```ts
export interface SourceChangedPayload {
  roomId: string;
  sourceGeneration: number;
  byUserId: string;
  source: WatchSourceDescriptor;
  startTime: number;
  autoplay: boolean;
}
```

Expected:

- host switching to a different anime/movie propagates to viewers;
- viewer extension opens/navigates to the new `sourceUrl`;
- old P2P/playback messages from the previous source are ignored.

- [ ] **Step 7.2: Preserve existing working Crunchyroll episode switching**

Rule:

```txt
Do not remove existing Crunchyroll in-series episode switching behavior. Wrap it behind the new source event only where needed for cross-title switching.
```

Expected:

- switching episodes inside one series still works as today;
- switching to a different anime uses the new source descriptor flow.

- [ ] **Step 7.3: Add adapter readiness state**

Expected states:

```txt
detecting -> navigating -> player_ready -> sync_ready -> failed
```

Expected:

- viewer does not apply seek/play until the target video element is ready;
- source switch failures show a small recoverable status in the overlay.

- [ ] **Step 7.4: Test source switching manually**

Manual scenario:

```txt
Host opens Crunchyroll anime A episode 1.
Viewer joins.
Host switches to anime A episode 2.
Viewer follows.
Host switches to anime B episode 1.
Viewer follows.
Host seeks to 50%.
Viewer catches up.
```

Expected:

- viewer follows both same-series and different-series switches;
- overlay remains attached after Crunchyroll route changes;
- no stale P2P renegotiation from previous source breaks media.

---

## Task 8: Persist Shared Watch Progress

**Files:**

- Create/Modify: `/Users/vladyslavhulyi/anidachi/apps/web/supabase/migrations/*_watch_progress.sql`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/web/lib/anidachi-auth/db.ts`
- Create: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/watch-progress/checkpoint/route.ts`
- Create: `/Users/vladyslavhulyi/anidachi/apps/web/app/api/watch-progress/recent/route.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/watch-progress.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/crunchyroll-progress.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/popup-app.tsx`
- Test: `/Users/vladyslavhulyi/anidachi/apps/extension/test/watch-progress.test.ts`

- [ ] **Step 8.1: Add session-level progress tables**

Tables:

```sql
create table if not exists public.watch_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(room_id),
  source_url text not null,
  canonical_url text not null,
  provider text not null,
  title text not null,
  series_title text,
  episode_title text,
  duration_seconds numeric,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid not null references public.users(id)
);

create table if not exists public.watch_session_participants (
  watch_session_id uuid not null references public.watch_sessions(id) on delete cascade,
  user_id uuid not null references public.users(id),
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (watch_session_id, user_id)
);

create table if not exists public.watch_progress_latest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  watch_session_id uuid not null references public.watch_sessions(id) on delete cascade,
  room_id uuid references public.rooms(room_id),
  current_time_seconds numeric not null,
  duration_seconds numeric,
  progress numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.users(id)
);

create table if not exists public.watch_progress_checkpoints (
  id uuid primary key default gen_random_uuid(),
  watch_session_id uuid not null references public.watch_sessions(id) on delete cascade,
  room_id uuid references public.rooms(room_id),
  user_id uuid not null references public.users(id),
  reason text not null,
  current_time_seconds numeric not null,
  duration_seconds numeric,
  created_at timestamptz not null default now()
);
```

Expected:

- one room can create one watch session per source;
- one episode/movie can show solo, pair, and group progress lanes;
- history survives room close.

- [ ] **Step 8.2: Checkpoint only meaningful moments**

Checkpoint reasons:

```txt
room_created
participant_joined
source_changed
pause
seek_settled
interval_30s
pagehide
room_ended
episode_finished
```

Expected:

- no per-second writes to Postgres;
- progress UI remains accurate enough for resume.

- [ ] **Step 8.3: Keep local cache for popup speed**

Expected:

- popup reads cached progress immediately from `chrome.storage.local`;
- authenticated extension refreshes from `/api/watch-progress/recent`;
- stale local prototype demo sessions are removed or clearly isolated behind an experiment flag.

- [ ] **Step 8.4: Test progress merge**

Test case:

```txt
Given pair session watched episode to 50%
And group session watched same episode to 100%
When popup renders the episode
Then one layered timeline is shown
And group segment sits under pair segment
And avatar markers are clickable
```

Run:

```bash
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/extension test -- watch-progress
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/web test -- watch-progress
```

Expected:

- timeline layering is deterministic;
- backend recent-progress endpoint returns normalized session rows.

---

## Task 9: Add Observability And Debug Export

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/debug-log.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/extension/src/debug-probe.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/api/src/index.ts`
- Modify: `/Users/vladyslavhulyi/anidachi/apps/api/src/room-state.ts`

- [ ] **Step 9.1: Standardize debug event names**

Required categories:

```txt
auth.*
room.http.*
room.ws.*
room.snapshot.*
room.source.*
p2p.ice.*
p2p.negotiation.*
p2p.media.*
progress.*
adapter.*
overlay.*
```

Expected:

- every room/P2P bug report can be traced from extension logs and Worker logs.

- [ ] **Step 9.2: Add one-click debug export in extension debug area**

Expected export fields:

```txt
extension build id
user id hash
room id
room generation
source generation
last 300 debug events
browser
platform
selected ICE candidate types per peer
last room error
```

Expected:

- user can send one debug file without exposing access tokens or secrets.

- [ ] **Step 9.3: Add Worker request correlation**

Expected:

- every HTTP and WebSocket handshake logs a `requestId`;
- room DO logs include `roomId`, `serverSeq`, `connectionId`, and event type.

---

## Task 10: Commercial Release Gates

**Files:**

- Modify: `/Users/vladyslavhulyi/anidachi/docs/architecture.md`
- Modify: `/Users/vladyslavhulyi/anidachi/docs/site-extension-integration-notes.md`
- Modify: `/Users/vladyslavhulyi/anidachi/docs/shared-watch-progress-tracker.md`
- Modify: `/Users/vladyslavhulyi/anidachi/anidachi-extension-public`

- [ ] **Step 10.1: Run full automated verification**

Run:

```bash
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/protocol test
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/api test
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/extension test
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/web test
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/protocol check
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/api check
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/extension check
pnpm -C /Users/vladyslavhulyi/anidachi --filter @anidachi/web check
```

Expected:

- all tests pass;
- TypeScript checks pass;
- no code path relies on guest identity for room membership.

- [ ] **Step 10.2: Run two-device manual acceptance test**

Manual matrix:

```txt
Mac host + Windows viewer
Windows host + Mac viewer
Crunchyroll same episode
Crunchyroll same-series episode switch
Crunchyroll different-anime switch
YouTube room
fullscreen overlay
P2P camera both directions
push-to-talk audio both directions
chat/reactions both directions
leave/rejoin
page reload
network interruption
```

Expected:

- both sides see and hear each other when camera/audio are enabled;
- direct/STUN/TURN path is visible in debug logs;
- room survives reload;
- stale rooms do not block new rooms.

- [ ] **Step 10.3: Build public extension package**

Run:

```bash
pnpm -C /Users/vladyslavhulyi/anidachi build:extension:public
```

Expected:

- `/Users/vladyslavhulyi/anidachi/anidachi-extension-public` is updated;
- `/Users/vladyslavhulyi/anidachi/anidachi-extension-public.zip` is updated;
- Chrome can load the unpacked folder without manifest errors.

- [ ] **Step 10.4: Update docs after implementation**

Expected docs updates:

```txt
docs/architecture.md explains the final control/live/runtime split.
docs/site-extension-integration-notes.md explains live website deployment and auth flow.
docs/shared-watch-progress-tracker.md explains production progress persistence.
docs/experimental-features.md records any remaining experimental features.
```

---

## Execution Order

1. Task 0: lock baseline.
2. Task 1: make code ownership and repo sync explicit.
3. Task 2: make auth reliable and remove guest room behavior.
4. Task 3: make room creation durable, idempotent, and lifecycle-aware.
5. Task 4: version protocol and snapshot handshake.
6. Task 5: add reconnect/resume.
7. Task 6: stabilize P2P and ICE behavior.
8. Task 7: make source switching first-class.
9. Task 8: persist shared watch progress.
10. Task 9: add observability.
11. Task 10: run commercial release gates.

## Commit Strategy

Each task should land as a separate commit:

```txt
docs: add commercial room architecture plan
chore: align website source of truth
feat: harden extension auth sessions
feat: add durable room lifecycle
feat: version room protocol snapshots
feat: add room websocket resume
feat: harden ultra-light p2p signaling
fix: remove production openrelay fallback
feat: add p2p reconnect diagnostics
feat: add source switch events
feat: persist shared watch progress
feat: add room and p2p debug export
docs: update commercial architecture notes
```

Rule:

```txt
Do not combine website auth, Worker protocol, and P2P media changes in one commit unless the test proves they are inseparable.
```

## Definition Of Done

- [ ] A signed-in user can create a room from the extension.
- [ ] A signed-in invited user can join through `https://www.anidachi.app/room/:roomId`.
- [ ] The website adds the invited user to room membership before extension connects to Worker.
- [ ] Extension connects to Worker using a room token, not guest identity.
- [ ] Durable Object sends a complete `ROOM_SNAPSHOT`.
- [ ] P2P starts only after snapshot readiness.
- [ ] Camera and push-to-talk audio work in both directions for two devices.
- [ ] P2P signaling has `clientSignalId`, `senderConnectionId`, `serverSeq`, dedupe, and bounded replay.
- [ ] Reload/rejoin during P2P negotiation does not require creating a new room.
- [ ] Video remains ultra-light and does not exceed the agreed bitrate/resolution/framerate contract.
- [ ] Production builds do not depend on OpenRelay TURN.
- [ ] Direct/STUN/TURN selected path is visible in logs.
- [ ] Host can switch episode and different anime; viewer follows.
- [ ] Playback sync still works after source switch.
- [ ] Stale rooms stop blocking new room creation.
- [ ] Watch progress checkpoints persist without per-second database writes.
- [ ] Popup can show layered pair/group/solo progress from real data.
- [ ] Public extension folder and zip build cleanly.
- [ ] Website and extension docs match deployed behavior.
