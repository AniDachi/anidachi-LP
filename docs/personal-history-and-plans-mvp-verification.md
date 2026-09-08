# Personal History And Plans MVP — Implementation Evidence

Started: 2026-09-08 (Asia/Ho_Chi_Minh). Status: Tasks 1–9 locally reviewed; Task 10 pre-delivery checkpoint.

This record tracks the [implementation plan](superpowers/plans/2026-09-08-personal-history-and-plans-mvp.md)
and [accepted specification](superpowers/specs/2026-09-08-personal-history-and-plans-mvp-design.md).
It is not staging activation or production acceptance. D01–D05 were accepted
before execution. Production promotion remains a separate decision.

## Preserved Baseline

- Fresh remote staging: `a03c0128825c73edcfdf9062a8d85e70148b2423`.
- Remote main: `54a154b702ea26e85fab2f3259aa7e5b98fa51be`.
- Isolated branch: `codex/personal-history-mvp`, worktree `.worktrees/personal-history-mvp`.
- Baseline commit: `0069baf`; source worktree remains on `codex/watch-toolbar-polish`.
- The original mixed WIP was copied to an ignored backup before isolation.
  All 1,069 recorded original source hashes remained unchanged afterward.
- Seventeen approved drawer files were carried forward; catalog server files
  already matched staging and were not reintroduced as new changes.
- Both established tester folders were byte-identical (12 files), with
  `version_name=9ee74a7c-staging-title-outline-20260906-r10`. They were not replaced.
- Read-only staging inspection confirmed all 41 repository migrations through
  `20260905145315_watch_history_browse_episode_previews`. No remote SQL changed.

## Initial Local Checks

Node 22.23.1 and pnpm 11.2.2; frozen dependency install, no dependency upgrades.

| Check | Result | Limit |
| --- | --- | --- |
| `pnpm check` | Passed, six tasks | Five unchanged tasks used existing build cache. |
| `pnpm test` | Passed, six tasks | Four unchanged tasks cached; initial sandbox IPC denial was retried with local socket permission. |
| Extension tests | 1,759 passed | Automated local behavior, not loaded provider acceptance. |
| Web tests | 447 passed, six skipped | The skipped optional local RPC/benchmark evidence gates are not treated as passed. |
| API tests | 201 passed | Cached baseline result for unchanged API. |
| Full migration chain | 41 applied | New disposable database only. |
| Existing pgTAP suite | 15 files, 732 assertions passed | Disposable database only; existing fixture notices are expected. |

Database tests use a new Colima profile, unique Supabase project
`anidachi-personal-mvp-20260908` and nondefault port 55582. The existing guard
verified the exact marker, Docker labels, project and port. Existing local and
remote databases were not reset. Initial VM mount configuration prevented the
CLI-created temporary file from reaching Postgres; correcting the new VM's
mounts resolved setup without a product-source change.

## Task 1 — Contracts And Early Media Experiment

Commits `ed87235` and `259050c` add strict tariff/access/personal capture/media
contracts, preserve active legacy event unions, and add an opt-in raw WebRTC
experiment. Protocol tests passed (160 tests) and all six cross-plane type checks
passed. Independent review approved the contract gate; two minor experiment
report/deadline corrections were implemented and independently re-reviewed.

The experiment uses synthetic 320×180 video at 10 fps and oscillator audio,
separate Chromium pages and local signaling. It does not load the production
Worker or extension media controller. Browser CPU is measured against one CPU
core; these values do not establish per-device production cost.

| Scenario | Connected pairs | Decoded video/audio streams | Browser CPU | Receiver reconnect |
| --- | --- | --- | --- | --- |
| Four clients: three publishers, one receiver | 6 | 9 / 9 | 53% of one core | 425 ms |
| Six clients: four camera, five microphone publishers, one receiver | 15 | 20 / 25 | 135% of one core | 443 ms |
| Fifteen clients with overlapping camera/audio publishers | Not completed | Not verified | Host contention | Not verified |
| Fifteen clients with four camera and eight separate audio publishers | 102 | 56 / 112 | 247% of one core | 603 ms |

Receive-only pages in the completed samples had zero local tracks and no
`getUserMedia` calls. The initial incomplete one-way negotiation was a harness
defect and its measurements were discarded before these completed samples.

The fifteen-client attempt caused host contention while auxiliary test runs were
also active. The experiment was stopped and its owned browser was closed. The
concurrent protocol payload test and room readiness check timed out; they are
not passing integration evidence. The specific protocol test passed in 22 ms
after recovery. This interrupted run does not prove that fifteen distributed
clients cannot work.

The experiment now requires explicit selection for fifteen-client scenarios,
has a whole-scenario deadline (at most 60 seconds), saves incremental results,
and force-cleans only its owned browser. Real timeout cleanup and focused
timeout-during-cleanup finalization were checked. Heavy capacity and regression
suites must run separately.

The isolated fifteen-client disjoint repeat passed on 2026-09-08 at 04:21 UTC
using Chromium 148.0.7778.96. All other implementation test runs had finished;
the task's disposable Colima VM was gracefully stopped with its database
preserved. The original browser preview and other local profiles were untouched.
The existing runner's whole-scenario watchdog was 60 seconds; the process exited
normally and its headless browser was gone afterward.

All 204 peer endpoints connected, with up to 14 peers per client. Setup and first
decode took 2,752 ms. During the 10.025-second measurement window there were no
stalled streams; three receive-only clients had zero local tracks and device
requests. Publisher uplink was 351–521 kbit/s for this synthetic workload, while
receive-only uplink reported zero. Reconnecting a receiver restored four video
and eight audio streams in 603 ms. No relay endpoints were used. The ignored
coordination receipt is `capacity-15-disjoint-isolated.json`.

Ruling: the reviewed contracts and completed raw 4/6/15 experiment unlock the
remaining implementation with the agreed limits. Actual production-controller
capacity, TURN, real networks, devices and lifecycle remain media/release gates
for Tasks 8–10. The short synthetic localhost sample is not production quality
or reliability acceptance. No agreed cap was reduced and no SFU was added.

## Task 2 — Durable Access And Billing Refresh

Commits `e1d6223` and `a3ac036` add owner-bound access/entitlement endpoints,
durable access epochs, explicit manual grants and a fenced Stripe refresh. The
two additive migrations preserve the existing history generation and data.
The resolver handles actual paid expiry without waiting for a webhook and
keeps the selected plan's expiry separate from continuing history entitlement
through another paid subscription.

Refresh obtains a durable lease before retrieving the current Stripe object,
then commits the subscription mirror and account access under the existing
account lock. The independent review found an account-selection regression for
requests carrying different website-cookie and extension-bearer identities.
The fix restores the endpoint's established bearer precedence, tests real
signed test JWT selection and passed scoped independent re-review.

| Check | Result | Limit |
| --- | --- | --- |
| Final web type check | Passed | Local source only. |
| Final focused access/billing tests | 29 passed | Stripe retrieval and DB transport are controlled test dependencies. |
| Web suite | 458 passed, six existing skips | Subsequent scoped auth/request-chain fixes received focused tests and type checks. |
| Full pgTAP | 16 files, 778 assertions passed | New guarded disposable DB, 43 migrations. |
| Concurrent SQL connections | Passed | Writer/downgrade ordering, expired-fence rejection and retained 123-second checkpoint. |
| Local DB security advisors | No issues | Local schema, not production configuration. |

