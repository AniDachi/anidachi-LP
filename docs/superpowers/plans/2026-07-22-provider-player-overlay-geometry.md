# Provider Player Overlay Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AniDachi adapt its overlay to YouTube player controls as reliably
as it currently adapts to Crunchyroll, while keeping every provider's DOM logic
fully isolated.

**Architecture:** Each provider owns a pure player-chrome measurer and its own
event subscription. Shared overlay code receives only normalized
`PlayerOverlayGeometry`; it never imports provider selectors or checks an
adapter ID. The saved user layout remains provider-independent, while effective
runtime placement accounts for the active player's safe insets and launcher
anchors.

**Tech Stack:** TypeScript 6, React 19, WXT 0.20, MV3 isolated-world content
scripts, `ResizeObserver`, `MutationObserver`, `requestAnimationFrame`, Vitest 4.

## Prerequisites

- Complete the manual staging acceptance and PR checkpoint for PR 1 in
  `docs/superpowers/plans/2026-07-22-source-adapters-architecture.md`.
- Complete Task 7, the adapter lifecycle manager, before attaching geometry
  subscriptions to replaceable adapters.
- Start from a clean feature branch based on current `origin/staging`.
- Use Node `22.23.1` and pnpm `11.2.2` through the repository version files.
- Execute this plan as the geometry portion of source-adapter PR 2. Do not open
  a separate PR for each task.

## Global Constraints

- Provider folders must not import one another.
- Shared runtime files must not branch on `adapter.id` for overlay geometry.
- Do not use undocumented YouTube player methods or global internal objects.
- YouTube DOM selectors are implementation details and must live only under
  `src/source-adapters/youtube/`.
- Adapter constructors must not register observers, listeners, timers, or
  global state.
- Every subscription disposer must be idempotent and cancel pending animation
  frames and delayed measurements.
- Do not modify room protocol, P2P media, auth, subscriptions, media-seat rules,
  database state, or host permissions.
- Do not rewrite or migrate stored layout presets. Provider geometry modifies
  only the effective runtime layout.
- Do not make chat and camera placement chase captions, cards, ads, annotations,
  or end screens. Their transient movement would make the overlay unstable.
- Do not add a permanent polling interval. Measurements must be event-driven.
- If provider chrome cannot be measured, return normalized safe defaults instead
  of hiding, detaching, or breaking the overlay.
- Preserve the current Crunchyroll visual behavior before adding YouTube
  behavior.
- Follow YouTube policy: AniDachi controls must not block standard YouTube
  player controls.

## File Structure

```txt
apps/extension/src/source-adapters/
  core/
    overlay-geometry.ts       # provider-neutral value contract and normalization
    types.ts                  # VideoAdapter geometry capability
    html5-video-adapter.ts    # generic default implementation
  crunchyroll/
    adapter.ts                # exposes Crunchyroll geometry capability
    player-chrome.ts          # Crunchyroll-only measurement and subscription
  youtube/
    adapter.ts                # exposes YouTube geometry capability
    player-chrome.ts          # YouTube-only measurement and subscription

apps/extension/src/
  overlay-app.tsx             # consumes only adapter geometry capability
  overlay-layout-runtime.ts   # maps safe insets into layout-engine context
  overlay-layout.ts           # panel reserve calculation
  top-bubble-reveal.ts        # keeps edge intent and shifted launcher reachable
  styles.ts                   # separates edge glow from launcher positioning

apps/extension/test/source-adapters/
  core/overlay-geometry.test.ts
  crunchyroll/player-chrome.test.ts
  youtube/player-chrome.test.ts
```

## Core Contract

Create this provider-neutral value type. It describes results, not platform
measurement logic.

```ts
export interface PlayerOverlayInsets {
  topPx: number;
  rightPx: number;
  bottomPx: number;
  leftPx: number;
}

export interface PlayerOverlayAnchor {
  topPx: number;
  rightPx: number;
}

export interface PlayerOverlayGeometry {
  controlsVisible: boolean;
  viewport: {
    widthPx: number;
    heightPx: number;
  };
  safeInsets: PlayerOverlayInsets;
  launcher: PlayerOverlayAnchor;
  panel: PlayerOverlayAnchor;
}

export type PlayerOverlayGeometryListener = (
  geometry: PlayerOverlayGeometry,
) => void;
```

