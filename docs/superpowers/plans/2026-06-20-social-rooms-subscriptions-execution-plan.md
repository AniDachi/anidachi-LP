# Social Rooms, Friends, Groups, And Subscriptions Execution Plan

**Created:** 2026-06-20.

**Status:** implementation in progress. Phases 4.5, 5 durable inbox, and 6
watch library/history are implemented on staging-oriented feature branches.
Stripe staging setup is deferred until Test Mode products, prices, and webhook
secrets are available.

**Product surface review:** updated 2026-06-21 to make the final product shape
explicit: the extension popup is the fast watch-control surface, while the web
account dashboard is the full management surface. The current standalone
`/friends` page is not the final destination; it should become part of the
account/dashboard information architecture before this feature is promoted.

**Goal:** add the social layer around Anidachi watchrooms without bloating the
current architecture: explicit friends, personal groups, recent co-watchers,
group/direct invites, durable "continue together" history, and host-based paid
room limits.

This plan builds on the existing three-plane architecture:

- `apps/web` + Supabase own durable identity, billing, profiles, friends,
  groups, room metadata, invite records, and watch history.
- `apps/api` + Durable Objects own live room state, WebSocket messages,
  playback sync, presence, chat, reactions, P2P signaling, and live room limits.
- `apps/extension` owns the browser viewing experience, local auth tokens,
  provider adapters, overlay UI, notifications, and WebRTC media.
- `packages/protocol` owns every cross-plane contract before consumers change.

## Evidence Reviewed

Project files reviewed:

- `docs/project-operating-manual.md`
- `docs/current-development-state.md`
- `docs/project-architecture-and-development.md`
- `docs/site-extension-integration-notes.md`
- `docs/shared-watch-progress-tracker.md`
- `docs/social-pricing-model.md`
- `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`
- `apps/web/lib/room-quota.ts`
- `apps/web/lib/anidachi-auth/extension-session.ts`
- `apps/web/app/api/create-checkout-session/route.ts`
- `apps/web/app/api/stripe/webhook/route.ts`
- `apps/api/src/room-state.ts`
- `packages/protocol/src/types.ts`
- Supabase migrations under `apps/web/supabase/migrations/`
- `apps/extension/src/popup-app.tsx`
- `apps/extension/src/watch-progress.ts`
- `apps/extension/src/social-client.ts`
- `apps/extension/src/overlay-app.tsx`
- `apps/web/app/friends/page.tsx`
- `apps/web/app/friends/friends-client.tsx`

Graphify queries checked on 2026-06-21:

- `Extension popup resources dashboard friends groups watch history continue together social plan product surfaces`
- `Extension popup resources progress tracking friends groups user dashboard account hub architecture`

Official docs checked on 2026-06-20:

- Stripe Subscriptions:
  `https://docs.stripe.com/billing/subscriptions/overview`
- Stripe subscription webhooks:
  `https://docs.stripe.com/billing/subscriptions/webhooks`
- Stripe Entitlements:
  `https://docs.stripe.com/billing/entitlements?dashboard-or-api=api`
- Supabase Row Level Security:
  `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase Realtime Broadcast:
  `https://supabase.com/docs/guides/realtime/broadcast`
- Chrome extension `gcm` API:
  `https://developer.chrome.com/docs/extensions/reference/api/gcm`
- Chrome extension `notifications` API:
  `https://developer.chrome.com/docs/extensions/reference/api/notifications`
- Firebase Cloud Messaging token management:
  `https://firebase.google.com/docs/cloud-messaging/manage-tokens`
- Firebase Cloud Messaging message lifetime:
  `https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan`
- Chrome Web Store user data and minimum permission policy:
  `https://developer.chrome.com/docs/webstore/program-policies/user-data-faq`
- Cloudflare Durable Objects WebSocket Hibernation:
  `https://developers.cloudflare.com/durable-objects/best-practices/websockets/`

Official docs rechecked on 2026-06-21:

- Chrome extension `sidePanel` API:
  `https://developer.chrome.com/docs/extensions/reference/api/sidePanel`
- Chrome extension `gcm` API:
  `https://developer.chrome.com/docs/extensions/reference/api/gcm`
- Chrome extension `notifications` API:
  `https://developer.chrome.com/docs/extensions/reference/api/notifications`
- Firebase Cloud Messaging token management:
  `https://firebase.google.com/docs/cloud-messaging/manage-tokens`
- Firebase Cloud Messaging TTL:
  `https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan`
- Supabase Row Level Security:
  `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase Realtime Broadcast:
  `https://supabase.com/docs/guides/realtime/broadcast`
- Stripe subscription webhooks:
  `https://docs.stripe.com/billing/subscriptions/webhooks`

## Non-Goals

- Do not build shared community servers or Discord-style spaces in the MVP.
  Personal groups are enough.
- Do not make every participant pay. The host plan controls the room.
- Do not increase P2P video beyond 4 media participants.
- Do not add SFU/LiveKit in this plan. If all 15 participants must receive the
  same camera streams later, that becomes a separate SFU decision.
- Do not write live playback state to Postgres every second.
- Do not expose Supabase service-role keys, Stripe secrets, OAuth secrets, JWT
  signing secrets, Cloudflare tokens, or TURN secrets to the extension.
- Do not replace the room/P2P hardening plan. This plan depends on it.
- Do not turn the extension popup into a full admin console. It should stay a
  fast, context-aware control surface.
- Do not leave a standalone `/friends` page as the final product shape. Friends,
  groups, invites, devices, billing, and watch library belong under the account
  dashboard.
- Do not add `sidePanel`, `gcm`, or `notifications` permissions to store builds
  until the corresponding UX, privacy copy, and Chrome Web Store listing impact
  are ready.

## Core Product Rules

### Identity

- A person must have an Anidachi account before they can become a friend,
  appear as a named recipient, or be stored in a group.
- OAuth signup through Google or Discord should automatically create or update
  the Anidachi user account.
- Google/Discord profile data should seed the account on first login: verified
  email, provider id, display name, and avatar if available.
- The AniDachi profile becomes the product source of truth after account
  creation. Provider data is a starting point; the user can later edit their
  AniDachi display name, avatar, and optional handle.
- If the same verified email logs in through Google and Discord, the providers
  should attach to one AniDachi account instead of creating duplicate people.
- First successful login should make the account dashboard available
  immediately. Redirect back to the original invite/extension flow when a
  `returnTo`/`next` target exists; otherwise use the account/dashboard entry.
- A one-off invite link remains supported. Watching together once does not
  automatically create a friendship.

### Relationship States

The product must keep these concepts separate:

- **Guest by link:** joined through an invite link, no social relationship.
- **Recent co-watcher:** someone the user watched with before, available for
  "add friend", "invite again", or "hide".
- **Friend:** an explicit accepted relationship.
- **Group member:** an accepted friend inside a personal group owned by one
  user.
- **Blocked user:** cannot send friend requests, direct invites, or group
  invites to the blocker.

Friendship must be explicit. Recent co-watchers are not friends until the user
chooses to send or accept a friend request.

### Groups

- MVP groups are owner-owned personal invite lists.
- Groups do not have shared admins, roles, public pages, chat history, or group
  profiles in the MVP.
- Only accepted friends can be added to a group.
- Removing or blocking a friend removes them from future group invite targeting.
  Historical watch sessions remain as immutable history.
- Sending an invite to a group creates a recipient snapshot at send time. Later
  group membership changes do not silently change already-sent invites.

### Subscription Ownership

The central rule:

```txt
Host plan controls room limits.
User plan controls personal account limits.
```

Examples:

- Free user joins a Plus host room: the room uses Plus limits, but the user's
  account remains Free.
