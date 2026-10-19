# SEO growth plan, revised (October 19, 2026)

Status: active. Replaces the work-package list in the external handover
`plan/2026-10-19-seo-growth-handoff.md` (anidachi-seo-handover.zip). The rules
in that handover still apply: `.cursor/agents/anidachi-seo-aeo-pages.md` and
`apps/web/docs/seo-content-guidelines.md` win where they disagree with this plan.

The handover was built on data through Oct 11 (GSC) and a code read from Oct 14.
This revision re-checked everything on Oct 19 against the live site, production
`main` (`b48de0e9`, equal to `staging`), GSC through Oct 18, GA4 through Oct 17,
and Amplitude. Several of the handover's premises did not hold; they are listed first.

**Today's release is included.**

- The 0.1.4-compatible Web and Worker were promoted to `main` at 14:27 UTC
  (`b48de0e9`, PR #453).
- Chrome Web Store 0.1.4 is public: the listing shows version 0.1.4, updated
  Oct 19, under the name "AniDachi: Watch Together, Synced Watch Party".
- Netflix is supported in production on both the website and the extension.
- A second full crawl at 19:00 UTC matched the first field for field. That's
  expected: the Netflix copy and the mobile install panel were already live during
  the first crawl.

All search and analytics numbers below are pre-release. Treat Oct 19 as a new
change point when comparing windows.

## Implementation status (October 19, evening)

Shipped to `staging` in one commit. Not yet promoted to production.

| Package | Status |
|---|---|
| A | **Done.** Week of Oct 19 – 25: 49 slots from the AnimeSchedule.net week 43 timetable, cross-checked against Crunchyroll's calendar. The title leads with "Crunchyroll Simulcast Calendar" and drops the year on cross-month weeks to stay within 60 characters. Open question: Precure is kept at Sun 00:30 UTC (AnimeSchedule); Crunchyroll showed 01:30 last week. |
| B1 | **Done.** `/friend/` routes are excluded from first-touch attribution, and fallback paths drop invite tokens and room ids (`redactAttributionPath`, with tests). |
| B2 | **Done.** The mobile panel sends `mobile_install_panel_view`, `extension_store_clicked` (placement `mobile_install_panel`) and `desktop_install_link_copied` (shared or copied). |
| B3 | **Done**, with the event name `extension_store_clicked`. It fires on desktop Store clicks from every `InstallLink` to the Chrome Web Store, from the homepage reviews link, and from the mobile panel. `cta_click` with `cta_variant: chrome_web_store` is kept. New finding: `extension_clicked` fires on the homepage's "See How It Works" scroll link, not on an install. This is documented in `CONVERSION_METRICS.md`. |
| B4 | Not done (optional; `web_vital` double reporting). |
| C | Ready for the owner in [SEO owner actions](../../releases/seo/2026-10-19-seo-owner-actions.md). |
| D | **Done.** 24 single-brand titles (table below). The guard test is indentation-agnostic, reads `{ absolute }` titles, and fails on any unreadable page title. Six pages have their own `openGraph`. `/extension` has one H1 (the Suspense fallback is no longer a heading). Googlebot now gets its title and description in `<head>`: `next.config.ts` adds Googlebot to Next's `htmlLimitedBots`. The `?welcome=1` view keeps a single `noindex`. All four orphans and the hub → Teleparty guide link are linked. Watch titles keep their tail only when the result fits in 60 characters; 18 of 176 still exceed 60 because of long anime names. |
| E | **Done (body part).** The homepage How It Works step 3 links "Crunchyroll watch party", "YouTube watch party" and "Netflix watch party" to their hubs. The homepage title waits for Nov 2 and owner approval. |
| F | **Done.** LDR page (title, description, new "LDR anime" section), how-to Crunchyroll guide, screen-share guide (title and answer), anime-marathon description. A text install link on the best-anime guide (an `InstallLink`, so phones get the handoff; not a third card). Anime-specific CTA copy on `/watch-anime-together` (`ctaCopy="animePillar"`). |
| G | **Done** for the logo: WebP (29 KB) instead of PNG (157 KB) in the logo component and two demo mocks. Session replay, Geist Mono and the homepage client tree are owner proposals. |
| N | **Done** for steps 2–5. Contextual links to `/netflix-watch-party` and `/guides/watch-netflix-together` from `/watch-party-app`, `/watch-netflix-together-long-distance`, `/guides/teleparty-netflix`, `/compare/anidachi-vs-teleparty`, `/watch-kdrama-together-long-distance` and the homepage. Second inbound links for `/guides/netflix-movie-night` and `/guides/netflix-group-watch`. Titles: `/watch-party-app` and `/virtual-movie-night`. `/anime-tracker` keeps its title because its body covers only Crunchyroll and YouTube. Netflix claims on the core pages were spot-checked. Docs updated. Step 1 (request indexing) is the owner's. |
| H | Reports and drafts: [owner actions](../../releases/seo/2026-10-19-seo-owner-actions.md), [index coverage report](../../releases/seo/2026-10-19-index-coverage-and-consolidation-report.md). The owner approved H.2 and H.4 later on Oct 19 (recorded in the guidelines decisions log). |
| H.2 | **Done.** `/compare/anidachi-vs-syncup` and `/compare/anidachi-vs-kosmi`. Parent hub: `/watch-party-app`. Inbound links from its body and related list, from `/guides/best-watch-party-apps-for-anime`, and from the guide-links registry (tags `compare`, `online`). Competitor claims cite syncup.tv and kosmi.io, checked 19 Oct 2026; unverified details say "Not stated". Reviews due Nov 18, Dec 18 and Jan 17. |
| H.4 | **Done for watch pages.** 15 new `WATCH_ENRICHMENT` entries with sources: Mashle, Naruto, Cyberpunk: Edgerunners, Serial Experiments Lain, Tokyo Revengers, Tokyo Ghoul, Howl's Moving Castle, My Hero Academia, Another, ODDTAXI, DanMachi, Berserk, Dragon Ball Z, Evangelion and Ergo Proxy. Enriched pages now use their entry's `updated` date as `dateModified`. Where the cached MyAnimeList count was wrong or first-season-only, a verified `episodes` override is shown. Genre hubs are unchanged (option A); re-measure after about Nov 2. |
| Data fix | **Found while enriching:** 30 watch pages pointed at the wrong MyAnimeList entry. Examples: Blue Lock showed Rurouni Kenshin's poster and score, Berserk showed Pokémon Sun & Moon's, Kingdom showed Naruto Shippuden's, and Suzume showed Spy x Family's. Five more pointed at a later season (Code Geass, Fate/Zero, Fire Force, Assassination Classroom, Bungo Stray Dogs). All 176 ids were checked against MyAnimeList page titles. The 30 corrections were each verified on MyAnimeList, and their cache entries were rebuilt from those pages (Jikan was unreachable). Separate commit. |
| H.1, E | Not approved yet. E's recommendation: wait until about Nov 2 (see the owner-actions doc). |

Checks:

- `pnpm --filter @anidachi/web check` passes.
- `test` passes: 1,319, with 6 skipped.
- Lint: no errors.
- `seo:links`: thin contextual inbound fell from 60 to 57. "Broken" targets rose from 122 to 128; all six are the existing `/opengraph-image.png` false positive on the six new `openGraph` blocks.
- Local `next build` and `next start`, checked with a Googlebot user agent:
  - every changed title renders in `<head>` at 60 characters or less;
  - `/extension` has one H1;
  - the `/extension?welcome=1` view has only `noindex, nofollow`.
- Browser test:
  - the mobile panel sends `mobile_install_panel_view` and `extension_store_clicked`;
  - the desktop hub sends `cta_click` and `extension_store_clicked`;
  - the homepage platform links render;
  - the WebP logo loads.
- The first build caught a server-component `onClick` on the Store reviews link (rendered on `/pricing`). It is now a client component, `TrackedStoreLink`.
- `dev:check` suggested the rooms profile only because two file names contain "room": `glossary/watchroom` and `chrome-extension-room-demo`. No room or P2P code changed.

Rollback: revert the commit on `staging`. No schema, env, Worker or extension
changes.

Re-measure 28 days after the production deploy of this commit.

### Title changes

| Page | Old rendered title | New rendered title |
|---|---|---|
| `/compare/anidachi-vs-amazon-watch-party` | AniDachi vs Amazon Watch Party for Anime (2026) \| AniDachi | AniDachi vs Amazon Watch Party for Anime (2026) |
| `/compare/anidachi-vs-anime-watch-parties-extension` | AniDachi vs Anime Watch Parties Extension — Crunchyroll Co-Watching Compared \| AniDachi | AniDachi vs Anime Watch Parties Extension (2026) |
| `/compare/anidachi-vs-crunchyroll-party` | AniDachi vs Crunchyroll Party — Which Is Better for Anime Nights? (2026) \| AniDachi | AniDachi vs Crunchyroll Party for Anime Nights (2026) |
| `/compare/anidachi-vs-hyperbeam` | AniDachi vs Hyperbeam — Best Hyperbeam Alternative for Anime (2026) \| AniDachi | AniDachi vs Hyperbeam: Hyperbeam Alternative for Anime |
| `/compare/anidachi-vs-kast` | AniDachi vs Kast — Best Kast Alternative for Crunchyroll Anime (2026) \| AniDachi | AniDachi vs Kast: Kast Alternative for Crunchyroll |
| `/compare/anidachi-vs-metastream` | AniDachi vs Metastream — Best Metastream Alternative for Anime (2026) \| AniDachi | AniDachi vs Metastream: Metastream Alternative for Anime |
| `/compare/anidachi-vs-netflix-watch-party` | AniDachi vs Netflix Watch Party for Anime (2026) \| AniDachi | AniDachi vs Netflix Watch Party for Anime (2026) |
| `/compare/anidachi-vs-rave` | AniDachi vs Rave: Which Is Better for Anime Watch Parties? (2026) \| AniDachi | AniDachi vs Rave: Better for Anime Watch Parties? (2026) |
| `/compare/anidachi-vs-roll-together` | AniDachi vs Roll Together — Crunchyroll Watch Party Extensions Compared (2026) \| AniDachi | AniDachi vs Roll Together: Crunchyroll Watch Party (2026) |
| `/compare/anidachi-vs-scener` | AniDachi vs Scener — Best Scener Alternative for Anime Watch Parties (2026) \| AniDachi | AniDachi vs Scener: Scener Alternative for Anime (2026) |
| `/compare/anidachi-vs-syncplay` | AniDachi vs Syncplay — Best Syncplay Alternative for Crunchyroll Anime (2026) \| AniDachi | AniDachi vs Syncplay: Syncplay Alternative for Anime |
| `/compare/anidachi-vs-teleparty` | AniDachi vs Teleparty — Crunchyroll & YouTube Watch Party (2026) \| AniDachi | AniDachi vs Teleparty for Crunchyroll, YouTube & Netflix |
| `/compare/anidachi-vs-twoseven` | AniDachi vs TwoSeven — Best TwoSeven Alternative for LDR Couples (2026) \| AniDachi | AniDachi vs TwoSeven: TwoSeven Alternative for Couples |
| `/compare/anidachi-vs-watch2gether` | AniDachi vs Watch2Gether — YouTube & Crunchyroll (2026) \| AniDachi | AniDachi vs Watch2Gether for YouTube & Crunchyroll (2026) |
| `/pricing` | AniDachi Pricing — Free Chrome Watch Party for Crunchyroll & YouTube \| AniDachi | AniDachi Pricing — Free to Join, Plus or Pro to Host |
| `/about` | About AniDachi \| AniDachi | About AniDachi |
| `/contact` | Contact AniDachi \| AniDachi | Contact AniDachi |
| `/discord-watch-party` | Discord Watch Party — Voice on Discord, Sync on AniDachi \| AniDachi | Discord Watch Party — Discord Voice, Synced Video \| AniDachi |
| `/extension` | Install AniDachi Chrome Extension \| AniDachi | Install AniDachi — Chrome Extension for Watch Parties |
| `/watch-crunchyroll-together` | Crunchyroll Watch Party with AniDachi — Sync & Chat (2026) \| AniDachi | Crunchyroll Watch Party: Sync & Chat with Friends \| AniDachi |
| `/guides/best-anime-movies-to-watch-with-friends` | Best Anime Movies to Watch With Friends Online (2026) \| AniDachi | Best Anime Movies to Watch With Friends (2026) \| AniDachi |
| `/guides/best-teleparty-alternatives-for-youtube` | Best Teleparty Alternatives for YouTube (2026) \| Switch to AniDachi \| AniDachi | Best Teleparty Alternatives for YouTube (2026) \| AniDachi |
| `/guides/crunchyroll-party-alternative` | Crunchyroll Party Alternative — Upgrade to AniDachi (2026) \| AniDachi | Crunchyroll Party Alternative (2026): Sync & Chat \| AniDachi |
| `/guides/switch-from-discord-screen-share` | Switch From Discord Screen Share to AniDachi (2026 Playbook) \| AniDachi | Switch From Discord Screen Share to AniDachi (2026) |
| `/watch-party-app` | Watch Party App for Crunchyroll and YouTube \| AniDachi | Watch Party App: Crunchyroll, YouTube & Netflix \| AniDachi |
| `/virtual-movie-night` | Virtual Movie Night on Crunchyroll or YouTube \| AniDachi | Virtual Movie Night on Netflix or Crunchyroll \| AniDachi |
| `/best-anime-for-long-distance-relationships` | Best Anime for Long Distance Relationships (2026) \| AniDachi | LDR Anime: Best Long-Distance Relationship Anime \| AniDachi |
| `/guides/how-to-watch-crunchyroll-with-friends` | How to Watch Crunchyroll with Friends (2026) — 2-Minute Watch Party \| AniDachi | How to Watch Crunchyroll with Friends in 5 Steps \| AniDachi |
| `/guides/can-you-screen-share-crunchyroll-on-discord` | How to Screen Share Crunchyroll on Discord — Why It Black-Screens \| AniDachi | Stream Crunchyroll on Discord: Black Screen Fix \| AniDachi |
| `/tools/crunchyroll-schedule` | Crunchyroll Release Schedule — Oct 12 – 18, 2026 \| AniDachi | Crunchyroll Simulcast Calendar: Oct 19 – 25, 2026 \| AniDachi |


## What changed in the plan, and why

| Handover item | Revised | Evidence |
|---|---|---|
| WP1: add a mid-page install CTA to four content pages, because they "almost never reach install" | **Dropped as written.** Replaced by measurement fixes (B) and targeted work on two weak pages (F) | All four pages already have two install cards (`aboveFoldCta` plus the layout's bottom card), which is the maximum the guidelines allow. The "0–1 install clicks" came from `extension_clicked`, which fires only from the homepage hero (`components/hero.tsx:74`). In Amplitude, users whose first page was `/watch-crunchyroll-together` and who reached `/extension` clicked through to the Chrome Web Store 65% of the time. The homepage figure is 43%. |
| WP1: add a `/pricing` link on both hubs | Mostly done | `/watch-crunchyroll-together:245` ("Compare plans"), `/watch-anime-together:181`. Neither page has a plan comparison to sit next to. |
| WP2: rewrite `/pricing` and `/compare/anidachi-vs-teleparty` for low click rate | **Removed from click-rate work** (the double-brand fix in D stays) | Their impressions are mostly the brand query "anidachi" at position 1–1.1, shown as sitelinks under the homepage: 286 of 617 for `/pricing` and 354 of 496 for the compare page. Non-brand demand on the compare page is about 22 impressions at position 10.8. |
| WP2: add a "Does Teleparty work with Crunchyroll?" section to the hub | Changed to **link only** | The hub already has that H2 (`:248`) and a matching FAQ. It links the compare page but never `/guides/does-teleparty-work-with-crunchyroll`. |
| WP8: homepage vs Crunchyroll hub, after Nov 2 | **Moved up.** The body-copy part starts now; the title waits for Nov 2 and owner approval | Since the Oct 12 release, Google shows the homepage instead of the hub for Crunchyroll head terms (details below). The freeze covers titles, H1s and URLs, not body copy or links. |
| WP3: "24 titles with the brand twice" | 23, plus a test gap of 18 pages | Crawl and code agree on 23. 18 public pages use tab indentation, which the guard test cannot see. |
| WP3: `/extension` duplicate H1 from Suspense | Confirmed, with an extra finding | The fallback H1 (`app/extension/page.tsx:141`) and the hub H1 (`extension-install-hub.tsx:258`) both ship. The page's `<title>` and description are also streamed into `<body>` instead of `<head>`, including for Googlebot. |
| WP10: refresh Netflix pages "when Netflix is live" | **Triggered today and expanded into package N** | Netflix is live on the website and in Store 0.1.4. The copy was already updated on Oct 17 and is now in production. The real problem is indexing: only 4 of 17 Netflix-intent pages are indexed. The Store listing doesn't mention Netflix. |
| WP9: merge analysis for zero-impression URLs | Kept, reframed as an indexing problem | URL Inspection on a random 30 of the 155 zero-impression URLs: 22 are not indexed ("Discovered – currently not indexed" or "URL is unknown to Google"). |
| WP6 | Kept; the Store listing moves up | The live listing names only YouTube and Crunchyroll. |
| (new) | **Crunchyroll schedule is stale today** | Best-performing new page, updated by hand every Monday. |
| (new) | **Mobile install is untracked since Oct 18** | The new handoff panel sends no events, and the old tracked button can no longer render. |
| (new) | **Invite tokens leak into attribution** | `seo_landing_path` records `/friend/invite/<token>`. |

## Current state (October 19)

### The site

- Production `main` = `staging` = `b48de0e9`, promoted today. The live crawl of 386
  sitemap URLs matches the handover crawl field for field: all 200, 23 double-brand
  titles, 212 titles over 60 characters, 64 descriptions over 160 characters, one page
  with two H1s, and four pages with no inbound links from other sitemap pages.
- SEO-relevant changes since the Oct 12 release:
  - Oct 13: movie-specific copy on watch pages (`25df6a00`, `c89afe1b`).
  - Oct 16–17: install page and in-extension guide refresh (`dc4fb963`, `4c071377`).
  - Oct 17: Netflix copy across about 40 pages (`9e2fc1b8`).
  - Oct 18: mobile install handoff (`7593d69f`).
  - None of these changed a title, H1 or URL. All reached production today.
- `/login` is `noindex, nofollow` but still gets about 244 brand impressions as a
  sitelink. That's harmless; no action.

### Search Console (domain property, `data_state: all`)

| Week | Clicks | Impressions | Avg. position |
|---|---|---|---|
| Sep 28 – Oct 4 | 400 | 11,282 | 6.9 |
| Oct 5 – 11 | 308 | 12,951 | 7.6 |
| Oct 12 – 18 (post-release) | 388 | 16,127 | 7.7 |

- **Host move:** the apex share of page impressions fell from 37% to 32% week over
  week. Homepage impressions on `www` went from 25 to 994 a week; the apex homepage
  still has 1,631.
- **Homepage took Crunchyroll head terms from the hub:**
  - `/watch-crunchyroll-together` fell from 1,107 to 681 impressions and from 24 to 8
    clicks. Its daily impressions dropped from about 170 to about 90 starting Oct 12.
  - The homepage now ranks instead of the hub for these queries (post-week impressions
    and position on `/`):
    - "crunchyroll watch party": 125 at position 6.5
    - "watch together crunchyroll": 46
    - "crunchyroll watch together": 43
    - "how to watch crunchyroll with friends": 38
  - Site-wide, non-brand Crunchyroll impressions still rose, from 1,133 to 1,817, so
    visibility moved between pages rather than disappearing. The cost is that the
    hub converts better than the homepage (see the funnel below).
  - `/guides/how-to-watch-crunchyroll-with-friends` also fell, from 388 to 210
    impressions, with 0 clicks in the post-release week.
- **New tool pages (first week):**
  - `/tools/crunchyroll-schedule`: 1,149 impressions and 11 clicks. Its top query is
    "crunchyroll simulcast calendar" (484 impressions, position 6.9, 2 clicks), but
    the title says "Release Schedule".
  - `/tools/random-anime-generator`: 250 impressions.
  - `/tools/black-clover-filler-list`: 173 impressions.
  - `/tools/naruto-shippuden-filler-list`: 167 impressions.
  - Five tool pages have no impressions yet, which is normal after one week.
- **Real low-click pages** (last 28 days, brand sitelinks excluded):

  | Page | Query | Impressions | Position | Clicks |
  |---|---|---|---|---|
  | `/best-anime-for-long-distance-relationships` | "ldr anime" | 254 | 2.6 | 0 |
  | `/guides/can-you-screen-share-crunchyroll-on-discord` | (page total) | 1,859 | 9.0 | 1 |
  | `/guides/how-to-watch-crunchyroll-with-friends` | (page total) | 1,521 | 7.2 | 11 |
  | `/glossary/ova-meaning` | (page total) | 14,200 | 9.3 | 1 |

  For the screen-share page, the limit is position, not the snippet. The OVA page
  stays deprioritized.
- **No impressions:** 155 of the 386 sitemap URLs had zero impressions in the last
  28 days: 70 watch pages, 53 guides, 11 genre hubs, 10 root pages, 5 tools,
  4 compare pages, 1 glossary page and 1 resources page.

### Install funnel (Amplitude, Sep 21 – Oct 19, unique users by first-touch `seo_landing_path`)

| First page | Reached `/extension` | Clicked Chrome Web Store | Rate |
|---|---|---|---|
| `/` | 606 | 263 | 43% |
| `/extension` (direct) | 200 | 52 | 26% |
| `/watch-crunchyroll-together` | 54 | 35 | 65% |
| `/watch-anime-together` | 46 | 9 | 20% |
| `/pricing` | 38 | 10 | 26% |
| `/guides/how-to-watch-crunchyroll-with-friends` | 12 | 8 | 67% |

GA4 organic, last 28 days:

- `/guides/best-anime-to-watch-with-friends`: 104 sessions and 1 install-page view.
  Mobile accounts for 66 of those sessions, with 0 CTA clicks.
- `/watch-anime-together`: 116 sessions and 45 install-page views. Its weak step is
  the Store click (20%), not reaching the install page.

### Measurement gaps

- **No GA4 custom dimensions are registered.** `seo_landing_path`, `placement`,
  `cta_variant`, `page_template` and the `web_vital` parameters can't be reported in
  GA4. Amplitude has them.
- **The only GA4 key event is `form_submit`.**
- **`extension_clicked` measures one button.** It fires only from the homepage hero,
  without `seo_landing_path`. The real Store click is `cta_click` with
  `cta_variant=chrome_web_store` (`extension-install-hub.tsx:243`).
- **Mobile install has been blind since Oct 18:**
  - `MobileInstallPanel` sends no events.
  - The hub's mobile "Copy desktop install link" button (the only source of
    `desktop_install_link_copied`, 116 events in 28 days) can no longer render in
    `cws` mode.
- **Invite tokens leak into attribution:**
  - `lib/seo-landing-path.ts` excludes `/friends`, but invite links are
    `/friend/invite/<token>`.
  - Tokens are recorded as `seo_landing_path`. The audit saw them in Amplitude; by
    design they also go to GA4 and to Stripe Checkout metadata.
- **Test traffic in GA4:** 265 sessions in 28 days came from `staging.anidachi.app`,
  `localhost` and `127.0.0.1`.
- **AI assistants:** 71 sessions in 28 days, almost all from chatgpt.com. 40 of them
  landed on `/`.

### Netflix launch (October 19 release)

- **The product and the website now agree.** Both say Netflix movie and episode
  pages work in desktop Chrome, with each viewer using their own account. The
  pricing FAQ describes card and cardless trials conditionally ("The plan cards
  show your current offer"). That fits the production state, where new cardless
  starts are still off.
- **Index status** (GSC URL Inspection, Oct 19) of the 17 Netflix-intent URLs:
  - **Indexed (4):** `/watch-party-app`, `/watch-netflix-together-long-distance`,
    `/guides/teleparty-netflix`, `/guides/netflix-party-for-youtube`.
  - **"Discovered – currently not indexed" (6):** `/netflix-watch-party` (linked
    from all 385 pages through the footer), `/guides/watch-netflix-together`,
    `/guides/how-to-watch-netflix-together`,
    `/guides/does-netflix-have-a-watch-party`,
    `/guides/how-to-screen-share-netflix-on-discord`, `/virtual-movie-night`.
  - **"URL is unknown to Google" (5):** `/netflix-party`,
    `/compare/anidachi-vs-netflix-watch-party`, `/guides/netflix-group-watch`,
    `/guides/netflix-movie-night`, `/guides/netflix-party-extension`.
  - **"Alternate page" (2):** `/guides/how-to-watch-netflix-with-friends` and
    `/guides/netflix-party-for-crunchyroll`. Google's last crawl saw an apex
    canonical. The live canonical is `www`, so a recrawl fixes this.
- **Search data:** GSC shows almost no Netflix query data yet (2 queries in
  28 days). There's no baseline to protect and no demand captured.
- **Titles that predate the launch** still name only "Crunchyroll & YouTube",
  although these pages now cover Netflix: `/watch-party-app`,
  `/virtual-movie-night`, `/pricing` and `/anime-tracker` (history now includes
  Netflix). The homepage title has the same gap but is frozen until about Nov 2.
- **Chrome Web Store listing** (283 users, 8 ratings, 5.0):
  - The summary is "Ambient watch-party overlay for watching online video
    together".
  - The description names only YouTube and Crunchyroll and never uses
    "Crunchyroll watch party" or "Netflix".
  - It also says friends "can quickly catch up with the room". Check that this
    can't be read as the async catch-up feature, which is still planned only.
  - Listing text is owner-edited in the Store dashboard.

### Index coverage beyond Netflix

- **Sample of 30 random zero-impression URLs (last 28 days):**
  - 7 indexed.
  - 22 not indexed: 17 "Discovered – currently not indexed", 5 "URL is unknown
    to Google". They include watch pages, genre listicles, one genre hub and
    `/resources/group-watch-onboarding`.
  - 1 "Alternate page" with the stale apex canonical
    (`/watch-supernatural-anime-with-friends`).
- **What this means:** most zero-impression pages aren't losing a ranking
  contest; Google hasn't indexed them. Indexing problems on this scale usually
  mean Google sees the site as too large for its perceived value. That supports
  enriching fewer pages and pointing internal links at the pages that matter.
  It does not support adding URLs.

## Work packages (revised order)

The handover's rules apply to every package: owner gate, freeze until about Nov 2 on
`/`, `/watch-anime-together` and `/guides/best-anime-to-watch-with-friends`
(titles, H1s and URLs), platform claims, read-only data access, and "done means".
Commit directly to `staging` per the owner's standing instruction (fast-forward
first, never `main`, never force-push).

### A. Crunchyroll schedule upkeep (today, then every Monday)

- Update `lib/tools/crunchyroll-schedule.ts` for the week of Oct 19 (`weekStart`,
  `checked`, episodes), using the primary source the file documents. The page still
  shows Oct 12 – 18.
- Optional title test: lead with the query people use, e.g. "Crunchyroll Simulcast
  Calendar & Release Schedule — {week}", kept within 60 characters.
- Decide with the owner who owns the Monday update. A stale weekly page on a
  freshness query loses its ranking quickly.
- Acceptance: the live page shows the current week; the title and description dates
  match.

### N. Netflix launch: get the existing pages indexed (now; replaces WP10)

Use the 17 Netflix-intent URLs that already exist. Don't add new ones.

1. **Owner (Search Console, write action):** use URL Inspection → Request
   indexing on the core set: `/netflix-watch-party`,
   `/guides/watch-netflix-together`, `/guides/how-to-watch-netflix-together`,
   `/guides/does-netflix-have-a-watch-party`,
   `/compare/anidachi-vs-netflix-watch-party` and `/netflix-party`. Then request
   the two "Alternate page" URLs so Google sees the `www` canonical.
2. **Internal links from crawled, indexed pages:**
   - Add contextual links to `/netflix-watch-party` and
     `/guides/watch-netflix-together` from body copy on `/watch-party-app`
     (crawled Oct 17), `/watch-netflix-together-long-distance`,
     `/guides/teleparty-netflix` and `/compare/anidachi-vs-teleparty`.
   - Add one homepage body link where Netflix is mentioned. Body copy is allowed
     during the freeze.
   - The footer link alone hasn't been enough.
   - Give each Netflix page at least two contextual inbound links. `/netflix-movie-night`
     has 1; most have 3–4, mostly from other not-indexed pages.
3. **Titles and descriptions that predate the launch** (non-frozen pages only):
   - Add Netflix where the page covers it: `/watch-party-app`,
     `/virtual-movie-night`, `/anime-tracker`.
   - For `/pricing`, combine this with the double-brand fix in D.
   - Leave the anime and Crunchyroll pages alone; Netflix isn't their intent.
   - Record old → new titles.
4. **Claim spot-check on the core set** against
   `docs/releases/netflix-website-copy-2026-10-17.md`:
   - desktop Chrome and full Netflix watch pages only;
   - each viewer uses their own account for the same title;
   - no ad-plan compatibility claim;
   - no async catch-up.
5. **Update the canonical docs.** The "Product truth" section of
   `apps/web/docs/seo-content-guidelines.md` still says to keep Netflix copy on
   staging. The agent file's description lists only Crunchyroll and YouTube.
   Record the Oct 19 launch in both.

- **Acceptance:** links visible on the live pages; `seo:links` shows at least 2
  contextual inbound links per core Netflix page.
- **Measure:** URL Inspection on the 17 URLs weekly; Netflix query impressions in
  GSC from the week of Oct 26.

### B. Install measurement fixes (code; no URL or SEO risk)

1. Exclude `/friend/` (or `/friend/invite`) in `NON_MARKETING_PREFIXES`
   (`lib/seo-landing-path.ts:10`), with a test. Privacy fix: do this first.
2. Track the mobile handoff in `components/mobile-install-panel.tsx`. It has been
   in production since today's release with no events. Track panel opened,
   Store link clicked, link shared or copied. Reuse `desktop_install_link_copied`
   for share/copy so the series continues, with `placement: "mobile_install_panel"`.
   Use `trackConversion` so `seo_landing_path` is attached.
3. Give the hub's Store click its own event name, e.g. `extension_store_clicked`,
   sent through `trackConversion`. GA4 can then report Store clicks by landing page
   without custom dimensions. Keep the current `cta_click` too, so Amplitude
   history continues. This changes a KPI definition, so confirm the event name
   with the owner first.
4. Optional and low priority: the `web_vital` listener in `lib/web-vitals-report.ts`
   can report LCP more than once per page view, and it attributes values to the
   path current at flush time.

- Acceptance: unit tests; events seen in GA4 DebugView or the Amplitude debugger on
  staging, at 390px and 1280px.

### C. Owner checklist (GA4 admin and console work, prepared not performed)

- Mark `extension_store_clicked` (after B3), `checkout_session_started` and
  `checkout_redirect_success` as key events.
- Register event-scoped custom dimensions: `seo_landing_path`, `placement`,
  `cta_variant`, `page_template`, `metric_name`, `metric_rating`.
- Add a data filter excluding `staging.anidachi.app`, `localhost` and `127.0.0.1`.
- Request indexing for the core Netflix pages (package N, step 1).
- Update the Chrome Web Store listing text:
  - Use the summary for the main phrases: "watch party" and "watch together"
    for Crunchyroll, YouTube and Netflix.
  - Add Netflix to the description.
  - Review the "catch up with the room" sentence against the planned-only async
    feature.
  - Ask for reviews after good sessions. That's a product change, so it needs a
    separate plan.
- Set up Bing Webmaster Tools and IndexNow.
- Re-check the GSC Pages report for the host move. The API's sitemap `indexed`
  field returns 0, so the Pages report is the source.

### D. October 12 release leftovers (from WP3, verified)

- **Double brand:** switch 23 titles to `title: { absolute: "…" }` or drop the
  brand from the string. That's 15 `compare/anidachi-vs-*` pages (all except
  `-discord-screen-share`), `/pricing`, `/about`, `/contact`,
  `/discord-watch-party`, `/extension`, `/watch-crunchyroll-together`,
  `/guides/best-anime-movies-to-watch-with-friends` (renders
  "| AniDachi | AniDachi"), `/guides/best-teleparty-alternatives-for-youtube`,
  `/guides/crunchyroll-party-alternative` and
  `/guides/switch-from-discord-screen-share`. Record old → new for each.
