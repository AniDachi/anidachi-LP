# Watch History v2 Clean MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task by task after explicit
> user approval. Do not begin implementation from this document alone.

**Goal:** Replace the current multi-writer, checkpoint-based Watch History v1
runtime with one compact, account-owned Watch History v2 source of truth shared
by the extension Popup and website, while preserving room playback, P2P, social,
and provider behavior.

**Architecture:** Supabase/Postgres remains the only durable account-history
authority. A single transactional RPC applies each authenticated user's progress
under an account boundary lock. The Cloudflare room Durable Object remains the
live-room authority; a Wave 1 lifecycle audit and threat model must approve the
minimal self-contained signed attestation before any Worker implementation. The
extension background service worker owns one account-scoped cache and bounded-by-
shape outbox; provider/content code only observes playback and enqueues facts.
Popup and web read the same versioned cursor-paginated server contract.

**Tech Stack:** TypeScript, Zod 4, Next.js 15 Route Handlers, Supabase/Postgres,
WXT 0.20/Chrome Manifest V3 storage, Cloudflare Workers/Durable Objects with
hibernatable WebSockets, `jose` HS256 JWTs, Vitest, Node test runner, Playwright
room harness, pnpm 11.2.2, Node 22.23.1.

**Status:** Waves 0-4 and Tasks 8-9 are implemented on `staging` through
`f82fdf6`; the v1 runtime cutover is active and a user confirmed the repaired
solo Crunchyroll -> Popup -> staging website path. Task 10 automated gates are
green locally, but the complete two-profile/two-network manual acceptance matrix
has not been run. The title-page read fix is locally verified in a standalone
additive migration followed by a separate web consumer commit; neither has been
deployed. Because all observed episodes for a visible title remain intentionally
exact and untruncated, the payload is not absolutely bounded and public release
remains blocked. Production promotion and legacy cleanup remain stopped.

## Execution Waves And Mandatory Stops

The tasks are executed only in these reviewable waves. Passing a wave does not
authorize the next one; each stop requires explicit user approval.

| Wave | Tasks | Deliverable | Mandatory stop |
| --- | --- | --- | --- |
| Approval preflight | Task 0 | Feature branch created from the approved baseline; the new master plan, old-plan supersession marker, and plans index committed together | Stop if branch ancestry, worktree ownership, baseline checks, or the three-file documentation scope differs from the recorded state. |
| Wave 1 | Tasks 1-2 | Room-lifecycle audit, threat model, and versioned protocol contracts only | Stop before any database migration, Worker runtime, web route, or extension runtime change. |
| Wave 2 | Tasks 3-4 | Additive Supabase foundation and authenticated v2 web API, with v1 still active | Stop before any extension begins publishing v2 progress. |
| Wave 3 | Tasks 5-6 | Background cache/outbox plus meaningful solo Crunchyroll and opted-in YouTube progress | Stop with shared-room history still suppressed and v1 UI/cutover unchanged. |
| Wave 4 | Task 7 | Worker attestation and shared-room publication, only if the Wave 1 authority gate passed | Stop before Popup/web cutover or disabling v1. |
| Wave 5 | Tasks 8-10 | Popup/web read-model switch, clean pre-release cutover, and staging proof | Stop before production promotion, legacy-table deletion, or catalog expansion. |

## Global Constraints

- Preserve the approved Watch History design from Git commit `d009c8db` except
  for the four corrections recorded below. This plan supersedes the oversized
  implementation plan in `8d788e06`; it does not reopen unrelated product rules.
- Reuse the saved protocol foundation in `b208c4ae`, then close its known room-
  proof and account-generation gaps before any runtime consumer changes.
- Treat `e818d0c4` as the current Crunchyroll catalog evidence gate: active-episode
  identity is proven; a complete series catalog is not.
- Keep Supabase as durable account state, the Worker Durable Object as live-room
  state, the extension as provider observer/cache/outbox, and
  `packages/protocol` as the cross-plane contract owner.
- Do not introduce Supabase Realtime, another database, a queue service, a
  persistent background socket, a generic event platform, or frequent polling.
- Do not change playback sync, P2P media, room admission, friends, groups,
  invites, inbox, pricing, or the in-player visual design.
- Do not touch or merge the unfinished `codex/popup-visual-foundation` worktree.
  The Popup integration task begins only after that work is either merged to
  `staging` or the user explicitly chooses a conflict-resolution path.
- Use feature branch -> PR -> staging -> tested promotion PR -> main. Never push
  directly to `main`. Every deployment or database application still requires
  the normal review and environment gates.
- Run Graphify read-only for navigation before wide changes and update the graph
  only after approved implementation changes. Verify graph claims against source.
- Keep all service-role credentials and JWT secrets server-side. Never log raw
  access tokens, room tokens, history attestations, cookies, provider responses,
  private URLs, emails, or full user IDs.

## Verified Baseline (2026-08-14)

| Source | Confirmed fact used by this plan |
| --- | --- |
| Current checkout `07114402` | Clean detached checkout exactly matching `staging`; Watch History v2 runtime is absent. |
| `apps/extension/src/overlay-app.tsx` | Local progress is saved about every five seconds and remote reconcile is attempted about every 60 seconds; pause, seek, ended, and pagehide force a request. There is no durable outbox. |
| `apps/extension/src/popup-app.tsx` | Popup can also reconcile local records, creating a second client writer path. |
| `apps/web/lib/anidachi-auth/watch-library.ts` | Reconcile performs multiple non-atomic writes, appends checkpoints, can populate other room participants, applies plan retention/title limits, and clears history through separate deletes. |
| `20260626_watch_library.sql` | v1 stores `watch_sessions`, participants, append-only checkpoints, and tracked titles. |
| `20260808_social_atomicity.sql` | `Recent people` currently depends on watch checkpoints. |
| Room protocol/Worker | The Durable Object owns `roomGeneration` and `sourceGeneration`; JOIN already carries a stable `participantSessionId`; hibernation attachments preserve verified identity and that session ID. |
| Web room token | It is a 30-minute connection credential issued before the Durable Object knows the participant's current room/source generations. |
| Persisted room lifecycle | `rooms` persists status and `ended_at`; `room_members` persists durable membership and `joined_at`. The database does not persist live connection/leave intervals, `participantSessionId`, room/source-generation history, or source-transition times. No cleanup policy may be assumed until Wave 1 audits every delete/retention path on the then-current branch. |
| YouTube adapter | Current progress accepts ordinary video IDs without an account preference or meaningful-playback gate. |
| Extension manifest | The store-safe extension has `storage` but not `unlimitedStorage`; current Chrome `storage.local` quota therefore applies. |
| Saved v2 commits | Approved design, implementation context, Crunchyroll evidence gate, and strict protocol contracts exist only in local Git commits and are not deployed runtime. |

## Corrected Decision Ledger

| Decision | Considered options | Recommendation | Why | MVP impact |
| --- | --- | --- | --- | --- |
| Shared-room proof | Add generations to the initial room token; reissue the room token; issue a self-contained signed Worker proof; persist a compact room-authority lifecycle ledger | Keep the current room token unchanged. The default minimal choice is a private self-contained `room_history` attestation after verified JOIN and each source change, using the existing signing secret with strict `typ`/issuer/audience separation, but it is authorized only if the Wave 1 lifecycle/threat gate passes. If it fails, stop and amend this plan before adding a compact authority ledger. | The web cannot know Durable Object generations when it creates the connection token. The signed proof establishes participant/session/generations at issuance; persisted room rows can establish only room, durable membership, join/end bounds. A separate key improves trust separation, but pre-release MVP does not add that configuration unless the threat model finds the shared-key boundary unacceptable. | Happy path remains one additive private event and no new service. The gate prevents falsely claiming that current database rows prove session/generation history; a ledger is not added speculatively. |
| YouTube meaningful progress | Duration/elapsed thresholds; route-only eligibility; actual playback evidence | Require account opt-in, canonical long-form `/watch`, stable video ID, supported surface, valid media values, and either observed non-seeking playback advancement while playing or `ended` | No arbitrary video-length or watched-time threshold is defensible. Actual advancement answers whether playback really happened. | Small provider policy plus a provider-neutral controller; 60 seconds remains only a transport heartbeat interval. |
| Receipts/outbox | Time/count limits invented in client code; unbounded queue; structurally coalesced queue | Keep receipts exactly 14 days. Keep at most `pendingTerminal + latest` per logical session/episode key, remove acknowledged entries immediately, use actual Chrome byte accounting, and define explicit storage-full behavior. | This matches the saved plan and avoids unsupported limits. Idempotency state is bounded by time; local retry state is bounded by its shape and browser quota. | No cron and no outbox TTL. Overflow triggers flush/coalescing, preserves an existing terminal event, then pauses new capture with a retryable visible error if storage still cannot accept the write. |
| Migration strategy | Full compatibility/backfill; destructive replacement; clean pre-release cutover | Use an additive foundation and separately deployed v2 Recent People RPC, then a coordinated logical runtime cutover: import no v1 test history, stop v1 writers/readers together, retain the legacy function and tables read-only for rollback, and delete them only in a later separately approved cleanup. | The product is pre-release and existing history is test data. Dual reads, union history, backfill, and long-lived adapters add risk without user value; immediate function/table replacement weakens deploy ordering and rollback. | Empty v2 history is acceptable. The additive RPC can deploy while v1 remains live; after acceptance, old extension builds receive `UPGRADE_REQUIRED` and the current staging artifact and website move together. |

## Final MVP Boundary

The first releasable v2 slice includes:

- one canonical episode resume row per account/provider/title/episode;
- meaningful solo and shared sessions without technical checkpoint history;
- each participant writing only their own progress;
- deterministic retry, idempotency, ordering, account-generation fencing, and
  deletion fencing;
- episode, title, and full-history deletion;
- account-wide YouTube preference, off by default;
- identical overlapping values in Popup and website;
- cursor pagination and independent recent-person evidence;
- offline cache/outbox recovery with no background polling;
- Crunchyroll and YouTube observed progress using provider-owned eligibility.

The first slice deliberately does not implement a Crunchyroll catalog collector,
exact series/season denominators, or canonical next-episode selection. Until a
real sanitized authenticated fixture proves completeness, responses use
`catalogState: "unavailable"`, exact denominators are `null`, and `nextEpisode`
is `null`. Observed season/episode grouping and per-episode progress still work.

## Canonical Runtime Flow

```txt
provider adapter
  -> provider history policy
  -> meaningful-progress controller
  -> account-scoped local cache + coalescing outbox
  -> extension background (the only client network writer)
  -> authenticated Next.js v2 route
  -> room-history attestation verification when shared
  -> one transactional Postgres RPC
  -> canonical v2 read model
  -> Popup and website
```

For shared viewing only:

```txt
web room token -> Worker verifies WebSocket -> JOIN with participantSessionId
  -> Worker reads current room/source generations
  -> private ROOM_HISTORY_AUTHORITY event
  -> progress event carries the opaque signed attestation
  -> web verifies purpose, signature, user, session, generations, and room lifecycle
```

## Data And Conflict Rules

- The authenticated web session supplies the user ID. No client `userId` is
  accepted as ownership authority.
- The core MVP write allowlist is `crunchyroll|youtube`. Netflix/Amazon remain
  presentation placeholders until their adapters receive the same evidence-first
  preflight; the v2 route rejects their progress rather than guessing identities.
- The existing v2 protocol name `accountGeneration` maps exactly to database
  `history_generation`; this plan calls the concept the history generation. It is
  server-owned and included in every v2 response, progress event, delete request,
  cache partition, and outbox partition.
- Full clear increments the history generation; all older cached/outbox events are
  rejected and discarded after canonical refresh.
- `clientEventId` is checked first as the idempotency key after the account
  boundary is locked. An in-window duplicate returns its stored acknowledgement
  and performs no ordering, session, progress, or recent-person mutation. If a
  full clear has since advanced generation, the old acknowledgement remains
  historically exact and the client rejects it for cache application, then
  refreshes the current generation.
- For a new event, the server captures `serverAcceptedAt`, computes
  `normalizedObservedAt = min(parsedClientObservedAt, serverAcceptedAt)`, and
  validates generation and deletion fences before allocating order. This blocks
  far-future clock poisoning without inventing a skew threshold.
- Each account settings row owns `nextServerOrder`. The transaction increments it
  while holding the same account boundary lock, so every accepted new event gets
  a unique per-account `serverOrder`. The stored comparison tuple is exactly
  `(normalizedObservedAt, serverOrder)`. `clientEventId` is only the idempotency
  key and is not part of conflict ordering.
- An event older than the stored `normalizedObservedAt` is stale. Equal normalized
  time is resolved by the newly allocated server order. A newer tuple may move
  resume position backward after an intentional seek; simple `max(progress)` is
  forbidden. Late offline/pagehide delivery cannot overwrite a newer tuple.
- Episode/title delete upserts a durable scope fence in the current generation.
  Only events with `normalizedObservedAt > deletedAt` may create fresh history;
  later activity never deletes or clears that fence. Repeated deletion moves the
  fence forward. Fences cascade with account deletion and may be removed only
  atomically after a full history-generation change makes the old generation
  permanently inadmissible.
- `min(client, server)` corrects only future-skewed timestamps; it cannot prove
  chronology when a device clock is behind the server. For episode/title deletion,
  genuine later playback whose client time still normalizes to `<= deletedAt` is
  safely rejected as indistinguishable from queued pre-delete work. MVP accepts
  this false rejection rather than adding clock-offset state, client sequencing,
  or a weaker resurrection fence. Full clear is primarily fenced by the new
  account generation, so this residual risk does not weaken rejection of old-
  generation work.
- Stable `clientEventId`/`clientMutationId` values survive retries. Receipts keep
  the exact canonical acknowledgement for 14 days and are removed opportunistically
  inside later write transactions; no receipt cleanup cron is added.
- Completion becomes durable on `ended` or progress at least 90%, as already
  approved. Later rewatch/seek can move resume position but cannot unset
  `completedAt`; no rewatch journal is created.
- A solo session uses the approved `clientSessionKey` recovery boundary. A shared
  session key is `(roomId, roomGeneration, sourceGeneration)` and is reused by
  reconnecting participants.
- Shared writes update only the authenticated participant row. Compact recent-
  person evidence is written only after two independently authenticated users
  have accepted progress in the same attested shared session.
- `recent_people_evidence` has one directional row per user pair, not per room:
  `(user_id, other_user_id)` plus `last_room_id` and `last_watched_at`. The latter
  is the server time of the write that confirms both participants in the shared
  session, never either device's observation time. No shared-room counter is
  stored, inferred, synthesized as `1`, or promised by the v2 UI.
- Room end/source change/leave close the relevant meaningful session without
  deleting it. Delayed offline terminal delivery may still be accepted for an
  ended room when its attestation was issued during the valid room lifecycle.

## Outbox And Storage Contract

The outbox key is:

```txt
userId + historyGeneration + provider + titleKey + episodeKey + clientSessionKey
```

Each key has exactly two optional slots:

1. `pendingTerminal`: one stable unacknowledged `ended` event, never silently
   replaced or discarded;
2. `latest`: the newest non-terminal state (`heartbeat`, `pause`, `seek`,
   `source_change`, `pagehide`, `room_leave`, or `room_end`).

Acknowledgement removes the matching slot immediately. Superseded non-terminal
states are replaced in place; technical observations never accumulate as a list.
There is no outbox age expiry and no global record-count constant.

Write admission uses the runtime `chrome.storage.local.QUOTA_BYTES`,
`chrome.storage.local.getBytesInUse(null)`, and the UTF-8 serialized candidate
delta. The admission estimate is
`allBytes - currentPartitionBytes + nextSerializedPartitionBytes <= QUOTA_BYTES`;
tests include the storage key bytes as well as its value. Because browser
accounting is authoritative, a failed `set` is handled as quota exhaustion even
when the estimate fit. On exhaustion:

1. request an immediate authenticated flush;
2. remove acknowledged and superseded non-terminal state;
3. retry the same write once;
4. if it still fails, retain any already-stored terminal event, reject the new
   capture as not durable, set `storage-full`, and show a retry action in Popup;
5. resume capture only after a successful flush or measured free space.

No `unlimitedStorage` permission is added for MVP. Near-quota tests must seed
unrelated extension storage and verify that history never clears another feature's
keys.

## Failure And Account-Switch Behavior

- When offline, Popup projects the last server-confirmed cache together with the
  current-owner local observation and outbox. Website keeps its last rendered
  response and offers retry; neither surface claims pending data is server-confirmed.
- Popup presentation is seamless and local-first: a valid same-owner/same-generation
  Crunchyroll observation appears immediately as a normal history card before the
  meaningful gate or network bootstrap completes. The user is not shown routine
  `pending`, `syncing`, or acknowledgement terminology. Source/page exit removes
  non-meaningful transient activity; meaningful outbox work remains projected until
  canonical history catches up. Only a real storage/save failure gets a visible
  recovery state. Server eligibility, cadence, and acknowledgement rules remain
  unchanged. Cached startup authority keeps YouTube disabled until canonical
  preferences load for the current startup.
- Flush is event-driven: enqueue, browser `online`, valid auth refresh, service
  worker startup/install, Popup/manual refresh, and content-script reconnect.
  No periodic background alarm is introduced.
- On sign-out or account change, old-account confirmed cache, preferences, and
  current observation are hidden and deleted immediately because the server can
  rebuild them. A final flush is attempted only while the old access token and
  owner generation are still valid. Only unacknowledged outbox slots may remain
  in a dormant owner/generation partition; an empty partition is removed.
- On another account, the old partition is inaccessible and no event is sent with
  the new token. On the same account's later sign-in, fetch canonical generation
  first, discard older generations, then resume matching pending work.
- Dormant pending partitions have no silent TTL or count eviction. If they consume
  the remaining quota, capture enters `storage-full` and offers owner-safe actions:
  sign back into the prior account to flush, or explicitly discard its unsent
  partition after a destructive confirmation. The current account never sees the
  prior account's titles, URLs, progress details, or authority token.
- Late responses are ignored unless owner ID, local request generation, and server
  `accountGeneration` still match.
- Explicit destructive actions are online-only in MVP. UI changes only after the
  delete acknowledgement; failures preserve the visible canonical record.

## Task 0: Approved Execution Preflight

**Files:** Documentation only.

- Add: `docs/superpowers/plans/2026-08-14-watch-history-v2-clean-mvp-implementation.md`
- Modify: `docs/superpowers/plans/2026-08-13-watch-history-catalog-progress-implementation.md`
- Modify: `docs/superpowers/plans/README.md`

**Interfaces:** Establishes a safe branch and immutable baseline only after the
user approves implementation.

- [ ] **Step 1: Reconfirm the saved chain and latest staging**

  Run read-only checks:

  ```bash
  git status --short --branch
  git rev-parse HEAD staging origin/staging b208c4ae
  git merge-base --is-ancestor staging b208c4ae
  git worktree list --porcelain
  ```

  Expected now: current `staging`, `origin/staging`, and checkout are `07114402`;
  `b208c4ae` descends from that baseline; the stale `/private/tmp` registration is
  not modified.

