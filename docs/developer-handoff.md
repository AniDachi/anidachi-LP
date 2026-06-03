# Anidachi Developer Handoff

This document is the high-level handoff for a developer or AI agent joining the
Anidachi codebase. It explains what the product is, how the repository is organized,
how environments are separated, how development should be done, and which boundaries
must not be crossed.

For exact environment URLs and release checklists, also read:

- `README.md`
- `docs/development-environments.md`
- `docs/architecture.md`
- `docs/experimental-features.md`
- `docs/releases/2026-06-04-monorepo-migration.md`

## Product Summary

Anidachi is a Chrome extension-first social watch layer for online video.

Users keep watching the original video on the original platform, with their own
account and access. Anidachi does not host, proxy, download, re-stream, record, or
distribute copyrighted video. It only adds:

- room creation and invite links;
- playback sync;
- lightweight presence;
- chat/reactions;
- optional P2P camera/audio;
- future persistent watch progress.

The product principle is:

```txt
The movie stays primary. Anidachi is an ambient social layer.
```

Do not turn the product into a streaming service, screen sharing product, Discord
clone, Zoom clone, or large chat sidebar.

## Source Of Truth

The primary repository is:

```txt
AniDachi/anidachi-LP
```

The main local checkout used during migration was:

```txt
/Users/vladyslavhulyi/anidachi-LP-monorepo
```

The legacy local repository:

```txt
/Users/vladyslavhulyi/anidachi
```

is historical reference only. New product work should happen in `AniDachi/anidachi-LP`.

## Repository Shape

Anidachi is now a pnpm/Turborepo monorepo.

```txt
apps/
  web/          Next.js website, auth, room APIs, Stripe, SEO, Supabase migrations
  extension/    WXT Chrome extension and in-player overlay
  api/          Cloudflare Worker + Durable Objects realtime room backend
  demo/         Local HTML5 video demo page

packages/
  protocol/     Shared Zod schemas, event types, sync math

docs/           Architecture notes, environment docs, plans, release notes
infra/          Local/dev infrastructure helpers
scripts/        Repository-level build/release scripts
```

Generated folders and packaged extensions must not be committed:

```txt
node_modules
.next
.turbo
.wrangler
.wxt
.output
dist
out
build
anidachi-extension-public
anidachi-extension-experiment
*.zip
*.crx
*.pem
.env*
```

The only allowed env-file exception is `.env.example`.

## Core Architecture

Anidachi has three planes.

### 1. Website / Control Plane

Lives in `apps/web`.

Responsibilities:

- user auth and sessions;
- profiles and avatars;
- durable room records;
- invite links and memberships;
- subscription/plan checks;
- extension auth handoff;
- future watch progress and watch history;
- marketing/SEO content.

The website owns durable business data. It should not run live playback sync.

### 2. Worker / Live Plane

Lives in `apps/api`.

Responsibilities:

- WebSocket room connections;
- Durable Object room state;
- live participant presence;
- host playback state;
- reactions/chat broadcast;
- P2P signaling;
- camera/voice status;
- short-lived ICE server config.

The Worker owns volatile live state. It should not store per-second playback state in
Postgres. It must not trust client-provided identity. Identity should come from verified
room tokens issued by the website.

### 3. Extension / Runtime Plane

Lives in `apps/extension`.

Responsibilities:

- video adapter detection;
- Crunchyroll/YouTube/generic playback control;
- Shadow DOM overlay UI;
- fullscreen overlay placement;
- keyboard shortcuts;
- camera/audio permissions;
- P2P media transport;
- reactions/chat rendering;
- source navigation and sync behavior.

The extension must never contain Supabase service-role keys, JWT signing secrets,
Cloudflare TURN secrets, Stripe secrets, or OAuth client secrets.

## Current Runtime Features

The extension currently includes:

- room creation and invite join flow;
- host-authoritative playback sync;
- reactions and lightweight chat modes;
- push-to-talk text input and voice input shortcuts;
- experimental P2P camera/audio transport;
- Cloudflare STUN/TURN fallback through the Worker `/ice-servers` endpoint;
- Crunchyroll/YouTube/generic video adapter work.

Ghost Cam and voice are separate concepts:

- Ghost Cam video must not publish microphone audio by default.
- Push-to-talk audio is a separate interaction and should visibly show who is speaking.
- Speech-to-text/dictation may request microphone permission, but it is not the same as
  enabling always-on voice chat.

P2P media is currently experimental. Treat it as a system that needs careful testing
around reconnects, tab refreshes, asymmetric joins, TURN fallback, and browser
permissions.

## Shared Protocol

Shared realtime types live in `packages/protocol`.

Rules:

- Define room events and payloads with Zod.
- Parse and validate all inbound room events.
- Prefer adding new protocol fields in a backward-compatible way.
- Do not duplicate protocol types inside the extension or Worker.
- Keep room, playback, P2P, reaction, and chat events typed end to end.

## Environments

Current environment model:

```txt
local       developer machine
preview     per PR / feature branch
staging     shared internal testing branch
production  public product on main
```

Production:

```txt
Website: https://www.anidachi.app
API:     https://anidachi-api-production.vladislav-gul7.workers.dev
WS:      wss://anidachi-api-production.vladislav-gul7.workers.dev
```

Staging:

```txt
Website: see docs/development-environments.md for the current protected Vercel URL
API:     https://anidachi-api-staging.vladislav-gul7.workers.dev
WS:      wss://anidachi-api-staging.vladislav-gul7.workers.dev
```

Staging is protected by an app-level password gate. The password is not committed.
The middleware is disabled for `VERCEL_ENV=production`, so it must not appear on
`www.anidachi.app`.

Supabase is currently used by the website for auth/data. A separate staging Supabase
project may be introduced later, but do not assume it exists until
`docs/development-environments.md` says so.

## Branching And Release Workflow

Use this flow:

```txt
feature/* or codex/* -> staging -> main
```

Rules:

- `main` is production.
- `staging` is the shared integration/testing branch.
- Create feature branches from `staging` unless there is a specific reason not to.
- Open PRs into `staging` first.
- Test staging manually with the staging extension build.
- Release to production through a reviewed PR from `staging` into `main`.
- Do not force-push protected branches.
- Do not bypass CI for production changes.

For small docs-only updates, it is acceptable to open a direct PR to `main` if the team
agrees and the change does not affect runtime behavior.

## Extension Build Model

There is one extension codebase with different endpoint bases per build.

Staging extension build must point to staging web/API/WS:

```txt
WXT_WEB_HTTP_BASE=<protected staging web URL>
WXT_API_HTTP_BASE=https://anidachi-api-staging.vladislav-gul7.workers.dev
WXT_API_WS_BASE=wss://anidachi-api-staging.vladislav-gul7.workers.dev
```

Production extension build must point to production web/API/WS:

```txt
WXT_WEB_HTTP_BASE=https://www.anidachi.app
WXT_API_HTTP_BASE=https://anidachi-api-production.vladislav-gul7.workers.dev
WXT_API_WS_BASE=wss://anidachi-api-production.vladislav-gul7.workers.dev
```

Do not mix staging and production endpoints inside one extension artifact. Always check
the debug panel or built bundle before sharing a zip.

## Local Setup

Install dependencies:

```bash
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install
```

Useful commands:

```bash
pnpm check
pnpm test
pnpm dev:web
pnpm dev:extension
pnpm dev:api
pnpm dev:demo
pnpm build:extension:public
```

The website dev server runs on:

```txt
http://localhost:3003
```

Extension dev output is normally loaded from:

```txt
apps/extension/.output/chrome-mv3-dev
```

Production/staging unpacked extension folders and zip files are build artifacts, not
source code. They should be regenerated, not edited manually.

## Manual Acceptance Checklist

Before merging runtime changes into production, test at least:

```txt
1. Sign in on the website.
2. Sign out on the website.
3. Sign in through the extension.
4. Open YouTube or Crunchyroll.
5. Create a room.
6. Copy invite link.
7. Join from another Chrome profile or device.
8. Confirm both participants appear.
9. Confirm chat/reactions render.
10. Confirm play/pause/seek sync.
11. Confirm P2P camera works both directions.
12. Hold V and confirm push-to-talk audio works both directions.
13. Confirm fullscreen overlay behavior.
14. Confirm debug panel points to the expected environment.
```

P2P stability is a known follow-up area. Passing the checklist once does not mean the
P2P implementation is production-hardened.

## Deployment Responsibilities

Website:

- hosted on Vercel;
- root directory is `apps/web`;
- production domain is `https://www.anidachi.app`;
- preview/staging behavior is controlled by branch and Vercel environment variables.

API:

- hosted on Cloudflare Workers;
- Durable Objects handle room state;
- deploy staging and production with Wrangler environments;
- Cloudflare TURN/STUN is exposed through `/ice-servers`.

Database/Auth:

- Supabase-backed website auth and room records;
- migrations live under `apps/web/supabase/migrations`;
- never use service-role keys in extension/client code.

Payments:

- Stripe Checkout is present;
- `STRIPE_WEBHOOK_SECRET` must be configured before relying on subscription webhook
  updates as source of truth.

## Security And Privacy Rules

Do not:

- commit secrets;
- expose service-role keys to the browser;
- request microphone permission for Ghost Cam;
- record or store webcam streams;
- host or proxy copyrighted video;
- bypass DRM;
- store live playback state in Postgres every second;
- add broad production permissions casually.

Do:

- keep camera/audio permissions explicit;
- keep P2P/TURN credentials server-side;
- validate room tokens server-side;
- keep extension endpoint bases environment-specific;
- document any new auth or deployment assumption.

## Known Follow-Ups

The monorepo migration and production release are complete, but these remain separate
product/engineering tasks:

- harden P2P reconnect, renegotiation, and asymmetric join timing;
- improve production-grade room lifecycle and cleanup;
- add durable social watch progress;
- decide if/when to split Supabase staging and production;
- finalize Stripe webhook configuration;
- prepare Chrome Web Store packaging and permissions review;
- keep `docs/development-environments.md` updated when staging URLs or environment
  variables change.

## How Another AI Agent Should Work Here

When picking up work:

1. Read this document.
2. Read `docs/development-environments.md`.
3. Check `git status --short --branch`.
4. Confirm the target branch and environment before editing.
5. Inspect the relevant app/package before changing code.
6. Keep changes scoped.
7. Prefer existing patterns.
8. Run the relevant checks.
9. Update docs if architecture, deployment, env vars, or workflow changes.
10. Never treat P2P, auth, rooms, and watch progress as isolated systems. They are
    connected through the room lifecycle and token model.
