# Free hosted 35 -> 60 -> 35 rehearsal commands

Status: **hosted rehearsal executed on 2026-09-12; recovery acceptance failed**.
This prepares Tasks 2 and 4 of the [production preparation plan](../../superpowers/plans/2026-09-12-production-promotion-preparation.md).
Production remains withheld by the [transition contract](production-35-to-60-transition.md).
The separate [staging pause/resume window](free-rehearsal-window.md) must be agreed
before freeing a slot. Do not run these commands against production
`bynsjjxzatxndzjkogim` or staging `cyppqpprkygjloyfvvvj`.

This is an isolated synthetic rehearsal using the unchanged 60-file manifest,
normal CLI history, existing bridge SQL and a new project's real non-superuser
operator. It is not a production executor, a production clone, or a full managed
cluster restore. Retain the existing real recovery archive and its independent
copy. None of the cleanup below deletes local backups.

## Executed result and correction gate

The candidate at `c0b0bb93` ran in an isolated, synthetic Free project under
ordinary non-superuser `postgres`. The agreed staging-only window finished with
staging restored and verified; the disposable project was deleted. Production
and existing deployment versions remained unchanged. Private receipts and the
original immutable archive have independently verified copies outside Git.

- The unchanged native 35 -> 60 migration chain passed. Same-database cleanup
  and application restoration committed, recovering the exact ordered 35
  migration versions and all 35 application/history table digests.
- Original bridge verification and service-role INSERT, UPDATE, DELETE and
  TRUNCATE rejection probes passed. Maintenance was never released.
- **Object privileges did not match:** 108 surplus grants to `anon` and
  `authenticated` remained across 41 functions and 13 tables. Surviving default
  privileges applied when the restore recreated objects; replaying the archive's
  object ACL statements did not remove these additions. Equal rows and a
  committed restore transaction are insufficient recovery acceptance.
- **Managed roles did not match:** the platform's `pg_net` installation trigger
  created `supabase_functions_admin`, which remained after extension removal.
  It has LOGIN and CREATEROLE. Zero dependencies or memberships do not establish
  that this residual role is safe. Do not remove, disable or alter managed roles
  as an unreviewed cleanup step, or seed the baseline to hide this difference.
- Interrupted-prefix recovery and hold-release probes were not executed.

**Do not rerun the unchanged command package as an accepted recovery procedure.**
Before a fresh hosted run, bind a complete baseline application-object privilege
snapshot to the immutable artifacts. Reconcile exact privileges, grant options,
owners and grantors inside the cleanup/restore transaction, with an equality
assertion before commit. Preserve legitimate client grants and existing default
privileges; reject unsupported owners, grantors or object/column ACL forms rather
than applying blanket revocations or changing managed catalogs. Test this under
PostgreSQL 17 non-superuser privileges with surviving default ACLs and forced
transaction failure. Separately resolve the residual managed role through a
supported platform procedure or an explicitly reviewed recovery policy.
The ACL correction below is a locally verified offline candidate requiring
independent review and fresh hosted acceptance. The managed-role correction
remains unresolved.
Task 2/4 recovery gates and production promotion remain open.

## 1. Prepare tools, target and local artifacts

Use a dedicated operator terminal with tracing off (`set +x`), Node 22.23.1,
Supabase CLI **2.111.0**, and PostgreSQL client **17.x** for the known 17.6 server.
The Mac's unqualified Homebrew `libpq` was 18.4 during preparation. The separate
keg-only `/opt/homebrew/opt/libpq@17/bin` now provides verified 17.11 tools;
select them explicitly. Do not use 18.x restore output on the 17.x target.

```bash
set -euo pipefail
set +x
umask 077
export REHEARSAL_ROOT="$(mktemp -d /private/tmp/anidachi-free-rehearsal.XXXXXX)"
export REPO="$(pwd -P)"  # reviewed isolated checkout
export PG17_BIN='/opt/homebrew/opt/libpq@17/bin'
export PATH="$PG17_BIN:$PATH"
pg_dump --version
pg_restore --version
psql --version
sb() { fnm exec --using=22.23.1 corepack pnpm dlx supabase@2.111.0 "$@"; }
test "$(sb --version)" = 2.111.0
sb db push --help
sb projects create --help
sb projects delete --help
fnm exec --using=22.23.1 node --test scripts/production-history-hosted-artifacts.test.mjs scripts/production-history-application-acl.test.mjs
```

After the window is approved, create the new Free project in the approved Free
organization through its Dashboard, with no upgrade, add-on, clone or PITR.
The checked CLI has `projects create`/`delete`, but no `projects pause`/`resume`
subcommands and no `--free` creation switch; use the explicit window procedure
for those controls. The creation screen must show the actual Free entitlement.
Record the new project ref, server version, creation time and organization in
the receipt. Do not connect application deployments, OAuth, Stripe, push keys,
webhooks, Vault secrets or real users to it. Restrict network access to the
operator, and disable its Data API for the rehearsal. This independent traffic
closure remains in effect through restore and hold-release tests.