- **Guard test:** make the regex at `lib/seo-guards.test.ts:46`
  indentation-agnostic (`^[ \t]+title:`). Then catch "AniDachi" anywhere in a title
  that also receives the template, and cover `/extension`'s `generateMetadata`.
- **`openGraph`:** add title, description and url to the six inline-metadata pages:
  `glossary/dub-vs-sub-watch-party`, `glossary/watchroom`,
  `glossary/asynchronous-watching`, `glossary/anime-simulcast`,
  `guides/anime-watch-party-ideas`, `guides/asynchronous-vs-live-watch-party`.
- **`/extension`:**
  - Make the Suspense fallback heading a non-`h1`.
  - Find why metadata is streamed into `<body>`. The page uses `useSearchParams`
    under Suspense plus `generateMetadata`.
  - Get the `<title>` and description into `<head>`. Check with
    `curl -A Googlebot`.
- **Orphans:**
  - `/guides/crunchyroll-group-watch`: hard-link it from the hub's related list
    (20-way tag tie).
  - `/compare/anidachi-vs-twoseven`: surface it on a long-distance page via
    `["compare","long-distance"]`.
  - `/guides/how-to-watch-anime-for-free-with-friends`: render the unused
    `allGuideLinks` on `/watch-anime-together:129`, or add a body link. Body only;
    this page is frozen.
  - `/watch-kdrama-together-long-distance`: in-body link from a long-distance page.
