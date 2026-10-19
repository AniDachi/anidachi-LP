# Index coverage and consolidation report — October 19, 2026

Report only. Nothing in this document has been executed. The hard safety rules
in [`apps/web/docs/seo-content-guidelines.md`](../../../apps/web/docs/seo-content-guidelines.md)
apply: no 301/308, merge, retirement, canonical retarget or new `noindex` on a
public marketing URL without owner approval and GSC evidence. The consolidation
section lists options for the owner to decide on. It does not recommend
executing any of them.

## Summary

Of 386 sitemap URLs, 155 had zero impressions over the last 28 days. All 155,
plus the 4 genre hubs that did get impressions, were checked on Oct 19 with GSC
URL Inspection (read-only).

| Section (zero-impression URLs) | URLs | Indexed | Alternate, apex canonical | Crawled, not indexed | Discovered, not indexed | Unknown to Google |
|---|---:|---:|---:|---:|---:|---:|
| `/watch/{slug}-with-friends` | 70 | 35 | 2 | 1 | 27 | 5 |
| Genre hubs `/watch-{genre}-anime-with-friends` | 11 | 3 | 2 | 0 | 6 | 0 |
| `/guides/*` | 53 | 1 | 1 | 1 | 35 | 15 |
| Other (root 10, tools 5, compare 4, glossary 1, resources 1) | 21 | 2 | 0 | 0 | 13 | 6 |
| **Total** | **155** | **41 (26%)** | **5** | **2** | **81 (52%)** | **26 (17%)** |

The full run matches the earlier 30-URL sample (23% indexed, 57% discovered, 17%
unknown).

What the inspection data shows:

- **Over half of these URLs have never been crawled.** All 81 "Discovered" URLs
  have no `lastCrawlTime`. Google knows the URLs but hasn't fetched them.
- **The 26 "unknown" URLs have no referring URLs on record in GSC.** Google
  hasn't linked them to any page or sitemap yet.
- **Crawls of indexed pages are stale.** 34 of the 35 indexed zero-impression
  watch pages were last crawled between Jul 15 and Aug 2. The other was Sep 23.
  Every indexed URL reports `googleCanonical` on www.