Copy the **direct** host/user from this project's Connect dialog; use the
**session pooler on 5432** if IPv6 is unavailable. Do not invent the pooler host
or use transaction mode 6543. Export only the connection metadata below; obtain
the new project's database password via a private terminal prompt, never from
an old production credential file. This candidate uses **ordinary `postgres`
login only** for every hosted CLI, dump and SQL command, with the new disposable
project's own password. The existing bridge's temporary `cli_login_postgres`
support is unchanged and tested separately; it is not selected by this candidate
because role selection on that CLI `--db-url` path remains unproved. The offline
helper rejects that login, including an otherwise matching endpoint binding.

```bash
export REHEARSAL_REF='replace-with-new-20-letter-project-ref'
export PGHOST='copy-actual-host-from-new-project-Connect'
export PGPORT=5432 PGDATABASE=postgres PGUSER=postgres PGSSLMODE=require
export REHEARSAL_SESSION_USER=postgres
export PGAPPNAME=anidachi-free-hosted-rehearsal
export REHEARSAL_NONCE="$(openssl rand -hex 16)"
export REHEARSAL_RELEASE_SHA="$(git rev-parse HEAD)"
read -r -s -p 'New disposable project database password: ' PGPASSWORD
export PGPASSWORD
printf '\n'
```

These are Bash commands, including `read -p`; run them in Bash. A session pooler
uses `PGUSER=postgres.<new-ref>`, and the server `session_user` must remain
`postgres`, matching `REHEARSAL_SESSION_USER`. The local helper
checks the endpoint/ref/user relationship, rejects the two live refs, and emits
no bridge phase when `backupSha256` is null. It never opens a network connection.

```bash
fnm exec --using=22.23.1 node --input-type=module <<'JS'
import {writeFileSync} from 'node:fs';
const e=process.env;
const b={projectRef:e.REHEARSAL_REF,host:e.PGHOST,port:Number(e.PGPORT),
 database:e.PGDATABASE,user:e.PGUSER,sessionUser:e.REHEARSAL_SESSION_USER,
 nonce:e.REHEARSAL_NONCE,releaseCommit:e.REHEARSAL_RELEASE_SHA,backupSha256:null};
writeFileSync(`${e.REHEARSAL_ROOT}/bootstrap-binding.json`,JSON.stringify(b),{flag:'wx',mode:0o600});
JS
fnm exec --using=22.23.1 node scripts/production-history-hosted-artifacts.mjs \
  "$REHEARSAL_ROOT/bootstrap-binding.json" "$REHEARSAL_ROOT/setup"
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/setup/bind-empty-target.sql"
```

`bind-empty-target.sql` refuses an existing public application/history, asserts
non-superuser effective postgres and creates an operator-only nonce marker. It
must run once on the independently verified new ref. Its marker is not a way to
prove a project identity without checking the control plane and endpoint first.
For every new terminal, recheck the saved binding against all `PG*` metadata,
re-enter the same target's credential, and run `guard.sql` before using the CLI.
Do not let an environment file or a linked checkout select a different target.

## 2. Build the synthetic baseline and drain it

The following password-free URL uses inherited `PGPASSWORD`; the pinned CLI's
connection parser supports libpq `PG*` fallbacks. Do not substitute
`SUPABASE_DB_PASSWORD` or `--password` for the direct `--db-url` path. If actual
CLI authentication fails, stop and correct the connection; never print a secret
URL, switch targets or substitute a temporary CLI login. This sequence stays on
the ordinary postgres connection established above.

```bash
export REHEARSAL_DB_URL="postgresql://${PGUSER}@${PGHOST}:${PGPORT}/postgres?sslmode=require"
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/setup/guard.sql"
sb --workdir "$REHEARSAL_ROOT/setup/first35" db push \
  --db-url "$REHEARSAL_DB_URL" --dry-run
sb --workdir "$REHEARSAL_ROOT/setup/first35" db push \
  --db-url "$REHEARSAL_DB_URL" --yes
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/setup/guard.sql" \
  -c "select cron.alter_job(jobid,active:=false) from cron.job;"
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/setup/guard.sql" \
  -c "select jobname,schedule,command,database,username,active from cron.job order by jobname;" \
  -c "select count(*) as running from cron.job_run_details where status in ('starting','running');" \
  -c "select count(*) as other_transactions from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid() and xact_start is not null;"
```

Require exactly the two baseline hourly jobs from the unchanged first 35
migrations, owned by the intended operator, local `cron.database_name=postgres`,
zero running jobs and zero other user/operator transactions. Managed background
work must be identified rather than killed. Wait/recheck running jobs; a timeout
keeps the task held. The baseline jobs may briefly run before deactivation on an
empty project; no synthetic fixture is installed until they are inactive. Keep
original definitions and the deliberately inactive rehearsal flags in the
receipt. Rehearsal deactivation is not evidence about production's original
active flags.

