# Source Adapter Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the extension's generic HTML5, YouTube, and Crunchyroll player
logic into independent provider adapters, then make YouTube a first-class room
source without regressing the existing Crunchyroll flow.

**Architecture:** A small provider registry owns page claiming and adapter
detection. A lifecycle manager owns exactly one active adapter. Shared room,
WebSocket, sync, P2P, overlay, and auth code consumes capabilities and policies
from the active adapter instead of checking provider names. Provider folders own
their selectors, URL parsing, metadata, progress extraction, navigation, player
quirks, and MAIN-world bridges.

**Tech Stack:** TypeScript 6, WXT 0.20, MV3 content scripts, React 19, Vitest 4,
shared `@anidachi/protocol` source descriptors.

## Global Constraints

- Work from latest `origin/staging` under Node `22.23.1` and pnpm `11.2.2`.
- Use two risk-based PRs into `staging`; do not open a PR for every small task.
- PR 1 is behavior-preserving architecture extraction.
- PR 2 adds lifecycle hardening and first-class YouTube source navigation.
- Do not change room protocol, Worker/API behavior, P2P media, auth, database,
  subscription logic, public UI, or host permissions.
- Do not use undocumented YouTube internal player APIs for navigation.
- Keep the existing Crunchyroll MAIN-world bridge behavior during PR 1.
- Do not leave a permanent compatibility facade or duplicate adapter logic.
- Constructors must not register listeners, observers, timers, or global state.
- `dispose()` must be idempotent and restore adapter-owned transient state.
- Provider folders must not import one another.
- In the final PR 2 state, known provider hosts must not fall through to the
  generic adapter on an unsupported route such as the YouTube homepage. PR 1
  preserves the current route behavior while only moving code.
- The overlay/room shell must survive a temporary player disappearance during
  an SPA transition; it must not apply remote playback to the old video.

## Non-Goals

- Adding Netflix, Amazon, or another provider.
- Replacing the host-authoritative sync algorithm.
- Rewriting the Crunchyroll MAIN-world implementation.
- Persisting additional source fields in Supabase.
- Adding a provider settings UI.
- Changing camera, microphone, media-seat, or layout behavior.

## Target File Structure

```txt
apps/extension/src/source-adapters/
  core/
    types.ts                 # stable adapter, definition, result, policy contracts
    adapter-manager.ts       # one active adapter and deterministic cleanup
    html5-video-adapter.ts   # shared native HTMLVideoElement behavior
    video-discovery.ts       # deep scan, usability checks, deterministic scoring
    source-url.ts            # bounded canonical URLs and room hash handling
  generic/
    adapter.ts               # generic HTML5 implementation
    definition.ts            # unowned-page fallback definition
  youtube/
    adapter.ts               # YouTube player behavior and metadata
    definition.ts            # page claim, player detection, factory
    url.ts                    # watch/shorts/embed/youtu.be parsing and canonicalization
    progress.ts              # YouTube watch-progress projection
    navigation.ts            # validated source navigation with hard-navigation fallback
  crunchyroll/
    adapter.ts               # Crunchyroll player behavior
    definition.ts            # watch-route claim and player detection
    bridge-client.ts         # isolated-world request client
    bridge-contract.ts       # typed request/result protocol shared with MAIN world
    navigation.ts            # existing seamless navigation plus hard fallback
    progress.ts              # existing Crunchyroll progress projection
    season.ts                # existing season parsing
    artwork.ts               # existing artwork loading
    artwork-select.ts        # existing pure artwork selection
    player-chrome.ts         # existing player chrome/occlusion measurement
  registry.ts                # ordered definitions and public detection/navigation API
```

WXT file-based entrypoints stay at:

```txt
apps/extension/entrypoints/content.tsx
apps/extension/entrypoints/crunchyroll.content.ts
```

The MAIN-world entrypoint imports the Crunchyroll bridge contract and pure
provider helpers, but it does not import the room or overlay runtime. This keeps
the WXT execution-world boundary explicit. Current WXT guidance for isolated
and MAIN-world content scripts is documented at
<https://wxt.dev/guide/essentials/content-scripts>.

## Core Contracts