The adapter capability is:

```ts
export interface VideoAdapter {
  // Existing fields and methods remain unchanged.
  getOverlayGeometry(): PlayerOverlayGeometry;
  subscribeOverlayGeometry(
    listener: PlayerOverlayGeometryListener,
  ): () => void;
}
```

Subscription semantics:

- `getOverlayGeometry()` is pure and side-effect-free.
- `subscribeOverlayGeometry()` starts provider-owned observation.
- The listener receives only normalized geometry that differs from the last
  emitted value.
- Overlay code reads once through `getOverlayGeometry()` before subscribing.
- Disposal stops every observer, event listener, animation frame, and delayed
  transition measurement.

---

### Task 1: Add The Provider-Neutral Geometry Contract

**Files:**
- Create: `apps/extension/src/source-adapters/core/overlay-geometry.ts`
- Modify: `apps/extension/src/source-adapters/core/types.ts`
- Modify: `apps/extension/src/source-adapters/core/html5-video-adapter.ts`
- Test: `apps/extension/test/source-adapters/core/overlay-geometry.test.ts`

**Interfaces:**
- Produces: `PlayerOverlayGeometry`, `DEFAULT_PLAYER_OVERLAY_GEOMETRY`,
  `normalizePlayerOverlayGeometry()`, and
  `arePlayerOverlayGeometriesEqual()`.
- Produces: `VideoAdapter.getOverlayGeometry()` and
  `VideoAdapter.subscribeOverlayGeometry()`.

- [ ] **Step 1: Write failing normalization and equality tests**

Cover finite non-negative values, integer rounding, viewport bounds, invalid
input fallback, structural cloning, and equality after normalization.

```ts
expect(
  normalizePlayerOverlayGeometry({
    ...DEFAULT_PLAYER_OVERLAY_GEOMETRY,
    viewport: { widthPx: 960.4, heightPx: 540.4 },
    safeInsets: { topPx: -2, rightPx: 4.6, bottomPx: 86.4, leftPx: NaN },
  }),
).toEqual({
  controlsVisible: false,
  viewport: { widthPx: 960, heightPx: 540 },
  safeInsets: { topPx: 0, rightPx: 5, bottomPx: 86, leftPx: 0 },
  launcher: { topPx: 10, rightPx: 10 },
  panel: { topPx: 48, rightPx: 10 },
});
```

- [ ] **Step 2: Run the new test and verify RED**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/source-adapters/core/overlay-geometry.test.ts
```

Expected: failure because `overlay-geometry.ts` does not exist.

- [ ] **Step 3: Implement the contract and safe defaults**

Use these literal defaults:

```ts
export const DEFAULT_PLAYER_OVERLAY_GEOMETRY: PlayerOverlayGeometry = {
  controlsVisible: false,
  viewport: { widthPx: 0, heightPx: 0 },
  safeInsets: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
  launcher: { topPx: 10, rightPx: 10 },
  panel: { topPx: 48, rightPx: 10 },
};
```

Clamp insets and anchors to the measured viewport when its dimensions are
usable. Keep defaults unchanged when width or height is zero.

- [ ] **Step 4: Add side-effect-free Generic HTML5 defaults**

`Html5VideoAdapter.getOverlayGeometry()` returns a normalized copy whose
viewport comes from `container.getBoundingClientRect()`. Its subscription is a
no-op disposer; generic resize relocation remains owned by the content
lifecycle.

```ts
subscribeOverlayGeometry(
  _listener: PlayerOverlayGeometryListener,
): () => void {
  return () => undefined;
}
```

- [ ] **Step 5: Run focused tests and extension typecheck**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/source-adapters/core/overlay-geometry.test.ts \
  test/source-adapters/generic/adapter.test.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: focused tests and typecheck pass.

- [ ] **Step 6: Commit the contract**

```bash
git add apps/extension/src/source-adapters/core \
  apps/extension/test/source-adapters/core/overlay-geometry.test.ts
