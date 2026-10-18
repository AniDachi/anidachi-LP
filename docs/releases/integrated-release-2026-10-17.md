# AniDachi 0.1.3 — Store review and coordinated launch

Status: package and runbook refresh authorized October 18, 2026. Production/main
changes and Store publication are NOT authorized. The owner uploads the review
ZIP with deferred publication, waits for approval, then authorizes the launch
window. On October 18 the owner requested two existing staging test accounts be
reset for abuse acceptance and chose to test them later. Preparation is complete
only where evidence below says so; reset accounts are not acceptance evidence.

## Candidate identity and evidence

- Frozen runtime source: `85236137d7e50dbfbddea348f71c394d853c5c4c` (staging, October 18).
- Original October 17 preparation started at `847e9d16394b9c91d7045376e89c9d4ce15d2342`.
- Production baseline: `a8aee4641ab74bd8b7992217fdcc4302543b7d54`.
- Documentation refresh branch: `codex/release-package-refresh-oct18`. No runtime changes.
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

October 18 extension typecheck and all **2,435 tests in 150 files** pass on the
frozen source. The exact unpacked production ZIP also passes an offline Chrome
fixture: popup/logo, all six tour steps, real HTML5 pause/resume, keyboard cleanup
and persisted seen state after browser restart. Five checkout-return scenarios
pass: success returns to the same tour step; closed tour, changed video, closed
tab and changed account do not reclaim focus; replay is rejected. These are local
fixtures, not real-provider, real-billing, Store-update or two-person acceptance.

### Frozen artifact receipt (October 18)

Local ignored bundle: `artifacts/chrome-web-store-0.1.3-final-20261018/`.

| Artifact | Identity |
| --- | --- |
| Store review ZIP | `AniDachi-0.1.3-Chrome-Web-Store.zip` |
| SHA-256 | `831a03b24702d118fd32c5183f3f4b8221b66faa404bd2b710754aef39278f17` |
| Build ID | `85236137-production-final-20261018` |
| Staging test ZIP | `AniDachi-0.1.3-Staging-Test.zip` |
| Staging SHA-256 | `ae9cfc60de9e1c68001954ed7a5941abaf62c0eb88f2fd2e5c5523f9fcb1bce4` |
| Staging build source | `c78c4dcd9dc05d6a758c805fe3825084d657b7eb` |

The staging ZIP is a byte-for-byte copy of the already validated website-welcome
build. Its extension/protocol/build inputs and lockfile have no diff to the frozen
runtime; later commits change Web subscription screens only. Channel endpoints,
IDs and push configuration intentionally differ. The Store ZIP now also includes
`anidachi:website-presence:v1`, missing from the previous onboarding-return archive.
This read-only hint does not grant trial eligibility or create an installation key.
The existing production public VAPID key and Store ID are preserved. Both channel
validators pass. Upload only the Store ZIP, not the containing evidence folder.

Runtime CI on `85236137`: `39095465827` and `39095472951`; Rooms E2E
`39095473013`; P2P E2E `39095473010`; staging smoke `39095644776` — passed.
Staging Web deployment: `dpl_FBwrTt2yB5qe8EKZNvYHu2Y5PsKN`, READY at that SHA.
Worker deployment run `39080161026` used `9f66ee73b669ffb452c8e9dd59bbde461c4851ed`;
Worker/protocol/lockfile diff to the frozen runtime is empty. Documentation-only
staging commits do not replace this runtime or ZIP identity.

The main ancestry merge has no source-tree difference from the pre-merge
candidate. Keep that merge commit when delivering to staging: squash would lose
its ancestry reconciliation. Preserve current www canonical handling, production
Worker deployment gate and approved staging UI. PR #402 is not an automatic
promotion authorization; review the complete eventual main diff afresh.

## Production baseline: do not repeat the old cutover

Read-only October 18 inspection found 69 applied migrations, latest
`20260928083738`. Hosting policy is already active: revision 2,
`activation_at=2026-10-03T16:44:10.213666+00:00`, `trials_enabled=true`.
Cardless activation and abuse-marker tables are not present yet. Existing paid,
trialing, canceled and past-due subscriptions exist.

