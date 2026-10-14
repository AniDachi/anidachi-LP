# Player onboarding: short local practice tour

Status: owner-approved staging integration candidate, October 14, 2026. The
owner accepted the final local design and rolling-logo completion, then authorized
selective delivery through a PR to staging. Earlier local-only sections below
record the design history; this approval supersedes their staging restriction.
Production/main promotion and Store publication remain outside this task.

The accepted scenario is an imitation of room creation using the existing
extension interface, not a real account/room setup flow. The integration starts
from staging `7140b9d4`, retaining its request-cost fixes, cardless hosting notices,
matte drawer/defaults and transient room-end button feedback. Only the teaching
components, keyboard guard, background claim and their OverlayApp wiring are
imported from the design checkout. Existing source/debug/auth/history/room handlers
are preserved. The local design checkout and preview remain separate.

The staging candidate keeps all three production exclusions: OverlayApp does not
mount the tour, content does not install its keyboard guard, and background rejects
its claim in a production build. A later production release must explicitly decide
activation at those three guards. Staging delivery does not activate production.

Before merge: extension typecheck/tests, scoped lint, quality preflight, independent
review and narrow staging build/validation. After merge: freeze the exact CI ZIP,
validate its staging ID/endpoints and hand it to the owner for loaded-browser
acceptance on supported players. Local preview evidence includes normal/compact
rolling wipes and reduced-motion fade, but does not establish MV3 provider
acceptance. Rollback is the preceding staging extension artifact; no server state,
permissions, env, schema or price changes are introduced.

## Accepted scenario

1. Let the first eligible personal video load for two seconds, then pause it.
   Welcome to AniDachi and the launcher spotlight share the first screen.
   The nearby hint says "You can hide the capsule" and shows
   Settings > Interface > Auto hide. Clicking the launcher opens the full practice drawer.
2. Highlight Create room. Explain that Plus or Pro lets you create rooms and
   friends join free. Clicking Create room creates only in-memory tutorial state.
3. Highlight both Copy invite and Invite friends and groups on one screen.
   Two short explanations repeat their button icons: share a copied link
   anywhere, or first add friends in the website account's Friends & Groups
   section and then invite them from the player. Either practice button continues
   to the chat rehearsal without a clipboard write or real invitation.
4. Close the practice drawer and immediately show and focus the familiar chat
   composer. Explain "Press Enter to open chat while watching."
   Prefill "Hey, watch buddy! 🍿" as an editable practice
   message and point a warm sketched arrow labelled "Click Send!" directly at Send.
   There is no separate
   Next: camera button on this screen; the footer retains only Skip tour.
   Typing and emoji selection remain optional, with the
   existing 140-character limit. Clicking Send or pressing Enter advances
   directly to the camera step even with an empty field; no message is sent or
   displayed and there is no extra confirmation step. The close button or Escape
   discards the draft and focuses Open chat again, so Enter can reopen the input.
   The existing
   whole-tour Escape behavior applies outside the composer.
5. Reopen the full drawer and highlight the paired camera/microphone controls
   beside the name. A compact icon legend explains Hold V to talk (yellow mic),
   Microphone always on (green mic), Camera on (green camera) and Camera off
   (gray crossed-out camera), using the same solid icons as the real controls.
   The subtitle says "Talk with friends while you watch." The hand-drawn cue
   explains that clicking either button continues. The curved pointer approaches the pair from the upper left
   and ends beside its left edge, clear of the capsule above it.
   Clicking either control or activating it with Enter/Space changes only its
   disposable demo state and immediately advances to settings, focusing the
   selected tab. There is no separate Next: settings button; the footer retains
   Skip tour. Real camera and microphone capture remain disabled; the redundant
   practice disclaimer is omitted from this screen.
6. The final screen says "Make it yours." with the subtitle "Your reactions,
   your layout, your preferences." A thin peach freehand frame contains four
   icon-led descriptions: Reactions ("Pick emojis for quick reactions."), Layout
   ("Arrange chat and cameras."), Interface ("Show or auto-hide controls.") and
   Room ("Choose your mic & camera defaults."). "Explore the settings" points
   to a capsule-shaped highlight around the drawer's four-tab rail.
   Users can switch tabs and try disposable controls in any order. A single ivory
   Let’s watch button starts a 1.2-second left-to-right wipe: a large existing
   AniDachi logo rolls across the player, erasing the practice scene behind it.
   Its rotation follows its travel distance and diameter. The underlying video
   is revealed progressively; after completion every practice element is removed
   and only the same foreground video resumes if it was originally playing.
   Reduced motion uses a short 160ms fade without the rolling logo. There is no note below the
   button and no duplicate Back to video/Skip tour action on this step. Numbered
   progress remains. The target stays visible when the player changes size;
   ordinary scrolling within the drawer remains unrestricted.

