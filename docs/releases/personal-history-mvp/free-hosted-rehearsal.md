# Free hosted 35 -> 60 -> 35 rehearsal commands

Status: **straight hosted recovery and interrupted prefix 37 accepted on 2026-09-12; prefixes 38 and 50 remain pending**.
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

## Accepted interrupted prefix 37, 2026-09-12

The frozen package at `4cebafab` completed a new synthetic Free-project failure
and same-target recovery under ordinary non-superuser `postgres`, PostgreSQL
17.6 and native CLI 2.111.0. Independent review accepted this target's
**application-scoped recovery** before its write holds were released.

- The injected CHECK rejected the normal CLI history INSERT for
  `20260904205540`, leaving the exact 37-version prefix. The native CLI exited
  with code 1 and reported SQLSTATE `23514`; effects after the authored COMMIT remained,
  including v3 objects and emptied legacy history relations. The checker returned
  `canResume=false` and required complete application recovery. No suffix retry
  or migration-history repair was performed.
- Full recovery restored all 35 original ordered migration versions, all 35
  full application/history relation digests, the application schema and all
  76 application ACL objects. Fresh post-recovery capture confirmed the exact
  original bridge control, including its preparation time; original archive,
  binding and nonce were retained.
- Existing managed catalog state matched apart from the accounted private
  bridge schema and the sole conditionally accepted `supabase_functions_admin`
  residual. The earlier migration in this prefix installs `pg_net`; fresh
  baseline/post-install/post-cleanup receipts passed all six policy conditions
  for this target. No preexisting managed role, credential, membership or default privilege
  was changed. PUBLIC-derived access and the managed authentication boundary
  remain explicit; loaded HBA is unknown and whole-cluster equality is not claimed.
- INSERT, UPDATE, DELETE and TRUNCATE were rejected with SQLSTATE `55000`
  while holds remained active. After independent acceptance and release on this
  isolated target, all four rollback-only service-role writes passed and all
  35 relation digests remained unchanged.
- All 304 evidence files were independently copied and byte/hash-verified
  before deleting the disposable project. The third staging-only window closed
  at 18:18:53 UTC after 38m54s, within its 45-minute bound. Staging's exact
  migrations, original jobs and Worker configuration were restored; account
  history, Inbox and normal extension room creation/completion passed.

Exact target, archive, input and query identities remain in restricted receipts
outside Git. Prefixes **38 and 50 were not started**; the production operating
sequence and fresh maintenance-bound checkpoint also remain open. Production,
paid plans and shared Git branches were unchanged. This closed window does not
authorize another staging pause or a production transition.

## Accepted second rehearsal, 2026-09-12

The corrected package at `bb0b546c` completed a fresh isolated Free-project
35 -> 60 -> 35 rehearsal under ordinary non-superuser `postgres`, PostgreSQL
17.6 and native CLI 2.111.0. Independent review accepted this target's
**application-scoped recovery** before the rehearsal write holds were released.

- All 35 ordered migration versions and all 35 full application/history
  relation digests matched the original immutable checkpoint. The application
  schema matched after excluding only generated psql restrict tokens and the
  34 explicitly identified bridge maintenance triggers.
- All 76 baseline application ACL objects matched, including owners,
  privileges, grantors and grant options. Existing roles, memberships, settings,
  schema/default ACLs, extensions, event triggers, publications and inactive
  baseline job definitions remained unchanged. The retained private bridge
  schema was accounted for separately.
- Fresh bound baseline, post-install and post-cleanup receipts passed the six
  conditions below. Independent review explicitly accepted only the named
  platform-created `supabase_functions_admin` residual for this recovery.
  No managed role, membership, credential or default privilege was changed.
  This does not claim whole-cluster or bitwise role-catalog equality: the role
  retains PUBLIC-derived privileges and the documented managed authentication
  trust boundary; loaded HBA remains unknown.
- INSERT, UPDATE, DELETE and TRUNCATE were denied with the maintenance SQLSTATE
  before release. After recorded acceptance and hold removal, all four
  rollback-only service-role writes succeeded; full baseline digests remained
  identical and baseline jobs stayed inactive.
- Original artifacts and recovery receipts were copied and byte-verified before
  deleting the disposable project. Deletion and window-closure receipts were
  subsequently copied and verified as well. The second staging-only window closed at
  14:59:41 UTC after 38m10s, with staging restored and account/room flows checked.
  Production and paid plans were unchanged.

