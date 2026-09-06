# Interface Visibility Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `Interface` settings section that controls main-control and
participant-pill visibility while preserving existing room, media, and provider
behavior.

**Architecture:** Store one validated extension-local preference object and
resolve presentation through pure policy functions shared by the live overlay
and miniature preview. Existing launcher and room-rail components retain their
pointer, focus, timing, geometry, and participant-audio responsibilities.

**Tech Stack:** TypeScript, React, WXT storage, Vitest, jsdom, Lucide React,
extension Shadow DOM CSS.

**Implementation Status:** Tasks 1-6 and automated Task 7 verification are
complete on `codex/voice-controls-plan`. Staging visual acceptance is pending.

**2026-09-04 correction:** The approved main-control behavior is independent of
microphone state. Remove the former Open mic pin, badge, and label suffix; keep
participant voice indicators and publication unchanged. The policy and hook
examples below reflect this correction. Verify active Open mic in both main
visibility modes with the real overlay component before rebuilding the artifact.

Local correction verification: extension check, 1517/1517 tests, changed-file
lint, staging build/validation, and byte-for-byte synchronization of both test
folders passed. Loaded-browser acceptance remains pending. Graphify maintenance
and the documentation refresh are tracked in `docs/project-knowledge-map.md`.

Closeout verification on 2026-09-04: the full workspace test run was repeated
without cache reuse (extension 1578 passed; web 412 passed and 3 existing skips;
API 201 passed; protocol 141 passed). Workspace typechecks passed. This is an
extension-local visibility correction, not a microphone/transport change; the
real overlay integration tests verify that hiding the launcher does not stop
publication. The correction is being integrated through a dedicated staging PR,
separate from Graphify maintenance. The historical rollout instructions below
describe the original feature; the broader provider/mode visual matrix remains
a pre-production acceptance requirement, not a claim made by these tests.

## Global Constraints

- The approved design is
  `docs/superpowers/specs/2026-07-30-interface-visibility-settings-design.md`.
- The settings label is `Interface`.
- Navigation order is `Reactions`, `Layout`, `Interface`, `Voice`, `Debug`.
- Main-control choices are `Auto hide` and `Always visible`.
- Participant-pill choices are `Smart` and `Always visible`.
- No presets, `Apply`, `Revert`, advanced section, or account synchronization.
- Defaults must reproduce the current launcher and room-rail behavior.
- Open panel and keyboard focus override main-control auto-hide. Microphone
  state does not affect the launcher.
- The side rail never renders without an active room or while the main panel is
  open.
- A mounted video participant never receives a duplicate side pill.
- Smart mode retains the current full-list edge-intent behavior.
- Persistent participant pills remain compact; only the hovered, focused, or
  actively adjusted participant expands.
- Current-user pills never expose local output volume or mute controls.
- Remote volume and mute remain listener-local and use existing audio
  preferences.
- No protocol, API, Worker, database, P2P transport, or provider-adapter changes.
- Do not add dependencies.
- Every implementation task ends with focused tests and one coherent commit.

---

### Task 1: Define The Versioned Interface Preference Model

**Files:**
- Create: `apps/extension/src/interface-preferences.ts`
- Create: `apps/extension/test/interface-preferences.test.ts`

**Interfaces:**
- Produces:

```ts
export const INTERFACE_PREFERENCES_STORAGE_KEY =
  "local:interfacePreferencesV1" as const;
export const INTERFACE_PREFERENCES_VERSION = 1 as const;

export type MainControlVisibility = "auto-hide" | "always-visible";
export type ParticipantPillVisibility = "smart" | "always-visible";

export interface InterfacePreferencesV1 {
  version: typeof INTERFACE_PREFERENCES_VERSION;
  mainControlVisibility: MainControlVisibility;
  participantPillVisibility: ParticipantPillVisibility;
}

export type InterfacePreferencesPatch = Partial<
  Pick<
    InterfacePreferencesV1,
    "mainControlVisibility" | "participantPillVisibility"
  >
>;

export function getDefaultInterfacePreferences(): InterfacePreferencesV1;
export function parseInterfacePreferences(value: unknown): InterfacePreferencesV1;
export function updateInterfacePreferences(
  current: InterfacePreferencesV1,
  patch: InterfacePreferencesPatch,
): InterfacePreferencesV1;
```

- Consumes: no runtime or storage dependencies.

- [x] **Step 1: Write failing normalization tests**

