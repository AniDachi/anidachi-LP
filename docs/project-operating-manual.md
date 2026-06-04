# Anidachi Project Operating Manual

Last updated: 2026-06-04.

This is the practical map of how the current Anidachi project is organized and
how development should move through local work, staging, tester extension builds,
and production. Keep this file direct and operational. Do not turn it into
marketing copy.

## Source Of Truth

Canonical GitHub repository:

```txt
AniDachi/anidachi-LP
```

Local working copies may live anywhere. In this documentation, `<repo>` means
the folder where a developer has cloned `AniDachi/anidachi-LP` on their own
machine.

```txt
<repo>
```

Example local clone locations:

```txt
~/Projects/anidachi-LP
C:\Projects\anidachi-LP
/workspace/anidachi-LP
```

Older pre-monorepo local folders may exist on individual machines. Treat them as
legacy context only. New product work belongs in the canonical repository above.
If useful code exists only in an old local folder, migrate it into this monorepo
before continuing.

Generated extension folders and zips are build artifacts. Do not edit them as
source and do not commit them:

```txt
anidachi-extension-staging/
anidachi-extension-public/
anidachi-extension-experiment/
anidachi-extension-*.zip
artifacts/
```

## Repository Layout

```txt
apps/
  web/        Next.js website, auth, Stripe, invite pages, room records, SEO
  extension/ WXT Chrome extension, overlay UI, video adapters, chat/reactions, P2P media
  api/        Cloudflare Worker + Durable Objects realtime room server
  demo/       Local HTML5 video test page

packages/
  protocol/  Shared Zod schemas, event types, sync math

docs/
  Current architecture, release process, plans, and operational notes

infra/
  Local/dev infrastructure helpers

scripts/
  Build and release helper scripts
```

The monorepo uses `pnpm` and Turborepo. `packages/protocol` is shared by the
extension and Worker, so room events should be changed there first, then consumed
by the app that sends or receives them.

## Mental Model

Think about the system as three planes:

```txt
Control plane:  apps/web + Supabase
Live plane:     apps/api + Durable Objects + WebSockets
Runtime plane:  apps/extension inside the user's browser
```

The control plane decides who the user is, what plan they have, which room exists,
who is allowed to join, and what durable data should be saved.

The live plane coordinates what is happening right now in a room. It should be
fast, temporary, and authoritative for live room messages.

The runtime plane is where the actual viewing happens. The extension controls the
overlay, reads and controls the local video element, and owns local media capture.

When deciding where a new feature belongs, ask which plane should own the truth:

- account, billing, friends, durable progress: `apps/web` and Supabase;
- realtime room state, playback sync, signaling: `apps/api`;
- video-page behavior, overlay UI, media capture: `apps/extension`;
- shared event shapes: `packages/protocol`.

## System Responsibilities

`apps/web` owns durable product state:

- user login;
- OAuth callbacks;
- extension auth exchange;
- room records;
- room membership;
- invite landing/join routes;
- Stripe checkout and subscription state;
- future friends, profiles, and watch-progress persistence.

Supabase access lives server-side in the web app. The service role key must never
be exposed to the extension or browser client code.

`apps/api` owns live room state:

- WebSocket room connections;
- Durable Object per room;
- presence during an active room;
- host-authoritative playback sync;
- reactions and chat events;
- P2P signaling messages;
- short-lived ICE server payloads for WebRTC.

The Worker is not the durable database. It should validate room tokens, enforce
live-room permissions, and coordinate realtime events.

`apps/extension` owns the viewing experience:

- video detection and adapters;
- Shadow DOM overlay;
- fullscreen-safe UI positioning;
- Anidachi menu and participant bubbles;
- reactions, chat input, voice/push-to-talk UI;
- playback control and drift correction;
- WebRTC peer connections and media rendering.

`packages/protocol` owns the room contract:

- `JOIN`;
- `HOST_STATE`;
- `PLAY`, `PAUSE`, `SEEK`;
- `REACTION`;
- `CAMERA_ON`, `CAMERA_OFF`;
- `P2P_SIGNAL`;
- server snapshots and participant events.

If a change touches more than one layer, describe the contract first. Do not
change extension behavior and Worker protocol independently.

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

Production:

```txt
Web: https://www.anidachi.app
API: https://anidachi-api-production.vladislav-gul7.workers.dev
WS:  wss://anidachi-api-production.vladislav-gul7.workers.dev
```

Staging and production must never accidentally share runtime endpoints. Before
uploading an extension zip, inspect `manifest.json` and the extension debug panel.

