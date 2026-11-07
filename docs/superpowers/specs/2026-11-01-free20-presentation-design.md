# Free20 presentation implementation scope

Source audit prepared November1 for Tasks4/5 of the [staging readiness plan](../plans/2026-11-01-free20-staging-readiness.md). This inventory describes the pre-transition interfaces and planned candidate changes, not deployed acceptance. Line references identify the audited base and may move. The trial-retirement guard is already implemented; coordinate additive pricing-mode changes with that accepted consistency logic. Root retains docs/Graphify ownership.

## Main conclusion

The remaining slice has **two functional presentation blockers** and a larger but mechanical public-copy cleanup. Do not solve it by globally redefining legacy `hosting.canHost` or `getPlanPolicy('free')`. Both are strict backward-compatible contracts and intentionally retain their old meaning. The independent `/api/me/hosting-status` is the correct authority for current Free20 time/access displays.

1. **Pricing cannot recognize Free20.** `components/pricing.tsx:516,569,651,886` uses `paidHostingActive` to decide between legacy 30-minute Free and paid-host-only Free. The currently active commercial policy can have `paidHostingActive=true` and Free20 enabled simultaneously. Thus simply changing 30 to 20 in tiers leaves the Free card overridden as join-only. Conversely treating `paidHostingActive=false` as Free20 invents an offer when the new policy is disabled. `lib/pricing-tiers.ts:49` derives Free minutes from strict legacy `getPlanPolicy('free').dailyHostSeconds=1800`.
2. **Player onboarding directs an eligible Free20 host toward paid/trial offers.** `extension/src/player-onboarding.tsx:67-81` recognizes cached Plus/Pro or legacy `hosting.canHost`, then uses the old trial entry. `overlay-app.tsx:6133` passes only `hostingDisplay.state`, despite already having `accountHostingTime` from the new endpoint at `:820`. With new Free hosting, legacy `canHost=false` is expected. This is a display/next-action mismatch; the create endpoint already has its separate Free20 admission path. NOTE: overlay still reads legacy hosting access; only legacy quota use is fenced by Free20 mode (`:834-842`).

Secondary mismatches:

- **Billing tells eligible Free users to buy rooms again** (`billing-client.tsx:939-955`); its details choose paid-only hosting or hardcoded 30 minutes / five-minute warning (`:976-993`). `EndedTrialSummary` says “Choose Plus or Pro to create rooms again” (`subscription-summary.tsx:371`). Active trial/paid/renewal cards must remain intact.
- **Install welcome treats all Free/manual users as inactive.** `resolveExtensionWelcome` (`lib/extension-welcome.ts:10`) accepts only matching active Stripe subscriptions or trials. `extension-welcome-hero.tsx:33,98` hides installation/platform next steps unless this legacy “active” flag is true. `/extension?welcome=1` therefore sends valid Free20 (and possibly valid manual) users to “Check your subscription.” Ordinary `/extension` is already an open install hub, not a subscription gate.
- **Popup is NOT a create/paywall gate.** `popup-app.tsx:229-234,874` reads legacy hosting access only to show the effective plan badge. No `canHost`, trial CTA or create-room action is present. Keeping that read for the badge is valid; adding full current status there is required only if the release asks popup to show remaining time / hosting availability. Do not replace a reliable plan badge with a network-dependent countdown as an incidental change.
- **Invite/join has no incorrect guest-own-hosting gate.** `app/room/[roomId]/page.tsx` requires auth and room membership/source; `room-invite-view.tsx` posts to the join route. It does not inspect a guest's own host budget. `/join` redirects to login; `/extension/connect` handles identity. No functional edits required there. Optional one-line helper can explain guests do not spend their own budget, using the existing layout.

## Smallest coherent implementation

### A. One public policy discriminator, no per-SEO authority fetch

Preserve the accepted trial-retirement consistency guards while adding mode presentation. Add a small additive offer field such as `hostingModel: 'legacy' | 'paid_hosting' | 'daily_free20'` to the existing pricing offer, derived from the server's exact env gate AND current SQL Free20 policy. An equivalent narrowly named boolean is fine. `paidHostingActive` must preserve its current meaning. This policy availability is public; remaining seconds and canCreateRoom belong only in authenticated hosting-status.

The existing pricing-offer query can select the extra policy field; no need for new polling, global root-layout fetch, or runtime DB reads on every SEO page. Unknown pricing authority keeps prices visible and commercial CTA unavailable/neutral; it must not paint an invented personal remaining budget or create permission.

