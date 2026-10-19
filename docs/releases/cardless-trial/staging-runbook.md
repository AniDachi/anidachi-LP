# Cardless trial: staging rollout and recovery

Candidate dated 2026-10-11. This is an operator procedure, not evidence that
deployment or activation has occurred. Use the
[acceptance record](../../superpowers/plans/2026-10-11-cardless-trial-acceptance.md)
for actual outcomes. Production requires separate owner authorization.

## Targets and order

- Git: `codex/cardless-trial` -> reviewed PR -> `staging`. Never deploy this
  branch directly to production or promote the whole staging branch with Netflix.
- Supabase staging: `cyppqpprkygjloyfvvvj`, matching `db-staging.yml`.
- Web: `https://staging.anidachi.app`, Vercel Preview / exact `staging` branch.
- Stripe sandbox: `acct_1RlmiIPQIEOqG7pr`; SDK/API stay `18.5.0` /
  `2025-08-27.basil`. Existing test catalog and webhook are reused.
- Amplitude: AniDachi project `813335` only, with explicit staging properties.

Before merging, record the exact diff/CI result, current hosted migrations,
policy values and baseline subscriptions/trial/grant conditions. Use read-only
comparisons of IDs, prices, intervals, cancellation settings and entitlement
dates; never put secrets or real-person details in the release record. Exclude
owned synthetic test fixtures from the preservation comparison.

The five new migrations are `20261011124600`, `20261011132247`,
`20261011135040`, `20261011153028`, `20261011161158`. They add disabled policy/schema and do not
rewrite old subscription prices or opt them into the new trial. The normal
staging workflow applies ordered pending migrations. Keep cardless starts off
until migration and compatible Web deployment have both succeeded. Check auth,
old paid/canceled/card-required/manual-grant accounts and staging protection
before enabling the new offer. A successful build alone is insufficient.

Configure `ANIDACHI_TRIAL_EVENT_DRAIN_SECRET` only for exact Preview branch
`staging`, with the same value in staging Vault under
`anidachi_trial_event_drain_secret`. Generate a separate strong random value;
do not reuse notification or room credentials. Do not expose or print it.
Verify the configured Amplitude key belongs to AniDachi `813335`, then enable
`anidachi_private.trial_event_scheduler` with `environment='staging'`.
Absent configuration retains pending rows; no trial depends on HTTP ingestion.

Only after compatible deployment, enable `cardless_trials_enabled` using the
existing versioned billing policy mechanism. Preserve the other policy fields,
including `trials_enabled` and the existing paid-hosting cutover. Capture the
new revision. Use tagged synthetic staging accounts for real start/setup/cancel
and payment cases; never attach an arbitrary real Customer to a fixture.

Build the staging extension from this isolated checkout. Its generated folder
is distinct from the owner's original local extension-design folder. Validate
its staging identity, endpoints and narrow permissions. Loaded-artifact testing
and the old published-client check remain explicit acceptance gates.

## Unknown activation result

The Billing/Checkout recovery action calls owner-scoped
`POST /api/billing/trial/recover`; ordinary session, same-origin JSON and owner
guards apply. It resumes the persisted activation with its frozen plan/period,
even when new starts are disabled. It never creates a replacement reservation.

1. Inspect the account's activation, legacy Checkout reservation, stored IDs,
   idempotency key and operation time. Do not release a reservation just because
   a timer or lease expired.
2. Use normal owner recovery first. Inside the safe 23-hour replay window the
   same operation/key may replay. Beyond it only positive uniquely owned Stripe
   Customer/Schedule evidence can recover lost IDs; a search with no results is
   not proof that a prior request failed.
3. If still pending, inspect the matching sandbox Stripe request/object metadata
   and webhook records. Re-deliver the matching verified event or re-run the
   existing reconciliation with the same owned object. Never construct a new
   subscription, extend trial dates, clear the ledger or grant access manually.
4. If ownership/outcome cannot be established, keep the reservation pending and
   escalate with the operation ID and verified evidence. HTTP 400, a timeout,
   stopped invocation or empty object search alone never releases the account.

