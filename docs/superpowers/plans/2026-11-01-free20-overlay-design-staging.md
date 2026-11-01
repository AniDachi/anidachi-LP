# Intermediate overlay design on staging

Parent: [Daily Free20 transition](2026-10-30-daily-free20-transition.md), block 6.

## Authorized scope

The owner requested transfer of the accepted local prototype into the real
staging extension, with a stable unpacked folder for continued iteration.
This is an intermediate design, not final Free20 acceptance. Conditional
permission to activate Free20 applies only when the whole system is ready;
live time events, trial transition, purchase delivery and enabled acceptance
remain unfinished, so this change does not activate it.

## Task 1: Preserve real action outcomes

- Keep camera/microphone controls and room/invite/people/settings behavior.
- Avatar opens the channel account page; View plans below name/plan opens billing.
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
