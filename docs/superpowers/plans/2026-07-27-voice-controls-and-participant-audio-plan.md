# Voice Controls and Participant Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to implement this plan task by task. Use
> `superpowers:test-driven-development` for each behavior change and
> `superpowers:systematic-debugging` for regressions. Query Graphify before
> broad P2P edits, then verify every important graph claim against source.

**Status:** Local runtime implementation and automated verification are
complete. Manual loaded-extension, two-network, and forced-relay staging
acceptance remain.

**Goal:** Add a privacy-safe Open mic mode and local per-participant audio
controls while preserving Push to talk, existing media-seat limits, P2P
recovery, and speaking indicators. Remove automatic player-volume ducking for
live P2P voice without removing the separate ducking used by Dictate reactions.

**Architecture:** Keep voice transport in the existing extension-side WebRTC
mesh. The local UI owns voice mode and listener preferences.
`P2PMediaController` owns microphone-track publication, audio playback elements,
voice activity sampling, and media recovery. Existing `voice-start` and
`voice-stop` P2P signals remain wire-compatible and describe whether a remote
microphone publication is expected; actual speaking state is derived from
WebRTC audio-level statistics. No Worker, API, database, room snapshot, or
protocol event/schema expansion is required. The semantic contract and comments
for the existing signals must be updated because they no longer mean
"definitely speaking". Microphone publication and camera publication remain
independent capabilities even though one P2P controller owns both transports.
The output-control UI follows the participant's currently rendered surface:
side voice rail without video, or the video-bubble contour with video.

**Tech stack:** TypeScript, React, WXT storage, WebRTC
`MediaStreamTrack`/`RTCRtpSender`/`RTCStatsReport`, HTML audio elements, Vitest,
Playwright real-WebRTC harness, Chrome MV3 staging builds.

**Primary code paths:**

- `apps/extension/src/overlay-app.tsx`
- `apps/extension/src/overlay-room-media-controls.tsx`
- `apps/extension/src/ghost-cam.ts`
- `apps/extension/src/p2p-media.ts`
- `apps/extension/src/media-types.ts`
- `apps/extension/src/hotkeys.ts`
- `apps/extension/src/styles.ts`
- `apps/extension/test/`
- `tests/e2e/`

**Current documentation checked:**

- MDN
  [`MediaStreamTrack.enabled`](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/enabled)
  confirms that track enablement is the correct local mute/unmute control and
  produces silent audio samples without replacing the track.
