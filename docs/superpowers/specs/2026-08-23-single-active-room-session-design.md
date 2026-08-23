# Single Active Room Session Design

Status: Accepted on `staging` on 2026-08-23 through PR #231 and merge
`f511b4dcb805e8959412213e00a2499f12f2b8be`. `main`, production, public release,
and Chrome Web Store distribution remain outside this acceptance.

Date: 2026-08-23

## Summary

AniDachi will allow an authenticated user to belong to at most one active watch
room at a time, regardless of provider, browser tab, browser profile, or device.
The rule applies to both hosts and guests and is enforced on the server, not by
extension-local state.

The existing architecture remains intact:

- Supabase owns the durable cross-room assignment;
- the existing per-room Cloudflare Durable Object owns live presence,
  reconnect grace, and room termination;
- the extension keeps its per-tab session record and Web Lock only for fast,
  responsive local behavior;
- the existing room protocol carries one bound participant session identifier
  across Web, Worker, and extension.

No Redis instance, user-global Durable Object, new queue service, polling loop,
or permanent heartbeat is added for this MVP boundary.

## Product Rules

| Situation | Required result |
| --- | --- |
| A user has no active room and creates or joins one | The server atomically assigns that user to the room. |
| The same user tries to create or join a different room on YouTube, Crunchyroll, another tab, or another device | The request is rejected with `ACTIVE_ROOM_CONFLICT` and a simple “You already have an active watch room” state. |
| The same tab reloads or briefly loses the network | It reuses the same `participantSessionId` and reconnects to the same room during a 60-second grace interval. |
| The same room is deliberately opened from its invite/link in another tab or device | The new tab may take over that same room. The old socket receives `SESSION_TAKEN_OVER`. This does not create or join a second room. |
| A stale superseded tab later closes | Its old session identifier is ignored. It cannot leave the new session or end the room. |
| The active host tab is closed | The room ends for everyone. A best-effort close notification makes this immediate; the Durable Object grace deadline is the reliable fallback. |
| The active guest tab is closed | Only that guest leaves. The host and other guests continue. |
| A tab is reloaded or navigates within the same supported flow | `tabs.onRemoved` does not fire, so the room is not treated as deliberately closed; the same tab may reconnect. |
| A closed tab is replaced by a fresh normal provider tab | The old room is not silently restored. The new tab has no tab-scoped room record. |
| A browser crashes or remains offline | After the 60-second reconnect grace, the host ends the room or the guest is released. |
| A room is ended through an existing explicit end path | Every active assignment for that room is cleared atomically with finalization. |

The 60-second interval is a product constant, not a lease renewed by periodic
heartbeats. It covers normal reloads, Back/Forward Cache restoration, short
network changes, and an MV3 service-worker restart without keeping abandoned
rooms alive for hours.

## Scope

### Goals

- Enforce exactly one active room per authenticated user across every provider
  and client.
- Make host and guest tab-close behavior deterministic and idempotent.
- Preserve seamless reload and brief network recovery.
- Prevent stale close events from ending or releasing a newer session.
- Keep invite acceptance, room membership history, Watch History v2, P2P media,
  and provider adapters compatible.
- Give the UI one stable, immediately understandable conflict response.

### Non-goals

- Public release, promotion to `main`, or production deployment.
- A room list, multi-room switching UI, background rooms, or room resumption on
  arbitrary new tabs.
- New providers beyond current YouTube and Crunchyroll behavior.
- Replacing Durable Objects, Supabase, WXT, or the current P2P topology.
- Adding a global presence service, heartbeat platform, distributed cache, or
  generic job system.
- UI/UX redesign beyond the minimal conflict and ended/left states required to
  make this rule usable.
- Changing TURN, ICE, billing, Private Blob, Chrome Web Store, legal, or release
  configuration.

## Current State And Gap

The current extension already has a tab-scoped `participantSessionId`, a
same-browser `room-tab-lock`, same-room takeover handling, and a reconnect path.
The existing Worker prevents two live sockets for the same user inside one
room. Those controls are useful but cannot stop the same account from joining
two different room Durable Objects or from doing so on two devices.

The room token currently identifies user, room, and role, while the client JOIN
event supplies `participantSessionId` separately. Therefore an old or malicious
client can choose a different session identifier after token issuance. The new
design binds that identifier into the server-issued room token and verifies an
exact match at JOIN.

The background `tabs.onRemoved` listener currently clears tab state without
notifying the server. `pagehide` closes the WebSocket for reload/navigation as
well as true departure, so it cannot be used alone to decide that the user left.
The design separates those two signals:

