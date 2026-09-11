# Production history: reviewed 35-to-60 preparation

Status: implementation and **disposable local rehearsal only**. Production apply,
main promotion, deployment hold installation, traffic reopening and policy
activation are not authorized by this document. The executable driver deliberately
refuses both hosted project identities; a separately reviewed production adapter
and release unlock remain necessary. There is no environment-variable bypass.

The [aggregate rehearsal receipt](2026-09-12-production-transition-rehearsal.json)
records the 24 passed synthetic checks and the exact tested commit/file hashes.
It contains no user records or backup contents.

## Fixed scope and eligibility

Production project `bynsjjxzatxndzjkogim` was observed at 35 versions through
`20260823132355`. The target is the exact 60-file chain through `20260911070906`,
from source `0b2c4e84a1c041fc7ead7a504880ec47f2af31e2`. The ordered filenames,
versions and SHA-256 hashes are pinned in
[`manifest.json`](../../../apps/web/supabase/operations/production-history-20260912/manifest.json).
No applied migration is edited, skipped, repaired or relabeled. The complete
pending chain includes inbox/cron, billing/manual grants, room/media and friends.

The supplied read-only production inventory is:

| Relation | Rows | Schema versions |
| --- | ---: | --- |
| `watch_sessions` | 6 | 1 only |
| `watch_session_participants` | 6 | 1 only |
| `watch_progress_checkpoints` | 21 | legacy |
| `user_tracked_titles` | 3 | 1 only |
| `watch_episode_progress` | 0 | — |
| `watch_history_receipts` | 0 | — |
| `watch_history_deletions` | 0 | — |
| `watch_history_title_summaries` | 0 | — |
| `watch_history_user_session_summaries` | 0 | — |
| `user_watch_settings` | 11 | consent/generation/counters retained |

These records are real unless proved otherwise. Source evidence in
`20260814020000_watch_history_v2_clean_cutover.sql` describes v1 as inert, and the
old web `/api/watch-library` source rejects legacy operations. **The deployed
production Web and Worker versions and all relevant read/write routes have not
been verified here.** If any legacy records are currently user-visible, archive
alone is insufficient: stop and review a compatible read/conversion design.
There is no inference of canonical provider identifiers, watched episode counts,
completion, room generations, solo sessions or v3 history from v1 rows.

Any count, schema, baseline, project or file-hash drift refuses preparation. New
live inventory requires review and a new rehearsal; do not reduce it to these
counts. `baseline-schema.json` pins the 35-version public schema including column
types/defaults/nullability and validated constraints. It contains no user rows.
The fixed operator bridge is outside `supabase/migrations` and is not applied by
staging migration automation.

## Preservation and maintenance boundary

`prepare.sql` acquires bounded write-conflicting locks over every existing public
table, then copies all ten history/settings relations before the **first** pending
migration. The private `anidachi_transition_20260912` schema stores complete typed
row values as JSONB, original primary keys, per-row and per-table SHA-256 hashes,
zero-row declarations, schema descriptors, the pinned transition document and
original scheduler flags. Other public relations retain only counts/digests over
their original columns, so additive columns do not conceal destructive changes.
The archive has no foreign keys to live product rows and is inaccessible to
PUBLIC, anon, authenticated and service_role. It is not a Data API or runtime
history source. Do not publish archive rows or backup data as CI artifacts.

Preparation is transactional. `prepared -> chain_applied -> verified -> completed`
is resumable; identical preparation retries verify the existing immutable snapshot
and never replace it from emptied or partially migrated relations. Per-table/row
hashes and live pre-reset values are rechecked before every apply/retry. The
canonical reset empties the nine live history relations while the originals remain
recoverable in the archive. Settings retain consent and next-server-order; each
original generation must become exactly old+1. Reverting generations is forbidden.

