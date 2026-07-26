## Background and Motivation

**(Active — 2026-07-26)** SEO agent critical fixes (YT + CR parity): agent playbook CR conversion stack + product-truth / mid-CTA / `/pricing` install alignment. Plan: `.cursor/plans/seo_agent_critical_fixes_a6487aa6.plan.md`.

~~YouTube SEO batch 2… conversion polish~~ (prior; completed — awaiting Planner confirm on polish QA).

## High-level Task Breakdown

### SEO agent critical fixes (Planner → Executor 2026-07-26)

1. Agent CR parity + Soft-pedal/voice/global CTA/mid-CTA/tag rules + YT map polish + `PRICING_CR_PRICING_SNIPPET`.
2. Fix AniDachi Crunchyroll-only claims on compare + P0 CR FAQs.
3. CR how-to HowTo+CTAs; Teleparty/Discord SS mid CTAs; narrow related tags.
4. Pseo CR breadcrumbs under CR pillar; enrich `crunchyroll-watch-party-free`.
5. Align CR pillar + key how-tos install steps to `/pricing` until CWS live.
   - Success: check/build pass; no “only for Crunchyroll” FAQs; CR how-to matches YT density.

## Project Status Board

### SEO agent critical fixes (Executor — awaiting Planner confirm)

- [x] Agent CR parity + language/CTA/tag rules
- [x] Truth: compare + P0 CR FAQs (YouTube where product-true)
- [x] CR conversion pages (how-to, Teleparty alts, Discord SS)
- [x] Pseo CR crumbs + free page enrichment
- [x] CWS → `/pricing` on CR pillar + key how-tos

### YouTube conversion polish (Executor — awaiting Planner confirm)

- [x] YouTube pricing helpers (`pricing-copy.ts`)
- [x] Enrich P0 pages + pillar Start-here list
- [x] P1 + P2 light pass (+ 3 older YT guides → `*_YOUTUBE_*` free FAQ)
- [x] SEO agent playbook update
- [x] Web check + build ✅ (2026-07-26); check re-run after FAQ swaps

### Completed (YouTube SEO batch 2 — 2026-07-26)

- [x] 10 KP-validated YouTube guide pages
- [x] guide-links + pillar wiring
- [x] web check + build

### Completed (prior watch-page batches — historical)

### Next batch (10 new watch pages)

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Add hub/listicle backlinks (`watch-anime-together`, `best-anime-to-watch-with-friends`) + bump `dateModified`
- [x] Run `npm run build`

## Key Challenges and Analysis

- Batch 2 pages are KP-valid but thin on conversion (meta promotes competitors equally; FAQ repeats “Is AniDachi free?”; agent jargon in FAQs; mid CTA underused).
- Head-term money sits on `/watch-youtube-together` (1k/720) — enrich pillar over shipping more 10/mo clones.
- SEO agent lacked KP gate, cannibalization map, and YT-specific conversion checklist → future batches risk more thin spokes.

## Executor's Feedback or Assistance Requests

- **Executor (SEO agent critical fixes):** All plan todos done. Check/build pending/complete — please confirm as Planner.
- **Manual QA checklist (agent critical fixes):**
  1. `/guides/how-to-watch-crunchyroll-with-friends` — HowToJsonLd, fold + mid CTA, `/pricing` install.
  2. `/guides/crunchyroll-watch-party-free` — conversion-class twin of YT free; CR crumbs.
  3. Compare FAQs (syncplay, netflix, rave, amazon, metastream) — not “Crunchyroll only.”
  4. Pseo CR guides (e.g. group-watch) — crumbs under Watch Crunchyroll Together.
  5. CR pillar HowTo — install via `/pricing`, not Chrome Web Store.
- **Executor (conversion polish):** Steps 1–5 done. Check + build passed. Please confirm as Planner when manual QA looks good.
- **Manual QA checklist (conversion polish):**
  1. `/watch-youtube-together` — “Start here” list + mid CTA → `/pricing`; FAQ uses YouTube-safe free answer.
  2. `/guides/youtube-watch-party-free` + Teleparty/Discord SS YT guides — CTR metas, mid CTA, no agent jargon.
  3. Rave/Kast/does-youtube + host/sync/group/without-SS — pricing snippets (not full free FAQ spam); no Crunchyroll-only FAQ text.
  4. Spot-check older YT guides (`best-apps…`, `how-to-watch-youtube-with-friends`, chrome-extension) — free FAQ mentions YouTube.
  5. After deploy: SERP title/description + pricing conversion by landing path.

### Additional batch (10 more watch pages — 2026-05-12)

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Add hub/listicle backlinks + bump `dateModified` → `2026-05-12`
- [x] Run `npm run build` ✅ (2026-05-12)

### Additional batch (10 more watch pages — 2026-05-14)

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Add hub/listicle backlinks + bump `dateModified` → `2026-05-14`
- [x] Run `npm run build` ✅ (2026-05-14)

### Additional batch (10 more watch pages — 2026-05-15)

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Add hub/listicle backlinks + bump `dateModified` → `2026-05-15` (list **86+**)
- [x] Run `npm run build` ✅ (2026-05-15)

### SEO batch — 10 high-leverage pages (2026-06-04)

**5 new watch pages** (high-traffic titles not previously in `animeList`):
- `sailor-moon` — MAL 530 — iconic magical-girl classic, nostalgic marathons
- `weathering-with-you` — MAL 38826 — Shinkai film, debate-worthy ending
- `suzume` — MAL 50265 — Shinkai film, grief + road-trip
- `my-neighbor-totoro` — MAL 523 — Ghibli classic, universal beginner entry
- `pokemon` — MAL 527 — most recognized anime franchise, nostalgic marathon

