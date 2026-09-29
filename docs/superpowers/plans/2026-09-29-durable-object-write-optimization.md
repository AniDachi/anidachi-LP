# Durable Object Write Optimization Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` inline, task by task,
> with TDD and a fresh whole-branch review. Track completed steps and evidence.
> The owner explicitly authorized implementation after reviewing the design and
> next steps: «хорошо, тогда приступай к работе максимально внимательно».

**Goal:** Reduce redundant DO writes while preserving room behavior, then deliver
to staging for the owner's manual acceptance before resuming trial activation.

**Architecture:** Keep one existing DO per room, storage formats and wire protocol.
Make persistence depend on semantic changes, retain durable metering anchors and
settle before external delivery, and reconcile the earliest alarm idempotently.

**Tech Stack:** Existing Cloudflare Workers/SQLite DO, TypeScript, Vitest Workers
runtime, shared protocol and unchanged extension.

**Spec:** [Design and baseline](../specs/2026-09-29-durable-object-write-optimization-design.md).

## Global Constraints

- Base: staging `1f4ad13f`; design commit `891f7b95`. Fetch/recheck before delivery.
- Meter schemaVersion 2 and snapshot schemaVersion 1 stay readable by old Worker.
- No protocol, heartbeat/snapshot delivery, Stripe, Supabase migration, secrets,
  commercial policy or extension changes. Preserve dormant trial implementation.
- Preserve sequence/replay, terminal fencing, exact logical deadlines, UTC quota,
  ACK idempotency, default output gates and settlement before external I/O.
- Local automatic tests are ours; staging manual acceptance is the owner's.
- No main, Store publication or T activation as part of optimization.
- Progress is evidence-based; amend implementation choices when source/tests
  expose a conflict, recording the reason and impact.

## Review Focus

1. Policy mutated in place or during await must not be mistaken for unchanged
   durable authority; expired/terminal rooms never process a late action (Tasks 2/4).
2. A pending usage bucket, UTC rollover or plan transition must not lose time
   when heartbeat settlement is removed (Task 3).
3. Alarm null during a running handler and constructor-before-alarm must retain
   the earliest source/disconnect/presence/terminal obligation (Tasks 2/4).
4. Failed snapshot/denial transaction must not update a success cache or retain
   a partial media grant; sequence-only changes remain durable (Task 4).
5. Lower storage counts must come from fewer writes, not lost messages, skipped
   checks or changed clocks/workload; old/new clients retain behavior (Tasks 1/5).

## File Map

- `apps/api/src/index.ts`: policy servicing, settlement, conditional policy
  persistence and constructor recovery; retain existing event authority/order.
- `apps/api/src/room-metering.ts`: pure same-state no-op.
- `apps/api/src/room-capability.ts`: absolute quota/warning deadline from meter.
- `apps/api/src/room-source-persistence.ts`: shared alarm reconciliation.
- `apps/api/src/room-persistence.ts`: semantic snapshot writes and denial diff.
- Existing metering/source/persistence tests; new `room-capability.test.ts` for
  isolated deadline calculations; existing `runtime/room-hibernation-runtime.ts`
  for signed room fixtures and recovery; test-only storage profiler under
  `apps/api/test/helpers/` if sharing improves clarity.
- Canonical state, trial master/plan and this plan carry progress/evidence.

### Task 1: Reproducible storage baseline

**Files:** `apps/api/test/runtime/room-hibernation-runtime.ts` and optional
`apps/api/test/helpers/room-storage-profile.ts`.

**Interfaces:** Test-only `observeRoomStorage(storage: DurableObjectStorage)`
returns `snapshot()` counts and `restore()`. SQL cursors execute normally;
snapshot reads rowsWritten after consumption. Track SQL totals/by room_meta key,
KV puts/deletes and alarm sets/deletes separately, including transactions.

- [x] Add profiles using existing signed v3 fixture: Free host+guest, Free solo,
  Plus/Pro host+guest, steady accepted HOST_STATE events spaced 1500ms in test
  time. Assert delivered state/monotonic sequence and known elapsed usage.