Exact core files:

- `apps/web/lib/anidachi-auth/pricing-offer.ts` — preserve the accepted trial-retirement changes; project-level offer discriminator only.
- `apps/web/lib/pricing-offer.ts` — additive field/type and fresh offer interpretation.
- `apps/web/lib/pricing-tiers.ts` — separate Free20 display data; do not derive 20 from legacy policy or mutate it.
- `apps/web/components/pricing.tsx` — choose correct Free card/matrix by explicit policy mode; preserve prices, paid checkout confirmation and existing active-trial handling.
- `apps/web/components/pricing-selection.tsx` — neutral loading fallback, currently paints paid-only-hosting claim.
- `apps/web/app/pricing/page.tsx` — Task5 owns this page's metadata, intro and FAQ/JSON-LD; remove the new-trial offer, retain original-term explanation for trials already active. Task4 owns the functional offer/card components above.

Prefer a small exported `FREE20_DAILY_HOST_SECONDS=1200` constant reused by the existing literal schema and display code; this would be an additive change to `packages/protocol/src/hosting-time.ts` plus its existing public export if necessary. It does not require changing any wire shape. Alternatively keep a clearly named presentation constant in web. The legacy 1800 schema remains unchanged. Free people/cameras/media seats stay 4; paid limits/prices remain untouched.

### B. Authenticated current status only where it affects a next step

- `apps/extension/src/player-onboarding.tsx` — give `getPlayerIntroductionOffer` an explicit current-status input. For Free20, ignore legacy trial offers; available daily allowance explains Free hosting, exhausted explains next UTC reset + upgrade, already-in-room is an existing-session state, unknown/error is check/retry. The create API remains authority.
- `apps/extension/src/overlay-app.tsx` — pass existing `accountHostingTime` into onboarding and use its bounded refresh for Free20. No second hook, no capture/layout/hotkey/dimming changes.
- `apps/web/app/account/billing/billing-client.tsx` — current Free20 display branch only; separate remaining/reset/access state from billing overview. One owner-bound, request/departure-fenced read on visible activation, explicit refresh or return, bounded expiry/UTC recovery. Keep active Stripe/trial/manual account access and pending recovery summaries. Apply the website identity boundary below rather than inventing a logical-login key.
- `apps/web/app/account/billing/subscription-summary.tsx` — ended-trial copy must acknowledge Free20 hosting rather than require purchase to create again. Keep existing paid/trial dates and renewal actions.
- `apps/web/lib/extension-welcome.ts` — add verified Free20/manual-ready presentation kind(s), based on current hosting-status, not a URL or plan token claim. Preserve current active-trial original-term branches.
- `apps/web/app/extension/page.tsx` — for the explicit `welcome=1` flow only, read current status with authenticated owner alongside the billing snapshot as needed. Ordinary install stays open. Errors remain check/retry.
- `apps/web/components/extension-welcome-hero.tsx` — show existing install/platform next steps for verified Free20/manual-ready users without claiming paid subscription or trial activation. Retain layout/mobile/device probing and native media behavior.
- A new narrowly scoped web `lib/account-hosting-status-client.ts` and/or hook, if needed by billing. Reuse protocol `acceptAccountHostingStatus`, mandatory owner header, no-store, exact `FREE20_DISABLED` legacy fallback, expiry and observable request/departure fencing. 503/malformed/expired is unknown, never 0/unlimited or paid-only fallback. Welcome reuses a shared authenticated server reader with enabled and whole-read elapsed guards, without self-HTTP or a second client hook.

**Website identity boundary (source-verified November1):** normal website session
reads expose the owner, not a stable logical-login ID. Refresh-family identity is
available only in the existing rotation mutation; do not rotate credentials or
add family-table reads to discover it for presentation. The web display is
bounded by authenticated owner, monotonic observation expiry and local request/
departure generations. Retire it on departure, unmount, expiry and known local
sign-out intent; reread on return or explicit retry. A same-user logout/relogin
in another window while this page stays continuously visible is not immediately
observable through the current contract. The prior account observation may
remain visible only within its original short validity window. Do not call
owner ID, random render nonce or refresh count a logical-session fence. Room
creation remains server-authoritative. This bounded presentation limit avoids
an unrelated website-auth redesign and must be disclosed in tests/review.
Extension onboarding retains its existing complete credential/session fencing.