**3 new listicle guides** (new keyword buckets):
- `app/guides/best-shonen-anime-to-watch-with-friends/page.tsx` — covers action, sports, long-run shonen
- `app/guides/best-classic-anime-to-watch-with-friends/page.tsx` — 90s–2000s TV series + Ghibli/Shinkai classics
- `app/guides/best-anime-to-binge-with-friends-this-weekend/page.tsx` — complete/arc-complete series by length

**2 new glossary entries** (topical authority + AEO):
- `app/glossary/anime-filler/page.tsx` — definition, filler percentages per series, skip guide
- `app/glossary/ova-meaning/page.tsx` — OVA vs TV, OVA types, watch order for groups

**Hub/listicle wiring:**
- `best-anime-to-watch-with-friends` updated to **115+**, `dateModified` → `2026-06-04`
- `watch-anime-together` `dateModified` → `2026-06-04`
- `best-anime-to-watch-for-beginners` +1 entry (My Neighbor Totoro), **30**, `dateModified` → `2026-06-04`

**Stripe fix (bonus):** Moved module-level `new Stripe(...)` into lazy `getStripe()` helpers in 3 API routes to fix `npm run build` failure when `STRIPE_SECRET_KEY` is absent locally.

- [x] Build ✅ — 176 watch pages generated (2026-06-04)

### Additional batch (10 more watch pages — 2026-05-19)

New slugs (high-traffic + Crunchyroll group-watch intent):

- `oregairu` (My Teen Romantic Comedy SNAFU) — MAL 14813
- `ouran-high-school-host-club` — MAL 179
- `the-melancholy-of-haruhi-suzumiya` — MAL 904
- `another` — MAL 11111
- `charlotte` — MAL 28999
- `nisekoi` — MAL 20785
- `akira` — MAL 47 (Movie)
- `highschool-dxd` — MAL 11617
- `cardcaptor-sakura` — MAL 232
- `date-a-live` — MAL 15583

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Jikan cache updated: 10 new slugs cached, 0 failures
- [x] Hub backlinks: `watch-anime-together` `dateModified` → `2026-05-19`; `best-anime-to-watch-with-friends` count → **107+**, `dateModified` → `2026-05-19`
- [x] Run `npm run build` ✅ (2026-05-19) — 160 titles, 227 static pages generated

## Current Status / Progress Tracking

- Added 5 new watch slugs to `animeList` and wired hub/listicle backlinks:
  - `odd-taxi`
  - `k-on`
  - `a-silent-voice`
  - `your-name`
  - `slam-dunk`
- Added MAL ID mappings for the 5 new slugs in `lib/anime-mal-ids.ts` so watch pages can fetch poster/score via Jikan.
- Build check: `npm run build` ✅
- Next: manual spot-check a couple pages in the browser (e.g. `/watch/odd-taxi-with-friends`).

- Added 10 new watch slugs to `animeList` and wired hub/listicle backlinks:
  - `kuroko-no-basket`
  - `hajime-no-ippo`
  - `kakegurui`
  - `nichijou`
  - `the-eminence-in-shadow`
  - `rascal-does-not-dream-of-bunny-girl-senpai`
  - `spirited-away`
  - `howls-moving-castle`
  - `princess-mononoke`
  - `perfect-blue`
- Added MAL ID mappings for the 10 new slugs in `lib/anime-mal-ids.ts`.
- Hub/listicle updates:
  - `app/watch-anime-together/page.tsx` (`dateModified` → `2026-05-09`)
  - `app/guides/best-anime-to-watch-with-friends/page.tsx` (`dateModified` → `2026-05-09`, updated count to `56+`)
- Build check: `npm run build` ✅
- Spot-check: `GET /watch/nichijou-with-friends` and `GET /watch/princess-mononoke-with-friends` returned `200` on local prod server; canonical emitted as `https://anidachi.app/watch/nichijou-with-friends`.

- **Additional 10 (2026-05-12):** new slugs:
  - `initial-d`
  - `soul-eater`
  - `bungo-stray-dogs`
  - `fate-zero`
  - `hellsing-ultimate`
  - `yuri-on-ice`
  - `land-of-the-lustrous`
  - `re-creators`
  - `kabaneri-of-the-iron-fortress`
  - `barakamon`
- Hub/listicle: `watch-anime-together` + `best-anime-to-watch-with-friends` list bumped to **66+** picks; `dateModified` set to `2026-05-12`.
- Build: `npm run build` ✅; prerender output includes `/watch/soul-eater-with-friends` verified via `.next` prerender manifest (local `curl` to dev server was `404` when dev not running — use `npm start` or dev server for live HTTP checks).

- **Additional 10 (2026-05-14):** new slugs:
  - `goblin-slayer`
  - `rising-of-the-shield-hero`
  - `clannad`
  - `serial-experiments-lain` (also resolves `neon-genesis-evangelion` → `related` reference that was previously dangling)
  - `ergo-proxy`
  - `black-lagoon`
  - `durarara`
  - `baccano`
  - `log-horizon`
  - `paranoia-agent`
- Hub/listicle: list bumped to **76+** picks; `dateModified` → `2026-05-14` on hub + guide.

- **Additional 10 (2026-05-15):** `danmachi`, `anohana`, `plastic-memories`, `planetes`, `claymore`, `quintessential-quintuplets`, `keep-your-hands-off-eizouken`, `kingdom`, `spice-and-wolf`, `the-devil-is-a-part-timer` — also resolves dangling `related` refs (claymore, quintuplets, eizouken, kingdom). List **86+**; `dateModified` → `2026-05-15`. Build ✅.

