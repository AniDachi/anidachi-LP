# Anidachi Extension Release Channels

Last updated: 2026-08-19.

This document describes the current Chrome extension release setup. Treat it as the
source of truth for the current implementation, not as a permanent product contract.
If build scripts, domains, or backend routing change, update this document in the
same PR.

## Channels

Anidachi uses three extension channels.

| Channel | Extension name | Main purpose | Web app | API/WS |
| --- | --- | --- | --- | --- |
| `local` | `Anidachi Local MVP` | Local development and broad site experiments | `http://localhost:3003` by default | `http://127.0.0.1:8787` / `ws://127.0.0.1:8787` by default |
| `staging` | `Anidachi Staging` | Stable unpacked artifact for founders/testers | `https://staging.anidachi.app` | `https://anidachi-api-staging.vladislav-gul7.workers.dev` / `wss://anidachi-api-staging.vladislav-gul7.workers.dev` |
| `production` | `Anidachi` | Future public user build; extension auth fail-closed | `https://www.anidachi.app` | `https://anidachi-api-production.vladislav-gul7.workers.dev` / `wss://anidachi-api-production.vladislav-gul7.workers.dev` |

The channel is selected with `WXT_EXTENSION_CHANNEL`.

An explicitly configured value outside `local`, `staging`, or `production`
fails the build. Release scripts force their named channel: caller environment
cannot turn the staging script into production or the public script into local.
Those scripts also force the channel's canonical web, API, and WebSocket
endpoints and narrow-permission mode; inherited endpoint or broad-permission
variables cannot alter a release artifact.

Channel sources:

- `local`: WXT dev or unpacked local build; broad permissions are allowed for
  development experiments; web defaults to localhost.
- `staging`: unpacked artifact from the `staging` branch; narrow permissions
  only; web is `https://staging.anidachi.app`.
- `production`: future artifact from the `main` branch; narrow permissions
  only; web is `https://www.anidachi.app`. It currently has no approved
  extension identity and cannot connect to web auth.

Local and staging have separate stable Chromium identities derived from
repository-controlled public manifest keys:

| Channel | Exact extension ID | Auth callback origin |
| --- | --- | --- |
| `local` | `nkinhhgigcflmfhilmcakbkongcpkfnl` | `https://nkinhhgigcflmfhilmcakbkongcpkfnl.chromiumapp.org` |
| `staging` | `ndkfphbchhfephdodcpehdcoclojagje` | `https://ndkfphbchhfephdodcpehdcoclojagje.chromiumapp.org` |
| `production` | none | none; fail closed |

The manifest `key` contains public material only. Never create, persist, or
commit a corresponding private key. Each local/staging web environment sets the
single `ANIDACHI_EXTENSION_CLIENT_ID` variable to its exact matching ID. Only
the exact `/auth` and `/logout` paths are accepted; suffix wildcards and
cross-channel IDs are forbidden.

The staging web URL is internal tester infrastructure. It may appear in staging
extension builds, OAuth callback allowlists, and internal docs, but it must stay
password-gated, noindex, excluded from sitemap output, and absent from production
SEO/marketing pages.

## Release Permissions

The local development build intentionally keeps broad access because it is used to
test generic HTML5 video detection on arbitrary sites.

The staging and production release builds are intentionally scoped to supported
watch surfaces and Anidachi infrastructure:

- YouTube
- YouTube embeds / `youtube-nocookie`
- Crunchyroll
- the channel web app host
- the configured Cloudflare Workers API host for the channel

Do not ship `http://*/*`, `https://*/*`, or `file:///*` in release builds unless
the product decision is explicit.

`pnpm validate:extension:staging` and
`pnpm validate:extension:production` compare the complete host-permission and
content-script match sets without depending on order. Missing and extra values
both fail validation.

## Build Commands

