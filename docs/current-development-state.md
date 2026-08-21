# Current Development State

Last updated: 2026-08-21.

This is the short operational source of truth for the current Anidachi setup.
Historical plans in `docs/superpowers/plans/` are useful context, but they can
contain old paths, old domains, or old decisions. When release channels,
endpoints, branch protection, or store workflow changes, update this document in
the same PR.

## Repository

Canonical GitHub repository:

```txt
AniDachi/anidachi-LP
```

Local clone placeholder used in docs:

```txt
<repo>
```

`<repo>` means the folder where a developer cloned `AniDachi/anidachi-LP` on
their own machine. Do not assume any specific absolute path. Older pre-monorepo
local folders are legacy context only and should not be used for new product
development.

## Branches And Protection

`staging` is the fast integration branch for tester builds.

- Required status check: `check-and-test`
- Additional non-required release workflow: `build-extension`
- Additional non-required deploy workflow: `deploy-api`
- Required approvals: `0`
- Strict up-to-date branch requirement: off
- Conversation resolution requirement: off
- CODEOWNERS review requirement: off; CODEOWNERS is advisory on this branch
- Force pushes: blocked
- Branch deletion: blocked
- Admin enforcement: on

`main` is the production branch.

- Required status check: `check-and-test`
- Additional non-required release workflow: `build-extension`
- Additional non-required deploy workflow: `deploy-api`
- Required approvals: `0`
- Dismiss stale approvals: on
- Strict up-to-date branch requirement: on
- Conversation resolution requirement: on
- CODEOWNERS review requirement: off; CODEOWNERS is advisory on this branch
- Repository auto-merge: enabled
- Force pushes: blocked
- Branch deletion: blocked
- Admin enforcement: on

Normal flow:

```txt
feature branch -> PR -> staging -> tester build -> PR/promotion -> main -> public build
```

Site-only auto-promotion:

- Pushes to `staging` run `Promote Site Staging to Main`.
- The workflow compares the full `main..staging` diff.
- If the diff contains only safe site/docs paths, it creates or updates a PR
  from `staging` to `main` and enables auto-merge.
- If the diff includes extension, API, workflow, package, auth, room, checkout,
  or other sensitive paths, promotion is skipped and must be handled manually.
- Workflow changes under `.github/**` are intentionally never auto-promoted; the
  auto-promotion workflow itself must be installed in `main` manually once.

## Development Quality System

Every contributor and AI worker should start from root `AGENTS.md`. It points to
the required docs, the active plan, the git flow, and the verification commands.
Plane-specific instructions now live in:

- `apps/web/AGENTS.md`
- `apps/api/AGENTS.md`
- `apps/extension/AGENTS.md`
- `packages/protocol/AGENTS.md`

Use `docs/development-quality-gates.md` as the central map from change type to
required checks, staging evidence, docs updates, Graphify updates, and PR notes.

Before opening a PR, run:

```bash
pnpm dev:check
```

This prints the focused check profile for the files changed against
`origin/staging`. High-risk profiles can also be inspected explicitly, for
example `pnpm dev:check -- --profile rooms` or
`pnpm dev:check -- --profile extension`.

Project-aware review is configured in `.coderabbit.yaml`. CodeRabbit is
advisory: it should catch Anidachi-specific risks, but it does not replace CI,
staging acceptance, or human/agent review. PRs should use the root
`.github/pull_request_template.md` and include verification, staging impact,
security/env impact, docs status, Graphify status, and rollback notes.

Local development and CI use the exact Node version from `.node-version`
(`22.23.1`) with pnpm `11.2.2` and `pnpm install --frozen-lockfile`.
`package.json` and `pnpm-workspace.yaml` enforce that toolchain. Do not churn
`pnpm-lock.yaml` unless dependency changes are intentional and reviewed.

Graphify is the project knowledge graph for agent orientation. Commit only the
team graph artifacts documented in `docs/project-knowledge-map.md`; keep local
cost files, HTML exports, scoped scratch graphs, and other generated outputs
ignored.

Graphify is now available through repo scripts:

```bash
pnpm graph:baseline
pnpm graph:update
pnpm graph:watch
pnpm graph:hook:install
pnpm graph:query "Trace room token flow from web to Worker WebSocket join."
```

Use it before cross-plane work, especially room/P2P/auth/Worker/CI changes. Do
not promote Graphify to a required CI check unless the team explicitly accepts
the runtime and backend requirements.

## Pre-release Security Readiness

Wave 1 of the active pre-release security plan is complete on `staging` at
merge `07dfaf4a8bd0c192e21fd381f4350ab88cdab322` (PRs `#192`-`#195`). The web
runtime uses Next.js `15.5.23`, the public media route accepts only exact public
media identifiers, and sensitive integration/CRM Blob paths now read, write,
and delete through the private store only. The temporary staging compatibility
flag has been removed; the retained public legacy objects are not a runtime
fallback and were not deleted or changed during cutover.

