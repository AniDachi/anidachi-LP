# YouTube Playback Synchronization Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make YouTube room playback reliable across play, pause, seek, source
changes, personalized advertisements, buffering, playback-rate changes,
autoplay restrictions, and player replacement without regressing Crunchyroll.

**Architecture:** Keep the existing Cloudflare room host-authoritative and use
the existing `PlaybackState` and `WatchSourceDescriptor` contracts. Move
playback decisions out of `overlay-app.tsx` into one testable coordinator.
Provider adapters own provider identity, playback observations, advertisement
detection, player policies, and same-provider navigation; the shared
coordinator consumes normalized capabilities and never inspects YouTube or
Crunchyroll DOM.

**Tech Stack:** TypeScript 6, React 19, WXT 0.20, MV3 content scripts, native
`HTMLVideoElement`, Vitest 4, `@anidachi/protocol`, Cloudflare Durable Objects.

## Status And Relationship To Existing Plans

- Automated implementation Tasks 1–6 are complete on
  `codex/provider-adapter-lifecycle` through commit `1b7e5cc`. Task 7 adds
  privacy-safe diagnostics and this maintenance documentation. The extension
  suite passes 68 files / 729 tests and TypeScript check passes. This evidence
  does not claim real-ad or two-profile acceptance.
- Task 8 remains open: build/validate the final staging artifact, run the
  two-profile matrix, record evidence, and perform the Crunchyroll regression
  pass before moving PR #148 out of draft.
- This plan is the detailed execution plan for the unfinished playback and
  source-navigation portions of
  `docs/superpowers/plans/2026-07-22-source-adapters-architecture.md`, especially
  Tasks 8–12.
- The completed adapter lifecycle and player-chrome geometry work remain in
  place. This plan must not redo them.
- The current draft delivery vehicle remains PR `#148`; use reviewable commits
  inside that PR rather than one PR per task.
- This document is an execution map, not permission to ignore current source.
  At the start of every task, compare its assumptions with the active branch,
  tests, current development state, Graphify, and the previous task's result.
  If reality differs, amend this plan first and record why. Do not force an
  obsolete interface into the code merely because it appears below.

## Product Decisions

1. The room host remains the only authoritative playback controller.
   A guest interaction with native YouTube controls sends no authoritative
   room command and is reconciled immediately to the latest host state with a
   transient `Host controls playback` status.
2. A room provider is pinned for the lifetime of the active room:
   - a host pins it from the adapter used to create the room;
   - a guest pins it from the first validated authoritative room source;
   - reconnect or hard navigation reconstructs it from the room snapshot;
   - leaving or ending the room clears it.
3. A YouTube room can switch only between valid YouTube videos. A Crunchyroll
   room can switch only between valid Crunchyroll resources. Cross-provider
   source changes are rejected locally without navigation or playback effects.
   The `generic` fallback remains same-page only: it may synchronize the
   currently bound finite media element, but cross-document generic source
   navigation returns `unsupported`.
4. Advertisements are local provider interstitials, not room media:
   - AniDachi never blocks, skips, seeks, pauses, or synchronizes the ad itself;
   - ad `currentTime`, duration, play, pause, and seek events never become room
     content state;
   - a host ad holds the shared content timeline at the last confirmed content
     time;
   - a guest ad does not pause the room; the guest queues the latest
     authoritative content state and catches up after the ad;
   - no code assumes that two users receive an ad, the same ad, or an ad of the
     same duration.
5. Host buffering longer than a short debounce holds the room. Guest buffering
   is local and recovers to the latest host state.
6. Host playback rate is authoritative and must be applied to guests.
7. A browser-blocked remote play is visible and recoverable through one
   user-gesture action. It must not create an infinite retry loop.
8. The public YouTube API does not expose a documented ad state. YouTube DOM
   signals are therefore isolated, bounded implementation details inside the
   YouTube adapter, with fail-closed behavior and diagnostics.
9. The first release-hardening scope is finite-duration YouTube VOD on an
   eligible watch route. A live stream, DVR stream, premiere before VOD
   availability, or player with no stable finite timeline is reported as
   unsupported and cannot silently enter normal room synchronization.
10. A reconnecting host does not repin a room from the adapter on the newly
    loaded page. It waits for the authoritative room snapshot and reconstructs
    the pinned provider from that source. Until then, host heartbeat and local
    playback events are suspended.

## Global Constraints

- Start each task from a clean worktree on
  `codex/provider-adapter-lifecycle`, synchronized with the current PR branch.
- Use Node `22.23.1` and pnpm `11.2.2`.
- Use TDD for every behavioral change: observe RED, implement the minimum
  complete behavior, then observe GREEN.
- Do not change P2P media, camera, microphone, media-seat, auth, billing,
  database, or public-site behavior.
- Do not change protocol schemas. The current contracts already express the
  required source and playback state.
- Task 3 includes one scoped Worker/RoomState correction proven necessary by
  source audit: first source initialization must be broadcast and the room's
  initialized provider must be enforced. Do not broaden that task into a room
  protocol rewrite.
- Do not use undocumented YouTube player methods for navigation or ad control.
- Do not block, hide, shorten, or skip YouTube advertisements.
- Do not obscure YouTube ad controls, attribution, or standard playback
  controls with a synchronization status or recovery action.
- Keep YouTube selectors under
  `apps/extension/src/source-adapters/youtube/`.
- Keep Crunchyroll selectors and MAIN-world bridge behavior under
  `apps/extension/src/source-adapters/crunchyroll/`.
- Shared room and playback code must not compare `adapter.id` with provider
  names.
- Constructors must not register listeners, observers, timers, or global
  handlers. Subscription and controller cleanup must be explicit and
  idempotent.
- Unknown provider state must suspend remote playback rather than applying a
  command to a possibly wrong video.
- A source transition is a playback barrier: while navigation, URL identity,
  adapter identity, or room-provider identity is unresolved, do not send or
  apply playback commands. Keep only the newest authoritative host state.
- Preserve the current 1.5-second host heartbeat, drift thresholds, remote
  command deduplication, and local-event suppression until characterization
  tests prove an intentional replacement.
