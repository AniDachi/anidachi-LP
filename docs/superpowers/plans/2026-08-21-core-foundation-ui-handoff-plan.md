# AniDachi Core Foundation To UI/UX Handoff Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to
> execute this plan task by task after explicit implementation approval. Use
> `superpowers:test-driven-development` for runtime changes and
> `superpowers:verification-before-completion` before every completion claim.
> Query Graphify first, then verify important claims against current source.

**Status:** Complete on `staging` as of 2026-08-22, through runtime base
`3a442b7f76992a5e48b387740bf9cc31a565235e`. The foundation now hands off to
normal UI/UX work. This is not production, market, public-release, `main`, or
Chrome Web Store readiness; the separately listed release, P2P/TURN, billing,
legal, public-form, media, and provider work remains outside this plan.

**Goal:** Close the smallest remaining cross-plane technical gaps needed for a
stable UI/UX development base without rebuilding working systems, weakening the
local-first experience, or adding speculative MVP infrastructure.

**Design authority:**

- `docs/superpowers/specs/2026-08-18-pre-release-security-reliability-readiness-design.md`
  for the applicable Watch History and room-boundary decisions;
- `docs/superpowers/specs/2026-08-06-account-data-history-social-inbox-design.md`
  for room-invite lifecycle and inbox semantics;
- `docs/current-development-state.md` for current runtime truth. If this plan
  and current source differ during execution, stop, record the drift, and amend
  this plan before changing runtime behavior.

**Tech stack:** TypeScript, Zod 4, Next.js 15 Route Handlers,
Supabase/Postgres, Cloudflare Workers/Durable Objects, WXT/Chrome Manifest V3,
Vitest, pgTAP, Playwright, pnpm 11.2.2, Node 22.23.1.

## Why This Is The Final Foundation Plan Before UI/UX

The large pre-release readiness program completed its first three staging
waves. Its remaining tasks mixed unrelated media, billing, public-form, legal,
release, and product-polish work with three genuine cross-plane foundation
gaps. This plan isolates only those three gaps:

1. Watch History v2 must keep all stored history while bounding the number of
   episode rows returned in one title-page response.
2. A room's current Crunchyroll or YouTube source must be validated once and
   durably converge from the live Worker authority to Supabase for reloads and
   late joins.
3. Room invitations must remain actionable while the room is active and become
   missed only when the room ends, with the transition performed atomically.

These are foundation rules that UI code will depend on. Visual redesign,
interaction polish, and feature expansion come after this plan.

## Fixed MVP Boundaries

- Preserve the verified Watch History local-first flow: provider observation is
  reflected in the same-owner Popup immediately; server synchronization follows
  asynchronously; offline outbox recovery and backward seeking remain intact.
- Supabase/Postgres remains the only durable account-history and room metadata
  authority. The extension cache/outbox is not a second durable source of truth.
- The room Durable Object remains the live room/playback authority.
- Automatic room navigation supports only the currently supported Crunchyroll
  and YouTube watch URLs. Netflix, Amazon, and other providers remain future
  adapter work.
- A room stays pinned to its creation provider. Same-provider source changes
  may update the room; cross-provider changes are rejected. No source-switch UI
  is added in this plan.
- A room invite has no separate product expiry while its room is active. A
  pending recipient becomes `missed` when the room ends and remains visible for
  24 hours. A temporarily full room does not expire the invite.
- Use existing Supabase, Worker Durable Object, internal Web callback, alarm,
  and extension mechanisms. Do not add a queue service, polling service,
  Realtime subscription, generic event store, or second cache layer.
- Keep all changes additive until their consumers are proven on staging. Never
  delete canonical Watch History rows, invite rows, or legacy rollback data in
  this plan.
- No production migration, `main` promotion, release, or store submission is
  authorized by completing a task or wave.

## Explicitly Out Of Scope