- **The 7 "Alternate page with proper canonical tag" results are stale apex
  canonicals.** The last crawls were Jul 12 to Sep 26, before the Oct 12 move
  to www. They include 4 hubs (sci-fi, fantasy, shoujo, supernatural) and 3
  guides (action, isekai, sci-fi). Google's
  [Page indexing report help](https://support.google.com/webmasters/answer/7440203)
  says no action is needed for this state. A recrawl should resolve it.
- **Recent crawls do happen.** `/tools/naruto-filler-list` and
  `/tools/one-piece-filler-list` were crawled and indexed on Oct 12, the day
  they shipped.
- **The inspection API returned no `sitemap` association for any of the 159
  URLs**, including the "Submitted and indexed" ones. Treat this as an API
  field gap, not evidence of a sitemap problem. The Sitemaps report in the GSC
  UI is the place to confirm.

## Next 15 watch pages to enrich in place

Ranked by GSC impressions over the last 28 days, with apex and www rows
combined. Blue Lock, Black Clover, Attack on Titan and Death Note are already
enriched and are excluded. Volumes are small (9 to 55), so treat this as a
rough order. "—" means GSC withheld the query data (anonymized).

| # | Page (`/watch/…-with-friends`) | Impr. | Clicks | Avg pos. | Top visible query (impr.) |
|---:|---|---:|---:|---:|---|
| 1 | `mashle` | 55 | 0 | 3.7 | "anidachi" (24); "mashle episode count" (1) |
| 2 | `naruto` | 22 | 1 | 3.9 | — |
| 3 | `cyberpunk-edgerunners` | 19 | 0 | 5.4 | "how many episodes in cyberpunk edgerunners" (1) |
| 4 | `serial-experiments-lain` | 15 | 0 | 5.6 | — |
| 5 | `tokyo-revengers` | 12 | 2 | 4.7 | — |
| 6 | `tokyo-ghoul` | 12 | 1 | 6.3 | — |
| 7 | `howls-moving-castle` | 12 | 0 | 8.1 | — |
| 8 | `my-hero-academia` | 11 | 1 | 5.2 | — |
| 9 | `another` | 11 | 0 | 7.5 | — |
| 10 | `odd-taxi` | 11 | 0 | 7.5 | — |
| 11 | `danmachi` | 10 | 1 | 8.8 | — |
| 12 | `berserk` | 10 | 0 | 4.2 | — |
| 13 | `dragon-ball-z` | 10 | 0 | 4.9 | — |
| 14 | `neon-genesis-evangelion` | 10 | 0 | 7.0 | "is neon genesis evangelion on crunchyroll" (1) |
| 15 | `ergo-proxy` | 9 | 0 | 8.9 | — (tied with `mob-psycho-100`, 9 impr., pos. 7.0) |

Notes:

- The visible queries are about episode counts. That matches the format of the
  existing `WATCH_ENRICHMENT` entries (facts, a session plan, FAQ).
- The Evangelion query asks about Crunchyroll availability. Per
  `watch-page-enrichment.ts`, enrichment makes no streaming-availability
  claims.
- 24 impressions for the brand query "anidachi" on Mashle is unexpected. Check
  it in the GSC UI before treating Mashle as a title-intent winner.

## Watch URLs with zero impressions (70)

Columns: words / inbound links from sitemap pages / in force-index sitemap
(Y/N) / last crawl. Word counts are nearly identical across the template:
median 1,831 for zero-impression pages and 1,830 for pages with impressions.
Median inbound links are 7 and 8.

**Indexed but no impressions (35).** All are in the force-index sitemap.

| Slugs (words / inbound / last crawl) |
|---|
| anohana 2050/8/07-21 · black-butler 1828/5/07-15 · black-lagoon 1767/5/07-23 · bocchi-the-rock 1842/15/08-01 · cardcaptor-sakura 1800/6/07-21 |
| darling-in-the-franxx 1892/6/08-02 · demon-slayer 1881/29/08-01 · fate-stay-night-unlimited-blade-works 1930/7/08-01 · fate-zero 1759/7/07-17 · goblin-slayer 1779/6/07-23 |
| golden-kamuy 1758/5/08-01 · great-pretender 1804/7/08-01 · great-teacher-onizuka 1901/4/08-01 · gundam-iron-blooded-orphans 1961/4/09-23 · hells-paradise 1804/5/08-02 |
| initial-d 1916/5/07-25 · inuyasha 1755/5/08-01 · kakegurui 1801/4/07-16 · kingdom 1779/4/07-23 · kuroko-no-basket 1833/8/07-17 |
| parasyte 1813/10/08-02 · perfect-blue 1581/8/07-17 · planetes 1774/5/07-23 · princess-mononoke 1066/9/07-17 · re-creators 1776/4/07-18 |
| seven-deadly-sins 1858/4/08-01 · sk8-the-infinity 1873/6/07-29 · the-devil-is-a-part-timer 1944/6/07-24 · the-melancholy-of-haruhi-suzumiya 1974/5/08-01 · tower-of-god 1850/7/08-02 |
| trigun-stampede 1768/5/08-01 · wind-breaker 1843/3/08-02 · your-lie-in-april 1847/16/08-01 · yuri-on-ice 1833/6/07-17 · zom-100-bucket-list-of-the-dead 2038/6/08-01 |

**Discovered, not indexed (27). Never crawled.** Not in the force-index
sitemap: clannad, ranking-of-kings.

| Slugs (words / inbound) |
|---|
| akame-ga-kill 1804/4 · beastars 1807/5 · boruto 1853/4 · clannad 1781/9 (N) · code-geass 1953/17 · dandadan 1858/9 · fairy-tail 1783/11 |
| fullmetal-alchemist-brotherhood 1843/18 · ghost-in-the-shell-stand-alone-complex 2033/9 · hyouka 1786/7 · jojos-bizarre-adventure 1801/7 · jujutsu-kaisen 1778/30 · konosuba 1971/27 |
| made-in-abyss 1809/11 · my-neighbor-totoro 1110/7 · one-piece 1853/17 · pokemon 1785/3 · psycho-pass 1750/13 · ranking-of-kings 1837/3 (N) · rising-of-the-shield-hero 1940/7 |
| sailor-moon 1860/7 · slam-dunk 1848/12 · spy-x-family 1891/27 · suzume 1562/7 · the-disastrous-life-of-saiki-k 2013/10 · undead-unluck 1809/5 · weathering-with-you 1637/8 |

**Unknown to Google (5).** All are in the force-index sitemap, and GSC records
no referring URLs for any of them. march-comes-in-like-a-lion 1981/12 ·
no-game-no-life 1909/6 · oshi-no-ko 1903/4 · puella-magi-madoka-magica 1830/8 ·
solo-leveling 1768/12.

**Other states (3):**

- Crawled, not indexed: overlord 1744/14 (Y), last crawled Apr 30.
- Alternate, stale apex canonical: hunter-x-hunter 1798/16 (N, crawled Jul 12)
  and kabaneri-of-the-iron-fortress 1902/5 (N, crawled Jul 20).

Several titles with the most search demand (Jujutsu Kaisen, One Piece, Spy x
Family, FMA: Brotherhood, Solo Leveling) are among the uncrawled pages. Having
more inbound links does not separate the groups: Jujutsu Kaisen has 30 and is
still uncrawled.

## Genre hubs vs genre listicle guides (15 hubs)

28-day GSC data, apex and www combined. "Overlap" counts the `/watch/` links in
`<main>` on the live pages (fetched Oct 19), shown as shared / hub total /
guide total. Every hub links to its matching guide, and every guide links back.

| Genre | Hub impr/clicks | Hub index state | Hub words / inbound | Guide `/guides/best-{genre}-anime-to-watch-with-friends` impr/clicks (pos.) | Guide index state | Guide words / inbound | Overlap |
|---|---|---|---|---|---|---|---|
| action | 8 / 0 | Indexed (Jul 29) | 1227 / 69 | 24 / 1 (4.5) | Alt., apex (Sep 11) | 741 / 1 | 17 / 94 / 17 |
| comedy | 0 / 0 | Indexed (Jul 18) | 1116 / 48 | 0 / 0 | Discovered | 965 / 1 | 12 / 48 / 12 |
| fantasy | 4 / 0 | Alt., apex (Sep 22) | 1207 / 47 | 0 / 0 | Discovered | 696 / 1 | 15 / 49 / 16 |
| horror | 0 / 0 | Discovered | 1246 / 13 | 0 / 0 | Discovered | 1917 / 3 | 5 / 9 / 12 |
| isekai | 0 / 0 | Discovered | 1189 / 13 | **443 / 3 (7.4)** | Alt., apex (Sep 26) | 1330 / 385 | 9 / 9 / 14 |
| mecha | 0 / 0 | Discovered | 1251 / 8 | no guide | — | — | — |
| mystery | 2 / 0 | Indexed (Jul 30) | 1021 / 34 | no guide | — | — | — |
| psychological | 0 / 0 | Discovered | 1254 / 21 | 0 / 0 | Discovered | 1985 / 5 | 8 / 16 / 14 |
| romance | 0 / 0 | Indexed (Jul 20) | 1020 / 35 | 0 / 0 | Discovered | 1882 / 2 | 15 / 25 / 17 |
| sci-fi | 3 / 0 | Alt., apex (Sep 8) | 1135 / 25 | 0 / 0 | Alt., apex (Sep 17) | 625 / 1 | 11 / 27 / 14 |
| shonen | 0 / 0 | Discovered | 869 / 7 | 0 / 0 | Discovered | 2410 / 6 | 14 / 21 / 18 |
| shoujo | 0 / 0 | Alt., apex (Sep 8) | 1083 / 8 | no guide | — | — | — |
| slice-of-life | 0 / 0 | Discovered | 1304 / 23 | 0 / 0 | Unknown | 2264 / 3 | 12 / 21 / 17 |
| sports | 0 / 0 | Indexed (Jul 20) | 968 / 15 | 0 / 0 | Discovered | 912 / 1 | 9 / 9 / 9 |
| supernatural | 0 / 0 | Alt., apex (Sep 10) | 1085 / 33 | no guide | — | — | — |

**Query overlap.** No query in the 28-day query×page export appears on both a
hub and its guide. The hubs have no attributed queries at all; their 17
impressions are all anonymized. The visible genre queries go elsewhere:

| Query contains | Page Google showed (impr.) |
|---|---|
| shonen / shounen | `/glossary/shonen-anime` (1,408) |
| isekai | isekai guide (9) |
| romance | `/guides/best-anime-to-watch-with-girlfriend` (8) |
| action | action guide (1), anime-movies guide (1) |

So there is no measurable cannibalization. The pair problem is that neither
page ranks. The one exception is the isekai guide. It is also the only genre
guide linked from every page (385 inbound links), which fits the
internal-linking hypothesis below without proving it.

### Consolidation options (owner-gated; none recommended for execution now)

| Option | What it means | Evidence for | Risk / rule |
|---|---|---|---|
| A. Keep both and differentiate in place | Hub = genre index linking every `/watch/` title. Guide = curated top picks with editorial reasons. Enrich whichever page shows impressions first. | This is the guidelines' default action (Keep/Enrich on existing URLs). No URL changes, and no hard rule is triggered. | Low. It doesn't reduce the number of URLs Google has to crawl. |
| B. Cross-canonical (guide → hub or hub → guide) | One page in each pair declares the other as canonical. | Google treats `rel=canonical` as a strong signal, but for "duplicate or very similar pages" ([consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)). Overlap is partial (sports is 9/9/9 identical, action is 17/94/17). | **Hard rule: canonical retarget.** Google may ignore the hint where pages differ. If the isekai or action guide were canonicalized away, it would risk their impressions. |
| C. Merge + 308 for selected pairs | Fold one page into the other and redirect it. | The [crawl budget guide](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget) lists consolidating duplicates as a crawl-demand lever. | **Hard rule: 301/merge.** Needs owner approval and GSC evidence. If done at all, the isekai and action guides should be the surviving URLs, not the redirected ones. |
| D. Wait and re-measure | No change until the www move settles (about Nov 2, per guidelines). Then re-inspect these 26 URLs. | 6 of the 26 URLs are stale apex alternates that should clear on recrawl. | None. Delays any benefit by about 2 weeks. |

To decide, the owner needs: the GSC Pages report export after about Nov 2, a
re-inspection of the 26 hub and guide URLs, and 28 days of query×page data
showing whether any pair starts to split the same queries.

## What would most likely move indexing

Grounded in Google documentation:

1. **"Discovered – currently not indexed" means not crawled yet.** Google
   "found it but not crawled yet" and may reschedule the crawl to avoid
   overloading the site
   ([Page indexing report](https://support.google.com/webmasters/answer/7440203)).
   The read-only next step is the GSC Crawl stats report
   ([help](https://support.google.com/webmasters/answer/9679690)), to check
   host status, response times and crawl volume since the Oct 12 move.
2. **Crawl demand depends on perceived inventory.** Duplicate or low-value URLs
   waste crawl time. The crawl budget guide names sites with many "Discovered –
   currently not indexed" URLs as part of its audience
   ([crawl budget](https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget)).
   It also asks for sitemaps with accurate `<lastmod>`. The force-index
   sitemap must not emit a rolling "today" lastmod (`force-index-urls.ts`).
3. **Internal links help discovery.** "Every page you care about should have a
   link from at least one other page on your site"
   ([crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)).
   `/guides/how-to-watch-anime-for-free-with-friends` has 0 inbound links from
   sitemap pages. Google records no referring URL for any of the 26 "unknown"
   URLs.
4. **Pages should add value of their own.**
   [Helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
   and the [scaled content policy](https://developers.google.com/search/docs/essentials/spam-policies)
   concern pages produced at scale without added value. Title-specific
   enrichment (facts, a session plan, FAQ) is the in-place way to make each
   watch page distinct.
5. **The www move needs a recrawl.** Stale apex alternates should clear on
   recrawl ([site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)).

**Hypotheses** (not shown by the data or by Google):

- The watch pages share one template at about 1,830 words each. Google may be
  rationing crawls of these pages because the template looks low-value, which
  would explain the July/August-only crawl dates. Enriching the 15 pages above
  and re-inspecting them in about 4 weeks would test this.
- More contextual links from pages that already rank (`/`,
  `/guides/best-anime-to-watch-with-friends`, the Discord guide) to
  uncrawled watch and genre pages may speed up crawling. Inbound link count
  alone doesn't explain the gap, though: `/contact`, `/netflix-watch-party`,
  `/discord-watch-party`, `/anime-watch-party-toolkit` and the couple and
  beginners guides are linked from all 385 sitemap pages and are still
  "Discovered".
- The fast crawl of the new filler-list tools on Oct 12 suggests Google
  crawls new pages with a distinct purpose quickly. More template pages may
  not get the same treatment.

## Data and method

- Report date: 2026-10-19.
- GSC Search Analytics (`sc-domain:anidachi.app`, apex and www combined by
  path): pages and query×page for 2026-09-21 to 2026-10-18 (28 days).
  Date×page for 2026-09-28 to 2026-10-19.
- GSC URL Inspection (read-only), run 2026-10-19: 155 zero-impression URLs, the
  4 hubs with impressions, and the action and isekai guides (161 calls, 0
  errors). The run made no indexing requests.
- Live crawl (`pages_post_release.tsv`, 386 sitemap URLs) and live HTML for 15
  hubs and 11 matching guides, fetched 2026-10-19. The mecha, mystery, shoujo
  and supernatural guides return 404 because they don't exist.
- Raw inspection JSON is kept in the session scratchpad, not committed.
