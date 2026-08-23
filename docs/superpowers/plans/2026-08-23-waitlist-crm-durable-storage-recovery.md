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

**Status (2026-08-23):** Tasks 1-4 are implemented and locally verified on
`codex/waitlist-crm-durable-storage`. Task 5 documentation/Graphify closeout is
in progress. Tasks 6-7 remain blocked on their explicit staging and production
gates; no live data or environment mutation is claimed here.

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

- [ ] Re-inventory both stores without printing record bodies. Confirm object
  paths, counts, unique IDs/emails, and whether the private side remains a
  conflict-free subset/union.
- [ ] Add `KREATLI_CRM_BLOB_READ_WRITE_TOKEN` to Preview from the existing
  private-store credential without exposing its value. Do not add the shared
  production private-integration variable.
- [ ] Run `crm:reconcile-blobs` in dry-run and require zero conflicts.
- [ ] Run `--apply`, then independently reread and verify all five objects,
  contacts, survey leads, IDs, and SHA-256. Keep public objects unchanged.
- [ ] Run `pnpm dev:check`, web check/test/build, secret/path grep, and Git diff
  review. Open a PR to `staging`; do not enable auto-promotion to `main`.
- [ ] After merge/deploy, verify `/api/waitlist-stats`, a unique controlled
  survey submission, a repeated same-email submission, contact form, feature
  request, and persistence after a fresh deployment.
- [ ] Recover the two known failed survey submissions directly from bounded
  Vercel logs if still retained. Keep payloads in process memory, deduplicate by
  normalized email, and verify count delta without printing user content.
- [ ] Record staging deployment, counts, checks, and rollback ETags in this plan.

### Task 7: Production cutover and closeout

**External state:** Vercel Production env, production web deployment, GitHub
promotion PR.

- [ ] Announce the exact production env/data action and require the already
  requested explicit approval before proceeding.
- [ ] Add the same CRM-specific private-store credential to Production. The old
  runtime must remain unchanged until promotion.
- [ ] Re-run destination inventory and require it matches accepted staging.
- [ ] Open the tested `staging -> main` promotion PR. Merge only after explicit
  approval and passing required checks.
- [ ] Verify production `/api/waitlist-stats` returns the durable nonzero count,
  one idempotent controlled signup persists across redeploy, and contact/feature
  submissions acknowledge only durable archives.
- [ ] Verify no `EROFS`, fake-success, Blob-auth, PII-log, or unrelated private-
  integration activation appears in production logs.
- [ ] Update this plan and `docs/current-development-state.md` with observed
  evidence, refresh Graphify, and close through the normal docs PR flow.
