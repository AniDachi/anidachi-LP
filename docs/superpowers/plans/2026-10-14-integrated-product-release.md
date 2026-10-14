# Integrated AniDachi Release Plan

> **For agentic workers:** Execute reviewed blocks independently; freeze and verify the combined candidate before production promotion.

**Goal:** Prepare one compatible release containing approved drawer/onboarding,
Netflix, cardless 3-day trial and Vercel request optimizations.
**Architecture:** Staging integrates independently reviewed feature PRs. A frozen
release manifest coordinates database, Web, Worker and the asynchronously updated
Chrome extension. Backend and old clients must remain compatible throughout.
**Tech Stack:** Next.js/Supabase/Stripe, Cloudflare Worker/DO, WXT Chrome MV3.
**Spec:** Owner request 2026-10-14; scope/invariants in the cost design and existing
Netflix, cardless-trial and player-onboarding plans.

## Global Constraints

- Authorized now: isolated implementation, integration planning and staging delivery.
- Production/main promotion, production feature activation and Store publication
  need final owner acceptance of the concrete candidate.
- Keep current main SEO/www fixes. Do not flip canonical host or reuse a conflicting
  old promotion PR without reviewing its complete final diff.
- English extension copy; preserve approved opaque matte UI and working media behavior.
- Staging stays password gated/noindex; analytics stays disabled there per owner.

## Current inventory (2026-10-14)

| Part | State | Remaining gate |
| --- | --- | --- |
| Netflix | PR 401/403/404 on staging; additive migration applied there | exact combined artifact, movie/episode/native navigation/fullscreen/history and two-client sync; ad-plan evidence |
| Cardless trial | PR 410–415 on staging; five migrations, trial/payment/expiry receipts | reconcile stale docs; combined smoke and later production configuration/activation |
| Drawer/onboarding | local branch `codex/extension-guided-onboarding` HEAD d857cc6a plus four dirty extension files | safe final-diff import; tour production-channel enablement; loaded artifact |
| Cost fixes | PR419 delivered to staging de27cc98; [approved follow-up](2026-10-14-vercel-request-followup.md) is in preparation | follow-up regressions/review/staging; exact combined loaded artifact and production-normalized counts |
| Production baseline | main a8aee464 contains selective SEO release | preserve main-only fixes; review complete migration/runtime diff |

Local design already includes Netflix. Since the common base 60df2876, staging's
extension changes are limited to cardless hosting-paywall files. Do not cherry-pick
Netflix again. Current promotion PR 402 is conflicting and is not a ready release.

## Stage 1: Preserve and optimize

- [x] Preserve binary final UI net patch and separate four-file uncommitted polish
  patch with source SHA/checksums; leave original checkout unchanged.
- [x] Deliver first [cost optimization plan](2026-10-14-vercel-cost-optimization.md)
  through PR419 to staging de27cc98.
- [ ] Complete [request follow-up](2026-10-14-vercel-request-followup.md), then verify
  its session/history behavior in the combined loaded extension.
- [ ] Measure request reductions without promising invoice percentages.

Preservation receipt: original checkout's ignored
`artifacts/integrated-release-2026-10-14/preservation-receipt.json`. Committed UI
patch SHA-256: `155a3b6856693d23bcba4162cd290b6c0bd4c8da68a5a0c180048c57b1bc4055`;
final polish: `c62dd1e5535412c49d3741cca6ad8b4916629bb744113350d50f279778b94225`.

## Stage 2: Integrate approved UI and onboarding

- [ ] Fresh-staging branch `codex/extension-release-ui`; import only approved final
  `apps/extension` net diff plus relevant plan/evidence, excluding old Graphify churn
  and unrelated trial docs. Retain new cardless paywall.
- [ ] Include latest solid media icons, no button dots, click-only 1-second tooltip,
  neutral V key, balanced yellow/green, darker matte drawer and Interface divider removal.
- [ ] Enable tour intentionally in production at all three guards: overlay mount,
  content keyboard guard and background claim. Preserve sender validation and cleanup.
- [ ] Verify fresh install and upgrade: absent `anidachi.playerIntroductionSeen.v3`
  means tour eligible; preserve seen state across patch updates. No surprise replay.
- [ ] Regression tests: tooltip timing/reset/blur/Escape/unmount; tour warmup/tab
  return/account state/no real room-chat-media side effects and all dismissal paths.
- [ ] Staging PR, matching build, review and actual loaded artifact acceptance.

## Stage 3: Freeze and accept one release candidate

Record source SHA, staging deploy IDs, Worker version, migration set, extension
version/channel/hash and test accounts' roles without tokens or personal data.

