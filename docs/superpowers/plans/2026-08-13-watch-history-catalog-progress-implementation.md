# Watch History Catalog And Progress Implementation Plan

> **Status: Superseded.** Do not execute this plan. It is retained as
> historical context and is replaced by
> [Watch History v2 Clean MVP Implementation Plan](./2026-08-14-watch-history-v2-clean-mvp-implementation.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current append-only watch checkpoint path with one compact,
account-owned history model that gives the extension Popup and website identical
episode resume state and honest Crunchyroll season/title totals, while preserving
provider isolation, offline recovery, shared-session history, and deletion safety.

**Architecture:** Supabase remains the durable system of record. A versioned v2
protocol separates progress events, catalog snapshots, preferences, deletion
commands, acknowledgements, and paginated reads. The extension keeps only an
account-scoped display cache plus a compact coalescing outbox. Provider-specific
history policies live beside each source adapter: Crunchyroll can lazily collect a
bounded catalog snapshot, while YouTube remains movie-like and disabled by default.
The rollout is additive: v1 remains available until the v2 database, web routes,
extension writer, Popup, and website have passed staging acceptance. Only then is
the checkpoint-dependent path removed in a separate cutover change.

**Tech Stack:** TypeScript 6 in the shared protocol and extension, the existing
TypeScript 5 compatibility range in the Next.js web app, Zod 4, WXT 0.20,
React 19, Next.js 15 route handlers, Supabase Postgres 17,
`@supabase/supabase-js` 2.106, Vitest 4, Node test runner, pnpm 11.2.2,
Node 22.23.1, Graphify.

## Global Constraints

- The approved product contract is
  `docs/superpowers/specs/2026-08-13-watch-history-catalog-progress-design.md`.
- Preserve the Popup hierarchy `provider -> title -> season -> episode`. Do not
  create a second history product or render every unwatched episode in the Popup.
- Keep history capacity and retention identical for Free, Plus, and Pro. Plans may
  continue to differ for rooms, participants, media seats, groups, and invitations.
- Do not change the in-player panel, playback synchronization, room authority,
  P2P media, friends, groups, or invite behavior except for the narrow progress
  publication hooks and independent `Recent people` evidence defined here.
- Do not infer exact catalog totals from observed history. Exact denominators are
  permitted only when the latest accepted provider snapshot is `complete`.
- Do not poll providers in the background. Crunchyroll catalog work is triggered by
  a real authenticated interaction, runs asynchronously, and is freshness-guarded.
- YouTube history is account-wide, disabled by default, and excludes Shorts,
  previews, unsupported embeds, and non-watch surfaces.
- The extension never receives a Supabase service-role key or other server secret.
- HTTP routes derive `userId` from the validated extension/web session. A body
  `userId` is invalid input and must never influence ownership.
- Every new HTTP boundary uses strict shared Zod schemas. Do not add v2 fields to
  the strict v1 response in place.
- Postgres functions use `security invoker` unless a demonstrated requirement
  needs `security definer`. Every function sets `search_path = ''`, schema-qualifies
  relations and functions, and grants execution only to `service_role`.
- Database indexes must match owner/provider/title/episode lookups and the
  `(last_watched_at, stable_id)` cursor path.
- Do not store raw access tokens, email addresses, full private provider payloads,
  or full user IDs in logs. Provider fixture captures must be sanitized.
- Do not mix implementation into the current dirty Popup UI worktree. Start runtime
  work from latest `origin/staging` in a clean `codex/` branch or sibling worktree.
  Integrate `popup-app.tsx`, `popup-styles.ts`, and Popup tests only after the current
  visual checkpoint is committed or merged.
- Each rollout phase is a coherent PR into `staging`. Do not include the destructive
  cleanup migration in the additive foundation PR.
- No production promotion occurs before authenticated staging acceptance with the
  actual staging extension artifact.
- This plan follows the current Supabase function guidance verified through
  Context7 on 2026-08-13: default to `security invoker`, use an empty
  `search_path`, schema-qualify referenced objects, and revoke default function
  execution before granting only the server role used by AniDachi.

---

## Target Contract And Storage Map

### Shared protocol

- `packages/protocol/src/watch-history.ts` owns v2 request/response schemas.
- `packages/protocol/src/account.ts` keeps the existing v1 schemas unchanged until
  cutover is proven.
- `WATCH_HISTORY_SCHEMA_VERSION` is exactly `2` and is independent of
  `ACCOUNT_RESPONSE_SCHEMA_VERSION`.

### Durable storage

- Existing `user_tracked_titles` remains the compact title index and cursor source.
- Existing `watch_sessions` and `watch_session_participants` remain meaningful
  product session storage, but v2 updates only the authenticated participant.
- New `watch_episode_progress` stores one mutable canonical episode state.
- New `watch_catalog_snapshots` stores one bounded JSON snapshot per
  user/provider/title.
- New `watch_progress_event_receipts` provides bounded idempotency, not a permanent
  observation journal.
- New `watch_history_deletions` fences delayed episode/title retries.
- New `user_watch_settings` stores the account history generation and the global
  YouTube-history preference.
- New `recent_people_evidence` stores one compact pair/room proof independent of
  watch history deletion.
- Existing `watch_progress_checkpoints` is retained during rollout and removed only
  after the v2 clients and `Recent people` read path are verified in staging.

### Runtime ownership

- `apps/extension/src/source-adapters/*/history-policy.ts` owns provider-specific
  eligibility and observation extraction.
- `apps/extension/src/watch-history-outbox.ts` owns compact retry state.
- `apps/extension/src/watch-history-controller.ts` owns meaningful publication
  timing and session boundaries.
- `apps/web/lib/anidachi-auth/watch-history.ts` owns authenticated v2 read/write
  orchestration and invokes transactional RPCs.
- Popup and website consume the same `WatchHistoryResponse` values; neither
  calculates authoritative catalog totals independently.

---

## Rollout Phases

1. **Provider proof and shared contracts:** capture a real, sanitized Crunchyroll
   fixture and add v2 schemas without switching runtime behavior.
2. **Additive server foundation:** add tables/RPCs/routes while v1 remains the
   active client path.
3. **Staging extension writer:** add the compact outbox, provider policies, catalog
   refresh, and meaningful event controller against v2 endpoints.
4. **Shared readers:** move Popup and website to v2 and validate parity, deletion,
   account isolation, and pagination.
5. **Cutover and cleanup:** stop v1 checkpoint writes, move `Recent people` fully to
   independent evidence, then remove obsolete storage only after staging proof.

Each phase ends with a commit and focused verification. Phases 2-4 may share one
feature PR when review remains clear, but phase 5 must remain a separate PR.

---

### Task 1: Crunchyroll Catalog Source Preflight And Sanitized Fixtures

**Files:**
- Modify: `docs/crunchyroll-adapter-notes.md`
- Create: `apps/extension/test/fixtures/crunchyroll/catalog-complete.json`
- Create: `apps/extension/test/fixtures/crunchyroll/catalog-partial.json`
- Create: `apps/extension/test/fixtures/crunchyroll/catalog-variants.json`
- Create: `apps/extension/test/fixtures/crunchyroll/catalog-new-release.json`

**Interfaces:**
- Produces: evidence for one stable series identity, stable season identities,
  stable episode identities, availability/release state, ordering, and variant
  identity in the current authenticated Crunchyroll browser context.
- Consumes: the existing staging extension, the authenticated staging test browser,
  and provider data already available to the user's page. No AniDachi runtime API
  changes occur in this task.

- [ ] **Step 1: Start from a clean execution branch**

Run:

```bash
git fetch origin
git worktree add ../anidachi-watch-history-v2 -b codex/watch-history-v2 origin/staging
cd ../anidachi-watch-history-v2
fnm use --install-if-missing
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install --frozen-lockfile
git status --short --branch
```

Expected: a clean `codex/watch-history-v2` worktree based on current
`origin/staging`. If the branch already exists, use a new clean `codex/` branch
name instead of reusing or resetting it.

- [ ] **Step 2: Observe one real multi-season Crunchyroll title**

Use the authenticated `google-auth-chrome-data` profile and the staging extension.
Inspect the supported watch page and already-loaded page/network state for:

- canonical series ID;
- season ID, title, number, and order;
- episode ID, title, number, source URL, availability, and release time if present;
- locale/audio/subtitle variant fields;
- pagination or continuation behavior;
- trailers, previews, future placeholders, and unavailable records.

Do not copy cookies, authorization headers, profile IDs, locale-specific account
tokens, or unrelated provider response fields into the repo.

- [ ] **Step 3: Record the source and explicit fallback rule**

Add a dated `Catalog observation` section to
`docs/crunchyroll-adapter-notes.md` containing:

- where the data was observed (page state, bridge-visible response, or documented
  provider response already requested by the page);
- exact stable identity fields used for series, seasons, episodes, and variants;
- pagination/completeness conditions;
- fields that identify released and currently available episodes;
- failure conditions that force `partial` rather than `complete`;
- the statement that provider endpoint paths and payload shapes are adapter-local
  and are not shared protocol contracts.

If no reliable completeness and canonical-identity evidence is available, stop the
catalog portion of this plan at this gate. Continue progress v2 with
`catalogState: "unavailable"`; do not invent exact totals or scrape titles as IDs.

- [ ] **Step 4: Create sanitized raw fixtures**

Create the four fixture files from the observed payload shape:

- `catalog-complete.json`: at least two seasons and three released episodes;
- `catalog-partial.json`: missing continuation or ambiguous identity so exact totals
  are unsafe;
- `catalog-variants.json`: at least two provider records representing one canonical
  episode plus one genuinely distinct episode;
- `catalog-new-release.json`: the complete fixture plus one newly available episode.

Keep only parser-relevant fields and replace user/account values. The fixtures must
remain structurally faithful to the observed source; they must not be hand-designed
AniDachi snapshots.

- [ ] **Step 5: Verify the fixture safety boundary**

Run:

```bash
rg -n -i "authorization|bearer|cookie|email|refresh_token|access_token" \
  apps/extension/test/fixtures/crunchyroll docs/crunchyroll-adapter-notes.md
git diff --check
```

Expected: no secret-bearing fixture content and no whitespace errors.

- [ ] **Step 6: Commit the preflight evidence**

```bash
git add docs/crunchyroll-adapter-notes.md \
  apps/extension/test/fixtures/crunchyroll/catalog-complete.json \
  apps/extension/test/fixtures/crunchyroll/catalog-partial.json \
  apps/extension/test/fixtures/crunchyroll/catalog-variants.json \
  apps/extension/test/fixtures/crunchyroll/catalog-new-release.json
git commit -m "test(extension): capture Crunchyroll catalog fixtures"
```

---

### Task 2: Additive Watch History V2 Protocol

**Files:**
- Create: `packages/protocol/src/watch-history.ts`
- Create: `packages/protocol/test/watch-history.test.ts`
- Modify: `packages/protocol/src/index.ts`
- Verify unchanged: `packages/protocol/src/account.ts`
- Verify unchanged: `packages/protocol/test/account.test.ts`

**Interfaces:**
- Produces: `WATCH_HISTORY_SCHEMA_VERSION`, catalog, event, acknowledgement,
  preference, deletion, cursor-read, title, season, episode, next-episode, and
  session schemas/types.
- Consumes: existing `WatchProviderSchema`, `WatchItemKindSchema`,
  `PublicProfileSchema`, and `AccountOwnedResponseMetaSchema` from `account.ts`.
- Compatibility: existing `WatchLibraryResponseSchema` remains strict v1.

- [ ] **Step 1: Write failing v2 contract tests**

Create `packages/protocol/test/watch-history.test.ts` with fixed UTC timestamps,
UUIDs, canonical Crunchyroll/YouTube URLs, and these cases:

1. a valid complete two-season catalog snapshot;
2. a valid partial catalog without exact totals;
3. rejection of more than 100 seasons, more than 500 episodes, strings beyond their
   bounds, non-HTTP URLs, and unknown object keys;
4. a progress heartbeat, intentional backward seek, shared room event with
   `sourceGeneration`, terminal `ended` event, and canonical acknowledgement;
5. rejection of body-level `userId`;
6. v2 read response with one complete Crunchyroll series and one movie-like YouTube
   item;
7. episode, title, and all-history deletion requests;
8. account-wide YouTube preference defaulting to `false`;
9. cursor with `lastWatchedAt` and stable `provider:titleKey` identity;
10. the existing v1 fixture still parses only through `WatchLibraryResponseSchema`.

- [ ] **Step 2: Run the focused test and confirm missing exports**

```bash
pnpm --filter @anidachi/protocol test -- watch-history.test.ts
```

Expected: FAIL because the v2 module and exports do not exist.

- [ ] **Step 3: Implement the strict v2 schemas**

Use these exact top-level contracts:

```ts
export const WATCH_HISTORY_SCHEMA_VERSION = 2 as const;

export const WatchCatalogCompletenessSchema = z.enum(["complete", "partial"]);
export const WatchCatalogStateSchema = z.enum(["complete", "partial", "unavailable"]);
export const WatchProgressEventKindSchema = z.enum([
  "heartbeat",
  "pause",
  "seek",
  "source_change",
  "pagehide",
  "room_leave",
  "room_end",
  "ended",
]);
export const WatchHistoryDeleteScopeSchema = z.discriminatedUnion("scope", [
  z.strictObject({ scope: z.literal("episode"), provider, titleKey, episodeKey }),
  z.strictObject({ scope: z.literal("title"), provider, titleKey }),
  z.strictObject({ scope: z.literal("all") }),
]);
```

The remaining contracts must use these ownership and size rules:

- `WatchProgressEvent`: stable `clientEventId`, stable `clientSessionKey`,
  `accountGeneration`, provider/title/episode identity, metadata, canonical source
  URL, current/duration seconds, `observedAt`, event kind, and optional shared-room
  proof `{ roomId, sourceGeneration }`;
- `WatchProgressAck`: accepted event ID/time, account generation, dedupe flag, and
  canonical episode state;
- `WatchCatalogSnapshotInput`: one title, max 100 seasons, max 500 episodes total,
  schema version, completeness, locale context, fetched/attempt timestamps, content
  hash, and bounded source/artwork URLs;
- `WatchCatalogAck`: accepted hash, completeness, fetched time, and whether an older
  complete snapshot was retained;
- `WatchHistoryResponse`: owner-bound meta, generated time, total title count,
  bounded items, and nullable cursor;
- `WatchHistoryItem`: stable identity, display fields, catalog state, aggregate
  `{completedEpisodes, availableEpisodes}`, seasons, recent meaningful sessions,
  and latest activity;
- `WatchHistorySeason`: stable identity/order and the same aggregate plus only
  started/completed episodes and at most one `nextEpisode`;
- `WatchHistoryEpisode`: canonical resume/completion state and meaningful sessions;
- `WatchHistoryPreferences`: `youtubeHistoryEnabled` only for this MVP;
- `WatchHistoryDeletionRequest`: stable `clientMutationId`, current generation,
  deletion scope, and `requestedAt`;
- `WatchHistoryDeletionAck`: new generation for full clear, deleted scope, and
  canonical `deletedAt` boundary.

Use `z.strictObject`, `z.iso.datetime()`, finite non-negative playback numbers,
progress in `[0, 1]`, bounded identifiers, and HTTP(S)-only URLs. Export inferred
types and re-export the module from `packages/protocol/src/index.ts`.

- [ ] **Step 4: Run protocol compatibility checks**

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/protocol check
```

Expected: all v1 and v2 protocol tests pass.

- [ ] **Step 5: Commit the protocol boundary**

```bash
git add packages/protocol/src/watch-history.ts \
  packages/protocol/test/watch-history.test.ts packages/protocol/src/index.ts
git commit -m "feat(protocol): add watch history v2 contracts"
```

---

### Task 3: Additive Supabase Foundation And Transactional RPCs

**Files:**
- Create: `apps/web/supabase/migrations/20260813010000_watch_history_v2_foundation.sql`
- Create: `apps/web/lib/anidachi-auth/watch-history-sql.test.ts`
- Modify: `apps/web/lib/anidachi-auth/social.test.ts`

**Interfaces:**
- Produces: v2 storage, indexes, helper functions, transactional progress/catalog/
  preference/deletion RPCs, and an additive recent-person evidence reader.
- Consumes: authenticated `userId` supplied by server-only code and strict v2 JSON
  payloads already parsed by web routes.
- Leaves active: v1 tables, v1 functions, v1 routes, and checkpoint writes.

- [ ] **Step 1: Write failing SQL safety tests**

Create a Node test that reads the migration file and asserts:

- all six v2 tables are present;
- RLS is enabled on every new table;
- every RPC has `set search_path = ''`;
- no RPC grants execute to `public`, `anon`, or `authenticated`;
- only `service_role` receives execute;
- the cursor, episode lookup, receipt expiry, deletion, and recent-people indexes
  exist;
- the migration does not drop or truncate a v1 table;
- `watch_progress_checkpoints` appears only in the compatibility branch of the
  recent-people reader, not in a new write function.

Run:

```bash
pnpm --filter @anidachi/web test -- watch-history-sql.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 2: Add compact v2 tables**

Create these relations with explicit constraints:

1. `public.user_watch_settings`
   - `user_id` primary key;
   - `history_generation bigint not null default 1 check (> 0)`;
   - `youtube_history_enabled boolean not null default false`;
   - `updated_at`.
2. `public.watch_episode_progress`
   - primary key `(user_id, provider, title_key, episode_key)`;
   - title/item/content/series/season/episode display metadata;
   - canonical source/artwork URLs;
   - current/duration seconds and progress;
   - `observed_at`, `completed_at`, `latest_session_id`, `last_event_id`, `updated_at`;
   - `history_generation` for full-clear fencing.
3. `public.watch_catalog_snapshots`
   - primary key `(user_id, provider, title_key)`;
   - `payload jsonb`, completeness, locale context, schema version, content hash,
     `fetched_at`, `last_attempt_at`, `updated_at`;
   - JSON object and serialized-size constraints; max payload is 512 KiB.
4. `public.watch_progress_event_receipts`
   - primary key `(user_id, client_event_id)`;
   - provider/title/episode identity, bounded canonical `acknowledgement jsonb`,
     accepted time, and expiry time;
   - receipt retention is 14 days and expired receipts are removed opportunistically.
5. `public.watch_history_deletions`
   - primary key `(user_id, provider, title_key, scope_key)`;
   - `scope_key = '*'` for title deletion or the episode key for episode deletion;
   - deletion boundary, generation, and update time.
6. `public.recent_people_evidence`
   - primary key `(user_id, other_user_id, room_id)`;
   - last watched time;
   - bidirectional rows are written only after both users have progress in the same
     valid shared session.

Extend existing product-session storage additively:

- add nullable `client_session_key` and `source_generation` to `watch_sessions`;
- add unique partial indexes for `(room_id, source_generation)` shared sessions and
  `(host_user_id, client_session_key)` solo sessions;
- add cursor index on `user_tracked_titles`
  `(user_id, active, last_watched_at desc, provider, title_key)`.

- [ ] **Step 3: Implement `apply_watch_progress_v2`**

Create `public.apply_watch_progress_v2(p_user_id uuid, p_event jsonb)` as one
transactional `plpgsql` RPC. It must:

1. lock the user settings row with `pg_advisory_xact_lock` keyed by `p_user_id`;
2. create default settings if absent;
3. reject mismatched account generation;
4. return the stored canonical acknowledgement for a duplicate `clientEventId`;
5. validate provider/domain compatibility defensively;
6. verify shared room host/member proof when room data is present;
7. resolve one room/source-generation session or one solo client-session boundary;
8. upsert only `p_user_id` in `watch_session_participants`;
9. update `recent_people_evidence` only against other participants already present in
   the same shared session, writing both directions;
10. reject an event at or before a matching deletion boundary;
11. reject a stale observation older than the canonical accepted action;
12. accept a newer intentional backward seek without `max(progress)` logic;
13. preserve `completed_at` after `ended` or progress at least `0.9`;
14. update `user_tracked_titles` without plan capacity or retention logic;
15. insert the bounded receipt and return canonical episode state.

Clamp client timestamps to a documented server tolerance before conflict comparison;
do not allow a far-future client timestamp to permanently win. Use server receipt
time as the final deterministic tie breaker. Persist the exact acknowledgement in
the receipt before returning it so a retry within the 14-day idempotency window
cannot observe a different answer after a newer event has been accepted. After that
window, canonical stale-event and generation checks must still prevent regression.

- [ ] **Step 4: Implement catalog, preference, read-support, and deletion RPCs**

Add:

- `replace_watch_catalog_v2(p_user_id, p_snapshot)`:
  atomically replace a valid snapshot, never replace a prior complete snapshot with
  an empty/invalid/partial result, and return the accepted hash/state;
- `set_watch_preferences_v2(p_user_id, p_preferences)`:
  update only the YouTube-history flag and return canonical settings;
- `delete_watch_history_v2(p_user_id, p_request)`:
  episode delete removes the user's episode progress and participant associations
  for that episode but keeps catalog; title delete also removes tracked title and
  private catalog; full delete increments generation and removes all owned history;
  none of the scopes deletes another user's progress or recent-person evidence;
- `list_recent_people_evidence(p_viewer_user_id)` compatibility version:
  read new evidence first and union legacy checkpoint evidence while v1 is active.

Deletion must not delete a shared `watch_sessions` row while another participant
still references it. Remove orphan sessions only after participant/progress cleanup.
A genuine event observed after a title/episode deletion may clear the matching
tombstone and create fresh history; an older outbox retry may not.

- [ ] **Step 5: Apply SQL hardening**

For every new table/function:

- enable RLS and add no browser-facing policies;
- revoke table/function privileges from `public`, `anon`, and `authenticated`;
- grant only the server-required privileges to `service_role`;
- schema-qualify built-ins through `pg_catalog` where practical;
- use bounded text checks and provider enums/checks;
- add comments explaining receipt retention and deletion tombstones.

- [ ] **Step 6: Run web tests and migration dry-run**

```bash
pnpm --filter @anidachi/web test -- watch-history-sql.test.ts social.test.ts
pnpm --filter @anidachi/web check
supabase --workdir apps/web db push --dry-run
```

Expected: focused tests and typecheck pass; the dry-run lists only the additive
foundation migration. If the local Supabase CLI is unavailable, the PR must remain
draft until the pinned `db-staging.yml` dry-run succeeds.

- [ ] **Step 7: Commit the additive database foundation**

```bash
git add apps/web/supabase/migrations/20260813010000_watch_history_v2_foundation.sql \
  apps/web/lib/anidachi-auth/watch-history-sql.test.ts \
  apps/web/lib/anidachi-auth/social.test.ts
git commit -m "feat(web): add watch history v2 storage"
```

---

### Task 4: V2 Web Service, Routes, Pagination, And Server Validation

**Files:**
- Create: `apps/web/lib/anidachi-auth/watch-history.ts`
- Create: `apps/web/lib/anidachi-auth/watch-history-routes.ts`
- Create: `apps/web/lib/anidachi-auth/watch-history.test.ts`
- Create: `apps/web/app/api/watch-history/v2/route.ts`
- Create: `apps/web/app/api/watch-progress/v2/route.ts`
- Create: `apps/web/app/api/watch-catalog/v2/route.ts`
- Create: `apps/web/app/api/watch-preferences/v2/route.ts`
- Modify: `apps/web/lib/staging-access.ts`
- Modify: `apps/web/lib/staging-access.test.ts`
- Modify: `apps/web/app/api/watch-library/rooms/route.ts`

**Interfaces:**
- Produces: authenticated v2 GET/DELETE/PATCH/POST endpoints and shared read model.
- Consumes: v2 protocol schemas, Supabase service-role client, and v2 RPCs.
- Leaves active: `/api/watch-library` and `/api/watch-progress/reconcile` v1.

- [ ] **Step 1: Write failing service and route-policy tests**

Cover:

- strict request parse failures return the existing safe account API error shape;
- unsupported provider/source-domain pairs return `400`;
- route ownership always uses `session.userId`;
- Popup limits are clamped to 20 and website limits to 50;
- malformed/expired cursors return `400` rather than restarting silently;
- cursor ordering is deterministic for equal `lastWatchedAt` values;
- `complete`, `partial`, and `unavailable` aggregate builders produce honest labels;
- only released/available catalog episodes enter denominators;
- completion is `ended` or at least 90 percent;
- the next episode is the first released available episode after completed progress;
- YouTube items never expose season/catalog denominators;
- v2 routes are staging-password exempt in the same authenticated API manner as the
  existing watch routes, without weakening page protection.

- [ ] **Step 2: Implement route helpers and canonical URL validation**

`watch-history-routes.ts` must:

- parse every body/query with the shared schemas;
- normalize URL hostnames and ports before provider checks;
- allow only approved Crunchyroll and YouTube origins for this MVP;
- reject credentials, non-HTTP(S), fragments where canonical URLs disallow them,
  and unrelated domains;
- map known generation, deletion, room-proof, stale-event, and payload-size failures
  to stable HTTP codes without leaking SQL text.

- [ ] **Step 3: Implement the read model**

`listWatchHistoryV2` must query:

- `user_tracked_titles` using owner, active flag, cursor, limit-plus-one;
- canonical episode rows only for the returned titles;
- latest valid catalog snapshots for those titles;
- meaningful participant/session rows needed by Mine/Together history;
- exact total title count separately.

Build title/season aggregates in one pure helper. Use `provider:titleKey` as the
stable cursor tie breaker. Encode cursors as versioned base64url JSON and validate
them on read. Do not fetch all account history to paginate in memory.

The returned episode subset contains started/completed episodes and at most one
catalog-derived next episode per expanded season. Do not place the full catalog in
the response.

- [ ] **Step 4: Implement v2 route handlers**

- `GET /api/watch-history/v2?limit=...&cursor=...` -> paginated read;
- `DELETE /api/watch-history/v2` -> strict episode/title/all request and deletion ack;
- `POST /api/watch-progress/v2` -> one progress event and canonical ack;
- `PUT /api/watch-catalog/v2` -> one bounded snapshot and catalog ack;
- `GET/PATCH /api/watch-preferences/v2` -> account-wide YouTube setting.

Progress and catalog endpoints remain separate so provider-catalog failure cannot
block progress persistence. Do not return the full history response after each
progress event; return the compact acknowledgement only.

- [ ] **Step 5: Preserve room recreation compatibility**

Update `apps/web/app/api/watch-library/rooms/route.ts` and its service dependency so
the existing `create room from history session` action accepts meaningful v2 session
IDs while v1 IDs remain valid during rollout. Do not alter room entitlement or room
creation semantics.

- [ ] **Step 6: Run focused and plane checks**

```bash
pnpm --filter @anidachi/web test -- watch-history.test.ts staging-access.test.ts
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/protocol test
```

- [ ] **Step 7: Commit the additive v2 web API**

```bash
git add apps/web/lib/anidachi-auth/watch-history.ts \
  apps/web/lib/anidachi-auth/watch-history-routes.ts \
  apps/web/lib/anidachi-auth/watch-history.test.ts \
  apps/web/app/api/watch-history/v2/route.ts \
  apps/web/app/api/watch-progress/v2/route.ts \
  apps/web/app/api/watch-catalog/v2/route.ts \
  apps/web/app/api/watch-preferences/v2/route.ts \
  apps/web/lib/staging-access.ts apps/web/lib/staging-access.test.ts \
  apps/web/app/api/watch-library/rooms/route.ts
git commit -m "feat(web): expose watch history v2 API"
```

---

### Task 5: Account-Scoped Compact Outbox And V2 Extension Client

**Files:**
- Create: `apps/extension/src/watch-history-outbox.ts`
- Create: `apps/extension/test/watch-history-outbox.test.ts`
- Create: `apps/extension/src/watch-history-client.ts`
- Create: `apps/extension/test/watch-history-client.test.ts`
- Modify: `apps/extension/entrypoints/background.ts`
- Verify unchanged: `apps/extension/src/watch-library-client.ts`

**Interfaces:**
- Produces: account-owned coalescing outbox, v2 background bridge, request parsers,
  API calls, ack/deletion application, and v2 response cache.
- Consumes: shared v2 protocol and existing extension auth header helpers.
- Compatibility: v1 client remains available until Popup/website cutover.

- [ ] **Step 1: Write failing outbox state-machine tests**

Cover these exact transitions:

1. two non-terminal observations for one account/session/episode retain only the
   newest event and its stable ID;
2. different episodes and different accounts remain isolated;
3. a pending terminal event is retained when a later non-terminal rewatch state is
   observed, with the later state queued behind it;
4. duplicate enqueue with the same event ID is idempotent;
5. ack removes only the acknowledged event;
6. full deletion generation clears older entries;
7. episode/title deletion clears matching entries at or below the server boundary;
8. corrupt or wrong-owner storage is ignored;
9. retry order is terminal first, then newest non-terminal;
10. storage remains bounded to one terminal plus one latest state per key.

- [ ] **Step 2: Implement the storage envelope**

Use an account-specific WXT local key:

```txt
anidachi.watchHistoryOutbox.v2.<encodedUserId>
```

The envelope contains `version`, `userId`, `accountGeneration`, and a record keyed by
`provider:titleKey:episodeKey:clientSessionKey`. Each record contains at most
`pendingTerminal` and `latest`. Generate `clientEventId` once on enqueue and never
replace it during retry.

- [ ] **Step 3: Write failing bridge/client tests**

Cover strict message recognition, each v2 route, owner-bound cache parsing, HTTP
error mapping, preference default, catalog upload independence, and ignoring a late
response after account generation changes.

- [ ] **Step 4: Implement the v2 background client**

Add commands for:

- list history;
- publish progress;
- upload catalog;
- get/update preferences;
- delete episode/title/all history;
- create room from meaningful session.

All fetches run in the background service worker through the existing auth/header
pattern. Parse every success response before returning it to the content script or
Popup. Cache read responses under an account-specific v3 key; never migrate an
unvalidated v1/v2 cache into the v2 read model.

- [ ] **Step 5: Add deterministic outbox flushing**

The flush operation:

1. snapshots the active owner/generation;
2. publishes a bounded batch in deterministic order;
3. applies acknowledgements only while owner/generation still match;
4. stops on auth failure and retains entries;
5. uses bounded exponential backoff with jitter for transient failure;
6. retries on the next meaningful event, sign-in recovery, browser `online`, or
   explicit refresh; it does not add a frequent polling timer.

- [ ] **Step 6: Run focused extension checks**

```bash
pnpm --filter @anidachi/extension test -- \
  watch-history-outbox.test.ts watch-history-client.test.ts
pnpm --filter @anidachi/extension check
```

- [ ] **Step 7: Commit the v2 transport layer**

```bash
git add apps/extension/src/watch-history-outbox.ts \
  apps/extension/test/watch-history-outbox.test.ts \
  apps/extension/src/watch-history-client.ts \
  apps/extension/test/watch-history-client.test.ts \
  apps/extension/entrypoints/background.ts
git commit -m "feat(extension): add compact watch history outbox"
```

---

### Task 6: Provider-Owned History Policies And Crunchyroll Catalog Refresh

**Files:**
- Create: `apps/extension/src/source-adapters/core/history-policy.ts`
- Create: `apps/extension/src/source-adapters/crunchyroll/history-policy.ts`
- Create: `apps/extension/src/source-adapters/crunchyroll/catalog.ts`
- Create: `apps/extension/src/source-adapters/crunchyroll/catalog-refresh.ts`
- Create: `apps/extension/src/source-adapters/youtube/history-policy.ts`
- Create: `apps/extension/test/source-adapters/crunchyroll/catalog.test.ts`
- Create: `apps/extension/test/source-adapters/crunchyroll/catalog-refresh.test.ts`
- Create: `apps/extension/test/source-adapters/youtube/history-policy.test.ts`
- Modify: `apps/extension/src/source-adapters/core/types.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/definition.ts`
- Modify: `apps/extension/src/source-adapters/youtube/definition.ts`
- Modify: `apps/extension/src/source-adapters/generic/definition.ts`
- Modify: `apps/extension/src/watch-progress-entry.ts`
- Modify only if preflight requires main-world access:
  `apps/extension/src/source-adapters/crunchyroll/bridge-contract.ts`
- Modify only if preflight requires main-world access:
  `apps/extension/src/source-adapters/crunchyroll/bridge-client.ts`
- Modify only if preflight requires main-world access:
  `apps/extension/entrypoints/crunchyroll.content.ts`

**Interfaces:**
- Produces: provider-owned eligibility, observation, optional catalog collection,
  and refresh policy.
- Consumes: active `VideoAdapter`, provider fixture data, account preferences, and
  v2 history client.
- Boundary: generic/shared code contains no Crunchyroll selector, endpoint, locale,
  season, variant, or YouTube route rule.

- [ ] **Step 1: Write failing provider-boundary tests**

Extend `provider-boundaries.test.ts` so shared history files may import only the
core history interface, not concrete Crunchyroll/YouTube modules. Assert provider
definitions expose a `historyPolicy`, while generic policy returns no observation.

- [ ] **Step 2: Define the core policy**

Add:

```ts
export interface SourceHistoryPolicy {
  isEligible(context: SourceHistoryContext): boolean;
  capture(context: SourceHistoryContext): WatchProgressObservation | null;
  collectCatalog?: (
    context: SourceHistoryContext,
  ) => Promise<WatchCatalogSnapshotInput | null>;
}
```

Attach the policy to `SourceAdapterDefinition`. Change
`getWatchProgressEntryForAdapter` to resolve the active definition and delegate to
its policy. Remove the direct Crunchyroll/YouTube branching from that shared file.

- [ ] **Step 3: Implement and test Crunchyroll catalog parsing**

Parse only the observed fixture shape from Task 1. Tests must prove:

- stable multi-season ordering;
- released/available denominator filtering;
- trailer/preview/future exclusion;
- canonical variant collapse only from stable provider identity;
- ambiguous identity returns `partial`;
- an empty or malformed source returns no replacement snapshot;
- the new-release fixture increments available totals without altering episode IDs;
- payload limits are enforced before upload.

Do not retain the hardcoded watch-ID season map as the catalog denominator source.
It may remain temporarily as a display fallback for observed episode metadata until
the complete catalog path is proven.

- [ ] **Step 4: Implement the 24-hour refresh coordinator**

Store per-account/per-title state with:

- last successful complete refresh time;
- last attempt time;
- last content hash;
- failure count and bounded next eligible attempt;
- one in-memory promise for concurrent trigger deduplication.

Rules:

- skip another request for 24 hours after a successful complete snapshot;
- partial snapshots do not erase a prior complete snapshot or start the 24-hour
  complete freshness window;
- failures retry only on a later genuine interaction;
- backoff caps at one hour and resets after success;
- no interval, alarm, page-load crawl, or history-wide refresh is introduced;
- progress capture continues even when catalog collection/upload fails.

- [ ] **Step 5: Implement YouTube eligibility separately**

The YouTube policy returns an observation only when:

- the account preference is enabled;
- the URL is a canonical long-form watch URL;
- a stable video ID exists;
- the surface is not Shorts, preview, embed, thumbnail, reel, or unsupported page;
- valid duration and current time exist.

It always returns a movie-like item and never implements `collectCatalog`.

- [ ] **Step 6: Run provider tests**

```bash
pnpm --filter @anidachi/extension test -- \
  source-adapters/provider-boundaries.test.ts \
  source-adapters/crunchyroll/catalog.test.ts \
  source-adapters/crunchyroll/catalog-refresh.test.ts \
  source-adapters/youtube/history-policy.test.ts \
  watch-progress-entry.test.ts
pnpm --filter @anidachi/extension check
```

- [ ] **Step 7: Commit provider isolation**

```bash
git add apps/extension/src/source-adapters/core/history-policy.ts \
  apps/extension/src/source-adapters/core/types.ts \
  apps/extension/src/source-adapters/crunchyroll/history-policy.ts \
  apps/extension/src/source-adapters/crunchyroll/catalog.ts \
  apps/extension/src/source-adapters/crunchyroll/catalog-refresh.ts \
  apps/extension/src/source-adapters/crunchyroll/definition.ts \
  apps/extension/src/source-adapters/youtube/history-policy.ts \
  apps/extension/src/source-adapters/youtube/definition.ts \
  apps/extension/src/source-adapters/generic/definition.ts \
  apps/extension/test/source-adapters/provider-boundaries.test.ts \
  apps/extension/test/source-adapters/crunchyroll/catalog.test.ts \
  apps/extension/test/source-adapters/crunchyroll/catalog-refresh.test.ts \
  apps/extension/test/source-adapters/youtube/history-policy.test.ts \
  apps/extension/src/watch-progress-entry.ts \
  apps/extension/test/watch-progress-entry.test.ts
git commit -m "feat(extension): add provider history policies"
```

If Task 1 proves that a main-world bridge change is required, stage the three
conditional bridge/content files listed in this task after reviewing their diff.

---

### Task 7: Meaningful Progress Controller And Account Preference

**Files:**
- Create: `apps/extension/src/watch-history-session.ts`
- Create: `apps/extension/test/watch-history-session.test.ts`
- Create: `apps/extension/src/watch-history-controller.ts`
- Create: `apps/extension/test/watch-history-controller.test.ts`
- Create: `apps/extension/src/watch-history-preferences.ts`
- Create: `apps/extension/test/watch-history-preferences.test.ts`
- Modify: `apps/extension/src/overlay-app.tsx`
- Modify: `apps/extension/src/watch-progress.ts`
- Modify: `apps/extension/test/watch-progress.test.ts`

**Interfaces:**
- Produces: stable session boundaries, meaningful v2 event publication, local crash
  recovery, catalog-refresh triggers, and account-wide YouTube preference cache.
- Consumes: active provider definition/history policy, auth generation, room/source
  generation, outbox, and v2 client.

- [ ] **Step 1: Write session-boundary tests**

Cover:

- a solo client session survives page reload in the same tab through
  `sessionStorage`;
- source/episode change creates a new session key;
- room session identity is `(roomId, sourceGeneration)`;
- reconnect in the same room/source generation does not create a duplicate session;
- leaving/ending a room terminates only that boundary;
- sign-out or account switch clears the active owner view immediately.

- [ ] **Step 2: Write controller event tests with fake timers**

Cover:

- local display/cache state may update frequently, but server publication occurs
  only on a 60-second heartbeat, pause, completed seek, source change, pagehide,
  room leave/end, and ended;
- heartbeat is suppressed before valid duration/current time;
- seek emits the settled target once;
- terminal completion remains queued until ack;
- offline publication stays local and flushes after `online`;
- a catalog trigger is asynchronous and does not block progress enqueue;
- catalog refresh is triggered on eligible title interaction, not every heartbeat;
- no history is captured while signed out;
- YouTube is suppressed by default and enabled after canonical preference load.

- [ ] **Step 3: Implement account-wide preference caching**

`watch-history-preferences.ts` uses an account-scoped local cache, parses the v2
response, defaults `youtubeHistoryEnabled` to `false`, and ignores late responses
after an account generation change. Preference mutations persist through the web
endpoint before updating canonical UI state; transient failure keeps the prior
setting and exposes a retryable error.

- [ ] **Step 4: Implement the controller**

Move the current history timing logic out of the large `overlay-app.tsx` effect into
one controller with injected dependencies. Keep the existing one-second current
resource display refresh and local crash-recovery cache if needed, but replace the
five-second server checkpoint model with the meaningful v2 publication schedule.

The controller must not change adapter playback subscriptions used by room sync.
It observes them independently and disposes all listeners/timers on adapter change.

- [ ] **Step 5: Wire room/source boundaries narrowly**

Pass current `roomId` and `sourceGeneration` from `overlay-app.tsx`. On source
change, room leave, room end, adapter detach, pagehide, and ended, enqueue the
corresponding event before disposing the old boundary. Never publish another
participant's progress; `watchedWithCount` is display metadata only and is not
authorization proof.

- [ ] **Step 6: Run focused and regression tests**

```bash
pnpm --filter @anidachi/extension test -- \
  watch-history-session.test.ts watch-history-controller.test.ts \
  watch-history-preferences.test.ts watch-progress.test.ts \
  source-adapters/youtube/sync-integration.test.ts \
  source-adapters/content-lifecycle.test.tsx
pnpm --filter @anidachi/extension check
```

- [ ] **Step 7: Commit runtime publication**

```bash
git add apps/extension/src/watch-history-session.ts \
  apps/extension/test/watch-history-session.test.ts \
  apps/extension/src/watch-history-controller.ts \
  apps/extension/test/watch-history-controller.test.ts \
  apps/extension/src/watch-history-preferences.ts \
  apps/extension/test/watch-history-preferences.test.ts \
  apps/extension/src/overlay-app.tsx apps/extension/src/watch-progress.ts \
  apps/extension/test/watch-progress.test.ts
git commit -m "feat(extension): publish meaningful watch progress"
```

---

### Task 8: Move The Popup To The Canonical V2 Read Model

**Execution gate:** Do not start this task until the current Popup visual WIP is
committed or merged. Rebase the clean history branch onto the accepted Popup commit,
resolve conflicts by preserving accepted visuals, then rerun Popup tests before
adding v2 behavior.

**Files:**
- Create: `apps/extension/src/popup-watch-history-model.ts`
- Create: `apps/extension/test/popup-watch-history-model.test.ts`
- Modify: `apps/extension/src/popup-app.tsx`
- Modify: `apps/extension/src/popup-styles.ts`
- Modify: `apps/extension/test/popup-people-panel.test.tsx`
- Modify: `apps/extension/test/watch-library-client.test.ts`

**Interfaces:**
- Produces: bounded v2 Popup history, exact/observed labels, next episode, account
  preference control, and episode/title/all deletion actions.
- Consumes: `WatchHistoryResponse`, v2 client/cache, and existing account generation
  guard.
- Preserves: accepted Popup visual language and Mine/Together interaction.

- [ ] **Step 1: Rebase only after checkpointing current UI**

```bash
git fetch origin
git rebase origin/staging
git status --short --branch
pnpm --filter @anidachi/extension test -- popup-people-panel.test.tsx
```

Expected: clean branch and accepted existing Popup tests passing before v2 edits.

- [ ] **Step 2: Write pure model tests**

Cover:

- provider/title/season/episode grouping remains stable;
- complete catalog shows `completed / available` for title and season;
- partial/unavailable catalog shows `N watched` without a false denominator;
- expanded season contains started/completed episodes plus at most one next episode;
- a new release increases the denominator without clearing completed episodes;
- YouTube remains unseasoned;
- Mine/Together filtering uses meaningful session participants;
- account switch and sign-out expose no previous account data;
- server cursor and total title count are preserved without assuming the first page is
  the complete history.

- [ ] **Step 3: Replace Popup v1 reads with v2 reads**

On signed-in load:

1. show only owner-matching validated v2 cache;
2. request the first 20 recent titles;
3. merge pending local outbox state only as a temporary optimistic overlay;
4. replace it with canonical acknowledgements/read responses;
5. ignore late previous-owner generations;
6. keep explicit refresh as the recovery action.

Remove plan-based title counts/retention labels from the Watch area. Do not remove
room/group plan UI outside history.

- [ ] **Step 4: Add bounded history controls**

Add:

- episode deletion in the expanded episode action menu;
- title deletion in the title action menu;
- full-history deletion under the existing settings/history action;
- YouTube history toggle under platform/history settings, default off;
- honest loading, empty, offline-cache, mutation-pending, and retry states.

Each destructive action requires an explicit confirmation, sends a stable mutation
ID, waits for server acknowledgement, clears matching cache/outbox state through the
returned deletion boundary, and cannot affect friends/groups/inbox/recent people.

- [ ] **Step 5: Preserve current visual hierarchy**

Use existing theme tokens and accepted Popup spacing. Do not add nested cards, a full
unwatched episode browser, plan upsells, release notifications, or a second history
navigation layer in this task.

- [ ] **Step 6: Run Popup and extension verification**

```bash
pnpm --filter @anidachi/extension test -- \
  popup-watch-history-model.test.ts popup-people-panel.test.tsx \
  watch-history-client.test.ts watch-library-client.test.ts
pnpm --filter @anidachi/extension check
pnpm build:extension:staging
pnpm validate:extension:staging
```

- [ ] **Step 7: Commit Popup v2 integration**

```bash
git add apps/extension/src/popup-watch-history-model.ts \
  apps/extension/test/popup-watch-history-model.test.ts \
  apps/extension/src/popup-app.tsx apps/extension/src/popup-styles.ts \
  apps/extension/test/popup-people-panel.test.tsx \
  apps/extension/test/watch-library-client.test.ts
git commit -m "feat(extension): show canonical watch history"
```

---

### Task 9: Move The Website To The Same V2 Values

**Files:**
- Create: `apps/web/app/account/watch-library/watch-history-model.ts`
- Create: `apps/web/app/account/watch-library/watch-history-model.test.ts`
- Modify: `apps/web/app/account/watch-library/page.tsx`
- Modify: `apps/web/app/account/watch-library/watch-library-client.tsx`
- Modify: `apps/web/app/account/watch-library/loading.tsx`

**Interfaces:**
- Produces: cursor-paginated website history, identical aggregates, and matching
  deletion/preference controls.
- Consumes: the same v2 protocol and routes as the Popup.

- [ ] **Step 1: Write shared-value and pagination tests**

Use the same canonical fixture imported by the Popup model test where practical.
Assert that Popup and website selectors produce the same title/season counts,
completion state, resume values, next episode, catalog state, and Mine/Together
classification. Cover cursor append without duplicates and stable ordering for equal
timestamps.

- [ ] **Step 2: Switch the server page to v2**

Load the first 25 titles through `listWatchHistoryV2`. Pass the validated response to
the client. Remove v1 plan-limit and retention cards. Keep authentication redirect
and account layout behavior unchanged.

- [ ] **Step 3: Add cursor pagination**

The client requests the returned `nextCursor`, appends by stable ID, and prevents
concurrent duplicate loads. A refresh replaces the first page; it does not merge
stale rows from an earlier account generation.

- [ ] **Step 4: Add matching deletion and preference controls**

Use the same v2 deletion/preference requests and copy semantics as the Popup. The
website may show fuller season drilldown, but must not calculate a different
denominator or maintain a separate canonical state.

- [ ] **Step 5: Run website checks**

```bash
pnpm --filter @anidachi/web test -- watch-history-model.test.ts watch-history.test.ts
pnpm --filter @anidachi/web check
```

- [ ] **Step 6: Commit website v2 integration**

```bash
git add apps/web/app/account/watch-library/watch-history-model.ts \
  apps/web/app/account/watch-library/watch-history-model.test.ts \
  apps/web/app/account/watch-library/page.tsx \
  apps/web/app/account/watch-library/watch-library-client.tsx \
  apps/web/app/account/watch-library/loading.tsx
git commit -m "feat(web): use canonical watch history v2"
```

---

### Task 10: Automated Gates, Staging Deployment, And Real Acceptance

**Files:**
- Create: `scripts/smoke-watch-history-staging.mjs`
- Modify: `package.json`
- Modify: `docs/staging-acceptance-checklist.md`
- Modify: `docs/current-development-state.md`
- Modify: `docs/superpowers/specs/2026-08-13-watch-history-catalog-progress-design.md`

**Interfaces:**
- Produces: repeatable API smoke coverage and recorded staging evidence.
- Consumes: staging web deployment, staging Supabase migration, and actual staging
  extension artifact.

- [ ] **Step 1: Add an authenticated staging smoke script**

Add `pnpm smoke:watch-history:staging`. The script reads
`ANIDACHI_STAGING_BASE_URL`, `ANIDACHI_STAGING_USER_A_TOKEN`, and
`ANIDACHI_STAGING_USER_B_TOKEN`; it accepts only a non-production staging origin,
never prints either token, and exercises only synthetic fixture identities:

1. preferences default off and update on;
2. solo progress insert and duplicate event retry;
3. intentional backward seek;
4. terminal completion persistence;
5. catalog complete upload and exact aggregate read;
6. stale event rejection;
7. two-account shared session ownership;
8. episode/title/all deletion boundaries;
9. cursor pagination with equal timestamps;
10. cleanup of all synthetic history created by the script.

The script must refuse production origins, redact tokens, and use a unique run ID.

- [ ] **Step 2: Run repository gates before opening the PR**

```bash
git diff --check
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm dev:check
pnpm check
pnpm test
pnpm graph:update
```

Expected: all gates pass. Commit only approved Graphify artifacts if the project
policy and PR scope call for them; do not include local graph exports or costs.

- [ ] **Step 3: Open the additive PR into staging**

The PR description records:

- affected planes: protocol, web, Supabase, extension;
- Graphify query used;
- additive migration and rollback path;
- no plan-based history limits;
- no background provider polling;
- v1 routes/tables still intact;
- exact staging acceptance scenarios below.

Wait for the pinned Supabase dry-run/push, web deployment, extension CI, and review
checks. Do not test the extension against v2 before the foundation migration and
web routes are deployed successfully.

- [ ] **Step 4: Build and refresh canonical staging artifacts**

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
```

Copy the validated artifact to the two canonical test folders using the existing
build output; do not manually assemble files:

```bash
rsync -a --delete anidachi-extension-staging/ \
  /Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging/
rsync -a --delete anidachi-extension-staging/ \
  /Users/vladyslavhulyi/anidachi-extension-staging2/
shasum anidachi-extension-staging/manifest.json \
  /Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging/manifest.json \
  /Users/vladyslavhulyi/anidachi-extension-staging2/manifest.json
```

Expected: the three manifest hashes and `version_name` values match.

- [ ] **Step 5: Run realistic acceptance**

With authenticated staging accounts and the actual loaded extension, verify:

- Crunchyroll multi-season title: partial progress, pause, reload, resume, backward
  seek, completion, and source switch;
- complete catalog counts at title/season level and observed-only labels when the
  fixture/source is partial;
- new episode refresh after the 24-hour guard is simulated through test state;
- second browser/device receives the same canonical values;
- two-person room gives each account only its own progress but shared session people;
- offline progress survives reload and converges after reconnect;
- episode/title/all deletion cannot be resurrected by a delayed outbox event;
- history deletion leaves friends, groups, inbox, and recent people intact;
- YouTube is off by default, can be enabled globally, and excludes Shorts;
- Popup and website show equal progress/counts for the same records;
- room sync, provider switching, overlay, P2P media, and invites are unchanged.

Run the staging API smoke after manual auth setup:

```bash
pnpm smoke:watch-history:staging
```

- [ ] **Step 6: Record evidence and commit verification tooling/docs**

Update the acceptance checklist and current state with exact artifact/deployment
identities and any remaining risk. Mark the design `Implemented in staging` only
after all required scenarios pass.

```bash
git add scripts/smoke-watch-history-staging.mjs package.json \
  docs/staging-acceptance-checklist.md docs/current-development-state.md \
  docs/superpowers/specs/2026-08-13-watch-history-catalog-progress-design.md \
  graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json
git commit -m "test(history): add staging acceptance coverage"
```

Stage Graphify files only when they were intentionally refreshed and changed. If
they did not change or are excluded by policy, omit them from the command.

---

### Task 11: Separate V1 Cutover And Checkpoint Cleanup

**Prerequisite:** Task 10 acceptance is complete, no active staging consumer reads
v1, and the product has not shipped a public extension version that still depends on
the v1 routes. If a public v1 client exists, keep compatibility until the minimum
supported extension version has advanced; do not perform this task early.

**Files:**
- Create: `apps/web/supabase/migrations/20260813020000_watch_history_v2_recent_people_cutover.sql`
- Create only after a second proof gate:
  `apps/web/supabase/migrations/20260813030000_watch_history_v1_cleanup.sql`
- Modify: `apps/web/lib/anidachi-auth/social.test.ts`
- Modify: `apps/web/lib/anidachi-auth/plan-entitlements.ts`
- Modify: `apps/web/lib/anidachi-auth/plan-entitlements.test.ts`
- Modify: `packages/protocol/src/account.ts`
- Modify: `packages/protocol/test/account.test.ts`
- Delete or reduce after consumer audit: `apps/web/lib/anidachi-auth/watch-library.ts`
- Delete after consumer audit: `apps/web/app/api/watch-progress/reconcile/route.ts`
- Delete after consumer audit: `apps/web/app/api/watch-library/route.ts`
- Delete or reduce after consumer audit: `apps/extension/src/watch-library-client.ts`
- Modify: `apps/extension/src/popup-app.tsx`
- Modify: `apps/web/app/account/watch-library/watch-library-client.tsx`
- Modify: `docs/current-development-state.md`

**Interfaces:**
- Produces: v2-only history/runtime and checkpoint-independent `Recent people`.
- Removes: v1 checkpoint writer/read path and history-specific plan entitlement
  fields.

- [ ] **Step 1: Prove no active v1 consumer remains**

Run:

```bash
rg -n "watch-progress/reconcile|/api/watch-library|WatchLibraryResponseSchema|watch_progress_checkpoints|historyRetentionDays|maxActiveTrackedTitles" \
  apps packages scripts docs --glob '!docs/superpowers/plans/**'
```

Classify every match. The only permitted checkpoint match before migration 2 is the
compatibility branch in `list_recent_people_evidence`. No Popup, website, content
script, background handler, or staging smoke may call a v1 history endpoint.

- [ ] **Step 2: Cut `Recent people` over to independent evidence**

Create the recent-people cutover migration that replaces
`list_recent_people_evidence` with a query over `recent_people_evidence` only while
preserving hidden-person and friendship exclusion semantics. Keep
`watch_progress_checkpoints` physically present in this migration.

Run web/social tests, Supabase dry-run, deploy to staging, and verify recent people
before and after deleting all history for one participant.

- [ ] **Step 3: Remove v1 runtime and plan-history restrictions**

After the recent-people cutover is proven:

- remove v1 Popup/website/background calls and obsolete cache/sync ledger paths;
- remove history-specific `maxActiveTrackedTitles` and `historyRetentionDays` from
  `PlanEntitlements.account`, leaving `maxOwnedGroups` and unrelated plan controls;
- remove UI copy and tests that expose plan-based history limits;
- retain only room recreation helpers still used by v2, moving them to the v2 module
  before deleting the old module;
- remove the old plan-limit archiving and retention cutoff behavior.

- [ ] **Step 4: Create the final cleanup migration**

Only after a second static audit and staging runtime proof, create
`20260813030000_watch_history_v1_cleanup.sql` to:

- drop `watch_progress_checkpoints` and its indexes;
- remove columns or functions used only by checkpoint reconciliation;
- keep `watch_sessions`, `watch_session_participants`, `user_tracked_titles`, v2
  progress/catalog/settings/deletion/receipt/evidence tables;
- keep meaningful shared-session history and room recreation working.

Do not drop product session rows merely because the checkpoint table is removed.

- [ ] **Step 5: Run full verification and open a separate cutover PR**

```bash
git diff --check
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/extension test
pnpm dev:check
pnpm check
pnpm test
supabase --workdir apps/web db push --dry-run
pnpm graph:update
```

Open this as a separate PR into `staging` with the accepted additive PR and staging
evidence linked. Rollback before the cleanup migration is an application rollback to
v1; after the cleanup migration, rollback remains v2-only and must not assume
checkpoint data can be reconstructed.

- [ ] **Step 6: Commit cutover in reviewable blocks**

```bash
git add apps/web/supabase/migrations/20260813020000_watch_history_v2_recent_people_cutover.sql \
  apps/web/lib/anidachi-auth/social.test.ts
git commit -m "refactor(social): decouple recent people from history"

git add -A -- apps/web/lib/anidachi-auth/plan-entitlements.ts \
  apps/web/lib/anidachi-auth/plan-entitlements.test.ts \
  apps/web/lib/anidachi-auth/watch-library.ts \
  apps/web/lib/anidachi-auth/watch-library-routes.ts \
  apps/web/app/api/watch-progress/reconcile/route.ts \
  apps/web/app/api/watch-library/route.ts \
  apps/web/app/api/watch-library/rooms/route.ts \
  apps/extension/src/watch-library-client.ts \
  apps/extension/test/watch-library-client.test.ts \
  apps/extension/src/popup-app.tsx \
  apps/web/app/account/watch-library/watch-library-client.tsx \
  packages/protocol/src/account.ts packages/protocol/test/account.test.ts \
  docs/current-development-state.md
git commit -m "refactor(history): switch consumers to v2"

git add apps/web/supabase/migrations/20260813030000_watch_history_v1_cleanup.sql
git commit -m "refactor(db): remove watch progress checkpoints"
```

---

## Final Acceptance Matrix

The implementation is complete only when every row is proven:

| Area | Required proof |
| --- | --- |
| Canonical state | Popup and website return equal values from v2 for overlapping records |
| Episode resume | Reload and second device resume at the latest accepted real action |
| Backward seek | Newer intentional backward seek wins over older higher progress |
| Completion | `ended` or >=90% persists through rewatch and catalog refresh |
| Catalog honesty | Exact counts only for complete snapshots; partial/unavailable never show false totals |
| New release | Available denominator grows without erasing completed states |
| Offline | Compact outbox converges after reconnect without duplicate sessions or writes |
| Idempotency | Same `clientEventId` returns the same canonical acknowledgement |
| Shared rooms | Each participant writes only self; shared session/evidence appears only after valid participation |
| Deletion | Episode/title/all boundaries cannot be reversed by stale outbox entries |
| Social isolation | History deletion leaves friends, groups, inbox, and recent people intact |
| YouTube | Off by default, account-wide opt-in, long-form only, no artificial seasons |
| Pricing | No history limit or retention difference between Free, Plus, and Pro |
| Provider isolation | Shared files contain no provider selectors/endpoints/season rules |
| Resource use | No catalog polling, one complete refresh per title per 24 hours, bounded snapshots/receipts/outbox |
| Regression | Room sync, source switching, overlay, P2P media, and invites remain unchanged |
| Release | DB staging workflow, CI, staging artifact validation, API smoke, and real two-account acceptance pass |

## Rollback Rules

- Before client cutover, roll back application code to v1; additive v2 tables may
  remain unused.
- During staging writer rollout, disable the v2 extension build by loading the prior
  validated staging artifact; do not delete v2 data to roll back.
- Do not replace a last-known complete catalog with partial/failed data during
  rollback or forward operation.
- Do not run the cleanup migration until v1 consumers and checkpoint-dependent
  social reads are proven absent.
- If cleanup has run, roll forward on v2. Do not recreate an append-only checkpoint
  journal as an emergency compatibility workaround.

## Out Of Scope Follow-Ups

- scheduled release monitoring and release notifications;
- external anime metadata providers;
- ratings, dropped-show state, manual season hiding, and rewatch journals;
- full unwatched catalog browsing in the Popup;
- provider catalog support for Netflix/Amazon before their adapter preflight;
- analytics dashboards beyond privacy-safe operational failure counters;
- subscription differentiation based on history capacity or retention.