The implementation must use these names and dependency directions. Minor field
ordering can follow the formatter, but semantic changes require amending this
plan before implementation continues.

```ts
import type { PlaybackState, WatchSourceDescriptor } from "@anidachi/protocol";
import type { WatchProgressEntry } from "../../watch-progress";

export type SourceAdapterId = "generic-html5-video" | "youtube" | "crunchyroll";
export type SourceProvider = WatchSourceDescriptor["provider"];
export type ProviderPageClaim = "supported" | "blocked" | "not-applicable";

export interface PlayerEvent {
  type: "play" | "pause" | "seek" | "timeupdate";
  time: number;
}

export interface SeekOptions {
  resumeIfPlaying?: boolean;
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
}

export interface AdapterOverlayBinding {
  mountTarget: HTMLElement;
  viewportElement: HTMLElement;
  useNativePlayerDoubleClick: boolean;
}

export interface ProgressContext {
  roomId?: string;
  watchedWithCount: number;
}

export type EnsureSourceResult =
  | { status: "already-current" }
  | { status: "navigation-started"; targetUrl: string }
  | { status: "unsupported"; reason: string }
  | { status: "failed"; reason: string };

export interface SourceNavigationContext {
  roomId: string | null;
  signal: AbortSignal;
}

export interface VideoAdapter {
  readonly id: SourceAdapterId;
  readonly provider: SourceProvider;
  readonly name: string;
  readonly video: HTMLVideoElement;
  readonly container: HTMLElement;
  readonly playbackPolicy: AdapterPlaybackPolicy;

  getTitle(): string | null;
  getFingerprint(): string;
  getCurrentTime(): number;
  getState(): PlaybackState;
  getSourceDescriptor(): WatchSourceDescriptor | undefined;
  getProgressEntry(context: ProgressContext): WatchProgressEntry | null;
  getOverlayBinding(): AdapterOverlayBinding;
  getCameraStackBottomPx(): number;
  subscribeCameraStackBottomPx(listener: (value: number) => void): () => void;

  play(): Promise<void>;
  pause(): void;
  seek(time: number, options?: SeekOptions): void;
  subscribe(listener: (event: PlayerEvent) => void): () => void;
  duckVolume(targetVolume?: number): () => void;
  isFullscreen(): boolean;
  enterFullscreen(): Promise<void>;
  exitFullscreen(): Promise<void>;
  dispose(): void;
}

export interface AdapterDetectionContext {
  document: Document;
  url: URL;
  videos: readonly HTMLVideoElement[];
}

export type AdapterDetectionResult =
  | { status: "ready"; adapter: VideoAdapter }
  | { status: "waiting"; provider: SourceProvider }
  | { status: "blocked"; provider: SourceProvider }
  | { status: "none" };

export interface SourceAdapterDefinition {
  readonly id: SourceAdapterId;
  readonly provider: SourceProvider;
  readonly priority: number;
  claimPage(url: URL): ProviderPageClaim;
  detect(context: AdapterDetectionContext): VideoAdapter | null;
  ensureSource(
    source: WatchSourceDescriptor,
    context: SourceNavigationContext,
  ): Promise<EnsureSourceResult>;
}
```

`pause()` and `seek()` remain synchronous in PR 1 to preserve the public shape
and current overlay timing. If later telemetry shows that callers need bridge
completion, changing them to promises must be a separate contract change with
its own tests; do not combine that with file extraction.

## Registry Rules

```ts
const DEFINITIONS: readonly SourceAdapterDefinition[] = [
  youtubeDefinition,
  crunchyrollDefinition,
  genericDefinition,
];
```

- A specialized definition that returns `supported` owns the page and detects
  only inside its provider player. If that player is not ready, the registry
  returns `{ status: "waiting" }`.
- A specialized definition that returns `blocked` owns the host but rejects the
  route; the content lifecycle disposes the player binding instead of falling
  through to Generic.
- `genericDefinition` runs only when every specialized provider returns
  `not-applicable`.
- YouTube owns `/watch`, `/shorts/<id>`, `/embed/<id>`, valid `youtu.be/<id>`,
  and `youtube-nocookie.com/embed/<id>` pages.
- Other YouTube pages return `blocked`, preventing homepage previews and ads
  from becoming a generic room source.
