# Room invitation return and reinvitation

Owner-approved correction, 2026-09-14. Baseline: main `99e84f10`.
The approved conversation supersedes the permanent one-invite-per-room rule in
the account/social/inbox specification. The host button stays **Invite**.

## Behavior and constraints

- Pending invitations are deduplicated across friends, groups, retries and
  concurrent host actions. Current room participants receive no new invitation.
- After an accepted invitation and departure, the host can Invite again. Create
  a fresh recipient/invite identity so unread state and push/display dedupe work
  naturally. Preserve earlier resolved rows and action replay results.
- A new invitation supersedes the prior accepted invitation for that recipient
  in that room. Old responses cannot resolve the replacement. A declined current
  invitation remains declined for this room (unchanged anti-repeat behavior).
- Accepted invitations remain available as **Return** while the room and
  friendship remain active. Joining failure must not consume this recovery path.
  Show only the current invitation for the room; no duplicate old Return card
  beside its replacement. Return cards are already seen, do not count as new
  notifications/response-required items, and have no Decline button.
- Accept/Return always rechecks the recipient, friendship and room. It returns
  the ordinary join destination and never bypasses capacity, active-room switch,
  media-seat admission or host revocation. No changes to P2P, capture or Worker
  room events. Short reconnects retain existing session semantics.
- Presence for host UI comes from its authoritative room snapshot, keyed by
  user identity, not historical Accepted or participant count. SQL conservatively
  respects an existing active_room_sessions assignment for this room, including
  admission in progress. Departure already releases that assignment with session
  fencing; do not invent a second presence store or clear assignments here.
- Keep auth/account fences, bounded requests, 20 actions/minute, 100 recipients,
  private owner groups and existing delivery outbox. Never send real invitations
  or change real account/room data during verification.
- Old extension clients must keep parsing responses. New Inbox clients opt in
  with `includeReturnable=true` on list and mark-seen URLs. Default endpoints
  retain the old response states. New clients tolerate old-server responses.
- Follow feature -> staging -> checked main/private tester delivery. Public ZIP
  and Chrome Store publication are excluded. Physical two-account acceptance is
  still a manual test, not inferred from unit or synthetic tests.

## Task 1: Atomic database lifecycle

Own only a new additive migration and focused SQL tests. Create the migration
through the installed Supabase CLI. Add nullable recipient `superseded_at` (no
destructive rewrite). Reinvitation marks prior current accepted recipient rows
superseded and inserts new pending recipients in the same transaction, preserving
the existing outbox INSERT trigger. Replays of one clientActionId return their
original result and cannot send again. No current accepted + active assignment,
pending, declined or legacy unresolved recipient can be reinvited. Mixed group
requests create rows only for eligible people. If all requested people already
have active assignments and no existing invite, raise
`room_invite_already_in_room`; never invent a fake invite row.

Update create_room_invite_atomic with its existing signature and payload. Update
respond_room_invite_v2 with the same return shape: lock room before recipient,
recheck room/friendship even for accepted replay, reject superseded replies with
`already_resolved`. Preserve declined/idempotent/expiry outcomes and no writes on
failed authorization. Keep scope and privileges service_role-only, SECURITY
INVOKER, empty search_path.

Add get_account_inbox_page_v3 with the same signature/JSON shape as v2 plus the
new item_state `returnable`. Retain v2 unchanged for old clients. The v3 projection
includes current accepted invitations to active rooms with accepted friendship,
uses current durable room source/title for Return, coerces seen_at to a non-null
accepted/created timestamp, excludes superseded rows and deduplicates historical
current rows per room. Pending replacement takes precedence. Existing active,
missed, friend-request pagination and counts retain their semantics. Return cards
do not increment unseen/actionable/active_room_invite counts. All reads/counts
come from one coherent DB statement. No cross-account leakage.

Prove red then green in real local Postgres: accepted -> assignment -> no resend
-> fenced departure -> new invite; new outbox revision exactly once; duplicate
direct/group/retry; mixed recipients; declined; stale accept; friendship removal;
ended accepted; old v2 compatibility; Return pagination/counts/seen; role grants.

## Task 2: Shared contract and web consumers

Extend the protocol Inbox union with strict `state: returnable`, missedAt null,
otherwise existing room-invite fields. Keep old variants unchanged. New server
list/seen routes select v3 only with includeReturnable=true. Update web Inbox
client requests/rendering, return/failed-join flow and counters. Error mapping for
room_invite_already_in_room is an honest conflict. Filter sent invitations to the
requested active room when supplied, preserving unfiltered legacy behavior and
latest canonical statuses. Tests cover route opt-in and old/new payloads.

## Task 3: Extension host and Inbox

Keep current layout. Host Invite target state combines current room user IDs and
canonical invitation states: in-room disabled, pending disabled, accepted absent
enabled with label Invite, declined/expired unavailable. Group action skips
in-room/pending/declined users and targets eligible new/returned users once. Host
status updates on membership identity changes, including leave and same-count
replacement, with room/account/request fences. Refetch after send to converge
mixed groups and avoid false 'everyone invited' notices.

Opt into new Inbox projection; include Return cards without marking them unread
or alerting. Reuse explicit join/switch-room confirmation, no automatic navigation
or joining on notification click. Update popup and overlay Inbox renderers and
cache reconciliation tests so response/state transitions cannot resurrect old
cards or erase a newer invitation. Test actual mounted controls and HTTP boundary.

## Task 4: Verification and delivery

Scoped independent reviews, protocol/web/extension checks and tests, real SQL
regressions, room harness, staging artifact build/validation, dev:check. Review
compatibility and migration-before-web deployment order, stage then promote via
PR and produce immutable CI production ZIP. Record exact CI/deployment/artifact
receipts in delivery PR. Update canonical invitation spec/current state and room
plan once; bounded Graphify update after final source. Preserve prior tester ZIP.

## Progress

- Database lifecycle implemented in `7dbeac22`, independently reviewed: 177 real
  local SQL assertions passed, including concurrent direct/group sends, lock
  ordering, grants and the existing lifecycle/outbox regression suites.
- Protocol and web consumers implemented in `e4c080b7`: 194 protocol tests and
  576 web tests passed (6 existing skips); both type checks passed. Focused tests
  first reproduced missing Return rendering, unsupported state, duplicate page
  cards and unscoped sent requests. Independent web/protocol review passed.
- Extension integration is in `aacb26b0` and `eca7ad1f`: 1983 tests, type check,
  staging build and artifact validation passed. Mounted tests cover account
  replacement during requests, same-count room membership changes, Return open
  failure, and stale Inbox snapshots. Independent review found missing account
  fences; the correction and additional coverage receive a scoped re-review.
- Existing Worker unit tests (235), Workers runtime tests (75) and room harness
  (39/39) passed. An isolated offline Chromium loaded the staging extension with
  no page errors; its signed-out layout was inspected. This is loading proof,
  not physical invitation acceptance.
- Database prerequisite PR325 reached staging as `2f9346a8`. Migration run
  `34864532047` and staging CI `34864532030` passed. Hosted service-role v2/v3
  empty-owner reads and role grants were verified without changing account data.
  Dependent runtime and final-main delivery receipts are recorded in release PRs.
- Rollout is additive migration first, then web and extension. Rollback retains
  the new column/history and old v2 RPC; revert consumers to `99e84f10` and use its
  immutable tester ZIP if needed. Do not drop recipient or history data.
- Remaining acceptance: checked staging/main delivery and exact private tester
  ZIP. Physical two-account return/reinvite validation is not yet completed.
