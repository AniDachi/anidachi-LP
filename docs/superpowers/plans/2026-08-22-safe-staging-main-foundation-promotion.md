# Safe Staging-to-Main Foundation Promotion Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:executing-plans` to execute this plan task-by-task. Do not use
> subagents for this release unless the user explicitly authorizes delegation.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Approved for careful preparation on 2026-08-22. No PR merge is
authorized in advance: every merge into `staging` or `main` requires a fresh
explicit user approval immediately before it. This remains a technical
`main`-baseline operation, not a public launch or extension publication.

**Goal:** Move the tested AniDachi technical foundation from `staging` to
`main` without a database/runtime race, without publishing an extension, and
without claiming public or market readiness.

**Architecture:** Use a two-phase production promotion. First merge only the 12
already staging-tested Supabase migrations into `main`, wait for the production
database workflow, and verify that the old production runtime remains healthy.
Then create a fresh runtime promotion branch from the updated `main`, merge the
exact frozen `staging` candidate into it, prove that the runtime PR contains no
pending migration files, and promote that tested tree through a second PR.

**Tech Stack:** Git and GitHub pull requests, GitHub Actions, Supabase CLI
2.111.0, PostgreSQL 17, Vercel Git deployments, Cloudflare Workers/Wrangler,
Node 22.23.1, pnpm 11.2.2, WXT, Vitest, pgTAP, and the existing room/P2P
harnesses.

**Spec and operational authorities:**

- `docs/current-development-state.md`
- `docs/development-quality-gates.md`
- `docs/staging-acceptance-checklist.md`
- `docs/release-and-rollback-runbook.md`
- `docs/extension-release-channels.md`
- `docs/superpowers/plans/2026-08-14-watch-history-v2-clean-mvp-implementation.md`
- `.github/workflows/db-production.yml`
- `.github/workflows/deploy-api.yml`
- `.github/workflows/build-extension.yml`

## Global Constraints

- Never push directly to `main` or `staging`; every durable change goes through
  a PR.
- Never merge any PR into `staging` or `main` without a fresh explicit user
  approval immediately before that exact merge. First report the PR URL, target
  branch, exact file scope, completed checks, expected automatic deployment,
  and rollback boundary; then stop and wait.
- Never force-push `main` or `staging` and never disable their protection to
  make a promotion pass.
- Do not merge the current combined promotion PR `#174` directly.
- Supabase migrations must reach production before any runtime that consumes
  their new tables, columns, functions, triggers, or RPCs.
- Do not apply production SQL manually, edit production migration history, or
  perform a destructive database rollback. A lock timeout is retried only after
  writers drain; any other database failure stops the plan for investigation.
- The runtime promotion must be tree-identical to the frozen, tested `staging`
  candidate. No opportunistic code, UI, refactor, dependency, or product change
  may enter either promotion branch.
- Use GitHub's merge-commit strategy for both production PRs. Do not squash or
  rebase the runtime promotion because its ancestry must prove that the frozen
  `staging` candidate is contained in `main`.
- The Chrome Web Store is out of scope. The production extension workflow may
  build and upload a private GitHub Actions artifact only; no store ID, upload,
  listing, publishing, or update action is allowed.
- This promotion is not a public-launch, market-readiness, legal, billing,
  additional-provider, UI/UX-completion, two-network/TURN-completion, or Chrome
  Web Store claim.
- Do not change Bloü/OpenClaw, CRM, social-media integration, or private Blob
  production state under this plan. The accumulated `staging` diff already
  contains previously landed private-storage changes, but their unconfigured
  fail-closed production paths are an explicitly accepted deferred surface for
  this non-launch `main` baseline.
- Do not print or copy secret values. Configuration gates compare required
  variable names, origins, and public endpoint values only.
- From the first production merge until runtime verification completes, freeze
  the selected `staging` candidate. If `origin/staging` moves, stop and repeat
  the drift review before proceeding.
- Keep both promotion branches and worktrees until the corresponding PR is
  merged and verified. Do not delete recovery evidence early.

## Verified Planning Snapshot

This snapshot was read on 2026-08-22. Every value must be refreshed at
execution time; drift is a stop condition, not permission to silently adjust
the release.

| Item | Verified state |
| --- | --- |
| Local branch/worktree | Clean `staging` worktree |
| Frozen runtime parent | `bb32e26adee6971709a35d2929c7ad7155ebd8d5` |
| Remote `staging` | Same `bb32e26adee6971709a35d2929c7ad7155ebd8d5` |
| Remote `main` | `b740be2e1a9060b166f55fe9ab2dbde2385e8fb3` |
| Divergence | `main` has 3 promotion merge commits; `staging` has 234 commits |
| Accumulated diff | 272 files, 326,864 additions, 151,158 deletions |
| Current promotion PR | `#174`, open, mergeable, clean, manual promotion |
| PR `#174` checks | CI, migrations-to-staging, Rooms, P2P, Vercel, staging smoke green |
| Pending production migrations | 12 ordered files listed below |
| Production Vercel baseline | Ready deployment `dpl_A8fsBNDh7SJLthsKsfThCk6fpQ3x` |
| Staging Vercel candidate | Ready deployment `dpl_6bvDCC5v5koztbQEHZ2kq2uYUwjD` |
| `main` protection | Strict required `check-and-test`, merge PR required, force pushes blocked |
| `staging` protection | Live GitHub protection does not match the current documentation; reconcile separately after the release |

The 3 commits unique to `main` are previous promotion merge commits. The tree of
the latest promotion merge matches its `staging` parent, so no independent
production hotfix is currently hidden on `main`. Recheck this before execution.

## Exact Migration Set

The migration-only PR must contain exactly these paths in this order and no
other repository files:

