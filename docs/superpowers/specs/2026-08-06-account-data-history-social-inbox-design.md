# Account Data, Watch History, Social, And Inbox Foundation Design

Status: Durable inbox and Web Push implemented; invitation notifications pending staging acceptance

Date: 2026-08-06

Last updated: 2026-08-25

## Summary

AniDachi will use one durable account model for the web account dashboard and
the extension popup. Supabase-backed web services remain the durable source of
truth. The extension keeps an account-scoped local cache and a compact durable
outbox so playback progress remains responsive and survives temporary network
loss, but local storage does not become a second history, social graph, group,
invite, entitlement, or unread-count authority.

The MVP covers:

- canonical resume progress;
- distinct solo and shared watch sessions;
- friends and friend invite links;
- owner-owned personal groups;
- durable room invites and a shared account inbox;
- lightweight Manifest V3 notification delivery;
- consistent values across the web dashboard and extension popup.

This design deliberately avoids Supabase Realtime, Firebase/GCM, a new sync
service, a generic notification-event platform, frequent inbox polling, and
visual changes to the in-player panel. Standards-based Web Push is a wake-up
signal for the existing durable inbox, not a second data channel.

For the existing
`2026-06-20-social-rooms-subscriptions-execution-plan.md`, this design preserves
the implemented friends, groups, room-invite tables, popup inbox, and web inbox.
It supersedes the unimplemented GCM, push-token registration, short independent
invite expiry, and alarm-polling portions with the event-driven Web Push channel
and room-lifecycle invite semantics described below.

## Fixed Product Decisions

1. Supabase-backed web services own durable account state.
2. The extension writes only the signed-in user's progress.
3. Resume progress and historical watch sessions are separate concepts.
4. Shared sessions contain participants who actually publish their own
   checkpoints for that room session; one client never writes another user's
   progress.
5. The popup is a fast, recent, context-aware surface. The web account is the
   complete management and history surface.
6. Matching entities, counters, statuses, and limits have the same server
   values on both surfaces. The popup may request a smaller result window.
7. Social relationships, groups, invites, and unread state never use local
   extension storage as their source of truth.
8. A room invite remains actionable while its room is active and its recipient
   state is pending. There is no separate product expiry timer.
9. When the room ends, a pending invite becomes a non-actionable `Missed`
   presentation for 24 hours, then leaves the inbox.
10. Notification delivery is derived from the durable inbox. Missing a browser
    notification never loses an invite.
11. MVP background delivery uses standards-based Web Push for immediate
    invalidation, lifecycle reconciliation for recovery, and
    `chrome.notifications` for display. It does not use GCM, Realtime, or
    frequent polling.
12. The existing in-player panel and its visual behavior are outside this
    scope. Internal progress publication may change without changing that UI.

## Goals

- Prevent stale or duplicate extension events from regressing server progress.
- Make offline retry safe and bounded.
- Record truthful solo and shared history without cross-user mutation.
- Make friend, group, and invite state transitions atomic and idempotent.
- Prevent data from one account appearing after an account switch.
- Give the website and popup shared runtime-validated contracts.
- Add durable unread state and useful room-invite notifications without a
  parallel realtime or polling platform.
- Preserve current provider adapters, room synchronization, P2P media, and
  player-overlay behavior.
- Ship the work as small staging-first slices with explicit rollback paths.

## Non-Goals

- Real-time updates in an already-open account dashboard.
- Firebase Cloud Messaging, Chrome GCM, or Supabase Realtime.
- A persistent background WebSocket or frequent inbox polling.
- A universal notification table or event-sourcing platform.
- Community groups, shared group admins, group chat, public groups, or roles.
- Writing live playback position to Postgres every few seconds.
- Letting the popup become a complete account administration surface.
- Replacing Cloudflare Durable Objects as the live-room authority.
- Changing room playback sync, provider adapters, media seats, audio, video, or
  the visual in-player panel.

## Notification Delivery References

Official sources rechecked on 2026-08-09:

- Chrome extension Web Push:
  `https://developer.chrome.com/docs/extensions/how-to/integrate/web-push`
- Chrome extension real-time update options:
  `https://developer.chrome.com/docs/extensions/develop/concepts/real-time`
- Chrome extension alarms:
  `https://developer.chrome.com/docs/extensions/reference/api/alarms`
- Chrome extension notifications:
  `https://developer.chrome.com/docs/extensions/reference/api/notifications`
- Chrome action popup opening:
  `https://developer.chrome.com/docs/extensions/reference/api/action`
- HTTP Web Push delivery, TTL, urgency, and topic replacement:
  `https://www.rfc-editor.org/rfc/rfc8030.html`

## Existing Foundation To Reuse

The current code already has useful pieces that should be strengthened instead
of replaced:

- account-scoped extension watch-progress stores;
- account-scoped server-library caches and sync ledgers;
- `watch_sessions`, `watch_session_participants`,
  `watch_progress_checkpoints`, and `user_tracked_titles` tables;
- durable room-invite and recipient tables;
- friendships, personal groups, and group-membership tables;
- cookie or extension-bearer API authentication;
- server-only Supabase service-role access with RLS enabled;
- Worker-owned `roomGeneration` and `sourceGeneration` values;
- durable inbox screens in the popup and web account.

The implementation must remove the current cross-user progress propagation,
last-write-wins state transitions, unscoped popup social state, duplicated DTOs,
and multi-write operations that can leave partial records.

## Architectural Boundaries

### `packages/protocol`

Owns the runtime schemas and inferred TypeScript types for every value that
crosses web, Worker, and extension boundaries. It must not contain database
queries, browser APIs, React state, or provider-specific observation logic.

### `apps/web`

Owns authenticated account APIs, server-side domain services, Supabase RPC
calls, entitlement enforcement, pagination, retention, inbox aggregation, and
the complete account dashboard.

### `apps/api`

Remains the live-room authority. It already owns `roomGeneration`,
`sourceGeneration`, current participants, room capabilities, and source state.
It does not become the account-history database.

### `apps/extension`

Owns provider observation, a compact account-scoped progress outbox, cached
server snapshots, popup presentation, background inbox checks, and browser
notifications. It never receives database or signing secrets.

## Shared Contracts

The following Zod schemas and inferred types belong in `packages/protocol` or a
focused account-data module exported by that package:

- `WatchProgressCheckpointSchema`;
- `WatchProgressReconcileRequestSchema`;
- `WatchProgressReconcileResponseSchema`;
- `WatchLibraryResponseSchema`;
- `WatchSessionSchema`;
- `FriendshipSchema`;
- `FriendGroupSchema`;
- `RoomInviteSchema`;
- `SocialSnapshotResponseSchema`;
- `AccountInboxResponseSchema`;
- `AccountSummaryResponseSchema`;
- mutation request and response schemas for friend, group, and invite actions.

All HTTP responses are parsed at runtime. A TypeScript cast is not response
validation. The web dashboard and popup use the same response builders and
contract fixtures.

Every account response includes:

```ts
interface AccountResponseMeta {
  serverTime: string;
  schemaVersion: 1;
}
```

No global account revision or live subscription is required for the MVP.

## Account Isolation

Every extension cache, outbox, sync ledger, inbox cursor, and notification
dedupe record is keyed by the authenticated AniDachi user ID and a storage
schema version.

On account change or sign-out:

1. in-memory data from the previous user is hidden immediately;
2. a new request generation is issued;
3. late responses from previous generations are ignored;
4. the previous user's durable local partitions remain inaccessible but are not
   destructively mixed with the new account;
5. push delivery, subscription maintenance, and authenticated reconciliation
   stop until a valid current session exists.

Cached social data may be shown only when its stored owner ID matches the
current token user ID. Mutations never complete against a token that no longer
matches the active account.

## Watch Progress Model

### Resume Progress