Exact target/input/archive/query hashes and producing times remain in restricted
operator receipts outside Git. The earlier failed run below remains failed.
No interrupted-prefix campaign was started in this window, preserving time for
staging restoration. That proof, the production operating sequence, and a fresh
maintenance-bound production checkpoint remain separate release prerequisites.

## Executed result and correction gate

The first candidate at `c0b0bb93` ran in an isolated, synthetic Free project under
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

**The original failed command package is not an accepted recovery procedure.**
The correction required binding a complete baseline application-object privilege
snapshot to the immutable artifacts. Reconcile exact privileges, grant options,
owners and grantors inside the cleanup/restore transaction, with an equality
assertion before commit. Preserve legitimate client grants and existing default
privileges; reject unsupported owners, grantors or object/column ACL forms rather
than applying blanket revocations or changing managed catalogs. Test this under
PostgreSQL 17 non-superuser privileges with surviving default ACLs and forced
transaction failure. Separately resolve the residual managed role through a
supported platform procedure or an explicitly reviewed recovery policy.
The ACL correction below and guarded capture workflow subsequently passed the
fresh hosted application recovery recorded above. Conditional-policy acceptance
belongs only to that measured target; a later target still requires its own
complete receipts and explicit acceptance. Interrupted-prefix proof and the
remaining Task 2/4 production prerequisites stay open.