**Popup minimal choice:** leave `popup-app.tsx` unchanged when it only shows effective plan. If the approved slice includes hosting status in the popup, use the existing `use-account-hosting-status.ts` there with owner + complete session identity and visible enablement, preserve existing plan badge, and render only one compact status within existing layout. No background poll. Update `test/popup-plan-access.test.tsx` only if this choice is made.

**No changes required:** legacy `hosting-access-client.ts`, `use-hosting-access.ts`, `HostingAccessSchema`, `account-entitlements.ts`, guest join/auth/connect routes, history capture leases, camera/mic controllers. They are not the place to grant Free20 globally.

## Shared public copy substitutions

Use existing shared exports instead of rewriting every importing page. Preserve current price constants, paid caps, third-party provider access/trial facts, Async-coming-soon claims and personal-history authority.

In `apps/web/lib/pricing-copy.ts`:

- Add short Free20 summary: “Free includes 20 host minutes per UTC day for up to 4 people, including the host. Plus and Pro include hosting without a daily time limit.”
- Add full metering note: “Time counts while the host and at least one guest are present, including while video is paused. Waiting alone uses no time. The shared account allowance resets at 00:00 UTC with no carryover. Joining a friend's room does not spend your own hosting allowance.”
- Add history note: “Free can read, Resume and delete saved history. Recording and editing progress require each viewer's own Plus or Pro access.”
- Rewrite `PRICING_HOST_MODEL`, free answers, overview/compare snippets, YT/CR snippets, table cells, `PRICING_FIRST_CHECKLIST_FAQ`, `PRICING_GROUP_ONBOARDING`, long-distance snippet, guide mention and `pricingWatchPageFaqAnswer`. They currently imply paid-only hosting.
- Update `PRICING_ROOM_SIZE_RANGE` to include Free 4 as well as Plus/Pro 6/15, without changing existing paid limits.
- Remove new-trial sales promises from the public note. Prefer renaming `PRICING_TRIAL_NOTE` to a clear existing-trial note only where that explanation is needed: “New trials are no longer offered. Existing trials keep their original end date and renewal terms.” Do not append a long historic-trial paragraph to every SEO answer.
- Free20 room copy should say four **media seats** and four simultaneous cameras; a granted seat permits camera/mic subject to explicit local device action. Do not promise auto-start/camera changes or confuse seats with participants.

Other shared sources to update (all confirmed current exposed copy):

| Exact file | Current evidence / minimal substitution |
| --- | --- |
| `apps/web/lib/home-faq.ts` | :18,23,38,43 — host-only-paid claim; reuse short host/history constants and mention daily reset in free answer. |
| `apps/web/lib/pseo-new-guides.tsx` | :243,264,323,360,387,408,490,548,587,605,628,637,649,658,663,696,820,950 — centrally authored intros/HowTo/FAQ for multiple public routes. Replace host predicates; preserve personal history sentences. |
| `apps/web/lib/watch-page-rich-content.ts` | :205,318 — programmatic watch-page HowTo/FAQ; use Free20-aware creation text. Existing history sentences :216,371 stay valid. |
| `apps/web/lib/extension-install-faq.ts` | :10 — install setup currently says create only with Plus/Pro/trial. |
| `apps/web/lib/extension-using-guide.ts` | :26 — create step reused by install and account Help. |
| `apps/web/components/primary-checkout-cta.tsx` | :19,25,28,31,34,37 — install CTA bodies; reuse concise host summary, keep install action. |
| `apps/web/components/how-it-works.tsx` | :27 — paid-only-hosting step. |
| `apps/web/components/main-app-features.tsx` | :29-35 — “One subscription” / “You choose Plus or Pro” implies all hosting needs purchase. Keep existing paid room-size demo; qualify it as larger paid rooms and add Free20 sentence, or add Free option only if separately desired. No layout rewrite needed. |
| `apps/web/components/json-ld.tsx` | :64,76,85,95 — global SoftwareApplication copy, explicit Free-cannot-create and trial sales links. Must match visible offer. |
| `apps/web/app/account/help/page.tsx` | :29 — paid-only-hosting instruction. |
| `apps/web/app/about/page.tsx` | :44 — omit Free hosts today. |
| `apps/web/app/terms/page.tsx` | :53-59 and :110-124 — service description and new-trial offer. Update product terms narrowly; retain original dates/renewal handling for existing trials. |

## Public page-local cleanup scope