- [x] Record baseline counts at unchanged production source; profile setup,
  joins and initial source repair are outside the measured steady segment.
- [x] Add target assertions that fail on redundant meter/policy/alarm/snapshot
  writes; preserve the baseline receipt outside test expectations.
- [x] Run focused runtime test. Expected: target write-budget assertion fails
  while functional fixture passes. No public network or real room creation.
- [x] Commit the test/profiler with baseline evidence; target remains RED until
  Tasks 2–4. This measurement step is not a shippable runtime change.

### Task 2: No-op meter and stable policy/alarm persistence

**Files:** `room-metering.ts`, `room-capability.ts`, `room-source-persistence.ts`,
`index.ts`; `room-metering.test.ts`, new `room-capability.test.ts`,
`room-source-persistence.test.ts`, affected in-memory storage doubles.

**Interfaces:** Keep `reconcileRoomMeter(state, shouldMeter, now): RoomMeterState`.
Change the internal `nextRoomPolicyAlarm(state, now, meter: RoomMeterState,
active: boolean): number`; its single runtime caller passes the durable meter.
Keep `reconcileStoredRoomAlarm(transaction, fallbackAt?, options?)` return value
as the effective earliest scheduled timestamp or null.

- [x] RED: repeated inactive same-day reconcile returns the original state;
  active/inactive boundaries, pending usage and UTC changes remain meaningful.
- [x] RED: quota/warning deadlines remain identical at fractional elapsed
  seconds; preserve lease/closing/UTC precedence and already-due behavior.
- [x] RED: reconciling the same actual alarm does not write it; earlier/later
  obligations, removal, absent alarm and terminal/presence paths still schedule.
- [x] Implement minimal no-op checks and durable transaction comparisons;
  compare policy values rather than object identity; retain authority checks.
- [x] Run API check/test and focused runtime profile. Expected: unit suite green,
  lower counters; remaining heartbeat/snapshot budget failures belong to Tasks 3/4.
- [x] Commit and record exact counts and remaining failures.

### Task 3: Preserve metering intervals between events

**Files:** `index.ts`, `room-metering-v2.test.ts`, runtime hibernation test.

**Interfaces:** `serviceRoomPolicy(now): Promise<void>` preserves `activeSince`
between ordinary events, uses `roomUsageSummary(meter, now)` for display and
settles/persists before `roomUsageBuckets` + `storage.sync` + external renewal.
Existing acknowledgeRoomUsageDay and bounded pending ledger stay authoritative.

- [x] RED: consecutive HOST_STATE keeps the original activeSince and does not
  rewrite meter; the next renewal delivers the full interval exactly once.
- [x] Add/retain literal boundary expectations for host alone, join/leave,
  10.5s + 5.7s intervals = 16s, UTC midnight and late exhausted-day alarms.
- [x] Implement conditional settlement at real transitions/external checkpoints.
  Re-evaluate access and live metering after asynchronous authority work.
- [x] Run API unit/runtime tests for pending ACK, forced wake, exact exhaustion,
  unavailable authority, closure while callback waits, terminal idempotency.
  Expected: no changed functional outcomes; steady meter writes removed.
- [x] Commit verified interval change and record evidence.

### Task 4: Snapshot/denial writes and wake recovery

**Files:** `room-persistence.ts`, `index.ts`, runtime test and persistence tests.

**Interfaces:** Preserve `writeStoredRoomState(storage, snapshot): void` and
`readStoredRoomState`. Compare against successful durable contents excluding
only snapshot.updatedAt; atomically write changed snapshot and denial-set diff.
Prefer reading existing SQLite state to an additional mutable cache unless
measurement proves that cache necessary. No storage format migration.

- [x] RED: unchanged snapshot with later updatedAt writes zero rows; changed
  serverSeq/capabilities/source/participants remains durable; unchanged denials
  are not deleted/reinserted; changed sets are exact and atomic.
- [x] RED: failed denial write rolls back snapshot and retries successfully;
  constructor/wake retains original pending/earlier alarm and unchanged state.