- **Hub → Teleparty guide:** in the existing Teleparty section of
  `/watch-crunchyroll-together` (`:248–258`), link
  `/guides/does-teleparty-work-with-crunchyroll` with that anchor text. Add a
  dated "tested on" line to the guide; Teleparty claims need a primary source.
- **Watch-page titles:** shorten `buildTitleTag` in `app/watch/[slug]/page.tsx:51-66`.
  Drop the "— Group Marathon" / "— Live Watchroom" / "— Group Movie Night" tails
  when the title would exceed 60 characters with the suffix.
- **Acceptance:** re-run the crawl: 0 double-brand titles, 0 pages without their own
  `og:title`, `/extension` with 1 H1. `seo:links` shows no new orphans.

### E. Homepage vs Crunchyroll hub

- **Now (body copy, allowed during the freeze):**
  - Add an exact-match link from homepage body copy to `/watch-crunchyroll-together`
    (anchor such as "Crunchyroll watch party") near the platform section.
  - Add one to `/watch-youtube-together` as well.
  - Make the hub the clearest Crunchyroll answer: it already converts at 65% from
    hub view to Store click.
- **After about Nov 2, with owner approval:** confirm in GSC that the homepage has
  moved to `www`, then propose a brand-and-product homepage title that stops
  competing for "crunchyroll watch party". This is a pillar title change, so it
  needs the owner gate.
