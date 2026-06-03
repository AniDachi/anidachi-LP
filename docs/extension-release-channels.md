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
| `staging` | `Anidachi Staging` | Chrome Web Store test item for founders/testers | `https://v0-anime-app-landing-page-git-3b9ab6-georges-projects-8c4bc43a.vercel.app` | `https://anidachi-api-staging.vladislav-gul7.workers.dev` / `wss://anidachi-api-staging.vladislav-gul7.workers.dev` |
| `production` | `Anidachi` | Public user build | `https://www.anidachi.app` | `https://anidachi-api-production.vladislav-gul7.workers.dev` / `wss://anidachi-api-production.vladislav-gul7.workers.dev` |

The channel is selected with `WXT_EXTENSION_CHANNEL`.

## Store Permissions

The local development build intentionally keeps broad access because it is used to
test generic HTML5 video detection on arbitrary sites.

The staging and production store builds are intentionally scoped to supported
watch surfaces and Anidachi infrastructure:

- YouTube
- YouTube embeds / `youtube-nocookie`
- Crunchyroll
- Anidachi web app
- the configured Vercel preview host for the channel
- the configured Cloudflare Workers API host for the channel

Do not ship `http://*/*`, `https://*/*`, or `file:///*` in store builds unless the
product decision is explicit and the Chrome Web Store listing explains why broad
access is required.

## Build Commands

Generate the staging Chrome Web Store artifact:

```bash
pnpm build:extension:staging
```

Outputs:

- `anidachi-extension-staging/`
- `anidachi-extension-staging.zip`
- `artifacts/anidachi-extension-staging-<git-sha>.zip`

Generate the production extension artifact:

```bash
pnpm build:extension:public
```

Outputs:

- `anidachi-extension-public/`
- `anidachi-extension-public.zip`
- `anidachi-extension-experiment/`
- `anidachi-extension-experiment.zip`

The build scripts regenerate extension PNG icons before building.

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

## Chrome Web Store Tester Instructions

Keep reviewer/tester instructions short enough for the Chrome Web Store form.
The staging access code should be entered in the store form or shared out of band;
do not commit it to git.

Current instruction shape:

```txt
Install Anidachi Staging, then open a YouTube or Crunchyroll video page. Click the small "A" bubble on the video, sign in through the staging site with Google/Discord. If asked for access, use the provided tester code. Click Create room, Copy invite, and open it in another Chrome profile/device. Controls: A opens menu; Sync now resyncs; keys 1-6 send emoji; hold V for push-to-talk; Alt/Option+C opens text chat; Ghost Cam toggles camera.
```
