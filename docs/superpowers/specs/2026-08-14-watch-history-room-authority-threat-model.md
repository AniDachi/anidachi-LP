# Watch History Room Authority Threat Model

**Scope:** Watch History v2 shared-session authority only. This review does not
authorize a database migration, Worker implementation, web route, or extension
runtime change.

**Reviewed baseline:** `codex/watch-history-v2-runtime` at the Task 0 baseline,
2026-08-14. The repository has no `SECURITY.md`; the root contributor security
rules and the Codex security threat-model guidance were applied.

**Gate outcome:** `SELF_CONTAINED_ATTESTATION_APPROVED`

The minimal purpose-bound Worker attestation is acceptable for the pre-release
MVP, subject to every invariant and test gate below. It proves a bounded live-room
fact at issuance; it is not a playback receipt, presence history, or durable room
lifecycle ledger.

## 1. Overview

### Protected assets

- integrity and ownership of each account's Watch History v2 rows;
- integrity of shared session boundaries and pair-keyed Recent People evidence;
- isolation between ordinary room connection tokens and history attestations;
- confidentiality of the shared JWT secret and opaque attestation values;
- availability of delayed offline delivery after a legitimate shared session.

### Actors

| Actor | Trust level | Relevant capability |
| --- | --- | --- |
| Authenticated extension client | Untrusted input, trusted only for its authenticated account | Observes playback, stores an opaque authority, and submits progress for itself. It can alter all client-visible fields. |
| Next.js web service | Trusted verifier and account boundary | Authenticates the caller, verifies the attestation and durable lifecycle bounds, then calls the transactional history writer. |
| Cloudflare Worker and room Durable Object | Trusted live-room authority and attestation issuer | Verifies room connection tokens, admits JOIN, owns the current participant session and generations, and sends authority privately to one socket. |
| Supabase/Postgres | Trusted durable account and lifecycle store | Stores room existence, host/member lower bounds, terminal room time, account generation, receipts, fences, and canonical history. |
| Another room participant | Untrusted peer | Must never write another user's history or receive that user's private authority. |
| Network or token thief | Adversarial | May replay an observed request or stolen opaque authority, but does not know a server secret. |
| Compromised Worker, web service, or JWT secret | Fully privileged adversary for this boundary | Can forge attestations; the shared secret also has broader existing token-signing impact. |

### Trust boundaries

```text
provider page / extension (untrusted)
  -> authenticated HTTPS history request
Next.js web service (account + attestation verifier)
  -> service-role transactional RPC
Supabase/Postgres (durable authority)

Next.js room route (connection credential issuer)
  -> room token
Cloudflare Worker / Durable Object (live-room authority)
  -> private ROOM_HISTORY_AUTHORITY event
extension (opaque carrier only)
```

The ordinary room token crosses into the Worker and has `typ: room` plus audience
`anidachi-worker`. It is a short-lived WebSocket connection credential, not a
history credential. The web creates it before the Durable Object knows the JOIN
session or current generations, so adding those facts to the initial room token
cannot prove the required state.

## 2. Persisted Lifecycle Audit

### Source evidence