`staging.anidachi.app` is an internal tester surface. It must be password-gated,
noindex, excluded from the sitemap, and never used in production SEO/marketing
pages. It may appear in internal env vars, OAuth callback allowlists, staging
extension builds, and internal docs.

Deployment ownership:

- web app: Vercel through GitHub;
- realtime API: Cloudflare Workers through Wrangler/GitHub workflow;
- extension: Chrome Web Store upload for staging or production listing.

## How Login Works

The website uses custom auth backed by Supabase tables. It does not use Supabase
Auth as the primary auth product.

Website login:

1. User signs in with Google or Discord on the web app.
2. The website validates OAuth state.
3. The website upserts the user in Supabase.
4. The website issues its own access and refresh tokens.
5. Website tokens are stored in HttpOnly cookies.

Extension login:

1. The extension calls `chrome.identity.launchWebAuthFlow`.
2. The browser opens `/extension/connect` on the configured web app.
3. If the user is not logged in, the website sends them through the normal web
   login flow.
4. The website creates a one-time extension auth code.
5. The extension receives the code through the Chrome identity redirect URL.
6. The extension exchanges it through `/api/extension/auth/exchange`.
7. The extension stores extension-scoped access/refresh tokens in
   `chrome.storage.local`.

Important rule: the extension should never receive service-role keys, OAuth
client secrets, JWT signing secrets, Stripe secrets, or Cloudflare TURN secrets.

## How Room Creation Works

Rooms are created through the website, not directly through the Worker.

Room creation flow:

1. User opens a supported video page.
2. The extension detects the video and shows the small Anidachi bubble.
3. User signs in if needed.
4. User clicks `Create room`.
5. The extension sends room metadata to `POST /api/rooms` on the web app:
   current URL, video fingerprint, title, and later provider-specific IDs.
6. The website writes durable room data to Supabase.
7. The website returns:
   - `roomId`;
   - `roomToken`;
   - `shareableLink`.
8. The extension opens a WebSocket to the Worker:
   `/ws/:roomId?roomToken=...`.
9. The Worker verifies the `roomToken` and derives identity/role server-side.

The old unauthenticated Worker room creation path is intentionally disabled in
commercial mode. If room creation fails, inspect the website API first, then the
Worker connection.

## How Joining Works

Invite flow:

1. Host copies the web invite link.
2. Guest opens `/room/:roomId` on the website.
3. If needed, the website asks the guest to log in.
4. The website records room membership.
5. The website redirects to the source video URL with `#anidachiRoom=<roomId>`
   when it has a source URL.
6. The extension sees the room id in the hash.
7. The extension calls `/api/rooms/:roomId/connect` to get a fresh `roomToken`.
8. The extension connects to the Worker WebSocket.

The Worker should not trust participant identity sent by the client. It should
trust the verified room token.

## How Realtime Rooms Work

The Worker uses Durable Objects. One room maps to one Durable Object instance.

The Durable Object keeps only live state:

- participants currently connected;
- host playback state;
- transient reaction/chat events;
- camera status;
- P2P signaling.

Postgres should not receive per-second playback state. Persist only durable
business/product data there: users, rooms, memberships, plans, future watch
progress, and history.

## How Playback Sync Works

Current sync is host-authoritative:

1. The host sends playback state and play/pause/seek events.
2. The Worker accepts host state only from the room host.
3. Viewers receive host state through WebSocket.
4. The extension compares local video time with expected host time.
5. Small drift is ignored; larger drift is corrected by seeking or asking the
   user to sync.

When changing sync behavior, update `packages/protocol`, Worker validation, and
extension drift handling together.

## How Video And Audio Work

Current media direction is WebRTC P2P, not server-hosted video calls.

Flow:

1. Participants join the room WebSocket.
2. The extension starts a local media controller when camera/audio is enabled.
3. The extension exchanges WebRTC offers, answers, ICE candidates, voice-start,
   voice-stop, renegotiate, restart-ice, and bye messages through `P2P_SIGNAL`.
4. The Worker only forwards targeted P2P signaling between room participants.
5. Browser WebRTC chooses a direct/STUN path when possible.
6. Cloudflare TURN is used as fallback when direct paths fail.

P2P is intended for small rooms, currently around 2-4 people. Do not raise the
camera/audio room size without revisiting bandwidth, mesh topology, reconnection,
and TURN cost.

There is still historical LiveKit-related code and documentation in places. Do
not build new work around LiveKit unless a deliberate product/infra decision
brings it back.