Current [Supabase platform source](https://github.com/supabase/postgres/blob/develop/migrations/db/init-scripts/00000000000003-post-setup.sql)
supports the recorded `pg_net` role origin, but provides no customer cleanup
procedure for this residual role. Extension removal and role administration are
different privileges; PostgreSQL 17 requires CREATEROLE and ADMIN OPTION for
ordinary [role removal](https://www.postgresql.org/docs/17/sql-droprole.html).
Keep managed roles untouched. The following conditional policy has independent
review approval for **application-scoped recovery**, not a passed hosted result:

1. Keep the original baseline and FAILED receipt unchanged. This policy applies
   only when `supabase_functions_admin` is absent before the pending chain and
   appears through the recorded `extensions.grant_pg_net_access()` platform hook.
   A preexisting role or another origin requires a separate baseline decision.
   Prefixes before role creation retain strict role equality, with no exception.
2. Capture the hook definition/owner and matching event trigger before pg_net,
   then capture installed pg_net version/owner/schema and the resulting role.
   The expected hook and `issue_pg_net_access` trigger are owned by
   `supabase_admin`; the recorded CREATE EXTENSION path must explain the role.
   The only permitted added principal is exactly `supabase_functions_admin`:
   LOGIN/CREATEROLE true; INHERIT/SUPERUSER/BYPASSRLS/CREATEDB/REPLICATION false;
   connection_limit -1; valid_until NULL. This is a retained LOGIN/CREATEROLE
   role, not an inert or credential-free principal inferred from absence.
3. On the new target immediately before recovery acceptance, require zero
   cluster-wide `pg_shdepend` references, zero `pg_auth_members` edges involving
   it as role, member **or grantor**, no role settings and no sessions. All five
   checked roles—anon, authenticated, authenticator, service_role and postgres—
   must exist, with both SET directions exactly false. Staging's observed net
   schema ACL dependency is not the required post-drop zero result.
4. Recheck `password_configured` is exactly false using only the server-side
   NULL predicate on this role's password. Missing role/field, partial inventory,
   NULL/unavailable checks, permission errors, a configured password or an
   unexplained customer-accessible non-password path keep acceptance closed.
   Loaded HBA remains unknown: the prior ordinary-operator read was denied by
   its underlying function. Do not query it again, bypass its permissions or
   attempt a login as the role. This policy relies on the documented managed
   customer password/SCRAM connection contract; privileged internal platform
   access stays within the existing managed-service trust boundary. Changed or
   contradictory platform/authentication evidence is a stop, not an exception.
5. Preserve strict application data/schema/owners/ACLs/grantors/options,
   schema/default ACLs, preexisting roles/memberships/settings and disabled-job
   comparisons. Record PUBLIC-derived database/schema privileges in the receipt
   and PUBLIC routine EXECUTE in the existing application ACL snapshot; never
   call this zero access. The residual role may receive no explicit application
   grant or ownership. Do not rewrite the baseline role dump, pre-seed a role,
   replay role SQL, DROP/ALTER the role, add membership/credentials, change
   defaults or broadly ignore `supabase_*` differences. Every other delta fails.
6. Preserve all producing SQL/source, original target/input hashes and capture
   times. Record explicit conditional-policy acceptance for this single retained
   principal and narrowed scope only after every fresh post-cleanup measurement
   and ordinary recovery comparison passes. Missing/partial/unreadable evidence
   remains failure/unknown. Do not claim bitwise role-catalog, whole-cluster or
   prior hosted equality. Independent review of capture source remains separate
   from policy review. No new pause/window, cloud mutation, role cleanup, hold
   release or production action is authorized by the policy or its receipts.

The earlier read-only staging observation (no configured password, no relevant
SET paths, no settings/sessions and one net ACL dependency) informed policy
review. It is not a measurement of the deleted rehearsal or a future recovery.


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
fnm exec --using=22.23.1 node --test scripts/production-history-hosted-artifacts.test.mjs scripts/production-history-application-acl.test.mjs scripts/production-history-prefix-proof.test.mjs
```

After the window is approved, verify the creation screen's actual Free
entitlement and the current zero-cost quote for the approved organization.
Create the new project through its Dashboard or the authenticated native CLI
with the same agreed name, organization and region, with no upgrade, add-on,
paid size, clone or PITR. The second run used the native CLI with a generated
disposable password kept only in the operator session's memory; no existing
project credential was changed.
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

Capture the managed-role receipt in this same drained baseline, before any
pending migration can install pg_net. The reusable
[metadata SELECT](../../../scripts/production-history-managed-role-receipt.sql)
uses one psql JSON binding and the existing disposable target guard. It emits
one JSON receipt, including source/input/target/time, ordinary operator/server
identity, the complete specified role tuple, boolean password state, all relevant
membership/dependency edges, setting names only, session count, the explicit
five-role SET inventory, PUBLIC database/schema ACLs and named platform hook.
It reads no password/hash value, other function definitions, application rows,
HBA or GUC values. A missing managed role produces `exists=false` and NULL
role-dependent fields; baseline absence is explicit, not a false password result.

Define this command in the same operator terminal. The original transition input
and reviewed SQL bytes must still match the pinned release. The SQL copy and
receipts are immutable; a failed/partial capture remains in its original file.
The function validates receipt structure/producer identity only; it does not
classify policy acceptance or release holds.

```bash
capture_managed_role_receipt() {
  local role_phase="$1"
  case "$role_phase" in baseline|pg-net-installed|post-cleanup) ;; *) return 1 ;; esac
  test "$(git rev-parse HEAD)" = "$REHEARSAL_RELEASE_SHA"
  git diff --quiet "$REHEARSAL_RELEASE_SHA" -- scripts/production-history-managed-role-receipt.sql
  (cd "$REHEARSAL_ROOT/transition" && shasum -a 256 -c SHA256SUMS)
  local receipt_context
  receipt_context="$(fnm exec --using=22.23.1 node --input-type=module - "$role_phase" <<'JS'
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildArtifacts,writeArtifacts} from './scripts/production-history-hosted-artifacts.mjs';
const e=process.env,root=e.REHEARSAL_ROOT;
const original=readFileSync(`${root}/transition/input.json`,'utf8'),input=JSON.parse(original);
assert.equal(buildArtifacts(input.target)['input.json'],original);
assert.equal(input.target.releaseCommit,e.REHEARSAL_RELEASE_SHA);
const sql=readFileSync('scripts/production-history-managed-role-receipt.sql');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
writeArtifacts(`${root}/managed-role-source`,{'receipt.sql':sql,'SHA256SUMS':`${sha(sql)}  receipt.sql\n`});
console.log(JSON.stringify({phase:process.argv[2],input_sha256:sha(original),query_sha256:sha(sql),source_commit:e.REHEARSAL_RELEASE_SHA,target:input.target}));
JS
)"
  (cd "$REHEARSAL_ROOT/managed-role-source" && shasum -a 256 -c SHA256SUMS)
  local role_receipt="$REHEARSAL_ROOT/managed-role-$role_phase.json"
  (set -o noclobber; psql -X -qAt -v ON_ERROR_STOP=1 -v receipt_context="$receipt_context" \
    -f "$REHEARSAL_ROOT/transition/guard.sql" -c 'begin read only;' \
    -f "$REHEARSAL_ROOT/managed-role-source/receipt.sql" -c 'commit;' > "$role_receipt")
  chmod 400 "$role_receipt"
  (cd "$REHEARSAL_ROOT"; set -o noclobber; shasum -a 256 "managed-role-$role_phase.json" > "managed-role-$role_phase.json.sha256")
  chmod 400 "$role_receipt.sha256"
  fnm exec --using=22.23.1 node --input-type=module - "$role_receipt" <<'JS'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const r=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert.equal(r.format,1);assert.equal(r.context_complete,true);