```bash
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/setup/guard.sql" \
  -f apps/web/supabase/operations/production-history-20260912/fixture.sql
psql -X -qAt -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/setup/guard.sql" -c "select coalesce(jsonb_agg(version order by version),'[]'::jsonb) from supabase_migrations.schema_migrations;" \
  > "$REHEARSAL_ROOT/baseline-versions.json"
psql -X -qAt -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/setup/guard.sql" -c "select jsonb_agg(to_jsonb(j) order by jobname) from cron.job j;" \
  > "$REHEARSAL_ROOT/baseline-cron.json"
```

Check the exact ordered versions against `manifest.json` entries 1–35; counts
alone are insufficient. Require no baseline `pg_net`, no preexisting
`anidachi_private`, `anidachi_history_private`, `anidachi_room_private`, no views,
materialized views, standalone application types or extension-owned objects in
`public`. Require no publication bindings to application tables for this first
candidate. Record all extension names/versions/owners/schema, schema owner/ACL,
`pg_default_acl` including grantor identity, roles/memberships and event-trigger
name/owner/enabled/function. These are metadata, not managed user rows.
If the new project's topology differs, stop and review the difference; do not
drop managed schemas or disable event triggers to manufacture the prerequisite.
A future production candidate needs its own recorded publication/dependency
handling when these restrictions do not hold there.

Create this reusable aggregate query before the backup; it emits only one
count/digest per application relation. Save its output while the drain holds.

```bash
cat > "$REHEARSAL_ROOT/application-digests.sql" <<'SQL'
set role postgres;
set timezone='UTC';
set extra_float_digits=0;
begin;
create function pg_temp.application_digest(s text,t text) returns jsonb
language plpgsql as $$ declare result jsonb; begin
 execute format('select jsonb_build_object(''schema'',%L,''table'',%L,''count'',count(*),''sha256'',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E''\n'' order by to_jsonb(r)::text),''''),''UTF8'')),''hex'')) from %I.%I r',s,t,s,t) into result;
 return result;
end $$;
select pg_temp.application_digest(schemaname,tablename)
from pg_tables where schemaname in ('public','supabase_migrations')
order by schemaname,tablename;
commit;
SQL
psql -X -qAt -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/application-digests.sql" \
  > "$REHEARSAL_ROOT/baseline-digests.jsonl"
```

## 3. Make and bind the recovery checkpoint

Use the independent traffic isolation and drained inactive schedules above to
keep the synthetic application stationary. `pg_dump` provides its consistent
snapshot; a parallel application-data measurement must use that snapshot, or
be taken while the same drain is independently maintained. Managed logs can
continue changing and are not application equality evidence.

```bash
pg_dump --role=postgres --lock-wait-timeout=10s --format=custom --create \
  --file="$REHEARSAL_ROOT/baseline.dump"
pg_dumpall --role=postgres --roles-only --no-role-passwords > "$REHEARSAL_ROOT/baseline-roles.sql"
pg_dump --role=postgres --lock-wait-timeout=10s --schema-only --schema=public --schema=supabase_migrations \
  --file="$REHEARSAL_ROOT/baseline-app-schema.sql"
pg_restore --list --schema=public --schema=supabase_migrations \
  "$REHEARSAL_ROOT/baseline.dump" > "$REHEARSAL_ROOT/application.toc.full"
```

Keep the **full** archive unchanged. Make a separate application TOC selection,
retaining all table/function/constraint/index/trigger/RLS/data/owner/object-ACL
entries, while excluding existing schema containers and **all default-ACL**
entries. Their original catalog objects stay in place; skipping their replay
must not skip application object ACLs. No roles/auth/storage/net/cron data are
replayed into this managed project. `--clean` alone cannot remove new objects
that were absent from the baseline archive. Do not use `--no-owner`, `--no-acl`,
`--disable-triggers`, `session_replication_role=replica`, or schema CASCADE.

```bash
python3 - "$REHEARSAL_ROOT" <<'PY'
import pathlib,re,sys
p=pathlib.Path(sys.argv[1]); lines=(p/'application.toc.full').read_text().splitlines()
out=[]
for s in lines:
    skip=bool(re.search(r'\bDEFAULT ACL\b|\bSCHEMA - (public|supabase_migrations)\b|\b(?:ACL|COMMENT) - SCHEMA (public|supabase_migrations)\b',s))
    out.append('; '+s if skip and not s.startswith(';') else s)
(p/'application.toc').write_text('\n'.join(out)+'\n')
PY
pg_restore --use-list="$REHEARSAL_ROOT/application.toc" \
  --file="$REHEARSAL_ROOT/application-restore.sql" "$REHEARSAL_ROOT/baseline.dump"
export REHEARSAL_BACKUP_SHA="$(shasum -a 256 "$REHEARSAL_ROOT/baseline.dump" | cut -d ' ' -f 1)"
fnm exec --using=22.23.1 node --input-type=module <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
const e=process.env,b=JSON.parse(readFileSync(`${e.REHEARSAL_ROOT}/bootstrap-binding.json`));
b.backupSha256=e.REHEARSAL_BACKUP_SHA;
writeFileSync(`${e.REHEARSAL_ROOT}/binding.json`,JSON.stringify(b),{flag:'wx',mode:0o400});
JS
fnm exec --using=22.23.1 node scripts/production-history-hosted-artifacts.mjs \
  "$REHEARSAL_ROOT/binding.json" "$REHEARSAL_ROOT/transition"
(cd "$REHEARSAL_ROOT/transition" && shasum -a 256 -c SHA256SUMS)
chmod 400 "$REHEARSAL_ROOT/baseline.dump" "$REHEARSAL_ROOT/application.toc" \
  "$REHEARSAL_ROOT/application-restore.sql"
```

