# Waitlist And CRM Durable Storage Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore durable waitlist and public-form behavior without losing old
CRM data or activating unrelated private integrations.

**Architecture:** Keep the existing private Vercel Blob store, add a narrowly
named CRM runtime authority, and make Blob mutations optimistic and
conflict-safe with ETags. Reconcile the retained public CRM snapshot into the
private authority through a dry-run-first, conflict-aborting script, then verify
staging before any production runtime promotion.

**Tech Stack:** TypeScript, Next.js 15 Route Handlers, `@vercel/blob` 2.8.0,
Node test runner, Vercel CLI, pnpm 11.2.2, Node 22.23.1.

**Spec:**
`docs/superpowers/specs/2026-08-23-waitlist-crm-durable-storage-design.md`

**Status (2026-08-24):** Complete. Tasks 1-7 are implemented and verified from
lossless reconciliation through Production. Promotion PR `#240` merged to
`main` as `8cc5e4e6641ca55f0b62a320e8726de67900ce34`; fresh Production
deployment `dpl_DCt6ocJBbEJ848rfaC38W5bhbdyg` still returns and renders 685
waitlist leads after a full redeploy.

## Global Constraints

- Do not add a database, queue, new service, new Blob store, or background job.
- Do not configure production `PRIVATE_INTEGRATION_BLOB_*`.
- Do not touch Bloü/OpenClaw, TURN, Stripe, Chrome Web Store, or legal work.
- Do not delete or modify the legacy public CRM objects.
- Do not print, commit, or persist user PII during recovery.
- Every runtime behavior change begins with a failing test and observed RED.
- Every Blob overwrite is conditional on the ETag that produced its input.
- Feature branch -> PR -> staging -> verified promotion PR -> main.

---

### Task 1: CRM-specific Blob boundary and fail-closed runtime

**Files:**

- Modify: `apps/web/lib/private-integration-blob.ts`
- Modify: `apps/web/lib/private-integration-blob.test.ts`
- Modify: `apps/web/lib/kreatli-crm/store.ts`
- Modify: `apps/web/lib/kreatli-crm/waitlist-stats-route.test.ts`
- Verify: `apps/web/lib/pre-release-security-boundaries.test.ts`

**Interfaces:**

- Produces: `PrivateBlobSnapshot`, `updateText(pathname, mutate)`,
  `hasKreatliCrmBlobConfiguration()`, and CRM-specific runtime selection.
- Consumes: `BlobPreconditionFailedError`, `get(..., { useCache: false })`, and
  `put(..., { ifMatch })` from `@vercel/blob` 2.8.0.

- [x] Add a failing Blob-client test that returns ETag `v1`, rejects the first
  conditional put with `BlobPreconditionFailedError`, then proves the mutation
  reloads `v2`, reapplies once, and writes only with `ifMatch: "v2"`.
- [x] Run `pnpm --filter @anidachi/web test --
  lib/private-integration-blob.test.ts` and confirm failure because versioned
  mutation does not exist.
- [x] Add a failing store test with `VERCEL=1`, no CRM-specific variables, and
  an empty temporary `CRM_DATA_DIR`; assert `readContacts()` rejects and the
  stats route returns `503`, `{ count: null }`, and `private, no-store`.
- [x] Run the focused test and confirm the existing local fallback incorrectly
  returns cacheable zero.
- [x] Extend `createPrivateIntegrationBlobClient` with an origin-fresh snapshot
  read and a bounded optimistic `updateText`. Preserve existing unconditional
  methods for unrelated integration owners.
- [x] Resolve CRM auth only from `KREATLI_CRM_BLOB_READ_WRITE_TOKEN`, or
  `KREATLI_CRM_BLOB_STORE_ID` plus optional `VERCEL_OIDC_TOKEN`. Use local files
  only outside Vercel when that auth is absent.
- [x] Make a configured-but-missing `contacts.json` throw a stable durable-store
  error. Keep local empty development data as an intentional zero.