- Plus user joins a Free host room: the room remains Free.
- Free friends can join paid rooms.
- Paid limits are not transferred to other users' personal accounts.

## Product Surfaces And Sync Model

AniDachi needs two first-class product surfaces over the same backend data:

```txt
Extension popup = fast watch control.
Web account dashboard = full management and editing.
```

Both surfaces must use the same web APIs and durable Supabase state. The
extension can cache recent data locally for speed, but local storage is never the
source of truth for social relationships, room invites, shared watch sessions,
subscription limits, or durable tracked-title counts.

### Extension Popup

The extension popup already has the right foundation: provider folders,
resources, series, episodes, local progress, and shared-progress UI. It should
become the quick "during watching" surface.

Recommended top-level popup areas:

```txt
Resources
Friends
Groups
Inbox
```

Responsibilities:

- open watched resources quickly;
- show local cached progress instantly;
- show backend-backed shared session markers after sync;
- create or continue a room from the current resource/session;
- invite one friend, a group, recent people, or copy a link;
- accept or decline pending invites;
- send a friend request to a recent co-watcher;
- create a simple personal group when the interaction is lightweight;
- show plan limits only where the user hits them.

The popup should avoid heavy management. If a flow needs bulk editing,
multi-step settings, billing, device cleanup, privacy, or long history browsing,
it should deep-link to the web dashboard.

### Web Account Dashboard

The website should become the full account control panel, not just marketing and
auth pages. Recommended route shape:

```txt
/account
  /account/watch-library
  /account/friends
  /account/groups
  /account/invites
  /account/devices
  /account/billing
  /account/settings
```

Responsibilities:

- edit profile, display name, avatar, and optional handle;
- browse the full watch library by provider, title, episode, and session;
- edit or archive tracked titles;
- inspect who watched what together and when;
- create a room from a saved session;
- manage friends, incoming/outgoing requests, blocked users, and recent people;
- manage groups and group membership;
- inspect pending/expired invites;
- manage notification devices and push permissions;
- manage billing and current plan limits.

The current `/friends` page should be treated as a staging-only stepping stone.
Before production promotion, it should either move into `/account/friends` or be
replaced by the dashboard shell.

### Optional Future Side Panel

Chrome Side Panel is useful for a persistent, wider extension UI, but it requires
the `sidePanel` permission and changes the Chrome Web Store permission surface.
For MVP, prefer popup + overlay unless the popup becomes too dense. If side
panel is adopted later, use it as a richer companion panel for watch library,
friends, groups, and inbox, not as a replacement for the web dashboard.

### Sync Rules

- Backend APIs own durable social and watch data.
- Extension `chrome.storage.local` owns only fast cache and offline-friendly
  local provider progress.
- Cached extension data must store `syncedAt` and enough version/revision
  fields to avoid overwriting newer server state.
- Server writes win for friends, groups, invites, devices, subscription limits,
  and shared watch sessions.
- Local provider progress can create a checkpoint candidate, but the server
  decides whether it becomes durable history and whether it counts toward
  tracked-title limits.
- On login, the extension should reconcile local progress into the account using
  explicit checkpoint APIs, not direct Supabase access.
- On logout, local cache can remain device-local, but account-bound social data
  must be cleared from the extension cache.

## Plan Matrix

Internal plan codes are now canonical:

- `free` -> Free
- `plus` -> Plus
- `pro` -> Pro

Legacy aliases `watcher`, `nakama`, `junkie`, `crunchyroll_subscriber`, and
`anime_junkie` may be accepted only during the compatibility bridge window for
old tokens, Stripe metadata, and pre-bridge data. New runtime code and new data
must emit `free`, `plus`, and `pro`.

| Capability | Free (`free`) | Plus (`plus`) | Pro (`pro`) |
| --- | --- | --- | --- |
| Price | $0 | $7.99/mo | $14.99/mo |
| Main use | Try Anidachi and join friends | Regular watchrooms with friends | Larger groups |
| Who pays | Nobody | Host | Host |
| Host daily room time | 30 host-min/day | Unlimited | Unlimited |
| Total participants in own room | 4 | 6 | 15 |
| Media seats in own room | 0 | 4 | 4 |
| Chat/sync/reactions | Yes | Yes | Yes |
| Invite link | Yes | Yes | Yes |
| Friends | Unlimited | Unlimited | Unlimited |
| Recent people | Yes | Yes | Yes |
| Own personal groups | 1 | 5 | 15 |
| Active tracked titles | 3 | 15 | 50 |
| Personal history visible | 7 days | 3 months | 12 months |
| Continue together | Within Free room limits | Yes | Yes |
| Receive push invites | Yes | Yes | Yes |
| Send group/direct push invites as host | In-app only or limited | Yes | Yes |
| Custom room name | No | Yes | Yes |

Important media rule for Pro:

```txt
Pro allows 15 total room participants, but only 4 media seats.
The other 11 participants are chat/sync/reaction participants.
```

For MVP stability, "media seat" means WebRTC camera and push-to-talk audio
participation. Chat-only participants should not join the P2P media mesh. They
can still watch their own source video, sync playback, chat, and react.

If the future product needs all 15 participants to see 4 live camera streams,
that is no longer small-room mesh P2P. It should be evaluated as an SFU/LiveKit
or Cloudflare Realtime SFU feature.

## Current Gaps To Close

The existing code has a useful foundation:

- `users.plan` stores canonical `free | plus | pro` after the bridge
  canonicalization migration.
- extension access tokens already include `plan`.
- `room-quota.ts` already implements Free host-minutes.
- room create/connect already flows through the web app.
- Worker `RoomState` already rejects the 5th distinct participant.
- `packages/protocol` already defines room events and participants.

But these gaps must be fixed before the social layer can be reliable:

- Stripe checkout must use canonical `plus` / `pro` plan codes and suffixed
  test/live price env vars.
- Stripe webhook currently sends a subscription alert email but does not update
  the user's plan or subscription state.
- There is no durable `subscriptions` or `billing_customers` table.
- There are no `profiles`, `friendships`, `groups`, invite-recipient, push-token,
  or production watch-session tables.
- Worker has one hardcoded `MAX_ROOM_PARTICIPANTS = 4` and no split between
  total participants and media seats.
- `Participant.cameraEnabled` is a client-visible flag, not a server-enforced
  entitlement or seat reservation.
- Current protocol snapshots do not carry room capabilities.
- Extension permissions do not include `gcm` or `notifications` yet.
- The staging `/friends` page is functional but not the final account
  dashboard UX.
- Friend request UX must avoid manual codes. The MVP friend-add paths are
  recent co-watchers and a private one-time friend invite link.
- The extension popup still contains demo shared-session markers; production
  shared progress must come from backend watch history.
- The extension popup currently owns the resource/progress browsing experience,
  while the website does not yet have an equivalent account watch-library
  dashboard.

## Billing And Entitlements

### Source Of Truth

Stripe is the billing source of truth. Anidachi should mirror the minimum
subscription state required for fast authorization.

Use either of these approaches:

1. **Preferred if available in the account:** Stripe Entitlements.
   - Configure features on Stripe products.
   - Listen to `entitlements.active_entitlement_summary.updated`.
   - Persist active feature lookup keys internally for fast checks.
   - Map feature keys to Anidachi plan entitlements.

2. **Acceptable MVP fallback:** Stripe subscription status mirror.
   - Listen to subscription and invoice webhooks.
   - Store active subscription status, price id, plan code, and current period.
   - Derive entitlements from server-side `PLAN_ENTITLEMENTS`.

Do not trust the extension for plan decisions. Extension tokens may carry a plan
snapshot for UI, but sensitive operations must resolve the user's current plan
server-side.

### Required Webhook Events