- [ ] **Step 2: Create the runtime branch only after approval**

  If `staging` is still an ancestor of `b208c4ae`, create
  `codex/watch-history-v2-runtime` at `b208c4ae` in the current Codex worktree.
  If staging moved, create the branch from latest staging and replay only the four
  reviewed commits `d009c8db`, `8d788e06`, `e818d0c4`, `b208c4ae` in order.
  Do not switch, prune, or modify any other worktree.

- [ ] **Step 3: Make the plan authority unambiguous**

  Before changing any runtime, make exactly three documentation changes:

  1. add this reviewed master plan;
  2. directly below the old plan's title, add this marker with a relative link:

     ```markdown
     > **Status: Superseded.** Do not execute this plan. It is retained as
     > historical context and is replaced by
     > [Watch History v2 Clean MVP Implementation Plan](./2026-08-14-watch-history-v2-clean-mvp-implementation.md).
     ```

  3. add `2026-08-14-watch-history-v2-clean-mvp-implementation.md` to the top of
     `Current active execution plans` in `docs/superpowers/plans/README.md`. Do not
     list the superseded 2026-08-13 plan as active.

  Verify the exact documentation scope, then commit it:

  ```bash
  git status --short
  git add docs/superpowers/plans/2026-08-14-watch-history-v2-clean-mvp-implementation.md \
    docs/superpowers/plans/2026-08-13-watch-history-catalog-progress-implementation.md \
    docs/superpowers/plans/README.md
  git diff --cached --check
  git diff --cached --name-only
  git commit -m "docs(history): approve clean watch history v2 plan"
  ```

  Expected before staging: `git status --short` lists only the three documentation
  paths above. Expected after staging: the cached whitespace check is silent and
  the cached name-only output contains exactly those three paths. Expected after
  commit: the new plan is no longer an untracked detached-worktree artifact, the
  old plan is visibly non-executable, README has one active Watch History plan,
  and the commit contains no runtime, migration, generated graph, secret, or
  unrelated file.

- [ ] **Step 4: Establish toolchain and baseline evidence**

  Run:

  ```bash
  fnm exec --using="$(cat .node-version)" node --version
  fnm exec --using="$(cat .node-version)" pnpm --version
  pnpm dev:check
  pnpm --filter @anidachi/protocol test
  pnpm --filter @anidachi/protocol check
  ```

  Record failures as baseline; do not hide or repair unrelated failures in this
  feature.

## Task 1: Audit Room Lifecycle And Approve The Authority Boundary

**Required sub-skill for execution:** Use `codex-security:threat-model` for this
task. This task is documentation and read-only source inspection only.

**Files:**

- Create: `docs/superpowers/specs/2026-08-14-watch-history-room-authority-threat-model.md`
- Modify: this plan only if the recorded gate outcome changes its approved path

**Interfaces:** Produces the signed-attestation security boundary and a binary
go/no-go gate consumed by Tasks 2, 4, and 7. It creates no schema or runtime.

- [ ] **Step 1: Re-audit every persisted room-lifecycle path**

  On the approved feature branch, trace room creation, membership insertion,
  membership removal, room finalization, account deletion cascades, and every
  cleanup/retention job against the then-current source. Start with:

  ```bash
  rg -n "create table.*rooms|room_members|ended_at|delete.*rooms|delete.*room_members|cleanup|retention" \
    apps/web/supabase/migrations apps/web/lib apps/web/app
  rg -n "participantSessionId|roomGeneration|sourceGeneration|SOURCE_CHANGED|serializeAttachment" \
    apps/api packages/protocol apps/web
  ```

  Record exact files and migration identifiers. Confirm or reject each current
  baseline fact: durable room row, durable member row with `joined_at`, reliable
  terminal `ended_at`, no live leave interval, no persisted participant session,
  no generation/source-transition history, and no automatic room/member deletion.

- [ ] **Step 2: Write the bounded threat model**

  Document assets, actors, trust boundaries, claims, verification order, replay
  cases, delayed offline delivery, source change, leave/end, hibernation restore,
  key compromise, logging/redaction, and account/history deletion. State exactly:

  - ordinary room tokens are connection credentials and never verify as history;
  - the attestation proves only that its subject/session/generations were current
    in the Durable Object at issuance;
  - database rows prove room existence, durable host/membership, join lower bound,
    and end upper bound only; they do not independently prove participant session,
    live presence, generation history, or source identity;
  - the authenticated user can mutate only their own history; recent-person
    evidence additionally requires a second independently accepted participant;
  - delayed delivery has no invented age cutoff, so room/member rows used as
    lifecycle evidence must not be automatically removed while this contract is
    supported;
  - the MVP default uses the existing server secret with strict
    `typ: room_history`, issuer `anidachi-worker`, and audience
    `anidachi-web-history`; a separate or asymmetric key is documented as stronger
    isolation, not falsely described as providing no protection.

- [ ] **Step 3: Apply the binary authority gate**

  Approve the self-contained attestation path only if all of these are proven and
  accepted in the threat-model review:

  1. room and member evidence is retained for the supported delayed-delivery
     contract, with no unreviewed cleanup path;
  2. room `created_at` for the host, member `joined_at`, and final `ended_at`
     provide reliable issuance bounds;
  3. strict signature/claim matching plus authenticated self-only writes contains
     the residual risk created by absent connection/source-generation history;
  4. shared recent-person evidence cannot be created from only one participant;
  5. shared-key compromise scope is acceptable for pre-release MVP.

  If every condition passes, record `SELF_CONTAINED_ATTESTATION_APPROVED` with the
  evidence and proceed to Task 2. If any condition fails, record
  `AUTHORITY_LEDGER_REQUIRED`, stop Wave 1 immediately, and amend this master plan
  under separate review with the smallest durable lifecycle record. Do not create
  that table, Worker writer, migration, or provisional protocol in this task.

- [ ] **Step 4: Validate and commit the audit artifact**

  ```bash
  rg -n "SELF_CONTAINED_ATTESTATION_APPROVED|AUTHORITY_LEDGER_REQUIRED" \
    docs/superpowers/specs/2026-08-14-watch-history-room-authority-threat-model.md
  git diff --check
  git add docs/superpowers/specs/2026-08-14-watch-history-room-authority-threat-model.md
  git commit -m "docs(security): define watch history room authority"
  ```

  Expected: exactly one gate outcome appears, every factual claim links to current
  source, and no runtime/schema file is changed.

## Task 2: Close The Versioned Protocol Before Runtime Changes

**Files:**

- Modify: `packages/protocol/src/watch-history.ts`
- Modify: `packages/protocol/src/types.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/test/watch-history.test.ts`
- Modify: `packages/protocol/test/protocol.test.ts`

**Interfaces:** Produces all strict v2 HTTP schemas plus the additive private
Worker-to-participant authority event. v1 exports remain unchanged through cutover.

**Gate:** Begin only after Task 1 records
`SELF_CONTAINED_ATTESTATION_APPROVED`. Otherwise Wave 1 is stopped and this
protocol shape is not implemented.

- [ ] **Step 1: Add failing corrected-contract fixtures**

  Tests must reject the saved `{ roomId, sourceGeneration }` proof and accept only
  shared progress containing matching:

  ```ts
  {
    roomId,
    participantSessionId,
    roomGeneration,
    sourceGeneration,
    attestation
  }
  ```

  Add cases for wrong purpose/audience shape, mismatched generation, missing
  participant session, oversized opaque token, old account generation, strict
  unknown fields, cursor round-trip, YouTube preference default false, and all
  deletion scopes.

- [ ] **Step 2: Correct the watch-history schemas**

  Keep the saved catalog/read schemas so `catalogState: "unavailable"` is explicit,
  but replace `WatchSharedRoomProofSchema` with
  `WatchSharedRoomAuthoritySchema`. Add `accountGeneration` to
  `WatchHistoryResponseMetaSchema`, so list and preference responses can fence
  caches without a second request.

  Keep `WatchProgressEventSchema` self-only: it has no writable participant list
  or `userId`. Retain stable event IDs, client session key, account generation,
  provider/title/episode identity, progress, observation time, event kind, and
  optional shared authority.

  Do not add `clientSequence` without a separate durable per-session high-water
  mark. Do not add `sharedRoomCount` to any v2 schema. The existing social v1
  field remains untouched until the coordinated cutover in Task 9.

- [ ] **Step 3: Add the private room authority server event**

  Add strict `ROOM_HISTORY_AUTHORITY` to `ServerEventSchema` with the four visible
  matching fields and one bounded opaque attestation string. It is a server event,
  never a client command. Existing clients already ignore an unknown strict event
  without closing the socket, so Worker-first deployment stays compatible.

- [ ] **Step 4: Run protocol gates**

  ```bash
  pnpm --filter @anidachi/protocol test
  pnpm --filter @anidachi/protocol check
  ```

  Expected: all v1 protocol tests and new v2/authority fixtures pass.

- [ ] **Step 5: Commit the protocol closure**

  ```bash
  git add packages/protocol/src packages/protocol/test
  git commit -m "feat(protocol): close watch history v2 authority contracts"
  ```

## Task 3: Add The Compact Transactional Supabase Foundation

**Files:**

- Create: `apps/web/supabase/migrations/20260814010000_watch_history_v2_foundation.sql`
- Create: `apps/web/supabase/tests/watch_history_v2.test.sql`
- Create: `apps/web/lib/anidachi-auth/watch-history-v2-sql.test.ts`
- Modify: `apps/web/lib/anidachi-auth/social.test.ts`

