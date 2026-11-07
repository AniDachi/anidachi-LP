# Free20: 0.1.5 Store review and production preparation

Status on November 7: the owner reports Chrome Web Store approval of **0.1.5**.
The approved candidate remains held for the coordinated production launch. Store
dashboard status/publication has not been independently inspected. Current work
includes owner-authorized reconciliation/configuration delivery to staging and
read-only LIVE inventory; it does not authorize main promotion,
production activation, LIVE writes, Store publication or public ZIP hosting.

Execution plan: [release preparation](../../superpowers/plans/2026-11-06-free20-store-release-preparation.md).
Product contract: [Free20](../../daily-free20-contract.md) and
[current master plan](../../superpowers/plans/2026-10-30-daily-free20-transition.md).

## Post-approval checkpoint: November 7, 2026

The final review candidate came from staging PR #523, source
`d702613bc39ea99613166a5edc9cb13270117f93`, and supersedes the November 6 candidate.
Keep the exact approved ZIP; changing a provider setting is not a reason to rebuild
it. The immutable receipt is under
`artifacts/chrome-web-store-0.1.5-release-20261107/` (local, ignored).

- Version: `0.1.5`; extension ID: `gpkolofebdhfpapbbgdkdkmlmjfidgmn`.
- ZIP SHA256: `358757aa77168fb515fd3df7be28f60d677b2536dffc45536f88b84c2aef33a3`.
- Production website: READY `dpl_6FTnPJHmRWPZ4hX9LLZRuF9VaBke`, main
  `9da93cd9891b6155051fc550957635c089fc8f3a`.
- Staging website: READY `dpl_G691FEgXQh9aLpW3JQV2k4LhNUVt`, source `d702613b`.
- Production Worker: `3ea773eb-f258-4713-a314-9abeb4012f49`, 100% traffic,
  no `ANIDACHI_FREE20_ACCOUNTING_ENABLED` binding. Staging Worker:
  `8a293e3a-5986-4380-8fad-e972878bfcc2`, accounting enabled.
- Production DB still has 83 migrations, staging 93. The ten pending files below
  exactly match the frozen release's SHA256 manifest. Production policy revision 3
  retains its original activation timestamp and trials enabled; the two Free20
  policy columns are absent. Staging revision 5 has Free20/abuse on and trials off.
- The initial readback exposed only Sandbox. After the owner completed Stripe
  reauthorization, AniDachi LIVE `acct_1RlmiCAGc1Bd58Cj` became available and the
  read-only catalog, coupons, portals and webhook inventory completed below.
- Production GitHub `WXT_EXTENSION_VERSION` remains `0.1.4`. Set it to `0.1.5`
  before the authorized main build; a workflow-generated ZIP must not replace the
  already approved archive under the same approval/hash claim.

