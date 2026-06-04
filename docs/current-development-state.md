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

## Current Staging Store Artifact

The latest staging artifact was generated from commit `6be6f82`:

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

- Project operating manual: `docs/project-operating-manual.md`
- Project architecture and development workflow:
  `docs/project-architecture-and-development.md`
- Current operational state: `docs/current-development-state.md`
- Overall architecture notes: `docs/architecture.md`
- Extension release channels: `docs/extension-release-channels.md`
- Site and extension integration: `docs/site-extension-integration-notes.md`
- P2P and experimental features: `docs/experimental-features.md`
- Commercial room/P2P/progress plan:
  `docs/superpowers/plans/2026-06-03-commercial-room-p2p-progress-architecture.md`
- Monorepo migration history:
  `docs/superpowers/plans/2026-06-03-main-repository-monorepo-migration.md`