Create table-driven tests covering the complete default, one valid payload,
field-by-field fallback, arrays, `null`, unknown versions, and immutable return
objects:

```ts
import { describe, expect, it } from "vitest";
import {
  getDefaultInterfacePreferences,
  parseInterfacePreferences,
  updateInterfacePreferences,
} from "../src/interface-preferences";

describe("interface preferences", () => {
  it("uses the existing behavior as the default", () => {
    expect(getDefaultInterfacePreferences()).toEqual({
      version: 1,
      mainControlVisibility: "auto-hide",
      participantPillVisibility: "smart",
    });
  });

  it("falls back invalid fields independently", () => {
    expect(
      parseInterfacePreferences({
        version: 1,
        mainControlVisibility: "always-visible",
        participantPillVisibility: "hidden",
      }),
    ).toEqual({
      version: 1,
      mainControlVisibility: "always-visible",
      participantPillVisibility: "smart",
    });
  });

  it("rejects unknown versions", () => {
    expect(
      parseInterfacePreferences({
        version: 2,
        mainControlVisibility: "always-visible",
        participantPillVisibility: "always-visible",
      }),
    ).toEqual(getDefaultInterfacePreferences());
  });

  it("normalizes patches without mutating the current object", () => {
    const current = getDefaultInterfacePreferences();
    const next = updateInterfacePreferences(current, {
      participantPillVisibility: "always-visible",
    });

    expect(next).toEqual({
      version: 1,
      mainControlVisibility: "auto-hide",
      participantPillVisibility: "always-visible",
    });
    expect(next).not.toBe(current);
    expect(current.participantPillVisibility).toBe("smart");
  });
});
```

- [x] **Step 2: Run the focused test and verify failure**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- interface-preferences
```

Expected: FAIL because `interface-preferences.ts` does not exist.

- [x] **Step 3: Implement the model without legacy migration**

Implement exact enum guards and defensive object creation:

```ts
export function getDefaultInterfacePreferences(): InterfacePreferencesV1 {
  return {
    version: INTERFACE_PREFERENCES_VERSION,
    mainControlVisibility: "auto-hide",
    participantPillVisibility: "smart",
  };
}

export function parseInterfacePreferences(value: unknown): InterfacePreferencesV1 {
  const defaults = getDefaultInterfacePreferences();
  if (!isRecord(value) || value.version !== INTERFACE_PREFERENCES_VERSION) {
    return defaults;
  }

  return {
    version: INTERFACE_PREFERENCES_VERSION,
    mainControlVisibility:
      value.mainControlVisibility === "auto-hide" ||
      value.mainControlVisibility === "always-visible"
        ? value.mainControlVisibility
        : defaults.mainControlVisibility,
    participantPillVisibility:
      value.participantPillVisibility === "smart" ||
      value.participantPillVisibility === "always-visible"
        ? value.participantPillVisibility
        : defaults.participantPillVisibility,
  };
}

export function updateInterfacePreferences(
  current: InterfacePreferencesV1,
  patch: InterfacePreferencesPatch,
): InterfacePreferencesV1 {
  return parseInterfacePreferences({
    ...current,
    ...patch,
    version: INTERFACE_PREFERENCES_VERSION,
  });
}
```

Keep `isRecord()` private. Do not read old layout, voice, or overlay keys.

- [x] **Step 4: Run the focused test and typecheck**

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- interface-preferences
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: PASS.

- [x] **Step 5: Commit the model**

```bash
git add apps/extension/src/interface-preferences.ts \
  apps/extension/test/interface-preferences.test.ts
git commit -m "feat(extension): define interface visibility preferences"
```

---

### Task 2: Add One Pure Visibility Policy For Runtime And Preview

**Files:**
- Create: `apps/extension/src/interface-visibility.ts`
- Create: `apps/extension/test/interface-visibility.test.ts`

**Interfaces:**
- Consumes:
  - `MainControlVisibility`
  - `ParticipantPillVisibility`
- Produces:

```ts
export type MainControlRevealPhase = "hidden" | "glow" | "visible";
export type ParticipantPillPresentation = "hidden" | "compact" | "expanded";

export interface MainControlPresentation {
  edgeGlowVisible: boolean;
  edgeIntentEnabled: boolean;
  pinned: boolean;
  visible: boolean;
}

export function resolveMainControlPresentation(input: {
  focused: boolean;
  mode: MainControlVisibility;
  panelOpen: boolean;
  phase: MainControlRevealPhase;
}): MainControlPresentation;

