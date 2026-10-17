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
