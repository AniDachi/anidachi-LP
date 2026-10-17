# Trial flow stability

Owner approved implementation and staging delivery on October 17. Branch from
staging `8231eb64`; production, main and Store publication are excluded.

## Contract

- Keep the last verified presentation for the same owner while revalidating.
  Freshness expiry is not a denial and must not turn a trial button into purchase.
- Initial unknown state is neutral. Confirmed unavailable means ordinary purchase;
  failed checks remain retryable. Paid consent cannot be inferred from a trial click.
- Blur is not page hiding. Preserve an operation and its idempotency key during
  backgrounding; check session ownership again before following a deferred redirect.
- Display snapshots never grant hosting or a trial. Existing atomic reservation,
  cookie and optional installation proof, account guards and Stripe idempotency stay.
- Coalesce pending reads, retain reviewed fresh proof for the same operation, and
  avoid duplicate rate-limit accounting without removing endpoint protection.
- Extension trial entries open selected Plus/monthly confirmation directly;
  server/browser preflight decides the final offer. No new permissions or secrets.

## Implementation and evidence

1. Regression tests for pricing expiry/focus, checkout pending/background/account
   changes, billing refresh/renewal locks, extension access and offer links.
2. Implement the shared freshness/operation rules and bounded request coalescing.
3. Check notification request bursts, query-selected billing period and login copy.
4. Run full affected checks/tests and independent review; inspect local UI.
5. Update canonical docs and Graphify; PR to staging, verify CI and deployment.
6. Build matching channel ZIPs from the tested source; record hashes and limits.

Existing audit evidence is in the local ignored
`artifacts/trial-integration-audit-2026-10-17/`. Real fresh-account abuse acceptance,
loaded-extension checks and production rollout remain separately recorded evidence.

Rollback: revert this presentation/request optimization while preserving existing
cardless handlers, reservations, schedules and additive database contracts. Never
clear pending operations or disable anti-abuse to recover a UI issue.

Database preparation PR #436 applied migration `20261017130802` on staging before
the runtime consumer. All 13 disposable SQL suites and cross-account browser/key
claim races passed. Independent review found and prompted regressions for pending
read invalidation, account changes during refresh and deferred navigation; the
runtime tests cover these separately from ordinary same-owner refresh.

Pricing uses a query-aware Suspense boundary with a neutral fallback, leaving
the outer page static. Extension `ANIDACHI_HOSTING_ACCESS` adds optional `fresh`
to bypass an older pending read after admission denial or a real tab return.
Normal same-session reads still coalesce; completed authority is never cached.
No shared room payload or Worker changes. Final CI/artifact hashes and unresolved
real-browser acceptance are recorded in the staging PR and local build receipt.

## Return to onboarding after checkout

The owner approved automatic return from the website after a confirmed cardless
trial activation or completed paid Checkout. This is a navigation-only follow-up
on `codex/onboarding-checkout-return`, based on staging `54b3dab4`; production and
Store publication remain excluded.

- The onboarding CTA opens the existing Plus/monthly trial confirmation (or
  pricing when unavailable), with a random one-time `onboarding` UUID. The website
  preserves it through login and plan selection. It is not a URL or entitlement.
- The extension keeps the originating tab, document, frame and owner in bounded
  `chrome.storage.session` records for at most one hour, surviving worker sleep.
  The content script also requires the same video and an active tour. Return
  resumes that tour without resetting its current step or creating a room.
- Cardless return follows only a server-confirmed `active` result. Paid return
  requires the same tab's owner-bound Checkout receipt, the exact session ID,
  server-confirmed completed/paid (or no-payment-required) Checkout and its own
  active Plus/Pro subscription. `CheckoutResult.sessionId` and the sync response's
  `checkoutComplete` are additive; old consumers keep their behavior.
- The website rechecks the current owner before return. A short external port
  binds the attempt to the live website document; abort, navigation and unmount
  disconnect it. The extension validates the exact configured website origin,
  top frame, owner, source document, current website tab and request deadline.
  After consuming the token it checks owner and port again before focusing.
- Missing/closed/reloaded source, closed tour, changed video/account, unavailable
  extension or blocked storage leaves the website confirmation and a manual
  return option. Cancelling or failing checkout never triggers an automatic
  return. A normal website purchase does not acquire a new onboarding target.
- Existing billing/offer validation, anti-abuse cookie and installation proof,
  Stripe schedules/idempotency, account/room authority and auth handoff remain.
  No database migration, permissions, OAuth allowlist, environment variable,
  Worker change, polling loop or extra Stripe request is introduced.

Verification: owner/document/expiry/replay/abort regressions and web tests for
confirmed versus failed or unrelated Checkout, plus a loaded-artifact Chrome
round-trip using offline video and website fixtures. These do not substitute
for an owner-approved live staging trial/payment acceptance before promotion.
Record exact checks, artifact hashes and deployment in the PR/build receipt.

Rollback: revert this follow-up and reload the prior extension. Additive response
fields can remain during mixed-version rollout; older packages use their normal
Billing/success page, while a missing return bridge falls back on the website.
