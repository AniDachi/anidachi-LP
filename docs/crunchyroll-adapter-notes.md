# Crunchyroll Adapter Notes

Date: 2026-05-25

## Live CDP Research: Navigation and Player Lifecycle

Date: 2026-05-26

This section is based on a live Chrome/CDP pass against authenticated Crunchyroll pages:

- `https://www.crunchyroll.com/ru/watch/GPWUKE590/what-it-takes-to-be-a-hero`
- `https://www.crunchyroll.com/ru/watch/G8WUNEWJE/roaring-muscles`
- `https://www.crunchyroll.com/ru/watch/GZ7UVJXG0/start-line`
- `https://www.crunchyroll.com/ru/watch/G50UZW40Q/what-i-can-do-for-now`
- `https://www.crunchyroll.com/ru/watch/GMEE00351495ENUS/chainsaw-man--the-movie-reze-arc`
- `https://www.crunchyroll.com/ru/watch/GEVUZP0ZM/the-end-of-the-beginning-and-the-beginning-of-the-end`

### Real Player Object

The useful runtime control object is not exposed as `window.bitmovin.player.Player` on current
Crunchyroll pages. The public `window.bitmovin` object can exist but be empty. The working player
object is Crunchyroll's Katamari player behind React fiber:

- root candidates: `#player-container`, `.video-player-wrapper`, `[data-testid="player-controls-root"]`, `video`
- React keys: `__reactFiber*` / `__reactProps*`
- object path observed: React `stateNode.player._katamariPlayer`
- useful methods: `play`, `pause`, `seek`, `seekToStreamTime`, `seekToContentTime`,
  `seekToTimelineTime`, `setFullScreen`, `setPlaybackRate`

The current extension bridge should prefer:

1. `katamari.seekToStreamTime(target)` for seek.
2. `katamari.play()` / `katamari.pause()` for playback.
3. Captured Bitmovin API only as legacy fallback.
4. Timeline UI fallback only if Katamari/Bitmovin are unavailable.
5. Do not use raw `video.currentTime = target` as a Crunchyroll seek fallback; logs showed it can
   move the timestamp while leaving decoded picture/audio stuck on the old segment.

Observed Katamari seek states:

- seek is accepted while state is `playing`, `paused`, or `rebuffering`
- during media replacement/navigation states include `stopped` and `mediaLoading`; remote sync
  should not hammer seek/play while the player is in those transitional states

### Active Player vs Detail-Only Page

The same `/watch/...` URL can appear in two different states:

- active player mode: `video#bitmovinplayer-video-null` exists, controls exist, Katamari exists
- detail-only/watch page: `.video-player-wrapper` exists, episode metadata exists, but there is no
  `<video>` element and no `[data-testid="player-controls-root"]`

This happened on direct navigation to some `/watch/...` URLs. Clicking/continuing from the page can
create the active player and may navigate to a later "continue watching" episode. Therefore:

- Crunchyroll detection must be retry/observer-based, not a one-shot `querySelector("video")`.
- A `/watch/...` route without a video is not an adapter failure; it is a waiting state.
- Room join should connect independently of video readiness, then bind sync when the video appears.
- Overlay mounting should wait for `#player-container` / `.video-player-wrapper`, then update when
  the actual video and controls arrive.

### Next Episode Transition

Clicking `[data-testid="next-episode-button"]` on an active player uses SPA navigation. In the live
test from `GPWUKE590` to `G8WUNEWJE`, the sequence was:

| Time from click | Event |
| --- | --- |
| 16 ms | `history.replaceState` changes URL to the next `/watch/...` |
| 715 ms | old video emits `emptied`, `currentTime` becomes `0`, Katamari state `stopped` |
| 1079 ms | `loadstart`, new `blob:` `currentSrc`, Katamari state `mediaLoading` |
| 1494 ms | `loadedmetadata`, duration available |
| 1930 ms | `canplay` |
| 1935 ms | `play` / `playing`, Katamari state `playing` |

Important implications:

- URL changes before the real media changes.
- For roughly the first half-second after the URL changes, the old `video.currentSrc`,
  `currentTime`, duration, and player state can still describe the previous episode.
- Do not immediately publish a new room fingerprint from only the URL change unless the adapter has
  seen `emptied`/`loadstart`/`loadedmetadata` or a new `currentSrc`.
- Many same-series episodes have identical duration, so duration is not enough to detect a new
  episode.
- Use the Crunchyroll watch id from URL plus the media lifecycle (`emptied`, `loadstart`,
  `loadedmetadata`, changed `currentSrc`) as the practical remount signal.

### Remote Episode Transition

When the host changes episodes, the receiver should not use `location.assign()` as the first path.
That creates a full document reload, while Crunchyroll's own episode switch is a same-document SPA
transition. The current receiver flow is:

1. Host publishes a new `PlaybackState.sourceUrl` and `videoFingerprint`.
2. If the receiver detects a Crunchyroll fingerprint mismatch, it persists the room id in
   `sessionStorage` and asks the MAIN-world Crunchyroll bridge to run `navigate`.
3. The bridge first looks for an exact Crunchyroll `<a href>` matching the target `/watch/...`
   route and clicks it, so Crunchyroll's own router owns the transition.
4. If no exact route link is visible, the bridge tries `[data-testid="next-episode-button"]` and
   accepts that path only if the URL reaches the host's target route. This restores the working
   fullscreen next-episode behavior.
5. If the bridge does not reach the target, the receiver falls back to `location.assign()` to the
   host's exact `sourceUrl`. This still handles previous and arbitrary episode targets predictably.
6. A no-click router experiment was attempted by scanning React fiber for navigation objects and by
   nudging the History API. This caused bad intermediate `/watch/...` states and visible
   Crunchyroll 404 screens on some transitions, so it is not used in the working build.

Do not implement this as raw `history.pushState()`/`replaceState()` from the extension. Per the
History API, those calls only mutate the URL/history entry; they do not automatically fire
`popstate` or force Crunchyroll's React router to load the new episode. The safest extension-level
approach is to activate Crunchyroll's own link/button handlers from the page MAIN world.

### Hash Behavior

When a hash was added before clicking next episode:

```text
https://www.crunchyroll.com/ru/watch/G8WUNEWJE/roaring-muscles#probeHash=1
```

Crunchyroll replaced the URL with:

```text
https://www.crunchyroll.com/ru/watch/GZ7UVJXG0/start-line
```

The hash was dropped. For Anidachi this means:

- `#anidachiRoom=...` is useful only for the initial invite join.
- After join, the active room id must live in extension state/storage, not only in `location.hash`.
- On Crunchyroll episode transitions, do not require the hash to remain present.

### Reload and Back/Forward

Reload behavior depends on whether Crunchyroll is already in active player mode:

- Reloading an active player page recreated the video and preserved active playback mode.
- The new `blob:` `currentSrc` changed, but the route and episode remained the same.
- Browser back/forward between active player history entries also recreated active video playback.

Adapter requirements:

- Treat `currentSrc` changes on the same watch id as a media remount, not as a different room video.
- Rebind video listeners after reload, back, forward, and SPA transitions.
- Preserve Anidachi room connection across rebinds unless the watch id changes and the user chooses
  to leave/change room.

### Fullscreen

Crunchyroll fullscreen makes `#player-container.player-container` the `document.fullscreenElement`.
In the live test:

- before fullscreen: `document.fullscreenElement === null`
- after fullscreen: `document.fullscreenElement.id === "player-container"`
- video/container rect expanded to the viewport
- exiting fullscreen restored the same container

Overlay rules:

- Mount or relocate Anidachi overlay under `document.fullscreenElement` while fullscreen is active.
- For Crunchyroll, the ideal fullscreen parent is `#player-container`, not `document.body`.
- Use `pointer-events: none` on the overlay root and `pointer-events: auto` only on interactive
  Anidachi controls.

### Other Player Actions

- `katamari.setPlaybackRate(1.25)` updates `video.playbackRate` and emits `ratechange`.
- The room protocol already carries `playbackRate`; Crunchyroll adapter should read it from the
  video state and eventually apply it through Katamari if rate sync is enabled.
- Skip-intro UI was present as a button containing `[data-testid="skip-intro-icon"]` with
  `aria-label="Пропустить вступление"`. In the sampled moment, clicking it did not emit a seek; do
  not special-case skip intro yet. If it does seek in other episodes, normal `seeking`/`seeked`
  listeners should capture it.

## Observed Player Structure

Crunchyroll currently renders a Bitmovin-based player:

- Main container: `#player-container.player-container`
- Player surface: `.bitmovinplayer-container`
- Video element: `video#bitmovinplayer-video-null`
- Controls root: `[data-testid="player-controls-root"]`
- Play/pause: `[data-testid="play-pause-button"]`
- Fullscreen: `[data-testid="fullscreen-button"]`
- Timeline container: `[data-testid="timeline-controls-container"]`
- Timeline input: `input.timeline-slider[type="range"]`
- Jump controls: `[data-testid="jump-backward-button"]`, `[data-testid="jump-forward-button"]`
- Timestamp: `[data-testid="timestamp"]`

Older `vilos-*` selectors are kept only as fallback.

## Overlay Chrome Fitting

Anidachi treats Crunchyroll as a site-specific overlay target rather than a generic video box. The
overlay watches visible player controls inside `#player-container` and adapts its own chrome:

- Ghost Cam bubbles use a dynamic `bottom` offset. When the Crunchyroll timeline/control bar is
  visible, bubbles move above it; when the player UI fades out, bubbles return to the lower-right
  ambient position.
- Reaction popups reuse the same dynamic bottom offset so reactions still originate from the active
  avatar position.