The owner-approved October 14 cleanup removes the small eyebrow labels from
steps 1–5 and the extra bottom practice notes from steps 2–5. Main descriptions,
button-state legends, arrow captions and progress remain.

The panel says Practice mode, uses a generic You identity and shows the current
video through CurrentResourcePanel. Signed-in and signed-out viewers get the
same practice scenario, with account-aware plan copy. PanelAccountTitle,
AnidachiLogoMark and PanelMediaControls reuse shared presentation; inactive non-step controls do not invoke product handlers.
Normal overlay controls are hidden while this isolated teaching UI is active.
No room creation, auth, invite, checkout, clipboard, media-capture or WebSocket
callback is supplied to the tutorial. Existing live handlers are unchanged.
The plans link is the one explicit external action described below.

The approved full-drawer iteration includes all five existing settings sections
(Reactions, Layout, Interface, Voice, Room) before creation, then the existing
People section and room controls after simulated creation. Settings use the
canonical presentation components with disposable in-memory values; they do not
read or write account preferences. The camera/microphone pair is interactive only on its teaching screen and only
changes in-memory presentation. The microphone mode shares one local value with
the existing Voice settings view; neither direction writes preferences. It does
not simulate microphone capture or voice transmission while V is held. Participant
management and other non-step room actions remain inert. The drawer stays readable and
scrollable, with surrounding controls gently dimmed and only the highlighted
target kept fully bright. Visual masks allow pointer events through so the
disposable settings remain explorable. Create room retains its target ring and both invitation buttons
share one glowing outline around both buttons, excluding Sync now. Keyboard
focus distinguishes the selected invitation button with a fill, keeping one
outer ring. Scrolling keeps highlights clipped to the drawer;
creating the practice room restores it to the top so both invitation actions
are visible. The practice chat fades in without the live composer's entrance
translation, keeping its spotlight aligned with the input throughout the transition.
The owner approved chat and camera explanations before the settings overview,
making six short screens in total. On the final screen, invitation actions lose their highlight
and are inactive; focus moves to the selected settings tab. Settings exploration
does not save preferences or request media permissions.

The owner-approved second screen offers Try 3 days free to signed-out viewers
and signed-in viewers with confirmed trial eligibility. Signed-in viewers with
used, unavailable or not-yet-confirmed eligibility see View plans. Accounts with
Plus/Pro or current hosting access see "Your plan includes room creation" and
no upsell. Account-scoped hosting display data comes from the existing shared
useHostingAccess hook, enabled while the tour is active; it does not grant access
or alter a subscription. The link opens the channel's /pricing page in a new tab
only on explicit click. Actual checkout retains authoritative eligibility checks.
Practice Create room is still available without visiting plans or paying.
Actual camera/microphone capture and a real sign-in/create-room tutorial remain outside the teaching flow. The separately approved live drawer change is described below.
The chat rehearsal is isolated presentation with no transport callbacks.

## Lifecycle

- The background serializes an installation-wide first-display claim using
  `chrome.storage.local` key `anidachi.playerIntroductionSeen.v3`. The boolean is
  consumed at first display, including Skip/interruption. V3 lets testers who
  saw the rejected earlier drafts review the approved practice scenario.
- Wait for identity/session restoration, foreground visibility, a ready content
  video, and a player at least 600px wide and 340px high. Do not begin over an
  existing/restored room, invitation/resume intent, open panel, pending creation,
  ad or invalidated extension context. Recheck eligibility after the claim.
- Before claiming the first display, allow two seconds of ready content so the
  backdrop has a rendered video frame. Playing video must have future frame data;
  an already-paused video with a current frame stays paused. Buffering, seeking,
  source changes or lost eligibility restart the wait. Unmount cancels it without
  consuming the tour or changing playback.
- Escape, Skip tour and close dismiss. Contain keyboard navigation and the final
  dismissal keyup so they do not trigger player shortcuts. Chrome can consume
  fullscreen Escape itself; the visible close button remains available.
