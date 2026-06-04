## Background and Motivation

We are adding more programmatic `/watch/[slug]` pages (“Watch {Anime} with Friends”) to expand SEO coverage and internal linking, with a focus on **higher conversion to paid subscription checkout** (via the homepage `/#pricing` → pricing/checkout flow).

## Key Challenges and Analysis

- Watch pages are generated from `lib/anime-data.ts` (`animeList`) via `app/watch/[slug]/page.tsx`.
- Adding “5 more watch pages” typically means adding 5 new `AnimeEntry` items, making sure:
  - slugs are unique and URL-safe
  - `related` references existing slugs
  - hub pages/listicles link to the new watch pages
  - any site-wide `dateModified`/metadata patterns stay consistent

## High-level Task Breakdown

### Batch: Create 10 new programmatic watch pages (conversion = start subscription)

1. Add 10 new `AnimeEntry` items to `lib/anime-data.ts` (slugs listed below).
   - Success criteria: `animeList` includes 10 new, unique slugs; each has `title`, `synopsis`, `episodes`, `genres`, and `related` slugs that exist in `animeList`.
2. Add MAL IDs for the 10 new slugs to `lib/anime-mal-ids.ts`.
   - Success criteria: `getMalIdForSlug(slug)` returns a number for each new slug; watch pages can fetch posters/scores via Jikan.
3. Add required hub/listicle backlinks for every new watch page.
   - Success criteria:
     - Each new slug is linked from `app/watch-anime-together/page.tsx` (“Popular Anime to Watch Together” grid).
     - Each new slug is linked from `app/guides/best-anime-to-watch-with-friends/page.tsx` (exactly one best-fit section per title; no duplicate `/watch/...` links on the page).
     - Bump `dateModified` on any touched hub/listicle pages (ISO date, honest).
4. Validate build.
   - Success criteria: `npm run build` succeeds.

## Project Status Board

### Completed (previous batch)

- [x] Add 5 anime entries to `lib/anime-data.ts`
- [x] Add hub/listicle backlinks for the 5 new watch pages
- [x] Run `npm run build`

### Next batch (10 new watch pages)

- [x] Add 10 anime entries to `lib/anime-data.ts`
- [x] Add MAL IDs for the 10 slugs to `lib/anime-mal-ids.ts`
- [x] Add hub/listicle backlinks (`watch-anime-together`, `best-anime-to-watch-with-friends`) + bump `dateModified`
- [x] Run `npm run build`

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

### Executor's Feedback or Assistance Requests

- Please submit a test email in the hero survey and confirm the contact appears at `/kreatli-email-crm` with segment `survey_lead`.
- Production needs `BLOB_READ_WRITE_TOKEN` set (same as Gmail tokens) for CRM writes on Vercel.