export interface ParticipantRailPresentation {
  edgeIntentEnabled: boolean;
  fullListExpanded: boolean;
  persistentCompact: boolean;
}

export function resolveParticipantRailPresentation(input: {
  edgeExpanded: boolean;
  mode: ParticipantPillVisibility;
}): ParticipantRailPresentation;

export function resolveParticipantPillPresentation(input: {
  interacted: boolean;
  mode: ParticipantPillVisibility;
  railExpanded: boolean;
  speaking: boolean;
}): ParticipantPillPresentation;
```

- [x] **Step 1: Write failing policy matrices**

Cover precedence, not implementation details:

```ts
describe("main control visibility", () => {
  it.each([
    ["auto-hide", "hidden", false, false],
    ["auto-hide", "glow", false, true],
    ["auto-hide", "visible", true, false],
    ["always-visible", "hidden", true, false],
  ] as const)("resolves %s / %s", (mode, phase, visible, glow) => {
    expect(
      resolveMainControlPresentation({
        focused: false,
        mode,
        panelOpen: false,
        phase,
      }),
    ).toMatchObject({ visible, edgeGlowVisible: glow });
  });

  it("pins Auto hide for panel or focus", () => {
    for (const override of [
      { panelOpen: true, focused: false },
      { panelOpen: false, focused: true },
    ]) {
      expect(
        resolveMainControlPresentation({
          ...override,
          mode: "auto-hide",
          phase: "hidden",
        }),
      ).toMatchObject({ pinned: true, visible: true, edgeIntentEnabled: false });
    }
  });
});

describe("participant rail visibility", () => {
  it("disables edge intent in persistent mode", () => {
    expect(
      resolveParticipantRailPresentation({
        edgeExpanded: false,
        mode: "always-visible",
      }).edgeIntentEnabled,
    ).toBe(false);
  });

  it("keeps Smart quiet pills hidden and speaking pills compact", () => {
    expect(
      resolveParticipantPillPresentation({
        interacted: false,
        mode: "smart",
        railExpanded: false,
        speaking: false,
      }),
    ).toBe("hidden");
    expect(
      resolveParticipantPillPresentation({
        interacted: false,
        mode: "smart",
        railExpanded: false,
        speaking: true,
      }),
    ).toBe("compact");
  });

  it("keeps persistent pills compact and expands only interaction", () => {
    expect(
      resolveParticipantPillPresentation({
        interacted: false,
        mode: "always-visible",
        railExpanded: false,
        speaking: false,
      }),
    ).toBe("compact");
    expect(
      resolveParticipantPillPresentation({
        interacted: true,
        mode: "always-visible",
        railExpanded: false,
        speaking: false,
      }),
    ).toBe("expanded");
  });
});
```

Also test that Smart `edgeExpanded` expands every pill and that
`always-visible` disables edge intent.

- [x] **Step 2: Run the focused test and verify failure**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- interface-visibility
```

Expected: FAIL because the policy module does not exist.

- [x] **Step 3: Implement deterministic resolvers**

Use the approved precedence directly:

```ts
const pinned =
  input.mode === "always-visible" ||
  input.panelOpen ||
  input.focused;

return {
  edgeGlowVisible: !pinned && input.phase === "glow",
  edgeIntentEnabled: !pinned,
  pinned,
  visible: pinned || input.phase === "visible",
};
```

For the rail:

```ts
const persistentCompact = input.mode === "always-visible";
return {
  edgeIntentEnabled: !persistentCompact,
  fullListExpanded: !persistentCompact && input.edgeExpanded,
  persistentCompact,
};
```

For participant pills:

```ts
if (input.mode === "always-visible") {
  return input.interacted ? "expanded" : "compact";
}
if (input.railExpanded) {
  return "expanded";
}
return input.speaking ? "compact" : "hidden";
```

Return complete objects from every resolver. Do not access DOM, React, storage,
participants, provider adapters, or audio state. Room/panel/participant
eligibility remains in the existing `shouldRenderRoomRail()` helper.

- [x] **Step 4: Run policy and existing intent tests**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- interface-visibility room-rail-intent top-bubble-reveal
```

Expected: PASS without changing existing tests.

- [x] **Step 5: Commit the policy**

```bash
git add apps/extension/src/interface-visibility.ts \
  apps/extension/test/interface-visibility.test.ts