1. `apps/web/supabase/migrations/20260814010000_watch_history_v2_foundation.sql`
2. `apps/web/supabase/migrations/20260814020000_watch_history_v2_clean_cutover.sql`
3. `apps/web/supabase/migrations/20260816090000_watch_history_v2_bounded_read.sql`
4. `apps/web/supabase/migrations/20260818131602_oauth_login_transactions.sql`
5. `apps/web/supabase/migrations/20260818192007_extension_auth_pkce.sql`
6. `apps/web/supabase/migrations/20260819133849_auth_channel_rotation.sql`
7. `apps/web/supabase/migrations/20260820040229_auth_artifact_cleanup.sql`
8. `apps/web/supabase/migrations/20260820111116_room_history_authority_expiry.sql`
9. `apps/web/supabase/migrations/20260821162622_watch_history_v2_resource_bounds.sql`
10. `apps/web/supabase/migrations/20260822033019_room_source_generation.sql`
11. `apps/web/supabase/migrations/20260822065227_room_invite_lifecycle_actions.sql`
12. `apps/web/supabase/migrations/20260822091552_finalize_legacy_orphan_invite_rooms.sql`

These files were designed and staging-tested as structurally migration-first
compatible: the old runtime can continue using its existing table shapes while
the additive v2/OAuth/auth-family/source/invite boundaries are present. The
bounded-read migrations install active projection triggers, so they are
compatible but not dormant. The final orphan-invite migration performs a
bounded historical data update; it must not be reapplied or rewritten.

There is one intentional session-continuity exception. The auth-channel
migration marks refresh-token rows that existed at cutover as revoked, and the
following hourly cleanup migration may physically remove them. The old runtime
does not read `revoked_at`, and can still insert its unchanged nullable legacy
shape, but existing production refresh sessions are not promised to survive the
cutover. This was accepted on staging because AniDachi is pre-release; it must
be accepted explicitly again for production under Decision 4.

## Promotion Topology

```text
frozen staging candidate
        |
        | supplies only the 12 migration files
        v
codex/main-foundation-migrations-20260822
        |
        | PR A -> main -> production DB workflow -> verify old runtime
        v
updated main with database prerequisites
        |
        | new branch from updated main, then merge exact frozen staging
        v
codex/main-foundation-runtime-20260822
        |
        | PR B -> main -> Vercel + Worker + CI + extension artifact
        v
verified main tree containing frozen staging ancestry
        |
        v
close PR #174 as superseded -> record evidence -> small docs closeout
```

## Decisions Required Before Execution Approval

### Decision 1: Defer the existing private integration/Blob cutover

The accumulated `staging` runtime already changes Bloü/OpenClaw, CRM, Google
Ads, Instagram, TikTok, and YouTube credential storage to use a private Blob
boundary. Current Vercel Production configuration exposes neither
`PRIVATE_INTEGRATION_BLOB_STORE_ID` nor
`PRIVATE_INTEGRATION_BLOB_READ_WRITE_TOKEN`; the new runtime therefore fails
closed when those paths are used.

The user clarified that this operation exists only to establish a clean `main`
baseline and is not a launch. Therefore this plan will not create a private
store, add either variable, copy or inspect objects, change those products, call
their production routes, or add a fallback to the public store. Those deferred
internal integration paths may remain fail-closed after the technical `main`
deployment and must be recorded as not production-ready.

This boundary permits runtime PR B only while source inspection confirms that
the missing private Blob configuration is isolated from AniDachi's public web,
website auth, Watch History, rooms, Worker, and extension build paths. If a core
MVP path is found to depend on it, stop and return for a new decision rather than
silently configuring or bypassing the private boundary.

A selective partial promotion that silently drops those accumulated files is
not approved by this plan: it would make `main` a hand-built product variant,
weaken ancestry proof, and recreate the large-diff problem.

### Decision 2: Defer remaining room-network evidence

Automated Rooms/P2P checks and real-WebRTC harnesses are green, and the user
accepted the normal two-profile room flow. TURN is already configured; the
production Worker exposes the required TURN secret names and this plan must not
change that configuration. Only a manual acceptance proving an actual relayed
session across two different networks is not recorded. That evidence is
explicitly deferred until preparation for public extension distribution and
does not block this Git-baseline promotion because no production extension is
distributed. This residual may not be rewritten as full media, production, or
market readiness.

### Decision 3: Mandatory approval before every merge

Execution must pause before every merge, including:

- the approved plan/docs PR into `staging`;
- migration-only PR A into `main`;
- runtime PR B into `main`;
- the closeout docs PR into `staging`; and
- any generated closeout promotion PR into `main`.

For each pause, report what will merge, why it is needed, what checks passed,
what will deploy automatically, and how the operation stops or rolls back. A
general or earlier approval does not replace the fresh approval for that exact
merge.

### Decision 4: Intentional production reauthentication

The clean auth-channel cutover does not maintain a permanent legacy refresh
verifier. Existing production website and extension test sessions may therefore
need one explicit sign-in after promotion. This is expected product behavior,
not a rollback condition, provided new website sessions work and no account
data is lost.

Before PR A merges, the user must explicitly accept this pre-release
reauthentication boundary. Execute PR A and PR B in one attended release window
with no unrelated pause between them: verify the database and old public web,
then prepare and merge PR B as soon as Gate B permits. Do not describe the old
runtime's temporary health as refresh-session continuity.

---

### Task 1: Land The Approved Plan And Freeze The Candidate

**Files:**

