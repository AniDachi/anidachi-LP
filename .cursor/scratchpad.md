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