Generate the stable staging unpacked artifact:

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
```

For an explicit local testing artifact with broad page access, use only:

```bash
pnpm build:extension:staging:local-broad
```

That command passes the script's dedicated `--broad` mode. It is not a narrow
staging release artifact, writes only to the separate local-broad paths below,
and must not be promoted or uploaded.

Outputs:

- `anidachi-extension-staging/`
- `anidachi-extension-staging.zip`
- `artifacts/anidachi-extension-staging-<git-sha>.zip`

Local-broad outputs:

- `anidachi-extension-staging-local-broad/`
- `anidachi-extension-staging-local-broad.zip`
- `artifacts/anidachi-extension-staging-local-broad-<git-sha>.zip`

Generate the production extension artifact:

```bash
WXT_VAPID_PUBLIC_KEY="<production-public-key>" pnpm build:extension:public
pnpm validate:extension:production
```

The production VAPID public key must match the production web app's
`ANIDACHI_VAPID_PUBLIC_KEY`. Keep `ANIDACHI_VAPID_PRIVATE_KEY` server-only in
Vercel Production. GitHub Actions reads the public key from the
`WXT_VAPID_PUBLIC_KEY` variable in the `production` environment and refuses to
build the `main` artifact when that variable is missing. Staging uses its own
key and remains isolated from production subscriptions.

The release manifest includes Chrome's `notifications` permission. This lets
the default-on room-invite preference register a Web Push subscription after
sign-in without hiding a second activation step in extension settings. Turning
the preference off revokes the local subscription while durable Inbox data and
the action badge continue to work.

Outputs:

- `anidachi-extension-public/`
- `anidachi-extension-public.zip`
- `anidachi-extension-experiment/`
- `anidachi-extension-experiment.zip`

The build scripts verify that the committed extension PNG icons match the source
logo without modifying the source tree. After changing
`apps/extension/public/Anidachi_logo.png`, regenerate and commit the icons before
building:

```bash
pnpm build:extension:icons
pnpm check:extension:icons
```

Use broad staging permissions only for local development experiments:

```bash
pnpm build:extension:staging:local-broad
```

Do not distribute the broad staging build as a tester or release artifact.

## Promotion Flow

1. Develop locally using the local WXT dev build.
2. Open a feature branch and PR into `staging`.
3. Build and validate `Anidachi Staging` as an unpacked tester artifact.
4. Test that exact artifact with founders/testers against staging web/API infrastructure.
5. If staging is accepted, merge/promote the same code path to `main`.
6. Do not enable production extension auth until a separate production identity
   and cutover are explicitly approved.

There is no Chrome Web Store dependency in the current pre-release flow.

## Important Invariant

Staging and production must not share runtime endpoints accidentally.

Before distributing an artifact, inspect `manifest.json` and the debug panel build id:

- Staging should show `Anidachi Staging` and `*-staging-*`.
- Production should show `Anidachi` and `*-production-*`.

Pre-upload checklist:

- `manifest.name` matches the channel.
- Local and staging `manifest.key` values derive the exact channel ID above.
- Production has no `manifest.key` and no approved web-auth identity.
- `manifest.version_name` contains the current git SHA, channel name, and CI run
  number or build timestamp.
- `host_permissions` does not contain `http://*/*`, `https://*/*`, `file:///*`,
  or `<all_urls>`.
- `content_scripts.matches` does not contain broad patterns.
- Web/API hosts match the channel.
- The production build uses the public half of the production VAPID key pair;
  the corresponding private key exists only in the production web environment.
- `alarms` is present for daily notification recovery and `notifications` is a
  required manifest permission for default-on invite alerts. The Popup setting
  controls the local subscription rather than requesting another permission.
- `minimum_chrome_version` is at least 121 for extension Web Push support.
- Icons exist at 16, 32, 48, and 128 px.
- The zip root contains `manifest.json` at the top level.

## Tester Instructions

Share staging access details out of band; do not commit them to git.

Current instruction shape:

```txt
Install Anidachi Staging, then open a YouTube or Crunchyroll video page. Click the small "A" bubble on the video, sign in through the staging site with Google/Discord. If asked for access, use the provided tester code. Click Create room, Copy invite, and open it in another Chrome profile/device. Controls: A opens menu; Sync now resyncs; keys 1-6 send emoji; hold V for push-to-talk; Alt/Option+C opens text chat; Ghost Cam toggles camera.
```