**Interfaces:** Produces v2-owned episode state, settings, receipts, deletion
fences, independent recent-person evidence, session identity, and transactional
RPCs. It does not backfill or read v1 checkpoints.

- [ ] **Step 1: Write failing migration safety tests**

  Assert the migration is additive; every new table has RLS; every function uses
  `set search_path = ''`; all object names are schema-qualified; execute is
  revoked from `public`, `anon`, and `authenticated`; only `service_role` is
  granted; foreign keys and access paths are indexed; receipts expire at exactly
  14 days; no table is dropped/truncated; no v2 function writes or reads
  `watch_progress_checkpoints`.

- [ ] **Step 2: Create five compact v2 relations**

  Create:

1. `public.user_watch_settings`: `user_id` PK, positive
   `history_generation` default 1, `next_server_order` bigint default 0,
   `youtube_history_enabled` default false, `updated_at`. The locked counter is
   the unique monotonic order boundary for that user; no client supplies it.
2. `public.watch_episode_progress`: PK
   `(user_id, provider, title_key, episode_key)`, observed display/source metadata,
   current/duration/progress, `completed_at`, latest session/event IDs,
   normalized `observed_at`, unique per-user `server_order`, and
   `history_generation`.
3. `public.watch_history_receipts`: PK `(user_id, client_id)`, kind
   `progress|delete`, bounded canonical acknowledgement JSON, `accepted_at`, and
   `expires_at = accepted_at + interval '14 days'`.
4. `public.watch_history_deletions`: UUID primary key, durable
   `all|title|episode` scope columns, history generation, `deleted_at`, and last
   client mutation ID. Checks require exactly the identity columns appropriate to
   the scope. Three partial unique indexes enforce one all-fence per user, one
   title-fence per `(user, provider, title)`, and one episode-fence per
   `(user, provider, title, episode)` without nullable-key ambiguity.
5. `public.recent_people_evidence`: PK `(user_id, other_user_id)`,
   `last_room_id`, `last_watched_at`, and a check that a user cannot reference
   self. It deliberately has no room ledger and no `shared_room_count`.

  Add only the indexes used by current queries: a unique
  `(user_id, server_order)` index, episode lookup, title pagination, receipt
  expiry, deletion-fence lookup, and recent-people ordering/foreign keys.

- [ ] **Step 3: Extend existing product-session summaries additively**

  Add v2 discriminator/generation fields to `watch_sessions` and
  `user_tracked_titles`; add `client_session_key`, `room_generation`, and
  `source_generation` to `watch_sessions`. Add unique partial indexes for v2 solo
  `(host_user_id, client_session_key)` and shared
  `(room_id, room_generation, source_generation)` session identities. Existing v1
  rows retain discriminator 1 and are not imported into v2 reads.

- [ ] **Step 4: Implement `apply_watch_progress_v2`**

  `public.apply_watch_progress_v2(p_user_id uuid, p_event jsonb,
  p_room_authority jsonb)` runs as one short transaction. It must:

1. capture transaction `serverAcceptedAt` and lock/ensure the user's settings row;
2. opportunistically delete only receipts whose `expires_at` passed;
3. look up `(p_user_id, clientEventId)` and return its exact acknowledgement
   immediately when present, before any generation/order/session mutation;
4. reject account-generation mismatch for a new event;
5. validate provider/domain and trusted decoded authority consistency;
6. compute `normalizedObservedAt = least(parsed observedAt, serverAcceptedAt)`;
7. verify room existence, durable host/membership, host
   `room.created_at <= authority.iat` or member
   `room_members.joined_at <= authority.iat`, and, for an ended room,
   `authority.iat <= ended_at`; treat participant session and generations as
   signed Worker claims, not facts reconstructed from the DB;
8. reject an applicable deletion fence unless
   `normalizedObservedAt > deleted_at`; never clear a fence on accepted playback;
9. reject a normalized observation older than canonical episode state;
10. increment locked `next_server_order` and assign the resulting unique value;
11. compare/store `(normalizedObservedAt, serverOrder)`, allowing a newer tuple to
    move resume backward intentionally; use `clientEventId` only for Step 3
    idempotency and never as ordering input;
12. resolve one solo or shared meaningful session and upsert only `p_user_id` as
    participant;
13. after a second distinct self-owned participant write confirms the same shared
    session, upsert both directional recent-person rows with `last_room_id` and
    `last_watched_at = greatest(existing, serverAcceptedAt)`; duplicate receipts
    never repeat this derivation;
14. update canonical episode/title state without plan limits/checkpoint inserts;
15. preserve `completed_at`, then store and return the bounded canonical receipt.

- [ ] **Step 5: Implement preference and atomic deletion RPCs**

  Add service-role-only `set_watch_preferences_v2` and
  `delete_watch_history_v2`. Deletion locks the same account boundary, dedupes its
  mutation ID, and uses server transaction time as `deleted_at`. Episode/title
  deletion upserts the matching current-generation fence with the later timestamp,
  removes only the authenticated user's episode/title/participant rows, and never
  clears that fence when later playback is accepted. It preserves other
  participants/shared session rows and all recent-person/social data, removing
  orphan sessions only after references disappear. Full clear atomically advances
  `history_generation`; only after old-generation events are permanently rejected
  may it remove now-irrelevant old-generation fences. Account deletion cascades
  settings, receipts, progress, fences, and evidence under existing account rules.

- [ ] **Step 6: Run static/database gates and commit**

  ```bash
  pnpm --filter @anidachi/web test -- watch-history-v2-sql.test.ts social.test.ts
  pnpm --filter @anidachi/web check
  supabase --workdir apps/web db reset --local --no-seed
  test -f apps/web/supabase/tests/watch_history_v2.test.sql
  supabase --workdir apps/web test db --local  # require Files=1, never NOTESTS
  supabase --workdir apps/web db lint --local --schema public --level warning --fail-on error
  supabase --workdir apps/web db push --local --dry-run
  git add apps/web/supabase/migrations/20260814010000_watch_history_v2_foundation.sql \
    apps/web/supabase/tests/watch_history_v2.test.sql \
    apps/web/lib/anidachi-auth/watch-history-v2-sql.test.ts \
    apps/web/lib/anidachi-auth/social.test.ts
  git commit -m "feat(web): add watch history v2 storage"
  ```

  If the pinned Supabase CLI is unavailable locally, keep the PR draft until the
  repository's pinned staging migration workflow reports the same dry-run.

## Task 4: Add The Authenticated V2 Web Service And Routes

**Files:**

- Create: `apps/web/lib/anidachi-auth/watch-history-authority.ts`
- Create: `apps/web/lib/anidachi-auth/watch-history-v2.ts`
- Create: `apps/web/lib/anidachi-auth/watch-history-v2-routes.ts`
- Create: `apps/web/lib/anidachi-auth/watch-history-authority.test.ts`
- Create: `apps/web/lib/anidachi-auth/watch-history-v2.test.ts`
- Create: `apps/web/lib/anidachi-auth/watch-history-v2-routes.test.ts`
- Create: `apps/web/app/api/watch-history/v2/route.ts`
- Create: `apps/web/app/api/watch-history/v2/progress/route.ts`
- Create: `apps/web/app/api/watch-history/v2/preferences/route.ts`
- Create: `apps/web/app/api/watch-history/v2/delete/route.ts`
- Create: `apps/web/app/api/watch-history/v2/rooms/route.ts`

**Interfaces:** Authenticates cookie or extension bearer sessions, verifies strict
protocol values, verifies Worker authority for shared writes, invokes only the
transactional RPC writer, and builds one canonical read response.

**Gate:** Shared-authority verification follows the exact Wave 1 threat-model
outcome. Wave 2 may ship the verifier and routes behind unused shared input, but
it does not authorize Worker publication or shared extension writes.

- [ ] **Step 1: Write route/auth failure tests**

  Cover missing/invalid auth, malformed JSON, extra fields, oversized input,
  unsupported provider, provider/domain mismatch, wrong authority
  signature/purpose/audience/user/
  session/generation, unknown room, non-member, authority issued after room end,
  authority issued before durable join, duplicate event/delete, stale generation,
  older normalized observation, same-time server ordering, deletion fence, future
  client time normalization, and stable error codes. Prove episode/title playback
  with `normalizedObservedAt > deletedAt` creates new history without clearing the
  fence. Add a negative-clock-skew case where genuine post-delete playback has
  `normalizedObservedAt <= deletedAt`: it must return stable `DELETED_HISTORY`
  without clearing the fence or recreating history. Never return raw token or SQL
  details.

- [ ] **Step 2: Verify purpose-bound authority**

  Use the existing server JWT secret to verify HS256, issuer
  `anidachi-worker`, audience `anidachi-web-history`, and
  `typ: room_history`. Match the decoded subject and all visible shared fields to
  the authenticated request. Pass only the validated claims to the service-role
  RPC. Do not accept the ordinary room token on this route. Use the existing
  server secret only because Task 1 approved that exact trust boundary; do not
  claim the DB independently verifies participant session or generations.

- [ ] **Step 3: Implement the one progress writer route**

  `POST /api/watch-history/v2/progress` parses one `WatchProgressEvent`, derives
  user identity from `getApiSession`, enforces the Crunchyroll/YouTube MVP
  allowlist and canonical HTTPS origins, verifies shared authority when present,
  invokes `apply_watch_progress_v2` once, and parses the returned
  `WatchProgressAck`. Popup/content code never calls Supabase directly.