- Create: `docs/superpowers/plans/2026-08-22-safe-staging-main-foundation-promotion.md`
- Modify: `docs/superpowers/plans/README.md`
- Refresh if changed by the required semantic update:
  `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, and
  `graphify-out/manifest.json`

**Interfaces:**

- Consumes: the user's approved decisions above.
- Produces: one durable execution authority on `staging` and one exact frozen
  candidate SHA recorded in the release evidence.

- [ ] **Step 1: Incorporate the user's approved choices**

Update only the Decisions section and any directly affected stop/acceptance
conditions. Do not broaden the promotion into UI/UX, store, legal, billing, or
new product work.

- [ ] **Step 2: Put the approved plan on a docs-only feature branch**

From the clean current worktree:

```bash
git fetch origin main staging
git switch -c codex/main-foundation-promotion-plan-20260822 origin/staging
```

Add one active-plan pointer to `docs/superpowers/plans/README.md`, then verify:

Invoke the installed Graphify skill as `$graphify . --update` because this
change adds a semantic plan. Do not substitute the code-only graph updater and
do not request a separate model-provider key. Then verify:

```bash
git diff --check
git status --short
```

Expected changed paths are exactly this plan and
`docs/superpowers/plans/README.md`, plus only the three team Graphify artifacts
listed above if the semantic refresh actually changes them. Any Graphify cache,
cost, HTML, wiki, scratch, or provider file is excluded.

- [ ] **Step 3: Commit and merge the docs-only plan through `staging`**

```bash
git add \
  docs/superpowers/plans/2026-08-22-safe-staging-main-foundation-promotion.md \
  docs/superpowers/plans/README.md \
  graphify-out/graph.json \
  graphify-out/GRAPH_REPORT.md \
  graphify-out/manifest.json
git commit -m "docs: define safe main foundation promotion"
git push -u origin codex/main-foundation-promotion-plan-20260822
gh pr create \
  --repo AniDachi/anidachi-LP \
  --base staging \
  --head codex/main-foundation-promotion-plan-20260822 \
  --title "docs: define safe main foundation promotion" \
  --body "Defines the approved database-first and runtime-second production promotion. This PR changes documentation only and does not authorize or perform a production deployment."
```

Wait until the docs PR is green, report its exact two documentation paths plus
any allowed Graphify artifacts, and request explicit user approval. Merge only
after that approval. Do not push its commit directly to `staging`.

- [ ] **Step 4: Capture and freeze the resulting `staging` head**

```bash
git fetch origin main staging
git rev-parse origin/staging
git diff --name-only bb32e26adee6971709a35d2929c7ad7155ebd8d5..origin/staging
```

Expected difference from `bb32e26` is only this plan, the plan index, and any
three allowed team Graphify artifacts refreshed above. Record the resulting full
SHA in the promotion PR bodies and progress log. Any runtime, workflow,
migration, lockfile, configuration, or other generated-file change stops the
plan for renewed review.

**Acceptance:** the plan is durable, the final candidate SHA is known, and its
only change above the already accepted runtime is documentation.

### Task 2: Re-prove The Frozen Staging Candidate

**Files:** none.

**Interfaces:**

- Consumes: the frozen candidate SHA from Task 1.
- Produces: fresh local, CI, staging, database, artifact, and harness evidence
  for the exact tree that will be promoted.

- [ ] **Step 1: Verify Git and GitHub drift**

```bash
git fetch origin main staging
git status --short --branch
git rev-list --left-right --count origin/main...origin/staging
gh pr list --repo AniDachi/anidachi-LP --state open --limit 100 \
  --json number,title,baseRefName,headRefName,isDraft,mergeable,mergeStateStatus,url
gh pr view 174 --repo AniDachi/anidachi-LP \
  --json state,baseRefName,headRefName,headRefOid,mergeable,mergeStateStatus,statusCheckRollup
gh api repos/AniDachi/anidachi-LP/branches/main/protection
gh api repos/AniDachi/anidachi-LP/branches/staging/protection
```

Stop if the worktree is dirty beyond the approved plan files, the frozen SHA
moved, another PR targets `main`, PR `#174` no longer represents
`staging -> main`, or any unexpected independent commit exists on `main`.

After the drift review, detach the isolated worktree at the exact candidate
currently recorded by `origin/staging` and confirm it before running gates:

```bash
git switch --detach origin/staging
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/staging)"
```

- [ ] **Step 2: Pin the repository runtime**

```bash
fnm exec --using="$(cat .node-version)" node --version
fnm exec --using="$(cat .node-version)" pnpm --version
fnm exec --using="$(cat .node-version)" pnpm install --frozen-lockfile
```

Expected versions are Node `v22.23.1` and pnpm `11.2.2`.

- [ ] **Step 3: Run the complete application gates**

```bash
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/protocol test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test:runtime
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/extension test
fnm exec --using="$(cat .node-version)" pnpm check
fnm exec --using="$(cat .node-version)" pnpm test
fnm exec --using="$(cat .node-version)" pnpm dev:check
git diff --check
```

`pnpm dev:check` prints the expected gate profile; it does not replace the
commands above.

- [ ] **Step 4: Run the pinned local database gates**

Use the same Supabase CLI release as GitHub Actions:

```bash
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web db reset
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web test db
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web db lint --level warning
WATCH_HISTORY_LOCAL_RPC_TEST=1 fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test
WATCH_HISTORY_BENCHMARK_TEST=1 fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test
```

Then run the linked staging dry-run only after confirming the linked project is
the documented staging project `cyppqpprkygjloyfvvvj`:

```bash
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web db push --dry-run
```

Expected result is no pending staging migration. Never relink this local
worktree to production.

- [ ] **Step 5: Run room, WebRTC, Worker, and artifact gates**

```bash
fnm exec --using="$(cat .node-version)" pnpm harness:rooms
npm --prefix tests/e2e install
npm --prefix tests/e2e exec playwright install chromium
npm --prefix tests/e2e run harness:p2p
fnm exec --using="$(cat .node-version)" pnpm smoke:worker:staging
fnm exec --using="$(cat .node-version)" pnpm build:extension:staging
fnm exec --using="$(cat .node-version)" pnpm validate:extension:staging
```

The prior loaded-artifact user acceptance may be reused only because the frozen
runtime is still `bb32e26` plus plan/index/knowledge-graph metadata. If Task 1
reveals any runtime change, rebuild, reload, and repeat the affected two-profile
acceptance.

- [ ] **Step 6: Recheck the live staging deployment**