Before applying any pending migration, capture the complete baseline application
ACL metadata while the same independent drain remains in force. This covers all
34 baseline public tables, `supabase_migrations.schema_migrations`, and every
public function; unsupported public relation/type/extension forms, column ACLs,
owners or grantors fail closed. The snapshot includes raw ACLs for audit and
normalized privileges (including NULL ACL defaults and unambiguous PUBLIC),
grant options and stable object identities. No application row is emitted.

```bash
fnm exec --using=22.23.1 node scripts/production-history-application-acl.mjs capture \
  "$REHEARSAL_ROOT/binding.json" "$REHEARSAL_ROOT/application-acl-capture"
(cd "$REHEARSAL_ROOT/application-acl-capture" && shasum -a 256 -c SHA256SUMS)
# noclobber preserves a previous failed/partial capture too: inspect it, never replace it.
(set -o noclobber; psql -X -qAt -v ON_ERROR_STOP=1 \
  -f "$REHEARSAL_ROOT/application-acl-capture/capture.sql" \
  > "$REHEARSAL_ROOT/baseline-application-acl.json")
chmod 400 "$REHEARSAL_ROOT/baseline-application-acl.json"
fnm exec --using=22.23.1 node scripts/production-history-application-acl.mjs reconcile \
  "$REHEARSAL_ROOT/binding.json" "$REHEARSAL_ROOT/application-acl" \
  "$REHEARSAL_ROOT/baseline-application-acl.json"
(cd "$REHEARSAL_ROOT/application-acl" && shasum -a 256 -c SHA256SUMS)
```

Both packages reuse the original target/nonce/source/archive binding. The offline
helper validates the snapshot before writing anything; its immutable checksum
manifest binds the snapshot and generated SQL. On retry, repeat both helper
commands and checksum checks with the original inputs, without recapturing the
baseline. Changed inputs or tampered owned artifacts stop before any overwrite.
Copy these files with the independent checkpoint and preserve their hashes in
the receipt. A new run gets a new directory; the old FAILED rehearsal evidence
must never be overwritten.

Each dump opens a new connection and explicitly selects `postgres`; a previous
psql SET ROLE does not carry over. pg_dump takes its own read-only consistent
snapshot; `PGOPTIONS` is not used as proof of session settings through a hosted
pooler. Role export is separate metadata, not part of the MVCC data snapshot.

Review the selected TOC and generated restore SQL offline; no application ACL
may be silently excluded, and no managed schema/role/default-ACL mutation may be
included. Record their SHA-256 alongside the full archive hash and final
source/helper hashes. Copy the checkpoint to an owner-only location outside
the checkout and verify the copied hash before applying. Retain the finite
owner/expiry record from the production preparation plan; expiry is a review,
not permission for automatic deletion. Never put dumps or raw fixture/real rows
in Git, logs, or CI artifacts.

The original immutable `transition/input.json` includes the actual rehearsal
ref/endpoint/operator/nonce, release SHA, original manifest source SHA, exact
manifest/bridge hashes and backup hash. It stays the input for every attempt.
The helper refuses altered existing files rather than generating a replacement
input from current database contents. File checksums protect accidental drift;
they are not a signature against an operator deliberately replacing both bytes
and checksum files. Preserve their identity in the independent receipt.

## 4. Prepare, apply, verify, finish under isolation

```bash
test "$(shasum -a 256 "$REHEARSAL_ROOT/baseline.dump" | cut -d ' ' -f 1)" = "$REHEARSAL_BACKUP_SHA"
fnm exec --using=22.23.1 node scripts/production-history-hosted-artifacts.mjs \
  "$REHEARSAL_ROOT/binding.json" "$REHEARSAL_ROOT/transition"
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/prepare.sql"
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/verify.sql"
sb --workdir "$REHEARSAL_ROOT/transition/all60" db push \
  --db-url "$REHEARSAL_DB_URL" --dry-run
sb --workdir "$REHEARSAL_ROOT/transition/all60" db push \
  --db-url "$REHEARSAL_DB_URL" --yes
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/verify.sql"
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/finish.sql"
```