- [ ] **Step 4: Implement read and preference routes**

  `GET /api/watch-history/v2` uses opaque base64url cursor data for
  `(lastWatchedAt, provider:titleKey)`, accepts 1-100 items, and returns
  `totalTitleCount`, `nextCursor`, current generation, observed seasons/episodes,
  and meaningful sessions. Popup requests a recent subset; website follows
  cursors. With no proven catalog, aggregate denominators/progress and next episode
  remain null exactly as the strict schema requires.

  `GET/PATCH /api/watch-history/v2/preferences` returns/updates only the account's
  YouTube flag and current generation. Missing settings are created with false.

- [ ] **Step 5: Implement deletion and room recreation**

  `POST /api/watch-history/v2/delete` invokes the atomic delete RPC and returns the
  canonical generation/fence acknowledgement. `POST
  /api/watch-history/v2/rooms` reuses existing room entitlement/quota logic and
  recreates a room only from a v2 session visible to the requester.

- [ ] **Step 6: Run web service gates and commit**

  ```bash
  pnpm --filter @anidachi/web test -- watch-history-authority.test.ts \
    watch-history-v2.test.ts watch-history-v2-routes.test.ts
  pnpm --filter @anidachi/web check
  git add apps/web/lib/anidachi-auth/watch-history-* \
    apps/web/app/api/watch-history/v2
  git commit -m "feat(web): add canonical watch history v2 API"
  ```

### Wave 2 local PostgreSQL acceptance — 2026-08-14

- PostgreSQL 17 replayed the complete 21-migration chain from an empty local
  Supabase database. A separate reset to `20260810190000` proved the pre-v2
  rollback boundary; local dry-run then listed only
  `20260814010000_watch_history_v2_foundation.sql`, and forward push succeeded.
- The real database gate passes 34 pgTAP assertions for schema privileges/RLS,
  RPCs, receipts, deletion fences, shared two-writer evidence, hard room
  deletion, account-generation clearing, and late-failure transaction rollback.
  Eight concurrent same-account events produced eight distinct receipts,
  server orders 1-8, one canonical episode row at order 8, and no deadlock.
- Revalidating the two broadened season constraints over 100,000 synthetic rows
  took about 8.3 ms and 4.9 ms locally. The migration now uses `NOT VALID` plus
  `VALIDATE CONSTRAINT` so the full scan does not retain the initial
  `ACCESS EXCLUSIVE` DDL lock. Staging still needs its own dry-run and lock/size
  observation before deployment.
- The original GET remained exact but loaded the complete account
  progress/session snapshot before title pagination. A synthetic in-process probe took about
  123 ms and 209 MiB total RSS for 50,000 rows, and 230 ms and 292 MiB for
  100,000 rows, excluding PostgREST transfer and session enrichment. This is an
  explicit pre-release, test-volume-only acceptance. Task 10 now removes the
  full-account episode aggregation with a canonical one-row-per-title projection:
  `list_watch_history_v2_page` keyset-selects the requested title page before
  transporting its progress rows. Session enrichment is the latest 20 sessions
  per title from a compact requester-owned `(user, session)` projection plus
  each visible episode's latest session. A shared session's host-owned generation
  is not compared with the viewer's account generation. The additive RPC and
  66-assertion pgTAP contract are isolated from the runtime consumer so the
  database prerequisite can deploy first. All episodes for a visible title are
  still exact and untruncated; a 501-title/13,200-episode local probe returned
  2,376 episode rows plus 20 session IDs (1,455,993 bytes) for a 50-title page
  with about 21 MiB parser RSS growth. This does not establish an absolute bound, so public release
  remains blocked. Do not describe the fix as live until the prerequisite and
  consumer have passed staging in order.
- Local PostgreSQL acceptance closes the Wave 2 source/integration gate only.
  Staging migration dry-run and two-account cookie/bearer/shared-room acceptance
  remain mandatory before deployment. Wave 3 still requires a separate approval.

## Task 5: Add The Background-Owned Cache, Outbox, And V2 Client

**Files:**

- Create: `apps/extension/src/watch-history-outbox.ts`
- Create: `apps/extension/src/watch-history-storage.ts`
- Create: `apps/extension/src/watch-history-client.ts`
- Create: `apps/extension/test/watch-history-outbox.test.ts`
- Create: `apps/extension/test/watch-history-storage.test.ts`
- Create: `apps/extension/test/watch-history-client.test.ts`
- Modify: `apps/extension/entrypoints/background.ts`
- Modify: `apps/extension/src/privacy-sanitizer.ts`
- Modify: `apps/extension/test/diagnostic-log.test.ts`

**Interfaces:** Content/Popup send internal typed commands; only background owns
authenticated network calls, acknowledgements, cache replacement, and outbox
flush.

- [ ] **Step 1: Write the outbox state-machine tests**

  Prove account/generation partitioning, one terminal plus one latest slot per key,
  stable IDs across retry/restart, replacement of superseded non-terminal state,
  immediate acknowledgement removal, duplicate acknowledgement, deletion cleanup,
  sign-out/account switch isolation, deletion of rebuildable cache/preferences/
  current observation, retention of only unacknowledged old-owner outbox slots,
  removal of empty partitions, stale response rejection, and deterministic flush
  order (terminal before latest, then oldest persisted client observation and
  stable event ID). Client code never invents `serverOrder` or predicts the
  server's normalized observation time.

- [ ] **Step 2: Write quota/overflow tests without invented limits**

  In `watch-history-storage.test.ts`, stub `QUOTA_BYTES`, `getBytesInUse`,
  candidate serialization, and failed writes.
  Test immediate flush/coalesce/retry, preservation of existing terminal state,
  refusal of a new unpersisted event after the final failure, visible
  `storage-full`, recovery when bytes free, and preservation of unrelated storage
  keys. Seed multiple dormant account partitions and prove none is silently
  evicted. Assert there is no age expiry or global key-count cutoff; explicit
  destructive discard removes only the selected old-owner outbox after
  confirmation and never exposes its payload to the current account UI.

- [ ] **Step 3: Implement versioned account partitions**

  Use `watch-history-storage.ts` as the one WXT `local:` persistence adapter with
  explicit schema version and owner ID for server-confirmed cache, current local
  playback observation, preferences, account generation, and outbox. The current
  observation is crash-recovery state, not another server history, and is replaced
  in place. Keep opaque room authority only inside the pending event that requires
  it. Restrict logs and diagnostic snapshots to hashed IDs/generation counts;
  redact attestation fields.

- [ ] **Step 4: Implement the v2 HTTP/background bridge**

  Add list, progress, preference, delete, and room-recreation commands. Parse every
  response with shared Zod schemas. Background obtains the current token itself or
  verifies the passed session owner before sending; content/Popup cannot choose a
  different owner. Map `GENERATION_MISMATCH`, `DELETED_HISTORY`,
  `INVALID_ROOM_AUTHORITY`, `UPGRADE_REQUIRED`, retryable network error, and
  storage-full to stable local states.

  Add owner-safe commands that report only whether another account has pending
  unsent work and its byte use, never its titles/progress/URLs/attestation, and
  require explicit destructive confirmation before discarding that partition.

- [ ] **Step 5: Implement event-driven flush**

  Register listeners synchronously at service-worker startup. Flush on enqueue,
  `online`, valid auth storage change/refresh, startup/install, Popup/manual
  refresh, and content reconnect. Snapshot owner+generation before each request;
  apply ack/cache changes only if still current. One trigger performs one bounded
  drain and does not install an alarm or endless retry loop.

- [ ] **Step 6: Run extension transport gates and commit**

  ```bash
  pnpm --filter @anidachi/extension test -- watch-history-outbox.test.ts \
    watch-history-storage.test.ts watch-history-client.test.ts diagnostic-log.test.ts
  pnpm --filter @anidachi/extension check
  git add apps/extension/src/watch-history-* apps/extension/entrypoints/background.ts \
    apps/extension/src/privacy-sanitizer.ts apps/extension/test
  git commit -m "feat(extension): add compact watch history v2 outbox"
  ```

## Task 6: Add Solo Provider Policies And The Meaningful-Progress Controller

**Files:**

- Create: `apps/extension/src/source-adapters/core/history-policy.ts`
- Create: `apps/extension/src/watch-history-controller.ts`
- Create: `apps/extension/test/source-adapters/youtube/progress.test.ts`
- Create: `apps/extension/test/watch-history-controller.test.ts`
- Modify: `apps/extension/src/source-adapters/core/types.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/definition.ts`
- Modify: `apps/extension/src/source-adapters/crunchyroll/progress.ts`
- Modify: `apps/extension/src/source-adapters/youtube/definition.ts`
- Modify: `apps/extension/src/source-adapters/youtube/progress.ts`
- Modify: `apps/extension/test/crunchyroll-progress.test.ts`
- Modify: `apps/extension/src/current-resource-panel.tsx`
- Modify: `apps/extension/src/overlay-app.tsx`
- Delete after controller integration: `apps/extension/src/watch-progress-entry.ts`
- Delete after controller integration: `apps/extension/test/watch-progress-entry.test.ts`

**Interfaces:** Provider adapters own eligibility/identity; the controller owns
meaningful state and enqueue timing; overlay no longer performs HTTP
reconciliation. This wave publishes only solo observations. When a room is
active, the controller must not downgrade shared playback into solo history;
shared publication remains suppressed until Task 7.

- [ ] **Step 1: Write provider eligibility tests**

  Crunchyroll accepts only the supported canonical `/watch/{id}` surface with a
  stable watch ID, active adapter video, valid source URL, and valid media values.
  It reports observed season/episode metadata but never claims catalog
  completeness.

  YouTube starts disabled and fails closed until canonical account preferences
  load. When enabled it accepts only canonical long-form `/watch?v={stableId}` on
  supported YouTube hosts, rejects Shorts/embed/preview/unsupported routes, and
  requires valid duration/current time. No duration or watched-seconds threshold
  appears in policy or tests.