```bash
gh run list --repo AniDachi/anidachi-LP --branch staging --limit 20
vercel inspect https://staging.anidachi.app --scope georges-projects-8c4bc43a
```

Require the final candidate's CI, Vercel deployment, migration-to-staging,
Rooms, P2P, extension build, and staging smoke to be green where their path
filters apply.

**Acceptance:** all applicable gates are green for the frozen candidate; every
exception is explicit, bounded, and approved rather than silently called a
pass.

### Task 3: Prove Production Configuration Readiness

**Files:** none under this plan.

**Interfaces:**

- Consumes: the exact production requirements from the frozen runtime.
- Produces: a names-only configuration matrix and a go/stop decision before any
  production merge.

- [ ] **Step 1: List Vercel Production variable names without values**

```bash
vercel env ls production --scope georges-projects-8c4bc43a
```

Require the presence of core AniDachi names including
`NEXT_PUBLIC_SITE_URL`, Supabase URL/anon/service-role variables,
`ANIDACHI_JWT_SECRET`, Google/Discord OAuth variables,
`ANIDACHI_API_INTERNAL_BASE_URL`, `ANIDACHI_INTERNAL_API_SECRET`, and all three
`ANIDACHI_VAPID_*` variables. `ANIDACHI_EXTENSION_CLIENT_ID` must remain absent
because production extension identity/auth is deliberately fail-closed.

- [ ] **Step 2: List Worker and GitHub Production configuration names**

```bash
cd apps/api
fnm exec --using="$(cat ../../.node-version)" pnpm exec wrangler secret list --env production
cd ../..
gh api repos/AniDachi/anidachi-LP/environments/production/variables \
  --jq '.variables[] | .name' | sort
gh api repos/AniDachi/anidachi-LP/environments/production/secrets \
  --jq '.secrets[] | .name' | sort
gh api repos/AniDachi/anidachi-LP/actions/secrets \
  --jq '.secrets[] | .name' | sort
```

Require Worker secret names `ANIDACHI_INTERNAL_API_SECRET`,
`ANIDACHI_JWT_SECRET`, `CLOUDFLARE_TURN_KEY_API_TOKEN`, and
`CLOUDFLARE_TURN_KEY_ID`. Require GitHub production variables
`WXT_WEB_HTTP_BASE`, `WXT_API_HTTP_BASE`, `WXT_API_WS_BASE`, and
`WXT_VAPID_PUBLIC_KEY`, plus the existing production database and Cloudflare
deployment secret names.

- [ ] **Step 3: Enforce the deferred Private Blob boundary**

Record that `PRIVATE_INTEGRATION_BLOB_STORE_ID` and
`PRIVATE_INTEGRATION_BLOB_READ_WRITE_TOKEN` are absent. Do not add either
variable, create a store, migrate an object, inspect private object content, or
call the affected production routes under this plan.

Inspect the source consumers:

```bash
rg -l "private-integration-blob|privateIntegrationBlob|PRIVATE_INTEGRATION_BLOB" \
  apps/web | sort
```

Require every runtime consumer to remain within the deferred Google Ads,
Instagram, TikTok, YouTube marketing credential, Kreatli CRM, or OpenClaw job
surfaces. Stop if the public web shell, account auth, Watch History, room APIs,
Worker, protocol, or extension imports this boundary. Record the deferred
fail-closed state in PR B and final closeout rather than calling these internal
integrations healthy.

- [ ] **Step 4: Validate production build inputs without deploying**

Run a production Worker dry run:

```bash
ANIDACHI_WORKER_DRY_RUN_DIR="$(mktemp -d "${TMPDIR%/}/anidachi-worker-production.XXXXXX")"
cd apps/api
fnm exec --using="$(cat ../../.node-version)" pnpm exec wrangler deploy \
  --env production \
  --dry-run \
  --outdir "$ANIDACHI_WORKER_DRY_RUN_DIR"
cd ../..
```

Read the production VAPID public key from the GitHub environment variable into
a shell variable without printing it, then build and validate the release
artifact locally:

```bash
ANIDACHI_RELEASE_VAPID_PUBLIC_KEY="$(gh api repos/AniDachi/anidachi-LP/environments/production/variables/WXT_VAPID_PUBLIC_KEY --jq .value)"
test -n "$ANIDACHI_RELEASE_VAPID_PUBLIC_KEY"
WXT_VAPID_PUBLIC_KEY="$ANIDACHI_RELEASE_VAPID_PUBLIC_KEY" \
  fnm exec --using="$(cat .node-version)" pnpm build:extension:public
unset ANIDACHI_RELEASE_VAPID_PUBLIC_KEY
fnm exec --using="$(cat .node-version)" pnpm validate:extension:production
```

Verify the artifact is ignored/untracked and do not upload it anywhere.

**Acceptance:** core AniDachi configuration is sufficient for the frozen
runtime; production extension auth and the private-integration surfaces remain
deliberately disabled; no deferred system was changed or misrepresented as
ready.

### Task 4: Prepare Migration-Only PR A

**Files:** exactly the 12 migration paths listed above.

**Interfaces:**

- Consumes: current `origin/main` and the frozen `origin/staging` migration
  files.
- Produces: branch `codex/main-foundation-migrations-20260822` and a PR to
  `main` containing no runtime or documentation change.

- [ ] **Step 1: Reuse the current isolated Codex worktree and branch from `main`**

At execution time use `superpowers:using-git-worktrees`. This task already runs
inside a linked Codex worktree, so first prove that fact and do not create a
nested worktree:

```bash
ANIDACHI_GIT_DIR="$(cd "$(git rev-parse --git-dir)" && pwd -P)"
ANIDACHI_GIT_COMMON="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
test "$ANIDACHI_GIT_DIR" != "$ANIDACHI_GIT_COMMON"
test -z "$(git rev-parse --show-superproject-working-tree)"
test -z "$(git status --porcelain=v1)"
git fetch origin main staging
git switch -c codex/main-foundation-migrations-20260822 origin/main
unset ANIDACHI_GIT_DIR ANIDACHI_GIT_COMMON
```