Resume progress is the latest accepted checkpoint for one user and one
provider/title/episode identity. It is mutable and monotonic by accepted
observation time. A stale checkpoint may be retained as historical evidence but
cannot replace the resume pointer.

### Historical Sessions

Watch sessions are immutable activity boundaries with mutable latest progress
while active. They are classified explicitly:

- `solo`: no room ID, one owner;
- `shared`: a room ID plus authoritative room/source generations.

Completing or abandoning a session does not delete it. Watching the same
episode later creates or resumes a different session according to the boundary
rules below; it never silently rewrites an old completed shared session.

### Session Identity

Solo playback uses a random `clientSessionId` generated by the extension. It is
restored for the same user and resource across a refresh only while its last
local activity is no more than 30 minutes old. A later visit creates a new solo
session.

Shared playback reuses existing room runtime facts instead of introducing a new
room service. Its stable session key is derived from:

```txt
roomId + roomGeneration + sourceGeneration + videoFingerprint
```

`sourceGeneration` already changes when the host changes the watched resource.
`roomId` is the current durable room-lifecycle boundary. `roomGeneration` is
included as an additional runtime fence, but the implementation must not assume
that it already increments during a room reset because the current Worker keeps
it stable. A participant who joins midway publishes into the current shared
session key. A source change creates a new shared session.

Shared reconcile requests include the current room token. The web API verifies
that the token is valid for the same room and user before accepting shared
metadata. The write still affects only the authenticated user's participant and
resume records.

### Local Capture And Outbox

Provider adapters continue observing progress frequently enough for local
recovery. The extension writes local progress approximately every five seconds,
but it does not upload every observation as an immutable database row.

Server publication happens on:

- a heartbeat no more frequent than once per 30 seconds;
- pause;
- seek completion;
- source change;
- page hide or supported-page exit;
- room leave;
- playback ended.

The durable outbox compacts unsent progress by account, session, and episode.
For ordinary progress it keeps only the newest unsent checkpoint. Terminal
events such as `ended` are retained until acknowledged. Each transmitted entry
has a stable random `clientEventId` that survives retries.

The outbox is bounded. A cap removes only superseded non-terminal checkpoints;
it never drops the newest checkpoint for an active resource or an unacknowledged
terminal event.

### Server Reconcile

The authenticated web route validates and normalizes the batch, then calls one
transactional Postgres RPC. The RPC:

1. rejects a `userId` supplied by the client and uses the authenticated user;
2. deduplicates `(user_id, client_event_id)`;
3. validates provider against the canonical URL domain;
4. verifies room proof for shared entries;
5. resolves or creates the solo/shared session;
6. upserts only the authenticated participant row;
7. advances resume progress only when the incoming accepted timestamp is newer;
8. inserts the idempotent historical checkpoint;
9. applies tracked-title limits consistently;
10. returns the canonical account library result.

Client timestamps remain useful for offline ordering, but the server bounds
future clock skew. Values more than five minutes ahead of `serverTime` are
clamped to `serverTime`. Old offline observations remain valid historical input
but cannot regress a newer resume pointer.

The request is structurally validated before the RPC runs. Inside the RPC, all
writes caused by one checkpoint are atomic. Expected item-level outcomes such
as duplicate, stale, expired room proof, or unsupported resource are returned
as per-event acknowledgements or rejections so one poison item cannot block
unrelated progress. An unexpected database failure aborts the RPC call and
leaves every unacknowledged outbox entry available for retry. Retrying the same
`clientEventId` is safe.

### Persistence Changes

Additive migrations should introduce or backfill:

- a stable `session_key` for watch sessions;
- explicit solo/shared session kind if it cannot be derived safely;
- `client_event_id` on checkpoints with a unique
  `(user_id, client_event_id)` constraint;
- indexes for user, provider, title, episode, session time, and pagination;
- conditional update logic inside the reconcile RPC;
- consistent retention and tracked-title enforcement.

Existing rows receive deterministic legacy session keys. Destructive table
replacement is not required.

### Retention And Pagination

