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

## Website invitation landing page

The recipient page keeps the sender's identity and a single Add friend action.
After confirmed acceptance, or when the users are already friends, it shows
You're now friends without a second action. Friendship links do not join a room
or offer a room transition, even when created from the capsule inside a room.

Sign-in preserves the invitation path. If the session expires on the open page,
the acceptance response replaces the action with Sign in to the same invitation.
Unavailable links show their reason; transient failures remain retryable. The
client only confirms success when the server returns an accepted friendship and
continues to send the displayed account's owner header. Changes to this web page
require a web deployment; updating the extension folder alone does not ship them.

## Toolbar Inbox follow-up (November 6)

The toolbar drawer keeps live account-cache subscriptions and the existing
background push reconciliation. Opening Inbox, returning focus/visibility, or
regaining connectivity also rereads the authoritative inbox using a fresh
session. Concurrent events and reads within five seconds coalesce; no polling,
new permission, API, or notification subscription behavior is introduced.

The Inbox tab shows a compact orange count of unseen invitations from the same
account-owned server snapshot used by the toolbar icon. It stays until the
existing seen acknowledgement updates that snapshot, including when Settings
covers Inbox. Zero is hidden; the visual count is capped at 99, with the full
count in the accessible tab name. The label and underline stay in place when
the count changes. Switching accounts cannot retain the previous owner's count.

Cached cards stay in place during refresh, with only the refresh icon spinning.
An actual read failure retains the list and a concise Retry message; stale
mutation controls remain disabled. Missed invitations say Room ended and have
no Join action.

The internal social bridge preserves HTTP status. A rejected Join/Decline no
longer sets the whole inbox to a mutation-error state: the popup records feedback
for that invitation instance and rereads the canonical list. Confirmed ended,
missing, or resolved invitations lose their actions even if that reread
fails. Transient failures allow retry after a successful refresh. A forbidden response
is retryable because friendship eligibility can recover. Feedback is
scoped to owner, creation time, activity and state, so resends and Return cards
do not inherit earlier errors. Friend-request conflicts similarly reconcile
Inbox and People. Durable cache contents and counters are never guessed locally.

After successful acceptance, the join destination opens before the refresh;
opening failure remains retryable. Duplicate actions share the existing lock,
and late old-account results cannot open a room or change another account's UI.
This follow-up is included in the owner-authorized staging review and delivery.

## Toolbar People clarity (November 6)

Friends uses Add friend, and Groups uses Create group. Empty lists present one
central action without empty search or a redundant zero count. Nonempty lists
retain search, existing row actions and the Friends / Groups switch.

Add friend keeps a short one-person explanation and Copy link (accessible name:
Copy invite link). Confirmation replaces that button label with Copied without
a duplicate message beneath it. That
explicit click creates and copies the link in one operation; opening the dialog
alone does not create one. A valid link is reused, expiry is checked at click,
and New link creates a replacement for another friend without silently copying
it. The URL remains selectable if clipboard access fails. Duplicate operations
are locked, and late old-account results cannot reach the clipboard or dialog.

The group dialog keeps name and friend selection, a selected count, and distinct
Create group / Save changes actions. Initial focus goes to the name. Private-list
semantics, empty groups, 100-member limit, draft retention, conflict/retry handling
and deletion confirmation are unchanged. This is a UI change with no
server migration or new permissions; see the [follow-up plan](superpowers/plans/2026-11-06-people-drawer-clarity.md).

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
acceptance and room invitation delivery with two accounts. Record that result
separately from source, unit and local visual evidence before production promotion.

The owner authorized staging delivery on November 6 after reviewing the local
UI. Release checks passed: web typecheck, 1765 web tests (six optional history
RPC/evidence cases skipped), extension typecheck, 169 files / 2838 extension
tests, 39 signaling-harness scenarios and `pnpm dev:check`. Actual-component
preview evidence covers People, group selection and saving, Inbox, capsule
invitations and the web acceptance page. This does not claim a real two-account
staging session. The release PR and ignored local delivery receipt carry CI,
deployment, artifact and independent-review results; this document does not
predeclare the staging merge or a production release.

Rollback is the prior reviewed extension artifact plus a revert of this web
page change through staging. No database rollback or server flag change is needed.