The live staging deployment is `dpl_B6dD3YJdGJrkBfkppQGsXH9PdaBL`. Both staging
aliases, CI, deployment smoke, noindex/no-store behavior, the bounded private
snapshot manifest, and the affected TikTok test-account health checks passed.
An unrelated internal YouTube publishing test credential requires manual
reconnection later; it does not affect product auth, rooms, Watch History, or
the extension.

Wave 2 Task 5 is deployed on `staging` at merge
`d330be47cb23ee58eeba3e0db18ec1f2f2e86e21` (PR `#197`). Browser Google and
Discord login now use random one-time state, an independent browser-correlation
secret, S256 PKCE, provider-bound atomic consumption, and transaction-scoped
cookie cleanup. Migration `20260818131602_oauth_login_transactions.sql` is
applied; the linked migration dry run is empty. Local web/pgTAP gates,
independent and CodeRabbit review, GitHub CI, migration deployment, rooms/P2P
E2E, Vercel deployment, and staging smoke passed.

Task 5's attended provider gate is accepted.
On 2026-08-20, real Google and real Discord consent/callback flows
succeeded on staging inside the enforced initial ten-minute OAuth transaction
window. Exact elapsed times and screenshots are not claimed. Task 6 now has
stable,
repository-controlled unpacked local and staging identities, exact per-channel
callback binding, S256 PKCE, atomic one-time exchange, and fail-closed
production. When extension connection needs website login, the validated
request crosses browser OAuth only inside a ten-minute authenticated-encryption
envelope derived from the existing server JWT secret; the durable OAuth row and
browser-visible login return path contain only that opaque envelope. The
approved local ID is `nkinhhgigcflmfhilmcakbkongcpkfnl`; the
approved staging ID is `ndkfphbchhfephdodcpehdcoclojagje`. This source work is
locally verified in PR `#199`. Its additive migration is already applied on
staging, the linked dry run is empty, and Vercel Preview branch `staging` has
the exact staging client ID. Task 6 is merged to `staging`; the exact merged
narrow artifact has now been loaded in both established staging test profiles;
the user confirmed both profiles successfully authorized and loaded it. That
two-profile confirmation is distinct from the one first-profile MV3-worker
proof: its exact `/auth` callback was state-matched, wrong verifier -> 401
`invalid_grant`, the same still-usable code with its correct verifier -> 200,
and consumed-code replay -> 401 `invalid_grant`. That worker also completed the
real `/extension/logout` flow: its exact callback had the approved Chromium
host, `/logout` path, matching state, `signed_out=1`, and exactly the expected
parameters. Separately, the issued test refresh token from the PKCE/replay proof
was revoked through the supported extension logout endpoint (200), and an
immediate refresh attempt was rejected (401 `Invalid refresh token`). All
code/state/verifier/access/refresh values stayed in process memory and were
cleared without being printed or persisted. This closes the Task 6 staging
connection, verifier, replay, browser-logout-callback, and issued-session-
revocation evidence. The rollout order remains additive migration first,
application second, then exact unpacked staging acceptance. Legacy rows survive
with null binding columns, but the new RPCs cannot consume them. If the new app
must be rolled back after bound issuance, stop issuance and drain for more than
five minutes (or remove only unconsumed bound rows) before restoring the old
exchange, which cannot enforce PKCE. Staging/public release scripts force their
canonical web/API/WS endpoints and narrow mode, and artifact validation rejects
any extra host permission or content-script match. Broad staging remains a
separate explicit local testing command and output path.

Task 7 reached staging through PR #201 and merge commit `13a30fa`. The additive
migration `20260819133849_auth_channel_rotation.sql` is applied to staging and
creates service-role-only website/extension refresh families and hash-only
consumed-token lineage; raw or encrypted refresh tokens are not stored. Access tokens require
exact scalar issuer/audience/type channel claims. Refresh rotation is atomic,
uses a ten-second concurrency-reuse interval, expires after 90 consecutive days
without refresh and after an immutable 365-day maximum, and revokes the active
family on any other known replay. The extension serializes sign-in, refresh
persistence, and invalid-session clearing so an old response cannot overwrite a
new account. Local database reset, 180 pgTAP assertions, web/extension suites and
checks, staging artifact build/validation, independent task review, scoped fix
re-reviews, and the final CodeRabbit review with zero findings passed. The
migration-first staging deployment, post-merge CI, Rooms/P2P, extension build,
Vercel status, and staging smoke passed. Both established test profiles completed
the forced reauthentication; the user confirmed correct website/Popup accounts,
single-profile extension logout isolation, and successful reconnect. Task 7 is
staging-accepted.

Task 8 reached staging through PR #203 and merge commit `e8c5519`. Migration
`20260820040229_auth_artifact_cleanup.sql` is applied and installs one active
hourly Supabase Cron job, `anidachi-auth-artifact-cleanup-hourly`, which invokes
the service-role-only bounded cleanup function. Each call deletes at most 100
physical expired, revoked, consumed, or otherwise unusable auth-artifact rows;
active refresh families, live OAuth transactions, and unexpired extension codes
are not eligible. Successful extension-code exchange now deletes its exact code
atomically instead of retaining a consumed row. There is no Vercel cleanup
route, new secret, queue, worker, dashboard, polling loop, or user-visible
setting.

