# apps/api Agent Instructions

`apps/api` owns the Cloudflare Worker, Durable Object room state, WebSocket room
traffic, live playback sync, P2P signaling, ICE/TURN access, and realtime room
telemetry.

## Source Of Truth

- Start with root `AGENTS.md`, `docs/current-development-state.md`, and
  `docs/project-operating-manual.md`.
- For room/P2P work, read the active P2P plans listed in root `AGENTS.md`.
- For env, Worker bindings, Cloudflare resources, and secrets, use
  `docs/environment-and-secrets-matrix.md`.

## Rules

- The Worker must verify authenticated room identity and room tokens; do not
  trust client-provided identity for authenticated rooms.
- Durable Object state is the live room authority. Durable account/product state
  belongs to `apps/web`/Supabase.
- Room event shapes, snapshots, generation counters, and signaling payloads must
  stay compatible with `packages/protocol` and extension consumers.
- Keep TURN/ICE credentials short-lived and authenticated. Do not add anonymous
  relay credential paths.
- Keep telemetry privacy-preserving. Do not log raw PII, raw ICE candidates,
  secrets, access tokens, or direct personal identifiers.
- Treat hibernation, socket attachments, alarms, replay buffers, quota metering,
  and sequence ordering as high-risk areas.

## Verification

- Run `pnpm --filter @anidachi/api check` and
  `pnpm --filter @anidachi/api test` for Worker/API changes.
- Run `pnpm --filter @anidachi/api test:runtime` when Cloudflare runtime
  behavior, Durable Objects, or Worker bindings are affected.
- Run `pnpm harness:rooms` for room protocol/signaling/lifecycle changes.
- Run `pnpm smoke:worker:staging` when staging Worker behavior matters.
