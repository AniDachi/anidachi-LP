# Watch History Catalog And Progress Design

**Date:** 2026-08-13

**Status:** Approved design; local implementation and separately authorized staging activation completed 2026-09-05; authenticated acceptance pending.

## 2026-09-05 Clean-Start Amendment

The approved implementation plan is
`../plans/2026-09-05-watch-history-crunchyroll-catalog-progress-plan.md`.
Its clean-start and canonical-identity rules supersede the older additive
transition below: test history need not be preserved. Schema 3 stores one row per
logical provider episode directly, with the latest actual audio/watch variant as
resume metadata. Applied migrations remain immutable; a separately authorized
forward cutover clears only reviewed test-history relations and advances history
generation while preserving accounts, room state, social data, Recent People,
media/UI settings, and YouTube tracking consent. Old HTTP and SQL writers must
reject incompatible events. No legacy backfill or parallel raw read model is
required. This authorization is local only, not permission to deploy or reset a
remote database.

This slice covers Crunchyroll identity/catalog completeness, localized labels,
and server-owned overall title progress. A separate redesign of shared watching
history, poster retrieval, and tree-line cosmetics remains deferred. Existing
shared viewing still works with schema 3 and validates the original raw room
source, not the canonical episode key. YouTube keeps its existing capture policy.

Exact aggregates describe currently released/regionally available episodes;
historical completion counts may include episodes now unavailable. Regional
context changes suppress the old exact aggregate immediately. Failed same-region
refreshes retain the last successful complete bundle. Canonical IDs never depend
on translated labels, numbering, audio locale, or URL slugs. Details and bounded
limits in the approved plan are normative for implementation and testing.

The authorized local implementation is now complete on the feature branch. Its
retained disposable-database commands, transition proof, schema/RPC/read-state/
benchmark results, local harness incident disclosure, activation boundary, and
rollback constraint are recorded in `../../watch-history-v3-local-verification.md`.
The later separately authorized staging cutover is recorded in
`../../watch-history-v3-staging-verification.md`: schema PR #265 preceded runtime
PR #264, and the matching CI extension was synchronized to both verified tester
folders. Only reviewed old test history was reset. Main/production was not
promoted; authenticated-provider and loaded-extension acceptance remain open.

**Scope:** AniDachi watch history, series catalog metadata, progress sync, and
the shared data contract used by the extension Popup and website account area

## Relationship To Existing Design

This document refines the watch-history portion of
`2026-08-06-account-data-history-social-inbox-design.md`. The earlier document
remains authoritative for friends, personal groups, room invites, inbox, push
delivery, and account isolation.

For watch history, this document supersedes the earlier rules about:

- plan-based history retention and tracked-title limits;
- storing an append-only checkpoint for every uploaded progress observation;
- deriving `Recent people` from technical watch-progress checkpoints.

The existing Popup hierarchy of provider, title, season, and watched episode is
preserved. This design adds the missing catalog denominator and makes progress
storage compact and reliable; it does not replace the current hierarchy with a
second history interface.

## Product Goal

AniDachi should answer four questions consistently in the extension Popup and
on the website:

1. What was the user watching most recently?
2. Where should playback resume for a specific movie or episode?
3. How much of a season and series has the user completed?
4. What is the next currently available episode?

The answer must remain correct across refreshes, devices, offline recovery,
solo viewing, and room viewing without continuously polling providers or
creating an unbounded event journal.

## MVP Boundaries

The MVP includes:

- identical watch-history retention and title capacity for Free, Plus, and Pro;
- one canonical server-side history for the Popup and website;
- exact per-episode resume progress;
- exact season and series progress when a complete provider catalog is known;
- lazy Crunchyroll catalog refresh during real interaction with a title;
- separate YouTube history behavior without artificial seasons;
- episode, title, and full-history deletion;
- compact offline retry and deterministic conflict handling.

The MVP does not include:

- background crawling of every title in a user's history;
- scheduled release monitoring or new-episode browser notifications;
- an external anime metadata service;
- a permanent row for every five-second playback observation;
- a complete list of all unwatched episodes inside the Popup;
- manual season hiding, dropped-show workflows, ratings, or rewatch journals;
- different history limits or retention windows by subscription plan.

Subscription plans continue to differ through rooms, participants, groups, and
other advanced features. Watch history is not a subscription restriction.

## User Experience