An actual populated canonical progress row remained byte-equivalent through
downgrade, expiry, renewal and repaired billing authority. This verifies access
transitions after migration; the populated before/after migration rehearsal
remains Task 9. The SQL writer and downgrade waited on the same account lock
in both orderings (observed waits 390 ms and 411 ms). A superseded Stripe
snapshot could not restore stale access.

Read-only aggregate inventories on September 8 found no unexplained paid
mirrors in staging or production. Production had 305 Free accounts: 302 with
no subscription history and three with only inactive or expired subscription
history. No account or billing identifiers were queried. Its migration list
had 35 entries, six behind the initial 41-migration staging baseline. This
snapshot does not prove the complete production upgrade path or authorize
promotion; refresh it and rehearse that separate migration chain before any
future production release. If paid mirrors with historical canceled rows
appear, reconcile explicit grants rather than infer stale billing or an
indefinite entitlement. The migration preserves paid mirrors with no
subscription history as explicit grants.

Real Stripe TEST flows remain unrun: account discovery through the configured
connector returned `USER_NOT_LOGGED_IN`. No LIVE fallback, prices, subscriptions,
webhooks or external notifications were changed. Existing history capture/read
paths are not yet activated with the new policy; Tasks 3–6 and coordinated
rollout remain required.

## Task 3 — Personal Writer, Read Fences And Unified Browse

Commits `b03f581` and `899410f` add independent own-player checkpoints, durable sequence and
receipt fences, paid history/catalog access, and personal browse over retained
solo/shared records. Independent review and the scoped fix re-review passed. Completion remains
sticky; a newer genuine rewatch can move Resume backward without using the
host's position. Free preferences and explicit consent changes remain available,
as does deletion of all owned history without first reading the paid list.

The single database policy starts inactive. A new personal envelope is already
strictly paid; old writers remain compatible only while the policy is inactive.
After activation, both public legacy writer aliases return update-required
before receipt replay. The internal canonical core is inaccessible directly to
service_role. Catalog attempts bind the access epoch at issuance and commit;
substituting a new proof does not authorize an old attempt.

| Check | Result | Limit |
| --- | --- | --- |
| Final cross-plane type checks | Six tasks passed | One unchanged task cached. |
| Final web suite | 468 passed, six existing skips | Handler tests use controlled stores; no deployed HTTP/SSR acceptance. |
| Final protocol suite | 161 passed | Additive catalog proof contract included. |
| Full pgTAP before final cleanup | 17 files, 848 assertions passed | Actual disposable PostgreSQL. |
| Final delete-all cleanup regression | 74 assertions passed | Scoped actual SQL/service_role run after the final migration; no full 852-assertion run claimed. |
| Concurrent SQL connections | Passed | Writer/downgrade, delete/replay, consent/write and activation/legacy races. |
| Final local security advisors | No issues | Includes the private-core and delete-all privilege changes. |

Actual competing SQL connections waited 406–423 ms at the shared authority
boundaries. A higher sequence from the same session could correct its earlier
client clock and update Resume, while an older different session could not
overwrite that point. Eligible Crunchyroll capture survived YouTube consent
changes. Synthetic fixtures were removed or rolled back afterward.

Mixed retained history and sessionless canonical progress survived local policy
activation, with search/date filters applied before bounded pagination. The
owner's historical time and source variant were used even when a shared host
continued later. This is populated activation evidence; the complete populated
before/after migration rehearsal remains Task 9.

Seven additive migration entries bring the disposable chain to 50. One generated
file was accidentally applied empty after a local assembly error; it was kept
immutable and corrected by a subsequent migration. The final narrow migration
removes the owner's operational sequence rows atomically during delete-all;
partial deletion and other owners are unaffected, and old-generation retries
remain rejected. No existing history retention policy was introduced.

Independent review found a catalog cache-hit path that could rebind an old
accepted or pending revision to a later paid epoch. The fix binds authority only
when a new revision is actually issued. Both accepted-cache and pending A/B/A
sequences were reproduced against PostgreSQL (five failing assertions), then
passed all 20 regression assertions after the forward migration. A genuinely new
attempt still succeeds. Final local advisors remained clean; no unrelated full
suite rerun is claimed for this SQL-only fix. Scoped independent re-review approved the correction.

Activation is still false. After activation, rollback must keep the policy true
and use a tested compatible runtime or a fail-closed forward fix. Setting it
false would reopen legacy Free capture and is not an acceptable rollback.

## Task 4 — Recent People From Confirmed Presence

Commit `42e1b88` records only actual co-presence after a committed WebSocket join,
independently of history access and consent. Invites, HTTP membership, sockets
that have not joined and disconnected reconnect-grace entries do not count.
The existing private Recent People projection, hidden entries, friendship
eligibility and 50-result bound are retained. Independent spec and quality review passed.

A durable outbox coalesces the latest observation per pair, retaining at most
105 pending pairs with an overflow counter. Delivery uses four concurrent
callbacks, an eight-second timeout and at most eight attempts for an unchanged
observation, with exponential retry up to five minutes and a 24-hour outer age
bound. Callback network I/O runs outside the JOIN/end queue. Claims and ACKs
remain durable; an old ACK cannot erase a newer observation.

The trusted internal endpoint uses the existing service authorization. Its
service-role-only SQL function binds the first room generation under a room row
lock, separately from source generation, then validates room times and surviving
accounts. Legitimate first delivery after room end is supported; deleted
accounts are acknowledged without recreation. No provider, title, playback
position, watch session or group data is captured by this flow.

| Check | Result | Limit |
| --- | --- | --- |
| API unit tests | 207 passed | Includes bounded outbox and callback timeout. |
| Actual Cloudflare runtime tests | 44 passed | Includes unresolved callback versus third JOIN/end, forced wake and late retry, replacement/stale close. |
| Web suite | 471 passed, six existing skips | Controlled handler/library tests, not deployed endpoint acceptance. |
| Protocol suite | 162 passed | Strict co-presence payload and no viewing fields. |
| Cross-plane type checks | Six tasks passed | Local consumers only. |
| Room harness | 39 of 39 passed | Local room lifecycle/signaling; separate from media capacity. |
| Actual SQL suite | 19 files, 895 assertions passed | Guarded disposable database, 51 migrations. |
| Final scoped SQL | 23 passed | Strict history policy active only inside the rolled-back Free-user fixture. |
| Local security advisors | No issues | Local grants/schema only. |

The initial forced-wake test timed out because it left an END response body
unconsumed, retaining I/O during eviction. Consuming that response fixed the
fixture; no application workaround, timeout increase or skipped assertion was
introduced. The final runtime test verifies persisted late delivery, successful
ACK and an empty alarm after wake.

The additive migration preserves existing evidence and projection. Synthetic
fixtures were removed or rolled back and the durable history policy remains
inactive. The task database was subsequently stopped, with its data preserved,
for the isolated raw media experiment above. Worker delivery still requires
the compatible migration and Web endpoint before deployment. Actual authenticated
Web/Worker/database staging acceptance remains a later gate.

