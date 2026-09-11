# Extension Inbox polish

Status: implementation and local verification complete; staging delivery pending.
User approved improving the drawer Inbox.
Base: staging `89d1cf55`; isolated from unrelated root worktree changes.

## Presentation

Visual thesis: a quiet charcoal invitation list, with warm cream actions and
small orange accents, matching People and the fixed 392x600 drawer.

Content plan: a compact Invitations heading and refresh action; nonempty Friend
requests, Room invites, then Missed sections; one useful empty state; a quiet
website link. Sender avatars, readable names, time and optional group/message
provide context without repeated nested cards. Only active room invites use a
subtle action surface. Missed invitations remain visible without Join actions.

Interaction thesis: restrained hover/focus transitions, action-specific busy
feedback, and stable cached content while refreshing. Respect reduced motion.
No entrance animation on every navigation, and no automatic room joining.

## Behavior boundaries

- Preserve durable inbox order, account ownership, cache publication, mark-seen
  reconciliation and the authoritative unread badge. No new data model, API,
  migration, polling or notification delivery behavior.
- Preserve pending friend-request Accept/Decline and active invite Join/Decline.
  Disable mutation controls while stale or while the existing shared mutation
  lock is busy; distinguish joining from declining visually.
- Show one empty state only after a successful empty response. Loading and
  errors stay honest, including cached-empty responses. Keep cached items on
  refresh failure; offer Retry without making stale invitations actionable.
- Isolate Inbox component/styles. Leave People, Watch, shell dimensions, player,
  permissions, subscriptions and history behavior unchanged.

## Verification and delivery

- Focused tests for empty/nonempty sections, action routing and pending labels,
  stale/error states and disabled duplicate actions; retain convergence tests.
- Extension typecheck and full suite; narrow staging build and validation.
- Browser fixtures for populated, long-text and failure states at normal and
  narrow widths. Inspect the actual loaded staging Inbox plus People/Watch.
  Do not send real invites or change friendships merely to populate a fixture.
- Independent review; one bounded Graphify refresh at the feature boundary;
  `dev:check`; clean feature PR to staging. Main promotion is separate.
- Back up and hash-check the installed staging artifact before replacing it.
  Rollback: revert this PR and reload the prior staging artifact.

## Local verification

- Extension typecheck passed; full suite: 128 files / 1895 tests passed.
- Independent source/test review: no actionable findings.
- Browser fixtures inspected at 392x600 and 320x440. Long names, handles, titles,
  group names and unbroken messages wrap without horizontal overflow. Saved
  invitations remain visible and disabled after an error; Retry restores the
  ready view. Joining shows its spinner and disables other actions. Missed
  cards have no Join/Decline controls. Empty state has no zero-count sections.
- Fixture browser console: no warnings or errors. Fixture callbacks only;
  real invitation acceptance is not claimed from these checks.
