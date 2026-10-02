# Production preparation, October 2, 2026

Status: staging candidate in verification; no production deployment or Store package.
The October 2 owner decision below supersedes the earlier pre-Store bridge plan.
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

The owner explicitly keeps the current public website and production behavior
until Store review is approved, then launches the prepared product manually.
Do not revive the separate pre-Store marketing rewrite or deploy the new public
site merely to build an extension ZIP. These instructions supersede the earlier
compatible-public-copy preparation sequence; compatibility of server consumers
and preservation of current subscriptions remain mandatory.

1. **Finish staging and freeze the candidate.** Deliver the Got it acknowledgement
   and safeguards through a staging PR, verify CI/deployments and the exact tester
   artifact, and record remaining manual acceptance separately. Reconcile the
   source diff with collaborator changes. Record Sandbox lifecycle evidence in
   the [October 2 verification receipt](billing-recovery-2026-10-02.md).
2. **Prepare the Store package without deploying production.** Verify the highest
   dashboard-uploaded version, production extension ID/endpoints/narrow permissions,
   and the matching production public push key. Build from the accepted frozen
   staging SHA with explicit version/build identity; record SHA-256 and validate
   the exact ZIP. This owner-directed review artifact is an explicit exception
   to the usual build-after-main order: its creation must not require main or
   public-site deployment. Verify it against the current server as well as the
   staged new system. No source migration or publication is implied.
3. **Prepare LIVE and launch prerequisites.** Take the read-only purchased-
   subscription inventory; identify the exact annual catalog/Portal/webhook,
   open-Checkout, additive-schema, secret and recovery requirements. Keep existing
   monthly prices and subscriptions intact. Apply external production changes
   only in the separately authorized launch preparation. Prepare matching
   privacy/Store disclosures and reviewer instructions before package submission;
   disclose any pending privacy publication as a gate rather than marking it done.
4. **Owner submits with deferred publication.** Submission, Store approval and
   publication are separate from activation. Keep current production serving old
   clients during review. After approval, agree the manual launch window and verify
   the submitted ZIP is the accepted artifact. Do not enable auto-merge on the
   standing staging-to-main promotion PR.
5. **Deliver approved launch prerequisites in dependency order.** Land the
   production Worker delivery guard separately before broad promotion. Verify the
   guard on main; apply additive migrations with T=NULL, trials/scheduler off;
   establish the dedicated drain secret. Deliver compatible Web admission before
   manually deploying the new Worker, and verify old-client create/join/end and
   paid access. Keep any interval between new Web delivery and activation inside
   the explicit launch procedure; do not expose trial checkout before readiness.
6. **Publish, activate once, and reconcile.** Confirm the Store version is
   published, then commit the single recorded activation UUID/T after all
   prerequisites are accepted. Chrome updates asynchronously; server enforcement
   must handle old clients. Reconcile all frozen Free room targets, preserve paid/
   trial rooms and purchased subscription invariants, and observe the first real
   invoices. No deliberate five-minute Free cutover grace is added; later ordinary
   entitlement loss retains its separate existing grace.

These steps are preparation, not permission for production mutations. Main
promotion, LIVE setup, Store submission/publication and T remain distinct actions.

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

Still open: final staging delivery/acceptance; LIVE before/after reconciliation
and approved annual/Portal/webhook setup; push-key match; dashboard version;
published privacy/disclosures; exact production ZIP and current-server compatibility;
compatible recovery proof; 3DS and real open-room payment-loss acceptance; production
approval/execution and first live invoices. Sandbox post-trial failure, automatic
recovery and retry exhaustion are now verified in the linked October 2 receipt.
No production readiness claim is made until the remaining gates are closed.

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