- [ ] **Step 2: Move branching into provider definitions**

  Add a small optional history-policy interface to `SourceAdapterDefinition` and
  adapt each provider's existing `progress.ts` as that implementation. Shared
  history code asks the active definition for an observation; it does not import
  concrete provider modules or synthesize provider identity. Remove the direct
  provider switch in `watch-progress-entry.ts`, then delete that bridge and its
  obsolete test after the controller owns observation.

- [ ] **Step 3: Write meaningful-progress state tests**

  `hasMeaningfulPlayback` becomes true only when media is actually playing,
  non-seeking, and its playback time advances compared with the prior playing
  observation, or when `ended` fires. Pause, seek, pagehide, source/room leave,
  and heartbeat before that gate produce no history event. Noise, metadata load,
  autoplay rejection, scrubbing without playback, and route detection alone do
  not count.

- [ ] **Step 4: Implement publication cadence**

  Continue frequent local observation for crash recovery. After the meaningful
  gate, enqueue a heartbeat no more than once per 60 seconds while playing, plus
  forced latest state on pause, seek completion, source change, pagehide, room
  leave/end, and `ended`. The 60-second value controls transport frequency only;
  it is never an eligibility or watched-duration requirement.

- [ ] **Step 5: Remove overlay writer behavior**

  Replace overlay direct reconcile with controller enqueue. Keep its existing
  local display update and provider/player behavior. Move Current Resource to the
  provider-neutral observation/local-state type so it no longer depends on the v1
  store. An active room remains observation-only for v2 in this wave. Popup writer
  removal waits for Task 8's visual-branch integration gate, so no Wave 3 artifact
  is promoted as the coordinated cutover build.

- [ ] **Step 6: Run provider/controller gates and commit**

  ```bash
  pnpm --filter @anidachi/extension test -- \
    crunchyroll-progress.test.ts source-adapters/youtube/progress.test.ts \
    watch-history-controller.test.ts
  pnpm --filter @anidachi/extension check
  git add apps/extension/src apps/extension/test
  git commit -m "feat(extension): publish meaningful watch progress"
  ```

## Task 7: Issue Room Authority And Enable Shared Publication

**Gate:** Begin only after Task 1 recorded
`SELF_CONTAINED_ATTESTATION_APPROVED`, Wave 3 solo behavior passed review, and the
user explicitly approved Wave 4. If the authority gate failed, do not improvise
this task from an obsolete design; amend the master plan first.

**Files:**

- Modify: `apps/api/src/auth.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/test/auth.test.ts`
- Modify: `apps/api/test/routes.test.ts`
- Modify: `apps/api/test/runtime/room-hibernation-runtime.ts`
- Modify: `apps/extension/src/room-client.ts`
- Modify: `apps/extension/src/watch-history-controller.ts`
- Modify: `apps/extension/test/room-client-auth.test.ts`
- Modify: `apps/extension/test/watch-history-controller.test.ts`

**Interfaces:** Consumes Task 2's private protocol event, the Task 1 threat-model
decision, and Task 6's solo controller. Produces one self-contained signed proof
for the current participant/session/generation tuple and enables shared progress
without a database authority ledger.

- [ ] **Step 1: Write signing, isolation, and lifecycle tests**

  Add failing tests proving:

  - room connection tokens cannot verify as history attestations and vice versa;
  - claims contain `typ: "room_history"`, issuer `anidachi-worker`, audience
    `anidachi-web-history`, subject user ID, room ID, participant session ID, room
    generation, source generation, and issued-at;
  - the existing signing secret is accepted only through the separate verifier
    configuration approved in Task 1; raw tokens are redacted from logs/errors;
  - there is no arbitrary short expiry or outbox age cutoff: authenticated replay
    is instead bounded by exact claims, DB join/end issuance bounds, account
    generation, and deletion fences as approved by the threat model;
  - an absent `participantSessionId` or ended/ending room produces no authority;
  - a delayed terminal with authority issued before room end can be accepted, but
    authority issued after end or before durable join is rejected by the web/RPC;
  - a single participant cannot create recent-person evidence.

- [ ] **Step 2: Add the purpose-bound signing helper**

  Implement `signRoomHistoryAttestation` beside room-token verification using
  `ANIDACHI_JWT_SECRET` with HS256 only because Task 1 approved that deployment
  boundary. Use a distinct type/issuer/audience and bounded protocol claims. Do
  not expose a new route, secret, or token to another participant.

- [ ] **Step 3: Send and refresh private authority**

  After verified JOIN, accepted admission, durable participant/session storage,
  and snapshot delivery, send `ROOM_HISTORY_AUTHORITY` only to that socket. After
  authoritative `SOURCE_CHANGED`, issue one new authority per currently joined
  socket using hibernation attachments as needed. Never refresh periodically and
  never issue after room ending/end.

- [ ] **Step 4: Consume authority without solo fallback**

  Room client retains only the newest authority matching current room,
  `participantSessionId`, `roomGeneration`, and `sourceGeneration`. On source
  change, enqueue the prior source's final state with the prior authority before
  activating the new one. Reconnect with the same tuple reuses the session. A
  missing/mismatched authority keeps shared publication suppressed and exposes a
  recoverable state; it never silently writes shared playback as solo.

- [ ] **Step 5: Prove hibernation and shared convergence**

  Evict/recreate the Durable Object in the runtime harness, then verify restored
  sockets receive correct authority on the next source change. Test two distinct
  authenticated writers, same-generation reconnect, source-generation change,
  room end, delayed terminal, duplicate receipt, and server-timed pair evidence.

- [ ] **Step 6: Run Wave 4 gates and commit**

  ```bash
  pnpm --filter @anidachi/api test
  pnpm --filter @anidachi/api test:runtime
  pnpm --filter @anidachi/api check
  pnpm --filter @anidachi/extension test -- room-client-auth.test.ts \
    watch-history-controller.test.ts
  pnpm --filter @anidachi/extension check
  pnpm harness:rooms
  git add apps/api/src apps/api/test apps/extension/src/room-client.ts \
    apps/extension/src/watch-history-controller.ts apps/extension/test
  git commit -m "feat(history): attest shared room progress"
  ```

## Task 8: Move Popup And Website To One Canonical Read Model

**Integration gate:** Start only when `codex/popup-visual-foundation` is merged to
staging or the user explicitly approves how to reconcile it. Preserve that work's
visual choices; this task changes data and small required states, not design.

**Files:**

