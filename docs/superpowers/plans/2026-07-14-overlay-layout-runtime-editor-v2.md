# Overlay Layout Runtime And Editor V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the running V1 overlay layout path with one truthful V2 path shared by the live camera/chat overlay and the layout editor.

**Architecture:** `overlay-layout-model.ts` remains the only stored layout contract and `overlay-layout-engine.ts` remains the only geometry resolver. A focused runtime adapter converts measured player state and resolved geometry into CSS variables, while a dedicated editor component owns an unapplied draft and uses the same measured runtime context for its scaled preview. `overlay-app.tsx` owns storage loading, transient live draft preview, applying the persisted definition, live player measurements, and wiring; the V1 preferences module and its storage keys are deleted after all consumers move.

**Tech Stack:** React 19, TypeScript 6, Vitest 4, WXT storage, existing CSS-in-TS overlay stylesheet, Pointer Events.

## Global Constraints

- Keep the V2 storage key exactly `local:overlayLayoutPreferencesV2`.
- Never read, migrate, translate, rewrite, or delete `local:overlayLayoutPreferences` or `local:ghostCamSizeStep`.
- Use `resolveOverlayLayout()` for both live and preview geometry.
- Keep camera participant order and all P2P/media behavior unchanged.
- Render four preview camera slots but only the occupied live slots.
- Persist only on `Apply`; drag, keyboard, resize, fullscreen, and compact fallback never write storage.
- A failed write keeps the previously applied in-memory layout active and shows a non-blocking editor error.
- Keep the existing 12 by 8 grid, four size steps, chat widths `3..6`, text scales `compact|normal|large`, and message counts `3|5|8`.
- Add no drag-and-drop or geometry dependency.
- Delete V1 source, tests, imports, handlers, CSS, and constants in the same delivery.
- Do not change rooms, API, protocol, auth, WebRTC, media seats, or production deployment.

---

### Task 1: V2 Storage Contract And Runtime Style Adapter

**Files:**
- Modify: `apps/extension/src/overlay-layout-model.ts`
- Create: `apps/extension/src/overlay-layout-runtime.ts`
- Modify: `apps/extension/test/overlay-layout-model.test.ts`
- Create: `apps/extension/test/overlay-layout-runtime.test.ts`

**Interfaces:**
- Produces: `OVERLAY_LAYOUT_STORAGE_KEY_V2`.
- Produces: `getOverlayLayoutRuntimeStyles(resolved)` returning finite CSS custom properties for camera group, bubbles, and chat.
- Produces: `getOverlayLayoutReservedRects(input)` for the account bubble and room rail; native controls remain a bottom safe inset.

- [x] Add tests proving the V2 key is the only new key and that resolved pixel geometry maps to finite `px` CSS values, including camera leader direction and chat typography.
- [x] Run the focused tests and verify they fail because the key/runtime adapter does not exist.
- [x] Implement the minimal model export and pure runtime adapter.
- [x] Run the focused tests and extension type check.
- [x] Commit the task.

### Task 2: Live Runtime Parity

**Files:**
- Modify: `apps/extension/src/overlay-layout-engine.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/styles.ts`
- Modify: `apps/extension/test/overlay-layout-engine.test.ts`
- Modify: `apps/extension/test/overlay-layout-runtime.test.ts`

**Interfaces:**
- Consumes: `parseOverlayLayoutPreferencesV2()`, `resolveOverlayLayout()`, and Task 1 runtime styles.
- Produces: one applied `OverlayLayoutDefinition` loaded only from the V2 key.
- Produces: live camera/chat geometry recalculated from player dimensions, native-control safe inset, reserved AniDachi UI, camera count, and applied preferences.

- [x] Add failing engine coverage proving camera groups avoid reserved UI without mutating saved intent.
- [x] Resolve the nearest same-size camera placement around reserved UI before compact size fallback.
- [x] Replace V1 and standalone camera-size state with one applied V2 definition and an async `applyLayoutDefinition()` that activates only after storage succeeds.
- [x] Resolve live geometry on player measurement, controls visibility, camera count, and applied-definition changes.
- [x] Render the camera group from resolved bounds/leader direction and the chat from resolved rect, typography, and effective message count.
- [x] Keep reaction placement coherent with the resolved camera vertical position without changing reaction transport or content.
- [x] Run focused tests and extension check.
- [x] Commit the task.

