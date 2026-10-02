# Sandbox billing lifecycle verification, October 2, 2026

Status: real AniDachi Sandbox to staging webhook verification completed for the
scenarios below. This is not production acceptance or an authorization to launch.

## Environment and method

Only AniDachi Sandbox (`livemode=false`) and five newly created disposable staging
QA accounts were used. Stripe customers have no email or real payment details.
No existing customer subscription, LIVE configuration, production/main, deployment,
price or notification setting was changed. Checkout/auth UI was not exercised by
the fixture setup. Real application webhooks, not injected subscription results,
updated staging subscription mirrors and the immutable trial ledger.

| Scenario | Stripe result | Staging result |
| --- | --- | --- |
| Failed first payment after 72-hour trial | subscription_cycle invoice open, first attempt declined, past_due | first_payment_state=failed, Free, canHost=false, history=plan_required |
| Automatic recovery after trial | After the QA card change, scheduled second attempt paid the same 799-cent USD invoice | active Plus, hosting/history restored, first_payment_state=paid, trial still used |
| All retry attempts fail | Initial attempt plus 8 retries; canceled/payment_failed; invoice open, auto_advance=false, no next attempt | canceled, Free, hosting disabled, trial still used |
| Failed monthly renewal after paid first month | New renewal invoice declined, past_due | Free, hosting/history writes disabled, no trial ledger created |
| Automatic monthly recovery | Scheduled second attempt paid the same 799-cent USD invoice | active Plus, hosting/history restored; still no trial ledger |
| Awaiting-result expiry | Explicit staging SQL p_at at original trial end +119/+120 minutes | Access true at +119, false at +120 while awaiting; this does not grant extra access after a known failure |

Initial zero-dollar subscription_create invoices were distinguished from the
first regular subscription_cycle invoice. Neither recovery used a manual invoice
payment. All five QA subscriptions were stopped afterwards; Stripe and staging
both confirm canceled and effective Free/no hosting. QA audit rows and test-clock
history remain available; no future clock advancement is scheduled.

## Clock and runtime limits

A future Test Clock exposed a test-fixture limitation: Stripe invoice listing
with created >= future trial_end returned no invoices while the unfiltered list
contained them. That run is not evidence of first-payment ledger handling.
The successful trial run uses a separate historical clock (September 15 start,
September 18 trial end), with only its QA reservation creation times aligned to
the historical setup. Stripe clocks do not advance Postgres clock time; the
awaiting boundary therefore used explicit SQL p_at calls separately.

The local Cloudflare runtime test
`persists authority-loss closing deadline across renewed tokens and wake`
passed: 1 test passed, 95 skipped by filter; 1 file passed, 4 skipped. It covers
the fixed five-minute authority-loss deadline, hibernation/token renewal and
ROOM_ENDED/capability_expired. It does not prove real browser/P2P cleanup on staging.

## Evidence and remaining gates

Private local evidence is in the ignored
`artifacts/billing-recovery-20261002/{report.md,evidence.json,renewal.jpg}`.
It records exact Sandbox object IDs, application states and the paid invoice
screenshot. The checked source was `d34764bed8c1e0654a785c7048d459f1753ab67a`;
the staging deployment was not changed for these tests.

The subsequent [3DS/webhook receipt](stripe-3ds-readiness-2026-10-02.md) closes
action_required and Stripe-hosted browser recovery for an isolated annual trial.
Still open in the broader acceptance matrix: Checkout/OAuth-to-recovery-link
navigation for that fixture, real open-room behavior on paid-access loss, remaining
P11/mixed-client and recovery cases, plus launch-time LIVE/application reconciliation
and first LIVE invoices.
Prior owner-accepted trial signup/basic room behavior remains valid; these new
results do not claim the entire release is ready.