### Post-payment success page (Discord contact)

- Added a Discord contact block to the Stripe Checkout success page (`/success`) so subscribers can reach out via Discord in addition to email.
- Removed the bottom action buttons from `/success`.
- Added an optional Discord username field on `/success` that saves to Stripe Customer metadata (key: `anidachi_discord_contact`) using the `session_id` from the success URL.
- Build check: `npm run build` ✅

## GSC SEO Optimisation Batch (2026-06-08)

### What was done
Live GSC data (Mar 9 – Jun 5 2026) pulled via Composio. Site had ~7,300 impressions / ~370 clicks (5% blended CTR). Key findings and all changes below.

**Technical fix:**
- `apps/web/next.config.ts` — added 301 redirect `anidachi.app/* → www.anidachi.app/*` to consolidate the www/non-www PageRank split (was costing ~33% of homepage authority).

**Content / SEO changes (`dateModified` bumped to 2026-06-08 on all):**

| File | Changes |
|------|---------|
| `app/watch-anime-together/page.tsx` | Title → includes "anime watch party"; new H2 "Host an Anime Watch Party Online"; new H2 "Watch Anime Together Long Distance" (59 impressions trapped at pos 9, 0 clicks); 4 new FAQ entries |
| `app/watch-crunchyroll-together/page.tsx` | Title rewrite; 4 new FAQ entries: "Does Crunchyroll have watch party?", Teleparty, group watch; new "Crunchyroll Group Watch Tips" H2 section |
| `app/guides/how-to-watch-crunchyroll-with-friends/page.tsx` | Title → "Crunchyroll Watch Party Guide (2026)"; H1 rewrite; 5 new FAQ entries for all "does crunchyroll have…" / "can you…" variants |
| `app/glossary/ova-meaning/page.tsx` | Title → "What Does OVA Mean in Anime?" (377 imp, 0 clicks hidden gem); new "OVA Full Form" section; "Famous OVAs by Series" section (Haikyuu, AoT, Demon Slayer examples); 5 new FAQ entries |
| `app/guides/how-to-watch-anime-with-friends-on-discord/page.tsx` | Title → "How to Stream Anime on Discord & Run an Anime Watch Party"; new "Discord Anime Watch Party" section; 2 new FAQ entries |
| `app/compare/anidachi-vs-kast/page.tsx` | Title → "Best Kast Alternative for Crunchyroll Anime" |
| `app/compare/anidachi-vs-scener/page.tsx` | Title → "Best Scener Alternative for Anime Watch Parties" |
| `app/compare/anidachi-vs-syncplay/page.tsx` | Title → "Best Syncplay Alternative for Crunchyroll Anime" |
| `app/compare/anidachi-vs-discord-screen-share/page.tsx` | Title → "Crunchyroll vs Discord Screen Share" |

**Build:** `npm run build` ✅ (2026-06-08)

**Remaining (Tier 3, not done):**
- `/guides/best-anime-to-watch-with-friends` — ranks pos 18 for own keyword, needs content expansion

## Executor's Feedback or Assistance Requests

- **Planner / user:** Please manually spot-check at least 2 of the new watch URLs (e.g. `/watch/soul-eater-with-friends`, `/watch/initial-d-with-friends`) in the browser with `npm run dev` or `npm start` running; confirm `200`, layout, and canonical. Executor validated via `npm run build` + prerender manifest.

- Please manually load `/success` in your browser and confirm:
  - The “Contact via Discord” box is visible.
  - “Copy username” copies `.profun`.
  - “Open Discord profile” opens your Discord profile in a new tab/window.
  - The two buttons shown previously (Explore AniDachi / Contact Us) are gone.
  - The Discord username field appears; when arriving from Stripe (has `?session_id=...`), clicking Save shows “Saved”.

### Proposed next 10 `/watch/[slug]-with-friends` pages

Goal: expand high-intent “watch {anime} with friends” landers for titles with strong brand demand + group-watch energy, optimized to convert into the paid subscription checkout (primary CTA remains `/#pricing` on watch pages per existing template).

1. `kuroko-no-basket`
2. `hajime-no-ippo`
3. `kakegurui`
4. `nichijou`
5. `the-eminence-in-shadow`
6. `rascal-does-not-dream-of-bunny-girl-senpai`
7. `spirited-away`
8. `howls-moving-castle`
9. `princess-mononoke`
10. `perfect-blue`

### Additional batch slugs (implemented 2026-05-12)

1. `initial-d`
2. `soul-eater`
3. `bungo-stray-dogs`
4. `fate-zero`
5. `hellsing-ultimate`
6. `yuri-on-ice`
7. `land-of-the-lustrous`
8. `re-creators`
9. `kabaneri-of-the-iron-fortress`
10. `barakamon`

### Additional batch slugs (implemented 2026-05-14)

1. `goblin-slayer`
2. `rising-of-the-shield-hero`
3. `clannad`
4. `serial-experiments-lain`
5. `ergo-proxy`
6. `black-lagoon`
7. `durarara`
8. `baccano`
9. `log-horizon`
10. `paranoia-agent`

## Lessons

- If terminal output indicates vulnerabilities, run `npm audit` before continuing.

---

## Sitewide CTA → Plan-Picker Survey (Planner Notes)

### What you asked for

Analyze all CTAs across the site that currently send users to “plans/pricing” (primarily `/#pricing`) and make them **open the same plan-picking survey modal** that exists in the homepage hero (“Help me pick a plan”), instead of navigating to pricing.

### What exists today (relevant CTA surfaces found)

- **Hero survey modal** (already correct behavior): `components/hero.tsx`
  - Primary hero CTA opens the survey modal (no navigation).