## Task 5 Reviewed Personal Capture and Resume

Implementation `e4f9083`, corrected by `092f189` and independently approved,
replaces room-dependent history capture with one
recorder for the viewer's own player. Paid authority is checked before history
observation or catalog discovery. Persisted access deadlines survive client
recreation, and request latency consumes the lease instead of granting a new
five minutes after a response. Confirmed Free clears local capture data;
unavailable authority pauses capture while retaining previously eligible,
bounded work. Neither path deletes confirmed server history.

Queued personal requests retain their original owner, generation, access and
consent epochs, event ID and capture sequence. Sequence allocation precedes
asynchronous work. Old envelopes without capture eligibility evidence are
not assigned today's paid rights: they are retired with a bounded aggregate
count and a non-success notice. Confirmed server data and preferences remain.
Live current-resource display now comes directly from the player adapter,
independently of history observation, storage and catalog discovery.

Explicit Resume uses a shared, short-lived source/time navigation intent.
The content consumer verifies current account, generation, access, source and
room state before seeking ready content. It adds no autoplay or room creation;
the programmatic seek alone is not new viewing. This path still needs actual
provider and loaded-extension acceptance.

| Check | Result | Limit |
| --- | --- | --- |
| Cross-consumer type checks | Six tasks passed | Local source only. |
| Protocol suite after Resume fix | 13 files, 167 tests passed | Shared contracts and helpers. |
| Extension suite | 122 files, 1,772 tests passed | Unit and browser-DOM fixtures. |
| Last hard-denial browse fix | 48 focused tests and final extension check passed | Run after the full suite; the full suite was not needlessly repeated for two status-list additions. |
| Resume fix regression set | Seven extension files, 91 tests passed | Actual adapter/MAIN dispatcher with simulated provider APIs, plus ordinary playback/controller regressions. |
| Final narrow staging build and validation | Passed inside isolated worktree | Precommit `e4f9083` metadata plus fix source; not the Task 10 release candidate. |

Delayed access loss, stale successful receipts, sequence ordering, legacy
storage, consent, deletion and current-account fences have automated coverage.
Persisted-state client recreation does not establish actual Chrome MV3 kill,
browser restart, real advertisement readiness or loaded-provider behavior.
The original r10 tester folders were not replaced. The successful build reports
ineffective dynamic-import and large-chunk warnings; this record does not claim
pristine output or establish a newly introduced performance regression.

Independent review found inconsistent Resume URL normalization and an
unsupported Crunchyroll content-phase assumption. Both were fixed and approved
in scoped re-review. The parser and live adapter now agree on canonical raw
content identity. Crunchyroll Resume checks the exactly associated captured
player's known inactive advertisement state immediately before its dedicated
seek. Ordinary room controls remain unchanged. Unsupported provider state waits
within the intent lifetime; duplicate deliveries and lost acknowledgements do
not repeatedly rewind the player. The provider/module shape still needs actual
loaded-browser acceptance. Tasks 6–10 own that coordinated acceptance and the
remaining interface work.

## Task 6 Personal Drawer, Account Site and Pricing

Implementation commit `2bb4e51f8400595000f4459c92ba9f7b141465bf`, based on
`2bee7def94ba2e21df9ab541d89dc0a5252a8ea8`. Independent task review and scoped I1/I2 re-review approved the implementation.
The drawer uses one personal query, with no Mine/Together or social-history
filters. Existing canonical solo/shared and sessionless progress remain visible.
Search/date, season/Specials, film/single-video backing and the approved card
outline remain. No persisted obsolete UI filter keys existed, so no artificial
storage migration was introduced.

Bootstrap authority precedes cached/private drawer rows. The account site checks
access before private fetch and again before serialization, including owner,
generation and epoch. Free consent preferences and clear-all work without title
lists. Explicit Resume uses the actual displayed generation and shared guarded
navigation helper; it does not recreate a room. Pricing source uses central
policy values with unchanged prices and group rights. Public media promises
remain gated by Tasks 8–10; no Stripe or public deployment change occurred.

| Evidence | Result | Boundary |
| --- | --- | --- |
| Full extension suite | 123 files, 1787 passed | Before final minimal Video CSS correction |
| Full web suite | 471 passed, 6 existing skips, zero failures | App TSX has its own explicit suite |
| Final covering extension tests | 121 passed | Includes final source and cache namespace regression |
| Explicit site TSX suite | 25 passed | Includes final access-aware rerender key and Free controls |
| Extension/web typechecks | Passed | Local source |
| Narrow staging build/validation | Passed in isolated worktree | Not a loaded or released candidate |
| Production-component browser fixture | No console/page errors; default 392, narrow 320 and tall behavior checked | Synthetic data, task-only 4186 server |

Independent review found two website integration gaps: the common transport lost
machine-readable authority error codes, and detail pagination did not propagate
access denial to the owner gate. Fix `2b03fa8c79ba8ecfbaad3fc1539c2111f97e245b`
preserves structured code/status plus existing human messages and 401/header
behavior, classifies exact authority codes, and retires private detail/list state
through current-owner and operation fences. Unknown access remains unavailable,
not Free; ordinary non-authority retry retains visible data. Eight route-shaped
regressions reproduced the defects before the fix. Final covering site/API tests
are 42/42, with web typecheck and diff check passing. Scoped re-review approved both findings with no new Critical/Important breakage;
no unrelated extension/build/media suites were repeated for this web-only fix.

Parent inspected paid, Free, unavailable, update-required, empty/filter-empty,
long names/titles, filters, Specials, films, YouTube and actual account-component
screenshots. Shared footer spacing and the wrapped Video label were corrected;
final 392/320 YouTube images have a stable one-line label. Default shell remains
392×600 CSS pixels. Five-row behavior was checked with an explicitly labeled
800px fixture shell override; ordinary default has four rows. Site desktop and
narrow renderings used production CSS. This proves rendered component behavior,
not authenticated staging SSR, provider playback, loaded MV3 or social backend
acceptance. People/Inbox destination content in the fixture was synthetic.

Receipts and screenshots are under `/private/tmp/anidachi-task6-visual/`;
full command logs and exact scope are recorded in the task report. Parent read
final log summaries and browser result JSON; no suite was repeated just to
regenerate reported evidence. Known dynamic-import and chunk-size build warnings
remain documented for final branch triage, with no warning-free claim.

The task-only 4186 server was stopped. Both original tester manifests still match
version `9ee74a7c-staging-title-outline-20260906-r10` and SHA256
`29060bbc99cc83ef6be2198fa8c0c8f042cecb2048269daa11da5839aa521ff3`;
original 4174 preview remains PID 34509. This is a preservation spotcheck, not a
repeat of the full 1069-source hash audit. Neither tester was replaced.

## Task 7 Server Room Capabilities and Quota

Implementation `9fb48f86a0af5279eca182e88ee9e77129c1bd69`, based on
`d6498366e9e3c6a9bf515a54d2fd148675ec0547`, and fix
`9b4caa94ffe9142fae9e385c4f0ba8e894627e5b` passed independent task review
and scoped re-review.
The existing durable policy controls strict versioned room creation and claim
negotiation. Frozen room caps and signed leases use durable host authority;
camera and microphone grants are independent and include host publication.
Per-kind revocation epochs reject delayed pre-revoke intents. Short disconnected
reservations preserve capacity while excluding absent sockets from signaling,
presence and Free usage.

