# Intermediate overlay design on staging

Parent: [Daily Free20 transition](2026-10-30-daily-free20-transition.md), block 6.

## Authorized scope

The owner requested transfer of the accepted local prototype into the real
staging extension, with a stable unpacked folder for continued iteration.
This is an intermediate design, not final Free20 acceptance. Conditional
permission to activate Free20 applies only when the whole system is ready;
live time events, trial transition, purchase delivery and enabled acceptance
remain unfinished, so this change does not activate it.

That boundary describes the initial November 1 design delivery. Subsequent live
time wiring and controlled staging activation are tracked in the
[readiness plan](2026-11-01-free20-staging-readiness.md). The November 2 correction
below uses those existing live time observations and does not change activation.

## Task 1: Preserve real action outcomes

- Keep camera/microphone controls and room/invite/people/settings behavior.
- Avatar opens the channel account page. View plans opens the channel `/pricing`
  page, including the low-time warning and exhausted-limit action. The header
  link is shown only when the server confirms the current account's Free plan;
  hide it for Plus, Pro and an unknown plan (owner correction, November 2).
- Copy uses the current room invitation and shows microphone-style feedback only
  after clipboard success. Scope late results to the room/login/connection.
- Rotate only the sync icon. Report `Sync sent` only when the existing controller
  sends HOST_STATE on an open socket; queued/dropped/no-op is not success.
- Verify failed copy, stale operation, disconnected/non-host sync and repeated
  clicks with focused extension tests.

## Task 2: Transfer timer/action presentation

- Use the accepted 28px tabular timer, 20px icon, 4px gap and 14px action text.
- Finite time before a room stays left of Create; active host time is inside End,
  with hover/focus/confirmation revealing the action. Keep native media dock.
- Use only the existing legacy quota authority where that mode is actually
  enabled. No invented 1200-second value, no new account polling, and no use of
  the account display API as a substitute for future live Free20 events.
- No timer for unknown/unlimited/guest access; preserve existing access paywalls.
- Move the timer when real creation succeeds, respecting reduced motion and
  cleaning animation on failure, room change or unmount.
- Check owner/session changes, expiry/reset and unknown states; inspect real
  component rendering in the local preview and the built staging artifact.

## Task 3: Deliver and record

- Run extension check/test, pnpm dev:check, narrow staging build/validation.
- Update current state and the knowledge graph using the repository adapter.
- Fresh whole-branch review, PR into staging, successful required CI, merge.
- Rebuild from the accepted staging commit and update the same unpacked directory.
- Record artifact identity, visual evidence and limits of browser acceptance.
- Do not promote main, publish a Store version or change server gates.

## Review focus

Look for async feedback crossing sessions, false successful sync, unknown quota
rendered as zero, guests consuming/displaying the wrong account time, duplicated
quota fetches, hidden confirmation actions, shifted media controls and cleanup
of animation/feedback after closing the panel or changing the room.

## Rollback

Revert this UI commit on staging and rebuild the narrow staging artifact. No
server schema, accounting, commercial switches or production artifacts change.

## November 2: Room-start timer motion correction

The owner approved the local component rehearsal and requested delivery through
a staging PR into the same unpacked extension folder for real-room inspection.
The separate counter-flight mechanism below was superseded by the continuous
counter correction at the end of this document after real-extension feedback.

- Room readiness and the first valid `HOSTING_TIME` can arrive in separate
  renders. Start the button transition when the room is ready, then move the
  first fresh finite counter into End without replaying the button transition.
- Reserve the idle action geometry during admission without retaining expired
  digits. Keep the button height, width and baseline; fade the original orange
  surface and Create label into the red End state using the accepted easing.
- A pending time observation is distinct from confirmed unlimited access. Never
  animate the old account number as if it were current room authority; update
  in-flight digits from current props and retire them immediately on unknown
  access, source/connection change, confirmation, cancellation or unmount.
- Respect reduced motion. Native hover and keyboard focus reveal End; end
  confirmation must be visible immediately even during the transition.
- Preserve camera/microphone placement, existing media controls, room actions,
  accounting, capacity, shared contracts and server flags.

The local rehearsal renders source components and CSS with simulated replies.
It covers simultaneous/delayed/changed/unknown/unlimited/failed responses,
multiple preview scales, hover/end, reduced motion and quota exhaustion. This is
not a loaded-extension or live-room acceptance result. Exact suite counts,
independent review, CI, staging artifact identity, backup and folder verification
belong in the delivery PR/receipt. The owner checks the updated extension after
Chrome Reload; main, production and Store remain a separate decision.

