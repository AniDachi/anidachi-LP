# Overlay Layout Engine V2 Design

Status: Implemented; staging visual acceptance pending

## Summary

Replace the extension's current generic rectangle-based layout behavior with a
small, shared layout engine that models chat and camera bubbles according to
their real runtime behavior. The editor preview and the live overlay must use
the same resolver so the preview remains truthful across player sizes,
fullscreen transitions, active camera counts, and hidden chat or camera state.

This work changes extension-local presentation only. It does not change room
capacity, media seats, WebRTC signaling, API behavior, protocol payloads, or
server state.

## Problem

The current editor stores both chat and video as grid rectangles. This works
reasonably for chat, but it does not represent the live camera stack:

- the preview's video rectangle has a width and height that the live camera
  stack does not consume;
- live camera bubbles use a separate responsive pixel size and horizontal flex
  layout;
- collision checks use preview rectangles instead of the real rendered camera
  footprint;
- the editor writes every drag and slider change directly to persistent
  storage;
- the current preset state mixes layout selection with editing behavior;
- moving a preview object centers it under the pointer instead of preserving
  the grab offset;
- inactive chat and cameras do not have a reliable shared representation for
  previewing the final layout.

The result can be valid in the miniature editor but overlap or shift
unexpectedly on the actual player.

## Goals

- Use one deterministic layout resolver for the editor preview and live
  overlay.
- Model a four-seat camera group as one leader slot plus three following slots.
- Keep the leader on the outer edge and make the remaining slots grow inward.
- Flip the leader side stably when it crosses the center of the editor.
- Preview all four camera slots even when no camera is active.
- Preview chat with representative ghost messages even when chat is hidden or
  empty.
- Persist layout intent rather than viewport-specific pixels.
- Adapt safely to player dimensions and player UI without modifying saved
  preferences.
- Start from a clean version 2 default without importing version 1 geometry.
- Keep the implementation extension-local and dependency-light.

## Non-Goals

- Built-in or named user presets. Presets are a later layer over the stable
  layout definition.
- Vertical, curved, or freeform camera arrangements.
- Moving reactions, the room rail, the account bubble, or the settings panel.
- Styling polish, new animations, or final editor visual design.
- Changes to camera capture, microphone capture, media-seat assignment, or P2P
  transport.
- Cross-device layout synchronization. Layout remains device-local because the
  correct result depends on the local player and screen.

## Product Behavior

### Camera Group

The editor always renders four camera slots:

- one opaque leader slot that acts as the drag handle;
- three lower-emphasis ghost slots showing where additional cameras will
  appear.

The four slots represent the existing four media seats. The leader is not a
privileged participant and does not imply host status. It defines the anchor
and fill order of the visual group.

When the leader is on the left side, it is the leftmost slot and the tail grows
to the right. When the leader is on the right side, it is the rightmost slot
and the tail grows to the left. During dragging, a center hysteresis band keeps
the side from oscillating when the pointer moves around the midpoint. The
stored `leaderSide` makes the final result deterministic after reload.

At runtime, active camera participants occupy slots from the leader inward.
Adding or removing a participant must not reverse the group or move its anchor.
The editor uses four ghost slots; the live overlay renders only occupied slots.

Camera size uses the existing discrete size vocabulary: `small`, `normal`,
`large`, and `xl`. The resolver may temporarily constrain the effective pixel
size on a compact player, but it never overwrites the saved size choice.

### Chat

Chat is modeled as content, not as a freely distorted rectangle. The user
controls:

- grid position;
- width in supported grid columns;
- text scale: `compact`, `normal`, or `large`;
- visible message count: `3`, `5`, or `8`.

The engine derives chat height from text scale, message count, line height,
padding, and the available player area. This prevents combinations where the
chosen font cannot fit inside an independently selected height.

The editor always renders representative ghost messages with different line
lengths. The ghost content reflects the selected text scale, width, and message
count. In normal viewing, inactive or empty chat remains hidden.

This layout controls the existing chat-column presentation. Message bubbles
remain outside the first implementation scope.

### Draft And Apply

Opening the Layout editor creates a draft from the applied preferences.
Dragging, resizing, and changing chat settings update only the draft and editor
preview.

