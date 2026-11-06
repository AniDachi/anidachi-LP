# Compact chalk welcome and homepage Friends presentation

Status: local design accepted; owner authorized staging delivery on November 6.
The delivery PR records the merged commit, CI, deployment and tester artifact.
This plan does not predeclare delivery or authorize production promotion.

## Approved scope

Replace the long first-launch extension welcome with the selected compact,
chalk-illustrated three-step layout. Keep the existing popup account header and
Watch/People/Inbox navigation. Omit the lower overview of those three sections.

The welcome contains Open a video, Click the capsule, and Create a room,
decorative chalk illustrations, Got it, and the channel-specific Guide link.
Copy remains selectable text; the illustration is bundled locally as a
transparent PNG and rendered as decorative background slices because it repeats
the written instructions. A second transparent sprite supplies the three orange,
hand-drawn circled numerals from the selected design. Each artwork and its text
share one grid row and align vertically at their centers, including wrapped copy.
The existing arrows connect the rows without duplicating parts of the artwork.
The actual 392 × 600 popup must fit without scrolling.

## Behavior preserved

- `apps/extension/src/popup-welcome.tsx` retains the existing installation-local
  `anidachi.welcomeAcknowledged.v1` key. Only Got it acknowledges the screen.
- Visiting other tabs or the setup guide does not acknowledge it. Existing
  acknowledgements remain valid; updating the extension does not force replay.
- Welcome visibility does not grant recording consent or change history
  preferences, account state, entitlements, or notification preferences.
- `apps/extension/src/popup-app.tsx` retains the watch-history component but
  hides its content while the welcome is visible. Got it reveals it.
- Settings remain available through the existing header gear. The removed
  explanatory Settings link is not replaced by a second entry point.

## Local review and release boundary

The local preview imports the real welcome, navigation, account-title and popup
styles. Its fixture storage and account controls are isolated from the installed
extension. Preview tabs contain fixture content; this is not a full backend test.

The staging-channel tester artifact may be rebuilt locally for owner review.
This does not deploy staging, change server flags or update production. Promote
only after the owner accepts the design and the usual staging PR checks pass.

Validation: extension TypeScript check, existing welcome acknowledgement and
popup settings/plan tests, complete extension test suite, staging build/artifact
validation, and a browser inspection at the actual popup dimensions.

## Homepage Friends presentation

The owner also approved updating the homepage walkthrough to match the current
capsule Friends window. The old hand-written invitation markup referred to
styles removed from the extension. The website now renders the actual
`CapsuleFriendsPanel`, including its curved attachment and open/close animation,
with local sample friends and Invite, Sent, then In room states. Membership and
the capsule count change together. Keeping the window mounted lets its existing
close animation finish; the simulated cursor follows the actual invitation
button during reveal. Longer Friends/Sent scenes make the state changes readable.

The walkthrough remains inert and automatic. It never creates a real friend
link, sends an invitation, reads an account, or joins a room. The unchanged
`FriendInviteLink` interface lives in a presentation-safe type module and is
re-exported by `social-client`; the panel imports shared social types directly
from the protocol package. This removes the web type-checker's dependency on
Chrome/auth implementation without changing any payload or extension behavior.

## Delivery checks and rollback

Local checks passed: web and extension typechecks; 1767 web tests with six
existing optional skips; 169 files / 2847 extension tests; and `pnpm dev:check`.
Focused presentation tests cover the actual shared component, inert controls,
closing retention, replay reset, offscreen pauses, reduced motion, and mode
changes. The real local homepage was inspected at desktop and 390 × 844;
Friends fits without horizontal overflow, the attachment aligns with its button,
and History / Async / Live switch correctly. The welcome was inspected at
392 × 600, including acknowledgement and Guide alignment.

The release candidate must pass the staging build and artifact validator before
PR delivery; the stable tester folder is refreshed from the merged revision.
No room protocol, Worker, database, billing, auth, media, environment or
permission behavior changes. Broad room/P2P checks suggested by the file-path
classifier are not applicable to this UI and type-only dependency change.
Real installed-extension/staging acceptance remains distinct from local previews
and is required before production promotion.

Rollback: revert this UI change through staging and restore the previous
reviewed tester artifact. No migration or server flag rollback is needed.