git commit -m "feat(extension): resolve interface visibility policy"
```

---

### Task 3: Load And Persist Preferences With Ordered Writes

**Files:**
- Create: `apps/extension/src/use-interface-preferences.ts`
- Create: `apps/extension/test/use-interface-preferences.test.tsx`

**Interfaces:**
- Consumes Task 1 preference functions.
- Produces:

```ts
export interface InterfacePreferencesStorage {
  read(): Promise<unknown>;
  write(preferences: InterfacePreferencesV1): Promise<void>;
}

export interface InterfacePreferencesController {
  error: string | null;
  preferences: InterfacePreferencesV1;
  ready: boolean;
  saving: boolean;
  update(patch: InterfacePreferencesPatch): void;
}

export function useInterfacePreferences(
  preferenceStorage?: InterfacePreferencesStorage,
): InterfacePreferencesController;
```

The default storage adapter reads and writes
`INTERFACE_PREFERENCES_STORAGE_KEY` through `wxt/utils/storage`.

- [x] **Step 1: Write failing hook tests with an injected fake store**

Render a harness exposing state as data attributes and buttons that call
`update()`. Test:

1. valid stored preferences load and normalize;
2. invalid stored data becomes the default;
3. two rapid updates are written in order and the final state is retained;
4. a latest write failure restores the latest successful applied snapshot;
5. unmount during a pending read or write does not update React state.

Use deferred promises for the ordering case:

```ts
const firstWrite = deferred<void>();
const secondWrite = deferred<void>();
const write = vi
  .fn()
  .mockImplementationOnce(() => firstWrite.promise)
  .mockImplementationOnce(() => secondWrite.promise);

await click(button(container, "Pin main control"));
await flush();
expect(write).toHaveBeenCalledTimes(1);

await click(button(container, "Pin participant pills"));
expect(write).toHaveBeenCalledTimes(1);

firstWrite.resolve();
await flush();
expect(write).toHaveBeenCalledTimes(2);

secondWrite.resolve();
await flush();
expect(readPreferences(container)).toMatchObject({
  mainControlVisibility: "always-visible",
  participantPillVisibility: "always-visible",
});
```

- [x] **Step 2: Run the focused test and verify failure**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- use-interface-preferences
```

Expected: FAIL because the hook does not exist.

- [x] **Step 3: Implement initial load and a serialized write queue**

Use refs for:

- `mountedRef`;
- `appliedRef`, initialized to the default;
- `revisionRef`;
- `writeQueueRef`, initialized to `Promise.resolve()`.

On load, parse the value before placing it in both state and `appliedRef`.

On update:

```ts
const normalized = updateInterfacePreferences(preferencesRef.current, patch);
const revision = ++revisionRef.current;
preferencesRef.current = normalized;
setPreferences(normalized);
setSaving(true);
setError(null);

writeQueueRef.current = writeQueueRef.current
  .catch(() => undefined)
  .then(async () => {
    try {
      await preferenceStorage.write(normalized);
      appliedRef.current = normalized;
      if (mountedRef.current && revision === revisionRef.current) {
        setSaving(false);
        setError(null);
      }
    } catch {
      if (mountedRef.current && revision === revisionRef.current) {
        preferencesRef.current = appliedRef.current;
        setPreferences(appliedRef.current);
        setSaving(false);
        setError("Couldn't save interface settings.");
      }
    }
  });
```

Capture `preferencesRef.current`, not a stale render value. Keep queue ordering
so an older write can never land after a newer one.

- [x] **Step 4: Run hook tests and extension check**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- use-interface-preferences interface-preferences
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: PASS with no React act warnings.

- [x] **Step 5: Commit persistence**

```bash
git add apps/extension/src/use-interface-preferences.ts \
  apps/extension/test/use-interface-preferences.test.tsx
git commit -m "feat(extension): persist interface visibility choices"
```

---

### Task 4: Build The Interface Settings View And Truthful Preview

**Files:**
- Create: `apps/extension/src/overlay-interface-settings.tsx`
- Create: `apps/extension/test/overlay-interface-settings.test.tsx`
- Modify: `apps/extension/src/settings-panel-navigation.ts`
- Modify: `apps/extension/test/settings-panel-navigation.test.ts`
- Modify: `apps/extension/src/styles.ts`

**Interfaces:**
- Consumes:
  - `InterfacePreferencesV1`
  - `InterfacePreferencesPatch`
  - Task 2 presentation resolvers
- Produces:

```ts
export interface InterfaceSettingsPanelProps {
  error: string | null;
  onChange(patch: InterfacePreferencesPatch): void;
  preferences: InterfacePreferencesV1;
  ready: boolean;
  saving: boolean;
}

export function InterfaceSettingsPanel(
  props: InterfaceSettingsPanelProps,
): JSX.Element;
```

