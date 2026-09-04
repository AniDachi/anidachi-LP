# Watch History Crunchyroll Catalog Progress Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` task by task,
> `superpowers:test-driven-development` for behavior changes, and
> `superpowers:verification-before-completion` for completion claims.
> Steps use checkbox (`- [ ]`) syntax.

**Status:** Approved for local implementation 2026-09-05. The user authorized
careful execution after removing preservation of old test history as a requirement.
Local implementation is in progress; no remote database cutover is authorized.

**Goal:** Store new history by stable provider identities and show accurate
server-owned series progress with provider-localized labels in Popup and website.

**Architecture:** One canonical progress row per account/logical episode from the
first new write. The latest actual watch variant is resume metadata. Reuse the
existing history auth, bounded outbox, receipts, deletion fences, and indexed
summaries with canonical keys. Add a bounded catalog snapshot and derived variant
lookup. Transition the test environment once instead of reconciling legacy history
or maintaining parallel read models.

**Tech Stack:** Existing TypeScript, Zod 4, WXT/Chrome MV3, React, Next.js,
Supabase/Postgres, Vitest, pgTAP, Node 22.23.1, pnpm 11.2.2. No new runtime service,
external anime database, crawler, or dependency upgrade.

**Spec:** `docs/superpowers/specs/2026-08-13-watch-history-catalog-progress-design.md`.
The user's 2026-09-05 clean-start amendment below supersedes that spec's
old-history-preservation requirements. The remaining catalog correctness and
ownership rules continue to apply; update the spec before implementing.

## User Decision And Execution Boundary

The user states there are no real users and that old test history has no product
value. No import, backfill, reconciliation, or old-history rendering is required.
That removes a transition constraint, not the need to protect newly recorded data.

- Preserve the uncommitted Popup design on `codex/watch-drawer-design`:
  `apps/extension/src/popup-styles.ts`,
  `apps/extension/src/popup-watch-history.tsx`,
  `apps/extension/src/popup-watch-history-styles.ts`,
  `apps/extension/test/extension-theme.test.ts`, and
  `apps/extension/test/popup-watch-history.test.tsx`.
- Implement after plan approval. Routine WIP isolation does not require another
  product choice unless there is an actual conflict. Preserve edits without reset,
  stash, or implicit discard.
- The future cutover may clear **test Watch History**: progress, historical viewing
  sessions/memberships, derived history summaries, receipts/fences, and obsolete
  history checkpoints. Invalidate old history caches/outbox partitions as well.
- Preserve accounts/auth, subscriptions, friends/groups, invitations, rooms and
  live participants, Recent People evidence, camera/microphone/UI settings, and
  history preferences including YouTube tracking consent.
- Preserve settings rows and monotonic server order; advance history generation.
  Version rejection also covers accounts that had no settings row at cutover.
- Do not reset an entire remote database, browser profile, or all extension storage.
  Do not delete/rewrite applied migration files.
- Current work remains local. Push, deployment, test-folder synchronization, and
  main promotion require their existing separately authorized release workflow.

## What Changes From The First Proposal

| Previous proposal | Revised decision |
| --- | --- |
| Raw progress keys plus nullable canonical mappings | Canonical keys directly in new progress. |
| Reconcile old slugs and raw rows | One-time test-history reset, no backfill. |
| Parallel raw and logical title/session summaries | Adapt the existing summaries; one active read model. |
| Compatible old progress writers/readers | Version the history contract and require the matching client. |
| Copy raw variants into deletion tombstones | Fence canonical title/episode identity directly. |
| Preserve independent old dub resume rows | One completion and the latest actually watched variant/position. |

Provider variant mappings remain necessary for correct audio-version identity and
next-episode URL selection. They are provider data, not legacy migration machinery.

## Evidence Used For The Design

### Current AniDachi baseline

- `packages/protocol/src/watch-history.ts` already contains a dormant catalog
  input and a read model capable of `catalogState: "complete"`, exact title and
  season aggregates, and a canonical next episode. No runtime currently uploads a
  catalog, and the web service currently returns `unavailable` with null totals.
- Crunchyroll progress currently records only the active watch page. Its
  `episodeKey` is the `/watch/<guid>` content ID, while its `titleKey` can fall
  back to a localized slug/title even when a stable series ID was discovered.
- `watch_episode_progress` is keyed by raw
  `(user_id, provider, title_key, episode_key)`. `watch_sessions` and their
  participant/session relationships use the same raw viewing identity.
- Popup and website already consume the same bounded Watch History v2 response,
  but some optimistic delete code locally recalculates aggregate fields. That is
  safe only while exact server aggregates do not exist and must be corrected
  before enabling catalogs.
- Existing reads are intentionally bounded to eight observed episodes per visible
  title; the website defaults to 50 titles and the server/Popup maximum is 100.
  A full catalog must never be parsed for every visible title during an ordinary
  read.

### Current Crunchyroll behavior

The 2026-09-05 sanitized live preflight found the current web client using:

```txt
/content/v2/cms/objects/{watchId}
/content/v2/cms/series/{seriesId}/seasons
/content/v2/cms/seasons/{seasonId}/episodes
```

This is empirical adapter evidence, not a public supported Crunchyroll API
contract. Endpoint paths and raw response shapes must remain private to the
Crunchyroll adapter and be protected by sanitized fixtures plus a live staging
gate.

Observed properties that the implementation may rely on only after fixture
validation:

- series `id` is the stable title identity;
- season `identifier` remains stable across tested display/audio locales even
  when the returned season `id` changes;