git commit -m "refactor(extension): define provider overlay geometry"
```

---

### Task 2: Move Crunchyroll Behind The Geometry Capability

**Files:**
- Modify: `apps/extension/src/source-adapters/crunchyroll/player-chrome.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/adapter.ts`
- Modify: `apps/extension/test/source-adapters/crunchyroll/player-chrome.test.ts`

**Interfaces:**
- Consumes: `PlayerOverlayGeometry` and its normalization/equality helpers.
- Produces: `getCrunchyrollPlayerOverlayGeometry()` and
  `subscribeCrunchyrollPlayerOverlayGeometry()`.

- [ ] **Step 1: Extend existing Crunchyroll characterization tests**

Keep the current expected geometry equivalent:

```ts
expect(getCrunchyrollPlayerOverlayGeometry(container)).toEqual({
  controlsVisible: true,
  viewport: { widthPx: 960, heightPx: 540 },
  safeInsets: { topPx: 0, rightPx: 0, bottomPx: 108, leftPx: 0 },
  launcher: { topPx: 13, rightPx: 10 },
  panel: { topPx: 51, rightPx: 10 },
});
```

Also test hidden controls, unusable containers, repeated identical geometry,
and idempotent subscription disposal.

- [ ] **Step 2: Run the Crunchyroll test and verify RED**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/source-adapters/crunchyroll/player-chrome.test.ts
```

Expected: failure because the new exports do not exist.

- [ ] **Step 3: Map the current measurement into the common value contract**

Preserve all existing selectors, visibility rules, constants, and clamping.
Rename only the returned shape. When controls are hidden, preserve the current
Crunchyroll runtime behavior by returning `safeInsets.bottomPx = 0`.

- [ ] **Step 4: Move Crunchyroll observation into its provider file**

The provider subscription must use:

- one `MutationObserver` scoped to the Crunchyroll player container;
- one `ResizeObserver` for the container and discovered chrome roots;
- `pointermove`, `pointerleave`, `transitionend`, and `fullscreenchange`;
- one requestAnimationFrame-coalesced measurement at a time;
- no interval.

Observe only `class`, `style`, `aria-hidden`, `hidden`, and `data-testid`
attributes plus child-list changes required for replaced controls.

- [ ] **Step 5: Expose capability methods from `CrunchyrollVideoAdapter`**

```ts
override getOverlayGeometry(): PlayerOverlayGeometry {
  return getCrunchyrollPlayerOverlayGeometry(this.container);
}

override subscribeOverlayGeometry(
  listener: PlayerOverlayGeometryListener,
): () => void {
  return subscribeCrunchyrollPlayerOverlayGeometry(this.container, listener);
}
```

- [ ] **Step 6: Run Crunchyroll and adapter regressions**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/source-adapters/crunchyroll/player-chrome.test.ts \
  test/source-adapters/crunchyroll/adapter.test.ts \
  test/video-adapter.test.ts
```

Expected: all tests pass with unchanged Crunchyroll values.

- [ ] **Step 7: Commit the provider migration**

```bash
git add apps/extension/src/source-adapters/crunchyroll \
  apps/extension/test/source-adapters/crunchyroll
git commit -m "refactor(extension): isolate crunchyroll overlay geometry"
```

---

### Task 3: Implement Pure YouTube Chrome Measurement

**Files:**
- Create: `apps/extension/src/source-adapters/youtube/player-chrome.ts`
- Modify: `apps/extension/src/source-adapters/youtube/adapter.ts`
- Test: `apps/extension/test/source-adapters/youtube/player-chrome.test.ts`

**Interfaces:**
- Produces: `getYouTubePlayerOverlayGeometry(container)`.
- Does not register observers or listeners in this task.

Use selectors only inside `youtube/player-chrome.ts`:

```ts
const YOUTUBE_BOTTOM_CHROME_SELECTORS = [
  ".ytp-chrome-bottom",
  ".ytp-progress-bar-container",
] as const;

