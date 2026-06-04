# Anidachi Extension Release Channels

Last updated: 2026-06-04.

This document describes the current Chrome extension release setup. Treat it as the
source of truth for the current implementation, not as a permanent product contract.
If build scripts, domains, or backend routing change, update this document in the
same PR.

## Channels

Anidachi uses three extension channels.

| Channel | Extension name | Main purpose | Web app | API/WS |
| --- | --- | --- | --- | --- |
| `local` | `Anidachi Local MVP` | Local development and broad site experiments | `http://localhost:3003` by default | `http://127.0.0.1:8787` / `ws://127.0.0.1:8787` by default |
| `staging` | `Anidachi Staging` | Chrome Web Store test item for founders/testers | `https://staging.anidachi.app` | `https://anidachi-api-staging.vladislav-gul7.workers.dev` / `wss://anidachi-api-staging.vladislav-gul7.workers.dev` |
| `production` | `Anidachi` | Public user build | `https://www.anidachi.app` | `https://anidachi-api-production.vladislav-gul7.workers.dev` / `wss://anidachi-api-production.vladislav-gul7.workers.dev` |

The channel is selected with `WXT_EXTENSION_CHANNEL`.

Channel sources:

- `local`: WXT dev or unpacked local build; broad permissions are allowed for
  development experiments; web defaults to localhost.
- `staging`: artifact from the `staging` branch; narrow permissions only;
  private/trusted tester Chrome Web Store listing; web is
  `https://staging.anidachi.app`.
- `production`: artifact from the `main` branch; narrow permissions only; public
  Chrome Web Store listing; web is `https://www.anidachi.app`.

The staging web URL is internal tester infrastructure. It may appear in staging
extension builds, OAuth callback allowlists, and internal docs, but it must stay
password-gated, noindex, excluded from sitemap output, and absent from production
SEO/marketing pages.

## Store Permissions

The local development build intentionally keeps broad access because it is used to
test generic HTML5 video detection on arbitrary sites.

The staging and production store builds are intentionally scoped to supported
watch surfaces and Anidachi infrastructure:

- YouTube
- YouTube embeds / `youtube-nocookie`
- Crunchyroll
- the channel web app host
- the configured Cloudflare Workers API host for the channel

Do not ship `http://*/*`, `https://*/*`, or `file:///*` in store builds unless the
product decision is explicit and the Chrome Web Store listing explains why broad
access is required.

## Build Commands

Generate the staging Chrome Web Store artifact:

```bash
pnpm build:extension:staging
pnpm validate:extension:staging
```

Outputs:

- `anidachi-extension-staging/`
- `anidachi-extension-staging.zip`
- `artifacts/anidachi-extension-staging-<git-sha>.zip`

Generate the production extension artifact:

```bash
pnpm build:extension:public
pnpm validate:extension:production
```

Outputs:

- `anidachi-extension-public/`
- `anidachi-extension-public.zip`
- `anidachi-extension-experiment/`
- `anidachi-extension-experiment.zip`

The build scripts regenerate extension PNG icons before building.

Use broad staging permissions only for local development experiments:

```bash
pnpm build:extension:staging:broad
```

Do not upload the broad staging build to Chrome Web Store.

## Promotion Flow

1. Develop locally using the local WXT dev build.
2. Open a feature branch and PR into `staging`.
3. Build `Anidachi Staging` and upload it to the staging Chrome Web Store item.
4. Test with founders/testers against staging web/API infrastructure.
5. If staging is accepted, merge/promote the same code path to `main`.
6. Build `Anidachi` production and upload it to the production Chrome Web Store item.

The staging and production Chrome Web Store items should remain separate extension
listings. This gives testers automatic updates from the staging item without
affecting public users.

## Important Invariant

Staging and production must not share runtime endpoints accidentally.

Before uploading a zip, inspect `manifest.json` and the debug panel build id:

- Staging should show `Anidachi Staging` and `*-staging-*`.
- Production should show `Anidachi` and `*-production-*`.

Pre-upload checklist:

- `manifest.name` matches the channel.
- `manifest.version` is higher than the previous Chrome Web Store upload for
  that listing.
- `manifest.version_name` contains the current git SHA, channel name, and CI run
  number or build timestamp.
- `host_permissions` does not contain `http://*/*`, `https://*/*`, `file:///*`,
  or `<all_urls>`.
- `content_scripts.matches` does not contain broad patterns.
- Web/API hosts match the channel.
- Icons exist at 16, 32, 48, and 128 px.
- The zip root contains `manifest.json` at the top level.

## Chrome Web Store Tester Instructions

Keep reviewer/tester instructions short enough for the Chrome Web Store form.
The staging access code should be entered in the store form or shared out of band;
do not commit it to git.

Current instruction shape:

```txt
Install Anidachi Staging, then open a YouTube or Crunchyroll video page. Click the small "A" bubble on the video, sign in through the staging site with Google/Discord. If asked for access, use the provided tester code. Click Create room, Copy invite, and open it in another Chrome profile/device. Controls: A opens menu; Sync now resyncs; keys 1-6 send emoji; hold V for push-to-talk; Alt/Option+C opens text chat; Ghost Cam toggles camera.
```
