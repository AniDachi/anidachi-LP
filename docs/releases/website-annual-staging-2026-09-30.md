# Website and annual billing staging delivery — September 30, 2026

## Scope and boundary

The owner explicitly authorized delivering the completed website work to staging.
[PR #383](https://github.com/AniDachi/anidachi-LP/pull/383) merged at
12:44:57 UTC as `d64f6e8a8ce5d47f6ea709b490a22e400f1dde07`, from reviewed feature
head `d3032f2be0a708b3051421260c49d9a695d591f9`.

Delivered scope:

- Homepage design, one paid host with free guests explanation, all six getting
  started steps, comparison table and responsive competitor selection.
- Centered pricing cards, immediate static monthly/yearly public prices, Yearly
  selected by default, visible three-day card-trial and full renewal terms.
- Public signup counter: approved 1,409 baseline plus registrations after the
  fixed timestamp in the current deployment's own database.
- Sandbox annual Checkout: Plus $76.70/year and Pro $143.90/year. Existing paid
  monthly accounts can explicitly confirm immediate yearly conversion in Stripe,
  with proration. Period changes during a trial preserve its original end.
- A test-only API fixture correction discovered by CI. Production Worker source,
  extension, protocol and database schema are unchanged by this release.

The existing staging paid-hosting activation is preserved. This release does not
reactivate cutover, reset trials or convert existing monthly subscriptions.
Main/production, LIVE Stripe and Chrome Store publication remain separate gates.

## Configuration

Read-back verified account: **AniDachi sandbox**, `acct_1RlmiIPQIEOqG7pr`,
`livemode=false`. Existing monthly prices, ordinary Portal, API credentials and
webhook were retained. Three public IDs were added to Vercel Preview scoped to
exact branch `staging`:

| Variable | Public value |
| --- | --- |
| `STRIPE_PRICE_ID_PLUS_YEARLY_TEST` | `price_1ULJ4FPQIEOqG7prxAO9Ju9I` |
| `STRIPE_PRICE_ID_PRO_YEARLY_TEST` | `price_1ULJ4XPQIEOqG7prMHFwXHus` |
| `STRIPE_YEARLY_PORTAL_CONFIGURATION_ID_TEST` | `bpc_1ULJAFPQIEOqG7prMqpyZip0` |

Both prices are active USD year/1, licensed, per-unit prices. The dedicated
non-default Portal permits price updates with `always_invoice`, explicitly lists
the annual prices and has no scheduled change or shared login. No secret was
read, exported, committed or rotated for annual configuration.

## Verification before merge

- `pnpm check`, `pnpm test`, web lint and `git diff --check` passed. Web:
  851 passed, six existing skips, zero failures. Existing lint warnings remain.
- Pricing DOM/SSR suite: 23 scenarios including immediate public trial terms,
  explicit confirmation when eligibility changes, owner/amount changes and
  annual totals. These do not prove Stripe's complete payment lifecycle.
- Independent read-only billing and website reviews found no blocking findings.
- Updated feature head passed [CI](https://github.com/AniDachi/anidachi-LP/actions/runs/36716219905),
  [E2E Rooms](https://github.com/AniDachi/anidachi-LP/actions/runs/36716219842) and
  [E2E P2P Media](https://github.com/AniDachi/anidachi-LP/actions/runs/36716219868).
  Vercel preview `dpl_2q3vhyixeyRDKirjgduwEKnabKch` was READY at that same head.
- `dev:check` selected web, API, rooms and docs because the runtime-test path is
  broadly classified. Both remote room/media harnesses passed. No new extension
  artifact is needed for this website release.

### Calendar-dependent test correction

The first CI run failed three unchanged room tests, reproduced locally as
93 passed / three failed. Those tests mocked `Date.now()` to September 29 while
the policy fixture derived its quota day from real `new Date()` on September 30.
The resulting quota/usage mismatch correctly failed closed in the Worker.

The fixture now derives all dates from the controlled clock. The three tests use
future UTC reference dates so Workerd's independent native alarm clock cannot
fire or clamp their synthetic historical deadlines. All exact assertions remain:
original deadline, restored alarm, end time, 60 seconds on the old UTC day and
zero on the new day. API typecheck and all **96 Workers runtime tests** passed;
independent review confirmed this is a test-only correction.

## Deployed verification

- Vercel `dpl_5HfezoKU9Mb2Y79TP2Qq72cLqxnZ` is **READY**, commit
  `d64f6e8a`, branch `staging`, with the alias **https://staging.anidachi.app**.
- Post-deployment [Staging Smoke](https://github.com/AniDachi/anidachi-LP/actions/runs/36717079889)
  passed against the staging domain: password gate, wrong-password rejection,
  signed gate session, login/connect redirects, noindex and empty sitemap.
- [Deploy API](https://github.com/AniDachi/anidachi-LP/actions/runs/36716791666)
  passed; the test-file path triggered a redeploy despite unchanged Worker source.
  Version `b2007792-1f7d-4feb-8e34-05c80fb4bed7` deployed at 12:46:16 UTC.
  `pnpm smoke:worker:staging` passed health and unauthenticated ICE denial.
- [Migration workflow](https://github.com/AniDachi/anidachi-LP/actions/runs/36716791360)
  reported the remote database up to date in both dry-run and apply; no migration
  was added by this release.
- Browser inspection on the real staging domain passed at 1470px and 390px:
  aligned prices/buttons, static yearly amounts, correct monthly switching,
  signup count 1,409, responsive comparison switching and unchanged guest-label
  position when switching 5 to 14. At 390px, document width equals viewport width
  (no horizontal overflow). No browser console errors were captured.
- The initial public pricing state showed trial terms; the already subscribed
  browser account then correctly resolved to Manage subscription. No Checkout,
  Portal confirmation, payment, sign-out or account mutation was performed.
  This is UI verification, not owner payment acceptance.
- Screenshots are local review artifacts: `/private/tmp/anidachi-staging-pricing-desktop-2026-09-30.jpg`
  and `/private/tmp/anidachi-staging-pricing-mobile-2026-09-30.jpg`. They are not
  committed and must not be treated as permanent repository attachments.
- Main remains `a5a0134e`; promotion PR #376 is open with auto-merge disabled.
  No production configuration or Store release was performed.


## Remaining owner acceptance

The owner performs the full Sandbox payment flow. Deployment and automated checks
do not mark these scenarios complete:

1. Open staging on desktop and phone; review the final design, counter, monthly/
   yearly toggle and trial/renewal amounts.
2. Enroll an eligible account into annual Plus/Pro with a card; verify the initial
   trial and later full annual invoice, webhook, account dates and extension rights.
3. Verify a used-trial account pays without another trial. During a trial, change
   period/plan and confirm the original trial end is retained.
4. Convert an active paid monthly subscription to yearly: inspect Stripe's credit
   and total, explicitly confirm, verify the same subscription and new period.
5. Check declined payment/3DS/cancellation/retry, annual cancel/restore and renewal.
   The complete cases remain in the [annual checklist](paid-hosting-trial/annual-billing-2026-09-30.md).

## Documentation, graph and rollback

This receipt supersedes the September 30 local-only delivery statements for the
website, counter and annual billing. Their earlier local results remain historical.
Graphify was queried and verified against current source. A no-write semantic
merge preflight still loses the unrelated node
`docs_superpowers_plans_2026_09_14_host_managed_media_seats_room_media_seats_v3_migration`
(14,198 to 14,197 nodes). The refresh was stopped; graph freshness is not claimed.
No unrelated regeneration/pruning is included in the release receipt.

Before creating annual subscriptions, the previous staging web deployment was
`dpl_4pPLCVC4CiK6x6TXhBvEQvTD62ww` at `73ea22d5`. After annual subscriptions exist,
retain annual price recognition, webhook/sync handling and configuration even if
new sales are paused. Use a targeted UI revert or reviewed forward fix instead of
blindly deploying code that cannot recognize annual subscriptions. No database
rollback is required. Trial ledger and existing monthly subscriptions are retained.