- **Sitewide CTAs that currently navigate to pricing** (need to change):
  - Nav “Pricing” link: `components/nav-pricing-link.tsx` → `href="/#pricing"`
  - Nav “Pick a Plan” button: `components/nav-pricing-button.tsx` → `href="/#pricing"`
  - Home features bottom CTA: `components/main-app-features.tsx` → `href="#pricing"`
  - Footer “Pricing” link: `components/footer.tsx` → `href="/#pricing"`
  - SEO page checkout CTA blocks: `components/primary-checkout-cta.tsx` → `href="/#pricing"`
    - Rendered on SEO templates via `components/seo-page-layout.tsx` (above-fold + bottom).
- **Pricing section** (`components/pricing.tsx`) does **not** navigate; it starts Stripe checkout directly. Not part of the “redirect to plans” issue.

### Key challenges and analysis

- The survey modal currently lives _inside_ `components/hero.tsx`, so other pages/components cannot open it without:
  - prop-drilling an `openSurvey()` function everywhere, or
  - a global event bus, or
  - a dedicated React context/provider mounted in `app/layout.tsx`.
- Because the user selected **sitewide**, we need the survey modal to be available on guides/compare/watch pages too (not just `/`).
- Some CTAs are in server components (`components/footer.tsx`) today, so adding `onClick` logic requires either:
  - switching `Footer` to a client component, or
  - extracting the “Pricing” link into a small client component.

### High-level Task Breakdown (implementation plan)

1. **Extract the hero survey modal into a reusable sitewide component**
   - Create `components/plan-survey/plan-survey-modal.tsx` (client) containing:
     - modal UI + steps logic (currently in `components/hero.tsx`)
     - checkout start logic (`fetch("/api/create-checkout-session")` and redirect)
     - analytics events (`survey_opened`, `survey_step_viewed`, `survey_completed`, `survey_closed`)
   - Success criteria:
     - Modal renders identically to current hero survey.
     - Modal can open on any route (not just `/`).

2. **Add a sitewide provider/hook to open the modal from any CTA**
   - Create `components/plan-survey/plan-survey-provider.tsx` (client) that:
     - holds `survey` state + localStorage persistence (reuse `LS_KEY` + validation from `components/home/home-client.tsx`)
     - computes `recommendedTier` using `recommendedTierForSurvey(survey)` from `lib/home-survey.ts`
     - exposes `openSurvey({ placement, cta_variant })` and `closeSurvey()`
   - Mount provider once in `app/layout.tsx` so it’s globally available.
   - Success criteria:
     - Any component can call `openSurvey(...)` and the modal opens.
     - Survey answers persist across navigations (and refresh) the same way they do on `/`.

3. **Wire the homepage hero CTA to the provider (no duplicate modal)**
   - Update `components/hero.tsx`:
     - remove internal `showSurvey` state + modal rendering
     - replace “Help me pick a plan” `onClick` with `openSurvey({ placement: "hero", cta_variant: "hero_survey_recommended_plan" })`
   - Success criteria:
     - Hero CTA still opens the survey with step = 1.
     - No duplicate modals or state divergence.

4. **Convert all pricing-navigation CTAs to open the survey instead**
   - Update these CTA components to prevent navigation and open the survey modal:
     - `components/nav-pricing-link.tsx`
     - `components/nav-pricing-button.tsx`
     - `components/main-app-features.tsx` (bottom CTA currently `href="#pricing"`)
     - `components/primary-checkout-cta.tsx` (sitewide SEO CTA blocks)
     - `components/footer.tsx` (Pricing link)
       - Preferred approach: extract a tiny client component `components/footer-pricing-cta.tsx` and use it in `Footer` so the rest of the footer can stay server-rendered if desired.
   - Keep existing `trackConversion("cta_click", ...)` payloads, but change the action to “open survey”.
   - Success criteria:
     - Clicking any of these no longer changes the URL / scrolls to `#pricing`; it opens the survey modal instead.
     - Existing `cta_click` analytics still fire with the same `cta_variant` and `placement` values.

5. **Build validation**
   - Run `npm run build`.
   - Success criteria: build passes.

### Manual test checklist (post-implementation)

- From `/`:
  - Nav “Pricing” and nav “Pick a Plan” open the survey.
  - “Start paid plan” in features section opens the survey.
  - Footer “Pricing” opens the survey.
  - Hero “Help me pick a plan” opens the same survey (no regression).
- From a guide page (any `/guides/*`):
  - `PrimaryCheckoutCta` opens the survey.
  - Survey checkout still redirects to Stripe successfully.

---

## Homepage CRO Rework (Execution Summary)

### Project Status Board

- [x] Milestone 1: Home client orchestrator + survey state wiring
- [x] Milestone 2: Hero mini-survey UI + analytics events
- [x] Milestone 3: Pricing recommendation UI + message-matched CTA labels
- [x] Milestone 4: Proof proxies section + trust badges near pricing CTAs
- [x] Milestone 5: FAQ defaults expanded (top 3)
- [x] Milestone 6: `npm run build` passes

### Current Status / Progress Tracking

- Homepage now uses a client orchestrator (`components/home/home-client.tsx`) that persists survey state in localStorage and scrolls to pricing on CTA.
- Hero mini-survey is live (`components/hero.tsx`) and fires `survey_answered` (via `trackEvent`) plus a `cta_click` conversion event with recommendation context.
- Pricing supports recommendation props and highlights the recommended tier (`components/pricing.tsx`). Trust indicators are shown adjacent to payment CTAs.
- “See It In Action” section now appears directly under the hero (`components/home/home-client.tsx` → `ChromeExtensionDemo` moved up).
- Removed the 3-card trust strip (“Secure checkout / No account sharing / Founding member perks”) from the homepage (`components/home/home-client.tsx`).
- FAQ supports default-open items; homepage opens 3 key questions by default (`components/faq-section.tsx`).
- Build check: `npm run build` ✅ (2026-05-11)