- **Measure** weekly: hub vs. homepage impressions for the four queries above.

### F. Click-rate and conversion rewrites (replaces WP2)

| Page | Change |
|---|---|
| `/best-anime-for-long-distance-relationships` | Add "LDR anime" to the title or description, plus a section on anime *about* long-distance relationships ("ldr anime": 254 impressions at position 2.6, 0 clicks). |
| `/tools/crunchyroll-schedule` | See A. |
| `/guides/how-to-watch-crunchyroll-with-friends` | Give it a step-by-step angle that's distinct from the hub; link the hub. The title is 78 characters; bring it under 60. |
| `/guides/can-you-screen-share-crunchyroll-on-discord` | Lead the title and first paragraph with the black-screen fix. Expect little change until position improves (it ranks at about 9); add internal links from Discord pages. |
| `/guides/best-anime-to-watch-with-friends` | Frozen title and H1. Change body and CTA only: a short "watch these together" line with an inline text link to `/extension` after the first picks (a text link, not a third install card). Its mobile visitors (66 of 104) never click. |
| `/watch-anime-together` | Frozen title and H1. It sends 45 visitors to `/extension`, but only 20% click the Store. Make the above-fold CTA copy specific to anime platforms; check that the hub's mobile and desktop copy matches the promise. |
| `/glossary/anime-marathon` | One description pass; the current one is over 200 characters. Low priority. |

