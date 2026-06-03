# Anidachi Development Environments

This document explains how Anidachi development, staging, and production are separated.
It is the shared reference for the team before testing or releasing changes.

## Source Of Truth

```txt
Primary repo: AniDachi/anidachi-LP
Main local checkout: /Users/vladyslavhulyi/anidachi-LP-monorepo
Legacy local repo: /Users/vladyslavhulyi/anidachi
```

Use the primary repo for new product work. The legacy local repo should only be used as
historical reference until the production migration is complete.

## Branch Model

```txt
feature/* or codex/* -> staging -> main
```

- `main` is production.
- `staging` is the shared integration/testing branch.
- Feature branches should normally branch from `staging`.
- Open PRs into `staging` first.
- After staging is tested, open a release PR from `staging` into `main`.
- `main` and `staging` are protected: PR review, CI, conversation resolution, and no force-push/delete.

## Website Environments

### Production Website

```txt
https://www.anidachi.app
https://anidachi.app
```

Production is public and must stay stable. Real users should only use the production site.

### Staging Website

Current fast staging uses a protected Vercel preview alias:

```txt
https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app
```

This URL is protected by Vercel deployment protection and returns HTTP 401 until the
viewer authenticates with Vercel. It also sends `x-robots-tag: noindex`.

Do not attach `staging.anidachi.app` yet. On the current Vercel setup, deployment
protection does not protect custom domains. A public staging custom domain should only
be added after one of these is true:

- `anidachi.app` DNS is managed in Cloudflare and Cloudflare Access protects staging;
- Vercel deployment protection covers the custom staging domain;
- the app has explicit staging auth middleware.

## API Environments

### Production API

```txt
https://anidachi-api-production.vladislav-gul7.workers.dev
wss://anidachi-api-production.vladislav-gul7.workers.dev
```

### Staging API

```txt
https://anidachi-api-staging.vladislav-gul7.workers.dev
wss://anidachi-api-staging.vladislav-gul7.workers.dev
```

Both Workers use Cloudflare TURN/STUN through `/ice-servers`.

## Extension Builds

There is one extension codebase and two kinds of builds.

### Staging Extension

Used for internal testing only. It is loaded manually as an unpacked Chrome extension or
downloaded from the GitHub Actions artifact:

```txt
anidachi-extension-staging
```

Current staging build environment:

```txt
WXT_WEB_HTTP_BASE=https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app
WXT_API_HTTP_BASE=https://anidachi-api-staging.vladislav-gul7.workers.dev
WXT_API_WS_BASE=wss://anidachi-api-staging.vladislav-gul7.workers.dev
```

### Production Extension

Used for public release. Later this should be the Chrome Web Store version.

Expected production build environment:

```txt
WXT_WEB_HTTP_BASE=https://www.anidachi.app
WXT_API_HTTP_BASE=https://anidachi-api-production.vladislav-gul7.workers.dev
WXT_API_WS_BASE=wss://anidachi-api-production.vladislav-gul7.workers.dev
```

## OAuth Redirects

Production OAuth redirect URLs must remain in Google and Discord.

Staging OAuth redirect URLs must be added before staging login can be tested:

```txt
Google:
https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app/api/auth/callback/google

Discord:
https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app/api/auth/callback/discord
```

Adding staging redirects does not break production as long as production redirects are
not removed or edited.

## What Can Be Tested Before OAuth Redirects

These are not blocked:

- Vercel preview builds.
- Vercel deployment protection and noindex headers.
- Cloudflare Worker health.
- Cloudflare `/ice-servers`.
- Extension typecheck/tests/build.
- Static website rendering after Vercel authentication.

These are blocked until OAuth redirects are added:

- Google/Discord sign-in on staging.
- `/api/me` authenticated staging smoke test.
- Extension sign-in against staging.
- Room creation through authenticated website API.
- Full invite flow through staging web auth.

## Staging Acceptance Checklist

Run this after OAuth redirects are added.

```txt
1. Open the protected Vercel preview URL.
2. Authenticate through Vercel protection.
3. Sign in with Google or Discord.
4. Open /api/me and confirm user JSON is returned.
5. Sign out and confirm /api/me returns 401.
6. Load the latest anidachi-extension-staging artifact.
7. Sign in through the extension.
8. Open YouTube or Crunchyroll.
9. Create a room.
10. Copy invite.
11. Join from a second Chrome profile or second device.
12. Confirm both participants appear.
13. Confirm P2P video works both directions.
14. Hold V and confirm push-to-talk audio works both directions.
15. Confirm play, pause, and seek sync.
16. Confirm reactions/chat render.
17. Confirm debug info shows staging web/API bases.
```

## Production Release Checklist

Only run after staging acceptance passes.

```txt
1. Mark the migration PR ready for review.
2. Get approval.
3. Merge into main.
4. Confirm Vercel production deployment succeeds.
5. Confirm production Worker responds.
6. Build/download production extension artifact.
7. Smoke test website sign-in on www.anidachi.app.
8. Smoke test production extension room creation and join.
9. Tag the migration release.
```

