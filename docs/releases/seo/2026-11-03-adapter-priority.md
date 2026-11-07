# Which streaming adapters to build next (2026-11-03)

Companion to [homepage positioning](2026-11-03-homepage-positioning.md).

Data: Google Ads Keyword Planner `generateKeywordHistoricalMetrics` (exact keywords, English, Google Search),
Oct 2025 – Sep 2026, run through the repo's Google Ads credentials (`apps/web/lib/google-ads`).
90 keywords: 3–9 "watch party / watch together / teleparty <platform>" phrasings per platform.
When Google returned the same monthly series for two phrasings (close variants), they're counted once.
Keyword Planner rounds into buckets, so read the numbers as orders of magnitude.

Adapters today: YouTube, Crunchyroll, Netflix, generic. The store build only allows those three hosts.

## Demand by platform (US, monthly searches)

| Platform | 12-mo avg | Median month | Jul–Sep 2026 avg | World 12-mo avg | Pattern |
|---|---:|---:|---:|---:|---|
| Netflix *(built)* | 20,173 | 16,610 | 13,977 | 93,100 | Holiday peak (Dec 37k), sliding through 2026 |
| **Prime Video** | 6,462 | 5,700 | 6,833 | 15,140 | Steady ~4–6k; spikes to 13–14k in May–Jun 2026 |
| **Hulu** | 5,167 | 3,965 | 3,027 | 5,760 | Falling: 12.6k (Oct 25) → 2.2k (Sep 26), as Hulu moves into Disney+ |
| **Disney+** | 2,747 | 2,615 | 2,437 | 6,450 | Steady 2–3.9k |
| YouTube *(built)* | 2,069 | 2,050 | 1,930 | 7,790 | Flat |
| Plex (+ Jellyfin) | 2,039 | 2,045 | 1,900 | 6,380 | Flat |
| **HBO Max** | 1,368 | 1,360 | 1,033 | 2,090 | Winter peak 2.2k, down to 760 in Sep |
| **Peacock** | 1,365 | 640 | 1,493 | 1,390 | ~500–900 base; 6.3k in Jun 2026 (sports) |
| Crunchyroll *(built)* | 806 | 780 | 633 | 2,370 | Flat |
| Apple TV | 602 | 575 | 660 | 1,090 | Flat, slightly up |
| Twitch | 318 | 340 | 310 | 1,080 | Flat |
| Paramount+ | 202 | 185 | 223 | 260 | Flat (high bid, $9.77) |
| Tubi | 168 | 165 | 150 | 170 | Flat |
| ESPN+/Fubo/YouTube TV/Sling | 110 | – | – | 120 | Tiny |
| Viki, HIDIVE, Bilibili, Pluto, DAZN, Vimeo | 10–50 each | – | – | – | No search case |

Teleparty-seeking queries ("teleparty <platform>"), a proxy for people who want an extension rather than a built-in feature:
Netflix 880, **Peacock 690**, **HBO Max 390**, Prime 240, Disney+ 140, YouTube 110, Crunchyroll 110, Apple TV 90, Hulu 70.
On Peacock this is half of all demand. On HBO Max it's close to a third.

## Recommended order

1. **Prime Video.** The largest unbuilt market in the US (~5.7k median, 6.8k recent) and worldwide (15k). Demand is
   steady and spikes with live events. Hub: `/prime-video-watch-party`.
2. **Disney+ with Hulu content.** About 2.4k Disney+ plus about 2.2–3k Hulu right now. Disney is retiring the standalone
   Hulu app in 2026 and moving Hulu's catalog into Disney+, so one Disney+ adapter covers both search groups.
   Also cover `hulu.com` for as long as it plays video. Hulu has a lot of anime, which suits AniDachi's base. Hubs: `/disney-plus-watch-party` and `/hulu-watch-party`.
   The Hulu hub should catch the falling-but-still-large "hulu watch party" demand and point to Disney+.
3. **HBO Max.** About 1–1.4k, with a high share of extension-seeking queries. The trend is down. Small, but a known brand with
   few good watch-party options. Use "HBO Max" in copy: "max watch party" gets ~20 a month.
4. **Peacock.** The base is small (~640 median), but half of it searches for an extension, and it jumped 10× during June 2026
   sports. Time the launch before a big Peacock live event, not on a quiet month.
5. **Apple TV.** ~600 and flat. SharePlay only works on Apple devices, so Chrome users on Windows have no option.

**Not now:**
- **Plex.** The volume is real (~2k), but Plex removed Watch Together from its new TV and mobile apps and kept it in the
  web app. Most searchers are on a TV or phone, where a Chrome extension can't help. Jellyfin has SyncPlay built in,
  and self-hosted domains would need broad host permissions, which store builds don't allow.
- **Twitch, Paramount+, Tubi** (150–340 each). Let the generic adapter cover them where it can.
- **Anime-only platforms** (HIDIVE, Bilibili, Viki): 10–50 searches a month. Build them only if users ask in feature requests.

## The bigger near-term lever is Netflix SEO

Netflix is already built and has more US demand (~14k a month recently) than all five recommended platforms together.
`/netflix-watch-party` had zero impressions in the last 28 days because it isn't indexed (ANI-5, ANI-6).
Fixing that comes before any new hub.

## Extension notes for each launch

- Adding a host to `STORE_VIDEO_HOST_PERMISSIONS` changes the install-time permission warning. Chrome disables the
  extension for existing users until they accept the new permission. To avoid that, request new streaming hosts as
  `optional_host_permissions` at the moment a user opens that site, or batch several platforms into one release.
- Prime Video plays on `www.primevideo.com` and `www.amazon.com/gp/video/…`. Both need covering. Its ad tier inserts
  mid-roll ads, so sync has to handle ad breaks the way the Netflix adapter handles unsupported phases.
- Each adapter launch ships with its `/<platform>-watch-party` hub, a "does <platform> have a watch party" guide and
  a "teleparty <platform>" comparison, following the Crunchyroll pattern. Publish the hub only after the adapter works in the store build.
