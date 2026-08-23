# Task 7 Local Evidence: Single Active Room Session

Date: 2026-08-23

Branch: `codex/single-active-room-session`

Base: `origin/staging`

This file records local evidence only. No linked Supabase migration, staging
deployment, remote push, promotion, or test-profile extension update was run.

## Race And Lifecycle Matrix

| Required case | Deterministic owner and evidence |
| --- | --- |
| Simultaneous different-room claims | `single_active_room_sessions.test.sql` uses genuinely concurrent transactions and leaves only the winner. The complete local migration replay and 461 pgTAP assertions passed in Task 2 before commit `4862131`. |
| Same-room retry and takeover | pgTAP covers idempotent reuse and a new exact session; extension storage tests cover prepare/confirm and stale cleanup; the live room harness proves both same-session reconnect and different-session takeover. |
| Token/JOIN mismatch | Web JWT tests require the bounded token claim; protocol rejects missing JOIN session; Worker auth and runtime tests reject missing or mismatched sessions. |
| Guest disconnect, grace, expiry, callback | `participant-disconnect.test.ts`, Worker runtime hibernation tests, internal Web callback tests, and the public departure route cover exact-session, retry, and idempotent release. |
| Host disconnect, grace, guests remaining | Worker runtime tests prove same-session cancellation and durable `host_disconnected` finalization after hibernation while guests remain. |
| Stale close after takeover | database exact release, Worker pending-disconnect cancellation, extension closed-tab identity cleanup, and live takeover tests all compare the exact participant session. |
| Shared source/disconnect/lifecycle alarm | Worker runtime tests prove the disconnect deadline wins over the four-hour fallback and source/lifecycle retries retain one reconciled alarm. |
| Duplicate delivery | database release/finalize, Web callbacks, Worker alarm acknowledgements, and repeated end tests are idempotent. |
| Hibernation reconstruction | Worker runtime suite restores source outbox, participant deadlines, room lifecycle, history authority, and socket attachments after eviction. |
| Extension close versus reload | only `chrome.tabs.onRemoved` invokes bounded departure; existing `pagehide`, `pageshow`, visibility, and online handlers remain reconnect-only. |

The matrix deliberately uses each subsystem's authoritative deterministic test
layer. PostgreSQL concurrency is not duplicated inside a Worker-only WebSocket
harness, and Durable Object hibernation is not approximated in extension unit
tests.

## Commands And Results

- Protocol: 6 files, 138/138 tests passed; type-check passed.
- Web: 347 passed, 3 intentional skips, 0 failures; type-check passed.
- API unit: 15 files, 161/161 tests passed.
- API runtime: 27/27 Worker hibernation tests passed.
- Extension: 99 files, 1303/1303 tests passed; type-check passed.
- Room signaling harness: 39/39 scenarios passed.
- Repository `pnpm check`: 6/6 tasks passed.
- Repository `pnpm test`: 6/6 tasks passed.
- `pnpm dev:check`: passed and selected the expected rooms/API/extension/Web profiles.
- Staging extension build: completed; artifact validation passed with narrow staging configuration.
- Real Chromium P2P harness: 26/26 checks passed in direct-first mode, including bidirectional decoded video, open mic, push-to-talk, dropped offer/answer recovery, reload, and short network loss.
- `git diff --check`: passed.

An early P2P attempt correctly failed with `401` because its local token fixture
omitted the newly required session binding. Task 8 source review then found
that Web used the production issuer `anidachi-auth` while Worker and both local
harnesses expected `anidachi-web`. The shared issuer/audience contract and both
harness fixtures were corrected; Worker verification was not weakened. The
final harness candidate pair was `host/host`, so this run proves direct-first
media and recovery, not forced TURN behavior. TURN was not changed by this
task.

## Task 8 Source Review Addendum

The pre-PR source review covered database concurrency and grants, all
room-token/JOIN/departure/end-reason producers and consumers, one-alarm
scheduling, hibernation restore, exact stale-session comparisons, Web callback
idempotency, extension auth/tab lifecycle, Watch History authority continuity,
and the absence of unrelated infrastructure changes.

Review fixes are isolated in:

- `3a4814b` — production room-token issuer/audience alignment;
- `e482eb4` — bounded pending-disconnect turnover independent of live seats;
- `c7e4c7b` — cloned legacy tab identity, malformed stored authority, terminal
  close handling, and safe cross-provider conflict recovery.

After those fixes, every command listed above was rerun. The validated local
staging artifact was rebuilt at commit `c7e4c7b`. No linked migration, remote
push, staging deployment, or established two-profile test folder was changed.

Non-failing existing test/build warnings were observed for React `act(...)` in
older UI tests and Vite ineffective dynamic imports. They did not originate in
the active-room changes and did not fail any gate.

## Rollback Boundary

The implementation is split into coherent local commits. Runtime rollback can
revert the extension admission/close commits and the Web/Worker consumer
commits while leaving the additive server-only table and RPCs in place. No
destructive database down-migration is required.
