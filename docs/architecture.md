# Anidachi Architecture and Stack Notes

This document records the current local/public MVP architecture, stack decisions, deployment steps, and product/engineering constraints for Anidachi.

## Product Shape

Anidachi is a Chrome extension-first ambient watch layer for online video.

It does not host, proxy, record, or distribute movies/video content. Each user watches the source video on their own page. Anidachi only synchronizes playback state and renders a lightweight social overlay:

- small Anidachi status bubble;
- compact mini-panel;
- silent Ghost Cam bubbles;
- emoji reactions;
- short voice-to-comment reactions;
- host-authoritative play/pause/seek sync.

The product principle is: the movie stays primary; social UI appears as a minimal transparent layer over the player.

## Monorepo Layout

```txt
apps/
  api/          Cloudflare Worker + Durable Object room backend
  demo/         Local HTML5 video demo page
  extension/    WXT React Chrome extension
  web/          Next.js site, auth, billing, room invite pages
packages/
  protocol/     Shared Zod protocol, types, sync math
infra/
  livekit/      Local LiveKit Docker compose wrapper
docs/
  architecture.md
  experimental-features.md
  shared-watch-progress-tracker.md
```

## Current Stack

### Extension

- WXT
- React
- TypeScript
- Shadow DOM content script overlay
- `livekit-client` for Ghost Cam
- `lucide-react` icons
- Vitest + happy-dom for tests

The extension is a content-script overlay. It detects the active video, mounts inside the player container, and keeps itself visible in fullscreen.

### Realtime Room API

- Cloudflare Workers
- Hono
- Durable Objects
- WebSocket
- Zod protocol from `packages/protocol`
- Room JWT verification with `jose`

One room maps to one Durable Object instance. Live playback state lives in memory inside the Durable Object, not in a database.

Room creation is auth-only for the commercial product:

- the extension signs in through the website;
- `apps/web` creates durable Supabase room rows and issues short-lived room tokens;
- the Worker accepts WebSocket joins only with a valid `roomToken`;
- the Worker derives participant id/name/avatar/role from the room token and does not trust client-provided identity fields.

### Ghost Cam

- Local development: self-hosted LiveKit via Docker
- Public friend testing: LiveKit Cloud

Ghost Cam publishes camera video only:

- no microphone track;
- low resolution;
- low fps;
- rendered as circular transparent bubbles.

Microphone is used only by browser speech recognition for push-to-talk voice reactions, not by LiveKit.

### Voice Input

- Chrome `webkitSpeechRecognition`
- Push-to-talk hotkey: hold `V`
- While listening, the video is ducked to about 10 percent volume
- Recognized text is sent as a short live comment reaction

Keyword to emoji mapping:

```txt
смешно -> 😂
жесть  -> 😱
люблю  -> ❤️
огонь  -> 🔥
плачу  -> 😭
смотри -> 👀
```

## Public Test Environment

Current public Worker:

```txt
https://anidachi-api.vladislav-gul7.workers.dev
wss://anidachi-api.vladislav-gul7.workers.dev
```

Current LiveKit Cloud URL:

```txt
wss://anidachi-1vnsspf7.livekit.cloud
```

LiveKit API credentials are Cloudflare Worker secrets and must not be committed:

```txt
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
```

Important: the LiveKit secret was shared during manual setup. Rotate it after external testing if this repo or chat history may be exposed.

## Local Development

Install dependencies:

```bash
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install
```

Start local LiveKit:

```bash
docker compose -f infra/livekit/docker-compose.yml up
```

Start local API:

```bash
ANIDACHI_JWT_SECRET=local-dev-secret-local-dev-secret \
pnpm dev:api
```

Start extension dev build:

```bash
pnpm dev:extension
```

Start demo page:

```bash
pnpm dev:demo
```

Load the dev extension from:

```txt
apps/extension/.output/chrome-mv3-dev
```

Local defaults:

```txt
API_HTTP_BASE=http://127.0.0.1:8787
API_WS_BASE=ws://127.0.0.1:8787
WEB_HTTP_BASE=http://localhost:3003
LiveKit=ws://localhost:7880
Demo=http://127.0.0.1:5174
```

Start local website:

```bash
pnpm --filter @anidachi/web dev
```

For auth-only local testing, configure `apps/web/.env.local` with Supabase, OAuth, and `ANIDACHI_JWT_SECRET`. The same JWT secret must be set for the Worker.

## Public Friend Test Build

The public build points the extension at the deployed Worker:

```bash
WXT_API_HTTP_BASE=https://anidachi-api.vladislav-gul7.workers.dev \
WXT_API_WS_BASE=wss://anidachi-api.vladislav-gul7.workers.dev \
WXT_WEB_HTTP_BASE=https://anidachi.app \
pnpm --filter @anidachi/extension build
```

Package the extension:

```bash
pnpm build:extension:public
```

This updates both the installed unpacked extension folder and the zip for friends:

```txt
/Users/vladyslavhulyi/anidachi/anidachi-extension-public
/Users/vladyslavhulyi/anidachi/anidachi-extension-public.zip
```

Current manually loaded experiment folders:

```txt
Mac: /Users/vladyslavhulyi/anidachi/anidachi-extension-experiment
PC:  C:\Users\vladi\OneDrive\Desktop\anidachi-extension-experiment
```

When testing new Crunchyroll work, keep both folders updated, then reload the
extension from `chrome://extensions` and refresh the Crunchyroll tab.

Install manually in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Unzip `anidachi-extension-public.zip`.
4. Click Load unpacked.
5. Select the unzipped folder.
6. Refresh YouTube or another video page.

## Cloudflare Deploy

The Worker config lives at:

```txt
apps/api/wrangler.toml
```

It contains only public/non-secret config:

```toml
[vars]
LIVEKIT_URL = "wss://anidachi-1vnsspf7.livekit.cloud"
```

Secrets are set with Wrangler:

```bash
cd /Users/vladyslavhulyi/anidachi/apps/api
pnpm exec wrangler login
pnpm exec wrangler secret put LIVEKIT_API_KEY
pnpm exec wrangler secret put LIVEKIT_API_SECRET
pnpm exec wrangler secret put ANIDACHI_JWT_SECRET
pnpm exec wrangler secret put CLOUDFLARE_TURN_KEY_ID
pnpm exec wrangler secret put CLOUDFLARE_TURN_KEY_API_TOKEN
pnpm exec wrangler deploy
```

Cloudflare Realtime TURN notes:

- Create a TURN key in Cloudflare Dashboard under Realtime/TURN.
- Keep the TURN key id and API token server-side only; never put them in the extension.
- The Worker endpoint `GET /ice-servers` calls Cloudflare
  `generate-ice-servers` and returns short-lived `RTCIceServer[]` credentials to the extension.
- Optional TTL override: `pnpm exec wrangler secret put CLOUDFLARE_TURN_TTL_SECONDS`.
- The default TTL is 12 hours, clamped between 10 minutes and 24 hours.

Verify API:

```bash
node -e 'fetch("https://anidachi-api.vladislav-gul7.workers.dev/").then(r=>r.text().then(t=>console.log(r.status,t)))'
```

Verify LiveKit token endpoint without printing the token:

```bash
node - <<'NODE'
const response = await fetch('https://anidachi-api.vladislav-gul7.workers.dev/livekit/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ roomId: 'smoke', identity: 'smoke-user', name: 'Smoke User' })
});
const payload = await response.json();
console.log({
  status: response.status,
  serverUrl: payload.serverUrl,
  hasToken: Boolean(payload.token),
  tokenLength: payload.token?.length ?? 0
});
NODE
```

Verify ICE server endpoint without printing TURN credentials:

```bash
node - <<'NODE'
const response = await fetch('https://anidachi-api.vladislav-gul7.workers.dev/ice-servers');
const payload = await response.json();
console.log({
  status: response.status,
  configured: payload.configured,
  provider: payload.provider,
  ttlSeconds: payload.ttlSeconds,
  iceServerCount: payload.iceServers?.length ?? 0,
  urls: payload.iceServers?.map((server) => server.urls)
});
NODE
```

## Popup Resources And Progress

The extension popup now has an early Resources surface for saved watch progress. Crunchyroll records
real local episode progress; Netflix, YouTube, and Amazon are placeholders for later provider
support.

The shared-progress tracker is currently a demo UI layer with fake friends/groups. Product and
engineering rules for turning it into a real social resume feature are documented in:

```txt
docs/shared-watch-progress-tracker.md
```

## Video Adapter Decisions

The extension uses a generic video adapter system.

Implemented adapters:

- `generic-html5-video`
- `youtube`
- `crunchyroll`

Generic adapter:

- scans visible `HTMLVideoElement`s;
- includes open shadow roots;
- selects the largest usable video;
- falls back to a tightly wrapped parent container;
- uses a LAN-stable fingerprint based on page path and stable video source key.

YouTube adapter:

- uses `#movie_player` / `.html5-video-player` as the container;
- uses YouTube video id for fingerprint;
- uses YouTube native fullscreen button for fullscreen;
- uses YouTube player API `setVolume/getVolume` for voice ducking, with HTML5 fallback.

This prevents YouTube fullscreen/layout issues where appending overlays to `document.body` disappears in fullscreen or clips the video.

Crunchyroll adapter:

- recognizes `crunchyroll.com` watch pages;
- uses the watch id from `/watch/<id>/...` for a stable fingerprint instead of transient CDN/HLS URLs;
- prefers Crunchyroll player containers such as `#vilosRoot` and `#player0`;
- uses Crunchyroll's native play/pause and fullscreen controls as fallbacks when direct media methods are ignored;
- listens to `play`, `playing`, `pause`, `seeking`, `seeked`, and throttled `timeupdate` events;
- does not override Crunchyroll's fullscreen layout CSS or double-click behavior.

The Teleparty black-box/static observation that informed this: for Crunchyroll they use a platform-specific content/injected-script approach with selectors around `#vilosRoot`, `#player0`, `video[src]`, and `vilos` control test ids. We copied the architectural idea, not proprietary code.

## Fullscreen Overlay Decision

Fullscreen is handled by mounting the overlay inside the player/fullscreen container, not `document.body`.

Key rules:

- content script runs at `document_start`;
- overlay root uses Shadow DOM;
- overlay root has `pointer-events: none`;
- interactive controls use `pointer-events: auto`;
- for YouTube, overlay target remains the YouTube player container;
- for Crunchyroll, overlay target remains the Crunchyroll player root and native fullscreen behavior is preserved;
- for generic fullscreen, overlay target becomes `document.fullscreenElement`;
- double-click on generic videos routes fullscreen to the player container when needed.

## Room Protocol

Client events:

- `JOIN`
- `HOST_STATE`
- `PLAY`
- `PAUSE`
- `SEEK`
- `REACTION`
- `CAMERA_ON`
- `CAMERA_OFF`

Server events:

- `ROOM_SNAPSHOT`
- `PARTICIPANT_JOINED`
- `PARTICIPANT_LEFT`
- `HOST_STATE`
- `REACTION`
- `ERROR`

All protocol schemas live in:

```txt
packages/protocol/src
```

## Sync Algorithm

Current sync is host-authoritative:

- first participant in a room becomes host;
- host sends playback state every 1.5 seconds and on video events;
- host also broadcasts explicit `PLAY`, `PAUSE`, and `SEEK` commands for user actions;
- Durable Object accepts playback commands only from the current host;
- viewers ignore state for a different video fingerprint;
- viewers apply explicit `SEEK` immediately instead of treating it as passive drift;
- viewers compute drift from host time and local time;
- remote playback timestamps are normalized to the receiver clock to avoid cross-device clock skew;
- small drift is ignored;
- larger drift seeks to expected host time;
- large drift shows catch-up state instead of forcing an immediate seek.

This is intentionally simple for MVP. Smooth correction with temporary playback rate can be added later.

## Identity and Invite Flow

Identity is auth-only for the commercial product.

- the extension signs in through `apps/web` with Chrome Identity;
- website users are the canonical identities;
- the website creates durable room rows and issues short-lived room tokens;
- invite URLs point to website room pages;
- the Worker accepts WebSocket joins only with a valid room token.

## Hotkeys

Current hotkeys:

```txt
V hold    push-to-talk voice input
1         😂
2         😱
3         ❤️
4         🔥
5         😭
6         👀
```

Hotkeys are active only when:

- a room is active;
- focus is not inside input/textarea/select/contenteditable/textbox;
- `Cmd`, `Ctrl`, or `Alt` are not pressed.

Plain `1-6` intentionally override YouTube number seek behavior because the current product priority is fast reactions.

## Known Constraints

- Extension uses broad host permissions for local/prototype speed.
- This is not Chrome Store-ready.
- No auth, DB, friend graph, dashboard, billing, or persistent history yet.
- No microphone track is published to LiveKit.
- Speech recognition may use Chrome/browser speech services.
- Netflix/DRM sites need site-specific adapters and may not permit overlay behavior reliably.
- Local LiveKit over LAN can work, but public friend testing should use LiveKit Cloud.

## Verification Commands

Run extension tests:

```bash
pnpm --filter @anidachi/extension test
```

Typecheck extension:

```bash
pnpm --filter @anidachi/extension check
```

Check API:

```bash
pnpm --filter @anidachi/api check
```

Full workspace tests/checks can be run with:

```bash
pnpm test
pnpm check
```

## Important Files

```txt
apps/extension/entrypoints/content.tsx    Overlay mounting and fullscreen relocation
apps/extension/src/overlay-app.tsx        Main overlay UI and room interaction
apps/extension/src/video-adapter.ts       Generic, YouTube, and Crunchyroll video adapters
apps/extension/src/ghost-cam.ts           LiveKit Ghost Cam integration
apps/extension/src/hotkeys.ts             Hotkey routing
apps/extension/src/media-ducking.ts       Generic HTML5 video ducking
apps/extension/src/voice.ts               Speech recognition and keyword mapping
apps/extension/src/room-client.ts         WebSocket room client
apps/api/src/index.ts                     Worker routes and Durable Object
apps/api/src/room-state.ts                Room state and host assignment
apps/api/src/livekit-token.ts             LiveKit token generation
packages/protocol/src                     Shared room protocol and sync math
```