### Executor's Feedback or Assistance Requests

- Please refresh the homepage (`/`) and confirm:
  - “See It In Action” is immediately below the hero.
  - The trust-card section is gone (no 3 cards under “See It In Action”).

---

## Survey → Subscription Conversion (Planner Notes)

### What exists today (baseline)

- Survey lives in the hero modal: `components/hero.tsx`
  - Step 1: segment (`Friend_group_host` / `Long_distance_watch` / `Community_mod`)
  - Step 2: priority (`sync_and_no_spoilers` / `chat_and_reactions` / `async_progress` / `host_controls`)
  - Step 3: discovery (`google_search` / `reddit` / `discord` / `friend` / `other`)
  - Step 4: timing (optional) (`today` / `this_week` / `just_researching`)
  - Step 5: “Recommended for you” + 2 plan cards that can start Stripe checkout immediately
- Recommendation logic: `lib/home-survey.ts`
  - Only elevates to `anime_junkie` when `priority === "host_controls"` OR `segment === "Community_mod"`.
- Persistence: localStorage (`components/home/home-client.tsx`).
- Tracking:
  - `survey_answered` fired per answer
  - `checkout_session_started` / `checkout_redirect_success` / `checkout_error` from both hero and pricing.

### Converting mechanism goals (subscription purchase)

The survey should do more than “collect answers” — it should:

- Increase confidence (“this plan is right for me”)
- Reduce perceived risk (refund/cancel/security)
- Increase urgency at the right moments (esp. `timing === "today"`)
- Make the recommended path feel obvious (and everything else secondary)
- Capture value even when not ready to buy (esp. `just_researching`)

### High-impact survey improvements (ideas)

- **Make the recommendation feel earned (diagnosis → prescription)**
  - After Q2 (priority), show a 1-line “We’ll optimize for: \_\_\_” preview so the user sees progress toward a result.
  - In step 5, show 2–3 “Because you said X…” bullets mapping answers → features on the plan (reduces “random recommendation” feeling).

- **Reduce friction + increase momentum**
  - Allow skipping “How did you find us?” entirely OR move it after checkout begins (it’s not value to the buyer).
  - Convert step 4 (timing) to an inline micro-question on the recommendation screen (“Want to use this today?”) so it doesn’t block the payoff.

- **Personalize the CTA copy everywhere**
  - Step 5 buttons currently say “Start checkout”.
  - Replace with the existing message-matched CTA helper in `lib/home-survey.ts` (`pricingCtaLabelForTier`) so the button reads like the user’s intent (“Start hosting watchrooms”, etc.).

- **Stronger risk reducers at the exact decision point**
  - Add 2–3 micro-trust lines _directly under the Step 5 CTA button_ (not only on pricing):
    - “Secure Stripe checkout”
    - “Cancel & refund anytime in early access”
    - “No account sharing — everyone uses their own Crunchyroll”

- **Better “just researching” path (salvage non-buyers)**
  - If `timing === "just_researching"`, show a secondary conversion:
    - “Email me this plan + setup steps” (collect email) OR “Join Discord for updates + onboarding help”.
  - Keep primary CTA visible, but don’t force immediate buy; this should increase eventual purchases without lowering current ones.

- **Add one purchase-intent question that improves targeting**
  - New Q (early): “How many people will be in your watchroom most of the time?” (2–3 / 4–8 / 9+)
  - Use it to:
    - Make `Community_mod` + larger groups feel clearly “Anime Junkie” (higher-ticket justification)
    - Provide tailored copy (“Best for 6–10 friends”)

- **Make the recommended plan visually dominant**
  - On step 5, render recommended tier as the first card (or full-width), with the non-recommended option collapsed under “Compare the other plan”.
  - The page already has a dedicated `Pricing` section; step 5 can be more “decision-focused” and less like a full pricing table.

- **Urgency that matches timing (no fake countdowns)**
  - If `timing === "today"`, add: “You can be in a room in ~2 minutes.”
  - If `this_week`, add: “Set it up once, reuse for every episode.”

- **Instrument funnel drop-off by step**
  - Add events for `survey_opened`, `survey_step_viewed`, `survey_completed`, `survey_closed` with `step` + current answers to identify where users bail.
  - Use these to decide whether discovery/timing questions should be removed or moved.

### High-level Task Breakdown (next implementation batch)

1. Update survey content + flow in `components/hero.tsx`.
   - Success criteria: fewer blocking steps before showing recommendation; step 5 recommendation copy explicitly references answers; recommended CTA is primary and visually dominant.
2. Use message-matched CTA labels for step 5 purchase buttons via `pricingCtaLabelForTier`.
   - Success criteria: Step 5 CTA text changes based on survey answers (same behavior as pricing section).
3. Add “just researching” salvage path (email capture or Discord join) without harming direct checkout.
   - Success criteria: when `timing === "just_researching"`, a secondary conversion appears; primary checkout is still possible.
4. Add step-level funnel analytics events.
   - Success criteria: events emitted for open/close/step viewed/completed; payload includes `recommended_tier` and answered fields.
5. Validate build.
   - Success criteria: `npm run build` passes.

### Current Status / Progress Tracking (2026-05-12)

