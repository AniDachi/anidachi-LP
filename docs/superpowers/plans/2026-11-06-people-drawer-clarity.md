# People drawer clarity

User request: tidy People so adding friends and creating groups are simple and
clear. This is a local follow-up to the accepted September People editor, using
the existing extension style and API. No new friendship or group semantics.

## Design and approach

Keep Friends / Groups and the focused dialogs. Use explicit Add friend and
Create group actions. Empty lists have one central action, without empty search
or a redundant zero count. Nonempty lists retain search and compact rows.

Add friend explains that the link is for one person. Copy invite link creates
and copies on that explicit click; opening the dialog alone creates nothing.
Keep the URL available for manual copy and reuse a valid link on subsequent
copies. New link explicitly replaces the displayed link for another friend.
Old unused links retain the existing server expiry and single-use behavior.
Late results after account change must not display or copy another owner's link.

Create group keeps the name, accepted-friend selection, search and compact
selected count. Create group / Save changes labels distinguish creation from
editing. Groups remain private invitation lists, including allowed empty groups.
Draft retention, conflict handling, limits and destructive confirmations stay.

Alternatives considered: copy-only text cleanup would leave the redundant link
step; a new full-screen wizard would be disproportionate to this small request.
The implementation choice is the existing dialog with one explicit copy action.

## Implementation and validation

- [x] Update `popup-people-panel.tsx` and `popup-people-styles.ts` only for the
  presentation and link-copy interaction above; preserve API/auth ownership.
- [x] Extend existing People regressions for single-click creation/copy, reuse,
  expiry, clipboard failure, duplicate clicks, and late account-switch results.
  Preserve existing group selection, stable retry ID and conflict tests.
- [x] Inspect actual components in the local fixture: populated/empty lists,
  copy/re-copy, creation/editing and narrow width.
- [ ] Run extension typecheck/tests, dev check, review and Graphify refresh.
- [ ] Build/validate the narrow staging artifact; back up and refresh the same
  tester folders and ZIPs. Do not push or deploy this local block automatically.

Rollback: restore the prior tester artifact or revert this local change.

Local verification: extension typecheck and 169 files / 2838 tests pass; the
independent source review found no actionable issues. Actual-component fixture
was inspected at 392 and 320 pixels, including a successful local group save and
reopening with the selected friends intact. This is fixture evidence, not real
two-account friend acceptance. Delivery evidence will be recorded in
`artifacts/people-clarity-20261106/` (ignored, local only).