## November 2: Whole-panel lifecycle correction

The owner's subsequent real-extension feedback requires checking the complete
panel lifecycle, including delayed account data and reopening, rather than only
the isolated action row. This correction is confined to extension presentation
and display-data lifecycle; room admission, accounting and server flags retain
their existing authority.

- Prefetch the account observation for an active player after identity is known.
  Opening/closing the panel does not discard a still-fresh observation. Plan and
  idle Free20 time come from that same response; legacy hosting reads remain for
  explicitly legacy policy and the existing paywall.
- Preserve original monotonic/wall-clock anchors and validity/UTC boundaries.
  Keep bounded expiry recovery, with an additional stale-only read on reopening;
  no polling loop or persistent account cache is introduced. A room-boundary
  epoch fences idle seconds even for a pending `idle -> room -> idle` round trip.
  Credential changes and authoritative admission denial retire affected reads.
  Fresh plan metadata may survive the room read; account seconds never fill live
  `HOSTING_TIME`, and unavailable data never becomes a fabricated allowance.
- Reserve header and timer slots while data is unavailable. Use quiet neutral
  placeholders instead of temporary account/status words. Keep the action row
  baseline and height fixed; interpolate paid/unlimited width changes. Reveal
  participants within a smoothly growing section, preserving all media controls.
- Own pending creation above the conditional panel mount. Closing/reopening
  cannot flash Leave or produce invalid digits. Keep the existing bounded escape
  after connection failure/timeout. Animate the button once on readiness. The
  continuous-counter correction below replaces the separate delayed counter
  flight. Pending and unlimited states retain a visible
  clock or action during the transition; reduced motion remains immediate.

Verification includes the complete source `OverlayApp` and styles in isolated
Chromium with explicit background/HTTP/transport fixtures, covering cold/warm
open, delayed identity/time, paid/unknown access, pending reopen, failure, hover
and reduced motion. This is component-level browser evidence, not an authenticated
staging room or two-participant acceptance. The delivery PR records regression
results, review and exact staging artifact; the owner reloads that artifact in
the existing test folder for the next real-room visual pass.

## November 2: Continuous counter and negotiated media presentation

The owner still observed a missing timer during creation and a temporary media
seats line under the account name. A full-component replay with the actual HTTP
payload shape reproduced both: legacy `capabilities` and modern
`mediaCapabilities` coexist in create/connect responses, but the extension read
only the former. The earlier fixture had incorrectly normalized that response
before exercising its parser.

- Keep one counter DOM element from idle through admission and the move into
  End. Move that element with the button once membership is ready; update its
  text in place when live time arrives. No counter clone, second flight, changing
  Create label, intermediate success label, or vertical shift is required.
- Capture the last fresh account number only for this visual handoff. It stays
  still, never starts metering, never becomes a live-clock snapshot or admission
  grant, and expires at the earliest of its original validity, UTC reset, or
  eight seconds after the click. Bind it to the logical login and admitted room.
  Accepted live observations, including unknown/unlimited, supersede it. Hidden
  pages, wall-clock discontinuity, failure, transport restart and room/source
  generation changes retire it. Closing the panel alone preserves the bounded
  handoff; it does not extend its deadline.
- Read the existing schema-validated negotiated media metadata from HTTP create
  and connect. Keep the legacy fallback for old/malformed responses. This only
  selects the correct media protocol presentation early: actual media readiness,
  seats, capture and defaults still require accepted WebSocket state and grants.
  Reveal modern participant details after both membership and media state are
  ready, avoiding provisional legacy controls. Keep native camera/microphone
  controls in place.
- Keep unknown/unlimited states honest and preserve hover, keyboard focus, end
  confirmation, cancellation and reduced-motion behavior. Slow or failed
  admission never becomes a successful room solely because an animation ran.

Verification must use the real HTTP parser with both capability fields, the full
OverlayApp and its real styles, plus delayed/changed/unknown/paid replies,
reopening, failure, expiry and reduced motion. Source browser simulation is
separate from loaded-extension acceptance. Extension checks/tests, room harness,
versioned-media WebRTC harness, narrow staging artifact validation, independent
review and normal PR/CI delivery precede updating the owner's existing folder.
No schema, server policy, activation flags, main, production or Store change.

## November 2: Account-status recovery and room settlement

