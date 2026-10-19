# AniDachi 0.1.4 — Store review and coordinated launch

Status: release audit and package refresh authorized October 19, 2026.
Production/main changes and Store publication are NOT authorized. The owner uploads
the exact review ZIP with deferred publication, waits for approval, then authorizes
the launch window. The owner screenshot now shows 0.1.3 as a draft and 0.1.2
as published; the owner authorized 0.1.4 for the requested Store rename and
reported that anti-abuse works. This is owner-reported acceptance, not a new
instrumented cookie-only or Stripe test. Preparation is complete only where the
evidence below says so.

## Candidate identity and evidence

- Frozen package source: `b49bbab000dbb6e979e8732d4dd07b3ca61a0653` on the release preparation branch.
  This adds only the approved production manifest name and matching validation
  to runtime baseline `32ad5ab035b2584a735edf0028e29b081e0ea1af` (staging, #448/#449).
  The rename commit still needs staging integration before production promotion.
- Production baseline remains `a8aee4641ab74bd8b7992217fdcc4302543b7d54`.
- Documentation refresh branch: `codex/release-audit-oct19`.
- Previous actual Store package: 0.1.2, SHA-256
  `90d2b981c17198cfa0472b5bf40d061f5aca84fd7a16ed767e1735f0be459375`.
  The production GitHub version variable remains unchanged. The later owner
  screenshot shows draft 0.1.3 and published 0.1.2. Automated dashboard access
  was unavailable; no upload, submission or publication was performed here.
- Candidate version: **0.1.4**. Production name is
  `AniDachi: Watch Together, Synced Watch Party`; short name remains `AniDachi`. Keep the existing Store item/ID
  `gpkolofebdhfpapbbgdkdkmlmjfidgmn`; do not create a second listing.
- The previous frozen source was `9b99ba0ec10855984bad3724c76b60ad6deb142b`.
  The audited 0.1.3 refresh added only the popup welcome and its tests:
  the progress/people/invites overview and website setup guide. The 0.1.4
  follow-up changes only Store metadata and matching validation.
  Later subscription, library and mobile-install changes are Web-only.
- Exact build IDs, package hashes, migration hashes, deployment IDs and check
  output belong in the ignored artifact directory's receipts. A rebuilt ZIP is
  a different artifact until revalidated.

The production overlay mount, early keyboard guard and background introduction
claim are enabled together. Sender validation and the installation-local
`anidachi.playerIntroductionSeen.v3` key remain unchanged. An absent key makes
an installation eligible; an existing seen value prevents replay. The practice
tour does not create a room, capture camera/mic, send chat or change preferences.

October 19 extension typecheck and all **2,439 tests in 150 files** pass on the
frozen source. The exact unpacked production ZIP also passes an offline Chrome
fixture: popup/logo, all six tour steps, real HTML5 pause/resume, keyboard cleanup
and persisted seen state after browser restart. Five checkout-return scenarios
pass: success returns to the same tour step; closed tour, changed video, closed
tab and changed account do not reclaim focus; replay is rejected. These are local
fixtures, not real-provider, real-billing, Store-update or two-person acceptance.

### Frozen artifact receipt (October 19)

Local ignored bundle: `artifacts/chrome-web-store-0.1.4-release-20261019/`.

| Artifact | Identity |
| --- | --- |
| Store review ZIP | `AniDachi-0.1.4-Chrome-Web-Store.zip` |
| SHA-256 | `98f42ba080c38058053cced1fadb48e7587dd8c164c8cc3861f648178612d55e` |
| Build ID | `b49bbab000dbb6e979e8732d4dd07b3ca61a0653-production-rename-20261019` |
| Staging test ZIP | `AniDachi-0.1.4-Staging-Test.zip` |
| Staging SHA-256 | `cc9b66e3a05f9c9e850892190ad2b85a6ee08e5311441e27ba3bee5fd0ff351c` |
| Staging build source | `b49bbab000dbb6e979e8732d4dd07b3ca61a0653` |

Both channel ZIPs are rebuilt from the same frozen source. They supersede all
0.1.3 archives. Byte comparison allows only the new manifest name/version and
diagnostic build IDs; all functional bundles are otherwise identical. The
rename checks rerun extension typecheck/tests, both channel validators and local
Chrome onboarding/welcome fixtures. Earlier offer/return receipts below belong
to the unchanged 0.1.3 runtime and are retained, not misreported as new live tests. The #444 trial fallback fix
is preserved: unresolved access stays neutral, retries use the existing coalesced
read, and a confirmed card-required server retains ordinary pricing navigation.
Confirmed trial/paid behavior and final server authorization are unchanged.
Seven exact-package Chrome scenarios are checked per channel: delayed read,
error/retry, used trial, paid subscription, signed-out, card-required server and
incomplete terms. Each normal signed-in case uses one read; retry adds one
explicit read; signed-out uses none. These are offline fixtures, not live account
or payment acceptance; the receipt records their actual outcomes.

Both ZIPs retain `anidachi:website-presence:v1`, the existing production public
VAPID key, channel IDs and unchanged narrow permissions. Channel endpoints and push
configuration intentionally differ. Validators, ZIP CRC/extracted-byte comparisons
and removed-text scans pass. Upload only the Store ZIP, not the evidence folder.
Old archives are retained for history and must not be uploaded.

Current staging CI `39180531485`, Rooms E2E `39180539114`, P2P E2E
`39180538974` and protected staging smoke `39180707930` all succeeded at
`32ad5ab0`. The promotion-PR CI `39180538988` passed on attempt 2 without a
source change; attempt 1 hit an intermediate-timing assertion in the existing
paid-hosting runtime test while the alarm completed before its snapshot. The
same-tree staging push CI passed. Do not hide that flaky result or treat rerunning
as a code repair. Database workflows `39180397158` and `39180531438` succeeded.
Staging Web is READY: `dpl_EDMkTu9GCi7ZGHpNcRwEyg4qB7Gd` at `32ad5ab0`.
Production Web remains READY: `dpl_8isU75BC4EGwgFA7oKzmCsEHUjTf` at `a8aee464`.
The existing Worker source `9f66ee73b669ffb452c8e9dd59bbde461c4851ed` has no
Worker/protocol/lockfile delta to this frozen source; this audit does not deploy it.
Documentation commits after this freeze do not change package identity.

Staging currently has no required-status-check protection reported by GitHub;
`--auto` can therefore merge immediately. Wait for the exact-head checks and
inspect their results before any merge; never use auto-merge as the waiting gate.
No protection setting was changed as part of preparation.

The main ancestry merge has no source-tree difference from the pre-merge
candidate. Keep that merge commit when delivering to staging: squash would lose
its ancestry reconciliation. Preserve current www canonical handling, production
Worker deployment gate and approved staging UI. PR #402 is not an automatic
promotion authorization; review the complete eventual main diff afresh.

## Production baseline: do not repeat the old cutover

Read-only October 19 inspection found 69 applied migrations, latest
`20260928083738`. Hosting policy is already active: revision 2,
`activation_at=2026-10-03T16:44:10.213666+00:00`, `trials_enabled=true`.
Cardless activation and abuse-marker tables are not present yet. Existing paid,
trialing, canceled and past-due subscriptions exist.

**Do not replay the October 3 transition UUID/T, reset hosting activation,
disable all trials, cancel old subscriptions or alter existing Stripe prices.**
This release adds a new trial mode to an already operating paid-hosting product.
Refresh this snapshot before launch; it is evidence at a point in time.

Ten source migrations are pending against that ledger, in this order:

1. `20261007235706_netflix_history_and_room_sources.sql`
2. `20261011124600_cardless_subscription_trials.sql`
3. `20261011132247_cardless_trial_launch_guards.sql`
4. `20261011135040_cardless_trial_renewal_setup.sql`
5. `20261011153028_trial_conversion_events.sql`
6. `20261011161158_cardless_trial_review_guards.sql`
7. `20261015072640_cardless_trial_abuse_guards.sql`
8. `20261016092853_trial_offer_preflight.sql`
9. `20261017130802_trial_context_rate_limit.sql`
10. `20261018223354_trial_renewal_preview_and_saved_card.sql`

Staging has all 79 source migrations and both cardless starts and anti-abuse
enforcement enabled at policy revision 3. Production still has the original
policy revision 2 and no cardless tables. These read-only checks did not change
flags, subscriptions or accounts.

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
   Update the production build version variable to 0.1.4 only during the
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
| Exact ZIP and source | October 19 production/staging validators, CRC/unpacked equality and 2,439 extension tests pass. Both channel ZIPs use the same frozen source; exact-package scenario results are in the receipt. No archive was uploaded or published. |
| Fresh onboarding | Exact production ZIP passes all six steps/finish, video/input cleanup, restart/no replay and five checkout-return cases in offline Chrome. Actual provider/installed-update behavior remains a separate gate. |
| Multi-provider rooms | Prior provider/input tests and staging repairs passed; final combined two-person Netflix plus YouTube/Crunchyroll smoke remains separate. Include V/repeat/keyup/chat, native controls/fullscreen/navigation, real mic/camera and room end. |
| Browser/installation abuse | Owner reported that anti-abuse works. Server tests and staging migrations pass; read-only October 19 policy confirms enforcement remains on. Do not repeat completed owner testing merely for this popup change. Cookie-only denial and exact Stripe-operation evidence remain unrecorded if not covered by that test; confirm their coverage before production activation. |
| Trial billing | Preserve earlier no-charge expiry, renewal/decline/3DS/recovery receipts. Current staging includes 21 preview states and saved-card renewal guards from #448/#449; 1,316 web tests passed with 6 skipped, plus disposable SQL contracts. Preview switching is local and price preview is read-only. Real Sandbox saved-card setup/change/cancel/re-enable, multi-tab and delayed-return acceptance still require explicit evidence; preview screenshots are not payment proof. Re-run affected cases only. |
| Store update | Compare exact 0.1.2/0.1.4 permissions; Netflix adds `https://www.netflix.com/*`. Actual Store permission acceptance/re-enable and settings/session/seen-state preservation are not proven by unpacked reload. |
| Public copy/privacy | The [website-copy follow-up](netflix-website-copy-2026-10-17.md) removes stale Netflix availability claims and adds Netflix to the existing privacy provider list for the coordinated launch. Verify its staging delivery and review Store listing/privacy declarations before publication. Do not imply ad-plan acceptance without evidence or change SEO routes/H1s to perform this cleanup. |
| Production readiness | October 19 read-only schema/policy/deployment baseline is recorded; ten migrations remain pending. The current Stripe connector exposes Sandbox only, so LIVE catalog/Portal/webhook readiness is still open. Real post-deploy auth/push and legacy-client smoke remain required. |

## Next acceptance steps, one at a time

1. Confirm coverage of the owner-reported anti-abuse test. If not already tested,
   finish only the cookie-only path and exact single-trial/72-hour evidence in
   staging, preserving cookies and markers rather than resetting them again.
2. Exercise the newly changed saved-card renewal paths in Stripe Sandbox: fresh
   consent, unchanged trial end, plan/period change, cancellation/re-enable,
   second-tab quote and delayed return. A card being stored must not itself
   enable renewal, and a changed card must not be silently reused.
3. Close combined provider/host+guest and account/history gates above. Existing
   passing unit/SQL/E2E results are not actual Netflix DRM/ad-plan or Store update
   acceptance. Preserve earlier valid receipts; repeat affected cases only.
4. Replace the current 0.1.3 draft with the exact hashed 0.1.4 ZIP and submit with
   automatic publication off; review listing/privacy/reviewer notes. Store review
   can happen while these acceptance checks continue. Approval is not permission
   to change main or production; use the ordered launch stages above.

## Store submission notes

Keep one simple purpose: synchronized watch rooms, chat, voice and camera on
supported video pages. Explain Netflix host access and its provider-local MAIN
bridge; it controls playback, not DRM or video capture. The channel site external
connection verifies optional installation proof for trial abuse protection; do
not describe it as fingerprinting or a permanent device identity. Camera/mic are
user-controlled. Match actual Watch History preferences, retention and account
access in privacy declarations; do not promise unverified ad-plan behavior.

Google submission guidance: [update an existing item and defer publication](https://developer.chrome.com/docs/webstore/update/)
and [ZIP preparation](https://developer.chrome.com/docs/webstore/prepare).

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
- After any saved-card renewal operation is created, retain the new immutable
  payment-source validation and current-card reconciliation guards. Reverting to
  the pre-#448 service is unsafe while such an operation may be pending/applying:
  that code ignores `payment_source_operation_id` and can restore a replaced card
  on retry. Roll back UI independently, retain/backport compatible handlers, or
  first prove all such operations settled. A nullable schema column alone does
  not establish runtime rollback compatibility.
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