Connected rooms renew authority through the existing authenticated internal
callback. Leases last at most 30 minutes, renew five minutes before expiry and
respect the selected plan expiry. Loss of authority fixes a five-minute closing
deadline that reconnect cannot reset. Free budgets remain frozen after upgrade.
UTC usage is cumulative and idempotent per room/day, with bounded pending
buckets. Quota exhaustion closes live sockets before waiting for accounting;
pending usage and a ten-second finalization retry persist across wake.

| Evidence | Result | Boundary |
| --- | --- | --- |
| Root type checks | Six packages passed | Local source |
| API / protocol units | 213 / 167 passed | Core state and contracts |
| Extension debug summaries | 16 passed | Type integration only; media consumers are Task 8 |
| Web suite | 473 passed, six existing skips | Routes/helpers and contract guards |
| Full Worker runtime before final enforcement refinement | 51 passed | One SQLite overdue-alarm diagnostic was emitted |
| Focused media-v2 runtime after live-end refinement | Eight passed | Stalled accounting ACK, immediate end and idempotent retry |
| Final media-v2 runtime after UTC fix | 12 passed | Includes delayed/exact/pre-midnight and failed accounting; 44 unrelated tests excluded |
| Final legacy-history route/owner regression set | 31 passed | Terminal activation/race response, inactive compatibility, unknown failure and owner/privacy boundaries |
| Room signaling harness | 39 passed | Legacy signaling regression, not media decode proof |
| New SQL / existing active-session SQL | 28 / 48 passed | Includes real concurrent admission and security boundaries |
| Local database security advisors | No issues | Guarded disposable DB only |

Four forward migrations were applied only to the dedicated port-55582 database:
20260908065520, 20260908070552, 20260908071729 and 20260908072249. Final inventory
contains 55 migrations, policy version 1 inactive, and no Task 7 synthetic users.
Data is retained and the SQL window released. The task VM was gracefully stopped
at 15:00 local time on September 8 to free resources for media load testing. Applied migration files were not
rewritten. Parent inspected the reported final log summaries; passing focused
tests are not represented as a second full-suite run.

Independent review corrected a delayed-midnight ordering defect: the old day's
allowance now governs only that UTC day. True pre-midnight exhaustion still
closes at its actual point; exact-midnight and delayed events settle the old
bucket before evaluating the new budget. The existing history-room recreation
route is explicitly terminal after activation, including an atomic SQL activation
race, while inactive legacy behavior remains. It introduces no v2 history
recreation feature. Actual Worker and route regressions reproduced the defects
before the fix and passed afterward; API/Web/protocol typechecks also passed.
Scoped re-review approved both changes with no new Important/Critical issue.

Actual old Worker token verification, old Web callback parsing and SQL create/
claim fences have compatibility evidence. Actual P2PMediaController grant-to-
capture behavior, terminal peer teardown, loaded UI, TURN and two-network
acceptance remain downstream requirements.

## Task 8 Extension Media

Implementation `fd09142529696666b2482bba66ba4f7d4d848d20`, based on
`60f8e6ae6a7cd269cf5c246e69db6a2e9a8fe8c1`, passed the local checks below.
Independent review found three Important issues, corrected in
`ec275468c8c891041c4410ede8e69bd49149c144` and approved in scoped re-review.
A released subject could lose still-active staggered target rate windows; terminal
capture failure could retain a grant; and an interrupted disable could remain
uncommitted after same-instance reconnect. Actual-source regressions reproduced
the defects first. Earlier green local-off fixtures did not establish terminal
grant release; final covering cases assert server grants and related reception.
The existing controller still owns capture and RTC peers. RoomClient owns the
transport and a focused volatile helper for explicit intent, grant, ACK and
snapshot ordering. Camera and microphone authorization are independent;
receiver-only participants use no device permission and form no peer pairs with
other receivers. Ready PTT retains its microphone place between presses.

Actual four-client testing exposed the old global SDP limit. Signed v2 now uses
existing signaling budgets per authorized target, with a frozen-cap-bounded raw
frame ceiling and the unchanged general budget for other or invalid messages.
Legacy behavior is retained. Independent review and scoped re-review approved
expiry, reconnect, churn, authorization and allocation boundaries. Released
subjects now retain all still-active child windows, including staggered ones.

| Evidence inspected by parent | Result | Boundary |
| --- | --- | --- |
| Full extension suite | 124 files, 1802 passed | Final covering set subsequently ran after fixture timing correction |
| Final covering extension suite | Four files, 199 passed | Controller, helper, controls and actual overlay wiring |
| API / Worker runtime | 216 / 59 passed | Local source and real Worker test runtime |
| Room signaling / existing real media harness | 39 / 26 passed | Includes legacy lost offer/answer recovery and listener output |
| Extension/API checks | Passed | Final source |
| Narrow staging build/validation | Passed | Worktree-only build; metadata predates commit, not delivery candidate |
| Actual 4 / 6 / 15 participant runs | All permitted streams decoded and every present endpoint advanced | 12 / 30 / 204 endpoints; synthetic devices on one machine |
| Complete first-video samples | 3/3 p95 118.2 ms; 10/10 p95 201 ms; 56/56 p95 277.8 ms | One run per size; measured from first remote roster observation |
| Receivers in 15-client run | Zero getUserMedia calls for all three | Four camera-only plus eight mic-only publishers |
| Pair selection in 15-client run | 14 peers per publisher, 12 per receiver | 102 pairs; no receiver-to-receiver pairs |
| Terminal RTC teardown | All peers and local publication stopped while accounting response remained pending | Actual local Worker/controller receipt |
| Room-shell component images | Parent inspected viewport 320 host and 392 receiver | Existing maximum width 324; not full loaded overlay |

The final capacity receipts are `/private/tmp/task8-media-4-live-reload.json`,
`task8-media-6-final.json` and `task8-media-15-final.json`. Every present inbound
video frame and audio decoded sample counter advanced over approximately one
second. The 15-client run completed setup in 4134 ms and all media 377 ms after
the final join. This is a bounded local decode check, not an endurance or
reliability percentage. An earlier incomplete 55/56 sample is not used as the
final percentile.

Production camera constraints remained 240×240, ideal 10 fps/max 12; observed
video was VP8 240×240 at 10 fps. Configured targets were video 150 kbps and audio
24 kbps; effective encoder enforcement was not separately sampled. The isolated
15-client whole-harness lifetime sample was 481.7% summed CPU (about 4.82 logical
cores) and 3998.1 MiB summed RSS, which can include shared pages. Over 1052 ms,
aggregate RTP uplink per camera publisher was 1.218–1.272 Mbps and per microphone
publisher 0.706–0.741 Mbps across 14 copies. These are not steady-state single-
browser CPU, WAN link traffic or per-encoder configured limits. Selected
candidates were host/UDP only. The dedicated database VM remained stopped.

