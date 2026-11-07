# Search Console indexing requests (October 19, 2026)

Run these in Search Console: URL Inspection, paste the URL, then **Request indexing**. Google allows about 10 requests a day per property, so they are split into days, most valuable first. Status is from URL Inspection on Oct 19.

**Once, today:** in Sitemaps, resubmit `https://www.anidachi.app/sitemap.xml`. That covers every other changed page; Google recrawls those on its own schedule.

## Day 1 (today)

| URL | Why | Status Oct 19 | Impressions (28 days) |
|---|---|---|---|
| https://www.anidachi.app/watch-crunchyroll-together | new title; Google still indexes the old apex URL | Alternate (old apex canonical) | 4,531 |
| https://www.anidachi.app/guides/how-to-watch-crunchyroll-with-friends | new title and description | Alternate (old apex canonical) | 1,521 |
| https://www.anidachi.app/compare/anidachi-vs-teleparty | new title, Netflix copy | Alternate (old apex canonical) | 496 |
| https://www.anidachi.app/netflix-watch-party | Netflix launch page, not indexed | Unknown to Google | 0 |
| https://www.anidachi.app/guides/watch-netflix-together | Netflix launch page, not indexed | Discovered, not indexed | 0 |
| https://www.anidachi.app/compare/anidachi-vs-syncup | new page | Unknown to Google | 0 |
| https://www.anidachi.app/compare/anidachi-vs-kosmi | new page | Unknown to Google | 0 |
| https://www.anidachi.app/best-anime-for-long-distance-relationships | new LDR anime title and section | Indexed | 1,043 |
| https://www.anidachi.app/guides/can-you-screen-share-crunchyroll-on-discord | new title; last crawled Sep 21 | Indexed | 1,859 |
| https://www.anidachi.app/tools/crunchyroll-schedule | new week and title (repeat every Monday) | Indexed | 1,149 |

## Day 2

| URL | Why | Status Oct 19 | Impressions (28 days) |
|---|---|---|---|
| https://www.anidachi.app/watch-anime-together | body links and CTA; still indexed on the apex URL | Alternate (old apex canonical) | 2,917 |
| https://www.anidachi.app/guides/best-anime-to-watch-with-friends | install link; still indexed on the apex URL | Alternate (old apex canonical) | 2,882 |
| https://www.anidachi.app/extension | new title, one H1, title now in head for Googlebot | Indexed | 633 |
| https://www.anidachi.app/pricing | new title | Indexed | 617 |
| https://www.anidachi.app/compare/anidachi-vs-netflix-watch-party | Netflix, not known to Google | Unknown to Google | 0 |
| https://www.anidachi.app/guides/how-to-watch-netflix-together | Netflix, not indexed | Discovered, not indexed | 0 |
| https://www.anidachi.app/guides/does-netflix-have-a-watch-party | Netflix, not known to Google | Unknown to Google | 0 |
| https://www.anidachi.app/netflix-party | Netflix, not indexed | Discovered, not indexed | 0 |
| https://www.anidachi.app/guides/how-to-watch-netflix-with-friends | Netflix; still indexed on the apex URL | Alternate (old apex canonical) | 8 |
| https://www.anidachi.app/guides/best-anime-movies-to-watch-with-friends | double-brand title fixed | Indexed | 754 |

## Day 3

| URL | Why | Status Oct 19 | Impressions (28 days) |
|---|---|---|---|
| https://www.anidachi.app/watch/blue-lock-with-friends | showed another anime's poster and score | Indexed | 73 |
| https://www.anidachi.app/watch/attack-on-titan-with-friends | episode count fix | Indexed | 76 |
| https://www.anidachi.app/watch/mashle-with-friends | enriched; still indexed on the apex URL | Alternate (old apex canonical) | 55 |
| https://www.anidachi.app/glossary/anime-marathon | new description; last crawled Sep 14 | Indexed | 489 |
| https://www.anidachi.app/about | single-brand title; still indexed on the apex URL | Alternate (old apex canonical) | 327 |
| https://www.anidachi.app/compare/anidachi-vs-rave | single-brand title; still indexed on the apex URL | Alternate (old apex canonical) | 120 |
| https://www.anidachi.app/watch-party-app | Netflix title and links | Indexed | 58 |
| https://www.anidachi.app/virtual-movie-night | Netflix title, not indexed | Discovered, not indexed | 0 |
| https://www.anidachi.app/guides/netflix-group-watch | Netflix, not indexed | Discovered, not indexed | 0 |
| https://www.anidachi.app/guides/netflix-movie-night | Netflix, not indexed | Discovered, not indexed | 0 |

## Day 4

| URL | Why | Status Oct 19 | Impressions (28 days) |
|---|---|---|---|
| https://www.anidachi.app/watch/naruto-with-friends | enriched | Indexed | 22 |
| https://www.anidachi.app/watch/cyberpunk-edgerunners-with-friends | enriched; showed another anime's data | Indexed | 19 |
| https://www.anidachi.app/watch/berserk-with-friends | enriched; showed Pokemon's data | Indexed | 10 |
| https://www.anidachi.app/watch/serial-experiments-lain-with-friends | enriched | Indexed | 15 |
| https://www.anidachi.app/watch/tokyo-revengers-with-friends | enriched | Indexed | 12 |
| https://www.anidachi.app/watch/tokyo-ghoul-with-friends | enriched | Indexed | 12 |
| https://www.anidachi.app/watch/howls-moving-castle-with-friends | enriched | Indexed | 12 |
| https://www.anidachi.app/watch/my-hero-academia-with-friends | enriched, episode count fix | Indexed | 11 |
| https://www.anidachi.app/guides/netflix-party-for-crunchyroll | Netflix; still indexed on the apex URL | Alternate (old apex canonical) | 21 |
| https://www.anidachi.app/guides/how-to-screen-share-netflix-on-discord | Netflix, not indexed | Discovered, not indexed | 0 |

## After the section index pages are deployed (commit 230ec426, not pushed yet)

| URL | Why |
|---|---|
| https://www.anidachi.app/guides | new section index page |
| https://www.anidachi.app/compare | new section index page |
| https://www.anidachi.app/watch | new section index page |
| https://www.anidachi.app/glossary | new section index page |
| https://www.anidachi.app/tools | new section index page |

Resubmit the sitemap again after that deploy.

## No request needed

The other 62 changed pages (mostly indexed watch, compare and glossary pages with small edits) will be picked up from the sitemap. Request any of them only if quota is left over.