### Confirmed failed activation: private operator settlement

Use only the intended environment's operator connection. These functions are
`postgres`-only, unavailable to `service_role`, authenticated users and HTTP
routes. They preserve Customer identity and do not alter entitlement records.
Every hold/reconciliation/settlement writes a private audit record. Evidence is
an operator attestation with references to verified logs, not automatic provider
verification performed by SQL. Never paste secrets or response bodies into it.

1. Verify all serving versions have the new create-attempt guard. Retire any
   older invocation/deployment that could create without it. This candidate has
   not been hosted before these guards; do not roll back to an unguarded version.
2. Read the exact activation owner, ID, generated key, `created_at` and all
   `subscription_trial_activation_attempts`. Put it on hold using
   `anidachi_private.hold_cardless_trial_activation_v1(user_id, activation_id,
   frozen_key, true)`. The same account lock serializes hold, create admission,
   object recording and terminal settlement. An already-admitted request may
   still execute and must be accounted for.
3. Let all admitted invocations finish or positively verify their termination.
   Start/recover routes have a 180-second maximum duration; manual reconciliation
   additionally enforces at least five minutes after hold. **Elapsed time is
   not sufficient evidence.** Inspect the execution records and corresponding
   Stripe request logs: an HTTP request can continue at Stripe after its caller
   ends. If a deployment cannot enforce this bound or execution cannot be
   established, keep the hold and resolve that uncertainty first.
4. For every `applying` or `unknown` attempt, establish the actual outcome. An
   abandoned `begin` response or crash before dispatch requires positive
   no-dispatch execution evidence. A dispatched request requires its verified
   Stripe request/result evidence. If positive Schedule evidence exists, record
   `succeeded` and recover that exact object; never settle the activation failed.
   For a confirmed no-effect attempt, use
   `anidachi_private.reconcile_cardless_trial_attempt_v1(user_id, activation_id,
   attempt_id, 'no_effect', null, verified_request_id_or_null,
   provider_or_no_dispatch_evidence, terminated_executor_evidence)`.
   The function rejects missing evidence and does not expire any marker itself.
   Successful response markers are immutable. If Customer creation succeeded,
   verify and bind that same Customer through the existing owner-fenced
   `record_cardless_trial_customer_v1` before settling; do not create another.
5. Once every issued attempt is resolved, use
   `anidachi_private.settle_cardless_trial_activation_v1(user_id, activation_id,
   frozen_key, frozen_created_at, evidence_reference)`. It refuses unresolved
   attempts, any known Schedule success, recorded subscription/trial, mismatched
   identity or unbound successful Customer. It marks only that activation
   `failed`, retaining audit and allowing a new explicit request. A stale tab
   must obtain fresh admission and cannot revive the failed activation.
6. If reconciliation instead finds a real Schedule, normal positive-object
   recovery remains available during hold. If further retries are warranted,
   resume with the same hold function and `false`; preserve the original
   idempotency keys and 23-hour replay boundary.

This procedure does not promise automatic recovery from all unknown external
outcomes. An unverifiable provider result remains held for investigation.

## Unknown renewal or cancellation result

The UI's recovery action uses `POST /api/billing/trial/renewal/complete` for the
existing operation. Return and webhook use the same finalizer. It verifies fresh
Checkout, off-session SetupIntent, PaymentMethod ownership, frozen terms, current
generation and original trial end. An old tab cannot confirm a newer operation.

An `applying` operation fences later mutations until its outcome is known. Do
not tell the customer renewal is canceled while this state is unresolved.
Inspect the latest owned Schedule and Subscription, not a cached Stripe
idempotent response. Positive proof of an already-successful enable can commit
after native Schedule release without repeating an update. Otherwise an expired
unknown mutation settles only after verified native cancellation. Repeat the
desired cancellation after reconciliation using the current account state.

