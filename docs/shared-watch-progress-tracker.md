# Shared Watch Progress Tracker

Last updated: 2026-08-15

This document records the current Watch History v2 product and runtime boundary.
The old local/demo checkpoint design is retired. The active implementation plan
is `docs/superpowers/plans/2026-08-14-watch-history-v2-clean-mvp-implementation.md`.

## Rollout Status

- The additive PostgreSQL foundation, authenticated v2 web API, extension
  outbox/cache, meaningful progress capture, Worker room authority, and v2
  Popup/website readers are implemented.
- PR #178 deployed the v2 Popup/website consumer layer to `staging` at merge
  commit `d4af69b332e61e243ed7044f44dd62ce360c9c56` while keeping v1 HTTP paths
  active.
- The exact CI staging extension artifact is
  `d4af69b332e61e243ed7044f44dd62ce360c9c56-staging-103` (Actions artifact
  `9245980993`). It has passed build validation but has not yet completed the
  loaded two-profile acceptance matrix.
- The logical clean cutover is prepared separately and is not deployed. Until
  manual staging acceptance passes, v1 routes must not return `426` and the
  cutover migration must not be applied to staging.
- Nothing in this rollout is approved for `main` or production yet.

## Product Behavior

Watch History answers:

- what the signed-in user watched;
- where each observed episode or movie stopped;
- which meaningful solo or shared sessions are available to continue;
- who was recently confirmed in the same shared session.

Popup opens from an owner-bound local cache, overlays pending progress, and asks
the background runtime to refresh. The website reads the same strict v2 response
from the server. Popup never becomes a second durable source of truth and never
writes provider progress directly.

History is observed-only for the MVP. AniDachi does not invent complete season or
series totals from episode numbers. When catalog completeness is unproven, the UI
shows observed episodes and marks catalog state unavailable.

## Ownership And Data Flow

```txt
provider adapter
  -> provider-neutral observation
  -> background-owned owner/generation fence
  -> compact local latest + terminal outbox
  -> authenticated v2 progress route
  -> one transactional PostgreSQL RPC
  -> canonical account history
  -> strict v2 read model
  -> Popup cache and website
```

- Account identity comes only from background-owned auth/session state.
- Every local partition is bound to `ownerUserId` and `accountGeneration`.
- Every accepted event receives server ordering under the account lock.
- `clientEventId` is the idempotency key, not a chronology claim.
- Durable receipts are retained for exactly 14 days.
- The outbox has terminal-plus-latest shape per logical session. It has no TTL,
  invented count cap, or silent dormant-owner eviction.
- Storage pressure fails closed, preserves terminal work, exposes recovery, and
  never deletes unrelated extension storage.

## Meaningful Progress

Crunchyroll records only canonical supported `/watch/{id}` pages with valid
finite media and usable identity metadata. YouTube is disabled by default and,
after account-wide opt-in, accepts only canonical long-form `/watch?v=...`
surfaces. Shorts, embeds, previews, feeds, and malformed media fail closed.

There is no arbitrary video-length or watched-seconds threshold. Playback becomes
meaningful after two advancing, non-seeking playing samples, or an actual `ended`
event. Once meaningful, pause, seek completion, page hide, source change, room
leave/end, and a coalesced 60-second playing heartbeat can be delivered. A seek
backward is valid progress, not evidence to discard the event.

## Shared Sessions

Shared history remains self-written: each participant writes only their own
progress. The Worker emits a short-lived purpose-bound authority proving the
current user, room, participant session, room generation, and source generation.
The web route verifies and reduces that token before invoking PostgreSQL; the raw
attestation is neither persisted in normal state nor logged.

Room entry suppresses solo publication until authority and source identity are
ready. Room/source changes rotate logical sessions. Delayed terminal delivery is
idempotent, and stale generations cannot attach to the current shared session.

## Deletion And Recent People

- Episode, title, and full-history deletion are atomic.
- Episode/title fences survive later playback. A new event recreates history only
  when its normalized observed time is later than the fence.
- Full clear advances `accountGeneration`, permanently rejecting older queued
  work. A slow device clock can conservatively reject genuine post-delete
  playback; this is an explicit MVP limitation.
- Recent People is independent evidence keyed by the ordered user pair. It
  requires accepted writes from both participants and uses server confirmation
  time.
- History deletion does not delete Recent People. The product exposes no
  fabricated shared-room count.

## Rollback And Remaining Gates

The pre-release cutover imports no v1 test history. V1 tables remain inert and
intact after cutover so rollback is the prior app deployment plus restoration of
the previous Recent People function. Dropping legacy tables is a later,
separately approved migration.

Before cutover or production promotion:

1. Load Actions artifact `9245980993` in the authenticated staging browser
   profiles.
2. Complete the two-profile solo/shared/offline/deletion/account-switch/YouTube
   acceptance matrix from the active plan.
3. Confirm Popup and website values match across profiles/devices.
4. Apply the logical cutover only after those checks pass, then rerun staging
   smoke and regression gates.

The current GET is correct but reads the complete account history before title
pagination. This is acceptable only for pre-release test volumes. Before public
release it needs a bounded server query or an explicitly measured and approved
data-volume limit.
