# Overlay Layout Engine V2 Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the versioned, extension-local layout model and deterministic geometry engine that later editor and runtime work can share.

**Architecture:** Add a clean version 2 model beside the existing version 1 runtime, then add a DOM-free resolver in a separate file. Version 2 uses its own storage payload and never imports version 1 geometry. The first core increment stops before React, storage wiring, and visual changes; every output is exercised through focused Vitest coverage so runtime integration can consume a stable API.

**Tech Stack:** TypeScript 6, Vitest 4, WXT 0.20, existing pure camera-size helpers.

## Global Constraints

- Keep the grid at exactly 12 columns by 8 rows.
- Model exactly four media slots: one leader plus three followers.
- Keep layout persistence device-local; do not touch API, protocol, rooms, P2P, or server code.
- Add no drag-and-drop, geometry, or constraint-solving dependency.
- Keep exactly one clean default and one stored layout; preset logic is out of scope.
- Runtime adaptation must never mutate the stored definition.
- Do not import, translate, wrap, dual-read, or dual-write version 1 layout data.
- Leave the current version 1 runtime untouched only until the new runtime replaces and deletes it.
- Use ASCII in source and tests.

---

### Task 1: Version 2 Layout Model And Defaults

**Files:**
- Create: `apps/extension/src/overlay-layout-model.ts`
- Create: `apps/extension/test/overlay-layout-model.test.ts`
- Reference: `apps/extension/src/overlay-layout-preferences.ts`
- Reference: `apps/extension/src/ghost-cam-size.ts`

**Interfaces:**
- Produces: `OverlayLayoutDefinition`, `OverlayLayoutPreferencesV2`, `getDefaultOverlayLayoutDefinition()`, `getDefaultOverlayLayoutPreferencesV2()`, `normalizeOverlayLayoutDefinition()`, and `parseOverlayLayoutPreferencesV2()`.
- Consumes: unknown version 2 storage input.
- Preserves: existing `overlay-layout-preferences.ts` exports so the current UI continues compiling unchanged.

- [x] **Step 1: Write failing model and parsing tests**

Create tests that lock the public behavior:

```ts
import { describe, expect, it } from "vitest";
import {
  getDefaultOverlayLayoutDefinition,
  getDefaultOverlayLayoutPreferencesV2,
  normalizeOverlayLayoutDefinition,
  parseOverlayLayoutPreferencesV2,
} from "../src/overlay-layout-model";

describe("overlay layout model v2", () => {
  it("defaults to the clean four-seat definition", () => {
    const preferences = getDefaultOverlayLayoutPreferencesV2();
    const definition = getDefaultOverlayLayoutDefinition();

    expect(preferences).toEqual({ layout: definition, version: 2 });
    expect(definition.video).toMatchObject({ leaderSide: "right", sizeStep: 1 });
    expect(definition.chat).toMatchObject({ maxMessages: 5, textScale: "normal" });
  });

  it("rejects version 1 geometry and starts from clean defaults", () => {
    const preferences = parseOverlayLayoutPreferencesV2({
      version: 1,
      presetId: "custom",
      objects: {
        video: { x: 1, y: 2, w: 4, h: 2 },
        chat: { x: 7, y: 3, w: 5, h: 2 },
      },
      chat: { maxMessages: 8 },
    });

    expect(preferences).toEqual(getDefaultOverlayLayoutPreferencesV2());
  });

  it("normalizes malformed fields without mutating the input", () => {
    const input = {
      video: { anchor: { x: -99, y: 99 }, leaderSide: "invalid", sizeStep: 99 },
      chat: { position: { x: 99, y: -10 }, width: 99, textScale: "tiny", maxMessages: 7 },
    };
    const snapshot = structuredClone(input);
    const normalized = normalizeOverlayLayoutDefinition(input);

    expect(input).toEqual(snapshot);
    expect(normalized.video.anchor).toEqual({ x: 0, y: 7 });
    expect(normalized.video).toMatchObject({ leaderSide: "left", sizeStep: 3 });
    expect(normalized.chat).toMatchObject({ maxMessages: 8, textScale: "normal", width: 6 });
  });

  it("is idempotent for valid version 2 storage", () => {
    const first = parseOverlayLayoutPreferencesV2(getDefaultOverlayLayoutPreferencesV2());
    const second = parseOverlayLayoutPreferencesV2(first);
    expect(second).toEqual(first);
  });
});
```