- Crunchyroll owns only `/watch/<id>`; other Crunchyroll pages return `blocked`.
- Provider candidate ordering is deterministic: provider confidence, existing
  video score, then DOM order.
- Remote source navigation is selected by `source.provider`, not by the current
  adapter ID. This permits a room to move from Crunchyroll to YouTube without
  teaching the current provider about the target provider.
- Generic remote navigation returns `unsupported`; it never opens an arbitrary
  URL automatically.

---

## PR 1: Behavior-Preserving Provider Extraction

### Task 1: Lock Characterization Tests

**Status:** Complete in `1e6cec8`.

**Files:**
- Modify: `apps/extension/test/video-adapter.test.ts`
- Modify: `apps/extension/test/overlay-mount.test.ts`
- Modify: `apps/extension/test/playback-control.test.ts`
- Modify: `apps/extension/test/watch-progress-entry.test.ts`
- Modify: `apps/extension/test/media-ducking.test.ts`

**Produces:** A baseline that fails if the refactor changes adapter selection,
fingerprints, Crunchyroll controls, event timing, fullscreen, progress, or
volume restoration.

- [x] Add a regression test proving the current winner-first detector chooses
  the same visible video before and after extraction.
- [x] Add a regression test for a reused video element whose YouTube or
  Crunchyroll fingerprint changes after SPA navigation.
- [x] Add a regression test proving Crunchyroll `pause()` and `seek()` retain
  their current fire-and-observe behavior.
- [x] Add a regression test proving YouTube volume ducking restores player
  volume, native video volume, and mute state exactly once.
- [x] Run the focused baseline:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- \
  test/video-adapter.test.ts \
  test/overlay-mount.test.ts \
  test/playback-control.test.ts \
  test/watch-progress-entry.test.ts \
  test/media-ducking.test.ts
```

Expected: all focused tests pass before production code moves.

- [x] Commit:

```bash
git add apps/extension/test
git commit -m "test(extension): lock provider adapter behavior"
```

### Task 2: Introduce Core Types And Shared HTML5 Primitives

**Status:** Complete in `69d985e`.

**Files:**
- Create: `apps/extension/src/source-adapters/core/types.ts`
- Create: `apps/extension/src/source-adapters/core/source-url.ts`
- Create: `apps/extension/src/source-adapters/core/video-discovery.ts`
- Create: `apps/extension/src/source-adapters/core/html5-video-adapter.ts`
- Modify: `apps/extension/src/video-adapter.ts`
- Test: `apps/extension/test/source-adapters/core/source-url.test.ts`
- Test: `apps/extension/test/source-adapters/core/video-discovery.test.ts`

**Consumes:** Existing protocol bounds and `duckVideoVolume()`.

**Produces:** The core contracts above, bounded canonical URL helpers,
deterministic deep video discovery, and the common HTML5 implementation.

- [x] Write failing tests for room-hash removal, URL length limits, open shadow
  roots, visibility filtering, scoring, and stable DOM-order tie breaking.
- [x] Run the two new test files and verify they fail because the modules do not
  exist.
- [x] Move shared behavior without changing constants, thresholds, logging, or
  public method signatures.
- [x] Make `video-adapter.ts` a temporary explicit re-export facade so existing
  consumers remain unchanged while providers move:

```ts
export type { PlayerEvent, SeekOptions, VideoAdapter } from "./source-adapters/core/types";
export { Html5VideoAdapter } from "./source-adapters/core/html5-video-adapter";
export {
  canonicalWatchSourceUrl,
  normalizeVideoFingerprint,
} from "./source-adapters/core/source-url";
```

- [x] Run the new core tests and the original adapter tests.
- [x] Commit:

```bash
git add apps/extension/src/source-adapters/core apps/extension/src/video-adapter.ts \
  apps/extension/test/source-adapters/core
