# Watch History Local Read Implementation Plan

> Use test-driven-development. Use subagent-driven-development for the independent
> server/contract task and its review; the controller integrates the client and
> loaded-artifact verification in this existing isolated worktree.

**Goal:** Show saved Mine/Together history and known episodes immediately without
turning every playback checkpoint into a cold read.

**Architecture:** Server remains the durable authority. An opt-in bounded title
response includes exact-query episode previews. One persistent account/query-owned
read cache replaces the disposable browse cache; ordinary progress makes relevant
results stale rather than inaccessible. Deletion/generation/consent/auth fences
remain hard. The existing canonical cache and outbox keep their responsibilities.

**Tech Stack:** Existing WXT/React/TypeScript/Zod/Postgres, Node 22.23.1,
pnpm 11.2.2. No dependencies, services or polling.

**Spec:** User-approved design in the current conversation: local saved history,
background synchronization, identical fast read behavior for solo/shared, exact
server filters, initial episodes with titles, bounded continuation, existing
progress writer/outbox preserved.

## Global Constraints

- Local work only: no push, merge, deploy, remote migration, production changes.
- Preserve history and surrounding auth, rooms, media, capture and YouTube consent.
- Old clients must receive their old strict response unless they opt into previews.
- Filtering must precede pagination. Never show canonical unfiltered rows as matches.
- Canonical progress/aggregates remain unchanged by browse filters.
- No global cache miss on an ordinary accepted progress checkpoint.
- Same-owner auth rotation must not expose another account or resurrect deleted data.
- Generated artifacts are ignored. Do not replace tester folders with an artifact
  requiring an undeployed server. Record cold/missing data honestly.
- Database verification uses an explicitly identified disposable database only.

## Task 1: Exact-query initial episode previews

**Files:** packages/protocol/src/watch-history-browse.ts and tests;
apps/web/lib/anidachi-auth/watch-history-browse.ts, watch-history-browse-routes.ts
and tests; a new CLI-named migration and focused pgTAP regression.

**Interfaces:** `WatchHistoryBrowseResponse.episodePreviews?` is an array of
`WatchHistoryBrowseTitleEpisodesResponse`, one per returned title. Its detail has
at most eight matching episodes, unchanged canonical catalog/counts, complete flag
and exact query-bound continuation. Opt in with `includeEpisodePreviews=true` on
the titles HTTP request. The background adds this only at the network boundary;
normal UI filter inputs and episode queries do not carry that flag.

- [ ] Add fail-first protocol/service/SQL tests: solo/shared; matching episode
  outside the canonical latest eight; group/date/participant combined; 9+ matching
  episodes with no gaps/duplicates on continuation; canonical aggregates invariant;
  old caller response unchanged; owner/generation/malformed payload rejection.
  ```ts
  expect(response.episodePreviews[0].detail.episodes.map(e => e.episodeKey))
    .toEqual(["eligible-old-episode"]);
  expect(response.episodePreviews[0].detail.complete).toBe(true);
  expect(legacy).not.toHaveProperty("episodePreviews");
  ```
- [ ] Run failures against the existing implementation and record output.
- [ ] Extend bounded RPC selection using the existing filtered matching relation;
  no HTTP/RPC request per title and no full account materialization in JavaScript.
  Reuse exact episode cursor ordering/binding and matching session/group semantics.
- [ ] Build/validate previews from canonical rows and selected matching evidence.
  Preserve the final generation check; update strict schemas and old-caller tests.
- [ ] Run focused protocol/web and actual disposable SQL tests, record size/query
  evidence, self-review and commit only task-owned files locally.

## Task 2: Persistent, safely revalidated reads

**Files:** apps/extension/src/watch-history-browse-cache.ts,
watch-history-client.ts, watch-history-storage.ts and their tests.

**Interfaces:** Keep cacheOnly reads and return saved data with freshness metadata.
Persist bounded responses locally; bind query/account/generation/consent and hard
invalidation independently from ordinary progress freshness. Keep canonical/outbox
authorities intact. Request Task 1 previews only on network title reads.

- [ ] Fail-first: warm both modes and old-title detail, accept a real new progress
  acknowledgement, then read caches through a new client/cache instance. Previously
  saved rows remain displayable and stale; no cross-owner/clear/delete/consent leak.
  ```ts
  expect(await restarted.handle(cachedOldTitle)).toMatchObject({ ok: true, data: oldDetail });
  expect(await restarted.handle(cachedDeletedTitle)).not.toHaveProperty("data");
  ```
- [ ] Implement one bounded persistent read cache. Separate stale-but-displayable
  progress changes from hard invalidations; preserve late-response protection.
- [ ] Test same-owner token refresh, logout/login scope, new account, generation,
  deletion races, cache quota/failure and obsolete responses. Cache failures must
  never turn successful server reads into history failures.

## Task 3: Stable drawer integration and verification

**Files:** apps/extension/src/popup-watch-drawer.tsx and focused tests;
current-state/history docs and this plan; ignored loaded-artifact fixtures.

- [ ] Fail-first: render a title with exact-query preview while its detail request
  is held; known episodes appear without waiting. Warm Mine/Together, advance
  progress, switch modes and reopen; keep rows visible while refresh is held.
  ```ts
  expect(screen.getByText("Known episode")).toBeVisible();
  expect(screen.queryByText("Loading matching episodes...")).toBeNull();
  ```
- [ ] Seed episode presentation from validated matching previews, prefer newer
  exact-query detail when present, and load only missing continuation on demand.
  Preserve stale pages during background refresh; never reuse another filter's rows.
- [ ] Reconcile newly observed solo titles immediately; shared additions require
  verified membership or an explicitly pending observation, never guessed groups.
- [ ] Verify stable order/disclosures, terminal progress, bounded pagination and
  read-only offline display through component tests and the installed MV3 artifact.
- [ ] Run protocol/web/extension checks/tests, narrow artifact build/validation,
  independent review and Graphify/doc maintenance. Keep all claims scoped to the
  actual local evidence; record the needed staging activation separately.

## Rollback

Restore the prior Web/extension consumers, retaining history and additive database
changes. New cache keys are disposable read data; canonical cache/outbox remain
untouched. No automatic data deletion or database reset is a rollback step.