- Modify: `apps/extension/src/popup-app.tsx`
- Modify: `apps/extension/test/popup-people-panel.test.tsx`
- Create: `apps/extension/test/popup-watch-history.test.tsx`
- Modify: `apps/web/app/account/watch-library/page.tsx`
- Modify: `apps/web/app/account/watch-library/watch-library-client.tsx`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2.test.ts`
- Delete after all imports move: `apps/extension/src/watch-library-client.ts`
- Delete after all imports move: `apps/extension/src/watch-library-auth.ts`
- Delete after all imports move: `apps/extension/src/watch-progress.ts`
- Delete with their retired modules: `apps/extension/test/watch-library-client.test.ts`
- Delete with their retired modules: `apps/extension/test/watch-library-auth.test.ts`
- Delete with their retired modules: `apps/extension/test/watch-progress.test.ts`

**Interfaces:** Popup uses bounded cached v2 data and background commands; website
uses cursor pages from the same DTO; no surface writes raw progress.

- [ ] **Step 1: Add shared response fixtures**

  Render the same fixtures through Popup and web assertions: observed-only
  Crunchyroll series/seasons, partial and complete episode progress, solo/shared
  sessions, YouTube movie-like item, pending optimistic progress, empty history,
  stale/offline cache, and each deletion scope. Assert matching values for every
  overlapping record.

  Put Watch History rendering/state assertions in the dedicated
  `popup-watch-history.test.tsx`. Keep `popup-people-panel.test.tsx` only for
  Recent People regression coverage; it is not a substitute for Popup history
  tests.

- [ ] **Step 2: Switch Popup reads**

  First paint uses a same-owner/same-generation confirmed cache plus the active
  local observation. A cache-only startup authority makes Crunchyroll presentation
  available before the canonical preference request, while that request continues
  in the background and YouTube remains fail-closed. Background refresh replaces
  the cache with a parsed canonical response; pending outbox state overlays only
  matching episode/session values without exposing technical sync labels. Local
  observation visibility never makes it eligible for server persistence. Remove plan title/
  retention labels and all Popup reconcile/backfill/artwork writer calls. Move any
  still-needed presentation helpers to a small v2 model module, then delete the v1
  local progress store/client/auth modules and their tests once imports are zero.
  Show storage-full and pending-old-account states without exposing the prior
  account's payload; explicit discard requires destructive confirmation.

- [ ] **Step 3: Add the account YouTube preference**

  Add one account-level history setting in the existing appropriate settings
  surface on Popup and website. Until GET succeeds, treat YouTube as disabled.
  PATCH acknowledgement updates both caches; late previous-owner responses are
  ignored.

- [ ] **Step 4: Add online-only deletion controls**

  Episode/title/all actions send stable mutation IDs and current generation,
  remain busy until acknowledgement, then clear matching confirmed cache and
  outbox scopes. Errors retain the record and expose retry. History deletion never
  calls friend/group/recent-person deletion.

- [ ] **Step 5: Switch website reads and pagination**

  Use the v2 service for the initial server page and opaque `nextCursor` for more.
  Remove v1 plan limit/retention presentation. Preserve existing account auth and
  visual hierarchy. `unavailable` catalog shows an observed count, never a false
  denominator or next episode.

- [ ] **Step 6: Run UI/consumer gates and commit**

  ```bash
  pnpm --filter @anidachi/extension test -- popup-watch-history.test.tsx \
    popup-people-panel.test.tsx
  pnpm --filter @anidachi/extension check
  pnpm --filter @anidachi/web test -- watch-history-v2.test.ts
  pnpm --filter @anidachi/web check
  git add apps/extension/src apps/extension/test \
    apps/web/app/account/watch-library apps/web/lib/anidachi-auth
  git commit -m "feat(history): unify popup and web on watch history v2"
  ```

## Task 9: Perform The Logical Clean Pre-Release Cutover

**Files:**

- Create: `apps/web/supabase/migrations/20260814020000_watch_history_v2_clean_cutover.sql`
- Modify: `apps/web/app/api/watch-progress/reconcile/route.ts`
- Modify: `apps/web/app/api/watch-library/route.ts`
- Modify: `apps/web/app/api/watch-library/rooms/route.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-library-routes.ts`
- Modify: `apps/web/lib/anidachi-auth/social.test.ts`
- Modify: `apps/web/lib/anidachi-auth/watch-history-v2-sql.test.ts`
- Modify: `packages/protocol/src/account.ts`
- Modify: `packages/protocol/test/account.test.ts`
- Modify: `apps/web/lib/anidachi-auth/social.ts`
- Modify: `apps/web/app/friends/friends-client.tsx`
- Modify: `apps/extension/src/popup-people-panel.tsx`
- Modify: `apps/extension/test/popup-people-model.test.ts`
- Modify: `apps/extension/test/popup-people-panel.test.tsx`
- Modify: `apps/extension/test/social-client.test.ts`

**Interfaces:** Stops v1 application reads/writes, points Recent people only at
independent evidence, and retains old tables solely as inert rollback storage.

- [ ] **Step 1: Prove no active v1 writer remains**

  Search runtime imports/routes for `reconcileWatchProgress`,
  `watch_progress_checkpoints`, `upsertWatchSessionParticipant`, and Popup
  reconcile messages. Classify every result. Only disabled v1 service code,
  migrations, tests, and historical docs may remain.

- [ ] **Step 2: Add and separately deploy the database prerequisite**

  Add `list_recent_people_evidence_v2` as a service-role-only read of pair-keyed
  `recent_people_evidence`; do not replace the v1 function, union legacy
  checkpoints, or backfill test evidence. Return `other_user_id`, `last_room_id`,
  and server-owned `last_watched_at` only. The migration does not drop/truncate
  legacy history tables. Merge and verify this migration in a prerequisite PR
  before the runtime cutover PR so database and web auto-deploy order cannot
  create an incompatible interval.

- [ ] **Step 3: Remove the unsupported shared-room count atomically**

  Remove `sharedRoomCount` from the Recent Person protocol, web mapper, Friends
  presentation, extension model, Popup subtitle, fixtures, and tests in the same
  cutover commit. Replace the subtitle with non-count copy based on
  `lastWatchedAt` where useful; never fabricate `1`. This is a pre-release contract
  cutover, not a compatibility adapter or a reason to add a room-count ledger.

- [ ] **Step 4: Disable v1 HTTP paths**

  Return HTTP 426 with stable `UPGRADE_REQUIRED` from v1 list/reconcile/delete and
  old room-from-session paths. Do not maintain dual writers, dual reads, or a v1-
  to-v2 translation adapter. The staging artifact and website v2 endpoints must
  already be ready before this change is deployed.

- [ ] **Step 5: Verify rollback boundary**

  Before any later destructive cleanup, rollback means redeploying the prior app
  and restoring the prior recent-people function; dormant v1 data remains. A
  future drop migration is explicitly outside this plan and requires separate
  approval after staging acceptance. No current test history is imported.

- [ ] **Step 6: Run cutover gates and create separately deployable commits/PRs**

  ```bash
  pnpm --filter @anidachi/web test -- watch-history-v2-sql.test.ts \
    watch-history-v2-routes.test.ts watch-library-routes.test.ts \
    friends-recent-people.test.ts social.test.ts
  pnpm --filter @anidachi/web check
  rg -n "watch_progress_checkpoints|reconcileWatchProgress" \
    apps/web apps/extension packages/protocol
  git add apps/web/supabase/migrations/20260814020000_watch_history_v2_clean_cutover.sql \
    apps/web/lib/anidachi-auth/watch-history-v2-sql.test.ts \
    apps/web/supabase/tests/watch_history_v2.test.sql
  git commit -m "feat(history): add recent people v2 evidence rpc"
  # Merge this prerequisite into staging and verify db-staging before continuing.
  git add \
    apps/web/app/api/watch-progress apps/web/app/api/watch-library \
    apps/web/lib/anidachi-auth/social.ts apps/web/lib/anidachi-auth/social.test.ts \
    apps/web/lib/anidachi-auth/watch-library-routes.ts \
    apps/web/lib/anidachi-auth/watch-library-routes.test.ts \
    apps/web/lib/friends-recent-people.test.ts apps/web/app/friends \
    packages/protocol/src/account.ts \
    packages/protocol/test/account.test.ts apps/extension/src/popup-people-panel.tsx \
    apps/extension/test
  git commit -m "feat(history): cut over pre-release runtime to v2"
  ```

## Task 10: Full Automated Gates And Staging Acceptance

**Files:**

- Modify after evidence exists: `docs/current-development-state.md`
- Modify after evidence exists: `docs/shared-watch-progress-tracker.md`
- Modify after evidence exists: `docs/crunchyroll-adapter-notes.md`
- Modify after evidence exists: `docs/superpowers/plans/README.md`
- Modify after evidence exists: this plan's status/evidence sections

**Interfaces:** Proves the complete flow against real staging infrastructure and
loaded extension artifacts before any promotion.

- [ ] **Step 1: Run repository gates**

  ```bash
  pnpm --filter @anidachi/protocol test
  pnpm --filter @anidachi/protocol check
  pnpm --filter @anidachi/api test
  pnpm --filter @anidachi/api test:runtime
  pnpm --filter @anidachi/api check
  pnpm --filter @anidachi/web test
  pnpm --filter @anidachi/web check
  pnpm --filter @anidachi/extension test
  pnpm --filter @anidachi/extension check
  pnpm harness:rooms
  pnpm check
  pnpm test
  pnpm dev:check
  ```

- [ ] **Step 2: Review security and resource boundaries**

  Confirm no new host/`unlimitedStorage` permission, no secret in extension,
  attestation redaction, service-role-only functions, RLS, fixed 14-day receipt
  retention, no outbox expiry/count constant, no provider/catalog polling, and no
  raw provider payload committed.

- [ ] **Step 3: Deploy to staging in compatibility-safe order**

1. Merge/apply the additive Supabase foundation and v2 Recent People RPC, then
   verify migration history. Neither prerequisite changes the active v1 contract.
2. Deploy web v2 APIs while v1 routes still work.
3. Deploy Worker protocol/authority; old clients ignore the additive event.
4. Build and validate the pre-cutover staging extension artifact.
5. Load that artifact in the authenticated staging browser profiles.
6. Verify v2 end to end while v1 remains available.
7. Build the cutover artifact, merge the runtime cutover PR, and load that
   artifact after the website deploy is healthy. This PR performs the 426 route
   switch and starts using the already-deployed v2 Recent People RPC; it applies
   no breaking database replacement.

  Run applicable commands:

  ```bash
  pnpm build:extension:staging
  pnpm validate:extension:staging
  pnpm smoke:worker:staging
  npm --prefix tests/e2e run harness:p2p
  ```

- [ ] **Step 4: Execute realistic acceptance matrix**

  With two authenticated profiles and, for shared cases, two devices/networks:

- solo Crunchyroll start, pause, seek backward, reload, end, and resume;
- observed seasons/episodes without fabricated catalog totals;
- solo session recovery without duplicate meaningful sessions;
- two-person room where each user writes only self;
- reconnect in the same room/source generation without duplicate session;
- source change creates a new shared boundary and closes the prior one;
- room leave/end plus delayed offline terminal delivery;
- offline latest+terminal retry and duplicate delivery;
- account switch/sign-out, rebuildable-cache deletion, dormant pending-outbox
  isolation, explicit discard, and late-response rejection;
- episode/title/all deletion followed by replay of older queued events;
- episode/title playback with `normalizedObservedAt > deletedAt` creates fresh
  history without clearing the fence;
- genuine episode/title playback from a deliberately slow device clock with
  `normalizedObservedAt <= deletedAt` is safely rejected; acceptance evidence
  records the documented MVP clock-skew limitation, while full-clear recovery uses
  the new account generation;
- recent people survives history deletion, uses server confirmation time, has no
  shared-room count, and is not fabricated from one writer;
- Popup and website values match across a second browser/device;
- YouTube absent by default, enabled account-wide, canonical long-form recorded,
  Shorts/embed/preview rejected, and no duration/watched-time threshold;
- near-quota behavior preserves terminal state and unrelated extension storage.

- [ ] **Step 5: Record evidence and update canonical docs**

  Record artifact `version_name`, staging URLs/deployments, migration IDs, Worker
  smoke, two-profile results, screenshots for Popup/web states, failures/remaining
  risk, rollback point, and Graphify query/update status. Update docs only to facts
  actually proven; do not call production ready from unit tests alone.

- [ ] **Step 6: Open PR to staging and stop before production**

  The PR must include docs/Graphify status, staging impact, migration order,
  permission/secret impact, rollback steps, and evidence. Production migration,
  artifact promotion, and main merge require a separate user-approved promotion
  after staging acceptance.

### Task 10 closeout status — 2026-08-16

- Fresh protocol, API, extension, room, and real-WebRTC gates from the initial
  closeout pass. After review fixes, web passes 206 tests with two opt-in local
  contracts skipped in the ordinary suite; both the actual RPC/parser contract
  and realistic parser benchmark pass separately. A staging extension artifact
  was previously built and validated with `version_name`
  `768c219-staging-20260816185317`; the live staging Worker smoke also passes.
- GitHub evidence for staging commit `f82fdf6` shows the staging migration,
  extension build, CI, Rooms, P2P Media, and staging smoke workflows succeeded.
  The bounded-read commits are local only and are not included in that evidence.
- Staging has the v2 foundation and clean-cutover migrations through
  `20260814020000`. The new `20260816090000` title projection/bounded-read RPC has
  only local Supabase proof: full migration reset, 71/71 pgTAP, schema lint,
  local dry run, and actual RPC output parsed by the production runtime. It must
  be the first staging PR; the web consumer is a second PR after the database
  workflow and migration history are verified.
- Production requires the same split. `.github/workflows/db-production.yml` and
  the application deployment react independently to a push on `main`, so a
  combined promotion can expose runtime before its RPC. Merge a migration-only
  promotion, wait for `Deploy migrations to production` and verify the remote
  migration history, then merge the runtime promotion.
- Automated coverage and the user-confirmed solo path are not substitutes for
  the unexecuted loaded-artifact two-profile/two-device matrix. No production
  readiness, full staging acceptance, deployment, or legacy deletion is claimed.
- The title projection eliminates the account-wide episode grouping and the
  previous 20-times-episode session fanout, but an individual visible title can
  still have an unbounded exact episode array. The measured realistic fixture is
  not a universal bound; public release remains blocked until that API boundary
  is explicitly resolved or separately accepted with defensible evidence.
- EXPLAIN on the 501-title fixture shows the exact canonical-generation page
  shape using `idx_watch_history_title_summaries_page` before `LIMIT` (51 rows,
  0.036 ms, 18 shared hits, zero reads). Exact count separately scans only the
  501 summary rows (0.041 ms). A real heartbeat updated one summary in 0.306 ms;
  deleting a 1,200-episode title invoked the statement trigger once and took
  1.004 ms. These are local measurements, not production latency claims.
- Review round 2 installs progress maintenance before the idempotent v2-only
  projection initialization. A rollback-only contract proves a newer write in
  that interval survives and owns the summary max. On a skewed 10,000-session
  title, the old window plan scanned/sorted 10,000 sessions in 3.656 ms; the new
  indexed per-title lateral query visited 20 sessions and 20 owner rows in
  0.030 ms. A deep cursor that formerly filtered 501 summaries now carries the
  timestamp range in `idx_watch_history_title_summaries_page`'s index condition,
  visiting 51 candidates in 0.026 ms. These are rollback-only local EXPLAIN
  measurements and do not remove the unbounded visible-title episode blocker.
- Review round 3 adds a v2-only one-row-per-user-session projection maintained
  from participant membership. Host generation 1/viewer generation 2 coverage
  returns all three shared sessions, and viewer full clear removes its three
  derived rows while retaining the host's three. The requester-leading index
  `(user_id,history_generation,provider,title_key,last_watched_at desc,session_id)`
  visited exactly 20 rows on a rollback-only fixture containing 10,000 newer
  non-owned same-title sessions and 20 older owned sessions (0.025 ms, 26 shared
  hits). The pre-fix measured planner already chose the requester participant
  index for this skew (20 participant rows plus 20 session PK probes, 0.029 ms,
  82 hits), so no global-scan claim is inferred from that run.
- The unapplied migration now opens an explicit transaction, sets a ten-second
  lock timeout, and takes a write-conflicting settings-first lock before the
  session, participant, and progress sources. This matches apply/delete writer order,
  prevents initializer/delete resurrection for both projections, and avoids
  relying on undocumented per-file runner atomicity. A local three-session
  concurrency contract proves in-flight settings and session writers drain at
  their ordered locks, later writers wait and resume after commit, and a forced
  mid-migration error rolls back earlier DDL/DML. Lock timeout requires rerunning the database
  workflow after writers drain; never repair history or apply fragments.
- The prerequisite is old-web-compatible but not dormant because its triggers
  and participant FK maintain the derived projections. Migration rollback
  requires a separately reviewed forward cleanup after the consumer is absent:
  drop the session trigger, participant trigger, and both progress triggers,
  then the list RPC and maintenance functions,
  both projection tables and their indexes in dependency order, while leaving
  canonical v2 progress and all legacy storage untouched. No rollback migration
  is created by Task 10.
- Review round 4 makes session checkpoint truth authoritative end to end. The
  user-session projection now stores `watch_sessions.last_checkpoint_at`, which
  is the same source as the returned DTO `lastWatchedAt`; delayed/offline
  participant timestamps cannot reorder or displace latest-20 candidates.
  Session checkpoint/schema/provider/title/room/client identity changes maintain
  every current v2 member projection. An invalid shared tombstone with neither
  room nor client key deletes/creates no projection and cannot consume `LIMIT
  20`. The valid RED failed 6/71 pgTAP assertions (20 vs 22 candidates, wrong
  IDs 1..20, stale checkpoint, included tombstone twice, missing session
  trigger); GREEN passes 71/71. On the rollback-only 10,000-non-owned/25-owned
  opposed-participant-timestamp fixture, the index-only candidate scan returned
  canonical sessions 6..25, visited exactly 20 rows in 0.017 ms (45 shared hits,
  zero reads), and the full RPC took 25.003 ms. The 1,455,993-byte payload still
  contains 2,376 exact episode rows, so the public-release blocker is unchanged.

## Deferred Catalog Evidence Gate (Not Part Of Core MVP Execution)

Do not create `watch_catalog_snapshots`, a catalog upload route, collector,
freshness timer, exact denominators, or next-episode logic in Tasks 0-10.

A separate additive catalog plan may start only when a real authenticated,
sanitized Crunchyroll fixture proves all of:

- canonical series and season identities;
- complete pagination across seasons/episodes;
- released/currently available filtering;
- reliable locale/audio/subtitle variant collapse;
- a completeness signal proving no page is missing;
- removal of cookies, headers, tokens, account IDs, and unrelated private fields.

If that evidence appears, preserve the approved interaction-driven rule: refresh
only after genuine title interaction, coalesce concurrent work, keep the last valid
complete snapshot on failure, and never block progress capture. That follow-up may
reuse the saved catalog schemas and size boundary after validating them against the
real fixture. Until then, observed-only history is the correct shipped behavior.

## MVP Acceptance Criteria

- Supabase has one canonical account history and one transactional progress writer.
- Popup never writes progress and Popup/web parse the same strict v2 response.
- Each authenticated user mutates only self; shared context requires a valid
  participant/session/room/source-generation attestation approved by the Wave 1
  lifecycle threat-model gate.
- One mutable episode row and meaningful sessions replace append-only checkpoints.
- Duplicate, stale, out-of-order, offline, backward-seek, terminal, and ended-room
  delivery converge through idempotency-first handling and the server-owned
  `(normalizedObservedAt, serverOrder)` order; `clientEventId` remains only the
  retry/idempotency key.
- Receipts retain exactly 14 days; outbox has only terminal+latest shape, no expiry
  or invented count cap, and explicit quota-full behavior.
- Episode/title/all deletion is atomic; current-generation fences are never cleared
  by later playback, and old outbox work cannot resurrect deleted history.
- Episode/title post-delete recreation is guaranteed only when
  `normalizedObservedAt > deletedAt`; arbitrary negative device-clock skew can
  conservatively reject genuine new playback and is an explicit MVP residual risk,
  not an absolute chronology guarantee.
- Full clear advances account generation; sign-out/account switch cannot leak state.
- Recent people is pair-keyed, independent of history deletion, requires two
  self-owned participant writes, uses server confirmation time, and exposes no
  unsupported shared-room count.
- YouTube is off by default and records only meaningful supported long-form playback
  after opt-in, with no length or elapsed-time threshold.
- Crunchyroll exact catalog totals are absent until evidence exists; observed
  episode resume remains correct.
- No new polling platform, background catalog crawl, extension permission, or
  durable telemetry journal is introduced.
- Current room sync, P2P, social, inbox, pricing, and visual behavior pass regression
  gates.
- Staging evidence exists from a loaded artifact and realistic two-profile flow
  before any production promotion.

## Current External Constraints Rechecked For This Plan

- Chrome `storage.local` currently exposes a 10 MB quota without
  `unlimitedStorage` and provides `getBytesInUse`; the implementation uses runtime
  values rather than duplicating a guessed budget:
  <https://developer.chrome.com/docs/extensions/reference/api/storage/>
- WXT supports typed/versioned `local:` storage items and migrations; existing
  working wrappers need not be replaced wholesale:
  <https://wxt.dev/storage>
- Cloudflare recommends the Durable Object Hibernation WebSocket API and preserves
  per-socket structured-clone attachments through hibernation; the existing room
  runtime already follows this model:
  <https://developers.cloudflare.com/durable-objects/best-practices/websockets/>
- Supabase recommends security invoker by default, an empty `search_path`, fully
  qualified relations, and explicit function grants; v2 RPCs follow those rules:
  <https://supabase.com/docs/guides/database/functions>
