# Project Knowledge Map

This document explains how to build and use a local Graphify map for Anidachi.
It is intentionally lightweight. Do not paste large generated graph reports into
git.

## Current Status

Graphify CLI is installed locally in the current development environment, but
`graphify-out/graph.json` is not committed and should stay local by default.

## Why Use It

Use Graphify before cross-plane changes where normal file search is not enough:

- extension auth and website auth handoff;
- room creation, join, connect, and end flow;
- Worker Durable Object room state;
- P2P signaling and WebRTC media;
- staging/main release automation;
- env/secret ownership.

## Output Policy

Default:

- keep `graphify-out/` local;
- do not commit generated HTML/JSON/cache outputs;
- commit only curated notes when they are reviewed and useful.

If a generated report uncovers a real architecture insight, summarize it here or
in the relevant plan instead of committing the whole generated report.

## Recommended First Graph

Run from the repository root:

```bash
graphify extract . --no-cluster
```

If the corpus is too large, run scoped passes:

```bash
graphify extract docs --no-cluster
graphify extract apps/web --out graphify-out/web --no-cluster
graphify extract apps/api --out graphify-out/api --no-cluster
graphify extract apps/extension --out graphify-out/extension --no-cluster
graphify extract packages/protocol --out graphify-out/protocol --no-cluster
```

Graphify writes outputs to `graphify-out/`.

To refresh an existing graph after code changes:

```bash
graphify update .
```

## Useful Queries

After a graph exists:

```bash
graphify query "How does extension auth connect apps/web and apps/extension?"
graphify query "Trace room token flow from room creation to Worker WebSocket join."
graphify query "Which files connect P2P signaling, room-client, and Durable Objects?"
graphify query "What release workflow paths affect staging and main?"
```

Use query results as navigation help, not as proof. Verify important claims
against source files before editing.