Handle these events idempotently:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `entitlements.active_entitlement_summary.updated` if using Stripe
  Entitlements

Store processed Stripe event ids so retries do not double-process.

### Access Rules

- `active` and `trialing` can grant paid plan access.
- `past_due` can keep access during a short grace period if product chooses to
  allow retries. The grace policy must be explicit in code and tests.
- `unpaid`, `canceled`, `incomplete_expired`, and `paused` should fall back to
  Free.
- A downgrade or canceled subscription must never delete user data. It should
  archive or hide over-limit data.
- Active room capabilities are a snapshot. For MVP, plan changes affect newly
  created rooms. Upgrade-in-place is a separate protocol feature if needed.

### Checkout Requirements

- Checkout must require an authenticated Anidachi user.
- Checkout sessions must include `metadata.userId` and `metadata.planCode`.
- If a Stripe customer already exists for the user, reuse it.
- Success/cancel URLs should return to the account or room flow, not only the
  marketing home page.
- Price ids must be environment-specific and named for Plus/Pro, not legacy
  marketing names.

### Server Entitlement Helper

Create one server helper and use it everywhere:

```ts
type PlanCode = "free" | "plus" | "pro";

type PlanEntitlements = {
  planCode: PlanCode;
  room: {
    dailyHostSeconds: number | "unlimited";
    maxParticipants: number;
    maxMediaSeats: number;
    canNameRoom: boolean;
    canSendPushInvites: boolean;
  };
  account: {
    maxOwnedGroups: number;
    maxActiveTrackedTitles: number;
    historyRetentionDays: number;
  };
};
```

Rules:

- Keep this helper server-side first.
- Export only safe, derived capability values to the extension.
- Unit-test every plan and edge status.
- Room creation must use this helper to snapshot capabilities.
- Group creation, active title tracking, invite sending, and history reads must
  use this helper for account limits.

## Database Model

All new Supabase tables must enable RLS. The current project uses custom auth
and server-side service-role access, so start with RLS enabled and no direct
public policies unless a direct Supabase client feature is intentionally added.

### Billing Tables

```sql
billing_customers (
  user_id uuid primary key references users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  plan_code text not null check (plan_code in ('free', 'plus', 'pro')),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

stripe_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text
)
```

The existing `users.plan` can remain as a denormalized fast path, but it must be
updated only by trusted server code from subscription/entitlement state.

### Profile Tables

The existing `users.display_name` and `users.avatar_url` are enough for auth, but
social features need a profile boundary:

```sql
profiles (
  user_id uuid primary key references users(id) on delete cascade,
  handle text unique,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

MVP can auto-create a profile from `users` immediately after OAuth account
creation. A unique handle can be optional at first, but the MVP should not use
manual handle/code search as the primary friend-add UX. Use recent co-watchers
and short-lived friend invite links instead. Do not expose raw user UUIDs as a
primary friend-add UX.

Profile sync rules:

- On first OAuth login, seed `profiles.display_name` and `profiles.avatar_url`
  from the provider profile.
- On later OAuth logins, do not blindly overwrite a user-edited AniDachi
  profile. Keep provider data as fallback or refresh only if the AniDachi
  profile has not been customized.
- Friend invite links are separate one-time token records. Store only token
  hashes server-side and expire links by default.
- Store Google/Discord provider ids on `users`, but do not expose them in public
  profile responses.

### Friend Invite Link Table

```sql
friend_invite_links (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  accepted_by_user_id uuid references users(id) on delete set null,
  revoked_at timestamptz
)
```

Friend invite links are for adding a person, not joining a room. Existing room
invite links remain the watchroom join mechanism. A friend invite link should
show the sender after sign-in and become accepted with one explicit click.
Unauthenticated users go through Google/Discord OAuth first, get an AniDachi
account/profile automatically, and then return to the invite page.
Limit active unused friend invite links per sender to reduce spam and token
spray.

### Friendship Tables

```sql
friendships (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references users(id) on delete cascade,
  addressee_user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'blocked', 'removed')),
  blocked_by_user_id uuid references users(id),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (requester_user_id <> addressee_user_id)
)
```

Add a unique unordered-pair constraint. In Postgres this can be done with a
generated pair key or an expression index over `least()` and `greatest()`.

Friendship rules:

- One relationship row per unordered user pair.
- Pending requests can be canceled by requester or declined by addressee.
- Accepted friendship can be removed by either side.
- Blocked wins over all invite and friend-request paths.
- Friend search must not leak private email addresses. Prefer handle search.

### Groups

```sql
friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users(id) on delete cascade,
  name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)

friend_group_members (
  group_id uuid not null references friend_groups(id) on delete cascade,
  friend_user_id uuid not null references users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, friend_user_id)
)
```

Rules:

- Owner must have an accepted friendship with each member.
- `maxOwnedGroups` counts non-archived groups owned by the user.
- Downgrade over the group limit archives extra groups instead of deleting them.
- Archived groups do not send new invites but can remain visible as history.

### Invites

```sql
watch_invites (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references rooms(room_id) on delete cascade,
  sender_user_id uuid not null references users(id) on delete cascade,
  source_type text not null check (source_type in ('link', 'direct', 'group', 'recent')),
  source_group_id uuid references friend_groups(id),
  message text,
  status text not null default 'active' check (status in ('active', 'canceled', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
)

watch_invite_recipients (
  invite_id uuid not null references watch_invites(id) on delete cascade,
  recipient_user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'seen', 'accepted', 'declined', 'expired')),
  delivered_at timestamptz,
  seen_at timestamptz,
  responded_at timestamptz,
  primary key (invite_id, recipient_user_id)
)
```

Rules:

- Group invites snapshot recipient rows at send time.
- Link invites can exist without recipient rows.
- Named direct/group invites require authenticated recipients.
- Accepting an invite must still re-check room state and active caps.
- Invites are not the source of live presence. Worker room state is.

### Devices And Push Tokens

Extend the existing `devices` table rather than inventing a second device model:

```sql
alter table devices add column push_provider text;
alter table devices add column push_token text;
alter table devices add column push_token_updated_at timestamptz;
alter table devices add column notifications_enabled boolean not null default false;
alter table devices add column revoked_at timestamptz;
alter table devices add column last_delivery_error text;
```

Rules:

- One user can have multiple extension devices.
- Store token timestamps and prune stale tokens.
- Mark tokens revoked when FCM/Chrome returns permanent delivery errors.
- Push payloads should contain only ids and small display snippets. The
  extension fetches invite details after the user clicks.

### Watch History And Tracking

Production history should follow the existing shared progress tracker direction:
persist checkpoints, not live playback ticks.

Suggested MVP tables:

```sql
watch_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id text references rooms(room_id) on delete set null,
  host_user_id uuid references users(id) on delete set null,
  provider text not null,
  source_url text not null,
  item_id text,
  item_title text not null,
  episode_id text,
  episode_title text,
  duration_seconds integer,
  current_time_seconds integer not null default 0,
  progress numeric,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now()
)

watch_session_participants (
  session_id uuid not null references watch_sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('host', 'viewer')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (session_id, user_id)
)

