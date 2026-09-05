# Watch Drawer Browse Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute
> the tasks below, and test-driven-development for behavior changes.

**Goal:** Deliver accurate group/participant/date browsing and a stable, compact
Watch drawer, with existing canonical progress and account settings preserved.

**Architecture:** Extend the existing Supabase history boundary with additive
invitation provenance and bounded server-side browsing. Keep filtered responses
separate from the extension's canonical playback cache. Reuse React components,
current preference commands, history projections and current account links.

**Tech Stack:** TypeScript, Zod, React, WXT, Next.js, Postgres/Supabase, Vitest,
pgTAP; Node 22.23.1 and pnpm 11.2.2. No dependency changes.

**Spec:** docs/superpowers/specs/2026-09-05-watch-drawer-browse-design.md

**Local status (2026-09-05):** Tasks 1–3 are implemented and independently
reviewed through `bf260d7e858bbd721820a2c7a4ee5532ac924542`. Task 4 automated,
SQL-source, isolated artifact, and synthetic real-component evidence is recorded in
`docs/watch-drawer-browse-local-verification.md`. Semantic Graphify refresh, final
controller review, and the local documentation checkpoint remain pending. Nothing
in this status is staging deployment or authenticated acceptance.

## Global Constraints

- Local only: no push, PR, merge, remote migration/deploy, or main changes.
- Preserve current history, YouTube consent, account fences and media/room flows.
- Filter durable history before pagination; never infer groups from current members.
- Group association is owner-private and based on invitation plus actual viewing.
- Title/season aggregates remain canonical and independent of browse filters.
- Additive service-role-only DB changes, RLS, empty search_path, no secret exposure.
- Use an explicitly guarded disposable local DB, never reset a shared local DB.
- No new dependencies, services, polling or speculative history backfill.
- Do not overwrite tester folders with a client requiring undeployed endpoints.
- Keep changes isolated in this linked worktree and preserve unrelated edits.

## Task 1: Durable Provenance And Server Browse Boundary

**Files:**
- Add a CLI-named migration in apps/web/supabase/migrations/.
- Add apps/web/supabase/tests/watch_history_v3_browse.test.sql.
- Add packages/protocol/src/watch-history-browse.ts and its protocol tests/export.
- Add apps/web/lib/anidachi-auth/watch-history-browse.ts and tests.
- Add apps/web/app/api/watch-history/v3/browse/route.ts and route tests.
- Extend existing canonical history session enrichment only if needed; do not
  change the progress/capture or invitation response contract unnecessarily.

**Interfaces:** Produce validated WatchHistoryBrowseQuery,
WatchHistoryBrowseResponse and owner-bound browse handler for Task 2. Query has
mode (solo/shared), optional search, groupId, participantUserId, from inclusive
UTC timestamp, until exclusive UTC timestamp, limit and opaque cursor. Response
contains canonical WatchHistoryResponse plus matching session context and honest
bounded continuation. Export exact signatures and fixture examples in the task
report before Task 2. Reuse existing episode detail DTO where possible; filtered
detail queries must retain the same conditions, not reveal unfiltered rows.

- [ ] Write protocol, service and SQL regressions before implementation. Minimal
  contract rejection cases:
  ```ts
  expect(WatchHistoryBrowseQuerySchema.safeParse({
    mode: 'solo', groupId: group.id,
  }).success).toBe(false);
  expect(WatchHistoryBrowseQuerySchema.safeParse({
    mode: 'shared', from: '2026-09-05T00:00:00Z',
    until: '2026-09-04T00:00:00Z',
  }).success).toBe(false);
  ```
- [ ] Verify expected red results. SQL fixtures cover invited-but-absent, actual
  participant, ordinary link, overlapping/repeated group invites, rename/delete,
  delayed checkpoints and group-owner isolation. Record first failing assertions.
- [ ] Add transactional provenance capture from existing authenticated invitation
  context, preserving recipient deduplication/push behavior. Persist historical
  group context only with eligible actual shared evidence; no current-member join.
- [ ] Add indexed filtering before title/episode/session LIMIT with distinct
  counts, requester/current-generation fencing and query-bound keyset cursors.
  Group+participant+date must match one actual eligible session. Reuse canonical
  aggregates unchanged. Fail malformed queries before DB access.
- [ ] Provide filter options from owner-visible history/group/participant data,
  with explicit bounds/continuation if needed. Never silently derive options from
  only the currently displayed cards. Document exact endpoint/contracts.
- [ ] Verify old canonical readers and invitations remain compatible. Cover a
  matching session older than the first 20, a matching episode older than the
  first eight, and a matching title beyond the first page. Prove no duplicates.
- [ ] Run protocol/web focused tests and checks, actual guarded local pgTAP and
  production RPC parsing. Inspect query plans on populated fixtures. Commit only
  this coherent local task and submit for independent task review.

## Task 2: Query-Isolated Extension Client

