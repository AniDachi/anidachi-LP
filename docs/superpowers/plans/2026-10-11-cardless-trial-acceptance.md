# Cardless trial: acceptance evidence

Date: 2026-10-11. Status: **Candidate deployed to staging with new starts and
analytics delivery disabled. Preservation and deployment checks passed; an
analytics environment repair and real account acceptance remain open. No
production rollout.**

- [Design](../specs/2026-10-11-cardless-trial-design.md)
- [Implementation plan](2026-10-11-cardless-trial.md)
- Branch: `codex/cardless-trial`, isolated from extension design.
- Base: `60df2876be22a55af5f719918ad5fd5b1c79df65` (`origin/staging`).
- Owner authorized sequential implementation and sandbox checks, with independent
  billing review and final review. Production requires separate authorization.

## Verified tooling and access

The SDK proof runner uses the application's API pin `2025-08-27.basil` and the
existing lockfile SDK `18.5.0` (package range `^18.3.0`); no version upgrade.
It requires explicit `--test` and `--account`, and validates the actual response
account, test mode and API version before writes. Fixture ownership is checked
with `anidachiProof=cardless_trial` plus a unique run ID. No real-customer
enumeration, caller-supplied existing customer IDs or deletion is supported.

The user connected **AniDachi sandbox** (`acct_1RlmiIPQIEOqG7pr`). CLI profile
`anidachi-cardless-proof` authenticated successfully into that sandbox; its
profile reports a test credential and no live credential. The scripts-only
CLI transport uses that credential internally, explicitly selects `--live=false`
and the pinned API, and checks the **response** `Stripe-Version` header.
It never extracts the key, forwards SDK Authorization or prints raw CLI headers.
An inherited `STRIPE_API_KEY` is removed from the child environment.

The connector schema (`2026-09-30.preview`) is not used as pinned-version proof.
No live billing calls or settings changes were performed.

- Ten guard/transport tests: RED observed for new behavior, then GREEN.
- At the Task 0 checkpoint, TypeScript passed including all three proof scripts.
- Task 0 baseline web suite: 986 tests, 980 passed, six skipped, zero failures.
  Task 1 product changes and their newer results are recorded separately below.
  Scripts have their separate explicit test command below.

```sh
pnpm --filter @anidachi/web exec tsx --test \
  scripts/stripe/cardless-trial-proof.test.ts \
  scripts/stripe/stripe-test-cli-transport.test.ts
pnpm --filter @anidachi/web check
```

## Real sandbox results: original subscription design

Run `7d80e097-3257-4fdf-bd46-cafd0f2c1c41`, pinned API, completed
2026-10-11 11:19 UTC. Each subscription was created in one call with a three-day
trial and `cancel_at_period_end=true`. Test clocks advanced to expiry and then
four hours beyond it.

| Scenario | Subscription | Verified result |
| --- | --- | --- |
| No consent, no saved card | `sub_1UPKmTPQIEOqG7prsbBV8ZDt` | 259200 seconds; canceled; only initial zero invoice; no PaymentIntent, charge, payment attempt or debt |
| No consent, saved test Visa | `sub_1UPKmkPQIEOqG7prVkSY7lYz` | Same result despite Customer default payment method |

The runner correctly returned `passed=false` with remaining scenarios pending.
Its own exit code was 2; pnpm reported the nonzero child command as an error.

```sh
pnpm --filter @anidachi/web exec tsx scripts/verify-cardless-trial-sandbox.ts \
  --test --account acct_1RlmiIPQIEOqG7pr --cli-profile anidachi-cardless-proof
```

### Already-open Portal: FAILED the AniDachi-only consent contract

Run `531d1b59-c4c4-4349-9ecb-dbd3fa0e29c5`:

1. Created a synthetic Customer with a saved test Visa. Opened its Portal in
   a browser **before** creating the trial.
2. Used the existing sandbox default configuration
   `bpc_1UEY3sPQIEOqG7prgiXgxMwc`, without changing it. Subscription cancellation
   is enabled at period end; subscription updates are disabled.
3. Created `sub_1UPKrbPQIEOqG7prIiY3UVx2`, original trial
   `1791717797` → `1791976997` (exactly 72 hours), scheduled cancellation enabled.