The bridge installs statement triggers on all existing public tables, including
users/rooms and other FK parents. It rejects writes from runtime session identities
through direct SQL, mutating reads and SECURITY DEFINER RPCs. Only the actual
`postgres` operator login with no client SET ROLE bypasses it; changing a request
GUC cannot turn an authenticator session into that login. Existing scheduled jobs
are suspended through `cron.alter_job`, with their flags retained. These are
maintenance protections, not a concurrency-group substitute. Before production,
operators must independently drain running jobs/transactions and exclude other
operator/direct-DB writers; cron and operator sessions can also use `postgres`.
Already running jobs must be finished before backup/preparation, not merely
scheduled inactive. No broad service-role grant is changed.

The old runtime must stay frozen and traffic held throughout the chain. The
baseline public table triggers protect its writes; the completed bridge adds the
same holds to newly created public tables **before any new runtime deployment**.
The inbox scheduler's own enabled flag and shared/personal policy remain false.
`completed` means DB verification complete **with maintenance still held**; it does
not mean production is open or policy is active. No automatic cleanup/unhold SQL
is provided because choosing when to reopen is a separate accepted release step.

## Required production order and unresolved prerequisites

1. Separately authorize and deliver the production holds **before** a promotion
   carrying this migration chain. The new DB workflow has no credentials/apply
   job; push and dispatch fail closed. Worker deploy allows staging only and
   refuses main. Vercel's web `ignoreCommand` cancels main/production builds while
   allowing staging/preview builds. These files have no effect on an already
   deployed/queued job using old source. Verify actual workflow installation,
   protected production environment, and no queued runs before proceeding.
2. Freeze the Vercel production project/Git delivery and manual promotion paths;
   verify its root/config and ignored-build behavior. Source ignoreCommand alone
   cannot control an external promotion, queued deployment or project override.
   Keep Web **and** Worker delivery held. Staging deployment remains available.
3. Pin an exact accepted main SHA, project identity, full migration hashes and
   successful rehearsal receipt. Recheck live inventory and schema. Establish
   deployed-inert v1 evidence and all old-client read/write behaviors. Review the
   concrete production adapter against real DB login/session/role topology and
   Data API exposed schemas. The local driver cannot serve as that adapter.
4. Establish application traffic maintenance and drain old Web/Worker instances,
   clients, queues, cron, mutating readers, settings/preferences/deletes and FK
   cascades. Confirm no other operator session can mutate the snapshot. Record
   the actual maintenance mechanism and test it under production role topology.
5. Take and verify a complete recoverable baseline backup/checkpoint under that
   stable boundary; rehearse restoration with matching migration history and
   compatible runtime. The private archive is not a full-database backup. Then
   run the transactional bridge and verify the committed snapshot before any
   pending migration. An approval checkbox is not proof of these prerequisites.
6. Under a single noncanceling production transition operation, recheck the
   exact target/backup/snapshot and apply all 25 unchanged files using Supabase
   **2.111.0**, normal ordered migration history, and the matching reviewed adapter.
   No `migration repair`, `--include-all` workaround or remote reset. Retain
   maintenance through process failures and restarts.
7. Verify all 60 versions, exact archive hashes, zero invented history, generation
   old+1, consent/counters and original unrelated public-column digests. Verify
   expected manual grants only for old paid mirrors without subscription history;
   do not create a new Stripe subscription. Verify private ACLs, inactive policy,
   disabled inbox scheduler and suspended original cron jobs. Publish only an
   aggregate DB receipt, tied to the exact release SHA/manifest/backup identity.
8. Deliver the pinned compatible Web and Worker while maintenance remains held.
   Verify real legacy 426/upgrade behavior, v3 empty reads, Free read/Resume/delete,
   current paid capture authority and stale-generation rejection before releasing
   the barrier. These HTTP/runtime contracts require their own acceptance: local
   database preservation does not prove them. Preserve consent and fences. Shared
   media/personal-policy activation and extension distribution remain separate
   acceptance/approval decisions.
9. A separately reviewed unlock removes the fixed maintenance triggers and
   restores only approved scheduler states once the compatible stack is accepted.
   Explicitly review whether production automatic delivery should resume; do not
   silently delete the hold because the database reached version 60.

## Failure, rollback and retention