- `Apply` normalizes, persists, and activates the draft.
- `Revert` restores the draft to the currently applied layout.
- closing the panel without applying discards the draft.

The first release stores one applied layout. Preset selection, named custom
layouts, and preset management are intentionally deferred until the layout
engine and editor behavior are stable.

## Stored Model

Version 2 uses a new storage key: `local:overlayLayoutPreferencesV2`. It does
not read or rewrite `local:overlayLayoutPreferences` or
`local:ghostCamSizeStep`.

```ts
type OverlayLayoutLeaderSide = "left" | "right";
type OverlayLayoutTextScale = "compact" | "normal" | "large";
type OverlayLayoutMessageCount = 3 | 5 | 8;
type OverlayLayoutCameraSizeStep = 0 | 1 | 2 | 3;

interface OverlayLayoutGridPoint {
  x: number;
  y: number;
}

interface OverlayLayoutDefinition {
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

interface OverlayLayoutPreferencesV2 {
  version: 2;
  layout: OverlayLayoutDefinition;
}
```

The model exposes one immutable default definition and returns defensive clones
to callers. It contains no preset registry, legacy parser, compatibility
adapter, or dual-read state.

The grid remains 12 columns by 8 rows. Grid points describe layout intent. They
are normalized and clamped before resolution and persistence. `video.anchor`
identifies the center cell of the leader slot. `chat.position` identifies the
top-left cell of the derived chat block. Stored coordinates and widths are
integers.

## Clean Version 2 Start

Version 2 accepts only a valid or partially valid version 2 payload. Missing,
version 1, or unrecognized values resolve to the clean default layout. Invalid
version 2 fields fall back field-by-field so one damaged field does not discard
the rest of a valid version 2 layout.

The old layout and camera-size keys remain untouched for rollback safety, but
the new model never imports from them. Normalization is idempotent.

## Layout Resolver

The core is a pure function with no React, DOM, storage, or provider access.

```ts
interface OverlayLayoutSafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface OverlayLayoutViewport {
  width: number;
  height: number;
  safeInsets: OverlayLayoutSafeInsets;
}

interface OverlayLayoutContext {
  viewport: OverlayLayoutViewport;
  reservedRects: PixelRect[];
  cameraCount: 0 | 1 | 2 | 3 | 4;
}

interface ResolvedOverlayLayout {
  video: {
    bounds: PixelRect;
    effectiveSizePx: number;
    effectiveSizeStep: OverlayLayoutCameraSizeStep;
    leaderSide: OverlayLayoutLeaderSide;
    slots: PixelRect[];
  };
  chat: {
    rect: PixelRect;
    effectiveMaxMessages: OverlayLayoutMessageCount;
    fontSizePx: number;
    lineHeightPx: number;
  };
}

resolveOverlayLayout(definition, context): ResolvedOverlayLayout
```

The resolver:

1. normalizes the definition and viewport;
2. converts grid intent to candidate pixel geometry;
3. resolves the camera leader side and generates camera slots inward;
4. computes chat dimensions from width, text scale, and message count;
5. clamps both components into the safe player area;
6. avoids reserved player UI and chat/video overlap;
7. searches for the nearest valid placement without changing saved intent;
8. applies temporary compact-player degradation only when the requested layout
   cannot fit.

Camera media has placement priority during compact fallback. The resolver
first moves chat to the nearest valid location. If no placement fits, it may
temporarily reduce camera size down to the supported minimum and reduce the
effective live chat message count down to three. These effective values are
runtime output only and are never persisted.

If the viewport is invalid or has no usable area, the resolver returns a safe
default layout instead of non-finite CSS values.

## Reserved Areas And Adaptation

The resolver accepts provider-independent geometry. Existing adapter and
Crunchyroll player-chrome code remain responsible for observing the real video
bounds and reporting player controls.

Reserved geometry includes, when visible:

- native player controls and timeline area;
- AniDachi top account bubble;
- the room voice rail;
- fixed outer padding required to keep shadows and controls on screen.

Opening the settings panel does not change the saved layout. The editor preview
uses a synthetic 16:9 viewport and the same resolver with four preview cameras.
The live overlay resolves again whenever player dimensions, fullscreen state,
controls visibility, camera count, or applied preferences change.