After Schedule release the ordinary subscription payment/recovery flow owns
decline and 3DS. Initial and update zero invoices are never recurring service or
cash conversion proof. A genuine post-trial recurring invoice fully settled by
Customer credit grants the paid service period; it need not charge the card.
`first_invoice_id`/`first_paid_at` retain that first settlement. Separate immutable
`first_cash_*` fields record the first positive cash receipt, even on a later
cycle, and only that receipt creates `trial_first_payment_succeeded`. Retain
cancellation while payment is due.

## Accelerated first-invoice reconciliation

In an existing-customer Sandbox Test Clock check, `created[gte=trial_end]`
returned no cycle invoice even though that invoice's returned `created` equaled
`trial_end`. For a fresh subscription with `livemode=false` and a Test Clock,
refresh therefore lists up to 100 invoices scoped to that subscription without
Stripe's date filter. It still filters returned timestamps and billing reasons,
selects the earliest eligible cycle, retrieves it fresh, and verifies ownership,
service period and settlement. Truncated history fails closed. Other
subscriptions retain the provider date filter; this observation does not prove
a Live Stripe issue.

After recovery, verify the same already-paid invoice in `first_invoice_id` and
`first_cash_*`, then repeat the ordinary Billing status refresh and check that
there is still only one logical `trial_first_payment_succeeded` event. Do not
charge again or manually patch the ledger. Analytics delivery remains separately
gated. Unpaid cardless Billing states pair `Trial ends` with the original
`trial.endsAt`, including local time, even when Stripe has moved the next billing
period forward. Paid states retain their normal renewal/end date.

## Analytics delivery recovery

Inspect `trial_conversion_events` aggregate counts and
`anidachi_private.trial_event_scheduler` status. Events keep their original ID,
time and frozen environment. Wrong/missing bearer and environment mismatch must
fail closed. Only the dedicated drain can lease/acknowledge bounded batches.

Unknown delivery uses the same insert ID and account identity. After six days
from first attempt it enters `manual_recovery_at`; do not clear that field or
replay older unknown results blindly, because provider deduplication lasts seven
days. Compare the event against AniDachi-scoped evidence before deciding whether
to acknowledge an observed delivery or perform a separately reviewed repair.
Do not alter source billing transitions to make a chart match.

## Deletion, rollback and outstanding acceptance

Account deletion is currently a manual support request. Before deleting its DB
records, resolve or cancel owned Stripe obligations through the existing billing
process, confirm their final state, then follow normal room/account cleanup.
An activation with reserved browser or installation claims cannot be deleted,
including through an account cascade (`TRIAL_ACTIVATION_DELETE_UNRESOLVED`).
Use the existing hold/reconcile/settle procedure first: unknown or applying Stripe
attempts retain their evidence; only proven no-effect settlement releases the
reservation. Consumed claims survive deletion until their original expiry. Do
not remove orphaned reservations automatically or infer no Stripe effect from a
missing activation. The October 19 preflight found no reserved orphans in either
staging or production.
Cascading the ledger/outbox does not cancel Stripe. The candidate adds neither
an automated delete endpoint nor permanent per-person anti-abuse retention.

Rollback disables new cardless starts and, if necessary, the analytics scheduler.
Retain compatible refresh/webhook/recovery code and all operation records so
already-started trials, confirmed renewals and payment retries keep working.
Do not roll the schema or billing handler back to a pre-cardless version.

Required hosted acceptance: signed-out/Free/trial/paid at desktop/mobile sizes;
Plus/Pro and both periods; verified-login start; explicit setup/cancel/recovery;
saved card, decline and canceled/successful 3DS; duplicate/out-of-order webhook;
two tabs/account change/network loss; paid purchase during pending work;
flag-off recovery; current and old extension clients; exact access expiry,
five-minute room closing with no reconnect reset, guest joining/history reads;
preservation comparison and owner sign-off.

Stripe Test Clocks do not advance Postgres or Worker clocks. Report separately
the sandbox billing results, local deadline tests and real-time hosted expiry.
If the real 72-hour observation is still running, record its due time and keep
that acceptance item open; do not shorten a real trial or claim the gate passed.