const YOUTUBE_TOP_ACTION_SELECTORS = [
  ".ytp-watch-later-button",
  ".ytp-share-button",
  ".ytp-chrome-top-buttons button",
] as const;
```

- [ ] **Step 1: Write failing YouTube geometry tests**

Cover:

- unusable container returns defaults;
- visible bottom chrome produces `controlsVisible: true`;
- hidden-by-opacity bottom chrome remains a stable layout reservation but
  produces `controlsVisible: false`;
- top-right action controls shift the launcher to the left of their cluster;
- missing known selectors use visible-button geometric fallback;
- small players use bounded defaults instead of negative coordinates;
- normal, theater-size, and fullscreen-size rectangles normalize correctly.

Use this bottom inset rule in expected values:

```ts
bottomPx = clamp(
  containerRect.bottom - bottomChromeTop + 18,
  54,
  Math.min(180, containerRect.height - 72),
);
```

- [ ] **Step 2: Run the YouTube geometry test and verify RED**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/source-adapters/youtube/player-chrome.test.ts
```

Expected: failure because the module does not exist.

- [ ] **Step 3: Implement visual availability checks**

An element is usable only when:

- it belongs to the active player container;
- its rectangle intersects the container;
- width and height are greater than one pixel;
- no ancestor through the player root has `display: none`,
  `visibility: hidden`, or `visibility: collapse`;
- cumulative opacity is above `0.04` when checking current visibility.

Measure the same elements without the opacity condition to obtain stable layout
geometry while YouTube fades controls out.

- [ ] **Step 4: Implement bottom chrome reservation**

Use known bottom selectors first. If they are absent, inspect visible buttons,
sliders, and progress controls in the bottom 30% of the player. Exclude any
candidate wider than 96% and taller than 45% of the player to avoid treating a
whole overlay root as controls.

Keep the measured bottom reservation stable across opacity-only hide/show
transitions. This prevents cameras and chat from jumping every time YouTube
autohides its controls.

- [ ] **Step 5: Implement top launcher placement**

Use a nominal launcher size of `92 x 32`, a player margin of `10`, and a gap of
`8` pixels.

1. Build the top-right action cluster from known selectors.
2. If none are found, inspect visible `button` and `[role='button']` elements in
   the top 25% and right 45% of the player.
3. Place the launcher immediately left of the cluster when at least 92 pixels
   plus margins remain.
4. If there is not enough horizontal room, place it below the cluster at the
   right player margin.
5. If no cluster exists, use `{ topPx: 10, rightPx: 10 }`.
6. Set the panel anchor to `{ topPx: max(48, launcher.topPx + 40), rightPx: 10 }`.

- [ ] **Step 6: Expose pure geometry from `YouTubeVideoAdapter`**

Add `getOverlayGeometry()` only. Leave subscription as the inherited no-op
until Task 4.

- [ ] **Step 7: Run focused YouTube tests and typecheck**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/source-adapters/youtube/player-chrome.test.ts \
  test/source-adapters/youtube/adapter.test.ts \
  test/overlay-mount.test.ts
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: all focused tests and typecheck pass.

- [ ] **Step 8: Commit pure YouTube measurement**

```bash
git add apps/extension/src/source-adapters/youtube \
  apps/extension/test/source-adapters/youtube
git commit -m "feat(extension): measure youtube player chrome"
```

---

### Task 4: Add Event-Driven YouTube Geometry Updates

**Files:**
- Modify: `apps/extension/src/source-adapters/youtube/player-chrome.ts`
- Modify: `apps/extension/src/source-adapters/youtube/adapter.ts`
- Modify: `apps/extension/test/source-adapters/youtube/player-chrome.test.ts`

**Interfaces:**
- Produces: `subscribeYouTubePlayerOverlayGeometry(container, listener)`.

- [ ] **Step 1: Write failing subscription lifecycle tests**

Test initial scheduling, resize, player class mutation, child replacement,
pointer activity, fullscreen change, transition completion, duplicate-state
suppression, and repeated disposal.

The listener must not run twice for two events that resolve to identical
normalized geometry.

- [ ] **Step 2: Run the subscription tests and verify RED**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/source-adapters/youtube/player-chrome.test.ts
```

Expected: failure because subscription behavior is not implemented.

- [ ] **Step 3: Implement requestAnimationFrame-coalesced measurement**

Register:

- `ResizeObserver` on `#movie_player` and current top/bottom chrome roots;
- scoped `MutationObserver` for `class`, `style`, `aria-hidden`, and `hidden`;
- capturing `pointermove`, `pointerleave`, and `transitionend` listeners;
- document `fullscreenchange` listener.

