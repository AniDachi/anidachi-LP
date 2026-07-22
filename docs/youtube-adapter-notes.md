# YouTube Adapter Maintenance Notes

This document describes the current ownership and maintenance rules for the
YouTube extension adapter. It is an implementation guide, not a contract with
YouTube: DOM classes and element structure can change without notice.

## Ownership Boundary

All YouTube-specific player detection, selectors, geometry measurement, and
observation must stay under:

```txt
apps/extension/src/source-adapters/youtube/
```

`player-chrome.ts` owns YouTube player-control geometry. Shared overlay code
consumes only the normalized `PlayerOverlayGeometry` values exposed by the
active `VideoAdapter`. It must not import YouTube selectors or branch on the
YouTube adapter ID when positioning overlay elements.

The current primary selectors are:

```txt
.ytp-chrome-bottom
.ytp-progress-bar-container
.ytp-watch-later-button
.ytp-share-button
.ytp-chrome-top-buttons button
.ytp-chrome-top
.ytp-chrome-top-buttons
```

When these classes are unavailable, the adapter uses bounded semantic
fallbacks for interactive elements near the bottom or top-right of the player.
Those fallbacks are intentionally limited to the active player container.

## Measurement And Fallback

The provider measurer returns normalized values for:

- player viewport dimensions;
- stable safe insets;
- launcher and panel anchors;
- whether bottom controls are currently visible.

Bottom-control visibility respects rendered opacity. The reserved bottom inset
uses the stable control layout even while controls fade out, preventing saved
camera and chat positions from jumping. If top actions cannot be measured, the
launcher falls back to the physical top-right player margin. If the player
container itself has no usable size, the provider-neutral safe defaults are
returned; the overlay is not detached and user layout preferences are not
rewritten.

Captions, ads, cards, annotations, end screens, transient menus, and temporary
tooltips do not contribute to safe insets. Following those elements would make
the overlay unstable during normal playback.

## Observation And Disposal

Observation begins only when `subscribeOverlayGeometry()` is called. Adapter
construction remains side-effect free.

The YouTube provider observes the player container and discovered chrome roots
with `ResizeObserver`, and filters `MutationObserver` records to relevant
structure and visibility attributes. Pointer movement, pointer exit,
transitions, and fullscreen changes schedule coalesced measurements. A single
delayed measurement captures the end of the control fade transition; there is
no polling interval.

The disposer must disconnect both observers, remove every event listener,
cancel the pending animation frame, and clear the delayed measurement. Shared
React lifecycle code marks the subscription disposed before invoking that
disposer, so a late callback from a replaced player cannot update the new
overlay.

## Updating YouTube Selectors

When YouTube changes its player DOM:

1. Reproduce the issue on a valid full `/watch?v=...` page in normal, theater,
   fullscreen, and small-window modes.
2. Inspect only elements inside `#movie_player` or `.html5-video-player`.
3. Prefer stable player chrome roots or semantic roles. Do not use page-wide
   selectors, generated element indexes, page text, or undocumented YouTube
   JavaScript APIs.
4. Update selectors and measurement logic only in
   `source-adapters/youtube/player-chrome.ts`.
5. Add or update characterization tests for visible, hidden, missing, replaced,
   and fallback chrome.
6. Run the focused player-chrome and lifecycle tests, the complete extension
   suite, staging build validation, and real-player visual acceptance.
7. Confirm Crunchyroll behavior is unchanged before merging into `staging`.

## Adding Another Provider

A new provider gets its own folder, measurer, subscription, tests, and adapter
capability implementation. It may reuse the provider-neutral geometry types and
normalization helpers, but must not reuse YouTube or Crunchyroll selectors or
import either provider implementation. Unknown chrome must degrade to safe
normalized values, and all observation must have a deterministic disposer.

The shared overlay should require no provider-specific geometry change when a
new adapter is added.
