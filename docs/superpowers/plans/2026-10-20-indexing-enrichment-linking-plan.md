# Indexing, enrichment and internal-linking plan (October 20, 2026)

Status: proposed. Owner approvals recorded on Oct 20 are listed in section 1.
Record them in the decisions log of `apps/web/docs/seo-content-guidelines.md`
when the first change ships.

Evidence (all read-only, Oct 20):

- URL Inspection of all 393 sitemap URLs.
- Keyword Planner (US monthly searches).
- GSC queries and pages, 90 days.
- GA4 conversions by landing page, 90 days.
- A live crawl of `www.anidachi.app`.

## 0. What the data says

| Index state (URL Inspection) | URLs |
|---|---|
| Indexed on `www` | 237 |
| Indexed on the apex URL ("Alternate page with proper canonical tag"). These count; they move to `www` on recrawl. | 38 |
| URL is unknown to Google | 69 |
| Discovered – currently not indexed | 42 |
| Crawled – currently not indexed | 6 |
| 404 on Google's last crawl (`/tools`, created Oct 19) | 1 |

The 117 unindexed URLs break down as:

- 51 guides
- 35 watch pages
- 15 root pages, including `/netflix-watch-party`, `/netflix-party`,
  `/discord-watch-party` and the five section index pages
- 6 genre hubs
- 5 compare pages
- 3 tools
- 2 glossary pages
- 1 resources page

Why these pages are ignored:

1. **Thin and twinned.** About 250 words of each crawl count is shared nav and
   footer: `/contact` measures 246. The unindexed Netflix and Discord pages measure
   500–600 words, which leaves roughly 250–350 unique words each. Several cover the
   same intent:
   - `watch-netflix-together`, `how-to-watch-netflix-together` and
     `how-to-watch-netflix-with-friends`
   - `discord-watch-together` and `discord-watch-together-activity`
   - `can-you-stream-crunchyroll-on-discord` and `can-you-screen-share-crunchyroll-on-discord`
   - `netflix-party` and `guides/netflix-party-extension`

   Google discovers these pages and decides they are not worth crawling.
2. **Links come from weak or rarely crawled pages.** Many existing inbound links
   sit on pages Google last crawled 70–90 days ago. Several were added on Oct 19
   and have not been seen yet.

Which pages convert (GA4, 90 days):

| Page type | Checkouts per 1k users | Install-page views per 1k users |
|---|---|---|
| Platform hubs (`/watch-crunchyroll-together`) | 18 | 152 |
| Discord, Teleparty and Crunchyroll how-to guides | 0–3 | 40–50 |
| Anime lists, watch pages, glossary | 0 | ~5 |

Enrichment therefore starts with the Netflix, Discord and Crunchyroll commercial
pages. Anime lists, genre hubs and watch pages wait for the Nov 2 re-measure
(owner decision, option A).

## 1. Owner-approved builds (Oct 20)

| # | Page | Type | Target searches (US/month) |
|---|---|---|---|
| 1 | `/netflix-watch-party` → full Netflix hub | Upgrade (same URL) | netflix watch party 8,100 · watch parties netflix 1,300 · netflix together 320 |
| 2 | `/tools/crunchyroll-schedule` | Upgrade (same URL) | crunchyroll release schedule 6,600 · release calendar 6,600 · schedule 5,400 · simulcast calendar 4,400 · calendar 2,900 · anime schedule 2,400 |
| 3 | `/tools/crunchyroll-dub-schedule` | **New URL** | crunchyroll dub schedule 720 · dub release schedule 260 · english dub schedule/release 220 · one piece dub release date 1,900 · next one piece dub release 320 |
| 4 | `/guides/how-to-screen-share-netflix-on-discord` | Upgrade (same URL) | how to stream netflix on discord 5,400 · how to screen share netflix on discord 1,600 · how to stream/watch movies on discord 960 · mobile 280 · netflix black screen discord 140 |
| 5 | `/guides/is-teleparty-free` | **New URL** | is teleparty safe 880 · is teleparty free 720 · how to use teleparty 480 · teleparty premium 390 · teleparty review 110 |