The owner reported long-lived plan and time placeholders, especially after
closing a room. Source tracing confirmed that the Worker's terminal socket event
precedes usage settlement and the web finalization callback. The overlay returned
to idle and immediately read the account while that operation could still be in
progress. A temporary failure erased even fresh plan metadata and had no automatic
recovery. A short visibility interruption also imposed the ordinary five-second
refresh cooldown despite having discarded the previous observation.

- Retain an already confirmed display observation through a transient read
  failure, with its original owner/credentials, monotonic/wall anchors, TTL and
  UTC reset. The room epoch still fences pre-room seconds; this is not an
  authorization cache or a source for live room time.
- Recover a quick failed read with at most two retries, after 500 and 1500 ms.
  Validate each reply afresh without extending observation validity, and never
  start another attempt after a five-second recovery window. Successful recovery
  does not start polling.
  Owner/session/room changes, suspension and unmount cancel queued recovery.
- Successful end HTTP completion supersedes an earlier pending account read
  immediately, scoped to the same logical login and room. A late completion
  cannot clear a newer room/login. Local detachment is not proof of room closure:
  a fresh account response may still describe its active room in another tab.
- A resume after visibility loss requests fresh data immediately. A final read
  error exposes a compact retry in the existing timer slot and stops showing a
  plan-loading skeleton. Explicit retry is immediate; unknown time never becomes
  zero, unlimited access or a locally restored budget.

Verification uses hook regressions plus the complete source OverlayApp, real
account-status message handler and response validation in isolated Chromium.
Fixtures reproduce terminal-event-before-settlement, a slow settlement, first
read failure, paid access, full outage and short visibility loss. This is source
browser evidence, not an authenticated staging account timing measurement or
loaded-extension acceptance. Extension checks/tests, narrow artifact validation,
independent review and staging PR/CI delivery are required before updating the
same owner extension folder. There is no backend, protocol, permission, policy,
main, production or Store change; rollback is an extension commit revert/rebuild.

## November 2: Closing presentation waits for ready account time

The owner chose to keep a red `Closing room` action until end completion and a
fresh account read, then animate directly to `Create room` with the ready timer.
This supersedes any proposal to hold the old live-room digits in the idle slot.

- Actual room termination and media shutdown remain immediate. A separate,
  login/room-scoped presentation holds only the disabled red action, without
  actionable room controls, old timer values or a skeleton strip.
- The post-terminal room epoch and post-HTTP settlement revision must each have
  a completed account read. An earlier response/error cannot release this view.
  Confirmed unlimited access has no finite timer; exhaustion keeps its existing
  terminal screen. Failure offers the existing retry. The presentation is capped
  at twelve seconds and is retired by a different login or room.
- Use the same 640 ms easing for the reverse button movement/color blend and
  introduction of the freshly confirmed timer. Preserve action-row geometry,
  reduced motion, camera/microphone behavior and existing room-end confirmation.
  The idle action reads `Create room` directly, without `Room closed` flicker.
- Validate complete OverlayApp with delayed settlement/read, paid access,
  exhausted/failed reads, reopening and reduced motion. Source simulation and
  automated checks do not replace the owner's loaded staging extension check.

Scope remains extension presentation; no accounting, server contract, protocol,
permissions, policy gates or production rollout changes. Rollback is a staging
extension revert/rebuild and restoration of the previous verified folder.

## November 2: Accepted local lifecycle corrections

The owner requested local iteration in the same unpacked staging-channel folder,
then tested the successive builds and explicitly authorized merging the complete
set into staging. This supersedes the earlier requirement to merge every visual
iteration before updating that folder. The final PR must still pass the normal
gates, preserve unrelated work, and deliver a rebuild from the merged staging SHA.

- On tab/window return, retain still-fresh account and room observations with
  their original monotonic/wall anchors, owner/login/room scope, TTL and UTC
  boundary. Cancel old requests across visibility loss, fence buffered room
  events until correlated recovery, and replace canceled recovery after a new
  continuity loss. Do not extend validity, grant access or introduce polling.
- A stationary cursor left by Create must not reveal End as the red button moves
  underneath it. Intentional pointer movement, keyboard focus and confirmation
  still reveal the action; reduced-motion behavior remains supported.
- Fresh validated Plus/Pro account metadata suppresses quota placeholders during
  room-scoped reads. This does not supply live time or override a later finite
  room observation. Paid capacity and camera/microphone controls are preserved.
- Invite/restored-room entry has its own neutral joining presentation. Personal
  hosting time, Create and the exhausted-hosting screen must not appear during
  admission. Use real membership before showing guest/host actions; preserve
  the existing escape action if the first snapshot takes longer than eight
  seconds. A failed request or session initialization must not leave a false
  pending state. Owner-scoped initialization errors survive unrelated identity
  refresh, and restoration never closes controls the user opened himself.