user_tracked_titles (
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  title_key text not null,
  item_title text not null,
  active boolean not null default true,
  archived_reason text,
  last_watched_at timestamptz not null default now(),
  primary key (user_id, provider, title_key)
)
```

Rules:

- Checkpoints should be written on room created, joined/left, source changed,
  pause/end/pagehide, every 15-30 seconds while watching, and final room close.
- `maxActiveTrackedTitles` counts active rows only.
- Over-limit titles are archived, not deleted.
- Personal history visibility follows the viewer's own plan.
- Shared session retention follows each viewer's personal visibility when shown
  in their UI. A paid host does not grant everyone paid personal history.

## API Surface

Use server APIs in `apps/web`; do not let the extension talk directly to
Supabase tables.

### Billing

- `POST /api/create-checkout-session`
  - Auth required.
  - Accepts `planCode: "plus" | "pro"`.
  - Creates or reuses Stripe customer.
  - Stores metadata.
- `POST /api/stripe/webhook`
  - Verifies signature.
  - Processes subscription/entitlement events idempotently.
  - Updates `subscriptions` and denormalized `users.plan`.
- `GET /api/me/entitlements`
  - Returns safe plan and capability summary for UI.

### Profile

- `GET /api/me`
  - Keep existing behavior, add profile fields as needed.
- `PATCH /api/me/profile`
  - Update display name, handle, avatar if supported.

### Friends And Recent People

- `GET /api/friends`
- `POST /api/friends/requests`
- `POST /api/friends/requests/:id/accept`
- `POST /api/friends/requests/:id/decline`
- `DELETE /api/friends/:userId`
- `POST /api/users/:userId/block`
- `GET /api/recent-people`
- `POST /api/recent-people/:userId/hide`
- `POST /api/friends/invite-links`
- `POST /api/friends/invite-links/:token/accept`

Friend request creation must rate-limit spam and reject blocked pairs.
Friend request creation should target a known user selected from recent
co-watchers or another trusted internal list. Do not expose manual code,
handle, or UUID lookup as the primary MVP UX.

### Groups

- `GET /api/groups`
- `POST /api/groups`
- `PATCH /api/groups/:groupId`
- `DELETE /api/groups/:groupId` or archive
- `POST /api/groups/:groupId/members`
- `DELETE /api/groups/:groupId/members/:userId`

Group creation must enforce `maxOwnedGroups`.

### Rooms And Invites

- `POST /api/rooms`
  - Creates a durable room.
  - Computes `RoomCapabilities` from host entitlements.
  - Persists plan/capability snapshot on `rooms`.
  - Returns room id, room token, invite link, quota summary, and capabilities.
- `POST /api/rooms/:roomId/connect`
  - Re-checks membership and issues a short-lived room token.
  - Returns current capabilities.
- `POST /api/watch-invites`
  - Creates link/direct/group/recent invites.
  - Enforces host push-invite entitlement.
  - Creates recipient rows.
  - Enqueues push delivery for eligible devices.
- `GET /api/watch-invites/inbox`
  - Source of truth for pending invites.
- `POST /api/watch-invites/:inviteId/accept`
- `POST /api/watch-invites/:inviteId/decline`

### Devices

- `POST /api/devices/push-token`
  - Extension registers or refreshes a Chrome GCM registration token.
  - Requires extension access token.
  - Updates `last_seen_at` and token timestamp.
- `DELETE /api/devices/:deviceId/push-token`
  - Disable notifications for a device.

### Watch History

- `GET /api/watch-history`
- `GET /api/watch-library`
  - Returns provider/title/episode/session rollups for the account dashboard and
    extension popup cache.
- `POST /api/watch-progress/reconcile`
  - Accepts local extension checkpoint candidates after login and merges them
    without overwriting newer server state.
- `POST /api/watch-sessions/:sessionId/checkpoint`
- `POST /api/rooms/from-watch-session`
  - Creates a room with the saved source metadata and selected participants.

### Dashboard Aggregates

- `GET /api/account/summary`
  - Returns the small account dashboard summary: plan, limits, pending invites,
    pending friend requests, active groups, tracked-title usage, and device
    notification status.
- Dashboard routes should call existing specific APIs for mutations instead of
  inventing parallel write paths.

## Protocol And Worker Changes

Add a shared room capability contract before changing Worker and extension
behavior:

```ts
type RoomCapabilities = {
  hostUserId: string;
  hostPlan: "free" | "plus" | "pro";
  maxParticipants: number;
  maxMediaSeats: number;
  canUseMedia: boolean;
  canNameRoom: boolean;
  canSendPushInvites: boolean;
  roomCreatedAt: number;
};
```

Protocol changes:

- Add `RoomCapabilitiesSchema` to `packages/protocol`.
- Include `capabilities` in `ROOM_SNAPSHOT`.
- Add explicit error codes:
  - `ROOM_FULL`
  - `MEDIA_DISABLED`
  - `MEDIA_SEATS_FULL`
  - `INVITE_EXPIRED`
  - `INVITE_BLOCKED`
  - `PLAN_LIMIT_REACHED`
- Add tests for schema compatibility.

Worker changes:

- Replace hardcoded `MAX_ROOM_PARTICIPANTS = 4` with per-room capabilities.
- Keep reconnecting existing participants admitted even when the room is at cap.
- Enforce total participant cap on new distinct users.
- Enforce media seat cap on `CAMERA_ON` or future `MEDIA_JOIN`.
- If `maxMediaSeats = 0`, reject media with `MEDIA_DISABLED`.
- If media seats are full, reject with `MEDIA_SEATS_FULL`.
- P2P media negotiation must only happen among active media participants.
- Chat-only participants must not join the media mesh.
- Chat, reactions, playback sync, presence, and invite acceptance still work for
  all admitted participants.

Cloudflare WebSocket Hibernation remains part of the room/P2P hardening plan.
This social plan should not fork that work. It only depends on hibernation-safe
room state once the room plan reaches that block.

## Extension UX

### Popup Navigation

The extension popup should evolve from a resources-only view into a compact
watch control hub:

```txt
Resources | Friends | Groups | Inbox
```

Rules:

- `Resources` remains the default because opening the popup during watching
  should show current progress first.
- `Friends` shows accepted friends, pending requests, and recent co-watchers
  with small actions.
- `Groups` shows personal groups and lightweight create/edit flows.
- `Inbox` shows durable invites, not push-only messages.
- Every tab should have a web-dashboard escape hatch for full management.
- Keep row actions compact; use icons/tooltips in the popup and fuller labels
  in the web dashboard.

### Main Invite Surface

In the extension room menu, the host should be able to choose:

- copy invite link;
- invite individual friends;
- invite recent co-watchers;
- invite a saved group;
- continue from a saved session marker.

Recommended layout:

```txt
Invite
  Friends
  Groups
  Recent
  Link
```

From the popup resource list, an episode/session marker can open:

```txt
Continue
  Same people
  Pick friends
  Pick group
  Copy link