The branch must be created from freshly fetched `origin/main`, not from local
`staging`. If the isolation or clean-worktree assertions fail, stop rather than
creating or switching a branch by guesswork.

- [ ] **Step 2: Restore only the exact migration set from the frozen candidate**

```bash
git restore --source=origin/staging -- \
  apps/web/supabase/migrations/20260814010000_watch_history_v2_foundation.sql \
  apps/web/supabase/migrations/20260814020000_watch_history_v2_clean_cutover.sql \
  apps/web/supabase/migrations/20260816090000_watch_history_v2_bounded_read.sql \
  apps/web/supabase/migrations/20260818131602_oauth_login_transactions.sql \
  apps/web/supabase/migrations/20260818192007_extension_auth_pkce.sql \
  apps/web/supabase/migrations/20260819133849_auth_channel_rotation.sql \
  apps/web/supabase/migrations/20260820040229_auth_artifact_cleanup.sql \
  apps/web/supabase/migrations/20260820111116_room_history_authority_expiry.sql \
  apps/web/supabase/migrations/20260821162622_watch_history_v2_resource_bounds.sql \
  apps/web/supabase/migrations/20260822033019_room_source_generation.sql \
  apps/web/supabase/migrations/20260822065227_room_invite_lifecycle_actions.sql \
  apps/web/supabase/migrations/20260822091552_finalize_legacy_orphan_invite_rooms.sql
```

- [ ] **Step 3: Prove the branch contains no other change**

```bash
git status --short
git diff --name-status
git diff --check
git diff --name-only | wc -l
```

Expected count is `12`, and every line must be one of the listed migration
paths. Any workflow, runtime, test, docs, lockfile, or generated file stops the
task.

- [ ] **Step 4: Apply the migration branch to a fresh local database**

```bash
fnm exec --using="$(cat .node-version)" pnpm install --frozen-lockfile
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web db reset
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web test db
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web db lint --level warning
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web check
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/web test
git diff --check
```

This proves the new schema applies while the branch still contains the old
`main` web runtime. Task 2 carries the stronger new-runtime/pgTAP/contracts
evidence.

- [ ] **Step 5: Commit, push, and open PR A**

```bash
git add apps/web/supabase/migrations
git commit -m "feat(db): promote tested foundation migrations"
git diff --name-status origin/main...HEAD
test "$(git diff --name-only origin/main...HEAD | wc -l | tr -d ' ')" = "12"
git push -u origin codex/main-foundation-migrations-20260822
gh pr create \
  --repo AniDachi/anidachi-LP \
  --base main \
  --head codex/main-foundation-migrations-20260822 \
  --title "feat(db): promote tested foundation migrations" \
  --body "Database-first production prerequisite for the tested staging foundation. The diff is restricted to the 12 ordered Supabase migrations recorded in the promotion plan. No runtime is included. Do not merge runtime until the production migration workflow and old production runtime are verified. Rollback uses the reviewed forward/redeploy procedures; migration history and canonical data must not be edited or deleted."
```

- [ ] **Step 6: Enforce Gate A**

Require PR A to be mergeable, up to date with `main`, green on
`check-and-test`, and still exactly 12 migration files. Present the PR URL and
evidence to the user, explain the automatic database/Vercel effects, and stop
until the user explicitly approves this exact merge.

**Acceptance:** PR A is a reviewable migration-only production prerequisite
with no runtime deployment race.

### Task 5: Merge And Verify The Production Database Prerequisite

**Files:** no new repository files.

**Interfaces:**

- Consumes: approved, green migration PR A.
- Produces: production migration history containing all 12 files and a healthy
  old production runtime.

- [ ] **Step 1: Recheck `main`, `staging`, and PR A immediately before merge**

```bash
git fetch origin main staging
gh pr view codex/main-foundation-migrations-20260822 \
  --repo AniDachi/anidachi-LP \
  --json state,baseRefOid,headRefOid,mergeable,mergeStateStatus,statusCheckRollup,files
```

Stop if either branch moved outside the approved plan-only path, the file count
is not 12, or a required check is not successful.

- [ ] **Step 2: Merge PR A with a merge commit**

```bash
gh pr merge codex/main-foundation-migrations-20260822 \
  --repo AniDachi/anidachi-LP \
  --merge
```

- [ ] **Step 3: Watch the production database workflow to completion**

```bash
gh run list --repo AniDachi/anidachi-LP --branch main --limit 20
git fetch origin main
ANIDACHI_DB_RUN_ID="$(gh run list \
  --repo AniDachi/anidachi-LP \
  --workflow "Deploy migrations to production" \
  --branch main \
  --commit "$(git rev-parse origin/main)" \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId')"
test -n "$ANIDACHI_DB_RUN_ID"
gh run watch "$ANIDACHI_DB_RUN_ID" \
  --repo AniDachi/anidachi-LP \
  --exit-status
gh run view "$ANIDACHI_DB_RUN_ID" \
  --repo AniDachi/anidachi-LP \
  --log
```

Require:

- dry run detects only the intended pending migrations;
- apply exits successfully;
- all 12 migration timestamps appear in ordered workflow output;
- no migration is partially repaired or marked manually.

If the bounded-read or resource-bound migration hits its documented ten-second
lock timeout, leave runtime stopped, allow active writers to drain, and rerun
the same workflow. Any other failure stops the plan for diagnosis.

- [ ] **Step 4: Verify the migration-only production web deployment**

Vercel will rebuild `main`, but the application source remains the old runtime.

```bash
vercel inspect https://www.anidachi.app --scope georges-projects-8c4bc43a
curl --fail --silent --show-error --location https://www.anidachi.app/ >/dev/null
```

Require a Ready production deployment and a healthy public home page. Record
the new deployment ID as the migration-only rollback point. Confirm that the
login page renders and that a new website login can be initiated, but do not
require a pre-cutover refresh session to survive: Decision 4 intentionally
allows one reauthentication.

