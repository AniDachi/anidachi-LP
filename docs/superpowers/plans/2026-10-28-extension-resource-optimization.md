# Extension resource optimization — October 28, 2026

## Scope and delivery boundary

The owner approved a separate branch from staging, automated checks for YouTube,
Netflix and Crunchyroll, staging delivery and a test ZIP. The owner will perform
authenticated playback acceptance using the ZIP. No production promotion,
Chrome Web Store release, server setting or database change is authorized.

Base: staging `3f251a7cf8f4be488e0651bc565c9289ff05519a`.
Branch: `codex/extension-resource-optimization`.

## Implemented changes

1. The history controller skips an unchanged paused heartbeat only after a
   successful local checkpoint. The comparison includes observation metadata,
   meaningful-progress state and display mode. Failed writes remain retryable;
   source, owner, generation and consent changes reset the comparison.
2. Paused heartbeats no longer renew expired capture leases. Playback wakes
   validation and a fresh baseline immediately; startup, explicit recovery, online and account/choice
   events retain their existing checks. Expired authority never grants capture.
3. Background clients serialize outbox drains per owner and underlying store.
   Each drain rereads durable membership; later work is not hidden behind the
   result of an earlier request. Empty drains do not fetch capture authority.
   Failed requests release the live-worker queue. Capture/access requests have a
   15-second abort deadline so a stalled network cannot hold that queue indefinitely.
   Stable event IDs and durable
   storage continue to protect retry/restart behavior.
4. The popup requests the social directory and room invitations when People is
   visible. A fresh existing 60-second social cache can satisfy that read.
   Explicit refreshes and mutations still fetch canonical data. Meaningful inbox
   changes invalidate the owner's social cache and refresh visible People;
   seen acknowledgements and timestamps alone do not. Inbox catchup, push updates,
   badge counts and seen handling remain independent of People visibility.

## Preserved contracts

- Playing samples keep the existing five-second local cadence and roughly
  one-minute transport cadence. Background playback is not suspended.
- Pause, seek, ended, room leave, source change and page lifecycle checkpoints
  remain explicit events. Ads/seeks are not newly counted as meaningful viewing.
- No history schema, outbox capacity, ACK shape, auth lifetime, entitlement,
  anti-abuse, server endpoint or protocol change.
- No video-adapter, live playback-sync, WebSocket or P2P/media implementation change.
- Account/session, generation, deletion, storage-capacity and recording-consent
  guards remain in place, including around asynchronous responses.
- No new dependencies, permissions, secrets or environment variables.

## Verification

- Extension typecheck passed. Full extension suite initially passed 150 files /
  2,450 tests; the final candidate adds queued-drain logout, offline and stalled
  request regressions (2,453 tests). Final checks are recorded in the PR.
- Protocol typecheck and 245 tests passed.
- API typecheck and 272 tests passed.
- Local room signaling harness: 39/39 scenarios passed.
- Provider suites cover YouTube, Netflix and Crunchyroll histories/adapters;
  shared playback-sync regressions run in the full extension suite.
- New deterministic cases cover an hour paused without periodic renewal,
  resume validation, unchanged/changed checkpoints on all three providers,
  persistence retry, overlapping drains with new work, logout while queued,
  retry after a network error or stalled request, empty queues, lazy People and explicit refresh,
  and owner-scoped cache invalidation without seen-update refetches.

These are controlled tests, not measured production savings. No claim of real
Netflix/Crunchyroll account playback or two-person provider acceptance is made.
Media code is unchanged; room harnesses and CI cover compatibility while live
provider acceptance remains the owner's step.

Before delivery, require `pnpm dev:check`, a narrow staging build, artifact
validation, green PR checks and a verified staging merge. Record commit and ZIP
checksum in the delivery message/PR rather than changing the package for a hash.

Graphify navigation was used before changes. The required AST update was
attempted, but the safe adapter rejected the current extractor's external node
`anidachi_protocol (@anidachi/protocol)` before publication. Semantic extraction
was also performed for this plan; no partial or stale graph is published. The
existing graph/report/manifest are preserved. This tooling incompatibility is
recorded as a documentation-navigation exception, not a product test failure.

## Owner acceptance with the staging ZIP

Use the existing staging extension folder/profile so stored history is retained.
Reload the extension and the provider tabs after updating the extracted files.

On each of YouTube, Netflix and Crunchyroll:

1. Watch, pause, resume, seek and change video/episode. Check recent position and
   completed episode history; YouTube requires its existing recording consent.
2. Leave a playing tab in the background, return and check progress. Leave a
   paused tab for over five minutes, resume and check new progress is captured.
3. Briefly disconnect/reconnect, then reopen the drawer. Progress must recover
   without duplicate entries. Close/reopen the browser and check durable history.
4. With a second participant, check play/pause/seek, late join and reconnect.
   Open People/Inbox and confirm invitations and actions update normally.
5. Switch accounts and check that the previous account's history, people and
   pending actions never appear under the new account.

## Rollback

Revert the staging feature commit and use the previous staging ZIP. There is no
storage migration, so the prior build can read the same durable queue/history.
Do not clear user history, recording choices or trial/anti-abuse data as rollback.
Production and the public Store package remain unchanged until separately approved.