- [x] Implement no-op snapshot and denial diff, preserving accepted HOST_STATE
  persistence and output gates. Fix constructor scheduling only as evidence
  requires; preserve earliest durable obligations before ordinary traffic.
- [x] Run full API check/test/runtime; original and optimized cost profile.
  Expected: steady HOST_STATE has one necessary room snapshot write, no unchanged
  meter/policy/alarm/denial writes, and delivered/recovered state stays correct.
- [x] Commit; record before/after by metric without equating counters to billing.

### Task 5: Review, staging delivery and owner handoff

**Files:** Evidence under `docs/releases/`, canonical docs, Graphify artifacts;
no new runtime features in this task.

- [ ] Run `pnpm dev:check`, API check/test/runtime, room harness and relevant
  protocol checks; real-WebRTC harness for this shared room persistence path.
- [ ] Verify compatibility reading old/new storage and preservation of dormant
  trial/terminal behavior. Review full branch with a fresh reviewer; fix confirmed
  defects with RED→GREEN evidence and rerun affected checks.
- [ ] Update docs and Graphify via semantic skill for docs plus AST for changed
  code. Preserve unrelated graph backlog and existing integrity caveats.
- [ ] Fetch upstream, open PR into staging, attach it to this task, inspect CI
  and resolve relevant failures. Preserve main promotion gate.
- [ ] Before delivery capture current staging version/config/policy; after merge
  verify exact Worker deployment and smoke, with T/trials still dormant. Record
  rollback version and target-environment evidence; no production or Store action.
- [ ] Provide owner a concrete manual scenario with old ZIP, new candidate and
  mixed clients. Record manual acceptance only after the owner's actual result.
- [ ] Resume trial acceptance/activation only after that result; this remains an
  external acceptance gate, not an unchecked task to silently mark complete.

## Progress

2026-09-29: exact worktree verified; fetched staging remains `1f4ad13f`. Existing
design `891f7b95` accepted with explicit instruction to begin. Native execution;
implementation and runtime evidence will be added task by task.

Task 1 baseline (real SQLite, 20 accepted HOST_STATE frames at 1500ms):

| Scenario | SQL rows written | Meter | Snapshot | KV puts | Alarm sets |
| --- | ---: | ---: | ---: | ---: | ---: |
| Free solo | 100 | 60 | 40 | 20 | 20 |
| Free + guest | 80 | 40 | 40 | 20 | 20 |
| Plus + guest | 100 | 60 | 40 | 20 | 20 |
| Pro + guest | 100 | 60 | 40 | 20 | 20 |

Fixture passed all four scenarios before target budgets were added. All four
budget assertions then failed on real redundant writes; no production source
changed. SQL rows, KV calls and alarm calls are separate metrics, not a billing sum.

Task 2: API types and all 252 unit tests pass. Runtime profile now has zero
policy KV puts and alarm writes; SQL40 for Free solo/Plus/Pro, SQL80 for active
Free. Four final-budget failures remain intentionally until Tasks 3–4.

Task 3: runtime regression first reproduced activeSince moving 30 seconds on
ordinary frames, then passed with a stable anchor and a 60-second durable
checkpoint before the Web callback. All 87 functional runtime tests pass; four
write budgets remain RED solely for duplicate snapshots (SQL40 in all profiles).

Task 4: final profiles GREEN at SQL20 (one durable snapshot per accepted frame),
zero meter/policy/alarm writes in the steady segment. SQL writes drop 75% for
active Free and 80% for the other three fixtures; this is not a production
daily-billing forecast. Unchanged two-user denial set: 7 rows -> 0.

Real SQLite rollback/retry tests pass. Wake tests first reproduced a pre-existing
UTC recovery flaw: constructor settlement erased an overdue previous-day quota.
Recovery now preserves the old meter/deadline until policy enforcement, re-arms
a missing alarm, and ends at the original timestamp. API types + 252 unit pass;
95 runtime cases passed in the full run, and the remaining source fixture was
corrected to include its required title (3/3 focused storage tests then pass).