- UI/UX redesign and visual polish;
- new friends, groups, notification, or source-switch product features;
- Bloü, OpenClaw, or any server-media intake work;
- legal, privacy-policy, consent-copy, or compliance work;
- Stripe/billing ownership hardening;
- public forms, waitlist behavior, staging-password, or CRM-password hardening;
- new streaming providers;
- full market-release proof, production rollout, `main`, or Chrome Web Store;
- a new Watch History version or revival of Watch History v1;
- storage caps that discard a user's canonical history;
- two-network/TURN acceptance already tracked by the room/P2P roadmaps.

## Architecture And Contracts

### Watch History bounded read

The product remains Watch History v2. The current title-page RPC stays available
until the new consumer is deployed. An additive versioned RPC returns at most
eight most-recent observed episodes for each visible title. Each title also
returns exact aggregate counts and an opaque continuation:

```ts
type WatchHistoryItem = {
  observedEpisodeCount: number;
  completedEpisodeCount: number;
  episodePage: {
    complete: boolean;
    nextCursor: string | null;
  };
  seasons: WatchHistorySeason[]; // bounded recent slice only
};
```

An authenticated detail endpoint returns at most 50 episode rows for one
`(provider, titleKey)` page. Its opaque keyset cursor uses the canonical observed
ordering plus a stable binary identity tie-breaker. Exact title/season counts
come from projections, not from the returned slice. Paging is not a historical
snapshot: if live observations change between pages the client refreshes; this
plan does not add an event log or snapshot service.

The eight/50 limits are initial fixed MVP constants. The realistic
501-title/13,200-episode fixture must remain at or below 2 MiB serialized for a
50-title page and below 32 MiB parser RSS delta. A lower episode-slice limit is
allowed if evidence requires it. Raising either resource ceiling or the slice
limit requires a recorded plan amendment, not an ad hoc test change.

Watch History receipts remain valid for exactly 14 days. Cleanup is global,
bounded, repeatable, and uses the already-installed Supabase Cron capability,
through one dedicated receipt-cleanup function/job rather than changing the
auth cleanup contract. It deletes expired receipts only. Any write-abuse limiter
is evidence-gated: it may restrict creation of new unique identities or
receipts, but must never reject ordinary five-second updates to an existing
session.

### Canonical and durable room source

`packages/protocol` owns one pure URL canonicalizer for supported YouTube and
Crunchyroll watch destinations. It returns a strict source descriptor or a
stable rejection and contains no provider DOM logic. Web room creation, Web
join/reload, Worker source changes, and extension navigation use that contract.

Supabase rooms gain additive `source_provider` and `source_generation` state.
Creation persists generation 1, matching the Worker's existing positive initial
generation; the first accepted Worker source observation advances it to 2. The
Worker remains authoritative while the room is live and increments its existing
generation on an accepted same-provider source change. It then sends the latest
descriptor to a new authenticated internal Web route. The database update is
monotonic: an older or duplicate generation cannot overwrite a newer source.

The Worker retains only one coalesced pending source snapshot in Durable Object
storage, not one row per event. The existing alarm must schedule the earliest
room-lifecycle or source-retry deadline. Playback broadcast does not wait for
Vercel/Supabase. Successful acknowledgement clears only the matching pending
generation; failure retries with bounded exponential backoff. Room termination
does not erase the last durable source.

The legacy `/ice-servers` query-string bearer is removed only after repository
search and tests prove zero consumers. The WebSocket `roomToken` query parameter
is separate and remains because browser WebSockets cannot set an Authorization
header.

### Room-lifecycle invite semantics

Existing creation stays atomic and idempotent through
`create_room_invite_atomic`. A new additive, versioned response RPC performs
recipient ownership, friendship, room-active, and current recipient-state checks
inside one transaction. Exactly one accept/decline transition wins.

New versioned inbox/reconciliation functions derive actionability from room
lifecycle, not `room_invites.expires_at`. Existing functions and the column stay
during the compatibility window. Runtime consumers switch only after the
database prerequisite is applied, preventing a window where the inbox shows an
invite as active but the old acceptance path rejects it as expired.

The compatibility `expiresAt` protocol field may remain during this plan, but it
is non-authoritative and no product copy displays it. Making the column nullable
or removing the compatibility field is optional later cleanup, not a UI/UX
foundation blocker.

