# LIVE annual catalog preparation — October 2, 2026

## Scope and result

The owner approved step-by-step preparation of AniDachi LIVE annual billing
after the release sequence was explained. The first price-create attempt was
rejected for missing connector permissions and created nothing. After the owner
updated access, the following catalog and separate Portal configuration were
created and read back successfully.

This is a Stripe catalog/configuration preparation receipt, not a production
deployment, trial activation, completed LIVE checkout, or Store release. During
this catalog block no subscription, customer, invoice, payment, webhook, retry or
notification setting was mutated. The later separately authorized
[3DS/webhook block](stripe-3ds-readiness-2026-10-02.md) added only the LIVE
action-required event subscription. Vercel environment variables remain unchanged.

## Prepared LIVE objects

Verified account: AniDachi, `acct_1RlmiCAGc1Bd58Cj`, `livemode=true`.
Final readback: **2026-10-02T10:40:32.537Z**.

| Purpose | LIVE ID | Amount / behavior |
| --- | --- | --- |
| Existing Plus product | `prod_UkI4IkKa86J733` | Existing monthly default retained |
| Plus yearly | `price_1UM3mvAGc1Bd58CjUnlK9JNl` | USD 7,670 cents / year |
| Existing Pro product | `prod_UkI6Udvl3VpihD` | Existing monthly default retained |
| Pro yearly | `price_1UM3njAGc1Bd58CjaAxFnifl` | USD 14,390 cents / year |
| Yearly confirmation Portal | `bpc_1UM3ppAGc1Bd58CjWCK4qaN4` | Active, non-default, no shared login |
| Existing default Portal | `bpc_1UEiR1AGc1Bd58CjV6IRKFT5` | Unchanged |

Both prices are active USD recurring year/1, licensed, per-unit prices, with no
price-level trial. Lookup keys are `anidachi_plus_yearly_usd_v1` and
`anidachi_pro_yearly_usd_v1`. The application remains responsible for one
eligible three-day trial per account after activation.

Tax behavior remains `unspecified`, matching both existing LIVE monthly prices.
No Stripe Tax or tax registration change was made; Sandbox prices use a different
tax setting, so this receipt deliberately records the LIVE value.

The separate Portal permits only price updates and lists only the two prepared
annual targets. Proration is `always_invoice`, there are no deferred-update
conditions, and `trial_update_behavior=continue_trial`. Product quantity
adjustment is explicitly disabled for both products. Invoice history, payment
method updates and cancellation at the period end are available in this separate
configuration. Its return URL is
`https://www.anidachi.app/account/billing?billing=return`.

The website's paid yearly-conversion route admits a verified active monthly
subscription, quantity one, paid latest invoice, no scheduled cancellation or
pending changes, and the same Stripe product. It creates an explicit Stripe
confirmation flow; this preparation did not create any customer Portal session
or confirm a conversion. A trial-period change uses the separate application
quote/confirm path and preserves its original trial end.

## Preservation and current production

Fresh before/after readbacks compared all **17** returned subscriptions:
**5 active** and **12 canceled**, with no differences. The active cohort's
customer/subscription/item/price identities, quantity, interval, billing anchor,
period boundaries, trial and cancellation settings, discounts, pending changes
and collection mode were preserved. One active subscription already had renewal
canceled; that setting remains unchanged.

All **5** prior active prices and **5** products, including their monthly default
prices, were unchanged. The existing default Portal and webhook endpoint were
also unchanged. The final annual allowlist was read using
`expand: data.features.subscription_update.products`.

Main and the production Web alias were last verified at `a5a0134e` during this
preparation. That checkout route selects explicit configured monthly Price IDs;
it does not enumerate newly created prices. No new environment IDs or deployment
were applied, so preparing this catalog does not expose an annual option on the
current public website.

The private receipt is stored under ignored
`artifacts/release-candidate-20261002/live-annual-setup-receipt.json` with owner-only
file permissions. It contains the preservation snapshot; customer/subscription
identifiers are intentionally absent from this committed document.

## Remaining launch work

- Connect these public IDs to production only in the agreed launch preparation:
  `STRIPE_PRICE_ID_PLUS_YEARLY_LIVE`,
  `STRIPE_PRICE_ID_PRO_YEARLY_LIVE`, and
  `STRIPE_YEARLY_PORTAL_CONFIGURATION_ID_LIVE`.
- The explained LIVE `invoice.payment_action_required` event addition is complete.
  Verify compatible handler delivery during launch; the old production handler
  skips the new event. All prior events, endpoint URL and API version are retained.
- Reconcile open old Checkout sessions, production application subscription rows
  and effective access before deployment/activation. This catalog receipt does
  not replace that wider release reconciliation.
- One active subscription uses the older Crunchyroll Fan product at $8/month.
  Its terms remain untouched. The owner explicitly excluded developing a separate
  conversion path for it. Preserve the existing subscription; do not migrate it,
  create a second subscription, or claim the new same-product annual flow covers it.
- Complete production env/compatible delivery, new-checkout and customer-driven
  conversion verification, real open-room payment-loss acceptance, and first LIVE
  invoice observation through the [ordered release procedure](production-preparation-2026-10-02.md#ordered-production-delivery).
  Existing Sandbox evidence remains in
  [the billing recovery receipt](billing-recovery-2026-10-02.md).

## Verification and recovery boundary

No application code changed in this block; no room harness or LIVE test charge
was run. Verification was Stripe API readback plus inspection of the current
production price selection and the prepared annual consumers. Existing source,
Sandbox and manual acceptance retain their stated limitations.

If the prepared catalog is abandoned before use, first establish that the new
prices/configuration are unused and unreferenced, then archive only those new
objects under an explicit rollback action. Never archive existing monthly prices,
cancel subscriptions or restore a stale billing snapshot. After use, preserve
references and follow the compatible billing recovery procedure.

References: [Stripe prices](https://docs.stripe.com/api/prices/create),
[Portal configuration](https://docs.stripe.com/api/customer_portal/configurations/create).