- Do not add dependencies for functionality available through the platform and
  current codebase.
- Do not refresh Graphify team artifacts until meaningful source or
  architecture changes are ready for review.

## External Constraints Verified On 2026-07-23

- The official YouTube IFrame Player API documents playback state, playback
  rate, errors, and autoplay-blocked events, but no advertisement state:
  <https://developers.google.com/youtube/iframe_api_reference>.
- YouTube developer policy prohibits modifying, blocking, replacing, or
  interfering with YouTube advertisements and player functionality:
  <https://developers.google.com/youtube/terms/developer-policies>.
- `HTMLMediaElement.play()` can reject with `NotAllowedError` when scripted
  playback lacks user activation, so a visible user-gesture recovery is
  required:
  <https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play>.

These references constrain behavior; they do not authorize use of the IFrame
API against YouTube's own page player. The extension continues to use the
native media element and bounded page observations already available to its
content script.

## Current Verified Baseline

- `RoomState.updateHostState()` and `RoomState.canControlPlayback()` accept only
  the joined host.
- The first `undefined source -> valid source` update currently does not set
  `sourceChanged`, so a guest connected before that update can receive a plain
  `HOST_STATE` without the source required to pin its provider.
- Host play, pause, and seek are broadcast immediately.
- A local guest playback event currently attempts a command that the Worker
  rejects because only the host can control playback.
- Host state is sent every 1.5 seconds while the adapter is active.
- Remote commands are deduplicated and local events are suppressed while
  remote commands settle.
- The current YouTube adapter inherits native HTML5 playback behavior.
- The adapter lifecycle suspends old playback bindings and replaces reused
  YouTube video elements when the URL fingerprint changes.
- YouTube currently has no advertisement-phase detection.
- YouTube currently ignores a mismatched remote fingerprint instead of
  navigating to the host's new YouTube video.
- `PlaybackState.playbackRate` exists, but guests do not apply it and the
  adapter does not emit `ratechange`.
- Remote autoplay failures are logged but not recoverable through the UI.
- Existing focused baseline on 2026-07-23:
  - extension playback/adapter: 4 files / 29 tests;
  - protocol: 1 file / 29 tests;
  - API room state: 1 file / 17 tests.

## Target File Structure

```text
apps/extension/src/
  playback-sync-controller.ts
  playback-sync-status.ts
  source-adapters/
    core/
      types.ts
      playback-policy.ts
      source-navigation.ts
      source-descriptor.ts
    generic/
      adapter.ts
    youtube/
      adapter.ts
      definition.ts
      navigation.ts
      playback-phase.ts
      url.ts
    crunchyroll/
      adapter.ts
      navigation.ts
    registry.ts

apps/extension/test/
  playback-sync-controller.test.ts
  playback-sync-status.test.ts
  source-adapters/
    source-switching.test.ts
    youtube/
      navigation.test.ts
      playback-phase.test.ts
      sync-integration.test.ts
    crunchyroll/
      navigation.test.ts
```

Existing tests remain in place. Do not move files merely to match this tree
unless a task explicitly names the move.

## Provisional Interfaces And Dependency Direction

These interfaces make ownership and test seams concrete, but they are not a
license to force a stale abstraction into the implementation. Task 1 may
rename or reduce them after the pre-task source audit if the same dependency
direction, lifecycle guarantees, and product decisions are preserved and this
plan is amended first.

Add the following provider-neutral playback contracts to
`apps/extension/src/source-adapters/core/types.ts`:

```ts
export type AdapterPlaybackPhase =
  | "content"
  | "interstitial"
  | "buffering"
  | "transition"
  | "unsupported";

export interface AdapterPlaybackSnapshot {
  phase: AdapterPlaybackPhase;
  contentTime: number;
  playing: boolean;
  playbackRate: number;
  capturedAt: number;
}

export interface AdapterPlaybackPolicy {
  playBeforeMediaReady: boolean;
  readyTimeoutMs: number;
  skipPlayAfterTimeoutWhileSettling: boolean;
  remoteSeekThrottleMs: number;
  remoteSeekTargetToleranceSeconds: number;
  pendingSeekGuard: null | {
    maxAgeMs: number;
    localTargetToleranceSeconds: number;
    remoteTargetToleranceSeconds: number;
  };
  localSeekCoalescing: null | {
    settleDelayMs: number;
    readyDelayMs: number;
    duplicateWindowMs: number;
    targetToleranceSeconds: number;
    suppressPlaybackAfterSeekMs: number;
  };
  hostBufferingHoldDelayMs: number;
}

export type PlayerEvent =
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number }
  | { type: "timeupdate"; time: number }
  | { type: "ratechange"; time: number; playbackRate: number }
  | { type: "phasechange"; snapshot: AdapterPlaybackSnapshot };
```

Retain the complete `VideoAdapter` contract defined in
`2026-07-22-source-adapters-architecture.md`, including identity, overlay
geometry, progress, fullscreen, volume ducking, subscription, and disposal.
Add only these provider-neutral playback capabilities; do not redefine a
smaller parallel adapter contract:

```ts
export interface VideoAdapter {
  getPlaybackSnapshot(): AdapterPlaybackSnapshot;
  setPlaybackRate(rate: number): void;
}
```

Extend the existing source-navigation contract from
`2026-07-22-source-adapters-architecture.md`; do not create a second navigator
registry:

```ts
export interface SourceNavigationContext {
  roomId: string | null;
  roomProvider: SourceProvider;
  signal: AbortSignal;
}

export type EnsureSourceResult =
  | { status: "already-current" }
  | { status: "navigation-started"; targetUrl: string }
  | {
      status: "unsupported";
      reason:
        | "provider-mismatch"
        | "invalid-source"
        | "unsupported-route";
    }
  | { status: "failed"; reason: "navigation-failed" };

export interface SourceAdapterDefinition {
  readonly provider: SourceProvider;
  ensureSource(
    source: WatchSourceDescriptor,
    context: SourceNavigationContext,
  ): Promise<EnsureSourceResult>;
}
```

Provider implementations may receive injected `location.assign`/bridge seams
privately for tests. Runtime lookup remains
`getDefinitionForProvider(roomProvider)`.