### Task 3: Draft-Based V2 Layout Editor

**Files:**
- Create: `apps/extension/src/overlay-layout-editor.tsx`
- Create: `apps/extension/src/overlay-layout-interaction.ts`
- Create: `apps/extension/test/overlay-layout-editor.test.tsx`
- Create: `apps/extension/test/overlay-layout-interaction.test.ts`
- Modify: `apps/extension/src/overlay-app.tsx`

**Interfaces:**
- `OverlayLayoutEditor` consumes `appliedLayout`, the measured runtime context, camera enabled/status props, `onCameraToggle`, transient `onPreviewChange`, and async `onApply`.
- The editor creates a defensive draft on mount, uses the measured player viewport with `resolveOverlayLayout(...cameraCount: 4)` for the scaled preview, publishes the draft only as a transient live preview, and clears it on unmount.
- Interaction helpers produce snapped grid positions, preserve pointer grab offsets, and resolve leader side with a two-cell center hysteresis band.

- [x] Add failing pure tests for grab-offset mapping, clamping, leader-side hysteresis, arrow movement, and session snapshots.
- [x] Implement the pure interaction helpers and make those tests pass.
- [x] Add failing component tests for four camera ghosts, chat ghosts, draft isolation, Revert, successful Apply, failed Apply, and remount discard.
- [x] Implement the editor with Video/Chat selection, camera size, chat width, text scale, message count, Apply/Revert, and an accessible error status.
- [x] Implement pointer capture with distinct pointer-up and pointer-cancel behavior plus keyboard movement/Escape restore.
- [x] Wire the editor into the Layout settings category without changing other settings categories.
- [x] Run focused tests and extension check.
- [x] Commit the task.

### Task 4: Delete V1 And Finish Visual Styling

**Files:**
- Delete: `apps/extension/src/overlay-layout-preferences.ts`
- Delete: `apps/extension/test/overlay-layout-preferences.test.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/styles.ts`

**Interfaces:**
- Preserves only the V2 model, engine, runtime adapter, interaction helpers, and editor.
- Removes old preset UI, direct-persist handlers, generic preview rectangles, chat-height control, and standalone ghost-camera-size storage.

- [x] Remove every V1 import, state/ref, storage key, handler, UI branch, and CSS selector.
- [x] Style the preview as a restrained player miniature with one clear leader, three quieter followers, representative chat rows, stable dimensions, visible focus, and no nested decorative cards.
- [x] Ensure compact-width text and controls do not overflow and reduced-motion users do not receive layout motion.
- [x] Verify `rg` finds no runtime V1 or old-key references outside historical docs.
- [x] Run extension tests/check and `git diff --check`.
- [x] Commit the task.

### Task 5: Acceptance, Documentation, And Staging Delivery

**Files:**
- Modify: `docs/current-development-state.md`
- Modify: `docs/superpowers/specs/2026-07-14-overlay-layout-engine-v2-design.md`
- Modify: this plan
- Update approved Graphify artifacts when required by repository policy.

- [x] Run `pnpm --filter @anidachi/extension test` and `pnpm --filter @anidachi/extension check`.
- [x] Run `pnpm dev:check`, then broaden to `pnpm check` if recommended or affected by shared failures.
- [x] Build and validate the staging extension artifact.
- [ ] Inspect the loaded UI at compact and desktop player sizes, including fullscreen, controls visible/hidden, zero/four preview cameras, one/four live cameras where locally reproducible, Apply/Revert, reload persistence, and storage failure presentation.
- [x] Rebuild `/Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging` for the user's Chrome profile.
- [x] Refresh Graphify, review the complete branch diff, and update implementation checkboxes/docs truth.
- [ ] Open a PR into `staging`, wait for required CI, merge only after checks pass, and leave `main` untouched.