- The Anidachi room/menu bubble reads the visible top-right Crunchyroll controls and positions
  itself in the same row. The extension reserves the far-right slot for Anidachi by shifting the
  Crunchyroll settings variants (`settings-button` / `player-settings-menu-button`) and fullscreen
  controls left, so the Anidachi bubble becomes the last item after fullscreen instead of floating
  over the controls.
- The opened mini-panel is height-limited against the reserved Ghost Cam lane, so it scrolls inside
  itself instead of covering the avatar.
- The detector ignores full-player control roots so a persistent invisible/transparent controls
  container does not keep the Ghost Cam permanently raised.

## Playback Control Decision

The first control choice is now Crunchyroll's Katamari player object found from React fiber in the
page's MAIN world. The earlier Bitmovin capture path is only a legacy fallback: current live pages
can have `window.bitmovin` present but not expose a usable `bitmovin.player.Player` constructor.

The fallback path still runs in the MAIN world:

1. Clamp the target to `[0, duration - 0.25]`.
2. Try `katamari.seekToStreamTime(target)`.
3. If Katamari is unavailable, try captured `bitmovin.player.Player#seek(target, "anidachi")`.
4. If Bitmovin is unavailable or rejects the seek, set the native Crunchyroll timeline range value
   and dispatch `input`/`change` so Crunchyroll's own player state handles the seek.
5. If no player-level path applies the seek, report failure with a post-seek `video` snapshot.

Do not use `video.fastSeek()` or direct `video.currentTime = target` as a Crunchyroll fallback.
Those paths caused the worst observed failure mode: the timestamp moved while Crunchyroll's player
did not fetch/decode the new DRM/MSE segment, leaving picture/audio frozen.

The earlier range-input attempt was not enough because it only assigned `input.value`. The bridge
uses the native `HTMLInputElement.value` setter and dispatches bubbling/composed `input/change`
events, then waits briefly to see whether the Crunchyroll player actually moved the media. If it
does not move, the current Crunchyroll adapter reports the failure and does not apply a raw media
seek fallback.

Logs from `mac7.json`/`77.txt` showed a second failure mode: the receiver's `video.currentTime` did move to the target, but Crunchyroll stayed in `seeking=true`, `readyState=1`, and the old buffer range. The extension then sent repeated `play()` calls while the player was still fetching the new segment, which left playback stuck. Remote resume now waits for media readiness on Crunchyroll and uses a longer readiness timeout; if the player is still settling after the timeout, it skips that play attempt instead of hammering the player.

Logs from `mac8.json`/`88.txt` showed a third failure mode on the sender side. One user gesture in Crunchyroll can emit a burst like `PAUSE -> SEEK -> PLAY -> HOST_STATE` within a few milliseconds, and sometimes the `PLAY` event is just Crunchyroll's internal seek/resume state rather than an explicit user action. Sending every raw media event to the room made the receiver process conflicting commands while it was still loading the seek target.

Crunchyroll local events are now coalesced:

1. Local `seek` events are queued briefly instead of broadcast immediately.
2. Duplicate `seeking/seeked` events for the same target are collapsed.
3. Local `play/pause` events that happen while the seek is pending or while media is settling are not broadcast as separate room commands.
4. The extension sends one `SEEK` plus one authoritative `HOST_STATE` with the final local `playing`/`paused` value after the short settle window.

This makes "seek while playing", "pause then seek", and "seek then resume" behave like one ordered control transaction instead of several racing commands.

Logs from `mac9.json`/`99.txt` showed that coalescing was active, but the PC receiver still froze
after raw media seeks. The failing signature was: `currentTime` moved to the remote target while
`buffered` stayed on the old playback range, so Crunchyroll never fetched the new segment. This is
why the timeline input is now back as the first fallback after Bitmovin capture: the extension needs
to notify Crunchyroll's player layer, not only mutate the `HTMLVideoElement`.

The receiver also guards pending Crunchyroll remote seeks. While a remote seek is still fresh or the
media is still settling, moving host-state updates are held instead of repeatedly seeking to the
host's advancing clock. If the room is playing, playback is kicked after the seek has actually
started so the player can fetch the target segment.

Repeated remote seeks are throttled for Crunchyroll. A manual seek emits both an explicit `SEEK` event and a following `HOST_STATE`; applying both immediately caused duplicate seek attempts. The receiver now ignores near-identical Crunchyroll remote seek targets for a short window and exposes catch-up state instead of hammering the player.

## Room Control Model

The room still assigns the first participant as `host` for display and periodic state broadcast, but explicit user controls are no longer host-only:

- Any joined participant may send `PLAY`, `PAUSE`, and `SEEK`.
- The Worker validates that `byUserId` matches the WebSocket participant.
- Remote playback events are suppressed locally for a short window after applying an incoming command to avoid echo loops.

This gives the expected watch-party behavior: either side can pause, resume, or seek.