Define statuses in `apps/extension/src/playback-sync-status.ts` and the
coordinator surface in `apps/extension/src/playback-sync-controller.ts`:

```ts
export type PlaybackSyncStatus =
  | { kind: "synced" }
  | { kind: "host-controls-playback" }
  | { kind: "buffering" }
  | { kind: "out-of-sync"; expectedTime: number; drift: number }
  | { kind: "waiting-for-host-ad" }
  | { kind: "watching-local-ad" }
  | { kind: "resume-required" }
  | { kind: "unsupported-media"; message: string }
  | { kind: "sync-error"; message: string }
  | { kind: "source-mismatch"; message: string };

export interface PlaybackSyncSession {
  roomId: string | null;
  participantId: string | null;
  isHost: boolean;
  roomProvider: SourceProvider | null;
  roomGeneration: number;
  sourceGeneration: number;
  connectionGeneration: number;
}

export interface PlaybackSyncTransport {
  send(event: ClientEvent): void;
}

export interface PlaybackSyncControllerOptions {
  transport: PlaybackSyncTransport;
  ensureRemoteSource(
    source: WatchSourceDescriptor,
    context: SourceNavigationContext,
  ): Promise<EnsureSourceResult>;
  onStatus(status: PlaybackSyncStatus): void;
  now?: () => number;
}

export class PlaybackSyncController {
  constructor(options: PlaybackSyncControllerOptions);
  bindAdapter(adapter: VideoAdapter | null): void;
  setSession(session: PlaybackSyncSession): void;
  pinRoomProvider(provider: SourceProvider): boolean;
  handleLocalEvent(event: PlayerEvent): void;
  handleHostState(
    state: PlaybackState,
    source?: WatchSourceDescriptor,
  ): Promise<void>;
  handleRemoteCommand(
    event: Extract<ServerEvent, { type: "PLAY" | "PAUSE" | "SEEK" }>,
  ): void;
  heartbeat(): void;
  catchUpFromUserGesture(): void;
  resumeFromUserGesture(): Promise<void>;
  suspend(): void;
  dispose(): void;
}
```

The controller maintains a private epoch containing session, connection,
source, and adapter generations. Every async play/readiness/navigation result
captures that epoch and checks it again after each `await`. A late result from
an old adapter, connection, source, room, sign-out, or disposed controller is a
no-op. The UI never calls `adapter.seek()` directly for catch-up; it invokes
`catchUpFromUserGesture()` so source, phase, and suppression guards remain
centralized.

The implementation may keep private helper types private. The dependency
direction is the stable part: adapters normalize provider state, the
coordinator owns synchronization decisions, and React renders status and
forwards room lifecycle. Public names may change when the pre-task review finds
a concrete conflict and records the amendment.

---

### Task 1: Characterize And Extract The Playback Coordinator

**Files:**
- Create: `apps/extension/src/playback-sync-controller.ts`
- Create: `apps/extension/src/playback-sync-status.ts`
- Create: `apps/extension/test/playback-sync-controller.test.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/active-adapter-playback.ts`
- Test: `apps/extension/test/playback-control.test.ts`
- Test: `apps/extension/test/active-adapter-playback.test.tsx`

**Consumes:** Current `VideoAdapter`, `RoomClient.send()`, protocol playback
events, `playback-control.ts`, and the current refs/constants in
`overlay-app.tsx`.

**Produces:** A tested coordinator that preserves accepted play, pause, seek,
heartbeat, drift, deduplication, readiness, suppression, and suspension
outcomes before any YouTube-specific feature is added. The one intentional
transport cleanup is that guest playback events are rejected locally instead
of sending commands the Worker already rejects.

- [ ] **Step 1: Re-audit current behavior before extraction**

Run:

```bash
git status --short --branch
graphify query "Trace current host and guest playback synchronization from VideoAdapter events through the Worker and back."
rg -n "sync\\.|REMOTE_|HOST_STATE|PLAY|PAUSE|SEEK|adapter\\.id" \
  apps/extension/src/overlay-app.tsx \
  apps/extension/src/playback-control.ts \
  apps/extension/src/active-adapter-playback.ts
```

Expected: clean worktree; the Graphify trace and source agree with the baseline
above. If they do not, update this plan before editing code.

- [ ] **Step 2: Write failing coordinator characterization tests**

Cover these exact cases with a fake adapter, fake transport, and fake clock:

```ts
it("broadcasts host play pause and seek once");
it("rejects local guest control as authoritative state");
it("reconciles a guest control immediately without sending transport events");
it("sends host heartbeat every caller tick without duplicating local commands");
it("suppresses events caused by a remote command");
it("ignores a repeated remote command inside the dedupe window");
it("seeks medium and large host drift using existing thresholds");
it("waits for non-Crunchyroll media readiness before remote play");
it("cancels pending play when pause arrives");
it("does not apply remote state while the adapter is suspended");
it("disposes timers and adapter subscriptions exactly once");
it("does not heartbeat before a reconnecting room provider is restored");
it("ignores a late play completion after adapter replacement");
it("ignores a late readiness completion after reconnect or source change");
it("ignores every async completion after sign-out or dispose");
it("routes manual catch-up through the coordinator");
```

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/playback-sync-controller.test.ts
```

Expected: FAIL because `PlaybackSyncController` does not exist.

- [ ] **Step 3: Move existing decisions without changing thresholds**

Implement the provisional coordinator interface. Move only playback refs, timers,
dedupe state, pending play, pending seek, and remote application decisions.
Keep React room/auth/P2P/UI state in `OverlayApp`. `OverlayApp` passes room
session changes and server events to the controller. Preserve all current
timing constants. Enforce the existing host-only Worker contract locally so
guest events do not create rejected network traffic.
Move the current `{ expectedTime, drift }` catch-up state and action behind
`PlaybackSyncStatus` and `catchUpFromUserGesture()`; do not leave a direct
adapter seek path in React.

- [ ] **Step 4: Remove the moved duplicate logic**

After controller tests pass, remove the old playback callbacks and refs from
`overlay-app.tsx`. There must be one owner for each timer, suppression window,
pending command, and adapter playback subscription.

- [ ] **Step 5: Verify extraction**

Run:

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/playback-sync-controller.test.ts \
  test/playback-control.test.ts \
  test/active-adapter-playback.test.tsx
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
```

