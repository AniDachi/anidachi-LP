# apps/web Agent Instructions

`apps/web` owns durable product state, account surfaces, OAuth, Supabase,
Stripe, rooms/invites pages, dashboard flows, SEO, and internal web tooling.

## Source Of Truth

- Start with root `AGENTS.md`, then read `docs/current-development-state.md`,
  `docs/project-operating-manual.md`, and relevant domain docs.
- For subscriptions and entitlements, use `docs/social-pricing-model.md` and the
  current web auth/billing code as the source of truth.
- For env and secrets, use `docs/environment-and-secrets-matrix.md`.

## Rules

- Keep service-role Supabase access server-side only. The extension, browser
  client, and public routes must never receive service-role keys or signing
  secrets.
- Treat OAuth callback, session, extension-auth, Stripe, and room lifecycle
  routes as high risk.
- Staging must stay password-gated, noindex, out of sitemap output, and absent
  from public SEO/marketing pages.
- Do not change plan codes, entitlement semantics, room ownership, invite
  behavior, or durable account state without updating docs and affected runtime
  consumers.
- If a web change alters room, invite, subscription, or auth payloads consumed by
  the extension or Worker, check `packages/protocol` and the consuming plane
  before implementation is considered complete.

## Verification

- Run `pnpm --filter @anidachi/web check` for web code changes.
- Run `pnpm --filter @anidachi/web test` when behavior, auth, billing, rooms, or
  durable data logic changes.
- Use `pnpm smoke:worker:staging` or staging web checks when web behavior depends
  on live Worker/API state.
