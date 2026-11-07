# Homepage title + Explore strip: readiness check (2026-11-02)

Package E of the [SEO growth plan](../../superpowers/plans/2026-10-19-seo-growth-plan.md).
Data: Search Console `sc-domain:anidachi.app`, `data_state: all`, read-only via Composio.
GSC marks 2026-11-01 as the first incomplete day.

## Verdict: ready

- www had **99.2%** of homepage impressions in the last 7 days (Oct 26 – Nov 1: 2,231 www vs 19 apex).
  On complete days only (Oct 25 – 31) it is 98.9%. The threshold was about 80%.
- URL Inspection of `https://www.anidachi.app/` (Nov 2): **Submitted and indexed**, verdict PASS,
  Google-selected canonical `https://www.anidachi.app/` (same as the declared canonical),
  last crawl 2026-11-01 06:08 UTC (mobile), fetch successful.

Both conditions hold, so the changes below are drafted in the working tree. Nothing is committed or pushed.

## Host move: homepage by day

| Date | Apex impr. | Apex clicks | www impr. | www clicks | www share |
|---|---:|---:|---:|---:|---:|
| Oct 19 | 22 | 1 | 299 | 36 | 93.1% |
| Oct 20 | 27 | 0 | 326 | 23 | 92.4% |
| Oct 21 | 25 | 1 | 356 | 38 | 93.4% |
| Oct 22 | 10 | 1 | 273 | 17 | 96.5% |
| Oct 23 | 9 | 2 | 348 | 32 | 97.5% |
| Oct 24 | 6 | 1 | 458 | 41 | 98.7% |
| Oct 25 | 6 | 0 | 434 | 37 | 98.6% |
| Oct 26 | 1 | 0 | 356 | 38 | 99.7% |
| Oct 27 | 6 | 2 | 318 | 33 | 98.1% |
| Oct 28 | 2 | 0 | 278 | 28 | 99.3% |
| Oct 29 | 3 | 0 | 292 | 30 | 99.0% |
| Oct 30 | 2 | 0 | 323 | 36 | 99.4% |
| Oct 31 | 5 | 1 | 357 | 43 | 98.6% |
| Nov 1 (partial) | 0 | 0 | 307 | 19 | 100% |

| Window | Apex impr. / clicks | www impr. / clicks | www share |
|---|---|---|---:|
| Oct 12 – 18 (from the plan) | 1,631 / – | 994 / – | 38% |
| Oct 19 – 25 | 105 / 6 | 2,494 / 224 | 96.0% |
| Oct 26 – Nov 1 | 19 / 3 | 2,231 / 227 | 99.2% |

## Hub vs homepage for the four Crunchyroll queries

Host stripped before grouping. Weekly numbers for Oct 25 – 31 so they compare with the plan's
one-week Oct 12 – 18 baseline (homepage only was recorded then).

| Query | `/` Oct 12–18 | `/` Oct 25–31 (impr / clicks / pos) | Hub Oct 25–31 (impr / clicks / pos) |
|---|---|---|---|
| crunchyroll watch party | 125 @ 6.5 | 80 / 4 / 5.1 | 22 / 1 / 5.2 |
| crunchyroll watch together | 43 | 36 / 4 / 5.5 | 7 / 0 / 7.3 |
| watch together crunchyroll | 46 | 26 / 1 / 5.2 | 2 / 0 / 6.5 |
| how to watch crunchyroll with friends | 38 | 27 / 1 / 6.3 | 5 / 0 / 9.0 |

14-day totals (Oct 19 – Nov 1):

| Query | `/` impr / clicks / pos | Hub impr / clicks / pos | Other pages impr |
|---|---|---|---:|
| crunchyroll watch party | 172 / 6 / 5.7 | 55 / 1 / 5.6 | 8 |
| crunchyroll watch together | 59 / 4 / 5.7 | 9 / 0 / 8.1 | 0 |
| watch together crunchyroll | 48 / 2 / 5.2 | 6 / 0 / 4.7 | 11 |
| how to watch crunchyroll with friends | 57 / 4 / 5.3 | 23 / 0 / 9.1 | 25 |

The homepage still takes most of the impressions for all four queries (about 3–13× the hub).
Its impressions are lower than in Oct 12–18 for every query, but the hub has not picked them up.

## Drafted changes (working tree on `staging`, uncommitted)

**Title** (`apps/web/app/layout.tsx`, root `default` title and root `openGraph.title`):

- Old: `AniDachi – Watch Together | Sync Crunchyroll & YouTube with Friends` (67 chars)
- New: `AniDachi — Watch Together on Crunchyroll, YouTube & Netflix` (59 chars)

The homepage has no page-level title, so it renders the root default. The brand appears once.
The H1 and the description are unchanged. The change is in the layout rather than `app/page.tsx`
because a page-level `openGraph` would replace the root one and drop its image. Any route without
its own title also inherits this default, as it did with the old one.

**Explore strip** (`components/home/home-explore.tsx` + `.module.css`, rendered in
`components/home/home-client.tsx` right after "More platforms. Coming soon."):

- A `<nav>` with the heading "Explore by platform." and six pill links: Crunchyroll watch party
  (`/watch-crunchyroll-together`), Netflix watch party (`/netflix-watch-party`), YouTube watch party
  (`/watch-youtube-together`), Discord watch party (`/discord-watch-party`), Anime A–Z (`/watch`) and
  Free anime tools (`/tools`).
- It uses the upcoming-platforms section's container width, heading scale and theme tokens.

**Checks:** `pnpm --filter @anidachi/web check` passes; `pnpm --filter @anidachi/web test` shows
1,525 passed, 0 failed, 6 skipped; eslint is clean on the changed files.
**Not verified:** the rendered page. Starting the local preview was declined in this run, so the
strip's look and the rendered `<title>` have not been checked in a browser.

## Release notes for the owner

- Ship these two changes together in their own commit, separate from other work. A website-only
  push to `staging` auto-promotes to production within minutes.
- Rollback: revert that one commit.
- After release: re-run the four-query split weekly (plan section E). Success means hub impressions
  rise for these queries without a drop in homepage brand clicks.
