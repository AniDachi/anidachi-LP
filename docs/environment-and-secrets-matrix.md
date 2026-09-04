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
| `ANIDACHI_API_INTERNAL_BASE_URL` | Preview / `staging` | Server-only Worker origin, expected `https://anidachi-api-staging.vladislav-gul7.workers.dev` | Host room end succeeds and the Worker receives `/internal/rooms/:roomId/end` |
| `ANIDACHI_API_INTERNAL_BASE_URL` | Production | Server-only Worker origin, expected `https://anidachi-api-production.vladislav-gul7.workers.dev` | Production host room end reaches the production Worker, never staging |
| `ANIDACHI_INTERNAL_API_SECRET` | Production / Preview `staging` | Authenticates Web/Worker room lifecycle calls and invitation-outbox recovery; use a distinct matching value in both runtimes per environment | Host room end completes without `ROOM_END_SYNC_FAILED`; authenticated recovery acknowledges a bounded drain; unauthenticated internal requests return `401` |
| `ANIDACHI_NOTIFICATION_DRAIN_SECRET` | Preview / exact branch `staging`; production only after separate promotion | Dedicated server-only authority for the notification drain; same environment's value is stored in Vault as `anidachi_notification_drain_secret`. Never reuse the room/internal secret | Missing/wrong bearer fails before database access; dedicated bearer works only at the drain, not room callbacks; verify after a new web deployment |
| `ANIDACHI_VAPID_SUBJECT` | Production / Preview `staging` | Server-side contact identity for existing Web Push delivery | Complete VAPID configuration is accepted; unavailable configuration leaves observable retry work |
| `ANIDACHI_VAPID_PUBLIC_KEY` | Production / Preview `staging` | Public application-server key used by extension push subscription registration | Registered extension subscription and server delivery use the same environment's key |
| `ANIDACHI_VAPID_PRIVATE_KEY` | Production / Preview `staging` | Server-only Web Push signing key; never include in Worker, extension or browser bundles | Controlled staging invitation records provider acceptance without logging key material |
| `KREATLI_CRM_PASSWORD` | Production / Preview as needed | Internal CRM access | CRM login works only for authorized users |
| `KREATLI_CRM_SESSION_SECRET` | Production / Preview as needed | Internal CRM session signing | CRM session survives refresh |
| `KREATLI_CRM_BLOB_READ_WRITE_TOKEN` | Production / Preview `staging` | Server-only authority for the existing private `kreatli-crm/*` data objects used by the waitlist and public forms | `/api/waitlist-stats` returns the durable nonzero count; a controlled form submission persists across a fresh deployment |
| `KREATLI_CRM_BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN` | Production / Preview `staging` (optional alternative) | OIDC form of the same CRM-only private Blob authority; do not configure it together with an unrelated store | Origin-fresh read and conditional ETag write succeed against the intended private store |
| `STRIPE_SECRET_KEY_TEST` | Preview / `staging`, Development | Server-only Stripe sandbox key. Must start with `sk_test_` | Staging checkout creates a test Checkout Session |
| `STRIPE_SECRET_KEY_LIVE` | Production | Server-only Stripe live key. Must start with `sk_live_` | Production checkout creates a live Checkout Session |
| `STRIPE_WEBHOOK_SECRET_TEST` | Preview / `staging`, Development | Stripe test webhook signing secret for `https://staging.anidachi.app/api/stripe/webhook` | Unsigned POST returns `400 Missing stripe-signature`; signed test event returns 2xx |
| `STRIPE_WEBHOOK_SECRET_LIVE` | Production | Stripe live webhook signing secret for `https://www.anidachi.app/api/stripe/webhook` | Unsigned POST returns `400 Missing stripe-signature`; signed live event returns 2xx |
| `STRIPE_PRICE_ID_PLUS_TEST` / `STRIPE_PRICE_ID_PRO_TEST` | Preview / `staging`, Development | Stripe test prices for AniDachi Plus/Pro | Test checkout writes `plus`/`pro` subscription state |
| `STRIPE_PRICE_ID_PLUS_LIVE` / `STRIPE_PRICE_ID_PRO_LIVE` | Production | Stripe live prices for AniDachi Plus/Pro | Live checkout writes `plus`/`pro` subscription state |
| OAuth client vars | Production / Preview | Google/Discord web auth | Login smoke on matching environment |
| Supabase public vars | Production / Preview | Browser-safe Supabase project config | `/api/me` and room APIs work |

`PRIVATE_INTEGRATION_BLOB_*` is a separate shared integration boundary. It must
not be added to production merely to enable the waitlist because doing so would
also activate unrelated deferred integration owners. The CRM-specific variable
above is the narrow public-product dependency.

The one-off recovery CLI uses
`KREATLI_CRM_LEGACY_PUBLIC_BLOB_READ_WRITE_TOKEN` for read-only source access and
`KREATLI_CRM_BLOB_READ_WRITE_TOKEN` for the private destination. These values
belong only in the operator process environment. They must not be committed,
printed, or added to browser/extension configuration.

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
| Worker env var | `ANIDACHI_WEB_INTERNAL_BASE_URL=https://staging.anidachi.app` | `ANIDACHI_WEB_INTERNAL_BASE_URL=https://www.anidachi.app` | Environment-specific target for room callbacks and invitation-outbox recovery; scheduler rejects a mismatched origin |
| Worker secret | `ANIDACHI_INTERNAL_API_SECRET` | `ANIDACHI_INTERNAL_API_SECRET` | Must match the Web value for the same environment and differ between staging/production |

The preceding invitation-outbox recovery caller uses the existing internal URL
and secret. The approved Supabase replacement uses a separate drain-only secret
and does not access `ROOMS` or change room lifecycle alarms. Disable only the old
staging cron after verifying automatic Supabase recovery; retain production
configuration until its separate promotion. The ordered rollout, current
activation state, and acceptance boundary are recorded in
`docs/superpowers/plans/2026-09-04-invitation-delivery-reliability.md`.

Worker secrets are managed with Wrangler/GitHub Actions. Do not store them in
repo docs. Expected categories:

- `ANIDACHI_JWT_SECRET`
- Cloudflare TURN key id / API token
- `ANIDACHI_INTERNAL_API_SECRET`

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

Invitation recovery uses pg_cron, pg_net and Vault in the same environment's
database. Its migration is dormant until an operator sets the environment and
enables the private singleton. Provision a fresh random drain-only value in
Vercel Preview `staging` and staging Vault without logging it or adding it to
local files. Verify effective denial of Vault and private scheduler access before
sending a credential-bearing request. Never grant `anon` or `authenticated`
access to scheduler state or the drain function. Preserve the platform-owned
pg_net ACLs: Supabase intentionally grants PUBLIC transport access, protected by
the non-exposed `net` schema and NOLOGIN client roles. Verify that `net`, `vault`
and `anidachi_private` are rejected by the Data API and that no client-callable
public function exposes their data. Do not attempt unsupported owner escalation.

The scheduled SQL sets a short statement timeout before a fixed private function
call; function-level timeout alone does not bound its outer SQL statement. Do not
put bearer values in cron commands, committed migrations, request IDs, or diagnostics.
Validate cron execution, HTTP result, and durable outbox completion separately.
The pg_net request queue is transient and is not a second delivery outbox.

## Change Checklist

When changing any dashboard variable or secret:

1. Record the variable name and environment in the PR.
2. Do not record the value.
3. Trigger or wait for a new deployment.
4. Run the relevant smoke test.
5. Update this document and `docs/current-development-state.md` if behavior or
   ownership changed.
