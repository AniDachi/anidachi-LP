# AGENTS.md

This file is the short startup contract for AI and human contributors working on
AniDachi. Keep it concise. Put long explanations in `docs/`.

## Read First

Before making product changes, read these in order:

1. `docs/project-operating-manual.md`
2. `docs/current-development-state.md`
3. `docs/project-architecture-and-development.md`
4. The relevant active plan in `docs/superpowers/plans/`

For room, realtime, or P2P work, also read:

- `docs/superpowers/plans/2026-06-07-production-room-p2p-hardening-roadmap.md`
- `docs/superpowers/plans/2026-06-12-room-flow-p2p-flawless-execution-plan.md`

For development-process work, read:

- `docs/superpowers/plans/2026-06-17-development-flow-quality-system-plan.md`

## Git Flow

Normal flow:

```txt
feature/codex branch -> PR -> staging -> tested promotion PR -> main
```

Rules:

- Branch from latest `staging`.
- Open PRs into `staging` first.
- Never push directly to `main`.
- Never force-push `staging` or `main`.
- Do not revert unrelated user or collaborator changes.
- Production promotion happens only after staging acceptance for risky work.

Startup commands:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
git switch -c codex/task-name
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install --frozen-lockfile
```

## Project Planes

- `apps/web`: durable product state, auth, OAuth callbacks, rooms, Supabase,
  Stripe, invite/join pages, SEO, internal CRM tools.
- `apps/api`: Cloudflare Worker, Durable Objects, WebSocket room state, live
  sync, P2P signaling, ICE/TURN access.
- `apps/extension`: WXT Chrome extension, content scripts, overlay, video
  adapters, WebRTC media, push-to-talk.
- `packages/protocol`: shared room/event schemas and sync contracts.

If behavior crosses planes, define the protocol/contract first.

## Commands

Baseline:

```bash
node --version   # CI uses Node 22
pnpm --version   # repo expects pnpm 11.2.2
pnpm check
pnpm test
pnpm dev:check
```

Web:

```bash
pnpm --filter @anidachi/web check
pnpm --filter @anidachi/web test
pnpm dev:web
```

API / Worker:

```bash
pnpm --filter @anidachi/api check
pnpm --filter @anidachi/api test
pnpm harness:rooms
pnpm smoke:worker:staging
```

Extension:

```bash
pnpm --filter @anidachi/extension check
pnpm --filter @anidachi/extension test
pnpm build:extension:staging
pnpm validate:extension:staging
```

Real WebRTC harness:

```bash
npm --prefix tests/e2e install
npm --prefix tests/e2e exec playwright install chromium
npm --prefix tests/e2e run harness:p2p
```

## Safety Rules

- Do not commit secrets, `.env*`, `.dev.vars*`, debug exports, extension zips,
  generated extension folders, local browser profiles, or `graphify-out/`.
- Staging must stay password-gated, noindex, excluded from sitemap, and absent
  from production SEO/marketing pages.
- Store-safe extension builds must keep narrow host permissions. Broad extension
  permissions are local-only.
- The extension must never receive service-role keys, OAuth secrets, JWT signing
  secrets, Stripe secrets, Cloudflare API tokens, or TURN secrets.
- AI-generated code is untrusted until tests, review, and project-specific
  checks pass.

## Done Means

Docs-only:

- Documentation links remain accurate.
- Active docs do not contradict `docs/current-development-state.md`.

Site/UI:

- Relevant web checks pass.
- Visual behavior is inspected on the correct environment.

Auth/API/payments:

- Unit/API checks pass.
- Env and secret impact is documented.
- Staging smoke is run where applicable.

Extension:

- Extension check/test pass.
- Staging artifact is built and validated if behavior changed.
- Permissions remain channel-appropriate.

Room/P2P/Worker:

- API tests and room harness pass.
- Real-WebRTC harness or staging manual test is used for media changes.
- Progress is recorded in the active P2P plan.

Release/deploy:

- CI status is understood.
- Rollback path is known before promotion.