- Updated survey flow in `components/hero.tsx` to reduce friction:
  - Step 1: segment
  - Step 2: priority
  - Step 3: group size (optional; skip allowed)
  - Step 4: recommendation + timing/discovery (both optional; do not gate checkout)
- Added a “We’ll optimize for…” preview after priority (shown at the start of step 3).
- Recommendation CTAs now use `pricingCtaLabelForTier(...)` (message-matched CTA copy).
- Added decision-point micro trust copy directly under step-4 checkout buttons.
- Added “just researching” salvage path in step 4 (Discord contact + email plan + Discord setup guide link).
- Added step-level funnel analytics events: `survey_opened`, `survey_step_viewed`, `survey_completed`, `survey_closed`.
- Bumped localStorage key to `anidachi_home_survey_v2` in `components/home/home-client.tsx` to safely roll out the new survey schema (`group_size`).

### Site-wide SEO/AEO plan alignment (2026-05-18)

- [x] Removed `showInstallCta` / Chrome install CTA (extension not live yet)
- [x] Sitemap: genre hub priority 0.85 via `lib/sitemap-discovery.ts` (removed duplicate block in `app/sitemap.ts`)
- [x] `lib/genre-hub-links.ts` + cross-links on hub, toolkit, listicles, footer, Crunchyroll pillar
- [x] `watch-anime-together`: typo fix, genre section, `dateModified` 2026-05-18, `itemList` + `aboveFoldCta`
- [x] `npm run build` ✅
- [ ] Optional: VideoObject/trailer schema (plan tier 3); genre hub OG/Twitter images

### Survey email → CRM (2026-05-21)

- [x] `lib/kreatli-crm/survey-lead.ts` — upsert survey emails + answers into `contacts.json` / Vercel Blob
- [x] `/api/subscribe-interest` calls `upsertSurveyLead` before Gmail alert (CRM failure does not block modal)
- [x] `npm run build` ✅

**Segments:** `survey_lead`, plus `segment:…`, `priority:…`, etc. **Notes:** full survey snapshot + timestamp. Re-submits append notes and merge segments.

**View leads:** `/kreatli-email-crm` → **Survey leads** tab (contacts with `survey_lead` segment; outreach tab excludes them).

- [x] CRM tabs: **Contacts** vs **Survey leads** in `crm-client.tsx`
- [x] Survey tab shows parsed survey answers + follow-up actions (Gmail, status, notes)

### SEO batch — 10 high-traffic pages (2026-06-08)

**1 new genre hub:**
- `/watch-fantasy-anime-with-friends` — fantasy genre cluster (Frieren, HxH, Ghibli, etc.)

**4 new listicle guides:**
- `/guides/best-sports-anime-to-watch-with-friends` — 9 picks
- `/guides/best-comedy-anime-to-watch-with-friends` — 12 picks
- `/guides/best-dubbed-anime-to-watch-with-friends` — 12 picks (dub vs sub friction)

**4 new how-to / troubleshooting guides:**
- `/guides/how-to-watch-seasonal-anime-together` — simulcast weekly workflow
- `/guides/crunchyroll-watch-party-not-working` — sync/detection troubleshooting
- `/guides/how-to-run-an-online-anime-club` — Discord + recurring clubs
- `/guides/how-to-plan-an-anime-marathon-with-friends` — weekend binge planning

**2 new compare pages:**
- `/compare/anidachi-vs-rave` — missing competitor coverage
- `/compare/crunchyroll-party-vs-teleparty-for-anime` — third-party tool-shopping intent

**Infrastructure:**
- `genre-hub-links.ts` + `sitemap-discovery.ts` updated for fantasy hub
- `guide-links.ts` updated (new guides + previously missing shonen/classic/weekend binge entries)

- [x] `npm run build` ✅ — 272 static routes (2026-06-08)

### Executor's Feedback or Assistance Requests

- Please submit a test email in the hero survey and confirm the contact appears at `/kreatli-email-crm` with segment `survey_lead`.
- Production needs `BLOB_READ_WRITE_TOKEN` set (same as Gmail tokens) for CRM writes on Vercel.

### Vercel Fluid Active CPU optimization (2026-06-27)

- [x] Skip JWT middleware on public marketing routes (`lib/middleware-routes.ts`, `middleware.ts`)
- [x] Static homepage — waitlist count via client `/api/waitlist-stats` only (`app/page.tsx`)
- [x] Room waiting poll uses `GET /api/rooms/[roomId]` instead of full `router.refresh()` every 5s
- [x] Watch pages use build cache only at runtime + `force-static` (`jikan-for-watch-page.ts`, `watch/[slug]/page.tsx`)
- [x] `pnpm --filter @anidachi/web check`, `test`, and `build` pass
- [x] Nav session moved client-side (`NavBarClient` → `/api/me`); marketing routes now static (○) in build
- [x] Room waiting poll refreshes on 404 (ended/missing room)
- **Post-deploy:** confirm Vercel Usage → Active CPU drops within 48–72h (rolling 30-day window).

### Async Mode Demo — landing page (2026-07-07)

- [x] Live/Async tab toggle in `chrome-extension-demo.tsx` (default Live)
- [x] New `chrome-extension-demo-async-overlay.tsx` — 3-beat coded sequence (React → Later → Catch up)
- [x] Desktop + mobile branches with async copy, pills, step indicators
- [x] `demo_mode_selected` GA4 event on tab change
- [x] `pnpm --filter @anidachi/web check` passes; browser verified on localhost:3003
- [x] Fix duplicate "2 days later" title + double timeline dot (Async overlay)
- [x] Improve step title visibility (longer + larger)
- [x] Mobile overlay sizing pass: larger chip text/padding, clearer clock/progress bar, more readable pin card
- [x] Fix mobile overlap: move reaction moment + timeline pin upward (compact offsets)
- **Manual QA:** scroll to demo, toggle Async tab, confirm overlays read well on mobile (esp. chip/pin/clock) + timestamp pin + progress tracker animation.

