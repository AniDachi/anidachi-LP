# Chrome compliance patch, September 13, 2026

## Scope

The owner approved the technical/privacy corrections after reviewing the
private tester ZIP audit. Public website ZIP publication and Chrome Web Store
submission remain outside this change. Preserve the existing immutable tester
archive; build a distinct replacement only after validating its actual contents.

- Zod uses `jitless` before protocol schemas initialize in all four extension
  entrypoints. This avoids dynamic Function execution without weakening CSP or
  changing validation rules. Web, Worker, and shared protocol schemas are unchanged.
- Narrow staging/production builds expose only the logo, only to the existing
  supported video-origin set. The artifact validator checks the exact set.
- An account must explicitly allow automatic history recording in this browser.
  Missing, malformed, stale-version, or unreadable choices fail closed. Existing
  users see the choice once after upgrading. A different account does not inherit
  it; returning to the same account preserves its choice.
- The paid entitlement and separate YouTube preference remain additional gates.
  Recording choice gates observation, discovery, local capture writes, and progress
  upload/retry. Open tabs invalidate capture authority on changes. Dispatch checks
  the current account and auth/choice revision after asynchronous reads.
- Stopping recording preserves saved history and pending work. Previously sent
  requests can finish. Read, Resume, room playback, and website manual editing do
  not require this local recording choice. A fresh consent does not bypass server
  generation, access-epoch, deletion, or YouTube-epoch checks on queued work.
- The privacy page describes actual history, auth, media, storage, processors,
  retention, and user controls. Website Amplitude initializes analytics only,
  with autocapture and remote configuration disabled; it does not start Session
  Replay. Explicit analytics events remain available.

## Verification

- Extension typecheck: passed. Extension suite: 130 files, 1937 passing tests.
- Web typecheck: passed. Web suite: 567 passing, 6 skipped, no failures.
- Root `pnpm check` and `pnpm test`: passed, including protocol 183 and API
  229 tests. Local room signaling harness: 39/39. `pnpm dev:check`: passed.
- Staging build and exact artifact validator: passed.
- Built staging extension loaded in a separate temporary full Chromium profile.
  Local fixture responses only; no real account or hosted records were modified.
  The prompt required an explicit action; decline, review, allow, Settings stop,
  persistence, and horizontal overflow checks passed. Popup emitted no runtime,
  console, or CSP errors. Screenshots and run receipt are local artifacts.
- Independent source review of consent gates, account/revocation races, and
  catalog disposal: no remaining blockers. It is not live-user acceptance.

## Delivery and remaining acceptance

At source preparation, these changes are not yet deployed. Use the usual feature
PR to staging and accepted promotion to main. Record actual CI/deployment IDs
and the replacement ZIP's source commit, version name, SHA-256, and validated
production endpoints in the delivery receipt. Do not relabel an earlier ZIP.

After the web deployment, verify `/privacy` in the target environment. On the
replacement extension, verify opt-in followed by playback recording on supported
services and stopping from an already open drawer. Local fixture verification
does not replace real provider playback or production authentication acceptance.
No database migration, server secret, tariff, callback allowlist, room signaling,
camera, microphone, or push-to-talk behavior is changed by this patch.

Graphify was used to locate the existing capture paths. A graph refresh is
deferred to the next consolidated accepted baseline: this patch retains current
plane ownership and API contracts, and the relevant runtime paths were reviewed
directly. Do not include unrelated generated graph churn in this patch.

## Rollback

Revert the source patch through the same branch flow and rebuild a separately
identified artifact if necessary. Never silently re-enable recording for an
account that opted out: an extension rollback must retain the capture gate or
disable recording entirely. Saved account history is not removed by this patch.
Do not roll back to Session Replay while the deployed privacy page says it is off.

## References

- [MV3 CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [Web-accessible resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources)
- [User-data disclosure](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)
- [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
