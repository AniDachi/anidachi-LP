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
| `ANIDACHI_EXTENSION_CLIENT_ID` | Production | Public approved store/ZIP identity `gpkolofebdhfpapbbgdkdkmlmjfidgmn` | After deployment, only this client's exact Chromium `/auth` and `/logout` callbacks are accepted; mismatched clients/paths remain rejected |
| `ANIDACHI_EXTENSION_CLIENT_ID` | Preview / exact branch `staging` | Public unpacked staging identity `ndkfphbchhfephdodcpehdcoclojagje` | Staging login stays bound to its own identity; production ID is not accepted |
| `NEXT_PUBLIC_ROBOTS_NOINDEX` | Preview / `staging` | Forces noindex behavior on staging | Check `robots.txt` and `X-Robots-Tag` |
| `ANIDACHI_STAGING_GATE_ENABLED` | Preview / `staging` | Enables app-level staging password gate | Unauthenticated staging request shows gate |
| `ANIDACHI_STAGING_GATE_PASSWORD_SHA256` | Preview / `staging` | Hash of staging access password | Gate accepts known password, rejects wrong password |
| `ANIDACHI_STAGING_GATE_COOKIE_SECRET` | Preview / `staging` | Signs staging access cookie | Gate cookie persists in same browser |
| `ANIDACHI_API_INTERNAL_BASE_URL` | Preview / `staging` | Server-only Worker origin, expected `https://anidachi-api-staging.vladislav-gul7.workers.dev` | Host room end succeeds and the Worker receives `/internal/rooms/:roomId/end` |
| `ANIDACHI_API_INTERNAL_BASE_URL` | Production | Server-only Worker origin, expected `https://anidachi-api-production.vladislav-gul7.workers.dev` | Production host room end reaches the production Worker, never staging |
| `ANIDACHI_INTERNAL_API_SECRET` | Production / Preview `staging` | Authenticates Web/Worker room lifecycle calls and invitation-outbox recovery; use a distinct matching value in both runtimes per environment | Host room end completes without `ROOM_END_SYNC_FAILED`; authenticated recovery acknowledges a bounded drain; unauthenticated internal requests return `401` |
| `ANIDACHI_FREE20_ACCOUNTING_ENABLED` | Web scope: Preview / exact branch `staging` only; Production excluded. Absent at the initial November1 preflight; live deployment/activation receipts in [PR490](https://github.com/AniDachi/anidachi-LP/pull/490) | Server-only opt-in for Free20 create/connect, account status/warning, internal budget and billing refresh delivery; exact `true` only. Also requires SQL `hosting_commercial_policy.free20_enabled` and a durable daily-room marker. Uses the existing room service credential, never a client flag | Missing/other value returns `503 FREE20_ACCOUNTING_DISABLED` at the authenticated internal budget route; account status reports disabled. The owner authorized staging activation after readiness gates. Follow the [staging runbook](superpowers/plans/2026-11-01-free20-staging-activation-runbook.md): compatible schema/runtime first, SQL last, new deployment required. Do not configure broad Preview or Production |
| `ANIDACHI_FREE20_ABUSE_ENABLED` | Enabled by the owner on November 4 locally, only Preview / exact branch `staging`. Never broad Preview or Production | Exact `true` enables the credentialed context endpoint and v5 scoped callers. Reuses existing browser-cookie/installation-key signing and internal room credentials; no new secret or Worker anti-abuse flag | Additive SQL `hosting_commercial_policy.free20_abuse_enabled` defaults false and independently fences final admission, including old RPCs; staging activation advanced policy revision 4 to 5 with both gates enabled. Follow the [anti-abuse runbook](superpowers/plans/2026-11-03-free20-abuse-staging-runbook.md#authorized-activation-receipt-november-4-2026): schema first, compatible Web/Worker and client, Web gate and canonical-origin verification, normal unprotected-room drain, guarded SQL policy last. Missing/other value keeps enrollment unavailable; SQL must remain off until compatible callers are verified. Protected rooms retain bound accounting after admission enforcement is disabled |
| `ANIDACHI_TRIAL_EVENT_DRAIN_SECRET` | Candidate: Preview / exact branch `staging`; Production only after separate approval | Dedicated analytics-drain bearer, same environment's Vault name `anidachi_trial_event_drain_secret`. Distinct from room/notification credentials. Never include in Worker or clients | Missing/wrong bearer fails before DB access; initially disabled private scheduler; verify canonical environment and AniDachi Amplitude project `813335` before enabling |
| `ANIDACHI_NOTIFICATION_DRAIN_SECRET` | Preview / exact branch `staging`; production only after separate promotion | Dedicated server-only authority for the notification drain; same environment's value is stored in Vault as `anidachi_notification_drain_secret`. Never reuse the room/internal secret | Missing/wrong bearer fails before database access; dedicated bearer works only at the drain, not room callbacks; verify after a new web deployment |
| `ANIDACHI_HOSTING_CUTOVER_DRAIN_SECRET` | Planned Preview / exact branch `staging`, then separately Production | Server-only cutover-drain authority; matching same-environment Vault name `anidachi_hosting_cutover_drain_secret`. Distinct from room and notification keys; never put in Worker or extension | New Web drain accepts only this bearer; room admission rejects it; private SQL recovery remains disabled until verified. Not configured remotely by the local implementation |
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
| `STRIPE_PRICE_ID_PLUS_YEARLY_TEST` / `STRIPE_PRICE_ID_PRO_YEARLY_TEST` | Development; Preview / exact branch `staging` configured September 30 | AniDachi Sandbox annual prices, USD, year/1, licensed | Annual Checkout uses the full annual charge and the same account-wide trial authority |
| `STRIPE_PRICE_ID_PLUS_YEARLY_LIVE` / `STRIPE_PRICE_ID_PRO_YEARLY_LIVE` | Production, not configured by the September 30 local work | Separate live annual prices; no monthly fallback | Verify independently before enabling annual sales in production |
| `STRIPE_PRICE_IDS_PLUS_YEARLY_LEGACY_TEST` / `STRIPE_PRICE_IDS_PRO_YEARLY_LEGACY_TEST`; corresponding `_LIVE` names | Recognition-only aliases; TEST catalog separation is a November 5 staging candidate, LIVE configuration requires separate approval | Comma-separated archived annual price IDs; whitespace and empty tokens ignored. Preserve existing subscriptions/webhook entitlement recognition after changing the configured annual purchase targets | Neither Checkout nor yearly confirmation selects aliases. Verify old annual subscriptions still resolve Plus/Pro; archive old annual prices before enabling native cancellation offers on their former monthly products |
| `STRIPE_YEARLY_PORTAL_CONFIGURATION_ID_TEST` / `STRIPE_YEARLY_PORTAL_CONFIGURATION_ID_LIVE` | TEST configured for Preview / exact branch `staging`; LIVE awaits separate promotion | Dedicated **non-default** configuration for immediate monthly-to-yearly confirmation; `price` only, `always_invoice`, no scheduled changes, annual products/prices explicitly allowed | Existing paid monthly subscription opens `subscription_update_confirm` for the same item; the normal cancel/restore configuration stays unchanged |
| `STRIPE_PRODUCT_HUNT_COUPON_ID_TEST` / `STRIPE_PRODUCT_HUNT_COUPON_ID_LIVE` | TEST only on Preview / exact branch `staging`; LIVE must remain unset until accepted promotion | Nonsecret coupon ID for customer-bound ANIHUNT40, 40% repeating 3 months, Plus/Pro products only, redemption cutoff `2026-11-01T17:00:00Z` | Absent disables issuance. Apply campaign-binding migration and annual Checkout/Portal guards before enabling. No unsuffixed fallback should be configured. See [campaign plan](superpowers/plans/2026-10-22-product-hunt-promo.md). |
| `STRIPE_UNINSTALL_FIRST_ENABLED_TEST` / `STRIPE_UNINSTALL_FIRST_COUPON_ID_TEST`; corresponding `_LIVE` names | Exact `true` enables only the resolved Stripe mode; TEST on branch `staging`, LIVE remains off pending launch approval | One-month 40% offer for a new monthly Plus/Pro subscription, including eligible former subscribers. Account-bound promotion and one shared lifetime allowance | Disabled/absent fails closed. Verify schema, Checkout recovery and same-mode coupon first. No unsuffixed/cross-mode fallback. See [Free20 preparation](releases/free20/production-preparation-2026-11-06.md). |
| `STRIPE_UNINSTALL_RENEWAL_ENABLED_TEST` / `STRIPE_UNINSTALL_RENEWAL_COUPON_ID_TEST`; corresponding `_LIVE` names | Exact `true` enables only the resolved Stripe mode; LIVE not enabled by preparation | One-month 40% next-renewal offer on the existing monthly subscription; shares the same lifetime account allowance | Enable only after compatible signed `invoice.created` handling and the existing same-environment webhook subscription are verified. Turning issuance off retains fulfillment of accepted claims using their stored coupon. No cross-mode fallback. |
| `STRIPE_CANCELLATION_RETENTION_ENABLED_TEST`; corresponding `_LIVE` name | Exact `1` enables only the resolved Stripe mode; LIVE remains off pending launch approval | Native owner-specific cancellation offer: 40% once, monthly products only; shared lifetime allowance with both uninstall paths | Verify `20261105120000`, compatible reconciliation, separate annual targets/legacy aliases and archived old annual sale prices first. Disabling issuance preserves accepted coupons/grants and reconciliation. No unsuffixed/cross-mode fallback. See [Free20 preparation](releases/free20/production-preparation-2026-11-06.md). |
| OAuth client vars | Production / Preview | Google/Discord web auth | Login smoke on matching environment |
| Supabase public vars | Production / Preview | Browser-safe Supabase project config | `/api/me` and room APIs work |
| `NEXT_PUBLIC_AMPLITUDE_API_KEY` | Production (Preview optional) | Browser Amplitude project key | Client `trackConversion` events reach AniDachi Amplitude |
| `AMPLITUDE_API_KEY` | Production (optional; falls back to public key) | Existing Amplitude HTTP publisher for ZIP downloads and the candidate verified trial funnel | Key must belong to AniDachi project `813335`; trial events include explicit environment and immutable insert IDs. No new project or key is provisioned |
| `EXTENSION_ZIP_URL` | Production (Preview optional) | Sole source: immutable public HTTPS Blob/CDN URL of the approved zip, without credentials or a fragment | `/api/extension/download` redirects only to this URL; no local-file fallback |
| `EXTENSION_ZIP_VERSION` | Same as zip URL | Semver shown on `/extension` | Hub version matches the built artifact |
| `EXTENSION_ZIP_SHA256` | Same as zip URL | 64 hex SHA-256 of the zip bytes | `/api/extension/latest` checksum matches downloaded zip during release acceptance |
| `EXTENSION_ZIP_BYTES` | Same as zip URL | Zip size in bytes for hub copy | Size on `/extension` is honest |

All four `EXTENSION_ZIP_*` values above must be valid before the page and APIs
declare a download available. `available` is configuration readiness, not a live
storage health check. Before enabling a release, verify the actual hosted file,
its download headers, checksum, size and production identity; do not hash/download
the archive during every page request. Metadata and redirects use `no-store`.
`EXTENSION_ZIP_PATH` is retired and ignored in every environment. The source URL is
visible to the browser in the redirect: use a public artifact, never an expiring
authenticated URL or secret query token. Keep an old published artifact immutable
so rollback can restore its URL and matching metadata together.

`PRIVATE_INTEGRATION_BLOB_*` is a separate shared integration boundary. It must
not be added to production merely to enable the waitlist because doing so would
also activate unrelated deferred integration owners. The CRM-specific variable
above is the narrow public-product dependency.

The one-off recovery CLI uses
`KREATLI_CRM_LEGACY_PUBLIC_BLOB_READ_WRITE_TOKEN` for read-only source access and
`KREATLI_CRM_BLOB_READ_WRITE_TOKEN` for the private destination. These values
belong only in the operator process environment. They must not be committed,
printed, or added to browser/extension configuration.

## Application maintenance preparation

`ANIDACHI_MAINTENANCE_MODE` is an optional server-only setting for Web and
Worker. Unset, empty or exact `open` preserves existing behavior; `closed` or
an invalid nonempty value returns retryable HTTP 503 before application handlers
and pauses the Worker's notification recovery caller. It adds no new secret or
operator bypass. No environment enables it automatically.

This is deployment-local admission only. Existing sockets, Durable Object
alarms, Postgres jobs, in-flight work and old deployments need separate controls.
Activation and reopening follow the
[maintenance admission contract](releases/personal-history-mvp/maintenance-admission.md)
and the reviewed production transition sequence. Never apply it to working
staging or production as an incidental configuration test.

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
| Worker env var (staging deployed; production source preparation November 7) | `ANIDACHI_FREE20_ACCOUNTING_ENABLED="true"` in `[env.staging.vars]` | `"true"` prepared in `[env.production.vars]`; not deployed | Exact `true` enables accounting only for authenticated SQL-marked daily rooms, plus internal refresh/retry paths. Existing unmarked rooms are not adopted. Source values survive CI deployment; selected room mode remains durable. Production deployment is manual and gated on the exact main SHA after schema/compatible Web readiness. Follow the [launch runbook](releases/free20/production-preparation-2026-11-06.md); runtime preparation precedes SQL activation and is not enabled acceptance |
| Worker env var | `ANIDACHI_WEB_INTERNAL_BASE_URL=https://staging.anidachi.app` | `ANIDACHI_WEB_INTERNAL_BASE_URL=https://www.anidachi.app` | Environment-specific target for room callbacks and invitation-outbox recovery; scheduler rejects a mismatched origin |
| Worker secret | `ANIDACHI_INTERNAL_API_SECRET` | `ANIDACHI_INTERNAL_API_SECRET` | Must match the Web value for the same environment and differ between staging/production |

The preceding invitation-outbox recovery caller uses the existing internal URL
and secret. Supabase recovery is active on staging with a separate drain-only
secret and does not access `ROOMS` or change room lifecycle alarms. The old
staging invitation cron was disabled after automatic Supabase recovery was
verified on 2026-09-04. The November1 Free20 purchase-delivery block adds a
distinct `*/2 * * * *` staging Worker schedule; it only retries the Free20
outbox when the existing Free20 flag is enabled. Invitations remain on
Supabase Cron. Deployed production remains unchanged until its separate
promotion; the production accounting source flag is prepared for that manual
deployment. The invitation rollout and acceptance boundary are recorded in
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
separately after any auth or extension-channel change. The production packed
`key` exists so unpacked sideload IDs (and those redirect URIs) stay stable —
do not rotate it.

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

## Cardless trial candidate: staging rollout

The five October 11 migrations add the disabled `cardless_trials_enabled` policy,
provider email proof, durable activation/consent records and a disabled analytics
scheduler. No new Stripe key, price, webhook endpoint or shared Portal setting is
required by the candidate. Existing Test credentials remain staging-only.

`anidachi_private.trial_event_scheduler` is separate from notification delivery.
Its environment must match the reviewed Vercel target and Git branch:
`VERCEL_ENV=preview` + `VERCEL_GIT_COMMIT_REF=staging`, or
`VERCEL_ENV=production` + `VERCEL_GIT_COMMIT_REF=main`. Both system variables
must be exposed to the server runtime. Development, missing metadata and feature
Previews do not drain. `NEXT_PUBLIC_SITE_URL` is SEO/public-origin configuration
and does not identify the analytics environment. The private scheduler uses only the dedicated Vault bearer and a fixed
matching host, eight events per batch, and bounded retry leases. Configure its
secret/environment before enabling; a missing key does not lose pending events.

This document records required configuration, not a claim of hosted activation.
Follow the [staging runbook](releases/cardless-trial/staging-runbook.md) and
[acceptance evidence](superpowers/plans/2026-10-11-cardless-trial-acceptance.md).