- episode `identifier` represents the logical episode;
- `versions[]` maps language/audio watch GUIDs to that logical episode;
- provider order is authoritative; episode numbers may be fractional, zero, or
  absent and are display metadata rather than keys;
- legacy dubbed seasons can remain distinct provider seasons and must not be
  merged by matching titles or numbers;
- localized labels change with `locale`, while stable identifiers do not;
- returned membership is region-sensitive, and availability/release fields need
  field-specific parsing rather than one truthy check;
- a current regional One Piece response was already close to the old 500-episode
  limit, so that dormant limit cannot support the intended feature safely.

Official Crunchyroll help also states that language availability can differ by
season and episode, display/audio/subtitle languages are distinct settings, some
legacy dubs still appear as separate seasons, and catalog availability varies by
region. See:

- <https://help.crunchyroll.com/hc/en-us/articles/22747847738772-What-languages-are-available-for-shows>
- <https://help.crunchyroll.com/hc/fr/articles/20762279453076-Comment-changer-la-langue-de-l-audio>
- <https://help.crunchyroll.com/hc/en-us/articles/22934571555476-How-do-I-change-the-subtitle-language>
- <https://help.crunchyroll.com/hc/en-us/articles/43269213267092-Why-can-t-I-watch-certain-shows-in-my-region>
- <https://help.crunchyroll.com/hc/en-us/articles/31320247305748-How-do-I-mark-episodes-seasons-and-shows-as-watched>

### Database and browser boundaries

- Supabase remains the durable authority. New functions use `security invoker`
  by default, an empty `search_path`, schema-qualified objects, revoked default
  execution, and service-role-only grants, matching current Supabase guidance:
  <https://supabase.com/docs/guides/database/functions> and
  <https://supabase.com/docs/guides/database/postgres/row-level-security>.
- Chrome `storage.local` is quota-bound, so the extension stores only compact
  per-account freshness/ack metadata, never the full catalog:
  <https://developer.chrome.com/docs/extensions/reference/api/storage>.
- Provider fetches that need the page's Crunchyroll context remain in the MAIN
  world bridge; the isolated extension world receives only sanitized validated
  results:
  <https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts>.

## Product And Data Definitions

These definitions are normative for implementation and tests.

### Logical identity

```txt
catalog title key   = crunchyroll:series:<series id>
catalog season key  = crunchyroll:season:<season identifier>
catalog episode key = crunchyroll:episode:<episode identifier>
raw content key     = the current /watch/<guid> content ID
```

- Locale, translated titles, audio language, subtitle language, season number,
  episode number, URL slug, and artwork are never identity.
- A canonical episode owns one or more `watchVariants`. Each variant contains its
  raw content ID, audio locale when known, original flag, provider order, and a
  validated Crunchyroll watch URL.
- A raw content ID may map to exactly one canonical episode across all active
  snapshots for the same account, generation, and provider. Any duplicate or
  conflicting alias inside the upload or against another title makes the new
  collection partial.
- At most one variant may be marked original. Absence of an original variant is
  valid; AniDachi must not manufacture one.
- Distinct provider season identifiers remain distinct even when labels, episode
  numbers, or audio metadata look equivalent.
- New progress stores canonical title/season/episode keys directly. There is one
  progress row per account/logical episode. Its latest raw watch ID, audio locale,
  URL, position, and duration are playback metadata; completion is sticky.
- Current-object provider metadata can establish identity independently of the full
  catalog. A full catalog is required for exact totals, not ordinary progress.
- Missing identity is temporarily pending in the existing bounded account outbox;
  it is never replaced by a guessed slug, translated title, or episode number.
- Every canonical key must be the exact prefixed derivation shown above from its
  corresponding provider identifier. Uniqueness alone is insufficient.
- Normalize every variant URL with the shared `canonicalizeRoomSourceUrl` helper.
  Require provider `crunchyroll`, canonical URL exactly
  `https://www.crunchyroll.com/watch/<providerContentId>`, and fingerprint exactly
  `crunchyroll|watch/<providerContentId>`. Persist only that canonical episode URL;
  drop locale, query, fragment, and mutable slug.

### Localization

- Capture `document.documentElement.lang` at the interaction that starts a
  collection, with `navigator.language` only as a fallback. Pass that immutable
  value through the asynchronous job so an SPA navigation cannot change it.
- Query Crunchyroll using that display locale and persist the labels actually
  returned. Provider fallback is accepted; AniDachi does not machine-translate.
- Capture current audio and subtitle context separately. Preferred audio affects
  variant selection but never changes canonical identity.
- A successful complete snapshot for the current context supplies title, season,
  and episode labels. Those catalog labels take precedence over later raw progress
  labels. Without an active complete snapshot, the current observed labels remain
  the honest fallback.
- Treat regional availability and presentation separately. A region change bypasses
  freshness and suppresses old exact totals after server `begin`, because the
  denominator may differ. A display-locale change also bypasses freshness, but the
  last successful same-region bundle remains the exact/display fallback until a
  new localized complete bundle commits. If that refresh fails, the last successful
  locale remains displayed rather than exposing a half-localized catalog.
- Audio/subtitle choices never change canonical identity. Because a complete
  snapshot contains provider-declared variants, a known audio change only updates
  next/resume variant preference. It triggers a catalog refresh only when the new
  raw watch ID is absent from the accepted aliases. Subtitle change alone does not
  crawl the catalog.
- After stable series identity and region are discovered, a tiny server `begin`
  operation allocates the next title-scoped catalog revision before required full
  traversal. Across tabs/devices, the latest server-accepted revision is the active
  context for that account, generation, provider, and canonical title. A slower
  result for an older revision is superseded and cannot replace labels, totals,
  mappings, projection, or local freshness.

