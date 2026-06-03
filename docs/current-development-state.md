# Current Development State

Last updated: 2026-06-04.

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

Canonical local repository:

```txt
/Users/vladyslavhulyi/anidachi-LP-monorepo
```

The older local project folder is legacy context only:

```txt
/Users/vladyslavhulyi/anidachi
```

Do not continue new product development from the legacy folder unless it is being
used only to inspect old state.

## Branches And Protection

`staging` is the fast integration branch for tester builds.

- Required status check: `check-and-test`
- Required approvals: `0`
- Strict up-to-date branch requirement: off
- Conversation resolution requirement: off
- Force pushes: blocked
- Branch deletion: blocked
- Admin enforcement: on

`main` is the production branch.

- Required status check: `check-and-test`
- Required approvals: `1`
- Dismiss stale approvals: on
- Strict up-to-date branch requirement: on
- Conversation resolution requirement: on
- Force pushes: blocked
- Branch deletion: blocked
- Admin enforcement: on

Normal flow:

```txt
feature branch -> PR -> staging -> tester build -> PR/promotion -> main -> public build
```

## Runtime Environments

Local development:

```txt
Web: http://localhost:3003
API: http://127.0.0.1:8787
WS:  ws://127.0.0.1:8787
```

Staging:

```txt
Web: https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app
API: https://anidachi-api-staging.vladislav-gul7.workers.dev
WS:  wss://anidachi-api-staging.vladislav-gul7.workers.dev
```

Production:

```txt
Web: https://www.anidachi.app
API: https://anidachi-api-production.vladislav-gul7.workers.dev
WS:  wss://anidachi-api-production.vladislav-gul7.workers.dev
```

The custom Cloudflare Worker domain should eventually hide the account subdomain,
but the current Worker URLs above are the active endpoints.

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
pnpm build:extension:public
```

The same source code produces both store builds. The channel-specific behavior is
selected through build environment variables in the build scripts.

## Current Staging Store Artifact

The latest staging artifact was generated from commit `6be6f82`:

```txt
/Users/vladyslavhulyi/anidachi-LP-monorepo/anidachi-extension-staging.zip
/Users/vladyslavhulyi/anidachi-LP-monorepo/artifacts/anidachi-extension-staging-6be6f82.zip
```

Manifest checks:

```txt
name: Anidachi Staging
version_name: 6be6f82-staging-20260604040825
```

The staging Chrome Web Store reviewer/tester access code is stored in the Chrome
Web Store testing instructions, not in git.

## Current Product Behavior

The extension currently supports:

- YouTube and Crunchyroll content-script overlay;
- Anidachi bubble and compact room panel;
- sign-in through the web app with Google/Discord;
- room creation and invite copying through the website/API/Worker flow;
- WebSocket room join and playback sync;
- reactions and live chat input;
- Ghost Cam camera bubbles;
- push-to-talk audio;
- WebRTC P2P media with Cloudflare TURN fallback;
- debug export from the extension panel.

The extension still does not host, proxy, record, or distribute source video.

## Known Fragile Areas

These are intentionally not treated as solved:

- P2P media reconnect and asymmetric join timing can still be fragile.
- Room lifecycle and P2P source-generation hardening are planned but not fully
  complete.
- Watch progress persistence and friend/group progress are planned architecture,
  not finished product behavior.
- Custom API domain for hiding the Cloudflare account subdomain is deferred.
- Stripe production webhook appears wired, but end-to-end subscription testing is
  still a separate follow-up.

## Documentation Map

- Current operational state: `docs/current-development-state.md`
- Overall architecture notes: `docs/architecture.md`
- Extension release channels: `docs/extension-release-channels.md`
- Site and extension integration: `docs/site-extension-integration-notes.md`
- P2P and experimental features: `docs/experimental-features.md`
- Commercial room/P2P/progress plan:
  `docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md`
- Monorepo migration history:
  `docs/superpowers/plans/2026-06-03-main-repository-monorepo-migration.md`
