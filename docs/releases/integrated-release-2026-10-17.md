# AniDachi 0.1.3 — Store review and coordinated launch

Status: release preparation authorized October 17, 2026. Production changes and
Store publication are NOT authorized by this document. The owner uploads the
review ZIP, waits for approval, then authorizes the launch window. Fresh-account
abuse acceptance is explicitly deferred by the owner, not marked passed.

## Candidate identity and evidence

- Starting staging source: `847e9d16394b9c91d7045376e89c9d4ce15d2342`.
- Production baseline: `a8aee4641ab74bd8b7992217fdcc4302543b7d54`.
- Branch: `codex/integrated-release-candidate`.
- Previous actual Store package: 0.1.2, SHA-256
  `90d2b981c17198cfa0472b5bf40d061f5aca84fd7a16ed767e1735f0be459375`.
  Its archived build receipt and production GitHub version variable confirm
  0.1.2; the owner identifies it as the second release. The Store dashboard is
  currently login-gated, so a newer unpublished upload has not been inspected.
- Candidate version: **0.1.3**. Keep the existing Store item/ID
  `gpkolofebdhfpapbbgdkdkmlmjfidgmn`; do not create a second listing.
- Exact final source, build IDs, package hashes, deployment IDs and test output
  belong in the ignored artifact directory's `build-receipt.json` and report.
  A rebuilt ZIP is a different artifact until revalidated.

The production overlay mount, early keyboard guard and background introduction
claim are enabled together. Sender validation and the installation-local
`anidachi.playerIntroductionSeen.v3` key remain unchanged. An absent key makes
an installation eligible; an existing seen value prevents replay. The practice
tour does not create a room, capture camera/mic, send chat or change preferences.

Local extension typecheck and all **2,415 tests in 148 files** passed after the
production-channel regressions were observed failing and fixed. This proves
source behavior, not fresh-install, Store-update or two-person acceptance.

The main ancestry merge has no source-tree difference from the pre-merge
candidate. Keep that merge commit when delivering to staging: squash would lose
its ancestry reconciliation. Preserve current www canonical handling, production
Worker deployment gate and approved staging UI. PR #402 is not an automatic
promotion authorization; review the complete eventual main diff afresh.

## Production baseline: do not repeat the old cutover

Read-only October 17 inspection found 69 applied migrations, latest
`20260928083738`. Hosting policy is already active: revision 2,
`activation_at=2026-10-03T16:44:10.213666+00:00`, `trials_enabled=true`.
Cardless activation and abuse-marker tables are not present yet. Existing paid,
trialing, canceled and past-due subscriptions exist.

**Do not replay the October 3 transition UUID/T, reset hosting activation,
disable all trials, cancel old subscriptions or alter existing Stripe prices.**
This release adds a new trial mode to an already operating paid-hosting product.
Refresh this snapshot before launch; it is evidence at a point in time.

Eight source migrations are pending against that ledger, in this order:

1. `20261007235706_netflix_history_and_room_sources.sql`
2. `20261011124600_cardless_subscription_trials.sql`
3. `20261011132247_cardless_trial_launch_guards.sql`
4. `20261011135040_cardless_trial_renewal_setup.sql`
5. `20261011153028_trial_conversion_events.sql`
6. `20261011161158_cardless_trial_review_guards.sql`
7. `20261015072640_cardless_trial_abuse_guards.sql`
8. `20261016092853_trial_offer_preflight.sql`

Record file hashes and compare them with the live migration ledger immediately
before applying. Migrations are additive; new cardless/enforcement flags and
analytics delivery default off. The marker cleanup cron is bounded in Postgres.
Never infer schema readiness from a Web build or a disabled trial flag: new
billing code reads the new tables even while trial starts are disabled.

## Ordered delivery from review preparation to authorized launch

1. **Freeze and review.** Record every acceptance item below as passed, deferred
   or pending; post-deployment checks happen at their designated launch stages.
   Owner-deferred account tests are not required to prepare the review archive.
   Owner submits the exact ZIP with deferred publication (automatic publication disabled). Keep
   the current production serving during review. Record approval/package hash;
   agree a launch window. Do not replace the submitted artifact silently.
2. **Refresh configuration read-only.** Verify live schema, existing policy,
   Web/Worker source, extension callback ID, LIVE Stripe catalog/annual prices,
   Portal/webhook event handling and public VAPID match. Keep signing/Stripe/TURN
   secrets server-side. Do not rotate auth signing secrets for this release.
   Update the production build version variable to 0.1.3 only during the
   authorized launch; do not upload a later CI rebuild in place of the reviewed ZIP.
3. **Schema first, separately.** Pre-apply only the reviewed pending migrations
   with an approved migration-only operation, or deliver a migration-only main
   PR and wait for its completed ledger. The broad application promotion must
   wait. `db-production.yml` and Vercel start independently on a main push;
   their mere existence is not an ordering guarantee. Verify cardless starts
   and enforcement remain false and existing policy fields are unchanged.
4. **Compatible Web.** Promote accepted Web/billing/auth/antiabuse/history code
   only after schema verification. Verify production deployment SHA, old paid
   and card-required subscriptions, old-client auth/create/join/end, existing
   Checkout and Portal access, signed-out/Free/paid UI and canonical URLs.
   Set the trial event scheduler environment to production while delivery remains
   disabled, before admitting any cardless trial. Stop on any access regression.
   Retire serving old unguarded trial-start
   code before enforcing the new marker requirement.
