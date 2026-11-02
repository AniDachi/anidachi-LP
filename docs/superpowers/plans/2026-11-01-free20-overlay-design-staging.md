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
