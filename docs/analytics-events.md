# Analytics events (GA4 + Amplitude)

Added 2026-11-08 after the funnel audit. Code-only: no database, link or extension changes.

## Where analytics runs

- **GA4** loads only on `www.anidachi.app` (inline bootstrap in `app/layout.tsx`, built by
  `lib/analytics-env.ts`). Staging, localhost, previews and translate proxies send nothing.
- **Bot tag:** visits with `navigator.webdriver`, HeadlessChrome, or a 1280x1200 / 1366x1366 / 800x600
  screen send `traffic_type: "bot"` to GA4 and never start Amplitude or Session Replay. Add a GA4 data
  filter that excludes `traffic_type = bot` (GA4 Admin, internal traffic rule with value `bot`).
- **Amplitude (browser):** production host only. Autocapture limited to page views, sessions and
  marketing attribution. Session Replay samples 25%. `web_vital` goes to GA4 only.
- **Amplitude (server):** `lib/analytics-server-events.ts`, `emitServerEvent()`. Only when
  `VERCEL_ENV=production` and the commit ref is `main`. Fire-and-forget through `after()`, no retry
  queue, so a small loss is expected. Dedupe uses a deterministic insert id.

## Server events (Amplitude)

| Event | Where | Notes |
|---|---|---|
| `sign_up`, `login` | `handle-oauth-callback.ts` | `provider`, `flow` (extension, room_invite, friend_invite, checkout, uninstall, account, website). New user = row created in the last 60 s. `sign_up` carries first-touch fields from the `anidachi_first_touch` cookie. |
| `login_failed` | same | `error` code only |
| `extension_connected` | `app/extension/connect/page.tsx` | Closest signal to "installed and signed in" |
| `free20_warning_shown` | `free20-warning.ts` | Once per user per UTC day (claim id) |
| `free20_limit_reached` | `internal/rooms/[roomId]/ended` | Room ended with `quota_exhausted` in Free20 mode |
| `purchase_completed` | `stripe-webhook-events.ts` | Live, paid, amount > 0. Plan, period, value, landing path from Stripe metadata |
| `room_created`, `room_joined`, `room_connected` | rooms routes | `room_joined` = first guest join; `room_connected` once per user, room and role |
| `uninstall_reason_submitted`, `uninstall_checkout_started`, `uninstall_offer_claimed` | `uninstall-routes.ts` | |

## Browser events (GA4 + Amplitude unless noted)

- `invite_viewed` (state: ended, waiting_for_host, ready_to_join, ready_to_open), `uninstall_viewed`,
  `friend_invite_accepted` (outcome).
- GA4 only: `sign_up` (from the short-lived `anidachi_signup` cookie), `purchase` on `/success`
  (no value; revenue lives in Amplitude).
- Checkout events now carry `billing_period`.

## First touch

`captureFirstLandingPath()` also writes a first-party cookie `anidachi_first_touch`
(`{p: path, r: referrer host, u: utm}`, 90 days, written once). The server reads it at sign-up.

## GA4 Admin (manual)

Custom dimensions: `placement`, `page_template`, `cta_variant`, `seo_landing_path`, `cta_experiment`.
Key events: `extension_store_clicked`, `checkout_redirect_success`, `sign_up`, `purchase`.
Data filter: exclude `traffic_type = bot`. Unwanted referrals: Google sign-in and Stripe hosts.
