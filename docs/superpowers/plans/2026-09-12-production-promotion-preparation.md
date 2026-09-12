# Production promotion preparation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to carry out the preparation tasks in order. Steps use checkbox (`- [ ]`) syntax for tracking. This document does not authorize running the production transition.

**Goal:** Establish a verifiable production release and recovery procedure for the accepted personal-history/account/social/billing release before changing the live database or runtime.

**Architecture:** Keep three different controls explicit: deployment holds stop new code delivery, traffic maintenance stops product activity, and database holds stop writes during preservation and migration. Reuse the reviewed 35-to-60 preservation bridge; do not treat its disposable driver as a production executor. Release compatible runtime before distributing the production extension; commercial/media policy activation has its own acceptance gate.

**Tech Stack:** PostgreSQL 17.6 / Supabase CLI 2.111.0, Vercel / Next.js, Cloudflare Workers / Durable Objects, GitHub Actions, WXT extension, Stripe LIVE; project Node 22.23.1 and pnpm 11.2.2.

**Spec:** [Personal history and plans](../../superpowers/specs/2026-09-08-personal-history-and-plans-mvp-design.md), [production transition contract](../../releases/personal-history-mvp/production-35-to-60-transition.md), [quality gates](../../development-quality-gates.md), and [existing rollout/activation contract](../../releases/personal-history-mvp/README.md).

## Global constraints

- Preserve root worktree `codex/watch-toolbar-polish` and its 38 existing dirty paths. Preparation uses the separate linked worktree on `codex/production-release-preparation`.
- Feature branch -> reviewed PR -> staging -> tested promotion PR -> main. No direct main push, force-push, automatic merge or unrelated changes.
- Preserve original data and user-visible progress; no remote reset, rewritten migration bytes, skipped/relabeled migration versions, guessed v1-to-v3 history, or eviction of user history.
- Personal history only; Free retains read/Resume/delete, paid capture/editor; existing consent, owner/epoch fences, capacity and completion rules remain.
- Keep staging password-gated/noindex and extension permissions narrow. Do not distribute a staging artifact as production.
- No real charge, refund or real subscription cancellation as an incidental test. LIVE portal configuration is already completed; it does not prove the new application is deployed.
- Physical A/V, selected TURN, multi-network capacity and active-policy recovery cannot be inferred from synthetic/local results.
- A failed prerequisite keeps the dependent release step closed. A passed read-only audit does not install a hold, create a backup, or authorize irreversible operations.

## Verified baseline, 2026-09-12 04:44 UTC

The [aggregate audit](../../releases/personal-history-mvp/2026-09-12-production-readiness-audit.json) records the observations and their limits.

| Plane | Observed state |
| --- | --- |
| Git | `main` = `54a154b702ea26e85fab2f3259aa7e5b98fa51be`; `staging` = `1c68c31cc6ca3a1bf2aea0ca1fc21654e9a67ba1` |
| Promotion | PR #247 open, head matches staging, no auto-merge; no running/queued Actions at inspection |
| Production Web | `dpl_8syhEybTfDdm9M4ab1cFKxpz1zZt`, READY, production aliases, source matches main |
| Production Worker | `c2cc7ccb-041b-4e51-be2f-0a2593796f67` at 100%; public health/auth-gate smoke passed |
| Production DB | `bynsjjxzatxndzjkogim`, healthy, 35 migrations through `20260823132355` |
| Baseline descriptors | All 34 public-table column/constraint descriptors match the reviewed baseline; this is not a full database-object/ACL comparison |
| Migration files | All 60 files match the pinned SHA-256 manifest; 25 remain pending in production |
| Existing history | Six schema1 sessions, six schema1 participants, 21 checkpoints, three schema1 tracked titles, 11 settings; other five history relations empty |
| Existing tasks | Two enabled hourly Postgres jobs, no running cron job or active non-audit transaction observed at inspection |
| Protection | No GitHub production-environment protection rules; current production DB workflow does not select that environment |
| Vercel dependency | `supabase-blouapp` remains Required for Production/Development, prefix `BLOU`; dashboard now shows Available, unlike the earlier failed preview incident |
| Recovery at 04:44 UTC | Dashboard sign-in was still pending; the later recovery inspection and local restore result are recorded below |

These are observations, not a traffic freeze. Recheck immediately before execution. Do not use unchanged row counts as proof that row contents did not change.

