# Checkout continuation after sign-in — October 1, 2026

Status: local implementation on `codex/site-next-pass`, following staging
`85b01251`. No push, staging deployment, main promotion or real payment is included.

## Approved behavior

A guest chooses Plus or Pro and monthly or yearly billing, signs in with Google
or Discord, then continues directly to the selected Stripe Checkout. The login
screen names the selected plan and interval. There is no second plan selection.

- Pricing keeps both fields in the internal `/checkout?plan=...&billing=...`
  return path, including when a session expires during the checkout request.
- `/checkout` validates the selection, requires the existing website session,
  stays noindex and uses the minimal authentication page layout.
- The client reads a fresh account offer, checks the published price and passes
  the expected owner, trial status and amount to the existing checkout API.
- An eligible account continues automatically. An account without a trial must
  explicitly confirm the displayed immediate charge and renewal period.
- Existing subscriptions go to Account → Subscription. No extra subscription
  is created by the continuation screen.
- Network failures have a manual retry. One in-flight attempt, request IDs and
  the existing server reservation/reconciliation prevent accidental duplicate
  checkout attempts. Refreshing or retrying does not grant another trial.
- Leaving or hiding the tab immediately retires stale responses and paid
  confirmation; a manual retry checks the current account again.
- An invalid refresh session uses the existing `/api/auth/refresh` recovery
  route, which refreshes or clears cookies before redirecting. A still-valid
  access JWT cannot trap the visitor in a login/checkout loop.
- Provider cancellation, token exchange, user creation and token issuance
  failures preserve a validated checkout selection from the consumed OAuth
  transaction. OAuth start errors preserve only a valid internal checkout target.
  Missing, expired or uncorrelated OAuth state still fails closed; no untrusted
  callback query is used to reconstruct the destination.
- Stripe cancellation still returns to pricing with the billing period; it does
  not automatically reopen Checkout. Completion still uses the existing success
  screen and server/webhook subscription lifecycle.

## Scope and verification

Changed plane: website only. Existing API payloads, session/cookie contracts,
OAuth correlation and PKCE, entitlements, prices, Stripe session creation,
webhooks, database schema, Worker and extension are unchanged. No environment,
OAuth client, secret, Stripe Sandbox or live configuration changes are required.

Verified locally:

- New regression cases failed before the fix for selected-plan continuation and
  preserving the choice after OAuth cancellation/start failure.
- Focused pricing/continuation/OAuth suite: 52 passing tests.
- Full website suite: 963 passing tests, 6 existing skips, no failures.
- Website TypeScript check and scoped ESLint pass.
- Browser: guest Plus yearly and Pro monthly reach their contextual login
  screen; Google and Discord links both keep the exact plan and period.
- Component tests exercise the actual continuation UI, with external HTTP
  responses replaced: StrictMode, paid confirmation, owner change, session
  expiry, price mismatch/unavailable yearly price, server 409, expired offers,
  retry, double-click, background responses and partial-session recovery.
- Independent review found two edge cases (late background redirects and partial
  session loops). Both were reproduced, fixed and re-reviewed without findings.

Real Google/Discord → Stripe Sandbox → success is **not verified in this local
browser**. Local OAuth credentials remain unavailable. Owner acceptance belongs
to the later, explicitly authorized staging delivery; existing staging/main are
not changed by these local checks.

## Staging acceptance and rollback

After an authorized deployment, test guest Plus yearly and Pro monthly through
Google and Discord, cancel sign-in once and retry, then confirm the plan/period
and trial terms in Sandbox Checkout. Also verify a used-trial account, an existing
subscriber, and returning from Stripe without completing Checkout. The owner
performs the real account/payment acceptance.

Rollback is a code revert of this change: guest pricing returns to the prior
pricing page after login. No SQL, secret or Stripe rollback is needed. Already
created Checkout sessions and subscriptions retain their existing server lifecycle.