- The final wipe makes practice controls inert and moves focus out of them.
  Repeated clicks/Enter cannot restart it; Escape can dismiss it immediately.
  Animation completion has a bounded timeout fallback. Source change, pagehide,
  a real room or unmount cleans up the transition along with the existing
  playback ownership rules. Enabling reduced motion during the wipe ends it.
  The wipe clips the local teaching layer; it does not read or process video
  pixels, add network calls or change provider adapters.
- The composer registers its input with the early tutorial keyboard guard so
  native typing, selection, paste and IME work inside the extension's closed
  shadow root. Player key handlers still receive none of these events. Enter,
  Escape and Tab remain handled by the tour; repeated/composing Enter never sends.
  Unmounting the composer releases the input reference and drops its draft.
- Switching tabs, including opening the pricing offer, preserves the current
  practice step and message draft while video stays paused. Returning to the
  player continues that same tour without another claim or automatic playback.
  Foreground visibility is still required before the first display and before
  resuming video after dismissal. Source change, pagehide, or a real room taking
  over closes the practice without resuming video, including while backgrounded.
  Unmount removes timers, subscriptions and keyboard state. Storage failure
  leaves the player untouched.
- Production packages do not mount this component/install its keyboard guard;
  their background rejects its claim. Channel permissions, dependencies,
  protocol, auth, billing, room sync and media implementations are unchanged.
- Existing popup welcome/history acknowledgement and recording rules are unchanged.

## Review and verification

The current owner-selected visual direction is the third generated concept,
Cinematic Type: deeply dimmed video, large left-aligned cream headings with one
orange word, hand-drawn directional cues beside the targets, and numbered progress with
Skip tour at the lower left on the first five screens. The final screen uses
the owner-selected freehand settings frame and a separate ivory Let’s watch
button; its footer contains progress only. The video backdrop is darkened to 86% with
the existing outer mask, and every target uses the same warm, softly glowing
outline without pulse animation. Invitation methods share one measured target
and outline, while either button still advances the same local flow.
The real practice panel keeps its existing components.
All teaching arrows share TourSketchCue: warm, rounded freehand strokes and
short handwriting-style labels (Start here, Click to create, Try either one,
Click Send, Click either to continue, Explore the settings). The chat cue stays anchored to Send;
the invitation cue approaches from above, and the camera cue reaches the left
edge of the pair without crossing the capsule.
The launcher hiding hint has its own spacing below the annotation. Cue artwork
is decorative and does not change control names, focus, hit targets or actions.
Fonts use local system handwriting faces with a cursive fallback, with no remote
font requests or new bundled assets. Native control/navigation icons stay native.
Compact players reduce text and the directional cue to preserve the controls.
The earlier second design is retained in Git history; its curved raster arrow is
no longer bundled. No new assets or host permissions are added. The two-second
video warmup and installation claim remain unchanged. Room rehearsal stays local;
the existing hosting display read and explicit plans navigation are the only
account/network interactions introduced for offer presentation. The existing v3
reset is still needed to repeat a previously seen tour. Copy layout reserves
space above the progress footer on both large and compact players.

The local page on port 3017 now imports the same PlayerOnboarding component and
canonical overlay styles; it no longer renders the rejected invented toolbar.
The page only supplies a demo video/adapter and always-allowed local claim, with
Replay tour for iteration. This is component visual evidence, not proof of a
loaded extension on YouTube/Crunchyroll/Netflix.

Required checks: extension TypeScript, extension test suite, focused lint,
`pnpm dev:check`, staging-channel build and artifact validation. Tests exercise
local-only room progression, no room/auth/clipboard actions, offer eligibility,
plans link and keyboard activation, cleanup, playback ownership, race handling,
keyboard dismissal, tab-return state preservation, hidden-source/room takeover,
foreground-only startup and one-time storage arbitration. Browser review covers all
short steps and return to video.
Loaded-extension acceptance remains pending the owner's Reload/manual review.
The preceding three-screen iteration passed 2232 extension tests. Component browser review
at 1280x720 and 600x340 covered the launcher hint, plan CTA, full drawer,
simulated create/copy, footer spacing and playback restoration with no console
errors. The two-invitation follow-up keeps the same flow and adds both-button
progression coverage without real clipboard/network calls. The settings follow-up
adds a freely explorable final overview and explicit Back to video completion;
its focused test covers all five tabs and keeps playback paused while exploring.
The earlier full-drawer review also covered settings navigation, a
keyboard-adjusted layout slider without resuming video and drawer scrolling.
The simplified chat step checks immediate display/focus, keyboard/button
continuation with empty or filled input, cancellation with text,
repeated/composing Enter, closed-shadow editing isolation, no message transport,
cleanup and direct progression to the camera explanation and settings. Browser
review covers the prefilled composer, the arrow pointing to Send, one-click
continuation without a duplicate Next button, and compact-player composer/copy
separation. Camera and microphone toggles remain keyboard/mouse demos without capture.
The paired-controls follow-up passed the extension typecheck and all 2250 tests,
including bidirectional mode consistency with Voice settings, keyboard toggling,
independent camera state and absence of capture/network calls. Colors supplement
icons, accessible state and titles. Press motion affects only the inner cap;
reduced-motion preferences disable transitions. At that practice-only checkpoint, live room controls and production
remained unchanged; no media implementation or protocol was changed.
The October 14 step-five follow-up tests both buttons with click, Enter and
Space: each advances directly to settings, focuses its selected tab, preserves
independent disposable media state and makes no capture/network request.
No room/P2P harness is required for this isolated presentation-only rehearsal;
no room, signaling, capture or synchronization handlers were changed.