- [x] **Step 2: Run the focused test and verify the missing-module failure**

Run:

```bash
pnpm --filter @anidachi/extension exec vitest run test/overlay-layout-model.test.ts
```

Expected: FAIL because `../src/overlay-layout-model` does not exist.

- [x] **Step 3: Implement the version 2 model**

Create these exact public types and constants:

```ts
export const OVERLAY_LAYOUT_GRID_COLUMNS = 12;
export const OVERLAY_LAYOUT_GRID_ROWS = 8;
export const OVERLAY_LAYOUT_STORAGE_VERSION = 2 as const;

export type OverlayLayoutLeaderSide = "left" | "right";
export type OverlayLayoutTextScale = "compact" | "normal" | "large";
export type OverlayLayoutMessageCount = 3 | 5 | 8;
export type OverlayLayoutCameraSizeStep = 0 | 1 | 2 | 3;

export interface OverlayLayoutGridPoint { x: number; y: number }
export interface OverlayLayoutDefinition {
  video: {
    anchor: OverlayLayoutGridPoint;
    leaderSide: OverlayLayoutLeaderSide;
    sizeStep: OverlayLayoutCameraSizeStep;
  };
  chat: {
    position: OverlayLayoutGridPoint;
    width: number;
    textScale: OverlayLayoutTextScale;
    maxMessages: OverlayLayoutMessageCount;
  };
}
export interface OverlayLayoutPreferencesV2 {
  version: typeof OVERLAY_LAYOUT_STORAGE_VERSION;
  layout: OverlayLayoutDefinition;
}
```

Define one immutable default with video `{ anchor: { x: 11, y: 6 }, leaderSide: "right", sizeStep: 1 }` and chat `{ position: { x: 0, y: 4 }, width: 5, textScale: "normal", maxMessages: 5 }`. Return defensive clones from every public getter.

Implement normalization with these exact ranges and fallbacks:

- video anchor: integer `x` in `0..11`, integer `y` in `0..7`;
- leader side: `left` or `right`, fallback inferred from anchor half and then `right`;
- size step: nearest integer in `0..3`, fallback `1`;
- chat position: integer `x` in `0..11`, integer `y` in `0..7`;
- chat width: integer `3..6`, also clamped so `position.x + width <= 12`;
- text scale: exact supported value, fallback `normal`;
- message count: nearest of `3`, `5`, and `8`.

Implement `parseOverlayLayoutPreferencesV2(value)` so it:

1. normalizes version 2 data directly;
2. normalizes the version 2 `layout` field-by-field;
3. returns the clean default for version 1, missing, or unrecognized input;
4. never reads version 1 rectangles or the old camera-size key.

- [x] **Step 4: Run model tests and extension type checking**

Run:

```bash
pnpm --filter @anidachi/extension exec vitest run test/overlay-layout-model.test.ts
pnpm --filter @anidachi/extension check
```

Expected: model tests PASS and extension TypeScript check exits `0`.

- [x] **Step 5: Commit the model**

```bash
git add apps/extension/src/overlay-layout-model.ts apps/extension/test/overlay-layout-model.test.ts
git commit -m "feat(extension): add overlay layout model v2"
```

---

### Task 2: Deterministic Camera Slot Geometry

**Files:**
- Create: `apps/extension/src/overlay-layout-engine.ts`
- Create: `apps/extension/test/overlay-layout-engine.test.ts`
- Reference: `apps/extension/src/ghost-cam-size.ts`
- Reference: `apps/extension/src/overlay-layout-model.ts`

**Interfaces:**
- Consumes: `OverlayLayoutDefinition["video"]`, `OverlayLayoutViewport`, and camera count `0..4`.
- Produces: `PixelRect`, `OverlayLayoutSafeInsets`, `ResolvedVideoLayout`, and `resolveVideoLayout()`.
- Later task dependency: Task 3 composes `resolveVideoLayout()` inside `resolveOverlayLayout()`.

- [x] **Step 1: Write failing camera geometry tests**

