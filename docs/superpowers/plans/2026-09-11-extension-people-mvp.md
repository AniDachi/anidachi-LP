# Extension People: link invitations and private group editor

Status: implementation, local checks and loaded staging-artifact verification complete.
PR checks and staging merge evidence are recorded in the delivery PR. Continues the accepted website Friends &
Groups MVP on staging `43d58692`; user approved the same work in the drawer.

## Product and visual direction

Keep Watch | People | Inbox and the existing fixed drawer. Inside People use a
cream Friends | Groups switch, compact avatar rows, quiet separators and a
single primary action. Search and row actions stay close to the list. Avoid
nested cards and permanent forms. A modal contains the focused task and returns
focus to its opener. Respect reduced motion and narrow drawer widths.

- Friends: accepted friends, name/handle search, one-time invitation link.
  Opening the dialog does not create a link. Copy failures preserve the URL.
  Keep the last generated link while this account's People panel is mounted.
  Existing incoming requests remain actionable in Inbox.
- Groups: private lists belonging to their creator, searchable by name.
  Create/edit name and up to 100 accepted friends in one modal. Empty groups are
  allowed. Selection survives search. Save atomically; Cancel discards with an
  inline confirmation when dirty. Failed saves retain the draft and create ID.
  Delete group and remove friend require an explicit confirmation.
- Room invitations remain in the player pill's existing picker. This change
  does not create shared progress, public groups or automatically send invites.

## Contract and implementation

1. Add background social bridge operations for POST `/api/groups/editor`, POST
   `/api/friends/invite-links`, DELETE `/api/friends/:userId`. Reuse existing
   group archive and room/inbox contracts. Validate inputs and responses.
2. Send the captured account owner in `x-anidachi-social-owner`. Preserve the
   group revision for conflict detection and the draft UUID for creation retry.
3. Integrate through PopupApp's account gate and mutation lock. Discard results
   after account change. Refresh acknowledged social mutations; distinguish a
   saved mutation from a failed subsequent refresh. Do not remount history.
4. Replace only People presentation/styles. Keep the cached/stale/offline
   states, retained navigation, dimensions and Inbox behavior.

## Verification and delivery

- Bridge tests: owner header, atomic payload, validation, failure/response
  handling, safe link URL, existing invitation compatibility.
- UI tests: search and selection, cancel/save, stable ID retry, duplicate-click
  protection, clipboard failure, destructive confirmation, stale account data.
- Extension typecheck and full suite; narrow staging build and validation.
- Inspect actual drawer/loaded artifact, plus history and invitation entry
  points without sending real invitations. Record any manual test gap.
- One scoped Graphify refresh at the feature boundary, normal `dev:check`, PR
  into staging. Preserve unrelated WIP and back up tester artifacts before
  replacing them. Rollback by reverting this PR/reloading the previous artifact.

No server migration, secret, environment or room protocol change is expected.

## Local verification, 2026-09-11

- Extension typecheck passed; 127 test files / 1884 tests passed.
- `pnpm dev:check`: extension + docs profiles; no API/room/media gate triggered.
- Independent review found and fixed stale-revision conflict recovery and menu
  Escape focus restoration. Added regressions for both and late links after an
  account switch; follow-up review has no remaining findings.
- Chrome local fixture checked at 382x600, 392x600 and 320x440: long names wrap,
  group selection survives search, Cancel protects the draft, footer actions
  remain accessible, one-time-link modal retains a selectable URL. No console
  errors or warnings. Fixture data only; no real invitations sent.
- Drawer shell and fixed sizing rules unchanged. Only the loaded staging folder
  is a delivery target; production/public/experiment artifacts remain separate.

## Loaded staging artifact

Build `6dd848dc-staging-20260911200437` passed staging artifact validation and
was loaded in Chrome under the existing staging extension ID. Its permission
sets and key are unchanged. The previous loaded build was backed up and both
backup and copied candidate were verified by file hashes. Public/experiment
folders were not replaced.

Actual popup checks: 3 accepted friends and 2 existing groups matched the
website; editor showed the real accepted-friend list; selecting and discarding
a member left the original group unchanged and restored focus. Link dialog
opened without creating a link. Inbox loaded its empty request/invite states.
History loaded the existing title/season/episode progress. No real invitation
was sent and no real friendship/group/progress mutation was performed.

Remaining manual acceptance: a user-authorized real group save and a two-account
friend-link acceptance. Atomic API behavior and mutation failures are covered
by the existing server tests plus the extension bridge/UI regressions.
