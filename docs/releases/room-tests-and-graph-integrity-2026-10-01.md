# Room recovery tests and Graphify integrity — October 1, 2026

## Staging delivery

The owner approved delivery after the local work and PR checks. [PR #393](https://github.com/AniDachi/anidachi-LP/pull/393)
merged at 09:42:18 UTC on October 1 as `b42ae31bb189f2eb9ac2d1d5962884653f29e471`.
This section supersedes the local-only delivery status recorded below.

- Vercel `dpl_3CDAmMbiRgjyCR4HWZa7jr118HAv` was verified READY with
  `staging.anidachi.app` assigned to that merge commit.
- [Deploy API](https://github.com/AniDachi/anidachi-LP/actions/runs/36844448593)
  passed and deployed staging version `1f93f027-ebc1-4566-9f1f-07296a99b5f8`.
  The existing `apps/api/**` trigger includes test changes; no Worker production
  implementation changed. Direct `pnpm smoke:worker:staging` passed afterward.
- [Rooms](https://github.com/AniDachi/anidachi-LP/actions/runs/36844458319),
  [P2P](https://github.com/AniDachi/anidachi-LP/actions/runs/36844458305) and
  [post-deploy site smoke](https://github.com/AniDachi/anidachi-LP/actions/runs/36844584535)
  passed for the merged revision. The site smoke verifies the staging gate,
  noindex and sitemap restrictions; this is not new manual media acceptance.
- Before merge, all PR checks passed on `8dcf6706`. The final graph had 14,684
  nodes, 33,142 links and 56 hyperedges; 231 AST and 39 complete document sources
  were verified. No-op refresh left graph/report/manifest byte-identical.
- Main remains `a5a0134e`; PR #376 has no auto-merge. No Stripe, extension
  artifact, database schema or environment configuration changes were made.

## Original local checkpoint

Base: staging `969a7f44`. Owner requested room-test diagnosis first, then graph
repair. Local branch: `codex/room-terminal-recovery`. No production, deployment,
environment, billing or protocol change is included in this work.

## Progress

- [x] Reproduce the terminal-cleanup test's missing completion barrier.
- [x] Correct both manual terminal retry sites and retain strict closure checks.
- [x] Complete runtime verification and independent review.
- [x] Diagnose graph merge loss; prove a lossless update path with regression tests.
- [x] Refresh changed code/docs with source-scoped extraction and endpoint validation.

## Room-test evidence

The flaky test scheduled `setAlarm(Date.now() - 1)`, then called
`runDurableObjectAlarm`. Workerd can start the overdue alarm automatically before
the helper. The installed Cloudflare test pool 0.16.20 checks `getAlarm()` and
returns `false` when the alarm has already been consumed; that return does not
wait for the automatically running handler. A following join can legitimately
observe `409 ROOM_ENDING` before cleanup commits `410 ROOM_ENDED`.

An added delivery assertion failed in 50/50 targeted repetitions on the original
schedule (`false` instead of `true`). Keeping the durable retry deadline due but
scheduling the runtime alarm 60 seconds ahead makes the helper the sole delivery
owner. It executes immediately; no sleep is added. With that correction, 50/50
repetitions passed, including strict 410, durable `runtimeFinalized`, no remaining
alarm, no duplicate Web callback, and 410 after eviction/wake. The second manual
retry loop had the same scheduling race and is corrected too. The permanent
suite keeps one test, not 50 duplicate copies.

A temporary gated automatic-alarm diagnostic crashed local workerd with
`Promise callback destroyed itself`; it was removed and is not the evidence for
the correction. The original one-off test passed before instrumentation, which
is consistent with the previously intermittent CI failure.

Ruling: fix test scheduling, not production closure. No server defect was
demonstrated by this failure. The failure injection, retry path and strict
terminal assertions remain. Production incidents or all room scenarios are not
claimed verified by this narrow diagnosis.

Reference: [Cloudflare test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/#durable-objects)
and the installed `cloudflare/test-internal.mjs` helper implementation.

## Graph evidence

Graphify 0.9.64's no-op `build_merge` changed the baseline from 14,198 nodes /
32,582 links to 14,197 / 32,577. Its filename ghost merge removed the semantic
`20260914063511_room_media_seats_v3.sql` concept from the September 14 media plan.
Its simple graph serialization also collapsed parallel facts and changed
unrelated labels/provenance. Disabling deduplication still rejected node loss.

The repository adapter now merges raw JSON by source and extraction layer. It
uses Graphify's AST extractor/resolver but avoids the lossy NetworkX storage
round-trip. Untouched records retain their content; refreshed sources replace
only their own layer. Deleted symbols retire their incident relationships.
Semantic extraction used the Codex skill and subagents reading full documents,
reusing grounded IDs and rechecking SHA-256 hashes. No provider key or headless
LLM backend was introduced. Code/document navigation is refreshed; this is not
a new audit of decorative images or demo videos.

An independent reviewer accepted the room fix and identified three updater
risks: fresh parallel edges could still collapse, source edits during manifest
creation could receive the wrong stamp, and a nested legacy hyperedge copy could
stay stale. All three were reproduced by four failing regressions, then fixed.
The final Python suite passes 15 tests; the disposable Node integration passes
two. Top-level hyperedges are authoritative, matching upstream read precedence;
the duplicate nested copy is synchronized. The previously lost migration concept
survives the actual refresh.

See [safe update mechanics, limits and commands](../graphify-safe-updates.md).
The report intentionally uses a simple analysis projection with retained
communities; it is not a full re-clustering. Raw relationships remain preserved.

## Validation and delivery

Local verification:

- API runtime suite: 96/96 passed; targeted corrected test: 50/50 repetitions.
- API unit suite: 252/252 passed; API typecheck passed.
- Graphify merge/publication regressions: 15/15 passed.
- Graphify disposable integration: 2/2 passed, including imports, deletions,
  stale-fragment rejection and no-op stability.
- Independent review: three important updater findings corrected; no production
  room change requested by the reviewer.

`pnpm dev:check` classifies the Python tooling as broad impact. The applicable
gate is API test infrastructure plus local graph tooling/docs. Web/extension
builds, live room/media harnesses and Worker deployment are deliberately omitted:
no product, protocol, auth, billing, media, environment or UI implementation
changes. Runtime failure injection covers the touched room-test behavior.

This receipt records local proof, not a staging/main deployment or live-room
acceptance. Rollback is a normal revert of the test/tooling patch and its three
graph artifacts. No Worker redeploy or storage migration is needed. Ignored
backup bundles support recovery from an interrupted local graph publication.
