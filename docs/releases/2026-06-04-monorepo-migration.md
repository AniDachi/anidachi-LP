# Monorepo Migration Release - 2026-06-04

## Summary

The Anidachi codebase was migrated into `AniDachi/anidachi-LP`, which is now the
single source of truth for the website, Chrome extension, Cloudflare API, demo app,
and shared protocol package.

This release establishes the team development workflow:

```txt
feature/codex branch -> staging -> production main
```

## Completed

- Migrated the website into `apps/web`.
- Added the WXT Chrome extension in `apps/extension`.
- Added the Cloudflare Worker and Durable Object room API in `apps/api`.
- Added the local HTML5 video demo in `apps/demo`.
- Added shared Zod protocol and sync types in `packages/protocol`.
- Switched the repository to pnpm 11.2.2 and Turborepo.
- Added CI/build workflows and release helper scripts.
- Configured Vercel to build the monorepo from `apps/web`.
- Configured staging and production Cloudflare Worker environments.
- Added protected staging documentation and app-level staging password gate.
- Confirmed Google/Discord OAuth redirects for the protected staging preview.
- Built and tested the staging extension artifact.
- Merged PR #2, `chore: migrate Anidachi to monorepo`, into `main`.
- Deployed the production website to `https://www.anidachi.app`.
- Deployed the production API to `https://anidachi-api-production.vladislav-gul7.workers.dev`.
- Built the production extension artifact.
- Tagged the release as `monorepo-migration-2026-06-04`.

## Release References

```txt
Repository:     AniDachi/anidachi-LP
Merged PR:      https://github.com/AniDachi/anidachi-LP/pull/2
Merge commit:   8422196 release: monorepo migration
Release tag:    monorepo-migration-2026-06-04
Production web: https://www.anidachi.app
Production API: https://anidachi-api-production.vladislav-gul7.workers.dev
Production WS:  wss://anidachi-api-production.vladislav-gul7.workers.dev
```

Local production extension artifact from the release checkpoint:

```txt
/Users/vladyslavhulyi/anidachi-LP-monorepo/artifacts/anidachi-extension-production-8422196.zip
```

Artifacts are build outputs and are intentionally not committed to git.

## Verified

- Production website responds with HTTP 200.
- Production API root responds with `{"ok":true,"service":"anidachi-api"}`.
- Production `/ice-servers` returns Cloudflare STUN/TURN configuration.
- Production `/api/me` returns HTTP 401 without authentication.
- Production `/api/rooms` returns HTTP 401 without authentication.
- Git `main` is clean and synchronized with `origin/main` after merge.

## What This Means

- New Anidachi work should happen in `AniDachi/anidachi-LP`.
- The legacy local repo is historical reference only.
- `main` is production.
- `staging` is the shared integration/testing branch.
- Feature branches should target `staging` first.
- Production releases should happen through a reviewed PR into `main`.
- Staging and production extension builds must use different `WXT_*` endpoint bases.

## Known Follow-Ups

These were intentionally not treated as blockers for the monorepo migration release:

- Harden P2P video/audio stability and reconnect behavior.
- Add `STRIPE_WEBHOOK_SECRET` before relying on Stripe subscription webhook events.
- Decide later whether to split Supabase into separate staging and production projects.
- Run full manual production product smoke with signed-in browser profiles:
  - website sign-in and sign-out;
  - extension sign-in;
  - room creation;
  - invite join from another browser/device;
  - participants, chat/reactions, playback sync;
  - P2P camera/audio behavior.

