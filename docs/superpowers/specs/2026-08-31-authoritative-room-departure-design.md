# Authoritative Room Departure Design

Status: Approved for implementation on `staging` scope. The product owner
delegated the final product decision on 2026-08-31 after the live failure was
root-caused. `main`, production, and public extension distribution remain out of
scope.

Date: 2026-08-31

## Summary

AniDachi will treat the durable active-room assignment in Supabase as the commit
point for a guest's explicit departure. Once the exact assignment is released,
the guest has left from the product's perspective and may immediately create or
join another room. Cleaning the matching live Durable Object socket is a
separate, bounded operation that cannot roll the durable departure back or turn
an already completed leave into a user-visible failure.

This replaces the current circular explicit-departure dependency:

```txt
extension -> Web -> Worker -> Web callback -> Supabase
```

with an authority-aligned flow:

```txt
extension -> Web -> exact Supabase release (commit)
                       |
                       +-> bounded Worker detach cleanup
extension <- success  +-> local socket/media teardown
```

Passive disconnect recovery remains Worker-owned. It continues to use durable
pending-disconnect records and alarms, followed by an idempotent signed callback
to Web after the reconnect grace interval.

## Confirmed Failure

The 2026-08-31 staging failure was not a UI or browser-click failure. Live logs
for the same room and participant showed this sequence:

1. `POST /api/rooms/:roomId/depart` returned HTTP `502`.
2. The Worker accepted the exact departure and called
   `POST /api/internal/rooms/:roomId/participants/:userId/departed`.
3. The staging password gate rejected that internal callback with HTTP `401`.
4. The Worker returned `PARTICIPANT_DEPARTURE_CALLBACK_FAILED`.
5. Web propagated the Worker failure instead of releasing the durable active
   assignment.
6. The extension displayed `Could not leave the room. Please try again.` and the
   user remained blocked by `ACTIVE_ROOM_CONFLICT`.

The immediate configuration defect is a missing callback path in the staging
bearer allowlist. Adding one path would repair this instance but preserve the
architectural defect: an explicit guest leave would still require a successful
round trip from Web to Worker and back to Web before durable state could change.

## Product Rules

| Situation | Required result |
| --- | --- |
| Guest clicks `Leave room` with the current exact session | The durable assignment is released, this tab tears down locally, and another room is immediately available. |
| The same leave request is repeated | It succeeds idempotently without recreating state or showing an error. |
| The response is lost after the database commit | A retry observes the already-released assignment and succeeds, allowing local teardown. |
| Worker detach is unavailable after the database commit | Leave still succeeds; the client closes its socket and existing disconnect cleanup removes any remaining live state. |
| Supabase release fails | Leave fails as retryable; local room state remains so the client cannot pretend that a durable departure occurred. |
| A superseded tab sends its old exact session | Its local UI may close, but it cannot release or detach the newer authoritative session. |
| A confirmed emergency action is used after local state was lost | Web derives the current assignment server-side and releases only that explicitly confirmed room. |
| Guest closes the tab without clicking leave | Worker starts the existing reconnect grace and releases the exact assignment through the signed callback when grace expires. |
| Host leaves or closes the authoritative host tab | The separate host room-end lifecycle runs; guest departure never ends the room. |
| No active assignment exists | Departure returns the legacy-compatible idempotent success `stale`. |
| A tab closes while its Web admission is still in flight | A late committed admission is compensated exactly; if that result is unconfirmed, the background persists only the exact identity and retries it without touching a replacement session. |

## Scope

### Goals

- Make ordinary guest departure reliable even when Worker-to-Web callback
  delivery is temporarily unavailable.
- Preserve the one-active-room invariant and exact-session stale-tab safety.
- Make repeated leave requests safe and predictable.
- Retain the Worker's 60-second passive reconnect grace while keeping ordinary
  tab close local-only; remove the hidden tab-close HTTP accelerator.
- Give an exceptional late admission after tab removal a persistent,
  background-owned exact retry lifecycle.
- Replace per-route staging-gate exceptions for internal callbacks with one
  explicit service-to-service boundary.
- Return typed outcomes so the extension can distinguish durable failures from
  successful or stale local teardown.
- Add automated coverage for the exact deployed failure and all cross-plane
  race boundaries.

### Non-goals

- Redesigning room creation, invites, playback sync, P2P media, quota metering,
  or provider adapters.
- Changing the 60-second reconnect grace.
- Replacing Supabase, Durable Objects, or the existing internal service secret.
- Adding a server-side queue, outbox table, new database table, new secret, or
  new service. The extension-local exact retry record required for a late
  admission race is in scope and contains no token, role, or secret.
- Changing the host's metered room-finalization contract in this slice.
- Promotion to `main`, production deployment, or Chrome Web Store publication.

