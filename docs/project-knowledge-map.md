# Project Knowledge Map

This document explains how to build and use the Graphify map for Anidachi. It is
the project knowledge graph for agents and developers.

## Current Status

Graphify is an official development aid for Anidachi. The repo provides pnpm
scripts for common commands and commits a small set of team graph artifacts so
every agent starts with the same project map.

Current policy:

- commit `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md` when
  present, and `graphify-out/manifest.json`;
- do not commit `graphify-out/cost.json`, HTML exports, scoped scratch graphs,
  cache files, Obsidian/wiki exports, converted sidecars, or local memory files;
- curated conclusions should still be documented in human docs when they affect
  decisions;
- Graphify is not a required CI check.

If `graphify-out/graph.json` exists, agents should query it before broad
architecture reads.

Observed local status on 2026-06-23:

- Graphify CLI is installed via `uv tool` in the current development
  environment and upgraded to `0.8.44`.
- Codex project integration is installed under `.codex/`.
- Codex `multi_agent = true` is enabled in the local `~/.codex/config.toml`.
- Code graph baseline is maintained with `graphify update . --no-cluster`.
- Post-commit and post-checkout hooks are intentionally uninstalled locally to
  avoid dirtying `graphify-out/` during normal checkout/commit work.
- The Graphify merge driver is installed locally for `graphify-out/graph.json`.

## Why Use It

Use Graphify before cross-plane changes where normal file search is not enough:

- extension auth and website auth handoff;
- room creation, join, connect, and end flow;
- Worker Durable Object room state;
- P2P signaling and WebRTC media;
- staging/main release automation;
- env/secret ownership.

## Output Policy

Commit:

- `graphify-out/graph.json`
- `graphify-out/GRAPH_REPORT.md` when generated
- `graphify-out/manifest.json`

Keep local:

- `graphify-out/cache/`
- `graphify-out/cost.json`
- `graphify-out/*.html`
- `graphify-out/scopes/`
- `graphify-out/memory/`
- `graphify-out/obsidian/`
- `graphify-out/wiki/`
- `graphify-out/converted/`
- full AST/semantic cache files unless the team intentionally decides to commit
  them for speed after confirming they do not expose local absolute paths.

If a generated report uncovers a real architecture insight, summarize it in the
relevant plan or architecture doc instead of relying only on generated output.

## Recommended Setup Per Machine

Graphify should be installed outside the repo, preferably with `uv tool` or
`pipx`. The CLI command is `graphify`.

Check the local install:

```bash
uv tool install --upgrade graphifyy
graphify --help
graphify install --project --platform codex
```

For Codex, enable subagents once per machine:

```toml
[features]
multi_agent = true
```

This belongs in `~/.codex/config.toml`. Restart Codex after changing it.

Install the merge driver once per clone and keep git hooks disabled by default:

```bash
pnpm graph:hook:uninstall
pnpm graph:hook:status
pnpm graph:merge-driver:install
```

`.gitattributes` marks `graphify-out/graph.json` to use Graphify's merge driver
so parallel graph updates are union-merged instead of leaving conflict markers.
Git hooks are a local opt-in only; they are useful for people who want automatic
refreshes, but they also dirty `graphify-out/` during routine branch switches and
commits. The default project workflow is manual updates.

## Baseline Graph

Default code baseline, no LLM backend required:

```bash
pnpm graph:baseline
```

This creates or refreshes `graphify-out/graph.json` from code relationships.

Full Codex semantic graph, no separate backend key required:

```txt
$graphify .
```

Use this inside Codex when docs, plans, diagrams, or images need to be part of
the graph. Codex uses the active model session and subagents.

Headless semantic graph for CLI/CI:

```bash
pnpm graph:extract
```

Headless `graphify extract` is different from `$graphify`: it needs a supported
Graphify backend when docs, PDFs, or images are present. Code-only extraction
runs locally without a key.

If the corpus is too large or a task only needs one plane, run scoped passes
outside the committed tree or inside ignored `graphify-out/scopes/`:

```bash
graphify extract apps/web --out graphify-out/scopes/web --no-cluster
graphify extract apps/api --out graphify-out/scopes/api --no-cluster
graphify extract apps/extension --out graphify-out/scopes/extension --no-cluster
graphify extract packages/protocol --out graphify-out/scopes/protocol --no-cluster
```

With `--out graphify-out/scopes/api`, Graphify writes to
`graphify-out/scopes/api/graphify-out/`.

## Keeping The Graph Current

Use manual updates as the default:

1. Before broad architecture, auth, room, P2P, Worker, CI, or release-flow work,
   query the existing graph:

```bash
pnpm graph:query "Trace room token flow from web to Worker WebSocket join."
```

2. After meaningful code or architecture changes, refresh the code graph:

```bash
pnpm graph:update
```

3. For docs/semantic changes in Codex, use the Codex-hosted extraction path:

```txt
$graphify . --update
```

`pnpm graph:update` uses `graphify update . --no-cluster`, so it is fast and
does not require an LLM backend for code changes.

Watcher and git hooks are local opt-ins only:

```bash
pnpm graph:watch
pnpm graph:hook:install
```

Check whether Graphify thinks a manual update is pending:

```bash
pnpm graph:check-update
```

Do not fully re-extract on every small change. Use full extraction after major
refactors, after Graphify upgrades, or if the graph becomes obviously stale.

## Pull Request Rule

For room/P2P/auth/Worker/CI/release-flow PRs, include a short note in the PR:

```txt
Graphify:
- graph updated: yes/no
- queries used:
  - ...
- source files manually verified:
  - ...
```

Graphify is navigation help, not proof. Important claims still need source,
tests, and staging verification.

## Useful Queries

After a graph exists:

```bash
pnpm graph:query "How does extension auth connect apps/web and apps/extension?"
pnpm graph:query "Trace room token flow from room creation to Worker WebSocket join."
pnpm graph:query "Which files connect P2P signaling, room-client, and Durable Objects?"
pnpm graph:query "What release workflow paths affect staging and main?"
```

Use query results as navigation help, not as proof. Verify important claims
against source files before editing.

## Current Anidachi Queries To Run Before P2P Block 6

Before implementing the next room/P2P block, run:

```bash
pnpm graph:update
pnpm graph:query "Trace P2P signaling from extension to Durable Object and back."
pnpm graph:query "Which files affect sourceGeneration, roomGeneration, and stale event drops?"
pnpm graph:query "Which files affect Durable Object WebSocket hibernation and room alarms?"
pnpm graph:query "Which files affect quota metering between web, Worker, and extension?"
```

Record the useful results in the P2P plan or PR, not in `graphify-out/`.
