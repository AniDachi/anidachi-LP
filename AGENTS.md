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

## Knowledge Graph

Graphify is the local project knowledge graph. Use it before broad
architecture, auth, room, P2P, Worker, CI, or release-flow changes.

Setup per machine:

```bash
uv tool install graphifyy
graphify install --platform codex
pnpm graph:baseline
pnpm graph:hook:install
pnpm graph:hook:status
pnpm graph:merge-driver:install
```

Codex must have `multi_agent = true` under `[features]` in
`~/.codex/config.toml` for full `$graphify` semantic extraction.

Daily use:

```bash
graphify query "Trace room token flow from web to Worker WebSocket join."
pnpm graph:update
pnpm graph:query "Trace room token flow from web to Worker WebSocket join."
pnpm graph:watch
```

Rules:

- If `graphify-out/graph.json` exists, query it before doing wide file reads
  for architecture questions.
- Commit only team graph artifacts from `graphify-out/`: `graph.json`,
  `GRAPH_REPORT.md`, and `manifest.json`.
- Do not commit `graphify-out/cost.json`, HTML exports, scoped scratch graphs,
  cache files, Obsidian/wiki exports, or other local generated files.
- The post-commit hook keeps code relationships fresh; docs/semantic changes
  can still need a manual `$graphify . --update` in Codex.
- `.gitattributes` marks `graphify-out/graph.json` for Graphify's merge
  driver. Run `pnpm graph:merge-driver:install` once per clone.
- `$graphify .` in Codex uses the active Codex session and does not require a
  separate LLM backend key. Headless `pnpm graph:extract` is different: it needs
  a configured backend when docs, PDFs, or images are present.
- Record useful Graphify queries in PRs for room/P2P/auth/Worker/CI changes.
- Treat Graphify as navigation help. Verify important claims against source.

## Safety Rules

- Do not commit secrets, `.env*`, `.dev.vars*`, debug exports, extension zips,
  generated extension folders, local browser profiles, or local-only
  `graphify-out/` outputs.
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community
structure, and cross-file relationships.

When the user types `$graphify` in Codex, use the Graphify skill before doing
anything else. `/graphify` is the equivalent command in assistants that support
slash commands.

Rules:
- For codebase questions, first run `graphify query "<question>"` when
  graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for
  relationships and `graphify explain "<concept>"` for focused concepts. These
  return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw
  grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates;
  dirty graph files are not a reason to skip graphify. Only skip graphify if
  the task is about stale or incorrect graph output, or the user explicitly says
  not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of
  raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when
  query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current
  (AST-only, no API cost).