- [ ] **Step 5: Confirm no API or extension release was triggered by PR A**

The PR changes only migration paths, so `Deploy API` and `Build Extension`
should not run. If either runs, stop and explain the path-filter mismatch before
runtime promotion.

**Acceptance:** all database prerequisites are installed, the old production
runtime is healthy, and no new runtime has been promoted.

### Task 6: Prepare Fresh Runtime Promotion PR B

**Files:** the remaining tested `staging` tree after the 12 migration files are
already present in `main`.

**Interfaces:**

- Consumes: updated verified `origin/main` and the unchanged frozen
  `origin/staging` candidate.
- Produces: branch `codex/main-foundation-runtime-20260822`, whose tree is
  identical to frozen `staging` and whose diff against updated `main` contains
  no migration files.

- [ ] **Step 1: Re-fetch and prove the candidate stayed frozen**

```bash
git fetch origin main staging
git rev-parse origin/main origin/staging
```

Compare the `origin/staging` SHA with the Task 1 record. Any drift stops this
task. Do not merge a moving branch into the release.

- [ ] **Step 2: Create the runtime branch in the existing isolated worktree**

The migration branch is already pushed, merged, and verified by this point.
Keep it as recovery evidence, but switch the same clean linked worktree onto a
new branch based on the post-PR-A `origin/main` commit:

```bash
test -z "$(git status --porcelain=v1)"
git switch -c codex/main-foundation-runtime-20260822 origin/main
```

Do not create a nested worktree and do not delete the migration branch yet.

- [ ] **Step 3: Merge the exact frozen `staging` candidate into the branch**

```bash
git merge --no-ff origin/staging -m "merge: prepare tested staging runtime for main"
```

No conflict resolution by judgment is allowed. Any conflict means the planned
base changed and requires renewed review.

- [ ] **Step 4: Prove tree identity and migration separation**

```bash
test "$(git rev-parse HEAD^{tree})" = "$(git rev-parse origin/staging^{tree})"
test -z "$(git diff --name-only origin/main...HEAD -- apps/web/supabase/migrations)"
git diff --check origin/main...HEAD
git status --short
```

All commands must succeed. Tree identity is the proof that PR B adds no
hand-edited production variant.

- [ ] **Step 5: Run the final merged-tree gates**

```bash
fnm exec --using="$(cat .node-version)" pnpm install --frozen-lockfile
fnm exec --using="$(cat .node-version)" pnpm check
fnm exec --using="$(cat .node-version)" pnpm test
fnm exec --using="$(cat .node-version)" pnpm --filter @anidachi/api test:runtime
fnm exec --using="$(cat .node-version)" pnpm harness:rooms
npm --prefix tests/e2e run harness:p2p
fnm exec --using="$(cat .node-version)" pnpm build:extension:staging
fnm exec --using="$(cat .node-version)" pnpm validate:extension:staging
ANIDACHI_RUNTIME_WORKER_DRY_RUN_DIR="$(mktemp -d "${TMPDIR%/}/anidachi-worker-runtime.XXXXXX")"
cd apps/api
fnm exec --using="$(cat ../../.node-version)" pnpm exec wrangler deploy \
  --env production \
  --dry-run \
  --outdir "$ANIDACHI_RUNTIME_WORKER_DRY_RUN_DIR"
cd ../..
git diff --check origin/main...HEAD
```

- [ ] **Step 6: Push and open PR B**

```bash
git push -u origin codex/main-foundation-runtime-20260822
gh pr create \
  --repo AniDachi/anidachi-LP \
  --base main \
  --head codex/main-foundation-runtime-20260822 \
  --title "feat: promote tested foundation runtime to main" \
  --body "Runtime phase of the approved two-step production promotion. The 12 Supabase migrations were applied and verified first. This branch was created from the updated main and merged the exact frozen staging candidate; its tree must equal staging and its main diff must contain zero migration files. This is a pre-release technical baseline, not public launch or Chrome Web Store publication."
```

- [ ] **Step 7: Review the synthesized PR result**

Require:

- PR B is based on the current post-migration `main`;
- GitHub reports mergeable and clean;
- required `check-and-test` is fresh and green;
- Vercel Preview is Ready;
- migration diff is empty;
- branch tree remains equal to frozen `staging`;
- the Decision 1 fail-closed boundary and Decision 2 deferral are recorded;
- rollback IDs for Vercel and Worker are recorded.

- [ ] **Step 8: Close PR `#174` only after PR B is green**

Close `#174` with a comment naming PR A and PR B as the database-first
replacement. Do not merge it and do not close it earlier, because it remains the
visible accumulated-diff reference until the replacement is proven.

```bash
gh pr close 174 \
  --repo AniDachi/anidachi-LP \
  --comment "Superseded by the approved two-phase promotion: migration-only PR A followed by the fresh runtime PR B. PR #174 was not merged because its combined database/runtime deployment could race production migrations."
```

- [ ] **Step 9: Enforce Gate B**

Present PR B, production database evidence, configuration result, residual
exceptions, automatic deployment effects, and rollback points to the user, then
stop until the user explicitly approves this exact merge.

**Acceptance:** PR B is a fresh, up-to-date, migration-free runtime promotion of
the exact tested candidate.

### Task 7: Merge Runtime PR B And Observe Production

**Files:** no new repository files during the observation window.

**Interfaces:**

- Consumes: approved, green runtime PR B.
- Produces: `main` containing the frozen `staging` ancestry and a complete set
  of deployment results.

- [ ] **Step 1: Perform the final no-drift check**

```bash
git fetch origin main staging
gh pr view codex/main-foundation-runtime-20260822 \
  --repo AniDachi/anidachi-LP \
  --json state,baseRefOid,headRefOid,mergeable,mergeStateStatus,statusCheckRollup
```