git commit -m "refactor(extension): extract video adapter core"
```

### Task 3: Extract Generic And YouTube Providers

**Status:** Complete in `0bb699f`.

For PR 1, provider definitions use a deliberately narrow intermediate contract:
`id`, `provider`, `priority`, and a synchronous `detect(video)` factory for the
already-selected winning video. `claimPage()`, `waiting`/`blocked` ownership,
`ensureSource()`, capabilities, and lifecycle methods remain PR 2 work. This
keeps the extraction behavior-preserving while giving Task 5 a typed registry
input instead of ad hoc provider branches.

**Files:**
- Create: `apps/extension/src/source-adapters/generic/adapter.ts`
- Create: `apps/extension/src/source-adapters/generic/definition.ts`
- Create: `apps/extension/src/source-adapters/youtube/adapter.ts`
- Create: `apps/extension/src/source-adapters/youtube/definition.ts`
- Create: `apps/extension/src/source-adapters/youtube/url.ts`
- Create: `apps/extension/src/source-adapters/youtube/progress.ts`
- Modify: `apps/extension/src/source-adapters/core/types.ts`
- Modify: `apps/extension/src/video-adapter.ts`
- Modify: `apps/extension/src/watch-progress-entry.ts`
- Test: `apps/extension/test/source-adapters/generic/adapter.test.ts`
- Test: `apps/extension/test/source-adapters/youtube/adapter.test.ts`
- Test: `apps/extension/test/source-adapters/youtube/url.test.ts`

**Consumes:** `Html5VideoAdapter`, discovery helpers, core contracts.

**Produces:** Independent Generic and YouTube definitions with no Crunchyroll
imports and one canonical YouTube ID parser shared by fingerprint, descriptor,
progress, and later navigation code.

- [x] Move existing generic behavior exactly, including fingerprint and
  fullscreen fallback.
- [x] Move existing YouTube title, container, fingerprint, fullscreen, and
  volume behavior exactly.
- [x] Add URL tests for `/watch?v=`, `/shorts/`, `/embed/`, `youtu.be`, and
  `youtube-nocookie.com/embed/`; invalid IDs return `null`.
- [x] Keep fingerprint and progress output unchanged for valid current YouTube
  URLs. Stricter route ownership and navigation validation belong to PR 2.
- [x] Move the existing YouTube progress builder mechanically and make the
  current shared dispatcher delegate to it; do not add a new progress surface.
- [x] Do not enable new progress or navigation behavior in this task; the parser
  can be broader while public behavior remains characterized by existing tests.
- [x] Run Generic, YouTube, and original adapter tests.
- [x] Commit:

```bash
git add apps/extension/src/source-adapters/generic \
  apps/extension/src/source-adapters/youtube apps/extension/src/source-adapters/core/types.ts \
  apps/extension/src/video-adapter.ts apps/extension/src/watch-progress-entry.ts \
  apps/extension/test/source-adapters/generic \
  apps/extension/test/source-adapters/youtube
git commit -m "refactor(extension): isolate generic and youtube adapters"
```

### Task 4: Extract Crunchyroll Provider And Bridge

**Status:** Complete in `87dbab5`.

**Files:**
- Create: `apps/extension/src/source-adapters/crunchyroll/adapter.ts`
- Create: `apps/extension/src/source-adapters/crunchyroll/definition.ts`
- Rename: `apps/extension/src/crunchyroll-control.ts` to
  `apps/extension/src/source-adapters/crunchyroll/bridge-contract.ts`
- Create: `apps/extension/src/source-adapters/crunchyroll/bridge-client.ts`
- Rename provider helpers into `apps/extension/src/source-adapters/crunchyroll/`:
  `progress.ts`, `season.ts`, `artwork.ts`, `artwork-select.ts`, and
  `player-chrome.ts`
- Rename: `apps/extension/src/crunchyroll-study.ts` to
  `apps/extension/src/source-adapters/crunchyroll/study.ts`
- Modify: `apps/extension/entrypoints/content.tsx`
- Modify: `apps/extension/entrypoints/crunchyroll.content.ts`
- Modify: `apps/extension/src/overlay-layout.ts`
- Modify imports in `apps/extension/src/overlay-app.tsx`
- Modify imports in `apps/extension/src/popup-app.tsx`
- Modify imports in `apps/extension/src/watch-progress-entry.ts`
- Modify imports in provider-related tests
- Test: `apps/extension/test/source-adapters/crunchyroll/adapter.test.ts`
- Test: `apps/extension/test/source-adapters/crunchyroll/bridge-client.test.ts`
- Test: `apps/extension/test/source-adapters/crunchyroll/player-chrome.test.ts`

**Consumes:** Core contract, existing Crunchyroll MAIN-world protocol and
helpers.

**Produces:** One provider folder containing all Crunchyroll-specific source
logic. `crunchyroll.content.ts` remains the WXT MAIN-world boundary.

- [x] Move the bridge contract first and update both worlds to import the same
  request/result types.
- [x] Move the request client separately; test matching IDs, unrelated window
  messages, timeouts, and listener cleanup.
- [x] Move the adapter without changing native-control fallbacks, seek
  tolerances, event deduplication, or debug events.
- [x] Move pure provider helper files mechanically and update imports without
  changing their exports.
- [x] Move the existing player-chrome measurement and equality helpers out of
  `overlay-app.tsx`; keep generic layout math in `overlay-layout.ts`.
- [x] Move the opt-in Crunchyroll study helper mechanically and retain its
  content-script lifecycle exactly.
- [x] Run all Crunchyroll adapter, progress, artwork, season, playback-control,
  and original adapter tests.
- [x] Commit:

```bash
git add apps/extension/entrypoints/content.tsx \
  apps/extension/entrypoints/crunchyroll.content.ts \
  apps/extension/src/source-adapters/crunchyroll apps/extension/src/overlay-app.tsx \
  apps/extension/src/overlay-layout.ts apps/extension/src/popup-app.tsx \
  apps/extension/src/watch-progress-entry.ts apps/extension/test