Server plan entitlements own retention and tracked-title counts. The popup does
not resurrect expired server history from its local cache.

The web account exposes cursor-based history pagination. The popup requests a
bounded recent window and server-derived full counts. Both surfaces receive the
same entity values for overlapping records. No silent fixed 250-session cutoff
is allowed.

## Friends

AniDachi supports direct friend requests and authenticated personal friend
invite links.

The user-facing MVP relationship flow remains explicit and small:

```txt
pending -> accepted
pending -> declined
accepted -> removed
```

Existing persisted `blocked` states remain readable for compatibility and are
excluded from social suggestions. This slice does not expose new block/unblock
controls and does not remove the existing backend state as an unrelated risky
refactor.

Transactional RPCs handle:

- friend-link consumption plus friendship creation;
- accept or decline only when the persisted state is still `pending`;
- remove;
- removal from current personal groups when a friendship is removed.

Removing a friend preserves historical solo/shared watch sessions and allows a
new request later. Repeated idempotent requests return the current canonical
state.

Friend-link tokens remain high-entropy and stored only as hashes. Direct
requests and link creation receive per-account rate limits and bounded active
link counts.

## Recent People

Recent people is a discovery aid derived from successful authenticated shared
watch sessions, not a second relationship type.

Rules:

- keep one canonical row per other user, ordered by the latest shared session;
- exclude the active user, accepted friends, pending friend relationships, and
  compatibility-blocked or explicitly hidden users;
- never duplicate the same user between Friends and Recent people;
- allow an eligible recent person to receive a friend request;
- preserve the shared watch history when a person is hidden or a friendship is
  later removed.

The popup receives recent people through the same versioned, account-owned
social snapshot as friends and groups. It must not make an unvalidated side
request or maintain a separate recent-people cache.

## Personal Groups

MVP groups are owner-owned personal recipient lists. They have no shared admins,
roles, public identity, independent chat, or history.

Rules:

- only accepted friends can be members;
- group count follows the owner's personal plan;
- group creation and limit enforcement happen in one transaction;
- add/remove member operations verify ownership and current friendship;
- removing or blocking a friendship removes active group memberships;
- archived groups cannot receive new members or create invites;
- historical shared watch sessions and already-created invite snapshots remain
  unchanged.

The popup supports lightweight create, select, and invite actions. Rename,
archive, bulk membership editing, and limit management belong to the web
account.

## Room Invites

Room invites target either explicit accepted friends or one owner-owned group.
Group delivery resolves a recipient snapshot at send time. Later group changes
do not alter an existing invite.

Creation uses one transactional RPC that:

1. validates the active host and room;
2. validates direct recipients or group ownership;
3. resolves accepted-friend recipients;
4. creates the invite and recipient snapshot together;
5. enforces recipient-count and request-rate limits;
6. deduplicates a stable `clientActionId` from the sending client;
7. returns the canonical invite.

Accept and decline are conditional transitions from persisted `pending` state.
Only one concurrent response can win.

Before accept:

- the recipient must still be pending;
- current friendship is checked;
- room existence and ended state are checked;
- room capacity is checked by the existing room admission path.

An ended room changes the recipient state to `expired`, which clients present
as `Missed` for 24 hours. A temporarily full room returns a clear `ROOM_FULL`
result without converting the pending invite. An accepted invite returns the
canonical join target but does not bypass normal room admission.

Only one semantic invitation may exist for the same recipient and room.
Overlapping direct and group targeting, retries, and repeated host actions
return the existing recipient state and never create another notification. A
recipient who declines cannot be invited to that same room again, but can be
invited normally to a future room.

The host invite panel reads the same canonical sent-invite state when it opens.
Targets already invited to the active room remain visibly labeled `Pending`,
`Accepted`, or `Invited` instead of returning to an ambiguous `Invite` action.
The create response also reports whether the transactional RPC created a new
recipient snapshot, so a retry can say that an invite already exists rather
than claiming another delivery. During the additive deployment bridge, clients
parse a missing `created` field from an older web deployment as `true`; new web
deployments always return the explicit boolean.