Earlier actual runs exposed overlapping renegotiation destroying a valid peer.
The correction uses the existing stable-state drain for normal v2 requests while
preserving stale signaling recovery. Its regression reproduced the defect first;
actual late publication then decoded in 201 ms. Legacy dropped-offer and dropped-
answer recovery each took 311 ms. Actual v2 PTT first/repeat samples were 60/68 ms
with a previously granted microphone place and warm-track reuse on repetition.
These samples do not measure grant acquisition or physical-device permission.
Synthetic permission denial, track-ended recovery and emulated short offline
checks passed; they do not establish physical device or two-network behavior.

A separate reload audit found that the earlier fixture had released grants
before reloading. A fresh RoomClient restoring a still-live server grant without
volatile intent now releases it, while the same instance keeps its current
intent across socket reconnect. The final live-reload receipt confirms camera
and microphone clients reusing live sessions released grants at sequence 2,
made zero capture calls and recovered reception in 114/112 ms. A same-instance
reconnect retained the one existing microphone capture. Parent inspected the
structured receipts and final command summaries without repeating the suites.

The component fixture shows compact independent counts, long names, host revoke
controls and scrolling 15-person roster at the existing room-panel width.
Reconnecting was a fixture state; denial feedback has unit/runtime/wiring proof,
not a separate rendered denial screenshot. Full loaded overlay/provider behavior,
forced relay, two-network and physical-device acceptance remain open.

AST-only Graphify refresh succeeded and its generated team artifacts are retained
for the parent's final semantic refresh. Build warnings about ineffective dynamic
import/chunk size remain recorded; no warning-free claim is made. Owned media
processes and ports were cleaned; the original 4174 preview and tester folders
were preserved. No remote changes or original tester replacement occurred.

Fix verification: 13 limiter tests, 268 covering extension tests and a later
54-test transport set passed; the latter overlaps the 268 and is not additive.
One Worker command ran all 60 runtime tests because its intended selector was
forwarded incorrectly; all passed, including the actual staggered-window
reconnect regression. Final extension/API checks and narrow worktree build/
validation passed. No full 15-client rerun was performed for lifecycle fixes.

Internal terminal callbacks carry the exact immutable MediaIntent of the capture
attempt. Current-controller, generation, request, sequence and epoch checks stop
a late failed attempt from disabling newer intent. Initial denial and exhausted
camera/microphone recovery release only the failed kind; bounded recovery holds
its grant. Lost desired-off commands reconcile once per actual transport with
the original request/sequence, without snapshot storms or replay after newer
intent/epoch. Mounted actual Overlay wiring and actual Worker/controller cases
provide complementary evidence.

Final `/private/tmp/task8-fix1-media4-isolated.json` passed 15/15 in 38.047 s:
interrupted camera/microphone disables released server grants, permission denials
released only the failed kind, both exhaustion paths released their grants and
other microphone reception continued. The earlier combined scenario passed its
assertions but emitted one ninth-SDP rejection after setup and independent
permission cases shared a ten-second window. That receipt remains disclosed.
The final run separates independent scenarios by existing windows; a bounded
trace measured per-phase offers 2/6/5/4 and zero rate denials. No waits were added
inside a recovery loop and no limits were raised. Temporary trace instrumentation
was removed. Fixed-budget exhaustion under arbitrary rapid repeated actions is
not claimed impossible.

Scoped re-review found I1/I2/I3 addressed and no new actionable fix regression.
The independently identified old quota-display/auto-end consumer was deferred
to Task9: disconnected reservations, committed-usage overlap and UTC rollover
were not covered by Task8. Task9 integration evidence follows below.
This prevents treating the server's existing quota proof as full interface proof.

## Task 9 Local Integration and Populated Preservation

Task 9 source base is `6baf39c4dca26d0de99d13eb78a35395d14d7794`.
The release candidate and its deployed identity remain Task 10 gates. This section
records local evidence; it does not activate a policy or accept an external stack.

### Authoritative quota integration

`ROOM_SNAPSHOT.quota` is optional and strict: UTC `day`, integer
`remainingSeconds` in 0–1800, `metering: boolean`, and nonnegative integer
`measuredAt` (server milliseconds). Only frozen Free v2 rooms emit it, only when
the reconciled budget matches the usage day. The Worker computes
`max(0, allowedSeconds - roomUsage.seconds)`; HTTP committed daily remaining is
not subtracted again. Paid v2 omission is expected. Free omission is unknown,
shown as “Checking room time…” without a legacy fallback.

The actual Overlay regression reproduced the old ACK/reconnect arithmetic. The
actual Worker regression additionally found that an existing host received only
PARTICIPANT_JOINED when the guest joined: its quota anchor would stay paused.
V2 joins now send the existing snapshot to other sockets; disconnect snapshots
already exist. Existing policy service/alarm completion now publishes the same
snapshot after lease/budget/day reconciliation. No endpoint, poller, scheduler,
second quota authority or tariff change was introduced.

The local interval interpolates only connected host + authoritative metering.
Disconnected reservations pause it. A v2 estimate at zero never sends the
privileged quota-end request or tears down the room; genuine ROOM_ENDED retains
terminal teardown. Legacy arithmetic and client-end behavior remain intact.
Quota ordering checks server sequence, measured time and UTC day, including an
unknown-budget interval. Current room/session/owner/connection callback ownership
and generation checks fence stale deliveries. Source changes retain the room
quota anchor; room/session replacement clears it. A reconnect hides its old
estimate until a current snapshot arrives. The mounted test exercises the actual
Overlay reconnect scheduler and HTTP bridge with committed remaining1500, then
accepts Worker remaining1200; a callback from the previous connection is ignored.

Actual Worker tests observe the published 1200-second budget after nonterminal
ACK/current-room overlap; exact and delayed midnight settle yesterday and publish
1620 seconds after 180 seconds of new-day use. The mounted Overlay covers fresh
1800 at exact midnight, stale room/session/source/sequence/time/day, unknown
budget and zero without client termination. These are controlled local clocks,
sockets and mounted components, not loaded MV3 or deployed HTTP acceptance.

### Populated 41 → 55 upgrade

A separate guarded project `anidachi-personal-mvp-preserve-20260908` used port
55592 in the existing task-only Colima VM. It started with exactly the 41 SQL
files from staging commit `a03c0128825c73edcfdf9062a8d85e70148b2423`, through
`20260905145315`. Synthetic data was committed before any new migration. All
14 forward migrations were then applied in order through `20260908072249`.
The previously existing project on 55582 was preserved. Both projects were
read back at55/latest20260908072249/policyfalse and retained; only their task VM
was gracefully stopped after verification (17:18 local September8). No reset or remote SQL
was used. The old v2→v3 destructive transition harness was not executed.

`personal_mvp_preservation_contract.mjs` reuses exact disposable project/config/
marker/container-label/port guards and finite SQL/process timeouts. Its receipt
stores every old column name, baseline/forward file SHA256 and both snapshots.
It compares old columns explicitly, so expected additive metadata does not
invalidate the preservation comparison. `personal_mvp_preservation_seed.sql`
uses real canonical legacy v3 writers and deletion before the upgrade.

The populated fixture contains four accounts (Free/Plus/Pro and cleared), five
progress rows, one completion, one consent-on and three consent-off settings,
a generation advanced to 2 by deletion, no resurrected progress for that owner,
one shared and three solo sessions, friendship, private group, member, group
invite/action/recipient and room metadata. All 24 old-column counts/hashes match.
Empty catalog/old checkpoint/group-provenance tables are recorded as empty;
this fixture does not claim populated preservation for those empty tables.

