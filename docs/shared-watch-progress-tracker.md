# Shared Watch Progress Tracker

Last updated: 2026-08-16.

This document records the current Watch History v2 product and runtime boundary.
The older local/demo tracker has been retired from active runtime.

## Product Surface

Watch History answers three questions without becoming a second room system:

- what the signed-in account watched;
- where each observed episode can resume;
- which solo or shared session supplied the meaningful progress.

Popup stays compact and local-first. The website provides the paginated account
view. Both parse the same strict v2 response and show observed-only provider
data; neither invents catalog denominators or writes progress.

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

## Read Boundary

The API contract is title-cursor-paginated. The initial implementation paginated
after loading the full account, which was accepted only for pre-release test
volume and blocked public release. The locally verified additive
`20260816090000_watch_history_v2_bounded_read.sql` migration maintains one
canonical summary row per observed v2 title and keyset-selects the requested
title page before loading its episodes. Session enrichment is limited to the
latest 20 title sessions plus each visible episode's canonical latest session.
A compact v2-only row per `(user, session)` records the user's current account
generation, title key, and canonical `watch_sessions.last_checkpoint_at`, the
same value returned as the session DTO's `lastWatchedAt`. Participant heartbeat
time does not affect candidate order. Its requester/title/order index avoids
candidate scans across other users, and it does not compare a host-owned shared-
session generation with the viewer's account generation. Sessions with neither
`room_id` nor `client_session_key` are internal shared tombstones, are omitted
from initialization/maintenance, and cannot consume the latest-20 bound.
The exact title count remains server-computed and no business retention cap was
invented. Normal heartbeat writes incrementally upsert the title timestamp;
episode/title/all delete statements recompute each distinct affected title once.
The migration's explicit transaction locks settings first, then session,
participant, and progress sources, before installing maintenance and running either v2-only
initializer. This matches writer order, lets in-flight writers drain, blocks
later writers, and prevents concurrent deletes from being reinserted from a
stale initializer snapshot. A ten-second lock timeout rolls the whole migration
back for workflow retry. Title initialization preserves the newest observation;
the locked session initialization converges exactly to canonical checkpoint and
identity state. Deep cursors use an indexable timestamp bound plus the strict binary tie
predicate. Recent
session lookup is a requester-leading indexed per-visible-title lateral query
capped at 20 before the visible episodes' latest-session IDs are unioned.
Participant/full-clear deletion cascades only the requester's derived rows.
Session-side checkpoint/identity writes update current member projections, and
hard-room-delete tombstones remove their derived rows.

All observed episodes for each visible title remain exact and untruncated. A
local synthetic account with 501 titles and 13,200 episodes returned a 50-title
page containing 2,376 episode rows and 20 session IDs in 1,455,993 bytes, with
about 21 MiB parser RSS growth. That realistic measurement is not an absolute per-title bound.
Public release therefore remains blocked pending explicit episode pagination or
a separately approved defensible bound.

The migration is not live yet. It must merge/apply and pass migration-history
verification before the separate web consumer PR on staging. Production requires
the same migration-only promotion and successful independent production database
workflow before the runtime promotion.

## Providers

Crunchyroll records the active observed episode after meaningful playback.
Catalog state stays `unavailable`; observed seasons/episodes are not proof of a
complete catalog. YouTube is an explicit browser-local opt-in, off by default,
and accepts only canonical supported long-form playback with actual advancement
or an ended event. The choice is mirrored to the account in the background and
seeds only browsers without their own explicit choice. Shorts, embed, preview,
and route-only observations remain ineligible. An active supported page observes
the local choice directly and resamples immediately; toggling does not require a
page reload or a server response.

## Current Evidence And Remaining Gate

Tasks 0-9 are on staging through `f82fdf6`; v1 HTTP paths now return
`426 UPGRADE_REQUIRED`, while legacy tables remain inert for rollback. A user
confirmed the repaired solo Crunchyroll -> Popup -> staging website path after
PR #188. Task 10 local automation, room/P2P regression, artifact validation, and
staging Worker smoke pass. The corrected local database contract passes 71
pgTAP assertions plus migration-order and concurrency/rollback contracts, and
actual local RPC output passes the production runtime parser.

The full loaded-artifact acceptance matrix is not complete. Two authenticated
profiles on two devices/networks must still verify self-only shared writes,
reconnect/source boundaries, offline terminal replay, deletion fences, account
switch/discard/late-response behavior, cross-device Popup/web equality, YouTube
opt-in, and near-quota terminal preservation before production readiness can be
claimed.

## Rollback

Before destructive cleanup, application rollback is a redeploy of the prior web,
Worker, and extension artifacts. Additive v2 tables/functions and inert v1 tables
remain available; do not delete legacy storage as part of this release closeout.
The bounded-read prerequisite is old-runtime-compatible but not dormant because
its triggers/FK maintain both projections. Use the Watch History forward-cleanup
sequence in `docs/release-and-rollback-runbook.md` if that migration itself must
be removed; canonical progress remains untouched.
