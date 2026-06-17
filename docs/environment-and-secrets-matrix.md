# Environment And Secrets Matrix

This document lists where Anidachi runtime configuration lives. It records names,
owners, and verification steps only. Do not add secret values.

## Principles

- Secrets live in provider dashboards, not git.
- Public environment variables may be named here, but sensitive values are never
  pasted into docs, PRs, issues, or chat.
- Changing an environment variable affects only new deployments. Trigger or wait
  for a fresh deployment before testing.
- Staging and production must never accidentally share runtime endpoints.

## Vercel

Project: Anidachi web app.

| Variable | Environment | Purpose | Verification |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production | Public canonical site URL, expected `https://www.anidachi.app` | Inspect production metadata/canonical URLs |
| `NEXT_PUBLIC_SITE_URL` | Preview / `staging` | Staging public site URL, expected `https://staging.anidachi.app` | Load staging after password gate |
| `NEXT_PUBLIC_ROBOTS_NOINDEX` | Preview / `staging` | Forces noindex behavior on staging | Check `robots.txt` and `X-Robots-Tag` |
| `ANIDACHI_STAGING_GATE_ENABLED` | Preview / `staging` | Enables app-level staging password gate | Unauthenticated staging request shows gate |
| `ANIDACHI_STAGING_GATE_PASSWORD_SHA256` | Preview / `staging` | Hash of staging access password | Gate accepts known password, rejects wrong password |
| `ANIDACHI_STAGING_GATE_COOKIE_SECRET` | Preview / `staging` | Signs staging access cookie | Gate cookie persists in same browser |
| `KREATLI_CRM_PASSWORD` | Production / Preview as needed | Internal CRM access | CRM login works only for authorized users |
| `KREATLI_CRM_SESSION_SECRET` | Production / Preview as needed | Internal CRM session signing | CRM session survives refresh |
| Stripe variables | Production | Checkout and subscription flow | Stripe webhook/checkout smoke |
| OAuth client vars | Production / Preview | Google/Discord web auth | Login smoke on matching environment |
| Supabase public vars | Production / Preview | Browser-safe Supabase project config | `/api/me` and room APIs work |

## GitHub Actions

Repository: `AniDachi/anidachi-LP`.

| Name | Scope | Purpose | Verification |
| --- | --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Repository secret | Wrangler deploy account | `Deploy API` can dry-run/deploy |
| `CLOUDFLARE_API_TOKEN` | Repository secret | Wrangler deploy token | `Deploy API` succeeds on `staging`/`main` |
| `WXT_WEB_HTTP_BASE` | `staging` env variable | Staging extension web base | Build artifact debug info points to staging |
| `WXT_API_HTTP_BASE` | `staging` env variable | Staging extension API base | Extension connects to staging Worker |
| `WXT_API_WS_BASE` | `staging` env variable | Staging extension WS base | Extension WebSocket connects to staging Worker |
| `STAGING_ACCESS_CODE` | `staging` env secret | Staging smoke gate access | `Staging Smoke` passes |

Cloudflare deploy token must be scoped to the Anidachi account and include at
least:

- `Account -> Workers Scripts -> Edit`
- `Account -> Account Settings -> Read`
- `Account -> Account Analytics -> Read`

If Worker deploy fails with Analytics Engine code `10089`, confirm Analytics
Engine is enabled and the GitHub token has the current scopes.

## Cloudflare

| Resource | Staging | Production | Notes |
| --- | --- | --- | --- |
| Worker | `anidachi-api-staging` | `anidachi-api-production` | Names are distinct in `apps/api/wrangler.toml` |
| Durable Object binding | `ROOMS` | `ROOMS` | Class: `RoomDurableObject` |
| Analytics Engine binding | `ROOM_ANALYTICS` | `ROOM_ANALYTICS` | Dataset names differ by environment |
| Analytics dataset | `anidachi_room_events_staging` | `anidachi_room_events_production` | Appears after binding and first writes |
| Worker env var | `ANIDACHI_ENV=staging` | `ANIDACHI_ENV=production` | Used in telemetry/debugging |
| LiveKit URL | same configured URL | same configured URL | Legacy/historical until cleanup |

Worker secrets are managed with Wrangler/GitHub Actions. Do not store them in
repo docs. Expected categories:

- `ANIDACHI_JWT_SECRET`
- Cloudflare TURN key id / API token
- Any future internal server-to-server room-end secret

## OAuth Redirect Allowlists

Maintain separate entries for:

- Production website auth callbacks.
- Staging website auth callbacks.
- Production extension `chromiumapp.org` redirect URI.
- Staging extension `chromiumapp.org` redirect URI.

Changing extension IDs changes required redirect URIs. Verify Google and Discord
separately after any auth or extension-channel change.

## Supabase

Supabase service role key is server-only and must never reach the extension or
browser client bundles.

Document schema changes in migrations and verify them before relying on new
columns/RPCs in product code.

## Change Checklist

When changing any dashboard variable or secret:

1. Record the variable name and environment in the PR.
2. Do not record the value.
3. Trigger or wait for a new deployment.
4. Run the relevant smoke test.
5. Update this document and `docs/current-development-state.md` if behavior or
   ownership changed.