4. Reloaded the same Portal session. It showed **Don't cancel subscription**.
   The following page displayed $7.99/month and the renewal date.
5. Explicitly pressed **Renew subscription**. API inspection confirmed
   `cancel_at_period_end=false`, while the original trial end stayed unchanged.
6. Advanced only its test clock to trial end plus four hours. Stripe created
   and paid invoice `in_1UPKtTPQIEOqG7prTBFsJT6K` for 799 USD cents, one attempt;
   PaymentIntent `pi_3UPKtWPQIEOqG7pr1h4TiIsO` and charge
   `ch_3UPKtWPQIEOqG7pr1WCQl28G` succeeded.

This is **not a charge without any user action**: the test explicitly confirmed
renewal inside Stripe. It proves that Stripe's confirmation can bypass the
proposed AniDachi quote/setup/consent ledger. Hiding future Portal entry points
on AniDachi cannot establish the original contract for already-open sessions.

## Selected Stripe mechanism: Subscription Schedule

After the explanation, the owner authorized continuing the schedule proof.
The following diagnostic established the Portal behavior; the full set of
Stripe capability checks below followed on the same schedule mechanism.
Official Stripe documentation supports a phase whose `trial_end` equals its
`end_date`, with schedule `end_behavior=cancel`. It also describes restrictions
on Portal changes to scheduled subscriptions:

- [Subscription schedules and trials](https://docs.stripe.com/billing/subscriptions/subscription-schedules#use-trials)
- [Customer Portal limitations](https://docs.stripe.com/customer-management#limitations)

Run `40cb6052-609e-4a03-8ee6-6090e1155f24` used a second synthetic Customer,
saved test Visa, and another Portal session opened before creation. One API call
created schedule `sub_sched_1UPKxvPQIEOqG7prO3AAD6aD` and its subscription
`sub_1UPKxvPQIEOqG7prSpBDi1bt`:

- Trial start/end: `1791718191` → `1791977391`, exactly 259200 seconds.
- Single all-trial phase, same end date, `end_behavior=cancel`.
- Underlying subscription has `cancel_at=trial_end`; its
  `cancel_at_period_end` is **false**, so existing flag-only assumptions require
  explicit adaptation if this candidate is adopted.
- The old Portal still displayed **Renew subscription**, but actual submission
  returned **Something went wrong, and your subscription was not renewed**.
  Fresh API inspection confirmed its scheduled end was unchanged.
- After clock advance to expiry plus four hours: subscription canceled, only
  its initial zero invoice, zero payment attempts, no PaymentIntent or charge.

Thus the tested schedule rejected this Portal path. The visible Stripe error is
also a UX limitation to account for; this is not evidence that every possible
Portal operation, consent race or payment path has been verified.

Reproducer phases (each requires `--test --account ... --cli-profile ...`):

```text
verify-cardless-trial-portal.ts prepare
Open returned test Portal before continuing.
verify-cardless-trial-portal.ts create-trial
Use the same Portal to attempt renewal; inspect its UI result.
verify-cardless-trial-portal.ts inspect
verify-cardless-trial-portal.ts advance
```

Append `-schedule` to each phase for the schedule candidate. Receipts live in
ignored `.superpowers/sdd/2026-10-11-cardless-trial/`; they cannot be silently
overwritten. Ephemeral Portal URLs and local screenshots are not committed.

## Completed Schedule capability checks

The new runner `apps/web/scripts/verify-cardless-schedule-sandbox.ts` completed
14 named cases, each with `passed=true`, between 12:00 and 12:25 UTC on
2026-10-11. Every case owns a separate synthetic Customer, Schedule,
Subscription and Test Clock. The earlier successful original-subscription
cases are **not** counted toward these results.

| Case | Subscription | Result |
| --- | --- | --- |
| `expiry-no-card` | `sub_1UPLVRPQIEOqG7prTJ78jWxs` | Canceled at 72h; initial zero invoice only; no payment attempt, PaymentIntent, charge or debt |
| `expiry-saved-card` | `sub_1UPLVsPQIEOqG7pr4VKYtzFn` | Same, despite an existing Customer default card |
| `expiry-relative-duration` | `sub_1UPLYtPQIEOqG7prvK1U0Ucq` | Native `duration: day × 3` + `trial: true` accepted on pinned API; exactly 259200 seconds; no payment |
| `opt-in-monthly` | `sub_1UPLQIPQIEOqG7prvBDagEJW` | Original end preserved; one 799-cent cycle invoice paid after trial |
| `opt-in-pro-annual` | `sub_1UPLWIPQIEOqG7prNBoQXycs` | Explicit change from monthly fixture to 14390-cent yearly fixture; same trial end; one correctly priced cycle payment |
| `cancel-after-opt-in` | `sub_1UPLSIPQIEOqG7prhprQrQPm` | Cancel restored the scheduled end; replay of the old opt-in key did not reverse it; no payment at expiry |
| `late-setup-no-card` | `sub_1UPLT4PQIEOqG7prXmtVFKjm` | Setup completed after expiry; actual schedule update rejected; no payment |
| `late-setup-saved-card` | `sub_1UPLTiPQIEOqG7prCmEvuaM1` | Same with an existing Customer default card |
| `boundary-no-card` | `sub_1UPLUHPQIEOqG7prS23nheIo` | Read active at end−1s; delayed update after end+4h rejected; no payment |
| `boundary-saved-card` | `sub_1UPLUrPQIEOqG7praTJfqraD` | Same with an existing Customer default card |
| `boundary-exact-no-card` | `sub_1UPLnHPQIEOqG7prmXKmsSIt` | Read active at end−1s; update after clock reaches exactly end rejected; no payment |
| `boundary-exact-saved-card` | `sub_1UPLoDPQIEOqG7prHjaVZm3X` | Same with an existing Customer default card |
| `decline-after-opt-in` | `sub_1UPLXCPQIEOqG7prfD8adbB7` | Setup succeeds; first charge declines; invoice remains open/unpaid, Subscription past_due, no successful charge |
| `checkout-3ds` | `sub_1UPLZpPQIEOqG7prDdRiN5sm` | Real setup Checkout and 3DS in browser; first payment requires 3DS; canceled challenge stays unpaid; successful retry pays the same invoice once |

The exact-boundary row IDs and all outcomes are also retained in local receipts;
only synthetic identifiers appear here. Ordinary `checkout` without 3DS is an
optional runner case and was not executed: hosted setup was exercised by
`checkout-3ds`, while the ordinary successful charge is covered by `opt-in-monthly`.

### Creation and renewal semantics

The early cases used explicit `end_date=trial_end` relative to the frozen test
clock. The relative-duration case, browser case and exact-boundary cases use
`start_date=now`, `duration={interval:day, interval_count:3}`, `trial=true`.
Both produce the same single all-trial phase and exact 72-hour Subscription.
The product design uses the latter so that request latency does not shorten
the trial before Stripe creates it.

Opt-in performs one Schedule update: `end_behavior=release`, owned default PM,
chosen price, unchanged original phase start/end/trial_end, no prorations.
The Schedule stays attached until the original trial end. At the boundary it
releases the Subscription into normal recurring billing. This is different
from calling the Schedule release endpoint immediately after setup.

Cancellation before trial end changes `end_behavior` back to `cancel`.
The test replayed the same previous opt-in idempotency key after cancellation:
Stripe returned a cached earlier response, but a fresh retrieve proved the
current Schedule remained canceling. Never apply access from that cached
response. Application generation checks and serialized mutation recovery are
still required for a stale callback attempting a **new** mutation/key.

### Hosted Checkout and 3DS evidence

Official test card `4000002760003184` was used because it requires authentication
even after setup. Test name/address/email were synthetic. No real card or money.

1. Complete the setup Checkout and its test 3DS challenge.
2. Fresh Stripe inspection before opt-in: trial still ending, no PaymentIntent
   or charge. Merely saving a card did not connect renewal.
3. Apply the explicit fixture opt-in, advance its clock through trial expiry.
4. Invoice `in_1UPLhCPQIEOqG7prN7OHxBto` requires 3DS; Subscription is past_due.
5. Cancel the bank challenge: invoice remains open with 799 cents outstanding,
   zero charges; PaymentIntent reports `payment_intent_authentication_failure`.
6. Retry and complete 3DS: **the same** invoice becomes paid, the same
   PaymentIntent `pi_3UPLhKPQIEOqG7pr0Mb8OHFq` succeeds, exactly one paid charge
   `ch_3UPLhKPQIEOqG7pr0GiiaB9q`, Subscription active.

Screenshot `schedule-3ds-paid.jpg` is kept with ignored local proof artifacts.
The success redirect on staging is not used as payment proof: this synthetic
Customer does not represent the logged-in AniDachi account. Actual Stripe
Session, SetupIntent, Subscription, invoice and PaymentIntent were verified.

### Zero invoices and test-clock timestamps

Initial trial invoice and the additional `subscription_update` invoice after
the annual price change both have zero due/paid and no pre-expiry payment.
Neither proves a paid conversion. Task 5 must test the application's analytics
classification and deduplication explicitly.

One early monthly assertion incorrectly compared `Charge.created` (wall-clock
time in this test) with the simulated trial end. It was corrected to use the
cycle invoice's simulated creation time plus the zero-intent/zero-charge
snapshot before expiry. A read-only re-verification passed; the payment was
not repeated. This was a test-evidence bug, not an early customer charge.

### Reproduction and scope of the gate

Every command uses the existing guarded CLI transport. Run API cases once with
`run <case>`, browser setup with `prepare checkout-3ds`, then complete the
returned hosted form. Use `inspect`, `complete`, `advance`, and finally `verify`
with the same case. Existing receipts are never silently overwritten.

```sh
pnpm --filter @anidachi/web exec tsx scripts/verify-cardless-schedule-sandbox.ts \
  run expiry-no-card --test --account acct_1RlmiIPQIEOqG7pr \
  --cli-profile anidachi-cardless-proof
```

All 14 completed cases and the separately recorded old-Portal Schedule check
passed their Stripe assertions. Task 0 establishes Stripe feasibility, not
finished application behavior. The original `CardlessStripeProof` report stays
incomplete; it is not retroactively relabeled as a full product pass.

Still mandatory in Tasks 1–5: database concurrency and exactly-once activation,
stale/new-key setup callbacks after cancellation, unknown-outcome recovery,
webhook/return convergence, ledger/access cutoffs, analytics zero-invoice handling,
legacy regression checks and actual staging acceptance. Stripe Test Clocks do
not advance Postgres time and do not prove these application properties.

## Release state

Only tagged synthetic sandbox products, prices, customers, subscriptions,
test clocks and schedules were created. Existing customer
subscriptions, shared Portal settings, product runtime, migrations, flags,
extension builds and deployments remain unchanged. The original extension
checkout is preserved. The Stripe capability gate is satisfied; Tasks 1 onward
implement and prove the application contract before any release decision.


## Task 1: local database and common refresh

Local only, based on Task 0 commit `8048e631`. Migration
`20261011124600_cardless_subscription_trials.sql` adds a disabled policy flag,
activation/consent records, immutable provenance and service-role-only RPCs.
The existing Checkout shares account serialization through an insert guard.
Uncertain external mutations remain durable; age/flag-off never releases them.
New cancellation generations fence old completion callbacks. An unresolved
external mutation must reconcile before the next one can reserve authority.

Verified on PostgreSQL 17.6 from cached Supabase image `17.6.1.156`, new container
`anidachi-paid-hosting-cardless-db-v2-20261011` in local context
`colima-anidachi-personal-mvp`, labels disposable/paid-hosting, network `none`,
no published ports. Existing containers/data were not used for these tests.
No hosted schema or billing policy was changed.

- Existing ordered migration replay and populated canonical-data preservation passed.
- New SQL RED: missing policy column, before migration implementation. GREEN:
  cardless **57**, legacy trials **36**, eligibility **27**, Checkout reservations
  **14**, legacy lifecycle **15**, room admission **22**: **171 assertions**.
- New-account Customer race: RED on the initial required Customer, then GREEN.
  Account reservation now precedes external Customer creation; owner-fenced binding
  persists the same mapping on replay and rejects another owner or missing Customer.
- Real concurrent service-role transactions for old Checkout / Plus / Pro yield
  one durable creation authority. Both reservation orderings are also checked.
- New snapshot/refresh tests: **8 RED -> 8 GREEN**. Focused refresh suites **30/30**.
  Checks cover missing/wrong activation, owner/customer/subscription/dates, fresh
  schedule reads, completed/released schedule identity and zero paid invoices.
- Full web suite **994 total: 988 passed, 6 existing skips, 0 failures**; TypeScript passed.
- SQL covers exact trial expiry without consent, confirmed renewal waiting limit,
  decline/3DS/retry, monotonic paid state, canceled stale setup, ordinary later
  paid checkout, legacy defaults and manual grants. Migration preserves populated
  users/subscriptions/history/customer mappings/fences; no data backfill is done.

The common refresh still uses the original lease and fresh reads. Cardless writes
use v3 and require the stored activation plus verified Schedule identity. Legacy
writes retain v2; v2 rejects cardless provenance. After automatic release, the
Schedule's `released_subscription` is used, verified read-only against our owned
sandbox fixtures. A canceled Schedule with no subscription link is accepted only
for an already-recorded matching canceled subscription; it cannot grant access.

This is storage/refresh evidence, not full application or staging acceptance.
Start/renewal endpoints, recovery orchestration, anti-abuse guards, UI, webhook
integration and analytics remain Tasks 2–5; production remains unapproved.


## Task 2: local start, compatible offers and request guards

Local server start is implemented behind the disabled cardless policy. New API
`POST /api/billing/trial/start` retains same-origin JSON/session/owner checks and
adds a durable account limit (20 requests per minute per operation). Its active
response requires the shared fresh Stripe refresh; pending never consumes a new
idempotency key. A saved Customer card never changes creation parameters.

The stable creation keys are `trial-customer:<activationId>` and
`trial:<activationId>`. After 23 hours an absent object does not allow a blind
recreate. Positive uniquely owned Customer/Schedule discovery can recover IDs;
ambiguous outcomes remain pending. Existing legacy Checkout recovery reuses its
original frozen parameters, then expires/reads the actual outcome before freeing
the account. A completed Checkout blocks a new trial. A DB insert guard also
blocks old deployments from reserving a fresh card-required trial when cardless
policy is active; an already reserved one keeps its original terms.

New migration `20261011132247_cardless_trial_launch_guards.sql` adds private
request-limit and provider email-proof records. Google login previously did not
persist `email_verified`; a legacy address/session is not treated as historical
proof. Only boolean provider confirmation is stored. Before a fresh cardless
reservation, a missing current-email proof returns `verification_required`;
the future UI must ask for a fresh Google/Discord login. Ordinary login and paid
rights still work if proof storage fails. Existing activations recover without
this new-start gate. Google claim reference:
https://developers.google.com/identity/openid-connect/openid-connect .

Verification on the same disposable v2 container: **182 SQL assertions**
(57 cardless + 11 launch guards + 114 legacy regressions), and real old/new/plan
reservation concurrency passed. Service cases RED -> **11 GREEN**, route cases
RED -> **3 GREEN**, compatibility/offer suites **52/52**, OAuth suites **14/14**.
Full web: **1016 total, 1010 passed, 6 existing skips, 0 failures**. TypeScript and
`git diff --check` passed. No hosted migration, flag, deployment or Stripe object
was changed in Task 2. Setup/renewal, full webhook recovery and UI remain Task 3–5.

## Task 3: local consent, setup finalizer and recovery

Server billing now uses owner-scoped quotes, a persisted consent before Checkout,
card-only setup, fresh Session/SetupIntent/PaymentMethod ownership checks, and a
single serialized Schedule update. The all-trial phase retains its original
dates. Saved cards, setup redirects and zero invoices do not grant paid access.
The pinned Checkout SDK accepts setup metadata, not a `usage` override; Checkout
creates an off-session SetupIntent and the finalizer explicitly verifies that
usage. No SDK/API upgrade was made.

New migration `20261011135040_cardless_trial_renewal_setup.sql` persists the
setup origin/request/Session and fences transitions against the latest account
generation. Applying mutations cannot be overtaken. An ambiguous outcome after
expiry is settled only after fresh proof of native cancellation. Webhook and
return use the same finalizer; pending outcomes request webhook redelivery.
The common refresh can recover a pending activation after a lost Schedule
response, including a delayed canceled subscription, without recreating it.

Independent server review reproduced two P2s, then regression tests turned
RED -> GREEN: old cancel replay after a newer successful opt-in no longer claims
cancellation (`superseded`, HTTP409); quote hashes use canonical allowlisted
fields irrespective of client property order or extras. A P3 stored-key mismatch
was corrected before any hosted use: runtime now sends the activation's stored
`cardless-trial-v1:<id>` key. Task 2's historical `trial:<id>` implementation is
superseded; proof runner fixture keys are independent of product records.
Owner-scoped `/api/billing/trial/recover` resumes the stored request and frozen
terms, including when another tab lost the request ID before any Stripe create.
It never creates a reservation and uses the same CSRF/session/owner/rate guards.
Pending legacy reconciliation is explicitly `kind=legacy_checkout`, without a
fake activation ID: repeat start with the same selection/request. Cardless
`kind=activation` includes the actual recoverable activation ID. This final
contract regression also went RED -> GREEN; the four focused service/route suites
passed **46/46** with TypeScript green after that refinement.

Verification after the repair pass:

- Full web **1053 total: 1047 passed, 6 existing skips, 0 failures**; TypeScript passed.
- Disposable PostgreSQL: **203 assertions** (57 cardless, 11 launch, 21 renewal,
  114 legacy). Real separate-connection races passed for old/new trial creation
  and setup completion versus cancellation: one durable external authority.
- Cases include stale callbacks with a new request, lost Stripe update/DB commit,
  lost setup creation, foreign owner/PM/Intent, expired quote and trial, changed
  price, off-session intent verification, flag-off recovery and preserved dates.
- `git diff --check` passed. New runtime behavior is local; no hosted migrations,
  policy changes, deployments or customer subscriptions were changed.

Sandbox webhook registration was inspected read-only using the guarded CLI
transport: account `acct_1RlmiIPQIEOqG7pr`, livemode=false, endpoint
`we_1Tkl14PQIEOqG7prAB0aLM7a`, enabled on the staging webhook URL.
`checkout.session.completed`, subscription created/updated/deleted, invoice
paid/payment_failed/payment_action_required and entitlement summary updates
are already registered. No endpoint edit was necessary. Existing webhook payload
version is `2025-06-30.basil`; authoritative fresh application requests retain
`2025-08-27.basil`. This does not assert anything about Live configuration.

Independent repair review accepted all four original findings and the legacy pending
contract refinement with no remaining finding in the server scope. The reviewer
ran the four focused suites independently (46/46); UI, hosted behavior and later
operator recovery remain outside that review.

UI/account integration, analytics, hosted staging verification, operator recovery
past Stripe's safe replay window and owner acceptance remain Tasks 4–5.

## Task 4: local clients and visible payment terms

Pricing and checkout now distinguish the authoritative offer mode. A cardless
trial starts only after the signed-in person explicitly confirms the selected
plan; sign-in itself never starts it. Fresh account/offer checks retire stale
results and preserve the existing card-required flow. A provider verification
request uses the actual Google/Discord OAuth entry points; merely reopening the
login page with an existing session would not obtain a new provider proof.
Pending activation recovery reuses the owner record, including after flag-off.

Billing shows the original trial end with a timezone, rather than presenting
the scheduled no-consent cancellation as a canceled subscription. Renewal review
shows the server's plan, period, full amount and first-charge date before card
setup. Pending setup exposes its frozen terms and a recovery action; an unknown
result never promises that future billing is disabled. Expired pending setup
remains recoverable, but cannot resume card collection or hide behind the old
subscription history. After a failed first charge, the existing cancellation
action is retained. A saved card or return URL is not treated as paid access.

Extension paywall copy points to the current website offer without promising
card-required or cardless behavior from an old strict hosting payload. No shared
protocol fields, auto-create behavior, Netflix or local redesign were changed.
Primary/mobile website CTAs remain installation actions. FAQ, pricing and terms
explain both modes; the SEO content guide records the rollout boundary.

Verification:

- New client/server-view cases were observed RED then GREEN, including account
  changes, late returns, stale offers, pending cancellation, frozen terms,
  verification login and declined-payment cancellation.
- Web TypeScript passed; full web suite **1075 total, 1069 passed, 6 existing
  skips, 0 failures**. Extension check passed; **143 files / 2210 tests passed**.
- Actual local Billing components at `127.0.0.1:3032/dev/billing` were inspected
  at 1440px and 390px. The cardless preview and Pro yearly review show terms
  without overflow; sample mutation buttons remain inactive. Local Pricing used
  mocked server offers for guest, eligible Free, trial-used and paid states, each
  monthly/yearly at both sizes. All expected CTA/copy assertions passed.
- Screenshots and QA reports are retained locally under
  `/private/tmp/anidachi-cardless-proof/task4-{desktop,mobile}-{trial,review,pricing}.png`
  and `task4-{ui,pricing}-qa.log`. Screenshots were visually inspected. No page
  errors; unauthenticated local header requests to `/api/me` and `/api/auth/refresh`
  returned the expected 401, not billing action failures. This is local UI proof,
  not authenticated Supabase/Stripe/staging acceptance.
- Repository Playwright was used for isolated headless local contexts because
  the frontend skill's Browser plugin is unavailable. No user browser profile,
  original extension workspace or production service was altered.

Ruling: hosted desktop/mobile acceptance moves from Task 4 into Task 5 alongside
the first staging PR/deploy. The requirement remains open until that real browser
evidence exists; local fixtures do not satisfy it. Analytics, loaded artifact,
operator recovery and owner staging acceptance also remain Task 5.


## Task 5: verified funnel and local integration checkpoint

The dedicated outbox migration does not backfill existing trials. New cardless
ledger, applied renewal and first positive paid-invoice transitions record stable
IDs inside their DB transaction. Existing room creation and verified Durable
Object host+guest presence record the first room/shared-presence milestones.
The presence function keeps its original authority/ownership/deadline checks;
no Worker protocol change or video/chat telemetry is introduced.

The existing Amplitude publisher adds bounded acknowledgement handling. A new
dedicated analytics drain secret and initially disabled private scheduler keep
its authority separate from notification and room callbacks. Canonical
environment checks fail closed. Unknown receipts retain the same ID/time; after
six days from the first attempt automatic replay stops for operator review.
The new events instrument cardless trials only. They do not establish a new
comparably instrumented card-required cohort or subsequent-renewal dashboard.

Local evidence on the isolated worktree:

- New analytics/route tests observed RED then GREEN: **20/20**, including existing
  notification-drain regressions. Fetch was mocked; no ingestion was performed.
- Disposable PostgreSQL: **238 assertions** (57 cardless, 11 launch, 21 renewal,
  35 analytics, 114 legacy) and both actual separate-connection races passed.
  New cases cover setup/zero invoice versus paid, no premature activation,
  verified host+guest presence, duplicate transitions, wrong environment/lease,
  missing secret, disabled drain, six-day recovery horizon and access controls.
- Repo check: all six tasks successful. Repo tests: all six tasks successful;
  web **1087 total / 1081 passed / 6 existing skips**, protocol **245 passed**,
  API **253 passed**, extension **2210 passed**. Room harness **39/39** and real
  local Worker runtime **96/96** passed.
- The shell log wrapper used a read-only zsh variable after those commands and
  exited nonzero; the preserved runner summaries above show actual completion.
  This wrapper error is not a product/test failure and is not hidden as exit0.
- The lost-success renewal case already verifies recovery after native Schedule
  release without repeating the Stripe update. Unknown expired mutations settle
  only on positive cancellation evidence.
- Deletion SQL proves the outbox cascades after fixture-room cleanup. The actual
  product currently requests account deletion by email; there is no new automatic
  deletion endpoint. DB deletion is not evidence of Stripe cancellation.

Hosted preflight read-only: staging project `cyppqpprkygjloyfvvvj` is healthy and
ends at migration `20261007235706`; none of the five new migrations is applied.
This matches the checked-in staging workflow target. No production project was
queried. New real-account flows, actual analytics delivery, loaded current/old
extensions, full 72h/room expiry and owner acceptance remain pending.
Operator procedure: [staging runbook](../../releases/cardless-trial/staging-runbook.md).


## Task 5 review repairs (before hosted delivery)

Independent review of `6603637f` found three P2 issues and no critical issue.
That SHA was **not ready for staging**. No hosted mutation occurred while it
was under review. Repairs are implemented; a fresh immutable review is pending.

- Durable owner-scoped offer/Billing recovery after reload and flag-off:
  RED -> GREEN, 96 focused UI/service tests; committed `4ccf2833`.
- Fresh DB admission before every Customer/Schedule create, private operator
  hold/evidence reconciliation/terminal settlement. Unknown outcomes and
  abandoned applying markers never release on age alone. Positive Schedule
  evidence only permits recovery; retained Customer identity is not replaced.
- Settled recurring service and positive cash conversion now have separate
  immutable proofs. Credit-paid first cycle keeps access; a later first cash
  receipt records conversion. Initial/update zero invoices remain excluded.
- New service regressions RED6 -> GREEN. Final full web suite: **1098 total,
  1092 passed, 6 existing skips, 0 failures**; web TypeScript passed.
- SQL **258 assertions**: 57 cardless, 11 launch, 21 renewal, 37 analytics,
  18 review guards, 114 legacy. Four separate-connection scenarios passed:
  old/new account reservation, enable/cancel, create admission/operator hold,
  and verified object recording/operator settlement. Existing records preserved.
- The operator tests use simulated positive no-dispatch/provider evidence; they
  prove database guards and audit behavior, not a real provider investigation.
  Hosted staging must still verify wiring and operator procedure on owned fixtures.

Fifth additive migration: `20261011161158_cardless_trial_review_guards.sql`.
The original four migration files remain unchanged. New secrets are still
unprovisioned; analytics delivery and all hosted acceptance remain pending.


## Hosted staging delivery and environment repair checkpoint

PR #410 merged at **2026-10-11 16:55:02 UTC** as
`2471411b7bede05a5564679988fee7725df93d17`. Its final runtime review accepted
`4b6a8027`; Graphify-only `32250893` followed. The main feature CI passed on the
exact PR head. CodeRabbit reported skipped for the non-default branch; this is
not counted as an independent code review.

- Staging database workflow `38157618111` applied all five migrations.
  The automatic workflow `38157586770` also succeeded idempotently.
- Before/after snapshots at 16:39 and **16:59:54 UTC** preserved 17 subscription
  rows, nine legacy trial rows and the empty manual-grant set. Fingerprints
  excluded bookkeeping timestamps and newly added trial fields; price, period,
  cancellation and entitlement fields were included. Existing paid-hosting
  activation, trial flag and policy revision 2 were unchanged.
- `cardless_trials_enabled=false`; no cardless activation, renewal or event rows.
  The new scheduler remains disabled without an environment or run timestamps.
- Web deployment `dpl_6VGZp6PqUqqgswip1wvx7HL9UNUj` became READY and owns
  `staging.anidachi.app` on the exact staging merge SHA. No Worker deploy is
  required by this change. Protected-site smoke `38158036228` passed.
- Extension build `38157882289` passed check/test/build/artifact validation.
  No artifact was copied over the owner's local extension-design folder.
  Loading that artifact and checking the old published client remain pending.
- Read-only browser inspection of the existing paid account Billing page showed
  its active monthly plan and renewal controls. No cancellation, card or purchase
  action was performed. This is not proof of a fresh trial or OAuth flow.
- A dedicated drain bearer was provisioned only on Vercel Preview branch
  `staging` and matching staging Vault. Values are neither recorded nor reused
  from room/notification credentials. The Amplitude key's association with
  project `813335` still needs confirmation before delivery is enabled.

Two authenticated empty-queue probes from staging PostgreSQL reached the drain
but returned **503**. Service-role SQL claim returned zero rows successfully;
unauthenticated HTTP returned 401. The Vercel deployment target/branch are
Preview/staging, while public canonical metadata points at the production site.
The exact private SEO env value was not read, so the environment-gate diagnosis
is a supported candidate rather than a proven hosted fix.

The follow-up resolver accepts only Preview/staging or Production/main from
Vercel system metadata. It no longer classifies runtime identity by
`NEXT_PUBLIC_SITE_URL`. Resolver regressions were observed RED then GREEN;
the existing route fixture was updated to supply the required branch and to
prove feature Preview rejection before DB access. Focused tests **12/12**;
full web **1101 total / 1095 passed / six existing skips / zero failures**;
TypeScript and changed-file lint passed. Hosted 200 acknowledgement remains a
required follow-up receipt. Neither probe enabled the scheduler or sent events.

All fresh-account, loaded-extension, expiration, actual funnel-delivery and
owner acceptance gates remain open. The source checkpoint does not assert
production readiness. Exact repair deployment/probe outcomes are recorded in
the follow-up PR description and controller report.
