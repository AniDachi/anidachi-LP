# AniDachi New Chat Project Context

Last updated: 2026-07-07.

Use this file as a quick handoff for a fresh AI chat or a new developer. It is
not a replacement for the canonical docs; it is a map of what to read, how the
system is split, what is currently active, and which rules must not be broken.

## First Read Order

Read these before changing product code:

1. `AGENTS.md`
2. `docs/project-operating-manual.md`
3. `docs/current-development-state.md`
4. `docs/project-architecture-and-development.md`
5. The relevant active plan under `docs/superpowers/plans/`
6. `docs/development-quality-gates.md` for required checks and evidence

For room, realtime, extension media, or P2P work, also read:

- `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`

For friends, groups, invites, subscriptions, watch library, and dashboard work,
read:

- `docs/superpowers/plans/2026-06-20-social-rooms-subscriptions-execution-plan.md`

For development-flow/process work, read:

- `docs/superpowers/plans/2026-06-17-development-flow-quality-system-plan.md`
- `docs/project-knowledge-map.md`

There is also `docs/ai-site-development-handoff.md`, but that document is
site-page focused. Do not use it as the main source for extension, Worker,
room, billing, or P2P decisions.

## Development Quality System

AniDachi uses layered agent instructions:

- root `AGENTS.md` for project-wide rules;
- `apps/web/AGENTS.md` for durable web/auth/billing/product state;
- `apps/api/AGENTS.md` for Worker, Durable Objects, live rooms, and signaling;
- `apps/extension/AGENTS.md` for WXT/MV3 runtime, overlay, providers, and P2P;
- `packages/protocol/AGENTS.md` for shared schemas and event contracts.

Use `docs/development-quality-gates.md` before opening PRs. It maps each change
type to required checks, staging evidence, docs updates, Graphify updates, and
PR notes. Do not rely on this handoff as the only rule source; it is a map to
the canonical instructions and docs.

## What AniDachi Is

AniDachi is a monorepo for:

- a public/staging web app and account dashboard;
- a Chrome extension that runs on supported video sites;
- a Cloudflare Worker realtime API with Durable Object rooms;
- shared room/event protocol schemas;
- Supabase persistence, Stripe billing, OAuth login, and internal tooling.

The product lets people watch provider-hosted video together. AniDachi does not
host, proxy, record, or redistribute source video. Every user watches the source
video on their own provider page; AniDachi synchronizes room state, playback,
chat/reactions, push-to-talk audio, and ultra-light P2P camera bubbles.

## Three-Plane Architecture

Think about every feature as one of three planes:

```txt
Control plane: apps/web + Supabase
Live plane:    apps/api + Durable Objects + WebSockets
Runtime plane: apps/extension inside the user's browser
```

`apps/web` owns durable product state:

- users, profiles, sessions, OAuth callbacks;
- extension auth exchange;
- room records and room membership;
- invite/join pages;
- friends, groups, inbox, watch library, and dashboard data;
- Stripe checkout, webhooks, subscriptions, and entitlements;
- Supabase access through server-side code only.

`apps/api` owns live room state:

- Cloudflare Worker HTTP/WS entry points;
- Durable Object per room;
- live participants and host playback state;
- chat, reactions, sync, P2P signaling;
- short-lived ICE/TURN payloads;
- room telemetry and hibernation-safe state.

`apps/extension` owns browser runtime behavior:

- WXT MV3 Chrome extension;
- content scripts and Shadow DOM overlay;
- Crunchyroll/provider adapters;
- popup/watch library UI;
- player detection and player control;
- Ghost Cam video bubbles;
- push-to-talk audio;
- P2P media controller and WebRTC peer connections;
- local caches for speed, with server sync for durable state.

`packages/protocol` owns shared contracts:

- Zod schemas and TypeScript types;
- room event payloads;
- playback state shapes;
- server snapshots;
- P2P signaling contracts.

If a feature crosses planes, define or update the protocol/contract first.

## Runtime Environments

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

Production:

```txt
Web: https://www.anidachi.app
API: https://anidachi-api-production.vladislav-gul7.workers.dev
WS:  wss://anidachi-api-production.vladislav-gul7.workers.dev
```

Staging is internal tester infrastructure. It must stay password-gated,
noindex, excluded from sitemap output, and absent from public SEO/marketing
pages. It may appear in internal docs, env vars, OAuth allowlists, and staging
extension builds.

## Git And Release Flow

Normal flow:

```txt
feature/codex branch -> PR -> staging -> tested promotion PR -> main
```

Rules:

- Work from latest `staging`.
- Use scoped feature branches, normally `codex/<task-name>` for Codex work.
- Open PRs into `staging` first.
- Never push directly to `main`.
- Never force-push `staging` or `main`.
- Do not revert unrelated human or collaborator changes.
- Production promotion happens only after staging acceptance for risky work.

Startup:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
git switch -c codex/task-name
fnm use --install-if-missing
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install --frozen-lockfile
```

Before finishing, check branch and worktree cleanliness:

```bash
git status --short --branch
```

## Historical Working Baseline

This snapshot is historical context only. Re-check current branch, remote refs,
and `docs/current-development-state.md` before treating any SHA as current.

As of the original 2026-07-05 handoff, the local repo was on:

```txt
branch: staging
remote: origin/staging
latest merge: 10d01ce Merge pull request #119 from AniDachi/codex/restore-extension-wip-20260703
```

PR #119 fixed same-room reconnect camera blink by keeping the P2P media session
alive across transient room reconnect states. The important files from that fix:

- `apps/extension/src/overlay-media-session.ts`
- `apps/extension/src/overlay-app.tsx`
- `apps/extension/src/ghost-cam.ts`
- `apps/extension/src/overlay-media-session.test.ts`
- active P2P plan progress logs

The fix was verified with extension check/test, staging extension build,
staging artifact validation, and real WebRTC harness.

If you start later, re-check the current `staging` state instead of assuming
this SHA is still the latest.

## Current Product Focus

The active work is mostly:

- extension stability on Crunchyroll;
- P2P video/audio reliability;
- push-to-talk correctness;
- room reconnect and source/episode switching;
- watch library and progress tracking;
- friends, groups, recent co-watchers, invites, and dashboard sync;
- clean staging artifacts for real two-device testing.

The recent P2P direction is:

- P2P-only media; legacy LiveKit runtime is removed;
- keep video intentionally ultra-light;
- support up to 4 media seats, while larger rooms can have chat-only users;
- voice must work independently from camera visibility;
- do not add user-facing reconnect buttons for normal media recovery;
- use diagnostics and automatic recovery before asking the user to act.

## Important Extension/P2P Decisions

- The extension should feel fast by showing local/cache state immediately, then
  reconciling with the server.
- Local extension cache must be account-scoped. Switching accounts must not show
  stale watch history or stale room state from the previous account.
- Website sign-out and extension sign-out must stay synchronized enough that
  the UI does not lie about the current user.
- The overlay/popup should avoid flicker during short auth/session refreshes.
- P2P media must not be tied to transient WebSocket `connecting` states.
- Camera recovery must not publish false `CAMERA_OFF -> CAMERA_ON` flaps.
- Push-to-talk should keep mic intent while the key is physically held, even
  through harmless focus/blur transitions.
- Remote mic indicators must be based on explicit voice intent plus WebRTC
  audio flow, not on stray RTP/DTX movement alone.
- Debug exports are the primary way to understand real two-client bugs.

## Where To Look By Task

Auth/session and extension identity:

- `apps/extension/src/auth-client.ts`
- `apps/extension/src/user-identity.ts`
- `apps/extension/src/silent-session-adoption.ts`
- `apps/web/app/api/extension/auth/*`
- `apps/web/lib/anidachi-auth/*`

Overlay, popup, layout, and Crunchyroll UI integration:

- `apps/extension/src/overlay-app.tsx`
- `apps/extension/src/overlay-layout.ts`
- `apps/extension/src/styles.ts`
- `apps/extension/src/ghost-cam.ts`
- `apps/extension/src/ghost-cam-size.ts`
- `apps/extension/src/content.ts`
- `apps/extension/src/popup-app.tsx`

P2P media, ICE/TURN, audio/video:

- `apps/extension/src/p2p-media.ts`
- `apps/extension/src/p2p-ice.ts`
- `apps/extension/src/media-types.ts`
- `apps/api/src/ice-servers.ts`
- `apps/api/src/index.ts`
- `tests/e2e/p2p-media-harness.mjs`

Room client, Worker live state, signaling:

- `apps/extension/src/room-client.ts`
- `apps/api/src/index.ts`
- `apps/api/src/room-state.ts`
- `apps/api/src/room-persistence.ts`
- `apps/api/src/p2p-signal-buffer.ts`
- `packages/protocol/src/types.ts`

Room creation/join/end on web:

- `apps/web/app/api/rooms/route.ts`
- `apps/web/app/api/rooms/[roomId]/join/route.ts`
- `apps/web/app/api/rooms/[roomId]/connect/route.ts`
- `apps/web/app/api/rooms/[roomId]/end/route.ts`
- `apps/web/app/room/[roomId]/*`

Watch library and progress tracking:

- `apps/extension/src/watch-progress.ts`
- `apps/extension/src/watch-library-client.ts`
- `apps/extension/src/crunchyroll-progress.ts`
- `apps/extension/src/crunchyroll-season.ts`
- `apps/web/lib/anidachi-auth/watch-library.ts`
- dashboard/watch-library routes under `apps/web/app/*`

Friends, groups, invites, and social:

- `apps/extension/src/social-client.ts`
- `apps/web/lib/anidachi-auth/social.ts`
- `apps/web/app/friends/*`
- social/dashboard APIs under `apps/web/app/api/*`
- `docs/superpowers/plans/2026-06-20-social-rooms-subscriptions-execution-plan.md`

Billing/subscriptions:

- `apps/web/lib/anidachi-auth/plan-entitlements.ts`
- `apps/web/lib/anidachi-auth/stripe-subscription-sync.ts`
- `apps/web/app/api/create-checkout-session/route.ts`
- `apps/web/app/api/stripe/webhook/route.ts`
- `docs/environment-and-secrets-matrix.md`
- `docs/social-pricing-model.md`

Environment, deploy, release:

- `docs/current-development-state.md`
- `docs/development-environments.md`
- `docs/environment-and-secrets-matrix.md`
- `docs/staging-acceptance-checklist.md`
- `.github/workflows/*`

Knowledge graph:

- `docs/project-knowledge-map.md`
- `graphify-out/graph.json`
- `graphify-out/GRAPH_REPORT.md`
- `graphify-out/manifest.json`

Quality gates and agent rules:

- `docs/development-quality-gates.md`
- `AGENTS.md`
- `apps/web/AGENTS.md`
- `apps/api/AGENTS.md`
- `apps/extension/AGENTS.md`
- `packages/protocol/AGENTS.md`

## Verification Commands

Baseline:

```bash
pnpm check
pnpm test
pnpm dev:check
```

Extension:

```bash
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm build:extension:staging
pnpm validate:extension:staging
```

API / Worker:

```bash
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/api test
pnpm harness:rooms
pnpm smoke:worker:staging
```

Real WebRTC harness:

```bash
npm --prefix tests/e2e install
npm --prefix tests/e2e exec playwright install chromium
npm --prefix tests/e2e run harness:p2p
```

Web:

```bash
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
pnpm dev:web
```

Staging health checks that are often useful:

```bash
curl -I https://staging.anidachi.app
pnpm smoke:worker:staging
pnpm validate:extension:staging
```

## Staging Extension Artifacts

Generated extension folders and zips are build artifacts, not source. Do not
commit them.

Common local artifact paths:

```txt
anidachi-extension-staging/
anidachi-extension-staging.zip
artifacts/anidachi-extension-staging-<sha>.zip
```

For real tester builds:

1. Build with `pnpm build:extension:staging`.
2. Validate with `pnpm validate:extension:staging`.
3. Load the generated unpacked folder in Chrome.
4. Confirm manifest name is `Anidachi Staging`.
5. Confirm debug info points to staging web/API/WS.

For the Windows second-client setup, previous prepared builds were copied under:

```txt
C:\Users\vladi\AnidachiTest\
```

Re-check the current Windows host and artifact version before assuming that
folder is still current.

## Debug Logs And P2P Diagnosis

For P2P bugs, ask for full debug exports from both participants close to the
bug. The overlay debug area is designed to export a compact or full recent log
window. Full exports contain richer event data; compact exports are easier to
scan quickly.

When analyzing logs, look for:

- auth/session transitions;
- room connect/reconnect states;
- `CAMERA_ON` / `CAMERA_OFF`;
- `voice-start` / `voice-stop`;
- P2P signal offer/answer/ICE flow;
- selected candidate pair direct vs relay;
- inbound audio/video stats;
- media-stall recovery reasons;
- participant/session/generation mismatches.

Do not diagnose real P2P reliability only from same-machine tests. Same-machine
tests are smoke tests. Product confidence needs at least two profiles/devices,
and preferably different networks or VPN-free remote machines.

## Graphify Usage

Graphify is available as the local knowledge graph. Before broad architecture,
auth, room, P2P, Worker, CI, or release-flow work, query it first:

```bash
pnpm graph:query "Trace room token flow from web to Worker WebSocket join."
graphify query "Which files connect P2P signaling, room-client, and Durable Objects?"
graphify explain "P2PMediaController"
```

Graphify is navigation help, not proof. Verify important claims against source
files, tests, and docs.

After meaningful code or architecture changes:

```bash
pnpm graph:update
```

Do not commit local Graphify scratch outputs. Only team graph artifacts from
`graphify-out/` are allowed when intentionally refreshed: `graph.json`,
`GRAPH_REPORT.md`, and `manifest.json`.

## External Docs Rule

Use Context7 MCP for current documentation when the task involves a library,
framework, SDK, API, CLI tool, or cloud service. This includes React, Next.js,
WXT, Chrome extension APIs, Cloudflare Workers/Durable Objects, Vercel,
Supabase, Stripe, Playwright, and similar dependencies.

For WebRTC/browser behavior, prefer primary sources such as MDN, W3C WebRTC
specs, Chrome extension docs, Cloudflare docs, and provider docs. Treat blogs as
secondary.

## Safety Rules

- Do not commit secrets, `.env*`, `.dev.vars*`, debug exports, extension zips,
  generated extension folders, local browser profiles, or local-only graph
  outputs.
- The extension must never receive service-role keys, OAuth secrets, JWT signing
  secrets, Stripe secrets, Cloudflare API tokens, or TURN secrets.
- Staging must remain gated and noindexed.
- Store-safe extension builds must keep narrow host permissions. Broad
  permissions are local-only.
- Do not add temporary hacks or half-measures without clearly marking them.
- Do not silently change product rules; discuss major UX/business logic changes
  first.
- Keep the worktree clean after each task. Generated files should be either
  ignored, deleted, or intentionally documented.

## New Chat Startup Checklist

1. Read this file.
2. Read `AGENTS.md`.
3. Check current branch and cleanliness:

   ```bash
   git status --short --branch
   git log --oneline --decorate -5
   ```

4. Sync from `staging` before new work:

   ```bash
   git fetch origin
   git switch staging
   git pull --ff-only origin staging
   ```

5. Read the relevant active plan.
6. Use Graphify for cross-plane orientation.
7. Make a scoped branch.
8. Run focused checks before claiming work is done.
9. For extension/P2P changes, build and validate the staging artifact.
10. Record docs/Graphify/staging status in the PR template.
11. Record important progress in the active plan.