```ts
import { describe, expect, it } from "vitest";
import { resolveVideoLayout } from "../src/overlay-layout-engine";

const viewport = {
  height: 720,
  safeInsets: { bottom: 56, left: 12, right: 12, top: 12 },
  width: 1280,
};

describe("overlay layout camera geometry", () => {
  it("places four right-side slots from the leader inward", () => {
    const result = resolveVideoLayout(
      { anchor: { x: 11, y: 5 }, leaderSide: "right", sizeStep: 1 },
      viewport,
      4,
    );
    expect(result.slots).toHaveLength(4);
    expect(result.slots[0]!.x).toBeGreaterThan(result.slots[1]!.x);
    expect(result.slots[1]!.x).toBeGreaterThan(result.slots[2]!.x);
    expect(result.slots[2]!.x).toBeGreaterThan(result.slots[3]!.x);
  });

  it("places left-side followers toward the screen interior", () => {
    const result = resolveVideoLayout(
      { anchor: { x: 0, y: 3 }, leaderSide: "left", sizeStep: 1 },
      viewport,
      4,
    );
    expect(result.slots[0]!.x).toBeLessThan(result.slots[1]!.x);
    expect(result.slots[3]!.x + result.slots[3]!.width).toBeLessThanOrEqual(1268);
  });

  it("returns only occupied runtime slots and keeps all geometry in bounds", () => {
    for (const count of [0, 1, 2, 3, 4] as const) {
      const result = resolveVideoLayout(
        { anchor: { x: 11, y: 7 }, leaderSide: "right", sizeStep: 3 },
        { ...viewport, height: 360, width: 640 },
        count,
      );
      expect(result.slots).toHaveLength(count);
      for (const slot of result.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(12);
        expect(slot.y).toBeGreaterThanOrEqual(12);
        expect(slot.x + slot.width).toBeLessThanOrEqual(628);
        expect(slot.y + slot.height).toBeLessThanOrEqual(304);
      }
    }
  });
});
```

- [x] **Step 2: Run the test and verify the missing-export failure**

```bash
pnpm --filter @anidachi/extension exec vitest run test/overlay-layout-engine.test.ts
```

Expected: FAIL because `resolveVideoLayout` is not implemented.

- [x] **Step 3: Implement camera slot resolution**

Create these public interfaces:

```ts
export interface PixelRect { x: number; y: number; width: number; height: number }
export interface OverlayLayoutSafeInsets { top: number; right: number; bottom: number; left: number }
export interface OverlayLayoutViewport {
  width: number;
  height: number;
  safeInsets: OverlayLayoutSafeInsets;
}
export interface ResolvedVideoLayout {
  bounds: PixelRect;
  effectiveSizePx: number;
  effectiveSizeStep: OverlayLayoutCameraSizeStep;
  leaderSide: OverlayLayoutLeaderSide;
  slots: PixelRect[];
}
```

Implement `resolveVideoLayout(video, viewport, cameraCount, maximumSizeStep?)` as a pure function:

1. normalize viewport dimensions and insets to finite non-negative numbers;
2. clamp camera count to integer `0..4`;
3. resolve the responsive bubble size with the existing `getResponsiveGhostCamSizePx()` and gap with `getGhostCamGapPx()`;
4. convert the leader grid point to a pixel center inside the usable inset rectangle;
5. generate followers to the right for `leaderSide: "left"` and to the left for `leaderSide: "right"`;
6. translate the entire group back inside the usable rectangle instead of moving individual slots;
7. return a zero-sized finite bounds rectangle and no slots for camera count zero;
8. never mutate the input video definition or viewport.

The optional `maximumSizeStep` supports Task 3 compact fallback without changing the stored size step.

- [x] **Step 4: Run camera tests and extension checks**

```bash
pnpm --filter @anidachi/extension exec vitest run test/overlay-layout-engine.test.ts
pnpm --filter @anidachi/extension check
```

Expected: camera tests PASS and TypeScript check exits `0`.

- [x] **Step 5: Commit camera geometry**

```bash
git add apps/extension/src/overlay-layout-engine.ts apps/extension/test/overlay-layout-engine.test.ts
git commit -m "feat(extension): resolve adaptive camera slots"
```

---

### Task 3: Chat Geometry, Collision Search, And Core Resolver

**Files:**
- Modify: `apps/extension/src/overlay-layout-engine.ts`
- Modify: `apps/extension/test/overlay-layout-engine.test.ts`

**Interfaces:**
- Consumes: `OverlayLayoutDefinition`, `OverlayLayoutContext`, `resolveVideoLayout()`.
- Produces: `ResolvedChatLayout`, `ResolvedOverlayLayout`, and `resolveOverlayLayout()`.
- Guarantees: finite output, deterministic nearest placement, no input mutation, and stored intent unchanged during compact fallback.

