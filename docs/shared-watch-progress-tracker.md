# Shared Watch Progress Tracker

Last updated: 2026-09-05.

This document records the current Watch History v3 staging boundary and the
historical v2 evidence that preceded it. The older local/demo tracker has been
retired from active runtime. Technical `main` remains on v2; no statement below
turns a local candidate into a deployed staging or production feature.

## Product Surface

Watch History answers three questions without becoming a second room system:

- what the signed-in account watched;
- where each observed episode can resume;
- which solo or shared session supplied the meaningful progress.

Popup stays compact and local-first. The website provides the paginated account
view. On staging both consume the same strict schema-3 authority and show
canonical provider data without inventing catalog denominators; neither read
surface is a second progress writer.

## Runtime Ownership

- Supabase/Postgres is the only durable account-history authority.
- The room Durable Object remains the live room, source-generation, and playback
  authority. It issues the signed self-attestation used by each participant to
  publish only their own shared progress.
- Provider/content code observes media events. The extension background is the
  only extension writer and owns an account/generation-scoped cache and outbox.
- Popup reads the confirmed cache plus a matching active local observation, then
  asks background to refresh. The website reads the same server contract.
- There is no Supabase Realtime channel, polling service, provider catalog crawl,
  backfill, second database, or durable telemetry journal.

## Durable Model And Convergence

One mutable episode row stores canonical resume progress. Meaningful solo/shared
sessions replace append-only checkpoints. The transactional progress RPC applies
idempotency, server order, account generation, shared authority, and deletion
fences together.

The outbox is bounded by shape, not an invented count or expiry: each logical
session/episode key retains at most terminal plus latest. Acknowledged entries are
removed. Chrome's actual storage accounting decides quota behavior; an existing
terminal is preserved if a new capture cannot be stored.

Receipts expire exactly 14 days after server acceptance. Episode/title deletion
fences reject older queued work. Full clear advances the account generation.
Sign-out and account switch hide prior-owner data while retaining dormant pending
work until the user explicitly confirms discard.

## Historical v2 Read Boundary

The accepted v2 contract became title-cursor-paginated without returning every
episode for every visible title. Additive migration
`20260821162622_watch_history_v2_resource_bounds.sql`, deployed by PR `#215`
as staging squash `7d2e3badb043c3d3adb4ef16ad9527dd3762259f`, adds exact title
counts, bounded title/detail RPCs, and receipt cleanup. PR `#216`, staging squash
`b652f8b8cfbdd8130a648702708dfcc13dc2cd8d`, switched the Web and extension
consumers without changing the local-first ownership model.

The title RPC returns at most eight canonically recent episode rows per visible
title, exact observed/completed counts, and an honest continuation. An
authenticated owner-bound detail request returns at most 50 rows, one lookahead,
and an opaque keyset cursor ordered by canonical observation time with a binary
episode-identity tie-breaker. Detail pages are not a snapshot lease: a live
change can require the client to refresh rather than silently merging stale
pages. The Popup stays on the bounded canonical title snapshot plus its
same-owner local observation; it does not eagerly fetch old detail pages.

All canonical episode rows remain durable and untruncated. The accepted local
501-title/13,200-episode fixture measured 275,920 serialized bytes and a
+573,440-byte parser RSS delta for a 50-title bounded page. The exact title
projection remains transactionally maintained across writes, deletes, and full
clear. The existing title/session projections and rollback-safe legacy data are
not a retention cap or a second durable store.

Receipts expire exactly 14 days after acceptance. The service-role-only hourly
cleanup selects and deletes a globally ordered, skip-locked batch of at most 100
expired receipts; it never deletes progress, settings, summaries, deletion
fences, or unexpired receipts. No creation-rate limiter was added because the
recorded current behavior did not justify one without risking legitimate offline
or terminal recovery.

## Providers

Crunchyroll records the active observed episode after meaningful playback.
Canonical catalog evidence is used when available; observed seasons/episodes alone
are never proof of a complete catalog. YouTube is an explicit browser-local opt-in,
off by default,
and accepts only canonical supported long-form playback with actual advancement
or an ended event. The choice is mirrored to the account in the background and
seeds only browsers without their own explicit choice. Shorts, embed, preview,
and route-only observations remain ineligible. An active supported page observes
the local choice directly and resamples immediately; toggling does not require a
page reload or a server response. A newer local choice fences an in-flight account
refresh. Opt-out clears the active YouTube presentation and preserves only the last
already-observed meaningful solo sample for background delivery; it does not capture
after consent has been withdrawn.

## Historical v2 Evidence

