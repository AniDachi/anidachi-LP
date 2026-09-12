# Temporary Free-project rehearsal window

This is the manual scheduling and recovery wrapper for the
[hosted database rehearsal](free-hosted-rehearsal.md). It does not authorize a
staging pause, project creation/deletion, production release or plan upgrade.
Agree the window with the owner after the command package is reviewed. The
production transition still follows the [release contract](production-35-to-60-transition.md).

## Second executed window, 2026-09-12

The second owner-authorized zero-cost window is **closed**. It ran from
14:21:31 to 14:59:41 UTC, **38m10s** within the agreed 45-minute bound.
The corrected, independently reviewed application recovery passed; its
[separate result](free-hosted-rehearsal.md#accepted-second-rehearsal-2026-09-12)
does not change the earlier failed receipt or complete interrupted-prefix proof.

Before deleting the new disposable project, original artifacts and complete
recovery receipts were copied and byte-verified. Only the two original projects
remain, both healthy. Staging retained its exact 60 migration versions and
scheduler configuration; the original three active jobs, Worker publication
flags and Worker version were restored. Canonical Worker health/auth smoke,
authorized account history and Inbox, and normal loaded-extension room
creation/completion passed. No invitation or camera/microphone test was started.
Production, the shared Vercel project and paid plans were unchanged.

No new prefix campaign was started within this window, leaving a restoration
margin. Any later staging pause requires its own agreed window; this completed
window does not remain active.

## Executed window, 2026-09-12

The first owner-authorized zero-cost window is **closed**. It started at 11:18:55 UTC;
staging restoration and final checks completed at 12:01:45 UTC, within the
45-minute bound. The temporary synthetic project was deleted, and only the two
original projects remain. No plan upgrade or production change occurred.

Staging returned to its exact 60-version migration baseline, original three
active jobs, scheduler settings, Worker publication flags and Worker version.
Worker health/auth checks passed; the authorized account loaded history and
Inbox, and the loaded extension created and ended a room through the normal
flow. No invitation was sent. The shared Vercel project was not paused.

The [database recovery result](free-hosted-rehearsal.md#executed-result-and-correction-gate)
failed acceptance on object privileges and a residual managed role despite
matching restored rows. Receipts and the original synthetic archive were
preserved with verified independent copies outside Git. No rehearsal hold was
released. A fresh window requires corrected, reviewed recovery commands and a
new agreed staging pause; the completed window does not remain active.

## Targets and cost boundary

The 2026-09-12 control-plane and final restoration checks confirmed:

| Purpose | Project | Organization | State |
| --- | --- | --- | --- |
| Production, never pause for this rehearsal | `anidachi-prod` / `bynsjjxzatxndzjkogim` | `swqtnczsqxubsecedcjp` | `ACTIVE_HEALTHY`, PG 17.6.1.127 |
| Staging, temporarily paused only in the agreed window | `anidachi` / `cyppqpprkygjloyfvvvj` | Same organization | `ACTIVE_HEALTHY`, PG 17.6.1.121 |
| Rehearsal | Disposable synthetic project; exact identity retained in the private receipt | Same organization, zero-cost Free entitlement verified | Created for this window, then deleted |

The organization is **George-Kreatli's Org**, verified `free` for this window.
For a future window, confirm its scope and recheck creation eligibility/cost
before creating anything. Supabase allows two active Free projects across the
owner/admin's organizations; paused projects do not consume a slot. Do not create
another organization, buy Pro, enable a clone/PITR/add-on, or assume that a
different organization evades the limit. If the proposed project is not offered
at zero cost, resume staging and report the actual constraint.

The chosen experiment is synthetic. It needs no production OAuth, Stripe, SMTP,
push, Vault, TURN, service-role or user-data export. Do not connect the temporary
project to the website, extension, Worker, Vercel integrations or GitHub secrets.
It receives only the reviewed migration files and synthetic fixture. The
existing real-data backup remains in its restricted storage, not in this project.

## Before asking to start the window

- Review the command package and its offline checks. Record the accepted commit
  and all migration/bridge hashes. Do not merge the draft preparation PR simply
  to obtain a test environment: staging Worker delivery can disconnect sockets.
- Agree that no one will use staging during this window. Record the operator,
  start time, latest time to resume staging, and the exact temporary-project
  name/ref in a private receipt outside Git. If time runs out, retain receipts,
  close the experiment and resume staging; a failed rehearsal is not a reason
  to leave staging paused indefinitely.
- Recheck both project's identities and states, organization plan, available
  project slots, and native operator login. Do not print a database URL or token.
- Confirm the unchanged staging source/runtime and migration baseline (60).
  Record current Worker publication flags, version and schedules, plus the
  existing PostgreSQL job names and active flags. Keep this small receipt for
  restoration; never dump scheduler command bodies, Vault values or user rows.
- Freeze merges and manual deployments for the window and wait for already
  running staging migration/deployment jobs. This is a coordinated manual
  release window, not a newly invented protected GitHub environment. A source
  hold cannot cancel old-source or already queued work.

The Web staging and production deployments share a Vercel project. **Do not
pause that entire Vercel project, change its production environment or install
an unscoped firewall rule for a staging-only experiment.** The agreed staging
outage can show unavailable account features; it need not deploy a new
maintenance UI. This is not the production traffic-maintenance procedure.

## Pause only staging

1. Let test rooms end normally and close the test browser tabs. Verify their
   final callbacks have settled. Historical `rooms` rows alone are not proof
   that sockets or Durable Object alarms have drained. If a room is still in
   use, defer the pause; do not redeploy a Worker or terminate users to clear it.
2. Read current Cloudflare state for **`anidachi-api-staging`**, not the production
   script. Confirm there is no alternate route/service ingress used by testers.
   The observed 2026-09-12 state is `enabled=true`, `previews_enabled=true`, no
   Worker cron triggers, version `b0f05bfa-40b0-408d-883b-b577ecd3bf07`. Recheck;
   these observations are not a future drain guarantee.
3. After the normal drain, disable only that script's publication using the
   documented control-plane request below. Verify readback and rejection of a
   fresh HTTP/WebSocket upgrade, and verify the version did not change. Do not
   delete the script, namespace, account subdomain, rooms or alarms.

   ```http
   GET /accounts/d60ffabe1c032c70f433ff6affebc646/workers/scripts/anidachi-api-staging/subdomain
   POST /accounts/d60ffabe1c032c70f433ff6affebc646/workers/scripts/anidachi-api-staging/subdomain
   Content-Type: application/json

   {"enabled":false,"previews_enabled":false}
   ```

4. On the explicitly selected staging SQL connection, retain the existing
   job-name/active-state list, then stop those application jobs. Use the native
   owner connection; no migration file or `migration repair` is involved.

   ```sql
   -- Read and retain this result before changing any active flag.
   select jobid, jobname, active from cron.job order by jobname;
   select count(*) as running_jobs
   from cron.job_run_details where status in ('starting', 'running');

   -- Only after checking that these are the observed application jobs.
   begin;
   set local lock_timeout = '5s';
   set local statement_timeout = '15s';
   select cron.alter_job(jobid, active := false)
   from cron.job
   where jobname in ('anidachi-auth-artifact-cleanup-hourly',
                     'anidachi-watch-history-receipt-cleanup-hourly',
                     'anidachi-inbox-push-drain');
   commit;
   ```

   Wait for running jobs, live outbox leases and already issued pg_net requests
   to settle. Observe aggregate counts only; do not clear leases, pending rows
   or the network queue. Stopping cron does not cancel event-triggered Web
   delivery. A short outage can naturally expire an invitation; it must not be
   rewritten into a newly sent invitation on resume.

   ```sql
   select count(*) as active_outbox_leases
   from public.account_inbox_push_outbox
   where terminal_at is null and lease_until > now();
   select count(*) as queued_network_requests from net.http_request_queue;
   ```

   The exact three jobs above were active at the 2026-09-12 preparation check;
   running jobs, active leases and queued network requests were zero. These
   queries are verified, but the observation must be repeated after the agreed
   drain. A queued-request count does not prove no request is already in flight.
5. Select **anidachi / `cyppqpprkygjloyfvvvj`** in Supabase and use Pause project,
   or the existing connector's `pause_project` with exactly that ref. Wait for
   the paused state. Recheck production is still healthy before creating the
   temporary project. `restore_project` means resume here, not restore the
   production SQL backup.

## Run the experiment

Create the confirmed zero-cost project in the approved organization, matching
the production major version and region where Free offers it. Save its returned
ref before any database command. A requested version/region is not evidence of
what was provisioned: inspect the actual engine, cron topology and non-superuser
operator. The command helper rejects both known production and staging refs.

Follow [the database command sequence](free-hosted-rehearsal.md). Keep it isolated
from all runtimes. Record failures and committed migration prefixes without
editing canonical SQL, inventing migration-history rows or rebuilding the
original snapshot. The objective is update **and rollback in the same hosted
database**, including objects added by the pending chain. A restore into another
empty database is narrower evidence and does not pass this experiment.

## Resume staging even if the experiment fails

1. Save only the necessary synthetic backup, aggregate results and errors to
   restricted local storage. Verify the recorded temporary ref/name/organization
   before removing the explicitly disposable project. Never select a target by
   list position. If its removal cannot finish, pausing that temporary project
   can release the Free slot; retain its ref for later approved cleanup.
2. Select staging **`cyppqpprkygjloyfvvvj`** and Resume project, or call the
   connector's `restore_project` with that exact ref. Wait for `ACTIVE_HEALTHY`.
   Do not reset its database or apply the production baseline to it.
3. Verify staging still has its original 60 versions, expected application
   schema, existing data and unchanged scheduler configuration. Restore only
   the original active flags from the saved job-name map, after checking no job
   was added or changed unexpectedly. Do not enable all jobs indiscriminately or
   add a second notification scheduler. Leave failed readbacks closed and
   diagnose them before permitting use.
4. Restore the exact saved publication flags for `anidachi-api-staging` with
   POST to the same subdomain endpoint. Check version identity, health and the
   ordinary authentication gate. Reopen test use after a known authorized
   account can load history/inbox without errors and a normal room opens/ends.
   Check pending invitation/notification processing without sending new test
   messages to other people.
5. Verify production identity/health stayed unchanged. Release the coordinated
   deployment hold only after staging verification. Record the actual outage
   duration, result and any retained temporary project. A resumed project alone
   is not proof that the website/Worker connection works.

Supabase documents that resume preserves project data/configuration, but does
not promise a fixed completion time. Do not give a guaranteed pause duration
before measuring this project. Never leave staging paused merely because an
optional investigation is unfinished.

## What a successful rehearsal permits

It closes only the tested database/operator/recovery questions. Update the
production command package with those receipts, then verify the separate
production traffic closure, protected operator probes and compatible deployment
sequence. Production release still needs its own agreed window and fresh
maintenance-bound backup. No paid policy activation, extension distribution or
physical-media acceptance is inferred from this database experiment.

## Primary references, checked 2026-09-12

- [Supabase Free project capacity](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase pause/resume behavior](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Cloudflare per-script publication API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/methods/create/)
- [Cloudflare publication and redeploy behavior](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [WebSocket disconnection on Worker deployment](https://developers.cloudflare.com/durable-objects/best-practices/websockets/#websocket-disconnection-on-deploy)