## Extension Channels

The same source code builds three extension channels.

`local`:

- name: `Anidachi Local MVP`;
- used for local development;
- may use broad permissions for generic video detection experiments.

`staging`:

- name: `Anidachi Staging`;
- separate Chrome Web Store listing for founders/testers;
- points at staging web and staging Worker endpoints;
- should use narrow host permissions;
- testers get updates from the staging Chrome Web Store item after review.

`production`:

- name: `Anidachi`;
- public Chrome Web Store listing;
- points at production web and production Worker endpoints;
- should use narrow host permissions.

Build commands:

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
pnpm build:extension:staging:broad
pnpm build:extension:public
pnpm validate:extension:production
```

Staging does not become production by changing users in place. The code is
promoted. The extension listings stay separate. A tested commit from `staging` is
merged/promoted to `main`, then the production extension is built and uploaded to
the production Chrome Web Store listing.

`pnpm build:extension:staging` is the store-safe tester build and must use narrow
permissions. `pnpm build:extension:staging:broad` is local-only for development
experiments and must not be uploaded to Chrome Web Store.

## Development Flow

Normal feature flow:

1. Start from `staging`.
2. Create a feature branch.
3. Make the smallest coherent change.
4. Run local checks.
5. Open a PR into `staging`.
6. CI must pass.
7. Merge into `staging`.
8. Build and upload `Anidachi Staging` if testers need the change.
9. Test in the staging extension and staging web/API environment.
10. When accepted, open a release PR from `staging` into `main`.
11. `main` keeps stricter checks but does not require approval.
12. After merge to `main`, deploy/build production artifacts.

Branch protection:

- `staging`: requires `check-and-test`, no approval required, faster iteration.
- `main`: requires `check-and-test`, no approval, up-to-date branch, and
  conversation resolution.
- Repository auto-merge is enabled, so eligible PRs can merge after required
  checks pass.

Site-only auto-promotion:

- Website page/content work should still merge into `staging` first so it can be
  verified on `staging.anidachi.app` and by the staging extension.
- After a push to `staging`, `Promote Site Staging to Main` compares the full
  `main..staging` diff.
- If the diff contains only safe site/docs paths, it creates or updates the
  `staging -> main` PR and enables auto-merge.
- If extension, API, workflow, package, auth, room, checkout, or other sensitive
  files are present in the diff, auto-promotion is skipped.
- Workflow changes under `.github/**` are intentionally never auto-promoted; the
  auto-promotion workflow itself must be installed in `main` manually once.

Normal deploy path is PR merge. Manual release workflow dispatch is only for
retries or emergencies, and release workflows must run from `staging` or `main`.
Do not use manual dispatch from a feature branch as an alternate release path.

Never push risky changes directly to `main`. Never mix unrelated P2P, billing,
auth, UI, and migration changes in one large PR unless the change cannot be split.

Plain-language version:

```txt
feature branch = your safe workspace for one task
staging        = shared testing branch for founders/testers
main           = production branch for the public product
```

For example, a website improvement starts from `staging`, moves into a feature
branch, gets checked and reviewed through a PR, then lands in `staging` for
testing. Only after it is accepted does the same code move to `main`.

An extension feature follows the same path, but testers receive it through the
separate `Anidachi Staging` Chrome Web Store listing before it is promoted to the
public `Anidachi` listing.

## Everyday Development Loop

Start each feature from current `staging`:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
git switch -c codex/task-name
pnpm install --frozen-lockfile
pnpm check
pnpm test
```

Run checks for the surface you touched.

Web/auth/SEO change:

```bash
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
pnpm --filter @anidachi/web build
```

Extension change:

```bash
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm build:extension:staging
pnpm validate:extension:staging
```

Protocol/API change:

```bash
pnpm --filter @anidachi/protocol test
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/api test
cd apps/api
pnpm exec wrangler deploy --env staging --dry-run --outdir /tmp/anidachi-worker-dry-run
```

Promotion:

1. Merge the feature PR into `staging`.
2. Confirm Vercel staging is Ready.
3. Run staging smoke when web/auth/staging-gate behavior changed.
4. Build/upload `Anidachi Staging` if testers need extension changes.
5. Test on at least one clean browser profile or new PC when auth changes.
6. Open PR from `staging` into `main`.
7. Merge only after checks; request review when the change is risky.
8. Build/upload production extension only from `main`.

## Local Commands

Install dependencies:

```bash
cd <repo>
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install
```

Run checks:

```bash
pnpm check
pnpm test
```

Run local services:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:extension
pnpm dev:demo
```

Build extension artifacts:

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
pnpm build:extension:public
pnpm validate:extension:production
```

Deploy Workers:

```bash
cd apps/api
pnpm exec wrangler deploy --env staging
pnpm exec wrangler deploy --env production
```

## Release Checklist

Before uploading staging extension:

- branch is based on `staging`;
- `pnpm check` passes;
- `pnpm test` passes;
- `pnpm build:extension:staging` succeeds;
- `pnpm validate:extension:staging` succeeds;
- staging smoke passes after deploy if auth/web behavior changed;
- manifest name is `Anidachi Staging`;
- debug build id contains `staging`;
- host permissions are not broad;
- web/API endpoints point to staging.

Before uploading production extension:

- code has gone through staging;
- production PR checks have passed and the PR has been merged into `main`;
- `pnpm build:extension:public` succeeds;
- `pnpm validate:extension:production` succeeds;
- manifest name is `Anidachi`;
- debug build id contains `production`;
- host permissions are not broad;
- web/API endpoints point to production.

## What Not To Do

Do not:

- develop new features in old pre-monorepo folders;
- commit generated extension folders or zips;
- put secrets in the extension, docs, or git;
- make staging point to production API by accident;
- make production point to staging API by accident;
- write live playback state to Postgres every second;
- let the Worker trust client-provided identity for authenticated rooms;
- bypass `packages/protocol` when changing room event shapes;
- ship broad Chrome Store permissions without a deliberate product decision;
- treat P2P stability as fully solved until reconnect/asymmetric-join issues are
  hardened and tested.

## Development Startup Checklist

Before making changes:

1. Confirm the working directory is your local clone of `AniDachi/anidachi-LP`
   (`<repo>` in this documentation).
2. Check the current branch and git state.
3. Read `docs/current-development-state.md` for current endpoints and known
   fragile areas.
4. Read the relevant domain document:
   - extension release: `docs/extension-release-channels.md`;
   - auth/rooms/site-extension flow: `docs/site-extension-integration-notes.md`;
   - P2P experiments: `docs/experimental-features.md`;
   - watch progress: `docs/shared-watch-progress-tracker.md`.
5. Inspect the actual source files before assuming behavior.
6. Keep the change scoped.
7. Run at least `pnpm check`; run `pnpm test` when behavior or protocol changes.
8. Update docs when endpoints, release flow, protocol, or ownership changes.

If the task touches production or secrets, stop and verify the environment before
editing. Do not guess production values from old plans.

## Documents To Read First

Historical plans under `docs/superpowers/plans/` may contain old URLs and old
decisions. Use `docs/current-development-state.md` for active endpoints and
release state.

Read in this order before changing the project:

1. `README.md` for repo basics and commands.
2. `docs/project-architecture-and-development.md` for the system architecture
   and development workflow.
3. `docs/project-operating-manual.md` for how the project is organized and how
   development should move.
4. `docs/current-development-state.md` for current endpoints, branch protection,
   build artifacts, and known fragile areas.
5. `docs/extension-release-channels.md` for staging/public extension builds.
6. `docs/site-extension-integration-notes.md` for auth, website, extension, and
   database integration details.
7. `docs/experimental-features.md` for P2P and experimental feature status.
8. `docs/architecture.md` for broader architecture notes.
9. `docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md`
   for the longer future plan around rooms, P2P, and watch progress.
10. `docs/superpowers/plans/2026-06-03-main-repository-monorepo-migration.md`
   only as migration history. It may include old paths and historical decisions.

When documents conflict, prefer:

```txt
current-development-state.md
project-operating-manual.md
extension-release-channels.md
the code
historical plans
```

The code still wins over documentation if behavior has drifted. When that
happens, fix the documentation in the same PR as the code change or in an
immediate follow-up PR.

## How Future Watch Progress Should Fit

Watch progress should be durable product data and therefore belongs in the web
app/Supabase side of the system, not in the Worker live room state.

Expected future shape:

- extension detects provider/show/episode/movie identity;
- extension reports meaningful progress checkpoints, not every second;
- web API writes user/group progress to Supabase;
- room UI can show personal, friend, and group progress;
- Worker may broadcast live progress during an active room, but the durable
  record belongs to Supabase.

The product idea of multiple friend/group progress layers on one episode card is
documented separately in `docs/shared-watch-progress-tracker.md`.