Keep titles at or under 60 characters including ` | AniDachi`. Record old → new in
the commit so each change can be measured and reverted.

### G. Page weight (unchanged from WP7, low risk)

- **Logo:** point `lib/brand.ts` at `/Anidachi_logo.webp` (29 KB instead of
  157 KB; WebP supports alpha). Keep the PNG for JSON-LD.
- **Session replay:** propose a lower `sessionReplay.sampleRate` to the owner
  (`lib/amplitude.ts:34`, currently 1).
- **Geist Mono:** used in 7 public places (badges and tabular numbers). Consider
  `font-variant-numeric` or a system mono stack instead.
- **Homepage:** `home-client.tsx` exists only for `useHomeScrollAssist`. Moving the
  static sections out of the client tree is a separate plan.

### H. Owner-gated (unchanged)

- **Section index pages** (WP5): `/guides`, `/compare`, `/watch`, `/glossary` and
  `/tools` all 404.
  - 15 "Compare" crumbs point to `/watch-crunchyroll-together` and 1 points to
    `/watch-anime-together`.
  - 9 glossary pages hard-code a "Glossary" crumb pointing to
    `/watch-anime-together`.
  - Both `pseo-new-guides` crumbs (`:890`, `:1021`) say "Guides".
  - Propose these through the publishing gate. Don't touch the crumbs before
    approval.
