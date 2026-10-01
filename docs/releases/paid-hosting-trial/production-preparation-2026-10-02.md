# Production preparation, October 2, 2026

Status: local release safeguards; not a production deployment or Store package.
The owner requires existing purchased subscriptions to remain unchanged. This
record supplements the [transition plan](../../superpowers/plans/2026-09-27-paid-hosting-and-trial-transition.md)
and [cutover runbook](cutover-operations.md). The local implementation is tracked
in [production release safeguards](../../superpowers/plans/2026-10-02-production-release-guards.md).

## Purchased subscriptions are preserved

The release must preserve existing Stripe customer, subscription, item and price
identities; plan; billing interval; quantity; renewal anchor; paid-through date;
discounts; and cancellation setting. Existing monthly customers remain monthly
at their existing price. Annual billing is a new purchase option or an explicit
customer choice, never a migration of current subscribers. Existing subscriptions
continue their normal renewal and customer-initiated management.

Do not cancel/recreate subscriptions, attach trials to them, replace their prices,
reset anchors, initiate prorations/charges, or bulk-rewrite entitlements as a
release operation. Creating an annual catalog entry must not archive or change a
price used by an existing subscription. Preserve the ordinary Portal separately
from any configuration that offers annual switching.

Before production work, take a private read-only inventory of existing active,
trialing and other nonterminal subscriptions and their mapped application rows.
Record the fields above, effective access and capture time. Check for multiple
nonterminal subscriptions and inconsistent mappings before proceeding. After
each schema/Web/Worker/activation phase, compare that cohort and effective access.
Explain genuine intervening renewals, payments and customer actions from Stripe
events; do not restore a stale snapshot over legitimate billing changes. Keep
customer identifiers and raw snapshots outside Git and public logs; the release
receipt contains counts and categorized differences only.

The six proposed migrations add hosting/trial/checkout/cutover infrastructure;
they do not issue Stripe operations or bulk-update purchased subscription rows.
`subscription_access_grants_v1` keeps legacy subscriptions without a trial-ledger
row on their existing `current_period_end` semantics. Runtime webhook delivery
still updates payment state normally. Local pricing regressions verify that
existing Plus/Pro subscribers get management rather than a new trial offer;
this is not a substitute for the LIVE before/after reconciliation.

## Read-only preflight snapshot

These observations were captured in the October 2 preparation audit. Refresh
them immediately before delivery; they are not continuing health guarantees.

| Area | Observed state | Remaining proof |
| --- | --- | --- |
| Source | staging `3998250d`; local welcome commits through `89eb1deb`; production main `a5a0134e` | Stage and accept the welcome acknowledgement and these safeguards, then freeze exact release SHAs. |
| Production database | Six September 27–28 paid-hosting migrations absent; personal history active | Apply dormant additive schema in order; inspect grants, policy and existing paid access. |
| Production Web/Worker | Existing Web/main and September 15 Worker still serve production | Deliver compatible Web before the new admission-dependent Worker. |
| Stripe | Connected connector is AniDachi Sandbox, `livemode=false` | Read-only LIVE subscription, catalog, Portal, webhook and open-Checkout inventory. Sandbox evidence cannot prove LIVE setup. |
| Vercel production configuration | Monthly keys present; annual price/Portal and dedicated drain secret absent | Configure approved annual catalog, Portal and per-environment delivery secret later. Existing monthly IDs remain intact. |
| Production extension configuration | GitHub public VAPID key present; explicit version absent | Match public push key to the production Web pair, and select a version above the highest uploaded Store version. |
| Store/privacy | Public Store version `0.1.1`; public privacy still describes the old history choice | Verify dashboard version and publish matching privacy/disclosures before the default-on history client. |
| Staging | Paid-hosting T active, trials/scheduler enabled; inspected drain result succeeded | Preserve accepted evidence and finish release-specific checks; do not repeat activation. |

The owner already confirmed on staging that Free rooms closed, Plus continued,
trial checkout worked and the tested account behavior was correct. Annual
switching during trial was also checked in the earlier work. That acceptance
does not prove the first real post-trial invoice, payment failure/action-required
handling, or LIVE operation. Keep these distinctions in the release receipt.

## Local safeguards prepared

- Pricing keeps its static prices, yearly default and usable buttons. Unknown or
  pre-activation offers use `Choose Plus/Pro`. A guest sees a trial only after the
  server confirms active hosting policy and enabled trials. An authenticated
  eligible offer remains authoritative; existing subscribers reach management.
  Offer expiry/failure cannot turn an unknown offer into a trial promise.
- `Deploy API` keeps automatic staging delivery, but production requires manual
  dispatch with `production_ready_sha` equal to the exact full event commit SHA.
  Checkout uses that SHA. Push triggers are restricted to staging, so a main push
  cannot displace a queued or running manual production delivery. This acknowledgement does not contact
  Supabase or Vercel and does not prove prerequisites; the operator must record
  their actual verification before dispatch.
- Production local builds and CI require an explicit `WXT_EXTENSION_VERSION`.
  They cannot silently reuse package/CI `0.1.0`. A test fixture version and its
  generated ZIP are not a reviewed Store release.

These controls currently exist only on the local preparation branch. The old
production workflow remains in force until the reviewed gate is delivered. Do
not merge the entire staging branch into main expecting a future gate to protect
an earlier automatic deployment.