- [x] Make contact writes and JSONL appends consume the optimistic helper.
- [x] Re-run focused tests and confirm GREEN.
- [x] Commit as `fix(web): add durable CRM Blob authority` (`88f15d0`).

### Task 2: Conflict-safe CRM mutations

**Files:**

- Modify: `apps/web/lib/kreatli-crm/store.ts`
- Create: `apps/web/lib/kreatli-crm/store.test.ts`
- Modify: `apps/web/lib/kreatli-crm/survey-lead.ts`
- Create: `apps/web/lib/kreatli-crm/survey-lead.test.ts`
- Modify: `apps/web/lib/kreatli-crm/contact-messages.ts`
- Modify: `apps/web/lib/kreatli-crm/feature-requests.ts`
- Modify: `apps/web/lib/kreatli-crm/private-integration-blob-jsonl.ts`
- Modify: `apps/web/app/kreatli-email-crm/actions.ts`
- Modify: `apps/web/scripts/crm/cli.ts`

**Interfaces:**

- Produces: `mutateContacts<T>(mutation)` returning the committed contacts and
  mutation result; mutation returns `{ changed, value }`.
- Consumes: Task 1 optimistic text update.

- [x] Add a failing store test where two contact mutations start from the same
  ETag and prove both unique contacts survive after one retry.
- [x] Add a failing survey-lead test proving a retried same-email submission
  produces one lead, one referral credit, and no duplicate identical note.
- [x] Run both tests and confirm RED from the current read-then-overwrite path.
- [x] Implement `mutateContacts` for Blob and local modes. The Blob mode parses
  a fresh snapshot inside every retry; the local mode writes one temporary-file
  replacement in the configured data directory.
- [x] Refactor survey lead creation, referral credit, contact-message CRM
  enrichment, feature-request CRM enrichment, internal add/update/delete/import,
  and CLI add/set/import to use `mutateContacts`.
- [x] Make `meta.json` timestamp advancement best-effort after the contacts
  commit; it must not turn a committed lead into a failed submission.
- [x] Re-run focused tests, full web tests, and web typecheck; confirm GREEN.
- [x] Commit as `fix(web): prevent concurrent CRM data loss` (`060a462`).

### Task 3: Honest public submission responses and private logging

**Files:**

- Modify: `apps/web/app/api/subscribe-interest/route.ts`
- Create: `apps/web/lib/kreatli-crm/subscribe-interest-route.test.ts`
- Modify: `apps/web/app/api/waitlist/join/route.ts`
- Create: `apps/web/lib/kreatli-crm/waitlist-join-route.test.ts`
- Modify: `apps/web/app/api/contact/route.ts`
- Modify: `apps/web/app/api/feature-requests/route.ts`
- Modify: `apps/web/components/plan-survey/plan-survey-modal.tsx`

**Interfaces:**

- Produces: non-2xx retryable response for unsaved waitlist work; durable
  success remains independent from optional Gmail notification.
- Consumes: `SurveyLeadResult.saved` and Task 2 durable archives.

- [x] Add a failing route test where `upsertSurveyLead` returns
  `{ saved: false, reason: "write_failed" }`; assert `/api/subscribe-interest`
  returns `503`, `{ ok: false }`, and does not call notification dependencies.
- [x] Add a failing authenticated waitlist-join test with the same storage
  result; assert `503` rather than an HTTP-200 body with `ok: false`.
- [x] Add tests proving a thrown Gmail-token read after a committed survey,
  contact message, or feature request still returns durable success.
- [x] Run focused tests and confirm RED from optimistic success and unguarded
  notification reads.
- [x] Remove the lead name/email/survey log and replace storage logs with a
  request-scoped generic event that contains no user content.
- [x] Return a stable retryable `503` when the survey lead was not saved. Keep
  Gmail alerting inside a best-effort function after durable success.
- [x] Make `/api/waitlist/join` return the same failure boundary.
- [x] Make the survey modal require both `response.ok` and `data.ok` before
  showing confirmation.
- [x] Re-run focused and full web checks; confirm GREEN.
- [x] Commit as `fix(web): report public form persistence truthfully` (`5f2c5f3`).