- [x] **Step 1: Add failing chat and collision tests**

Append tests covering exact behavior:

```ts
import { getDefaultOverlayLayoutDefinition } from "../src/overlay-layout-model";
import { rectsOverlap, resolveOverlayLayout } from "../src/overlay-layout-engine";

it("derives larger chat geometry from text scale and message count", () => {
  const definition = getDefaultOverlayLayoutDefinition();
  const compact = resolveOverlayLayout(
    { ...definition, chat: { ...definition.chat, maxMessages: 3, textScale: "compact" } },
    { cameraCount: 0, reservedRects: [], viewport },
  );
  const large = resolveOverlayLayout(
    { ...definition, chat: { ...definition.chat, maxMessages: 8, textScale: "large" } },
    { cameraCount: 0, reservedRects: [], viewport },
  );
  expect(large.chat.rect.height).toBeGreaterThan(compact.chat.rect.height);
  expect(large.chat.fontSizePx).toBeGreaterThan(compact.chat.fontSizePx);
});

it("moves chat to the nearest free grid position without moving the camera anchor", () => {
  const definition = getDefaultOverlayLayoutDefinition();
  const result = resolveOverlayLayout(definition, {
    cameraCount: 4,
    reservedRects: [{ x: 0, y: 650, width: 1280, height: 70 }],
    viewport,
  });
  expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
  expect(result.video.leaderSide).toBe(definition.video.leaderSide);
});

it("uses temporary compact fallback without mutating preferences", () => {
  const definition = getDefaultOverlayLayoutDefinition();
  const snapshot = structuredClone(definition);
  const result = resolveOverlayLayout(definition, {
    cameraCount: 4,
    reservedRects: [],
    viewport: {
      height: 360,
      safeInsets: { bottom: 40, left: 8, right: 8, top: 8 },
      width: 640,
    },
  });
  expect(definition).toEqual(snapshot);
  expect(result.chat.effectiveMaxMessages).toBeLessThanOrEqual(definition.chat.maxMessages);
  expect(result.video.effectiveSizeStep).toBeLessThanOrEqual(definition.video.sizeStep);
  expect(rectsOverlap(result.chat.rect, result.video.bounds)).toBe(false);
});

it("returns finite geometry for an invalid viewport", () => {
  const definition = getDefaultOverlayLayoutDefinition();
  const result = resolveOverlayLayout(definition, {
    cameraCount: 4,
    reservedRects: [],
    viewport: {
      height: Number.NaN,
      safeInsets: { bottom: -1, left: Number.NaN, right: 0, top: 0 },
      width: 0,
    },
  });
  for (const value of Object.values(result.chat.rect)) expect(Number.isFinite(value)).toBe(true);
  for (const value of Object.values(result.video.bounds)) expect(Number.isFinite(value)).toBe(true);
});
```

- [x] **Step 2: Run the focused test and verify missing resolver exports**

```bash
pnpm --filter @anidachi/extension exec vitest run test/overlay-layout-engine.test.ts
```

Expected: FAIL because `resolveOverlayLayout` and `rectsOverlap` do not exist.

- [x] **Step 3: Implement chat metrics and collision search**

Use fixed readable text metrics:

```ts
const CHAT_TEXT_METRICS = {
  compact: { fontSizePx: 11, lineHeightPx: 14, rowHeightPx: 30 },
  normal: { fontSizePx: 13, lineHeightPx: 16, rowHeightPx: 34 },
  large: { fontSizePx: 15, lineHeightPx: 19, rowHeightPx: 39 },
} as const;
const CHAT_PADDING_X_PX = 10;
const CHAT_PADDING_Y_PX = 8;
const CHAT_ROW_GAP_PX = 5;
```

Add these interfaces:

```ts
export interface OverlayLayoutContext {
  viewport: OverlayLayoutViewport;
  reservedRects: PixelRect[];
  cameraCount: 0 | 1 | 2 | 3 | 4;
}
export interface ResolvedChatLayout {
  rect: PixelRect;
  effectiveMaxMessages: OverlayLayoutMessageCount;
  fontSizePx: number;
  lineHeightPx: number;
}
export interface ResolvedOverlayLayout {
  video: ResolvedVideoLayout;
  chat: ResolvedChatLayout;
}
```

Implement `resolveOverlayLayout(definition, context)` with this deterministic order:

1. normalize the definition with `normalizeOverlayLayoutDefinition()`;
2. normalize the viewport and reserved rectangles;
3. try the stored camera size and stored chat message count;
4. compute chat width from grid columns inside the usable inset width;
5. compute chat height as `padding * 2 + rows * rowHeight + gaps`;
6. enumerate all valid chat grid positions and rank by Manhattan distance from the requested position, then by `y`, then by `x`;
7. reject candidates outside the safe rectangle or overlapping video/reserved rectangles;
8. if no candidate fits, retry supported message counts at or below the stored
   value in descending order (`8`, `5`, `3`) and camera sizes from the stored
   step down to `0`;
9. return the first valid combination without modifying the definition;
10. for an unusable viewport, return finite zero-origin fallback rectangles.

Export `rectsOverlap(a, b)` for direct geometry tests. Treat zero-area rectangles as non-blocking.

- [x] **Step 4: Run focused and complete extension verification**

```bash
pnpm --filter @anidachi/extension exec vitest run test/overlay-layout-engine.test.ts
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
```

Expected: all engine tests PASS, all extension tests PASS, and type checking exits `0`.

- [x] **Step 5: Commit the completed core resolver**

```bash
git add apps/extension/src/overlay-layout-engine.ts apps/extension/test/overlay-layout-engine.test.ts
git commit -m "feat(extension): add overlay layout resolver"
```

---

### Task 4: Core Acceptance And Knowledge Graph Refresh

**Files:**
- Modify when generated: `graphify-out/graph.json`
- Modify when generated: `graphify-out/GRAPH_REPORT.md`
- Modify when generated: `graphify-out/manifest.json`

**Interfaces:**
- Verifies: Tasks 1-3 form a clean, tested, extension-local foundation.
- Produces: a reviewable core checkpoint before any React/runtime integration begins.

- [x] **Step 1: Run repository quality routing**

```bash
pnpm dev:check
```

Expected: extension and docs profiles are recommended, with no unexpected API,
protocol, database, or deployment profile.

- [x] **Step 2: Run final core checks**

```bash
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
git diff --check origin/staging...HEAD
```

Expected: all commands exit `0` and the diff contains only the approved layout
core, tests, specification, plan, and approved graph artifacts.

- [x] **Step 3: Refresh Graphify after meaningful architecture changes**

```bash
pnpm graph:update
```

Inspect `git status`. Keep only `graphify-out/graph.json`,
`graphify-out/GRAPH_REPORT.md`, and `graphify-out/manifest.json` if Graphify
changed them. Do not add cost files, HTML, cache, wiki, or scratch exports.

- [x] **Step 4: Commit approved graph artifacts separately**

Run only when approved graph files changed:

```bash
git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json
git commit -m "chore(graph): refresh overlay layout architecture"
```

- [x] **Step 5: Record the core checkpoint**

Update this plan's Task 1-4 checkboxes and add a short execution note containing
the final test counts, commit SHAs, and any deliberate deviations. Commit only
the plan update:

```bash
git add docs/superpowers/plans/2026-07-14-overlay-layout-engine-v2-core.md
git commit -m "docs(extension): record layout core checkpoint"
```

The next plan starts runtime/editor integration only after this checkpoint is
reviewed. Advanced named presets remain a later product increment.

## Execution Note

Completed on `codex/overlay-layout-engine-v2` from `origin/staging` at
`378f823`.

- Clean V2 model and normalization: `eadeda0`; focused model tests passed 5/5.
- Clean-start scope correction: `a528af9`; no migration, adapter, preset, or
  custom-state surface remains in the V2 core.
- Camera slot geometry: `4a7bd62`; safe-area sizing correction: `25d5396`.
- Chat geometry, collision search, and combined resolver: `be28fcf`; focused
  engine tests passed 12/12.
- Final extension verification passed 33 files and 359 tests; extension type
  checking and `git diff --check origin/staging...HEAD` passed.
- `pnpm dev:check` selected only the extension and docs profiles.
- Graphify refresh: `80f612a`. `.graphifyignore` now excludes the local
  `.superpowers/` execution ledger so scratch reports cannot enter committed
  graph artifacts.

Deliberate degradation remains limited to physically impossible geometry: when
the safe area is fully blocked even at the minimum supported chat and camera
sizes, the resolver returns one finite, clamped, deterministic result that may
overlap. Stored layout intent is never changed. Presets and runtime/editor
integration remain outside this checkpoint.