Require the dry-run to show only manifest entries 36–60. The normal CLI runs
all unchanged files and records the suffix, including the zero-byte migration.
No `--include-all`, `migration repair`, manual version insertion or altered SQL.
Finish asserts the exact 60 versions, old+1 history generations, preserved
consent/counters, unchanged unrelated original columns, intended manual plan
grants and inactive personal policy/application scheduler; it installs holds on
new public tables. `completed` **still means writes held**.

Disable the new cron job through `cron.alter_job` immediately after it exists,
then verify/drain it. Its newly created application scheduler remains disabled
from creation; no Vault secret, endpoint or push credential is configured.
`finish.sql` checks that flag, but does not itself deactivate the cron job.

```bash
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/guard.sql" \
  -c "select cron.alter_job(jobid,active:=false) from cron.job where jobname='anidachi-inbox-push-drain';" \
  -c "select jobname,active from cron.job order by jobname;" \
  -c "select phase,maintenance from anidachi_transition_20260912.control;"
```

For failure/resume, preserve the failed command's exit code/time, original
input/backup and actual ordered history; verify it is an exact 35–60 prefix.
Do not rerun `prepare.sql` if the control table exists: run `verify.sql` with
the original input. A missing control table plus any pending migration committed
is a hard stop. After diagnosing/removing only the rehearsal fault, repeat the
hash checks, `verify.sql`, dry-run and unchanged `db push` suffix. At history 60
with phase still `prepared` (interruption before phase update), `finish.sql`
performs the checked advancement. A non-prefix history or ambiguous committed
object state requires diagnosis under isolation, not history repair.

Before accepting resume behavior, exercise the separate prefix-failure pass
below. The local harness uses CREATE EVENT TRIGGER; that privilege must not be
assumed for a hosted non-superuser. No event-trigger fault is prescribed here.

## 5. Recover the full application to 35 in the same hosted database

Eligible only while this isolated synthetic project has received no public
activity, new real billing/invitation writes or external delivery. Production
rollback after reopening needs a separate reconciliation decision.

Keep public/API isolation independent of DB triggers. Preserve
`anidachi_transition_20260912` and `anidachi_rehearsal_binding` throughout.
Unschedule only the new drain job and wait for any invocation to finish before
dropping its routine. Leave the two baseline jobs inactive and unchanged.

```bash
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/guard.sql" \
  -c "select cron.unschedule(jobid) from cron.job where jobname='anidachi-inbox-push-drain';" \
  -c "select count(*) as running from cron.job_run_details where status in ('starting','running');"
```

Generate the following candidate cleanup file from the **actual prefix**.
Review its object names against the baseline inventory and the unchanged
migration source before execution. This is bounded to the isolated application
namespace; it is not a general-purpose cleanup tool. Require baseline table
names plus only the twelve additions listed below, no foreign/partitioned
relations, views, sequences, standalone types or extension members there.
Unexpected dependencies make RESTRICT fail and the restore transaction roll
back; resolve the concrete dependency before any retry. Never add CASCADE.

```bash
psql -X -qAt -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/guard.sql" -f - \
  > "$REHEARSAL_ROOT/recovery-cleanup.sql" <<'SQL'
-- Remove noninternal app triggers, including retained bridge holds on tables
-- that are about to be recreated; the bridge itself remains private and intact.
select format('drop trigger %I on %I.%I;',t.tgname,n.nspname,c.relname)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname in ('public','anidachi_private') order by 1;
-- Defaults/check expressions can depend on application routines.
select format('alter table %I.%I drop constraint %I;',n.nspname,c.relname,k.conname)
from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','anidachi_private') and k.contype in ('f','c') order by k.contype desc,1;
select format('alter table %I.%I alter column %I drop default;',n.nspname,c.relname,a.attname)
from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
join pg_class c on c.oid=d.adrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','anidachi_private') order by 1;
-- One multi-object DROP handles dependencies among listed routines.
select 'drop routine '||string_agg(format('%I.%I(%s)',n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),', ' order by n.nspname,p.proname,p.oid)||' restrict;'
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','anidachi_private','anidachi_history_private','anidachi_room_private')
and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e');
-- Complete app table unit includes migration HISTORY DATA, not manual repair.
select 'drop table '||string_agg(format('%I.%I',schemaname,tablename),', ' order by schemaname,tablename)||' restrict;'
from pg_tables where schemaname='public'
or (schemaname='supabase_migrations' and tablename='schema_migrations')
or (schemaname='anidachi_private' and tablename='inbox_push_scheduler');
select 'drop schema if exists anidachi_private restrict;';
select 'drop schema if exists anidachi_history_private restrict;';
select 'drop schema if exists anidachi_room_private restrict;';
-- Baseline required pg_net ABSENT. Only its whole supported extension is removed.
select 'drop extension if exists pg_net restrict;';
SQL
```