## Execution And PR Sequence

Every runtime wave begins from fresh `origin/staging` on a `codex/` feature
branch, queries Graphify, verifies the named source and consumers, adds RED tests
before implementation, and stops at its acceptance gate. Database prerequisites
merge and are verified on staging before dependent runtime PRs. Do not combine a
required migration and its consumer when their deployment order can race.

### Task 0: Close Planning State Before Runtime Work

**Files:**

- Create: this plan
- Modify: `docs/superpowers/plans/README.md`
- Modify:
  `docs/superpowers/plans/2026-08-18-pre-release-security-reliability-readiness-plan.md`
- Modify:
  `docs/superpowers/plans/2026-08-14-watch-history-v2-clean-mvp-implementation.md`
- Modify: `docs/current-development-state.md`
- Update intentionally: `graphify-out/graph.json`
- Update intentionally: `graphify-out/GRAPH_REPORT.md`
- Update intentionally: `graphify-out/manifest.json`

**Steps:**

1. Record the old readiness program as closed by scope disposition, without
   claiming that Tasks 0 or 12-18 were all implemented.
2. Record the Watch History v2 foundation plan as historical and transfer its
   remaining resource-boundary work here.
3. Correct the current-state record for merged staging PRs #189 and #190 while
   retaining the per-title episode fan-out as an open gap.
4. Make this file the primary active foundation plan and retain the room/P2P
   roadmaps as parallel long-running evidence plans.
5. Refresh Graphify for the intentional documentation change, review generated
   scope, run the docs-only quality gate, commit, and open a PR to `staging`.

**Stop:** merge only the documentation PR to `staging`. Do not begin Tasks 1-8
inside that PR.

### Task 1: Reconfirm The Watch History Execution Baseline

**Inspect:**

- `packages/protocol/src/watch-history.ts`
- `apps/web/lib/anidachi-auth/watch-history-v2.ts`
- `apps/web/lib/anidachi-auth/watch-history-v2-routes.ts`
- `apps/web/supabase/migrations/20260816090000_watch_history_v2_bounded_read.sql`
- `apps/extension/src/watch-history-client.ts`
- `apps/extension/src/popup-watch-history.tsx`
- `apps/web/app/account/watch-library/watch-library-client.tsx`

**Steps:**

1. Re-run a source/consumer trace for the protocol, current title RPC, web
   library, Popup projection, deletions, and outbox recovery.
2. Confirm against current source that the title-page RPC still returns every
   episode for each visible title and that the Popup's immediate projection does
   not depend on a server detail request.
3. Record the database RED matrix for Task 2 and the protocol/consumer RED
   matrix for Task 3 before editing either branch. Include exact counts, bounded
   slice, cursor, equal-time ordering, provider/title mismatch, unknown fields,
   2,000-episode title, realistic account, delete, clear, outbox, and local
   projection cases.
4. Verify the staging migration history and current PR ancestry. If source,
   deployed schema, or user-verified local-first behavior differs from this
   plan, stop and amend it.

**Acceptance:** a source-backed test matrix and deployment baseline exist; no
file, runtime, database, or generated-graph change is made in this task.

### Task 2: Deploy The Additive Watch History Database Prerequisite

**Files:**

- Create with `supabase --workdir apps/web migration new watch_history_v2_resource_bounds`:
  `apps/web/supabase/migrations/<generated>_watch_history_v2_resource_bounds.sql`