### Existing History Hierarchy

The Popup keeps the current structure:

```txt
Provider
  Title
    Season
      Episode
```

Existing watched and partially watched episodes remain grouped by their known
season. No duplicate hierarchy is introduced.

### Title Summary

When a complete catalog snapshot is available, a series row shows completed
released episodes over all released and currently available episodes, for
example `19 / 25`.

When catalog data is missing, stale with no previous valid snapshot, or known
to be partial, the UI shows an honest observed count such as `7 watched`. It
must not present `7 / 7` as complete.

### Season Summary

Each known season shows its own completed and available count, for example
`7 / 13`. Future unreleased episodes and provider placeholders do not enter the
denominator.

### Expanded Season

The Popup shows:

- episodes already watched or started;
- the current unfinished episode;
- one next available episode when the catalog identifies it.

It does not render the full unwatched catalog. The website account area may
later provide the full season and episode drilldown while using the same
canonical server values.

### New Releases

If a provider exposes a newly released episode during a later catalog refresh:

- all completed episode states remain completed;
- the available episode count increases;
- season and series percentages may decrease naturally;
- the new episode can become the next available episode.

Release notifications are not part of this MVP because catalog refresh is
interaction-driven rather than a release-monitoring service.

## Canonical Data Model

Supabase is the durable source of truth. Extension storage is an account-scoped
cache and compact retry outbox, not a parallel history system.

### Title Catalog Snapshot

One bounded snapshot is stored per authenticated user, provider, and title.
The snapshot contains:

- stable provider and title identity;
- provider series identity when available;
- title, artwork, and canonical source URL;
- seasons with stable provider identity, number, title, and display order;
- released and currently available episodes with stable identity, number,
  title, source URL, release time when known, and display order;
- snapshot completeness (`complete` or `partial`);
- provider locale or availability context when available;
- `fetchedAt`, `lastAttemptAt`, a content hash, and schema version.

For the MVP this is stored as one validated, size-bounded JSON snapshot instead
of several normalized catalog tables. It is replaced atomically, never appended
to as an event stream. This keeps the write path and cleanup small while still
allowing the snapshot format to be normalized later if real query volume
requires it.

A valid previous snapshot remains usable when a refresh fails. An empty or
partially parsed response never replaces a known complete snapshot.

### Episode Progress

One mutable row exists per user, provider, title, and episode identity. It
stores:

- current position and duration;
- progress ratio;
- latest accepted observation time;
- completion time;
- latest valid source URL;
- season and episode metadata last observed from the provider;
- the latest meaningful session reference.

Completion is recorded when playback emits `ended` or reaches at least 90%.
Once completed, an ordinary rewatch or backward seek does not make the episode
uncompleted. The current rewatch position may still update the resume pointer.
The MVP does not create a separate rewatch journal.

### Meaningful Watch Sessions

Watch sessions preserve product history, not technical telemetry:

- solo sessions identify one user's viewing boundary;
- shared sessions identify one room and source-generation boundary;
- each room participant writes only their own participant progress;
- source changes create a new shared session boundary;
- reconnecting does not duplicate the same active session.

Frequent local observations update the current episode state. They do not each
create an immutable database checkpoint.

### Tracked Title Summary

A compact row per user and title remains available for pagination, ordering,
artwork, latest activity, and deletion. Server-side counts and progress are
derived from canonical episode progress plus the latest valid catalog snapshot.

### Recent People Evidence

`Recent people` receives its own compact durable evidence derived from a valid
shared session. It is not derived from technical progress checkpoints. Clearing
watch history therefore does not remove friends, group membership, invites, or
recent-person evidence. A user can hide a recent person separately.

## Provider Policies

### Crunchyroll

Crunchyroll owns series, season, and episode catalog behavior inside its
provider adapter. The adapter may inspect authenticated page data and provider
responses already available to the user's browser. Provider-specific parsing
must not leak into shared room or generic history logic.

A catalog refresh is considered only when the authenticated user genuinely
interacts with a supported title, such as:

- starting or resuming a supported episode;
- switching the active room or player source to another supported episode;
- explicitly opening that title from AniDachi history.

The refresh runs in the background and does not delay playback or progress
capture. A per-account, per-title freshness guard prevents another provider
request for 24 hours after the last successful complete refresh. Concurrent
triggers share one in-flight refresh. A failed attempt uses a short bounded
backoff and may retry only during a later interaction; it cannot loop within the
same page visit.

