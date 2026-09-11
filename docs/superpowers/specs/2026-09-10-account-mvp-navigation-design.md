# Account MVP workspace

Approved in the September 10 conversation: implement the existing account as
three primary tasks, preserving the working history editor, subscription and
invitation contracts. This replaces the Overview/Invites navigation in the
earlier account library plan; it does not change personal history ownership.

## Surface and interaction

- `/account` redirects to `/account/watch-library`. Primary navigation contains
  Watch Library, Friends & Groups, Subscription, in that order. Share an idea
  and Help remain visible secondary links. Profile is accessible from the avatar.
- Preserve the cover library and season/special dropdown editor. Save/Discard/Stay
  protects progress edits on route changes, sign-out and notification Join.
  Opening/closing notifications must leave the inspector and draft mounted.
  Remember library search, provider/progress filters and selected title within
  this account workspace; re-read canonical data after returning. Preserve list
  scroll where practical without persisting history content in browser storage.
- Notification bell opens a responsive native dialog with a quiet unread badge.
  Reuse the canonical owner-bound account inbox and existing action endpoints.
  Active invites and friend requests precede collapsed missed invitations.
  Existing sent invitations stay available within notifications. The old
  `/account/invites` URL remains a compatible full-page notification view.
  Read status changes only when the inbox is actually opened. Refresh on focus
  and a bounded visible-page timer, retaining current data on failures. Changes
  to friend requests reconcile other mounted account surfaces, not a new queue.
- Friends has two switches: Friends and Groups. Incoming requests appear above
  friends only when present; outgoing requests are expandable. The September 11
  [link-first amendment](../plans/2026-09-11-friends-groups-link-mvp.md) replaces
  recent-people actions with one-time friend links and moves group name/member
  changes into one staged dialog. Groups retain owner-private invitation-list
  meaning. No shared progress, group hosting or new room creation path.
- Profile edits name, handle and avatar through the existing profile API;
  identity comes from the authenticated server session and late responses must
  not cross owners. MVP uses the existing avatar URL capability rather than a
  new upload/storage subsystem. Email is read-only. Preserve unsaved edits on
  failed saves and make successful saves reflected in the account identity.
- Subscription retains existing plan, period-end cancellation, portal and
  entitlement behavior. Share an idea retains the existing CRM form and contacts.
  Help provides concise getting-started guidance and existing support links.
  Existing waitlist/referral access is retained in Profile where applicable.

## Visual direction

Dark, calm workspace; cream selected controls and orange status/action accents.
Cover images remain the library's visual anchor. Desktop has a narrow sidebar,
main working area and contextual inspector. Below 1024px, a compact Menu button
and current-section label replace the navigation rows. The button opens a left
modal drawer with primary sections above secondary links. Escape, the close
button and backdrop dismiss it; accepted navigation closes it while existing
unsaved-change guards remain authoritative. Widening to desktop dismisses the
drawer and restores sidebar focus. Notification dialog
has its own bounded scrolling area. Use short opacity/transform transitions,
clear keyboard focus, native dialog focus containment/return and reduced motion.
Keep existing English product copy. No dashboard counters or decorative overview.

## Boundaries and evidence

Profile adds an optional `x-anidachi-profile-owner` header: a present mismatch
returns 409 before body processing or mutation. The new form always supplies it;
existing extension clients without it remain compatible. It is not authentication.
Keep its constant module client-safe and the handler/server dependencies separate.

No new database schema, Stripe settings, shared protocol, Worker behavior,
extension build or history realtime invalidation. Free reads/resumes/deletes
retained history; paid capture/manual edits and capacity remain unchanged.
Server data stays authoritative. API failures never become empty-success UI.
No notification transmission to real people as part of testing.

Validate owner/race behavior, notification Join with a dirty editor, request
reconciliation, profile error recovery, library navigation restoration, existing
billing/history tests, keyboard/mobile layouts and authenticated staging routes.
Deliver by feature PR to staging; main promotion is separate. Rollback reverts
only these web/docs changes and never modifies saved history or subscriptions.