- Create: `apps/web/supabase/tests/watch_history_v2_resource_bounds.test.sql`
- Modify:
  `apps/web/supabase/contracts/watch_history_v2_migration_order_contract.sql`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2.local-rpc.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2.benchmark.test.ts`

**Steps:**

1. Add and run RED pgTAP, SQL-contract, real-RPC, and benchmark cases from the
   Task 1 matrix. Confirm failures describe only the absent bounded database
   behavior.
2. Extend the title projection with exact observed/completed episode counts and
   maintain them transactionally on progress writes, deletions, and full clear.
3. Add a new service-role-only bounded title-page RPC without changing the
   currently consumed RPC. Return at most eight recent episode rows per title
   plus exact counts and continuation.
4. Add a service-role-only title-detail keyset RPC capped at 50 rows plus one
   lookahead. Prove index-backed bounded work, stable ordering, no duplicates,
   and safe behavior when rows change between requests.
5. Add an expiry-leading index and a service-role-only cleanup function that
   deletes one skip-locked batch of receipts whose exact 14-day expiry passed.
   Schedule one hourly Supabase Cron job using the already-enabled capability.
   Never delete progress, settings, summaries, fences, or unexpired receipts.
6. Measure normal and adversarial creation rates using current heartbeat and
   session behavior. Add a creation-only budget only if the evidence demonstrates
   a material pre-UI risk; otherwise record the explicit no-limiter decision.
7. Run full Supabase reset, pgTAP, lint, dry-run, migration-order/concurrency
   contracts, real RPC parsing, and the payload/RSS benchmark.
8. Open a migration-prerequisite PR to `staging`; verify remote migration history
   before Task 3.

**Acceptance:** the old staging web runtime remains compatible; 50 titles are at
or below 2 MiB and parser RSS delta is below 32 MiB; queries and cleanup are
bounded; receipts retain exactly 14 days.

### Task 3: Switch Watch History Consumers Without Changing Local-first UX

**Files:**

- Modify: `packages/protocol/src/watch-history.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/test/watch-history.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2-routes.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2-routes.test.ts`
- Create: `apps/web/app/api/watch-history/v2/title-episodes/route.ts`
- Modify: `apps/web/app/account/watch-library/watch-library-client.tsx`
- Create:
  `apps/web/app/account/watch-library/watch-library-client.test.tsx`
- Modify: `apps/extension/src/watch-history-client.ts`
- Modify: `apps/extension/test/watch-history-client.test.ts`
- Modify: `apps/extension/src/popup-watch-history.tsx`
- Modify: `apps/extension/test/popup-watch-history.test.tsx`

**Steps:**

1. Add and run RED protocol, route, website, Popup, and client tests from the
   Task 1 matrix. Confirm they fail for the missing bounded consumer contract,
   not for unrelated staging or network state.
2. Close the strict protocol contract described above and switch the web
   service to the already-deployed bounded RPC.
3. Add the authenticated detail route with account ownership, strict request
   parsing, stable public errors, and no user-selectable SQL limit above 50.
4. Make the website fetch detail pages only when a title is expanded or the
   user explicitly asks for more, merging by canonical episode identity. A
   failed detail fetch leaves existing rows visible and retryable.
5. Keep the Popup on the bounded canonical snapshot plus same-owner local
   projection. It never eagerly downloads old detail pages.
6. Prove pause, close, offline recovery, backward seek, delete, full clear,
   account switch, stale refresh, and outbox behavior remain unchanged.
7. Build and validate the staging extension and perform loaded-artifact
   Crunchyroll/YouTube and website convergence acceptance.

**Acceptance:** no response silently claims that a bounded slice is complete;
stored history is intact; local observation remains immediate; Popup and website
converge after synchronization.

### Task 4: Define And Test The Canonical Room Source Contract

**Files:**

- Create: `packages/protocol/src/source-url.ts`
- Create: `packages/protocol/test/source-url.test.ts`
- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/test/protocol.test.ts`
- Modify: `apps/extension/test/source-adapters/crunchyroll/navigation.test.ts`
- Modify: `apps/extension/test/source-adapters/youtube/navigation.test.ts`

**Steps:**

1. Inventory every currently accepted Crunchyroll and YouTube navigation sample
   before choosing canonical paths; preserve valid current flows.
2. Add RED tests for canonical desktop/mobile YouTube and Crunchyroll watch
   URLs, query normalization, unsupported routes/hosts, credentials, fragments,
   HTTP downgrade, deceptive subdomains, cross-provider changes, and overlong
   input.
3. Implement one pure strict canonicalizer and source descriptor. Keep provider
   observation, DOM selectors, and navigation execution in the extension.
4. Add schemas for the internal source-persistence callback and monotonic
   acknowledgement.