| Existing table | Before = after rows | Stable old-column MD5 |
| --- | --- | --- |
| `friend_group_members` | 1 | `0340e9aa67ed4d67919dfe90305fbc0e` |
| `friend_groups` | 1 | `09a1712ffee1121f8602e997a76b0cca` |
| `friend_invite_links` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `friendships` | 1 | `c4f9e05e1e101950fdc7d6c4f7236d97` |
| `room_invite_actions` | 1 | `baa9b658974cdb2c1dd2ae3f2208f887` |
| `room_invite_recipients` | 1 | `356fb7c31e5ece192830b5ba516a0098` |
| `room_invites` | 1 | `45d00daf88f18be931e2a5eb44ef4502` |
| `room_members` | 1 | `b0210efeee1a001b7747c894952198c1` |
| `rooms` | 1 | `15a1e69d6a325175363ff5a1ea33f553` |
| `user_watch_settings` | 4 | `5ad50a75a4c9f8e26b9950f0e2db5473` |
| `users` | 4 | `1beec06740c97ca6f6a5b25857cdbd60` |
| `watch_catalog_aliases` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `watch_catalog_snapshots` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `watch_episode_progress` | 5 | `f10ccc1120f0ec533e38fe06ee0412e3` |
| `watch_history_deletions` | 1 | `e62dea02bf957c0b69dcf4fcf7f01279` |
| `watch_history_group_invitation_contexts` | 1 | `741bb033c26c8993113160d0c4adc66b` |
| `watch_history_receipts` | 7 | `cdfe78254bcb86fa09022103e7cfc7f8` |
| `watch_history_session_groups` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `watch_history_session_observations` | 5 | `07b69c897b5010a345f9021bd9369798` |
| `watch_history_title_summaries` | 5 | `6fef47d21df24529e0f1e33b0446eb9e` |
| `watch_history_user_session_summaries` | 5 | `b4e4f9c18ef30a8251b0a3a816f56970` |
| `watch_progress_checkpoints` | 0 | `d41d8cd98f00b204e9800998ecf8427e` |
| `watch_session_participants` | 5 | `306bdc29c6013d5d27dbdc5dd41a84fb` |
| `watch_sessions` | 4 | `6271030c0682cdff46af055bd9a3e764` |

The receipt is `/private/tmp/task9-preservation.verified.json`; its SHA256 is
`0f9cea2dea7194ebbb1c125bb8abff6d52e12372dd82b2171bd961961e614634`.
Final local policy remains version 1 **inactive**. This is a staging-41 chain
proof, not a production-35 chain rehearsal or a permission to migrate production.

### Compatibility, cutover and rollback

| Combination / step | Source-backed result | Remaining delivery gate |
| --- | --- | --- |
| DB41 + old staging Web/Worker/extension | Existing baseline; no new personal/v2 authority | Do not deploy new dependent runtime before additive DB chain |
| DB55 inactive + old runtime | Preserved legacy writer/create path; no activation race from migrations alone | Actual mixed deployed stack smoke not run |
| DB55 inactive + new runtime | Personal capture uses explicit paid authority; v2 create/connect negotiates header2; legacy rooms remain legacy | Stage and verify all consumers before activation |
| Active policy + old history v1/v2/legacy-v3/alias/replay | Terminal update-required; SQL account/policy fences prevent alias or activation-race bypass | Existing SQL/route fixtures pass; real stale extension not loaded |
| Active policy + old ordinary/history room creator | Legacy creation refused; history recreation explicitly426 including SQL race | New negotiated ordinary create must be deployed first |
| Stored v2 room + old Web claim | Legacy claim wrapper refuses even if policy is rolled back; protected core cannot bypass it | Actual old deployed Web denial not run |
| New v2 token + old Worker | Strict v2 signed capabilities omit maxMediaSeats, so actual legacy verifier rejects | Upgrade-required behavior, never silent legacy reinterpretation |
| New client + existing legacy room | Negotiated connect returns original legacy caps; legacy media/lifecycle drain remains | Loaded legacy-room reconnect not run |
| New Worker before Task9 quota consumer | Worker authority correct, old Overlay can prematurely end v2 room | Unsupported activation candidate; deploy matched Task9 consumer |
| Activation | Durable server policy is the authority; client UI flags cannot activate access | Keep inactive until dependency, queue, migration, runtime and acceptance gates pass |
| Post-activation rollback | Keep DB, grants, data, generations, consent/access epochs and active write gates; use a tested v2-compatible runtime or fail closed | Exact compatible deployed rollback candidate and rehearsal are NOT RUN; Task10 must bind them |

Old staging `a03c012` is **not** a valid post-activation rollback: disabling the
policy or restoring an old writer would reopen Free capture. This first cutover
has no prior deployed v2 build. Local inactive preservation and source-level
fences do not establish a tested operational rollback.

Eligible paid pending requests retain original owner/generation/access/consent
epochs, event ID, session and sequence. The actual client tests drain offline
completion and original stored identity work, preserve retries on unavailable
responses, and reject epoch/deletion conflicts without reissuing them. Before
activation, any drain must use that original eligibility; this task has not
drained real installed clients. `personal-history-capture.test.ts` verifies an
unproven old queue is counted once as retiredUnproven, is not posted/relabelled,
and remains non-success after recreation. A currently paid account is not proof
that an old envelope was paid when captured. Confirmed server rows survive;
retirement is never described as a successful upload or “Synced”.

### Final local validation receipts

| Check | Result / receipt |
| --- | --- |
| Protocol units / check | 169 passed; `task9-protocol-test.log`, `task9-protocol-check.log` |
| API units / check | 217 passed; `task9-api-test.log`, `task9-api-check.log` |
| Worker actual runtime | 61 passed; `task9-worker-full.log` |
| Room signaling harness | 39/39; `task9-room-harness.log` |
| Extension full suite | 1812 passed before final additional quota fences; `task9-extension-full.log` |
| Final focused Overlay/quota | 57 passed across Overlay/quota/personal capture; `task9-final-focused.log`; actual same-session reconnect additionally passed `task9-reconnect-focused.log` |
| Web typecheck | Passed; comment-only Web runtime change; `task9-web-check.log` |
| Before/after migration | 24 exact count/hash comparisons passed; `task9-preservation*.log/json` |
| Narrow build/validation/check | Passed final checks; `task9-final-extension-check.log`, `task9-final-build.log`, `task9-final-validate.log`; worktree-local only |
| dev:check | Classification/recommendation only; it does not execute tests |

Receipts named above are under `/private/tmp/`. Unchanged earlier Task1–8 cases
reuse their reviewed receipts above, rather than implying new executions. Task9
changes no capture topology; the final actual 4/6/15-controller media receipts
from Task8 remain the media evidence. No heavy15 repeat was necessary. Graphify
was queried as navigation; final semantic refresh is parent-owned Task10 work.

### Task9 scoped review fix1 — legacy quota compatibility