git commit -m "refactor(extension): isolate crunchyroll adapter"
```

### Task 5: Add Registry And Remove The Temporary Facade

**Status:** Complete in `ba54783`.

For PR 1, the registry preserves the existing synchronous discovery surface:
`detectSourceAdapter(documentValue): VideoAdapter | null`. The final
`AdapterDetectionResult` ownership states require provider page claims and are
introduced together with lifecycle hardening in PR 2. The ordered definitions
and their numeric priorities must both reflect the current winner-first order:
YouTube, Crunchyroll, then Generic. This avoids a dormant priority contract that
would change behavior once consumed.

**Files:**
- Create: `apps/extension/src/source-adapters/registry.ts`
- Create: `apps/extension/src/source-adapters/core/source-descriptor.ts`
- Modify: `apps/extension/entrypoints/content.tsx`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/debug-probe.ts`
- Modify: `apps/extension/src/watch-progress-entry.ts`
- Delete: `apps/extension/src/video-adapter.ts`
- Test: `apps/extension/test/source-adapters/registry.test.ts`
- Test: `apps/extension/test/source-adapters/core/source-descriptor.test.ts`

**Consumes:** Three provider definitions and core contracts.

**Produces:** The only public adapter discovery entrypoint:

```ts
export function detectSourceAdapter(
  documentValue: Document = document,
): VideoAdapter | null;

export function getDefinitionForProvider(
  provider: SourceProvider,
): SourceAdapterDefinition | null;
```

- [x] Write registry tests for priority, generic fallback, deterministic
  selection, and the current route behavior. Tests for `waiting` and
  known-provider route blocking are added with lifecycle hardening in PR 2.
- [x] Preserve current winner-first selection inside supported player scope for
  PR 1; provider-specific candidate improvements belong to PR 2.
- [x] Move `buildWatchSourceDescriptor()` into the shared core descriptor
  module without changing its URL bounds, title fallback/truncation, provider
  mapping, duration handling, or dependency on the current page context.
- [x] Update every consumer to import core types or registry functions from the
  new paths.
- [x] Delete the facade and verify no source import references
  `./video-adapter` or `../src/video-adapter`.
- [x] Run:

```bash
rg -n 'from ["\x27].*video-adapter["\x27]' apps/extension
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
```

Expected: `rg` prints no imports; check and all extension tests pass.

- [x] Commit:

```bash
git add apps/extension
git commit -m "refactor(extension): route adapters through provider registry"
```

### Task 6: PR 1 Verification And Staging Review

**Status:** Automated verification complete on 2026-07-22. Manual loaded-
extension staging acceptance remains pending.