The allowed new tables are `account_inbox_push_outbox`, `watch_catalog_snapshots`,
`watch_catalog_aliases`, `watch_history_group_invitation_contexts`,
`watch_history_session_observations`, `watch_history_session_groups`,
`account_manual_plan_grants`, `stripe_subscription_refresh_leases`,
`personal_history_policy`, `personal_watch_sequences`, `room_usage_days_v1`,
`watch_history_edit_receipts`. The only new runtime private table is
`anidachi_private.inbox_push_scheduler`. Routine signatures/owners and moved
private overloads must match the actual canonical prefix; review the generated
DROP list. No `public` or `supabase_migrations` schema/default ACL is dropped.

Do not execute a blank/partial generated file. Require its reviewed list and
SHA-256 in the recovery receipt before this transaction. Re-run the offline ACL
helper against the original snapshot and verify both immutable packages:

```bash
fnm exec --using=22.23.1 node scripts/production-history-application-acl.mjs reconcile \
  "$REHEARSAL_ROOT/binding.json" "$REHEARSAL_ROOT/application-acl" \
  "$REHEARSAL_ROOT/baseline-application-acl.json"
(cd "$REHEARSAL_ROOT/transition" && shasum -a 256 -c SHA256SUMS)
(cd "$REHEARSAL_ROOT/application-acl" && shasum -a 256 -c SHA256SUMS)
```

Include reconciliation after archive replay, before `install_holds()` and COMMIT,
in this same connection and explicit transaction:

```bash
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/guard.sql" \
  -c 'begin;' -f "$REHEARSAL_ROOT/recovery-cleanup.sql" \
  -f "$REHEARSAL_ROOT/application-restore.sql" \
  -f "$REHEARSAL_ROOT/application-acl/reconcile.sql" \
  -c 'select anidachi_transition_20260912.install_holds();' \
  -c "notify pgrst, 'reload schema';" -c 'commit;'
```

The generated pg_restore SQL loads table data before user triggers/FKs from
post-data. Owners and application ACLs are replayed normally. The final hold
installation commits together with recovery. Reconciliation first requires the
exact original object identity/owner inventory, then removes only surplus
privileges or grant options and grants only missing ones. It asserts complete
normalized ACL/owner/grantor equality before hold installation. It preserves
schema/default ACLs and uses RESTRICT for dependency failures. The reconciliation
file contains no COMMIT; transaction-scoped input rejects standalone psql
execution before privilege mutations. Never run it in a separate connection or
remove its final equality assertion. Keep the independent post-restore pg_dump
and schema/catalog comparisons in section 6; normalized ACL equality alone does
not compare routine definitions or managed roles. Any SQL error closes the session
and rolls the whole application transaction back. The prior cron unschedule is
a separate safe, inactive checkpoint; it remains absent after failure and may
be repeated. On disconnect, inspect whether 35 or the prior prefix committed,
verify the artifact/marker, and compare actual definitions/data; do not blindly
rerun DROP/restore against an already successful result.

New pg_net removal must succeed as this non-superuser operator and leave managed
extension topology as recorded. If the platform refuses it, record the concrete
error and keep recovery unaccepted; do not grant superuser or surgically delete
extension members. Do not rewind managed cron IDs/history or remove managed
logs to force whole-cluster equality. Keep bounded no-op tick/sequence residuals
explicitly separate from restored application behavior.

## 6. Verify recovery, test holds, release only the rehearsal

Run `guard.sql`, then the **original** `verify.sql` only after all new objects
have been removed and the exact baseline history restored. It verifies the old
archive, original public-column digests, scheduler names/flags and reinstated
holds even if its retained phase was `completed`. That old phase is not a new
recovery receipt. Record a separate aggregate recovery result.

```bash
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/verify.sql"
psql -X -qAt -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/guard.sql" -c "select jsonb_agg(version order by version) from supabase_migrations.schema_migrations;" \
  > "$REHEARSAL_ROOT/restored-versions.json"
cmp "$REHEARSAL_ROOT/baseline-versions.json" "$REHEARSAL_ROOT/restored-versions.json"
```

```bash
psql -X -qAt -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/application-digests.sql" \
  > "$REHEARSAL_ROOT/restored-digests.jsonl"
cmp "$REHEARSAL_ROOT/baseline-digests.jsonl" "$REHEARSAL_ROOT/restored-digests.jsonl"
pg_dump --role=postgres --lock-wait-timeout=10s --format=custom \
  --schema=public --schema=supabase_migrations --file="$REHEARSAL_ROOT/restored-application.dump"
pg_restore --list "$REHEARSAL_ROOT/restored-application.dump" \
  > "$REHEARSAL_ROOT/restored-application.toc.full"
python3 - "$REHEARSAL_ROOT" <<'PY'
import pathlib,re,sys
p=pathlib.Path(sys.argv[1]); lines=(p/'restored-application.toc.full').read_text().splitlines()
# Exclude only this bridge trigger from the schema equality projection.
lines=['; '+s if re.search(r'\bTRIGGER public \S+ production_history_maintenance postgres$',s) else s for s in lines]
(p/'restored-schema.toc').write_text('\n'.join(lines)+'\n')
PY
pg_restore --schema-only --use-list="$REHEARSAL_ROOT/restored-schema.toc" \
  --file="$REHEARSAL_ROOT/restored-app-schema.sql" "$REHEARSAL_ROOT/restored-application.dump"
# Ignore only generated psql restrict/unrestrict tokens, if this client emits them.
python3 - "$REHEARSAL_ROOT" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
for stem in ['baseline','restored']:
    lines=(p/f'{stem}-app-schema.sql').read_text().splitlines()
    (p/f'{stem}-app-schema.compare.sql').write_text('\n'.join(s for s in lines if not s.startswith(('\\restrict ','\\unrestrict ')))+'\n')
PY
diff -u "$REHEARSAL_ROOT/baseline-app-schema.compare.sql" "$REHEARSAL_ROOT/restored-app-schema.compare.sql"
```

