## Background and Motivation

We are adding more programmatic `/watch/[slug]` pages (“Watch {Anime} with Friends”) to expand SEO coverage and internal linking.

## Key Challenges and Analysis

- Watch pages are generated from `lib/anime-data.ts` (`animeList`) via `app/watch/[slug]/page.tsx`.
- Adding “5 more watch pages” typically means adding 5 new `AnimeEntry` items, making sure:
  - slugs are unique and URL-safe
  - `related` references existing slugs
  - hub pages/listicles link to the new watch pages
  - any site-wide `dateModified`/metadata patterns stay consistent

## High-level Task Breakdown

1. Add 5 new anime entries to `lib/anime-data.ts`.
   - Success criteria: `animeList` includes 5 new, unique slugs; each has `title`, `synopsis`, `episodes`, `genres`, and `related` slugs that exist.
2. Add internal backlinks to the new watch pages from the appropriate hub/listicle pages.
   - Success criteria: new watch pages appear in “Watch Anime Together” hub and at least one relevant listicle page; links use `/watch/{slug}-with-friends`.
3. Validate build.
   - Success criteria: `npm run build` succeeds.

## Project Status Board

- [x] Add 5 anime entries to `lib/anime-data.ts`
- [x] Add hub/listicle backlinks for the 5 new watch pages
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

## Executor's Feedback or Assistance Requests

- None yet.

## Lessons

- If terminal output indicates vulnerabilities, run `npm audit` before continuing.