### Task 4: Lossless CRM reconciliation tool

**Files:**

- Create: `apps/web/lib/kreatli-crm/blob-reconciliation.ts`
- Create: `apps/web/lib/kreatli-crm/blob-reconciliation.test.ts`
- Create: `apps/web/scripts/reconcile-kreatli-crm-blobs.ts`
- Modify: `apps/web/package.json`

**Interfaces:**

- Produces: `reconcileKreatliCrmBlobs({ mode, sourceAuth, destinationAuth,
  sdk, log })` with dry-run default and a structured count/digest report.
- Consumes: public source and private destination Blob auth; exact five-object
  inventory from the design spec.

- [x] Add failing pure tests for strict-subset contacts, destination-only
  contacts, duplicate UUID, duplicate normalized email, divergent common
  identity, malformed JSON, JSONL union, divergent JSONL identity, meta merge,
  source ETag drift, destination ETag drift, and post-write digest mismatch.
- [x] Run the focused test and confirm RED because the reconciler is absent.
- [x] Implement lossless deterministic unions. Any malformed or divergent
  identity returns conflict before write; do not silently choose a winner.
- [x] Implement origin-fresh reads, conditional destination writes, and
  post-write SHA-256/count/identity verification. `--apply` must be explicit.
- [x] Keep Gmail tokens and every non-CRM prefix outside the inventory.
- [x] Add the package script `crm:reconcile-blobs` and verify a metadata/data
  fake dry run performs zero writes.
- [x] Re-run focused/full web checks; confirm GREEN.
- [x] Commit as `feat(web): add lossless CRM Blob reconciliation` (`18788dc`).

### Task 5: Canonical docs, env contract, and Graphify

**Files:**

- Modify: `docs/environment-and-secrets-matrix.md`
- Modify: `docs/current-development-state.md`
- Modify: `docs/superpowers/plans/README.md`
- Modify: this plan
- Update intentionally: `graphify-out/graph.json`
- Update intentionally: `graphify-out/GRAPH_REPORT.md`
- Update intentionally: `graphify-out/manifest.json`

- [x] Record the CRM-specific variable names and per-environment verification
  without values.
- [x] Correct the prior claim that deferred private Blob paths do not affect the
  public product; name the waitlist/public-form dependency and fail-closed rule.
- [x] Record the old public objects as retained rollback data and state that
  unrelated private integrations remain disabled in production.
- [x] Add this recovery plan to the plan index and keep it active until live
  staging and production evidence are recorded.
- [x] Run `$graphify . --update`, inspect the generated scope, and query the
  repaired Hero -> stats -> CRM -> private Blob path.
- [x] Run `pnpm dev:check` and docs link/path checks.
- [x] Commit as `docs(web): record CRM recovery boundary`.

### Task 6: Staging data and runtime acceptance

**External state:** Vercel Preview env and the existing private Blob store.

- [x] Re-inventory both stores without printing record bodies. Confirm object
  paths, counts, unique IDs/emails, and whether the private side remains a
  conflict-free subset/union.
- [x] Add `KREATLI_CRM_BLOB_READ_WRITE_TOKEN` to Preview from the existing
  private-store credential without exposing its value. Do not add the shared
  production private-integration variable.
- [x] Run `crm:reconcile-blobs` in dry-run and require zero conflicts.
- [x] Run `--apply`, then independently reread and verify all five objects,
  contacts, survey leads, IDs, and SHA-256. Keep public objects unchanged.
- [x] Run `pnpm dev:check`, web check/test/build, secret/path grep, and Git diff
  review. Open a PR to `staging`; do not enable auto-promotion to `main`.
- [x] After merge/deploy, verify `/api/waitlist-stats`, a unique controlled
  survey submission, a repeated same-email submission, contact form, feature
  request, and persistence after a fresh deployment.
- [x] Recover the three observed failed survey submissions directly from bounded
  Vercel logs if still retained. Keep payloads in process memory, deduplicate by
  normalized email, and verify count delta without printing user content.
- [x] Record staging deployment, counts, checks, and rollback ETags in this plan.

