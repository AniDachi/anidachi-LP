# Experimental Features

This file records prototype-only behavior that can be removed, disabled, or promoted later.

## Hold Fire Super Reaction

Status: experimental, enabled by default in local builds.

Purpose: test whether a charged reaction feels better than a normal emoji tap. A short press on
`🔥` sends a normal fire emoji. Holding `🔥` or the `4` hotkey starts a charged reaction: the charge
ring appears after `0.5s`, fills for `1s`, and then releases an atomic-style animation above the
sender's Ghost Cam bubble.

Implementation:

- Config lives in `apps/extension/src/experiments.ts`.
- Overlay behavior lives in `apps/extension/src/overlay-app.tsx`.
- The super reaction is transported as `__anidachi_atomic_fire__` with `effect: "atomic-fire"` so it
  does not render as a regular emoji reaction.
- Protocol metadata for the effect lives in `packages/protocol/src/types.ts`.

Disable options:

- Build-time default: set `WXT_EXPERIMENT_HOLD_FIRE_SUPER_REACTION=false` before building the
  extension.
- Runtime/internal override: set the WXT storage key
  `local:experiment:holdFireSuperReaction` to `false`.

When disabled, `🔥` and hotkey `4` behave as normal emoji reactions. No hold timer, charge ring, or
atomic animation runs.

## P2P Media Transport

Status: experimental, enabled by default in local/public extension builds as of the P2P media test
branch.

Purpose: test whether Anidachi can avoid LiveKit/SFU media costs for the intended small-room case
of up to 4 participants. Playback sync, reactions, rooms, and signaling still use the Cloudflare
Durable Object. Camera and push-to-talk audio are exchanged directly between browsers through
WebRTC peer connections.

Implementation:

- Config lives in `apps/extension/src/experiments.ts`.
- P2P media controller lives in `apps/extension/src/p2p-media.ts`.
- `apps/extension/src/ghost-cam.ts` chooses between `p2p` and `livekit`.
- Targeted signaling is typed in `packages/protocol/src/types.ts` as `P2P_SIGNAL`.
- Durable Object only forwards `P2P_SIGNAL` between joined participants.
- Camera is constrained to roughly `240x240`, `10-12fps`, with a `150kbps` sender bitrate target.
- Push-to-talk audio is sent only while the keyboard voice key is held.
- Room events sent while the WebSocket is still connecting are queued by `RoomClient` so early
  `CAMERA_ON` and P2P control events are not lost during join.
- Compact debug logs include `p2p.*` entries for offer/answer, ICE candidates, connection state,
  selected candidate-pair stats, local/remote track arrival, and autoplay failures.
- ICE config is loaded from the Anidachi API endpoint `GET /ice-servers`. In production/public
  testing this endpoint generates short-lived Cloudflare Realtime TURN credentials server-side and
  returns a browser-safe `RTCIceServer[]`.
- The extension keeps WebRTC in direct-first mode: `iceTransportPolicy` remains `all`, STUN-only
  entries are ordered before TURN entries, and the Cloudflare STUN list is supplemented with Google
  STUN as an extra direct-connect path. Browser ICE still chooses the candidate pair; TURN is only a
  fallback when host/server-reflexive pairs cannot connect.
- If Cloudflare TURN secrets are not configured or the endpoint is unreachable, the extension falls
  back to build-time `WXT_P2P_ICE_SERVERS_JSON`, then Google STUN plus the best-effort OpenRelay
  static TURN config. OpenRelay is not a production dependency.

Disable options:

- Build-time default: set `WXT_MEDIA_TRANSPORT=livekit` before building the extension.
- Runtime/internal override: set WXT storage key `local:experiment:mediaTransport` to `livekit`.
- Disable the bundled best-effort OpenRelay TURN attempt with
  `WXT_P2P_ENABLE_OPEN_RELAY_TURN=false`.
- Force all P2P media through TURN during diagnostics with `WXT_P2P_FORCE_RELAY=true`.

Known limitations:

- Some cross-network cases will fail without a real TURN relay. If local same-machine/same-LAN
  tests work but remote friends do not see video/audio, check compact debug logs for
  `p2p.ice-config`, missing `relay` candidates, or a `failed`/stuck `checking` ICE state.
- To confirm a session stayed direct, inspect the `p2p.stats` selected candidate-pair log. Direct
  sessions should select `host`, `srflx`, or `prflx`; `relay` means the session fell back to TURN.
- P2P can expose peer network candidates at the WebRTC layer. For production privacy, add TURN-only
  or relay-preferred modes for users who need it.
- Mesh P2P is intended for `2-4` people. Do not raise the room camera limit without revisiting
  upload bandwidth and connection count.