Expected: all tests and typecheck pass with no accepted room-behavior change;
the only transport-level difference is removal of rejected guest commands.

- [ ] **Step 6: Commit**

```bash
git add apps/extension/src/playback-sync-controller.ts \
  apps/extension/src/playback-sync-status.ts \
  apps/extension/src/overlay-app.tsx \
  apps/extension/src/active-adapter-playback.ts \
  apps/extension/test/playback-sync-controller.test.ts \
  apps/extension/test/playback-control.test.ts \
  apps/extension/test/active-adapter-playback.test.tsx
git commit -m "refactor(extension): isolate playback sync controller"
```

---

### Task 2: Replace Provider Branches With Playback Capabilities

**Files:**
- Create: `apps/extension/src/source-adapters/core/playback-policy.ts`
- Modify: `apps/extension/src/source-adapters/core/types.ts`
- Modify: `apps/extension/src/source-adapters/core/html5-video-adapter.ts`
- Modify: `apps/extension/src/source-adapters/generic/adapter.ts`
- Modify: `apps/extension/src/source-adapters/youtube/adapter.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/adapter.ts`
- Modify: `apps/extension/src/source-adapters/core/source-descriptor.ts`
- Modify: `apps/extension/src/playback-control.ts`
- Modify: `apps/extension/src/playback-sync-controller.ts`
- Modify: `apps/extension/entrypoints/content.tsx`
- Test: provider adapter and playback suites

**Consumes:** The provisional contracts above and current Crunchyroll timing
constants.

**Produces:** Explicit provider, source descriptor, playback policy,
playback snapshot, and playback-rate capabilities. Shared runtime contains no
provider-name comparisons.

- [ ] **Step 1: Write failing capability tests**

Add exact assertions:

```ts
expect(generic.provider).toBe("generic");
expect(youtube.provider).toBe("youtube");
expect(crunchyroll.provider).toBe("crunchyroll");
expect(youtube.getPlaybackSnapshot().phase).toBe("content");
expect(youtube.getSourceDescriptor()?.provider).toBe("youtube");
expect(crunchyroll.playbackPolicy.readyTimeoutMs).toBe(6500);
```

Also assert that `setPlaybackRate(1.5)` writes `video.playbackRate` and that
`ratechange` emits `{ type: "ratechange", playbackRate: 1.5 }`.

- [ ] **Step 2: Run tests and observe RED**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/source-adapters \
  test/video-adapter.test.ts \
  test/playback-control.test.ts
```

Expected: FAIL on missing capabilities.

- [ ] **Step 3: Implement default and Crunchyroll policies**

Implement the full policy shape already defined by the source-adapter plan.
Generic and YouTube preserve the existing 2.5-second ready behavior and no seek
guards/coalescing. Crunchyroll preserves all currently accepted values:
immediate play behavior, 6.5-second readiness timeout, 2.4-second remote seek
throttle, 3-second duplicate-target tolerance, 15-second pending-seek guard,
and all current local-seek coalescing timings. Add only the new
`hostBufferingHoldDelayMs: 500` field. Characterization tests must prove that
none of the Crunchyroll guards disappear during migration.

- [ ] **Step 4: Move descriptor ownership into adapters**

`getSourceDescriptor()` must use one adapter-owned provider and the existing
bounded canonical URL helper. Remove `watchProviderFromAdapterId()` and
provider mapping from `content.tsx`.

- [ ] **Step 5: Replace shared provider comparisons**

Run:

```bash
rg -n 'adapter\\.id\\s*[!=]==?\\s*["\x27](youtube|crunchyroll)' \
  apps/extension/entrypoints/content.tsx \
  apps/extension/src/overlay-app.tsx \
  apps/extension/src/playback-control.ts \
  apps/extension/src/playback-sync-controller.ts
```

Expected: no matches. Provider-specific adapters may still compare their own
local state.

- [ ] **Step 6: Verify and commit**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test
git status --short
git add apps/extension/src/source-adapters/core/playback-policy.ts \
  apps/extension/src/source-adapters/core/types.ts \
  apps/extension/src/source-adapters/core/html5-video-adapter.ts \
  apps/extension/src/source-adapters/core/source-descriptor.ts \
  apps/extension/src/source-adapters/generic/adapter.ts \
  apps/extension/src/source-adapters/youtube/adapter.ts \
  apps/extension/src/source-adapters/crunchyroll/adapter.ts \
  apps/extension/src/playback-control.ts \
  apps/extension/src/playback-sync-controller.ts \
  apps/extension/entrypoints/content.tsx \
  apps/extension/test/playback-control.test.ts \
  apps/extension/test/video-adapter.test.ts \
  apps/extension/test/source-adapters/core/source-descriptor.test.ts \
  apps/extension/test/source-adapters/generic/adapter.test.ts \
  apps/extension/test/source-adapters/youtube/adapter.test.ts \
  apps/extension/test/source-adapters/crunchyroll/adapter.test.ts
git commit -m "refactor(extension): consume provider playback capabilities"
```

---

### Task 3: Pin Room Provider And Add Safe YouTube Source Switching

**Files:**
- Create: `apps/extension/src/source-adapters/core/source-navigation.ts`
- Create: `apps/extension/src/source-adapters/youtube/navigation.ts`
- Create: `apps/extension/src/source-adapters/crunchyroll/navigation.ts`
- Create: `apps/extension/test/source-adapters/youtube/navigation.test.ts`
- Create: `apps/extension/test/source-adapters/crunchyroll/navigation.test.ts`
- Create: `apps/extension/test/source-adapters/source-switching.test.ts`
- Modify: `apps/api/src/room-state.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/test/room-state.test.ts`
- Modify: `apps/extension/src/source-adapters/registry.ts`
- Modify: `apps/extension/src/playback-sync-controller.ts`
- Modify: `apps/extension/src/overlay-app.tsx`

**Consumes:** Adapter `provider`, adapter source descriptors, current
Crunchyroll MAIN-world navigation, room snapshots, `SOURCE_CHANGED`, and
room-session hash persistence.

