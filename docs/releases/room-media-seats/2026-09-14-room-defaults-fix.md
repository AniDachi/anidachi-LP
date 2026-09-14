# Room defaults with media seats

Date: 2026-09-14. Production baseline: `6a144ed1`.
This is a private tester correction of existing room defaults, not a new media
policy. Deployment and immutable ZIP receipts belong to the delivery PR.

## Report and cause

Room > Microphone / Camera choices were saved in account-scoped local storage,
but v2/v3 overlay startup skipped the persisted Voice mode. A room snapshot could
also arrive before its media snapshot and incorrectly reset Open mic as if the
host had revoked the seat. The same skipped hydration blocked explicit Voice
preference writes; the versioned camera toggle returned before its preference
write. Thus Last used and applying new-room defaults both appeared broken.

## Corrected behavior

- Room settings save automatically for the signed-in account in this browser.
  Editing them affects the next room, without changing the current devices.
- On initial admission, wait for the connected room and its authoritative media
  snapshot. Apply the saved room setup once. Open mic / Camera on send the
  participant's own existing media intents; only server ACK or matching accepted
  snapshot permits capture. Push to talk starts silent until the participant
  presses the existing PTT control.
- No media seat means listening with devices off. Four occupied camera slots
  suppress the camera only; Open mic remains available with a seat. Freeing a
  slot or granting a seat later never queues an automatic device start.
- Explicit device choices update Last used. Revocation, rejected startup and
  capture cleanup change the current room state without overwriting that saved
  preference. A new room can therefore use the preferred setup again.
- Defaults are not replayed during a same-document reconnect. After a host seat
  change or device revocation, a new document also requires its own device
  action, even if its old local record still says On. This conservative v2/v3
  restoration boundary avoids reviving a revoke missed while disconnected.
- Legacy room behavior and v2 readers remain compatible. No API, database,
  protocol, permissions, tariff, provider or drawer geometry change is required.

## Verification and delivery

The actual mounted overlay reproductions failed before the fix. They cover
staggered admission/media snapshots, ACK gating, Last used writes, no seat,
full cameras, pending/active revoke and silent regrant. The settings test also
remounts the overlay and verifies that both chosen options remain selected.

Extension typecheck, the full extension suite (131 files / 1976 tests), staging
build and artifact validation passed. The real-WebRTC Pro scenario passed all
14 checks with 15 synthetic Chromium participants, eight microphones and four
cameras; all 168 expected media endpoints connected and the complete 56-sample
video p95 was 4722 ms. This harness covers the Worker/client/controller; mounted
tests cover the changed overlay. It does not prove physical-device behavior.

The owner is testing the media-seat release through private production ZIPs.
The remaining loaded-artifact check is: save Open mic / Camera on, create a new
room, then repeat with Last used and host revoke/regrant. Use the existing
private-testing flow; website ZIP publication and Store submission are excluded.
Rollback is to reinstall the prior immutable `6a144ed1` tester ZIP. There is no
server migration or account-data rollback for this correction.
