# Stripe 3DS and LIVE webhook readiness, October 2, 2026

Status: the separately authorized Stripe preparation block is complete. This is
not a production deployment, completed LIVE checkout or activation receipt.

## Scope

The owner asked to finish Stripe first, preserve purchased subscriptions and
leave the older $8/month Crunchyroll Fan subscription alone. One fresh disposable
AniDachi Sandbox customer/subscription and one staging QA user were created.
Existing Sandbox and LIVE customers were not mutated. No application runtime,
SQL function, Stripe API/SDK version, tax, notification or retry policy changed.

The fixture used a real Sandbox subscription with the prepared Plus annual price,
an exact 72-hour trial and Stripe's official authentication-required test card.
The application reservation RPC created the trial reservation; only that QA
reservation's creation timestamp was aligned to the historical Stripe clock.
The clock ran from September 24 to September 27, 2026. Postgres remained on real
time. This avoids the documented future-clock invoice-listing fixture limitation;
it does not prove the real-time trial boundary or actual Checkout/OAuth signup.

Subscription mirrors and trial states below came from signed Stripe webhooks and
the deployed staging access resolver. They were not manually written as results.

## Observed lifecycle

| Step | Stripe | Staging application |
| --- | --- | --- |
| Trial ends; card needs 3DS | First regular annual invoice open, USD 7,670 cents; PaymentIntent requires_action | past_due; first_payment_state=action_required; effective Free, canHost=false, history=plan_required; trial used |
| Cancel the bank challenge in hosted invoice UI | Same invoice unpaid; intent requires_payment_method with payment_intent_authentication_failure | first_payment_state=failed; still Free/no hosting; no new trial |
| Submit the same test card and complete 3DS | Same invoice paid once, amount_paid=7,670, amount_remaining=0; same intent succeeded | active Plus; paid through September 27, 2027; first_payment_state=paid; hosting/history eligibility restored; trial still used |
| Stop disposable QA subscription | canceled, no final invoice or proration requested | canceled; effective Free, no hosting; immutable first-payment state remains paid |
| Redeliver four earlier contended events | All ten relevant events have pending_webhooks=0 | All ten event rows processed with last_error=null; canceled/Free remains, historical paid state not downgraded |

Four near-simultaneous events initially received the existing retryable
"Stripe refresh busy; retry delivery" response while another event held the
subscription refresh lease. The action-required and paid events independently
updated access correctly. The four deferred events were deliberately resent
through the Sandbox Dashboard after cancellation, rather than waiting for the
Sandbox's displayed roughly one-hour retry. This verifies fresh-state refresh and
out-of-order safety; it is not a new background queue implementation or a claim
that every first delivery returned 200.

The hosted form initially focused optional Link email because its name field was
prefilled. Clearing only the optional Link name allowed the test payment without
creating a Link account or providing contact details. No AniDachi code change
was needed for this Stripe-owned form behavior.

## LIVE preparation

Account: AniDachi, livemode=true. Existing endpoint:
we_1TWGwEAGc1Bd58CjSA30Ttxu at
https://www.anidachi.app/api/stripe/webhook.

Added only invoice.payment_action_required to its six existing event subscriptions.
Endpoint URL, enabled status, API version 2025-06-30.basil and every other returned
endpoint field were preserved. Existing checkout.session.completed,
customer.subscription.created/updated/deleted, invoice.paid and
invoice.payment_failed subscriptions remain.

Fresh before/after readbacks of all 17 LIVE subscription objects (five active,
12 canceled, no additional result page) matched in every returned field. No
customer, subscription, item, price, invoice or payment was written in LIVE.
Annual prices and the separate Portal remain those in the
[LIVE catalog receipt](live-annual-setup-2026-10-02.md).

The inspected old production handler at a5a0134e acknowledges unhandled event
types without executing a billing branch. Subscribing to this extra event therefore
does not activate the new model. The new compatible handler already processes it
on staging; production handling requires the separately approved Web deployment.
No LIVE test event or real charge was sent to claim end-to-end production success.

The owner excluded developing a separate conversion path for the old
Crunchyroll Fan product. It retains its existing monthly terms. The current
same-product yearly flow must not be represented as covering that legacy product.

## Evidence and remaining boundaries

Private evidence: ignored artifacts/billing-3ds-20261002/evidence.json and paid.jpg.
It includes isolated QA IDs, observed access snapshots, event processing times and
the paid Sandbox invoice screenshot. The QA subscription was canceled and audit
objects retained. No future clock advancement is scheduled.

This proves Stripe-hosted 3DS cancellation/success plus real webhook/application
access readback. It does not prove signed-in navigation from AniDachi's
"Complete payment in Stripe" button, a new Checkout/auth session, real open-room
P2P closure, LIVE first invoices or production readiness. The source recovery
route verifies account/subscription/customer ownership, Stripe mode, open invoice
and an HTTPS invoice.stripe.com URL; no auth bypass was added for this QA run.

Next release work remains separately gated: connect production annual IDs,
deliver compatible schema/Web/Worker in the agreed order, verify actual customer
flows and old-client compatibility, complete Store/privacy acceptance, and launch
only at the owner's chosen time. No push, deployment, production env update,
Store action or policy activation occurred in this block.

Rollback of this event subscription, if explicitly required, removes only the
new invoice.payment_action_required entry while preserving a fresh read of every
other endpoint setting. Never restore a stale subscription snapshot. Catalog
rollback is covered in the LIVE catalog receipt.

## Verification scope

No runtime code changed; previously passing focused billing tests and full suites
were not rerun as substitutes for this external integration evidence. Documentation
links, whitespace and development-gate checks are required for this receipt;
semantic graph refresh follows the repository's safe update process.

References: [Stripe billing testing](https://docs.stripe.com/billing/testing),
[Stripe 3DS test cards](https://docs.stripe.com/testing?testing-method=payment-methods),
[webhook updates](https://docs.stripe.com/api/webhook_endpoints/update).