**Acceptance:** protocol tests define one unambiguous source contract; no room,
Worker, database, or navigation runtime changes yet.

### Task 5: Add Durable Room Source Persistence As A Database Prerequisite

**Files:**

- Create with `supabase --workdir apps/web migration new room_source_generation`:
  `apps/web/supabase/migrations/<generated>_room_source_generation.sql`
- Create: `apps/web/supabase/tests/room_source_generation.test.sql`
- Create: `apps/web/lib/anidachi-auth/room-source.ts`
- Create: `apps/web/lib/anidachi-auth/room-source.test.ts`
- Create: `apps/web/app/api/internal/rooms/[roomId]/source/route.ts`
- Modify: `apps/web/app/api/rooms/route.ts`
- Modify: `apps/web/app/api/rooms/[roomId]/join/route.ts`
- Modify: `apps/web/app/api/rooms/[roomId]/route.ts`
- Modify: `apps/web/app/room/[roomId]/page.tsx`
- Modify: `apps/web/lib/anidachi-auth/db.ts`

**Steps:**

1. Add RED pgTAP and Web service/route tests for creation generation, monotonic
   update, idempotent duplicate, stale callback, conflicting same generation,
   cross-provider change, legacy row, internal authorization, join, and reload.
2. Add nullable `source_provider` and positive `source_generation` to rooms with
   database constraints. Do not bulk-rewrite historical rooms. New creation
   writes generation 1; legacy rows are canonicalized at the Web boundary and
   become populated by the first valid Worker persistence callback.
3. Add a service-role-only monotonic persistence RPC: same generation and same
   source is idempotent; a lower generation is acknowledged as stale without an
   update; the same generation with conflicting data is rejected; a higher
   generation cannot change the pinned provider.
4. Add an internal Web callback protected by the existing shared internal
   authorization. Parse the shared schema and return an exact acknowledgement.
5. Canonicalize room creation and make status/join/reload use the durable current
   descriptor. Unsupported destinations never become automatic navigation.
6. Run Supabase, web, and protocol gates; deploy and verify this additive
   prerequisite on staging before Task 6.

**Acceptance:** the existing runtime remains compatible and room creation stores
one valid provider/source/generation tuple.

### Task 6: Converge Worker And Extension On The Durable Room Source

**Files:**

- Modify: `apps/api/src/internal-web-client.ts`
- Modify: `apps/api/test/internal-web-client.test.ts`
- Create: `apps/api/src/room-source-persistence.ts`
- Create: `apps/api/test/room-source-persistence.test.ts`
- Modify: `apps/api/src/room-state.ts`
- Modify: `apps/api/test/room-state.test.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/test/routes.test.ts`
- Modify: `apps/extension/src/room-client.ts`
- Modify: `apps/extension/test/room-client-auth.test.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/navigation.ts`
- Modify: `apps/extension/src/source-adapters/youtube/navigation.ts`
- Modify: `apps/extension/src/p2p-ice.ts`
- Modify: `apps/extension/test/p2p-ice.test.ts`

**Steps:**

1. Add RED API/extension tests for initialization, coalescing, acknowledgement,
   retry, overlapping room-lifecycle alarm, provider mismatch, navigation, and
   ICE header/query behavior.
2. On accepted source initialization/change, store one latest pending descriptor
   in Durable Object storage, broadcast live immediately, and persist to Web in
   `waitUntil` without blocking playback.
3. Coalesce newer generations, clear only matching acknowledgements, and retry
   failures using bounded exponential backoff. Coordinate the next alarm with
   existing empty-room/end retries and prove neither deadline can starve the
   other.
4. Validate source changes with the shared contract and pinned provider before
   mutating live room state.
5. Make extension create/navigation consume the shared canonical descriptor
   while preserving provider-specific behavior.
6. Search all consumers, then remove only the legacy ICE query bearer. Preserve
   Authorization bearer ICE and WebSocket query-token behavior.
7. Run protocol/API/web/extension checks, room harness, staging Worker smoke,
   and two-profile tests for create, join, source change, transient callback
   failure, reload, late join, stale callback, malicious URL, and room end.