assert.equal(r.producer.session_user,'postgres');assert.equal(r.producer.effective_user,'postgres');
assert.equal(r.producer.effective_superuser,false);assert.equal(r.producer.transaction_read_only,'on');
JS
}
capture_managed_role_receipt baseline
```

For this policy, require the baseline role and pg_net to be absent, the named
platform hook/event trigger to be present with the reviewed origin, and all five
expected application/operator roles to exist. Inspect every field; the structure
check above is not an acceptance decision. Copy and checksum-verify the original
baseline receipt, source SQL and each later receipt alongside the independent
checkpoint. Preserve the existing baseline roles dump and membership/settings
measurements; this narrowly scoped receipt does not replace them. On an error,
retain the partial file and stop. Never rerun into an existing phase filename or
replace old FAILED evidence with a new capture.

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
capture_managed_role_receipt pg-net-installed
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/verify.sql"
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/finish.sql"
```

Inspect the post-install receipt for pg_net and the exact recorded hook/role
origin before proceeding. For an interrupted committed prefix, preserve its
failure receipt and measure the actual state under isolation. If it already
created the role, capture the post-install origin before cleanup; if it did not,
retain strict role equality and do not manufacture a role exception or claim a
pg-net-installed phase.

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
is a hard stop. A history prefix alone cannot show that the unrecorded file
rolled back. Committed or uncertain effects require complete baseline recovery;
do not retry the file or repair its history row. Only after the specific failure
and absence of its effects are proved may the single rehearsal fault be removed,
followed by the hash checks, `verify.sql`, dry-run and unchanged `db push` suffix.
At history 60
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

Immediately before accepting recovery, take the fresh post-cleanup receipt:

```bash
capture_managed_role_receipt post-cleanup
```

For a run that created the role, compare all three immutable receipts and the
unchanged baseline role/catalog and application evidence against the six
conditions above. Require pg_net absent,
the sole permitted residual role's full expected tuple, password exactly false,
zero cluster shared dependencies, zero membership edges including grantor, no
settings/sessions and all five bidirectional SET checks available and false.
Missing role/field, permission error or another mismatch leaves the result
failed/unknown. An interrupted prefix that never created the role needs baseline
absence and strict equality, without a fabricated post-install receipt or the
conditional exception. Record explicit
conditional-policy acceptance and its scope in the new aggregate recovery
receipt before any hold release. This does not convert the earlier FAILED run
or current staging observation into accepted recovery.

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
Use a new nonce, binding, checkpoint and local directory; never recycle a
completed control record into a new campaign. The earlier window is closed;
this procedure requires its own agreed staging-only window.

The fault is one temporary CHECK constraint on the history table in this
nonce-bound disposable project. It rejects one future version's normal CLI
history insertion without editing migrations or existing history rows.
Choose one named boundary per fresh pass:

| Expected committed prefix | Denied next version | Required result handling |
| --- | --- | --- |
| 37 | `20260904205540` | Authored COMMIT precedes history insertion: complete baseline recovery, never suffix retry |
| 38 | `20260905083000` | Same transaction boundary: complete baseline recovery, never suffix retry |
| 50 | `20260908040654` | Resume only after exact fault and failed-file rollback evidence; otherwise complete recovery |

