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

The default legacy scenario retains its existing per-direction 8000 ms
first-frame wait and assertion. Media-v2 scenarios use the separate complete
sample p95 target documented below.

The local harness token fixture follows the production room-token boundary: it
uses issuer `anidachi-auth`, audience `anidachi-worker`, and binds the exact
`participantSessionId` that `RoomClient` sends in JOIN. Legacy runs use host
`host` with session `host-sess`; media-v2 runs use the actual host `p0` with
session `s0`. Every media-v2 run submits that fixture to the real local Worker
ICE route before opening Chromium. If that contract changes, update both sides
of the fixture; never relax Worker verification just to make the harness
connect.

The focused fixture regression bundles the production Worker verifier and checks
both the strict media-v2 host binding and legacy compatibility:

```bash
npm run test:harness
```

## Media-v2 Local Scenarios

Run the supported single-machine synthetic scenarios separately:

```bash
HARNESS_MEDIA_V2=4 node p2p-media-harness.mjs
HARNESS_MEDIA_V2=6 node p2p-media-harness.mjs
HARNESS_MEDIA_V2=15 node p2p-media-harness.mjs
```

Each scenario checks the expected bounded media graph, decoded camera and
microphone streams, advancing media, and a selected ICE candidate pair at both
endpoints of every expected media edge. After decoded media advances, candidate
sampling waits on that exact complete condition for at most five seconds. The
decoded-video TTFM sample contains one value for every permitted remote
camera/receiver combination. Its clock starts when that camera participant first
appears in the receiver's authoritative room membership, immediately before the
media topology update, and stops at the receiver's first decoded video frame.
The run fails unless the sample is complete and its nearest-rank p95 is strictly
below 6000 ms.

## Relay/TURN Mode

The default run is direct-first and often selects `host/host` candidate pairs on
one machine. That proves negotiation and media recovery logic, but it does not
prove restrictive-network behavior.

To force TURN relay in the same harness, either let the harness fetch ICE servers
from the local Worker endpoint with existing authorized local TURN bindings:

```bash
HARNESS_MEDIA_V2=4 HARNESS_FORCE_RELAY=true HARNESS_USE_WORKER_ICE_SERVERS=true node p2p-media-harness.mjs
```

or pass short-lived TURN credentials explicitly:

```bash
HARNESS_MEDIA_V2=4 HARNESS_FORCE_RELAY=true \
HARNESS_ICE_SERVERS_JSON='[{"urls":["turns:turn.example.com:443?transport=tcp"],"username":"...","credential":"..."}]' \
node p2p-media-harness.mjs
```

Relay mode fails fast unless at least one `turn:` or `turns:` URL is provided.
It then requires an actual selected relay candidate at both endpoints of every
expected media edge; TURN URLs alone cannot make the check pass. Do not commit
real TURN credentials.

Worker-backed relay mode requires `CLOUDFLARE_TURN_KEY_ID` and
`CLOUDFLARE_TURN_KEY_API_TOKEN` to be present in the explicitly authorized local
test environment. The Worker response must be Cloudflare TURN-configured and
include a `turns:443` URL, so the run proves the restrictive-network fallback
path instead of silently accepting STUN-only fallback. Missing bindings are an
external acceptance gate; do not retrieve or create long-lived credentials to
bypass it. The harness never logs credentials; it logs only provider,
configured status, TTL, `turns:443` readiness, and STUN/TURN URL counts.

## What This Harness Does Not Prove

Do not use a same-machine synthetic green run as a distributed, physical-device,
or market-readiness claim. Before release, record a staging run with two real
browser profiles on different networks and a remote-region tester run. The
release evidence should include selected candidate type (`host`, `srflx`, or
`relay`), TTFM, reconnect time, video recovery, push-to-talk latency, and whether
TURN was used.

This package is intentionally outside the pnpm workspace so Playwright/Chromium
do not weigh down normal `pnpm install`.