- WebSocket close means “temporarily disconnected; start grace”; and
- authenticated `tabs.onRemoved` departure means “this exact tab was closed;
  finish now if it is still authoritative.”

The earlier deliberate deferral of a global room lease in
`docs/current-development-state.md` is superseded for this approved feature
scope once the implementation is accepted on staging. It must not be described
as completed before that evidence exists.

## Considered Approaches

### Selected: Supabase assignment plus existing room Durable Object

This is the smallest authority that works across providers, tabs, profiles, and
devices. PostgreSQL supplies the uniqueness and transactional race handling;
the room Durable Object already owns socket presence, hibernation, alarms,
source durability, and room ending.

### Rejected: extension-only flag or Web Lock

It is fast but limited to one browser context/origin. It cannot enforce the
product rule across YouTube and Crunchyroll, profiles, devices, cleared local
storage, or modified clients.

### Rejected: one global Durable Object per user

It could serialize room claims, but it would introduce a second distributed
authority alongside Supabase, cross-DO coordination, repair logic, and another
failure surface. PostgreSQL already owns durable account and room state.

### Rejected: renewable database lease and recurring heartbeats

It would create continuous writes and ambiguous “temporarily offline” behavior.
The product needs one durable assignment plus a short live disconnect grace,
not a perpetually renewed lease.

## Authority And State Model

### Durable cross-room assignment

Add a server-only table:

```sql
public.active_room_sessions (
  user_id uuid primary key references public.users(id) on delete cascade,
  room_id text not null references public.rooms(room_id) on delete cascade,
  role text not null check (role in ('host', 'member')),
  participant_session_id text not null,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

The primary key is the global invariant: one row per user. A `room_id` index
supports finalization and repair. The table has RLS enabled, no public policies,
and explicit privilege revocation for `anon` and `authenticated`. Only the
server-side service client and narrowly granted server RPCs may use it.

`room_members` remains historical room membership and access context. It is not
repurposed as live presence or the one-room authority.

### Atomic database operations

The migration introduces versioned, server-only RPCs:

1. `create_room_with_active_session_v1` creates the room and claims the host in
   one transaction. A conflict creates no orphan room. Existing
   `clientRequestId` idempotency remains valid.
2. `claim_active_room_session_v1` claims an existing room for a host/member.
   The same room is idempotent and may update the session identifier for a
   deliberate takeover; another room returns a structured conflict.
3. `release_active_room_session_v1` deletes only when `user_id`, `room_id`, and
   `participant_session_id` all match. A delayed old close is harmless.
4. `finalize_room_usage` clears every assignment for the room in the same
   transaction that marks it ended. Its already-ended path also repairs any
   leftover assignments before returning.

Claim operations lock in a documented order and rely on the `user_id` primary
key as the final concurrency guard. The tests must issue genuinely concurrent
claims to prove that only one wins.

If an assignment points to a room already marked `ended`, the next claim may
delete that stale row and continue in the same transaction. It must never clear
an assignment to a live different room merely because a client calls it stale.

### Live room state

Each existing room Durable Object persists a bounded pending-disconnect record
for a participant:

```txt
userId
role
participantSessionId
disconnectedAt
deadlineAt
delivery state for an idempotent Web callback
```

A fixed internal safety cap bounds the number of records independently from
the simultaneous room seat cap. Disconnected users leave live occupancy
immediately, so short guest turnover may legitimately produce more pending
deadlines than live seats. The record is stored in Durable Object storage, not
only in constructor memory, so WebSocket Hibernation or Worker eviction cannot
lose the deadline.

The existing single Durable Object alarm remains the only alarm. Its scheduler
chooses the earliest due item across:

- room-source persistence retries;
- pending participant disconnects; and
- the existing room lifecycle/empty-room fallback.

Cloudflare alarms are at-least-once, so every departure callback and room end
operation is idempotent. No second alarm or `setTimeout` is used as durable
state.

## Session Binding

The extension prepares a candidate `participantSessionId` before calling room
create/connect. The identifier is included in:

1. the authenticated Web API request;
2. the Supabase active assignment;
3. the signed room token;
4. the WebSocket JOIN event; and
5. the tab-scoped extension session record.

The Worker accepts JOIN only when the token subject, room, role, and
`participantSessionId` match the event. The Worker never trusts the participant
identity sent by page code. Web and Worker share the canonical room-token
contract: issuer `anidachi-auth`, audience `anidachi-worker`.

For a same-tab retry or reload, the stored identifier is reused. A deliberate
same-room takeover prepares a new identifier and atomically replaces the same
room assignment. The Worker closes the old socket with `SESSION_TAKEN_OVER`.

## HTTP And Protocol Contract

Cross-plane schemas are defined first in `packages/protocol`.

### Conflict

Room create/connect returns HTTP `409`:

```json
{
  "code": "ACTIVE_ROOM_CONFLICT",
  "message": "You already have an active watch room.",
  "activeRoom": {
    "roomId": "...",
    "role": "host",
    "provider": "youtube",
    "title": "..."
  }
}
```

Only already-visible room metadata is returned. No raw access token, source
credential, internal identifier, or unvalidated redirect is exposed. The
extension shows one stable state without a loading loop or repeated refresh.
“Open active room” is offered only when the active room belongs to the current
provider (or has no provider yet). A conflict from another provider tells the
user to return to that existing tab; it must not connect the wrong provider tab
and take over the correct live session. Role-appropriate “End room” or “Leave
room” recovery remains available. Visual redesign is outside this plan.

### Departure

The extension calls an authenticated Web endpoint for the exact tab session:

```txt
POST /api/rooms/:roomId/depart
{ participantSessionId }
```

The Web server derives `userId` from the extension access token and forwards a
signed internal command to the room Durable Object. The extension cannot name a
different user. The response is idempotent and distinguishes only actionable
outcomes such as `departed`, `room_ended`, or `stale`.

The Worker calls a signed internal Web callback when a guest grace deadline
expires. Web invokes the exact compare-and-delete RPC. Host expiry uses the
existing Worker-to-Web room-finalization path with the new
`host_disconnected` end reason.

## Lifecycle Behavior

### Host

1. Socket closes: host disappears from live presence and a 60-second pending
   disconnect is persisted.
2. Same session reconnects before the deadline: pending departure is canceled;
   room continues.
3. Exact `tabs.onRemoved` departure arrives: Worker validates the current
   session and ends the room immediately.
4. No close notification arrives: alarm ends the room at the deadline even if
   guests remain connected.
5. Room finalization clears all host and guest assignments.

### Guest

1. Socket closes: guest disappears from live presence and receives the same
   60-second grace.
2. Same session reconnects: pending departure is canceled.
3. Exact tab-close departure arrives: only the guest assignment is released.
4. Deadline expires: Worker sends the idempotent release callback to Web.
5. The room and other participants continue.

### Reload, navigation, duplication, and crash

- Reload and same-tab supported navigation keep the tab ID and session record;
  they reconnect within grace.
- Closing the tab removes its tab-scoped record after the departure attempt. A
  fresh normal tab has nothing to restore.
- Duplicating an explicit same-room URL is a deliberate same-room takeover. The
  new tab receives a newly minted background-owned session identifier, wins,
  and makes the old session stale. A cloned legacy page `sessionStorage`
  identifier is never reused as authority for two tabs.
- Browser crash or extended offline state cannot deliver reliable
  `tabs.onRemoved`; the stored Durable Object deadline is the fallback.
- The existing four-hour empty-room timeout remains only a last-resort cleanup
  for legacy/corrupt state, not the normal host lifecycle.

## Failure And Race Handling

1. **Two different room claims at once:** the database unique key/transaction
   permits one and returns `409` for the other.
2. **Repeated same request:** create idempotency returns the same room; connect
   reuses or safely takes over the same room.
3. **Old close after takeover:** exact session comparison returns `stale` and
   changes nothing.
4. **Close command races WebSocket close:** the Durable Object handles either
   order and performs one idempotent result.
5. **Worker hibernates:** socket attachments and pending deadlines are restored
   from durable storage.
6. **Web callback fails:** the pending record remains and the one alarm retries
   with bounded backoff.
7. **Room ends twice:** finalization and assignment cleanup are idempotent.
8. **Claim succeeds but WebSocket never joins:** the exact tab-close path
   releases it; same-room retry remains allowed. If the client disappears, the
   conflict response offers explicit leave/end recovery. MVP does not add a
   recurring heartbeat solely for this edge.
9. **Old extension artifact:** requests without a bounded
   `participantSessionId` fail explicitly as an incompatible client. There is
   no permanent bypass that silently defeats the invariant.

## Invite And Membership Semantics

Accepting a social invite or becoming a `room_member` does not itself consume
the user's one active room. The assignment is claimed when the extension
actually requests a live connection. Therefore a user may receive or accept
invitations while watching elsewhere, but opening the second live room returns
the global conflict.

This preserves existing durable invite/membership behavior and avoids a stuck
reservation when a user accepts an invite but never opens its provider page.
The connect RPC remains the race-safe authority; an optional UI preflight may
improve messaging but is never treated as enforcement.

## Security And Privacy

- Every public room mutation requires the existing website or extension auth.
- Every Web/Worker callback uses the existing internal service secret boundary.
- RLS and explicit grants keep active-session rows server-only.
- Session IDs are bounded opaque UUID-like identifiers, not bearer credentials.
- Logs include privacy-safe room/user references and outcome codes, never room
  tokens, extension access tokens, source credentials, or raw private URLs.
- Conflict and departure endpoints are rate-limited by existing authenticated
  request limits where applicable; no anonymous room-state oracle is added.

## Rollout And Rollback

Implementation follows the normal `feature -> PR -> staging` flow. It does not
include `main` or production.

1. Apply the additive database migration first.
2. Deploy protocol/Web/Worker consumers that require the bound session ID.
3. Build and validate the matching staging extension artifact.
4. Update only the two established staging test folders and perform the
   two-profile acceptance matrix.
5. If runtime rollback is required, roll back Web/Worker/extension together.
   The unused additive table/functions may remain safely until a reviewed
   cleanup; do not destructively down-migrate live assignments.

There is no long-lived compatibility mode. Because AniDachi is not yet public,
an old internal extension may receive an explicit upgrade error during the
controlled staging cutover instead of bypassing the new invariant.

## Acceptance Matrix

The feature is accepted only when all of these are proven:

1. Host creates on YouTube; the same account cannot create/join a different
   Crunchyroll room.
2. Guest joins one room; a second invite cannot create a second live room.
3. Two concurrent cross-provider claims produce exactly one assignment and no
   orphan room.
4. Reload and a brief offline interval reconnect the same tab/session.
5. Closing the active host tab ends the room for all participants.
6. Closing one guest tab removes only that guest.
7. Opening the same room deliberately elsewhere takes over, and closing the old
   tab does not affect the winner.
8. A fresh normal provider tab does not silently restore a closed room.
9. Durable Object hibernation does not lose pending departure deadlines.
10. Existing playback sync, pause/seek, Watch History v2, room source,
    invitations, P2P signaling, and room quota checks remain green.

## Staging Acceptance Evidence

The additive migration `20260823090624_single_active_room_sessions.sql` was
applied before the runtime merge. Staging migration runs `32637163596` and
`32637269784`, CI `32637269772`, API deployment `32637269793`, extension build
`32637269796`, Vercel deployment `dpl_D9iXtfYyux52dRp46wucA8VKcM86`, and the
fresh Worker smoke all passed. The database inspection confirmed the
server-only table, RLS boundary, service-role-only RPC execution, and empty
initial assignment state.

The exact validated extension artifact had `version_name`
`f511b4dcb805e8959412213e00a2499f12f2b8be-staging-125` and SHA-256
`58a5b07f08bbef7031205244959f536087791a2245887bcd8f63d2dd7442fb8b`. Both
established test folders were byte-identical to that artifact before the two
profiles were reloaded.

Manual two-profile observation confirmed the host and guest cross-room blocks,
pause/seek/rate sync, host and guest reload, brief offline recovery, guest-only
departure, host room end, same-room takeover, stale old-tab safety, no silent
fresh-tab restore, old-link non-revival, and no false active room in the popup.
Crunchyroll Watch History continued to track. YouTube Watch History was disabled
during the final history observation, so no YouTube-history result is inferred.

Residual boundaries are explicit: this is staging evidence, not `main` or
production; Chrome-crash cleanup relies on the 60-second fallback; TURN-relay
and two-network media proof remain separate; conflict-copy and visual polish
remain UI/UX work.

## Current Primary References

- PostgreSQL atomic `INSERT ... ON CONFLICT` behavior:
  `https://www.postgresql.org/docs/current/sql-insert.html`
- Supabase RLS and server-only data access:
  `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Cloudflare Durable Object WebSocket Hibernation:
  `https://developers.cloudflare.com/durable-objects/best-practices/websockets/`
- Cloudflare Durable Object alarms, including one alarm and at-least-once
  delivery semantics:
  `https://developers.cloudflare.com/durable-objects/api/alarms/`
- Chrome `tabs.onRemoved` lifecycle event:
  `https://developer.chrome.com/docs/extensions/reference/api/tabs`
- Chrome Manifest V3 extension service-worker lifecycle:
  `https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers`