**Do not replay the October 3 transition UUID/T, reset hosting activation,
disable all trials, cancel old subscriptions or alter existing Stripe prices.**
This release adds a new trial mode to an already operating paid-hosting product.
Refresh this snapshot before launch; it is evidence at a point in time.

Nine source migrations are pending against that ledger, in this order:

1. `20261007235706_netflix_history_and_room_sources.sql`
2. `20261011124600_cardless_subscription_trials.sql`
3. `20261011132247_cardless_trial_launch_guards.sql`
4. `20261011135040_cardless_trial_renewal_setup.sql`
5. `20261011153028_trial_conversion_events.sql`
6. `20261011161158_cardless_trial_review_guards.sql`
7. `20261015072640_cardless_trial_abuse_guards.sql`
8. `20261016092853_trial_offer_preflight.sql`
9. `20261017130802_trial_context_rate_limit.sql`

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
| Exact ZIP and source | October 18 production build/validator, CRC/unpacked equality and 2,435 tests pass; staging ZIP inputs match the freeze. Artifact receipt records channels, hashes and scans. No archive was uploaded or published. |
| Fresh onboarding | Exact production ZIP passes all six steps/finish, video/input cleanup, restart/no replay and five checkout-return cases in offline Chrome. Actual provider/installed-update behavior remains a separate gate. |
| Multi-provider rooms | Prior provider/input tests and staging repairs passed; final combined two-person Netflix plus YouTube/Crunchyroll smoke remains separate. Include V/repeat/keyup/chat, native controls/fullscreen/navigation, real mic/camera and room end. |
| Browser/installation abuse | Server tests and staging migrations passed. Two owner-named staging accounts were reset October 18: Free/eligible, old Sandbox schedules canceled without invoice/proration, only their trial/marker records cleared; enforcement remains on. Owner will test later. Still verify first activation, second-account paid-only denial without clearing cookies, no duplicate Stripe trial, and cookie-only path without extension. |
| Trial billing | Preserve accelerated no-charge expiry, renewal/decline/3DS/recovery receipts. Ten local subscription UI states and authenticated staging trial overview/quote were checked after the SSR date fix (#442); that is not a new paid transaction. Re-run affected cases only; clocks do not advance DB/Worker time. |
| Store update | Compare exact 0.1.2/0.1.3 permissions; Netflix adds `https://www.netflix.com/*`. Actual Store permission acceptance/re-enable and settings/session/seen-state preservation are not proven by unpacked reload. |
| Public copy/privacy | The [website-copy follow-up](netflix-website-copy-2026-10-17.md) removes stale Netflix availability claims and adds Netflix to the existing privacy provider list for the coordinated launch. Verify its staging delivery and review Store listing/privacy declarations before publication. Do not imply ad-plan acceptance without evidence or change SEO routes/H1s to perform this cleanup. |
| Production readiness | October 18 read-only schema/policy/deployment baseline is recorded. The current Stripe connector exposes Sandbox only, so LIVE catalog/Portal/webhook readiness is still open. Real post-deploy auth/push and legacy-client smoke remain required. |

## Next acceptance steps, one at a time

1. In one connected test Chrome profile, reload staging as the first reset account.
   Keep cookies and the extension installation. Confirm `Try 3 days free` and
   `No card required`, Plus/monthly selected, then activate once. Verify the
   original 72-hour end time, hosting access and one matching Sandbox schedule.
2. Sign out and sign into the second reset account in the same profile without
   clearing cookies/reinstalling. Expect ordinary priced purchase, no free-trial
   claim and no second Sandbox trial. Do not reset markers between these steps.
   Then test the cookie-only denial with the extension disabled, using a direct
   website visit; re-enable the same extension afterwards.
3. With the same staged candidate, close the combined provider/host+guest and
   account/history gates above. Preserve earlier billing receipts; repeat only
   cases changed by the final candidate or cases without evidence.
4. Check the highest version in Store Package, including draft/review uploads,
   and review listing/privacy/reviewer notes. After owner acceptance, submit the
   exact hashed ZIP with automatic publication off. Approval is not permission
   to change main or production; use the ordered launch stages above.

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