Local verification includes a fresh database reset, 226/226 pgTAP assertions,
the exact production-statement normal-planner contract, full web/extension/
protocol tests and checks, database lint/advisors, repeatability, concurrent
lock-progress coverage, independent review, and CodeRabbit review. Post-merge
database deployment, CI, Rooms/P2P, Vercel, and staging smoke passed. One
attended bounded staging invocation removed exactly 100 eligible rows (47
expired extension codes, 5 expired OAuth transactions, 46 expired/revoked
legacy refresh rows, and 2 unusable refresh families) while all 7 active refresh
families remained. Task 8 is staging-accepted; the hourly job will drain the
remaining eligible backlog in bounded calls. Its first scheduled execution at
`2026-08-20 07:00 UTC` succeeded and removed another 100 eligible rows while
the active-family count remained 7.

Wave 2 is complete and staging-accepted: Tasks 5-8 satisfy their staging
acceptance boundaries, and the Wave 2 Stop is closed. Wave 3 may proceed from
current `staging`. No security work from this wave has been promoted to `main`;
production promotion remains a separate decision and is out of this closeout.

Wave 3 Tasks 9-10 are merged to staging. Task 10's WebSocket-admission change
merged in PR `#208` at `1707703efb6ec5e85b6a3c40fc9192134f23be3a` on 2026-08-21.
Post-merge CI, API deploy, migration workflow, Rooms E2E, P2P E2E, Vercel, and
staging smoke passed. Manual staging acceptance with two authenticated browser
profiles passed host room creation, guest join, synchronized play/pause/seek,
and guest reload/reconnect without duplicate or ghost participants. This proves
the normal two-profile join/reconnect path only; it is not a two-network/TURN,
production, or exhaustive adversarial-traffic result. Task 11 is next, and the
Wave 3 Stop remains open.

## Subscription Plan Codes

Canonical subscription plan codes are:

```txt
free | plus | pro
```

Legacy values `watcher`, `nakama`, `junkie`, `crunchyroll_subscriber`, and
`anime_junkie` are migration-only aliases. Runtime code may accept them during
the bridge window for old tokens, old Stripe metadata, and old database rows,
but new UI, APIs, protocol payloads, Stripe metadata, database writes, and docs
must emit `free`, `plus`, and `pro`.

## Extension Session Ownership

The extension background service worker is the single coordinator for extension
sign-in, access-token refresh, and website-account reconciliation. Content
scripts and the popup request auth operations through runtime messages and may
read cached identity for immediate rendering, but they do not own refresh.

Website and extension access tokens expire independently. A stale website access
cookie is not evidence that the extension signed out. The extension uses
`/api/extension/auth/website-session` to validate the long-lived website refresh
cookie for explicit logout and account-switch synchronization. Temporary HTTP or
network failures preserve the cached extension session; a confirmed invalid
extension refresh token remains the terminal server-side sign-out signal.
Cached identity may remain visible during a temporary outage, but authenticated
actions fail with a retryable error until a usable access token is available.
Supabase query failures propagate as server errors and must never be collapsed
into an invalid-token response. Startup reconciliation and cookie-change events
are coalesced by the background worker; strict cookie policies use the existing
silent browser flow as a fallback.

## Account Read Contracts And Popup Isolation

Account read responses for friends, groups, invites, and watch-library data use
shared versioned protocol schemas. Their metadata identifies the schema version,
server generation time, and authenticated account owner so extension clients can
reject malformed, incompatible, or cross-account responses before rendering or
caching them.

The Popup treats the active extension session as the owner of all account data.
Social, inbox, and watch snapshots are cached per account, visible state is
cleared immediately on account change or sign-out, and generation gates prevent
late requests, seen acknowledgements, poster hydration, social actions, and
history operations from writing into a newer account session. Popup snapshot I/O
does not claim ownership of the content script's active playback progress.

The additive durable inbox migration is applied on staging. The current account
inbox rollout moves both the Popup Inbox and `/account/invites` incoming surface
to the same owner-bound `/api/account/inbox` response, including server counts,
seen state, missed room invites, and cursor pagination in the full web surface.
Application rollout is tracked in PR #160. Loaded two-account staging
acceptance remains required before production promotion.

## Room Invite Notification Direction

Durable room-invite and inbox rows remain authoritative. The authenticated HTTP
inbox, account-scoped Popup cache, unseen badge, seen acknowledgement, and
shared web incoming surface are deployed. Standards-based Web Push delivery and
OS notifications are implemented and remain pending loaded-artifact,
two-account staging acceptance. The extension release manifest grants the
notification permission up front so the default-on local preference can
register a push device automatically after sign-in; the existing local toggle
still disables and revokes that browser's subscription. The
additive `devices` Web Push migration is already applied and verified on the
staging Supabase project; production remains unchanged until staging acceptance.
Web Push sends only an `inbox_changed` invalidation so the extension runs the
same inbox sync and displays minimal English room-invite notifications. There
is no frequent background inbox polling, Chrome GCM, Supabase Realtime
subscription, persistent notification WebSocket, or separate notification
event platform.

