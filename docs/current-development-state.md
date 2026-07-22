# Current Development State

Last updated: 2026-07-22.

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
- Built for local development and broad site experiments
- May use broad permissions locally

`staging`:

- Extension name: `Anidachi Staging`
- Built for the Chrome Web Store tester item
- Uses staging web/API endpoints
- Uses narrow store permissions for YouTube, Crunchyroll, Anidachi web, and
  staging Worker hosts

`production`:

- Extension name: `Anidachi`
- Built for the public Chrome Web Store item
- Uses production web/API endpoints
- Uses narrow store permissions for YouTube, Crunchyroll, Anidachi web, and
  production Worker hosts

Build commands:

```bash
pnpm build:extension:staging
pnpm build:extension:staging:broad
pnpm build:extension:public
pnpm validate:extension:staging
pnpm validate:extension:production
```

The default staging build is store-safe and uses narrow permissions. The broad
staging build is an explicit local-only command for development experiments. The
same source code produces both store builds. The channel-specific behavior is
selected through build environment variables in the build scripts.

## Last Recorded Staging Store Artifact

The last staging artifact explicitly recorded in this document was generated
from commit `6be6f82`:

```txt
<repo>/anidachi-extension-staging.zip
<repo>/artifacts/anidachi-extension-staging-6be6f82.zip
```

Manifest checks:

```txt
name: Anidachi Staging
version_name: 6be6f82-staging-20260604040825
```

The staging Chrome Web Store reviewer/tester access code is stored in the Chrome
Web Store testing instructions, not in git.

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
  adapter; first-class YouTube room source navigation and synchronization
  hardening remain follow-up work;
- a compact room panel with an edge-intent launcher: while the panel is closed,
  the top pill stays hidden until a deliberate top-right hover reveals it; the
  open panel pins the pill in place as its close control;
- an active-room-only side voice rail: it is absent before a room exists, and
  its participant list expands only after a deliberate press against the player
  edge rather than broad hover near the side;
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
- push-to-talk audio;
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
- Watch progress persistence now has a backend-backed watch-library foundation
  on the Phase 6 branch, but staging acceptance across real browser profiles is
  still required before treating it as finished product behavior.
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
- Historical commercial room/P2P/progress plan:
  `docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md`
- Monorepo migration history:
  `docs/superpowers/plans/2026-06-03-main-repository-monorepo-migration.md`
