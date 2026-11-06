# Capsule friends and invitations

The November 6, 2026 implementation on `codex/capsule-friends-flow` transfers the
approved capsule preview to the extension's real room controls. This document
describes that implementation; it does not assert a staging merge or production
release. The toolbar popup's People screen is a separate surface.

## Window and actions

The existing person-plus room action opens the attached Friends / Groups window.
Its curved outline points to the action. Opening and closing animate the window's
height and contents; reduced-motion preference removes the animation. Closed
contents are inert and hidden from accessibility navigation. The existing room,
camera, microphone, video and Free20 controls retain their behavior.

Search is separate for each tab. Empty Friends has one central Add friend action;
otherwise Add friend is in the window header. The Add friend view keeps Back,
one sentence about single-person use, the URL, Copy link and New link. Keyboard
focus follows the view transition. Errors have a retry or manual-copy path.

## Room invitation truth

`CapsuleFriendsPanel` presents data supplied by `OverlayApp`; it does not invent
server statuses. `capsuleInvitePresentation` combines durable invite responses
with current room participants:

- Invite sends through the existing `createRoomInvite` bridge and web API.
- A spinner applies only to the recipients currently being sent an invitation.
  Synchronous recipient locks also prevent overlapping group/direct sends before
  authentication refresh completes. Different recipients remain independent.
- Sent appears after the server confirms a pending invitation. Retries reuse the
  same client action ID until a successful response.
- In room requires confirmed live membership. Accepted outside the room remains
  distinguishable from membership and permits reinviting under the existing
  server contract; someone who leaves can be invited back.
- Declined, Expired and mixed terminal results remain distinct. Group actions
  count only eligible members, excluding those present or already pending.
- Until membership is known, invitation actions stay disabled.

Opening the window, reopening the whole controls, returning from Add friend,
focus/visibility/online events and account-inbox changes refresh its data. An
open visible window also refreshes every 30 seconds. Existing rows remain during
refresh. Membership changes refresh invite statuses; only the latest applicable
request may replace a status snapshot or target list.

## One-person friendship link

Add friend automatically calls the existing owner-validated
`createFriendInviteLink` bridge. The background POSTs to
`/api/friends/invite-links`; returned URLs are checked against the configured
website origin and `/friend/invite/` path. No new endpoint, schema, permission,
secret or deployment flag is introduced.

The URL and any in-flight creation are cached above the controls' mount boundary
for the current account/session and room. Closing/back/reopening reuses that
link. New link explicitly requests another. Expired links are replaced before
copying. Copy confirmation follows clipboard success; a denied clipboard leaves
the URL selectable for manual copying. Account/session or room changes discard
the previous scope, and late responses cannot populate the replacement scope.

The existing website asks the recipient to sign in and accept. The atomic
`accept_friend_link_v1` database function enforces one recipient, rejects self-use
and expired links, and allows the same successful recipient to retry safely.
New link does not revoke an earlier unused link; each link remains single-use
under the existing expiry and issuance limits. The sender uses New link for the
next person; the extension does not claim to know when a shared URL was consumed.

## Validation and release boundary

Regression coverage lives in `capsule-friends-model.test.ts`,
`capsule-friends-panel.test.tsx`, and `privileged-overlay-wiring.test.tsx`, alongside
the existing social-client, web social and database friendship-link tests.
Run extension checks/tests, room signaling harness, then the narrow staging
build and artifact validator before delivery. The local browser rehearsal imports
the actual panel component with sample data; it is not an authenticated delivery
or two-account acceptance test.

No media, Free20 accounting, protocol, Worker or database behavior changes in
this block. The real-WebRTC harness is not required for this UI-only integration;
the existing signaling harness and extension regressions cover the affected
boundary. After loading the refreshed staging folder, check actual friend-link
acceptance and room invitation delivery with two accounts. Before merging, record
that result separately from source, unit and local visual evidence.

Rollback is the prior reviewed extension artifact; no database rollback or
server flag change is needed.