Recovery uses reconciliation on push receipt, Chrome startup, account/session
change, popup open, and successful invite mutation, plus one daily maintenance
alarm for long-running browser sessions. Invite actionability follows the room
lifecycle; unresolved invites become a non-actionable `Missed` presentation for
24 hours after room end. The canonical product and implementation details live
in
`docs/superpowers/specs/2026-08-06-account-data-history-social-inbox-design.md`.

The current Chrome-only delivery slice accepts only HTTPS subscriptions on
Chrome's FCM push host, caps active push-enabled extension installations at five
per account, and uses bounded delivery concurrency with a network timeout.
Permanent failures are pruned without exposing push endpoints or raw provider
responses to clients. Supporting another browser requires an explicit provider
allowlist addition and staging proof rather than accepting arbitrary push URLs.

Room invite creation now uses the service-role-only
`create_room_invite_atomic` Postgres RPC. Room validation, accepted-friend or
group recipient resolution, invite creation, and recipient-snapshot creation
commit in one transaction. A sender-scoped action ledger makes the extension's
stable `clientActionId` retryable, caps new actions at 20 per minute, and keeps
the request payload bound to that identifier. Requests are capped at 100
resolved recipients. Repeated direct/group targeting for the same room and
recipient returns existing state, including declined or expired state, and does
not schedule another push invalidation. The migration is additive: historical
invite rows remain readable and are not destructively rewritten.

The host invite panel reloads canonical sent invites when opened and keeps each
target labeled `Pending`, `Accepted`, or `Invited`. The create response exposes
whether a new recipient snapshot was created, allowing the UI to distinguish a
real send from an idempotent or semantic duplicate.

The invite schema still assigns `expires_at` with a 12-hour default, and the
existing accept path enforces it. The staging inbox foundation preserves that
field as a compatibility lifecycle signal. A later room-lifecycle slice must
replace the independent expiry behavior additively and prove the new contract on
staging before the compatibility field or check is removed.

## Runtime Environments

Local development:

```txt
Web: http://localhost:3003
API: http://127.0.0.1:8787
WS:  ws://127.0.0.1:8787
```

Staging:

```txt
Web: https://staging.anidachi.app
API: https://anidachi-api-staging.vladislav-gul7.workers.dev
WS:  wss://anidachi-api-staging.vladislav-gul7.workers.dev
```

`staging.anidachi.app` is an internal tester surface. It must stay
password-gated, noindex, excluded from the sitemap, and absent from production
SEO/marketing pages. It may appear in internal env vars, OAuth callback
allowlists, staging extension builds, and internal docs.

Production:

```txt
Web: https://www.anidachi.app
API: https://anidachi-api-production.vladislav-gul7.workers.dev
WS:  wss://anidachi-api-production.vladislav-gul7.workers.dev
```

The custom Cloudflare Worker domain should eventually hide the account subdomain,
but the current Worker URLs above are the active endpoints.

Worker release guardrails:

- `deploy-api` validates the release ref and may run only from `staging` or
  `main`.
- Worker deploys run a Wrangler dry-run before the real deploy.
- Staging Worker smoke can be run with `pnpm smoke:worker:staging`.
- Staging and production Worker names must stay distinct.

Normal deploy path is PR merge. Manual workflow dispatch is for retries or
emergencies only; release workflows must not be manually dispatched from feature
branches.

## Extension Channels

`local`:

- Extension name: `Anidachi Local MVP`
- Stable unpacked ID: `nkinhhgigcflmfhilmcakbkongcpkfnl`
- Built for local development and broad site experiments
- May use broad permissions locally

`staging`:

- Extension name: `Anidachi Staging`
- Stable unpacked ID: `ndkfphbchhfephdodcpehdcoclojagje`
- Built as a repository-controlled tester artifact; no store item is required
- Uses staging web/API endpoints
- Uses narrow release permissions for YouTube, Crunchyroll, Anidachi web, and
  staging Worker hosts

`production`:

- Extension name: `Anidachi`
- Has no approved identity or manifest key in the current pre-release phase
- Web connection therefore fails closed until an explicit production cutover
- Uses production web/API endpoints
- Uses narrow release permissions for YouTube, Crunchyroll, Anidachi web, and
  production Worker hosts