Independent review found that real RoomClient creates a media helper for legacy
rooms too. Testing helper existence therefore dropped legacy roomUsage snapshots;
the earlier quota fixture did not initialize that helper and missed the regression.
The corrected consumer uses negotiated mediaV2 with a current callback dependency,
or an already accepted v2 capability snapshot. An absent Free v2 budget still
cannot fall back to legacy arithmetic.

The new actual-client-aware mounted fixture initializes RoomMediaSession and
begins transport for legacy, reproducing25:00 instead of20:00 for HTTP1500 and
roomUsage300. After the fix it verifies20:00,19:57 after3seconds,15:00 after a
600-second authoritative reanchor, and the retained legacy privileged end/close
at exhaustion. The existing v2 fixture now also initializes the real helper
lifecycle, preserving all ACK/UTC/reservation/reconnect/unknown-budget fences.

Focused Overlay/quota50/50, extension check, narrow build and artifact validation
passed: `/private/tmp/task9-fix1-focused-final.log`, `task9-fix1-check.log`,
`task9-fix1-build.log`, `task9-fix1-validate.log`; RED is `task9-fix1-red.log`.
This bounded fix adds no server/DB contract or external proof. Preexisting
ineffective dynamic-import and large-chunk build warnings remain disclosed and
are deferred; no bundle cleanup was attempted. Scoped independent re-review of
`b4706c1..f7ed14c` approved I1 and found no new Critical/Important fix regression.
Task9 local implementation is approved; the operational Task10 gates below remain.

### H/E/UI/M/S/C matrix

PASS here means the named **local** evidence passes. The last column explicitly
retains external or operational gates; a local PASS with an external NOT RUN is
not full staging acceptance. Earlier evidence refers to the reviewed Task sections
above and their reports, not an inferred deployed result.

| Case | Local status | Exact evidence scope | External / operational status |
| --- | --- | --- | --- |
| H01 | PASS | Task3 personal_watch_history SQL + Task6 unified browse tests | Loaded mixed history NOT RUN |
| H02 | PASS | Task3 independent paid guest SQL; Task5 personal-history-capture controller | Real provider guest NOT RUN |
| H03 | PASS | Task2/3 paid gate; Task5 Free observation/catalog/outbox assertions | Loaded Free guest NOT RUN |
| H04 | PASS | Task3 independent1080/1440 and own shared progress; Task5 recorder | Two real paid guests NOT RUN |
| H05 | PASS | Task3 E5=1080 personal writer, no earlier-episode synthesis | Provider end-to-end NOT RUN |
| H06 | PASS | Task5 capture-policy paused/no-playback tests | Loaded paused join NOT RUN |
| H07 | PASS | Task5 actual adapter/MAIN guards against simulated ads/unknown/mismatch; Task3 identity fences | Actual ads/provider NOT RUN |
| H08 | PASS | Task3 canonical identity/catalog; Task5 raw-variant Resume regressions | Loaded dubbed variant NOT RUN |
| H09 | PASS | Task3 completion/ordering and Task5 resume-seek/capture tests | Provider rewatch NOT RUN |
| H10 | PASS | Task3 actual SQL concurrency and same-clock ordering; Task5 immutable sequence tests | Multiple real devices NOT RUN |
| H11 | PASS | Task3 deletion races; Task5 stale queue ACK; Task9 cleared generation/hash | Loaded late replay NOT RUN |
| H12 | NOT RUN | Task5 storage recreation/absolute expiry/offline queue pass only | Actual MV3/browser kill NOT RUN |
| H13 | PASS | Task5 controller source/leave/reconnect immutable envelopes | Loaded reconnect NOT RUN |
| E01 | PASS | Task3 route/SQL read fences; Task6 SSR and mounted access-state tests | Deployed HTTP/SSR NOT RUN |
| E02 | PASS | Task2 stale JWT durable resolver; Task3 writer/alias SQL gates | Deployed direct POST NOT RUN |
| E03 | PASS | Task2 concurrency; Task3 gated writer; Task5/6 cache/privacy; Task9 preservation | Real downgrade NOT RUN |
| E04 | PASS | Task2 epochs; Task5 no Free-period capture or epoch laundering | Real upgrade NOT RUN |
| E05 | PASS | Task3 consent races; Task5 per-provider queue fences | Loaded consent transition NOT RUN |
| E06 | PASS | Task2 unavailable; Task5 absolute lease/pause; Task6 error UI | Real outage NOT RUN |
| E07 | PASS | Task2 mocked Stripe current-state/order plus actual SQL fencing | Stripe TEST NOT RUN: connector USER_NOT_LOGGED_IN |
| E08 | PASS | Task2 bearer owner tests; Task3/5/6 stale A/B response fences | Loaded multi-account NOT RUN |
| E09 | PASS | Task3 Free delete SQL/route; Task6 Free delete controls | Deployed Free deletion NOT RUN |
| E10 | PASS | Task5 history-independent room source; Task7 negotiated create/connect; existing room harness | Both providers/all plans NOT RUN |
| UI01 | PASS | Task3 SQL mixed browse; Task6 unified view; Task9 mixed preservation | Loaded drawer NOT RUN |
| UI02 | PASS | Task3 bounded filter-before-page SQL; Task6 UTC/future-date tests | Loaded calendar/DST NOT RUN |
| UI03 | PASS | Task6 stored-filter migration and preference tests | Real old profile NOT RUN |
| UI04 | PASS | Task6 mounted visual catalog/fallback cases and screenshots | Loaded provider catalog NOT RUN |
| UI05 | PASS | Task6 mounted paid/Free/loading/error/empty/filter-empty cache fences | Loaded multi-account NOT RUN |
| UI06 | PASS | Task6 keyboard/focus/reduced-motion and narrow fixture evidence | Loaded extension accessibility NOT RUN |
| UI07 | PASS | Task5 actual adapter/MAIN Resume fixture; Task6 navigation/actions | Actual Popup/site→provider NOT RUN |
| M01 | PASS | Task7 actual Worker/SQL cap admission; Task8 actual4/6/15 | Distributed caps NOT RUN |
| M02 | PASS | Task7 grant cap/revoke tests; Task8 controller/actual-engine | Physical capture denial NOT RUN |
| M03 | PASS | Task7 independent counters; Task8 actual-engine release retains other kind | Physical devices NOT RUN |
| M04 | PASS | Task8 actual4/6/15 receivers decode; all receiver gUM counts0 | Two networks/relay NOT RUN |
| M05 | PASS | Task8 intent/epoch/race and final failure-owner regressions | Loaded PTT/permission race NOT RUN |
| M06 | PASS | Task8 actual live-grant fullreload/same-instance reconnect/failure/lost-disable receipts | Physical sleep/device changes NOT RUN |
| M07 | PASS | Task8 actual15 complete204 endpoints,56/56video sample,CPU/uplink measured | TURN relay and two-network capacity NOT RUN |
| M08 | PASS | Task8 listener/PTT/open-mic units,actual fixtures,narrow324px room screenshots | Physical output and loaded UI NOT RUN |
| M09 | PASS | Task7 frozen host-plan Worker/SQL; quota sourced from room not guest plan | Deployed mixed-plan room NOT RUN |
| M10 | PASS | Task7+9 actual Worker midnight/ACK/end; Task9 actual Overlay reservation/1200/newday/no-local-end | Loaded reconnect/midnight NOT RUN |
| M11 | PASS | Task2 SQL entitlement + Task7/9 lease/expiry/renewal Worker runtime | Real Stripe-linked expiry NOT RUN |
| S01 | PASS | Task4 callback/action tests; Task7 ordinary invite compatibility; Task9 invite rows hash | Actual delivery/link/direct/group NOT RUN; no invitations sent |
| S02 | PASS | Task4 actual WS presence independent of paid history | Real Free+Free NOT RUN |
| S03 | PASS | Task4 actual overlap/delayed-authority/replay tests | Real late network delivery NOT RUN |
| S04 | PASS | Task3 group privacy/mixed browse SQL; Task4 historical independence; Task9 group/history hashes | Deployed edit/archive/remove NOT RUN |
| S05 | PASS | Task7 host authorization/grace;39room harness;Task5 independent capture | Real host leave/return NOT RUN |
| C01 | PASS | Task9 actual populated staging41→55,24old-column counts/hashes | Production35→55 NOT RUN and not authorized |
| C02 | PASS | Task3 SQL alias/replay/activation races; Task5 stale access queues | Loaded old writer NOT RUN |
| C03 | PASS | Task7 actual legacy token verifier and Web/SQL negotiation fences; Task9 source matrix | Mixed deployed binaries NOT RUN |
| C04 | NOT RUN | Additive preservation and gate/source invariants pass; no exact deployed rollback candidate | Task10 must select and rehearse compatible rollback |