The implemented MVP bound is 100 resolved recipients per request and 20 new
invite actions per sender per minute. New extension clients keep one UUID
`clientActionId` for a failed request retry; the web API generates a fallback
UUID for older extension builds. The database still performs room-recipient
deduplication, so a legacy retry cannot create or notify a second semantic
invite. Push invalidation is scheduled only when the RPC creates at least one
new recipient snapshot.

### Compatibility With The Invite Runtime

The deployed invite foundation still has a mandatory `expires_at` value with a
12-hour default, and the current accept path rejects an invite when that value
passes. This is current runtime behavior, not the approved final product rule.

The room-lifecycle slice must migrate additively:

1. add the room-state and missed-presentation read path without removing
   `expires_at`;
2. keep old clients and rows readable while web and extension consumers move to
   the new contract;
3. stop using `expires_at` as product actionability only after staging proves
   room-end handling, dedupe, and 24-hour `Missed` retention across both
   surfaces;
4. make the column nullable or remove it only in a later cleanup migration after
   every deployed consumer no longer depends on it.

No implementation may silently reinterpret existing rows or remove the current
server check in isolation.

## Durable Account Inbox

The inbox is an aggregated contract over domain records, not a second copy of
them. The MVP includes:

- incoming room invites;
- room invites that became `Missed` within the last 24 hours;
- incoming friend requests;
- server-derived pending and unread counts.

Add `seen_at` to room-invite recipient state and an addressee-specific seen time
for incoming friend requests. Marking items seen is an authenticated,
idempotent server mutation. Accepting or declining also makes the item seen.

`AccountInboxResponse` returns normalized items ordered by server time, the next
cursor, counts, and response metadata. `Missed` room invites are omitted from
actionable counts and remain available only for their 24-hour presentation
window before physical cleanup.

The web account and popup use the same inbox builder. No surface maintains an
independent unread counter.

## Notification Delivery

### MVP Channel

The extension uses the standards-based Push API as an immediate invalidation
channel. After a new durable room invite or friend request commits, the server
sends each enabled extension installation a minimal `inbox_changed` Web Push. A suspended
Manifest V3 service worker wakes, runs the same authenticated `syncInbox()` used
by the popup, and derives the badge and notification from the validated server
response. Push data never becomes authoritative account state.

The signal uses a 24-hour TTL and one replacement topic such as `inbox-sync`.
Multiple signals queued for one offline installation therefore collapse into
one wake-up, after which the extension fetches every unseen inbox item. The
payload contains no invite token, room token, sender name, group name, media
title, message body, or other private display data.

There is no minute- or five-minute inbox poll. Reconciliation runs when:

- a push event arrives;
- Chrome starts;
- an extension session is established or changes;
- the popup opens;
- an invite mutation succeeds;
- a once-per-24-hours `chrome.alarms` maintenance event verifies a long-running
  installation's subscription and catches stale state.

The daily alarm is a maintenance safety net, not the user-facing delivery path.
It must be checked and recreated on extension and browser startup because
Manifest V3 workers and alarms are not a durable process. A cursor advances
only after a response is schema-validated, stored for the active account, and
fully processed.

Each browser profile registers one Web Push subscription against the existing
account device model. Sign-in and notification enablement ensure the current
subscription is registered. Explicit disablement revokes the subscription and
stops OS notifications while preserving the durable inbox, its badge, and local
display dedupe. Sign-out additionally clears account-scoped dedupe and badge
state. Permanent push endpoint failures such as HTTP 404 or 410 prune the
server-side subscription. The VAPID private key remains server-only.

The Chrome MVP accepts only HTTPS subscriptions on Chrome's FCM push host and
allows at most five active push-enabled extension installations per account.
Delivery uses bounded concurrency and a request timeout. Stored endpoints are
validated again before delivery; invalid or permanently failed subscriptions
are disabled without making an outbound request. Another browser provider is
added only through an explicit allowlist change with its own staging evidence.

