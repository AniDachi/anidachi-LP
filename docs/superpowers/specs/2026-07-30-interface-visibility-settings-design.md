# Interface Visibility Settings Design

Status: Design approved in chat; written specification awaiting review

## Summary

Add an `Interface` settings section to the extension panel for controlling the
visibility behavior of the main AniDachi control and the side participant
pills. The section keeps the current low-obstruction behavior as its default,
adds an explicit always-visible option for users who prefer persistent access,
and includes a compact animated preview that uses the same presentation policy
as the live overlay.

This work changes extension-local presentation and local preferences only. It
does not change room state, media seats, microphone or camera publication,
participant audio transport, provider adapters, API behavior, Worker behavior,
or protocol events.

## Goals

- Give users clear control over whether the main AniDachi control auto-hides.
- Give users clear control over whether no-video participant pills appear only
  when relevant or remain available in a compact form.
- Keep persistent pills compact so they do not cover the player.
- In the new persistent mode, expand only the participant being hovered or
  keyboard-focused.
- Show the result before leaving settings through a truthful miniature preview.
- Preserve privacy-critical and room-lifecycle overrides.
- Keep the settings local, lightweight, validated, and immediately applied.
- Reuse the existing launcher and room-rail behavior instead of creating a
  second overlay system.

## Non-Goals

- Named presets, preset management, or importing/exporting interface settings.
- Changing chat or camera geometry. Those remain owned by `Layout`.
- Changing Push to talk or Open mic behavior. Those remain owned by `Voice`.
- Changing participant volume or mute persistence.
- Styling controls, colors, opacity, animation speed, or edge-intent timing.
- Showing side participant pills before a room exists.
- Duplicating a participant in both a rendered video bubble and the side rail.
- Cross-device or account synchronization.
- API, Worker, database, protocol, P2P signaling, or provider-adapter changes.

## Information Architecture

The settings navigation becomes:

```txt
Reactions · Layout · Interface · Voice · Debug
```

`Interface` sits beside `Layout` because both affect presentation, but their
responsibilities remain separate:

- `Layout` controls where chat and video appear and how large they are.
- `Interface` controls when the main control and side participant pills are
  visible.
- `Voice` controls only the microphone mode.

The section contains one compact preview followed by two accessible segmented
controls:

1. `Main control`: `Auto hide` or `Always visible`.
2. `Participant pills`: `Smart` or `Always visible`.

There are no presets and no nested advanced section.

## Product Behavior

### Main Control

`Auto hide` preserves the current behavior:

- the main control is hidden while idle;
- approaching the top-right player edge shows the existing proximity glow;
- deliberate edge intent reveals the control after the existing delay;
- moving away hides it after the existing grace period;
- pointer focus and keyboard focus keep it visible.

`Always visible` keeps the main control visible whenever the AniDachi overlay is
eligible to mount on the active full-player page. It does not make AniDachi
appear on YouTube thumbnails, feeds, Shorts, or unsupported pages.

The following higher-priority rules apply in both modes:

- an open AniDachi panel always pins the main control because it is the panel's
  close control;
- actively published Open mic always pins the main control as a privacy
  indicator;
- focus keeps the control visible until focus leaves;
- provider-specific overlay placement and safe insets remain unchanged.

`Always visible` suppresses the idle edge glow because the control is already
present.

### Participant Pills

The side rail remains available only when all of the following are true:

- a room is active;
- the AniDachi panel is closed;
- at least one participant is eligible for the rail.

A participant with a mounted, displayable video bubble is not eligible for a
duplicate side pill. The existing rendered-video readiness rule remains the
source of truth, so a participant returns to the rail if their video surface
disappears.

`Smart` is the default and preserves the low-obstruction intent:

- quiet participants remain hidden;
- a speaking no-video participant automatically appears as a compact pill;
- deliberate right-edge intent expands the existing full participant list;
- leaving the rail, after the existing grace period, hides quiet pills again.

`Always visible` changes only the idle state:

- every eligible no-video participant remains visible as a compact pill;
- hovering or keyboard-focusing one pill expands only that participant;
- speaking uses the existing green activity treatment without changing the
  pill's footprint;
- the rail does not require edge intent to become available.

The current participant may show microphone activity but never receives a
listener volume or mute control. Remote media-seat participants retain their
existing local output controls. A muted remote participant has a persistent,
recognizable mute marker in the compact state so a saved mute cannot be
mistaken for a transport failure.

While a remote participant is expanded:

- their existing local volume control and mute action are available;
- pointer capture and the audio-adjustment latch keep the pill open while the
  slider is being dragged;
- losing pointer hover does not close the control until adjustment ends;
- the rail continues to affect only local incoming playback.

Opening the main AniDachi panel hides the side rail in both modes. The panel's
`People` section is the participant surface while the panel is open, and the
rail must not compete with or cover it.

## Preview

The `Interface` section includes one compact miniature player. It contains:

- a silhouette of the main control near the top-right edge;
- three generic participant-pill silhouettes at the right edge;
- one speaking state and one muted state;
- no real room identity, messages, video, or P2P data.

Changing a setting immediately updates the preview:

- `Auto hide` demonstrates `hidden -> glow -> visible -> hidden`;
- main-control `Always visible` keeps its silhouette present;
- participant `Smart` demonstrates a speaking compact pill, deliberate rail
  intent, and the expanded participant list;
- participant `Always visible` keeps all silhouettes compact and expands only
  the hovered or focused example.

