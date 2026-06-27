# Anidachi Project Architecture And Development

Last updated: 2026-06-04.

This document describes how the current Anidachi codebase is organized, how the
runtime systems fit together, and how development should move from local changes
to staging and production. It is intentionally operational: it avoids product
pitch language and focuses on what a developer needs to understand before
changing the system.

When the code, deployed behavior, endpoints, release channels, or branch rules
change, update this document in the same PR or in an immediate follow-up PR.

In examples, `<repo>` means the folder where `AniDachi/anidachi-LP` is cloned on a
developer machine. Do not hardcode local absolute paths in documentation.

## Important Documents

Read these documents before making non-trivial changes:

1. `README.md`
2. `docs/project-architecture-and-development.md`
3. `docs/current-development-state.md`
4. `docs/project-operating-manual.md`
5. `docs/extension-release-channels.md`
6. `docs/architecture.md`

Read domain-specific documents when the task touches that area:

- `docs/site-extension-integration-notes.md` for website, auth, room handoff,
  extension login, and database integration.
- `docs/experimental-features.md` for P2P media and experimental extension
  behavior.
- `docs/shared-watch-progress-tracker.md` for the planned watch progress model.
- `apps/web/docs/seo-content-guidelines.md` for SEO/content pages.

Historical execution plans live in `docs/superpowers/plans/`. They explain why
some decisions happened, but they are not current instructions. They may contain
old paths, old endpoints, or stale implementation details.

## Repository

Canonical GitHub repository:

```txt
AniDachi/anidachi-LP
```

This repository is the working monorepo for the website, Chrome extension,
Cloudflare Worker API, shared protocol package, migrations, scripts, and
documentation.

Older local folders from pre-monorepo experiments are legacy context only. New
work should happen in this repository.

## High-Level System

The project has three runtime planes.

```txt
Control plane: apps/web + Supabase
Live plane:    apps/api + Durable Objects + WebSockets
Client plane:  apps/extension inside the user's browser
```

Ownership rules:

- durable users, profiles, subscriptions, persistent rooms, room memberships,
  and watch progress belong to `apps/web` and Supabase;
- live room state, playback synchronization, participant presence, reactions,
  chat, and P2P signaling belong to `apps/api`;
- video-page detection, overlay UI, media capture, player control, keyboard
  shortcuts, and provider adapters belong to `apps/extension`;
- cross-app contracts, event schemas, playback state shapes, and validation
  belong to `packages/protocol`.

The extension does not host, proxy, record, or distribute source video. Each user
watches source video on their own provider page. Anidachi synchronizes playback
state and social events only.

## Monorepo Layout

```txt
apps/
  web/
    Next.js app for anidachi.app, auth, Stripe, room records, invite/join pages,
    Supabase integration, landing pages, and SEO pages.

  extension/
    WXT Chrome extension. Injects the overlay into supported video pages,
    detects video/player containers, controls playback sync, renders room UI,
    reactions, chat, Ghost Cam, and push-to-talk audio.

  api/
    Cloudflare Worker API with Hono, Durable Objects, WebSocket rooms, room token
    verification, playback sync, presence, reactions, chat, and WebRTC signaling.

  demo/
    Local HTML5 video demo page for extension testing.

packages/
  protocol/
    Shared TypeScript and Zod schemas for room events, playback state, sync math,
    and cross-app data contracts.

docs/
  Current architecture, release process, operational state, and historical plans.

scripts/
  Repository-level build and artifact scripts.
```

## Current Stack

Website:

- Next.js 15 App Router
- React 19
- Tailwind CSS 4
- shadcn/ui style components
- Supabase Auth and Postgres
- Stripe Checkout and webhook integration
- Vercel deployment

Extension:

- WXT
- React
- TypeScript
- Shadow DOM overlay
- provider adapters for video detection/player control
- WebRTC P2P media for Ghost Cam and push-to-talk audio
- Cloudflare TURN fallback through WebRTC ICE servers
- Vitest/happy-dom tests where available

API:

- Cloudflare Workers
- Hono
- Durable Objects
- WebSocket
- `jose` for JWT verification/signing where needed
- Zod schemas from `packages/protocol`

Shared:

- pnpm 11
- Turborepo
- TypeScript
- Biome
- Vitest

## Environments

Local:

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

`staging.anidachi.app` is internal tester infrastructure. It must be
password-gated, noindex, excluded from sitemap output, and kept out of production
SEO/marketing surfaces.

Production:

```txt
Web: https://www.anidachi.app
API: https://anidachi-api-production.vladislav-gul7.workers.dev
WS:  wss://anidachi-api-production.vladislav-gul7.workers.dev
```

The Cloudflare Worker URLs currently expose the account subdomain. A custom API
domain is planned later, but these are the active endpoints at the time of this
document.

## Branch Model

Use this development path:

```txt
feature branch -> PR -> staging -> tester build -> PR/promotion -> main -> production build
```

Branch roles:

- `staging` is the shared integration branch for test builds and tester
  feedback.
- `main` is production.
- Feature branches are temporary branches for one task or one coherent group of
  changes.