5. **Compatible Worker.** Run the existing manual production deployment gate
   for the exact accepted main SHA after Web/DB readiness. Verify health,
   source admission and old/new-client room flows. Never reset live Durable
   Objects to deploy. Record rollback Worker version and matching Web baseline.
6. **New trial policy.** Once all prior gates pass, set abuse enforcement and
   enable cardless trials with the existing revision-checked policy procedure.
   Preserve all other fields, including the historical activation timestamp.
   Test a controlled eligible start, recovery, no-card expiry and explicit paid
   purchase for ineligible users. The server reservation stays authoritative;
   a browser/UI preflight never grants access. Missing/old extension falls back
   to the signed browser cookie. Unknown outcomes keep reservations pending.
7. **Analytics is separate.** Confirm the event environment was set before the
   first new trial in step 4, so retained events have the right environment.
   Only enable delivery after the production drain secret
   is configured on both Web and Vault and the key is verified to belong to
   AniDachi project 813335. Staging delivery remains disabled by owner choice.
   Trial access never depends on Amplitude ingestion.
8. **Publish and observe.** After new-server smoke passes, the owner publishes
   the approved Store version. Updates are asynchronous: old 0.1.2 clients must
   continue working. Verify actual invitation push and production auth on the
   new artifact, room end/reconnect, billing errors and normalized request cost.
   Record outcomes and stop activation/publication if an earlier gate fails.

As in the prior owner-directed 0.1.2 release, the new ZIP is built for the updated
production server. Complete Netflix/cardless flows against today's old backend
are not a prerequisite to preparing a review archive. **Old installed clients
against the new server remain a required compatibility check.** Reviewers must
be told truthfully which backend-dependent features are awaiting the coordinated
launch; provide an accepted test path/account through the Store's private reviewer
instructions when required, never credentials inside the package or repository.

## Remaining acceptance gates

| Check | Current evidence / next action |
| --- | --- |
| Exact ZIP and source | Build/validate both channels from frozen source; hash/extract the ZIP; no QA pages, secrets, source maps or cross-channel endpoints. |
| Fresh onboarding | Automated production tests pass; verify fresh install, all six steps/finish/skip, foreground ownership, reduced motion and no replay. |
| Multi-provider rooms | Prior provider/input tests and staging repairs passed; final combined two-person Netflix plus YouTube/Crunchyroll smoke remains separate. Include V/repeat/keyup/chat, native controls/fullscreen/navigation, real mic/camera and room end. |
| Browser/installation abuse | Server tests and staging migrations passed; owner deferred two fresh accounts in the same browser without clearing cookies. Verify denial shows ordinary priced purchase, no duplicate Stripe trial, and cookie-only path without extension. |
| Trial billing | Preserve existing accelerated no-charge expiry, renewal/decline/3DS/recovery receipts. Re-run only affected cases; clocks do not advance DB/Worker time. |
| Store update | Compare exact 0.1.2/0.1.3 permissions; Netflix adds `https://www.netflix.com/*`. Actual Store permission acceptance/re-enable and settings/session/seen-state preservation are not proven by unpacked reload. |
| Public copy/privacy | The [website-copy follow-up](netflix-website-copy-2026-10-17.md) removes stale Netflix availability claims and adds Netflix to the existing privacy provider list for the coordinated launch. Verify its staging delivery and review Store listing/privacy declarations before publication. Do not imply ad-plan acceptance without evidence or change SEO routes/H1s to perform this cleanup. |
| Production readiness | Schema/flags/LIVE integration/configuration are read-only preflight only; real post-deploy auth/push and legacy-client smoke still required. |

## Store submission notes

Keep one simple purpose: synchronized watch rooms, chat, voice and camera on
supported video pages. Explain Netflix host access and its provider-local MAIN
bridge; it controls playback, not DRM or video capture. The channel site external
connection verifies optional installation proof for trial abuse protection; do
not describe it as fingerprinting or a permanent device identity. Camera/mic are
user-controlled. Match actual Watch History preferences, retention and account
access in privacy declarations; do not promise unverified ad-plan behavior.

Release-note draft: “A redesigned player panel, a guided introduction, Netflix
watch rooms, clearer three-day trial setup without a card, and reliability and
request-efficiency improvements.” This is launch copy, not evidence of current
public availability. Store reviewer access/listing fields remain owner-reviewed.

## Rollback and stop conditions

- Before cardless activation: stop at the failed gate; leave additive schema in
  place and preserve existing billing behavior. Revert only the known compatible
  Web/Worker pair if needed, not an arbitrary historical main deployment.
- After any cardless trial starts: disable **new cardless starts only** and, if
  needed, analytics delivery. Keep compatible webhook/refresh/renewal/recovery
  handlers, marker ledger, outbox, Stripe schedules and original trial dates.
  A rollback to pre-cardless billing can strand payment obligations and is unsafe.
- Worker rollback must read already-persisted room/finalization state and preserve
  usage/source acknowledgements and retry deadlines; no destructive state reset.
- Extension rollback is a newly reviewed higher version, not overwriting the
  public ZIP or relying on all users to update at once. Keep server compatibility.
- Stop rollout on unexpected entitlement changes, duplicate charge/trial, auth
  failure, broken guest joining or lost finalization data. Investigate before
  enabling more flags. Do not clear pending Stripe reservations to unblock a demo.

References: [integrated plan](../superpowers/plans/2026-10-14-integrated-product-release.md),
[cardless recovery](cardless-trial/staging-runbook.md),
[release channels](../extension-release-channels.md),
[previous release order](paid-hosting-trial/production-preparation-2026-10-02.md#ordered-production-delivery).