The collector includes only released episodes currently available in the
user's provider context. Trailers, previews, future placeholders, and duplicate
audio or language variants are excluded from the denominator. Variants are
collapsed only when provider metadata supplies a reliable canonical identity;
titles alone are not sufficient evidence. If reliable identity or completeness
cannot be established, the snapshot is marked partial and exact totals are not
shown.

The implementation plan must begin with an adapter fixture and live staging
preflight to identify the current reliable Crunchyroll catalog source. No
undocumented provider endpoint is treated as permanently stable.

### YouTube

YouTube keeps its existing separate policy:

- history capture is disabled by default through one global user preference;
- ordinary long-form videos are independent movie-like items;
- Shorts, previews, and unsupported embedded surfaces are excluded;
- seasons and series denominators are not synthesized;
- enabling YouTube history affects future eligible viewing and does not create
  catalog records for unrelated videos.

## Synchronization Flow

### Progress Capture

The extension updates its account-scoped local state frequently enough for
crash recovery. Server publication occurs on meaningful events:

- a bounded playback heartbeat;
- pause;
- seek completion;
- source change;
- supported-page exit or page hide;
- room leave or room end;
- playback end.

The outbox keeps only the newest unsent non-terminal state per account, session,
and episode. Terminal completion remains until acknowledged. Every publication
has a stable `clientEventId` that survives retries.

### Server Write

The authenticated route invokes a transactional Postgres RPC. One accepted
event atomically:

1. resolves the authenticated user without trusting a client `userId`;
2. deduplicates the stable event ID;
3. validates provider identity against the canonical source domain;
4. verifies room proof for shared events;
5. resolves the meaningful session;
6. updates only the authenticated participant;
7. updates the episode progress and title summary;
8. acknowledges the canonical accepted state.

Catalog refresh uses a separate validated endpoint because catalog failure must
never block progress persistence. A complete catalog snapshot is atomically
replaced only after full validation.

### Conflict Resolution

The latest real user action wins, including an intentional seek backward.
Delayed offline observations whose client observation time predates a newer
accepted action cannot regress canonical state. Server receipt time, bounded
client time, stable event IDs, and the current account generation are used
together; simple `max(progress)` logic is not used.

## Read Contract

The server combines title summary, episode progress, meaningful sessions, and
the latest valid catalog snapshot. Popup and website receive identical values
for overlapping records.

The contract includes explicit catalog state:

- `complete`: exact season and title denominators are safe to show;
- `partial`: observed metadata can be shown, but exact totals cannot;
- `unavailable`: no valid snapshot exists.

Because current Zod responses are strict, new catalog and aggregate fields are
introduced through an additive versioned contract rather than inserted
silently into the existing v1 response. The old read path remains available
until both extension and website consumers use the new contract in staging.

Website history uses cursor pagination by `(lastWatchedAt, stableId)`. The
Popup requests a bounded recent subset plus server-derived totals; it never
assumes one fixed-size response contains the complete account history.

## Deletion Semantics

Authenticated users can delete:

- one episode's history;
- one title's history;
- all watch history.

Deletion is atomic at the requested boundary:

- episode deletion removes that episode's progress and associated history
  sessions but keeps the title catalog;
- title deletion removes its episode progress, associated history sessions,
  tracked-title summary, and private catalog snapshot;
- full-history deletion applies the title operation to every title owned by the
  account.

Removing a title or all history therefore also removes it from the Popup
immediately. A later real viewing interaction may create fresh progress and
refresh its catalog again.

Deletion does not remove:

- friends;
- personal groups or memberships;
- room invites;
- another user's history;
- compact `Recent people` evidence.

Local account-scoped history and pending outbox entries at or below the deletion
boundary are cleared after server acknowledgement so stale retries cannot
resurrect deleted history.

## Failure And Offline Behavior

- Progress capture continues locally when the network is unavailable.
- The newest compact state and terminal completion retry after reconnect.
- A failed catalog refresh keeps the last valid snapshot and never blocks
  playback.
- A first-time catalog failure produces observed-only labels, not fabricated
  totals.
- Invalid provider data is rejected and logged without raw private URLs,
  tokens, email addresses, or full user IDs.
- Account switching hides the previous account immediately and ignores late
  responses from its request generation.