**Acceptance:** live playback never waits for durable persistence; after retry,
Worker and Supabase converge on the highest valid generation; reload/late join
opens the current source; ICE query bearer is unreachable.

### Task 7: Make Invite Actionability Follow Room Lifecycle Atomically

**Files:**

- Create with `supabase --workdir apps/web migration new room_invite_lifecycle_actions`:
  `apps/web/supabase/migrations/<generated>_room_invite_lifecycle_actions.sql`
- Create: `apps/web/supabase/tests/room_invite_lifecycle_actions.test.sql`
- Modify: `packages/protocol/src/account.ts`
- Modify: `packages/protocol/test/account.test.ts`
- Modify: `apps/web/lib/anidachi-auth/social.ts`
- Modify: `apps/web/lib/anidachi-auth/social.test.ts`
- Modify: `apps/web/lib/anidachi-auth/account-inbox.ts`
- Modify: `apps/web/lib/anidachi-auth/account-inbox.test.ts`
- Modify: `apps/web/lib/anidachi-auth/account-inbox-routes.ts`
- Modify: `apps/web/lib/anidachi-auth/account-inbox-routes.test.ts`
- Modify: `apps/web/app/account/invites/invites-client.tsx`
- Modify: `apps/extension/src/account-inbox-client.ts`
- Modify: `apps/extension/test/account-inbox-client.test.ts`

**Steps:**

1. Add RED database and service tests for an active invite older than 12 hours,
   room end, room temporarily full, friendship removed, concurrent accept versus
   decline, duplicate action, wrong recipient, direct invite, and group invite.
2. Add versioned inbox/reconciliation and response RPCs. Determine actionability
   from `rooms.status`, recipient state, and friendship inside the transaction;
   ignore legacy `expires_at` as a product deadline.
3. Preserve the old functions for rollback, deploy the migration prerequisite,
   and verify remote staging history before switching runtime consumers.
4. Switch accept/decline and inbox services to the atomic functions. Remove
   “expires at” product copy while retaining compatibility parsing if required.
5. Prove active pending invites stay active even when old `expires_at` passed;
   ended rooms create one `missed` state for 24 hours; one terminal response
   wins; retries are idempotent.
6. Run protocol/web/extension/Supabase gates and two-profile direct/group staging
   acceptance. Do not add polling or a new notification transport.

**Acceptance:** UI consumers receive one lifecycle-consistent state and cannot
accept an ended, foreign, non-friend, or already-resolved invite.

### Task 8: Integrated Foundation Verification And UI/UX Handoff

**Closeout state:** Tasks 2-3 (bounded Watch History), Tasks 4-6
(canonical/durable room source), and Tasks 7A-7B plus the accepted regression
fix (room-lifecycle invites) are delivered to and accepted on staging. The
staging commits are `7d2e3badb043c3d3adb4ef16ad9527dd3762259f`,
`b652f8b8cfbdd8130a648702708dfcc13dc2cd8d`,
`b494bf31de94c70e379f50f87f96a18356e9f1f7`,
`ce88d9e9b2dbaef461c3558cb4ec8c53b7b88770`,
`4a63997648bb754fd2ee6b3d95f9a960283acb01`,
`d4262ffef6a78e4c275a95fb3e70d705ecc04759`,
`b12c4850f034e69f2cfd24a0db90bfd3e045eb87`,
`1bafc52`, and `3a442b7f76992a5e48b387740bf9cc31a565235e`. The recorded
migrations are `20260821162622_watch_history_v2_resource_bounds`,
`20260822033019_room_source_generation`,
`20260822065227_room_invite_lifecycle_actions`, and
`20260822091552_finalize_legacy_orphan_invite_rooms`.

Task 8 controller verification passed at runtime base `3a442b7`: workspace
check 6/6; forced workspace tests 6/6 (extension 98 files, 1,277/1,277); API
runtime 24/24; clean database reset; pgTAP 8 files/419; database lint clean;
linked dry-run remote up to date; rooms 39/39; isolated P2P 26/26; Worker
staging smoke; staging extension build/validation; `pnpm dev:check`; and
whitespace. The first P2P attempt encountered an environmental inspector-port
`9229` collision; the isolated rerun passed 26/26, so it is not a product
failure. All post-merge workflows and staging smokes are green.

