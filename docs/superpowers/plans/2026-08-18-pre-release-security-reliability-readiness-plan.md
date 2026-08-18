# AniDachi Pre-release Security And Reliability Readiness Plan

> **For Codex:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to
> implement this plan task-by-task. Use `superpowers:test-driven-development`
> for every runtime task, `codex-security:fix-finding` for security findings,
> and `superpowers:requesting-code-review` at every wave stop. Do not skip the
> drift gates or continue after a failed stop condition.

Status: Wave 1 complete on staging; Wave 2 Task 5 deployed to staging, with
interactive provider acceptance pending; Task 6 source implementation complete
locally, with staging acceptance pending

Date: 2026-08-18

Design authority:
`docs/superpowers/specs/2026-08-18-pre-release-security-reliability-readiness-design.md`

Security evidence authority: completed read-only scan at revision
`5af88fd2e1ad3440a4e9959e52332ac19e0c633f`, scan ID
`549049a7-5f73-453a-af82-4df10f5b3363`.

## Goal

Close the validated pre-release security and resource-boundary gaps without
rebuilding AniDachi, degrading the local-first Watch History experience, or
adding unnecessary MVP infrastructure. The resulting staging branch must be a
clean and reliable base for the separate UI/UX, social, groups, and shared-room
product work that follows.

This plan does **not** include production release, a merge to `main`, production
migrations, production deployment, public launch, or final UI/UX work.

## Architecture

The existing planes remain:

- `packages/protocol` owns strict cross-plane schemas and limits;
- `apps/web` owns website/extension auth issuance, durable account state,
  Supabase RPCs, Blob access, billing ownership, and server media intake;
- `apps/api` owns room tokens, Durable Object admission, live room state, and
  room-history attestation issuance;
- `apps/extension` owns provider observation, local-first Watch History,
  extension-owned diagnostics, and trusted user interaction;
- Supabase remains the durable source of truth and Vercel/Cloudflare remain the
  current hosting/runtime platforms.

No generic security gateway, new queue service, polling platform, or second
history authority is introduced.

### Database implementation contract

- Create every migration at execution time with
  `supabase --workdir apps/web migration new <descriptive_name>` after checking
  the installed CLI `--help`; `<generated>` paths below are not invented
  timestamps.
- Every new table in an exposed schema has RLS enabled. Internal tables have no
  client policy and explicitly revoke `public`, `anon`, and `authenticated`.
- Prefer `security invoker` functions with `search_path = ''` and fully qualified
  relations. Any unavoidable `security definer` function requires a separate
  threat-model note, owner check, non-public placement where possible, explicit
  `EXECUTE` revocation, and a privilege test.
- Postgres grants function execution to `PUBLIC` by default, so every internal
  function explicitly revokes `PUBLIC`, `anon`, and `authenticated`, grants only
  the intended role, and has pgTAP/Data API privilege coverage.
- Before every schema commit, run the local reset, pgTAP, lint, and the installed
  CLI's `db advisors`; inspect the generated migration list rather than assuming
  filename order from this document.

## Execution Contract: Never Follow This Plan Blindly

At the start of every task:

1. fetch and inspect the current `origin/staging` state;
2. query Graphify for the task boundary, then verify every important claim in
   source;
3. re-read the relevant plane `AGENTS.md` and current official platform docs;
4. inspect existing tests and all producers/consumers before editing;
5. compare the current source with this plan's assumptions;
6. stop and amend the design/plan if ownership, deployed state, or protocol has
   materially changed.

No task may silently reinterpret a finding, choose an unmeasured limit, or
preserve a legacy path just because it is mentioned here.

## Fixed Product And Safety Decisions

- Existing Watch History v2 stays. This plan closes its remaining episode-read
  and durable-abuse bounds; it does not return to v1.
- History remains local-first in the extension and server-authoritative after
  synchronization.
- Watch History receipts retain exactly 14 days.
- Outbox shape remains terminal plus latest per logical session; there is no
  outbox TTL or arbitrary key-count cap.
- Stored history remains complete. Pagination bounds transport and query work,
  not what the user is allowed to have watched.
- Website and extension auth become explicit channels. Because the product is
  pre-release and current data is test data, legacy refresh sessions are revoked
  at cutover instead of maintaining a permanent dual verifier.
- The current signing secret may remain for MVP with strict claim separation.
- Public or media limits must be backed by benchmark evidence recorded in the
  task report before staging.
- Unsafe uncertainty fails closed: a Blob may temporarily return `404`, a media
  fetch may be rejected, or a user may need to sign in again. The system never
  falls back to a broad credential read or cross-channel token.
- Task 6 does not depend on Chrome Web Store publication. Local and staging use
  separate repository-controlled public Chromium manifest keys with exact IDs;
  no private key is persisted. Each web deployment accepts one exact matching
  ID, while production has no approved identity and fails closed until a future
  explicit production cutover.

## Evidence-gated Initial Candidates

These values are starting hypotheses, not approved constants:

- a 24-hour delayed shared-room delivery window, intended to cover an overnight
  client/network interruption without equating authority lifetime to 14-day
  receipt retention;
- a 10-second pre-JOIN deadline and at most two pending sockets per authenticated
  participant, intended to cover the supported two-tab/device reconnect model.

Task 0 must validate them against the documented product promise, current room
reconnect traces, multi-tab behavior, and staging measurements. If the evidence
does not support a candidate, amend this design/plan before runtime work. Do not
silently raise it or preserve it merely because it is written here.

## Findings And Task Ownership

The row order and stable IDs below match `findings.json`; task reports and the
final re-scan use the ID, never an informal ordinal alone.

| # | Stable finding ID | Severity | Security item | Owning task |
| --- | --- | --- | --- | --- |
| 1 | `csf_83aeca0b556971026e425944` | high | public Blob proxy reaches private objects | Tasks 3-4 |
| 2 | `csf_98f48a4e4262becc1c8a9c44` | high | Chromium callback wildcard | Task 6 |
| 3 | `csf_8d596b89b735b2b647ec092a` | high | Next.js below fixed version | Task 2 |
| 4 | `csf_4d81bc523ba749d6d6a7b7fc` | medium | predictable OAuth state | Task 5 |
| 5 | `csf_4f0fce7bb9df75aa82f8de85` | medium | room-history replay | Task 9 |
| 6 | `csf_4ba44429432d4a225b1b6dba` | medium | checkout ownership | Task 15 |
| 7 | `csf_e510e2a7537d8b0621a2f79e` | medium | refresh replay/sliding lifetime | Task 7 |
| 8 | `csf_e8f5cba805995a4d8cfc3a1a` | medium | website accepts extension credentials | Task 7 |
| 9 | `csf_d0233a81c50e161bccd01922` | medium | pre-JOIN socket exhaustion | Task 10 |
| 10 | `csf_5402810ef329b0d7deb11c61` | medium | Watch History durable exhaustion | Task 13 |
| 11 | `csf_480cb74e6aa98fc952309fb5` | medium | page-origin diagnostics | Task 11 |
| 12 | `csf_ee96e3b67a5bf6cafb01709a` | medium | synthetic privileged extension actions | Task 11 |
| 13 | `csf_8a086af2924c376bbd7ff60e` | medium | Bloü arbitrary server fetch | Task 14 |
| 14 | `csf_ee4edf5bc90e54bcb4772153` | medium | OpenClaw unbounded image decode | Task 14 |
| 15 | `csf_e456654ba15fbb3388737ac0` | medium | arbitrary room redirects | Task 15 |
| 16 | `csf_653a1e8f1373a829acc0d816` | medium | staging/CRM password guessing | Task 16 |
| 17 | `csf_d96bf0ac0d9e37ff4bf7ee80` | medium | interest subscription amplification | Task 16 |
| 18 | `csf_c4f920ca76eea1b605b51856` | low | auth artifact retention | Tasks 7-8 |
| 19 | `csf_d7cf410cdf5606dfd4715d8e` | low | waitlist enumeration | Task 16 |
| 20 | `csf_0b6d766e6d2e63968a9fb8dd` | low | ICE query token | Task 15 |
| extra | project readiness gap | blocking before public history | unbounded visible-title episode response | Tasks 12-13 |