Schedule one immediate animation-frame measurement and one delayed measurement
at 220 ms after a visibility-affecting event to capture YouTube's completed
fade transition. A new event replaces the pending delayed timer.

- [ ] **Step 4: Implement strict cleanup**

The disposer must:

- disconnect both observers;
- remove every listener with matching capture options;
- cancel the pending animation frame;
- clear the delayed transition timer;
- become a no-op after its first call.

- [ ] **Step 5: Override the YouTube subscription capability**

```ts
override subscribeOverlayGeometry(
  listener: PlayerOverlayGeometryListener,
): () => void {
  return subscribeYouTubePlayerOverlayGeometry(this.container, listener);
}
```

- [ ] **Step 6: Run focused tests and commit**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/source-adapters/youtube/player-chrome.test.ts \
  test/source-adapters/youtube/adapter.test.ts
git add apps/extension/src/source-adapters/youtube \
  apps/extension/test/source-adapters/youtube/player-chrome.test.ts
git commit -m "feat(extension): track youtube overlay geometry"
```

---

### Task 5: Make The Overlay Consume Adapter Geometry

**Files:**
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/overlay-layout-runtime.ts`
- Modify: `apps/extension/src/overlay-layout.ts`
- Modify: `apps/extension/src/top-bubble-reveal.ts`
- Modify: `apps/extension/src/styles.ts`
- Modify: `apps/extension/test/overlay-layout-runtime.test.ts`
- Modify: `apps/extension/test/overlay-layout.test.ts`
- Modify: `apps/extension/test/overlay-layout-styles.test.ts`
- Modify: `apps/extension/test/top-bubble-reveal.test.tsx`
- Test: `apps/extension/test/source-adapters/provider-boundaries.test.ts`

**Interfaces:**
- Consumes: `adapter.getOverlayGeometry()` and
  `adapter.subscribeOverlayGeometry()`.
- Produces: provider-independent effective overlay placement.

- [ ] **Step 1: Write failing runtime safe-inset tests**

Replace the bottom-only runtime input with the full provider value:

```ts
export interface OverlayLayoutRuntimeContextInput {
  width: number;
  height: number;
  cameraCount: number;
  playerSafeInsets?: {
    topPx: number;
    rightPx: number;
    bottomPx: number;
    leftPx: number;
  };
  safePaddingPx?: number;
  reservedRects?: PixelRect[];
}
```

Each effective inset is `max(safePaddingPx, playerSafeInset)`. Test all four
edges, malformed values, and zero-sized viewports.

- [ ] **Step 2: Run runtime tests and verify RED**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/overlay-layout-runtime.test.ts test/overlay-layout.test.ts
```

Expected: failure because runtime accepts only `controlsBottomInsetPx`.

- [ ] **Step 3: Implement full safe-inset mapping**

Do not add YouTube or Crunchyroll checks to the layout engine. The engine
continues to consume numeric safe insets only.

- [ ] **Step 4: Replace Crunchyroll-specific React state**

In `OverlayApp`:

```ts
const [playerOverlayGeometry, setPlayerOverlayGeometry] = useState(() =>
  adapter.getOverlayGeometry(),
);

