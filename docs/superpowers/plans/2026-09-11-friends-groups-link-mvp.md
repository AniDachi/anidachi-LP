# Friends and groups: link-first MVP

Approved September 11: implement the real personal account, using one-time friend
links and private owner-managed groups of accepted friends. Groups remain invite
lists used by the existing player; they have no shared history or new room flow.

## Delivery

1. Replace the dense group cards with compact rows and one create/edit dialog:
   name, searchable friend checklist, selected count, Cancel and Save. Keep the
   draft on errors, guard unsaved navigation, stage changes until Save.
2. Invite friend opens a single-use link dialog. Generate deliberately, retain
   the link for retry/copy, offer another link for another person. Preserve login
   return and explicit recipient acceptance. No new recent-person requests in
   the website. Existing incoming/outgoing requests remain manageable.
3. Introduce an additive owner-fenced web group-editor endpoint. Save name and
   members in one database transaction; enforce owner, accepted friendships,
   existing plan quota, stale-edit rejection and retry-safe creation. Retain old
   extension APIs and payloads. Friendship removal clears affected memberships.
4. Consume a friend link and establish the friendship in one transaction. A
   retry by the same recipient succeeds only while that friendship is accepted;
   used links cannot re-add a removed friend. Other recipients cannot reuse it.
5. Verify SQL rollback/ownership/limits/retries, React draft/race/link flows,
   keyboard and mobile layouts, web check/test and dev:check. Do not send real
   invitations or change real friendships for testing.

## Release and rollback

Deploy the additive database prerequisite before the web consumer to staging.
Check migration CI, web deployment and authenticated read-only surfaces. Main
promotion remains separate. Roll back web consumers first; keep additive SQL
functions in place. No saved history, subscriptions or room state is reset.

## Evidence

Local implementation complete. Database migration
`20260911070906_friends_groups_editor_atomic.sql` passed on a newly created
local Supabase Postgres 17 container after replaying the full migration chain.
The pgTAP suite passes 32 checks; the concurrency contract passes simultaneous
link acceptance, quota admission, same-revision edits and unfriend/save races.
Frontend checks cover owner changes, quiet-refresh races, preserved drafts,
retry IDs, checkbox saves, canceled discard, double submits and link reuse after
clipboard failure. Web type checking and 562 tests pass (6 existing environment-dependent skips).
The existing room-invitation SQL lifecycle suite passes 50 checks; service-role
privilege checks pass. Desktop 1440px and mobile 390px inspection confirms fit,
member search/save, native focus return and link generation. Local screenshots
are in `/tmp/anidachi-friends-*` and `/tmp/anidachi-friend-link-mobile.png`.
Staging deployment and authenticated smoke evidence are recorded in the companion
web PR. Acceptance of a new friendship with two real accounts remains a separate
user check.

No new secrets, environment settings, shared protocol payloads, extension
artifacts or live room behavior. The `x-anidachi-social-owner` header is required
for `/api/groups/editor` and optional on established APIs; it is a mismatch fence,
not authentication. Public RPC execution is revoked; the authenticated website
resolves the owner and plan server-side. Existing sent invite recipients are
unchanged. Test fixtures do not contact or invite real users.


## Staging delivery, 2026-09-11

GitHub publication and staging delivery were explicitly authorized by the user.
The database prerequisite was merged in
[PR #296](https://github.com/AniDachi/anidachi-LP/pull/296) as `c98ac0a7`.
[Migration run 34582810318](https://github.com/AniDachi/anidachi-LP/actions/runs/34582810318)
completed successfully, including the pending-migration dry run and apply step,
before publishing the web consumer. The consumer is delivered by a separate
`codex/friends-groups-mvp` PR into staging; its final revision, Vercel deployment
and authenticated smoke evidence belong in that PR. Main remains a separate
promotion. No real invitations or friendship mutations are part of automated
staging inspection.