- [x] **Step 1: Add the failing navigation expectation**

Change the expected settings IDs to:

```ts
expect(SETTINGS_PANEL_CATEGORIES.map((category) => category.id)).toEqual([
  "reactions",
  "layout",
  "interface",
  "voice",
  "debug",
]);
```

Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- settings-panel-navigation
```

Expected: FAIL because `interface` is absent.

- [x] **Step 2: Add the category**

Extend `SettingsPanelCategory` and add:

```ts
{ id: "interface", label: "Interface" }
```

between `layout` and `voice`.

- [x] **Step 3: Write failing component tests**

Test the following observable behavior:

- two radio groups named `Main control` and `Participant pills`;
- only the approved labels are rendered;
- selected options use `aria-checked`;
- ArrowLeft/ArrowRight changes selection and moves focus;
- `onChange` receives only the changed preference field;
- no `Preset`, `Apply`, or `Revert` text exists;
- the preview state changes after preference changes;
- replay restarts the finite preview sequence;
- reduced motion renders the resolved states without animated travel;
- `saving` sets `aria-busy`;
- `error` renders a polite live status.

Use the established `VoiceSettingsPanel` radio-group test helpers instead of
adding a UI dependency.

- [x] **Step 4: Run the component test and verify failure**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- overlay-interface-settings
```

Expected: FAIL because `InterfaceSettingsPanel` does not exist.

- [x] **Step 5: Implement two accessible segmented controls**

Use real radio semantics:

```tsx
<div aria-label="Main control" role="radiogroup">
  <button
    aria-checked={preferences.mainControlVisibility === "auto-hide"}
    onClick={() => onChange({ mainControlVisibility: "auto-hide" })}
    role="radio"
    type="button"
  >
    Auto hide
  </button>
  <button
    aria-checked={preferences.mainControlVisibility === "always-visible"}
    onClick={() => onChange({ mainControlVisibility: "always-visible" })}
    role="radio"
    type="button"
  >
    Always visible
  </button>
</div>
```

Repeat the pattern for participant pills. Extract only a local private
`InterfaceSegmentedControl` helper inside the file.

Disable both groups until `ready` is true. Keep the current preview visible
with default behavior while the local read is pending.

- [x] **Step 6: Implement the finite preview**

Use a small fixed-aspect preview canvas with semantic state classes:

```ts
type PreviewMoment = "idle" | "proximity" | "speaking" | "interaction";
```

Build each frame by calling `resolveMainControlPresentation()` and
`resolveParticipantPillPresentation()`. On mount, replay, or changed
preferences, advance through the four moments once and stop. Do not loop.

Render:

- one main-control silhouette;
- three participant silhouettes;
- one speaking marker;
- one muted marker;
- one Lucide replay icon button.

Mark decorative silhouettes `aria-hidden="true"`. Apply
`OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE` to prevent `V` or reaction shortcuts from
activating while settings controls are focused.

- [x] **Step 7: Add compact unframed settings styles**

Add focused classes under a new `interface-settings-*` namespace:

- stable preview aspect ratio;
- no cards nested inside the preview frame;
- 8 px maximum radius for the preview tool;
- fixed segmented-control height;
- orange selection treatment consistent with existing settings;
- green speaking and muted red state only on the small indicators;
- no continuous glow or decorative gradients;
- `@media (prefers-reduced-motion: reduce)` disables transitions and
  animations.

- [x] **Step 8: Run focused tests and check**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- settings-panel-navigation overlay-interface-settings interface-visibility
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: PASS.

- [x] **Step 9: Commit the settings view**

```bash
git add apps/extension/src/overlay-interface-settings.tsx \
  apps/extension/src/settings-panel-navigation.ts \
  apps/extension/src/styles.ts \
  apps/extension/test/overlay-interface-settings.test.tsx \
  apps/extension/test/settings-panel-navigation.test.ts
git commit -m "feat(extension): add interface visibility settings"
```

---

### Task 5: Connect Main-Control Preferences Without Regressing Edge Intent

**Files:**
- Modify: `apps/extension/src/top-bubble-reveal.ts`
- Modify: `apps/extension/test/top-bubble-reveal.test.tsx`
- Modify: `apps/extension/src/overlay-app.tsx:526-534`
- Modify: `apps/extension/src/overlay-app.tsx:4758-4860`