### Region and denominator

- Region is an ISO 3166-1 alpha-2 code obtained from provider response context;
  it is never inferred from UI language or IP heuristics.
- A known region is required for a `complete` snapshot. If the provider does not
  expose it reliably, collection remains `partial` and the UI stays observed-only.
- The denominator means **released logical episodes currently listed as available
  in the captured Crunchyroll region/context**. It does not claim the user's
  subscription entitlement, because the current catalog token does not prove an
  individual plan.
- Store separate `availabilityContextHash` (region plus catalog/classifier schema)
  and `presentationContextHash` (requested display locale). Audio/subtitle context
  remains captured metadata and variant preference, not title identity.
- `premium_only` by itself does not remove an episode from this regional catalog
  denominator. Clips, trailers, previews, future placeholders, and entries with a
  proven finite expired availability end do not enter it.
- The classifier returns one of `available`, `known-unavailable`,
  `excluded-non-episode`, or `unknown`. Any `unknown` result makes the whole
  snapshot partial; it is never silently omitted from an exact denominator.
- Provider sentinel dates such as year 9998 are interpreted only in the specific
  fields proven by fixtures. An unknown date form makes the snapshot partial.
- A complete nonempty logical catalog may legitimately have zero currently
  available episodes. Its aggregate is `0 / 0`, progress `0`, no next episode,
  and the UI text is `Not currently available` with no progress bar.
- The normalized snapshot retains every classified logical episode.
  `available: false` represents known unavailable or not-yet-released inventory
  and is excluded from the denominator, not the snapshot. Only proven
  `excluded-non-episode` records are omitted. Empty seasons after that exclusion
  are omitted from the normalized snapshot.
- A totally empty provider response is not enough evidence for completeness.
  Until an explicit provider total-zero contract is proven in fixtures, it is
  partial/unavailable rather than a complete empty catalog.

### Completeness

A snapshot is `complete` only when all of the following are true:

1. Stable series ID and known region are present.
2. The entire season list succeeds.
3. Every returned season's episode list succeeds.
4. For every response that declares a total, raw `data.length` equals that total
   before identifier/version collapse or availability filtering. A canonical
   logical count is never compared with a raw provider-row total.
5. The provider confirms variants were considered where that marker exists.
6. All canonical identifiers and raw aliases are nonempty, bounded, and unique.
7. Every logical record has a deterministic order and a known availability class.
8. The fully normalized payload stays within every count and byte limit.
9. No navigation/context change occurred after the immutable collection context
   was captured.

Pagination parameters observed as ignored are not treated as pagination proof.
Any failed call, malformed record, count mismatch, conflicting alias, cap breach,
or context drift produces `partial`. An alias conflict uses reason
`ALIAS_CONFLICT`, creates no usable alias index or projection update, and a server
rejects any such payload that claims `complete`. Truncation is never labeled
complete. A partial attempt may update only attempt/context metadata.

### Progress semantics

- `observedEpisodeCount` counts observed canonical episodes;
  `completedEpisodeCount` counts those completed at least once, in the current
  account history generation.
- `aggregate.availableEpisodes` is the complete current regional denominator.
  `aggregate.completedEpisodes` is its intersection with canonical completion.
  Previously watched episodes that become unavailable remain personal history.
- `aggregate.completedEpisodes === completedEpisodeCount` is not a valid
  invariant. Preserve `completedEpisodeCount <= observedEpisodeCount`.
- Exact progress is completed/available, or zero when availability is zero.
  Exact values/next episode require `catalogState === "complete"`.
- Multiple audio variants update one logical progress row. Completion is sticky;
  resume uses the latest actually observed variant and its own position/duration.
  Never transfer a timestamp blindly between different cuts/audio versions.
- Next episode is first available incomplete in provider order; choose latest
  watched audio locale when available, then original, then provider order.

## Contract And Resource Bounds

Bump `WATCH_HISTORY_SCHEMA_VERSION` from 2 to 3 and move active consumers to
`/api/watch-history/v3`. After the coordinated transition, old v2 endpoints
return terminal `426 UPGRADE_REQUIRED`, using the existing v1 upgrade pattern.
No translation of old events, dual writing, or dual history model.

New Crunchyroll progress carries canonical `titleKey`, `seasonKey`,
`episodeKey` plus strict provider evidence:

~~~ts
type CrunchyrollHistoryIdentity = {
  providerSeriesId: string;
  providerSeasonIdentifier: string;
  providerEpisodeIdentifier: string;
  providerContentId: string; // actual /watch/<guid>
  audioLocale: string | null;
};
~~~

Validate exact prefixed canonical-key derivation and exact raw-ID/source-URL
equality on the authenticated server. Reject contradictions with accepted provider
mapping. Client metadata is account-scoped history input; it cannot authorize room
membership or mutate a shared global catalog.

YouTube retains its video identity and opt-in behavior under schema 3. This slice
does not add a YouTube series catalog.

~~~txt
seasons per title               <= 100
logical episodes per title     <= 2,000
variants per episode           <= 32
variants per title             <= 10,000
normalized snapshot            <= 1 MiB serialized
compact projection             <= 256 KiB serialized
stable key                     <= 220 UTF-16 code units
HTTP URL                       <= 2,048 characters
~~~

Count and byte limits are independently mandatory. Overflow means partial, never
truncation into complete. Keep normalized classified episodes with
`available: false`; only proven non-episodes are omitted.

