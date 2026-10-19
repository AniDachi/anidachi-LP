# Trial renewal clarity and performance

Date: 2026-10-19. Branch: `codex/trial-renewal-clarity`, based on staging
`32371ac1134f29b5717b9c7228f60f15b46f6971`. User approved careful fixes after the
staging audit. Production and existing subscriptions must not be changed by testing.

## Problem and contract

Switching a draft plan previously reserved a new operation and waited on Stripe,
measured at 2474–2655 ms on staging. Another tab could cancel `setup_pending` by
requesting a quote. A user with a verified card was sent through another setup
even when only changing the renewal plan.

Opening renewal management now reads four prices and the verified card once.
Selection changes are local. The main action requests a fresh authoritative quote
and compares plan, billing period, amount, currency and original payment date with
what the user saw. Changed terms require another explicit confirmation. There is
no automatic setup, renewal, retry loop or trial activation on opening the screen.
Only public prices are cached for five minutes, separated by Stripe mode and price
ID. Billing history deduplicates identical price reads. Account state, eligibility,
consent and mutation checks remain fresh and private.

Saved-card reuse requires an applied enable operation for the same user and
subscription, the currently selected subscription default PaymentMethod, and a
fresh Stripe ownership/mode/card check. The new consent references that immutable
source. It does not copy unique Checkout/SetupIntent IDs, grant a second trial,
extend the original 72 hours or imply consent from card presence alone. A detached
or changed card requires review; it never silently falls back to card setup.
Before an unverified Stripe apply/replay, the saved-card source and current default
are checked again. An external card change while the operation is already applying
keeps the existing pending fence and requires operator reconciliation; it cannot
restore the old card or assume an unknown Stripe outcome failed.

The database serializes quote, setup, reuse and cancellation on the existing owner
lock. A quote cannot supersede consented setup. Explicit cancellation remains
available. Existing generation fences, single applying operation, Stripe
idempotency, webhook/return recovery and verified commit remain authoritative.

## Delivery and rollback

1. Validate local web checks and full disposable cardless SQL contracts.
2. Review this branch and open a PR into staging.
3. Apply `20261018223354_trial_renewal_preview_and_saved_card.sql` on staging before
   deploying the web code. Existing rows retain null source IDs; legacy setup
   remains supported. No new environment variables, secrets or protocol fields.
4. Verify on Stripe Sandbox: first card setup; return/webhook order; saved-card
   monthly/yearly or Plus/Pro change; cancellation and re-enable; second-tab quote
   during setup; price change and network recovery. These real-account checks are
   distinct from local mocked/SQL tests and remain a staging acceptance gate.
5. Extension ZIPs do not change. Production requires separate staging acceptance
   and explicit promotion.

Rollback: before any new saved-card operation is created, the previous compatible
web service can be restored through the normal PR flow while retaining additive
schema and consent history. Once such an operation exists, retain or backport the
new payment-source and current-card reconciliation checks until all affected
operations are proven settled. The older service ignores the source provenance
and can restore a replaced card when replaying an applying operation; being able
to read the nullable column is not sufficient compatibility. UI rollback can be
separate. Never remove provenance or blindly replay Stripe writes.

## Evidence

- New regression tests failed before their fixes: three quote requests for two
  switches; pending setup superseded by another quote; repeated card setup;
  duplicate public price reads.
- 141 targeted web tests passed after fixes, covering account changes, quote
  expiry, changed-price reconfirmation, saved-card choice and cancellation.
- Disposable, labeled, network-isolated Postgres: all cardless contract suites
  passed, including anti-abuse browser/installation races and existing concurrent
  checkout/setup/cancel flows. Renewal SQL assertions: 30 passed.
- Full web suite: 1301 passed, 6 skipped, 0 failed. Web type check passed.
- Local browser inspection at `/dev/billing`: cardless and renewal-enabled states,
  instant Plus/Pro and monthly/yearly selection, verified-card display, unchanged
  renewal disabled action, and Save changes after selection. Preview uses sample
  data; payment actions are inactive.
- Independent code review found two issues (stale saved-card provenance after a
  prior change and a replaced card during delayed apply). Both were reproduced,
  fixed and independently checked with nine focused tests. No remaining blocker.
- Graphify code update attempted through the safe adapter but publication is
  blocked by the existing unresolved `storage` import from `wxt/utils/storage`.
  Semantic extraction is handled separately; no stale sources are stamped and
  no graph artifacts are included without successful publication.
- No production or live subscription mutation is part of this verification.

## Unified subscription screens (local follow-up)

The user approved extending the account design to all billing states. The same
summary shell now covers cardless and legacy card-required trials, active monthly
and yearly subscriptions, canceled renewal, first-payment processing, payment
required, overdue/unpaid/incomplete payments, paused/unknown statuses, Free and
pending trial activation. The approved trial-ended layout is retained. Initial
loading and unavailable status stay neutral and do not imply Free or trial denial.

Only presentation changes: the current account plan remains authoritative, and
unresolved subscriptions no longer duplicate a full Free block above the affected
plan. Their summary states actual account access and exposes the existing payment
recovery handler directly only when the original guard allows it. Processing
shows the bounded temporary-access deadline, never an active paid-period claim.
Expanded management retains plan, status and current access; cancellation,
restoration, yearly conversion, trial-plan change and cardless renewal handlers
are unchanged. Free-plan detail text is collapsible; “How to watch” keeps the
original installation-guide URL. Trial eligibility and anti-abuse are unchanged.

Local preview `/dev/billing` now includes 21 selectable scenarios with inactive
payment actions. Verification includes the presentation/account regression suite,
full web checks, browser inspection of the 21 states, and a 390px iframe viewport
for the real page. A focused independent review caught missing plan/access context
in expanded management; that issue was fixed with a regression test. This local
follow-up does not apply a migration, publish an extension or deploy staging/prod.