## Ordered production delivery

1. **Finish staging and freeze artifacts.** Include the Got it acknowledgement
   fix and these safeguards. Record exact commits, checks and owner acceptance.
   Inventory all main/staging differences, including collaborator changes.
2. **Land the delivery guard separately.** Use the normal staging-first PR flow
   and an explicitly approved minimal main promotion. Verify that production
   Worker no longer deploys on push. Do not perform a large product promotion in
   the same operation or assume the guard has already reached main.
3. **Prepare LIVE and dormant schema.** Reconcile purchased subscriptions first.
   Retain monthly prices, configure the approved annual prices and Portal, verify
   webhook events including `invoice.payment_action_required`, and inspect open
   legacy Checkout sessions. Reconcile incompatible open sessions before enabling
   the new offer; completed purchases remain subscriptions. The webhook setup
   script returning an existing URL does not prove its event list was updated.
   Apply the six migrations with T=NULL, trials off and scheduler disabled. Use
   the unified eligibility migration so unused trials are not split by signup
   date. Establish the dedicated drain secret on Web and Vault safely.
4. **Deliver a compatible Web, then Worker.** Web must expose and successfully
   authorize the admission endpoint before the new Worker is manually deployed;
   otherwise even legacy joins can receive 503. Keep the public site truthful
   while T=NULL. The pricing change here is insufficient for all static Free/
   trial claims in marketing, FAQ and articles: a separately reviewed compatible
   Web/content delivery is still required. Verify old clients, existing paid
   customers, room create/join/end and disabled drain health before advancing.
5. **Prepare and submit the production extension.** Select the next version from
   the Store dashboard, use the production identity/endpoints/narrow permissions
   and matching public push key. Build from the approved clean main commit with
   an explicit version and full-SHA build ID. Validate the exact ZIP and record
   SHA-256; test login, invitations, history/preferences and room behavior on
   that artifact. Publish accurate privacy/Store data disclosures. The owner
   uploads the verified ZIP with deferred publication, retaining control of the
   launch after review. Store approval is not a production activation signal.
6. **Publish, then activate deliberately.** After approval, publish the selected
   Store version and verify the visible version/install/update. Release matching
   Web messaging and commit production T only after all prerequisites are
   accepted. Chrome updates clients asynchronously: do not wait for every client
   or assume everyone already updated. Server enforcement must cover old clients.
   Keep any pre-T public-copy interval explicit and truthful; do not publish
   unsupported trial promises while waiting for a flag.
7. **Reconcile the cutover.** Run the single recorded activation operation and
   retain its UUID. Reconcile every frozen Free target through fence/finalization;
   paid/trial rooms stay outside that set. Confirm existing subscription/access
   invariants again, observe actual closure latency, and verify new trial → first
   invoice/failure outcomes. No deliberate five-minute Free cutover grace is
   added; ordinary later entitlement loss has its separate existing grace.

Steps above are a plan, not authority to execute production mutations. Production
promotion, LIVE setup, Store publication and T remain distinct owner decisions.

## Recovery and remaining gates

Keep known-good **compatible** Web and Worker artifacts. The new Worker writes
terminal intent for ordinary room endings even with T=NULL, so rollback to the
old main Worker can lose recovery/fencing; it is not automatically safe before T.
After T never clear policy/ledger/outbox state or restore Free hosting as rollback.
Retain and drain committed work; use a compatible fix or verified compatible
rollback. See [reconciliation](cutover-operations.md#reconciliation-and-recovery).

Investigate any legacy tombstone without a terminal receipt before selecting
targets; `ROOM_TERMINAL_PROOF_UNAVAILABLE` is pending recovery, not success.
Disabling new trials does not revoke already issued trials or invalidate existing
Stripe Checkout URLs by itself. Review those URLs separately when stopping offers.

Still open: final staging delivery; compatible pre-T Web/content package;
LIVE before/after inventory and annual/Portal/webhook setup; push-key match;
dashboard version; published privacy/disclosures; exact production ZIP validation;
compatible recovery proof; first post-trial invoice outcomes; production approval
and execution. No production readiness claim is made until those gates are closed.

## Local verification

- Website: 32 focused pricing tests; full suite 966 passing and 6 existing skips;
  typecheck and changed-file lint pass. The corrected paid-plan fixture was
  rechecked separately (7 passing offer tests). Local browser inspection shows
  static prices, yearly default and neutral buttons without a confirmed offer.
- Extension: typecheck and all 2,163 tests in 141 files pass, including real
  release-channel builds and the missing-production-version rejection. A local
  staging build with an explicit full-SHA test build ID passes artifact validation.
- Release tooling: 5 guard tests including CLI exit behavior; workflow YAML
  parsing, shell syntax and `dev:check` pass. No target remote workflow run is
  claimed from these checks.
- Fresh independent review found no critical/important issue. Its queueing note
  was addressed by removing main from push triggers: a main push cannot replace
  a pending manual production run in GitHub's concurrency group.

No API/SQL/room/P2P runtime changed in this safeguard block, so the broad
`dev:check` all-profile recommendation was narrowed to the affected web,
extension and workflow checks. Room/media harnesses and remote smokes were not
rerun as substitutes for the separately required production rehearsal.