Shared exports cover many consumers, but **changing only constants is insufficient**: public pages contain hardcoded metadata, HowTo/FAQ answers, table cells and prose around those imports. Appendix below gives exact file anchors. Replace only AniDachi's hosting/trial clauses with the shared constants; a page can contain both a stale AniDachi statement and valid third-party terms.

Especially important:

- `netflix-watch-party/page.tsx:325` has a five-person example that necessarily needs Plus under Free's four-person cap. Preserve that conclusion as a size-based example while removing new-trial sales. Do not flatten every “needs Plus” sentence into free hosting.
- `guides/crunchyroll-watch-party-not-working/page.tsx:139` documents a real legacy runtime error. Keep the legacy diagnostic qualified; add Free20 exhausted/reset/update-required guidance and Free4 capacity rather than silently deleting historical behavior needed by still-open legacy rooms.
- `guides/does-everyone-need-crunchyroll-premium-for-watch-party/page.tsx` contains genuine Crunchyroll trial facts; only AniDachi paragraph :321 needs this release's change.
- `guides/is-teleparty-free/page.tsx` contains Teleparty Premium prices, 7-day trial and guest-camera facts. Do not touch those; the AniDachi section and shared snippets can change.
- Keep privacy's existing-trial abuse protections/retention disclosure and active-trial history eligibility; it does not make a new sales offer. Keep checkout/success active/in-flight trial recovery, billing original renewal/expiry statements, and `/dev/*` historical preview fixtures.

## Verification for the proposed slice

No tests were executed for this read-only audit.

Extend meaningful existing suites rather than snapshot every text literal:

- `apps/web/lib/pricing-tiers.test.ts` — separate legacy and Free20 public matrix, 20 minutes UTC / 4 people / 4 cameras / 4 media seats, Free read/Resume/delete; prices/paid limits unchanged. Existing test currently equates every tier to the legacy policy and must not be weakened into a false 20-minute legacy invariant.
- `apps/web/lib/pricing-client.test.ts` + pricing-offer owner tests — explicit Free20 policy mode for guest/new Free/former trial; no trial CTA when retired; unknown/expired has no invented quota or paid-only-hosting message; existing paid/active-trial management stays intact. Confirm legacy-disabled mode still works.
- `apps/extension/test/player-onboarding.test.tsx` — current Free20 available, zero, active-room, failed/expired/owner-switch, existing paid/trial/manual and legacy modes. Verify no unwanted checkout call and no trial link for Free20.
- `apps/web/lib/billing-presentation.test.ts` and `billing-client.test.ts` — Free/former-trial current status and outage; original active-trial dates/renewal and billing recovery preserved.
- `apps/web/lib/extension-welcome.test.ts` and `extension-welcome-ui.test.ts` — new Free20/manual-ready states, exhausted still installable, unknown cannot imply activation, correct mobile install path, original trial terms preserved.
- Existing `room-invite-page.test.ts`, `account-hosting-status-client`/hook tests provide regression coverage; add tests only if their behavior actually changes. If adding a web reader, exercise owner/session mismatch, expired responses, exact 404 legacy fallback, 503 and bounded refresh/no polling.
- One focused public copy contract/source sweep across visible text + metadata/JSON-LD must reject AniDachi's retired “Free cannot create”, “host needs paid”, 30-minute Free and new 3-day sales promises while allowing true third-party trials and existing-trial terms. Do not write brittle tests for every sentence.

Required execution after implementation: web check/test, extension check/test, staging artifact build + validate, `pnpm dev:check`; protocol check/test only if shared constant/export is added. Browser inspection on the staging candidate for main/pricing/billing/install welcome and actual loaded extension popup/onboarding; account switch/logout/error/UTC reset and paid/trial/manual cases. No claim of visual acceptance from source tests. No media/controller/native-device changes are needed.

Docs/Graphify: update active Free20 transition/current state after implementation; semantic refresh through approved Graphify adapter for intentional doc changes. Keep staging password/noindex, no main or production promotion. Unknown current authority must never show successful zero/unlimited or revive a retired trial.

## Appendix: exact public page anchors

These are sentence-local cleanup anchors, not authorization for page redesign or third-party rewrites. Paths are repo-relative; all are under the checkout stated above. Core paths already listed above may repeat here to keep the public inventory self-contained. Multi-line text requires inspecting adjacent lines; line lists are representative starting anchors, not a full AST edit specification.