The preview may replay automatically after a setting change and exposes one
familiar replay icon button. It does not loop continuously. With
`prefers-reduced-motion: reduce`, state changes happen without travel or pulse
animations.

The preview uses the same pure visibility policy as the live overlay. Its event
sequence is simulated and isolated: it never joins a room, reads live
participants, requests media, or writes participant audio preferences.

## Stored Model

Preferences are stored locally in the browser profile under a new versioned
key:

```ts
const INTERFACE_PREFERENCES_STORAGE_KEY =
  "local:interfacePreferencesV1";

type MainControlVisibility = "auto-hide" | "always-visible";
type ParticipantPillVisibility = "smart" | "always-visible";

interface InterfacePreferencesV1 {
  version: 1;
  mainControlVisibility: MainControlVisibility;
  participantPillVisibility: ParticipantPillVisibility;
}
```

The immutable defaults are:

```ts
{
  version: 1,
  mainControlVisibility: "auto-hide",
  participantPillVisibility: "smart"
}
```

These defaults reproduce current behavior for existing users. The preference is
device/profile-local rather than account-scoped because it describes how this
browser's overlay should behave and must also work before sign-in.

The parser accepts only version 1 and known enum values. Missing or invalid
fields fall back independently to their defaults. Unknown versions fall back
to the full default without rewriting unrelated storage.

## Persistence And Failure Behavior

The controls apply immediately and do not use `Apply`, `Revert`, or preset
buttons.

On a setting change:

1. the local draft and live overlay update immediately;
2. the normalized complete preference object is written to extension-local
   storage;
3. a successful write becomes the applied snapshot;
4. a failed write restores the last applied snapshot and presents a compact
   inline save error in the `Interface` section.

Rapid changes may be coalesced, but the final selected values must be the final
persisted values. Closing and reopening the panel must not lose a successful
selection.

## Architecture

The implementation should keep four responsibilities separate:

1. A small preferences module owns types, defaults, normalization, and the
   storage key.
2. A pure presentation-policy module resolves launcher and participant-pill
   states from preferences plus runtime facts.
3. Existing launcher and room-rail components own timers, pointer/focus events,
   and rendering.
4. The `Interface` settings view owns controls, preview simulation, save state,
   and error feedback.

The live overlay and preview both consume the pure policy. The preview does not
duplicate runtime branching in CSS or a second component-specific state
machine.

The existing precedence is retained:

```txt
privacy and panel overrides
  > room/video eligibility
  > direct pointer or focus interaction
  > speaking activity
  > saved visibility preference
```

The current provider adapter remains responsible for overlay eligibility,
viewport geometry, and player safe insets. `Interface` preferences do not add
provider-specific policy.

## Accessibility

- Each two-option setting is a real radio group or equivalent accessible
  segmented control.
- Arrow keys move between options; Tab moves between setting groups.
- Hover behavior has an equivalent keyboard-focus behavior.
- Expanded participant controls retain their current accessible labels.
- The preview silhouettes are hidden from assistive technology.
- The replay button has a specific accessible label.
- Save failures are announced through a polite live region.
- Reduced-motion preferences are respected in both preview and live
  transitions.

## Verification

### Unit And Component Tests

- Preference parsing accepts valid values and falls back field-by-field.
- Unknown versions return the complete default.
- Main-control policy covers auto-hide, always-visible, panel-open, focus, and
  published Open mic precedence.
- Participant policy covers no room, open panel, quiet, speaking, persistent,
  mounted video, local participant, remote mute, and audio adjustment.
- Settings navigation includes `Interface` in the approved order.
- The preview consumes the same policy and does not access room or P2P APIs.
- Failed persistence restores the last applied preference.
- Rapid updates persist the final selection.
- Existing edge-intent delays and audio-adjustment latches remain covered.

### Manual Staging Acceptance

Verify on both Crunchyroll and YouTube in normal, theater, and fullscreen modes:

- defaults match the current launcher and rail behavior;
- main-control `Always visible` stays present without an edge glow;
- Auto hide still uses deliberate edge intent and does not flicker;
- Open mic remains visibly disclosed in Auto hide mode;
- no side rail appears before joining or creating a room;
- Smart reveals a speaking no-video participant and hides after silence;
- Always visible keeps quiet no-video participants compact;
- hover and keyboard focus expand only one participant;
- volume dragging does not close or resize the rail unexpectedly;
- a muted remote participant remains visibly muted after track or camera
  replacement;
- enabling video removes the duplicate side pill only after video is
  displayable;
- opening the panel hides the side rail;
- source changes and tab reloads preserve successful preferences;
- YouTube feeds, thumbnails, and unsupported pages remain unaffected.

### Required Commands

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
fnm exec --using="$(cat .node-version)" pnpm build:extension:staging
fnm exec --using="$(cat .node-version)" pnpm validate:extension:staging
pnpm graph:update
git diff --check
```

## Rollout

This work stays on the existing feature branch because it extends the same
voice-pill and participant-audio surface. It is added as a coherent, separately
committed block before the branch opens one draft PR into `staging`.

After automated checks:

1. build and validate the staging extension artifact;
2. sync both established local test folders;
3. manually verify both visibility modes with one and multiple participants;
4. perform a two-client check for speaking, mute, camera replacement, and panel
   interaction;
5. keep the PR in draft until the user accepts the behavior on staging.

No server deployment is required for this extension-local feature.
