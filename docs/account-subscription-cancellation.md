# Account subscription cancellation

Implementation candidate, 2026-09-09. Staging acceptance is pending. Production
promotion and live Stripe configuration remain separate decisions.

## Customer flow

`Account → Subscription` (`/account/billing`) shows the current authoritative plan,
recurring subscriptions, billing status, renewal/end dates, and pending
cancellation. Free accounts and manual plan grants with no recurring subscription
have no cancellation action. Existing canceled subscriptions remain visible.

`Cancel subscription` opens Stripe's cancellation confirmation for that specific
subscription. Opening the portal does not cancel it. Confirming there stops
renewal at the end of its billing period; existing paid access expires through
the established entitlement authority. There is no immediate-cancellation or
refund operation in AniDachi's new routes.

After either confirming or returning without cancellation, the page refreshes
Stripe state and displays the actual result. `Refresh status` retries a delayed
webhook or temporary sync failure. Query parameters never establish cancellation.
Payment failures are shown separately from the current plan.

The payment recommendation notice, checkout CTA, success page, and shared pricing
FAQ/snippets no longer advertise a blanket full refund guarantee. The existing
legal terms/refund policy are unchanged.

## Web contract and authority

- `GET /api/billing/subscription`: owner-private overview from subscription mirrors
  and `resolveAccountEntitlements`. A cached JWT plan is not access authority.
- `POST /api/billing/cancellation-portal`: body `{ subscriptionId }` selects the
  local subscription row owned by the signed-in user. Customer/subscription Stripe
  IDs are taken from server-side records and checked against a freshly retrieved
  Stripe subscription before opening a portal. Client customer/return URL fields
  have no authority.
- `POST /api/billing/refresh`: re-fetch nonterminal owned subscriptions through
  `syncStripeSubscriptionById` before returning the overview. Pending cancellations
  are refreshed; canceled and incomplete-expired subscriptions are terminal.

All three routes verify the durable website refresh session without rotating it.
The required `X-Anidachi-Billing-Owner` header fences a tab against a different
signed-in account. Cookie mutations require JSON and an exact matching Origin;
cross-site requests are rejected. Responses, including errors, are private and
no-store. Portal URLs and upstream billing payloads are not logged.