useEffect(() => {
  setPlayerOverlayGeometry(adapter.getOverlayGeometry());
  return adapter.subscribeOverlayGeometry(setPlayerOverlayGeometry);
}, [adapter]);
```

Delete `CrunchyrollPlayerChromeState` imports and the Crunchyroll-only observer
effect. Do not replace them with `isYouTube` branches.

- [ ] **Step 5: Route every affected surface through geometry**

Use:

- `safeInsets.bottomPx` for camera, chat, reactions, and room rail;
- all `safeInsets` for layout-engine runtime bounds;
- `launcher.topPx/rightPx` for `--top-bubble-top/right`;
- `panel.topPx/rightPx` for `--mini-panel-top/right`;
- `controlsVisible` for the generic `player-controls-visible` class;
- `getMiniPanelBottomReservePx()` for panel bottom reserve.

Keep edge intent at the physical top-right player edge even when YouTube shifts
the closed launcher left of native buttons. Anchor the glow to the player edge,
not `--top-bubble-right`. When the panel opens, move the launcher to the panel
anchor so it remains visually attached to its close surface. When the panel
closes, return it to the provider launcher anchor.

Update `useTopBubbleReveal()` so transfer from the edge to the launcher uses the
launcher's real bounding rectangle. Remove the current assumption that a
visible launcher always lives inside the last 160 pixels of the player. Add a
regression test with a launcher shifted more than 160 pixels from the edge.

Do not write effective coordinates back to `OverlayLayoutDefinition` or storage.

- [ ] **Step 6: Add a provider-boundary assertion**

Extend `provider-boundaries.test.ts` so shared runtime files cannot import
`youtube/player-chrome` or `crunchyroll/player-chrome` and cannot compare
`adapter.id` to provider literals for geometry.

- [ ] **Step 7: Run integration tests and provider-ID scan**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/overlay-layout-runtime.test.ts \
  test/overlay-layout.test.ts \
  test/overlay-layout-styles.test.ts \
  test/top-bubble-reveal.test.tsx \
  test/source-adapters/provider-boundaries.test.ts
rg -n 'adapter\.id\s*[!=]==?\s*["\x27](youtube|crunchyroll)' \
  apps/extension/src/overlay-app.tsx \
  apps/extension/src/overlay-layout-runtime.ts
```

Expected: tests pass and `rg` prints no matches.

- [ ] **Step 8: Commit overlay integration**

```bash
git add apps/extension/src/overlay-app.tsx \
  apps/extension/src/overlay-layout-runtime.ts \
  apps/extension/src/overlay-layout.ts \
  apps/extension/src/top-bubble-reveal.ts \
  apps/extension/src/styles.ts \
  apps/extension/test
git commit -m "refactor(extension): consume player overlay geometry"
```

---

### Task 6: Harden Replacement, Fallback, And Performance Behavior

**Files:**
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/debug-log.ts`
- Modify: `apps/extension/test/source-adapters/content-lifecycle.test.tsx`
- Modify: `apps/extension/test/source-adapters/youtube/player-chrome.test.ts`
- Modify: `apps/extension/test/source-adapters/crunchyroll/player-chrome.test.ts`

**Interfaces:**
- Consumes: the stable adapter replacement flow from source-adapter Task 7 and
  React effect cleanup for geometry subscriptions.
- Produces: deterministic subscription replacement during SPA player changes.

- [ ] **Step 1: Write failing replacement tests**

Cover:

- old YouTube geometry subscription is disposed before a replacement adapter is
  activated;
- temporary player disappearance emits no stale geometry into the new player;
- leaving `/watch` detaches all provider observers;
- returning to `/watch` creates exactly one subscription;
- fullscreen replacement does not retain the previous viewport dimensions;
- unknown YouTube chrome falls back without detaching the room overlay.

- [ ] **Step 2: Run lifecycle tests and verify RED**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension exec \
  vitest run test/source-adapters/content-lifecycle.test.tsx \
  test/source-adapters/youtube/player-chrome.test.ts
```

- [ ] **Step 3: Fix cleanup ordering in the lifecycle hooks**

Required ownership and order:

```txt
adapter manager suspends playback application
-> content lifecycle replaces the adapter prop
-> old OverlayApp geometry effect runs its cleanup
-> old provider subscription disconnects
-> OverlayApp reads new adapter geometry
-> OverlayApp subscribes to new provider geometry
-> adapter manager resumes playback only when source identity matches
```

Do not make `AdapterManager` own React state or geometry listeners. Its role is
to make adapter replacement deterministic; `OverlayApp` owns the subscription
because it owns the rendered geometry state.

- [ ] **Step 4: Add bounded debug diagnostics**

Log one structured `overlay.geometry` entry only when normalized geometry
changes. Include adapter ID, viewport, insets, launcher anchor, panel anchor,
and controls visibility. Do not log DOM text, page content, or every pointer
event.

