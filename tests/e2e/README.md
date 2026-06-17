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

This package is intentionally outside the pnpm workspace so Playwright/Chromium
do not weigh down normal `pnpm install`.