## Required Wave Stops

There is one evidence preflight (Wave 0) followed by six implementation waves.
At each stop:

1. run the named focused and plane gates;
2. run `git diff --check` and inspect the exact changed paths;
3. perform CodeRabbit review where code changed, then manual source review;
4. record migration/env/secret/rollback impact;
5. commit only the completed task or coherent review fix;
6. stop for an explicit go/no-go decision before the next wave.

If CodeRabbit authentication/service is unavailable, record the exact failure,
run the manual and security-specific review anyway, and mark the automated
review unproven. Do not describe it as passed; the wave proceeds only after an
explicit go/no-go decision accepts that temporary external-tool limitation.

Do not combine database prerequisites with runtime consumers in one staging
deployment when the application can deploy before its migration.

---

# Wave 0 — Evidence Freeze And Decision Gates

## Task 0: Create The Clean Execution Branch And Baseline

**Files:**

- Read: root and relevant plane `AGENTS.md` files
- Read: `docs/project-operating-manual.md`
- Read: `docs/current-development-state.md`
- Read: `docs/project-architecture-and-development.md`
- Read: `docs/development-quality-gates.md`
- Create during execution only:
  `.superpowers/sdd/2026-08-18-pre-release-security-reliability-readiness/task-0-report.md`

**Step 1: Preserve the approved plan while starting from current staging**

```bash
git fetch origin
git status --short --branch
git worktree list --porcelain
git switch codex/pre-release-security-readiness-plan
git merge-base --is-ancestor origin/staging HEAD
git switch -c codex/pre-release-security-readiness
fnm exec --using="$(cat .node-version)" node --version
fnm exec --using="$(cat .node-version)" pnpm --version
supabase --version
supabase migration new --help
supabase db --help
```

Expected: `origin/staging` is an ancestor of the reviewed planning commit, so the
new execution branch contains both the current staging runtime and the approved
design/plan. If the ancestry check fails because staging advanced, stop and
rebase or recreate the planning branch on the new staging head, re-run the plan
review, and only then create the execution branch. Do not branch directly from
`origin/staging` and accidentally omit the approved documents. No user WIP or
unrelated generated files may be staged. Do not prune worktrees or remove backup
extension folders.

**Step 2: Re-run the security boundary query and direct source checks**

```bash
graphify query "Trace public Blob reads, website and extension auth channels, room-history authority, pre-JOIN WebSockets, Watch History storage, and server media fetchers."
rg -n "chromiumapp|jwtVerify|refresh_tokens|room_history|blob|get\(|fetch\(|acceptWebSocket|watch_history_receipts" \
  apps/web apps/api apps/extension packages/protocol
```

Expected: Graphify supplies navigation only; the report records direct source
owners and all changed paths since the scan revision.

**Step 3: Run fresh baseline gates without repairing failures**

```bash
pnpm dev:check
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api test:runtime
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
pnpm harness:rooms
```

Record every baseline failure. An unrelated failure is not repaired inside this
plan without a separate scope decision.

**Step 4: Freeze the external evidence needed by later binary gates**

Read metadata/configuration without retrieving secrets or private object bodies:

- deployed Blob store access mode and object prefix inventory;
- current valid public-media object types and byte/dimension distribution,
  without reading private object bodies;
- explicit staging/local extension IDs and production fail-closed state;
- Vercel Firewall or other durable edge rate-limit rules;
- Supabase extensions and scheduling capability;
- current Supabase changelog entries relevant to Auth, Data API exposure,
  Postgres, Cron, and CLI behavior; do not pin an extension version clause that
  the current platform ignores;
- current staging migration history;
- Cloudflare Worker compatibility date and Durable Object configuration.

Record exactly one outcome for each gate:

```txt
BLOB_SHARED_NAMESPACE_SAFE | BLOB_PRIVATE_MIGRATION_REQUIRED
EDGE_RATE_LIMITS_PROVEN | APP_RATE_LIMITER_REQUIRED
SUPABASE_CRON_AVAILABLE | VERCEL_CRON_REQUIRED
EXTENSION_ID_SET_COMPLETE | EXTENSION_ID_SET_BLOCKED
ROOM_HISTORY_GRACE_PROVEN | ROOM_HISTORY_GRACE_AMENDMENT_REQUIRED
ROOM_ADMISSION_LIMITS_PROVEN | ROOM_ADMISSION_LIMITS_AMENDMENT_REQUIRED
```

If `EXTENSION_ID_SET_BLOCKED`, stop before Wave 2. Do not retain a wildcard as a
temporary workaround. If either room limit requires amendment, update the
design, shared constant names, tests, and this plan before Tasks 9-10. The Task 0
report must record the product behavior and measurement supporting the selected
values, not only the resulting numbers.

Controller amendment for Task 6: `EXTENSION_ID_SET_COMPLETE` is satisfied by the
stable repository-controlled unpacked local and staging public manifest keys.
Production intentionally has no approved ID and remains fail-closed; Chrome Web
Store publication is not a prerequisite or part of this plan.

**Step 5: Commit no runtime**

Task 0 produces only its ignored evidence report. Confirm:

```bash
git status --short
git diff --check
```

Expected: tracked source is unchanged.

### Wave 0 Stop

Required: clean tracked tree, fresh baseline results, source-drift map, all six
binary platform/product gates recorded, and no runtime or migration change.
Stop for go/no-go; a blocked extension-ID gate or an unreviewed room-limit
amendment prevents its dependent task from starting.

---

# Wave 1 — Immediate High-severity Boundaries

## Task 1: Record The Wave 1 RED Security Regressions

**Files:**

- Create: `apps/web/lib/pre-release-security-boundaries.test.ts`

**Step 1: Add source-to-runtime fixtures for the two Wave 1 high findings**

Write tests that prove the current failure modes without live exploitation:

- a media request for a credential/CRM prefix reaches the injected Blob getter;
- the installed Next.js version is below `15.5.23` and the staging middleware
  and Server Action surfaces exist.

The extension callback high finding receives its own immediate RED in Task 6 so
the branch is not deliberately left failing between waves.

**Step 2: Run the valid RED**

```bash
pnpm --filter @anidachi/web test
```

Expected: only the new security regression assertions fail; existing web tests
remain green. Correct test setup errors before accepting RED.

**Step 3: Commit tests only**

```bash
git add apps/web/lib/pre-release-security-boundaries.test.ts \
  apps/web/lib/middleware-routes.test.ts \
  apps/web/lib/internal-tool-routes.test.ts
git diff --cached --check
git commit -m "test(security): capture pre-release boundary regressions"
```

Stage only files that actually changed.

## Task 2: Patch Next.js Within The Existing 15.5 Line

**Files:**

- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/web/lib/middleware-routes.test.ts`
- Modify: `apps/web/lib/internal-tool-routes.test.ts`
- Modify: `apps/web/lib/pre-release-security-boundaries.test.ts`

**Step 1: Recheck the two official advisories**

Recheck the compatible 15.5 line against the official advisories. The execution
recheck selected exact `15.5.23`, which supersedes the earlier `15.5.21` floor
and closes the known Next-specific advisories without a Next.js 16 migration.

**Step 2: Pin and install the fixed patch**

Set `next` to exact `15.5.23`, then run:

```bash
pnpm install --frozen-lockfile=false
pnpm install --frozen-lockfile
```

Do not accept unrelated major dependency updates in the lockfile.

**Step 3: Prove the patched framework boundary without duplicating internals**

The official advisories define upgrading as the fix; application unit tests
cannot faithfully reproduce Next.js route normalization or crafted Server
Action parsing. Pin both package and lockfile to the exact patched version and
verify the installed dependency audit contains no Next.js advisory. After the
staging deployment, send unauthenticated normal, `.rsc`, and segment-prefetch
transport variants to a protected route and prove the staging gate handles all
of them. Send only a small malformed Server Action request to prove failure
containment; do not generate denial-of-service traffic. Record the exact
requests/statuses in the wave report.

**Step 4: Run GREEN**

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web build
pnpm audit --prod --json
git diff --check
```

The repository-wide audit may retain separately scoped advisories. The Wave 1
gate is that no advisory targets the installed Next.js package; do not hide or
misclassify findings owned by later waves.

**Step 5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml \
  apps/web/lib/middleware-routes.test.ts \
  apps/web/lib/internal-tool-routes.test.ts \
  apps/web/lib/pre-release-security-boundaries.test.ts
git commit -m "fix(web): update Next.js security patch"
```

Rollback: restore the prior package and lock entries only if the fixed patch
breaks staging; the high finding then remains open and later waves do not make
the project public-ready.

## Task 3: Restrict The Public Blob Media Boundary

**Files:**

- Create: `apps/web/lib/public-media-blob.ts`
- Create: `apps/web/lib/public-media-blob.test.ts`
- Modify: `apps/web/app/api/media/[...path]/route.ts`
- Modify: `apps/web/lib/pre-release-security-boundaries.test.ts`
- Modify as owners of explicit namespaces:
  `apps/web/lib/instagram/storage.ts`
- Modify as owners of explicit namespaces:
  `apps/web/lib/tiktok/storage.ts`
- Modify as owners of explicit namespaces:
  `apps/web/lib/youtube/storage.ts`
- Modify as owners of explicit namespaces:
  `apps/web/lib/kreatli-crm/gmail-tokens.ts`
- Modify as owners of explicit namespaces:
  `apps/web/lib/kreatli-crm/store.ts`

**Step 1: Add failing namespace and no-fetch tests**

Tests must reject credential, OAuth, Gmail, CRM, traversal, encoded separator,
and unknown-prefix paths before the injected Blob getter runs. Add valid public
image and video fixtures plus a conditional GET case. For a syntactically valid
public identifier, test that mismatched type and oversized metadata return
`404` without exposing the returned body.

**Step 2: Implement one allowlist helper**

`public-media-blob.ts` owns canonical prefix parsing, image/video content-type
allowlisting, streaming headers, the existing 100 MiB product ceiling, and
`404` mapping. Record the deployed inventory and ceiling in the task report.
The route accepts only application-owned public media identifiers. It does not
accept an arbitrary Blob pathname or URL.

Credential storage modules export their private namespace constants so tests
can prove they never intersect the public namespace. They do not expose tokens
or object contents.

**Step 3: Run GREEN**

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
```

**Step 4: Commit**

```bash
git add apps/web/lib/public-media-blob.ts \
  apps/web/lib/public-media-blob.test.ts \
  'apps/web/app/api/media/[...path]/route.ts' \
  apps/web/lib/pre-release-security-boundaries.test.ts \
  apps/web/lib/instagram/storage.ts apps/web/lib/tiktok/storage.ts \
  apps/web/lib/youtube/storage.ts \
  apps/web/lib/kreatli-crm/gmail-tokens.ts \
  apps/web/lib/kreatli-crm/store.ts
git commit -m "fix(web): isolate public Blob media reads"
```

## Task 4: Apply The Blob Inventory Gate

**Files depend on Task 0 outcome.**

### Path A: `BLOB_SHARED_NAMESPACE_SAFE`

Prove that deployed credentials are private and no disallowed namespace is
reachable after Task 3. Add the evidence to the wave report. Do not create a
credential migration merely for architectural symmetry.

### Path B: `BLOB_PRIVATE_MIGRATION_REQUIRED`

**Files:**

- Create: `apps/web/lib/private-integration-blob.ts`
- Create: `apps/web/lib/private-integration-blob.test.ts`
- Create: `apps/web/scripts/migrate-private-integration-blobs.ts`
- Modify: `apps/web/lib/instagram/storage.ts`
- Modify: `apps/web/lib/tiktok/storage.ts`
- Modify: `apps/web/lib/youtube/storage.ts`
- Modify: `apps/web/lib/google-ads/tokens.ts`
- Modify: `apps/web/lib/kreatli-crm/gmail-tokens.ts`
- Modify: `apps/web/lib/kreatli-crm/store.ts`
- Modify: `apps/web/lib/kreatli-crm/contact-messages.ts`
- Modify: `apps/web/lib/kreatli-crm/feature-requests.ts`
- Create: `apps/web/lib/kreatli-crm/private-integration-blob-jsonl.ts`
- Modify: `apps/web/lib/openclaw-jobs.ts`
- Modify: server routes that write private upload/job objects
- Modify: `apps/web/.env.example` only with secret names, never values

**Step 1: Test read-old/write-new and strict private access**

RED fixtures must prove phase-A reads use the origin-fresh legacy authority,
writes complete legacy-first and then mirror to the private store, semantic
deletes remove private first and legacy second before reporting success, and
the compatibility behavior applies only to inventoried exact paths while the
staging-only flag is enabled. Phase B must read/write/delete private only.
For the public legacy read, obtain current control-plane metadata, add a unique
ETag version parameter to the returned public URL, and require the body ETag to
match before parsing it; `useCache: false` alone is not a public-store freshness
guarantee. Credential disconnect owners must propagate deletion failures.
Public proxy access remains impossible in both phases.

**Step 2: Implement a resumable metadata-only migration command**

The script copies only inventoried credential/CRM objects, verifies destination
metadata/hash, records no secret values, and supports dry-run. It never deletes
the source object in the same run.

**Step 3: Remove compatibility after staging copy proof**

Deploy phase A before the final copy so old staging functions can drain while
new functions preserve the legacy store as the read authority and mirror every
write. The execution inventory contained 412 eligible objects
(1,120,524 bytes), including 403 mutable OpenClaw job objects. After the phase-A
deployment and drain window, rerun the metadata/hash migration to zero conflicts
and rerun it a second time to prove idempotency. Then remove legacy reads and
dual writes plus the staging flag in a separate phase-B commit and deployment.
If live evidence proves the legacy source store is also written by a non-staging
deployment outside this plan's authority, do not loop full scans or modify that
deployment. Take one origin-fresh, ETag-protected final snapshot of each differing
mutable staging object immediately before the phase-B alias switch, make staging
private-only, and validate or reconnect the affected test integration there. The
post-switch private store is the staging authority; later writes to the shared
legacy source do not reopen compatibility.
Record that bounded snapshot in the ignored execution report without object
bodies or credentials. Each entry contains the pathname, source ETag, previous
destination ETag or digest, UTC snapshot time, copied source digest, verified
private destination digest, and a successful origin-fresh private-only read.
Every entry must pass before the alias switch. If any entry fails, keep phase A
live. If post-switch validation fails before the first phase-B private write,
restore the prior phase-A staging deployment and its staging-only flag. After a
phase-B private write, do not automatically reopen the legacy authority; fail
closed and reconcile or reconnect the affected staging test integration.
Product-initiated disconnect/delete operations remove the exact object from
both stores during phase A; unrelated bulk deletion of old objects remains a
separately approved, recoverable operation. If prior exposure cannot be
excluded, produce a credential-rotation list; do not rotate automatically
inside this task.

