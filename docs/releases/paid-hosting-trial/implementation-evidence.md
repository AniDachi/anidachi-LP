# Paid hosting and trial: implementation evidence

Date: 2026-09-27. Local implementation with disposable Stripe sandbox fixtures,
including an uncompleted checkout and two Test Clock subscriptions. No LIVE
objects, remote schema, payment settings, deployments, Store publication or
policy activation changed.

Latest preparation: [September 29 staging preflight](staging-preflight-2026-09-29.md)
records fresh upstream/environment reads, whole-branch review, three corrected
defects, local verification, exact staging artifact and split delivery branches.
The older baseline/CI/local-env statements below remain historical checkpoints;
they are not the current delivery status. No remote delivery occurred.

## Baseline and remaining preflight

- Branch `codex/paid-hosting-transition-plan` starts at staging
  `e4204bdfef86a816a969fda9abdee3102a7a1d39`. Fetched main
  `a5a0134e1d661324061e10ef611dfb373cbe47bd` has the same tree.
- Staging CI [36311122480](https://github.com/AniDachi/anidachi-LP/actions/runs/36311122480)
  is failed with zero jobs/check runs and unavailable logs. The cause is not
  established; do not call remote CI green. Staging smoke and migration delivery
  at this SHA succeeded. Public Worker health responds normally in both environments.
- Both Supabase projects are ACTIVE_HEALTHY and contain the same 63 migrations
  through `20260914151946_room_invite_return`. Staging:
  `cyppqpprkygjloyfvvvj`; production: `bynsjjxzatxndzjkogim`.
- Public legacy ZIP metadata: version `0.1.0`, 703956 bytes, SHA-256
  `c44a09c556b5642bdb617b1f96b7100098596a38c5a8785bf5a4bd7a1e69a310`.
  Metadata does not verify hosted bytes or the exact published Store package.
- Correct staging Stripe sandbox confirmed with owner and existing receipt:
  `acct_1RlmiIPQIEOqG7pr`, TEST. Plus `price_1TkktLPQIEOqG7prWLOncTeX`
  is USD 799/month; Pro `price_1Tkku6PQIEOqG7prqtCEYYEq` USD 1499/month.
  Webhook `we_1Tkl14PQIEOqG7prAB0aLM7a` points to staging with API
  `2025-06-30.basil`. It does not yet subscribe to `invoice.payment_action_required`.
  Portal `bpc_1UEY3sPQIEOqG7prgiXgxMwc` cancels at period end; updates are
  disabled, with `trial_update_behavior=end_trial`. Do not enable that update
  behavior for the agreed trial-preserving switch flow.
- The initially connected legacy TEST mode of the LIVE account was read only
  and then replaced by the owner's correct sandbox. No fixtures were created there.
- Exact Web/Worker deployment versions, Store artifact, LIVE portal/webhook,
  promotion settings and trial email settings remain open before delivery.

## Task 1: dormant foundation

Migration `20260927131509_paid_hosting_trial_foundation.sql` adds policy and trial
ledger with RLS and explicit ACLs. Only the operator can write policy; the runtime
can read it. Runtime cannot delete trial usage or change original identity/end.
One account shares one ledger across Plus/Pro; subscription ownership is a
composite foreign key. Default policy has no activation time and trials disabled.

The existing account/history resolver owns effective access. Legacy subscription
and manual-grant behavior is preserved. Managed trial access is bounded by the
original end plus at most two hours; cancellation/failure shortens it. Confirmed
first payment restores normal subscription semantics. Repeated old events cannot
erase that confirmation. History epochs and capture fences remain authoritative.
This foundation does not yet ingest Stripe trials or enforce room admission.

`hosting` is optional additive account metadata, leaving existing plan/history
fields and media protocol unchanged. Old resolver responses remain readable;
missing metadata does not imply trial eligibility. Malformed authority returns
503 instead of an upgrade prompt. Source consumers and whole-repo checks pass;
published-extension compatibility still needs artifact acceptance.

## Local verification

- Web RED: new hosting tests failed for absent metadata and validation before
  implementation; GREEN: 11 focused tests passed.
- SQL RED: dormant policy/ledger and hosting fields were absent; GREEN: all 36
  new pgTAP assertions passed, including runtime role, exact boundaries,
  cancellation, failed/3DS first payment, immutable trial and recovery fences.
- Existing SQL regressions passed: history access 46, personal history 78,
  room media 66, room policy runtime role 9, active sessions 48 (including dblink).
- Two simultaneous `service_role` inserts for one synthetic account: exactly one
  committed trial; competing transaction rejected by account primary key.
- `paid_hosting_foundation_contract.mjs` applied all 63 prior migrations to a
  fresh labeled container, populated real synthetic account/subscription/history
  fixtures, then applied the migration transactionally. Canonical rows and access
  fences were byte-equivalent; new policy remained inactive. Trial suite passed.
- `pnpm check`: all six tasks passed. `pnpm test`: protocol 202, API 235,
  extension 2039, web 687 passed; six existing web skips. No failures.

Test infra: isolated local PostgreSQL 17.6 in explicitly labeled Docker containers;
the preservation container has no network. Existing dblink test requires TCP with
password authentication, which was enabled only in the disposable container.
Installed Supabase CLI 2.104.0 was killed by the host; downloaded same version
also failed. CLI 2.45.4 successfully generated the timestamped local migration.
No project dependency or external database was changed for this workaround.

## Recovery boundary

Task 5 source review (2026-09-27, design only) found that Worker
`endRoomExclusive` durably schedules a failed end and closes sockets before
callback only for rooms with `roomPolicy`. Legacy rooms need a separate durable
terminal intent. `applyTerminalRoomState` clears the shared lifecycle alarm;
pending accounting/source delivery must survive that cleanup. The web ended
callback skips finalization for an already-ended database room, while
`finalize_room_usage` owns usage settlement and active-session deletion. A bulk
SQL status change would bypass those responsibilities.

The design now selects a transactional activation/outbox and repeatable existing
internal room-end delivery, replacing tentative future per-room cutover alarms.
Before commit, preparation has no scheduled closures. After commit, delivery
continues with the original T until durable fence and finalization are confirmed.
Old-JWT admission, legacy rooms, delivery loss, extended callback outages,
concurrent creation and actual disconnect latency are explicit acceptance work.
These were the initial source-review findings; the local Task 5 implementation and new evidence are recorded below. Staging/runtime deployment remains unexecuted.

Before trial issuance/activation, leave policy inactive and revert consumers while
retaining additive tables. After trial issuance, only a compatible resolver that
understands the ledger and its original deadlines is a valid recovery version.
Never drop trial usage, rewrite history, or reset eligibility as rollback.
Staging/production recovery and full migration delivery remain unexecuted.

## Task 2: checkout preparation

The authenticated route now uses a durable per-account reservation. Its immutable
offer and Stripe idempotency keys survive response loss. A timeout never releases
the reservation. Replays older than 23 hours without an identifiable Stripe
session stop for reconciliation rather than risking duplicate creation after
Stripe's idempotency retention window. Customer mapping cannot be overwritten.

Existing subscriptions lead to management. Open legacy sessions are retired and
their actual outcome reread before creating an offer; completion wins over a
simultaneous expiration or plan switch. Global expiration of old links at
activation remains a release prerequisite; per-account reconciliation alone does
not invalidate a previously saved URL that the user opens directly.

Local proof: 13 focused checkout tests, 14 SQL assertions, and real concurrent
service-role transactions passed. Two reserve calls returned one ID; concurrent
complete/expire had exactly one winner. Web suite: 700 passed, 6 existing skips.
The isolated TEST account accepted card-only, mandatory-payment-method checkout
with `trial_period_days=3`; readback confirmed TEST/open/$0/mandatory card and no
subscription. It was not completed, so no subscription or email was created.
IDs are recorded only in the ignored local evidence file. The connector operation
search did not expose session expiration; the uncompleted fixture has Stripe's
24-hour expiry and no payment method. No LIVE object was modified.

This is not full staging acceptance: actual browser completion, fenced trial
ingestion, Test Clocks, and activation-time legacy URL coverage remain open.
Keep trials disabled until those dependencies and the later plan tasks pass.

## Task 3: lifecycle evidence in progress

An isolated sandbox Test Clock has passed the original 72-hour end for Plus and
Pro fixtures. The Plus regular invoice was first draft, then paid exactly one
hour after trial end (USD 799 cents, simulated only). The Pro renewal was declined:
regular invoice open, first attempt made, PaymentIntent requires_payment_method,
card_declined. Both initial invoices were paid/$0/subscription_create, distinct
from the first subscription_cycle invoice. Service periods use invoice line
periods, not the invoice's backward-looking period_start.

Dashboard browser control provided clock advancement, which the connector's
operation search did not expose. Fixtures have no email or AniDachi user metadata.
This verifies Stripe lifecycle and shapes; it does not prove the new application
webhook, which has not been deployed.

The default sandbox Portal canceled renewal while retaining the original trial
end. A separate synthetic subscription changed Plus -> Pro -> Plus through the
subscription API with `proration_behavior=none` and the original `trial_end`.
The reverse change after cancellation preserved `cancel_at_period_end=true`.
Only the initial $0 invoice existed. At the original trial end the subscription
became canceled, with no regular invoice or payment. Browser Workbench supplied
the update operation that connector search did not expose. This is Stripe
behavior proof, not execution of the application SDK/route or staging acceptance.

Ruling before UI implementation: keep the current SDK/API; use an owner-checked
server flow for trial plan changes. The sandbox default Portal has subscription
updates disabled and `trial_update_behavior=end_trial`; enabling that behavior
would violate the approved trial semantics. The server flow must show the target
price before confirmation, preserve the original end and renewal cancellation,
and refetch through fenced subscription synchronization after the mutation.

Local lifecycle/sync/webhook tests: 25 passed. Full web: 715 passed, six existing
skips; web typecheck passed. SQL lifecycle: 15 passed; foundation 36, checkout 14,
and existing history/room regressions 247 passed. The active-session dblink suite
requires a TCP parent connection; its initial Unix-socket invocation stopped at
connection setup, then all 48 assertions passed with TCP. The v2 RPC makes trial
ledger runtime writes RPC-only; the earlier direct-insert concurrency fixture
documents the foundation checkpoint, not the final runtime write contract.

The server quote/confirm flow and same-origin, account-bound HTTP endpoint are
locally implemented. Seven service tests cover ownership, original deadline,
preserving cancellation, lost responses, changed terms and synchronization failure;
route tests cover session/account changes, CSRF and invalid selections. Confirmation
shows the monthly list price; Stripe retains existing discounts, taxes and credits,
so the UI must label that price accurately rather than promise an invoice total.
The Test Clock also rejected an update using an already-past trial end, confirming
the deadline guard for requests that arrive after the server's preflight check.
Full web suite now passes 723 tests, with six existing skips. The registration
script includes `invoice.payment_action_required`; existing remote endpoints still
need their event-list update during staging setup.

Plan-change UI, real concurrent cancellation, late payment recovery and full
staging acceptance remain open. No remote schema or deployed code changed.

## Task 4: local room admission checkpoint

The canonical SQL create, claim and renewal paths now enforce the dormant
hosting policy, including their legacy wrappers. A second check at insertion
prevents a Free request that passed before T from inserting a room after T.
HTTP commercial denials include readable text for older clients; authority
outages remain retryable errors. Free guests can still join paid hosts without
receiving personal history access.

At checkpoint c745700d, frozen Free rooms kept the then-approved T + five minutes
deadline even if the host upgraded or renewed repeatedly. The owner's subsequent
decision replaces that transition deadline with T, without a warning or grace
period. Worker delivery, old room-token rejection and durable live closure remain
Task 5 work; SQL renewal alone does not finalize all live rooms.

Local evidence: 19 new SQL assertions, 312 previous SQL assertions, web 726 tests
with six existing skips, and protocol 202 tests passed. Actual parallel service
transactions preserved active assignments without a crossed host/guest deadlock.
A wall-clock boundary test proved successful pre-T preflight followed by denied
post-T insertion. Complete checkout, lifecycle and room migrations also applied
to the populated disposable preservation database inside a rollback transaction;
existing users, rooms and memberships remained unchanged.

## Owner clarification: immediate Free cutover

The owner replaced the transition warning and five-minute wait with immediate
closure at T, coordinated with verified publication of the new Store version.
The dormant, unpublished room migration now returns closingAt=T for frozen Free
rooms, including legacy rooms without a media lease. This does not alter the
separate five-minute grace when a paid/trial host later loses access.

Two updated SQL assertions failed against the previous five-minute behavior,
then all 22 room assertions passed after the change; the 312 previous SQL
assertions also passed. Replaying the complete checkout, trial and room migrations
in a rollback transaction on the populated disposable database preserved existing
users, rooms and memberships. This is local authority proof only. Delivery to all
live rooms, old-token enforcement and actual closure in Worker remain Task 5 work.


## Task 5: durable cutover and Worker authority

Local implementation on `codex/paid-hosting-transition-plan`, 2026-09-27; nothing
was deployed, activated remotely or submitted to the Store. The new migration
`20260927155330_paid_hosting_cutover_delivery.sql` leaves recovery disabled and
commercial policy inactive. Only an operator transaction can commit revision/T
and target open frozen Free/watcher rooms. Its pg_net request starts after commit;
logged outbox rows survive loss of the unlogged transport and never expire.

The dedicated Web drain claims at most four targets concurrently with 60s leases,
a 35s pass budget, 28s bounded delivery and 2s bounded database operations. It
validates the original revision/room/generation/T and retains partial fence proof.
Only Worker finalization plus ended database room and released room assignments
complete a target. The scheduler key cannot call room admission or lifecycle APIs.
The request body cannot choose rooms. SQL scheduler diagnostics keep fixed result
categories and status codes, not response content or secrets.

Worker persists terminal intent before callbacks and closes legacy sockets without
requiring roomPolicy. Its own alarm continues after eight callback failures and
hibernation; frozen usage and pending source work remain recoverable. Separate
Web-finalized and runtime-cleaned phases repair a local cleanup interruption.
An uncertain storage flush gates local work without claiming durable receipt.
Fresh authenticated admission applies to old signed tokens too; unavailable or
malformed authority produces 503, and local terminal state is rechecked after I/O.
`ROOM_ENDED` and its existing reason remain client-compatible at source level.

Evidence:

- SQL: 40 cutover assertions, 18 scheduler assertions, 12 real cross-transaction
  concurrency assertions; 336 foundation/history/room/privilege regressions.
  Before-T creation is covered; waiting post-T insertion is rejected. SKIP LOCKED,
  expired leases and late ACK fencing passed. An upgraded host can create a new
  paid room after release; late old-room finalization keeps the new assignment.
- Four follow-on migrations replayed in a rollback transaction on the offline
  preservation DB after foundation. Its two existing users plus two synthetic
  rooms/members were byte-equivalent before/after; no cutover work was created.
- Focused Worker RED tests reproduced old-token admission, unavailable authority,
  missing terminal retries, lost cleanup alarm and uncertain-flush reopening;
  fixes pass in workerd. Full runtime: 86 passed, including native fetch and a
  redirect that never forwards authority credentials.
- Full API unit: 244 passed. Protocol: 202 passed. Full web: 741 passed,
  six existing skips. `pnpm check`: all six tasks passed.
- `pnpm harness:rooms`: 39/39. Local current-source two-Chromium WebRTC harness:
  26/26 including audio, video and reconnect recovery. These are local synthetic
  checks, not the published Store package or distributed-network acceptance.
- The signaling harness exposed workerd's unsupported `redirect: "error"`;
  admission now uses `manual` and rejects non-200. A native-runtime regression
  covers this difference from mock fetch. No production check was relaxed.

Remaining: real Web/PostgREST/Worker staging flow, bounded latency under load,
all-target reconciliation, actual private scheduler configuration and recovery,
exact published old-client P2P teardown, late Stripe payment application flow,
UI and Store publication. See [cutover operations](cutover-operations.md).

Legacy-terminal limitation found during final review: a persisted old tombstone
without new terminal-intent proof is rejected as `ROOM_TERMINAL_PROOF_UNAVAILABLE`.
It cannot reopen or produce a fabricated fence/finalization ACK. A proposed local
repair using a new observed timestamp and repeated finalization was rejected by
automatic approval review as potentially unsafe for usage/sessions if legacy
identity is wrong; it was not applied. A regression verifies the retained safe
refusal. Task 5 acceptance remains open for proven recovery or target exclusion.

## Task 6: local extension offer, 2026-09-28

Task 5 foundation was saved in local commit `488f2d64`. The next local UI block
keeps the ordinary Create room button and handles only the authenticated server's
HTTP403 `HOST_SUBSCRIPTION_REQUIRED` as a plan offer. It does not grant access,
create a room, start Checkout or navigate automatically. Existing pre-activation
creation and quota behavior remain covered by the extension regression suite.

The background reads the fixed `/api/me/entitlements` endpoint with the active
stored token, explicit owner intent, omitted cookies, no cache and a ten-second
deadline including body parsing. It rejects mismatched/contradictory authority,
old-session responses and redirects. Missing additive hosting metadata does not
imply trial eligibility. Only verified eligible accounts see a card-required
three-day offer; at this historical checkpoint old Free/used-trial accounts
received paid-plan copy. The September 28 unified-trial correction below
supersedes the age-based rule and copy. Outage keeps
the generic plans action without a trial promise. Focus/visibility or explicit
refresh updates the offer after returning; even confirmed hosting access requires
a subsequent explicit Create room action. Account changes discard the old offer.

Evidence:

- New client/component RED tests failed on missing modules; 16 new cases passed
  after implementation. Two actual OverlayApp wiring RED cases failed on the
  absent offer, then passed. A third wiring case preserves a plain service error.
- Extension typecheck passed. Full extension suite: 135 files, 2058 tests passed,
  including existing auth, history, media and quota cases.
- Narrow staging build and artifact validation passed. No manifest permission or
  release-version change. ZIPs/generated folders remain ignored and unpublished.
  Existing build warnings cover large chunks and ineffective dynamic imports.
- Isolated Playwright Chromium source-component fixture at 1000px/390px passed
  eligible/existing-account/unavailable copy, fixed plans URL, dialog bounds,
  Escape dismissal and focus restoration. Screenshots were inspected; no browser
  runtime or console errors. Browser plugin was unavailable; installed local
  Playwright was used, without changing a user Chrome profile or remote data.

Remaining Task 6: website pricing/billing/success, verified Stripe price and
first-charge display, trial plan-change UI, shared marketing/FAQ copy, exact
loaded staging artifact and real checkout return/account-switch acceptance.
This partial checkpoint does not complete Task 6 or authorize a release.

## Task 6 scope audit, 2026-09-28

The owner asked whether the extension and removal of Free's 30-minute model were
fully represented in the plan. Read-only Graphify, Serena and source inspection
confirmed that the previous Task 6 checklist was too broad outside the plan offer.
`useFreeQuotaNotice` still reads the quota endpoint and runs reset timers;
OverlayApp still has the live quota counter and quota-ended messages. Its new
guard hides the exhausted notice only after a hosting denial for that account.
The shared Free policy retains `dailyHostSeconds: 1800`, and the quota status
handler still projects quota from planCode. The watch-history client also has a
separate create-room request to `/api/watch-history/v3/rooms` requiring consumer
review. Website billing/help and shared pricing copy retain Free-hosting claims.

The plan now separates inventory, post-T quota removal, all creation/access
flows, history read/record behavior, website billing/copy and loaded-artifact
acceptance. It explicitly retains pre-T compatibility and existing history,
distinguishes technical TTLs from the commercial quota, and adds staging cases
for a Free guest beyond 30 minutes/UTC reset and alternative room creation.
No runtime code, quota configuration, product rule or remote environment changed
in this documentation correction. Existing local tests are not new evidence for
the added open criteria; Task 6 remains incomplete.

## Next-block sequencing, 2026-09-28

Planning only: the owner asked for carefully ordered next steps. Source review
confirmed strict quota v1 parsing and the legacy hook's `quota: null` → `ready`
path; the existing entitlements read already has owner/session checks, database
serverTime and optional hosting metadata. The plan now makes the first product
checkpoint a coordinated server quota/read-contract plus extension change,
before remaining access/history UI and website work. The planned post-T Free
quota response is HTTP403 `HOST_SUBSCRIPTION_REQUIRED`, while the legacy/paid
success shape and authority-outage 503 remain distinct. This is not implemented
or accepted against the exact published old client yet.

The execution order also brings old-artifact/environment verification forward,
keeps the legacy-terminal and stale Checkout-session gates open, and distinguishes
an early staging test ZIP from the later accepted production/Store package.
No new feature, runtime code, tests, deployed configuration or billing state was
changed in this planning pass; the source inventory and all product criteria
remain open until their own evidence exists.

## Block B: quota contract and shared extension display, 2026-09-28

Implemented locally from base `ced0ce69`; this section supersedes the earlier
planning-only quota status above. No remote schema, configuration, billing or
release state changed.

The quota read resolves current hosting authority before reading usage. An active
Free account receives HTTP403 `HOST_SUBSCRIPTION_REQUIRED`, with neither quota nor
reset data; unknown authority still returns 503. Legacy Free and current paid
accounts keep the strict v1 success shape. The shared 1800-second commercial policy
and historical room accounting remain for pre-T behavior and old-room finalization.
They must not be removed until activation, old-room reconciliation and supported
client compatibility are accepted separately.

`useHostingAccess` now owns the display read for both quota and the existing offer.
It compares activation to the server timestamp, deduplicates concurrent event
reads and retires superseded answers. Missing metadata, loading and outages are
unknown, without a trial/minutes promise. It reads on opening, account/session
change, focus/visibility/pageshow/online and explicit refresh; it adds no timer
polling. A quota 403 clears the old notice and refreshes this same display state,
without opening a paywall or starting checkout. Only an explicit Create action
and its authoritative create denial open the offer. Post-T stale snapshots cannot
restart quota display, countdown or local quota-end action. Room termination still
comes from existing server authority.

Session review found a further race: a fresh login can have the same owner and
access token. Both background quota reads and display hooks now use login identity
(the existing refresh-token identity, kept internal and never rendered/logged).
A regression first reproduced the old trial offer reappearing after that login,
then passed with the explicit session boundary. Existing auth/media/history code
was not redesigned in this block.

### Source map for the next block

| Action / surface | Current path and authority | Evidence / remaining boundary |
| --- | --- | --- |
| Quota outside a room | Overlay → `useFreeQuotaNotice` → background `room-quota-status-client` → `/api/me/room-quota` → account resolver | B covers pre-T, post-T, unknown, midnight, request deadlines, owner/login races |
| Live quota / old room payload | Overlay `roomQuota`, authoritative snapshot and legacy local timer | B preserves pre-T v1/v2 and removes post-T display/local end; 31-minute synthetic host/viewer cases are not real paid-host join acceptance |
| Create / plan offer | `handleCreateRoom` → `createAndConnectRoom` → `room-client` → `/api/rooms`; server transaction is the gate | Real Overlay tests and loaded artifact cover denied create, no auto-create, display refresh; full subscription lifecycle remains C/F |
| History Resume | `popup-watch-drawer.tsx` and website `watch-library-client.tsx` use `buildPersonalHistoryResumeUrl`; Overlay consumes `applyPersonalHistoryResume` | Resume opens a source/position; it is not evidence of a room creation button. Full Free read/Resume/delete/capture acceptance remains C |
| Legacy history room recreation | Internal `watch-history-client` command calls `/api/watch-history/v3/rooms`; route calls `checkPersonalHistoryOperation(..., "legacy")` before creation and maps retired creation to 426 | No sender found in current popup/overlay UI source; legacy HTTP/RPC boundaries and wrappers still require C/F acceptance |
| Personal recording | `watch-history-controller`, `watch-history-access`, background operation-specific read/write gates | Existing suite passes; recording/backfill/old-queue and all subscription transitions are not newly accepted by B |
| Pricing, billing, success and shared copy | Website pricing tiers/copy, account billing/help, success sync, FAQ/SEO | Unchanged and still Block D |

### Validation

- RED: active Free still returned 200 quota; bridge accepted/retried a previous
  same-owner login; quota hook showed old exhausted/ready states; real Overlay
  displayed stale 30:00 after T. The fixes passed the same cases.
- A second RED→GREEN cycle reproduced identical-access-token login races in
  both the quota hook and actual hosting offer.
- Final full extension suite: **2082 tests in 136 files**. Web: **744 passed,
  six existing skips**. Protocol: **202 passed**. Web and extension typechecks pass.
- Narrow staging artifact builds and validates with unchanged permissions and
  version. Existing chunk-size/dynamic-import warnings remain. Generated output
  and ZIPs are ignored, not published.
- Loaded the actual unmodified compiled staging directory in an isolated
  Playwright Chromium profile. Browser plugin is unavailable. A local proxy
  blocked all external network; only synthetic HTTP responses were provided at
  the service-worker fetch boundary. Real content script, background bridge,
  Chrome storage/messaging and closed-shadow Overlay rendered on a local
  intercepted YouTube fixture (`https://www.youtube.com/watch?v=localqatest`).
- At 1100px and 390px, verified existing-account payment copy, eligible card trial,
  unavailable authority and newly paid access; fixed staging pricing URL, bounds,
  Escape, no automatic room creation and **zero quota endpoint requests** after T.
  Page identity and nonblank UI matched the fixture, with no framework overlay or
  page runtime/console errors. Screenshots were visually inspected.
- Temporary browser evidence is in `/tmp/anidachi-block-b-loaded/`; its receipt
  binds the loaded ZIP SHA-256. Final commit/source receipt is kept in the ignored
  task ledger directory. This is local synthetic loaded-artifact evidence, not
  real staging, a payment, a published Store package or a browser restart test.
- Read-only GitHub refresh: staging remains `e4204bdf`; Staging Smoke
  `36311264650` succeeded. CI `36311122480` failed with zero jobs created; no code
  test result or root cause can be inferred from that failed run.

Remaining: complete A/C inventory and state matrix; real Free join beyond 30
minutes, restart/stored-session recovery, history and subscription scenarios;
website D; legacy terminal proof, stale Checkout sessions, exact old Store
artifact, full staging rehearsal and release gates. Neither Task 6 nor the
server/staging/production transition is declared complete by this checkpoint.

## Block C, first local checkpoint: room recovery and personal history, 2026-09-28

Base `42a3f959`. This is a partial C checkpoint, not completion of Task 6.
Two defects were reproduced before changing product code:

- A delayed create rejection from a previous login could show a hosting offer,
  old quota notice or server error after the same user signed in again with an
  unchanged access token. The failure now checks the existing internal login
  identity after prepared-session cleanup and lock release. All three RED cases
  pass; an explicit second create reacquires the lock. Accepted room/session
  admission, token issuance and backend authority were not changed.
- Restored-room terminal 403/404/426 explanations disappeared when opening the
  panel triggered auth refresh. A separate terminal notice survives that refresh,
  retires on an account/login change or new room action, and still clears the
  stored room/hash. HOST denial explains that the room needs a Plus/Pro host,
  without offering a subscription to the joining guest. Three RED cases pass.

Additional integration evidence uses the real Overlay and history controller:
a persisted Free guest connects through the HTTP bridge to a synthetic Pro-host
admission, remains for 31 minutes across UTC, then reconnects using the same
participant session and a second admission request. No create/quota request,
local quota-end, renewal notice or paywall occurs. Personal recording stops on
either expired permission with unavailable refresh or confirmed Free; renewed
room authority does not grant the guest recording rights. A new paid permission
records only new meaningful playback, without replaying the intervening Free
position. Existing background/outbox/owner fences pass in the full suite.

Validation:

- Full extension suite: **2091 tests in 136 files**; final focused Overlay suite
  **85 passed**, including the added Web Lock assertion. Extension check passes.
- The separately invoked website history UI suite initially had three failures:
  its Happy DOM fixture lacked `self`, used by Next's idle callback after
  deletion. Adding that browser global to the fixture gives **37/37 passed**,
  including Free read/Resume/deletion. Website runtime is unchanged; web check
  passes. No new claim about the unrun broad web lib suite is made here.
- Narrow staging build and validation pass, with existing build warnings.
  Source, API/protocol payloads, media logic and permissions have no new changes
  beyond the listed extension state/error handling and test fixture.
- Actual compiled content/background/storage bridge loaded in an isolated
  Chromium profile with all external traffic blocked by a local proxy. Synthetic
  HTTP covers the existing offer matrix at 1100/390px, delayed denied create
  across a new login, actual Web Lock release, explicit retry and initial hash
  join denial. Its explanation survives auth refresh and the hash is removed.
  Exactly three explicit create requests and one denied join, no quota request,
  no page/console error. Screenshots inspected in
  `/tmp/anidachi-block-c-loaded/`; receipt binds ZIP SHA-256. This proves neither
  a real payment, real paid-host room transport nor persistence across a browser
  restart. No user's Chrome profile or remote service was changed.

Still open in C: full account/subscription transition matrix, source-proven
remaining create/legacy boundaries, popup/history read-copy acceptance, and
distinct Free-cutover versus ordinary paid/trial room-end explanations.
Then website D and whole-branch review/staging candidate E. No new Worker,
signaling or media code changed, so the earlier local room/WebRTC harness
receipts are retained as historical rather than rerun/claimed fresh. Full F
staging, Store artifact, legacy tombstone recovery and release gates remain open.

## Block C current-plan display and history copy, 2026-09-28

Base `badc19ff`. Local continuation of C; full Task 6 remains open.
Source review found two different display sources: the offer read current
entitlements, while overlay/popup badges and the popup recording invitation used
the login profile's cached plan. Five RED component cases reproduced the stale
badge/missing owner-bound read. Both surfaces now consume the existing
owner/login-bound entitlements reader. Pending/error hides the prior badge;
the popup recording invitation requires a confirmed Plus/Pro display plan.
Identity, consent storage, capture leases and room-creation authority are unchanged.
No expiry is inferred from trialEndsAt and no polling was added.

The real Overlay test keeps the login profile Free while refreshing effective
Plus/Pro/Free server outputs, including allowed access after the original trial
end and renewed access after a denied state. It checks the badge and offer agree,
failed reads retire both claims, and only the original explicit create occurs.
These outputs represent trial/cancel/pending/failure/late-payment cases; the test
does not simulate Stripe or prove their server-side state transitions. Popup
tests use the real runtime response parser and cover cached paid versus server
Free, unavailable authority, older metadata, logout, another owner and a new
login with an unchanged access token. History's existing read/capture boundary
is retained: Free Resume opens the source, Manage history opens the existing
website, neither creates a room. The old plan-required fallback copy now says
new recording needs Plus/Pro; it does not bypass the private-cache read lease.

Validation:

- Full extension **2098 tests / 137 files** and extension typecheck passed.
  First full run exposed one outdated popup-header fixture lacking the new
  entitlement response; adding that response made the entire rerun green.
- Narrow staging build/validate passed with existing chunk/dynamic-import
  warnings. No manifest, permission, API, Worker, protocol or media changes.
- Unmodified compiled content/background/popup loaded into isolated Chromium,
  with external network blocked and synthetic HTTP authority. At 1100/390px,
  badge/offer Plus, Pro, Free, unknown and recording invitations agree. Prior
  stale-login create denial, Web Lock release, explicit retry and terminal join
  cleanup still pass. Exactly three explicit creates, one denied join, zero
  quota requests and no page/console errors. Screenshots inspected; evidence
  under `/tmp/anidachi-block-c-plan-loaded/`, ZIP/source receipt in the ignored
  task ledger. The history service was unavailable in this browser fixture;
  history read/Resume/capture proof comes from component/background tests.

Still open: distinct Free-cutover versus ordinary paid/trial room-end messages,
the complete entrypoint/subscription acceptance matrix, real billing-to-client
updates and full staging/Store/restart scenarios. No live access, payment,
cutover, publication or deployment claim is made. Website D remains next after
the outstanding extension work.


## Block C room-end causes and warning, 2026-09-28

Base `30b92d3e`. Partial local extension checkpoint; Task 6 and C/F acceptance
remain incomplete. No migration, billing lifecycle, deadline policy, media
negotiation, cutover scheduling or legacy-tombstone recovery changed.

The existing durable cutover context was lost when forming `ROOM_ENDED`.
Worker output now includes optional literal `hostingCutover: true` only for
`capability_expired` with a recorded cutover whose deadline is not later than
that original termination. A cutover later attached to an earlier ordinary
closure cannot change its explanation. Existing reason values and close 4004
stay unchanged. Protocol tests retain the field in new clients and strip it
with the previous object contract; false markers and mismatched reasons fail.
This source-contract check does not prove an uninspected published Store ZIP.

The overlay uses this context instead of the viewer's personal plan. Free cutover
explains the Plus/Pro hosting requirement and free joining; ordinary expiry
explains that host room access could not be renewed. Authority outages can use
the same reason, so this does not assert a failed card payment. Media snapshots
with a closing deadline open the panel once for that account/room/generation/
deadline; the warning displays the original server ISO timestamp in local time.
The client neither resets five minutes nor closes a room on its own timer.
Terminal cleanup stops the active media controller, clears session/hash and
releases the tab lock; the explanation survives an auth display refresh. Missing
terminal frames still use generic close-4004 cleanup, without invented cause.

Validation:

- Protocol marker RED1 then GREEN; terminal replay RED1 then GREEN; earlier
  closure cause RED1 then GREEN. Four new overlay cases initially failed for
  generic explanations/hidden warnings, then passed. Active media teardown is
  checked in the actual existing publication/ACK/revoke fixture for all three
  terminal variants, rather than asserting disconnect on an uncreated controller.
- Root `pnpm check` and `pnpm test`: all six tasks passed (some unchanged tasks
  cached). Protocol **203/18**, API **248/23**, extension **2104/137**. Subsequent
  test-fixture correction uses ISO `closingAt` and the real snapshot parser;
  complete Overlay **92/92** passes again. No runtime source changed afterward.
- Workers runtime **86/4**: immediate cutover emits its marker with no grace
  warning, survives callback retries/eviction, and ordinary authority-loss
  expiry retains the original five-minute bound across wake without the marker.
  Room harness **39/39**, real local WebRTC harness **26/26** passed. These are
  local direct-path results, not physical audio, cross-network or TURN proof.
- Narrow staging build/validate passed after the full packaging test suite.
  Unmodified compiled extension loaded in isolated Chromium with external network
  blocked and synthetic HTTP/WS/local ICE boundaries. Real compiled parser,
  RoomClient, background session storage and Web Locks verify both explanations,
  unchanged deadline/repeated warning, close-only 4004, cleared socket/hash/storage/
  lock, three explicit creates and no automatic create/reconnect. Screenshots
  inspected at **1100/390 px**, no page/console or failed-network errors in the
  completed run. Preliminary fixture runs sent before admission completed or
  omitted the isolated ICE response; they are not accepted evidence.
- Local receipt `block-c-room-end-artifact-receipt.json` under the ignored task
  ledger records source hashes, ZIP/directory identity and browser evidence.
  Screenshots and script are local `/tmp/anidachi-room-end-loaded*` artifacts.

Rollback: reverting this display-only marker/consumer restores the old generic
explanation; it must not reopen rooms, alter trial identities, extend deadlines
or undo durable accounting. Unknown additive fields remain ignored by the
previous source contract. No new env variables or secrets are required.

Remaining gates: complete entrypoint/subscription/account/history matrix;
actual billing-to-client refresh, browser restart, exact old Store artifact and
mixed-version staging; safe legacy terminal recovery or proven target exclusion;
website D, whole-branch review and staged release. No remote writes, activation,
publication or deployment occurred in this checkpoint.


## Unified unused trial for all Free accounts, 2026-09-28

Base `383416ad`. The owner removed the registration-date split and approved
implementation. This supersedes all earlier new-account-only statements in this
evidence. Every Free account with an unused account trial follows the same card
checkout for Plus/Pro after activation. Active paid subscriptions, used-trial
identity, cancellation, first-payment bounds, history and room deadlines retain
their agreed rules. No annual plan, analytics or other deferred feature is added.

Migration `20260928083738_unified_free_trial_eligibility.sql` replaces only the
shared resolver definition and retains its service-role-only execute permission,
empty search_path and timeouts. It removes the unused creation-time read and its
eligibility predicate. Previous migrations remain immutable. Current authority
returns eligible/used/unavailable; existing_account stays accepted by the shared
schema solely for legacy compatibility. The extension gives that legacy response
a neutral plans/refresh message rather than an age-based refusal or trial promise.
Current Free fixtures use eligible. Server creation remains authoritative.

The existing checkout service already compares immutable reserved terms with
current authority. Four added regressions verify replacement of an open nontrial
checkout, replay of its original idempotency parameters after a lost response,
completion winning over expiration, and refusal to replace an unresolved open
session. No checkout runtime code or Stripe state changed in this correction.
An account with a consumed trial still receives ordinary paid checkout.

Validation:

- RED: original trial suite 1 failure, added eligibility matrix 4 failures and
  real paywall component 1 failure exposed the old rule/copy. GREEN after the
  additive migration and UI correction; new matrix **27/27**, original trial
  **36/36**, checkout reservations **14/14** under real service_role.
- Root `pnpm check` and `pnpm test`: **6/6 tasks** each; some unchanged tasks
  cached. Web **748 pass + 6 existing skips**, extension **2105/137**, protocol
  **203/18**, API **248/23**. Focused checkout service **17/17**.
- Full ordered migration replay on a new labeled disposable PostgreSQL container
  preserved populated users, subscriptions, customer mappings, watch settings,
  progress, sessions, participants and manual grants exactly. The policy stayed
  dormant. The preservation contract now applies follow-up migrations before
  checking the current product contract. CLI 2.104.0 is killed by this host;
  the already cached 2.45.4 CLI generated the new local migration filename only.
- Expanded local SQL run: **1350/1351 assertions in 34 files**, including 12
  cutover and 14 invite-return concurrency assertions. Failure **20** in
  `watch_history_v3_browse.test.sql` expects no retroactive context for a repeated
  invitation, but finds one. Replacing the resolver with its previous definition
  inside the same rollback-only fixture reproduces the identical failure.
  It remains an existing whole-branch acceptance issue; SQL is not all green.
  Initial local invocation also exposed the suites' TCP/dblink and explicit
  disposable-flag requirements; corrected runs are the counts above.
- Final narrow staging build/validation ran after packaging tests finished.
  The unchanged artifact was loaded in isolated Chromium with external network
  blocked and synthetic HTTP. Eligible/used/unavailable/paid/legacy offers,
  popup/overlay badges, stale-login response fencing, real Web Lock release,
  explicit retry and terminal guest explanation passed at 1100/390 px. Three
  explicit creates, one denied join, zero quota requests and no page/console
  errors. Screenshots inspected; this is not live Stripe/staging/Store evidence.
- ZIP SHA256 `83721f73e1e669aab654d5361575936a0461abdd7d595453c660573d56240178`.
  The ignored `unified-trial-artifact-receipt.json` records source hashes and
  byte identity of all 11 ZIP/loaded files. Local script/screenshots:
  `/tmp/anidachi-unified-trial-loaded*`.

No env/secret or permission expansion. Before activation, a definition rollback
can restore the prior resolver without deleting records; it would restore the
superseded age restriction and must not be used as the accepted product state.
After activation retain compatible consumers and all used-trial/checkout records;
never reset eligibility or reopen closed rooms as rollback. No push, remote
migration, activation, deployment, Store upload or LIVE payment occurred.
Remaining C entrypoint/subscription/history acceptance, website D, whole-branch
review E (including the SQL failure at that checkpoint) and staging/Store F stay open.

## Block C local entrypoint and history acceptance, 2026-09-28

Base `cb1f095bcbc309c25d41af575a988ac9a532ddf5`. The owner approved continued local
work and explicitly reserved website changes for discussion/agreement. This
checkpoint changes tests/documentation only, not website or extension runtime.

The earlier browse-history failure was a stale occupancy fixture. September 14
commit `7dbeac22` intentionally permits a fresh invitation for an accepted
recipient who left; `room_members` is durable membership, whereas
`active_room_sessions` proves current assignment. The old browse test established
only the former while expecting the latter. RED reproduced 1 failure in 54
assertions; inserting only the missing assignment in a rollback-only experiment
passed all 54 without product changes. The final fixture preserves the original
zero-context assertion for the assigned recipient. Nine additional assertions
cover fenced departure, fresh pending identity, acceptance, no retroactive group
attribution and only a new overlapping viewing appearing in the new group.
The focused result is **63/63**; the entire disposable SQL run is **1360/1360 in
34 files**, including concurrency suites. During test authoring, pgTAP rejected
an expected-result VALUES cursor; the final comparison uses SELECT. No migration
was altered and no database/runtime fix was necessary.

The [extension entrypoint/state map](extension-local-acceptance.md) follows
ordinary Create, hash/persisted/reconnect joins, personal Resume and the internal
legacy history recreation bridge through their actual server boundaries. Four
new extension cases verify that a Free read lease or paid login does not turn
the retired history endpoint's 426 into success; a 503 remains retryable, with
one request and unchanged history storage. These are added regression coverage
for existing correct behavior, not a claimed product RED/GREEN fix.

Current checks: **450 extension tests/13 files**, extension typecheck, and
**43 related web endpoint tests** passed. SQL/local test logs are under
`/tmp/anidachi-block-c-*`; the reproduction/one-variable experiment are
`/tmp/anidachi-history-context-{red,hypothesis,green}.log`. Runtime/manifest and
dependencies are unchanged from the baseline, so the prior narrow artifact
receipt remains applicable to those bytes; no new build or visual/media proof
is claimed. Full-suite, room/WebRTC and staging/release gates retain the scope
recorded at their original checkpoints.

Local history/entrypoint mapping is now recorded in Task 6. Real browser restart,
Checkout/webhook-to-client propagation, exact Store package/mixed clients,
whole-branch review, legacy terminal recovery, old checkout reconciliation and
staging remain open. Website D requires owner agreement before edits. No remote
writes, deploy, push, activation or Store submission. This test-only change can
be reverted without a schema or runtime rollback.

## Minimal trial website, local checkpoint, 2026-09-28

Base: `9d0ba788835a420a18a3fd2d179e8d59953d78b5`,
`codex/paid-hosting-transition-plan`, managed paid-hosting-plan worktree.
The owner approved minimal pricing/shared-homepage pricing, success and account
billing, with the supplied card reference adapted to AniDachi styling. This
supersedes the earlier restriction for this specific block. No push or external
environment change is authorized.

Implementation:

- `GET /api/billing/offer` resolves the current website owner, shared entitlement
  authority, existing subscriptions and mode-aware active monthly Stripe prices.
  Signed-out requests read only public activation policy and offer sign-in.
  Eligible old/new Free users see one trial; used/unavailable eligibility does
  not promise a trial; existing subscriptions/payment problems go to management.
  Responses are private/no-store and expose neither price IDs nor secrets.
- Pricing cards place CTA above features, emphasize Plus and explain card,
  monthly renewal and cancellation. Known pre-T Free hosting remains visible;
  unknown authority disables checkout and does not invent minutes/eligibility.
  Price table uses the same verified prices as cards. Pricing's own FAQ,
  structured FAQ and metadata avoid contradictory legacy promises. Broad
  marketing/SEO and account help remain for the next agreed block.
- Checkout revalidates owner, eligibility action and selected price immediately
  before the POST; server checks expected owner and trial intent before returning
  a redirect. Existing callers retain compatible optional payload fields.
- Billing view combines owned subscription rows with authoritative access and
  immutable trial records: original end, pending hard deadline, failed/3DS,
  ended and paid states. Quote/confirm connects the existing server trial-plan
  endpoint, preserving original end and canceled renewal. Cancel remains the
  existing guarded Portal path.
- Read-only payment recovery validates local owner/customer plus live-mode flag,
  remote subscription/customer/metadata, open latest invoice and its subscription
  parent. Only an HTTPS `invoice.stripe.com` URL without credentials or alternate
  port is returned. It does not create or charge an invoice.
- Success uses the specific synchronized checkout subscription, rather than
  another historical trial or aggregate account grant. Both success and billing
  reread authority at known trial/pending/selected-plan boundaries. Pricing
  retires pre-T offers at activation. Display leases are capped at 60 seconds;
  elapsed request time is deducted. Expiry hides stale state before rereading,
  and never grants access locally. Focus, manual retry and owner fences remain.

Validation:

- RED/GREEN covered the new trial stages and original dates, distinct success
  states, quote-before-confirm, post-T Free, unavailable offers and owned invoice
  recovery. Existing tests continue to exercise account/CSRF isolation.
- One fresh scoped review found Important stale deadline displays and a Minor
  aggregate-plan trial label. Four focused regressions failed before the fix;
  after correction all 29 focused UI tests passed. Timer tests cross activation,
  trial end and pending end while the tab stays focused.
- `pnpm --filter @anidachi/web check`: passed.
- `pnpm --filter @anidachi/web test`: **775 passed, 0 failed, 6 existing skips**,
  781 total / 14 suites. Full log: `/tmp/anidachi-web-full-test.log`.
- Local pricing was inspected in the in-app browser at 1440×1100 and 390×844,
  with synthetic eligible-trial offer responses. Mobile document width and
  scroll width are both 390. At the narrower tablet viewport, three cards were
  too cramped, so the three-column breakpoint was moved to lg. Screenshots:
  `/tmp/anidachi-trial-pricing-desktop.png`,
  `/tmp/anidachi-trial-pricing-mobile.png`,
  `/tmp/anidachi-trial-pricing-mobile-plus.png`.
  The screenshots are fixture evidence, not a real user's billing state.
  Interception and viewport override were removed afterwards.
- Ordinary `http://127.0.0.1:3003/api/billing/offer` returns 503. Its underlying
  environment/integration cause is not established in this checkpoint. Real
  local Checkout, authenticated billing browser and application-to-extension
  propagation remain unverified; do not present the visual fixture as proof.

No new env names, migration, secret/permission changes, dependency upgrade,
extension rebuild, Stripe write, push, deployment or Store action. Existing
mode-correct Stripe keys and configured monthly price IDs are required; test
and live identities must not be mixed. Before T, this website-only diff can be
reverted without data loss; after T, keep compatible UI/authority and do not
restore legacy Free promises. Broader Task 6.5, full transition review, real
Checkout/webhook/extension acceptance and staging/Store gates remain open.

Documentation consulted through Context7 and public Stripe docs:
[Prices retrieve](https://docs.stripe.com/api/prices/retrieve) and
[Hosted Invoice Page](https://docs.stripe.com/invoicing/hosted-invoice-page).
The existing Stripe SDK/API versions were retained.

## Local billing environment diagnosis and preparation, 2026-09-28

Base: local website checkpoint `1e8077e8dfe0c614ee6e4d0ceab1633af343d8df`.
Scope: diagnose the observed localhost offer failure and prepare an isolated
local integration environment. No push, hosted schema change, staging/prod
configuration, LIVE action or release is authorized by this checkpoint.

Root cause and evidence:

- `http://127.0.0.1:3003/api/billing/offer` reproduced HTTP 503 before Stripe
  Checkout. Temporary enum/boolean-only diagnostics identified `Price unavailable`:
  neither Plus nor Pro had a configured runtime Price ID. The local server also
  lacked its TEST Stripe secret and Supabase URL/service-role key. The Stripe
  connector's authorization does not configure application environment variables.
  No secret values were printed. The diagnostic route edits were removed and
  verified byte-for-byte identical to the committed route.
- Read-only Stripe connector verification selected the already approved
  `AniDachi sandbox`, `acct_1RlmiIPQIEOqG7pr`, `livemode=false`. Both current prices
  are active USD licensed, per-unit, monthly interval-count 1: Plus
  `price_1TkktLPQIEOqG7prWLOncTeX` = 799 cents and Pro
  `price_1Tkku6PQIEOqG7prqtCEYYEq` = 1499 cents. No Stripe write was performed.

Local preparation and actual verification:

- Created a separate labeled disposable PostgreSQL container, independent of
  prior SQL-test/preservation containers; no production/staging data was copied.
  Replayed **all 69 current migration files** in order. The new database has
  zero users, `activation_at IS NULL` and `trials_enabled=false`.
- Reused the cached Supabase PostgreSQL image `17.6.1.156` (PostgreSQL 17.6) and
  pinned PostgREST `v14.17` from the current official Supabase Docker configuration,
  digest `sha256:c9dc201e555f5d8e37e7f39cdd4df0229774996e213bfd7de8d10ac609030f2c`.
  Public Supabase changelog was consulted; this local exercise does not validate
  hosted PostgreSQL upgrade behavior or imply matching hosted runtime versions.
- Docker context `colima-anidachi-personal-mvp`; new containers
  `anidachi-paid-hosting-browser-db-20260928` and
  `anidachi-paid-hosting-browser-rest-20260928` have disposable/paid-hosting labels.
  The database has no published port and stays on its private internal network.
  Only PostgREST also joins a dedicated API network and publishes
  `127.0.0.1:55438`. A local transport on `127.0.0.1:55439` strips the client's
  `/rest/v1` prefix and forwards to that fixed destination without changing
  authorization, responses or database logic. Other paths return 404.
- Generated fresh local-only database/API/JWT signing credentials without
  printing them. Private mode-0600 `apps/web/.env.development.local` configures
  the local database. Separate mode-0600 `apps/web/.env.local` contains the
  verified TEST prices and empty Stripe secret/webhook fields for owner setup;
  both files are Git-ignored. The editor was directed to the empty-key file.
- A real HTTP request using the local service-role token read the singleton
  dormant policy successfully. Anonymous policy reads were denied; an unsupported
  transport path returned 404. No intercepted responses were used for this check.
  The transport script, private runtime configuration and migration-hash receipt
  live under the ignored
  `.superpowers/sdd/2026-09-27-paid-hosting-and-trial-transition/local-billing/`.

Remaining dependency and acceptance order:

1. Owner adds the **secret TEST key for this exact sandbox** to
   `STRIPE_SECRET_KEY_TEST` in the local `.env.local`; never paste it in chat.
   The field remains empty at this checkpoint. Verify the key's actual account
   and mode before any Checkout creation; plugin access alone is insufficient.
2. Start a local Stripe event listener with that account and forward to
   `http://127.0.0.1:3003/api/stripe/webhook`. Configure its own signing secret;
   the staging webhook's secret does not authenticate a separate CLI listener.
3. Prepare synthetic local users and the local trial/activation policy explicitly;
   migration replay intentionally leaves policy disabled. Exercise real app
   Checkout, signed webhook synchronization, return/billing display and cancellation
   using test payment methods. Fixture sessions do not establish OAuth acceptance.
4. Record payment-failure/3DS, expiry and old/new Free eligibility results, then
   the application-to-extension propagation and later agreed staging acceptance.

At checkpoint end both Stripe secret fields are still empty and the ordinary
offer endpoint still returns **503**. Local DB transport readiness is established;
real Checkout/webhook/browser acceptance is not. Product source is unchanged from
`1e8077e8`; no broad runtime test rerun is claimed for this environment-only block.
Stop only the two named local containers and the local transport to pause this
environment; do not remove their data or touch the earlier test containers.

Public references: [Supabase Docker configuration](https://github.com/supabase/supabase/blob/master/docker/docker-compose.yml),
[Supabase PostgreSQL changelog](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).