## Interaction Contract

The UI layer owns pointer and keyboard interaction but delegates all geometry
to the layout model and resolver.

- Pointer dragging preserves the initial grab offset.
- Positions snap to grid cells.
- Only the video leader acts as the camera-group drag handle.
- Crossing the center hysteresis band updates `leaderSide` once; movement
  inside the band preserves the previous side.
- Arrow keys move the selected object by one grid cell.
- Escape restores the object's position from the beginning of the current
  drag or keyboard edit session.
- Invalid moves keep the nearest valid same-size placement; they do not
  silently resize the stored object.

Pointer-session state remains transient and is never persisted.

## Code Boundaries

Keep the first implementation focused:

- a new `overlay-layout-model.ts` owns the versioned stored type, clean default,
  normalization, parsing, and draft-to-persisted conversion. It does not import
  from the existing layout module. The old `overlay-layout-preferences.ts`
  remains in use only by the still-running old editor and is deleted when the
  new runtime integration replaces that editor; no adapter is added between
  them.
- a new `overlay-layout-engine.ts` owns pure geometry, slot generation,
  collision handling, and compact fallback.
- `overlay-app.tsx` owns React state, pointer sessions, WXT storage calls, and
  rendering resolved output.
- `styles.ts` consumes resolved CSS variables or pixel values without
  duplicating layout decisions.

Do not add a drag-and-drop or constraint-solving dependency. There are only two
movable component groups, and the current Pointer Events plus keyboard path is
sufficient when backed by a deterministic engine.

## Failure Handling

- Corrupt storage is normalized to safe defaults.
- Missing, version 1, or corrupt storage falls back to the clean default.
- Persistence errors keep the applied in-memory layout and expose a non-blocking
  editor error; the UI must not claim the draft was saved.
- Pointer cancellation releases capture and restores the last stable draft
  geometry.
- Resize and fullscreen adaptation never write to storage.
- A missing chat or camera runtime element does not remove its editor ghost.

## Verification

### Unit Tests

- rejection of version 1 and unrecognized storage in favor of clean defaults;
- normalization and idempotence for malformed version 2 data;
- one through four camera slot generation;
- left and right leader ordering;
- center-side transition rules;
- chat height derived from every text scale and message-count combination;
- no overlap in representative desktop, fullscreen, and compact viewports;
- deterministic nearest-placement behavior;
- temporary compact fallback without stored-preference mutation;
- invalid viewport fallback with finite geometry.

### Component Tests

- preview renders one leader and three ghosts with no active cameras;
- chat ghost content renders with no messages;
- draft changes do not alter applied layout before `Apply`;
- closing discards an unapplied draft;
- applying persists version 2 and updates the live layout;
- pointer dragging preserves grab offset and releases capture on cancel;
- keyboard movement and Escape rollback.

### Project Checks

```bash
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm build:extension:staging
pnpm validate:extension:staging
```

### Manual Acceptance

Inspect the loaded staging artifact at compact, 720p, and 1080p player sizes,
both embedded and fullscreen. Cover chat hidden/visible, zero/one/four camera
previews, one/four real camera participants, both leader sides, native player
controls visible/hidden, Apply, Revert, discard, and extension reload
persistence.

P2P signaling is unchanged, but the final staging acceptance should include a
two-client visual smoke to confirm that remote media rendering and participant
ordering remain intact.

## Delivery Stages

1. **Model and engine:** version 2 schema, clean default, pure resolver,
   and unit tests. Keep the current visual editor mostly unchanged.
2. **Runtime parity:** make the live camera stack, live chat, and editor preview
   consume the shared resolver.
3. **Interaction:** leader dragging, center-side transition, chat dragging,
   draft/Apply/Revert, keyboard behavior, and component tests.
4. **Product controls:** chat text scale and message controls, camera size,
   errors, and empty-state ghosts.
5. **Polish and acceptance:** visual refinement, animation, responsive browser
   verification, staging artifact, and two-client smoke.

Each stage should be committed and verified independently. Do not mix unrelated
room, P2P, protocol, or settings-menu redesign into this work.

Preset architecture is designed only after the first four stages are stable.
It must compose over `OverlayLayoutDefinition` rather than adding preset logic
to the geometry engine.
