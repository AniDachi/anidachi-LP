# apps/extension Agent Instructions

`apps/extension` owns the WXT MV3 Chrome extension, content scripts, provider
adapters, Shadow DOM overlay, popup, auth bridge, local caches, player control,
P2P media, push-to-talk, and staging/public extension artifacts.

## Source Of Truth

- Start with root `AGENTS.md`, `docs/current-development-state.md`,
  `docs/extension-release-channels.md`, and relevant room/P2P plans.
- For provider behavior, read provider-specific notes such as
  `docs/crunchyroll-adapter-notes.md`.
- For staging build behavior, use the repo scripts and
  `docs/staging-acceptance-checklist.md`.

## Rules

- Keep Chrome Store permissions narrow. Broad host permissions are local-only or
  explicit staging-test artifacts.
- Do not put service-role keys, OAuth secrets, JWT signing secrets, Stripe
  secrets, Cloudflare tokens, or TURN secrets into the extension.
- Keep auth/session UI honest during refreshes and account switches; local
  caches must be account-scoped when data can identify a user or room.
- Provider adapters should isolate provider quirks from room/protocol logic.
- Overlay and media UI changes should preserve existing video behavior unless
  the product change explicitly says otherwise.
- P2P media, mic intent, camera state, and room reconnect behavior are high
  risk. Do not mark them done from same-machine smoke tests alone when real
  staging behavior is the product requirement.
- If the extension emits or consumes changed room events, update/check
  `packages/protocol`, `apps/api`, and relevant tests.

## Verification

- Run `pnpm --filter @anidachi/extension check` and
  `pnpm --filter @anidachi/extension test` for extension code changes.
- Run `pnpm build:extension:staging` and `pnpm validate:extension:staging` when
  behavior, manifest, permissions, channel config, or user-visible extension UI
  changes.
- Use `npm --prefix tests/e2e run harness:p2p` or staging two-client acceptance
  for P2P/media/reconnect changes.
