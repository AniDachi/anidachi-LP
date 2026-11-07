# Free20 Store release preparation

> Execution: use `superpowers:executing-plans`. Prepare and verify the candidate;
> production promotion, LIVE provider writes and Store publication remain separate gates.

**Goal:** deliver a traceable production-channel review ZIP and a rehearsed cutover
procedure for activating the accepted Free20 system after Chrome Web Store approval.

**Architecture:** retain the existing web/SQL authority, Worker accounting and
extension contracts. Generalize the staging-only retention implementation to an
explicit, independently gated Stripe mode. Keep compatibility while the Store
candidate is reviewed against the existing production backend.

**Tech Stack:** Next.js, Supabase/Postgres, Cloudflare Workers/Durable Objects,
WXT/React, Stripe API `2025-08-27.basil`, pnpm 11.2.2, Node 22.23.1.

**Spec:** [Free20 design](../specs/2026-10-30-daily-free20-design.md),
[transition plan](2026-10-30-daily-free20-transition.md), and the owner's
2026-11-06 instruction to prepare the ZIP and production launch after Store approval.

**Current checkpoint (November 7):** preparation Tasks 1–6 are complete; the owner
reports Store approval of 0.1.5. The owner has authorized reconciling main into the
release branch, preparing production Worker configuration, and delivering those
changes through staging (Task 7). Follow the concrete
[remaining launch checklist](../../releases/free20/production-preparation-2026-11-06.md#remaining-launch-checklist)
for the next phase; production/LIVE writes and publication remain separate.

## Global Constraints

- Source starts at accepted staging `dc988034df904157cf0bbb9e29bbfe9d41e82a04`;
  current main is `9da93cd9891b6155051fc550957635c089fc8f3a`.
- Do not promote to main, activate production, change LIVE Stripe, upload or publish
  the Store item in this preparation. Read-only production inspection is allowed.
- Existing product decisions remain: 1,200 host seconds per UTC day; paid/manual
  and existing trial rights preserved; no new trials; one lifetime 40% allowance
  across uninstall/cancellation, monthly only, no stacking, no annual-switch lock.
- Preserve `.serena/project.yml` local changes. Never commit secrets, ZIPs,
  generated extension output or local review artifacts.
- An accepted, frozen staging SHA may supply the production review ZIP without
  first deploying main. Record this owner-authorized sequence and exact provenance.
- Use an owner-confirmed version greater than every uploaded Store version.
  Never infer it from staging's default package version.
- Keep TEST/LIVE settings and objects isolated. New LIVE issuance defaults off;
  accepted obligations continue to reconcile when issuance is disabled.
- Keep automated, hosted deployment, loaded-browser, two-user and payment evidence
  distinct. Missing external evidence is recorded as pending, never invented.

## Review Focus

Environment isolation through offer issuance, restoration, invoice/webhook handling
and billing presentation; lifetime allowance races; monthly-only coupon scope;
old-client compatibility and rollout order; exact artifact provenance and permissions.

For Task 7, review the complete main-to-staging reconciliation, preserved SEO
routes and redirects, Free20 copy consistency, isolated production Worker binding,
manual deployment gate, and unchanged inputs of the approved extension archive.

### Task 1: Freeze the inventory and release gates

**Files:** this plan; `docs/releases/free20/production-preparation-2026-11-06.md`.

**Interfaces:** supplies exact source, migration list and environment requirements to
Tasks 2–5. External live configuration is evidence, not authorization to change it.

- [x] Record complete main-to-staging inventory (504 files, 10 SQL migrations).
- [x] Inspect production/staging versions, migration metadata, Worker flags and
  public configuration with scoped read-only tools; record unavailable access.
- [x] Verify official Store deferred-publication/version requirements and current
  Stripe product-scoped discount behavior; record authoritative links.

### Task 2: Make retention code production-capable without enabling it

**Files:** `apps/web/lib/anidachi-auth/{uninstall*,cancellation-retention*,retention-invoice*}`;
related existing tests and `stripe-env.ts` if a strict campaign helper is needed.

**Interfaces:** uses existing Stripe mode resolution and independent Supabase
databases. No new shared payload or lifetime-grant schema is expected. Consumers
include checkout, cancellation portal, webhooks and account billing presentation.

- [x] Add failing tests for valid LIVE objects, strict suffixed configuration,
  wrong-mode rejection, disabled issuance with reconciliation, and monthly scope.
- [x] Propagate the resolved mode through all retention validators and callers;
  preserve strict ownership, immutable terms, idempotency and grant locking.
- [x] Run relevant tests, then complete web tests and type checks.
- [x] Review schema/catalog dependencies; document required LIVE setup without writes.

### Task 2b: Preserve current-server compatibility during Store review

Audit found that production main lacks `/api/me/hosting-status`.

- [x] Add an opt-in capability marker to existing entitlements without changing
  the strict hosting object or unrequested response contract.
- [x] On generic 404 only, accept a fresh current-owner legacy hosting contract;
  reject all marked/unknown/malformed responses and all non-404 failures.
- [x] Keep rotating credentials, logout races, timeout and parallel confirmation
  fences; never invent quota or bypass server admission.
- [x] Regression tests and independent review; record separate loaded-browser
  acceptance rather than claiming it from transport mocks.

### Task 3: Reconcile public copy and Store materials

**Files:** `apps/web/app/privacy/page.tsx`; existing Store/release documentation.

**Interfaces:** must describe the actual compact welcome, history controls,
Free20/paid access, permissions and production URLs from the candidate.

- [x] Remove the stale assertion that the welcome explains history recording;
  retain the truthful default, eligibility, settings and deletion description.
- [x] Audit Store-facing text and site routes for stale trial/price/support claims;
  avoid redesigns or extra product copy.
- [x] Record Store description, change notes and reviewer steps for the candidate.

### Task 4: Verify the integrated candidate and deliver staging

**Files:** active transition/current-state docs; intentional Graphify artifacts.

**Interfaces:** validates Tasks 2–3 with the existing Free20/anti-abuse/social
contracts and the current server while issuance gates remain independent.

- [x] Run web, extension, API/protocol checks and relevant room/accounting/SQL
  suites; use existing tests rather than duplicate implementation assertions.
- [x] Check old/new-client compatibility, rollback semantics and payment recovery.
- [x] Perform one independent whole-branch review; fix material findings with
  regression tests and rerun affected checks.
- [x] Update docs/Graphify, run `pnpm dev:check`, open PR into staging and follow
  CI/deployment. Refresh the existing staging extension folder if its source changed.

### Task 5: Prepare the review ZIP and post-approval cutover

**Files:** release runbook and ignored artifacts/receipt; no ZIP in Git.

**Interfaces:** consumes an accepted immutable source SHA, verified Store version,
production public VAPID key, identity and production runtime endpoints.

- [x] Build/validate production ZIP, record SHA256/source/version/permissions and
  inspect actual bundle for staging/test endpoints and accidental secrets.
- [x] Document reviewer behavior before activation and precise deferred-publication
  sequence: compatible migrations/code, production verification, activation,
  Store publication, observation and rollback. No unapproved execution.
- [x] Report the actual artifact and clearly identify remaining owner/provider
  inputs or live acceptance gates before upload/promotion.

### Task 6: Optional uninstall compatibility before the website rollout

Owner decision on November 7: keep uninstall silent until the production website
supports the approved page, then enable it automatically for all installations.
No early main promotion, page redesign, billing changes or production writes.

**Files:** extension `uninstall-url.ts` and background; additive public web
capability route; shared versioned schema; staging metadata exception; release docs.

- [x] Reproduce unconditional registration against an unavailable site; cover
  arrival/rollback, transient failure, timeout, cache and concurrent lifecycle calls.
- [x] Register only the fixed canonical page after an explicit same-origin
  version-1 capability; no auth, identifiers, redirects or remote code.
- [x] Refresh without reinstall through browser startup/hourly alarms and a bounded
  persistent cache; leave account/room startup independent of the optional work.
- [x] Complete relevant web/extension/protocol checks, independent branch review,
  Graphify refresh and staging delivery. Verify the deployed capability and the
  actual built extension against old and new servers.
- [x] Freeze a new 0.1.5 candidate and mark the November 6 ZIP superseded; keep both
  immutable receipts. Refresh the same staging tester folder and Store handoff.

Delivery: PR #523 merged as `d702613bc39ea99613166a5edc9cb13270117f93`; PR and
post-merge CI, Rooms/P2P, deployment and staging smoke passed. The final production
and staging artifacts passed isolated compiled-background checks. Extension 2,879,
web 1,776 (six existing skips), protocol 293 and all-plane type checks passed.
The final ZIP SHA256 is
`358757aa77168fb515fd3df7be28f60d677b2536dffc45536f88b84c2aef33a3`.
Evidence remains under `artifacts/chrome-web-store-0.1.5-release-20261107/`.

### Post-approval handoff: read-only checkpoint

- [x] Record the owner's approval report without claiming an independent Store
  dashboard or publication check.
- [x] Recheck exact main/staging, hosted web/Worker, policy and migration versions;
  compare pending migrations to the frozen release hashes.
- [x] Recheck LIVE connection availability: both connections expose Sandbox only.
- [x] Preview main/staging merge locally without updating either branch: one
  conflict in `apps/web/app/watch-youtube-together/page.tsx`; main-only SEO work
  must be preserved before promotion. The final-tree diff now contains 514 files.
- [ ] Complete the separately tracked remaining launch checklist before production
  activation and owner publication. This planning checkpoint does not close it.

### Task 7: Reconcile release history and prepare the production Worker binding

Owner authorization on November 7 covers local preparation and staging delivery;
production promotion, LIVE changes and Store publication remain separate.

**Files:** merge of main `9da93cd9` into the release branch based on accepted staging
`d702613b`; `apps/api/wrangler.toml`; release/current-state/SEO guidance and graph.

- [x] Resolve the two YouTube copy conflicts with accepted Free20 wording, retaining
  the main SEO work and existing routes, redirects and metadata.
- [x] Prepare the explicit production accounting binding for staging; verify the
  exact-SHA manual production gate and channel isolation with existing checks.
- [x] Verify the immutable approved ZIP and all recorded extension build inputs.
- [ ] Run relevant checks, production dry-run and fresh independent branch review;
  refresh docs/Graphify and deliver a reviewed PR into staging.
- [ ] Verify hosted staging delivery and unchanged production, then report the
  remaining concrete production prerequisites.