**Files:**
- Modify only if behavior documentation moved:
  `docs/architecture.md`, `docs/current-development-state.md`, and
  `docs/crunchyroll-adapter-notes.md`

- [x] Run `git diff --check`.
- [x] Run extension check and full extension test suite.
- [x] Run `pnpm build:extension:staging` and
  `pnpm validate:extension:staging`.
- [x] Run `pnpm dev:check` and record the extension profile output.
- [x] Run `pnpm graph:update`; include team graph artifacts only if the graph
  policy and resulting diff require them.
- [ ] Load the staging artifact in the normal test profile and verify one local
  room on existing Crunchyroll and YouTube videos: mount, play, pause, seek,
  fullscreen, camera controls, and panel close/reopen.
- [ ] Open one PR into `staging` titled
  `refactor(extension): isolate source adapters` with explicit evidence that no
  provider behavior was intentionally changed.

Automated evidence recorded on 2026-07-22:

- extension typecheck passed;
- extension suite passed: 54 files / 542 tests;
- full workspace check passed: 6 tasks;
- full workspace suite passed: 6 tasks, including web 101, API 88, protocol 29,
  and extension 542 tests;
- narrow staging artifact validated as
  `ba54783-staging-20260722091624` with no broad host permissions;
- Graphify rebuilt to 6,688 nodes / 13,906 edges and resolves the new registry
  and source descriptor without the removed facade paths.

---

## PR 2: Lifecycle, Capabilities, And First-Class YouTube

### Task 7: Add The Adapter Lifecycle Manager

**Files:**
- Create: `apps/extension/src/source-adapters/core/adapter-manager.ts`
- Modify: `apps/extension/entrypoints/content.tsx`
- Test: `apps/extension/test/source-adapters/core/adapter-manager.test.ts`
- Test: `apps/extension/test/source-adapters/content-lifecycle.test.tsx`

**Produces:** One owner for adapter replacement and disposal:

```ts
export interface ActiveAdapterHooks {
  mounted(adapter: VideoAdapter): void;
  relocated(adapter: VideoAdapter): void;
  suspended(previous: VideoAdapter): void;
  replaced(previous: VideoAdapter, next: VideoAdapter): void;
  detached(previous: VideoAdapter): void;
}

export class AdapterManager {
  constructor(private readonly hooks: ActiveAdapterHooks);
  get current(): VideoAdapter | null;
  reconcile(
    result: AdapterDetectionResult,
  ): "mounted" | "relocated" | "suspended" | "replaced" | "detached" | "idle";
  dispose(): void;
}
```

- [ ] Test same instance relocation, same video/new fingerprint replacement,
  new video replacement, temporary disappearance, unsupported route detach,
  idempotent disposal, and `pagehide` cleanup. A `waiting` result suspends local
  adapter events and remote playback application while preserving the room
  shell; `blocked` detaches the overlay on an unsupported route.
- [ ] Move listener, marker, `ResizeObserver`, fullscreen, and adapter cleanup
  ordering from `content.tsx` behind the manager hooks.
- [ ] Keep room/WebSocket state inside `OverlayApp`; replacing the player must
  not recreate or close the room session.
- [ ] Add a regression test that a replacement video receives adapter event
  listeners and resize observation.
- [ ] Run lifecycle tests, extension check, and all extension tests.
- [ ] Commit:

```bash
git add apps/extension/src/source-adapters/core/adapter-manager.ts \
  apps/extension/entrypoints/content.tsx apps/extension/test/source-adapters
git commit -m "fix(extension): make adapter replacement lifecycle deterministic"
```

### Task 8: Replace Provider ID Branches With Capabilities And Policies