The [local native-CLI evidence](2026-09-12-prefix-cli-atomicity.json) confirms the
transaction distinction on isolated synthetic fixtures with CLI 2.111.0. It does
not accept a hosted prefix or replace fresh recovery evidence. In the pinned
[source runner](https://github.com/supabase/cli/blob/ae89b16c7e0e472c849d89c947513872b3c537f5/apps/cli/src/legacy/shared/legacy-migration-apply.ts#L116-L220),
the history INSERT follows the file's statements. An authored COMMIT can therefore
leave application effects committed while the history row is absent. A history
count, maximum version or exact prefix alone cannot authorize retry.

The fixed-case [offline checker](../../../scripts/production-history-prefix-proof.mjs)
emits a guarded read-only capture and assesses saved receipts. It cannot connect,
remove a fault or run a migration. It binds the decision to the original
ref/nonce/source/backup, reviewed CLI artifact, complete ordered `(version,name)`
ledger, precise history-insert error and before/after observations. It always
returns `canResume=false` for 37/38. Missing or contradictory evidence fails closed.

For 50, the failed file's only top-level effects are the new
`rooms.presence_room_generation` column/check and
`record_recent_room_presence_v1(jsonb)` definition/privileges. Capture their full
metadata before the first push at **35**, then require them still absent after
failure at **50**. The frozen preceding 50 files do not mention either target.
Other legitimate changes from versions 36–50 must not be compared to a whole
35-version schema as if they were partial failed-file effects.

Use Bash, owner-only files and no-clobber output. Select the native executable
path from the reviewed local CLI provenance; the runner below refuses a different
binary hash or version. A future platform/CLI artifact requires a new source
review and local proof rather than changing the expected hash to make it pass.

```bash
export REHEARSAL_EXPECTED_PREFIX=37
export REHEARSAL_DENIED_VERSION=20260904205540
export REHEARSAL_PREFIX_ROOT="$REHEARSAL_ROOT/prefix-$REHEARSAL_EXPECTED_PREFIX"
# Set to the resolved native executable recorded in the reviewed local proof.
export REHEARSAL_SB_BINARY='/absolute/path/to/the/reviewed/native/supabase'
umask 077
set -euo pipefail
set -o noclobber
mkdir -m 700 "$REHEARSAL_PREFIX_ROOT"
fnm exec --using=22.23.1 node scripts/production-history-prefix-proof.mjs capture \
  "$REHEARSAL_ROOT/binding.json" "$REHEARSAL_EXPECTED_PREFIX" \
  > "$REHEARSAL_PREFIX_ROOT/capture.sql"
fnm exec --using=22.23.1 node --input-type=module <<'JS' \
  > "$REHEARSAL_PREFIX_ROOT/expected-cli.json"
import assert from 'node:assert/strict';
import {manifest,verifyManifest} from './scripts/production-history-transition.mjs';
import {CLI_VERSION,CLI_BINARY_SHA256} from './scripts/production-history-prefix-proof.mjs';
verifyManifest();
const n=Number(process.env.REHEARSAL_EXPECTED_PREFIX);
assert.ok([37,38,50].includes(n));
assert.equal(manifest.migrations[n].version,process.env.REHEARSAL_DENIED_VERSION);
console.log(JSON.stringify({version:CLI_VERSION,binarySha256:CLI_BINARY_SHA256}));
JS
capture_prefix_receipt() {
  CAPTURE_NAME="$1" python3 <<'PYTHON'
import json, os, subprocess
from datetime import datetime, timezone
from pathlib import Path
root=Path(os.environ['REHEARSAL_PREFIX_ROOT'])
name=os.environ['CAPTURE_NAME']
assert name in ('before','after')
r=subprocess.run(['psql','-XqAt','-v','ON_ERROR_STOP=1','-f',str(root/'capture.sql')],
                 capture_output=True,text=True,check=True,timeout=120)
receipt=json.loads(r.stdout)
receipt['capturedLocallyAt']=datetime.now(timezone.utc).isoformat()
with (root/f'{name}.json').open('x') as f:
    json.dump(receipt,f,indent=2); f.write('\n')
PYTHON
}
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/verify.sql"
capture_prefix_receipt before
psql -X -v ON_ERROR_STOP=1 -v denied="$REHEARSAL_DENIED_VERSION" \
  -f "$REHEARSAL_ROOT/transition/guard.sql" -f - <<'SQL'
begin;
do $$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>35
 or (select phase from anidachi_transition_20260912.control)<>'prepared'
 or (select maintenance from anidachi_transition_20260912.control) is distinct from true
 then raise exception 'FRESH_PREPARED_35_REQUIRED'; end if;
end $$;
alter table supabase_migrations.schema_migrations
 add constraint rehearsal_deny_one_version check(version<>:'denied') not valid;
commit;
SQL
```

Retain the actual exit code, both output streams and their hashes; do not use a
bare `if db push` that discards the failure classification. The password-free URL
and every connection field must match the immutable binding. The normal CLI
receives the complete unchanged `all60` directory and selects its pending suffix.

```bash
python3 <<'PYTHON'
import hashlib, json, os, subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
root=Path(os.environ['REHEARSAL_ROOT'])
proof=Path(os.environ['REHEARSAL_PREFIX_ROOT'])
binding=json.loads((root/'binding.json').read_text())
expected=json.loads((proof/'expected-cli.json').read_text())
binary=Path(os.environ['REHEARSAL_SB_BINARY']).resolve(strict=True)
sha=lambda data: hashlib.sha256(data).hexdigest()
assert sha(binary.read_bytes())==expected['binarySha256']
env={k:v for k,v in os.environ.items() if not k.startswith('SUPABASE_')}
assert subprocess.run(['git','rev-parse','HEAD'],capture_output=True,text=True,
                      check=True).stdout.strip()==binding['releaseCommit']
subprocess.run(['git','diff','--quiet'],check=True)
subprocess.run(['git','diff','--cached','--quiet'],check=True)
assert subprocess.run([str(binary),'--version'],env=env,capture_output=True,
                      text=True,check=True,timeout=30).stdout.strip()==expected['version']
for key,field in [('PGHOST','host'),('PGPORT','port'),('PGDATABASE','database'),('PGUSER','user')]:
    assert env.get(key)==str(binding[field])
assert env.get('PGSSLMODE')=='require' and env.get('PGPASSWORD')
url=urlsplit(env['REHEARSAL_DB_URL'])
assert (url.scheme,url.hostname,url.port,url.username,url.password,url.path,url.query)==(
    'postgresql',binding['host'],binding['port'],binding['user'],None,'/postgres','sslmode=require')
started=datetime.now(timezone.utc).isoformat()
try:
    r=subprocess.run([str(binary),'--workdir',str(root/'transition/all60'),'db','push',
                      '--db-url',env['REHEARSAL_DB_URL'],'--yes'],env=env,
                     capture_output=True,timeout=300)
    stdout,stderr,exit_code=r.stdout,r.stderr,r.returncode
except subprocess.TimeoutExpired as error:
    stdout,stderr,exit_code=error.stdout or b'',error.stderr or b'',None
ended=datetime.now(timezone.utc).isoformat()
for name,data in [('stdout',stdout),('stderr',stderr)]:
    with (proof/f'denied-push.{name}.log').open('xb') as f: f.write(data)
attempt={'binding':binding,'expectedPrefix':int(env['REHEARSAL_EXPECTED_PREFIX']),
         'cli':expected,'startedAt':started,'endedAt':ended,'exitCode':exit_code,
         'stdoutSha256':sha(stdout),'stderrSha256':sha(stderr)}
with (proof/'attempt.json').open('x') as f:
    json.dump(attempt,f,indent=2); f.write('\n')
assert sha(binary.read_bytes())==expected['binarySha256']
if exit_code is None:
    raise SystemExit('STOP: CLI timeout; partial evidence retained; complete recovery required')
PYTHON
```

On timeout, interruption, network failure or a different SQL error, keep isolation
and take complete recovery. A timeout retains its partial streams and timing with
`exitCode=null`, which the classifier rejects; a missing/partial receipt never
permits resume.
Disable/drain the new cron job immediately if present, as in section 4. If this
prefix installed `pg_net`, capture its fresh post-install managed-role origin
before cleanup; otherwise preserve baseline absence and strict equality.
Then capture the failed state and assess the fixed case:

```bash
capture_prefix_receipt after
fnm exec --using=22.23.1 node scripts/production-history-prefix-proof.mjs assess \
  "$REHEARSAL_ROOT/binding.json" "$REHEARSAL_EXPECTED_PREFIX" \
  "$REHEARSAL_PREFIX_ROOT" > "$REHEARSAL_PREFIX_ROOT/decision.json"
```

A successful classification requires normal exit 1, the exact
`LegacyDbPushApplyError` with SQLSTATE `23514`, constraint
`rehearsal_deny_one_version`, the denied version in the failing row, and the final
statement equal to the CLI's history INSERT. It also requires the exact expected
ledger, installed fault, original target and prepared/held control state.
Database observation times remain separate from host capture/attempt times;
clock skew between the server and operator is not treated as data divergence.

**For 37/38, proceed directly to sections 5–6 and full application recovery.**
Retain the actual schema/data and catalog/security observations to document the
unrecorded effects; the recovery comparison uses every baseline relation and
application ACL, not a spot check of the reset/index. Never create the missing
history row, call migration repair or rerun the destructive file.

**Only for a classified 50 with `canResume=true`:** independently verify the
original archive/holds and immutable files again. The checker is evidence
validation, not proof that holds remain installed or authorization to reopen.
Require the same live prefix and absent failed-file objects while dropping the
one injected fault; keep all other maintenance controls in place.

```bash
fnm exec --using=22.23.1 node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessPrefixAttempt} from './scripts/production-history-prefix-proof.mjs';
const p=process.env.REHEARSAL_PREFIX_ROOT;
const json=name=>JSON.parse(readFileSync(`${p}/${name}.json`,'utf8'));
assert.equal(Number(process.env.REHEARSAL_EXPECTED_PREFIX),50);
const result=assessPrefixAttempt({binding:JSON.parse(readFileSync(`${process.env.REHEARSAL_ROOT}/binding.json`,'utf8')),
 expectedPrefix:50,before:json('before'),after:json('after'),attempt:json('attempt'),
 stdout:readFileSync(`${p}/denied-push.stdout.log`,'utf8'),stderr:readFileSync(`${p}/denied-push.stderr.log`,'utf8')});
assert.equal(result.canResume,true);
JS
fnm exec --using=22.23.1 node scripts/production-history-hosted-artifacts.mjs \
  "$REHEARSAL_ROOT/binding.json" "$REHEARSAL_ROOT/transition"
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/verify.sql"
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/guard.sql" -f - <<'SQL'
begin;
do $$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>50
 or exists(select 1 from pg_attribute where attrelid='public.rooms'::regclass
           and attname='presence_room_generation' and not attisdropped)
 or exists(select 1 from pg_constraint where conrelid='public.rooms'::regclass
           and conname='rooms_presence_room_generation_check')
 or to_regprocedure('public.record_recent_room_presence_v1(jsonb)') is not null
 then raise exception 'ROLLBACK_PROVED_PREFIX_50_REQUIRED'; end if;
end $$;
alter table supabase_migrations.schema_migrations drop constraint rehearsal_deny_one_version;
commit;
SQL
test "$(shasum -a 256 "$REHEARSAL_SB_BINARY" | cut -d ' ' -f 1)" = \
  "$(fnm exec --using=22.23.1 node --input-type=module -e "import {CLI_BINARY_SHA256} from './scripts/production-history-prefix-proof.mjs'; console.log(CLI_BINARY_SHA256)")"
"$REHEARSAL_SB_BINARY" --workdir "$REHEARSAL_ROOT/transition/all60" db push \
  --db-url "$REHEARSAL_DB_URL" --dry-run
"$REHEARSAL_SB_BINARY" --workdir "$REHEARSAL_ROOT/transition/all60" db push \
  --db-url "$REHEARSAL_DB_URL" --yes
psql -X -v ON_ERROR_STOP=1 -f "$REHEARSAL_ROOT/transition/finish.sql"
```

Resume uses the same pinned CLI artifact and unchanged canonical directory.
Require exact 60 verification, then complete sections 5–6 recovery/equality/holds
and controlled teardown for this target. This remains a candidate hosted fault
procedure until that fresh pass and its independent recovery review succeed.

## Primary references and observed preparation limits

- [Supabase CLI db push](https://supabase.com/docs/reference/cli/supabase-db-push): normal migration history and dry-run; actual 2.111.0 help was read for push, query, link, create and delete.
- [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres): direct/session endpoints and 5432/6543 distinction.
- [CLI connection parser](https://github.com/supabase/cli/blob/develop/apps/cli/src/legacy/shared/legacy-db-config.layer.ts): Context7-first lookup for `--db-url` versus linked credentials; runtime behavior still needs the selected hosted connection test.
- [PostgreSQL 17 ACL catalog functions](https://www.postgresql.org/docs/17/functions-info.html) and [REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html): normalized ACL defaults, grant options and RESTRICT dependency behavior.
- [PostgreSQL 17 pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html): archive TOC selection, ownership/ACL replay and error handling.
- [PostgreSQL password authentication](https://www.postgresql.org/docs/17/auth-password.html), [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres), and [Supavisor NULL-secret behavior](https://supabase.com/docs/guides/troubleshooting/supavisor-connection-error-fatal-eauthquery-unsupported-or-invalid-secret-format-d23dd4): the declared managed customer-authentication boundary; no claim to inspect loaded HBA or exclude privileged internal platform access.
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
