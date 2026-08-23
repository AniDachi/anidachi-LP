# Site, Extension, Auth, and Database Integration Notes

The June 2026 research below is retained as historical architecture context. It
is not a statement of the current implementation or remaining work; the
current operational authority is `docs/current-development-state.md`.

Research date: 2026-06-02
Website repo inspected: `https://github.com/George-Kreatli/anidachi-LP`
Inspected website commit: `942a8de Add new anime guides for group viewing in 2026`

## Current Integration Foundation — Staging Accepted 2026-08-22

The website, extension, Worker, and Supabase implementation now live in the
AniDachi monorepo. The core-foundation-to-UI/UX handoff is accepted on `staging`
through `3a442b7f76992a5e48b387740bf9cc31a565235e`. This means subsequent UI/UX
work can rely on the documented contracts below; it does not claim production
readiness, market readiness, `main` promotion, public release, or Chrome Web
Store readiness.

- Supabase/Postgres remains the only durable authority for accounts, Watch
  History, rooms, and invite metadata. The Worker Durable Object remains the
  live authority for room state, playback, and source generations; the
  extension owns browser-local observation, media, cache, and bounded outbox.
- Watch History title responses return no more than eight recent episode rows
  per title with exact counts and a continuation. The authenticated detail
  boundary returns at most 50 rows. The Popup remains local-first and does not
  eagerly download detail history. Migration
  `20260821162622_watch_history_v2_resource_bounds.sql` is applied on staging.
- YouTube and Crunchyroll room sources are canonical, provider-pinned, and
  monotonic. Generation 1 is persisted at creation; the Worker persists the
  newest accepted same-provider source asynchronously through the authenticated
  Web callback. Reload and late join use the durable descriptor. Migration
  `20260822033019_room_source_generation.sql` is applied on staging.
- Room-invite actionability derives from room lifecycle in the versioned v2
  inbox/action RPCs. Accept/decline has one atomic, idempotent transition;
  active-room invites do not expire solely because legacy `expires_at` passed,
  and an ended room reconciles once to `Missed` for 24 hours. The legacy field
  and functions remain for rollback. Migrations
  `20260822065227_room_invite_lifecycle_actions.sql` and
  `20260822091552_finalize_legacy_orphan_invite_rooms.sql` are applied on
  staging.
- Room-scoped ICE credentials require an `Authorization: Bearer` token. The
  browser WebSocket `roomToken` query is retained as a separate browser API
  exception; it is not an ICE-query fallback.

The accepted two-profile staging artifact evidence covers Watch History
convergence, canonical room source create/join/change/reload/late-join behavior,
and the invite host projection changing to `Accepted`. Two-network/TURN and
broader P2P/media acceptance, UI/UX design, billing, public forms, legal,
release/store, production, and new-provider work remain separate.

## Historical Research Snapshot: Website State

The website is not only a landing page. It already contains the beginning of a real
Anidachi account and room system.

Stack:

- Next.js 15 App Router
- React 19
- Tailwind CSS 4
- shadcn/ui style components
- Stripe Checkout
- Supabase Postgres
- Custom OAuth through Discord and Google
- `jose` for JWT signing and verification
- Vercel-oriented deployment

Important website files:

- `lib/anidachi-auth/db.ts`
- `lib/anidachi-auth/jwt.ts`
- `lib/anidachi-auth/session.ts`
- `lib/anidachi-auth/tokens.ts`
- `lib/anidachi-auth/handle-oauth-callback.ts`
- `app/api/auth/discord/route.ts`
- `app/api/auth/google/route.ts`
- `app/api/auth/callback/discord/route.ts`
- `app/api/auth/callback/google/route.ts`
- `app/api/auth/refresh/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/rooms/route.ts`
- `app/api/rooms/[roomId]/join/route.ts`
- `app/api/rooms/[roomId]/connect/route.ts`
- `app/room/[roomId]/page.tsx`
- `supabase/migrations/20260525_anidachi_auth.sql`

## Historical Research Snapshot: Website Auth Model

The website uses custom auth, not Supabase Auth.

Flow:

1. User signs in with Discord or Google.
2. Website validates OAuth state through the `anidachi_oauth_state` HttpOnly cookie.
3. Website upserts a row in `public.users`.
4. Website issues:
   - short-lived JWT access token, 15 minutes;
   - opaque refresh token, stored hashed in Supabase.
5. Tokens are stored as HttpOnly cookies:
   - `anidachi_access_token`
   - `anidachi_refresh_token`

Website sessions use a sliding refresh window. The access token remains short
lived, but an active browser with a valid refresh cookie is silently refreshed
through `/api/auth/refresh`; the refresh token expiry is extended on use. This
keeps users signed in during normal use without making the access token long
lived.

The website also already has a room token concept:

- `signRoomToken({ sub, roomId, role })`
- 30 minute JWT
- used by `/api/rooms/[roomId]/connect`

This is a good foundation for connecting the extension to real users.

## Historical Research Snapshot: Website Database

Existing migration creates:

- `users`
- `refresh_tokens`
- `rooms`
- `room_members`

The current schema is enough for early auth and simple rooms, but not enough for a
full extension-backed social product.

Needed future tables or schema extensions:

- `profiles`
- `devices`
- `friendships`
- `room_invites`
- extended `rooms`
- extended `room_members`
- `watch_sessions`
- `watch_progress`
- optional `reaction_events`

Important rule: live playback state must not be written to Postgres every second.
Live state belongs in Durable Objects. Postgres should store durable business data.

## Historical Research Snapshot: Extension/API State

The commercial implementation is auth-only.

The extension signs in through the website with `chrome.identity.launchWebAuthFlow`,
stores extension-scoped tokens in `chrome.storage.local`, and creates rooms through
the website API. Guest/local room creation is intentionally not supported in the
commercial path.

Current auth flow:

- `apps/web/app/extension/connect/page.tsx`
- `apps/web/app/api/extension/auth/exchange/route.ts`
- `apps/web/app/api/extension/auth/refresh/route.ts`
- `apps/web/app/api/extension/auth/website-session/route.ts`
- `apps/web/app/api/me/route.ts`
- `apps/extension/entrypoints/background.ts`
- `apps/extension/src/auth-client.ts`
- `apps/extension/src/user-identity.ts`

The extension session is independent after the one-time website exchange. Its
background service worker serializes refresh requests and keeps cached identity
during temporary failures. Website logout and account switching are reconciled
against the website refresh cookie through the dedicated website-session route;
the short-lived website access cookie is not used as a sign-out signal.

Current room flow:

- Extension calls `POST /api/rooms` on the website with an extension access token.
- Website stores durable room metadata in Supabase and returns `roomToken`.
- Extension opens Worker WebSocket with `?roomToken=...`.
- Worker verifies the room token and derives participant identity server-side.

The Worker no longer trusts client-provided `participant.id`, `displayName`,
`avatarUrl`, or role for authenticated rooms.

## Historical Research Snapshot: Main Integration Problem

The integration removes the previous split between website rooms and Worker-only
guest rooms.

The website should become the source of truth for:

- users;
- profiles;
- plans;
- friends;
- durable room metadata;
- invite landing pages.

The Worker should remain the source of truth for:

- realtime presence;
- WebSocket coordination;
- live playback state;
- reactions;
- transient camera/speaker state.

## Historical Research Snapshot: Recommended Target Architecture

```txt
apps/web
  Next.js site, auth, profile, billing, friend graph, invite landing

apps/extension
  WXT Chrome extension, overlay, adapters, Ghost Cam UI, reactions

apps/api
  Cloudflare Worker, Durable Objects, WebSocket realtime room engine,
  P2P signaling, room presence, and authenticated ICE/TURN access

Supabase Postgres
  durable user/profile/room/friend/session data
```

Recommended repo direction:

- Move or mirror the LP repo into the main Anidachi monorepo as `apps/web`.
- Convert the website from npm to pnpm.
- Keep shared room/auth/types in packages:
  - `packages/protocol`
  - future `packages/auth`
  - future `packages/db`

This avoids duplicate types, duplicate room logic, and duplicate user models.

## Historical Research Snapshot: Recommended Extension Login Flow

Do not try to read website HttpOnly cookies from the content script.

Preferred Chrome extension login:

1. Extension user clicks `Sign in`.
2. Extension generates a one-time state value and PKCE verifier, retains the
   verifier only for the active flow, and sends the S256 challenge.
3. Extension uses `chrome.identity.launchWebAuthFlow` to open
   `/extension/connect` with its exact ID and `/auth` redirect URI.
4. If website sign-in is needed, the server replaces the validated raw extension
   request with a ten-minute authenticated-encryption envelope derived from the
   existing server JWT secret. Browser OAuth persists and returns only the
   opaque envelope; tampered, expired, or wrong-purpose envelopes fail closed.
5. Website signs user in with Discord/Google if needed.
6. Website creates a short-lived one-time code bound to the exact client ID,
   redirect URI, state, authenticated user, and PKCE challenge.
7. Website redirects to the approved exact `chrome.identity.getRedirectURL("auth")`.
8. Extension receives the final redirect URL.
9. Extension validates the exact callback origin/path and state, then extracts
   the code.
10. Extension calls `/api/extension/auth/exchange` with the matching verifier;
   the server consumes the code atomically once.
11. Website returns extension-specific access and refresh tokens.
12. Extension stores tokens in `chrome.storage.local`.

Required website additions:

- `extension_auth_codes` table
- `/extension/connect`
- `/api/extension/auth/exchange`
- `/api/extension/auth/refresh`
- `/api/me`