### Force-Index Sitemap + Noindex Cleanup (2026-07-17)

**Background:** GSC Coverage Drilldown (`Discovered - currently not indexed`) listed 256 apex URLs. Scope B: temporary force-index sitemap for all **247** public URLs + exclude 9 noindex auth/product routes from the main sitemap.

**High-level tasks**
1. Add `apps/web/lib/force-index-urls.ts` (247 paths from 2026-07-17 GSC Table.csv).
2. Add production-only `apps/web/app/force-index-sitemap.xml/route.ts` (404 when indexing disabled).
3. Wire second sitemap in `apps/web/app/robots.ts`.
4. Expand `EXCLUDED_URL_PATHS` in `sitemap-discovery.ts`; add `robots: noindex` on `/extension/connect`.
5. Allow `/force-index-sitemap.xml` through staging/middleware/session-refresh static-asset bypasses (same as `/sitemap.xml`).

**Success criteria**
- [x] `FORCE_INDEX_URL_PATHS.length === 247` and none of the 9 noindex paths
- [x] Static discovery leaks none of the 9 noindex paths
- [x] `pnpm --filter @anidachi/web check` passes (Node 22)

**Post-deploy / GSC ops (human)**
1. Confirm `https://www.anidachi.app/force-index-sitemap.xml` returns 247 `<loc>` entries.
2. Confirm main `/sitemap.xml` omits `/login`, `/account*`, `/join*`, `/friends`, `/extension/connect`.
3. Submit `https://www.anidachi.app/force-index-sitemap.xml` in Google Search Console → Sitemaps.
4. After pages are Indexed: delete force-index route + URL list + second robots sitemap entry (cleanup PR).

### High-converting SEO batch 2 (2026-07-22) — Keyword Planner validated

**Shipped (10 new routes):**
1. `/guides/teleparty-not-working-crunchyroll`
2. `/guides/does-everyone-need-crunchyroll-premium-for-watch-party`
3. `/compare/anidachi-vs-metastream`
4. `/compare/anidachi-vs-hyperbeam`
5. `/guides/watch2gether-alternatives-for-anime`
6. `/guides/crunchyroll-watch-party-with-discord`
7. `/guides/is-crunchyroll-party-worth-it`
8. `/compare/anidachi-vs-twoseven`
9. `/guides/kast-alternatives-for-anime`
10. `/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing`

**Also:** guide-links.ts, sitemap priority bumps, hub backlinks on Teleparty/Watch2Gether/Kast/CR Party/Discord compares, CR pillar, toolkit.

**Checks:** `pnpm --filter @anidachi/web check` ✅ · `pnpm --filter @anidachi/web build` ✅

### High-converting SEO batch (2026-07-19) — Keyword Planner validated

**Shipped (10 new routes):**
1. `/pricing` — dedicated pricing + FAQ; footer “Pricing”; schema offer URLs; sitemap priority 0.9
2. `/guides/best-teleparty-alternatives-for-anime`
3. `/guides/can-you-screen-share-crunchyroll-on-discord`
4. `/guides/does-teleparty-work-with-crunchyroll`
5. `/guides/best-watch-party-apps-for-anime`
6. `/guides/best-way-to-watch-crunchyroll-with-friends`
7. `/guides/crunchyroll-party-alternative`
8. `/guides/how-to-host-a-crunchyroll-watch-party`
9. `/guides/rave-alternatives-for-anime`
10. `/guides/switch-from-discord-screen-share`

**Also:** `guide-links.ts` entries; hub links on Teleparty/Discord/CR Party/Rave compares, CR pillar, does-CR-have-WP, without-screen-share.

**Checks:** `pnpm --filter @anidachi/web check` ✅ · `pnpm --filter @anidachi/web build` ✅ (all 10 routes in build output)

### YouTube SEO agent + content plan (2026-07-25)

**Status:** Implementation complete — awaiting manual QA.

**Agent:** `.cursor/agents/anidachi-seo-aeo-pages.md` — YouTube keyword bank, platforms CR+YT, Include paths, pillar checklist, conversionTemplate includes `/watch-youtube-together`.

**Truth fixes:** home FAQ, hero, how-it-works, SoftwareApplicationJsonLd; LDR YouTube rewrite; compare matrices → Crunchyroll + YouTube.

**New routes:**
1. `/watch-youtube-together` (pillar)
2. `/guides/how-to-watch-youtube-with-friends`
3. `/guides/netflix-party-for-youtube`
4. `/guides/does-teleparty-work-with-youtube`
5. `/guides/youtube-watch-party-chrome-extension`
6. `/guides/watch2gether-alternatives-for-youtube`
7. `/guides/youtube-watch-party-with-discord`
8. `/guides/best-apps-to-watch-youtube-together`

**Enriched:** `/compare/anidachi-vs-watch2gether`, `/compare/anidachi-vs-twoseven`; rewrite `/watch-youtube-together-long-distance`.

**Wiring:** `guide-links.ts` (youtube / pillar-watch-youtube), footer, toolkit, sitemap priority 0.9, `inferPageTemplateFromPath` → pillar.

### Scalable Watch IA (2026-07-25) — siblings, no redirects

**Implemented:** Watch nav dropdown (Anime / CR / YouTube siblings); anime hub platform section (strong CR, soft YT); CR breadcrumbs under Anime; YT breadcrumbs without Anime parent; SEO agent platform×vertical rules; footer label consistency.

