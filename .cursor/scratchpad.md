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

### Post-payment success page (Discord contact)

- Added a Discord contact block to the Stripe Checkout success page (`/success`) so subscribers can reach out via Discord in addition to email.
- Removed the bottom action buttons from `/success`.
- Added an optional Discord username field on `/success` that saves to Stripe Customer metadata (key: `anidachi_discord_contact`) using the `session_id` from the success URL.
- Build check: `npm run build` ✅

## Executor's Feedback or Assistance Requests

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

## Lessons

- If terminal output indicates vulnerabilities, run `npm audit` before continuing.

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
  - After Q2 (priority), show a 1-line “We’ll optimize for: ___” preview so the user sees progress toward a result.
  - In step 5, show 2–3 “Because you said X…” bullets mapping answers → features on the plan (reduces “random recommendation” feeling).

- **Reduce friction + increase momentum**
  - Allow skipping “How did you find us?” entirely OR move it after checkout begins (it’s not value to the buyer).
  - Convert step 4 (timing) to an inline micro-question on the recommendation screen (“Want to use this today?”) so it doesn’t block the payoff.

- **Personalize the CTA copy everywhere**
  - Step 5 buttons currently say “Start checkout”.
  - Replace with the existing message-matched CTA helper in `lib/home-survey.ts` (`pricingCtaLabelForTier`) so the button reads like the user’s intent (“Start hosting watchrooms”, etc.).

- **Stronger risk reducers at the exact decision point**
  - Add 2–3 micro-trust lines *directly under the Step 5 CTA button* (not only on pricing):
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

### Executor's Feedback or Assistance Requests

- Please refresh `/` and try the hero survey to confirm:
  - You reach the recommendation in 2–3 clicks (group size can be skipped).
  - Step-4 checkout buttons show intent-matched labels (not “Start checkout”).
  - Selecting “Just researching” shows the salvage CTAs.