Not approved: #6 the Crunchyroll plans guide, #7 Netflix anime list, #8 the
streaming-services matrix. Do not reposition `/glossary/crunchyroll-mega-fan`
into a pricing guide.

## 2. The bar for an indexable page

Every page in sections 3 and 4 must meet all of these before it asks Google to recrawl:

- **One job.** A single search intent that no other AniDachi URL serves. When two
  pages share one, either give them different jobs (the default) or propose a 301
  to the owner. Merges and 301s need owner approval and GSC evidence.
- **At least 800 words of unique body text,** excluding nav, footer and the shared
  CTA blocks. Measure by diffing against `/contact`.
- **Something first-hand:** a real screenshot of the AniDachi flow, a tested-on
  date, real limits (desktop Chrome, own account per person, friends join free),
  a comparison table, or a decision box.
- **An answer in the first 60 words,** written so it can be quoted (featured
  snippet and AI answers).
- **FAQ built from real questions:** GSC queries and People Also Ask, not invented.
- **An honest `dateModified`.**
- **Calls to action that match the reader:**
  - an `InstallLink` through `midContentSlot` after the first useful section;
  - the bottom `PrimaryCheckoutCta`;
  - a link to the parent hub.
- **Inbound links:** at least two contextual body links from indexed pages
  (section 5). Each must sit in a sentence, not in a related-links list.

## 3. Enrichment plans for the approved pages

### 3.1 `/netflix-watch-party`: the Netflix hub (approved #1)

Today: about 590 words, unknown to Google, linked from the footer and 6 pages.

Model it on `/watch-crunchyroll-together`, the page that converts. Target about
1,800 words of unique body text. Do not change the H1's intent; it is not a frozen page.

| Section | Content |
|---|---|
| Answer block | "Netflix has no built-in watch party. AniDachi syncs a Netflix movie or episode across desktop Chrome; everyone uses their own Netflix account, and friends join free." |
| How it works | 4 steps with real screenshots: install, open a Netflix title, create the room, share the link |
| What works | Movies and episodes, desktop Chrome, voice and video, push-to-talk. Each person needs their own Netflix account. Claim no ad-tier support until it is verified |
| Does everyone need Netflix? | Answers "does everyone need netflix for teleparty" (40/month); merged here instead of a new URL |
| Netflix watch party not working | Short checklist: region catalogs, different profiles, browser, extension pinned. Covers the zero-volume competitor topics as sections, not URLs |
| Netflix on Discord | Two sentences, then a link to `/guides/how-to-screen-share-netflix-on-discord` |
| AniDachi vs Teleparty on Netflix | 5-row table, linking to `/compare/anidachi-vs-teleparty` and `/guides/is-teleparty-free` |
| Plan ideas | Links to `netflix-movie-night` and `netflix-group-watch` (section 4.1) |
| FAQ | 6–8 questions from GSC and People Also Ask |

### 3.2 `/tools/crunchyroll-schedule` (approved #2)

Today: indexed and crawled every few days. It had 1,270 impressions in its first
week at position ~7, almost all for "simulcast calendar".

- **Title:** `Crunchyroll Release Schedule & Simulcast Calendar (Oct 19–25)`.
  It must stay at or under 60 characters with the suffix, so shorten the date
  range format if needed. Put "release schedule" in the H1 as well.