## Considered Approaches

### Selected: durable release first, live detach second

Web atomically releases the exact active assignment before asking the Worker to
detach live state. The Worker cleanup is exact-session fenced, bounded, and
non-authoritative for the result shown to the user.

This follows the existing three-plane ownership model: Supabase owns durable
account eligibility, the Durable Object owns live presence, and the extension
owns local media/runtime teardown. It removes the circular dependency without a
new subsystem.

### Rejected: add the missing staging allowlist regex only

This makes the reported request work but leaves every explicit departure
dependent on a reverse callback and on future developers remembering to add
each internal path to an unrelated password-gate list. The same product failure
would recur on the next path or transient callback outage.

### Rejected: require Worker and Supabase acknowledgements before success

There is no atomic transaction spanning a Cloudflare Durable Object and
Postgres. Requiring both acknowledgements makes partial failure unavoidable and
recreates the current user-facing deadlock. Compensating rollback would be more
complex and could restore an assignment after the user had already disconnected.

### Deferred: transactional cleanup outbox

A Supabase outbox could guarantee Worker detach delivery independently from the
request, but it adds a table, worker, retry policy, and operational surface. The
existing client socket close plus Durable Object pending-disconnect alarm already
provide eventual cleanup. An outbox is justified only if telemetry later shows
persistent live ghosts after durable release.

## Authority And Invariants

### Durable authority

`public.active_room_sessions` remains the sole durable answer to whether an
authenticated user may create or join another room. Guest departure is complete
only when the exact row is absent.

The existing `release_active_room_session_v1(userId, roomId,
participantSessionId)` RPC remains the atomic compare-and-delete primitive. No
database migration is required.

### Live authority

The per-room Durable Object continues to own connected sockets, presence,
disconnect grace, and pending-disconnect alarms. A Web-issued explicit detach
command means the durable guest release already committed; the Worker must not
call Web again to confirm that same explicit operation.

### Client authority

The extension owns only its exact tab record and local resources. It supplies
`roomId` and `participantSessionId` as stale-write preconditions, never as user
identity. Web derives `userId` and role from authenticated server state.

### Invariants

1. A stale session cannot release a newer assignment.
2. A stale Worker cleanup cannot detach a newer socket.
3. A Worker cleanup failure cannot recreate a released assignment.
4. A database failure cannot be hidden behind local teardown.
5. Guest departure cannot end the host's room.
6. Repeated requests converge on the same durable and local result.

## Public Departure Contract

The existing authenticated endpoint remains the normal exact-session contract:

```txt
POST /api/rooms/:roomId/depart
{ participantSessionId }
```

The route authenticates the website or extension session and loads the current
server-owned active assignment. It does not trust a client-supplied role or user
identifier.

Successful responses remain HTTP `200` and use a strict protocol outcome:

```ts
type RoomDepartureOutcome =
  | "departed"
  | "room_ended"
  | "already_departed"
  | "stale";
```

The widened shared schema and current extension continue accepting
`already_departed` as a forward-compatible acknowledgement. Until explicit
version negotiation exists, the deployed public Web routes emit only
`departed`, `room_ended`, or `stale`; absence after an idempotent retry is
represented as `stale` for compatibility with older strict clients.

- `departed`: the exact durable assignment was released.
- `room_ended`: the exact authoritative host departure completed the existing
  room-end lifecycle.
- `already_departed`: accepted for forward compatibility, but not emitted by
  the current public Web routes.
- `stale`: the requested room/session is no longer authoritative; no current
  assignment was changed.

All accepted outcomes authorize teardown of the calling tab's local stale/current
room state. They never authorize clearing another tab's background record unless
that record has the same exact room and participant session.

Typed failures are limited to actionable durable conditions:

- `401 AUTH_REQUIRED`: extension auth must refresh or sign in.
- `409 ACTIVE_ROOM_CHANGED`: emergency recovery observed a different room or a
  concurrent takeover and changed nothing.
- `503 ROOM_DEPARTURE_UNAVAILABLE` with `retryable: true`: the durable
  assignment could not be read or released.

The route never returns a failure solely because Worker detach cleanup failed.

## Normal Guest Departure Flow

1. Extension sends the exact room and participant session.
2. Web authenticates the user.
3. Web reads that user's active assignment.
4. If no assignment exists, Web returns legacy-compatible `stale`.
5. If room or participant session no longer matches, Web returns `stale`
   without changing current state. If the exact assignment is the host, Web
   delegates to the existing room-end lifecycle and returns `room_ended`; the
   guest-only steps below do not run.
6. For a matching guest, Web calls the exact release RPC.
7. If the RPC reports `released`, durable departure is committed.
8. If the RPC reports `stale`, Web re-reads once:
   - no assignment -> `stale`;
   - changed assignment -> `stale`;
   - identical assignment -> retryable `503`, because the invariant did not
     converge.