**Produces:** Provider-pinned rooms and one pre-navigation operation. Guests
follow same-provider host source changes and never apply remote commands to a
previous or foreign-provider video. The Worker initializes and enforces the
same provider without changing the public event schema.

- [ ] **Step 1: Write failing navigation validation tests**

YouTube tests must cover:

```ts
it("returns already-current for the same canonical YouTube video");
it("assigns a canonical watch URL for a different valid YouTube video");
it("preserves the active room id in the target hash");
it("rejects javascript and foreign-host URLs");
it("rejects malformed and unsupported YouTube routes");
it("does not call undocumented YouTube navigation methods");
it("honors an aborted navigation operation");
```

Crunchyroll tests must preserve the existing MAIN-world command and hard
fallback.

- [ ] **Step 2: Write failing room-provider tests**

Cover:

```ts
it("pins a host room from the active adapter provider");
it("pins a guest room from the first authoritative source");
it("keeps the provider immutable until the room resets");
it("rejects a cross-provider source before navigation");
it("rejects cross-document navigation for the generic fallback");
it("holds remote playback while same-provider navigation is pending");
it("applies the newest queued host state after the target adapter binds");
it("cancels an older source navigation when a newer source arrives");
it("reconstructs the provider from a room snapshot after hard navigation");
it("keeps a reconnecting host suspended until the authoritative snapshot");
it("does not pin a reconnecting host from a foreign local adapter");
it("drops direct playback commands while source navigation is pending");
it("does not apply a pre-navigation command to the replacement adapter");
it("resumes heartbeat only after provider and adapter identities agree");
it("rejects a descriptor whose provider url fingerprint tuple disagrees");
```

API tests must cover:

```ts
it("publishes source initialization to participants already in the room");
it("increments source generation on first valid source initialization");
it("accepts a later source within the initialized provider");
it("rejects a later source from a different provider without changing room state");
it("rejects a source whose provider conflicts with its fingerprint or host");
it("restores the initialized provider from persisted room state");
```

- [ ] **Step 3: Run tests and observe RED**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/source-adapters/youtube/navigation.test.ts \
  test/source-adapters/crunchyroll/navigation.test.ts \
  test/source-adapters/source-switching.test.ts
fnm exec --using=22.23.1 pnpm --filter @anidachi/api exec vitest run \
  test/room-state.test.ts
```

- [ ] **Step 4: Implement provider navigation**

Add one provider-definition lookup and one `ensureSource()` path. YouTube must
use the existing canonical ID parser, rebuild a canonical watch
URL from the validated video ID, preserve only the AniDachi room hash, and call
`location.assign(canonicalTarget)`. Do not navigate to an incoming descriptor
URL verbatim and do not use YouTube internal player methods. Crunchyroll must
move, not duplicate, the current navigation helper.

`AbortSignal` cancels validation, coalescing, and work before navigation starts;
it cannot undo `location.assign()` after dispatch. Coalesce rapid source
updates before one assign, record the intended source generation, and after
reload trust only the newest authoritative room snapshot.

- [ ] **Step 5: Route authoritative source through the controller**

Pass `ROOM_SNAPSHOT.source` and `SOURCE_CHANGED.source` together with host
state. Do not reduce authoritative source events to fingerprint-only state.
Reset the pinned provider only when the room ends, the user leaves, signs out,
or switches account. A fresh room creation pins before the first host state. A
restored room, including a restored host room, pins only from its validated
snapshot source. With a room ID but no restored provider, neither local
commands nor heartbeat may leave the controller.

In `RoomState`, treat the first `undefined source -> valid source` transition as
source initialization, bump `sourceGeneration`, persist it, and broadcast the
existing `SOURCE_CHANGED` event. Derive and store the pinned provider from that
validated source. Same-provider source changes remain valid; a conflicting
provider or inconsistent `provider + canonical host/route + fingerprint`
tuple is rejected without mutating host state or source. Return a bounded
`SOURCE_PROVIDER_MISMATCH`/`INVALID_SOURCE` error; no new protocol shape is
needed because server error codes are strings.

- [ ] **Step 6: Verify and commit**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test
fnm exec --using=22.23.1 pnpm --filter @anidachi/api test
git status --short
git add apps/api/src/room-state.ts apps/api/src/index.ts \
  apps/api/test/room-state.test.ts \
  apps/extension/src/source-adapters/core/source-navigation.ts \
  apps/extension/src/source-adapters/youtube/navigation.ts \
  apps/extension/src/source-adapters/crunchyroll/navigation.ts \
  apps/extension/src/source-adapters/registry.ts \
  apps/extension/src/playback-sync-controller.ts \
  apps/extension/src/overlay-app.tsx \
  apps/extension/test/source-adapters/youtube/navigation.test.ts \
  apps/extension/test/source-adapters/crunchyroll/navigation.test.ts \
  apps/extension/test/source-adapters/source-switching.test.ts
git commit -m "feat(room): enforce provider-safe source switching"
```

---

### Task 4: Detect YouTube Content, Advertisement, Buffering, And Transition Phases

**Files:**
- Create: `apps/extension/src/source-adapters/youtube/playback-phase.ts`
- Create: `apps/extension/test/source-adapters/youtube/playback-phase.test.ts`
- Modify: `apps/extension/src/source-adapters/youtube/adapter.ts`
- Modify: `apps/extension/src/source-adapters/core/html5-video-adapter.ts`

**Consumes:** YouTube player container, native media readiness, active watch
URL, and stable video fingerprint.

**Produces:** A YouTube-only tracker that emits normalized phase snapshots,
keeps the last confirmed content time, and never exposes ad media time as room
content time.

- [ ] **Step 1: Write failing pure phase-detection tests**

Cover:

```ts
it("reports content for a ready watch video");
it("reports interstitial when the player has the ad-showing class");
it("does not confirm an interstitial from one weak marker alone");
it("confirms an interstitial from corroborated visible ad signals");
it("ignores hidden persistent ad-module nodes");
it("does not exit between consecutive ads in one ad pod");
it("does not leak an ad media event that beats the observer callback");
it("keeps ad buffering inside the interstitial phase");
it("prefers transition when an ad signal overlaps a SPA source change");
it("reports transition when the watch id and adapter fingerprint disagree");
it("reports buffering for content with insufficient readyState");
it("reports unsupported for live or non-finite media after metadata is ready");
it("keeps loading media in transition instead of prematurely calling it unsupported");
it("keeps the last content time while an interstitial video time advances");
it("returns to content with the new content time after the ad");
```

- [ ] **Step 2: Run tests and observe RED**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/source-adapters/youtube/playback-phase.test.ts
```

- [ ] **Step 3: Implement bounded DOM detection**

Use `#movie_player` / `.html5-video-player` state and visible markers scoped to
that container. Classify `ad-showing` as a strong signal. A weak persistent DOM
marker cannot confirm an ad by itself; require corroboration from a second
bounded player signal. Use tested entry/exit hysteresis so a brief DOM gap
between ads in one ad pod does not resume room content. Observe only:

```text
class changes on the player
child insertion/removal under player ad containers
loadstart, loadedmetadata, emptied
waiting, stalled, canplay, playing
```

Do not observe the whole page indefinitely. Deduplicate unchanged snapshots.
Cleanup disconnects the observer and all media listeners exactly once.
Resolve simultaneous signals in this order:

```text
transition -> interstitial -> unsupported -> buffering -> content
```

This prevents a temporary source mismatch from being treated as an ad and
prevents ad media duration from being used to classify the underlying content.
Before every local event, heartbeat, and remote media operation, the
coordinator synchronously reads `adapter.getPlaybackSnapshot()`. The observer
is a change notification, not the sole phase authority.

- [ ] **Step 4: Implement fail-closed fallback**

If URL identity, video identity, or player readiness is contradictory, return
`transition`; do not guess `content`. Diagnostic output must contain phase and
bounded booleans, not ad URLs or ad metadata.

- [ ] **Step 5: Verify and commit**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/source-adapters/youtube/playback-phase.test.ts \
  test/source-adapters/youtube/adapter.test.ts
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
git add apps/extension/src/source-adapters/youtube \
  apps/extension/src/source-adapters/core/html5-video-adapter.ts \
  apps/extension/test/source-adapters/youtube
git commit -m "feat(extension): classify youtube playback phases"
```

---

### Task 5: Apply Phase Barriers And Host/Guest Advertisement Policy

**Files:**
- Modify: `apps/extension/src/playback-sync-controller.ts`
- Create: `apps/extension/test/source-adapters/youtube/sync-integration.test.ts`
- Modify: `apps/extension/test/playback-sync-controller.test.ts`
- Modify: `apps/extension/src/playback-sync-status.ts`
- Create: `apps/extension/test/playback-sync-status.test.ts`
- Modify: `apps/extension/src/overlay-app.tsx`

**Consumes:** Normalized phase changes, last confirmed content time, latest
authoritative host state, and local host/guest role.

**Produces:** Deterministic ad isolation without synchronizing or controlling
the advertisement.

- [ ] **Step 1: Write failing host-ad tests**

Cover:

```ts
it("sends one content hold when the host enters an interstitial");
it("uses the last content time instead of the ad currentTime");
it("suppresses ad play pause seek and heartbeat events");
it("suppresses ad ratechange events");
it("does not call pause seek or play on the host advertisement");
it("holds at zero for a pre-roll before any content time is confirmed");
it("persists one paused HOST_STATE hold for join and reconnect snapshots");
it("resumes from current content state after the host ad ends");
it("does not emit duplicate hold or resume commands");
```

- [ ] **Step 2: Write failing guest-ad tests**

Cover:

```ts
it("does not pause the room when only a guest sees an ad");
it("does not apply remote commands to the guest advertisement");
it("keeps only the newest authoritative host state during the ad");
it("applies the newest host state after the guest ad ends");
it("remains paused after the ad when the host is paused");
it("recovers when the host also entered an ad during the guest ad");
it("does not apply a queued state until content identity is stable again");
it("restores a joining guest from the persisted host-ad hold");
it("restores a reconnecting guest from the persisted host-ad hold");
```

Transition/unsupported tests must cover:

```ts
it("cancels pending play when transition begins");
it("blocks local events heartbeat and remote commands during transition");
it("keeps only the newest host state during transition");
it("recovers once when the expected adapter and fingerprint become stable");
it("times out to source-mismatch without touching the wrong media");
it("blocks room playback for unsupported media");
it("ignores stale phase and play completions from an older epoch");
```

- [ ] **Step 3: Run tests and observe RED**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/playback-sync-controller.test.ts \
  test/source-adapters/youtube/sync-integration.test.ts
```

- [ ] **Step 4: Implement phase gating**

The coordinator stores at most one latest pending authoritative state.
`transition`, `interstitial`, and `unsupported` are playback barriers:

- entering any barrier invalidates pending play/readiness work;
- local playback events and heartbeat are blocked;
- remote commands never touch the current media;
- transition recovery requires the expected adapter and fingerprint;
- a bounded transition timeout becomes `source-mismatch`;
- unsupported media remains blocked until a supported adapter binds or the room
  ends.

Host ad hold uses the last confirmed content snapshot and sends exactly one
`HOST_STATE` with `playing: false`, last content time, actual content rate, and
the validated source. The Worker persists and broadcasts that state so a join
or reconnect during the ad is safe. Do not emit synthetic `PAUSE` or `SEEK`.
When confirmed content returns, send exactly one fresh content `HOST_STATE`.
For a pre-roll with no confirmed content snapshot, use a paused content hold at
time `0`; never reuse the ad time. A native YouTube Skip action is observed only
as a phase transition and is never invoked or intercepted by AniDachi.

- [ ] **Step 5: Add quiet local status**

Use `PlaybackSyncStatus` for local UI only:

```text
Host: Ad playing — room paused
Guest: Ad playing — sync will resume automatically
```

Show no persistent status in `synced`. Do not expose ad identity or duration.