- Explicit refresh is recovery; frequent polling is not introduced.

## Security And Resource Limits

- The extension never receives Supabase service-role credentials or other
  server secrets.
- Catalog and progress writes are authenticated and account-owned.
- Catalog payload count, string length, and serialized size are bounded before
  database writes.
- Provider URLs are normalized and domain-validated.
- Database indexes match user, provider, title, episode, and history-cursor
  access paths.
- Database functions use an explicit empty `search_path`, minimal execute
  grants, and server-controlled identity.
- Snapshot refresh locks prevent duplicate concurrent provider work.

These are resource-safety boundaries, not subscription limits presented to the
user.

## Migration And Rollout

The implementation is additive and staging-first:

1. Add versioned protocol contracts and fixtures without switching runtime
   readers.
2. Add compact catalog snapshot, canonical episode progress, idempotency, and
   social evidence storage plus transactional RPCs.
3. Switch extension progress publication and catalog refresh behind staging
   feature gates.
4. Switch Popup and website to the same canonical v2 read model.
5. Verify deletion, offline retry, account isolation, solo/shared history, and
   exact Crunchyroll counts with real staging accounts.
6. Stop writing technical progress checkpoints.
7. Remove obsolete checkpoint storage only after staging evidence proves no
   active read path or `Recent people` query depends on it.

Current test users and historical test data do not require a production
backfill. Schema compatibility is still additive so staging rollback remains
possible while the new path is being validated.

## Verification

### Adapter Tests

- complete and partial Crunchyroll catalogs;
- multiple seasons and stable ordering;
- trailers, future placeholders, and unavailable episodes;
- duplicate dub or language variants;
- new episode appearing after a refresh;
- one successful refresh per title per 24 hours;
- concurrent refresh deduplication and failed refresh fallback;
- YouTube remains independent and has no seasons.

### Protocol And Database Tests

- strict v1 compatibility and valid v2 parsing;
- bounded catalog payload validation;
- duplicate and out-of-order progress events;
- intentional backward seek;
- terminal completion persistence;
- atomic rollback and safe retry;
- each room participant can update only their own progress;
- exact episode, title, and full-history deletion;
- history deletion cannot remove `Recent people`;
- cursor pagination beyond the Popup window.

### UI Tests

- existing provider/title/season hierarchy remains intact;
- exact title and season totals appear only for complete snapshots;
- partial/unavailable snapshots show observed-only labels;
- expanded seasons show watched/started episodes and one next episode;
- a newly released episode updates totals without clearing completion;
- Popup and website fixtures display the same canonical progress.

### Staging Acceptance

Use authenticated staging accounts and the actual extension artifact to verify:

- a new Crunchyroll title with multiple seasons;
- resume, seek backward, completion, reload, and source switch;
- a second browser/device receiving the same canonical progress;
- a two-person room where each user owns their progress;
- offline progress followed by reconnect;
- simulated stale and newly refreshed catalogs;
- episode, title, and full-history deletion;
- YouTube disabled by default and enabled explicitly.

The in-player overlay, room playback synchronization, P2P media, friends,
groups, and invite behavior must remain unchanged.

## Acceptance Criteria

The MVP history foundation is complete when:

- the current Popup season hierarchy is preserved;
- each episode has one canonical resume state without duplicate technical
  history rows;
- exact season and series totals appear only from a complete current catalog;
- catalog refresh is interaction-driven and guarded by 24-hour freshness;
- new released episodes update totals without erasing watched state;
- Popup and website agree on progress and counts;
- offline and out-of-order progress converges without regression;
- each participant writes only their own progress;
- deletion cannot be reversed by stale local retry;
- history does not vary by plan and creates no background crawl;
- the migration passes automated checks and realistic staging acceptance before
  promotion.

## References

- Crunchyroll exposes episode, season, and series watched concepts and a web
  release calendar for available content:
  <https://help.crunchyroll.com/hc/en-us/articles/31320247305748-How-do-I-mark-episodes-seasons-and-shows-as-watched>
  and
  <https://help.crunchyroll.com/hc/en-us/articles/22745725145364-Is-there-a-release-calendar-available>
- Trakt separates compact watched data from explicit season progress and uses
  full season/episode drilldowns for detailed views:
  <https://roadmap.trakt.tv/changelog>
- Supabase database functions and authorization guidance:
  <https://supabase.com/docs/guides/database/functions>