A schema diff stops acceptance for inspection; do not broaden exclusions to
silence it. Dump object order may need semantic review; owners, ACL grantors,
definitions and default privileges must not be waived. These commands do not
compare roles, event triggers or cron; repeat their baseline catalog queries.

Also compare all 34 public tables' **full** row counts/digests, full
`schema_migrations` row content (including names/statements), routine definitions,
security/owner/ACL, columns/defaults, constraints/indexes, user triggers excluding
only `production_history_maintenance`, RLS/policies, schema/default-ACL
objects/provenance, roles/grants, event triggers, baseline extensions, and
baseline cron definitions/approved flags. Require no extra public/private runtime
objects and unchanged marker/archive. `verify.sql` alone checks original columns
and archive integrity; it cannot replace this full object/security comparison.
Use schema-only pg_dump/catalog comparison and independent aggregate snapshots;
never present table counts alone as recovery proof. Record restore duration and
retained archive/selection/helper/source hashes with actual non-superuser identity.

Prove a service-role INSERT/UPDATE/DELETE/TRUNCATE (transactional synthetic probe)
still fails with `55000 PRODUCTION_HISTORY_MAINTENANCE`, and a normal operator
transaction can read the restored baseline. Keep rollback-only probes separate
from actual archive equality. No real account/client acceptance is claimed.

After recovery equality passes, test hold removal only inside the still isolated
rehearsal project. Keep baseline cron flags inactive during this exercise; the
real production reopening step must restore the recorded original active flags
only with its compatible runtime and independent traffic controls in place.

```bash
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/guard.sql" -f - <<'SQL'
begin;
do $$ declare t record; begin
 for t in select c.relname from pg_trigger g join pg_class c on c.oid=g.tgrelid
 join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and g.tgname='production_history_maintenance'
 and g.tgfoid='anidachi_transition_20260912.block_runtime_writes()'::regprocedure
 loop execute format('drop trigger production_history_maintenance on public.%I',t.relname); end loop;
end $$;
update anidachi_transition_20260912.control set maintenance=false;
commit;
SQL
```

Once maintenance=false, original bridge verification deliberately refuses;
keep its completed recovery verification receipt from before unlock. Perform
only authorized synthetic rollback-only writes, then retain the aggregate proof,
remove the temporary project using its exact checked ref, and resume staging via
the [window procedure](free-rehearsal-window.md). Do not delete the target before
copying/verifying its recovery evidence. Re-read ref/nonce/control-plane identity
before deletion; do not use a broad project selector. No deletion command here
can remove the retained local real production archive. The production transition remains gated
until the hosted result, maintenance controls and release sequence are reviewed.

## Separate later pass: committed-prefix failure

Run this only **after a successful straight 35 -> 60 -> 35 recovery**, on another
fresh synthetic 35 baseline prepared with sections 1–4 through `prepare.sql`,
before its first pending `db push`. Keep the first pass's archive/receipt
immutable outside the project before deleting/recreating the temporary project.
Use a new nonce, binding, checkpoint and local directory; never recycle the
first transition's completed control record into a new campaign.

This fault is a temporary CHECK constraint on the history table in this
nonce-bound disposable project. It rejects one exact future version's normal
CLI history insertion without editing migration files or existing history rows.
Choose one named boundary per pass:

| Expected committed prefix | Denied next version | Risk exercised |
| --- | --- | --- |
| 37 | `20260904205540` | Canonical destructive reset and its history atomicity |
| 38 | `20260905083000` | Failure immediately after the reset boundary |
| 50 | `20260908040654` | Nonempty file without explicit BEGIN/COMMIT |