**Step 4: Verify and commit**

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
git diff --check
git commit -m "fix(web): move integration credentials to private Blob storage"
```

### Wave 1 Stop

Required GREEN: complete web tests/check/build, public-route negative fixtures,
Next `15.5.23`, and a recorded two-phase Blob gate outcome. The official private
store token connection is sufficient for the staging cutover; upgrading the
existing Vercel project to OIDC remains a separate dashboard hardening action
that must not be silently performed without an attended confirmation. Stop if a
credential namespace remains publicly reachable, phase-B legacy reads remain,
or the deployed access mode is unknown.

Outcome on 2026-08-18: **PASSED on staging.** PRs `#192` through `#195`
completed the reviewed source boundaries and private-only cutover. Merge
`07dfaf4a8bd0c192e21fd381f4350ab88cdab322` is live as Vercel deployment
`dpl_B6dD3YJdGJrkBfkppQGsXH9PdaBL`; both staging aliases resolve to it, the
deployment-specific staging smoke passed, and the public gate still returns
`no-store` plus `noindex,nofollow`. The bounded final manifest verified 412
allowlisted objects, atomically refreshed three differing private test objects,
and proved origin-fresh private reads without logging bodies or credentials.
All four affected TikTok test accounts passed provider health from the current
private-only runtime. The temporary staging legacy flag is removed and absent
from a fresh environment pull. One unrelated internal YouTube publishing test
credential needs later manual reconnection; it does not affect AniDachi auth,
rooms, Watch History, or the extension and does not reopen Blob compatibility.

---

# Wave 2 — Auth Transaction, Token Channel, And Retention

## Task 5: Make Browser OAuth State One-time And Unpredictable

**Files:**

- Create: `apps/web/lib/anidachi-auth/oauth-transaction.ts`
- Create: `apps/web/lib/anidachi-auth/oauth-transaction.test.ts`
- Create with `supabase migration new oauth_login_transactions`:
  `apps/web/supabase/migrations/<generated>_oauth_login_transactions.sql`
- Create: `apps/web/supabase/tests/oauth_login_transactions.test.sql`
- Modify: `apps/web/app/api/auth/google/route.ts`
- Modify: `apps/web/app/api/auth/discord/route.ts`
- Modify: `apps/web/lib/anidachi-auth/handle-oauth-callback.ts`
- Modify: `apps/web/lib/anidachi-auth/oauth/google.ts`
- Modify: `apps/web/lib/anidachi-auth/oauth/discord.ts`
- Add/modify focused callback route tests under
  `apps/web/lib/anidachi-auth/oauth-routes.test.ts`

**Step 1: Write RED tests**

Cover 128-bit random state, state and browser-correlation hashes at rest,
provider binding, sanitized return path, S256 PKCE, single consumption,
ten-minute expiry, two concurrent login tabs, cross-provider swap, callback
replay, and callback failure cleanup. Ten minutes is the initial interactive
login abuse window; keep it only if real staging provider consent completes
comfortably inside it, otherwise amend and document the security/product tradeoff.

**Step 2: Add the service-role-only transaction table/RPCs**

The table stores state hash, browser-correlation hash, provider, return path,
created/expiry/consumed timestamps, and no raw state, correlation secret, or
PKCE verifier. Derive the PKCE verifier from the random state with an
HKDF-separated `oauth-pkce-v1` subkey of the existing server-only
`ANIDACHI_JWT_SECRET`; the derived verifier is never stored or sent to the
browser. Enable RLS, create no client policy, revoke `public`, `anon`, and
`authenticated`, and grant only `service_role`.

**Step 3: Replace deterministic state**

Initiation generates 32 random state bytes plus an independent correlation
secret, stores only their hashes, sends the S256 challenge to the provider, and
sets a transaction-scoped HttpOnly correlation cookie. Its non-secret cookie
selector is derived from the state digest so concurrent tabs do not overwrite
one shared slot. The callback requires and clears the exact cookie, atomically
consumes matching provider/state/correlation, and supplies the derived verifier.