## Live drawer controls: approved local follow-up

The owner subsequently authorized the same paired controls in the ordinary room
drawer, connected to real camera and microphone actions. This remains a local
source/unpacked-build change: no remote push, staging deployment, main promotion
or Store publication. Controls appear after creating or joining a room, in the
existing header position. Microphone is left and camera is right.

PanelMediaControls and its styles are shared by both views. The tour still passes
only disposable callbacks and never captures media. The ordinary OverlayApp passes
its existing handleGhostCamToggle and handleVoiceModeChange callbacks, current
camera intent and voiceSession mode. Voice settings and the header share that same
state, existing account-scoped Last used persistence and room lifecycle; there is
no second state store or media implementation.

- Microphone alternates yellow Hold V and green Always on. Returning to V stops
  continuous publication through the existing reducer/controller path. The V key
  behavior itself is unchanged.
- Camera is gray when off and green when enabled, independent of microphone mode.
- Media-seat restrictions and camera capacity remain authoritative. A full camera
  allocation disables only the camera. Microphone enable is unavailable without
  an active media session/seat, while an already selected Open mic can be stopped.
- Existing server ACKs, device permission/error handling, revocation, reconnect,
  account-switch and room-end cleanup remain in charge. Header feedback exposes
  existing microphone errors even while Voice settings are not selected. The mic
  dot is subdued while off/connecting and shows error state from the controller;
  the yellow/green ring and descriptive hover/accessibility labels identify the
  selected mode. The owner-approved compact version uses a centered microphone
  icon without V/infinity marks. The housing has equal 3px padding around 30px
  buttons and extends 3px above/below the original 32px header row, preserving
  the header height.
- The fixed ring, independently depressed cap, dots, keyboard focus and reduced
  motion support carry over to the live drawer. Both buttons have native disabled
  states and explanatory titles. No permissions, dependencies, web/API or protocol
  contracts change.

Verification: focused component/real OverlayApp wiring tests cover both v2 and v3
intent/ACK behavior, immediate Open mic stop, independent camera toggling,
header/Voice consistency, persistence, camera-cap independence and seat revoke /
regrant without automatic restart. The room harness passed 39/39 and existing
same-machine fake-device WebRTC harness passed 26/26. These prove local wiring and
media regression behavior, not physical-camera, remote-network or loaded MV3
acceptance. The owner must Reload the updated unpacked folder, refresh a supported
video and test the ordinary drawer in a room. Tour reset is unnecessary for the
live controls. Extension typecheck and all 2255 tests pass. Local build and artifact validation
are required before handoff. Rollback is the preceding local artifact; server state is unchanged.

## Matte drawer: approved local design follow-up

The owner selected the dark matte-glass reference and authorized its transfer to
both the real extension drawer and the shared practice drawer, locally only.
This follow-up supersedes the earlier shared button housing and five-tab settings
presentation. No push, deployment, main promotion or Store release is authorized.

- Keep the existing drawer width and compact header. Use tinted near-black glass
  with background blur and no outer border. Microphone and camera retain their
  separate rings, pressable caps, colors and dots, without the enclosing capsule.
- Current resource is secondary and unboxed: existing provider logo, clock and
  percentage, title/episode and a slim progress bar. Remove its visible section
  heading and provider chevron. This does not add seeking behavior.
