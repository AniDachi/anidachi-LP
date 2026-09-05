# Release And Rollback Runbook

This runbook is for staging and production incidents caused by a release,
dashboard setting, or extension artifact.

## First Response

1. Identify environment: local, staging, or production.
2. Identify surface: web, API Worker, extension, OAuth, Supabase, Stripe, or CI.
3. Capture the failing URL, workflow run, commit SHA, extension version, and
   browser profile if relevant.
4. Avoid making multiple unrelated fixes at once.

## Web Rollback

For Vercel web regressions:

1. Open the Vercel project deployments.
2. Find the last known-good deployment for the same environment.
3. Promote/rollback to that deployment if production is affected.
4. Verify:
   - home page loads;
   - staging gate still works for staging;
   - login and `/api/me` work if auth was affected.
5. Open a follow-up PR with the real code fix.

## Worker Rollback

For Cloudflare Worker regressions:

1. Identify the last known-good `Deploy API` run.
2. Prefer reverting the bad commit through Git and redeploying from `staging` or
   `main`.
3. For emergency Cloudflare rollback, use Wrangler/dashboard rollback only when
   the Git path is too slow.
4. Verify:
   - Worker root responds;
   - `pnpm smoke:worker:staging` for staging;
   - room WebSocket connection for room changes.

`Deploy API` must only deploy from `staging` or `main`.

## Extension Rollback

For extension regressions:

1. Identify affected channel and exact artifact: unpacked staging tester build
   or a future published production build.
2. Locate previous known-good artifact and `version_name`.
3. Reload the previous unpacked artifact for current staging testers. If a
   future production store release exists, use that channel's approved rollback
   mechanism separately.
4. Verify manifest channel:
   - staging name: `Anidachi Staging`;
   - production name: `Anidachi`;
   - web/API/WS bases match the channel.
5. Use a clean Chrome profile to retest sign-in and room creation.

Do not rebuild an old release from a dirty working tree. Use the exact commit or
stored artifact.

## OAuth / Env Rollback

For login or redirect failures:

1. Check whether Google/Discord redirect allowlists changed.
2. Check Vercel env values for the target environment.
3. Check GitHub Actions env/secret scope if build/deploy changed behavior.
4. Restore the last known-good dashboard value.
5. Trigger a fresh deployment if Vercel/Worker env changed.
6. Verify login from website and extension.

For room-end synchronization failures, verify the complete server-only bridge
before changing code:

1. Web has `ANIDACHI_API_INTERNAL_BASE_URL` for the matching Worker.
2. Worker has `ANIDACHI_WEB_INTERNAL_BASE_URL` for the matching Web deployment.
3. Web and Worker have the same environment-specific
   `ANIDACHI_INTERNAL_API_SECRET`.
4. Trigger a fresh Web deployment after Vercel env changes; changing a dashboard
   value does not update an existing deployment.
5. End a real staging room and verify both Worker acknowledgement and the
   persisted Supabase `ended` state.

## Supabase Rollback

For schema/data issues:

1. Stop dependent deploys if possible.
2. Identify the migration and affected tables/RPCs.
3. Prefer a forward fix migration over destructive rollback.
4. Never expose service-role keys to client code while debugging.
5. Verify with read-only queries first, then repair.

### Watch History v2 bounded-read prerequisite

`20260816090000_watch_history_v2_bounded_read.sql` is compatible with the old
web runtime, but it is not dormant: its triggers maintain the derived
`watch_history_title_summaries` and
`watch_history_user_session_summaries` projections on v2 progress and
session/participant writes/deletes.

The migration uses an explicit transaction and acquires a write-conflicting
lock on `user_watch_settings` before session, participant, and progress sources, matching
the writer RPC lock order. If the ten-second lock timeout fires, the migration
rolls back completely: do not repair migration history or partially apply SQL;
let in-flight playback writes drain and rerun the database workflow.

If only the web consumer is bad, redeploy the prior web commit first. The
projection/RPC can remain installed while the previous web runtime ignores it.

If the migration itself must be removed, prepare and review a new forward
migration; do not edit migration history or run destructive SQL manually. The
forward migration must, in this order:

1. confirm the bounded-read web consumer is absent or already rolled back;
2. drop `sync_watch_history_session_summaries_v2` from
   `public.watch_sessions`, drop `sync_watch_history_user_session_summary_v2`
   from `public.watch_session_participants`, then drop
   `sync_watch_history_title_summary_v2` and
   `sync_watch_history_title_summary_delete_v2` from
   `public.watch_episode_progress`;
3. drop `public.list_watch_history_v2_page(uuid,bigint,integer,timestamptz,text)`;
4. drop the four trigger functions and
   `public.refresh_watch_history_title_summary_v2(uuid,bigint,text,text)`;
5. drop `public.watch_history_user_session_summaries`, then
   `public.watch_history_title_summaries`; their supporting indexes drop with
   the tables;
6. leave `public.watch_episode_progress`, sessions, participants, receipts,
   deletions, settings, generations, and every legacy table unchanged;
7. run migration-history, pgTAP, schema-lint, and old-web read/write smoke checks.

For a migration-only incident before the consumer deploy, no web rollback is
needed; apply the reviewed forward cleanup and verify old-runtime writes. After
the consumer deploy, web rollback comes first and database cleanup is optional.
Do not create the cleanup migration speculatively during a healthy release.

### Watch History v3 coordinated transition

The schema-3 canonical catalog/progress candidate is local and unactivated. Its
reviewed migration intentionally clears test history, advances history generation,
and makes old SQL writers terminal. Therefore the old Web deployment alone is not a
valid rollback after the migration is applied.

Before a separately authorized transition, record the exact environment, reviewed
history-relation counts, inbound foreign keys/triggers, migration list, deployed
Web/extension versions, preservation checks, and backup/rollback anchor. Quiesce
only history writes; do not stop room/media behavior. Apply the exact reviewed
migration, activate the matching v3 Web runtime, verify v3 reads/writes and
unrelated product state, and only then update explicitly approved tester folders to
the matching extension hash. Schema-2 requests and old cached outbox work must fail
terminally and create no settings, sessions, participants, or progress.

If activation fails, keep the short history-only upgrade state while preparing a
reviewed forward fix and matching runtime. A restore requires separate approval and
must be scoped so newer account, room, subscription, social, invite, Recent People,
and settings data is not lost. Never reset the whole remote database or promise
recovery of intentionally discarded test progress. The detailed local evidence and
remaining acceptance boundary are in `docs/watch-history-v3-local-verification.md`.

## Incident Note Template

```md
## Incident

- Date/time:
- Environment:
- Surface:
- Symptom:
- First bad commit/deploy:
- Last known-good commit/deploy:

## Mitigation

- Action taken:
- Verification:
- Remaining risk:

## Follow-up

- Root cause:
- Permanent fix PR:
- Docs/tests updated:
```