~~~ts
type CrunchyrollCatalogEpisode = {
  episodeKey: `crunchyroll:episode:${string}`;
  providerEpisodeIdentifier: string;
  title: string;
  episodeNumber: number | null;
  order: number;
  releasedAt: string | null;
  available: boolean;
  watchVariants: Array<{
    providerContentId: string;
    audioLocale: string | null;
    original: boolean;
    order: number;
    sourceUrl: string;
  }>;
};
~~~

The server independently normalizes and hashes deterministic keys, context,
labels, availability, ordering, and sorted variants. A client hash is not proof.
The extension retains only compact account-scoped acknowledgements, not a full
catalog.

## Durable Model

### Canonical progress and existing summaries

Adapt `watch_episode_progress` to canonical keys directly. Keep one row for
`(user_id, provider, title_key, episode_key)` in the account's current generation.
Add latest `provider_content_id` and `audio_locale`; keep source URL, resume,
sticky completion, event identity/order, and session association.

Adapt `watch_history_title_summaries` and
`watch_history_user_session_summaries` directly. Do not add parallel logical
summary tables. Keep indexed pagination, eight episode rows per title, a
50-episode detail page, and bounded 20-session enrichment.

Shared history-session identity remains
`room_id + room_generation + source_generation`. Content keys become canonical,
but Worker authority still identifies the actual source URL/fingerprint. Verify
authority against that raw source, not the new logical episode key. Room
membership, source synchronization, and the live lifecycle do not change.

### Catalog snapshot and variants

Create `watch_catalog_snapshots`, one row per
`(user_id, history_generation, provider, title_key)`, with active context/revision,
attempt status, and at most one retained complete payload plus compact projection,
accepted context/hash/time, and successful labels.

Create `watch_catalog_aliases` derived by the server from that accepted snapshot:
`(user_id, history_generation, provider, raw_content_id)` maps to canonical
title/season/episode, audio/original/order metadata, canonical URL, and accepted
availability context. Enforce cross-title raw-ID uniqueness and indexed lookup.

This relation validates provider-declared variants and selects next-episode URLs.
It does not migrate old progress. No separately uploaded alias index is accepted.
A partial catalog cannot replace accepted variants or become exact authority.

New tables use RLS, schema-qualified functions, revoked default execution, and
service-role-only access. No provider token or unfiltered provider response enters
the database.

### Current identity without a complete catalog

Fresh implementation preflight found that the object endpoint can omit logical
episode and season identifiers. Object metadata alone is therefore insufficient.
Resolve the exact recorded watch GUID via the object response, the series season
list, and only the matching season's episode list; or use a previously verified
mapping for that exact GUID. Match provider IDs/declared versions, never labels or
numbers. This is independent of complete **series** catalog traversal, not a
promise that one HTTP request always establishes identity. Missing/ambiguous
evidence remains pending. Canonical progress can be delivered before the full
catalog and rendered observed-only.

If identity cannot yet be resolved, persist the observation as identity-pending
inside the existing bounded outbox, with its original owner, generation, event ID,
observation time, source URL, and room authority. Resolve the recorded watch GUID,
not whatever episode an SPA page happens to show later. Retain the existing
outbox capacity/expiry and retry policy; do not add another queue or a raw-key
server fallback.

Resolution never advances observation time or changes owner/generation. A deleted,
expired, signed-out, or old-generation pending observation cannot recreate history.
No pending work blocks playback or room teardown.

### Catalog begin/commit

The first eligible interaction on a title page/source calls
`begin_watch_catalog_v3` after stable identity/region discovery. Same-page
duplicates coalesce; persistent local freshness cannot replace this server check.

- Complete matching region/locale accepted less than 24 hours ago returns fresh
  without a mutation.
- Required refresh allocates its revision from existing account monotonic server
  order under the account lock. Never reuse a title revision after delete/recreate.
- Return revision, refreshRequired, availabilityChanged, effectiveCatalogState,
  projectionRevision, and accepted hash/time.
- A same-region refresh retains last successful exact data/labels. Region change
  suppresses it immediately and emits history invalidation before collection ends.

`apply_watch_catalog_v3` is one account-locked transaction:

~~~txt
authenticate + check schema/generation
  -> require the current issued revision and immutable context
  -> enforce title deletion fence
  -> validate, normalize, and hash the bounded catalog
  -> replace snapshot and derived variants atomically
  -> join canonical progress directly and rebuild compact aggregates
  -> return applied/superseded acknowledgement
~~~

No progress migration/reconciliation step. Superseded results cannot change
context, labels, variants, totals, or freshness. Missing attempt after deletion is
superseded; only a new genuine interaction can begin another attempt. Partial
same-region results retain last complete; partial new-region results stay
observed-only.

Catalog collection alone does not create watched title cards or mark episodes
watched.

### Progress, reads, and deletion

- Canonical events reuse idempotent receipts/account order and update one row.
- Heartbeats/seeks update resume and incremental recency/session summaries.
- First logical completion/deletion updates the affected numerator.
- Complete snapshot replacement computes the available set/denominator.
- Normal reads/heartbeats never parse the full catalog per title.
- Full clear advances account generation and removes personal history/catalog
  state using requester-specific shared-session visibility rules. Another room
  participant's history is preserved.
- Title deletion fences canonical title and removes personal progress/catalog.
  Episode deletion fences its canonical key, removes one progress row, and keeps
  the catalog.
- Queued audio variants share the same canonical deletion fence. Original
  observation time remains authoritative after delayed identity resolution.
  No copied raw-variant deletion table is needed.
- Genuinely later playback may recreate progress under existing timestamp rules.
  Stale generation, expired authority, duplicate IDs, and old catalog revisions
  remain rejected.

