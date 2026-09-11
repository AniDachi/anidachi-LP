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
Staging rollout and authenticated acceptance are pending.

No new secrets, environment settings, shared protocol payloads, extension
artifacts or live room behavior. The `x-anidachi-social-owner` header is required
for `/api/groups/editor` and optional on established APIs; it is a mismatch fence,
not authentication. Public RPC execution is revoked; the authenticated website
resolves the owner and plan server-side. Existing sent invite recipients are
unchanged. Test fixtures do not contact or invite real users.


Release status: local only. Automatic approval review rejected GitHub push and PR
creation because it requires explicit confirmation of that remote side effect.
No code was pushed and no PR was created. The SQL prerequisite is isolated in
local commit `73c511a1` on `codex/friends-groups-db`; the web consumer stays in
`codex/friends-groups-mvp`. After authorization, publish the prerequisite PR to
`AniDachi/anidachi-LP:staging`, wait for migration success, then publish the web
consumer PR and verify authenticated staging. Main remains a separate promotion.