The fresh final-tree difference is **514 files**, versus the historical 504-file
preparation-base comparison below. GitHub's compare API returned only 300 files;
the complete count comes from local Git after fetching the exact remote refs.
Main has 13 commits outside staging, including production SEO changes. Promotion
PR [#471](https://github.com/AniDachi/anidachi-LP/pull/471) is open, auto-merge off,
and conflicting. A local `git merge-tree --write-tree --messages origin/main
origin/staging` preview confirmed one conflict:
`apps/web/app/watch-youtube-together/page.tsx`. No merge, branch update, schema
change or deployment was performed by the preview.

The subsequent owner-authorized local merge of main into the release branch
resolved both copy hunks in favor of the accepted Free20 wording. Its final web,
extension, protocol and workflow trees are byte-identical to staging `d702613b`:
the main SEO content was already present, but its ancestry had not been reconciled.
The only runtime configuration change is the explicit production Worker accounting
binding; the manual exact-main-SHA deployment gate is unchanged. This source
preparation does not change the deployed production Worker or SQL policy.

Readback evidence: `artifacts/free20-post-approval-20261107/provider-readback.json`
and `merge-preview.json` (local, ignored). These are dated inventory results, not
production acceptance or a substitute for a fresh check at the launch window.

### Remaining launch checklist

- [x] Owner reported Store approval; preserve the frozen candidate and receipt.
- [x] Refresh web/Worker/DB/Git inventory and verify pending migration hashes.
- [x] Obtain access to AniDachi LIVE Stripe and complete the read-only catalog,
  coupon, portal and existing-webhook inventory described below. Do not request
  secret keys in chat. Prepare exact changes before requesting LIVE-write approval.
- [ ] Reconcile main's production-only changes on a feature branch from current
  staging. Resolve the YouTube-page conflict while preserving current SEO work and
  the reviewed Free20 copy. Run web check/tests, inspect that page, and deliver
  through a PR to staging. Do not resolve by replacing an entire side blindly.
  Recheck the merge result and its difference from the frozen extension/protocol
  inputs; any runtime change requires compatibility review before using the
  already approved ZIP. Documentation-only or website-only reconciliation does
  not by itself require an extension rebuild.
- [ ] Prepare the explicit production accounting flag in `apps/api/wrangler.toml`
  through staging; review environment isolation, API check/tests, the existing
  deployment gate and a production dry run. Adding a dashboard-only flag is not
  durable because the deployment uses this config. Do not deploy production yet.
- [ ] Record owner release authorization, current rollback versions and a fresh
  active-room/pending-payment inventory at the actual launch window. Verify the
  original 0.1.4 client's update-required behavior and the approved candidate's
  authenticated behavior; earlier automated evidence is not this acceptance.
- [ ] Apply and verify the ten migrations before merging main. The existing main
  push migration workflow must then be a no-op, avoiding a race with Vercel.
- [ ] Promote compatible web, verify its exact SHA, then dispatch production
  Worker with that full `production_ready_sha`. Configure and verify LIVE billing
  and web/Worker flags before the final SQL policy switch. Preserve account rights,
  original activation, usage and accepted payment/discount obligations.
- [ ] Verify the coordinated production behavior, including Free/paid/guest rooms,
  time/closure, purchase transition, invitations and uninstall offers. Publish the
  already approved 0.1.5 only after this checkpoint; observe the rollout.

Detailed ordering and rollback boundaries below remain authoritative. LIVE access
is restored and the conflict is resolved locally. Staging delivery, the provider
changes documented below and coordinated production launch remain separate steps.

## Source and environment inventory

The preparation branch starts at accepted staging
`dc988034df904157cf0bbb9e29bbfe9d41e82a04` (PR #521). Production main remains
`9da93cd9891b6155051fc550957635c089fc8f3a`. Their tree comparison contains **504
changed files**, including ten migrations; the earlier 514 estimate was incorrect.
This includes website, SEO, auth, history, social and runtime work, not just Free20.
Freeze the final merged staging SHA in the artifact receipt; do not identify a
dirty working-tree build as that SHA.

Read-only provider inventory on November 6:

| Plane | Staging | Production |
| --- | --- | --- |
| Supabase | `cyppqpprkygjloyfvvvj`, 93 migrations | `bynsjjxzatxndzjkogim`, 83 migrations, latest `20261022124234` |
| SQL policy | Free20 and abuse enabled, new trials disabled | Old schema/policy; new flags not present |
| Original activation | `2026-09-29T15:48:48.80082Z` | `2026-10-03T16:44:10.213666Z` |
| Worker | `anidachi-api-staging`, version `95b6b52b-f109-4d74-966f-f5ebec76851c` | `anidachi-api-production`, version `3ea773eb-f258-4713-a314-9abeb4012f49` |
| Worker Free20 accounting | `true` | absent/off |
| Stripe connection | AniDachi sandbox, `livemode=false` | LIVE account unavailable through current connectors |

Cloudflare account: `d60ffabe1c032c70f433ff6affebc646`. Vercel project:
`prj_E6UFEzEZYaarqkbfLRJFS1lHzNER`. Inventory reads do not change customer data.
Vercel environment metadata establishes configured key names, not working Stripe
objects, matching secret pairs or successful payments. Recheck current aliases
and CI at delivery; record exact deployments in the PR/artifact receipt.

Pending production migrations, in order:

1. `20261031074738_daily_free20_room_admission.sql`
2. `20261031100000_free20_account_status.sql`
3. `20261101081311_free20_purchase_delivery.sql`
4. `20261101092311_free20_trial_retirement_guard.sql`
5. `20261101094401_free20_daily_warning.sql`
6. `20261101102723_free20_client_admission.sql`
7. `20261103120000_free20_abuse.sql`
8. `20261104133355_uninstall_retention_campaigns.sql`
9. `20261105120000_cancellation_retention.sql`
10. `20261105142000_uninstall_feedback_admin_read.sql`

Save SHA256 for each exact file with the frozen release receipt. Apply the entire
reviewed file, including checked function-body patches. A previously initialized
local fixture was stale despite containing the migration's tables; table presence
alone is not function parity. Fresh local replay of current post-October-31 files
passed 2,190 SQL assertions in 57 suites. The baseline image contains the first
Free20 migration; this is not a fresh replay of all 93 historical migrations.

## Compatibility during Store review

Production does not yet have `/api/me/hosting-status`. The candidate extension
handles its generic 404 only by a fresh authenticated, current-owner read of
`/api/me/entitlements?hostingStatusVersion=1`. A complete, consistent old hosting
contract without the capability marker selects the existing legacy presentation.
The old server still authorizes every room. No quota or paid access is invented.

New web returns `hostingStatusVersion: 1` when explicitly requested, independent
of Free20 activation. Any present marker prohibits generic-404 fallback. A
confirmed new status also latches support for that login, including concurrent
requests. Errors, malformed bodies, owner changes and unknown versions fail closed.
The old `hosting` object and unrequested entitlements responses are unchanged.

This permits review against the current production service. Free20's public
availability still begins at the coordinated server activation, not ZIP creation.

On November 7 the owner chose rollout compatibility instead of an early production
website deployment. Before the site supports `/uninstall`, the extension leaves
Chrome's optional uninstall URL empty. It only registers the canonical `/uninstall`
after a version-1 `{ available: true }` response from the same website's public
`GET /api/extension/uninstall-capability`. That metadata ships with the page and
APIs, **after their schema**; it asserts deployment support, not discount eligibility
or successful payments. No account, cookie or installation identifier is sent.

The background checks at install/worker start, browser startup and an hourly alarm,
with an hour-long cache across MV3 restarts and a five-second request deadline.
There are no redirects or response-supplied URLs. Explicit absence (404/410 or
versioned false) clears the optional URL. Network/server/unknown-response failures
preserve a previously verified page; without one they leave uninstall silent.
An explicit site rollback is detected on the next refresh. Initial network failure
can delay activation until the next successful check; no reinstall is required.
All installations and reviewers use the same behavior. Staging exposes only this
anonymous metadata GET; its page, feedback, billing and account surfaces remain
password-gated and noindex.

The new uninstall screen and retention flow still require the coordinated web
deployment and independently verified LIVE configuration. Disclose the transition
in reviewer notes; do not describe the old production website as the new flow.
Supply a suitable authorized test account through the Store's private reviewer
fields; do not put credentials in this repository or ZIP. Automated transport
tests are not a claim that a Store reviewer or a loaded production package has
completed an authenticated session.

Old installed clients remain subject to the existing Free20 admission/version
guard after activation. Verify the exact published 0.1.4 upgrade path separately;
do not assume every installation updates immediately.

## LIVE retention prerequisites

### Verified LIVE inventory: November 7

Read-only inventory of `acct_1RlmiCAGc1Bd58Cj` completed with `livemode=true` and
no truncated pages. No subscriptions, payments or provider objects were changed.
The sanitized receipt is
`artifacts/free20-post-approval-20261107/stripe-live-readback.json` (ignored).

| Plan | Existing monthly price | Existing annual price | Shared product |
| --- | --- | --- | --- |
| Plus | `price_1TknUGAGc1Bd58CjxImsjOEH`, USD 7.99 | `price_1UM3mvAGc1Bd58CjUnlK9JNl`, USD 76.70 | `prod_UkI4IkKa86J733` |
| Pro | `price_1TknW0AGc1Bd58CjkxcMVEx0`, USD 14.99 | `price_1UM3njAGc1Bd58CjaAxFnifl`, USD 143.90 | `prod_UkI6Udvl3VpihD` |

The two existing coupons are historical, invalid repeating offers; neither is the
new one-time 40% offer. The default portal is `bpc_1UEiR1AGc1Bd58CjV6IRKFT5`;
the existing annual-change portal is `bpc_1UM3ppAGc1Bd58CjWCK4qaN4`. Neither listed
configuration has native retention configured. No account-specific retention
session has been exercised by this inventory.

Keep generic portals free of a global retention coupon. The implemented Cancel
renewal flow creates its private single-use coupon on demand after checking the
account's lifetime allowance and monthly-only catalog. Absence of such a coupon
before an eligible request is expected; no blanket dashboard offer is needed.

The enabled webhook is `we_1TWGwEAGc1Bd58CjSA30Ttxu`, targeting
`https://www.anidachi.app/api/stripe/webhook`, pinned to `2025-06-30.basil`.
It subscribes to checkout completion, subscription create/update/delete,
invoice paid/payment failed/payment action required. `invoice.created` is missing.
Preserve this endpoint's pinned version independently of the application's
`2025-08-27.basil` API version; do not rotate its signing secret.

The concrete future LIVE change is to give annual sale prices distinct products
at the same amounts, preserve existing annual subscriptions through legacy IDs,
prepare the yearly-change portal, and create the approved monthly-only, one-time
40% campaign coupons. Add `invoice.created` only after its handler/schema are
delivered. Enable issuance only after the existing one-per-account and provider
validation gates pass. None of these LIVE mutations is authorized by this inventory.

The code now validates TEST and LIVE independently through the existing Stripe
mode resolver. No LIVE campaign was enabled by this work. Exact opt-ins:

| Campaign | LIVE settings |
| --- | --- |
| Uninstall first month, including eligible former subscribers | `STRIPE_UNINSTALL_FIRST_ENABLED_LIVE=true`, `STRIPE_UNINSTALL_FIRST_COUPON_ID_LIVE` |
| Uninstall next monthly renewal | `STRIPE_UNINSTALL_RENEWAL_ENABLED_LIVE=true`, `STRIPE_UNINSTALL_RENEWAL_COUPON_ID_LIVE` |
| Native cancellation offer | `STRIPE_CANCELLATION_RETENTION_ENABLED_LIVE=1` |

There is no unsuffixed or cross-mode fallback. Wrong-mode customers, prices,
coupons, subscriptions and invoices are rejected. The signed webhook also checks
mode before recording event processing. Turning issuance off preserves fulfillment
and reconciliation of accepted claims. All new paths share the existing one-time
account allowance; no second discount is introduced.

Before enabling LIVE offers, with separate authorization:

- Recheck the actual AniDachi LIVE account against the dated inventory above;
  access alone does not establish LIVE readiness.
- Verify Plus/Pro monthly and annual price IDs, currency, amounts and recurring
  intervals. Native cancellation requires four distinct products, and exactly one
  active sale price on each monthly product. Stripe coupon scope is by **product**,
  not monthly/yearly price interval. Keep annual conversion available and undiscounted.
- If separating existing annual sale products, retain the old annual IDs in
  `STRIPE_PRICE_IDS_PLUS_YEARLY_LEGACY_LIVE` and
  `STRIPE_PRICE_IDS_PRO_YEARLY_LEGACY_LIVE`. Archive old sale prices only after
  new annual targets and the dedicated yearly portal configuration are verified.
  Do not reprice existing subscriptions or alter their IDs, periods or anchors.
- Verify the ordinary cancellation portal and dedicated yearly confirmation
  configuration. The account's owner-checked Cancel action prepares the private
  offer; generic portal sessions do not have a global coupon. Check that unrelated
  Stripe retention rules do not supersede this owner-specific coupon.
- Update the **existing** LIVE webhook's event selection to include `invoice.created`
  while preserving endpoint ID/URL, signing secret, pinned API version and existing
  lifecycle events. Do not run an endpoint-creation script as an update.
- Validate current coupons and accepted/pending obligations before issuance.
  New offers remain disabled until schema, handler delivery and provider proof agree.

Primary references: [Stripe coupon product scope](https://docs.stripe.com/billing/subscriptions/coupons)
and [cancellation offers](https://docs.stripe.com/customer-management/cancellation-page).
Stripe API remains pinned to `2025-08-27.basil`; no SDK/API upgrade is part of this release.

## Ordered launch after Store approval

1. **Freeze and review.** Deliver the preparation PR to staging, follow CI and
   hosted smoke, then freeze source and build the exact 0.1.5 production ZIP.
   Record ZIP SHA256, byte size, public-key fingerprint, permissions, extension ID
   and build ID. User staging reload and authenticated/two-user acceptance remain
   distinct from automated checks.
2. **Store review only.** The owner uploads the reviewed ZIP and selects deferred
   publication, leaving automatic publication off. Keep the same ZIP after approval.
   Chrome documents a 30-day window to publish an approved deferred submission:
   [publish documentation](https://developer.chrome.com/docs/webstore/publish).
   Approval does not itself authorize this agent to publish or change production.
3. **Fresh go/no-go inventory.** After approval and owner launch authorization,
   recheck main/staging, active rooms, migration versions, pending payments and
   accepted discount obligations. Record current rollback versions. Resolve LIVE
   access/configuration before promising working production retention offers.
4. **Schema first.** Pre-apply only the ten reviewed pending migrations with their
   original versions/hashes while Free20/abuse issuance gates remain off. Use the
   reviewed CLI migration path and exact production project; stop on unexpected
   pending versions. Verify schema/functions/permissions, unchanged account rights,
   and preserved original `activation_at`. Do not rewrite migration history.
   A single main merge is insufficient: Vercel and DB workflows run independently.
5. **Compatible web.** Promote the accepted candidate through a staging-to-main PR
   after schema readiness. Verify Vercel Production READY at the exact SHA, auth,
   private API behavior, checkout/webhook health and disabled-policy responses.
   Never push main directly. Ensure old web instances no longer accept new trials
   before the eventual policy switch.
   Verify `/api/extension/uninstall-capability` returns the versioned metadata and
   `/uninstall` plus its APIs work against the migrated production schema. The
   installed candidate registers the page at its next background refresh (within
   an hour while Chrome is running, or at browser startup), without a new ZIP.
6. **Compatible Worker.** Dispatch the manual production Worker workflow with
   `production_ready_sha` equal to that verified main SHA. It requires schema and
   compatible web first. Add the production accounting flag through a reviewed
   `[env.production.vars]` config change; dashboard-only changes are overwritten
   by Wrangler deployment. Verify deployed version, bindings and health.
7. **Runtime ready, SQL last.** Deliver and verify production web flags
   `ANIDACHI_FREE20_ACCOUNTING_ENABLED=true` and
   `ANIDACHI_FREE20_ABUSE_ENABLED=true`, together with the Worker accounting flag.
   Verify same-environment internal authentication and existing abuse context keys
   without printing secrets. Only then atomically enable SQL Free20/abuse and disable
   new trials using expected-revision guards. Increment revision; preserve the
   original activation timestamp, existing trial/manual/paid rights and usage.
   Rehearse the exact SQL transaction and its no-op/revision-conflict behavior first.
8. **Verify, then publish.** Verify authenticated Free/paid/guest admission, settlement,
   quota exhaustion, owner-visible reset time and purchase transition on the final
   production versions. Enable individually verified LIVE retention campaigns.
   The owner then publishes the exact approved Store package. Update production
   build/download metadata only for that artifact; never replace it with a rebuild
   while claiming the old review/hash. Public ZIP hosting is a separate approved action.
9. **Observe.** Check errors, denied admissions, settlement recovery, duplicate
   payment events, invite delivery and update-required behavior for old clients.
   Use only AniDachi analytics project `813335` if analytics is consulted.

## Rollback boundaries

Before activation, restore the prior compatible web/Worker versions with gates
off; leave additive schema and immutable payment records intact. A disabled offer
flag stops new issuance, not accepted invoice obligations.

After Free20 rooms exist, do not blindly turn all three gates off: SQL admission,
web callbacks and Worker accounting form one contract. Prefer a forward fix or
drain affected rooms through normal terminal settlement before restoring legacy
runtime. Preserve daily ledgers, marker reservations, cumulative ACKs and accepted
payments; never reset usage or delete an unsettled room to simplify rollback.
The exact incident procedure depends on observed failure and requires a new
operator decision. A Store rollback requires a higher reviewed version.

## Store text and reviewer notes

Keep the existing Store identity `gpkolofebdhfpapbbgdkdkmlmjfidgmn` and name
**AniDachi: Watch Together, Synced Watch Party**. Production endpoints are
`https://www.anidachi.app` and
`https://anidachi-api-production.vladislav-gul7.workers.dev` / `wss`.

Suggested change notes:

> Daily free hosting time, clearer room controls, friends and invitations,
> improved onboarding, and fixes for account status and room transitions.

Private reviewer rollout note (keep this accurate at submission time):

> This package uses AniDachi's production services. During review, existing account
> and room access remains available through the current production backend. Daily
> free hosting and the uninstall survey/offer page are part of a coordinated server
> rollout before public release. The optional uninstall tab stays disabled until
> the website advertises support, then uses the same page for every installation.
> There is no reviewer-specific behavior. Please keep publication deferred; we
> will activate the compatible server deployment before manually publishing the
> approved package. No remote executable code is downloaded by this capability check.

Listing content should describe synced watching on YouTube, Crunchyroll and
Netflix, room links/friends, chat/reactions and optional voice/video. Explain the
20-minute daily host allowance and paid plans in pricing details, without trial
promises or implying the extension supplies paid streaming subscriptions. Watching
alone does not spend the allowance; guests do not spend their own host allowance.

Recording is controlled in Settings; eligible Plus/Pro access and YouTube consent
still gate collection. The compact welcome is not consent and does not explain
recording. Privacy now retains the actual defaults, eligibility and deletion
description without that stale welcome claim. Review Store privacy disclosures
against the exact package; no additional host permissions are requested here.

Before public launch, inspect the saved listing, screenshots, pricing and privacy
page together. This document is preparation text, not proof that Store fields or
the public production website have already been updated.
