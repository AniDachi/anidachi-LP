# Shared Watch Progress Tracker

Date: 2026-05-26

This document records the prototype direction for the Anidachi resources popup and the shared
watch-progress tracker. The current implementation is intentionally demo-driven, but the UI and data
shape should become a real product feature later.

## Product Goal

The resources popup should answer three questions quickly:

- What did I watch?
- Who did I watch it with?
- Where can we continue together?

The feature is not just a personal watch history. It is a social resume surface: a user can see
where a group stopped, where a pair stopped, and where they watched ahead alone, then restart the
right room with the right people.

## Current Prototype

Implemented in:

- `apps/extension/src/popup-app.tsx`
- `apps/extension/src/popup-styles.ts`
- `apps/extension/src/watch-progress.ts`
- `apps/extension/src/crunchyroll-progress.ts`
- `apps/extension/src/current-resource-panel.tsx`

Current behavior:

- The extension popup opened from the Chrome toolbar shows provider folders.
- Crunchyroll has real local watch-progress records from `chrome.storage.local`.
- Netflix, YouTube, and Amazon are placeholder provider folders.
- Series expand into episode rows.
- Episode rows have a small play triangle on the left to return to the source URL.
- Each episode can render demo shared-progress sessions:
  - group watch progress;
  - pair/date watch progress;
  - solo progress.
- Clicking an avatar marker opens a compact glass popover with participants and an action button.

Important: friend/session data in the tracker is fake demo data today. Only Crunchyroll resource and
episode progress are real.

## Visual Model

The shared tracker is a single layered timeline, not multiple parallel bars.

Rules:

- The inactive track is one neutral line.
- Each session is a colored segment starting at 0 and ending at that session's progress.
- Longer segments sit underneath shorter segments.
- Shorter segments sit visually on top so overlapping progress is readable.
- Avatar markers sit above all timeline segments.
- A group marker uses avatar circles stacked almost directly on top of each other, with only a tiny
  offset. It should read as "there are several people here" without taking much width.
- Clicking a marker opens the participant popover.
- The popover must stay compact, must not be clipped by provider rows, and must have a lightweight
  close icon without a heavy circular button.

Color meaning:

- Green: group/shared watch progress with several friends.
- Rose/red: pair watch progress, for example "continue with girlfriend".
- Blue/cyan: solo progress where the user watched ahead alone.

The tracker should feel like one timeline with different social states layered on it, not like a
chart or analytics widget.

## Interaction Model

Episode row:

1. User opens the extension popup.
2. User expands a provider, then a series.
3. User sees episodes with progress timelines.
4. User clicks a marker on the timeline.
5. A compact popover opens near that marker.
6. The popover shows the session label, progress detail, participants, and one action.

Popover actions:

- Group marker: create or resume a room with that group.
- Pair marker: create or resume a room with that one person.
- Solo marker: continue alone or open the source URL.

Production behavior should eventually:

- Create a room with preselected participants.
- Copy/share an invite if not all participants are online.
- Reuse the saved source URL and target time.
- Seek the local video to the saved session progress after navigation, only after adapter readiness.

## Data Model Needed For Production

Current local storage stores item/episode progress, but not true social sessions. Production needs a
session-level model.

Suggested model:

```ts
type WatchSessionKind = "group" | "pair" | "solo";

interface WatchProgressSession {
  id: string;
  provider: "crunchyroll" | "netflix" | "youtube" | "amazon";
  sourceUrl: string;
  itemId: string;
  itemTitle: string;
  episodeId?: string;
  episodeTitle?: string;
  kind: WatchSessionKind;
  participantIds: string[];
  roomId?: string;
  currentTime: number;
  duration: number;
  progress: number;
  lastWatchedAt: number;
  updatedByUserId: string;
}
```

Derived UI groups:

- Provider folder: groups all records by source provider.
- Series/movie item: groups by `itemId`.
- Episode row: groups by `episodeId` for series, or `itemId` for movies.
- Timeline session markers: all sessions for that episode/movie, sorted by progress descending for
  rendering.

Storage strategy:

- Prototype: `chrome.storage.local`.
- MVP with accounts: Supabase/Postgres for durable social session history.
- Live room playback state must still stay in Durable Objects; do not persist every host state tick
  to Postgres.
- Persist only meaningful checkpoints:
  - room created;
  - participant joined/left;
  - episode/source changed;
  - pause/end/pagehide;
  - every 15-30 seconds while watching;
  - final room closed.

## Real Data Flow

1. Adapter identifies the provider, item, episode, duration, and source URL.
2. Room client knows current participants and room id.
3. Progress recorder writes checkpoints for the current room.
4. Backend merges checkpoints into a `WatchProgressSession`.
5. Popup reads history from local cache first, then syncs with backend after auth.
6. User clicks a session marker.
7. Extension creates a room with selected participants and source metadata.
8. Extension opens the source URL.
9. Adapter waits until player is ready.
10. Extension seeks to `currentTime` and starts in paused or synced state.

For Crunchyroll, step 9 is important because the player can show a `/watch/...` route before the real
video object is ready.

## Production Rules

Do:

- Keep the popup dense and compact.
- Keep progress readable at small width.
- Prefer initials now; later use profile avatars when available.
- Make group avatar stacks extremely compact.
- Keep the popover one action deep.
- Cache recent progress locally so the popup opens instantly.
- Treat Crunchyroll episode transitions as SPA/media remounts.

Do not:

- Turn this into a full history dashboard inside the popup.
- Add a large chat or comments surface here.
- Store raw video, camera streams, or page data.
- Write live playback state to Postgres every second.
- Assume all providers expose the same metadata.
- Let popovers overflow outside the popup viewport or hide behind avatar markers.

## Open Product Questions

- Should group progress and solo progress both show on the same episode if the user watched ahead
  after the group stopped?
- If two groups watched the same episode to different points, should we show both markers or merge
  by most recent group?
- Should "Create room" notify friends immediately, or only create a copyable invite?
- Should a pair session have a stronger visual priority than a large group session?
- Should progress reset or mark complete after all participants finish an episode together?

## Conversion Checklist

- Replace `getDemoSessions()` in `popup-app.tsx` with real session data.
- Add a durable `WatchProgressSession` schema to shared protocol/db package.
- Add backend endpoints for history fetch and room-from-session creation.
- Add local cache invalidation and migration for `anidachi.watchProgress.v1`.
- Add tests for layered session sorting and popover alignment.
- Add browser/UI tests for clipping, marker clicks, close button, and source navigation.
- Add real friend identity/avatar support.
- Add provider-specific progress extractors beyond Crunchyroll.
- Add privacy copy explaining that watch history is social-room metadata, not video content.