Rules:

- Start normal work from `staging`.
- Do not work directly on `main`.
- Open PRs into `staging` first.
- Merge/promote to `main` only after staging has been tested.
- Keep each PR scoped enough to review.
- Update docs in the same PR when behavior, architecture, endpoints, release
  flow, or environment assumptions change.
- Do not commit generated extension folders or zip files unless there is an
  explicit release-artifact PR.
- Do not commit secrets.

Typical start:

```bash
cd <repo>
git switch staging
git pull origin staging
git switch -c codex/short-task-name
```

Before opening a PR:

```bash
pnpm check
pnpm test
```

If a task touches only documentation, `pnpm check` is usually enough unless code
or package metadata changed.

## Release Channels

The same extension source code produces separate channels through build
environment variables and build scripts.

```txt
local      -> local development build
staging    -> Anidachi Staging Chrome Web Store item
production -> public Anidachi Chrome Web Store item
```

Build commands:

```bash
pnpm build:extension:staging
pnpm build:extension:public
```

Channel rules:

- Staging and production are separate Chrome Web Store listings.
- Staging must point to staging web/API/WS endpoints.
- Production must point to production web/API/WS endpoints.
- Staging tester updates should never affect public users.
- Production users should never receive staging endpoints or debug-only
  behavior by accident.

Before uploading a store artifact, inspect the generated `manifest.json` and the
extension debug panel:

- staging should show `Anidachi Staging` and a `*-staging-*` build id;
- production should show `Anidachi` and a `*-production-*` build id;
- store builds should not include broad `<all_urls>` permissions unless that is
  an explicit product/review decision.

## Website, Auth, And Rooms

The website is the owner of durable account and commercial data.

Current responsibilities:

- user sign-in through Google/Discord;
- Supabase-backed profile/session state;
- plan/subscription state;
- room creation records;
- invite/join pages;
- short-lived room tokens for the extension/Worker flow.

Room creation for the commercial path is auth-only:

1. The extension opens or talks to the website auth flow.
2. The signed-in user creates a room through the website/API path.
3. The website writes durable room data to Supabase.
4. The website issues a short-lived room token.
5. The extension uses that token to join the Worker WebSocket room.
6. The Worker validates the token and derives participant identity from it.

The Worker must not trust client-provided identity for authenticated rooms. The
identity should come from a verified room token.

## Live Room API

The live room API is responsible for fast ephemeral state, not durable business
records.

Current responsibilities:

- WebSocket connect/join/leave;
- room snapshots;
- host-authoritative playback state;
- play/pause/seek sync events;
- participant presence;
- reactions;
- chat messages;
- P2P signaling messages;
- temporary room state inside Durable Objects.

One active room maps to one Durable Object instance. Live playback state should
stay inside the Durable Object and should not be written to Postgres every
second.

## Extension Runtime

The extension runs as a content-script overlay on supported video pages.

Current responsibilities:

- detect YouTube and Crunchyroll video players;
- mount an isolated Shadow DOM overlay into the video/player container;
- keep the overlay visible in fullscreen;
- show the `A` menu and compact room controls;
- create/copy/join room flow through the website/API;
- control local playback when applying host sync;
- render reactions, chat, Ghost Cam, and push-to-talk state;
- capture camera/microphone only for explicit media features;
- expose debug logs/build metadata for testing.

Important UI constraints:

- overlay should stay inside or visually tied to the player;
- fullscreen behavior must be tested separately;
- player controls should not be blocked except when an intentional input/protect
  layer is active;
- camera bubbles and chat should avoid covering provider controls;
- staging/debug UI must not become accidental production behavior.

## Media Architecture

Current default media direction:

```txt
WebRTC P2P first, Cloudflare TURN fallback when direct connectivity fails.
```

Media responsibilities:

- Ghost Cam publishes camera video as small circular bubbles;
- push-to-talk publishes microphone audio only while the configured key is held;
- the UI shows speaking state with a small microphone indicator;
- P2P signaling goes through the Worker WebSocket room;
- STUN/TURN selection is handled by WebRTC ICE negotiation.

TURN is a fallback, not the preferred path. The implementation should prefer
direct peer-to-peer connectivity where possible, but it must still work when NAT
or networks require TURN relay.

Known media risk:

- P2P reconnect and asymmetric join timing can still be fragile.
- New rooms and reload/rejoin behavior need careful testing.
- Do not treat P2P as fully finished until reconnect and failure handling are
  hardened.

SFU/LiveKit:

- No SFU/LiveKit runtime is active today.
- The current media architecture is small-room WebRTC P2P with Cloudflare TURN
  fallback.
- Reintroduce an SFU only through a deliberate product/infra decision.

## Watch Progress Direction

Watch progress is durable product data. It should not be modeled as only live
room state.

Expected ownership:

- extension detects provider/show/season/episode/movie identity;
- extension reports meaningful progress checkpoints, not every second;
- web API validates and writes progress to Supabase;
- Supabase stores personal, friend, group, and room progress records;
- Worker may broadcast live progress inside an active room, but durable progress
  belongs to Supabase.