## One-Time Test-History Transition

Use a reviewed forward migration. Applied migration files remain immutable,
consistent with
[Supabase migration guidance](https://supabase.com/docs/guides/deployment/database-migrations).

1. Implement and verify the model/API/clients locally first.
2. For the separately authorized target environment, inventory exact history
   tables, foreign keys, triggers, old writers, and cache keys. Record scoped row
   counts and verify all historical sessions being cleared belong to test scope.
3. Quiesce only history writes. Drain in-flight history transactions using the
   established lock order. Old SQL writers must be rejected/revoked too; terminal
   HTTP routes alone do not stop a previously deployed server.
4. Clear the reviewed test-history rows and summaries; advance account generations
   while preserving preferences and monotonic order. Preserve unrelated product
   tables. Do not use a full remote DB reset or `TRUNCATE ... CASCADE`.
5. Activate the matching schema-3 web and extension. Reject incompatible history
   requests; a short history-only upgrade state is acceptable during transition.
6. Updated client drops old history cache/outbox partitions once by storage
   version. Do not relabel old events as new, or assign them a new generation.
   Never use `chrome.storage.local.clear()` or reset a browser profile.
7. Verify empty history, preserved surrounding settings, then new solo/shared
   playback. Retire obsolete active history code after all consumer checks.

Source-confirmed candidate history relations for the scoped audit:

- `watch_episode_progress`, `watch_history_receipts`, `watch_history_deletions`;
- `watch_history_title_summaries`, `watch_history_user_session_summaries`;
- `watch_sessions`, `watch_session_participants`;
- old `watch_progress_checkpoints`, `user_tracked_titles`.

`user_watch_settings` rows are updated, not removed. `recent_people_evidence`,
rooms/live memberships and other product data are preserved. This candidate list
is not permission to clear all similarly named tables. One-time environment reset
and ordinary per-user history deletion remain distinct operations.

## User-Facing States

The title card uses only the canonical response:

| Server state | Title card |
| --- | --- |
| `complete`, available > 0 | Overall bar plus `completed / available`; width is server `aggregate.progress`. |
| `complete`, available = 0 | `Not currently available`; no bar and no `0 / 0` label. |
| `partial` | Existing observed count; no percentage or denominator. |
| `unavailable` | Existing observed count; no percentage or denominator. |
| Same-region refresh/cache pending | Keep the last successful exact aggregate and catalog labels until commit/refetch; never invent a temporary denominator. |
| Region-change `begin` accepted | Immediately use the ack's server-owned `partial` state: observed-only, no old exact aggregate or percentage while the new revision is pending. |

- The Popup and website share the same rendering semantics and accessible label.
- Optimistic playback continues to update the active episode resume UI but never
  mutates exact aggregate fields.
- Optimistic delete removes the visual target if desired, but a complete catalog's
  numerator/percentage remains server-owned until the canonical delete response
  is fetched.
- A region-change begin ack patches only the matching cached title's state from the
  server acknowledgement (`catalogState: partial`, exact aggregate null) and then
  requests canonical history. It preserves observed rows/counts and does not
  calculate any aggregate locally.
- After a successful catalog commit that changes the visible projection, background
  marks the account cache stale without erasing its last canonical response and
  emits one coalesced invalidation revision. An open Popup performs one canonical
  GET; a closed Popup refreshes on next open. Owner, generation, local request
  sequence, and invalidation revision fence responses so an older GET cannot
  overwrite newer data. This is not polling.
- The website has no background extension channel. It converges through its
  existing page load/focus/visibility/manual refresh path; Popup/web parity is
  asserted after both have completed a canonical refresh, not as an instant push
  guarantee.
- Poster retrieval, tree lines, indentation, card cosmetics, and the full unwatched
  episode tree are explicitly deferred until this data slice passes acceptance.

## Refresh Lifecycle

```txt
meaningful Crunchyroll interaction
  -> durably queue the observation; resolve its exact current-object identity
  -> MAIN-world bridge discovers immutable display/audio/region context
  -> title-level local in-flight check
  -> authenticated server begin returns revision/freshness decision
  -> if required, MAIN-world bridge fetches/sanitizes full provider responses
  -> isolated adapter normalizes and validates complete/partial snapshot
  -> background commits the current revision through authenticated web endpoint
  -> server commits or safely retains prior state
  -> compact freshness ack stored; one history invalidation emitted
```

- Triggers: meaningful playback start/resume or source change to another episode.
  A new title-opening control is not added to the dirty Popup in this slice.
- Non-triggers: five-second local observation, 60-second transport heartbeat,
  Popup render, browser startup, timer, or background crawl.
- One local in-flight collection exists per account/title. Same-context triggers
  join it; a newer context supersedes/aborts the older task. Server revisions fence
  concurrent tabs and devices.
- After a committed complete snapshot, the server's matching-context freshness is
  24 hours. Local ack metadata may coalesce duplicate work within the same page/
  issued revision but cannot skip the first begin check on a later page visit.
- A failed/partial attempt gets one attempt per page visit and a short fixed local
  backoff. It retries only after a later genuine interaction.
- The service worker may suspend and lose its in-memory in-flight map. Durable
  server ordering/hash rules make duplicate work harmless; no permanent job queue
  is added for catalog refresh.
- Full snapshots are transient. Only account-scoped compact revision/hash/context/
  fetchedAt acknowledgement metadata enters Chrome storage, and it is a cache rather
  than server-authority proof.
- Compact freshness is partitioned by owner and history generation. Title deletion
  clears that title's freshness entry; full clear/account-generation change drops
  the old partition; episode deletion keeps title freshness.

## Implementation Tasks

### Task 0: Preserve WIP And Establish A Local Baseline

- [x] Record plan approval, branch/HEAD, and dirty files; preserve the Popup design.
- [x] Read root/plane AGENTS, canonical docs, and the product spec. Record the
  user's clean-start amendment in the spec before changing runtime behavior.
- [ ] Isolate feature work if needed; no resetting or discarding the visual work.
- [ ] Inventory history consumers, legacy write paths, exact reset targets,
  surrounding foreign keys/triggers, and preserved settings.
- [ ] Run scoped baseline checks and classify existing failures before changes.

### Task 1: Provider Evidence And Current-Object Identity

**Files:** `docs/crunchyroll-adapter-notes.md`;
`apps/extension/test/fixtures/crunchyroll/catalog-complete-multiseason.json`,
`catalog-locales.json`, `catalog-variants.json`,
`catalog-availability.json`, `catalog-partial.json`;
`apps/extension/src/source-adapters/crunchyroll/progress.ts`;
`apps/extension/test/crunchyroll-progress.test.ts`.

- [ ] Capture secret-free fixtures proving exact current-object identity using
  its matching season metadata independently of full series catalog traversal.
- [ ] Include multiple locales/audio variants, separate legacy dub seasons,
  fractional/zero/null numbering, region, future/expired/clip classification,
  failed traversal, and raw count mismatch.
- [ ] Record exact field behavior, provider fallback, ignored pagination, and
  endpoint limitations. No cookies/tokens/account IDs in fixtures.
- [ ] Test direct canonical key derivation, exact watch GUID resolution, distinct
  legacy seasons, and missing/ambiguous identity remaining pending.
- [ ] Verify live provider behavior across supported cases. If identity/region/
  complete traversal cannot be proven, keep exact progress disabled.

### Task 2: Shared Schema 3 And Pure Catalog Parser

**Files:** `packages/protocol/src/watch-history.ts`, `src/index.ts`,
`packages/protocol/test/watch-history.test.ts`;
`apps/extension/src/source-adapters/crunchyroll/catalog.ts`;
`apps/extension/test/crunchyroll-catalog.test.ts`.

- [ ] Write failing schema/parser tests for the exact identity object and all
  bounds, strict unknown keys, source URL equality, variants/conflicts, region,
  locale, zero availability, partial results, and begin/commit acknowledgements.
- [ ] Bump history schema to 3; add provider-specific canonical progress fields and
  replace the unused catalog input. Preserve YouTube identity/consent behavior.
- [ ] Remove the invalid historical-completed/current-available equality rule;
  preserve the remaining exact/partial invariants.
- [ ] Implement a pure normalizer/classifier using Task 1 fixtures. No DOM, network,
  auth, database, or aggregate calculation inside it.
- [ ] Test deterministic ordering/hash input, raw-total checks before collapse,
  separate provider seasons, sentinel date handling, locale fallback, and limits.
  Ambiguity means partial.

~~~bash
pnpm --filter @anidachi/protocol test -- watch-history.test.ts
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/extension exec vitest run test/crunchyroll-catalog.test.ts
pnpm --filter @anidachi/extension check
~~~

### Task 3: One Canonical Database Model

**Files:** Create the migration via Supabase CLI
`migration new watch_history_canonical_catalog` in
`apps/web/supabase/migrations/`, using its real generated timestamp.
Adapt history tests in `apps/web/supabase/tests/`.
Move/update `apps/web/lib/anidachi-auth/watch-history-v2-sql.test.ts`,
`watch-history-v2.local-rpc.test.ts`, and
`watch-history-v2.benchmark.test.ts` to `watch-history-v3*`.

- [ ] Test canonical identity, two audio variants counting once, sticky completion,
  latest actual variant resume, account/RLS isolation, and old-schema rejection.
- [ ] Adapt existing progress/title/session summaries and schema/index predicates
  directly. Add bounded snapshot/derived variant relations, no parallel summaries.
- [ ] Implement `begin_watch_catalog_v3`/`apply_watch_catalog_v3` with account
  lock, generation, unique monotonic revision, context, deletion, and hash rules.
- [ ] Adapt progress/delete/read RPCs; preserve existing correct idempotency,
  requester isolation, shared-source authority, pagination, and receipt bounds.
- [ ] Implement narrow clean-start transition and terminal/revoked old write paths.
  Preserve applied migration files and unrelated data.
- [ ] Test populated-test-database and fresh-migration-chain paths, an in-flight old
  transaction, late schema-2 outbox, and an account without prior settings.
- [ ] Test title delete/recreate followed by an old catalog commit: revision must
  not be reused. Test delayed identity-pending observations after deletion.
- [ ] Benchmark maximum catalog and 100-title read; heartbeat cost must not scale
  with full snapshot size.

~~~bash
pnpm --filter @anidachi/web exec tsx --test lib/anidachi-auth/watch-history-v3-sql.test.ts lib/anidachi-auth/watch-history-v3.local-rpc.test.ts lib/anidachi-auth/watch-history-v3.benchmark.test.ts
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web test db
pnpm --filter @anidachi/web check
~~~

Use only a disposable local database for transition/reset tests.

### Task 4: Replace API And Canonical Read Builder

**Files:** Move/update `apps/web/lib/anidachi-auth/watch-history-v2.ts`,
`watch-history-v2-routes.ts` and their tests to `watch-history-v3*`.
Create the v3 route family under `apps/web/app/api/watch-history/v3/`:
`route.ts`, `progress/route.ts`, `delete/route.ts`,
`preferences/route.ts`, `rooms/route.ts`, `title-episodes/route.ts`,
`catalog/attempt/route.ts`, `catalog/route.ts`.
Update `apps/web/lib/anidachi-auth/watch-history-authority.ts` and tests,
`apps/web/lib/staging-access.test.ts`, and server consumers/imports.

- [ ] Test auth, canonical ID/source checks, payload limits, generation/revision
  mismatch, superseded no-mutation behavior, old version rejection, and server hash.
- [ ] Move consumers to v3 services/RPCs. Replace v2 HTTP handlers with terminal
  upgrade responses; do not keep legacy raw reads/writes.
- [ ] Test shared authority where the logical episode ID differs from raw watch
  GUID. Use actual source fingerprint for room-authority validation.
- [ ] Prefer accepted localized catalog labels; without a complete catalog use
  verified current-object labels. Do not group by translated title/slug.
- [ ] Test canonical progress without full catalog, identity contradiction,
  region-change suppression, failed same-region locale refresh, zero denominator,
  and historical vs current completed counts.
- [ ] Ensure all account/server/extension consumers use v3. Add new endpoints to
  staging access tests and keep terminal upgrade responses non-retryable.

~~~bash
pnpm --filter @anidachi/web exec tsx --test lib/anidachi-auth/watch-history-v3-routes.test.ts lib/anidachi-auth/watch-history-v3.test.ts lib/anidachi-auth/watch-history-authority.test.ts lib/staging-access.test.ts
pnpm --filter @anidachi/web check
~~~

### Task 5: Extension Identity, Collection, And Storage Transition

**Files:** `apps/extension/src/source-adapters/crunchyroll/bridge-contract.ts`,
`bridge-client.ts`, `progress.ts`;
`apps/extension/entrypoints/crunchyroll.content.ts`;
`apps/extension/src/source-adapters/core/history-policy.ts`;
`apps/extension/src/watch-history-catalog.ts`, `watch-history-client.ts`,
`watch-history-storage.ts`, `watch-history-outbox.ts`,
`watch-history-controller.ts`; `apps/extension/entrypoints/background.ts`;
their existing bridge/progress/history tests and
`apps/extension/test/watch-history-catalog.test.ts`.

- [ ] Test exact bridge actions, immutable contexts, current-object identity,
  bounded traversal, timeouts/abort, SPA races, and sanitized error handling.
- [ ] Extend the existing bridge, including actual current locale/audio context;
  do not add page-global network hooks.
- [ ] Queue observations before metadata discovery. Extend the existing bounded
  outbox with identity-pending records; resolve the original watch GUID, preserving
  original event/owner/generation/time/room authority. No extra queue or raw fallback.
- [ ] Use v3 routes/schema; validate stale content-script messages in background.
  Drop old history cache/outbox partitions once without touching auth/preferences/
  rooms/media settings or reassigning old events to the new generation.
- [ ] Implement background begin/commit and one in-flight catalog job per
  account/title. New contexts supersede old jobs; no catalog dependency blocks
  resolved progress transport.
- [ ] Region-changing begin and applied commit emit coalesced history invalidation.
  Fence GETs by owner/generation/request/invalidation revision.
- [ ] Test worker restart, duplicate/context races, offline retry, pending identity,
  delete before resolution, outbox capacity/expiry, account switch, schema upgrade,
  and stale content scripts.

~~~bash
pnpm --filter @anidachi/extension exec vitest run test/source-adapters/crunchyroll/bridge-client.test.ts test/crunchyroll-progress.test.ts test/watch-history-catalog.test.ts test/watch-history-client.test.ts test/watch-history-controller.test.ts test/watch-history-storage.test.ts
pnpm --filter @anidachi/extension check
~~~

### Task 6: Overall Progress In Popup And Website

**Files:** Preserved `apps/extension/src/popup-watch-history.tsx` and its styles;
`apps/extension/test/popup-watch-history.test.tsx`;
`apps/web/app/account/watch-library/watch-library-client.tsx` and its test.

- [ ] Integrate the existing visual checkpoint without overwriting user work.
- [ ] Test complete/partial/unavailable/zero-available states and localized labels.
- [ ] Render server `aggregate.progress` and counts; remove optimistic aggregate
  mutation from delete paths. Cache refresh retains canonical content.
- [ ] Use identical semantics on website after its canonical focus/refresh path.
- [ ] Keep a nested visual bar `aria-hidden` inside a disclosure button; include
  exact state in its accessible name. Test long/RTL labels, keyboard and narrow UI.
- [ ] Defer poster/tree-line cosmetics and full unwatched episode rendering.

~~~bash
pnpm --filter @anidachi/extension exec vitest run test/popup-watch-history.test.tsx
pnpm --filter @anidachi/web exec tsx --test app/account/watch-library/watch-library-client.test.tsx
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/web check
~~~

### Task 7: Verification And Controlled Test Transition

**Files:** Product spec, `docs/current-development-state.md`,
`docs/crunchyroll-adapter-notes.md`, appropriate history release notes.
Intentionally refresh Graphify using its semantic skill.

- [ ] Document canonical storage, schema 3, reset scope, preserved settings, and
  required tester extension update.
- [ ] Run protocol/web/extension/local pgTAP/project gates and review the complete
  change for identity, session authority, deletion, pending work, auth, and bounds.
- [ ] Simulate cutover with old data, pending events, and unrelated product
  fixtures. Verify only intended history resets and old writers cannot recreate it.
- [ ] Refresh Graphify and build/validate staging artifact.
- [ ] Before a separately authorized remote transition, record environment,
  targeted counts, migration/runtime activation order, and rollback.
- [ ] Coordinate migration/web/extension cutover. Allow a short history-only upgrade
  state; do not implement dual models to hide the transition.
- [ ] Update verified tester folders only when requested, checking paths/hashes.
- [ ] Record real authenticated provider/UI acceptance separately from test proof.

**Full local gates:**

~~~bash
pnpm --filter @anidachi/protocol check
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web test db
fnm exec --using="$(cat .node-version)" pnpm dlx supabase@2.111.0 --workdir apps/web db lint --level warning
pnpm check
pnpm test
pnpm dev:check
git diff --check
pnpm build:extension:staging
pnpm validate:extension:staging
~~~

## Manual Acceptance Matrix

Use an authenticated Crunchyroll test account and the approved staging extension.
Record title, display locale, audio locale, observed region, snapshot state, exact
counts, and whether evidence came from provider behavior or AniDachi logs. Do not
record tokens or cookies.

1. Multi-season series with one audio version: total and per-season counts match
   the provider, partial watch resumes, completion increments once.
2. Same logical episode in two audio variants: both URLs map to one episode;
   completing both does not double-count; latest variant resumes.
3. Change display language: stable title identity remains one row and labels change
   to the provider-returned locale after refresh. If the new same-region locale
   refresh fails, the last successfully committed exact bundle and labels remain.
4. Change audio language: identity remains stable and next episode chooses the
   matching variant when available.
5. Legacy separate dubbed season: provider-distinct season remains distinct.
6. Fractional episode/special: order and label are correct without integer-key
   assumptions.
7. New episode appears after freshness expiry/forced context refresh: denominator
   grows and percentage may decrease without losing completion.
8. Region/context change: after the new server begin revision, old exact total
   disappears until the new complete commit; a partial failure never shows stale
   exact data as current.
9. Expired/future/clip entries: classifier result matches fixtures and no ambiguous
   record enters an exact denominator.
10. A previously completed episode becomes unavailable: historical observed and
    completed counts remain positive, current aggregate is `0 / 0` with progress
    zero, title says `Not currently available`, and there is no bar/next episode.
11. Offline/provider failure: playback/progress still works, prior same-context
    complete snapshot remains valid, no retry loop occurs.
12. Delete one logical episode after watching two audio variants: its single canonical
    progress row disappears, catalog remains, and queued pre-delete events cannot
    resurrect it.
13. Delete title/full history: catalog and canonical progress follow the defined fence/
    generation behavior.
14. Old extension/schema-2 event after transition receives terminal upgrade and
    creates no progress/session/participant rows.
15. Start two different-context refreshes in separate tabs/devices: the latest
    begin revision wins; a slower older commit is superseded and cannot start a
    local freshness window.
16. Refresh two different titles concurrently in different display locales: each
    title keeps its own revision/context and neither overwrites the other.
17. Deliver catalog invalidation while an older Popup GET is pending, then deliver
    several more invalidations: cached canonical content remains visible, the old
    response cannot overwrite new data, and one coalesced current GET converges.
18. Commit Japanese catalog labels, then publish a later English progress event:
    complete reads keep Japanese catalog labels; partial/unavailable reads use the
    current observed fallback.
19. Old test history/caches/outbox are cleared in the scoped transition. New
    playback creates canonical history; old queued events cannot restore old rows.
20. Popup title button accessible name includes the exact aggregate state while the
    nested visual bar is hidden from accessibility APIs.
21. Refresh/focus the website after a catalog commit: Popup and website then display
    identical exact numerator, denominator, percentage, localized title, and
    catalog state.

22. Metadata outage: observations stay bounded/pending; later exact-ID resolution
    preserves their timestamps. Delete/account switch/expiry prevents resurrection.
23. Shared history verifies raw room-source authority while progress uses canonical
    episode keys; a guest clearing history does not change host/room state.
24. Different durations across audio variants preserve one completion and resume
    only the latest actually watched variant at its own observed position.

## Must-Stop Conditions

- Stable provider series/season/episode identity or complete region traversal
  cannot be proven; do not manufacture exact totals.
- Variant identity requires comparing translated titles/episode numbers.
- A real complete title exceeds bounds; revisit normalization/limits.
- Proposed cleanup reaches non-history data or requires a full remote DB reset.
- Bounded reads/heartbeats need to load full catalog payloads.
- Pending identity or shared authority cannot preserve original event attribution.
- A delete/recreate can accept a stale revision or pre-delete observation.
- Integration would discard the user's visual work.
- Live provider behavior contradicts fixture assumptions.

## Rollback

Test history reset is intentionally irreversible without a separate backup; do not
promise recovery of discarded test progress or add an import path for it.

- Catalog failure: disable collector/bar and keep canonical observed history.
- History-runtime failure during transition: retain the history-only upgrade state
  while fixing it; unrelated room/auth/media behavior remains available.
- The previous web deployment alone is not a valid rollback after schema change.
  Reverting requires a reviewed forward migration and matching client/runtime.
- Validate transition/failure paths locally and on staging before separately
  approved production promotion.

## Non-Goals

Old test-history preservation/import, dual history models, tree/poster cosmetics,
full unwatched tree, YouTube series catalogs, entitlement-specific availability,
external translation/metadata, polling/crawling, and unrelated room/P2P/media/
friends/invitation changes are outside this slice. No production/main promotion
is authorized by this plan.

## Planning Verification (2026-09-05)

At planning close the revised model was proposed, not implemented. Deployed runtime remains Watch
History v2. No history has been cleared and no product code, test folder, browser
profile, settings, or deployed database was changed for this amendment.