Watch History v2 is accepted on staging as part of the core-foundation-to-UI/UX
handoff. Task 2 recorded focused pgTAP 69/69, full pgTAP 306/306, strict real
RPC parsing 2/2, and the resource measurement above. Task 3's delivered
consumer and staging evidence includes the bounded title/detail contract,
local-first/offline/outbox regression coverage, staging artifact validation, and
the user's 2026-08-22 two-profile loaded-artifact confirmation that the complete
Crunchyroll/YouTube and website convergence flow works ideally.

This is a staging foundation acceptance only. It does not establish production
or market readiness, a Chrome Web Store release, two-network/TURN media proof,
new-provider support, a catalog, telemetry-based creation limits, or a
production migration/promotion. Those decisions require their own scope,
verification, and approval.

## Schema-3 Staging Baseline

The separately authorized 2026-09-05 canonical Crunchyroll catalog/progress
transition is active on `staging`: migration prerequisite PR `#265` landed before
runtime PR `#264`. Technical `main` remains at `54a154b7` with Watch History v2.
Schema 3 keeps the same ownership model while changing storage identity to one
progress row per account and logical provider episode. Latest raw
watch/audio/source metadata supplies resume behavior, and bounded catalog
snapshot/alias evidence supplies localized labels, regional availability, exact
aggregates, and per-season next-episode metadata.

The extension background remains the only extension writer. Metadata-pending
observations keep their original timestamps, event IDs, room authority, and source;
they do not reach the server until canonical identity resolves. The outbox remains
shape-bounded (terminal plus latest per logical key), account/generation scoped, and
deletion fenced. YouTube stays opt-in and independent. Shared history still verifies
the raw room source authority while storing progress by canonical episode key.

The staging clean-start migration intentionally discarded only reviewed test
history and advanced history generation. It blocks every v2 SQL/HTTP writer while
preserving account, auth/subscription, room, social/invite/Recent People,
interface/media, and YouTube consent state. The matching extension storage
transition retains only validated
YouTube preference state; old history cache/outbox/observations are not copied. This
short incompatible transition is deliberate, not a reason to implement dual models.

Exact retained commands, dedicated-container guards, migration/RPC/read-state/
benchmark evidence, the local-port-54322 harness incident disclosure, activation
order, rollback constraints, staging deployment receipt, and outstanding
authenticated acceptance are recorded in
`docs/watch-history-v3-local-verification.md` and
`docs/watch-history-v3-staging-verification.md`. The matching v3 artifact was
synchronized during that separately authorized activation; folder synchronization
did not prove a browser reload or authenticated Crunchyroll acceptance.

## Local Watch Drawer Browse Candidate

The approved follow-up keeps personal episode progress and title/season aggregates
canonical and unfiltered. Search, date, participant, and My groups conditions are
bounded server-side browsing projections over eligible durable history before
pagination. Shared-session dates come from the requester's recorded observation;
the drawer shows the actual recorded participants and does not replace resume or
completion state with a selected session.

My groups is owner-private provenance, not group progress or a shared-group history
product. A historical association requires an authenticated group invitation plus
overlapping actual participation in the same verified room generation. Sending or
accepting alone, generic links, current membership, names, or old ambiguous sessions
cannot establish it. The immutable group-name snapshot survives rename/deletion,
while history deletion and generation fences continue to remove or isolate the
owner's browse evidence.

The local source at `bf260d7e858bbd721820a2c7a4ee5532ac924542` has automated,
synthetic real-component, independent-review, and isolated narrow-artifact evidence
recorded in `docs/watch-drawer-browse-local-verification.md`. It has not been pushed,
deployed, remotely migrated, loaded into either established tester folder, or
accepted with authenticated staging accounts. Staging still reflects PR `#267`
(`f2fafb29`) and does not expose the new browse endpoints.

## Rollout And Rollback

The browse rollout order is additive database prerequisite, reviewed matching Web
runtime, matching narrow staging extension artifact, then authenticated staging
acceptance. This order needs separate authorization. Validate newly organized
group viewing with actual participation; do not treat old groups, invitations, or
ambiguous sessions as backfill evidence.

If the browse runtime must be rolled back, restore the prior Watch History v3 Web
and extension consumers while retaining the additive tables, functions, and
canonical history. Old v3 readers remain compatible. Restoring the canonical
writer entry point, if needed, requires a reviewed forward migration; never drop or
rewrite history to roll back this feature.

For the historical v2 boundary, before destructive cleanup, application rollback
was a redeploy of the prior Web, Worker, and extension artifacts. Additive v2
tables/functions and inert v1 tables remain available; do not delete legacy storage
as part of this handoff. The bounded-read prerequisite is old-runtime-compatible
but not dormant because its triggers and projections remain maintained. Use the
Watch History forward-cleanup sequence in
`docs/release-and-rollback-runbook.md` if that migration itself must be removed;
canonical progress remains untouched.