The backend-backed watch-library foundation exists, but real staging acceptance
across extension/browser profiles is still required before treating every
watch-progress behavior as finished.

## Local Development

Install dependencies:

```bash
cd <repo>
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install
```

Common commands:

```bash
pnpm dev:web
pnpm dev:api
pnpm dev:extension
pnpm dev:demo
pnpm check
pnpm test
```

Local website:

```bash
pnpm dev:web
```

Local Worker:

```bash
pnpm dev:api
```

Local extension dev build:

```bash
pnpm dev:extension
```

Use the shared staging website and staging Worker from the WXT dev browser:

```bash
pnpm dev:extension:staging
```

Use the Google-friendly launcher when testing Google sign-in:

```bash
pnpm dev:extension:staging:google
```

It starts WXT without auto-opening the `web-ext` browser, then opens a normal
Chrome profile with the dev extension loaded. This avoids Google's "browser or
app may not be secure" block while keeping WXT rebuilds active.

Load the dev extension from:

```txt
apps/extension/.output/chrome-mv3-dev
```

The WXT dev browser uses a persistent local Chrome profile at
`apps/extension/.wxt/chrome-data`, so login/cookies survive restarts. Refresh the
video page after content script changes if the page looks stale, and reload the
extension in `chrome://extensions` after manifest, permission, or background
service-worker changes.

Local auth/room testing requires the web app and Worker to share compatible
environment values, especially the JWT secret used for room tokens. Do not guess
production secrets from old plans.

## Testing Expectations

Minimum checks before merging code:

```bash
pnpm check
pnpm test
```

Manual extension checks after relevant changes:

1. Open YouTube with the target extension channel.
2. Open Crunchyroll with the target extension channel.
3. Verify the `A` menu opens and closes.
4. Verify sign-in through the configured web environment.
5. Create a room.
6. Copy invite.
7. Join from another Chrome profile or device.
8. Verify host playback sync.
9. Verify reactions and chat.
10. Verify Ghost Cam and push-to-talk if media code changed.
11. Verify fullscreen overlay behavior.
12. Verify debug panel shows the expected channel/build id.

For site changes, verify the affected route locally and through the relevant
Vercel deployment. For auth, billing, rooms, or Supabase changes, also verify the
database and callback path behavior.

## Secrets And Environment Values

Secrets must live in provider dashboards or local ignored env files, not in git.

Use:

- Vercel environment variables for website runtime secrets;
- Cloudflare Worker secrets for Worker runtime secrets;
- Supabase dashboard/CLI for database credentials and migrations;
- Stripe dashboard for webhook secrets and product/payment configuration;
- local `.env.local` files for development only.

Do not put API secrets, OAuth secrets, service-role keys, Stripe webhook secrets,
TURN credentials, or private URLs into committed documentation.

## Documentation Maintenance

Current documentation should describe the system as it works now. Historical
plans should stay historical.

When adding or changing behavior:

- update `docs/current-development-state.md` if endpoints, branch protection,
  release artifacts, known fragile areas, or runtime assumptions changed;
- update `docs/extension-release-channels.md` if extension channel behavior,
  permissions, endpoints, or store packaging changed;
- update `docs/project-operating-manual.md` if development workflow changed;
- update `docs/architecture.md` if system ownership or stack decisions changed;
- update this document when a new developer would otherwise misunderstand the
  project.

Trust order when docs conflict:

```txt
actual code and deployed behavior
docs/current-development-state.md
docs/project-architecture-and-development.md
docs/project-operating-manual.md
docs/extension-release-channels.md
docs/architecture.md
historical plans
```

If the code and docs disagree, inspect the code and deployed behavior first, then
fix the stale documentation.

## Practical Development Examples

Example: improving the website.

1. Start from `staging`.
2. Create a feature branch.
3. Change the relevant `apps/web` files.
4. Run `pnpm check` and relevant tests.
5. Open a PR into `staging`.
6. Verify the Vercel preview/staging behavior.
7. Merge into `staging`.
8. Promote to `main` only after the staging behavior is accepted.

Example: adding an extension feature.

1. Start from `staging`.
2. Create a feature branch.
3. Change `apps/extension` and `packages/protocol` if event contracts change.
4. Update `apps/api` if the feature needs realtime room support.
5. Run `pnpm check` and relevant tests.
6. Build the staging extension with `pnpm build:extension:staging`.
7. Test the staging build in Chrome.
8. Open/merge PR into `staging`.
9. Upload the staging Chrome Web Store item if testers need automatic updates.
10. Promote to production only after staging is verified.

Example: changing room or P2P behavior.

1. Read `docs/site-extension-integration-notes.md` and
   `docs/experimental-features.md`.
2. Inspect `apps/api`, `apps/extension`, and `packages/protocol` together.
3. Treat room state, signaling, and media negotiation as one flow.
4. Test with two Chrome profiles or two devices.
5. Test reload/rejoin behavior, not only first join.
6. Update known fragile areas if the behavior is still not fully hardened.