- MDN
  [`RTCAudioSourceStats`](https://developer.mozilla.org/en-US/docs/Web/API/RTCAudioSourceStats)
  documents local microphone level through `RTCRtpSender.getStats()` ->
  `media-source` -> `audioLevel`.
- MDN
  [`RTCInboundRtpStreamStats.audioLevel`](https://developer.mozilla.org/en-US/docs/Web/API/RTCInboundRtpStreamStats/audioLevel)
  documents the corresponding remote audio level.
- MDN
  [`HTMLMediaElement.volume`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/volume)
  and
  [`HTMLMediaElement.muted`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/muted)
  keep local playback gain (`0..1`) independent from local playback mute.

---

## Fixed Product Decisions

These decisions are part of this delivery and must not be silently changed
during implementation.

### Voice Modes

1. The two modes are named **Push to talk** and **Open mic**.
2. Push to talk remains the default.
3. Selecting Open mic changes the interaction mode but does not turn on the
   microphone by itself.
4. Creating or joining a room never enables the microphone automatically.
5. The selected mode persists locally across browser sessions.
6. The actual microphone-on state is intentionally not persisted across page
   reloads, content-script remounts, browser restarts, room changes, sign-out,
   or media-seat loss.
7. A transient same-room WebSocket reconnect that does not remount the overlay
   preserves the current in-memory microphone state.
8. A same-room source transition that increments `sourceGeneration` may
   recreate the P2P controller, but it preserves the existing in-memory Open
   mic intent and republishes only after the replacement controller is ready.
   This covers same-room video changes and provider ad transitions without
   treating a new room or a page remount as permission to start capture.
9. Switching from Open mic to Push to talk turns the microphone off
   immediately. Switching from Push to talk to Open mic leaves it off until the
   user explicitly enables it.

### Microphone and Camera Independence

1. Camera off must never prevent Push to talk or Open mic from publishing
   microphone audio.
2. Turning the camera on or off must not start, stop, reacquire, or reset the
   microphone.
3. Turning the microphone on or off must not start, stop, or recreate the
   camera track.
4. Camera and microphone can use the same media seat and P2P connection, but
   their intent, track lifecycle, status, recovery, and UI state remain
   separate.
5. A camera-only failure must not terminate healthy microphone publication. A
   microphone-only failure must not turn the camera off.
6. Same-room controller replacement restores each medium only from its own
   explicit in-memory intent.

### Push to Talk

1. Holding `V` continues to publish microphone audio.
2. Releasing `V`, losing pointer capture, window blur, or visibility loss stops
   Push to talk.
3. The header microphone control also supports press-and-hold Push to talk for
   mouse and touch users.
4. The warm-track optimization remains for Push to talk so repeated presses are
   fast.
5. The warm track is released after the existing idle timeout.

### Open Mic

1. The user explicitly toggles Open mic on or off.
2. Open mic remains enabled during ordinary room use and same-overlay
   reconnects; silence does not disable it.
3. Explicitly turning Open mic off releases the microphone track immediately
   rather than keeping it warm. This removes browser microphone capture
   indicators and honors the user's privacy expectation.
4. Permission denial, missing device, terminal track-recovery failure,
   media-seat loss, room leave/end, sign-out, or overlay teardown turns Open mic
   off and releases capture.

### Microphone Errors

1. `NotAllowedError`, `SecurityError`, `NotFoundError`,
   `OverconstrainedError`, and constraint/programming `TypeError` are terminal
   for the current user action: clear microphone intent, release capture, show
   one actionable error, and do not retry automatically.
2. `AbortError`, `NotReadableError`, an unexpected live-track `ended` event, and
   device handoff failures may use the existing bounded reacquisition policy.
3. Unknown capture errors may use the bounded policy but must stop at the
   existing retry cap.
4. A relevant `devicechange` may clear a stale unavailable-device message, but
   capture after a terminal error still requires a new explicit user action; no
   background retry loop is allowed.
5. `P2PMediaController` reports a typed terminal failure through
   `useGhostCam` to the overlay. The overlay clears `openMicEnabled` and
   `pushToTalkHeld` before any controller replacement can observe stale intent.

### Speaking State

1. **Microphone enabled** and **currently speaking** are separate states.
2. A participant with a rendered video uses the existing green video-bubble
   speaking ring. A participant without rendered video uses the side voice
   pill, which automatically slides out while measured speech is active.
3. The same participant must never receive both speaking surfaces at once.
   Actual rendered-video membership, not a camera status flag, chooses the
   surface so camera startup and teardown do not produce a duplicate or missing
   indicator.
4. `voice-start` means that remote audio publication is expected. It must not
   immediately mark that participant as speaking.
5. Local speaking prefers sender `media-source.audioLevel` and falls back to
   RMS measurement of the already-authorized local microphone track while a
   peer sender is not available or does not expose a level.
6. Remote speaking uses inbound RTP `audioLevel`.
7. If neither WebRTC stats nor the local-track meter exposes a level, voice
   transport continues but the UI remains conservative: it does not invent
   speaking activity from packet movement.
8. Muting a remote participant locally does not suppress their speaking
   indicator.
9. While Open mic is enabled, the collapsed main AniDachi pill stays minimally
   visible with a neutral microphone-on glyph. This is a privacy indicator, not
   a speaking animation. The existing green ring/side pill remains reserved for
   measured speech.

### Per-Participant Playback

1. Volume and mute affect only the current listener's browser.
2. They are not host moderation, do not change a remote microphone, and are not
   sent through room signaling.
3. Controls appear only for remote participants with a joined media seat.
4. The local participant does not receive a self-monitor volume control.
5. Volume is `0..100` in the UI and `0..1` on the audio element.
6. Dragging the slider to zero mutes locally while retaining the last audible
   volume. Dragging above zero unmutes and adopts the new volume.
7. The mute button preserves the last audible volume; unmute restores it.
8. Preferences persist locally by stable participant ID, which is the
   authenticated user ID in the current room protocol.
9. Defaults are 100% and unmuted.
10. No amplification above 100% is included.
11. One preference drives every rendering surface. Camera on/off or remote
    video track replacement moves the control between the side voice rail and
    video bubble without resetting volume or mute.
12. The side rail and video bubble change only local incoming playback. They do
    not expose microphone gain and cannot alter what the remote participant
    sends.

### Player Audio

1. Live P2P speech no longer lowers Crunchyroll or YouTube player volume.
2. This removal applies to both local and remote live voice.
3. Dictate reactions keeps its separate temporary ducking because speech
   recognition needs protection from player audio.
4. No platform adapter receives new voice-specific policy. Voice playback is
   platform-independent extension behavior.

### Scope Boundaries

This delivery does not add:

- server-side volume or mute state;
- host global mute, forced mute, or moderation controls;
- microphone or speaker device selection;
- audio amplification above 100%;
- recording, transcription, noise-gate settings, or echo-cancellation settings;
- more than the existing room media-seat limit;
- SFU routing or a replacement for the current P2P mesh;
- new protocol events or database fields.

---

## Runtime State Model

The overlay must derive publication from explicit state rather than using one
`liveVoiceTalking` boolean for every meaning.

```ts
export type VoiceMode = "push-to-talk" | "open-mic";

export type MicrophoneStatus =
  | "off"
  | "connecting"
  | "on"
  | "error";

export interface MicrophoneIntent {
  mode: VoiceMode;
  openMicEnabled: boolean;
  pushToTalkHeld: boolean;
}

export function shouldPublishMicrophone(
  intent: MicrophoneIntent,
  context: {
    roomActive: boolean;
    hasMediaSeat: boolean;
  },
): boolean;
```

Rules:

- Push to talk publishes only while `pushToTalkHeld`.
- Open mic publishes only while `openMicEnabled`.
- No room or no media seat always resolves to `false`.
- `MicrophoneStatus` describes capture/publication state.
- A separate `localSpeaking: boolean` describes measured activity.
- Status changes and speaking changes must not be inferred from each other.

The existing wire signals remain:

```ts
{ kind: "voice-start" } // microphone publication expected
{ kind: "voice-stop" }  // microphone publication no longer expected
```

Internally, new names must refer to microphone publication rather than
"talking". Do not retain parallel old and new state machines after migration.

---

## Voice Activity and Flow Model

Open mic makes the current audio classification insufficient because packet
movement during silence is not proof of speech.

The implementation must keep two independent classifiers:

```ts
export type AudioSpeechActivity = "active" | "quiet" | "unknown";

export type AudioTransportFlow =
  | "flowing"
  | "missing"
  | "not-expected"
  | "stalled"
  | "unknown";
```

### Speech Classification

- Sample only while microphone publication is expected.
- Use a 200 ms cadence.
- Use the existing `0.01` audio-level threshold unless staging evidence shows
  persistent false positives or missed normal speech.
- Enter `active` on the first above-threshold sample.
- Clear after three consecutive quiet samples, producing a 600 ms visual
  hangover that avoids flicker.
- A numeric `audioLevel` below threshold is `quiet`; packet or byte deltas must
  not override it.
- A missing `audioLevel` is `unknown`, not automatically `active`.

### Transport Flow Classification

- Transport flow uses receiver-track presence/state, connection state, inbound
  report presence, and packet/byte progression.
- A live, unmuted receiver track is healthy even if packet counters stay static
  during Opus DTX silence. Static counters alone are never proof of a stall.
- Packet/byte progression is positive confirmation of flow, not a requirement
  for quiet Open mic.
- A missing inbound report or receiver track is eligible for recovery only
  after the existing startup/reconnect grace window and consecutive samples.
- A technically muted or ended receiver track while publication is expected is
  eligible for the existing throttled recovery path.
- Muting an `<audio>` element locally must not affect transport-flow or speaking
  classification.

### Sampling Cost

- Use one local audio sender as the local `media-source` stats source.
- Query only active/expected audio paths.
- Stop the fast audio sampler when nobody is publishing audio.
- Remove audio speech/flow mutation from the slower general P2P health sampler
  so one sampler owns audio counters and hysteresis. Keep the slower sampler for
  ICE, video, and non-audio diagnostics.
- Do not add an always-running `AudioContext` unless Chrome staging proves that
  sender/inbound audio levels are unavailable.

---

## Preference Model

Create `apps/extension/src/voice-audio-preferences.ts`.

```ts
export const VOICE_AUDIO_PREFERENCES_STORAGE_PREFIX =
  "local:voiceAudioPreferencesV1";

export function voiceAudioPreferencesStorageKeyForUser(
  listenerUserId: string,
): string;

export interface ParticipantAudioPreference {
  muted: boolean;
  volume: number; // last audible value, clamped to 0.05..1
}

export interface VoiceAudioPreferencesV1 {
  version: 1;
  mode: VoiceMode;
  participantAudio: Record<string, ParticipantAudioPreference>;
}
```

The storage key is scoped to the authenticated listener using the same
`user:<id>` plus `encodeURIComponent` pattern as account-scoped watch progress.
The remote participant ID remains the inner map key. Account B in the same
Chrome profile must never inherit account A's selected voice mode, participant
IDs, mutes, or volumes.

The module must export pure helpers for:

- constructing defaults;
- deriving the account-scoped storage key;
- parsing unknown stored values;
- clamping volume;
- resolving the effective slider value;
- applying a slider change;
- toggling mute while preserving the last audible volume;
- updating one participant without mutating the previous object.

Malformed storage must fall back field by field instead of rejecting every
preference. Storage failures must not block room or media operation. An account
change clears the previous listener's in-memory preference map, loads the new
listener's scoped store, and replays only that store into the current/new P2P
controller after bootstrap.

---

## UI Contract

### Header Microphone Control

Add a compact microphone control beside the existing camera control in the
header media-control area.

- It uses the same visual height, spacing system, and focus treatment as the
  camera control.
- It appears as unavailable without an active room/media seat.
- Push to talk mode:
  - label: `Hold to talk`;
  - pointer down starts;
  - pointer up/cancel/lost capture stops;
  - focused `Space` or `Enter` keydown starts and keyup stops;
  - `V` remains the keyboard equivalent.
- Open mic mode:
  - label when off: `Turn microphone on`;
  - label when on: `Turn microphone off`;
  - click toggles.
- Enabled but quiet and actively speaking are visually distinguishable.
- The speaking ring/pill remains the primary cross-participant activity
  indicator.
- While Open mic is enabled, the collapsed main AniDachi pill remains minimally
  visible and shows a neutral microphone-on glyph. It does not use the green
  speaking treatment until measured activity is present.
- The control must have correct `aria-label`, `aria-pressed` or `role="switch"`
  semantics for its current mode, keyboard focus, and a tooltip.

### Voice Settings Panel

Replace the current single Push to talk status block with:

1. A two-option segmented mode control: `Push to talk` / `Open mic`.
2. A concise current-state row:
   - Push to talk: `Hold V or press and hold the mic`;
   - Open mic off: `Microphone off`;
   - Open mic on and quiet: `Microphone on`;
   - measured activity: `Speaking`;
   - acquisition: `Connecting`;
   - permission/device failure: the existing actionable error.
3. The existing Dictate reactions action, visually separated and unchanged in
   behavior.
4. Existing media-seat guidance, updated to say `microphone` instead of only
   `push to talk`.

Do not add explanatory marketing copy or duplicate the same toggle in multiple
rows.

### Participant Audio Controls

Keep `RoomPeopleSection` focused on identity, role, media-seat status, and host
authority actions. Do not add a second participant mixer to the room panel.

#### Participant Without Rendered Video

- The existing side voice rail remains the participant's audio presence.
- While the rail is collapsed, measured speech automatically slides that
  participant's compact pill out; silence retracts it using the existing
  speaking hangover.
- Deliberate edge intent still expands the complete no-video participant list,
  including quiet participants, so volume is reachable before they speak.
- Hover or keyboard focus on a remote participant pill reveals a horizontal
  `0..100` volume slider and a compact mute/unmute action inside the expanded
  pill.
- The slider must not make the rail wider while dragging, close the rail, or
  leak pointer/wheel/keyboard events into YouTube or Crunchyroll.
- Pointer down starts an adjustment latch and captures the pointer. While
  latched, pointer leave must not schedule the existing rail-close timer.
  Pointer up, pointer cancel, and lost pointer capture always clear the latch;
  the rail may close afterward only if neither pointer nor focus remains inside.
- The current user's no-video pill may show microphone activity but never shows
  a self-monitor volume slider.

#### Participant With Rendered Video

- A rendered video bubble replaces that participant's side voice pill; the two
  surfaces are mutually exclusive.
- Hover or keyboard focus on a remote video bubble reveals a circular volume
  arc on the bubble contour plus a compact mute/unmute affordance.
- The contour is a real accessible slider: `role="slider"`, `aria-valuemin`,
  `aria-valuemax`, `aria-valuenow`, participant-specific `aria-label`, and Arrow
  key support. It has `tabIndex={0}`. Its invisible pointer hit area may be
  wider than the painted arc.
- The volume arc starts at 135 degrees (lower-left), runs clockwise for 270
  degrees around the top of the bubble, and ends at 45 degrees (lower-right).
  Values are fixed as: lower-left `0`, top `50`, lower-right `100`.
- The bottom 90-degree gap is a non-interactive dead zone. Initial pointer down
  in that gap does nothing. A captured drag entering the gap freezes the
  previous value until it re-enters the active arc, so the value can never wrap
  from `100` to `0` or the reverse.
- Initial pointer down must land inside a minimum 12 px annular hit band around
  the contour. After pointer capture, movement continues to use the angle even
  if the pointer moves radially outside that band.
- Arrow Right/Up increases by `5`; Arrow Left/Down decreases by `5`; Home sets
  `0`; End sets `100`. Every value is clamped.
- The control remains available while the pointer moves from the video image to
  the contour, then fades without moving or resizing the video bubble.
- The existing green speaking ring remains visually distinct from the volume
  arc. Speaking remains visible while the participant is locally muted.
- Existing charge/flame/reaction effects remain pointer-transparent. During
  volume interaction, the volume arc is the top interactive contour while the
  effects remain decorative beneath it; no effect may steal drag input.
- The current user's video bubble may show speaking activity but never shows a
  self-monitor volume slider.

#### Surface Handoff

- Use the IDs of actually mounted `CameraBubble` entries as the source of truth:
  `cameraStackVisible ? renderableCameraParticipants : []`. Do not use the raw
  `ghostVideos` map because the P2P linger window intentionally retains stale
  media elements after camera off.
- Keep a participant in the side rail until their camera status is displayable,
  their video element is ready, and the bubble is actually mounted. Remove the
  rail surface only when all three are true.
- Restore the side-rail surface when the rendered video disappears.
- Surface handoff must preserve the same stored preference and must not change
  the underlying `<audio>` element, audio track, speaking state, or media-seat
  state.
- Chat-only, requested-seat, non-joined, and local-self participants do not
  receive remote output controls.

#### Hotkey and Player Isolation

- Mark microphone and participant-audio interaction roots with one dedicated
  overlay-control boundary attribute.
- Update the existing capture-phase global hotkey handler to inspect
  `event.composedPath()`. An already-held global Push to talk always processes
  its matching `V` keyup first so focus movement cannot leave the microphone
  stuck. After that release guard, return before composer, reaction, new Push
  to talk, or other global shortcuts when the boundary is present. Target-level
  `stopPropagation()` alone is too late for the current window capture listener.
- Keep the existing overlay interaction boundary for pointer, wheel, touch, and
  target-level keyboard propagation into the source player.
- Focused microphone buttons and volume sliders consume Enter, Space, Arrows,
  Home, and End according to their own contract without opening chat, triggering
  reactions, controlling playback, or starting global `V` handling.

---

## Implementation Status

- [x] Tasks 1-7 are implemented in separate reviewed commits on
  `codex/voice-controls-plan`.
- [x] Task 8 diagnostics, documentation, full repository gates, focused
  lifecycle tests, real-WebRTC scenarios, Graphify refresh, staging artifact
  validation, and test-folder handoff are complete.
- [ ] Manual staging acceptance remains governed by the matrix below and is not
  implied by local automation.

## Task 1: Add the Voice Domain and Preference Codec

**Files:**

- Create: `apps/extension/src/voice-audio-preferences.ts`
- Create: `apps/extension/test/voice-audio-preferences.test.ts`
- Modify: `apps/extension/src/media-types.ts`

**Steps:**

1. [ ] Write failing tests for default Push to talk mode, account-scoped keys,
   account A-to-B isolation, malformed persisted data, clamping, zero-to-mute
   behavior, unmute restoration, and immutable participant updates.
2. [ ] Add `VoiceMode`, `MicrophoneStatus`, `MicrophoneIntent`, and
   `shouldPublishMicrophone`.
3. [ ] Add the versioned WXT local preference codec and pure update helpers.
4. [ ] Ensure participant IDs are treated as opaque keys and no display name is
   stored.
5. [ ] Ensure the active listener account is part of persistence ownership and
   the guest/default key is never reused for an authenticated room.
6. [ ] Run:

   ```bash
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- voice-audio-preferences
   ```

7. [ ] Commit the coherent block:

   ```bash
   git add apps/extension/src/media-types.ts \
     apps/extension/src/voice-audio-preferences.ts \
     apps/extension/test/voice-audio-preferences.test.ts
   git commit -m "feat(extension): define voice control preferences"
   ```

**Acceptance:**

- Voice mode and microphone intent are distinct.
- Invalid storage cannot produce values outside the supported modes or volume
  range.
- Two accounts in one Chrome profile cannot observe each other's participant
  audio preferences.
- Mute restoration behavior is covered by unit tests.

---

## Task 2: Separate Microphone Publication, Speech, and Audio Flow

**Files:**

- Create: `apps/extension/src/voice-activity.ts`
- Create: `apps/extension/test/voice-activity.test.ts`
- Modify: `apps/extension/src/p2p-media.ts`
- Modify: `apps/extension/test/p2p-media.test.ts`

**Steps:**

1. [ ] Write failing pure tests proving:
   - a numeric quiet `audioLevel` stays quiet even when packets move;
   - packet movement with no `audioLevel` proves flow but not speech;
   - `audioLevel=0` plus static counters on a live unmuted receiver track is
     healthy DTX silence rather than a stall;
   - a missing report/track and a technically muted or ended receiver are
     classified separately from healthy silence;
   - three quiet samples clear speaking after one active sample.
2. [ ] Write failing controller tests proving:
   - `voice-start` marks remote audio expected without immediately adding a
     speaking ID;
   - `voice-stop` clears expectation and speaking;
   - sender `media-source.audioLevel` controls local speaking;
   - local and remote muted playback do not alter activity classification.
3. [ ] Extract pure speech/flow/hysteresis helpers into `voice-activity.ts`.
4. [ ] Add an audio-only 200 ms sampler that is active only while local or
   remote audio publication is expected.
5. [ ] Sample one local audio sender for `media-source.audioLevel` and expected
   remote inbound audio for `audioLevel` plus transport counters.
6. [ ] Keep the existing slower P2P health/recovery sampling for non-audio
   duties and remove its writes to audio activity counters.
7. [ ] Replace `publishActiveSpeakerIds()` dependence on publication state with
   measured `localSpeaking` plus measured remote IDs.
8. [ ] Preserve throttled audio-stall recovery, but base flow on packet/byte
   progression rather than speech classification.
9. [ ] Dispose the audio sampler and all counters on peer removal, track end,
   room disconnect, and controller disposal.
10. [ ] Run:

    ```bash
    fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- voice-activity p2p-media
    ```

11. [ ] Commit:

    ```bash
    git add apps/extension/src/voice-activity.ts \
      apps/extension/src/p2p-media.ts \
      apps/extension/test/voice-activity.test.ts \
      apps/extension/test/p2p-media.test.ts
    git commit -m "fix(extension): separate voice activity from audio flow"
    ```

**Acceptance:**

- Open mic silence does not show a speaking indicator.
- Open mic silence does not trigger media-stall ICE recovery.
- Static Opus DTX silence does not trigger media-stall ICE recovery.
- Real speech lights the correct participant and clears without flicker.
- The sampler does no fast polling while voice publication is inactive.

---

## Task 3: Generalize the P2P Microphone Lifecycle

**Files:**

- Modify: `apps/extension/src/p2p-media.ts`
- Modify: `apps/extension/src/ghost-cam.ts`
- Modify: `apps/extension/src/media-types.ts`
- Modify: `packages/protocol/src/types.ts` (semantic comments only; schemas
  unchanged)
- Modify: `apps/extension/test/p2p-media.test.ts`
- Modify: `apps/extension/test/ghost-cam.test.tsx`

**Steps:**

1. [ ] Replace internal `wantsVoiceTalk`, `voiceTalking`,
   `startVoiceTalk()`, and `stopVoiceTalk()` concepts with one microphone
   publication lifecycle:

   ```ts
   setMicrophonePublishing(enabled: boolean, release: "warm" | "immediate"):
     Promise<void>;
   ```

2. [ ] Rename status callbacks and state to microphone terminology while
   preserving wire-level `voice-start`/`voice-stop`.
3. [ ] Make publication transitions idempotent per peer and signaling transport
   generation:
   - one start signal per peer for an active publication;
   - repeat start for a newly joined peer and after signaling transport
     recovery so late join/reconnect works;
   - one stop signal per previously informed peer when publication ends;
   - replay the current desired state (`voice-start` or `voice-stop`) to every
     peer after each signaling transport generation, so a previously lost stop
     cannot leave stale remote expectation;
   - duplicate start/stop delivery remains harmless;
   - no renegotiation when only `track.enabled` changes on a warm sender.
4. [ ] Keep Push to talk warm release behavior.
5. [ ] Add immediate release for explicit Open mic off and terminal errors.
6. [ ] Classify capture failures according to the fixed terminal/recoverable
   contract and test that terminal permission/device errors never enter the
   retry loop.
7. [ ] Add a typed terminal-failure callback to `P2PMediaController`, expose it
   through `useGhostCam`, and verify one terminal failure is reported without a
   controller retry loop.
8. [ ] Ensure track end recovery follows current user intent but stops after
   the existing bounded retry policy.
9. [ ] Update `useGhostCam` to expose generic microphone publication and
   measured speaking state.
10. [ ] Update protocol comments for `voice-start`/`voice-stop` to describe
   publication expectation without changing the Zod schema or event names.
11. [ ] Remove parallel legacy wrappers after all local callers are migrated.
12. [ ] Run:

   ```bash
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- p2p-media ghost-cam
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol check
   ```

13. [ ] Commit:

    ```bash
    git add apps/extension/src/p2p-media.ts \
      apps/extension/src/ghost-cam.ts \
      apps/extension/src/media-types.ts \
      packages/protocol/src/types.ts \
      apps/extension/test/p2p-media.test.ts \
      apps/extension/test/ghost-cam.test.tsx
    git commit -m "refactor(extension): generalize microphone publication"
    ```

**Acceptance:**

- Push to talk and Open mic share one controller lifecycle.
- No old "talking means track enabled" state remains.
- Late peers and restored signaling transports receive the active publication
  state.
- Open mic does not renegotiate during silence.
- Explicit Open mic off stops device capture immediately.
- No protocol event or schema is added.

---

## Task 4: Add Local Per-Participant Output Control

**Files:**

- Modify: `apps/extension/src/p2p-media.ts`
- Modify: `apps/extension/src/ghost-cam.ts`
- Modify: `apps/extension/test/p2p-media.test.ts`
- Modify: `apps/extension/test/ghost-cam.test.tsx`

**Steps:**

1. [ ] Write failing tests that cover:
   - preference applied when a remote audio element is first created;
   - preference applied immediately to an existing element;
   - preference retained across remote track replacement;
   - muted playback still allows speaking-state updates;
   - `unlockAudio()` respects stored mute and volume.
2. [ ] Add:

   ```ts
   setParticipantAudioOutput(
     participantId: string,
     preference: ParticipantAudioPreference,
   ): void;
   ```

3. [ ] Store the current output preference map in the controller so every
   newly-created `<audio>` element receives it before `play()`.
4. [ ] Apply `element.volume` and `element.muted` independently.
5. [ ] Expose the runtime setter through `useGhostCam`.
6. [ ] Pass the complete preference map into `useGhostCam` and replay it when a
   controller is created, so preferences loaded before P2P setup are not lost.
7. [ ] Require preference bootstrap to finish, with validated stored data or
   safe defaults, before `useGhostCam` creates a controller or plays a remote
   audio element. A saved mute must never leak a brief 100% playback burst.
8. [ ] Ensure removal of a peer/audio element does not delete the user's stored
   preference.
9. [ ] On authenticated account change, clear all old-listener preferences from
   the live controller before replaying the newly loaded account-scoped map.
   Test A-to-B switching with the same remote participant ID.
10. [ ] Run:

   ```bash
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- p2p-media ghost-cam
   ```

11. [ ] Commit:

   ```bash
   git add apps/extension/src/p2p-media.ts \
     apps/extension/src/ghost-cam.ts \
     apps/extension/test/p2p-media.test.ts \
     apps/extension/test/ghost-cam.test.tsx
   git commit -m "feat(extension): add participant audio output control"
   ```

**Acceptance:**

- Volume and mute are entirely local.
- Stored mute/volume is applied before the first remote `play()` call.
- Preferences survive track recreation.
- Activity and recovery remain independent from playback mute.

---

## Task 5: Integrate Voice Mode, Hotkeys, and Privacy Cleanup

**Files:**

- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/hotkeys.ts`
- Modify: `apps/extension/src/overlay-unmount-cleanup.ts`
- Modify: `apps/extension/test/hotkeys.test.ts`
- Modify: `apps/extension/test/overlay-media-session.test.ts`
- Modify: `apps/extension/test/overlay-unmount-cleanup.test.tsx`
- Create: `apps/extension/test/overlay-voice-session.test.ts`

**Steps:**

1. [ ] Write pure state-transition tests for room join, room leave, media-seat
   loss, mode switch, same-overlay reconnect, source-generation controller
   replacement, camera on/off, authenticated account switch, and overlay
   teardown.
2. [ ] Bootstrap `VoiceAudioPreferencesV1` before P2P controller creation,
   falling back to validated defaults if storage fails, and persist only
   validated updates. Re-run bootstrap under the new listener-scoped key on an
   authenticated account change.
3. [ ] Replace `liveVoiceTalking` with:
   - persisted `voiceMode`;
   - in-memory `openMicEnabled`;
   - transient `pushToTalkHeld`;
   - derived microphone publication.
4. [ ] In Push to talk mode, keep `V` behavior and stop on keyup, pointer
   cancellation, blur, and visibility loss.
5. [ ] In Open mic mode, ignore `V` voice actions and do not turn the
   microphone off merely because the window loses focus.
6. [ ] Turn the microphone off with immediate release on:
   - mode switch to Push to talk;
   - media-seat loss;
   - room leave/end;
   - room ID change;
   - sign-out;
   - overlay unmount.
7. [ ] Consume the typed terminal-failure callback from `useGhostCam`; clear
   both overlay-owned microphone intent flags before any replacement controller
   can observe them.
8. [ ] Keep same-overlay WebSocket reconnects from resetting explicit Open mic
   state.
9. [ ] Preserve explicit in-memory Open mic intent across same-room
   `sourceGeneration` controller replacement and republish only after the new
   controller is ready. A stale controller must finish teardown and release its
   track before replacement capture starts.
10. [ ] Reset Open mic on a true room ID change or overlay remount.
11. [ ] Do not add microphone intent to room/session protocol or durable room
   storage.
12. [ ] Prove camera and microphone independence:
    - camera off plus Push to talk publishes audio;
    - camera off plus explicit Open mic publishes audio;
    - camera toggles do not change microphone intent or publication;
    - microphone toggles do not change camera intent or publication;
    - camera-only failure leaves healthy audio publishing;
    - microphone-only failure leaves healthy video publishing.
13. [ ] Run:

   ```bash
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- hotkeys overlay-media-session overlay-unmount-cleanup overlay-voice-session
   ```

14. [ ] Commit:

    ```bash
    git add apps/extension/src/overlay-app.tsx \
      apps/extension/src/hotkeys.ts \
      apps/extension/src/overlay-unmount-cleanup.ts \
      apps/extension/test/hotkeys.test.ts \
      apps/extension/test/overlay-media-session.test.ts \
      apps/extension/test/overlay-unmount-cleanup.test.tsx \
      apps/extension/test/overlay-voice-session.test.ts
    git commit -m "feat(extension): add privacy-safe open mic mode"
    ```

**Acceptance:**

- No create/join path starts the microphone.
- Push to talk cannot get stuck after lost key/pointer/focus.
- Open mic is not accidentally stopped by ordinary focus changes.
- Same-room source/controller replacement restores only previously explicit
  Open mic intent and cannot double-capture.
- Camera and microphone can operate independently in every supported state.
- All terminal room/media transitions stop capture.

---

## Task 6: Build the Header, Voice Panel, and Participant Mix UI

**Files:**

- Create: `apps/extension/src/overlay-voice-controls.tsx`
- Create: `apps/extension/src/participant-audio-controls.tsx`
- Create: `apps/extension/src/participant-volume-geometry.ts`
- Create: `apps/extension/test/overlay-voice-controls.test.tsx`
- Create: `apps/extension/test/participant-audio-controls.test.tsx`
- Create: `apps/extension/test/participant-volume-geometry.test.ts`
- Modify: `apps/extension/src/overlay-room-media-controls.tsx`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/styles.ts`
- Modify: `apps/extension/test/overlay-room-media-controls.test.tsx`
- Modify: `apps/extension/test/overlay-layout-styles.test.ts`

**Steps:**

1. [ ] Write component tests for:
   - header control semantics in both modes;
   - hold/cancel behavior for Push to talk;
   - focused `Space`/`Enter` keydown and keyup Push to talk behavior without a
     duplicate click toggle;
   - click toggle behavior for Open mic;
   - unavailable state without a media seat;
   - mode switching without automatic capture;
   - collapsed-pill privacy indication for enabled but quiet Open mic;
   - microphone operation while camera is off;
   - remote-only participant audio controls on the side rail and video bubble;
   - slider-to-mute and mute-to-restore behavior;
   - no duplicate side pill for a rendered video participant;
   - camera off while a lingered `GhostVideo` remains still restores the side
     pill;
   - surface handoff when a remote video appears or disappears;
   - no output control on the current user's own pill or video;
   - player input isolation while dragging either slider;
   - capture-phase global hotkeys ignore focused overlay controls;
   - a global `V` press followed by focus movement into a control still handles
     `V` keyup and stops Push to talk;
   - side-rail drag remains open across pointer leave and cleans up on
     pointerup, pointercancel, and lostpointercapture.
2. [ ] Write pure geometry tests for the circular slider:
   - 135-degree lower-left start=`0`, top=`50`, and 45-degree lower-right
     end=`100`;
   - initial pointer down outside the hit ring or inside the dead zone is
     ignored;
   - captured radial movement remains active;
   - movement through the dead zone freezes the previous value;
   - no `100 -> 0` wrap at the endpoint;
   - stable Arrow/Home/End key behavior.
3. [ ] Implement `PanelMicrophoneControl` and `VoiceSettingsPanel` in
   `overlay-voice-controls.tsx`.
4. [ ] Place the microphone control beside the existing camera control without
   changing room action behavior.
5. [ ] Replace the old Voice status block with the fixed two-mode UI contract.
6. [ ] Keep `RoomPeopleSection` unchanged as the authority/status surface.
7. [ ] Extract reusable accessible side-pill and circular-contour controls into
   `participant-audio-controls.tsx`; keep pointer-to-volume math pure in
   `participant-volume-geometry.ts`.
8. [ ] Pass preferences and change handlers into the existing `RoomRail` and
   `CameraBubble` render paths. Continue deriving mutual exclusion from actual
   mounted `CameraBubble` IDs, not raw retained `GhostVideo` IDs.
9. [ ] Connect preference changes to WXT local storage and immediately to
   `P2PMediaController`.
10. [ ] Add the dedicated hotkey-boundary attribute and update the existing
    capture-phase global hotkey path check after the active-PTT `V` keyup guard
    but before composer and new action handling. Keep pointer, wheel, touch, and
    target keyboard isolation so source-player controls never react during
    adjustment.
11. [ ] Add pointer capture plus an explicit side-rail adjustment latch. Cancel
    close timers on adjustment start and clean up on pointerup, pointercancel,
    lostpointercapture, component unmount, and participant removal.
12. [ ] Add focus-visible, hover, disabled, active, speaking, and muted styles
   consistent with the existing dark/orange visual system.
13. [ ] Keep the green speaking treatment and volume treatment visually
    distinct at all camera sizes, including Small, and give the contour a
    minimum practical pointer hit area without resizing the bubble.
14. [ ] Keep reaction/charge/flame layers pointer-transparent and below the
    interactive volume contour without changing their existing animation.
15. [ ] Verify long display names, four participants, camera transitions, and
    player-chrome adaptation do not overflow or move the controls incorrectly.
16. [ ] Run:

   ```bash
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test -- overlay-voice-controls participant-audio-controls participant-volume-geometry overlay-room-media-controls overlay-layout-styles
   ```

17. [ ] Commit:

    ```bash
    git add apps/extension/src/overlay-voice-controls.tsx \
      apps/extension/src/participant-audio-controls.tsx \
      apps/extension/src/participant-volume-geometry.ts \
      apps/extension/src/overlay-room-media-controls.tsx \
      apps/extension/src/overlay-app.tsx \
      apps/extension/src/styles.ts \
      apps/extension/test/overlay-voice-controls.test.tsx \
      apps/extension/test/participant-audio-controls.test.tsx \
      apps/extension/test/participant-volume-geometry.test.ts \
      apps/extension/test/overlay-room-media-controls.test.tsx \
      apps/extension/test/overlay-layout-styles.test.ts
    git commit -m "feat(extension): add voice and participant mix controls"
    ```

**Acceptance:**

- Voice can be controlled without opening a deep settings row.
- Mode configuration remains in the Voice settings panel.
- A no-video participant is controlled from the side voice pill; a participant
  with rendered video is controlled from that video bubble's contour.
- The two surfaces never duplicate one participant and preserve one preference
  during camera transitions.
- Participant volume controls do not compete with host media-seat actions.
- Keyboard and screen-reader semantics are covered.

---

## Task 7: Remove Live-Voice Player Ducking Only

**Files:**

- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/test/overlay-voice-session.test.ts`
- Create: `apps/extension/test/overlay-voice-ducking.test.tsx`

**Steps:**

1. [ ] Add a failing regression test proving local or remote P2P speaking does
   not call `adapter.duckVolume()`.
2. [ ] Add or preserve a test proving Dictate reactions still calls
   `adapter.duckVolume()` and restores it after recognition stops.
3. [ ] Remove `restoreLiveVoiceDuckingRef`, the local/remote live-voice ducking
   effect, and unused derived state.
4. [ ] Keep `restoreVoiceDuckingRef` and Dictate reactions cleanup unchanged.
5. [ ] Run the focused tests and:

   ```bash
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
   ```

6. [ ] Commit:

   ```bash
   git add apps/extension/src/overlay-app.tsx \
     apps/extension/test/overlay-voice-session.test.ts \
     apps/extension/test/overlay-voice-ducking.test.tsx
   git commit -m "fix(extension): stop ducking player audio for live voice"
   ```

**Acceptance:**

- Live voice never modifies source-player volume.
- Dictate reactions still performs bounded temporary ducking.
- Cleanup leaves source-player volume exactly where the adapter found it.

---

## Task 8: Diagnostics, Documentation, and Full Verification

**Files:**

- Modify: `docs/current-development-state.md`
- Modify:
  `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- Modify:
  `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`
- Modify: `tests/e2e/p2p-media-harness.mjs`
- Modify: `tests/e2e/harness-entry.ts`
- Modify extension diagnostics only if the current Debug panel cannot expose
  the required non-sensitive fields.

**Steps:**

1. [x] Add safe diagnostics for:
   - selected voice mode;
   - microphone status;
   - local speaking boolean;
   - expected remote publishers;
   - effective remote volume/mute states;
   - audio speech and transport-flow classifications.
2. [x] Do not log device labels, raw audio, permission details beyond the
   existing error category, or user content.
3. [x] Update current-state and P2P progress docs with the final implementation,
   verification evidence, and remaining limitations.
4. [x] Extend the real-WebRTC harness API and scenarios to prove:
   - Open mic publishes continuously through silence, late join, and signaling
     reconnect;
   - microphone audio publishes with camera off, survives camera on/off, and a
     microphone-only stop does not remove healthy video;
   - Push to talk warm reuse does not reacquire the microphone;
   - local mute/volume survives remote track replacement without changing
     sender audio or leaving speech classification unavailable.
   Use focused overlay/useGhostCam lifecycle tests, rather than the low-level
   transport harness, to prove same-room source/controller replacement restores
   only explicit in-memory Open mic intent.
5. [x] Run:

   ```bash
   git diff --check
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
   fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
   fnm exec --using="$(cat .node-version)" pnpm check
   fnm exec --using="$(cat .node-version)" pnpm test
   fnm exec --using="$(cat .node-version)" npm --prefix tests/e2e run harness:p2p
   fnm exec --using="$(cat .node-version)" pnpm build:extension:staging
   fnm exec --using="$(cat .node-version)" pnpm validate:extension:staging
   fnm exec --using="$(cat .node-version)" pnpm dev:check -- --profile extension
   ```

6. [x] Refresh the project graph:

   ```bash
   fnm exec --using="$(cat .node-version)" pnpm graph:update
   ```

7. [x] Commit only approved Graphify team artifacts if the refresh changed
   them intentionally.
8. [x] Commit harness, documentation, and diagnostics as one coherent final
   block.

**Acceptance:**

- All extension and repository checks pass.
- Focused lifecycle tests plus the real-WebRTC harness cover the new
  publication and output-control contracts at their actual ownership layers.
- The staging artifact builds and validates.
- No protocol event/schema, API, Worker, or database runtime change appears in
  the diff; only semantic comments for existing voice signals may change in the
  protocol package.
- Graphify and active development docs reflect the final architecture.

---

## Staging Acceptance Matrix

Use two Chrome profiles or the existing Mac/Windows test pair. Run at least one
test over a different network or relay-backed path before production promotion.

### Privacy and Lifecycle

- [ ] New room: camera off, microphone off.
- [ ] Guest join: microphone off.
- [ ] Refresh/reload: microphone off even if Open mic mode remains selected.
- [ ] Same-overlay WebSocket reconnect: explicitly enabled Open mic continues.
- [ ] Same-room source/ad transition: controller replacement briefly
  re-establishes, then explicit Open mic continues without duplicate capture.
- [ ] Leave/end/sign-out/media-seat revoke: microphone capture stops and browser
  capture indicator disappears.
- [ ] Permission denial: actionable state, no retry loop, no false speaking.
- [ ] Missing device: actionable state, no background retry loop; a later
  explicit attempt after device connection is allowed.

### Push to Talk

- [ ] Hold/release `V` publishes/stops audio.
- [ ] Pointer hold/release on the header control publishes/stops audio.
- [ ] Blur, key loss, pointer cancel, and visibility change cannot leave it
  stuck.
- [ ] Repeated presses reuse the warm track without extra negotiation.

### Open Mic

- [ ] Selecting the mode alone does not start capture.
- [ ] Explicit toggle starts and stops capture.
- [ ] Open mic publishes normally while the camera is off.
- [ ] Turning the camera on/off does not interrupt or restart Open mic.
- [ ] Silence does not show speaking.
- [ ] Normal speech shows and clears the ring/pill responsively.
- [ ] A speaking participant with rendered video gets only a green video ring.
- [ ] A speaking participant without rendered video gets only the side pill.
- [ ] Enabled but quiet Open mic remains visibly indicated in the collapsed main
  pill without using the speaking treatment.
- [ ] Silence and Opus DTX do not trigger repeated ICE restarts or
  renegotiation.

### Participant Mix

- [ ] Each listener can set a different volume for the same participant.
- [ ] Mute is local and does not affect the other listener.
- [ ] Unmute restores the last audible volume.
- [ ] Without remote video, edge reveal exposes a horizontal slider in the side
  pill; measured speech also reveals the compact pill automatically.
- [ ] With remote video, hover/focus exposes the contour slider and the
  participant no longer appears in the side rail.
- [ ] Camera off restores the side pill immediately even while a stale retained
  `GhostVideo` exists during the P2P linger window.
- [ ] Camera on/off moves the control between surfaces without resetting
  volume, mute, speaking state, or playback.
- [ ] Circular adjustment cannot wrap at its endpoint and works with Arrow keys.
- [ ] Leaving the side rail while dragging does not close it; release, cancel,
  and lost capture always end adjustment cleanly.
- [ ] Dragging either control does not seek, scroll, or toggle the source
  player.
- [ ] Enter, Space, Arrows, Home, and End on focused audio controls do not open
  chat or trigger global extension/player shortcuts.
- [ ] The current participant has no self-monitor output control.
- [ ] Preferences survive camera toggle, remote track replacement, and a new
  room with the same participant.
- [ ] A stored mute is applied before first playback; no audible 100% flash
  occurs during bootstrap or controller replacement.
- [ ] Muted participants still show speaking activity.

### Player and Dictation

- [ ] Crunchyroll volume is unchanged by local and remote P2P voice.
- [ ] YouTube volume is unchanged by local and remote P2P voice.
- [ ] Dictate reactions still ducks and restores player audio.
- [ ] Source switching and advertisements do not alter voice mode or participant
  output preferences while the overlay remains mounted.
- [ ] Switching authenticated accounts in one Chrome profile loads only the new
  listener's voice mode and participant output preferences.

### Recovery and Load

- [ ] Camera/audio still recover after short offline/online transitions.
- [ ] Quiet Open mic does not produce audio-stall recovery churn.
- [ ] CPU usage does not materially regress with four active media seats.
- [ ] Closing the panel does not stop Open mic; leaving the room does.

---

## Pull Request and Promotion

1. Implement on a `codex/*` feature branch based on current `staging`.
2. Keep commits aligned with the tasks above; do not open one PR per small
   visual adjustment.
3. Open one draft PR into `staging` after Tasks 1-7 are coherent and focused
   checks pass.
4. Record:
   - affected plane: extension;
   - protocol wire schema/events: unchanged; existing voice signal semantic
     comments updated;
   - API/Worker/database: unchanged;
   - Graphify query and update status;
   - staging artifact build ID;
   - two-client evidence;
   - rollback: revert the feature PR and rebuild the prior staging artifact.
5. Mark ready only after the full verification task passes.
6. Merge to `staging`, update both approved unpacked test folders, and complete
   the staging acceptance matrix.
7. Promote to `main` only after the user accepts voice behavior in the staging
   build.

---

## Final Definition of Done

- Push to talk remains fast and safe.
- Open mic is explicit, privacy-safe, and stable.
- Microphone and camera operate independently without cross-triggering or
  cross-failure cleanup.
- Speaking indicators represent measured speech rather than microphone intent.
- Silent audio remains a healthy transport state.
- Every listener can locally control each remote participant's volume and mute.
- No-video participants use the side voice rail; rendered-video participants
  use the video-bubble contour, with one preference and no duplicate surface.
- Live voice never changes player volume.
- Dictate reactions retains its intentional temporary ducking.
- No new server behavior, protocol event/schema, database state, or
  provider-adapter policy was added; existing voice signal semantics are
  documented as publication expectation.
- Automated checks, real-WebRTC validation, staging artifact validation, and
  two-client manual acceptance are recorded.