Interim data acceptance on 2026-08-23:

- The existing public authority contained 683 contacts and 682 survey leads;
  the existing private store was a conflict-free strict subset with 39 contacts
  missing and no divergent common identity.
- The dry-run planned changes only for `contacts.json` and `meta.json`, with
  zero conflicts. Conditional apply wrote those two objects and verified all
  five CRM objects immediately afterward.
- An independent origin-fresh dry-run then reported five unchanged objects,
  zero conflicts, 683 contacts, and 682 survey leads. `contacts.json` matched
  SHA-256 `32479f2f47a542989e1039297bec644a94c8eb1790f86f268049501a06c43b8f`.
- Preview branch `staging` now has the sensitive CRM-specific variable sourced
  from the existing private-store credential. Its value was equality-checked
  without printing it; no Production CRM variable was added.
- The old public objects were retained as the rollback source and were neither
  overwritten nor deleted. Runtime/deployment acceptance remains open below.

Final staging runtime acceptance on 2026-08-24:

- PR `#239` merged to `staging` as
  `d74fa6f3826a61f428147e5bbc472cc6220c4983`; its CI, Preview migration,
  deployment, and smoke checks passed. Only Preview received
  `KREATLI_CRM_BLOB_READ_WRITE_TOKEN`; Production remained unchanged.
- Authenticated `staging.anidachi.app` initially returned 682 from
  `/api/waitlist-stats`. Bounded Production logs retained three unique failed
  survey payloads, not the two originally observed. They were parsed and
  validated only in process memory, recovered without printing PII, and moved
  the count to 685. Repeating the first recovered email returned its original
  position and left the count at 685, proving idempotency.
- One controlled `@example.com` identity submitted the contact and feature-
  request forms. Both returned HTTP 200 and did not change the survey-lead
  count. The acceptance identity remains as one clearly synthetic non-waitlist
  CRM contact; it is not silently deleted from the append-only evidence.
- Fresh Preview deployment `dpl_AnAzpf8XTHUcCrYMz19TDkQ2y3rq` became Ready
  and received the `staging.anidachi.app` alias. After deployment, the Hero
  rendered `Launching soon — 685 on the waitlist`, the stats API returned HTTP
  200 with count 685, and fresh runtime logs contained no EROFS, Blob-auth, or
  CRM-persistence failure.
- The post-acceptance private authority contains 687 contacts, including 685
  survey leads. Current conditional rollback anchors are:

  | Object | ETag | SHA-256 |
  | --- | --- | --- |
  | `kreatli-crm/contacts.json` | `"01789dda616adfcf9487b2a7c658ef05"` | `f95908ecfd8f44f68a8c829883d3cf04fb419f13daaf0ea7282adcc997dc6100` |
  | `kreatli-crm/touches.jsonl` | `"bbe8c5183ac5a62d7962ab3e50696397"` | `6d7a3e2d924f7d4d791dfd86dbb5c234fb803141e34807969a06f9841c5740f0` |
  | `kreatli-crm/meta.json` | `"8d9bffe37a842519a81dd8c9735e1484"` | `7a50b84d7e2124be8ecaa9b8426e39089c2fe1bbbc9ae657d5cdec22b7ac63fd` |
  | `kreatli-crm/contact-messages.jsonl` | `"2866e9ccda23021684a30d287c6b70c9"` | `332d92ddf1a717ae83c53b2645d58410b49e42c89d265e829734106e2a6df668` |
  | `kreatli-crm/feature-requests.jsonl` | `"b709863097b47e72b9c911dcfda8a985"` | `80533cfaf369bc7d3a2c3e1d85bd08b78dcb20c9e415f5d2561691acb0b0bbdd` |

- The retained public rollback objects are still untouched. This staging
  evidence was promoted through PR `#240`; the Production evidence follows.

### Task 7: Production cutover and closeout

**External state:** Vercel Production env, production web deployment, GitHub
promotion PR.

- [x] Announce the exact production env/data action and require the already
  requested explicit approval before proceeding.