**Recovery update, 05:33 UTC:** Sign-in to the exact production project succeeded. Its Free plan has no managed project backups; PITR and restore-to-new-project are paid capabilities and were not enabled. A complete logical archive plus password-free roles was obtained through the native CLI temporary login with database sessions forced read-only. The actual archive was restored into a separate PostgreSQL 17.6 container with no network or published ports and cron execution disabled. All 72 table counts/digests, 35 migration versions, 65 role/attribute/grant statements and four sequence states matched. Restoration includes database creation/ownership/settings/ACLs; no owners or ACLs were skipped. This verifies local recovery from real production data, **not** a hosted Supabase recovery procedure or the final maintenance checkpoint.

**Hosted application recovery update, 06:20 UTC:** A separate restricted database in the existing staging project was restored under non-superuser `postgres`, using the real archive. All 35 table digests in `public` and `supabase_migrations`, and all 35 migration versions matched. Existing object owners/ACLs and `postgres` default privileges were replayed; exactly three `supabase_admin` default-ACL entries were excluded because the hosted operator cannot change them. Restoration took 27.06 seconds. The marked test database was removed; independent readback confirmed normal staging remains at 60 migrations with no probe databases. This verifies application restoration into an empty hosted database, **not** cleanup/rollback after the pending chain or whole-project replacement. Backup and receipts are now also stored outside the releasable worktree in an owner-only AniDachi backup directory on the same Mac.

## Task 1: Close read-only source and runtime identity checks

**Files:** Read `apps/web/lib/anidachi-auth/watch-library-routes.ts`, `watch-history-v2.ts`, `social.ts`, `apps/web/app/account/watch-library/page.tsx`, production workflow/config files at the *deployed* Git SHA, and the preservation manifest. Record only aggregate evidence in the audit JSON.

**Interfaces:** Consumes actual platform deployment IDs and Git refs; produces source-bound evidence about old readers/writers, not an authenticated UI acceptance claim.

- [x] Match the live Web deployment source to main; record the Worker version and smoke result separately. Worker version metadata alone does not prove its source SHA.
- [x] Verify the deployed account page uses v2 reads, the old library/reconcile routes return authenticated `426 UPGRADE_REQUIRED`, and v1 library helpers have no production consumers in that source tree.
- [x] Check the legacy social RPC explicitly: it remains present, but production social code calls its v2 replacement; anon/authenticated cannot execute the legacy RPC. The legacy checkpoints contain no multi-user shared session.
- [x] Verify legacy history relations have RLS enabled and no anon/authenticated policies. Do not equate a table SELECT grant with access through RLS.
- [x] Compare all 34 baseline descriptors, the 60 canonical migration hashes, current counts/schema versions and scheduler/session metadata without copying user rows.
- [ ] Run an authenticated, nonmutating old-client/account check with an authorized production account when available. Retain the distinction between source evidence and actual HTTP/UI proof.

## Task 2: Establish actual backup and restore capability

**Files:** Read `scripts/production-history-rehearsal.mjs`, the existing rehearsal receipt and preservation runbook. Add aggregate recovery identifiers/results to the release audit; never add a dump or user row to Git/CI artifacts.

**Interfaces:** Consumes the exact project identity and stable 35-version baseline; produces an identified recovery artifact/checkpoint, proven restore procedure, measured recovery duration and finite retention/owner record.

- [x] After the user's Supabase sign-in, select **anidachi-prod / bynsjjxzatxndzjkogim** and inspect backup dates, status, retention and available restore actions. Free has no managed backups; PITR and clone require an upgrade. No paid option was enabled.
- [x] Establish a complete logical backup candidate through the authorized native CLI temporary owner login: full custom-format database archive, password-free roles, and `supabase_migrations` schema/data. The read-only exported MVCC snapshot binds the archive to all table digests. The roles export is separate cluster metadata, not part of that database snapshot.
- [x] Account for external state: the pending SQL chain does not change Storage object bytes, Vercel Blob contents, Worker/DO state or external Stripe subscriptions. These are not in the database archive and must remain outside the DB restore operation; matching runtime delivery is still a paired recovery requirement. The new notification scheduler must stay disabled so no outgoing delivery needs undoing.
- [x] Restore the real archive into an isolated local destination and verify schema/data, roles/grants, sequence states and exactly 35 migration versions. Network was `none`, no ports were published, database files used volatile tmpfs, cron execution was disabled and the task container was removed afterward. The preexisting Docker profile was returned to its stopped state; the global Docker context was not switched.
- [x] Record artifact identity, creation time, owner-only storage, local restore evidence, operator and retention review deadline **2026-09-19**. Archive SHA-256: `a55e71cac42e700dcc82fb3a82a633cda468d834aa13d06d943574c9f256433c`. The successful local restore and verification took 3.32 seconds on an already running local engine; this is not a cloud recovery-time estimate. A verified owner-only copy and recovery receipts now also exist outside the releasable worktree; neither copy is in Git/CI or off-device storage.
- [x] Restore the complete application archive selection into an isolated hosted database with the actual non-superuser operator. Record the managed default-ACL exclusions and keep this narrower evidence separate from post-migration recovery.
- [ ] Review and rehearse the actual hosted recovery path under the production operator's non-superuser privileges. Local restoration used the initial `supabase_admin` superuser; this does not prove that the production `postgres` operator can restore managed roles/schemas or replace the hosted database.
- [x] Establish recovery storage outside the releasable worktree and verify the copied archive/roles hashes and owner-only permissions. This copy is on the same Mac and does not protect against loss of that device.
- [ ] Take a fresh recoverable baseline under established maintenance immediately before the transition. An older successful rehearsal does not freeze current production data.