The room-invite writer uses the deployed atomic, idempotent RPC. Notification
delivery is queued only for a newly created durable invite, after the canonical
transaction succeeds. Repeated room-invite or friend-request mutations return
their existing durable state and do not queue duplicate notifications.

### Browser Notifications

The MVP displays system notifications for explicit room invitations and new
incoming friend requests. Room creation, general friend activity, and presence
do not produce system notifications. Both supported invitation types remain
durable Inbox items even if push delivery is delayed or unavailable.

Notification rules:

- all user-facing notification, status, and error copy is English;
- a direct invite uses copy such as `Vladislav invited you to watch together`;
- a group invite uses `Vladislav invited you to watch with a group`; the exact
  private group name appears only inside the authenticated inbox;
- a friend request uses copy such as `Vladislav sent you a friend request`;
- one unseen active invite may identify the inviter, while multiple unseen or
  offline invites produce one count-based summary instead of an OS notification
  burst;
- an invite discovered after room end uses neutral missed copy and has no join
  action;
- notifications contain no custom sound and use the operating system's normal
  notification behavior;
- notifications have no inline `Join` or `Decline` buttons;
- clicking records an account-scoped popup route intent, attempts to open the
  extension action popup on `Invites`, and falls back to the canonical web inbox
  in a new tab if popup opening is unavailable;
- clicking never accepts, declines, joins, leaves, or switches rooms;
- joining from the inbox while already in another room is labeled `Switch room`
  and requires confirmation before the current room is left;
- local notification display dedupe is account- and browser-profile-scoped;
- every signed-in enabled device may notify, while server-owned `seen_at` keeps
  unread state consistent across devices;
- the action badge represents unseen items, not every pending action; opening
  `Invites` marks displayed items seen and clears the badge after the server
  acknowledges the mutation;
- disabled permission or preference leaves the durable inbox and badge
  functional;
- MVP exposes one `Invitation notifications` toggle, enabled by default, with
  no per-group mute, schedule, custom sound, or additional notification modes.

The local notification preference is per browser profile. Push subscription
fields remain tied to the authenticated account device. The release manifest
declares `notifications` as a required permission so the default-on preference
can register a Web Push device immediately after sign-in; the local toggle
unsubscribes that browser without changing the durable inbox. The Chrome Web
Store listing must explain the permission before public release.

Firebase/GCM and Supabase Realtime remain unnecessary. Web Push wakes the MV3
worker; the durable inbox and lifecycle reconciliation recover missed delivery.

## Surface Behavior

### Extension Popup

The popup shows cached canonical data immediately when the cache belongs to the
active account, then refreshes from the server. It refreshes on open, after any
mutation, after reconnect, and after an auth change.

The popup may overlay one local `Syncing` progress state on top of a server
snapshot. That optimistic state is visually explicit and never changes durable
counts or social state before acknowledgement.

Popup responsibilities:

- recent resources and resume actions;
- recent solo/shared sessions;
- accepted friends and contextual recent-people discovery;
- lightweight group creation, selection, and invite targeting;
- pending inbox actions;
- current server-derived counts and plan-limit feedback;
- offline, stale, loading, empty, syncing, and error states.

### Popup Social Information Architecture

The popup top-level navigation is:

```txt
Watch | People | Inbox
```

`People` has two internal modes, not three equal permanent tabs:

```txt
Friends | Groups
```

The `Friends` mode is the default. It shows accepted friends first, then a
compact `Watched with recently` section only when eligible recent people exist.
The recent section is contextual discovery, so it disappears entirely when
empty instead of leaving an empty navigation destination. Incoming friend
requests remain actionable in `Inbox`; outgoing request status does not create
another popup subsection.

The `Groups` mode shows personal groups and supports only quick creation,
selection, and invite use. Rename, archive, bulk membership editing, limits,
and other full management belong to the web account.

The `People` top-level tab has no aggregate numeric badge. Adding friend and
group counts together is not a meaningful people count. `Inbox` shows the
canonical server-derived unseen count; actionable counts remain inside the
Inbox surface.