Alternative: use `externally_connectable` so the site can message the extension.
This is useful for install detection and room handoff, but `launchWebAuthFlow` is
cleaner for auth.

## Historical Research Snapshot: Worker Changes Needed

The Worker must stop trusting client-provided identities.

Needed changes:

- Require `Authorization: Bearer <accessToken>` for website room creation.
- Require a room token for WebSocket connection.
- Verify JWTs in the Worker.
- Build the `Participant` server-side from the verified user.
- Never trust `participant.id`, `displayName`, or `avatarUrl` from the client.
- Require a valid room token before issuing ICE/TURN credentials.
- Link every Worker room to a Supabase `rooms.room_id`.

Current MVP path:

- Share `ANIDACHI_JWT_SECRET` with the Worker and verify HS256 tokens there.

Better production path:

- Move to asymmetric JWT signing, such as RS256 or EdDSA.
- Website signs tokens with a private key.
- Worker verifies with a public key or JWKS.
- This avoids sharing the signing secret with multiple services.

## Historical Research Snapshot: Website Changes Needed

Needed for product integration:

- Real account dashboard.
- Extension connect page.
- Extension token exchange endpoints.
- Friend list and friend request APIs.
- Room invite landing flow.
- Room membership management.
- Optional profile settings page.

The existing `/room/[roomId]` page is a useful start, but it should eventually:

- show the room host and metadata;
- require login;
- join the user to the room;
- hand off the room token to the extension;
- explain install/open-extension steps if the extension is missing.

## Historical Research Snapshot: Database Changes Needed

Recommended next migration:

```sql
create table public.profiles (...);
create table public.devices (...);
create table public.friendships (...);
create table public.room_invites (...);
alter table public.rooms add column source_url text;
alter table public.rooms add column provider text;
alter table public.rooms add column video_fingerprint text;
alter table public.rooms add column title text;
alter table public.rooms add column ended_at timestamptz;
alter table public.room_members add column role text;
alter table public.room_members add column left_at timestamptz;
create table public.watch_sessions (...);
create table public.watch_progress (...);
```

Security rules:

- Keep RLS enabled.
- Do not expose the Supabase service role key to the extension.
- Use server-side API routes or Worker endpoints for sensitive writes.
- Add explicit policies only when the browser must access data directly.

## Security Notes

Important:

- The extension must never contain Supabase service-role credentials.
- The extension must never contain TURN provider secrets, service-role
  credentials, or server-side signing secrets.
- Local and staging use separate repository-controlled public manifest keys and
  exact IDs. Only public key material is committed; production has no approved
  identity and web connection stays fail-closed until an explicit cutover.
- Never accept an arbitrary `*.chromiumapp.org` host. Each web environment
  accepts one exact ID and only its `/auth` and `/logout` callback paths.
- Room WebSocket joins must verify room membership.
- Extension auth codes must be one-time, short-lived, hashed at rest, and bound
  to client, redirect, state, and S256 PKCE challenge.
- Access tokens should stay short-lived.
- Refresh tokens should be rotatable and revocable per device.
- Session refresh should be transparent to the user. Access tokens stay
  short-lived; refresh tokens are long-lived, server-stored, and extended on
  active use.
- OAuth account linking by email is acceptable for MVP, but verified email checks
  must stay in place.

## Historical Research Snapshot: Phased Implementation Plan

Phase 1: make website auth real

- Deploy Supabase migration.
- Configure Discord/Google OAuth.
- Confirm user rows are created.
- Confirm website sessions work in production.

Phase 2: extension auth bridge

- Add extension auth code table.
- Add `/extension/connect`.
- Add token exchange/refresh endpoints.
- Add `chrome.identity.launchWebAuthFlow` in the extension.
- Use authenticated identity only; unauthenticated extension users cannot create or join rooms.

Phase 3: authenticated rooms

- Change website room creation to be the primary source.
- Remove Worker-only room creation in favor of website-created rooms.
- Add Worker JWT verification.
- Add room token verification for WebSocket connect.
- Make Durable Object derive participant identity from verified token.

Phase 4: Media transport protection

- Require a valid room token and room id on `/ice-servers`.
- Keep WebRTC P2P as the only active Ghost Cam / push-to-talk media path.
- Keep TURN credentials short-lived and generated server-side.

Phase 5: social product layer

- Add friend requests.
- Add friend picker in extension.
- Add room invite links.
- Add dashboard/recent rooms.
- Add persistent watch progress and shared progress history.

## Key Decision

The correct strategic direction is:

Do not build a separate extension database.
Use the website/Supabase account system as the canonical product database, and
connect the extension plus Worker to it through explicit auth tokens.

The extension remains the product experience. The website becomes identity,
billing, friends, invites, and durable room/profile management.