**Files:**
- Modify: `apps/extension/src/source-adapters/core/types.ts`
- Modify provider adapters under `apps/extension/src/source-adapters/`
- Modify: `apps/extension/entrypoints/content.tsx`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/playback-control.ts`
- Modify: `apps/extension/src/overlay-mount.ts`
- Test provider and playback suites under
  `apps/extension/test/source-adapters/`

**Produces:** Common code uses `getOverlayBinding()`, playback policy, and
player-chrome subscriptions; it never branches on `adapter.id`.

- [ ] Move overlay target, viewport element, and native-double-click decisions
  into each adapter's overlay binding.
- [ ] Move Crunchyroll player chrome measurement behind
  `getCameraStackBottomPx()` and `subscribeCameraStackBottomPx()`.
- [ ] Change playback helpers to receive `AdapterPlaybackPolicy`, not an
  adapter ID string.
- [ ] Generalize pending-seek and local-seek state names; retain existing
  Crunchyroll timing values in the Crunchyroll policy.
- [ ] Keep Generic and YouTube policies at their current default timing.
- [ ] Run:

```bash
rg -n 'adapter\.id\s*[!=]==?\s*["\x27](youtube|crunchyroll)' \
  apps/extension/entrypoints/content.tsx \
  apps/extension/src/overlay-app.tsx \
  apps/extension/src/playback-control.ts \
  apps/extension/src/overlay-mount.ts
```

Expected: no provider comparisons in shared runtime files.

- [ ] Run full extension check/tests and commit:

```bash
git add apps/extension
git commit -m "refactor(extension): consume provider capabilities"
```

### Task 9: Move Source Descriptors And Progress Into Providers

**Files:**
- Modify: `apps/extension/src/source-adapters/core/types.ts`
- Modify: `apps/extension/src/source-adapters/generic/adapter.ts`
- Modify: `apps/extension/src/source-adapters/youtube/adapter.ts`
- Modify: `apps/extension/src/source-adapters/youtube/progress.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/adapter.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/progress.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Delete: `apps/extension/src/watch-progress-entry.ts`
- Test: `apps/extension/test/source-adapters/progress.test.ts`

**Produces:** `adapter.getSourceDescriptor()` and
`adapter.getProgressEntry(context)` are the only provider metadata entrypoints.

- [ ] Make `provider` an explicit adapter field; remove ID-to-provider mapping.
- [ ] Use the shared YouTube URL parser for fingerprint, source descriptor, and
  progress identity.
- [ ] Cover normal watch, Shorts, embed, youtu.be, and youtube-nocookie URLs.
- [ ] Preserve Crunchyroll series/season/episode extraction exactly.
- [ ] Keep Generic progress unsupported and return `null`.
- [ ] Delete the dispatching progress helper and provider branches from the
  overlay.
- [ ] Run progress, adapter, popup, and extension suites.
- [ ] Commit:

```bash
git add apps/extension
git commit -m "refactor(extension): let providers describe watch sources"
```

### Task 10: Add Safe Provider Navigation And YouTube Source Switching

**Files:**
- Create: `apps/extension/src/source-adapters/youtube/navigation.ts`
- Create: `apps/extension/src/source-adapters/crunchyroll/navigation.ts`
- Modify: `apps/extension/src/source-adapters/registry.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Test: `apps/extension/test/source-adapters/youtube/navigation.test.ts`
- Test: `apps/extension/test/source-adapters/crunchyroll/navigation.test.ts`
- Test: `apps/extension/test/source-adapters/source-switching.test.ts`

**Produces:**

```ts
export async function ensureRemoteSource(
  source: WatchSourceDescriptor,
  context: SourceNavigationContext,
): Promise<EnsureSourceResult>;
```

- [ ] Validate provider, URL, hostname, route shape, ID, and protocol before
  navigation; reject `javascript:`, foreign hosts, malformed IDs, and generic
  arbitrary URLs.
- [ ] Preserve the active room ID using the existing room hash convention and
  persisted room session; the hash is not the sole room source of truth.
- [ ] Keep one navigation operation active. Abort an older operation when a
  newer host source arrives.
- [ ] YouTube returns `already-current` for the same canonical video and uses
  `location.assign(canonicalTarget)` for a different video. Do not call
  unsupported YouTube internal methods.
- [ ] Crunchyroll uses the existing MAIN-world `navigate` command and existing
  hard-navigation fallback.
- [ ] While navigation is pending, hold the latest host state and do not apply
  play/seek to the previous video. Completion requires a newly detected adapter
  whose fingerprint equals the target fingerprint.
- [ ] Replace `navigateToRemoteSourceIfNeeded()` and Crunchyroll-only URL
  helpers in `overlay-app.tsx` with `ensureRemoteSource()`.
- [ ] Run source-switching tests and full extension tests.
- [ ] Commit:

```bash
git add apps/extension
git commit -m "feat(extension): follow youtube room source changes safely"
```

### Task 11: Provider-Aware Detection Hardening

**Files:**
- Modify: `apps/extension/src/source-adapters/registry.ts`
- Modify: `apps/extension/src/source-adapters/youtube/definition.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/definition.ts`
- Modify: `apps/extension/src/source-adapters/generic/definition.ts`
- Modify: `apps/extension/src/overlay-mount.ts`
- Test: `apps/extension/test/source-adapters/registry.test.ts`
- Test: `apps/extension/test/source-adapters/content-lifecycle.test.tsx`

- [ ] Make YouTube select video only inside `#movie_player` or
  `.html5-video-player`; ignore preview, background, and ad videos outside the
  claimed player.