Rows are deduplicated by user ID before rendering. The popup remains a compact,
scrollable quick-action surface and always provides an `Open dashboard` escape
hatch for full management.

The current monolithic popup component should be split only along domain
boundaries needed by this work: account sync, resources/history, social/groups,
and inbox. This is a targeted extraction, not a general UI rewrite.

### Web Account Dashboard

The dashboard reads the same domain services directly during server rendering
and uses the same API mutations and response builders afterward. It refreshes
after mutations and when an account page regains visibility. There is no
constant polling or Realtime subscription.

Web responsibilities:

- complete cursor-paginated solo/shared history;
- full tracked-title management;
- detailed friend requests, friends, compatibility-blocked state where needed,
  and recent people;
- full group editing and archive management;
- complete invite inbox and sent history;
- account, billing, devices, and privacy management.

## Failure Behavior

### Offline Extension

- show the last validated account-owned snapshot with a visible offline state;
- keep new compacted progress in the durable outbox;
- do not allow offline social mutations to look successful;
- retry progress after connectivity and authentication recover;
- upload the outbox before fetching the final canonical library snapshot.

### Partial Server Failure

Transactional RPCs roll back all related writes. The client retains the same
idempotency key for retry. No invite, friendship, group, or watch reconcile may
return success after only part of its state was persisted.

### Stale And Duplicate Requests

- duplicate progress events return success without another checkpoint;
- stale progress cannot move the resume pointer backward;
- duplicate invite creation returns the existing invite for that action ID;
- only one pending-state response transition succeeds;
- late responses from a previous account request generation are ignored.

### Cache Corruption Or Contract Mismatch

Invalid local cache entries are discarded independently of the outbox. Invalid
server responses produce a recoverable error and are never written as a valid
snapshot. The last valid same-account snapshot may remain visible with a stale
indicator.

## Security, Privacy, And Abuse Controls

- The extension never receives Supabase service-role, JWT signing, OAuth,
  Stripe, Cloudflare, or TURN secrets.
- Authenticated user identity always comes from the validated cookie or bearer
  session, never a client body field.
- Shared-history metadata requires a room token bound to the room and user.
- Provider and canonical URLs are allowlisted against supported adapters.
- Friend requests, friend links, group creation, and room invites have bounded
  payload sizes and per-account rate limits.
- Invite notification copy avoids exposing private viewing details on a locked
  screen.
- RLS remains enabled without public write paths; privileged database functions
  have a fixed `search_path` and narrowly granted execution.
- Chrome permissions remain channel-appropriate and are added only with the
  implemented feature that requires them.

## Observability

Add privacy-safe structured events for:

- progress outbox enqueue, compact, retry, acknowledgement, and rejection;
- reconcile batch size, duplicate count, and stale count;
- friend/group/invite mutation result codes;
- push subscription register, refresh, revoke, and permanent delivery failure;
- push receipt, inbox reconciliation reason, item count, and notification display
  result;
- contract parse failures and account-generation drops.

Do not log access tokens, invite tokens, room tokens, message text, raw URLs with
private query parameters, email addresses, or full user IDs. Use existing
redaction and hashed identifiers.

## Testing Strategy

### Protocol

- parse valid fixtures shared by web and extension;
- reject incompatible versions, unsafe URLs, invalid states, and oversized
  batches;
- round-trip every public response schema.

### Database And Web Integration

- duplicate and out-of-order progress;
- mixed accepted and rejected reconcile items without outbox starvation;
- future clock skew;
- transaction rollback and retry;
- solo and shared session identity;
- one user cannot mutate another user's progress;
- friend-link atomic acceptance;
- concurrent friend and room-invite responses;
- concurrent group creation at plan limits;
- remove/block cleanup of active group membership;
- invite snapshot, room-lifecycle validity, missed retention, and full room;
- retention, plan downgrade, and history pagination beyond 250 sessions.

### Extension