```

The UI must show room capacity clearly:

- `Participants: 4/6`
- `Media seats: 2/4`
- `Chat-only seats available`

For Pro:

- show `15 total, 4 media seats`;
- do not imply all 15 participants can use video or voice.

### Friend And Group Actions

From recent co-watchers:

- invite again;
- add friend;
- hide from recent;
- block if abuse handling exists.

From friends:

- invite;
- add to group;
- remove friend.

From groups:

- invite group;
- edit group membership;
- create group if under plan limit.

### Plan-Limit States

The extension should explain limits through actions, not long text:

- Free host time exhausted: show reset time and upgrade action.
- Room full: show current cap and ask host to upgrade or create a smaller room.
- Media seats full: show that chat/sync is still available.
- Group limit reached: ask user to archive a group or upgrade.
- Tracked title limit reached: archive an older active title or upgrade.

### Notification Permission

Do not add `gcm` and `notifications` to store builds until push invites are
actually implemented and the Chrome Web Store listing/privacy policy are updated.

When the permission lands:

- explain it as friend/group watch invite notifications;
- keep host permissions narrow;
- keep notification payloads minimal;
- provide a setting to disable notifications per device.

## Web Account Dashboard UX

The website should provide the same product domains as the extension, but with
room for editing and review.

### Dashboard Shell

Recommended information architecture:

```txt
Overview
Watch Library
Friends
Groups
Invites
Devices
Billing
Settings
```

Rules:

- Move the staging `/friends` surface into this shell before production
  promotion.
- Keep the dashboard behind account auth and `noindex`.
- Do not mix the dashboard with SEO landing pages or public anime pages.
- Use the same server APIs as the extension; do not build a separate dashboard
  data model.

### Watch Library

The dashboard watch library should mirror the popup resource hierarchy with more
space and editing:

```txt
Provider -> Title -> Episode/Movie -> Sessions
```

Each row can show:

- personal progress;
- shared sessions and participants;
- last watched date;
- source provider;
- active/archived tracked-title state;
- continue/create room action;
- invite same people/group action;
- archive or restore action where allowed by plan.

### Friends And Groups

The web dashboard owns the full friend and group management UX:

- profile display fields and optional handle;
- copy profile/friend invite link;
- add friend from recent co-watchers;
- accept friend invite links;
- incoming and outgoing requests;
- accepted friends;
- recent co-watchers;
- hidden recent people;
- blocked users;
- group create/rename/archive;
- group membership editing;
- plan-limit state for Free/Plus/Pro groups.

### Devices And Notifications

The dashboard should show extension installs/devices after push registration:

- device label where available;
- last seen;
- notification enabled/disabled;
- revoke push token;
- delivery error state;
- explanation of why notifications exist.

## Push And Invite Delivery

Use push as a delivery channel, not as the source of truth.

Source of truth:

```txt
watch_invites + watch_invite_recipients
```

Delivery channels:

- extension inbox fetch;
- Chrome GCM push;
- future in-app realtime channel if needed.

Rules:

- Every push invite must have a durable invite row first.
- Push payload contains `inviteId`, `roomId`, sender display name, and small
  source title text if safe.
- Extension fetches full invite details after click.
- Use targeted registration tokens, not public topics.
- Set push TTL to match invite expiry. Do not rely on FCM's default multi-week
  storage for live watch invites.
- Expired invites should disappear from inbox and click-through should show a
  clean expired state.
- Store token timestamps and prune stale/revoked tokens.

Suggested TTLs:

- live "watch now" invite: 30-60 minutes;
- scheduled/resume invite: product decision later, likely several hours;
- do not use 4-week default for room invites.

## Watch History And Continue Together

The history feature should answer:

- what did I watch;
- who did I watch it with;
- where can we continue together.

Rules:

- Durable history stores source metadata and meaningful progress checkpoints.
- The extension can cache local provider progress for instant popup opening.
- Backend history should merge room checkpoints into session summaries.
- Shared progress is social-room metadata, not video content.
- Replace demo shared-session markers in the popup only when backend session
  rollups are available. Until then, demo markers must stay clearly isolated
  from production data paths.
- The web dashboard and extension popup should consume the same watch-library
  rollup API so they cannot drift.
- When creating a room from history, the host can select:
  - same group/session participants;
  - individual friends;
  - a saved group;
  - invite link only.

Personal retention:

- Free sees 7 days.
- Plus sees 3 months.
- Pro sees 12 months.

Downgrades:

- Do not delete old history immediately because a user downgraded.
- Hide or archive beyond the visible retention.
- Keep enough aggregate/server-side data for abuse, billing audit, and product
  safety where allowed by privacy policy.

## Privacy, Security, And Abuse Controls

### Chrome Web Store

This product handles login, profile data, source URLs, watch progress, friends,
and invite metadata. That means:

- privacy policy must describe collected data and why;
- data must move over HTTPS/WSS;
- extension permissions must stay narrow;
- new `gcm` and `notifications` permissions need a clear user-facing reason;
- watch activity data must be used only for Anidachi user-facing features, not
  ads or unrelated monetization.

### Supabase

- Enable RLS on every new table.
- Keep service-role access server-side only.
- Add indexes used by every friendship/group/invite/history query.
- Avoid relying on RLS policies as query filters; add explicit filters in code.
- If Supabase Realtime is introduced for inbox updates, use private channels and
  RLS policies. It is optional and not a replacement for push.

### Abuse Controls

Add gentle controls from the start:

- rate-limit friend requests;
- rate-limit group/direct invite sends;
- block prevents invite and friend-request delivery;
- hide recent people;
- cap message length;
- no public user directory in MVP;
- no global people search until privacy settings exist.

Reuse the anti-farming decisions from the P2P plan for Free host-minutes. Do not
add raw IP storage.

## Edge Cases

### Free Guest In Paid Room

- Guest can join under host room limits.
- Guest does not burn personal Free host quota.
- Guest does not receive paid personal limits.
- Guest can use media only if the host room has a free media seat.

### Paid Guest In Free Room

- Room remains Free because host is Free.
- Total cap remains 4.
- Media remains disabled for that room.
- Paid guest can create their own paid room separately.

### Subscription Changes Mid-Room

MVP rule:

- Room capabilities are snapshotted when the room is created.
- Upgrade/downgrade affects new rooms.
- Existing room is not abruptly downgraded mid-session.
- Fraud/admin revocation can force a room end through an internal endpoint.

If upgrade-in-place becomes important, add a separate protocol event and Worker
capability refresh. Do not hack it through extension state.

### Group Changed After Invite

- Existing invite recipient rows do not change.
- New group membership affects future invites only.

### Friend Removed After Invite

- Pending invite can still be declined/expired.
- Opening the invite should re-check block/removal if the relationship is
  required for that invite type.
- Link invites remain link-based unless blocked user rules apply.

### Blocked User

- Cannot send direct invite.
- Cannot send friend request.
- Is excluded from group invite snapshots.
- Should not appear in recent people except possibly hidden historical records.

### Multi-Device User

- One user can receive push on multiple extension installs.
- Accepting invite on one device should mark the invite accepted for that user.
- Other devices should show updated inbox state on next fetch.

### Push Delivered Late

- Notification click fetches invite by id.
- If expired, show expired state and do not join.

### Room Token TTL

Current room tokens are short-lived. Treat token TTL as auth/connect lifetime,
not room lifetime.

Free quota metering should move toward the Durable Object precise metering in
the room/P2P hardening plan. Do not depend on token expiry as the final quota
system.

### Tracked Title Limit

- Limit active tracked titles, not all historical data.
- New watch progress can archive the least-recent active title or ask the user
  to archive one. Pick one behavior in the implementation PR and test it.
- Archived titles can be restored if under the limit or after upgrade.

### Local Progress Reconcile Conflict

- If extension local progress is newer than server progress, create a checkpoint
  candidate and let the server merge it.
- If server progress is newer, keep server progress and update the local cache.
- If the provider URL changed but title/episode keys match, keep both source
  URLs until the provider adapter can confidently normalize them.
- Never let a stale local popup cache remove friends, groups, invites, tracked
  titles, or server sessions.

### Dashboard And Popup Drift

- The dashboard and popup must use the same read-model APIs for watch library,
  friends, groups, invites, and limits.
- If one surface cannot support a mutation cleanly, it should deep-link to the
  other surface rather than adding a second mutation path.
- Any dashboard-only action must still update extension cache on next refresh.

### Side Panel Decision

- Do not add the `sidePanel` permission for MVP unless the user explicitly
  approves it after seeing the popup/dashboard design.
- If side panel is added, it must reuse the popup data layer and dashboard
  APIs. It must not become a third product model.

## Rollout Order

### Phase 0 - Contract And Plan

- [x] Create this plan.
- [x] Update pricing doc to reflect Pro 15 total participants and 4 media seats.
- [ ] Decide whether Free gets any one-time video preview. Default: no preview
  in MVP.

### Phase 1 - Billing Entitlements Foundation

- [x] Add billing tables and idempotent Stripe event storage.
- [x] Replace legacy checkout tier names with Plus/Pro plan codes.
- [x] Store Stripe customer id per user.
- [x] Update Stripe webhook to sync subscription state and `users.plan`.
- [x] Add server-side `PlanEntitlements` helper and tests.
- [x] Add `/api/me/entitlements`.

Acceptance:

- Paid checkout changes plan after webhook.
- Cancel/delete subscription downgrades to Free.
- Webhook retries are idempotent.
- Extension UI can fetch safe entitlement summary.

### Phase 2 - Profiles, Friends, And Recent People

- [x] Add profile table or profile fields.
- [x] Add friendship migration and constraints.
- [x] Add friend request APIs.
- [x] Add recent co-watcher read model from watch sessions or room members.
- [x] Add block/hide mechanics.

Acceptance:

- Users can send, accept, decline, remove, and block.
- One-off link viewing does not auto-friend users.
- Recent people excludes blocked/hidden users.

### Phase 3 - Personal Groups

- [x] Add group tables.
- [x] Add group CRUD APIs.
- [x] Enforce owner plan group limit.
- [x] Only accepted friends can be group members.
- [x] Archive over-limit groups on downgrade.

Acceptance:

- Free can own 1 group, Plus 5, Pro 15.
- Non-friends cannot be added.
- Removed/blocked friends cannot be targeted through group invites.

### Phase 4 - Room Capabilities And Media Seats

- [x] Add `RoomCapabilities` to `packages/protocol`.
- [x] Persist room capability snapshot on `rooms`.
- [x] Include capabilities in room tokens and snapshots.
- [x] Replace Worker hardcoded cap with per-room `maxParticipants`.
- [x] Add server-enforced `maxMediaSeats`.
- [x] Restrict WebRTC media mesh to media participants.
- [x] Update extension room UI for participant/media seat counts.

Acceptance:

- Free host: 4 total, 0 media.
- Plus host: 6 total, 4 media.
- Pro host: 15 total, 4 media.
- 5th media participant in Plus/Pro gets `MEDIA_SEATS_FULL`.
- Chat-only participants do not create P2P media connections.

### Phase 4.5 - Product Surface Reframe

- [x] Replace standalone `/friends` direction with an authenticated account
  dashboard shell.
- [x] Move or prepare `/friends` to become `/account/friends`.
- [~] Add account dashboard navigation for Watch Library, Friends, Groups,
  Invites, Devices, Billing, and Settings. Initial real navigation exists for
  Overview and Friends & Groups; unimplemented sections must not be exposed as
  dead links.
- [x] Add extension popup navigation for Resources, Friends, Groups, and Inbox.
  Resources, Friends & Groups, and durable Inbox are wired without adding push
  permissions.
- [x] Keep Resources as the popup default.
- [x] Add a shared client/read-model layer so popup and dashboard consume the
  same account/social/watch-library data. Social uses the existing web APIs and
  extension bridge; watch library now uses `/api/watch-library` plus local
  progress reconciliation.
- [x] Add human-friendly friend add flow using recent co-watchers and friend
  invite links, without manual codes.
- [x] Add dashboard escape hatches from compact popup flows.
- [x] Decide explicitly whether side panel is out of MVP or approved for MVP.
  Default: out of MVP.

Acceptance:

- A user can understand where to manage friends/groups/history without seeing
  raw UUIDs.
- Popup handles fast invite/continue actions.
- Dashboard handles full editing and review.
- No separate product logic exists for popup vs dashboard.

### Phase 5 - Invites, Inbox, And Push Delivery

- [x] Add invite and invite recipient tables.
- [x] Add invite create/list/accept/decline APIs.
- [x] Add extension friend/group invite send panel backed by durable inbox.
- [x] Add durable inbox list to the extension popup.
- [x] Add durable invites section to the web dashboard.
- [ ] Add device push-token registration.
- [ ] Add Chrome GCM sender configuration.
- [ ] Add extension notification/inbox handlers.
- [ ] Update extension permissions and Chrome Web Store privacy/listing copy
  only when the feature is ready.

Acceptance:

- Direct friend invite creates inbox row.
- Group invite snapshots recipients.
- Dashboard and popup both show pending invites from the same backend rows.
- Push notification click fetches invite and joins if valid.
- Expired push cannot join.
- Free receives paid host invites.

### Phase 6 - Watch Library, History, And Continue Together

- [x] Add watch session/progress/tracked-title tables.
- [x] Add `/api/watch-library` rollup for dashboard and extension popup.
- [x] Add local extension progress reconciliation API.
- [x] Replace demo shared sessions in extension popup with backend-backed data
  from the watch-library rollup.
- [x] Add web dashboard Watch Library with provider/title/episode/session
  hierarchy.
- [x] Persist checkpoints at agreed cadence.
- [x] Add create-room-from-session API.
- [x] Enforce active tracked-title limits.
- [x] Apply personal retention windows.

Acceptance:

- Continue together works from a shared session marker.
- Progress persists after room end.
- Dashboard and popup show the same backend-backed watch sessions after sync.
- Free sees 7 days, Plus 3 months, Pro 12 months.
- Over-limit tracked titles archive instead of deleting history.

### Phase 7 - Staging Acceptance

- [ ] Run `pnpm dev:check -- --profile rooms`.
- [ ] Run relevant web/API/extension tests.
- [ ] Run room harness for room/protocol/Worker changes.
- [ ] Build and validate staging extension if extension behavior changed.
- [ ] Test staging with at least two real browser profiles:
  - Free host + Free guest.
  - Plus host + Free guests.
  - Pro host with >6 participants simulated at protocol/harness level.
  - media seat full.
  - group invite.
  - direct push invite.
  - continue from history.
- [ ] Record results in this plan's progress log or PR description.

## Required Tests

### Unit Tests

- `PlanEntitlements` matrix.
- Stripe status -> plan resolution.
- Stripe webhook idempotency.
- Friendship unordered-pair uniqueness.
- Blocked user restrictions.
- Group ownership limit.
- Group member must be accepted friend.
- Invite recipient snapshot.
- Active tracked title limit.
- Personal retention window.
- Friend invite token validation, hashing, expiry, and one-time acceptance.
- Local progress reconciliation conflict resolution.
- Worker total participant cap.
- Worker media seat cap.

### API Tests

- Auth required for social APIs.
- No direct Supabase client access.
- Free/Plus/Pro room creation returns correct capabilities.
- Checkout session requires auth and stores metadata.
- Webhook updates `users.plan`.
- Direct and group invite flows.
- Expired invite flow.
- Friend request from recent co-watchers.
- Friend invite link sign-in return and accept flow.
- `/api/watch-library` returns the same durable rollup used by popup and
  dashboard.
- `/api/watch-progress/reconcile` cannot overwrite newer server progress with
  stale local progress.
- `/api/account/summary` reflects plan limits, pending invites, and social
  counts without leaking private email addresses.

### Extension Tests

- Popup top-level navigation: Resources, Friends, Groups, Inbox.
- Invite tabs render from API state.
- Friend/group/recent selection.
- Participant/media counters.
- Room full and media seats full messages.
- Push token registration.
- Notification click fetches invite before joining.
- Local cache fallback for history popup.
- Logout clears account-bound social cache but keeps device-local provider
  progress where appropriate.

### Web Dashboard Tests

- Account dashboard requires auth and stays noindex.
- Friends page does not expose raw UUID as the primary add-friend flow.
- Dashboard friends/groups/invites use the same API responses as the popup.
- Watch Library renders provider/title/episode/session hierarchy.
- Dashboard archive/restore actions respect plan limits and update the next
  popup refresh.

### Harness/Staging Tests

- 4 Free participants allowed, 5th rejected.
- Plus allows 6 total but only 4 media seats.
- Pro allows 15 total but only 4 media seats.
- Chat-only participant does not receive or create WebRTC media.
- Paid host can invite Free users.
- Paid guest does not upgrade a Free host room.
- Free host quota remains host-based.
- Room token refresh does not end paid rooms.
- Popup invite inbox and web dashboard invite list agree after refresh.
- Continue from history creates a room from a real saved session, not demo data.

## Done Means

- Billing state is trustworthy and tested before it controls room limits.
- Social graph is explicit and privacy-safe.
- Groups are simple personal lists, not hidden communities.
- Host plan room limits and user personal limits are enforced server-side.
- Worker enforces both total participant cap and media-seat cap.
- Extension UI reflects limits but never becomes the authority.
- Extension popup is the fast watch-control surface; web account dashboard is
  the full management surface.
- The current `/friends` staging page has either moved into the dashboard or
  been replaced by the dashboard social section.
- Push invites work through a durable inbox, not push-only delivery.
- Watch history stores durable social checkpoints, not raw video or every tick.
- Popup shared-progress markers are backend-backed before being treated as a
  production feature.
- Chrome Web Store permissions and privacy copy match actual behavior.
- Staging acceptance covers Free, Plus, Pro, direct invite, group invite, and
  continue-together paths before production promotion.

## Progress Log

- [x] 2026-06-21: Started auth persistence hardening on
  `codex/auth-session-refresh-hardening` after staging testing showed website
  and extension sessions could appear signed out after the 15-minute access
  token window. Website access tokens remain short-lived, but refresh cookies
  now use a 90-day sliding window and normal page navigation with a refresh
  cookie silently goes through `/api/auth/refresh` before returning to the
  original page. Extension refresh responses can carry an updated refresh token,
  and the long-lived overlay refreshes identity before watch-progress reconcile,
  invite actions, and room end actions instead of reusing a stale access token.
  Focused verification passed:
  `pnpm --filter @anidachi/web test`,
  `pnpm --filter @anidachi/web check`,
  `pnpm --filter @anidachi/extension test`, and
  `pnpm --filter @anidachi/extension check`. Full verification also passed:
  `pnpm dev:check`, `pnpm check`, `pnpm test`,
  `pnpm build:extension:staging`, and `pnpm validate:extension:staging`.
  Final post-commit staging zip remains in progress so the artifact build id
  matches the committed SHA.
- [x] 2026-06-21: Fixed the first staging acceptance watch-library bug on
  `codex/watch-library-room-participants`: room-backed watch progress now
  expands `watch_session_participants` from the durable room host plus
  `room_members`, so a host or guest checkpoint records the shared session for
  everyone in the room instead of only the browser that sent the checkpoint.
  The same reconcile also updates tracked titles for all room participants.
  Extension progress extraction now records YouTube pages as movie progress in
  addition to the existing Crunchyroll episode/movie parser. Verified with
  `pnpm check`, `pnpm test`, `pnpm harness:rooms`,
  `pnpm build:extension:staging`, and `pnpm validate:extension:staging`.
- [x] 2026-06-21: Phase 6 watch library/history slice implemented on
  `codex/watch-library-phase6`. Added Supabase tables for `watch_sessions`,
  `watch_session_participants`, `watch_progress_checkpoints`, and
  `user_tracked_titles` with RLS enabled and FK/index coverage. Added
  `/api/watch-library`, `/api/watch-progress/reconcile`, and
  `/api/watch-library/rooms`; the room-from-session path reuses server-side
  host quota/capability checks. The extension now has a watch-library HTTP
  bridge, popup reconciliation from local progress cache, backend-backed shared
  progress markers instead of demo sessions, and low-frequency overlay
  checkpoint reconciliation (periodic plus pause/seek/ended/pagehide). Added
  `/account/watch-library` with provider/title/episode/session hierarchy and
  create-room actions. Verified focused web/extension checks and tests; staging
  migration application and staging extension artifact validation remain in the
  release checklist.
- [x] 2026-06-21: Phase 5 durable in-app inbox slice implemented on
  `codex/social-inbox-phase5`. Extended the extension social bridge with
  invite inbox list, accept, and decline commands; added an Inbox tab to the
  popup that reads `/api/invites` through the existing authenticated bridge;
  accepting an invite opens the room join URL, while declining refreshes the
  same durable inbox. Added `/account/invites` to the account dashboard with
  incoming and sent invite views backed by the same `/api/invites` rows, and
  added the section to account navigation. Chrome push/GCM, push-token
  registration, notification handlers, and Web Store permission copy remain
  intentionally deferred until the product is ready to request those
  permissions.
- [x] 2026-06-21: Phase 4.5 first implementation slice completed on
  `codex/social-dashboard-phase45`. Added authenticated `/account` dashboard
  shell, moved Friends & Groups to `/account/friends`, changed legacy
  `/friends` into a redirect, changed default post-login OAuth fallback to
  `/account`, and updated nav links. Added extension popup tabs with Resources
  as default plus a Friends & Groups read-only panel backed by the existing
  extension social bridge and dashboard escape hatch. OAuth profile sync now
  preserves already customized AniDachi profile fields. Verified with
  `pnpm --filter @anidachi/web check`,
  `pnpm --filter @anidachi/web test`,
  `pnpm --filter @anidachi/extension check`, and
  `pnpm --filter @anidachi/extension test`. Remaining: add durable inbox UI
  and replace demo watch-progress sessions with the Phase 6 backend rollup.
- [x] 2026-06-21: Reworked friend-add direction after product review. Removed
  code-based adding from the profile model and UI, added short-lived one-time friend
  invite links, added `/friend/invite/:token` with OAuth return support, and
  changed dashboard friend-add to recent co-watchers instead of manual code,
  handle, or UUID entry.
- [x] 2026-06-21: Applied remote Supabase migration
  `20260625_friend_invite_links.sql` to linked project `cyppqpprkygjloyfvvvj`
  with `supabase db push --linked --yes`. Verified local/remote migration
  history aligned through `20260625`, `friend_invite_links` exists with RLS
  enabled, token hash uniqueness, sender/accepted indexes, foreign keys, check
  constraints, and `supabase db advisors --linked --level error --fail-on error`
  reported no issues.
- [x] 2026-06-21: Product surface reframe added after reviewing the extension
  popup/resource tracker, current staging `/friends` page, Graphify social
  surface queries, and current official docs for Chrome Side Panel, Chrome GCM,
  Chrome notifications, FCM token/TTL behavior, Supabase RLS/Realtime, and
  Stripe subscription webhooks. The plan now treats the extension popup as the
  fast watch-control surface and the web account dashboard as the full
  management surface. Added account dashboard IA, popup navigation, shared
  sync/read-model rules, friend invite/recent co-watcher UX requirement,
  watch-library API,
  local progress reconciliation, Phase 4.5 product surface reframe, and tests
  for dashboard/popup drift.
- [x] 2026-06-20: Plan created after reviewing current project docs, room/auth
  code, existing migrations, Graphify query output, and official docs for
  Stripe, Supabase, Chrome extension push/notifications, Firebase Cloud
  Messaging, Chrome Web Store privacy, and Cloudflare Durable Objects
  Hibernation.
- [x] 2026-06-20: `docs/social-pricing-model.md` aligned with the approved Pro
  limit: 15 total participants, still 4 media seats in MVP.
- [x] 2026-06-20: Phase 1 billing entitlement code implemented on
  `codex/social-rooms-subscriptions-phase1`: Supabase migration for
  `billing_customers`, `subscriptions`, and `stripe_events`; server-side plan
  entitlement matrix; Stripe checkout auth/customer/metadata flow; webhook
  subscription mirror with idempotent event storage and `users.plan`
  recomputation; `/api/me/entitlements`; webhook registration events updated.
  Unauthenticated checkout now returns a login URL, and existing pricing CTAs
  redirect there instead of dead-ending on an error.
  Verified with `pnpm --filter @anidachi/web test` and
  `pnpm --filter @anidachi/web check`. Remaining before acceptance: apply the
  migration to staging and run a real Stripe webhook/checkout smoke.
- [x] 2026-06-20: Room-profile verification for Phase 1 completed:
  `pnpm dev:check`, `pnpm --filter @anidachi/api check`,
  `pnpm --filter @anidachi/api test`, and `pnpm harness:rooms` all passed.
  Graphify AST graph updated with `pnpm graph:update`.
- [~] 2026-06-20: Remote Phase 1 acceptance checked but not completed.
  Supabase CLI is installed (`2.104.0`) but not authenticated
  (`SUPABASE_ACCESS_TOKEN` missing), Vercel CLI cannot retrieve the current
  project settings from local `.vercel`, and local preview env did not expose
  explicit `STRIPE_PRICE_ID_PLUS` / `STRIPE_PRICE_ID_PRO`. Code now requires
  explicit Stripe price env names (or legacy env names) instead of hardcoded
  live price fallbacks. Remaining: authenticate Supabase or provide a DB URL,
  add/check Vercel preview Stripe price envs, apply the billing migration, and
  run real checkout/webhook smoke on staging.
- [x] 2026-06-20: Stripe webhook idempotency tightened before deploy: events
  are inserted as received, marked `processed_at` only after successful
  handling, and keep `last_error` for failed attempts so Stripe retries can
  safely reprocess. Fresh local verification passed:
  `pnpm --filter @anidachi/web check`,
  `pnpm --filter @anidachi/web test`,
  `git diff --check`, `pnpm dev:check`,
  `pnpm --filter @anidachi/api check`,
  `pnpm --filter @anidachi/api test`, and `pnpm harness:rooms`.
- [x] 2026-06-20: Supabase remote access was restored via `supabase login`.
  Project `cyppqpprkygjloyfvvvj` was linked to `apps/web`. Remote migration
  history was empty even though the old schema was already present, so old
  applied migrations were repaired in history. The duplicate local migration
  version was fixed by renaming `20260602_room_invite_source.sql` to
  `20260603_room_invite_source.sql`; the matching schema was verified present
  and repaired as applied. `20260620_billing_entitlements.sql` was then applied
  through `supabase db push --linked`. Verification confirmed
  `billing_customers`, `subscriptions`, and `stripe_events` exist with RLS
  enabled, and local/remote migration history is aligned through `20260620`.
- [x] 2026-06-20: Staging gate now allows Stripe's signed POST webhook
  delivery to `/api/stripe/webhook` while keeping other staging API paths
  protected. The webhook route still verifies `stripe-signature` with
  `STRIPE_WEBHOOK_SECRET`.
- [~] 2026-06-20: Stripe staging setup intentionally deferred until Test Mode
  products/prices and the staging webhook secret exist. Development can continue
  by manually setting `users.plan` to `plus` or `pro` for staging test
  accounts when paid-plan behavior needs to be exercised before checkout is
  wired.
- [x] 2026-06-20: Phase 2 foundation implemented and migrated on Supabase:
  `profiles`, `friendships`, and `recent_people_hidden` with RLS enabled. Added
  server APIs for profile updates, friend list/request/accept/decline/remove,
  blocking, recent people, and hiding recent people. `/api/me` now returns a
  safe public profile in addition to the existing user payload. Staging gate
  bearer bypass was extended to the new social endpoints so the extension can
  call them on staging. Social endpoints validate UUID-shaped ids before
  hitting Supabase, so malformed input returns a clean client error instead of
  leaking a database syntax failure. Verified with
  `pnpm --filter @anidachi/web check`, `pnpm --filter @anidachi/web test`,
  `git diff --check`, `pnpm dev:check`, `pnpm --filter @anidachi/api check`,
  `pnpm --filter @anidachi/api test`, `pnpm harness:rooms`, and remote
  migration checks through `supabase migration list --linked`.
- [x] 2026-06-20: Phase 3 personal groups implemented and migrated on
  Supabase: `friend_groups` and `friend_group_members` with RLS enabled. Added
  server APIs for group list/create/update/archive and member add/remove.
  Group creation enforces host account entitlements (`Free=1`, `Plus=5`,
  `Pro=15`), members must be accepted friends, and over-limit groups are
  archived instead of deleted when the owner's plan no longer allows them.
  Remote verification confirmed local/remote migration history aligned through
  `20260622`, both group tables exist, and RLS is enabled on both tables.
- [x] 2026-06-20: Phase 3 verification passed:
  `pnpm --filter @anidachi/web check`,
  `pnpm --filter @anidachi/web test`,
  `pnpm --filter @anidachi/api check`,
  `pnpm --filter @anidachi/api test`, `git diff --check`,
  `pnpm dev:check`, `pnpm harness:rooms`, and `pnpm graph:update`.
- [x] 2026-06-20: Phase 4 server-side room capabilities implemented and
  migrated on Supabase with `20260623_room_capabilities.sql`. `rooms` now
  persist a host-plan capability snapshot, web room create/connect/join sign
  that snapshot into room tokens and return it in API responses, the Worker
  includes capabilities in `ROOM_SNAPSHOT`, enforces per-room
  `maxParticipants`, and enforces `maxMediaSeats` for `CAMERA_ON`. The
  extension bridge reads capabilities and suppresses P2P startup for rooms with
  `maxMediaSeats=0`. Remaining Phase 4 work: full client-side media-seat UX and
  P2P participant filtering for Plus/Pro rooms where only 4 of 6/15 users
  should enter the media mesh.
- [x] 2026-06-20: Phase 4 verification passed:
  `pnpm --filter @anidachi/protocol check`,
  `pnpm --filter @anidachi/protocol test`,
  `pnpm --filter @anidachi/api check`,
  `pnpm --filter @anidachi/api test`,
  `pnpm --filter @anidachi/web check`,
  `pnpm --filter @anidachi/web test`,
  `pnpm --filter @anidachi/extension check`,
  `pnpm --filter @anidachi/extension test`, `pnpm harness:rooms`,
  `pnpm dev:check`, `git diff --check`, `pnpm check`, and `pnpm test`.
  Remote Supabase verification confirmed local/remote migration history aligned
  through `20260623` and the new `rooms` capability columns exist.
- [x] 2026-06-20: Phase 4 client media-seat UX and Phase 5 durable invite
  foundation implemented on `codex/social-invites-media-seats`. Extension P2P
  now filters the media mesh to media participants instead of all room
  participants, drops incoming P2P signals from chat-only participants, shows
  participant/media-seat capacity in the overlay, disables local Ghost Cam when
  the room has no seats or all seats are occupied, and handles
  `MEDIA_SEATS_FULL` by rolling the UI back to chat/sync mode. Added
  `20260624_room_invites.sql`, durable `room_invites` and
  `room_invite_recipients`, invite create/list/accept/decline APIs, staging
  gate bearer bypasses for invite endpoints, and a compact extension panel for
  sending direct friend or personal group invites. Push/GCM delivery and
  notification click handling are still not implemented. Verified the focused
  slice with `pnpm --filter @anidachi/extension test`,
  `pnpm --filter @anidachi/extension check`, `pnpm --filter @anidachi/web test`,
  and `pnpm --filter @anidachi/web check`. Applied the remote Supabase migration
  with `supabase db push --linked`; `supabase migration list --linked` is aligned
  through `20260624`, and `supabase db query` confirmed `room_invites` and
  `room_invite_recipients` exist with RLS enabled.
