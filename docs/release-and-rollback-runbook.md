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

1. Identify affected channel: staging tester item or public item.
2. Locate previous known-good artifact and `version_name`.
3. Re-upload the previous artifact to the matching Chrome Web Store listing if
   the store release must be rolled back.
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

## Supabase Rollback

For schema/data issues:

1. Stop dependent deploys if possible.
2. Identify the migration and affected tables/RPCs.
3. Prefer a forward fix migration over destructive rollback.
4. Never expose service-role keys to client code while debugging.
5. Verify with read-only queries first, then repair.

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
