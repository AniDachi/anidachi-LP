# Anidachi Development Environments

This document explains how Anidachi development, staging, and production are separated.
It is the shared reference for the team before testing or releasing changes.

## Source Of Truth

```txt
Primary repo: AniDachi/anidachi-LP
Local checkout placeholder: <repo>
```

Use the primary repo for new product work. In docs, `<repo>` means the folder
where a developer cloned `AniDachi/anidachi-LP`.

## Branch Model

```txt
feature/* or codex/* -> staging -> main
```

- `main` is production.
- `staging` is the shared integration/testing branch.
- Feature branches should normally branch from `staging`.
- Open PRs into `staging` first.
- After staging is tested, open a release PR from `staging` into `main`.
- `main` and `staging` are protected. See
  `docs/current-development-state.md` for the current required checks and
  auto-promotion rules.

## Website Environments

### Production Website

```txt
https://www.anidachi.app
https://anidachi.app
```

Production is public and must stay stable. Real users should only use the production site.

### Staging Website

```txt
https://staging.anidachi.app
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

These variables are scoped to the Vercel Preview/staging environment. The
middleware is also hard-disabled when `VERCEL_ENV=production`, so the staging
gate cannot appear on `www.anidachi.app` even if the variables are accidentally
added to Production.

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

### Fast Local Extension Development

Use WXT dev mode while changing overlay, popup, content script, or extension
room behavior:

```bash
pnpm dev:extension
```

For local extension changes against the shared staging website and staging
Worker, use:

```bash
pnpm dev:extension:staging
```

Google can reject WXT's auto-opened browser because `web-ext` launches Chrome
with remote debugging flags. For testing Google sign-in, use the Google-friendly
launcher instead:

```bash
pnpm dev:extension:staging:google
```

This keeps WXT running for rebuilds, but opens a normal macOS Chrome instance
at `chrome://extensions`. Load the dev extension once with Chrome's official
Developer mode flow: click "Load unpacked" and select
`apps/extension/.output/chrome-mv3-dev`. Its persistent profile lives at:

```txt
apps/extension/.wxt/google-auth-chrome-data
```

After the extension is loaded once in that profile, keep using the same command.
Chrome will remember the unpacked extension while WXT keeps rebuilding the files.

The staging dev command intentionally uses broad host permissions for local
developer speed. It does not change the store-safe staging artifact. To test the
same narrow host permissions used by tester/store builds, run:

```bash
pnpm dev:extension:staging:narrow
```

WXT writes the unpacked development extension to:

```txt
apps/extension/.output/chrome-mv3-dev
```

If WXT does not open Chrome automatically, open `chrome://extensions`, enable
Developer mode, choose "Load unpacked", and select that folder.

WXT launches Chromium with a persistent local profile at:

```txt
apps/extension/.wxt/chrome-data
```

That profile is gitignored and keeps cookies, extension storage, and login state
between dev restarts. UI and popup changes usually hot-reload. For content script
changes, refresh the video page if behavior looks stale. For manifest,
permission, or background/service-worker changes, reload the extension from
`chrome://extensions`.

### Staging Extension

Used for internal testing only. It is loaded manually as an unpacked Chrome extension or
downloaded from the GitHub Actions artifact:

```txt
anidachi-extension-staging
```

Current staging build environment:

```txt
WXT_WEB_HTTP_BASE=https://staging.anidachi.app
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
https://staging.anidachi.app/api/auth/callback/google

Discord:
https://staging.anidachi.app/api/auth/callback/discord
```

Adding staging redirects does not break production as long as production redirects are
not removed or edited.

See `docs/environment-and-secrets-matrix.md` for the full OAuth, Vercel,
GitHub, Cloudflare, and Supabase matrix.

## Staging Acceptance Checklist

Run the full checklist in `docs/staging-acceptance-checklist.md` before
promoting high-risk work to `main`. The short room/P2P smoke is:

```txt
1. Open `https://staging.anidachi.app`.
2. Enter the shared Anidachi staging password.
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
15. Reload one participant and confirm P2P reconnects without creating a new room.
16. Confirm debug logs show P2P `serverSeq` and selected direct/STUN/TURN candidate path.
17. Confirm play, pause, and seek sync.
18. Confirm reactions/chat render.
19. Confirm debug info shows these staging bases:
    WEB: https://staging.anidachi.app
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

## P2P Scorecard

Debug exports from the extension panel can be turned into the metrics the
room/P2P SLOs are judged on (see the 2026-06-12 execution plan):

```bash
node scripts/p2p-scorecard.mjs export-host.json export-guest.json
```

It accepts one export per participant (full or compact format) and prints, per
peer: time-to-connected, time-to-first-video, the selected candidate pair
(direct/STUN/TURN), ICE restarts with reasons, offer collisions, and signal
failures; per room: WebSocket opens/closes, pong timeouts, scheduled
reconnects, and signal counts; plus a summary with connect success rate,
median timings, and TURN relay share.

Use it during staging acceptance: export debug logs from both participants
after the checklist run and attach the summary to the plan's Progress Log.