**No URL renames / no 301s.**

### YouTube SEO batch 2 — 10 KP-validated guides (2026-07-26)

**Status:** Implementation complete — awaiting manual QA.

**Keyword Planner (US) reconfirmed:**
| URL | Primary term | Searches/mo |
|-----|--------------|-------------|
| `/guides/does-youtube-have-watch-party` | does youtube have watch party | 20 |
| `/guides/can-you-screen-share-youtube-on-discord` | can you screen share youtube on discord | 40 |
| `/guides/rave-alternatives-for-youtube` | rave youtube | 70 |
| `/guides/youtube-group-watch` | youtube group watch | 40 |
| `/guides/how-to-host-a-youtube-watch-party` | how to host a youtube watch party | 10 |
| `/guides/how-to-sync-youtube-with-friends` | sync youtube with friends | 10 |
| `/guides/best-teleparty-alternatives-for-youtube` | teleparty youtube (parent) | 110 |
| `/guides/how-to-watch-youtube-together-without-screen-share` | related Discord SS | 40 |
| `/guides/kast-alternatives-for-youtube` | kast youtube | 10 |
| `/guides/youtube-watch-party-free` | youtube watch party free | 10 |

**Wiring:** `guide-links.ts` (+10); pillar `/watch-youtube-together` related + dateModified; soft link from `does-teleparty-work-with-youtube`. Footer unchanged (pillar-only YouTube entry).

**Checks:** `pnpm --filter @anidachi/web check` ✅ · `pnpm --filter @anidachi/web build` ✅

### Hero extension demo overlay restyle (2026-07-26)

**Status:** Implementation complete — awaiting manual QA.

**Scope:** Live animated mock only (Async unchanged). Highest fidelity vs latest extension overlay.

**Changes:**
- `apps/web/components/chrome-extension-demo-overlay.tsx` — green sync dot, account+Plus panel, icon actions, Settings tabs (Reactions/Layout/Voice), live chat column, message composer peek, mint speaking cams, catch-up restyle, emoji set `😂😱❤️🔥😭👀` (room rail peek removed — duplicated cam bubbles)
- `apps/web/components/chrome-extension-demo.tsx` — Live subcopy → Crunchyroll or YouTube

**Checks:** `pnpm --filter @anidachi/web check` ✅ · `pnpm --filter @anidachi/web build` ✅

### Executor's Feedback or Assistance Requests

- **Manual QA (YouTube batch 2):** Spot-check `/guides/does-youtube-have-watch-party`, `/guides/rave-alternatives-for-youtube`, `/guides/best-teleparty-alternatives-for-youtube`, `/guides/can-you-screen-share-youtube-on-discord` — breadcrumbs under YouTube pillar (no Anime parent), FAQ, CTA → `/pricing`, related links.
- **Manual QA (hero Live demo):** On homepage “See It In Action”, confirm Live sequence shows new panel chrome, green sync, chat/composer, cams with speaking ring (no duplicate rail); Async tab still works; check mobile width.
- **Manual QA:** Open http://localhost:3003 — confirm Watch dropdown shows three siblings; check breadcrumbs on `/watch-youtube-together`, `/watch-crunchyroll-together`, `/guides/how-to-watch-youtube-with-friends`, `/guides/does-teleparty-work-with-crunchyroll`.
- **Manual QA (Watch IA siblings):** Confirm Watch dropdown = Anime / CR / YouTube (peers). Breadcrumbs: peers (`Home → CR/YT → page`); tablet has no hamburger overlap; YT related list not polluted by anime tags.
- **Manual QA (YouTube batch):** spot-check `/watch-youtube-together`, `/guides/how-to-watch-youtube-with-friends`, `/guides/does-teleparty-work-with-youtube`, rewritten `/watch-youtube-together-long-distance` — layout, FAQ, CTA → `/pricing`, no CR-only contradictions on home.
- **Manual QA (prior commercial):** `/pricing`, `/guides/does-teleparty-work-with-crunchyroll`, `/guides/can-you-screen-share-crunchyroll-on-discord`, `/guides/best-teleparty-alternatives-for-anime` — confirm layout, FAQ, CTA → pricing/survey, no broken links.
- After deploy: confirm new URLs appear in `/sitemap.xml`; optionally submit sitemap in GSC.
- Force-index sitemap + noindex cleanup was prior work; ready for production deploy then GSC submit.
- (Prior) Please submit a test email in the hero survey and confirm the contact appears at `/kreatli-email-crm` with segment `survey_lead`.
- (Prior) Production needs `BLOB_READ_WRITE_TOKEN` set (same as Gmail tokens) for CRM writes on Vercel.

### Lessons

- Web package `engines.node` requires **22.x**; local default Node 23 fails `pnpm --filter @anidachi/web check` until `nvm use 22`.
- GSC “Discovered – not indexed” exports can include intentionally noindex auth routes that auto-discovery still puts in `/sitemap.xml` — keep `EXCLUDED_URL_PATHS` in sync with page `robots: { index: false }`.
- Stale `.next/types` can fail `tsc` after deleting routes (e.g. `app/extension/page.tsx`); clearing `.next/types` before `pnpm check` fixes phantom module errors.
- SEO agent: after adding a YouTube conversion/KP/anti-cannibal stack, ship the **Crunchyroll twin in the same playbook pass** — otherwise CR pages drift (mid-CTA, crumbs, CWS vs `/pricing`, “Crunchyroll-only” FAQs).
- Never put agent jargon (`soft-pedal`, unexplained `provider-pinned`) in hard boundaries without an explicit “never publish” ban — agents copy it into FAQs.