- [ ] **Step 5: Run lifecycle, check, and full extension tests**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
```

Expected: full extension suite passes without leaked timers or open handles.

- [ ] **Step 6: Commit lifecycle hardening**

```bash
git add apps/extension/src/overlay-app.tsx \
  apps/extension/src/debug-log.ts \
  apps/extension/test/source-adapters
git commit -m "fix(extension): clean up player geometry lifecycle"
```

---

### Task 7: Documentation, Staging Artifact, And Acceptance

**Files:**
- Create: `docs/youtube-adapter-notes.md`
- Modify: `docs/architecture.md`
- Modify: `docs/current-development-state.md`
- Modify: `docs/superpowers/plans/2026-07-22-source-adapters-architecture.md`
- Modify: `docs/superpowers/plans/2026-07-22-provider-player-overlay-geometry.md`

- [ ] **Step 1: Document provider ownership and fallback rules**

Record:

- YouTube selectors are isolated and non-contractual;
- geometry fallback behavior;
- observation and disposal rules;
- which transient UI is intentionally ignored;
- the manual procedure for updating selectors after YouTube changes;
- the rule for adding another provider geometry implementation.

- [ ] **Step 2: Run repository checks**

```bash
git diff --check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
fnm exec --using="$(cat .node-version)" pnpm dev:check
```

- [ ] **Step 3: Build and validate staging extension**

```bash
fnm exec --using="$(cat .node-version)" pnpm build:extension:staging
fnm exec --using="$(cat .node-version)" pnpm validate:extension:staging
```

- [ ] **Step 4: Run YouTube visual acceptance**

Verify a real valid `/watch?v=...` page in these combinations:

```txt
normal player   x controls visible/hidden
theater mode    x controls visible/hidden
fullscreen      x controls visible/hidden
small window    x controls visible/hidden
```

For each combination verify:

- launcher does not overlap YouTube buttons;
- panel remains inside the player;
- cameras, chat, reactions, and voice rail avoid bottom controls;
- opening/closing controls does not make camera/chat jump excessively;
- stored custom layout remains unchanged;
- layout preview and ghost elements match runtime placement;
- leaving `/watch` removes the overlay;
- changing video through YouTube SPA navigation replaces geometry cleanly.

- [ ] **Step 5: Run two-profile room acceptance on YouTube**

Create and join a staging room, then verify play, pause, seek, camera bubbles,
chat, reactions, fullscreen, theater mode, panel close/reopen, and host switching
to another valid YouTube video.

- [ ] **Step 6: Run Crunchyroll regression acceptance**

Repeat normal/fullscreen control visibility, custom camera/chat placement,
panel close/reopen, and one two-profile room session. Current Crunchyroll
geometry must not regress.

- [ ] **Step 7: Refresh Graphify and record evidence**

```bash
fnm exec --using="$(cat .node-version)" pnpm graph:update
```

Record test totals, staging artifact `version_name`, YouTube modes checked,
Crunchyroll regression result, Graphify query used, and rollback commit in the
PR description. Mark a checkbox complete only after its stated command or
manual scenario has actually passed.

- [ ] **Step 8: Open one PR into staging**

Use the parent source-adapter PR 2 title:

```txt
feat(extension): harden provider adapter lifecycle
```

Do not promote to `main` until staging acceptance passes.

## Done Means

- YouTube and Crunchyroll own independent player-chrome implementations.
- Shared overlay code consumes only `PlayerOverlayGeometry`.
- No provider selectors or geometry ID branches remain in shared runtime files.
- YouTube launcher, panel, cameras, chat, reactions, and voice rail avoid stable
  native control areas in normal, theater, fullscreen, and small-window modes.
- YouTube control fade does not continuously move the saved custom layout.
- Adapter replacement and route exit leave no observer, listener, timer, or
  stale geometry update behind.
- Unknown YouTube DOM falls back safely.
- Full extension tests, staging build validation, YouTube acceptance, and
  Crunchyroll regression acceptance pass.

## Rollback

Rollback is extension-only:

1. Revert the commits from Tasks 5 through 1 in reverse order.
2. Rebuild and validate the staging extension.
3. Confirm Generic and Crunchyroll return to their previous geometry path.
4. No API, protocol, database, or server rollback is required.