| Fact | Current source evidence | Audit result |
| --- | --- | --- |
| Durable room and host lower bound | [`20260525_anidachi_auth.sql`](../../../apps/web/supabase/migrations/20260525_anidachi_auth.sql#L28-L38) creates `rooms` with a unique `room_id`, `host_user_id`, status, and server-defaulted `created_at`. [`createRoom`](../../../apps/web/lib/anidachi-auth/db.ts#L401-L448) inserts the row before returning a host room token. | Confirmed. For the host, `rooms.created_at` is the durable issuance lower bound. |
| Durable member lower bound | [`room_members`](../../../apps/web/supabase/migrations/20260525_anidachi_auth.sql#L40-L46) has primary key `(room_id, user_id)` and server-defaulted `joined_at`. The authenticated join route calls [`addRoomMember`](../../../apps/web/app/api/rooms/%5BroomId%5D/join/route.ts#L35-L71) before signing the member room token. | Confirmed. Upsert does not replace the stored `joined_at`, so reconnect does not move the lower bound. |
| Durable terminal upper bound | [`20260612_room_lifecycle_quota.sql`](../../../apps/web/supabase/migrations/20260612_room_lifecycle_quota.sql#L10-L26) adds `ended_at`. [`finalize_room_usage`](../../../apps/web/supabase/migrations/20260712150606_finalize_room_usage.sql#L35-L103) row-locks the room and atomically writes status `ended` and `ended_at`. | Confirmed for a successfully finalized room. |
| Callback-before-terminal ordering | The Worker [`endRoomExclusive`](../../../apps/api/src/index.ts#L642-L709) requires a successful authenticated web callback before persisting the terminal tombstone. Empty-room finalization retries from durable lifecycle state in [`runAlarmExclusive`](../../../apps/api/src/index.ts#L755-L816), and the callback validates an acknowledged DB finalization in [`notifyWebRoomEnded`](../../../apps/api/src/internal-web-client.ts#L17-L57). | Confirmed. A terminal Worker room has already received the web finalization acknowledgement. A failed callback leaves the room retryable/ending rather than falsely terminal. |
| No durable live leave interval | WebSocket close removes the participant only from live Durable Object state in [`handleClose`](../../../apps/api/src/index.ts#L1399-L1426). No Supabase member delete or leave timestamp is written. | Confirmed absent. Durable membership means "joined at least once", not continuous presence. |
| No persisted participant session or generation history | [`RoomStateSnapshot`](../../../apps/api/src/room-state.ts#L19-L29) holds current room/source generations in Durable Object storage. [`RoomSocketAttachment`](../../../apps/api/src/room-socket-attachment.ts#L20-L41) holds verified identity and optional participant session per socket. Neither shape is written to Supabase. | Confirmed absent from the database. |
| Hibernation continuity | The constructor restores the current room snapshot and socket attachments in [`RoomDurableObject`](../../../apps/api/src/index.ts#L361-L468). Accepted JOIN persists the participant session back into the attachment in [`handleJoin`](../../../apps/api/src/index.ts#L988-L1045). | Confirmed for current live state. This is not durable historical evidence after terminal cleanup. |
| Source generation boundary | [`RoomState.updateHostState`](../../../apps/api/src/room-state.ts#L200-L248) increments `sourceGeneration` when the source fingerprint changes; the Worker persists the snapshot and broadcasts `SOURCE_CHANGED` with both generations in [`handleHostState`](../../../apps/api/src/index.ts#L1065-L1105). | Confirmed as current Durable Object authority, not database history. |
| No room/member retention job | Repository-wide searches found no `DELETE`, `TRUNCATE`, or `DROP` for `rooms`/`room_members`, no Supabase `.delete()` against either table, and no `pg_cron`/scheduled cleanup path. | Confirmed for the reviewed branch. This is a required supported contract, not permission to add cleanup later without review. |
| Account/room deletion cascades | `room_members.room_id` and `room_members.user_id` use `ON DELETE CASCADE` in the initial schema. `rooms.host_user_id` does not cascade, and no current account-deletion runtime was found. | A deleted member account removes its membership and can no longer authenticate; explicit room/account deletion must intentionally invalidate delayed authority. The MVP does not promise delayed delivery after account or room deletion. |

### Audit commands

The audit covered all migrations, web database helpers/routes, Worker room state,
socket attachments, terminal callbacks, and repository scheduling surfaces. In
addition to the plan's two seed searches, the following negative searches were
run across runtime and migrations and returned no matches:

```bash
rg -n -U -i "delete\s+from\s+(public\.)?(rooms|room_members)|truncate...|drop..." \
  apps/web apps/api scripts .github
rg -n -U "\.from\((\"|')(rooms|room_members)(\"|')\).*?\.delete\(" \
  apps/web apps/api scripts
rg -n -i "pg_cron|cron\.schedule|scheduled\(|schedule\(" \
  apps/web/supabase/migrations apps/api apps/web/lib apps/web/app/api scripts .github
```

The negative result is branch-scoped evidence. A future room/member deletion,
retention, anonymization, or archival path must update this threat model or add a
compact lifecycle authority record before it ships.

## 3. Approved Attestation Contract

The Worker may issue one opaque self-contained attestation only after all of the
following are true:

1. the WebSocket room token passed HS256, audience, type, subject, room, role, and
   bounded-claim verification;
2. the client sent a valid, non-empty `participantSessionId` in JOIN;
3. admission succeeded and the subject is the joined participant on that socket;
4. the verified identity, participant, and session were written to the socket
   attachment and the room snapshot was persisted;
5. the room is neither ending nor ended;
6. the Worker reads `roomGeneration` and `sourceGeneration` from the same current
   Durable Object state used for the private response.

The signed payload is purpose-bound and contains only:

```text
alg = HS256
typ = room_history
iss = anidachi-worker
aud = anidachi-web-history
sub = authenticated participant user ID
roomId
participantSessionId
roomGeneration
sourceGeneration
iat
```

There is no participant list, progress value, provider payload, source URL,
email, display name, access token, or room token inside it. The visible protocol
event repeats `roomId`, `participantSessionId`, `roomGeneration`, and
`sourceGeneration` so both the extension and web verifier can require exact
matching while treating the signed value as opaque and bounded.

Authority is sent only to its subject's accepted socket:

- once after each successful JOIN/reconnect;
- once after each authoritative source-generation change to every currently
  joined socket;
- never on a timer, before JOIN, without a session ID, or after end begins.

An old authority remains valid for delayed work from its exact generation. It is
not silently upgraded to the new source generation. Leaving the socket does not
revoke previously issued authority because no durable leave interval exists; that
is an explicit availability/security tradeoff for offline terminal delivery.

## 4. Verification Order

The web history boundary must fail closed in this order:

1. authenticate the web/extension account session and derive the user ID from it;
2. strictly parse the progress envelope, reject unknown fields, and reject an
   absent or oversized opaque authority before JWT work;
3. verify only HS256 with the server-side secret, then require the exact purpose,
   issuer, audience, subject, room/session, generations, and issued-at claims;
4. require exact equality between every signed claim and the visible shared-room
   authority fields; the authenticated user must equal `sub`;
5. load the durable room. For the host require matching `host_user_id`; for a
   member require the `(room_id, user_id)` row;
6. require attestation issuance no earlier than the applicable durable lower
   bound (`rooms.created_at` for host or `room_members.joined_at` for member),
   normalized to JWT whole-second precision; when `ended_at` exists, require
   issuance no later than the terminal upper bound at the same precision;
7. inside the account-locked history transaction, require the current account
   generation, deletion fences, idempotency receipt, and deterministic event
   ordering before mutating history;
8. update shared-session participant evidence only for this authenticated writer;
   create directional Recent People evidence only when a second distinct user has
   an independently accepted write for the same `(roomId, roomGeneration,
   sourceGeneration)` session.

Ordinary room tokens must never enter this verifier. Their different purpose and
audience fail before any history mutation. Conversely, a history attestation must
never verify as a Worker connection token.

## 5. Threats, Mitigations, and Residual Risk

| Threat / attacker story | Impact before controls | Required mitigation | Residual risk accepted for MVP |
| --- | --- | --- | --- |
| A client submits an ordinary room token as history proof. | Token confusion could bypass the generation/session requirement. | Separate verifier; exact `typ`, issuer, audience, algorithm, and required claims; cross-purpose negative tests. | None expected without secret compromise. |
| A participant edits visible room/session/generation fields. | Progress could be assigned to a different shared boundary. | Verify signature, then exact-match all four visible fields to signed claims and authenticated `sub`. | None expected without secret compromise. |
| A participant replays a valid old authority after source change, leave, or room end. | It could claim additional progress for the old shared session. | Exact generation boundary, account generation, deletion fences, idempotency receipts, and self-only writes. New source claims require new authority. | A legitimate holder can continue submitting new self-owned events for the previously attested session because there is no expiry or leave ledger. This cannot directly mutate another account. |
| A single account tries to fabricate Recent People. | Another person could appear without independent participation. | The transactional writer records only the authenticated writer and requires a second distinct authenticated accepted writer for the exact shared session before pair evidence. | Two colluding real accounts can manufacture their own relationship evidence; preventing that is outside MVP and does not justify presence history. |
| A stolen opaque authority is used with another account. | Cross-account history or social corruption. | Signed `sub` must equal the authenticated account; no writable `userId`; receipts, rows, and lock boundary are account-owned. | Theft from the same authenticated account has the same power as that account until the account/session is secured or history generation changes. |
| A delayed event arrives after database cleanup. | Verification either rejects legitimate offline work or loses its lifecycle bound. | Keep room/member rows while this contract is supported. Any cleanup requires a reviewed compact authority ledger or an explicit delayed-delivery contract change. | Room or account deletion intentionally invalidates delayed work. |
| Worker hibernation loses identity or generations. | Wrong claims could be issued after restoration. | Parse persisted room snapshot and per-socket attachment; issue only after a valid restored attachment or a fresh JOIN; test hibernation/source-change behavior before Worker rollout. | Corrupt persisted state fails closed and requires reconnect; availability may be reduced. |
| Worker and web clocks differ near join/end. | A valid issuance may be conservatively rejected or a boundary may gain sub-second slack. | Compare signed `iat` and durable bounds at JWT whole-second precision; preserve structural ordering (DB join before connection token, DB finalization acknowledgement before Worker terminal state). | Arbitrary infrastructure clock skew is not solved by this MVP. It may cause false rejection; it does not let a client mint a signature. |
| Raw attestations appear in logs or errors. | Token theft and correlation. | Never log request bodies or token values; redact the authority field; expose stable error codes only. | Operational tooling outside the repository must preserve the same redaction rule. |
| The shared HS256 key is compromised. | An attacker can forge history authority and, because the same secret already verifies other JWTs, may have broader authentication impact. | Keep the secret server-side, restrict Worker/web configuration, require exact claims, rotate on suspected compromise, and treat exposure as a security incident. | This remains high impact. A separate purpose-specific or asymmetric key materially improves trust isolation and is the preferred post-MVP hardening, but the existing Worker already receives this shared verification secret. The incremental pre-release configuration is accepted for Wave 1. |

### What the attestation proves

It proves only that the signing Worker observed the named authenticated subject,
participant session, room generation, and source generation as current in that
Durable Object at `iat`, after accepted JOIN.

It does **not** independently prove:

- that playback occurred, that the reported position is honest, or that the
  reported provider identity matches a server-fetched catalog;
- continuous socket presence, a leave time, or presence at event delivery time;
- database history for participant sessions, generations, or source transitions;
- source identity beyond the current generation boundary;
- that two people watched together; pair evidence needs two authenticated writes.

Database rows independently prove only room existence, durable host/membership,
the applicable join lower bound, and a finalized room end upper bound. They do not
prove live presence, participant sessions, room/source generation history, or
source identity.

## 6. Severity Calibration and Gate Decision

| Gate condition | Evidence and decision |
| --- | --- |
| Lifecycle evidence retained | Pass. No reviewed cleanup/delete/scheduled retention path exists. Retention is now an explicit dependency; account/room deletion intentionally ends delayed delivery. |
| Reliable issuance bounds | Pass. Room/member rows exist before connection-token issuance, and Worker terminal state follows acknowledged atomic DB finalization. Whole-second comparison and clock-skew residuals are explicit. |
| Missing history contained | Pass for pre-release MVP. Strict signed matching plus authenticated self-only writes limits replay to the holder's own history; generations, account fencing, deletes, and receipts bound convergence. |
| Recent People requires two writers | Pass as a mandatory transactional invariant and test gate. No v2 implementation may create pair evidence from one accepted writer. |
| Shared-key blast radius | Accepted for pre-release MVP only. The Worker already possesses the shared verification secret; purpose separation blocks token confusion without compromise. Separate/asymmetric signing remains stronger isolation and should be reconsidered before public release. |

### Required gates before runtime rollout

- Protocol tests must reject room tokens, missing sessions, mismatched claims,
  wrong purpose/issuer/audience, unknown fields, and oversized authority values.
- Web/RPC tests must cover host/member lower bounds, ended-room upper bounds,
  delayed terminal delivery, old account generation, deletion fences, duplicate
  receipts, and one-writer Recent People suppression.
- Worker/runtime tests must cover private delivery, JOIN/session requirements,
  source changes, ending/ended suppression, hibernation restoration, and token
  redaction.
- Any new room/member cleanup, changed end ordering, new signing-key topology, or
  public-release security review reopens this gate.

With those constraints, a new durable room-authority ledger would duplicate live
state and add migration/retention complexity without closing a demonstrated MVP
gap. It remains the fallback if a future retention path or stronger historical
presence guarantee becomes a product requirement.