**Interfaces:**
- Consumes:
  - `MainControlVisibility`
  - `resolveMainControlPresentation()`
  - `useInterfacePreferences()`
  - `InterfaceSettingsPanel`
- Changes:

```ts
interface UseTopBubbleRevealOptions {
  bubbleRef: RefObject<HTMLButtonElement | null>;
  mode: MainControlVisibility;
  overlayRef: RefObject<HTMLElement | null>;
  panelOpen: boolean;
}
```

- [x] **Step 1: Extend the launcher harness with a mode**

Update `Harness` and `renderHarness` so every existing test explicitly uses
`"auto-hide"`. Add tests proving:

- `always-visible` starts visible without pointer movement;
- moving away never hides it;
- it never shows the proximity glow;
- switching back to `auto-hide` schedules the existing delayed hide;
- panel-open and focus still pin `auto-hide`;
- active Open mic does not pin `auto-hide` or alter the launcher.

- [x] **Step 2: Run the launcher test and verify failure**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- top-bubble-reveal
```

Expected: FAIL because the hook does not accept `mode`.

- [x] **Step 3: Make the hook consume the pure policy**

Keep the current timers and pointer zones. Add `modeRef`, include the mode in
initial visibility, and use `resolveMainControlPresentation()` for the returned
visible/glow state.

Every hide, reveal, and pointer-evaluation path must short-circuit when the
policy says `edgeIntentEnabled === false`. When mode changes from persistent to
auto-hide, reuse the current pointer if available; otherwise call the existing
delayed hide path.

Do not change:

- `TOP_BUBBLE_REVEAL_DELAY_MS`;
- `TOP_BUBBLE_HIDE_DELAY_MS`;
- edge proximity dimensions;
- provider placement variables;
- touch-event exclusion.

- [x] **Step 4: Mount one preference controller in `OverlayApp`**

At the top-level overlay state:

```ts
const interfacePreferences = useInterfacePreferences();
```

Pass:

```ts
mode={interfacePreferences.preferences.mainControlVisibility}
```

to `useTopBubbleReveal()`.

Render `InterfaceSettingsPanel` only for the `interface` category:

```tsx
{settingsPanelCategory === "interface" ? (
  <InterfaceSettingsPanel
    error={interfacePreferences.error}
    onChange={interfacePreferences.update}
    preferences={interfacePreferences.preferences}
    ready={interfacePreferences.ready}
    saving={interfacePreferences.saving}
  />
) : null}
```

Do not pass microphone state to the launcher. Voice indicators remain on the
participant surfaces, and hiding the launcher must not change publication.

- [x] **Step 5: Run launcher, settings, and voice-session tests**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- top-bubble-reveal overlay-interface-settings overlay-voice-session
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: PASS.

- [x] **Step 6: Commit launcher integration**

```bash
git add apps/extension/src/top-bubble-reveal.ts \
  apps/extension/src/overlay-app.tsx \
  apps/extension/test/top-bubble-reveal.test.tsx
git commit -m "feat(extension): apply main control visibility preference"
```

---

### Task 6: Add Persistent Compact Participant Pills

**Files:**
- Create: `apps/extension/src/overlay-room-rail.tsx`
- Create: `apps/extension/test/overlay-room-rail.test.tsx`
- Modify: `apps/extension/src/overlay-app.tsx:2180-2193`
- Modify: `apps/extension/src/overlay-app.tsx:5026-5290`
- Modify: `apps/extension/src/room-rail-intent.ts`
- Modify: `apps/extension/test/room-rail-intent.test.ts`
- Modify: `apps/extension/src/styles.ts`

**Interfaces:**
- Produces:

```ts
export interface RoomRailProps {
  activeParticipantId?: string;
  getParticipantAudioPreference(
    participantId: string,
  ): ParticipantAudioPreference;
  onParticipantAudioChange(
    participantId: string,
    preference: ParticipantAudioPreference,
  ): void;
  participants: Participant[];
  speakingParticipantIds: string[];
  visibilityMode: ParticipantPillVisibility;
}

export function RoomRail(props: RoomRailProps): JSX.Element;
```

- Consumes:
  - `resolveParticipantRailPresentation()`
  - `resolveParticipantPillPresentation()`
  - existing `ParticipantAudioInlineControl`
  - existing `ROOM_RAIL_OPEN_DELAY_MS`

- [x] **Step 1: Extract the current rail without changing behavior**

Move `RoomRail` from `overlay-app.tsx` into
`overlay-room-rail.tsx`. Keep `visibilityMode` fixed to `"smart"` during this
step. Leave the existing overlay-wide `initials()` helper in place because the
account and invite UI also use it. Add a private `participantInitials()` helper
inside the extracted rail instead of exporting another shared abstraction.

Update the import and render site in `OverlayApp`. Run:

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- room-rail-intent overlay-voice-controls participant-audio-controls
```