Build commands:

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
pnpm build:extension:staging:local-broad
WXT_VAPID_PUBLIC_KEY="<production-public-key>" pnpm build:extension:public
pnpm validate:extension:production
```

The default staging build is release-safe and uses narrow permissions. The broad
staging build is an explicit local-only command for development experiments and
writes to `anidachi-extension-staging-local-broad`, never to the narrow staging
candidate. The same source code produces every channel build. The
channel-specific behavior is selected through build environment variables in
the build scripts.

## Last Recorded Legacy Staging Artifact

The last staging artifact explicitly recorded in this document was generated
from commit `50c80a0`:

```txt
<repo>/anidachi-extension-staging.zip
<repo>/artifacts/anidachi-extension-staging-50c80a0.zip
```

Manifest checks:

```txt
name: Anidachi Staging
version_name: 50c80a0-staging-20260730171210
```

For new testing, prefer the latest `Build Extension` artifact from the
`staging` branch unless a PR records a more specific artifact.

## Current Product Behavior

The extension currently supports:

- YouTube and Crunchyroll content-script overlay;
- an ordered source-adapter registry with shared HTML5 core behavior and
  isolated Generic, YouTube, and Crunchyroll provider modules. This extraction
  preserves the existing winner-first behavior. YouTube overlay mounting is
  restricted to full watch pages so feeds, previews, Shorts, and embeds remain
  untouched;
- deterministic adapter replacement and suspension without recreating the room
  session. Provider geometry subscriptions are disposed before replacement,
  and stale callbacks from the previous player are ignored;
- independent YouTube and Crunchyroll player-chrome geometry. Shared overlay
  layout consumes only normalized safe insets and anchors from the active
  adapter;
- first-class provider-pinned room sources. YouTube and Crunchyroll rooms can
  switch only within their own provider, and the Room Worker rejects conflicting
  provider updates;
- YouTube finite-VOD synchronization with fail-closed transition detection,
  local advertisement isolation, 500 ms host-buffering debounce, authoritative
  playback rate, and explicit user-gesture recovery after autoplay blocking.
  Real-ad and two-profile staging acceptance remain required before PR #148 can
  leave draft;
- a compact room panel with an edge-intent launcher: while the panel is closed,
  the top pill stays hidden until a deliberate top-right hover reveals it; the
  open panel pins the pill in place as its close control;
- an `Interface` settings section with immediately applied, profile-local
  visibility preferences stored under `local:interfacePreferencesV1`. The main
  control can retain its edge-intent auto-hide behavior or remain visible.
  Open panel, active Open mic publication, and keyboard focus continue to pin
  it regardless of the selected preference;
- an active-room-only side voice rail with `Smart` and `Always visible` modes.
  Smart preserves quiet-hide, speaking-compact, and deliberate edge expansion.
  Always visible keeps eligible no-video participants compact and expands only
  the hovered, focused, or actively adjusted participant. Mounted video
  participants are still excluded, the current user never receives listener
  controls, and remote volume/mute remains local to the listener;
- sign-in through the web app with Google/Discord;
- room creation and invite copying through the website/API/Worker flow;
- WebSocket room join and playback sync;
- reactions and live chat input;
- Ghost Cam camera bubbles;
- local camera publishing is opt-in for every newly created, joined, or restored
  room session. A same-room network reconnect preserves the user's explicit
  camera choice, while leaving the room, signing out, or switching account
  resets the next room to camera off;
- one extension-local Overlay Layout Engine V2 now drives both the live camera/chat
  geometry and the Layout editor. It stores only grid intent under
  `local:overlayLayoutPreferencesV2`, previews one camera leader plus three
  followers, derives chat height from typography and message count, adapts to
  player controls and reserved AniDachi UI without rewriting saved preferences,
  keeps the full four-seat camera geometry reserved while rendering only
  occupied camera slots,
  previews editor drafts against the same measured runtime context in both the
  miniature and a pointer-transparent live ghost layer, starts drag from the
  resolver's actually displayed logical placement, supports bottom-edge chat
  alignment, clears ghosts after Apply, keeps real chat/cameras below the open
  settings panel, and persists changes only after an explicit successful
  `Apply`;
- one microphone publication lifecycle shared by `V`-only Push to talk and
  explicit Open mic. Selecting Open mic starts continuous publication only
  after the exact room session, listener, media seat, snapshot, and P2P
  controller are ready. The selected mode is stored per sender tab in
  extension-owned session storage, survives same-room source changes and a tab
  reload, and resets to Push to talk for a new room, leave/end, sign-out,
  account change, media-seat loss, terminal microphone failure, or full browser
  restart;
- local and remote speaking indicators are measured independently from
  transport flow: quiet Open mic remains published without appearing to speak
  or triggering audio-stall recovery, while sender/receiver audio levels drive
  the green treatment and a local-track RMS fallback covers the period before
  a sender exists. Push to talk is the deliberate exception: local and remote
  indicators activate immediately while `V` is held and clear on release;
- per-listener participant audio mix controls: each remote media-seat
  participant can be muted or adjusted locally from the side voice pill or the
  matching video-bubble contour. Preferences are versioned, validated,
  account-scoped, applied before remote playback, and survive camera/track
  replacement without changing the remote microphone or RTP flow;
- camera and microphone publication are independent. Camera off/on does not
  stop Open mic, microphone stop does not remove healthy video, and rapid
  answerer-side camera transitions coalesce their required renegotiation instead
  of dropping the latest direction change;
- live P2P voice does not duck Crunchyroll or YouTube player volume. Dictate
  reactions and their speech-recognition/player-ducking runtime have been
  removed;
- WebRTC P2P media with Cloudflare TURN fallback;
- no active LiveKit/SFU media path: the legacy extension transport, Worker
  `/livekit/token` route, local `infra/livekit` helper, and `livekit-client`
  dependency have been removed;
- local extension ICE fallback now includes Cloudflare STUN
  (`stun.cloudflare.com:3478`) before Google STUN, so the
  unauthenticated/no-room-token path no longer depends on Google-only STUN.
  `stun.cloudflare.com:53` was removed after real logs showed repeated Chrome
  701 timeouts on that candidate;
- P2P peer connections use `iceCandidatePoolSize: 2` with normal
  `iceTransportPolicy: "all"` outside explicit relay diagnostics, and the
  selected candidate pair is logged as compact direct-vs-relay telemetry without
  candidate strings, IPs, URLs, or participant ids;
- `/ice-servers` relay readiness diagnostics: Worker responses expose safe
  STUN/TURN URL counts plus `hasTurn`/`hasTurns443`, and configured Cloudflare
  TURN responses fail closed if they collapse to STUN-only after browser-blocked
  TURN URLs are filtered;
- Cloudflare TURN credential resilience: configured Workers keep a hot
  module-level cache of the last valid short-lived Cloudflare ICE payload.
  Fresh cached credentials are served without refetching, and a still-valid
  cached relay payload is served if Cloudflare's credential API is temporarily
  unavailable. Authenticated extension media setup no longer silently replaces a
  failed relay fetch with STUN-only defaults unless a build-time fallback also
  contains TURN;
- debug SDP summaries now record negotiated codec/FEC/RTX signals so Teleparty-
  style production A/V choices can be compared against actual AniDachi browser
  behavior before changing topology;
- WebRTC codec preferences are now applied before offer/answer creation:
  audio prefers browser-supported RED first, then Opus fallback; video keeps
  lightweight broadly-supported codecs first while preserving RTX/FEC entries
  when the browser exposes them. Local offer/answer SDP is then narrowly
  normalized for the negotiated audio/Opus payload so `useinbandfec=1` and
  `usedtx=1` are present for lower-bandwidth push-to-talk and ambient silence;
- stats-backed remote voice activity: inbound WebRTC audio bytes/packets/level
  can confirm or clear active-speaker state while a remote peer is expected to
  be talking after `voice-start`; after `voice-stop`, residual RTP/DTX movement
  cannot relight the mic badge by itself;
- Push to talk activity follows the held control on both sides: `voice-start`
  carries the active microphone mode, so local and remote PTT indicators appear
  immediately on key-down and clear on `voice-stop`; Open mic indicators remain
  tied to measured speech;
- push-to-talk audio is no longer coupled to camera visibility: voice-only room
  participants can enter or remain in the P2P media mesh without requiring
  `cameraEnabled`, so turning a camera off does not tear down the peer connection
  that carries audio;
- automatic remote-audio stall recovery: while remote voice is expected,
  connected inbound audio with missing or stalled packet/byte flow is
  classified from WebRTC stats and triggers throttled ICE recovery without a
  user-facing reconnect button;
- proactive P2P ICE recovery on browser `online` and Network Information
  `change` signals, covered by the real-WebRTC short network-loss harness;
- automatic remote-video stall recovery: expected connected remote video is
  checked through inbound WebRTC stats; when `framesDecoded` is available it is
  the authoritative health signal, with `bytesReceived` used only as a fallback
  for browsers that omit decoded-frame counters. Missing or stalled decoded
  frame flow triggers throttled ICE recovery without a manual reconnect button;
- P2P signaling replay fenced by current room/source generation;
- controller-level duplicate SDP/ICE protection in the extension media engine:
  exact repeated `offer`/`answer` SDP and ICE candidates are fingerprinted and
  dropped before being applied, while voice/control signals remain live;
- live `SOURCE_CHANGED` handling: the Worker increments `sourceGeneration` on
  host source changes and the extension resets stale P2P queues;
- Cloudflare Durable Object WebSocket Hibernation core for room sockets:
  versioned socket attachments, constructor rebuild from `getWebSockets()`,
  SQLite-backed room snapshot and P2P replay/sequence state, raw `ping`/`pong`
  auto-response keepalive, JSON `PING` compatibility for old clients, and a
  Workers-runtime forced wake test for existing sockets, host state/source
  snapshots, camera state, raw keepalive, and P2P replay;
- on the current room/P2P hardening branch, Free-room usage is now accumulated
  in one SQLite-backed Durable Object record only while a live host and guest
  are joined. `ROOM_SNAPSHOT` carries the cumulative value for reconnect-safe
  countdown display. Worker waits for the existing internal Web callback to
  acknowledge one service-role-only RPC that atomically applies usage and ends
  the room before it persists the terminal tombstone. The additive staging
  migration, shared callback secret, matching Web deployment, and matching
  Worker deployment were rolled out in that order on 2026-07-13. Automated CI,
  room/P2P E2E, Web smoke, and Worker smoke passed; real two-client acceptance
  remains required before promotion. The first manual host-end check exposed a
  missing Vercel `ANIDACHI_API_INTERNAL_BASE_URL` and correctly failed closed
  with `502`; the staging URL was configured, Web was redeployed, and a real
  staging room then transitioned from `live` to persisted `ended` state;
- debug export from the extension panel. Current diagnostic bundles include a
  unified top-level timeline that merges background diagnostics with page debug
  entries, while still keeping the split `diagnosticEntries` and
  `pageDebugEntries` for deeper inspection.

The extension still does not host, proxy, record, or distribute source video.

## Known Fragile Areas

These are intentionally not treated as solved:

- Overlay Layout Engine V2 still requires loaded staging acceptance at compact,
  720p, 1080p, and fullscreen player sizes. The local engine/component suite
  covers deterministic geometry, draft isolation, persistence failure, pointer
  cancellation, and keyboard rollback, but one/four real-camera rendering and
  reload persistence must still be confirmed in Chrome;
- P2P media reconnect and asymmetric join timing still require staging/manual
  acceptance beyond the local harness. The local harness now waits until both
  peers have received a room snapshot with both cameras enabled before measuring
  TTFM, which removes one false-start class but is not a real-network proof.
- Open mic and participant mix controls have direct-first two-browser coverage
  for silence, late join, signaling reconnect, camera off/on, microphone-only
  stop, Push to talk warm reuse, local mute/volume, and remote track replacement.
  Room-scoped mode persistence has reducer and revision-guarded storage
  coverage. Manual loaded-extension acceptance is still required for reload
  restore timing, media-seat revoke, permission denial, account switching,
  overlay/source replacement, four-seat load, and real speaker output on two
  devices.
- Interface visibility preferences have unit, component, full-repository,
  room-harness, and direct-first WebRTC coverage, and the staging artifact is
  validated. Loaded-extension visual acceptance is still required on YouTube
  and Crunchyroll across normal, theater, and fullscreen modes before the
  branch is ready for its PR.
- The local real-WebRTC harness usually selects same-machine `host/host`
  candidate pairs. Relay-only TURN harness mode exists and can use either
  explicit short-lived ICE JSON or the real Worker `/ice-servers` path, but a
  successful Cloudflare TURN relay run (`provider=cloudflare`,
  `configured=true`, `turns:443` present, selected pair is `relay`) plus
  two-network/two-profile staging acceptance are still required before treating
  P2P as proven for users in different networks or countries. The latest
  server/client cache hardening removes one transient Cloudflare API failure
  path, but it is not a substitute for a real relay run.
- A market-readiness claim for video/audio additionally requires a real remote
  participant outside the local network/ISP path, with candidate type, TTFM,
  reconnect, audio, and push-to-talk results recorded. Same-network local tests
  are smoke tests only.
- Hibernation forced-wake behavior and empty-room end alarms have explicit
  Workers-runtime coverage, but staging idle-session/alarm acceptance is still
  pending.
- The simplified Free quota meter is locally covered across presence changes,
  hibernation, repeated end, and atomic rollback-tested Supabase finalization.
  The exact staging migration/Web/Worker rollout and automated smokes passed;
  one normal Free-room lifecycle with two real clients and persisted usage
  verification is still pending. A global lease preventing an adversarial Free
  host from running several rooms concurrently is deliberately deferred until
  product evidence justifies that extra coordination.
- Source switching is not complete: live `SOURCE_CHANGED` and
  `sourceGeneration` bumps are implemented, but durable Supabase source
  persistence, room-create source descriptor plumbing, and explicit
  source-switch UI/commands are still pending.
- Watch History v2 is the active staging runtime. Supabase/Postgres is the one
  durable account-history authority; the extension background owns the
  account-scoped cache/outbox, while Popup and website consume the same strict
  v2 response. The v1 HTTP paths return `426 UPGRADE_REQUIRED`, and the legacy
  tables remain inert for rollback rather than being deleted.
- `ROOM_HISTORY_GRACE_AMENDMENT_REQUIRED` is the reviewed Task 9 decision after
  the Task 0 report proved unavailable: Worker-issued shared-history authority
  has mandatory exact scalar claims, a unique `jti`, and `exp = iat + 86,400`
  seconds. New expired authority fails before history/session/participant/Recent
  People mutation, while an exact unexpired 14-day receipt remains idempotent
  after authority expiry. Rejected delayed shared work stays in the extension's
  bounded outbox as `invalid-room-authority` and is never reclassified as solo.
- The additive foundation and Recent People v2 migrations are applied on
  staging through `20260814020000`. A user confirmed the repaired solo
  Crunchyroll -> Popup -> staging website path. Full two-profile/two-network
  acceptance, two-network/two-profile P2P evidence, the integrated Wave 3
  matrix, and production promotion are still pending; this is not a
  production-readiness claim.
- The locally verified `20260816090000_watch_history_v2_bounded_read.sql`
  removes the full-account episode aggregation from title pagination with a
  transactionally maintained one-row-per-title v2 projection. A second compact
  projection stores one row per v2 `(user, session)` membership with that
  user's current generation and title key. Its ordering timestamp is canonical
  `watch_sessions.last_checkpoint_at`, the same value returned in the session
  DTO, never participant heartbeat time. Session enrichment reads the latest 20
  through the requester-leading title/order index, then unions each visible
  episode's canonical latest session. Roomless shared tombstones with neither
  `room_id` nor `client_session_key` are excluded and cannot consume a candidate
  slot. Shared session generation stays
  host-owned and is never compared to the viewer's generation. It does not
  truncate observed episode DTO data: a single visible title can still return
  arbitrarily many episode rows.
  Keyset selection uses the projection index before `LIMIT`; normal heartbeat
  writes incrementally advance one summary row, while a delete statement
  recomputes each distinct affected title once.
  An explicit migration transaction first takes a write-conflicting lock on
  settings, then session, participant, and progress sources. This follows both writers'
  settings-first lock order, lets an in-flight writer drain, blocks later
  writers through both v2-only initializers, and prevents a concurrent delete
  from being reinserted by a stale initializer snapshot. A ten-second lock
  timeout rolls the migration back for a safe workflow retry. Maintenance is
  installed before both initial fills. The title fill preserves the maximum
  observation; the locked session fill converges exactly to canonical checkpoint
  and identity state.
  Deep cursors add an indexable timestamp upper bound while retaining the strict
  timestamp/binary-ID predicate. Session enrichment uses the v2 recent-title
  requester/session projection index through a per-visible-title `LATERAL ...
  LIMIT 20`. Participant deletion, including full clear, cascades only that
  user's projection row and leaves another participant's row intact. Session-
  side checkpoint/identity maintenance updates current v2 member projections;
  hard room deletion removes derived rows for the resulting internal tombstone.
  A 501-title/13,200-episode local probe returned 50 titles and 2,376 episode
  rows plus 20 session IDs in a 1,455,993-byte payload, with about 21 MiB parser
  RSS growth. This is evidence, not a universal resource bound, so public release remains blocked
  pending an explicit episode-pagination contract or a separately approved
  defensible bound.
- The additive projection/RPC must deploy in a migration-only prerequisite PR
  before the web consumer PR. Use that order on both staging and production: on
  production, merge the migration-only promotion to `main`, wait for `Deploy
  migrations to production` and verify migration history, then merge the
  runtime promotion. A direct combined staging-to-main promotion is unsafe
  because database and application deploys trigger independently and can expose
  runtime before its RPC.
- The migration-only prerequisite is compatible with the old web runtime, but
  it is not dormant: projection maintenance runs on v2 progress, session, and
  participant writes/deletes. If it must be undone, use the reviewed forward
  cleanup sequence in `docs/release-and-rollback-runbook.md`; never delete or
  rewrite canonical `watch_episode_progress` rows.
- Custom API domain for hiding the Cloudflare account subdomain is deferred.
- Stripe production webhook appears wired, but end-to-end subscription testing is
  still a separate follow-up.

## Documentation Map

- Project operating manual: `docs/project-operating-manual.md`
- Project architecture and development workflow:
  `docs/project-architecture-and-development.md`
- Current operational state: `docs/current-development-state.md`
- Agent/contributor startup contract: `AGENTS.md`
- Development flow quality plan:
  `docs/superpowers/plans/2026-06-17-development-flow-quality-system-plan.md`
- Environment and secrets matrix: `docs/environment-and-secrets-matrix.md`
- Staging acceptance checklist: `docs/staging-acceptance-checklist.md`
- Release and rollback runbook: `docs/release-and-rollback-runbook.md`
- Project knowledge map / Graphify policy: `docs/project-knowledge-map.md`
- Overall architecture notes: `docs/architecture.md`
- Extension release channels: `docs/extension-release-channels.md`
- Site and extension integration: `docs/site-extension-integration-notes.md`
- P2P and experimental features: `docs/experimental-features.md`
- Active room/P2P/realtime hardening roadmap:
  `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- Active execution program for that roadmap (SLOs, verified defects, e2e harness,
  block-by-block plan):
  `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`
- Approved extension voice controls and participant audio implementation plan:
  `docs/superpowers/plans/2026-07-27-voice-controls-and-participant-audio-plan.md`
- Approved Interface visibility design and implementation plan:
  `docs/superpowers/specs/2026-07-30-interface-visibility-settings-design.md`
  and
  `docs/superpowers/plans/2026-07-30-interface-visibility-settings.md`
- Historical commercial room/P2P/progress plan:
  `docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md`
- Monorepo migration history:
  `docs/superpowers/plans/2026-06-03-main-repository-monorepo-migration.md`