- outbox compaction and persistence across restart;
- upload-before-refresh recovery;
- account switching during in-flight social and history requests;
- same-account cache reuse and cross-account cache rejection;
- invalid response parsing;
- push subscription recovery and daily maintenance-alarm recreation after
  service-worker restart;
- queued push replacement, notification aggregation, dedupe, permission
  disabled, popup/fallback routing, and sign-out badge cleanup.

### Cross-Surface Acceptance

- website and popup fixtures render identical entity values and counts;
- popup recent subset matches the same records in full web history;
- inbox pending and unread counts agree after refresh;
- opening `Invites` on one device clears unread badge state on the other after
  reconciliation without removing pending actions;
- solo viewing creates no shared participants;
- two-account room viewing creates one shared session with two self-written
  participant records;
- later solo viewing does not mutate the shared session;
- offline progress appears as syncing and converges after reconnect;
- two browsers receive and independently notify a valid room invite.

### Staging

Use two real accounts, two browser profiles, two devices where available, and a
second network for the final room-history and notification pass. Verify
Crunchyroll and YouTube progress, source changes, reload, room leave, room end,
invite acceptance, account switching, browser restart, and notification click
routing.

## Migration And Rollout

All schema changes are additive first. Do not delete or repurpose existing
columns until the new read path has passed staging acceptance.

Recommended slices:

1. **Shared contracts and account isolation**
   - protocol schemas and fixtures;
   - account-owned popup state and request generations;
   - no database behavior change.
2. **Progress outbox and canonical reconcile**
   - additive watch schema migration and transactional RPC;
   - extension outbox and server response parsing;
   - server remains compatible with the previous library read model.
3. **Solo/shared history**
   - session-key backfill;
   - room generation/source generation inputs;
   - paginated canonical reads and cross-surface rendering.
4. **Friends and groups**
   - transactional transitions, compatibility handling for existing blocked
     state, group-limit enforcement, and membership cleanup.
5. **Durable inbox and room invites**
   - transactional creation/response, `seen_at`, room-lifecycle validity,
     24-hour missed presentation, semantic recipient-and-room dedupe,
     aggregation, counts, and an additive transition from the current 12-hour
     `expires_at` behavior.
6. **Background notification delivery**
   - Push API subscription, `inbox_changed` invalidation, lifecycle and daily
     maintenance reconciliation, badge, notification, controls, and
     store/privacy updates.
7. **Web dashboard completion**
   - full management routes and visibility refresh.
8. **Popup product pass**
   - recent history, social, groups, inbox, and clear state presentation.
9. **Staging acceptance and promotion**
   - focused automated checks, real-account/device evidence, rollback review,
     and tested promotion through staging to main.

Each slice is one coherent feature branch and PR into `staging`. Database-
dependent behavior is not considered complete from a preview build alone.
Promotion occurs only after the affected staging schema, web deployment, Worker
where applicable, and extension artifact have been tested together.

## Rollback

- Additive migrations remain in place during rollback.
- Feature code can return to old read paths while new columns are unused.
- Notification permissions are not shipped until the full notification slice
  is ready, so earlier slices do not require a manifest rollback.
- The old server library response remains available until both web and extension
  consume the validated contract in staging.
- No destructive backfill or table replacement is part of the MVP rollout.

## Acceptance Criteria

The foundation is complete when:

- stale, duplicate, and offline progress converges without regression;
- each user writes only their own progress;
- solo and shared sessions remain distinct and historically truthful;
- website and popup show the same canonical entity values, counts, and inbox
  state after refresh;
- account switching cannot expose previous-account social or watch data;
- friend, group, and invite multi-write operations are atomic and idempotent;
- direct/group room invites survive missed notification delivery;
- browser notifications arrive through Web Push without frequent polling and
  recover after offline time, service-worker restart, and browser restart;
- current plan retention and limits are consistently enforced server-side;
- integration and staging tests cover two accounts and real supported provider
  playback;
- the in-player visual interface and unrelated room/P2P behavior remain
  unchanged.
