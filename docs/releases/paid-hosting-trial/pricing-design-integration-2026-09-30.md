# Pricing design integration — local checkpoint, September 30, 2026

The owner approved consolidating website changes into the main local Next.js
website at port 3003. The separate Vite pricing prototype is retained as a
reference, not the ongoing website editing surface.

## Implemented scope

- The shared `apps/web/components/pricing.tsx` presents the approved pricing
  card hierarchy on both the homepage and `/pricing`, using AniDachi colors.
- The local development preview selects Yearly by default and shows 20% off
  twelve monthly payments: Plus $76.70/year and Pro $143.90/year at the approved
  $7.99/$14.99 monthly design amounts. Per-month equivalents are approximate;
  the full yearly amount is shown beside them. Amounts round to cents once.
- If the verified monthly catalog is available, the preview derives from it.
  The local fallback uses the existing marketing constants for display only.
- Yearly checkout is unavailable and labeled accordingly. Its button and event
  handler cannot start the existing monthly Checkout endpoint.
- Monthly checkout keeps server price/eligibility/owner validation, request
  locking, expired-offer handling and stale-account redirect protection.
  Monthly sign-in returns to the explicitly chosen monthly view.
- Existing subscribers can still open Account → Subscription from either view.
- `annualPreview` defaults on only in development. Production builds retain
  verified monthly prices and do not advertise unconfigured yearly checkout.

## Verification and release boundary

Component tests cover yearly default, full/approximate amounts, disabled yearly
checkout, outage behavior, server HTML, monthly checkout/period locking,
sign-in return and existing subscriber management, alongside the existing
pricing regressions. Final local results:

- `pnpm --filter @anidachi/web check`: passed.
- `pnpm --filter @anidachi/web test`: 827 passed, 6 existing skips, 0 failures.
- Changed-file ESLint and `git diff --check`: passed.
- The project's PostCSS parser accepted the new stylesheet.
- `pnpm dev:check --base HEAD` selected the web and docs profiles.
- Scoped Graphify AST and Codex semantic extraction completed for the component,
  tests and this receipt. The merge guard refused the update because it would
  drop one unrelated historical media-seat node. The three tracked graph
  artifacts remain unchanged; the graph refresh is pending a separate repair.
  No force/prune override or unrelated corpus refresh was performed.

Visual acceptance remains with the owner: browser automation was blocked by
the browser URL security policy in this session. DOM checks do not prove the
desktop/mobile appearance. No alternate browser or network workaround is used.

This is local website presentation work. No Stripe prices, webhook, database,
environment credentials, extension, staging or production were changed.
Annual billing still needs its own server/catalog/checkout/lifecycle integration
and Sandbox acceptance before the preview restriction can be removed.

Rollback: revert this bounded presentation change; no data migration or external
configuration rollback is required. Keep the separately accepted host/friends
explanation and six-item How AniDachi works section.