- **Authority** (WP6): draft the Chrome Web Store description, the AlternativeTo
  and Gitnux listings, and compare pages for SyncUp and Kosmi (new URLs).
- **Watch pages and genre hubs** (WP9):
  - Enrich the next watch pages by GSC impressions.
  - Produce a report-only analysis of the 70 zero-impression watch URLs and the
    11 zero-impression genre hubs.
  - Start the analysis from URL Inspection, not GSC impressions. In the sample,
    most zero-impression pages aren't indexed at all, so the question for each
    one is "enrich and link, or consolidate". Present options with evidence;
    don't merge.
- **Netflix pages** (WP10): moved into package N.

## Order of work

1. A (today).
2. B1 (privacy).
3. N, steps 2–5. The owner's step 1 runs in parallel.
4. D.
5. B2–B3.
6. E (body links).
7. F.
8. G (logo).
9. C goes to the owner in parallel with step 2.

## Re-measure

| Package | When | What |
|---|---|---|
| D, E, F | 28 days after deploy | GSC by page and by query × page |
| B | One week after deploy | Mobile panel and Store-click events by landing page |
| N | Weekly | URL Inspection on the 17 Netflix URLs; Netflix query impressions in GSC |
| All | From Oct 19 | Treat the Oct 19 release (Web, Worker, Store 0.1.4) as a change point |
| E | Weekly from Nov 2 | Hub vs. homepage for "crunchyroll watch party", "watch together crunchyroll", "crunchyroll watch together", "how to watch crunchyroll with friends" |

Re-pull with the handover's `scripts/pull-gsc-ga4.mjs` (read-only). For the Store
click by landing page, use Amplitude: `cta_click` where
`cta_variant = chrome_web_store`, grouped by event property `seo_landing_path`.