**Current stop condition:** Sign-in, full local restoration, narrower hosted application restoration and storage outside the worktree are verified. In-place rollback after the exact pending chain and the final maintenance-bound checkpoint remain open. Production currently has `pg_cron` but no `pg_net`; installing/removing the latter and the new cron job must be part of recovery proof. Existing public default privileges, managed schemas and platform event triggers must be preserved, not omitted after dropping their containers. Do not infer hosted superuser access from the local rehearsal, buy a backup product, or create a billed clone without an approved concrete choice. Do not re-request sign-in or report that no real production export has been made.

**Independent target boundary:** A sibling database cannot host the exact full chain because existing staging `pg_cron` is configured for `postgres` (`postmaster` setting), and both canonical migrations and the bridge require local cron objects. A separate disposable instance is needed for a full hosted 35→60→35 rehearsal. First check an available disposable project or Free eligibility; quote any paid option for the chosen organization before creating it. Production clone/PITR is not intrinsically required. Local non-superuser recovery tests remain useful but cannot silently replace this hosted acceptance. Do not change working staging cron settings or reset its default database to manufacture proof.

**Rehearsal details:** PostgreSQL role-grant provenance requires the source bootstrap role `supabase_admin` to be created by `initdb`; only that duplicate `CREATE ROLE` is omitted during replay, while its attributes and every grant remain intact. Use the archive's `--create` restoration so database owner/settings/ACLs are included. Match the source's `extra_float_digits=0`, UTC and ICU `en-US` collation for JSONB digest comparisons; default float formatting initially produced three mismatched digests with identical row counts. With source settings, all digests matched. Role passwords are deliberately absent; connection secrets and other platform state need the separate hosted recovery procedure.

## Task 3: Make deployment and traffic controls executable

**Files:** `.github/workflows/db-production.yml`, `.github/workflows/deploy-api.yml`, `apps/web/vercel.json`, `scripts/production-deployment-hold.mjs`; the release runbook describes the external controls and checks. Review actual platform settings as well as source.

**Interfaces:** Consumes a pinned accepted source and recovery evidence; produces independently verified delivery holds, application traffic maintenance and a drained stable database boundary.

- [ ] Deliver the narrow production holds through reviewed staging-first work before a full promotion. Inspect old-source/manual dispatch paths and queued jobs; a new-source ignore command cannot stop a previously queued or manually promoted deployment.
- [ ] Require the operator workflow to select the protected production environment; adding reviewers to an environment that the DB job never selects is ineffective. Preserve staging delivery and use one noncanceling transition operation.
- [ ] Specify and test the actual Web/Worker traffic maintenance mechanism before using it. Existing source currently has database write barriers and build holds, not a complete product maintenance facility. Cover new room creation/join, existing room lifecycle, auth callbacks, provider history queues, personal settings/editor/deletes, and internal Worker-to-Web requests.
- [ ] Drain rooms through their normal lifecycle. Historical DB room rows do not prove live sockets; do not bulk-delete rooms or force-disconnect users as test setup.
- [ ] Stop both observed Postgres schedules and any relevant external schedule, then wait for already-running jobs, in-flight requests/transactions and other operator writers. An idle observation now is not a future drain guarantee.
- [ ] Keep Stripe webhook delivery retryable while database writes are held: do not acknowledge an event as processed before it is durably handled. After maintenance, verify replay/backlog processing without duplicate subscription changes. Preserve pending invitation delivery; do not manually send test notifications to other people.
- [ ] Recheck the BLOU connection at deployment time. Current UI says Available; do not report it as an active outage or resume/delete its database. If it blocks production provisioning again, use a separately reviewed narrow connection change with a recorded rollback.

## Task 4: Review the hosted executor and final operating sequence

**Files:** Existing `apps/web/supabase/operations/production-history-20260912/` SQL/manifest and `scripts/production-history-transition.mjs` / tests. Keep the disposable driver's hosted-project rejection intact. A hosted executor is a separate reviewed deliverable after Tasks 2–3 establish its real connection, recovery and maintenance interfaces.

