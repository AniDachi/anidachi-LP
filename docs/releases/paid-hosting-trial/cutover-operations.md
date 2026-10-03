# Paid hosting cutover operations

Local implementation checkpoint, 2026-09-27. This is a preparation/recovery
runbook, not evidence of deployment or permission to activate production.
The [transition plan](../../superpowers/plans/2026-09-27-paid-hosting-and-trial-transition.md)
owns release gates; [implementation evidence](implementation-evidence.md) separates
local proof from staging and the published Store artifact.

## Ordered delivery

The [September 29 preflight](staging-preflight-2026-09-29.md) prepares separate
schema, Web/protocol and Worker/extension branches. The existing database,
Vercel and Worker workflows are independent: do not merge the whole original
feature branch into staging at once. Wait for the observed prerequisite
deployment between each phase. These local branches are not deployed evidence.

1. Apply additive migrations with hosting inactive and scheduler disabled.
   Verify existing accounts/subscriptions/history and runtime-role RPCs.
   Include `20260928083738_unified_free_trial_eligibility.sql`: unused trials
   apply to all Free accounts, regardless of registration date. A partially
   migrated server must not be accepted with the old age-based offer. Confirm
   reconciliation of open nontrial checkouts before enabling the new offer;
   completed payments stay managed subscriptions, never a second trial.
2. Deploy Web admission and cutover drain before deploying the new Worker.
   Existing internal room credentials authorize `POST /api/internal/rooms/:id/admission`;
   the new Worker requires a valid response for every WebSocket upgrade, including
   legacy tokens. Missing endpoint or database outage returns a temporary 503.
   Verify environment-specific origins, auth, no redirects and latency first.
3. Deploy compatible Worker terminal persistence/recovery. Validate ordinary
   room creation/join/end with old policy still inactive.
4. Provision a separate per-environment `ANIDACHI_HOSTING_CUTOVER_DRAIN_SECRET`
   on Web and its matching Vault secret `anidachi_hosting_cutover_drain_secret`.
   The Worker uses only the existing room secret. Notification credentials are
   never room authority. Confirm the private schema is not exposed by PostgREST.
5. Verify the disabled `anidachi-hosting-cutover-drain` Cron path, fixed owned URL,
   exact HTTP200 `{"ok":true}` acknowledgement and staging bearer gate behavior.
   The existing staging password/noindex protection remains enabled.
6. Complete staging acceptance and compatible UI/Store release gates before
   production activation. Store publication is distinct from all clients updating.
   Measure and accept an actual closure-latency bound before selecting production T.

## Single activation operation

An operator first checks current hosting revision, personal-history activation,
compatible deployments, Store publication and the matching dedicated secret.
Enable `anidachi_private.hosting_cutover_scheduler` for the intended environment
only after verifying those delivery prerequisites. Enabling it with no committed
targets does not close rooms. The activation function checks configuration and
history state; it does not prove remote HTTP health or Store publication.

Record a new operation UUID and the current expected revision outside the SQL
request before calling `anidachi_private.activate_paid_hosting_v1(operation_id,
expected_revision)` as the operator. Runtime service roles cannot call it.
The transaction locks policy in admission order, sets T from database time,
records all open frozen Free/watcher targets, enables trials and queues the
first drain for post-commit execution. It does not bulk-mark rooms ended.

If commit status is unknown, read `public.hosting_cutover_operation` and retry
the same recorded operation UUID. A committed operation returns the same
revision/T/target count; a different operation is rejected. Never generate a new
UUID merely because an HTTP response was lost.

Before commit, rollback leaves no executable closures. After commit, continue
delivery until every target is durably fenced and finalized. T stays immutable;
actual `fenced_at` and `finalized_at` show delivery latency. Cross-service
socket closure is asynchronous, without a deliberate five-minute transition grace.
Later ordinary paid/trial entitlement loss retains its separate five-minute grace.

## Reconciliation and recovery

Use operator/service-role reads of the operation and outbox:

- Original target count must equal retained target rows. Reconcile the activation
  room inventory; exclude paid/trial rooms and include legacy watcher aliases.
- Count unfenced and unfinalized targets separately, pending/expired leases,
  attempts and latency from T. Do not report a completed cutover with pending rows.
- A completed target requires Worker evidence, an ended/absent durable room and
  no active assignment for that room. Old-room retries must preserve a newly
  created paid room and its assignment. Usage finalization follows the existing
  idempotent Worker/Web path.
- A Web pass handles batches of four within 35s; leases last 60s. Delivery has a
  28s deadline and each database operation a 2s deadline. Unknown outcomes remain
  recoverable through lease expiry; tasks have no expiry or attempt discard.
- Cron runs once per minute and requests HTTP only for due unleased work.
  A queued pg_net request older than 90s records `transport_stalled` and prevents
  queue growth. Restore the pg_net worker before retrying transport; do not delete
  durable outbox rows. Lost transport responses become retryable after 90s.
- Worker has a separate durable 30s retry alarm, independent of roomPolicy and
  Cloudflare's automatic retry limit. Pending source/accounting is retained.
  Its Web-finalized and runtime-cleaned phases cover interruption after a callback
  ACK. Presence delivery continues through the shared alarm.

Keep all measurements and private diagnostics out of public logs; diagnostics
contain counts/fixed categories, never credentials or raw provider bodies.
After activation, recovery must keep compatible hosting/trial/terminal consumers.
Do not clear T, resurrect closed Free rooms, erase consumed trials or drop
pending closure work as rollback. Before activation, retain the dormant additive
schema and use a verified compatible consumer rollback. The new Worker also
writes terminal intent for ordinary room endings with T=NULL; an older Worker
that ignores that intent can lose recovery/fencing even before activation.
Keep exact compatible Web/Worker recovery artifacts and reconcile pending work
before considering any legacy rollback. See the
[production preservation and delivery procedure](production-preparation-2026-10-02.md).

## Unproven legacy terminal records

A legacy Worker tombstone without the new terminal-intent receipt returns
HTTP409 `ROOM_TERMINAL_PROOF_UNAVAILABLE`. It stays closed and the outbox stays
pending; no invented fence timestamp or additional finalization is accepted.
Before accepting Task 5, establish whether this state can occur among selected
production targets and reconcile the exact operation/room/generation, original
usage and active-session relationship. A tested recovery mechanism or evidence
excluding the state is still required. Do not treat this error as a completed
cutover or silently discard its target.

Automatic approval review rejected a proposed local change that would create a
new fence time and repeat finalization for this ambiguous legacy record, citing
risk to usage/session state if the legacy relationship was wrong. That change was
not applied. Existing fail-closed behavior is preserved and regression-tested.

## Still required on staging

Prove the real private Cron → pg_net → Web → Worker → Web/PostgREST flow,
source/accounting outages, transport loss and all-target reconciliation.
Run mixed current/old published Store clients and observe actual P2P/audio/video
cleanup when receiving the existing terminal event or losing the socket.
Local workerd/native-fetch, signaling and current-source Chromium harness results
do not substitute for these checks.