**Step 4: Verify**

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
supabase --workdir apps/web db reset
supabase --workdir apps/web test db
supabase --workdir apps/web db lint --level warning
```

**Step 5: Commit**

```bash
git add apps/web/lib/anidachi-auth/oauth-transaction.ts \
  apps/web/lib/anidachi-auth/oauth-transaction.test.ts \
  apps/web/app/api/auth/google/route.ts \
  apps/web/app/api/auth/discord/route.ts \
  apps/web/lib/anidachi-auth/handle-oauth-callback.ts \
  apps/web/lib/anidachi-auth/oauth/google.ts \
  apps/web/lib/anidachi-auth/oauth/discord.ts \
  apps/web/supabase/migrations/*_oauth_login_transactions.sql \
  apps/web/supabase/tests/oauth_login_transactions.test.sql
git commit -m "fix(auth): bind browser OAuth transactions"
```

Outcome on 2026-08-18: **SOURCE, DATABASE, AND AUTOMATED STAGING GATES PASSED;
INTERACTIVE PROVIDER ACCEPTANCE PENDING.** PR `#197` merged to `staging` as
`d330be47cb23ee58eeba3e0db18ec1f2f2e86e21`. Migration
`20260818131602_oauth_login_transactions.sql` is applied and the linked dry run
is empty. Local web tests, pgTAP, typecheck, independent review, CodeRabbit,
GitHub CI, migration deployment, rooms/P2P E2E, Vercel deployment, and staging
smoke are green. The deployed flow uses random one-time state, independent
browser correlation, S256 PKCE, provider binding, atomic consumption, exact
cookie cleanup, and generic public failures.

Do not yet call the ten-minute interaction window accepted: completing a real
Google and Discord consent/callback on staging remains an attended manual gate.
Task 6's earlier Chrome Web Store prerequisite is superseded by the approved
pre-release binding: stable repository-controlled unpacked local/staging
identities, exact per-environment allowlisting, and fail-closed production. The
wildcard callback must not be restored.

## Task 6: Bind Extension Connection To Approved IDs And PKCE

**Files:**

- Create: `packages/protocol/src/auth.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/protocol/test/auth.test.ts`
- Modify: `apps/extension/src/auth-client.ts`
- Create: `apps/extension/src/extension-channel-identity.ts`
- Modify: `apps/extension/test/auth-client.test.ts`
- Modify: `apps/extension/wxt.config.ts`
- Modify: `apps/web/app/extension/connect/page.tsx`
- Modify: `apps/web/app/extension/logout/route.ts`
- Modify: `apps/web/app/api/extension/auth/exchange/route.ts`
- Modify: `apps/web/lib/anidachi-auth/extension-codes.ts`
- Create: `apps/web/lib/anidachi-auth/extension-codes.test.ts`
- Create with `supabase migration new extension_auth_pkce`:
  `apps/web/supabase/migrations/<generated>_extension_auth_pkce.sql`
- Create: `apps/web/supabase/tests/extension_auth_pkce.test.sql`
- Modify: `apps/web/.env.example` with ID variable names only
- Modify: `scripts/validate-extension-artifact.mjs`
- Modify: affected active extension/auth documentation and staging smoke inputs

**Step 1: Close the protocol with RED fixtures**

Define strict initiation/exchange shapes for extension ID, exact redirect URI,
state, authorization code, PKCE challenge/verifier, and error codes. Reject
unknown fields and oversized values.

**Step 2: Add exact environment allowlist parsing**

Derive the stable local ID `nkinhhgigcflmfhilmcakbkongcpkfnl` and staging ID
`ndkfphbchhfephdodcpehdcoclojagje` from committed public manifest keys. Accept
only the single exact `ANIDACHI_EXTENSION_CLIENT_ID` configured for that web
environment and its `/auth` or `/logout` callback. Reject every other
`chromiumapp.org` host before code issuance and exchange. Production has no
manifest key and remains fail-closed without an explicitly configured future
production ID.

**Step 3: Implement PKCE S256 end to end**

The extension generates/verifies state locally, retains the verifier only for
the active flow, and sends its exact `chrome.identity.getRedirectURL()` result.
The server binds code hash, extension ID, redirect URI, challenge, user, expiry,
and consumption. Exchange is atomic and single-use.

**Step 4: Verify**

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
supabase --workdir apps/web db reset
supabase --workdir apps/web test db
```

**Step 5: Commit**

```bash
git commit -m "fix(auth): bind extension connection to approved clients"
```

Before committing, stage only the files listed above that actually changed and
run `git diff --cached --check`.

## Task 7: Separate Token Channels And Rotate Refresh Families

**Files:**

- Create with `supabase migration new auth_channel_rotation`:
  `apps/web/supabase/migrations/<generated>_auth_channel_rotation.sql`
- Create: `apps/web/supabase/tests/auth_channel_rotation.test.sql`
- Modify: `apps/web/lib/anidachi-auth/jwt.ts`
- Modify: `apps/web/lib/anidachi-auth/jwt.test.ts`
- Modify: `apps/web/lib/anidachi-auth/db.ts`
- Modify: `apps/web/lib/anidachi-auth/tokens.ts`
- Modify: `apps/web/lib/anidachi-auth/extension-session.ts`
- Modify: `apps/web/lib/anidachi-auth/website-session.ts`
- Modify: `apps/web/app/api/auth/refresh/route.ts`
- Modify: `apps/web/app/api/extension/auth/refresh/route.ts`
- Modify: `apps/web/app/api/extension/auth/logout/route.ts`
- Modify: `apps/web/app/api/auth/logout/route.ts`
- Modify: `apps/extension/src/auth-client.ts`
- Modify: `apps/extension/src/auth-tokens.ts`
- Modify: `apps/extension/test/auth-client.test.ts`

**Step 1: Add RED claim/channel/replay tests**

Cover exact HS256, issuer, audience, type, subject, issued/expiry claims;
website-rejects-extension and extension-rejects-website; wrong-channel refresh;
atomic rotation; predecessor replay family revocation; concurrent refresh winner;
the existing 90-day session horizon converted from sliding to absolute expiry;
logout family revocation; account deletion.

**Step 2: Add refresh family storage**

Add channel, family ID, device ID when present, token hash, parent/current token
state, created/last-used/absolute-expiry/revoked timestamps, and the indexes used
by rotation and cleanup. Keep RLS enabled and service-role-only access.

**Step 3: Implement clean pre-release cutover**

Mark every legacy refresh row revoked during migration. Do not add a legacy
fallback verifier. Existing staging users and extensions sign in once again.
Access tokens without the new exact channel claims are rejected.

**Step 4: Make extension rotation race-safe**

The extension persists a rotated refresh token only if the current stored token
still matches the request predecessor. A late response from an older account or
token is discarded. Existing Watch History account fences remain intact.

**Step 5: Verify and commit**

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
supabase --workdir apps/web db reset
supabase --workdir apps/web test db
git diff --check
git commit -m "fix(auth): separate channels and rotate refresh families"
```

## Task 8: Add Bounded Auth Artifact Cleanup

**Files:**

- Create with `supabase migration new auth_artifact_cleanup`:
  `apps/web/supabase/migrations/<generated>_auth_artifact_cleanup.sql`
- Create: `apps/web/supabase/tests/auth_artifact_cleanup.test.sql`
- Create conditionally for `VERCEL_CRON_REQUIRED`:
  `apps/web/app/api/internal/cleanup-auth-artifacts/route.ts`
- Create conditionally:
  `apps/web/lib/anidachi-auth/artifact-cleanup.test.ts`
- Create or modify conditionally: `vercel.json`

**Step 1: Test bounded cleanup**

RED tests cover immediate deletion of consumed extension codes, batch deletion
of expired codes/OAuth transactions/refresh rows, preservation of active
families, service-role-only execution, repeatability, and a hard batch bound.

**Step 2: Use the Task 0 scheduler outcome**

- `SUPABASE_CRON_AVAILABLE`: schedule the bounded SQL function in Supabase.
- `VERCEL_CRON_REQUIRED`: create one CRON_SECRET-protected route calling the same
  SQL function; it accepts no user input and logs counts only.

**Step 3: Verify and commit**

```bash
supabase --workdir apps/web db reset
supabase --workdir apps/web test db
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
git commit -m "fix(auth): bound credential artifact retention"
```

### Wave 2 Stop

Required GREEN: new login and extension connection, exact channel rejection,
refresh replay/concurrency, cleanup, full web/extension/protocol checks, and a
documented staging reauthentication consequence. Stop if any legacy token is
accepted cross-channel.

---

# Wave 3 — Room Capability, Worker Admission, And Extension Isolation

## Task 9: Bound Room-history Authority Lifetime

**Files:**

- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/test/protocol.test.ts`
- Modify: `apps/api/src/auth.ts`
- Modify: `apps/api/test/auth.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/test/routes.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-authority.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-authority.test.ts`
- Create with `supabase migration new room_history_authority_expiry`:
  `apps/web/supabase/migrations/<generated>_room_history_authority_expiry.sql`
- Modify: `apps/web/supabase/tests/watch_history_v2.test.sql`
- Modify: `apps/extension/src/watch-history-client.ts`
- Modify: `apps/extension/test/watch-history-client.test.ts`

**Step 1: Add RED lifecycle fixtures**

Cover mandatory `exp` and `jti`, the Task 0-selected maximum token age, wrong
type/issuer/audience, subject/session/room/source generation mismatch, exact
duplicate receipt after expiry, new event after expiry, delayed terminal before
and after room end, and no expired replay refresh of Recent People.

**Step 2: Close the shared contract**

Add one exported `ROOM_HISTORY_OFFLINE_GRACE_SECONDS` and the exact attestation
claims. Initialize it to 86,400 seconds only if Task 0 records
`ROOM_HISTORY_GRACE_PROVEN`; otherwise use the reviewed amended value. Worker
issuance, web verifier, SQL acceptance, and tests use that single
constant/configured value. Do not reuse the 14-day receipt lifetime.

**Step 3: Replace applied SQL functions additively**

The new migration uses `create or replace function` for v2 writers. It accepts
an already-receipted duplicate idempotently, but rejects a new expired/replayed
authority. It preserves self-only writes, generations, deletion fences, and the
two-writer Recent People rule.

**Step 4: Verify and commit**

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api test:runtime
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/extension test
supabase --workdir apps/web db reset
supabase --workdir apps/web test db
git commit -m "fix(history): expire room authority safely"
```

## Task 10: Enforce Admission Before Retaining WebSockets

**Files:**

- Create: `apps/api/src/room-admission.ts`
- Create: `apps/api/test/room-admission.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/src/room-rate-limit.ts`
- Modify: `apps/api/test/room-rate-limit.test.ts`
- Modify: `apps/api/test/routes.test.ts`
- Modify: `apps/api/test/room-socket-attachment.test.ts`

**Step 1: Add RED resource tests**

Cover the Task 0-selected per-subject pending limit and JOIN deadline, rejection
of the next socket before retention, room allowance derived from
`maxParticipants`, JOIN immediately before and at the exact deadline,
close/error counter release, participant replacement, hibernation rehydration,
aggregate rate budgets across replacement sockets, and an attachment-size check
well below Cloudflare's current 16,384-byte serialized attachment ceiling. Use
two sockets and ten seconds only after `ROOM_ADMISSION_LIMITS_PROVEN`; otherwise
test the reviewed amended constants.

**Step 2: Implement hibernation-safe admission state**

Authenticate first, reserve a pending subject/room slot, retain the socket, and
release or convert the reservation on JOIN/close/error/timeout. Store only the
minimum identity/deadline fields in the socket attachment. Never rely solely on
process memory after hibernation. Reconstruct reservations from attached sockets
after a wake rather than using module-global request state.

Use a short timer only during the bounded pre-JOIN phase and persist its absolute
deadline in the attachment. It may keep the object awake only until the selected
deadline; do not consume or replace the room's existing single Durable Object
alarm merely to manage each socket. Every message/JOIN path rechecks the absolute
deadline, and timeout/close races release a reservation exactly once.

**Step 3: Run GREEN**

```bash
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api test:runtime
pnpm --filter @anidachi/api check
pnpm harness:rooms
```

**Step 4: Commit**

```bash
git add apps/api/src/room-admission.ts apps/api/test/room-admission.test.ts \
  apps/api/src/index.ts apps/api/src/room-rate-limit.ts \
  apps/api/test/room-rate-limit.test.ts apps/api/test/routes.test.ts \
  apps/api/test/room-socket-attachment.test.ts
git commit -m "fix(api): bound room WebSocket admission"
```

## Task 11: Isolate Diagnostics And Privileged Overlay Actions

**Files:**

- Modify: `apps/extension/src/debug-log.ts`
- Modify: `apps/extension/test/debug-log.test.ts`
- Create: `apps/extension/src/privileged-overlay-intent.ts`
- Create: `apps/extension/test/privileged-overlay-intent.test.ts`
- Modify: `apps/extension/entrypoints/content.tsx`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/entrypoints/background.ts`
- Create: `apps/extension/test/privileged-overlay-wiring.test.tsx`

**Step 1: Add hostile-page RED tests**

Prove page `localStorage` receives no debug buffer; routine diagnostics contain
no title/reaction/user text/token/attestation; a synthetic untrusted click cannot
sign out/end a room; a forged content message cannot bypass current account,
role, room, or generation checks; a trusted click still succeeds once.

**Step 2: Move diagnostics to extension-owned state**

Use bounded extension session storage or memory. Preserve the existing explicit
support export after sanitation. Do not add `unlimitedStorage` or a telemetry
journal.

**Step 3: Close the shadow root and validate intent twice**

Use a closed shadow root for the overlay. Require `nativeEvent.isTrusted` in the
content UI and revalidate the narrow intent in background before mutation.
Normal playback observation, pause/seek capture, and local-first history do not
depend on this privileged-action gate.

**Step 4: Verify and commit**

```bash
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
pnpm build:extension:staging
pnpm validate:extension:staging
git commit -m "fix(extension): isolate diagnostics and privileged actions"
```

### Wave 3 Stop

Required GREEN: protocol/API/web/extension focused suites, room harness, loaded
artifact smoke, expiry/replay matrix, pending-socket exhaustion, and hostile-page
fixtures. Stop before history/database work if shared tracking regresses.

---

# Wave 4 — Bounded Watch History Read, Write, And Retention

## Task 12: Define Bounded Episode Pagination In Protocol

**Files:**

- Modify: `packages/protocol/src/watch-history.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/test/watch-history.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2-routes.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2-routes.test.ts`

**Step 1: Add RED strict-contract tests**

Add an opaque per-title episode cursor, bounded recent episode slice, exact
`hasMoreEpisodes`, and a strict title-episode page response. Cover cursor
round-trip, equal observed timestamps, stable binary ordering, unknown fields,
wrong provider/title, 500-input catalog ceiling, and no silent completeness
claim when more episodes exist.

**Step 2: Set one measured transport target**

Start the benchmark with 100 episode rows per visible title and a 50-title page.
The initial 2 MiB serialized-response and 32 MiB parser-RSS ceilings are derived
from the existing measured worst fixture (1,455,993 bytes and 22,036,480 bytes
RSS delta), leaving approximately 44% transport and 52% memory headroom while
removing the unbounded per-title episode fan-out. If the realistic fixture
exceeds either ceiling, reduce the episode slice until both pass. Record the
chosen value, fixture, Node/PostgreSQL versions, repetitions, and rationale as a
shared constant. Never increase a ceiling merely to make a fixture pass.

**Step 3: Close protocol and route request schemas**

The main list returns the bounded recent slice and continuation. A separate
authenticated title-episode request retrieves further keyset pages. Stored
history and title/season aggregates remain complete.

**Step 4: Verify and commit**

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
git commit -m "feat(protocol): bound watch history episode pages"
```

## Task 13: Add Bounded SQL Pages, Mutation Budgets, And Cleanup

**Files:**

- Create with `supabase migration new watch_history_v2_resource_bounds`:
  `apps/web/supabase/migrations/<generated>_watch_history_v2_resource_bounds.sql`
- Create: `apps/web/supabase/tests/watch_history_v2_resource_bounds.test.sql`
- Modify: `apps/web/supabase/contracts/watch_history_v2_migration_order_contract.sql`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2-sql.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2.local-rpc.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2.benchmark.test.ts`
- Create: `apps/web/app/api/watch-history/v2/title-episodes/route.ts`
- Modify: `apps/extension/src/watch-history-client.ts`
- Modify: `apps/extension/test/watch-history-client.test.ts`
- Modify: `apps/extension/src/popup-watch-history.tsx`
- Modify: `apps/extension/test/popup-watch-history.test.tsx`
- Modify: `apps/web/app/account/watch-library/watch-library-client.tsx`

**Step 1: Add SQL RED fixtures**

Prove the current list reads every episode for a visible title. Add fixtures for
one 2,000-episode title, equal cursor timestamps, forward/back page traversal,
deletion between pages, full clear generation advance, session enrichment, and
exact no-duplicate/no-skip behavior.

**Step 2: Implement indexed keyset episode pages**

Add the smallest supporting index and service-role-only function. Replace the
main list function so it reads only the bounded recent slice per visible title.
Do not materialize/rank the entire account before `LIMIT`. Keep exact title
count, canonical generation, C-collated stable ordering, and explicit JSON keys.

**Step 3: Calculate abuse budgets before enforcing them**

Use current five-second heartbeat behavior, observed and documented concurrent
Watch History devices/tabs, session rotation rules, 14-day receipt bytes, and
measured row sizes. Do not reuse the room pending-socket candidate as an account
device cap. Record normal/day and adversarial/hour storage projections. Limit
creation of new unique session identities and event receipts, not ordinary
updates to an existing session. A duplicate remains idempotent and a terminal
event is not evicted.

If the calculated budget would reject a documented normal flow, stop and amend
the design instead of raising an unexplained constant.

**Step 4: Add global expired-receipt cleanup**

Create one bounded service-role-only cleanup function preserving exactly 14
days. Use the scheduler outcome already selected in Task 8. Cleanup must be
repeatable, skip locked batches safely, and never delete progress, deletion
fences, summaries, or unexpired receipts.

**Step 5: Update consumers without blocking local-first UX**

Popup immediately renders its same-owner local projection and bounded canonical
snapshot. It does not eagerly fetch old episode pages. The website fetches
additional episode pages only when the title is expanded or the user requests
more. A failed detail fetch leaves existing rows visible with a retry state.

**Step 6: Run database and parser proof**

```bash
supabase --workdir apps/web db reset
supabase --workdir apps/web test db
supabase --workdir apps/web db lint --level warning
supabase --workdir apps/web db push --dry-run
WATCH_HISTORY_LOCAL_RPC_TEST=1 pnpm --filter @anidachi/web test
WATCH_HISTORY_BENCHMARK_TEST=1 pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
```

Benchmark acceptance:

- main 50-title page serialized body at or below 2 MiB;
- parser RSS delta below 32 MiB on the realistic fixture;
- visible title query and deep cursor use bounded index paths;
- one title episode page visits at most requested rows plus one lookahead;
- cleanup and new-session budget plans do not scan all users.

**Step 7: Split commits by deployment dependency**

```bash
git commit -m "feat(db): bound watch history resource lifecycle"
git commit -m "feat(history): consume bounded episode pages"
```

The database prerequisite commit must be deployable before the runtime consumer
and remain compatible with the then-current staging web app.

### Wave 4 Stop

Required GREEN: protocol, Supabase reset/lint/pgTAP/dry-run, real RPC parser,
benchmark, web/extension tests, deletion/outbox regressions, and a review of all
v1 selectors proving no v2 cross-version access. Stop if any response silently
claims complete episodes after truncation.

---

# Wave 5 — Server Media, Ownership, Redirects, And Public Abuse

## Task 14: Build One Bounded Server Media Intake Helper

**Files:**

- Create: `apps/web/lib/server-media-intake.ts`
- Create: `apps/web/lib/server-media-intake.test.ts`
- Modify: `apps/web/app/api/blou/publish/carousel/route.ts`
- Create: `apps/web/lib/blou-carousel-security-route.test.ts`
- Modify: `apps/web/app/api/openclaw/post/prepare/route.ts`
- Create: `apps/web/lib/openclaw-prepare-security-route.test.ts`

**Step 1: Add RED adversarial fixtures**

Cover HTTP/HTTPS scheme, URL credentials, loopback, RFC1918, link-local,
multicast, IPv4-in-IPv6, numeric host variants, DNS returning private IP,
redirect escape, redirect loop, slow response, oversized stream, MIME mismatch,
invalid magic bytes, excessive dimensions/pixels, aggregate multipart bytes,
file count, and bounded concurrency.

**Step 2: Implement the shared server-only helper**

Before choosing constants, inventory current valid Bloü/OpenClaw samples and
the deployed Vercel request, duration, and memory ceilings. Record accepted file
count, per-file and aggregate bytes, dimensions/pixels, redirect count, timeout,
and concurrency with their product/platform/benchmark basis. If a safe value
cannot be established, leave the affected integration disabled or fail closed
and amend the plan; do not invent a permissive number.

Prefer application-issued Blob IDs. Otherwise parse with `URL`, resolve every
target, require public IPs, and bind the actual connection to the validated
address set so DNS cannot change between validation and connect. Disable
automatic redirects and manually revalidate and rebind every hop, stream with
byte and total timeout limits, verify type/magic bytes, inspect image metadata
before Sharp transforms, and use a bounded processing pool. If the deployed
runtime cannot prove DNS-to-connection binding, accept only application Blob IDs
or an explicit fixed-origin allowlist; do not retain arbitrary remote URLs with
a best-effort preflight lookup.

Do not return resolved IPs, internal errors, or response bodies to callers.

**Step 3: Run GREEN and commit**

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
git commit -m "fix(web): bound server media intake"
```

## Task 15: Enforce Billing Ownership And Safe Room Destinations

**Files:**

- Modify: `apps/web/app/api/save-discord-credentials/route.ts`
- Create: `apps/web/lib/checkout-metadata-security-route.test.ts`
- Create: `packages/protocol/src/source-url.ts`
- Create: `packages/protocol/test/source-url.test.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `apps/web/app/api/rooms/route.ts`
- Modify: `apps/web/app/api/rooms/[roomId]/join/route.ts`
- Modify: `apps/web/app/room/[roomId]/page.tsx`
- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/test/protocol.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/test/routes.test.ts`
- Modify: `apps/extension/src/p2p-ice.ts`
- Modify: `apps/extension/test/p2p-ice.test.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/navigation.ts`
- Modify: `apps/extension/src/source-adapters/youtube/navigation.ts`

**Step 1: Add RED ownership and URL tests**

Cover unauthenticated checkout, another user's session/customer, unpaid or wrong
mode session, duplicate mutation; supported canonical Crunchyroll/YouTube URLs,
mobile YouTube normalization, unsupported host, username/password URL, HTTP
downgrade, arbitrary redirect; query-string ICE token rejection and Authorization
bearer acceptance.

**Step 2: Implement current-account ownership**

Resolve the AniDachi session first, retrieve Stripe checkout server-side, and
require exact `client_reference_id` or trusted metadata owner plus expected paid
state before updating customer metadata. Return stable public errors.

**Step 3: Reuse one cross-plane provider URL canonicalizer**

Define the strict Crunchyroll/YouTube watch-URL canonicalizer in
`packages/protocol/src/source-url.ts`, without moving provider observation or DOM
logic into the protocol package. Web room creation/join and extension source
navigation consume the same pure helper. Stored room source is canonical.
Unsupported external destinations are rejected rather than auto-opened.

**Step 4: Remove legacy ICE query bearer after zero-consumer proof**

Run:

```bash
rg -n "roomToken.*query|searchParams.*roomToken|/ice" apps packages tests
```

If any current consumer remains, migrate and test it first. Then reject query
tokens and keep Authorization bearer only.

**Step 5: Verify and commit**

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/extension test
pnpm harness:rooms
git commit -m "fix(platform): enforce ownership and safe room destinations"
```

## Task 16: Bound Public Forms And Shared-password Gates

**Files:**

- Create conditionally for `APP_RATE_LIMITER_REQUIRED`:
  `apps/web/lib/public-abuse-limit.ts`
- Create conditionally:
  `apps/web/lib/public-abuse-limit.test.ts`
- Create conditionally with `supabase migration new public_abuse_limits`:
  `apps/web/supabase/migrations/<generated>_public_abuse_limits.sql`
- Create conditionally:
  `apps/web/supabase/tests/public_abuse_limits.test.sql`
- Modify: `apps/web/app/api/subscribe-interest/route.ts`
- Modify: `apps/web/app/api/waitlist-position/route.ts`
- Modify: `apps/web/lib/staging-access.ts`
- Modify: `apps/web/lib/staging-access.test.ts`
- Modify: `apps/web/app/api/kreatli-crm/login/route.ts`
- Create: `apps/web/lib/public-endpoint-abuse-routes.test.ts`

**Step 1: Add RED abuse/privacy tests**

Cover strict body/field bounds, idempotent duplicate interest, per-IP and
normalized-email budgets, email work once, cross-instance persistence, uniform
waitlist response, repeated wrong staging/CRM passwords, independent counters,
backoff, successful authentication, and safe proxy IP extraction.

Also prove that concurrent accepted contact and feature-request submissions do
not lose JSONL archive records. The pre-existing append path is currently
last-writer-wins. Address it after the Wave 1 private-only cutover with a narrow
private-store `ifMatch` retry (or another bounded durable append selected from
the evidence); do not add a temporary dual-store CAS protocol to phase A.

**Step 2: Apply the Task 0 edge gate**

- `EDGE_RATE_LIMITS_PROVEN`: keep platform rules as the durable outer bound;
  implement route idempotency, input limits, privacy, and tests without a
  duplicate database limiter. Record rule IDs/config evidence, not secrets.
- `APP_RATE_LIMITER_REQUIRED`: add one narrow service-role-only fixed-window
  bucket for the named routes. It stores hashed discriminator values, expires
  buckets, has bounded cleanup, and is not exposed to clients.

Do not add asynchronous email infrastructure in this MVP plan. The route simply
ensures one accepted request causes at most one CRM update/email attempt.

**Step 3: Make waitlist responses non-enumerating**

Return one uniform public response independent of membership. If the product
must reveal position later, require an email-delivered signed lookup token in a
separate product task.

**Step 4: Verify and commit**

```bash
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
supabase --workdir apps/web db reset
supabase --workdir apps/web test db
git commit -m "fix(web): bound public and shared-password endpoints"
```

### Wave 5 Stop

Required GREEN: SSRF/media fixtures, Stripe ownership, room URL consumer matrix,
ICE header-only auth, public form idempotency/privacy, password throttling, full
web/API/protocol/extension checks, and platform/config evidence.

---

# Wave 6 — Integrated Verification And Readiness Closeout

## Task 17: Run A Focused Security Re-scan And Resolve Every Finding

**Required skill:** `codex-security:security-diff-scan`, followed by manual
source review.

**Files:**

- Modify only when evidence is complete:
  `docs/current-development-state.md`
- Modify:
  `docs/superpowers/plans/2026-08-14-watch-history-v2-clean-mvp-implementation.md`
- Modify: `docs/superpowers/plans/README.md`
- Modify: this plan
- Create during execution only:
  `.superpowers/sdd/2026-08-18-pre-release-security-reliability-readiness/task-17-report.md`

**Step 1: Map all 20 findings plus the history bound**

For each item record:

```txt
fixed | disabled-and-unreachable | deferred
commit
tests
staging evidence
remaining risk
owner
```

No high finding may be deferred. A medium finding may be deferred only when its
feature is disabled/unreachable and the boundary is proven. Low findings may be
deferred with an owner and pre-public deadline.

**Step 2: Run full repository gates**

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api test:runtime
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/extension check
pnpm harness:rooms
npm --prefix tests/e2e run harness:p2p
pnpm check
pnpm test
pnpm dev:check
```

If the local macOS P2P harness again stops at ICE while hosted CI and two-profile
staging pass, record it as a local environment limitation with exact evidence;
do not call it a product pass from assumption alone.

**Step 3: Run database gates**

```bash
supabase --workdir apps/web db reset
supabase --workdir apps/web test db
supabase --workdir apps/web db lint --level warning
supabase --workdir apps/web db advisors
supabase --workdir apps/web db push --dry-run
```

Verify exact migration order and repeatability. Never apply to production in
this plan.

**Step 4: Build and validate the staging extension**

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
```

Record `version_name`, ZIP SHA-256, permission diff, approved extension ID, and
the loaded artifact path. No generated ZIP or browser profile is committed.

**Step 5: Execute staging acceptance only after local GREEN**

Required flows:

- Google and Discord login state/PKCE and replay rejection;
- extension connect using the approved staging ID and rejection of another ID;
- website/extension refresh rotation, account switch, logout, and forced legacy
  reauthentication;
- allowed public artwork and denied credential/CRM media paths without reading
  private object content;
- solo Crunchyroll and YouTube local-first progress, offline recovery, backward
  seek, pause, close, Popup/web convergence;
- title with episode continuation and no missing/duplicate page rows;
- two-profile shared room, reconnect, source change, leave/end, delayed terminal
  inside the Task 0-selected test window, and synthetic expired replay
  rejection;
- pre-JOIN socket cap and normal multi-tab reconnect;
- hostile-page synthetic sign-out/end-room rejection and trusted user action;
- bounded Bloü/OpenClaw rejection fixtures in a non-destructive staging mode;
- checkout ownership negative test using test-mode Stripe sessions;
- room source allowlist and ICE Authorization-only path;
- public form idempotency/privacy and staging/CRM throttle evidence.

Do not send exploit traffic to production or access real private Blob contents.

**Step 6: Update canonical documentation truthfully**

Only after evidence:

- mark the Watch History v2 foundation complete and point its remaining public
  hardening work to this plan;
- update `docs/current-development-state.md` with resulting auth, Blob, room,
  history, extension, and staging facts;
- add this plan to the active plan README;
- record remaining UI/UX and product work separately;
- state explicitly that production release has not happened.

**Step 7: Refresh Graphify and review generated scope**

```bash
pnpm graph:update
git status --short
git diff --check
```

Commit only `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, and
`graphify-out/manifest.json` when intentionally changed. Exclude caches, HTML,
cost, scratch, browser, and extension artifact files.

**Step 8: Commit closeout docs**

```bash
git add docs/current-development-state.md \
  docs/superpowers/plans/2026-08-14-watch-history-v2-clean-mvp-implementation.md \
  docs/superpowers/plans/2026-08-18-pre-release-security-reliability-readiness-plan.md \
  docs/superpowers/plans/README.md \
  graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json
git diff --cached --check
git commit -m "docs(security): record pre-release readiness evidence"
```

Stage Graphify paths only if the update intentionally changed them.

## Task 18: Open The Staging PR And Stop

**This is not a production release.**

**Step 1: Audit branch composition**

```bash
git status --short --branch
git log --oneline --decorate origin/staging..HEAD
git diff --stat origin/staging...HEAD
git diff --check origin/staging...HEAD
```

Expected: clean tree, small ordered commits, no secrets, private objects, `.env`,
extension ZIP, browser profile, debug export, or unrelated user work.

**Step 2: Preserve migration-before-runtime order**

If the staging database workflow and web deployment remain independently
triggered, use separate PRs or an explicit prerequisite merge:

1. additive database/auth/history prerequisites;
2. verify remote staging migration history and rollback evidence;
3. runtime consumers and extension artifact;
4. final documentation/Graphify evidence.

Never merge runtime that requires an RPC/table not yet present on staging.

**Step 3: Open PR(s) to `staging` only**

PR descriptions must contain:

- finding coverage table;
- tests and staging evidence;
- migration/env/secret impact;
- reauthentication and extension-ID consequences;
- Blob inventory/rotation outcome;
- Watch History payload benchmarks and 14-day receipt proof;
- Worker admission/room-authority limits;
- rollback/forward-recovery instructions;
- docs and Graphify status;
- explicit `main`/production exclusion.

Stop after PR and staging review. Do not create a promotion PR, merge to `main`,
apply production migrations, deploy production, or call the product released.

## Final Completion Criteria

This plan is complete only when:

- Tasks 0-18 have evidence or an approved documented skip;
- all high findings are fixed;
- every medium finding is fixed or proven unreachable with a named follow-up;
- low findings are fixed or recorded before public access;
- Watch History response/query and durable artifacts are bounded without losing
  stored history or local-first UX;
- auth channels, OAuth transactions, refresh families, room authority, Blob
  paths, extension actions, WebSockets, media intake, billing ownership, public
  forms, and retention have direct regression tests;
- full local gates and required staging acceptance pass;
- canonical docs and Graphify match runtime;
- the work is cleanly reviewed on `staging`;
- no production release action has occurred.

After that, AniDachi can continue with UI/UX, People, Groups, invites, shared
tracking polish, and other product work on a clean hardened foundation. The
future production release remains a separate plan and explicit user decision.