**Interfaces:** Consumes the approved owner connection, recovery identity, immutable manifest and proven holds; produces an aggregate phase receipt bound to the exact project, release SHA and backup. The durable phases remain `prepared -> chain_applied -> verified -> completed`; completed still means database writes are held.

- [x] Review native CLI and connector operator identities and correct their narrow bridge compatibility. CLI keeps `session_user=cli_login_postgres` after explicit `SET ROLE postgres`; require effective postgres and real membership. Security review has no open findings. All 91 real SQL role/definer probes, forced timeout rollback cleanup, 25 full transition checks and full CLI-identity prepare/verify/install/finish operations passed locally. Keep exact file-hash receipts; this does not validate a hosted executor, install production holds or weaken the disposable target guard.
- [ ] Verify the complete hosted execution/recovery connection and scheduler/admin topology in the independent target. No migration repair, modified canonical SQL, or ad hoc timestamped connector migrations.
- [ ] Run the production bridge only after the stable backup boundary. Verify the private archive and immutable hashes before the first pending migration; a retry must verify and reuse the original snapshot.
- [ ] Apply the unchanged canonical chain with CLI 2.111.0 in order. A committed-prefix failure retains maintenance and resumes only the unchanged suffix after diagnosis. It never rebuilds an archive from emptied tables.
- [ ] Verify the 60-version target, archive identities, old+1 generation, preserved consent/counters, unchanged unrelated original columns, intended billing grants, private ACLs and disabled policy/scheduler flags.
- [ ] Deploy the pinned compatible Web and Worker while public traffic remains closed and database holds remain installed; first verify read-only identity/compatibility and authenticated legacy rejection.
- [ ] **Then release the DB write holds only under continuing, independently verified traffic maintenance.** Run the authorized paid-write, Free-read/Resume/delete, stale-generation and cancellation-portal handoff probes through the controlled operator path. A positive write test cannot pass while the DB rejects all service-role writes. A failed probe keeps public traffic closed; do not restore a pre-migration snapshot after accepting new user activity without a reconciliation decision.
- [ ] Only after those probes pass, restore the approved scheduler states, process deferred work, and reopen traffic. Select exactly one invitation recovery scheduler; production Worker currently gains a one-minute timer in the candidate while new Supabase scheduling starts disabled.

## Task 5: Gate policy activation and extension distribution separately

**Files:** `docs/releases/personal-history-mvp/README.md`, the room/P2P hardening plans, existing capacity/recovery evidence and extension build/validation scripts.

- [ ] Retain exact recoverable Web/Worker deployment IDs and immutable extension file hashes. A source commit alone is not a tested active-policy recovery pair.
- [ ] Close the existing physical camera/microphone, selected TURN, multi-network and C04 compatible recovery acceptance gates before the dependent activation/public-readiness claim. Do not rerun unchanged local suites to stand in for the missing physical evidence.
- [ ] Confirm the production extension/OAuth registration and production endpoints before distribution. Build and validate a production artifact from the accepted runtime, then separately record the artifact actually loaded in the authorized test browser.
- [ ] Activate the one-way commercial/media policy only after the documented room drain and dependent acceptance. Do not disable it as rollback after paid personal history is active.
- [ ] Verify the production account, history editor/drawer consistency, invitations/inbox and LIVE billing portal handoff on the compatible stack. Sandbox cancellation/restore has already passed; real cancellation or charging remains an explicitly authorized test, not a release side effect.

## Exit and failure decisions

Before any migration commits, abort to the unchanged old DB/runtime while retaining the stable backup. After a committed migration/reset, retain maintenance and choose reviewed forward completion or a full baseline DB + matching runtime restore. Never restore schema1 rows into v3 live tables or use only an old Web redeploy as rollback.

Main promotion and runtime release are not equivalent: the candidate deliberately holds automatic production deployment. A merged PR is not a successful DB transition, and a green DB receipt is not a reopened service. Record every step's actual evidence and stop at the first unmet prerequisite.

Preparation currently leaves production unchanged. Tasks 2–4 are not ready for execution; this is the explicit remaining release work, not a completed hosted migration procedure. Draft release documentation will receive its link checks, canonical reconciliation and one intentional Graphify update when the recovery/maintenance interfaces are settled, before its PR.

## Current documentation references

- [Supabase backups](https://supabase.com/docs/guides/platform/backups): managed backup/PITR capabilities, role-password and Storage-object limitations.
- [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): include migration history as well as roles, schema and data.
- [Supabase restore to a new project](https://supabase.com/docs/guides/platform/clone-project): database-only clone limitations and paid-plan prerequisites.
