# Why pages aren't getting indexed, and how to fix it (2026-11-03)

Data, all read-only:
- GSC URL Inspection on all 392 URLs in `sitemap.xml` (390 returned) on Nov 3.
- GSC Sitemaps API.
- The live `robots.txt` and both sitemaps.
- Googlebot-UA fetches of sample pages, measuring response time, word count and text overlap.
- The ANI board.

## The short answer

This isn't a crawl budget problem in Google's sense. Google says budget only matters for sites with
hundreds of thousands of URLs, and AniDachi has 392. Google is crawling: 162 URLs since Oct 1 and 141 since Oct 20.
It recrawls pages it already knows and holds new ones back. "Discovered – currently not indexed" on a
site this size means Google judged those URLs not worth fetching yet. That's a priority and quality signal, not a capacity limit.

## Where indexing stands

| Section | URLs | Indexed | Discovered (never crawled) | Unknown to Google | Apex canonical (stale) | Crawled, not indexed |
|---|---:|---:|---:|---:|---:|---:|
| `/watch/*` | 175 | 139 (79%) | 20 | 5 | 7 | 4 |
| `/guides/*` | 123 | 72 (59%) | 30 | 13 | 7 | 1 |
| Top-level pages | 37 | 26 (70%) | 8 | 2 | 0 | 1 |
| `/compare/*` | 18 | 16 (89%) | 1 | 0 | 0 | 1 |
| Genre hubs | 15 | 5 (33%) | 5 | 1 | 4 | 0 |
| `/tools/*` | 11 | 7 (64%) | 3 | 0 | 0 | 1 |
| Glossary, resources | 10 | 8 | 2 | 0 | 0 | 0 |
| **All** | **390** | **274 (70%)** | **69** | **21** | **18** | **8** |

That's better than Oct 19. Back then, only 26% of zero-impression URLs were indexed and the host move hadn't settled.

Important pages still not indexed:
- Never crawled: `/netflix-watch-party`, `/discord-watch-party`, `/virtual-movie-night`, `/watch-movies-together-long-distance`,
  `/guides/watch-netflix-together`, `/guides/watch-movies-together-online`, three new tools.
- Unknown to Google: `/watch`, even though every page links to it from the footer.

## Why

1. **Many pages look alike.**
   - The 175 `/watch/{show}-with-friends` pages are 45% of the sitemap and share 46–57% of their text with each other (5-word overlap).
   - There are 26 genre pages in two parallel sets: 15 hubs and 11 "best X anime" guides. The hubs got 7 impressions in 4 weeks (ANI-14).
   - Several clusters have 5–10 guides on nearly the same question (Netflix, Crunchyroll, Discord, YouTube).

   Google judges the site as a whole and holds back new URLs from a site whose existing URLs look templated and overlapping.
2. **The site is young and has few external links.** It's about five months old. GA4 referrals show Product Hunt and Discord
   and little else. Google decides how often to crawl a site's new URLs mostly from links pointing at it from other sites.
   (The GSC Links report has the referring-domain count. The API doesn't expose it.)
3. **The Oct 12 move from apex to www reset everything.** Google had to re-crawl the whole site on www and follow the apex redirects.
   October crawling went to confirming URLs it already knew (139 of them), not to new ones. 18 URLs still carry a stale apex canonical.
4. **The signals point at the wrong pages.**
   - `force-index-sitemap.xml` repeats 247 URLs. 164 are `/watch/*`, plus `/privacy` and `/terms`. It leaves out the
     new hubs. In the last two weeks `/watch/*` got 51 of the 141 crawls, the largest share.
   - Neither sitemap has `<lastmod>`, so Google can't tell which pages changed or are new.
   - New hubs are mostly linked from the footer. Every page has the same 35 footer links, and Google gives
     sitewide links little weight. `/watch` is in that footer and is still unknown.
5. **Too many new URLs at once.** About 15 pages shipped on Oct 8 and more tools on Oct 12, during the host move.

Not the cause: server speed (time to first byte 0.37–0.6 s, all 200), `robots.txt` (only private paths blocked), noindex or canonical tags
on www pages, and sitemap errors (0 errors, last fetched Oct 28).

## Getting current pages indexed

### This week: code, no approval needed
1. **Add real `<lastmod>` to `sitemap.xml`** from each page's `dateModified`. Use the real content date, never "today".
2. **Add contextual body links from the pages Google crawls most often.**
   - Source pages (all crawled Nov 1–3): `/`, `/watch-crunchyroll-together`, `/anime-tracker`,
     `/watch-anime-together`, `/watch-party-app`, `/watch-youtube-together`, `/best-anime-for-long-distance-relationships`.
   - Targets: the 10 priority pages below.
   - Use one link per target, in the main content (not the footer), with a descriptive anchor.
3. **Set up IndexNow and Bing Webmaster Tools.** Ping on deploy, and submit the sitemap in Bing. Bing feeds ChatGPT and Copilot
   search, and AI assistants are the best-converting channel (25% store-click rate).

### This week: owner
4. **Request indexing in GSC,** about 10 a day, in this order:
   1. `/netflix-watch-party`
   2. `/guides/watch-netflix-together`
   3. `/discord-watch-party`
   4. `/watch-movies-together-long-distance`
   5. `/virtual-movie-night`
   6. `/watch`
   7. `/guides/watch-movies-together-online`
   8. `/guides/does-crunchyroll-have-watch-party`
   9. `/tools/one-piece-how-many-episodes`
   10. `/tools/crunchyroll-dub-schedule`

   After that, the 18 URLs with a stale apex canonical.
5. **Retire `force-index-sitemap.xml`.** It was meant to stay until the host move settled (`lib/force-index-urls.ts`), and that has happened:
   70% of URLs are indexed and the homepage is on www. Today it steers crawling toward `/watch/*`.

### Next two weeks: owner decisions, then code
6. **Prune and merge until the sitemap is about 250 URLs.**
   - ANI-14: redirect 9 genre hubs into their matching guides.
   - ANI-15: the 71 `/watch/*` pages with zero impressions. Noindex them and drop them from the sitemap, or merge them, rather than only taking them out of the force-index sitemap.
   - ANI-16: the last two merges.
   - Merge guides that repeat a hub, such as "does *platform* have a watch party" and the YouTube group-watch and free-party guides.

   Fewer, more distinct pages raise how Google rates the rest of the site.
7. **Earn links** (the strongest lever for a young site):
   - The Chrome Web Store listing should link the site and name each platform. A Store listing ranks #1 for "netflix watch party" (ANI-5).
   - Product Hunt, AlternativeTo, directory submissions, Reddit and Discord community posts.
   - Promote `/tools/crunchyroll-schedule` as something other anime sites would want to link to.

## Rules for adding pages

- **Indexing gate:** add pages to a group only when that group is at least 80% indexed.
- **Page budget:** while the site is under ~300 indexed URLs, retire or merge one page for each new one.
- **New platform = one hub at launch.** It goes live with:
  - a homepage platform-grid link
  - body links from 3 frequently crawled pages
  - a `lastmod`
  - a GSC indexing request
  - an IndexNow ping
  - a link from the Store listing

  Supporting guides come only after the hub is indexed and getting impressions.
- **No more programmatic batches** (like `/watch/*`) until the existing ones earn impressions.
- **Track weekly:** the indexed share by section, and days from publish to index for new URLs (target under 14).