- [ ] **Step 6: Verify and commit**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test
git status --short
git add apps/extension/src/playback-sync-controller.ts \
  apps/extension/src/playback-sync-status.ts \
  apps/extension/src/overlay-app.tsx \
  apps/extension/test/playback-sync-controller.test.ts \
  apps/extension/test/playback-sync-status.test.ts \
  apps/extension/test/source-adapters/youtube/sync-integration.test.ts
git commit -m "fix(extension): isolate youtube ads from room playback"
```

---

### Task 6: Synchronize Playback Rate And Recover From Buffering And Autoplay Blocks

**Files:**
- Modify: `apps/extension/src/playback-sync-controller.ts`
- Modify: `apps/extension/src/source-adapters/core/html5-video-adapter.ts`
- Modify: `apps/extension/src/source-adapters/youtube/adapter.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/test/playback-sync-controller.test.ts`
- Modify: `apps/extension/test/source-adapters/youtube/sync-integration.test.ts`

**Consumes:** `PlaybackState.playbackRate`, `ratechange`, normalized buffering
phase, adapter policy, and `play()` rejection.

**Produces:** Stable rate application, debounced host buffering holds, guest
catch-up, and one explicit autoplay recovery action.

- [ ] **Step 1: Write failing playback-rate tests**

Cover the standard finite YouTube VOD rates `0.25`, `0.5`, `0.75`, `1`, `1.25`,
`1.5`, `1.75`, and `2`:

```ts
it("broadcasts an immediate host state when playback rate changes");
it("applies host playback rate before drift correction");
it("does not let a guest rate change become authoritative");
it("restores a guest local rate change to the host rate");
it("suppresses rate changes emitted by an advertisement");
it("avoids periodic seeks after matching host playback rate");
```

- [ ] **Step 2: Write failing buffering tests**

Use fake timers:

```ts
it("ignores a host buffering interval shorter than 500ms");
it("holds confirmed playing content after buffering lasts 500ms");
it("does not classify pause seek transition ad buffering or ended as content buffering");
it("cancels the debounce on pause seek ad source change adapter replacement and dispose");
it("handles repeated waiting playing flaps without duplicate holds");
it("resumes once when host content starts playing");
it("does not hold the room for guest buffering");
it("applies the newest host state when guest buffering clears");
it("leaves a persisted hold when the host disconnects during buffering");
```

- [ ] **Step 3: Write failing autoplay tests**

Cover:

```ts
it("classifies NotAllowedError as resume-required");
it("does not retry blocked play in a timer loop");
it("retries once from resumeFromUserGesture");
it("clears resume-required only after play succeeds");
it("cancels the pending retry when pause or source change arrives");
it("treats a non-NotAllowedError play failure as a bounded sync error");
it("calls play directly in the user activation handler before awaiting readiness");
it("resets one retry budget for a new authoritative play source or adapter epoch");
it("distinguishes AbortError from NotAllowedError and media failure");
```

- [ ] **Step 4: Run tests and observe RED**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/playback-sync-controller.test.ts \
  test/source-adapters/youtube/sync-integration.test.ts
```

- [ ] **Step 5: Implement rate and buffering behavior**

Apply the normalized finite host rate before computing expected host time.
After setting a rate, read and synchronize the rate the media element actually
accepted. Reapply the authoritative rate after player/source replacement,
because YouTube can reset it to `1`. A clamped or unsupported rate must not
cause a periodic seek loop, and the resulting local `ratechange` remains under
remote-event suppression.
Debounce host buffering through `playbackPolicy.hostBufferingHoldDelayMs`.
Only confirmed content that intends to be playing can start the host buffering
debounce. Guest buffering queues only the latest authoritative state.

- [ ] **Step 6: Implement one user-gesture recovery control**

Show `Resume sync` only for `resume-required`. Its click calls
`resumeFromUserGesture()`, whose first synchronous operation is `adapter.play()`
so browser user activation is retained. Disable it while the attempt is
pending. A failed attempt stays visible with bounded diagnostic logging.

- [ ] **Step 7: Verify and commit**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test
git status --short
git add apps/extension/src/playback-sync-controller.ts \
  apps/extension/src/source-adapters/core/html5-video-adapter.ts \
  apps/extension/src/source-adapters/youtube/adapter.ts \
  apps/extension/src/overlay-app.tsx \
  apps/extension/test/playback-sync-controller.test.ts \
  apps/extension/test/source-adapters/youtube/sync-integration.test.ts
git commit -m "fix(extension): recover youtube playback synchronization"
```

---

### Task 7: Add Diagnostics And Documentation

**Files:**
- Create: `docs/youtube-adapter-notes.md`
- Modify: `docs/current-development-state.md`
- Modify: `docs/superpowers/plans/2026-07-22-source-adapters-architecture.md`
- Modify: this plan
- Modify: `apps/extension/src/debug-log.ts`
- Test: `apps/extension/test/debug-log.test.ts`

**Consumes:** Final controller statuses, phases, navigation results, and current
bounded debug logging.

**Produces:** Actionable logs and maintenance instructions without collecting
personal data or ad metadata.

- [ ] **Step 1: Write failing diagnostic serialization tests**

Assert that logs include only:

```text
adapterId
provider
phase
sourceCorrelationId
contentTime
playbackRate
drift
action
sourceGeneration
navigationStatus
```

`sourceCorrelationId` is derived with an in-memory session salt and cannot be
correlated across sessions. Assert that raw fingerprints/video IDs, full ad or
content URLs, titles, query payloads, and DOM text are absent from console
logging, stored debug entries, and exported diagnostic bundles. Preserve and
test the existing retention and size limits; do not keep a correlation mapping.

- [ ] **Step 2: Document YouTube ownership**

`docs/youtube-adapter-notes.md` must explain:

- supported routes;
- player discovery;
- canonical identity;
- same-provider navigation;
- playback phase detection;
- advertisement policy;
- buffering and autoplay recovery;
- selector failure fallback;
- how to update selectors safely;
- required automated and two-profile manual tests.

- [ ] **Step 3: Update plan and current-state truth**

Mark only actually completed tasks. Record test totals and manual scenarios
that were truly executed. Do not describe real-ad acceptance as complete from
unit fixtures.

- [ ] **Step 4: Verify and commit**

```bash
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension exec vitest run \
  test/debug-log.test.ts