## Remaining Acceptance

Tasks 1–9 have scoped independent approvals, including Task 9's legacy quota
fix re-review. This does not close Task 10 delivery. Real
Stripe TEST, deployed Web/Worker/DB coherence, loaded narrow MV3/provider Resume,
actual browser termination, physical media, forced relay/two-network acceptance,
and exact compatible rollback remain NOT RUN. No production promotion is implied.

No PR, push, remote migration, real invite/notification, original tester-folder
replacement or policy activation was performed by Task9. The final release
manifest must bind deployed Web/Worker commits, all DB migrations, policyVersion1,
captureVersion1, mediaProtocolVersion2 and loaded extension version_name/hash.
A worktree build is not that release manifest.

## Task 10 — Local pre-delivery checkpoint

**PRE_DELIVERY_READY**, stopped before shared delivery. The committed
[release packet](releases/personal-history-mvp/README.md) includes exact source
Git objects and all 14 migration hashes, DB/runtime PR drafts, ordered rollout,
one-way activation review material and recovery limitations. Runtime source is
`8e4dd284c65ce47f893d51e28c72700a87e5c68e`; docs/Graphify receipt commits do not
change that pin. Final artifact build follows the controller's whole-branch
review; artifact/deployment/loaded identity fields are pending, not inferred
from Task 9 precommit builds.

Read-only remote refresh confirmed unchanged staging a03c012 and main 54a154b
on September 8. PR #247 remains open without auto-merge. Baseline CI/Rooms/P2P
runs passed for a03c012 only. Local preparations add no migration file, runtime
behavior, remote SQL, deploy, tester-folder replacement, Chrome reload or
activation. Parent-owned Graphify WIP and the original source/tester artifacts
remain outside this task's edits.

The existing local Tasks 1–9 receipts are reused for unchanged source. Task 10
checks document links, manifest/source equality, migration split coverage and
`git diff --check`; `pnpm dev:check` is classification only. The final controller
semantic Graphify/review and later actual CI/deployment receipts remain separate.
H12, C04, real Stripe TEST, loaded provider and physical/TURN/two-network gates
stay open exactly as in the matrix. The proposed v2 recovery source is not a
rehearsed rollback; first activation stays gated until compatible recovery is
verified. No production release decision is implied.

## Final review fix wave — I1–I3 (September 8)

The final branch review found three Important defects; this local wave addresses
all three and passed the single independent scoped rereview, with no new
Critical/Important findings. Source fix `d2e32e8` and metadata `fd873a4` are approved
for the source/Phase A gate. It supersedes Task 10's historical runtime
pin: current source identity is maintained in the release source-candidate JSON.

- **I1:** the owner transaction locks the inactive policy row and then rejects
  every legacy `status <> 'ended' AND media_lease IS NULL` room. The new guarded
  `personal_mvp_activation_contract.mjs` executes the README SQL itself. Actual
  legacy create holds SHARE; `pg_stat_activity` confirms activation waiting on a
  lock; create commits; activation rejects with policy false. The old SQL failed
  this regression by succeeding. Lobby/live (including 30-day-old rows) reject;
  ended or physically deleted fixture permits activation inside rollback. There
  is no room expiry exclusion based on age or invite expiration.
- **I2:** restored frozen room capabilities initialize subject capacity before
  attached sockets handle frames. Real workerd eviction without another upgrade
  now receives distinct JSON PING/PONG from all 15 participants; old code failed
  at participant 13. Existing independent-grant and flood/replacement checks pass.
- **I3:** catalog launch choice remains separate from history source. Newer
  canonical/pending Resume selects raw URL and exact time together; canonical
  lastWatchedAt advances the pending comparison fence. Three mounted drawer
  regressions parse Resume intents for saved raw absent from catalog, newer
  canonical raw and newer pending raw. Server grid regression preserves raw/time
  when preferred catalog variant differs. All four failed against old code and
  pass after correction. An additional mounted canonical-newer-than-pending
  case protects the updated timestamp fence (51 drawer tests pass). Site Resume reads episode.sourceUrl/currentTime together;
  it does not consume the popup browse/catalog grid endpoint.

Fresh local checks: Web476 passed/6 skipped (482 total, 21.47s), API217 (1.79s),
Worker-runtime61 (21.48s), extension1816 (13.66s), room harness39/39. Web/API/
extension type checks pass. Narrow staging build and artifact validation pass;
preexisting dynamic-import/chunk warnings remain. This was a precommit verification
build stamped61927b0, **not** a final committed delivery artifact or loaded proof.
No protocol/media topology/capture change: prior media15 proof was not rerun.

SQL target was only guarded original disposable55582/project
anidachi-personal-mvp-20260908 on its explicit task Docker socket. Synthetic
fixture cleanup completed; successful activation was always rolled back; schema55
and policyfalse retained. No SQL or fixture changes targeted preservation55592. The owned Colima profile
was stopped afterward; its automatic container lifecycle is shared by both
retained disposable projects. Initial SQL fixture
expected outcome `created` rather than actual `claimed`; this fixture correction
is not a runtime finding. Initial sandbox socket/log restrictions were rerun with
local-test approval; no remote or shared service was used.
Evidence precision: the activation RED log explicitly reports Node22.23.0;
it is not relabeled as the repository's Node22.23.1. Its actual database lock
interleaving remains valid; no duplicate run was needed for that patch-version note.

Controller reports current external boundaries: Mac is locked (loaded Chrome,
provider and MV3 checks await ordinary unlock), and Stripe connector reports
USER_NOT_LOGGED_IN / not connected. These are not new code findings or inactive
source-delivery blockers; dependent activation gates remain open. H12, C04,
Stripe TEST, loaded provider/artifact, physical/TURN/two-network proofs remain
NOT RUN. No remote delivery, activation, production or acceptance is claimed.