- **Intro:** 60 words naming the week, the time zone, and how many episodes air.
- **Time-zone switch:** client-side; default ET, with PT, UK, CET, IST and JST.
- **Each slot links** to the show's `/watch/{slug}-with-friends` page when one exists.
- **"English dubs this week" box:** links to the new dub schedule (#3).
- **Mid-page CTA:** "Watch this week's episodes together", using `InstallLink`.
- **Keep the Monday update.** Request indexing after each update (the owner's step).

### 3.3 `/tools/crunchyroll-dub-schedule`: new (approved #3)

- **Parent hub:** `/tools`.
- **Inbound links:** see section 5, which lists 5 indexed sources.
- **Content:** weekly English dub release times for current Crunchyroll dubs,
  plus a "next dub episode" line for long runners (One Piece and others).
- **Source:** Crunchyroll's official announcements. Record the source and the
  check date for each row.
- **Sections:**
  - how dubs lag simulcasts;
  - how to pick sub or dub for a group (link to `/sub-vs-dub`);
  - "Watch the dub together" CTA;
  - FAQ: "when do dubs come out on Crunchyroll", "next One Piece dub".
- **Upkeep:** weekly, the same Monday routine as #2. Without the weekly update
  the page goes stale and should not ship.

### 3.4 `/guides/how-to-screen-share-netflix-on-discord` (approved #4)

Today: about 612 words, unknown to Google, 4 inbound links.

- **Title:** `How to Stream Netflix on Discord (Black Screen Fix)`, 52 characters before the suffix.
- **Answer block:** Netflix shows black on Discord because the stream is DRM-protected. Explain what
  people try (browser hardware acceleration, window vs screen capture) and its
  limits. Do not give steps that defeat DRM, and point to Netflix's terms.
- **Section "Watch in sync instead":** voice in Discord, video through AniDachi.
  Four steps with screenshots.
- **Comparison table, screen share vs AniDachi:** picture quality, audio, lag,
  whether everyone needs Netflix, and what the host's upload limits.
- **Mobile section:** for "how to stream netflix on discord mobile" (280).
- **"How to watch movies on Discord" section** (960): Discord's Watch Together
  activity is YouTube only.
- **FAQ:** from GSC queries in this cluster.
- **Links out:** the Netflix hub, `/discord-watch-party`, and the Crunchyroll Discord guide.

### 3.5 `/guides/is-teleparty-free`: new (approved #5)

- **Parent:** `/compare/anidachi-vs-teleparty`.
- **Content:**
  - price and Premium tiers;
  - ads;
  - supported platforms;
  - mobile;
  - "is it safe" (permissions it requests, the privacy-policy points);
  - "how to use it" in 4 steps.
- **Sources:** each claim cites teleparty.com, the Chrome Web Store listing or
  the privacy policy, with a check date. Review on 30, 60 and 90 days.
- **Fairness:** where Teleparty is the better fit (mobile, Disney+ or Hulu), say so.
- **CTA:** "For Crunchyroll, YouTube and Netflix with voice: try AniDachi; friends join free".
- **Covers as sections, not URLs:** "is teleparty safe" (880) and "how to use teleparty" (480).

## 4. Enrichment plans for other ignored pages (same URLs, no approval needed)

These are same-URL rewrites. The default is to give each twin its own job. A
merge proposal is listed where the overlap cannot be fixed; those need the owner.

### 4.1 Netflix cluster (8 unindexed pages)

| Page | State | New job and enrichment | Merge proposal |
|---|---|---|---|
| `/netflix-party` | Unknown | Keyword: "netflix party" (9,900). Job: the name history. Netflix Party became Teleparty: timeline, what it does now (sourced), a dated table of 2026 options, and how to start a Netflix party with AniDachi. ~1,200 words | Absorb `/guides/netflix-party-extension` (same intent, 500 words) |
| `/guides/watch-netflix-together` | Discovered | Keyword: "watch netflix together" (1,300). Job: the ways to do it compared (countdown, Discord share, Teleparty, AniDachi), each with pros and cons in a decision table | Absorb `/guides/how-to-watch-netflix-together` |
| `/guides/how-to-watch-netflix-with-friends` | Indexed on the apex | Keep as the step-by-step how-to. Add screenshots and a troubleshooting box | — |
| `/guides/netflix-group-watch` | Unknown | Job: groups of 3–10+. Room size, roles and host controls, push-to-talk etiquette, different time zones | — |
| `/guides/netflix-movie-night` | Unknown | Job: planning one film. A pick list by mood with runtimes, a start-time converter, and a checklist | — |
| `/guides/does-netflix-have-a-watch-party` | Unknown | A dated, quotable answer. Keep it short; it answers one question | Or fold into the hub as its answer block |
| `/compare/anidachi-vs-netflix-watch-party` | Unknown | Unclear role: Netflix has no product called "Netflix Watch Party". Rewrite as "AniDachi vs Netflix screen share and countdown methods", or merge | Into the hub |

### 4.2 Discord cluster

| Page | State | Enrichment | Merge proposal |
|---|---|---|---|
| `/discord-watch-party` | Unknown (footer-linked) | Keyword: "discord watch party" (480). Job: the Discord hub. A table of Watch Together activity (YouTube only) vs screen share vs AniDachi, a setup for each platform, server-event tips, and links to the platform guides. ~1,400 words | — |
| `/guides/discord-watch-together` | Unknown | Keyword: "discord watch together" (720). What the activity does and doesn't do, and step-by-step setup | Absorb `/guides/discord-watch-together-activity` |
| `/guides/can-you-stream-crunchyroll-on-discord` | Unknown | Same intent as the indexed `/guides/can-you-screen-share-crunchyroll-on-discord` (957 impressions) | 301 into it |

### 4.3 Crunchyroll pages built to convert

| Page | State | Enrichment |
|---|---|---|
| `/guides/crunchyroll-watch-party-not-working` | Unknown | Real failure states from the extension (not synced, region, Premium-only episode, ad tier, browser, extension not pinned), each with a fix and a screenshot |
| `/guides/crunchyroll-watch-party-chrome-extension` | Unknown | Install walkthrough with screenshots, the permissions explained in plain language, and a short comparison with the other Crunchyroll extensions |
| `/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing` | Discovered | Keywords: "crunchyroll account sharing" and "share account" (960). Retitle as "Crunchyroll Account Sharing: Rules, Limits and a Better Way". Add Crunchyroll's terms (sourced) and streams per plan (verify) |
| `/guides/does-everyone-need-crunchyroll-premium-for-watch-party` | Unknown | Plan table (Fan, Mega Fan, Ultimate), what free users can watch, and the region note |
| `/guides/does-crunchyroll-have-watch-party` | Discovered | Already 1,327 words. A dated answer in the first lines, then history (Crunchyroll features, the Funimation shutdown). Mainly needs links |

### 4.4 Schedule, movies and free-anime pages

| Page | State | Enrichment |
|---|---|---|
| `/glossary/anime-simulcast` | Indexed, invisible (4 impressions) | Keyword: "simulcast meaning" (2,400). A 40-word definition first, then a sub vs dub timing diagram and a link to the schedule tool |
| `/guides/how-to-watch-seasonal-anime-together` | Discovered | This season's lineup with a weekly ritual plan. Linked from the schedule tool |
| `/guides/watch-movies-together-online` | Unknown | Keywords: watch movies together online 1,300 · with friends online 720. Reposition now that Netflix is live: "Netflix, YouTube and anime films", with a movie-night flow and a picks table |
| `/guides/how-to-watch-anime-for-free-with-friends` | Unknown | Keywords: free anime on youtube 780 · legal anime sites ~400. A list of official free channels (Muse Asia, Ani-One and others, checked and dated) and the free-tier path: host free, friends free |

### 4.5 Ask Google to index, without rewriting

The section index pages `/guides`, `/compare`, `/watch`, `/glossary` and `/tools`
(Google last saw `/tools` as a 404) were built on Oct 19 and already meet the bar.
Request indexing.

### 4.6 Not now

Leave these for the Nov 2 re-measure; they convert least:

- 35 watch pages
- 6 genre hubs
- 11 genre "best X anime" guides
- anime lists
- YouTube long-tail guides
- `/glossary/crunchyroll-mega-fan` (#6 not approved)

## 5. Internal links: from indexed pages to ignored pages

How sources were chosen:

- Indexed (on `www` or the apex).
- Crawled recently, so Google finds the link fast. Recency is shown as "d" =
  days since the last crawl.
- On the same topic.
- **No existing in-body link** to the target. Checked on Oct 20 against each
  source's HTML, ignoring the footer.

At most 3 new contextual links per source page. Put each one in a body sentence,
in the first half of the page, with descriptive anchor text. Avoid exact-match
anchors on more than one source per target.

| Target (state) | Source (indexed, crawl age, 90-day impressions) | Anchor text | Where on the source page |
|---|---|---|---|
| `/netflix-watch-party` (unknown) | `/watch-crunchyroll-together` (apex, d10, 5,655) | "Netflix watch party" | "Other platforms" paragraph |
| | `/best-apps-watch-anime-together-long-distance` (d6, 2,522) | "host a Netflix watch party" | Netflix row of the apps table |
| | `/guides/best-anime-movies-to-watch-with-friends` (d5, 393) | "watch Netflix films together" | Intro, where it mentions anime films on Netflix |
| | `/pricing` (d15, 925) | "Netflix watch parties" | Plan features list |
| `/netflix-party` (unknown) | `/compare/anidachi-vs-teleparty` (d1, 922) | "Netflix Party, now called Teleparty" | History or intro line |
| | `/best-apps-watch-anime-together-long-distance` (d6) | "the old Netflix Party extension" | Teleparty row |
| | `/guides/best-teleparty-alternatives-for-anime` (d72) | "what happened to Netflix Party" | Intro |
| `/guides/how-to-screen-share-netflix-on-discord` (unknown) | `/guides/can-you-screen-share-crunchyroll-on-discord` (d28, 957) | "stream Netflix on Discord" | "Same problem on other services" line |
| | `/guides/how-to-watch-anime-with-friends-on-discord` (apex, d17, 1,069) | "Netflix black screen on Discord" | Black-screen section |
| | `/guides/discord-screen-share-black-screen` (d11) | "fix the Netflix black screen" | DRM paragraph |
| | `/compare/anidachi-vs-discord-screen-share` (d28) | "Netflix on Discord" | Platform list |
| `/discord-watch-party` (unknown) | `/guides/how-to-watch-anime-with-friends-on-discord` (apex, d17) | "Discord watch party" | Intro |
| | `/guides/crunchyroll-watch-party-with-discord` (d22, 134) | "set up a Discord watch party" | Setup section |
| | `/compare/anidachi-vs-discord-screen-share` (d28) | "Discord watch party guide" | Verdict box |
| `/guides/watch-netflix-together` (discovered) | `/best-apps-watch-anime-together-long-distance` (d6) | "ways to watch Netflix together" | Netflix row |
| | `/watch-party-app` (d2) | "watch Netflix together" | Platform section |
| `/tools/crunchyroll-dub-schedule` (new) | `/tools/crunchyroll-schedule` (d6, 729) | "English dub schedule" | Dubs box |
| | `/guides/dubbed-anime-on-crunchyroll` (d23) | "Crunchyroll dub schedule" | Intro |
| | `/guides/english-dubbed-anime` (d21) | "this week's English dubs" | Intro |
| | `/sub-vs-dub` (d23) | "when dubs come out" | Timing section |
| | `/glossary/dub-vs-sub-watch-party` (d94) | "dub release schedule" | Definition footer |
| `/tools/crunchyroll-schedule` (indexed; strengthen it) | `/watch-crunchyroll-together` (apex, d10) | "Crunchyroll release schedule" | "What to watch" paragraph |
| | `/glossary/anime-simulcast` (d94) | "this week's simulcast calendar" | After the definition |
| | `/tools/random-anime-generator` (d6, 219) | "what's airing on Crunchyroll this week" | Below the results |
| `/guides/is-teleparty-free` (new) | `/compare/anidachi-vs-teleparty` (d1) | "Is Teleparty free?" | Pricing row of the table |
| | `/guides/teleparty-netflix` (d6) | "Teleparty Premium and pricing" | Intro |
| | `/guides/does-teleparty-work-with-crunchyroll` (d38) | "what Teleparty costs" | Answer block |
| | `/compare/anidachi-vs-syncup` (d1) | "Teleparty's free and paid tiers" | Alternatives paragraph |
| `/guides/crunchyroll-watch-party-not-working` (unknown) | `/watch-crunchyroll-together` (apex, d10) | "Crunchyroll watch party not working?" | FAQ |
| | `/guides/teleparty-not-working-crunchyroll` (d88) | "AniDachi troubleshooting" | Fixes section |
| | `/guides/how-to-sync-crunchyroll-with-friends` (d18) | "if the room won't sync" | Steps |
| `/guides/crunchyroll-watch-party-chrome-extension` (unknown) | `/compare/anidachi-vs-crunchyroll-party` (d4) | "Crunchyroll watch party extension" | Intro |
| | `/extension` (d25, 387) | "how the Crunchyroll extension works" | Below the install steps |
| `/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing` (discovered) | `/guides/can-you-screen-share-crunchyroll-on-discord` (d28) | "Crunchyroll account sharing" | Accounts paragraph |
| `/guides/does-crunchyroll-have-watch-party` (discovered) | `/guides/best-anime-to-watch-with-friends` (apex, d16, 1,963) | "Crunchyroll has no built-in watch party" | How-to-watch note (body only; title and H1 frozen) |
| `/guides/how-to-watch-seasonal-anime-together` (discovered) | `/glossary/anime-simulcast` (d94) | "watch seasonal anime together" | End of the definition |
| | `/watch-anime-together` (apex, d16, 3,200) | "seasonal anime with friends" | Body only (title and H1 frozen) |
| `/guides/watch-movies-together-online` (unknown) | `/guides/best-anime-movies-to-watch-with-friends` (d5) | "watch movies together online" | Setup section |
| | `/best-anime-for-long-distance-relationships` (d2, 770) | "watch a movie together online" | Movie picks section |
| `/guides/how-to-watch-anime-for-free-with-friends` (unknown) | `/tools/random-anime-generator` (d6) | "free, legal anime to watch with friends" | Below the results |
| | `/watch-anime-together` (apex, d16) | "watch anime free with friends" | Body only |
| `/guides`, `/tools` (unknown / old 404) | `/watch-anime-together` (apex) → `/guides`; `/tools/crunchyroll-schedule` → `/tools` | "all watch-party guides" / "more anime tools" | Body footer line |

Totals: 43 new contextual links across 29 source pages. No source gets more than 3.

## 6. Order of work

1. **Ship the enrichment of #1, #2 and #4 first,** with their inbound links. They
   have the most search demand and the right intent.
2. **Build #3 and #5,** each with all of its inbound links in the same deploy, and
   add both to the `/tools` and `/guides` index lists. They are new URLs, so the
   publishing gate applies.
3. **Rewrite the pages in section 4.1–4.4** with their links, one cluster per
   deploy: Netflix, then Discord, then Crunchyroll, then schedule, movies and free anime.
4. **Send merge proposals to the owner, with GSC evidence:**
   - `netflix-party-extension` → `/netflix-party`
   - `how-to-watch-netflix-together` → `/guides/watch-netflix-together`
   - `discord-watch-together-activity` → `/guides/discord-watch-together`
   - `can-you-stream-crunchyroll-on-discord` → `/guides/can-you-screen-share-crunchyroll-on-discord`
   - `/compare/anidachi-vs-netflix-watch-party` → the Netflix hub
5. **The owner requests indexing** after each deploy, at about 10 a day, in this
   order: the 5 approved pages, then the section index pages, then the clusters in
   step 3's order.

## 7. Measure

- **Weekly:** re-run URL Inspection on every page in sections 3–5. The data is in
  `scratchpad/kw/inspect_all.json`; the script is in the handover folder.
  Success: the page moves from unknown/discovered to indexed within 2–4 weeks of
  its deploy.
- **28 days after each deploy:** impressions and clicks per target query (GSC),
  and install-page views and `extension_store_clicked` per landing page (GA4,
  once the key events are set).
- **If a page is still unindexed after 6 weeks** with its links in place,
  propose merging it into its hub rather than enriching it further.