git diff --check
git add apps/extension/src/debug-log.ts apps/extension/test/debug-log.test.ts \
  docs/youtube-adapter-notes.md docs/current-development-state.md \
  docs/superpowers/plans
git commit -m "docs(extension): document youtube sync behavior"
```

---

### Task 8: Automated And Two-Profile Acceptance

**Files:**
- Modify: this plan with evidence only
- Update approved Graphify team artifacts only when required by project policy

**Consumes:** All completed tasks.

**Produces:** Evidence sufficient to decide whether PR `#148` can leave draft
and enter staging acceptance.

- [ ] **Step 1: Run automated gates**

```bash
git diff --check
fnm exec --using=22.23.1 pnpm --filter @anidachi/protocol test
fnm exec --using=22.23.1 pnpm --filter @anidachi/api test
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension check
fnm exec --using=22.23.1 pnpm --filter @anidachi/extension test
fnm exec --using=22.23.1 pnpm build:extension:staging
fnm exec --using=22.23.1 pnpm validate:extension:staging
fnm exec --using=22.23.1 pnpm dev:check
```

Expected: every command passes. Follow any broader profile recommended by
`dev:check`.

- [ ] **Step 2: Refresh Graphify intentionally**

Run the project Graphify update appropriate for changed code and docs. Review
only `graph.json`, `GRAPH_REPORT.md`, and `manifest.json`; exclude local cost,
HTML, wiki, cache, and scratch output.

- [ ] **Step 3: Build and update both test folders**

Update exactly:

```text
/Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging
/Users/vladyslavhulyi/anidachi-extension-staging2
```

Validate both against the source staging artifact with `diff -qr`.

- [ ] **Step 4: Run deterministic two-profile YouTube acceptance**

For the same video:

```text
create room
join room
host play
host pause
host seek forward and backward
host set 0.5x, 1x, 1.5x, and 2x
guest attempts local play, pause, seek, and rate change
guest reload
host reload
host reloads while the browser is temporarily on a different provider
temporary host buffering
temporary guest buffering
guest autoplay block and Resume sync
host reaches the natural end of the video
normal, theater, and fullscreen modes
YouTube SPA replacement of the active video element
bfcache page restore
```

Expected: the host remains authoritative; a guest control is reconciled
locally with transient `Host controls playback` feedback; no command loop,
periodic rate seek, stale-player command, rejected guest network command,
premature restored-host heartbeat, or unrecoverable blocked play occurs.

- [ ] **Step 5: Run source-switch acceptance**

```text
host opens another valid YouTube video
guest follows and retains the room
host changes videos twice quickly
only the newest target before assign is dispatched
after hard navigation only the newest room snapshot is accepted
foreign and malformed source descriptors do not navigate
cross-provider source is rejected
```

- [ ] **Step 6: Run real-ad acceptance**

Use separate profiles with independent account/ad conditions:

```text
host receives an ad and guest does not
guest receives an ad and host does not
both receive different ads
room is created while the host is in a pre-roll ad
ad is skipped using YouTube's own native skip control
ad ends naturally
host pauses during the first content frame after an ad
guest reconnects while its local ad is active
guest joins while the host ad is active
guest reconnects while the host ad is active
host reloads while its ad or buffering hold is active
reconnect occurs while source navigation or autoplay recovery is pending
```

Expected: no ad time enters room state, no AniDachi command controls the ad,
host ad holds the room, guest ad remains local, and content resynchronizes once
without oscillation.

Host-only and guest-only real-ad scenarios are required before production
promotion. Different simultaneous ads, native skip, and multi-ad pods must be
attempted and recorded when available. If the two required ad asymmetry
scenarios cannot be produced, the feature may continue through staging with
fixture coverage but is not eligible for promotion to `main`.

- [ ] **Step 7: Run unsupported-media acceptance**

Open a live stream or other watch route with no stable finite VOD timeline.
Expected: AniDachi reports that synchronized rooms are not yet supported for
that media, does not send host playback state, and does not apply remote
playback commands.

- [ ] **Step 8: Run Crunchyroll regression**

Repeat current staging play, pause, seek, source switch, fullscreen, camera,
voice, and reconnect scenarios. Expected: no behavior change from the accepted
Crunchyroll baseline.

- [ ] **Step 9: Capture evidence and review PR**

Record:

- commit and artifact version;
- exact automated totals;
- profiles and modes tested;
- which real-ad scenarios were available;
- bounded diagnostic outcome;
- Graphify status;
- rollback commit.

Do not mark the PR ready while source switching, real two-profile playback, or
Crunchyroll regression remains unverified. Readiness for production promotion
also requires real host-only and guest-only ad acceptance.

## Definition Of Done

- Host play, pause, seek, and playback rate are authoritative on YouTube.
- Guests recover from drift, buffering, autoplay blocks, reloads, and player
  replacement without command loops.
- Guests follow the host to another valid YouTube video.
- An active room cannot silently cross providers.
- Restored rooms do not emit playback until their provider is reconstructed
  from an authoritative snapshot.
- Advertisement media time and controls never enter room synchronization.
- Host ads hold the room; guest ads remain local and recover to current host
  content.
- Unknown YouTube player state suspends playback instead of acting on the wrong
  media.
- Unsupported live or non-finite media fails closed instead of pretending VOD
  synchronization works.
- Shared runtime contains no YouTube/Crunchyroll DOM selectors or provider-ID
  timing branches.
- Crunchyroll behavior remains accepted.
- Automated gates, staging artifact validation, two-profile YouTube acceptance,
  and Crunchyroll regression are recorded truthfully.

## Rollback Boundaries

Each behavioral commit above must be independently revertible:

1. coordinator extraction;
2. provider capability migration;
3. source navigation;
4. playback phase detection;
5. ad isolation;
6. rate/buffering/autoplay recovery;
7. docs and diagnostics.

If staging reveals a YouTube phase-selector regression, revert ad isolation and
phase detection together while retaining the behavior-preserving coordinator
and source navigation. If shared playback regresses Crunchyroll, stop promotion
and revert the first commit that changes shared behavior rather than adding a
provider-specific patch in `overlay-app.tsx`.