- [ ] YouTube/Crunchyroll/Netflix: source recognition, normal/fullscreen, native
  navigation, tour, settings and no cursor/keyboard interception after dismissal.
- [ ] Host+guest: create/invite/join, chat, real mic/PTT/open mode, camera on/off,
  denied permissions, seat limits, reconnect, source switch and room end.
- [ ] Account/history: Free/paid, recording off/on, consent, account switch, restart,
  offline/recovery, lease expiry, correct history with reduced requests.
- [ ] Trial: eligible start without card, active room rights, optional renewal,
  declined/3DS recovery, expiry without charge, paid state; no repeat trial.
- [ ] Compatibility: existing Store extension and new extension against new backend;
  staging source-equivalent legacy builds are evidence with a clearly stated limit.
- [ ] Exercise an actual published-version-to-candidate update, not only clean
  installation. Compare the exact permission sets: Netflix introduces required
  `https://www.netflix.com/*` access. Verify any permission warning/re-enable path,
  retained settings/session/tour state, and prepare a short user explanation.
  Chrome can disable an update until a new warning-bearing permission is accepted
  ([official guidance](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings)).
- [ ] Closed-room finalization: lost callbacks/restart, durable source/usage,
  no endless fast retry; explicitly resolve unknown pending-newer-source cases.
- [ ] Review Netflix ad-plan support evidence and align public claims with actual
  supported behavior; do not market unverified support.

## Stage 4: Prepare a reviewable Store and launch package (no deployment yet)

- [ ] Refresh live production schema/flags/billing/deploy state read-only.
- [ ] Prepare promotion from the accepted candidate preserving current main SEO.
  Source delta currently lists six additive migrations: 20261007235706,
  20261011124600,20261011132247,20261011135040,20261011153028,20261011161158.
  Recheck against actual migration ledger; never blindly replay.
- [ ] Define a real schema-before-app gate. A main push starts `db-production.yml`
  and Vercel independently; one broad merge does not impose deployment order.
  Prepare a separately authorized dormant-schema promotion or approved pre-apply,
  verify its completed ledger with activation/trial starts/scheduler off, then
  promote dependent application code. New billing reads the trial table even
  when new trial starts are disabled; a flag alone cannot protect missing schema.
- [ ] Check highest uploaded Store version before choosing the next version.
  Keep ID `gpkolofebdhfpapbbgdkdkmlmjfidgmn`, exact production endpoints/public
  VAPID match, narrow approved provider permissions and licenses; exclude QA pages.
- [ ] After combined staging acceptance and package authorization, build the
  production-channel review ZIP from the frozen accepted source without deploying
  production. Validate and hash it; verify compatibility with current backend as
  well as the staged new backend, and prepare reviewer access/instructions.
- [ ] Record privacy/listing changes and release notes; Netflix/onboarding/trial
  descriptions must match accepted behavior.
- [ ] Prepare rollback per plane: additive schema retained; compatible Web keeps
  existing trial obligations even if new trial starts disabled; Worker rollback
  must understand durable state; extension updates arrive asynchronously.
- [ ] Present exact manifest, remaining risks, rollback and acceptance to owner.

## Stage 5: Only after explicit production approval

- [ ] Preserve the existing [owner-directed release order](../../releases/paid-hosting-trial/production-preparation-2026-10-02.md#ordered-production-delivery):
  submit the exact accepted ZIP with deferred publication, keep current public
  behavior during review, wait for Store approval, then agree the manual launch
  window. Store submission and production rollout are separate permissions.
- [ ] Deliver authorized dormant additive schema first and verify completion;
  compatible Web billing/callback handlers next; guarded production Worker only
  after exact main SHA readiness. Record LIVE catalog/Portal/webhook/drain-secret
  and activation prerequisites without changing existing monthly subscriptions.
  Verify old clients still create/join/end and retain paid access.
- [ ] Smoke approved production paths, confirm the accepted Store version is
  published, then activate only the agreed flags and recorded transition UUID/T.
  Do not silently rebuild a different ZIP after Store review; source/package
  changes require renewed verification and review where applicable.
- [ ] Compare equal-length traffic-normalized cost/error periods. Separate delayed
  old-client adoption from regressions; monitor failures and rollback thresholds.

## Evidence limits and next action

Cardless receipts already include accelerated expiry/no-charge, payment decline,
3DS and recovery; do not repeat all historic tests unless final changes touch them.
Crunchyroll cardless legacy check was deferred. Real Netflix ad-plan acceptance is
not established. Staging analytics off is intentional. No production or Store-ready
claim follows from unit tests alone. The immediate implementation is cost reduction;
UI transfer and final combined acceptance follow in their own reviewed block.
