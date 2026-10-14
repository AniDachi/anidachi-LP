# Approved drawer and hosting notices: staging integration

## Scope and authority

Owner approved transferring the local drawer and room-access notices to staging
on 2026-10-14. Onboarding is the next separate design task. Production, main,
Store publication and billing activation are outside this delivery.

The candidate branch is `codex/extension-drawer-staging`, based on staging
`bc418bf7`. It selectively imports the approved UI from the original
`codex/extension-guided-onboarding` working tree without moving or cleaning it.
The original branch also contains unfinished onboarding and stale trial drafts;
neither is included. The staging Netflix adapters, request/session/history
optimizations and count-only diagnostic reads are preserved.

## Delivered behavior

- Self-contained dark matte drawer, subtle edge/shadow, flush settings surface,
  bundled Inter, compact provider/resource and participant presentation.
- Header camera/microphone controls use the existing room media handlers.
  Filled icons, no status dots, balanced yellow/green and a one-second
  click-triggered English microphone tooltip. Voice tab and drawer signout
  footer are removed; media-seat access controls remain.
- Layout editing uses centered dots and translucent camera/chat placeholders,
  both in the preview and on the player. The primary camera remains distinct.
- New installs use Large cameras at bottom-left; live chat is width 3, Medium,
  Fill, 100% text opacity. Camera and mic default to Last used. With no previous
  preference, camera stays off and mic uses push-to-talk. Valid saved settings
  and storage keys are preserved.
- Hosting denial displays the approved compact notice with a cream button.
  Confirmed cardless eligibility offers three days, no card and no automatic
  charge. Confirmed expired trial offers plans; paid/active access shows ready.
  Errors offer retry, checking offers no purchase action, and unknown/old
  metadata never invents cardless eligibility.
- Notice buttons open channel-specific `/pricing`; no room, subscription or
  trial is created automatically. Escape/close restore focus.

## Compatibility and cost

The existing private account read accepts opt-in `?hostingOffer=1`. Its optional
top-level `hostingOffer` contains trial mode, three-day duration and policy
revision. The strict legacy `hosting` object is unchanged. Older extension
projections ignore the additive field; no migration or environment change.

Only a denied, eligible account reads the small commercial-policy row. Revision,
activation and server time must match the access snapshot. Failed optional reads
omit terms without failing account authority. Ordinary auth/history requests and
older extensions retain their existing cost. No additional browser request,
Stripe call, polling loop, account cache or entitlement write is introduced.

The website's inert room demo shares overlay styles. Its legacy camera/footer
styles are retained locally in that component so their removal from the real
drawer does not damage the existing demonstration.

## Verification and acceptance

Baseline extension: 146 files / 2315 tests passed. Candidate extension:
146 files / 2320 tests passed. Web: 1180 passed, 6 skipped; protocol: 245 passed;
API: 266 unit and 109 Cloudflare runtime tests passed; room signaling: 39/39.
Extension/web/protocol/API typechecks pass. Narrow staging
build and artifact validation pass. Independent read-only review found and
confirmed the fix for shared-demo CSS; no blocking source findings remain.
The real-WebRTC harness with artificial devices passes 26/26. Web lint passes
with existing warnings; no new lint errors. `pnpm dev:check` identifies the
extension/rooms/web/API profiles.

Real-component local browser checks cover trial available/ended/error, correct
staging pricing URL, 324px drawer without horizontal overflow, bundled font,
Escape and focus restoration. Screenshots are kept in ignored local
`artifacts/extension-drawer-staging-2026-10-14/`, not in the extension package.

Final CI, merge/deployment and artifact receipts are recorded in the PR. Owner
acceptance must use the matching unpacked staging artifact: create/join room,
mic PTT/open, camera, layout Apply/persistence, normal/fullscreen, eligible and
expired trial accounts. Automated and fixture checks do not establish physical
capture or loaded-browser acceptance. Onboarding work follows this test.

## Rollback

Revert this feature PR on staging and reload the previous staging artifact.
No durable billing/media state or database schema changes require rollback.
Keep the original local design checkout and accepted existing preferences.
