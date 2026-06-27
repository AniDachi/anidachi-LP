# Real-WebRTC two-browser P2P harness (Block 1.5)

Drives the **actual** extension P2P engine (`P2PMediaController`) and room
transport (`RoomClient`) between two Chromium contexts with a fake camera,
against the real Worker (`wrangler dev`). Asserts the SLOs that matter for
"p2p works": both peers receive decoded video (TTFM, S3/S4) and a reloaded
peer recovers media without recreating the room (S5).

## Run

```bash
cd tests/e2e
pnpm install            # or npm install
npx playwright install chromium
node p2p-media-harness.mjs
```

Set `HARNESS_DEBUG=1` to stream per-page browser console output.

## Relay/TURN Mode

The default run is direct-first and often selects `host/host` candidate pairs on
one machine. That proves negotiation and media recovery logic, but it does not
prove restrictive-network behavior.

To force TURN relay in the same harness, either let the harness fetch ICE servers
from the local Worker endpoint:

```bash
HARNESS_FORCE_RELAY=true HARNESS_USE_WORKER_ICE_SERVERS=true node p2p-media-harness.mjs
```

or pass short-lived TURN credentials explicitly:

```bash
HARNESS_FORCE_RELAY=true \
HARNESS_ICE_SERVERS_JSON='[{"urls":["turns:turn.example.com:443?transport=tcp"],"username":"...","credential":"..."}]' \
node p2p-media-harness.mjs
```

Relay mode fails fast unless at least one `turn:` or `turns:` URL is provided,
and it asserts that the selected candidate pair uses a relay candidate. Do not
commit real TURN credentials.

For Worker-backed mode, local Wrangler may load `CLOUDFLARE_TURN_KEY_ID` and
`CLOUDFLARE_TURN_KEY_API_TOKEN` from `apps/api/.dev.vars`/`.env`, or from the
shell environment. In relay-only mode the Worker response must be Cloudflare
TURN-configured and include a `turns:443` URL, so the run proves the restrictive
network fallback path instead of silently accepting STUN-only fallback. The
harness never logs credentials; it logs only provider, configured status, TTL,
`turns:443` readiness, and STUN/TURN URL counts.

## What This Harness Does Not Prove

Do not use a same-machine green run as a market-readiness claim. Before release,
record a staging run with two real browser profiles on different networks and a
remote-region tester run. The release evidence should include selected candidate
type (`host`, `srflx`, or `relay`), TTFM, reconnect time, video recovery,
push-to-talk latency, and whether TURN was used.

This package is intentionally outside the pnpm workspace so Playwright/Chromium
do not weigh down normal `pnpm install`.
