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
ee

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

Current fast staging uses the stable Vercel branch preview alias:

```txt
https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app
```

This URL is protected by the app-level staging password gate, not by Vercel
Authentication. The gate returns HTTP 401 with the `Anidachi staging` password page
until the viewer enters the shared staging password. A successful login sets the
`anidachi_staging_access` HttpOnly cookie for roughly 30 days, so the same browser is
remembered.

The current password itself is intentionally not stored in git. Vercel stores only the
SHA-256 hash and the cookie signing secret as branch-scoped Preview environment
variables:

```txt
ANIDACHI_STAGING_GATE_ENABLED=true
ANIDACHI_STAGING_GATE_PASSWORD_SHA256=<sha256 hex>
ANIDACHI_STAGING_GATE_COOKIE_SECRET=<random secret>
ANIDACHI_STAGING_GATE_COOKIE_MAX_AGE_SECONDS=2592000
```

These variables are scoped to Preview for `codex/monorepo-migration`. The middleware is
also hard-disabled when `VERCEL_ENV=production`, so the staging gate cannot appear on
`www.anidachi.app` even if the variables are accidentally added to Production.

The gate intentionally bypasses:

- `/api/extension/auth/*`, because the extension auth exchange happens before the
  extension has a bearer token.
- API requests with `Authorization: Bearer ...`, because the real API route should
  validate the Anidachi token.
- Static assets and `OPTIONS`.

Unauthenticated API requests without a bearer token return JSON 401:

```json
{ "error": "Staging access required" }
```

Do not attach `staging.anidachi.app` yet. On the current Vercel setup, deployment
protection/custom-domain behavior is easy to misconfigure. A public staging custom
domain should only be added after one of these is true:

- `anidachi.app` DNS is managed in Cloudflare and Cloudflare Access protects staging;
- Vercel deployment protection covers the custom staging domain;
- the app-level staging auth middleware is confirmed to run on that custom domain.

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
- App-level staging password gate and noindex headers.
- Cloudflare Worker health.
- Cloudflare `/ice-servers`.
- Extension typecheck/tests/build.
- Static website rendering after entering the staging password.

These are ready for manual staging acceptance:

- Google/Discord sign-in on staging.
- `/api/me` authenticated staging smoke test.
- Extension sign-in against staging.
- Room creation through authenticated website API.
- Full invite flow through staging web auth.

## Staging Acceptance Checklist

Run this before marking the migration PR ready for review.

```txt
1. Open the protected Vercel preview URL.
2. Enter the shared Anidachi staging password.
3. Sign in with Google or Discord.
4. Open /api/me and confirm user JSON is returned.
5. Sign out and confirm /api/me returns 401.
6. Load the latest anidachi-extension-staging artifact.
   Local zip for this checkpoint: artifacts/anidachi-extension-staging-65bead8.zip
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
17. Confirm debug info shows these staging bases:
    WEB: https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app
    API: https://anidachi-api-staging.vladislav-gul7.workers.dev
    WS:  wss://anidachi-api-staging.vladislav-gul7.workers.dev
```

If the browser profile has never opened staging before, the extension sign-in flow may
show the password page first. Enter the staging password once, then continue Google or
Discord sign-in. Existing staging extension zips that point at the stable branch preview
alias still work with the password gate because the gate lives in the website middleware,
not in the extension bundle.

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