```bash
export REHEARSAL_DENIED_VERSION=20260904205540
export REHEARSAL_EXPECTED_PREFIX=37
fnm exec --using=22.23.1 node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {manifest,verifyManifest} from './scripts/production-history-transition.mjs';
verifyManifest();
const n=Number(process.env.REHEARSAL_EXPECTED_PREFIX);
assert.ok([37,38,50].includes(n));
assert.equal(manifest.migrations[n].version,process.env.REHEARSAL_DENIED_VERSION);
JS
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/verify.sql"
psql -X -v ON_ERROR_STOP=1 -v denied="$REHEARSAL_DENIED_VERSION" \
  -f "$REHEARSAL_ROOT/transition/guard.sql" -f - <<'SQL'
begin;
do $$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>35
 or (select phase from anidachi_transition_20260912.control)<>'prepared'
 then raise exception 'FRESH_PREPARED_35_REQUIRED'; end if;
end $$;
alter table supabase_migrations.schema_migrations
 add constraint rehearsal_deny_one_version check(version<>:'denied') not valid;
commit;
SQL
if sb --workdir "$REHEARSAL_ROOT/transition/all60" db push \
  --db-url "$REHEARSAL_DB_URL" --yes; then
  printf 'STOP: expected rehearsal failure did not occur\n' >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/guard.sql" \
  -c "select version from supabase_migrations.schema_migrations order by version;" \
  -c "select phase,maintenance from anidachi_transition_20260912.control;"
```

Require the actual error to name `rehearsal_deny_one_version`, and the ordered
history to equal the exact expected manifest prefix. Then inspect the failed
file's known objects and data: for `20260904205540`, old session/settings rows,
generation values, schema checks and catalog tables; for `20260905083000`, its
observed-season index; for `20260908040654`, `rooms.presence_room_generation` and
its recent-person routines. Compare with the exact source, not just max version.

A file's explicit COMMIT may leave schema/data committed before history insert
fails. That result is **not** safe suffix-resume proof even if history is an exact
prefix. Keep isolation, record the outcome, and perform the proven complete
application recovery from section 5. Do not insert the missing version or call
migration repair. If and only if the failing file's changes are proved rolled
back, remove the single fault, verify the original archive/holds and resume the
unchanged suffix:

```bash
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/guard.sql" \
  -c 'alter table supabase_migrations.schema_migrations drop constraint rehearsal_deny_one_version;'
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/verify.sql"
fnm exec --using=22.23.1 node scripts/production-history-hosted-artifacts.mjs \
  "$REHEARSAL_ROOT/binding.json" "$REHEARSAL_ROOT/transition"
sb --workdir "$REHEARSAL_ROOT/transition/all60" db push \
  --db-url "$REHEARSAL_DB_URL" --dry-run
sb --workdir "$REHEARSAL_ROOT/transition/all60" db push \
  --db-url "$REHEARSAL_DB_URL" --yes
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/finish.sql"
```

This is a candidate fault procedure, not a hosted result or a guarantee of CLI
atomicity for every file. Reuse the measured recovery and close the temporary
project/window through the same controlled teardown.

## Primary references and observed preparation limits

- [Supabase CLI db push](https://supabase.com/docs/reference/cli/supabase-db-push): normal migration history and dry-run; actual 2.111.0 help was read for push, query, link, create and delete.
- [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres): direct/session endpoints and 5432/6543 distinction.
- [CLI connection parser](https://github.com/supabase/cli/blob/develop/apps/cli/src/legacy/shared/legacy-db-config.layer.ts): Context7-first lookup for `--db-url` versus linked credentials; runtime behavior still needs the selected hosted connection test.
- [PostgreSQL 17 ACL catalog functions](https://www.postgresql.org/docs/17/functions-info.html) and [REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html): normalized ACL defaults, grant options and RESTRICT dependency behavior.
- [PostgreSQL 17 pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html): archive TOC selection, ownership/ACL replay and error handling.
- [Supabase backup/restore guidance](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): managed boundary differs from a raw cluster replacement.

The ACL correction has a separate local PostgreSQL 17.6 proof under ordinary
non-superuser `postgres`: real pg_dump replay reproduces the surplus-default-grant
bug, and transactional reconciliation restores exact normalized ACLs, owners and
grantors while preserving legitimate grants and default ACLs. Tests include NULL
and explicit-empty ACLs, grant options, quoted overloads, unsupported objects and
security metadata, immutable-input tampering, standalone misuse, repeated
reconciliation and forced failure preserving pre-restore rows/OIDs/ACLs. The
focused offline bundle passes 12 tests with no skips.

The local integration harness requires an already-running, freshly initialized
synthetic PostgreSQL 17 container, with ordinary `postgres` owning database and
public schema, synthetic anon/authenticated/service_role memberships and the
owner-test schema permission. It checks the `anidachi.task=acl-recovery-20260912`
label, network `none`, no published ports and an empty application fixture before
creating anything. Container setup/cleanup is a separate local operator action;
the harness uses only inspect/exec and never resets an existing fixture.

```bash
# Explicitly select the already-approved local Docker context; do not switch it globally.
DOCKER_CONTEXT=colima-anidachi-personal-mvp fnm exec --using=22.23.1 node \
  scripts/production-history-application-acl.integration.mjs anidachi-acl-fresh-test
```

This local result does not replace the earlier FAILED hosted security comparison.
Fresh hosted permission/dependency cleanup, exact recovery equality,
interrupted-prefix behavior and actual hold release remain acceptance gates;
this command package is not an acceptance receipt.
