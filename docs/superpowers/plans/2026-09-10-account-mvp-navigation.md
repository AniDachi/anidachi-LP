# Account MVP navigation implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for
> independent profile/social tasks and task reviews. The controller integrates
> the shared shell, notification lifecycle and editor navigation guards.

**Goal:** Deliver the approved compact account workspace using existing features.

**Architecture:** Keep durable state and endpoints unchanged. Add a persistent
account UI context for transient view state and a notification dialog that hosts
the existing inbox. Reuse existing profile, friend, subscription and CRM APIs.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing CSS and native
dialog; node:test/happy-dom and browser verification.

**Spec:** `../specs/2026-09-10-account-mvp-navigation-design.md`

## Global constraints

- Worktree `.worktrees/personal-history-mvp`, branch `codex/account-mvp-navigation`,
  based on staging `5f56ed03`; preserve the dirty root checkout.
- No changes to room/media protocols, Stripe configuration, history semantics,
  extension artifacts, secrets or database schema.
- Real invitations are never sent during tests. Use fixture transport for
  mutation tests and read-only authenticated staging inspection.
- Requests remain owner-bound; background refresh retains visible data.
- Existing Save/Discard/Stay must also protect notification Join navigation.

## Task 1: Account shell and notifications (controller)

Files: `app/account/{layout,page,account-nav,account.css}`, new components under
`components/account/`, `app/account/invites/invites-client.tsx`,
`app/account/watch-library/history-browser.tsx`, `components/nav-bar-client.tsx`.

- [x] Add behavior tests in `lib/account-sections-client.test.ts` for compact
  inbox embedding, unseen count read without seen writes, and refresh failure.
- [x] Introduce `AccountWorkspaceProvider({children})` keyed by owner, with transient
  per-section view state and one owner-scoped invalidation event for social data.
- [x] Add primary/secondary navigation; redirect `/account` to library. Keep
  `/account/invites` functional. Add avatar Profile link and bell.
- [x] Reuse `InvitesClient({ownerUserId,embedded?,onCountsChange?})`; keep public
  inbox parsing and existing actions. Separate sent-list failure from inbox read.
- [x] Route notification Join through the editor's cancelable navigation guard;
  opening the dialog does not navigate or unmount drafts. Test with dirty editor.
- [x] Restore library view controls and list scroll in workspace memory; owner
  changes reset it. Preserve all existing editor/API tests.

## Task 2: Friends and groups (independent implementation)

Files: `app/friends/friends-client.tsx`, its focused tests; scoped social styles
in a new `app/account/social.css` imported from the account layout by controller.

- [x] Test two account switches, incoming requests above friends, expandable
  outgoing requests and recent people in Add friend. Keep standalone `/friends`.
- [x] Implement those transitions using existing sections and APIs; preserve
  group editing, optimistic rollback, expanded state and creation idempotency.
- [x] Handle unmount/owner changes and stale refreshes. Broadcast
  `anidachi:account-social-changed` with detail `{ownerUserId}` after successful
  mutation; listen for the event to reconcile without a new notification store.
- [x] Verify failed load keeps existing rows, request actions and group changes.

## Task 3: Profile and help (independent implementation)

Files: new `app/account/profile/{page,profile-client}.tsx`,
`app/account/help/page.tsx`, `app/account/profile/profile.css`, focused tests.

- [x] Read existing profile API validation/response, UserMenu, CRM contact and
  waitlist components. Test save/error/owner behavior against fixture transport.
- [x] Render name, handle, avatar URL/preview, read-only email; save only explicit
  editable values. Validate owner response and preserve drafts on error. Update
  header after successful save through router refresh. Keep sign-out protection.
- [x] Add Help with short platform setup/history/group guidance and existing
  contact/suggestion links. Reuse conditional waitlist/referral on Profile.
- [x] Scope all styles; leave subscription and public contact/feature forms intact.

## Task 4: Integration, review and staging

- [x] Review each implementation against spec and check any shared interfaces.
- [x] Run `pnpm --filter @anidachi/web check`, web tests, web build and
  `pnpm dev:check`; resolve new failures, retaining baseline skips separately.
- [x] Inspect actual components with fixture transport at desktop/mobile sizes;
  exercise dialogs, error states, long labels, keyboard and editor navigation.
- [x] Update current-development-state and Graphify semantic/code artifacts once
  for the completed change. Review full diff; no unrelated runtime changes.
- [ ] Commit, PR into staging, required CI and deployment; read-only staging
  verification of library, social, subscription, profile/help and notifications.
- [ ] Record evidence, remaining manual gaps and revert-only rollback in PR.

## Verification evidence before staging

- Web typecheck passed. Full web suite: 542 passed, 6 existing skips; focused
  history editor suite: 22 passed. Production Next build passed; existing lint
  warnings and direct user-supplied avatar image warning remain non-blocking.
- Actual account components inspected with fixture transport at 1440 x 1000 and
  390 x 844. Library, friend and notification dialogs, profile and help checked;
  no page errors or horizontal overflow. Real account writes were not performed.
- Independent review covered shell/social and profile behavior; all reported
  defects were fixed and regression tested.
- Incremental Graphify used code extraction plus 3 documents through a Codex
  semantic agent. Graph has 11,987 nodes; no dangling/missing edges or self-loops
  in the persisted graph. Only the three team graph artifacts are committed.
- Staging deployment and authenticated smoke evidence will be recorded in the PR.
  Production promotion remains a separate acceptance step.
