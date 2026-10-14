# Vercel request follow-up implementation

Status: owner approved implementation and staging delivery, 2026-10-14.
Base: staging de27cc98. Branch: codex/vercel-request-followup.

## Spec and global constraints

Extend PR419 with the three approved targeted corrections. No production, Store,
pricing, permissions, environment, schema migration or design changes. Preserve
original UI checkout. Evidence baseline is the local report
artifacts/vercel-cost-followup-2026-10-14/RESULTS-RU.md in the original checkout.
Successful cold history startup currently makes two access calls; five simultaneous
account probes make five calls. Finalization under injected503/Retry-After600
makes131calls in one hour including ten repeated End commands. These are synthetic
counts, not production frequency or promised invoice savings.

Use existing server contracts. No completed authorization TTL cache. Never extend
history leases or use stale identity. Never discard pending source/usage on retries.
Changes must survive restart and preserve old persisted records and rollback.
Tests must demonstrate RED then GREEN with actual network-boundary counters.
The accepted design below is the spec; no separate spec file is necessary.

## Task 1: Startup history validation reuse

Own only watch-history-controller.ts, history tests and minimal startup wiring in
overlay-app.tsx near start/recover. Do not edit auth modules or other overlay code.
Combine start and its startup recovery into a single validation opportunity via an
explicit one-use startup receipt or equivalent scoped operation. Only reuse a
successful fresh network validation from this exact startup. Await an in-flight
startup validation. No check, error, expired lease, owner/revision/consent change
requires existing refresh. Do not globally change bootstrap force=true to false.
Keep ordinary online/auth/choice recovery forced; preserve capturePaused storage
recovery, content-reconnect queue, pending identities and unknown-choice failure.
Test cold allowed/denied2->1, warm negative/optout/paused still fresh, network error,
expiry, account and local-choice races, storage recovery and explicit online.
Run focused controller/client/overlay tests and extension check. Report exact scope,
RED/GREEN commands/counts and limitations. No commits (root owns git).

## Task 2: Session error classification and pending probe coalescing

Own auth-client.ts, auth-tokens.ts and their tests plus background wiring if needed.
Do not edit overlay-app.tsx; report required consumer changes to root.
First distinguish /api/me results: valid200;401 may refresh once; network/timeout/
429/5xx/malformed are unavailable;403/404 are failures without token-refresh loop.
Do not clear valid cached session due to transient failure. Preserve existing
ExtensionAuthTemporarilyUnavailableError and privileged intent restoration.
Persist rotated tokens even if following profile lookup is unavailable, without
pretending cached identity is fresh authorization.
Use one background-owned serialized storage authority with durable authRevision
in the same canonical stored record as tokens. Login/logout/credential replacement
and rotation change revision; metadata changes preserve it. Logout writes a tokenless
tombstone/new revision. Legacy active records initialize once. Validate revision,
owner and credentials before publishing/writing/clearing or reacting to old401.
Audit cross-context writers and listeners; no two-key generation/token race.
Coalesce only pending /api/me for matching revision+credential initially, not whole
login/refresh/adoption flows. No successful-response TTL cache. An abandoned waiter
cannot cancel others; the existing API exposes no caller cancellation handle. Known rights/session change cannot join a pre-change result.
Service worker restart loads durable revision; no promise persistence.
Tests:1/5/20 simultaneous probes N->1, no-account0,503no refresh,401one refresh,
403/404/malformed/network/429, rotation then unavailable, same-token ABA logout/login,
late old401, account replacement, legacy migration, restart and consumer compatibility.
Read current source before choosing compatible return contract; root will integrate
any overlay UI freshness adjustment. Run auth/signout tests and extension check.
Report RED/GREEN and risks; no commits (root owns git).

## Task 3: Durable finalization retry budget

Own apps/api sources/tests only. Preserve successful immediate completion, terminal
fence, frozen usage and source ACK requirements. Persist retry attempt+deadline
before external I/O. First delivery immediate; subsequent delays30,60,120,240,300s
with positive jitter0..10percent, calculated once/persisted. All commands and alarms
respect deadline without extending it on early calls. Gate settlement+source+ended
workflow, preserving source own deadline and presence scheduling with one DO alarm.
Honor Retry-After on429/503 (seconds or HTTP-date), never retry earlier than valid
server deadline; malformed values ignored, overflow checked. Preserve current
truthful pending502/503/webFinalized:false response; no premature200 ACK.
Add optional metadata to schemaVersion1 terminal record, preserving old deadlines
and fence; test rollback parser semantics. Avoid empty usage settlement only when
all frozen usage is durably acknowledged. Keep unresolved409 outbox intact.
No new wire identity/ACK schema in this correction; locally fence stale completions.
Tests: count capped under503, ten premature commands0extra, restart around claim/
ACK, RetryAfter600/date, source/presence interleave, usage midnight/frozen accounting,
old persisted intent, lost ACK, immediate success. Run APIunit/runtime and check.
Report exact RED/GREEN and counts; no commits (root owns git).

## Review focus and delivery

Fresh review for each scope and final combined branch. Root integration owns docs,
Graphify, consumer glue and git. Verify profile freshness does not grant room rights;
startup recovery cannot reuse revoked authority; finalization cannot lose usage or
ACK pending work. Run extension/Web/API checks and suites, runtime and room harness,
plus dev:check. Build/validate isolated narrow staging artifact. Update canonical
state and room roadmap with candidate evidence, semantic Graphify via safe adapter.
Open PR into staging, wait checks/review, merge only this candidate, verify staging
Worker/Web SHA and smoke. Record loaded extension acceptance separately if browser
cannot load unpacked artifact. No production promotion or Store upload.

## Local candidate checkpoint

Runtime candidate commit: `654f5ff4` (October 14). Tasks 1-3 are implemented;
independent review and staging delivery are the remaining gates at this checkpoint.

- Extension: 2300 tests pass and TypeScript/WXT check passes. One intermediate
  combined run exposed an unrelated popup timing failure; isolated 88-test rerun
  and the final complete 2300-test run pass without a popup change.
- Worker: 266 unit tests, 108 native workerd runtime tests and TypeScript pass.
- Web compatibility: 1176 tests pass, six existing tests skipped; type check passes.
- Cold history startup with actual storage-listener integration: two requests to
  one. Five or twenty simultaneous profile probes: one request; completed answers
  are never cached for later authorization.
- Minimum-jitter failure simulation: 15 finalization attempts per hour instead of
  the previous steady 120; ten early commands add zero. Retry-After and persisted
  deadlines survive eviction. Counts describe controlled tests, not invoice savings.
- Root consumer glue requires verified identity before room actions while keeping
  cached identity visible during transient transport errors.

No playback synchronization, media transport, ICE, track lifecycle or shared wire
payload changes are included. The native Worker runtime and room harness cover the
changed terminal flow; a new real-WebRTC media harness run is not required for this
scope. Loaded staging extension login/room acceptance remains necessary before a
production promotion. No production promotion is authorized by this plan.
