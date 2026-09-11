# Sandbox subscription cancellation verification

Verified on September 12, 2026 against the staging site and AniDachi Sandbox.
This receipt contains no customer email, user identifier, portal access URL or
payment credentials. It does not authorize or verify LIVE configuration.

## Configuration

The staging Stripe context is `acct_1RlmiIPQIEOqG7pr`, `livemode=false`.
An active default customer portal configuration was saved in the Sandbox
Dashboard and independently retrieved through the Stripe API:
`bpc_1UEY3sPQIEOqG7prgiXgxMwc`.

- Subscription cancellation: enabled, `at_period_end`, no proration.
- Existing customer information, payment method and invoice settings retained.
- Subscription updates and the standalone portal login link remain disabled.
- No products, prices, LIVE subscriptions or application ownership/mode checks
  were changed.

The existing staging webhook is enabled for subscription updates and points to
the staging site. Its API version is `2025-06-30.basil`.

## Authorized verification

The user explicitly authorized canceling and restoring renewal of the current
Plus test subscription. The initial portal handoff and return without canceling
were also tested separately.

| Checkpoint | Stripe API | Staging account page |
| --- | --- | --- |
| Before | Active; cancellation unset | Plus, Active, renewal date |
| After confirmed portal cancellation | Active; `cancel_at_period_end=true`; `cancel_at` equals period end | Plus, Renewal canceled, subscription end date |
| After Dashboard `Don't cancel` and site refresh | Active; `cancel_at_period_end=false`; `cancel_at=null`; `canceled_at=null` | Plus, Active, renewal date and cancellation action restored |

The same subscription and billing period were retained throughout. Period end
remained `2026-09-21T19:07:15Z` (September 22 in the website browser timezone).
The test created no replacement subscription, refund or immediate payment.
No clock advancement or final expiry was performed. Retained Plus status was
verified; a new watch-history write during the brief cancellation window was
not part of this test.

The final requested state is restored. Production portal configuration and the
end-of-period downgrade remain separate acceptance checks.