- After explicit guest departure, retain only the disabled red `Leaving room`
  action until the current idle account read completes or fails, then reuse the
  reverse animation. The existing twelve-second bound and login/room retirement
  apply. Departure, media shutdown and server work are not delayed by animation.

Before delivery, all 2666 extension tests and typecheck passed. Regression probes
failed against the previous delivered source and passed with the corrections.
The final isolated full-source browser pass covered 15 entry/exit, paid/free,
exhaustion, delayed/error and reduced-motion scenarios. Invite variants had zero
idle-hosting frames, actual transition animation and less than one pixel of
vertical action-row movement; the guest exit's loading-strip frames fell from
61 to zero. Earlier local checks cover focus/visibility continuity and hover.
Independent review found and verified fixes for bounded pending/recovery and
session-error cases. Exact suite outputs, source hashes and folder backups are
local execution artifacts; final CI and merge evidence belong in the staging PR.

The owner's visual acceptance does not waive the remaining production gates.
No Web/Worker/schema, accounting, grant, permission or policy change is included.
Rollback is a staging revert and rebuild into the same unpacked folder; keep the
previous verified folder backup. Main, production and Store publication remain
separate actions.

## November 3: Capsule notice and paid refresh

The owner approved delivery of the refined local capsule notice to staging and
reported recurrence of paid/entry presentation problems after the previous
delivery. Review found PR495–499 in staging and both local artifacts; the exact
loaded Chrome version remains a separate observation. A full OverlayApp test
reproduced a different gap: same-login token rotation with a delayed account read
cleared fresh Plus/Pro metadata during creation and exposed quota placeholders.

- Preserve confirmed account display through token rotation using the existing
  logical login. A separate credential epoch cancels old request/retry callbacks
  and starts a fresh read. Keep original monotonic/wall anchors, TTL, UTC reset,
  room and settlement epochs. A new login, logout or account switch still retires
  the old display. This cache supplies presentation, never admission rights.
- Include the owner's approved Creating room label through HTTP admission and
  first-snapshot readiness. Preserve bounded failure/escape and all previous
  join, paid, end, visibility and intentional-hover corrections.
- Keep the existing host-only, once-per-UTC-day server warning claim at300seconds.
  Use the existing live room clock: paused metering remains paused, stale/unknown,
  guest, ended and upgraded observations cannot show a live Free20 countdown.
  No warning requests, quota writes or room termination are added to UI ticks.
- Show a32px connected strip emerging left from underneath the real capsule.
  Copy is `05:00 left today` with `View plans`. If the capsule was hidden, reveal
  it first, wait briefly, then reveal the strip. Preserve its real count, outline,
  position and user control visibility preference after dismissal. Camera and
  microphone controls remain in their existing dock.
- On a host's server `ROOM_ENDED` with quota exhaustion in negotiated Free20,
  display `Room closed` / `Daily limit reached` in the same strip without forcing
  the panel open. A local zero or create denial cannot claim a room closed.
  The existing exhausted panel remains available on explicit open. Dismiss the
  terminal notice on account/login replacement, another room, confirmed unlimited
  access or the next daily budget. Retire it after a discontinuous clock/sleep,
  including unavailable account recovery. Preserve legacy and guest notices.
- Keep the approved orange gradient CTA and a four-second highlight, gentle
  nudge, rest cycle; terminal copy has highlight only. Pause CTA motion during
  interaction. The connected left dismiss tab expands on hover/focus, is exposed
  for touch, and restores capsule focus only when dismissal began inside it.
  Pricing opens the correct environment in a new tab. Reduced motion is immediate;
  the static polite announcement never reads every countdown tick.

Verification includes actual OverlayApp token-rotation and terminal-event tests,
clock/claim lifecycle tests, motion timing and component keyboard tests, plus
Chromium inspection of actual source styles in Shadow DOM at420px and320px.
Extension check/test, baseline check/test, room harness, dev:check, independent
review, staging artifact validation and normal PR/CI precede folder delivery.
The PR owns final counts, CI/merge and matching-file artifact evidence. These
checks are not authenticated loaded-extension or two-participant acceptance.

Scope is extension display and request lifecycle. No Worker, Web, SQL, protocol,
policy, permission or production change. Rollback reverts the staging extension
commit and rebuilds/restores the previous verified unpacked folder; do not toggle
Free20 or alter usage, claims, subscriptions or active-room records.