**Files:** apps/extension/src/watch-history-client.ts; its tests; a focused new
apps/extension/src/watch-history-browse.ts helper if required.

**Interfaces:** Consume Task 1's validated query/response. Produce background
commands browse and browse-detail/options as required, with expectedOwnerUserId,
plus pure local date-range/query helpers for Task 3. Existing list/bootstrap and
progress cache/outbox remain unchanged.

- [ ] Add red tests for malformed/foreign-owner query, stale query/account result,
  filtered result not replacing canonical cache, HTTP error and retry, pagination
  and filter switches. Name requests explicitly in assertions:
  ```ts
  expect(await handle(foreignOwnerBrowse)).toMatchObject({ ok: false });
  expect((await storage.readRoot()).partitions[key].cache).toEqual(canonical);
  ```
- [ ] Implement authenticated owner-validated browsing, runtime response parsing,
  and generation/invalidation guards. Query results are view-local, not a new
  persistent cache/outbox. Coalesce identical work only; distinct query results
  must not supersede canonical refreshes or one another globally.
- [ ] Implement local-day inclusive/exclusive ranges with Date calendar methods,
  not 24-hour millisecond subtraction. Test leap day and DST boundaries in UTC
  and America/New_York, and strict invalid/reversed custom dates.
- [ ] Run focused client/helper tests, full extension check/test; commit local
  task and obtain independent task review.

## Task 3: Drawer Layout, Filtering And History Settings

**Files:** apps/extension/src/popup-watch-history.tsx,
popup-watch-history-styles.ts, popup-app.tsx, popup-styles.ts;
new focused drawer filters/settings components; corresponding extension tests.
Website watch-library keeps management; change shared display helpers only if
needed for consistent truthful aggregate/date formatting.

**Visual thesis:** Quiet dark surfaces, precise cover-aligned hierarchy, orange
only for progress/action. No decorative glow, heavy repeated cards or color fields.
**Content plan:** Existing account/nav; compact toolbar; optional conditions;
provider/title/season/episode tree; Manage history footer.
**Interaction thesis:** In-place progress updates; short chevron/disclosure and
filter-panel transitions without row scaling; visible focus and reduced motion.

**Interfaces:** Consume Task 2 commands/helpers; preserve panel owner/action
generation and existing stable disclosure/ordering model. Settings reuse current
get-preferences/update-preferences commands, not a second source of truth.

- [ ] Add red component tests for active segment no-op; group/person/date filter
  payload/chips/reset; stale reads; canonical aggregate invariance; pagination;
  title date/shared session participants; no delete controls; Manage history URL;
  moved YouTube setting owner-switch/in-flight/rollback behavior.
- [ ] Implement real two-button Mine/Together segmentation, server-backed
  browsing and one compact Filters panel. Preserve visible content on background
  refresh, but never show old-query content as matching a new query. Show honest
  empty/error states and bounded load-more controls. Reset cursors on changes.
- [ ] Implement cover-centered continuous tree, full-width aggregate bars,
  compact season aggregates, integer/<1% labels with no false 100%, 2:3 covers,
  two-line title clamping and shallow episode indentation. Do not manufacture
  unavailable episodes or catalog totals. Keep one scroll and stable dimensions.
- [ ] Remove drawer destructive controls/code paths only; add account Manage
  history footer. Move YouTube preference to gear > History, keeping separate
  explanatory scope from browser-only invitation notifications. Preserve offline
  preference and rollback behavior; no implicit enabling.
- [ ] Run component/full extension tests/check and inspect actual components in
  a local browser fixture at narrow/full drawer widths, long/RTL labels,
  expanded trees, active filters, loading/error and reduced motion. Fixtures are
  test evidence, not the user-facing deliverable or a replacement prototype.
- [ ] Commit task locally; obtain independent spec/quality review.

## Task 4: Integration, Evidence And Local Handoff

**Files:** Current state and relevant history docs, this plan, review ledger;
generated artifacts stay ignored.

- [x] Run fresh workspace check/test and retained history tests, reuse the
  controller's final exact-source dedicated SQL evidence because SQL is unchanged,
  and run changed-path lint plus git diff checks.
- [x] Build and validate narrow staging-channel extension as an unpublished local
  candidate. Record that new server-backed filtering cannot be accepted against
  unchanged staging. Do not update the two established folders yet.
- [x] Review the whole diff independently for cross-account leaks, temporal
  provenance, query/cursor isolation, truthfulness, deletion, consent and UI.
- [ ] Update docs and semantic Graphify with the new boundaries. Preserve historical
  release evidence, record additive DB-first rollout and rollback to old runtime.
  Documentation is frozen; semantic Graphify refresh is pending.
- [ ] Keep all source locally committed in coherent checkpoints; leave no unrelated
  uncommitted source or generated artifacts staged. No push/merge/deploy.
- [ ] Handoff short user-facing result, local visual evidence and exact remaining
  authorization/manual acceptance requirement. Never claim staging already updated.