Expected: PASS with no visual behavior change.

- [x] **Step 2: Write failing component tests**

Use fake timers and participant fixtures to prove:

- Smart quiet slots resolve hidden;
- Smart speaking slots resolve compact;
- Smart edge dwell expands the full list after
  `ROOM_RAIL_OPEN_DELAY_MS`;
- persistent mode starts every eligible slot compact;
- hover or focus expands only one persistent slot;
- pointer leave restores compact state after the existing grace period;
- an active audio adjustment remains expanded across pointer leave;
- a remote muted participant renders a compact mute marker;
- the current participant never renders a slider or mute button;
- an open panel and mounted-video filtering remain covered by
  `room-rail-intent.test.ts`.

Expose the resolved state as:

```tsx
data-presentation={presentation}
```

on each `.room-rail-slot` so tests inspect product state rather than computed
CSS.

- [x] **Step 3: Run the rail test and verify failure**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- overlay-room-rail
```

Expected: FAIL because persistent mode is not implemented.

- [x] **Step 4: Apply the policy inside the extracted rail**

Maintain:

```ts
const [edgeExpanded, setEdgeExpanded] = useState(false);
const [interactedParticipantId, setInteractedParticipantId] =
  useState<string | null>(null);
```

Use edge handlers only when the rail policy enables edge intent. In persistent
mode, set `interactedParticipantId` from pointer enter and focus capture. Clear
it only after pointer/focus leaves and no audio adjustment is latched.

For each participant:

```ts
const presentation = resolveParticipantPillPresentation({
  interacted:
    interactedParticipantId === item.id ||
    adjustingParticipantId === item.id,
  mode: visibilityMode,
  railExpanded: edgeExpanded,
  speaking,
});
```

Render the compact mute marker only for remote media-seat participants whose
existing listener preference is muted. Use Lucide `VolumeX`; do not add another
mute state.

- [x] **Step 5: Update rail rendering in `OverlayApp`**

Pass:

```tsx
visibilityMode={
  interfacePreferences.preferences.participantPillVisibility
}
```

Keep `shouldRenderRoomRail()` responsible only for room, panel, and participant
eligibility. Keep `selectVoiceRailParticipants()` responsible for mounted-video
deduplication. Do not move either concern into stored preferences.

- [x] **Step 6: Implement stable compact and expanded styles**

Use data/class states generated by the component:

- hidden: width `0`, opacity `0`, no pointer events;
- compact: fixed width `64px`, visible, pointer enabled;
- expanded: existing `162px` width;
- persistent speaking: green treatment without width change;
- compact muted: visible small red mute icon;
- only the expanded participant reveals name/status or remote audio controls;
- adjustment latch keeps pointer events enabled;
- Smart full-list open retains current list scrolling and overscroll
  containment.

Do not change rail top/bottom geometry, provider safe insets, participant order,
or the eight-item cap.

- [x] **Step 7: Run the complete rail/audio test slice**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- overlay-room-rail room-rail-intent overlay-voice-controls participant-audio-controls participant-volume-geometry overlay-room-media-controls
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
```

Expected: PASS.

- [x] **Step 8: Commit participant-pill integration**

```bash
git add apps/extension/src/overlay-room-rail.tsx \
  apps/extension/src/overlay-app.tsx \
  apps/extension/src/room-rail-intent.ts \
  apps/extension/src/styles.ts \
  apps/extension/test/overlay-room-rail.test.tsx \
  apps/extension/test/room-rail-intent.test.ts
git commit -m "feat(extension): add persistent participant pills"
```

---

### Task 7: Verify, Document, Build, And Prepare Manual Acceptance

**Files:**
- Modify: `docs/current-development-state.md`
- Modify: `docs/superpowers/specs/2026-07-30-interface-visibility-settings-design.md`
- Modify: `docs/superpowers/plans/2026-07-30-interface-visibility-settings.md`
- Potentially update approved team artifacts only:
  - `graphify-out/graph.json`
  - `graphify-out/GRAPH_REPORT.md`
  - `graphify-out/manifest.json`