```text
apps/web/app/about/page.tsx:44
apps/web/app/account/help/page.tsx:29
apps/web/app/anime-watch-party-toolkit/page.tsx:36
apps/web/app/anime-watch-party/page.tsx:19,41,115,126,148
apps/web/app/best-anime-for-long-distance-relationships/page.tsx:51,343
apps/web/app/best-apps-watch-anime-together-long-distance/page.tsx:192
apps/web/app/compare/anidachi-vs-anime-watch-parties-extension/page.tsx:127
apps/web/app/compare/anidachi-vs-crunchyroll-party/page.tsx:45,189
apps/web/app/compare/anidachi-vs-kosmi/page.tsx:55,235
apps/web/app/compare/anidachi-vs-netflix-watch-party/page.tsx:67
apps/web/app/compare/anidachi-vs-rave/page.tsx:63
apps/web/app/compare/anidachi-vs-syncup/page.tsx:48,228
apps/web/app/compare/anidachi-vs-teleparty/page.tsx:264
apps/web/app/compare/crunchyroll-party-vs-teleparty-for-anime/page.tsx:40,50,203
apps/web/app/discord-watch-party/page.tsx:368,369
apps/web/app/extension/page.tsx:117
apps/web/app/glossary/anime-marathon/page.tsx:59,185
apps/web/app/glossary/anime-simulcast/page.tsx:66
apps/web/app/glossary/crunchyroll-mega-fan/page.tsx:85
apps/web/app/glossary/watchroom/page.tsx:34,92
apps/web/app/guides/best-anime-to-watch-on-crunchyroll-with-friends/page.tsx:42
apps/web/app/guides/best-anime-to-watch-with-friends/page.tsx:207
apps/web/app/guides/best-apps-to-watch-youtube-together/page.tsx:58
apps/web/app/guides/best-teleparty-alternatives-for-anime/page.tsx:137
apps/web/app/guides/can-you-screen-share-crunchyroll-on-discord/page.tsx:304
apps/web/app/guides/crunchyroll-party-alternative/page.tsx:141
apps/web/app/guides/crunchyroll-watch-party-chrome-extension/page.tsx:53,78,254,255,366
apps/web/app/guides/crunchyroll-watch-party-free/page.tsx:28,50,59,68,116,117,141,142
apps/web/app/guides/crunchyroll-watch-party-not-working/page.tsx:52,139,141
apps/web/app/guides/discord-screen-share-not-working/page.tsx:145
apps/web/app/guides/discord-watch-together/page.tsx:312
apps/web/app/guides/does-crunchyroll-have-watch-party/page.tsx:63,68,109,272
apps/web/app/guides/does-everyone-need-crunchyroll-premium-for-watch-party/page.tsx:321
apps/web/app/guides/does-netflix-have-a-watch-party/page.tsx:158
apps/web/app/guides/does-teleparty-work-with-crunchyroll/page.tsx:60,190
apps/web/app/guides/does-youtube-have-watch-party/page.tsx:58
apps/web/app/guides/how-to-create-an-anime-watch-party/page.tsx:77
apps/web/app/guides/how-to-host-a-crunchyroll-watch-party/page.tsx:23,35,47,77,107,200,201
apps/web/app/guides/how-to-host-a-youtube-watch-party/page.tsx:22,34,46,76
apps/web/app/guides/how-to-screen-share-netflix-on-discord/page.tsx:60,114,325,341
apps/web/app/guides/how-to-sync-crunchyroll-with-friends/page.tsx:73
apps/web/app/guides/how-to-sync-youtube-with-friends/page.tsx:74
apps/web/app/guides/how-to-watch-anime-for-free-with-friends/page.tsx:63,73,105,106,183,296,341
apps/web/app/guides/how-to-watch-anime-long-distance/page.tsx:84
apps/web/app/guides/how-to-watch-anime-together-without-screen-share/page.tsx:46
apps/web/app/guides/how-to-watch-anime-with-a-group/page.tsx:73,201
apps/web/app/guides/how-to-watch-anime-with-friends-in-different-time-zones/page.tsx:80,134
apps/web/app/guides/how-to-watch-anime-with-friends-online/page.tsx:77,132
apps/web/app/guides/how-to-watch-anime-without-spoilers/page.tsx:73
apps/web/app/guides/how-to-watch-crunchyroll-together-without-screen-share/page.tsx:61,104
apps/web/app/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing/page.tsx:105,321
apps/web/app/guides/how-to-watch-crunchyroll-with-friends/page.tsx:48,102
apps/web/app/guides/how-to-watch-netflix-with-friends/page.tsx:39,92,148,208,242
apps/web/app/guides/how-to-watch-youtube-together-without-screen-share/page.tsx:73
apps/web/app/guides/is-crunchyroll-party-worth-it/page.tsx:169
apps/web/app/guides/is-teleparty-free/page.tsx:371
apps/web/app/guides/long-distance-date-night-ideas/page.tsx:73,158
apps/web/app/guides/netflix-group-watch/page.tsx:131
apps/web/app/guides/netflix-movie-night/page.tsx:59
apps/web/app/guides/online-date-ideas/page.tsx:74,162
apps/web/app/guides/rave-alternatives-for-anime/page.tsx:132
apps/web/app/guides/romance-anime-dubbed/page.tsx:147
apps/web/app/guides/subbed-anime/page.tsx:147
apps/web/app/guides/switch-from-discord-screen-share/page.tsx:47,198
apps/web/app/guides/teleparty-not-working-crunchyroll/page.tsx:93
apps/web/app/guides/watch-movies-together-online/page.tsx:105,119,184
apps/web/app/guides/watch-netflix-together/page.tsx:48,157,256
apps/web/app/guides/watch2gether-alternatives-for-youtube/page.tsx:52
apps/web/app/guides/youtube-group-watch/page.tsx:72
apps/web/app/guides/youtube-watch-party-free/page.tsx:28,49,58,67,115,116,135,136
apps/web/app/long-distance-anime-date-night-ideas/page.tsx:36
apps/web/app/netflix-party/page.tsx:91,245,313
apps/web/app/netflix-watch-party/page.tsx:66,83,113,193,232,325,405
apps/web/app/pricing/page.tsx:13,38,46,51,60
apps/web/app/resources/group-watch-onboarding/page.tsx:40
apps/web/app/terms/page.tsx:55,110
apps/web/app/timezone-friendly-anime-watch-parties/page.tsx:79
apps/web/app/tools/crunchyroll-dub-schedule/page.tsx:184
apps/web/app/tools/crunchyroll-schedule/page.tsx:74,179
apps/web/app/tools/random-anime-generator/page.tsx:64
apps/web/app/virtual-movie-night/page.tsx:133
apps/web/app/watch-action-anime-with-friends/page.tsx:178
apps/web/app/watch-anime-long-distance-boyfriend-girlfriend/page.tsx:33,80,132
apps/web/app/watch-anime-together/page.tsx:67,72,183,534
apps/web/app/watch-comedy-anime-with-friends/page.tsx:176
apps/web/app/watch-crunchyroll-together-long-distance/page.tsx:34,85
apps/web/app/watch-crunchyroll-together/page.tsx:139,183,244,331
apps/web/app/watch-fantasy-anime-with-friends/page.tsx:38,188
apps/web/app/watch-horror-anime-with-friends/page.tsx:38,192
apps/web/app/watch-isekai-anime-with-friends/page.tsx:37,190
apps/web/app/watch-mecha-anime-with-friends/page.tsx:38,184
apps/web/app/watch-movies-together-long-distance/page.tsx:212
apps/web/app/watch-mystery-anime-with-friends/page.tsx:109
apps/web/app/watch-netflix-together-long-distance/page.tsx:31,168,190
apps/web/app/watch-party-app/page.tsx:127
apps/web/app/watch-psychological-anime-with-friends/page.tsx:38,203
apps/web/app/watch-romance-anime-with-friends/page.tsx:178
apps/web/app/watch-sci-fi-anime-with-friends/page.tsx:178
apps/web/app/watch-shonen-anime-with-friends/page.tsx:152
apps/web/app/watch-shoujo-anime-with-friends/page.tsx:170
apps/web/app/watch-slice-of-life-anime-with-friends/page.tsx:38,203
apps/web/app/watch-sports-anime-with-friends/page.tsx:167
apps/web/app/watch-supernatural-anime-with-friends/page.tsx:100,168
apps/web/app/watch-youtube-together-long-distance/page.tsx:44,92
apps/web/app/watch-youtube-together/page.tsx:52,70,153,263,427
```

Inventory: 105 public page files with direct AniDachi-host/trial copy candidates, plus the shared/core sources above. This breadth is copy duplication, not a requirement to change pricing, routes, layouts or media behavior. Raw bounded search evidence: `/private/tmp/free20-copy-search.txt`.