- People, room occupancy and compact media/camera counters share one heading.
  Counts and limits still come from room snapshots. Participant rows drop the
  redundant normal-state Media seat text and show an icon with Camera on/off,
  Speaking or Listening. Grant/revoke actions, waiting, error, reconnect,
  capacity and scheduled-close notices remain available.
- Preserve existing Settings controls, underline tabs and layout; change only
  typography and remove Voice from the navigation and tutorial overview.
  Microphone mode uses the existing header control and persistence. Room join
  defaults remain under Room. Remove no capture or signaling handlers.
- Bundle the unmodified official Inter 4.1 variable font with its SIL license.
  A document-scoped FontFace loads bundled bytes for the shadow-root drawer,
  with a system fallback; there is no font CDN or new permission. Reuse the
  existing provider logo component for both history and current resource.

Verification: extension TypeScript and all 2255 tests pass. Existing media wiring
checks now exercise the header switch instead of the removed Voice tab, retaining
intent/ACK, persistence, revocation and stop coverage. Browser component review
confirms the bundled Inter face loads, the 324px drawer keeps its 32px header
content row, settings navigation is preserved and camera/microphone states remain
independent. This is component evidence, not loaded-extension/device acceptance.
The ordinary unpacked folder must be rebuilt and validated, then the owner can
Reload and refresh a video to review the real drawer. Room/P2P handlers, protocol,
permissions, backend and production are unchanged; no new media harness run is
required for this presentation-only follow-up. Rollback is the preceding local
source/artifact.

## Drawer cleanup: approved local follow-up

The owner approved removing Sign out from the player drawer and practice tour.
Remove its drawer-only confirmation state and handler; retain the underlying
background authentication/logout services and other account surfaces unchanged.
The resource keeps its top divider, without a line beneath its timeline. Settings
uses one flat gray lower surface flush with both side edges and the bottom of the
drawer, without an inset rounded card. Tabs, settings controls and live media
behavior remain unchanged. This is local-only, with no push or deployment.

## Local installation and reset

### Opaque matte material (October 11 accepted local follow-up)

The owner selected the dense matte surface shown in the local appearance preview,
explicitly choosing it over the translucent experiment. The shared real/practice
drawer uses an opaque dark graphite base, an opaque graphite gradient and the existing
bundled 64px grain tile (1.6 KB, inlined into CSS). Remove the `@supports` override
that enabled 74%-opaque native backdrop blur. The drawer material is independent
of the provider's video compositing and does not require access to video pixels.
Settings and the media corner retain their matching lighter surface; dimensions,
typography and controls are unchanged. The later generated texture concepts were
not selected and are not included. A later local polish slightly darkens the
drawer and brightens the push-to-talk microphone's yellow icon, rim and indicator
without increasing their glow or changing the green always-on mode.

The preceding blur exploration is superseded. The owner confirmed blur on YouTube
but reported transparency without blur on Crunchyroll. Earlier screenshot-based
observations did not establish working Crunchyroll blur in the real window and
must not be treated as acceptance. The appearance screenshot looked dense against
its dark scene, but computed-style inspection also found the translucent override
in that preview. This follow-up makes both source and rebuilt local artifacts
explicitly opaque, matching the selected appearance independently of the scene.
Loaded-extension acceptance remains separate from component and build checks.

The previous YouTube-only player filter/attribute stays removed. No playback,
capture, media intent, auth, permissions or server behavior changes. Rebuild and
validate the existing local staging artifact without pushing or deploying.

Build with `pnpm build:extension:staging`, validate with
`pnpm validate:extension:staging`, then reload the existing AniDachi Staging from
`anidachi-extension-staging` in Chrome and fully refresh the video page.

To repeat only this tutorial, run in the **AniDachi Staging service worker**
inspector and then reload the video (do not clear all storage):

```js
await chrome.storage.local.remove('anidachi.playerIntroductionSeen.v3')
```

Rollback: reload the preceding staging artifact. The additional local boolean
is inert there; no server or account rollback is needed.


## Final settings screen: October 14 local visual iteration

The owner approved generated concept three, then removed the note beneath the
finish button and made the drawer-tab highlight a capsule. The implementation
uses the established freehand annotation style and bundled Lucide icons.
Only the tutorial presentation and its existing finish action are affected.
No capture, preference writes, room contracts, permissions or release changes.
The owner asked to iterate locally without rebuilding the installed extension
on each design change: this checkpoint refreshes only the component preview on
port 3017. Staging artifact build/validation and loaded-extension acceptance are
deferred until the separately requested packaging step.