9. After durable commit, Web requests exact Worker detach with a short abortable
   timeout. Success, stale, timeout, and transport failure are recorded but do
   not change the public `200` result.
10. On any successful outcome, the extension suppresses reconnect, closes the
    room socket, stops camera/microphone/P2P publication, releases the tab lock,
    and clears only the matching local room record.

If the public response is lost after step 7, retry restarts at step 3 and returns
`stale`. Both deployed strict clients and the current extension then complete
the same local teardown.

## Passive Close And Late Admission Compensation

Ordinary passive tab close remains local-only. Socket disappearance still
starts the Durable Object's persisted 60-second reconnect grace and signed Web
callback; that Worker lifecycle is retained. The removed hidden HTTP
accelerator is not part of normal tab-close behavior.

There is one narrower race: the tab can disappear while its authenticated Web
admission is still in flight. If that request later commits, the background
immediately sends one exact compensation for the captured `roomId`,
`ownerUserId`, and `participantSessionId`. A confirmed `departed`,
`room_ended`, `stale`, or forward-compatible `already_departed` completes the
compensation without creating a retry record. Any unconfirmed result persists
one coalesced extension-local job containing only that exact identity plus
bounded retry timing metadata.

The Manifest V3 background schedules the earliest job with the existing
`alarms` permission, restores it from local storage after service-worker or
browser restart, and also drains on matching auth restoration and online
events. Missing auth or a different signed-in account retains the job. Backoff
is capped at one hour. A job is removed only after exact idempotent success,
`stale`, `room_ended`, `already_departed`, or `ACTIVE_ROOM_CHANGED`; every one
of those outcomes proves the old identity cannot block. The retry never invokes
active-room recovery and never carries tokens, roles, secrets, or tab-local
replacement state.

## Worker Detach Cleanup

The internal service-authenticated command is renamed around its real purpose:
it cleans live state after durable guest release. Its protocol carries exact
`roomId`, `userId`, `participantSessionId`, and `requestedAt`.

For a matching guest socket or pending disconnect, the Durable Object:

1. removes the participant from live occupancy;
2. broadcasts the existing participant-left state once;
3. closes the matching socket;
4. clears the matching pending-disconnect record;
5. reconciles the single stored alarm; and
6. returns `detached`.

It does not call the Web participant-departed callback for this explicit path.
An absent or superseded session returns `stale` without affecting the current
socket. A host command is rejected because host finalization uses the separate
room-end path.

## Passive Disconnect And Alarm Flow

Passive WebSocket close/error behavior does not change:

1. Worker removes the socket from current presence and persists an exact pending
   disconnect with the 60-second deadline.
2. A same-session reconnect cancels the pending record.
3. A host deadline invokes the existing room-end lifecycle.
4. A guest deadline calls the signed internal Web callback.
5. Web performs the same exact release RPC.
6. `released` and `stale` both acknowledge and clear the pending Worker record.
7. Callback failure retains the record and reschedules bounded retry through
   the existing Durable Object alarm mechanism.

Because Cloudflare alarms are at-least-once, both callback processing and
pending-record acknowledgement remain idempotent.

## Emergency Active-Room Recovery

The confirmed `Leave active room` action remains a reserve for a lost or corrupt
local tab record. It is not used during normal leave.

`POST /api/rooms/active-session/depart` loads the authenticated user's current
server-owned assignment and requires the caller's expected `roomId`. It then
calls the same domain departure service in confirmed-recovery mode:

- a guest releases the exact assignment found by Web and receives the normal
  cleanup behavior;
- a host uses the existing end-room lifecycle;
- no assignment is an idempotent success;
- a different room or concurrent assignment change returns
  `ACTIVE_ROOM_CHANGED` and changes nothing.

There is no exact-route-then-recovery cascade inside ordinary extension leave.
Both public routes share one tested domain service instead of invoking one route
as a fallback for the other.

## Staging Service Boundary

The staging password gate will recognize authenticated internal API traffic by
one centralized rule:

```txt
POST /api/internal/** with an Authorization: Bearer header
```

This bypasses only the human staging password page. Every internal route still
verifies the exact `ANIDACHI_INTERNAL_API_SECRET` using the existing constant-
time service-auth helper and returns `401` for an invalid token.

Tests must prove both sides:

- all signed internal room callbacks reach their route without a staging cookie;
- an arbitrary Bearer value may pass the password gate but is rejected by the
  internal route's real service authentication.

This removes the fragile list of individual internal callback regexes without
making an internal operation publicly authorized.

## Error Handling And Observability

The public response reflects durable truth only. Worker cleanup is logged as a
separate safe outcome:

```txt
room_departure_durable: departed | already_departed | stale | failed
room_departure_cleanup: detached | stale | timeout | failed
mode: exact | confirmed_recovery | passive_disconnect
```

Logs may contain bounded room/user hashes and outcome codes but never access
tokens, internal secrets, raw participant identifiers, source URLs, names, or
user content.

The extension preserves typed server failures. It must not collapse auth,
concurrent-session, and durable-service failures into one generic message.
Ordinary users should see only:

- successful closure;
- `Your active room changed. This tab was closed without affecting it.` for a
  stale exact tab if visible feedback is needed;
- `Could not leave right now. Please try again.` only for a real durable read or
  release failure.

## Security

- Public departure requires existing website cookie or extension bearer auth.
- Web derives user identity and role server-side.
- Exact session IDs are bounded opaque identifiers and stale-write guards, not
  bearer credentials.
- Internal Worker commands and callbacks retain the existing shared-secret
  authorization boundary.
- Active-session data remains service-role-only with RLS and explicit grants.
- No new CORS path, anonymous room-state oracle, secret, permission, or browser
  host permission is added.

## Testing And Acceptance

### Protocol

- strict departure success and typed-error schemas;
- strict internal detach command and acknowledgement;
- malformed or oversized identifiers rejected.

### Web

- exact guest release happens before Worker cleanup;
- Worker success, stale, timeout, and failure all preserve public success after
  durable release;
- database read/release failure returns retryable `503` and skips local-success
  semantics;
- no assignment is idempotent success;
- stale exact session leaves a newer assignment untouched;
- RPC stale outcome is resolved by one authoritative re-read;
- emergency recovery shares the domain service and detects concurrent change;
- host role is routed only through room end;
- centralized internal staging bypass plus invalid-service-token rejection.

### Worker

- explicit guest detach closes only the exact session and performs no Web
  callback;
- missing/superseded detach is stale and cannot close the winner;
- explicit detach clears an existing pending-disconnect record;
- the later socket-close event does not recreate that record;
- passive close still persists grace, reconnect cancels it, and alarm callback
  retries idempotently;
- forced hibernation wake preserves pending cleanup behavior.

### Extension

- `departed`, `room_ended`, `already_departed`, and `stale` all tear down only
  the calling tab's matching local state;
- retry after lost response succeeds and tears down;
- durable `503` keeps recoverable local state and does not start a reconnect
  loop caused by the leave click;
- auth failure uses the existing one-refresh retry;
- normal leave never automatically invokes the emergency recovery route;
- media, camera, microphone, tab lock, hash, and reconnect state are cleared once.
- passive close during in-flight admission persists and automatically drains
  one exact retry after failed compensation, including across worker restart;
  duplicate failures coalesce and a replacement participant session is fenced.

### Harness And staging

1. Guest leaves normally and immediately creates a new room.
2. Guest double-clicks leave; both requests converge without an error.
3. Worker detach is forced to fail after database release; guest still leaves,
   local media stops, and a new room succeeds.
4. A stale old tab leaves after same-room takeover; the winner remains connected.
5. Lost local record uses the confirmed emergency action successfully.
6. Guest tab close without explicit leave releases after grace and does not end
   the host room.
7. Host tab close/end keeps the existing room-end lifecycle.
8. Internal room callbacks work through the staging gate with the service token
   and fail with an invalid token.
9. YouTube and Crunchyroll both pass the two-profile room lifecycle check.

Required automated gates are protocol, Web, API, API runtime, extension,
`pnpm harness:rooms`, real-WebRTC harness, staging extension build/validation,
and `pnpm dev:check -- --profile rooms`. Loaded two-profile staging acceptance
is required before any production promotion claim.

## Rollout And Rollback

This change follows `feature -> PR -> staging`. There is no database migration,
new environment variable, or secret rollout.

Protocol, Web, Worker, and extension changes ship as one compatible staging
candidate. During deployment, the new Web behavior may call an older Worker;
cleanup failure is already non-authoritative, so durable guest leave remains
safe. The new Worker accepts the new internal cleanup command only after Web is
deployed. The extension continues using the existing public departure route.

Rollback redeploys the previous Web/Worker/extension artifact together. No data
rollback or destructive migration is needed. Active assignments created before,
during, or after rollback retain the same table and exact-session semantics.

## Primary References

- HTTP idempotent request semantics: `https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2`
- Cloudflare Durable Object WebSocket Hibernation:
  `https://developers.cloudflare.com/durable-objects/best-practices/websockets/`
- Cloudflare Durable Object alarms and at-least-once execution:
  `https://developers.cloudflare.com/durable-objects/api/alarms/`
- Supabase database functions and RPC:
  `https://supabase.com/docs/guides/database/functions`
- Existing active-room authority design:
  `docs/superpowers/specs/2026-08-23-single-active-room-session-design.md`