Repeat the tree-identity and empty-migration-diff checks locally. Stop on any
change after Gate B.

- [ ] **Step 2: Merge PR B with a merge commit**

```bash
gh pr merge codex/main-foundation-runtime-20260822 \
  --repo AniDachi/anidachi-LP \
  --merge
```

- [ ] **Step 3: Monitor every triggered production workflow separately**

Track exact run IDs for:

- `CI`;
- `Deploy migrations to production` (must be a no-op dry run now);
- `Deploy API`;
- `Build Extension`;
- Vercel Production deployment.

Use `gh run list`, `gh run watch`, `gh run view --log`, and `vercel inspect`.
Do not call the release complete while any required surface is queued,
in-progress, cancelled, skipped unexpectedly, or failed.

- [ ] **Step 4: Apply cross-plane failure rules**

- If production DB reports a pending migration during runtime PR B, stop: the
  phase split failed. Do not accept runtime deployment.
- If Vercel fails before alias promotion, keep the old alias and diagnose.
- If Vercel becomes Ready while Worker deployment fails, roll Vercel back to
  the last known-good production deployment before attempting a code fix.
- If Worker succeeds while Vercel fails and the new Worker is not proven
  backward-compatible with the old web runtime, roll Worker back to its last
  known-good deployment or revert through Git according to the runbook.
- If only the production extension artifact build fails, no users receive it.
  Mark closeout blocked, keep the artifact unpublished, and fix through the
  normal feature-to-staging flow; do not hide the failure.
- Never delete or rewrite production database data as a response to an
  application deployment failure.

- [ ] **Step 5: Validate the production extension artifact without publishing**

Resolve the exact successful Build Extension run for the merged `main` SHA,
download its `anidachi-extension-production` artifact into a fresh temporary
directory, unzip the contained ZIP, and validate that exact payload:

```bash
git fetch origin main
ANIDACHI_PRODUCTION_SHA="$(git rev-parse origin/main)"
ANIDACHI_BUILD_RUN_ID="$(gh run list \
  --repo AniDachi/anidachi-LP \
  --workflow "Build Extension" \
  --branch main \
  --commit "$ANIDACHI_PRODUCTION_SHA" \
  --limit 1 \
  --json databaseId,conclusion \
  --jq 'map(select(.conclusion == "success"))[0].databaseId')"
test -n "$ANIDACHI_BUILD_RUN_ID"
ANIDACHI_ARTIFACT_ROOT="$(mktemp -d "${TMPDIR%/}/anidachi-production-artifact.XXXXXX")"
gh run download "$ANIDACHI_BUILD_RUN_ID" \
  --repo AniDachi/anidachi-LP \
  --name anidachi-extension-production \
  --dir "$ANIDACHI_ARTIFACT_ROOT/download"
test -f "$ANIDACHI_ARTIFACT_ROOT/download/anidachi-extension-production.zip"
mkdir "$ANIDACHI_ARTIFACT_ROOT/unpacked"
unzip -q \
  "$ANIDACHI_ARTIFACT_ROOT/download/anidachi-extension-production.zip" \
  -d "$ANIDACHI_ARTIFACT_ROOT/unpacked"
fnm exec --using="$(cat .node-version)" node scripts/validate-extension-artifact.mjs \
  --channel production \
  --dir "$ANIDACHI_ARTIFACT_ROOT/unpacked"
shasum -a 256 \
  "$ANIDACHI_ARTIFACT_ROOT/download/anidachi-extension-production.zip"
```

Record `version_name`, manifest name, narrow host permissions, production
web/API/WS endpoints, the run ID, and ZIP SHA-256. Keep the temporary directory
until closeout so the evidence remains inspectable; it is outside the repo and
must never be committed. Do not load or upload this artifact as a public
release; production extension authentication remains fail-closed.

**Acceptance:** all triggered production surfaces are green or the documented
rollback is active; no store/public-release action occurred.

### Task 8: Run Post-Deployment Verification

**Files:** none.

**Interfaces:**

- Consumes: successful Task 7 deployment IDs and `main` SHA.
- Produces: automated production smoke evidence and Git ancestry proof.

- [ ] **Step 1: Verify production web and unauthenticated boundaries**

```bash
vercel inspect https://www.anidachi.app --scope georges-projects-8c4bc43a
curl --fail --silent --show-error --location https://www.anidachi.app/ >/dev/null
curl --fail --silent --show-error --location https://www.anidachi.app/login >/dev/null
```

Inspect the new deployment for Ready status and the expected `main` commit.
Do not log in with or transmit user credentials during automated smoke.
An authenticated production extension/room smoke is intentionally impossible
at this stage because production extension identity remains fail-closed. Do not
convert staging acceptance into a claim of authenticated production readiness.

- [ ] **Step 2: Verify the production Worker**

```bash
WORKER_HTTP_BASE=https://anidachi-api-production.vladislav-gul7.workers.dev \
WORKER_EXPECTED_ENV=production \
  fnm exec --using="$(cat .node-version)" node scripts/smoke-worker.mjs
```

Require Worker health JSON and the authenticated ICE endpoint's expected 401
without a token.

- [ ] **Step 3: Verify migration idempotency from the runtime push**

The `Deploy migrations to production` run triggered by PR B must show an empty
dry run and a successful no-op apply. Any pending file means Task 5 evidence was
incomplete and the release remains failed.

- [ ] **Step 4: Prove Git convergence**

```bash
git fetch origin main staging
git merge-base --is-ancestor origin/staging origin/main
git diff --quiet origin/staging^{tree} origin/main^{tree}
git rev-list --left-right --count origin/main...origin/staging
```

Immediately after PR B, `staging` must be an ancestor of `main` and both trees
must match. `main` may be ahead only by the planned migration and promotion
merge commits.

- [ ] **Step 5: Confirm staging remains healthy**

```bash
vercel inspect https://staging.anidachi.app --scope georges-projects-8c4bc43a
fnm exec --using="$(cat .node-version)" pnpm smoke:worker:staging
```