**Interfaces:**
- Consumes all prior tasks.
- Produces one validated staging artifact and two synchronized local test
  folders.

- [x] **Step 1: Run the focused regression set**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- \
  interface-preferences \
  interface-visibility \
  use-interface-preferences \
  overlay-interface-settings \
  settings-panel-navigation \
  top-bubble-reveal \
  overlay-room-rail \
  room-rail-intent \
  overlay-voice-controls \
  overlay-voice-session \
  participant-audio-controls \
  overlay-room-media-controls
```

Expected: PASS.

- [x] **Step 2: Run the full extension gates**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
fnm exec --using="$(cat .node-version)" pnpm dev:check
git diff --check
```

Expected: all extension tests pass and no whitespace errors are reported.

- [x] **Step 3: Build and validate the staging artifact**

```bash
fnm exec --using="$(cat .node-version)" pnpm build:extension:staging
fnm exec --using="$(cat .node-version)" pnpm validate:extension:staging
```

Expected:

- `anidachi-extension-staging/manifest.json` names the staging extension;
- the build ID matches the current commit;
- validation reports no broad production permission regression.

- [x] **Step 4: Update current-state documentation**

Change the design status to:

```txt
Status: Implemented; staging visual acceptance pending
```

Add one concise `current-development-state.md` entry covering:

- `Interface` section and both setting pairs;
- profile-local storage key;
- launcher/panel precedence and microphone-independent visibility;
- Smart versus persistent participant pills;
- no protocol or server changes.

Mark completed checkboxes in this plan only after their commands have passed.

- [x] **Step 5: Refresh and inspect Graphify**

```txt
$graphify . --update
```

```bash
git status --short
```

Keep only approved team artifacts. Remove only local-only graph outputs created
by this refresh, such as cost, HTML, wiki, cache, or scoped scratch files. Do
not touch pre-existing or unrelated user changes.

- [x] **Step 6: Commit documentation and approved graph artifacts**

```bash
git add docs/current-development-state.md \
  docs/superpowers/specs/2026-07-30-interface-visibility-settings-design.md \
  docs/superpowers/plans/2026-07-30-interface-visibility-settings.md
git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json
git commit -m "docs(extension): record interface visibility behavior"
```

If Graphify produces no approved artifact change, omit the second `git add`.

- [x] **Step 7: Synchronize both established test folders**

From the worktree root:

```bash
rsync -a --delete anidachi-extension-staging/ \
  /Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging/
rsync -a --delete anidachi-extension-staging/ \
  /Users/vladyslavhulyi/anidachi-extension-staging2/
```

Compare representative hashes:

```bash
shasum anidachi-extension-staging/manifest.json \
  /Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging/manifest.json \
  /Users/vladyslavhulyi/anidachi-extension-staging2/manifest.json
```

Expected: all three hashes match.

- [ ] **Step 8: Stop for manual staging acceptance**

Ask the user to verify the matrix from the design specification on:

- Crunchyroll and YouTube;
- normal, theater, and fullscreen;
- no room, active room, and open panel;
- one no-video participant and multiple no-video participants;
- speaking, quiet, muted, volume drag, camera on/off, and Open mic.

Do not claim visual acceptance from automated tests.

- [ ] **Step 9: After user acceptance, push one branch and open one draft PR**

Confirm the worktree is clean:

```bash
git status --short --branch
```

Then:

```bash
git push -u origin codex/voice-controls-plan
gh pr create \
  --base staging \
  --head codex/voice-controls-plan \
  --draft \
  --title "feat(extension): add voice and interface controls" \
  --body $'## Summary\n- Add room-scoped Push to talk and Open mic controls.\n- Add listener-local participant volume and mute controls.\n- Add Interface visibility preferences for the main control and participant pills.\n\n## Validation\n- Extension check and full tests passed.\n- Staging artifact built and validated.\n- Manual Crunchyroll and YouTube acceptance completed.\n\n## Project impact\n- Affected plane: extension only.\n- Protocol, Worker, database, and server deployment: unchanged.\n- Docs and Graphify status recorded in commits.\n\n## Rollback\nRestore default interface preference reads and remove the Interface tab; room and media state remain unchanged.'
```

The PR body must record:

- affected plane: extension only;
- docs updated;
- Graphify updated or not needed with reason;
- staging artifact validation;
- manual acceptance evidence;
- no protocol, Worker, database, or server deployment;
- rollback: restore default preference reads and remove the `Interface` tab
  without changing room/media state.