- [ ] Return `waiting` during YouTube and Crunchyroll SPA transitions instead of
  mounting Generic.
- [ ] Block the overlay on unsupported known-provider routes.
- [ ] Preserve deep open-shadow-root discovery for unowned generic pages.
- [ ] Test delayed player insertion, video replacement, same-element source
  change, player removal/reappearance, and deterministic ties.
- [ ] Run registry/lifecycle tests and all extension checks.
- [ ] Commit:

```bash
git add apps/extension
git commit -m "fix(extension): scope player detection by provider"
```

### Task 12: Final Verification, Documentation, And PR 2

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/current-development-state.md`
- Modify: `docs/crunchyroll-adapter-notes.md`
- Create: `docs/youtube-adapter-notes.md`
- Update this plan's checkbox state and implementation notes

- [ ] Document provider ownership, registry order, source switching safety,
  unsupported routes, and the rule for adding a provider.
- [ ] Run `git diff --check`.
- [ ] Run extension check and full extension tests.
- [ ] Run staging extension build and artifact validation.
- [ ] Run `pnpm dev:check` and follow its recommended extension profile.
- [ ] Run `pnpm graph:update` and review only approved team graph artifacts.
- [ ] Perform two-profile staging acceptance on real YouTube:
  create/join room, play, pause, seek, same-video reload, host changes video,
  viewer follows and rejoins, fullscreen, volume ducking, player replacement,
  and leaving the watch route.
- [ ] Perform two-profile staging regression on real Crunchyroll with the same
  playback/source-switch scenarios currently supported.
- [ ] Verify Generic HTML5 on a local controlled fixture.
- [ ] Capture diagnostics for one successful YouTube and one successful
  Crunchyroll session without committing raw logs.
- [ ] Open one PR into `staging` titled
  `feat(extension): harden provider adapter lifecycle`.

## Required Automated Verification

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
fnm exec --using="$(cat .node-version)" pnpm build:extension:staging
fnm exec --using="$(cat .node-version)" pnpm validate:extension:staging
fnm exec --using="$(cat .node-version)" pnpm dev:check
git diff --check
```

The real WebRTC harness is not required because this plan does not change P2P
signaling or media tracks. Two-profile staging acceptance remains required
because adapter replacement, fullscreen mounting, and source navigation affect
the room experience around P2P media.

## Definition Of Done

- Generic, YouTube, and Crunchyroll logic live in separate provider folders.
- Shared runtime code contains no provider-name branches.
- No provider imports another provider.
- Unsupported YouTube/Crunchyroll routes cannot fall through to Generic.
- Adapter replacement and disposal are deterministic and tested.
- YouTube source fingerprints, descriptors, progress, and navigation use one
  canonical ID parser.
- YouTube guests follow a host to a different valid YouTube video and reattach
  to the same room.
- Crunchyroll playback and source navigation retain current tested behavior.
- Generic HTML5 behavior retains current tested behavior.
- Extension check, tests, staging build, artifact validation, and manual
  two-profile provider acceptance pass.
- Architecture/current-state/provider docs and Graphify are updated.

## Rollback

- PR 1 can be reverted independently because it is behavior-preserving.
- PR 2 can be reverted without reverting PR 1; the separated adapters remain a
  valid architecture even if lifecycle or YouTube source switching needs more
  investigation.
- No protocol, API, database, or environment rollback is required.