The production operation must not change the staging aliases, endpoint routing,
or tester artifact folders.

**Acceptance:** production automated smokes pass, database deployment is
idempotent, Git ancestry is clean, and staging is unchanged.

### Task 9: Record Closeout And Restore A Small Promotion Diff

**Files:**

- Modify: `docs/current-development-state.md`
- Modify: `docs/superpowers/plans/2026-08-22-safe-staging-main-foundation-promotion.md`
- Modify: `docs/superpowers/plans/README.md`

**Interfaces:**

- Consumes: exact PR numbers, merge SHAs, workflow run IDs, Vercel deployment
  IDs, Worker result, production extension `version_name` and SHA-256, and every
  approved residual exception.
- Produces: an honest durable production baseline and an ordinary small future
  `staging -> main` diff.

- [ ] **Step 1: Write only observed facts**

Record:

- migration PR and runtime PR URLs/numbers;
- frozen staging SHA and final main SHA;
- all 12 production migration results;
- Vercel/Worker/CI/extension artifact results;
- Chrome Web Store/public-launch non-action;
- production extension auth still fail-closed;
- private Blob decision/evidence;
- intentional production reauthentication result;
- two-network/TURN result or approved residual;
- rollback points and any incident.

Remove statements that say none of the promoted waves reached `main`, but do
not rewrite staging acceptance as production or market readiness.

- [ ] **Step 2: Send closeout docs through the normal workflow**

Create a docs-only branch from current `staging`, commit the three files, open a
PR to `staging`, and let the existing safe docs-promotion workflow create a
small follow-up PR to `main`. Invoke `$graphify . --update` after editing the
semantic closeout docs and include only changed team Graphify artifacts. Do not
push directly to either shared branch. Stop and obtain a fresh explicit user
approval before merging the docs PR into `staging`, then stop again before
merging any generated follow-up PR into `main`.

- [ ] **Step 3: Reconcile branch-protection documentation separately**

Compare the live GitHub API settings for `main` and `staging` with
`docs/current-development-state.md`. Do not change GitHub protection under the
release PR. Open a separate process PR/settings change with explicit scope so
the documentation and live branch rules agree.

- [ ] **Step 4: Clean promotion branches only after closeout is green**

Delete the two merged promotion branches only after verifying that both commits
are reachable from `origin/main`. Preserve the current Codex-owned worktree;
this plan did not create a nested worktree. Remove the temporary artifact
directory only after its run ID, manifest facts, and checksum are recorded, and
only after verifying that its resolved path starts with
`${TMPDIR%/}/anidachi-production-artifact.`. Never force-remove a dirty
worktree or delete an unresolved path. Use the recorded absolute temporary path
and require the guard below to succeed before deletion:

```bash
case "$ANIDACHI_ARTIFACT_ROOT" in
  "${TMPDIR%/}"/anidachi-production-artifact.*) ;;
  *) exit 1 ;;
esac
test -d "$ANIDACHI_ARTIFACT_ROOT"
rm -r -- "$ANIDACHI_ARTIFACT_ROOT"
```

- [ ] **Step 5: Final project-health report**

Report separately:

- completed technical baseline promotion;
- remaining UI/UX work;
- remaining two-network/TURN or other accepted evidence gap;
- production extension identity/store publication still deferred;
- private integration status;
- any branch-protection/process follow-up.

**Acceptance:** production state is documented without exaggeration, PR `#174`
is closed as superseded, future promotion diffs start from the new main
baseline, and no untracked release branch/worktree/artifact remains.

## Stop And Rollback Matrix

| Condition | Mandatory action |
| --- | --- |
| `staging` moves after freeze | Stop, review the new diff, rerun affected gates, and record a new candidate |
| Unexpected `main` commit appears | Stop and inspect ancestry/tree impact before rebuilding either promotion branch |
| Migration PR contains more than 12 files | Stop and recreate it from clean `origin/main` |
| Local reset, pgTAP, lint, or old-runtime checks fail | Do not open or merge migration PR A |
| Private Blob appears in a core AniDachi MVP path | Stop; do not configure or bypass it without a new user decision |
| Production migration lock timeout | Keep old runtime, let writers drain, rerun the same workflow |
| Other production migration failure | Stop; no manual SQL/history repair and no runtime merge |
| Runtime tree differs from frozen `staging` | Stop and recreate the runtime branch; do not resolve by hand |
| Runtime PR contains a pending migration diff | Stop; production phase separation is invalid |
| Required PR/CI/harness check fails | Do not merge; fix through feature -> staging -> renewed promotion |
| Vercel/Worker cross-plane mismatch after merge | Roll back the advanced runtime to its last known-good deployment, then diagnose |
| Production extension artifact fails | Keep it unpublished; do not call closeout complete |
| Automated production smoke fails | Activate the surface-specific rollback and record an incident |
| Only two-network/TURN remains unexecuted | Record the approved non-launch deferral; do not claim public readiness |

## Definition Of Complete

The plan is complete only when all of these are true:

- the user approved the non-launch scope, every individual merge, and the
  intentional reauthentication boundary;
- the exact staging candidate and current main were rechecked immediately before
  each production mutation;
- the 12 migrations were promoted first and verified on production;
- the old production runtime stayed healthy after migration-only deployment;
- runtime PR B contained zero migration diff and was tree-identical to frozen
  `staging`;
- main CI, production Vercel, production Worker, no-op DB workflow, and
  production extension artifact build/validation succeeded;
- automated production web/Worker smokes passed;
- no Chrome Web Store/public-launch action occurred;
- PR `#174` was closed as superseded rather than merged;
- `staging` became an ancestor of `main` and their trees matched before the
  small closeout docs change;
- production facts and residual risks were recorded honestly;
- branch/worktree/artifact cleanup preserved every uncommitted user file;
- remaining UI/UX and deferred launch work stayed separate.