- [x] Add the same CRM-specific private-store credential to Production. The old
  runtime must remain unchanged until promotion.
- [x] Re-run destination inventory and require it matches accepted staging.
- [x] Open the tested `staging -> main` promotion PR. Merge only after explicit
  approval and passing required checks.
- [x] Verify production `/api/waitlist-stats` returns the durable nonzero count,
  one idempotent controlled signup persists across redeploy, and contact/feature
  submissions acknowledge only durable archives.
- [x] Verify no `EROFS`, fake-success, Blob-auth, PII-log, or unrelated private-
  integration activation appears in production logs.
- [x] Update this plan and `docs/current-development-state.md` with observed
  evidence, refresh Graphify, and close through the normal docs PR flow.

Final Production acceptance on 2026-08-24:

- The user explicitly approved completing the repair. Production received only
  `KREATLI_CRM_BLOB_READ_WRITE_TOKEN`, sourced from the already accepted
  private CRM store without printing its value. The shared
  `PRIVATE_INTEGRATION_BLOB_*` boundary and unrelated integrations remained
  unchanged and fail-closed.
- Before promotion, the five-object destination inventory still matched the
  accepted staging authority with 687 contacts and 685 survey leads. Promotion
  PR `#240` passed its required checks and merged to `main` as
  `8cc5e4e6641ca55f0b62a320e8726de67900ce34`. Production migration workflow
  `32656249908` and main CI workflow `32656249981` both succeeded.
- Production deployment `dpl_3v2H5pk4v5muknJvpyKjXZpJHEXX` became Ready and
  received both public aliases. The stats API returned HTTP 200 with count 685,
  and the Hero rendered `Launching soon — 685 on the waitlist`.
- Replaying one already recovered real lead returned its existing position 683
  and left the count at 685. Contact and feature-request submissions using the
  existing controlled `@example.com` acceptance identity both returned HTTP
  200 and did not create a waitlist lead.
- A full Production redeploy produced
  `dpl_DCt6ocJBbEJ848rfaC38W5bhbdyg`. After the new instance became Ready and
  received `www.anidachi.app` and `anidachi.app`, the same-origin stats request
  again returned HTTP 200 with 685 and the Hero again rendered 685. This proves
  the accepted state is durable rather than deployment-filesystem state.
- Fresh Production logs contained no `EROFS`, Blob-auth, CRM-persistence,
  fake-success, or PII-log failure. The only notification warnings were the
  expected optional Gmail-not-configured messages; durable storage had already
  acknowledged the affected form submissions.
- The previous healthy deployment
  `dpl_AX8MKEAcgjAXJpPnVUXZgqfNN14D` remains the pre-cutover deployment rollback
  anchor. The legacy public CRM objects remain untouched as independent data
  rollback evidence.
- The post-Production-write private authority remains at 687 contacts and 685
  survey leads. Its final conditional rollback anchors are:

  | Object | ETag | SHA-256 |
  | --- | --- | --- |
  | `kreatli-crm/contacts.json` | `"b2fb74db68e8da83618d7cfff1d64508"` | `7aea59fca3b2e04739a4e40570b7702731868e60be653c1f142392b2ac245738` |
  | `kreatli-crm/touches.jsonl` | `"bbe8c5183ac5a62d7962ab3e50696397"` | `6d7a3e2d924f7d4d791dfd86dbb5c234fb803141e34807969a06f9841c5740f0` |
  | `kreatli-crm/meta.json` | `"6059193a09507919c77f1195f7137bbb"` | `e43400fdcb05e1f1b40054b8b4c46aa68d0e9368df8bc4dc5bb16b2afb7cf13a` |
  | `kreatli-crm/contact-messages.jsonl` | `"b642d14e94b09705c1e74b622f53fd70"` | `e82a7837f2d6877db29db654524bdba4882cd650637e2b448cb22c373ca5d133` |
  | `kreatli-crm/feature-requests.jsonl` | `"b488331bf438724d3087d53877d27989"` | `d58b87cc814ecd0895e16ef6575f93c12f749659ca40415923fe209e9eea3053` |