The exact attended artifact is `3a442b7-staging-20260822162838`. Both
established unpacked folders currently have that version and are byte-identical.
The user accepted Watch History, room-source, and invite host `Accepted`
behavior in the established two-profile staging flow.

Graphify refresh/query/explain passed from current source at
`f5622c7c` before this documentation finish: 9,943 nodes, 21,002 edges, and
1,120 communities; query/explain found the handoff; topology diagnostics report
0 missing endpoints, 0 dangling links, 0 self-loops, and 0 duplicate/collapsed
edges. It retains 550 legacy/external-reference placeholder nodes without
labels/source files (the same 1,100 field warnings reported by the prior graph).
The final post-documentation semantic refresh remains controller-owned because
this finish changes its input; it is a graph-freshness follow-up, not a blocker
to the completed staging closeout.

**Files:**

- Modify: `docs/current-development-state.md`
- Modify: `docs/shared-watch-progress-tracker.md`
- Modify: `docs/site-extension-integration-notes.md`
- Modify: this plan
- Modify: `docs/superpowers/plans/README.md`
- Update intentionally: `graphify-out/graph.json`
- Update intentionally: `graphify-out/GRAPH_REPORT.md`
- Update intentionally: `graphify-out/manifest.json`

**Steps:**

1. Run affected protocol, web, API, extension, Supabase, room harness, staging
   extension build/validation, Web smoke, Worker smoke, and `pnpm dev:check`.
2. Repeat focused loaded-artifact acceptance for local-first Watch History,
   offline convergence, backward seek, detail paging, room create/join/change/
   reload/late join, ICE Authorization, and invite lifecycle/concurrency.
3. Record exact commits, migrations, staging deployments, artifact identity,
   payload/RSS measurements, tests, known limits, and forward rollback paths.
4. Re-query Graphify, verify important claims in source, refresh the graph, and
   update canonical docs only with observed evidence.
5. Mark this plan complete only when all three foundation blocks pass. Keep
   unfinished UI/UX, release, P2P/TURN, billing, public-form, media, legal, and
   provider work separately visible rather than absorbing it here.
6. Open/merge the final evidence PR to `staging` and stop.

**Acceptance:** staging is a clean, documented foundation for UI/UX development.
This is not a production-readiness or public-release claim.

## Required Checks By Wave

Use the repository-pinned Node and pnpm versions. The exact affected-plane set
may grow after drift review, but it may not shrink without a recorded reason.

```bash
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/api test
pnpm --filter @anidachi/api test:runtime
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
supabase --workdir apps/web db reset
supabase --workdir apps/web test db
supabase --workdir apps/web db lint --level warning
supabase --workdir apps/web db push --dry-run
pnpm harness:rooms
pnpm build:extension:staging
pnpm validate:extension:staging
pnpm dev:check
```

Real WebRTC/TURN evidence remains governed by the room/P2P plans and is not
silently converted into a pass by this checklist.

## Definition Of Complete

This plan is complete only when:

- the title-page response has a measured episode-row bound and detail
  continuation without data loss or local-first regression;
- expired receipts are globally cleaned at exactly the approved 14-day boundary
  and any creation budget is evidence-based;
- every room source entry/change is canonical, provider-pinned, monotonic, and
  durably convergent for reload and late join;
- ICE credentials use Authorization only and the WebSocket exception is clearly
  retained/tested;
- invites remain actionable for the active room lifecycle and accept/decline is
  atomic and idempotent;
- all required local/staging checks and loaded-artifact acceptance are recorded;
- current docs and Graphify match source and staging evidence;
- no Bloü/OpenClaw, legal, production, `main`, release, store, speculative
  provider, or UI/UX work was pulled into the implementation.

After this definition is met, normal UI/UX work can proceed on the stable
contracts. Separate pre-public hardening and release decisions remain visible
and must receive their own scope and approval.