Before a migration commits, abort while keeping the old database/runtime. After
any committed file, retain maintenance and both recovery artifacts. Inspect the
real applied prefix and schema; resolve the failure, then resume only the exact
unchanged suffix through the normal CLI. Never call preparation against the
partially migrated live tables to create a replacement archive.

After the canonical reset, schema1 rows cannot be inserted into v3 tables. A
rollback uses the **complete baseline database backup with its 35-version history**
and matching runtime. An old-runtime redeploy alone is not rollback. Once traffic
reopens, a baseline restore can discard newer unrelated data and requires a
separate reconciliation/recovery plan. Production recovery is not automated here.

Assign a named operator and retention deadline before production apply. Keep the
archive inaccessible to the product. During retention, account/title deletion
requests must be reconciled against the archive and backups under the established
privacy procedure; recovery must never resurrect subsequently deleted data. After
the accepted rollback window, erase the archive and expire backups under that
policy. This implementation grants no indefinite hidden-history retention and
provides no bulk restore-to-current-history operation.

## Disposable rehearsal

Only the task-owned containers are used:

- `supabase_db_anidachi-prod-transition-20260912`, loopback `55692`;
- `supabase_db_anidachi-prod-transition-restore-20260912`, loopback `55693`.

The driver rejects the default port, wrong marker/project/labels, nonloopback
bindings and both remote projects. It never links a project or touches the
existing `supabase_db_cyppqpprkygjloyfvvvj`. PostgreSQL image is
`public.ecr.aws/supabase/postgres:17.6.1.121`; both disposable instances run with
`cron.launch_active_jobs=off` to prevent background/network effects. Their known
synthetic password is local fixture data, not a deployment credential.
Wait for the image's `PostgreSQL init process complete` log before restoring or
applying migrations: `pg_isready` alone can succeed during the temporary bootstrap
server and does not prove that image initialization has finished.

To reproduce on a fresh isolated target, provision those two uniquely named
containers with matching Supabase/compose project labels, loopback ports and
`POSTGRES_PASSWORD=task3-disposable-only`. Use a task directory under `/private/tmp`
with `supabase/config.toml` project id `anidachi-prod-transition-20260912`, DB port
55692 and major version 17. Create the exact disposable acknowledgement marker
required by `watch_history_v3_disposable_target.mjs`. Copy the first 35 files from
the pinned manifest to its migrations directory and run:

```sh
fnm exec --using="$(cat .node-version)" corepack pnpm dlx supabase@2.111.0 \
  --workdir "$TASK_DB_WORKDIR" db push \
  --db-url 'postgresql://postgres:task3-disposable-only@127.0.0.1:55692/postgres' --yes
```

On that initially empty database, load `fixture.sql`, then create a full custom
`pg_dump` of database `postgres` and copy it to `$TASK_DB_WORKDIR/baseline.dump`.
Do not reuse an unrelated target or overwrite an existing archive/backup. Export
the explicit disposable target acknowledgement, container, project, host port and
workdir variables required by the target contract, then run:

```sh
fnm exec --using="$(cat .node-version)" node --test scripts/production-history-transition.test.mjs
fnm exec --using="$(cat .node-version)" node scripts/production-history-rehearsal.mjs
```

The same driver exposes `prepare`, `apply`, `finish`, `status`. `apply` always
passes all 60 hash-checked files to pinned CLI `db push`; the normal database
history selects the pending suffix. The rehearsal deliberately injects real SQL
failures at prefixes 35, 37, 38 and 50, including before/after the canonical reset,
then resumes without modifying migration bytes. It verifies rollback of failed
preparation, role/definer/FK maintenance, drift refusals, immutable recovery data,
full-chain invariants, and restores the complete baseline into the second isolated
container. Only aggregate `rehearsal-receipt.json` is emitted. No production row
was read or archived by these tools.
The receipt records SHA-256 for every tested bridge/driver/harness/manifest/guard
file. Its checkout HEAD is context only until those exact bytes are committed;
verify the recorded hashes against the final commit before using the receipt.

Relevant upstream behavior: [Supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push)
and [PostgreSQL session identity](https://www.postgresql.org/docs/17/functions-info.html).