The existing durable lease/refetch/commit subscription-sync path and Stripe
webhooks remain the only billing mirror writers. The returned sync result now
also carries period end and pending cancellation for validation. The existing
mirror cancellation flag covers both classic `cancel_at_period_end` and flexible
`cancel_at` scheduling. Effective expiry is bounded by the earlier of the paid
period end and scheduled cancellation, never extended by cancellation. See
[Stripe billing mode behavior](https://docs.stripe.com/billing/subscriptions/billing-mode/compare#cancellations-in-the-customer-portal). No database,
protocol, Worker, extension, pricing, SDK/API-version, or entitlement-policy
change is introduced.

## Stripe configuration

No new environment variable is needed. The existing mode-safe Stripe client uses
TEST outside Vercel production and LIVE only in production. Runtime reads the
active default Customer Portal configuration and passes that exact ID when
creating the session. It never creates or edits a configuration.

In the matching Stripe **Sandbox** Dashboard, open [Customer Portal settings](https://dashboard.stripe.com/test/settings/billing/portal).
Select the intended Sandbox first, save the default portal configuration, and
set subscription cancellation to **at the end of the billing period**. Confirm:

- `active: true`, `is_default: true`, `livemode: false` for Sandbox;
- `features.subscription_cancel.enabled: true`;
- `features.subscription_cancel.mode: at_period_end`.

The runtime rejects missing, inactive, wrong-mode, disabled, or immediate-cancel
configurations with a retry/support message before issuing a session. Additional
portal features are not needed for the cancellation deep link. Use existing
branding/business and legal settings; cancellation does not require price or tax
configuration changes.

Before an explicitly authorized production rollout, independently check the
[live portal settings](https://dashboard.stripe.com/settings/billing/portal) and
existing subscription webhooks. Sandbox and live settings are separate. Existing
webhook coverage must include subscription updates/deletion; keep current signing
secrets and fenced sync. See [Stripe portal deep links](https://docs.stripe.com/customer-management/portal-deep-links)
and [portal integration](https://docs.stripe.com/customer-management/integrate-customer-portal).

## Verification and staging acceptance

Local evidence:

- `pnpm --filter @anidachi/web check`: passed on the final implementation.
- `pnpm --filter @anidachi/web test`: 495 passed, 6 pre-existing skips, no failures.
  This full run preceded the final flexible-cancellation normalization.
- Final focused billing service/route/UI/Stripe suite: 34 passed, including
  classic and flexible cancellation and expiry bounds.
- `pnpm dev:check`: web/docs profiles; `git diff --check`: passed.
- New billing files and modified Stripe helpers pass Biome checks.
- Headless Chromium fixture visual acceptance passed at 1440×1000, 390×844,
  and 320×740; details below. Real Stripe TEST end-to-end acceptance is pending.

Automated tests exercise owner/customer mismatches, CSRF and account switches,
wrong/absent portal configuration, pending/repeated cancellation, fenced refresh
failure, safe errors, authoritative plans, and the rendered active/pending/Free
states. They mock Stripe and do not mutate any account.

### Local visual evidence

The Browser plugin was unavailable; the existing Playwright/Chromium installation
was used with a loopback-only fixture preview at `/account/billing`. The preview
bundles the actual `BillingClient`, `AccountNav`, and compiled project CSS. Account
identity/header, routing wrappers, and billing API responses are fixtures; the
font uses a system fallback. This verifies rendered components and interactions,
not authenticated Next.js/Stripe integration or production font metrics.

Seven scenarios passed: active desktop, active mobile, active 320px narrow mobile,
mobile cancellation/return, unavailable portal, Free/no subscription, and overdue
payment. The keyboard-triggered cancellation opens an intercepted Stripe fixture;
returning triggers the real client refresh request and shows scheduled expiry
without a second cancellation button. No real Stripe request or subscription
mutation occurs.

The initial mobile check found global horizontal overflow: the implicit account
grid column expanded to the navigation's intrinsic width. Adding `grid-cols-1` to
`app/account/layout.tsx` constrains mobile to its container and preserves the
existing desktop template. All three viewport widths now have zero document
horizontal overflow, and visible buttons are at least 44px tall and stay within
the viewport. The navigation retains its intentional horizontal scrolling.

Page identity/content, absence of error overlays, interaction results, and
screenshots were checked. There were no JavaScript page errors or unexpected
console warnings/errors. The unavailable-portal scenario produces only the
expected browser resource error for its deliberately mocked HTTP 503.

Local-only, gitignored evidence is in `artifacts/billing-visual/`:
`desktop-active.png`, `mobile-active.png`, `narrow-active.png`,
`mobile-canceled.png`, `desktop-error.png`, `desktop-free.png`,
`mobile-past-due.png`, and `mobile-overflow-before.png`. `evidence.json` records
viewports, request assertions, measured overflow and console results. The preview
server and isolated headless browser were closed after verification.

On staging, using an explicitly authorized disposable Stripe TEST subscription:

1. Verify active plan, renewal date, mobile/desktop layout and keyboard access.
2. Open cancellation; verify the correct subscription and end-of-period date in
   Stripe. Return without confirming and check the subscription stays active.
3. Confirm cancellation of that disposable subscription; verify return refresh
   shows canceled renewal and the paid plan remains until period end.
4. Verify the webhook reaches the same mirror state; refresh again to confirm
   idempotent behavior. Advance only the disposable test clock to verify expiry.
5. Check already scheduled, canceled, Free/no-subscription, multiple-subscription,
   payment-overdue, unavailable Stripe, and changed-account cases.
6. Verify the recommendation/payment/success flow no longer shows the removed
   guarantee. Do not use real customer subscriptions for acceptance.

Rollback: revert the feature PR on staging. Existing subscription lifecycle,
webhooks, and scheduled cancellations remain valid. No migration rollback or
customer cancellation reversal is needed. Graphify refresh is coordinated with
the final scoped branch; the navigation query was `Trace Stripe subscription
sync, authoritative API session, account dashboard billing and cancellation`.
