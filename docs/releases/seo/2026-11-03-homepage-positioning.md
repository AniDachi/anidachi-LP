# Homepage positioning for a multi-platform AniDachi (2026-11-03)

> **Status: partly superseded by [the plan audit](2026-11-03-landing-page-plan-audit.md).** The audit found that
> moving Crunchyroll and anime searches from the homepage to the hubs would lose installs (homepage 24.6%
> store-click rate vs 5.7% for the Crunchyroll hub), that category demand is overstated, and that the proposed
> copy names Prime Video before it is supported. Read the audit before acting on the rollout below.

Question: once AniDachi supports Prime Video, HBO Max and more, what should the homepage rank for,
so it grows, feeds the platform clusters and does not take their traffic?

Data:
- Search Console `sc-domain:anidachi.app`, Oct 5 – Nov 1 2026 (28 days), `data_state: all`, read-only via Composio.
- Google Ads Keyword Planner, US, average monthly searches, via `apps/web/lib/google-ads/client.ts`.
  Volumes are Keyword Planner buckets, so treat them as orders of magnitude.

## Where the homepage stands

Title: `AniDachi — Watch Together on Crunchyroll, YouTube & Netflix` (drafted in the working tree, uncommitted).
H1: "Your friends are watching without you. Fix that." It names no keyword.

Homepage impressions, 28 days, by query group:

| Group | Impr. | Clicks |
|---|---:|---:|
| Crunchyroll co-watch | 1,222 | 37 |
| Anime co-watch ("watch anime together" etc.) | 844 | 38 |
| Brand ("anidachi") | 587 | 413 |
| Competitor + Crunchyroll ("teleparty crunchyroll") | 463 | 16 |
| Generic co-watch ("watch party", "watch together online") | 34 | 0 |
| Netflix, Discord, other platforms | 8 | 1 |

Site-wide, platform-agnostic co-watch queries had **82 impressions in 28 days**, and Prime/HBO/Disney/Hulu had 10.
AniDachi today is an anime and Crunchyroll site in Google's eyes.

The homepage also takes the Crunchyroll hub's queries. It has 72–80% of impressions for
"crunchyroll watch party", "crunchyroll watch together", "watch party crunchyroll" and
"watch together crunchyroll". This is ANI-7, and the drafted title (which names Crunchyroll) keeps it that way.

`/watch-party-app` targets the generic "watch party app" idea but got 45 impressions, 36 of them for "anidachi".
`/netflix-watch-party`, `/watch-movies-together-long-distance` and `/virtual-movie-night` had zero (not indexed, ANI-5).

## Demand (US, monthly)

| Cluster | Main queries | Approx. total |
|---|---|---:|
| Teleparty brand | teleparty 49.5k, teleparty browser extension 12.1k, teleparty watch party 8.1k | 88k |
| Generic co-watch | watch party 27.1k (mixed intent: sports, TV show), watch party app 1.3k, watch movies together online 1.3k, stream together 880, watch movies with friends online 720, watch party extension 110 | 60k |
| Netflix | netflix party 9.9k (mostly Teleparty navigational), netflix watch party 8.1k, watch netflix together 1.3k | 32k |
| Prime Video | amazon prime video watch party 2.4k, amazon/amazon prime watch party 1k each, prime video watch party 880 | 9k |
| Disney+ | disney plus watch party 880, disney+ groupwatch 480 | 6k |
| Hulu | hulu watch party 5.4k | 6k |
| Long distance | watch movies together long distance 480 (×4 variants), long distance movie streaming 320 | 3.5k |
| HBO Max | hbo max watch party 480, hbo watch party 320, teleparty for hbo max 210 | 1.8k |
| YouTube | youtube watch party 880 | 1.7k |
| Crunchyroll | crunchyroll watch party 480, three "watch together" variants 170 each | 1.3k |
| Anime (non-Crunchyroll) | watch anime together 140, anime watch together 140, anime watch party 90 | 0.6k |

Two things follow:

1. The anime + Crunchyroll market AniDachi ranks in today is about **2k searches a month**. Netflix, Prime, Hulu
   and Disney+ together are about **50k**. The growth is in the platform clusters, not the homepage.
2. Platform demand is phrased **"<platform> watch party"** in every cluster. That is the hub keyword, and the
   homepage should not compete for it.

## Recommendation

### The homepage owns the category, the hubs own the platforms

| Tier | Page | Owns | Never targets |
|---|---|---|---|
| 0 | Homepage | Brand + category: "watch party extension", "watch together online", "watch movies together online", "stream together", "sync streaming with friends", "teleparty alternative" (supporting) | Any "<platform> watch party" query |
| 1 | Platform hubs | "<platform> watch party", "watch <platform> together", "how to watch <platform> with friends", "teleparty <platform>" | Generic category terms |
| 1 | Use-case hubs | Anime (`/watch-anime-together`), long distance, Discord, virtual movie night | Platform head terms |
| 2 | Guides, compare, `/watch/*` | Long-tail questions, "X vs Y", show titles | Hub head terms |

Why the homepage should hold the category and not a platform:

- It is the only page with brand authority (587 brand impressions, 70% click rate, sitelinks). Spending that on
  Crunchyroll head terms takes them from the hub. Spending it on the category term grows the whole site.
- A title that lists platforms gets longer with each launch and still loses to the hub for each platform.
  "Watch Together on Crunchyroll, YouTube & Netflix" has no room for Prime, HBO Max, Disney+ and Hulu.
- Generic co-watch is the only cluster with no AniDachi page ranking at all, so the homepage takes nothing from a hub there.

Don't target "watch party" on its own (27.1k). Its results are a mix of sports watch parties, the TV series
*Party Down* and event pages, and big sites own it. Treat it as a long-term outcome of the category terms, not a target.

### Homepage on-page

- **Title** (proposal, ≤60 chars, brand once):
  - `AniDachi — Watch Party Extension to Watch Together Online` (57), or
  - `AniDachi: Watch Together Online, Synced with Friends` (51).
  Don't ship the drafted platform-list title. Ship the Explore strip on its own.
- **H1**: keep the hook if you like it, but add a visible subhead with the category phrase:
  "The watch party extension for Netflix, Prime Video, Crunchyroll and more." Platform names belong in the body, not the title.
- **Meta description**: category first, platforms as proof: "Watch together online with friends. AniDachi syncs
  playback across Netflix, Prime Video, Crunchyroll and YouTube, with chat and reactions. Friends join free."
- **Platform grid**: one card per platform. Each card links to its hub with the exact hub anchor
  ("Prime Video watch party"). Upcoming platforms show "Coming soon" with no link until the hub exists.
  This replaces "More platforms. Coming soon." and grows the Explore strip.
- **Anime stays the brand story, not the head term.** Keep "built by anime fans", the Ani mascot and a "Watch anime
  together" use-case card linking to `/watch-anime-together`. That keeps brand recall and sends the
  anime queries the homepage holds today to the anime hub.
- **Schema**: `SoftwareApplicationJsonLd` and the HowTo should say "streaming services", not three platform names.

### Hubs for new platforms

- URL pattern `/<platform>-watch-party`, matching how people search and the existing `/netflix-watch-party`:
  `/prime-video-watch-party`, `/hbo-max-watch-party`, `/disney-plus-watch-party`, `/hulu-watch-party`.
  Keep the existing hub URLs. Don't migrate `/watch-crunchyroll-together` or `/watch-youtube-together`.
- Each hub links back to the homepage once, with the category anchor ("watch party extension"). All hubs point
  the same category signal at the homepage, and the homepage points each platform signal at its hub.
- Each hub has its own "does <platform> have a watch party" and "teleparty <platform>" guides, as Crunchyroll has.
  Hulu and Disney+ demand is high for built-in features (Hulu watch party, Disney+ GroupWatch). Check whether those
  features still exist before writing, because "it was discontinued, here's what works" is the strongest angle if so.
- Publish a hub only when the platform works in the extension. A hub for an unsupported platform will rank for
  "does X have a watch party" and then lose the visitor at install.

### Pages to merge or retarget

- `/watch-party-app`: no non-brand traffic and the same intent as the new homepage. 301 it to `/` when the
  homepage title changes, so two generic pages don't split the category.
- `/watch-movies-together-long-distance` becomes the long-distance hub (~3.5k/month, platform-agnostic, fits the new positioning).
  It isn't indexed yet, so add it to the ANI-5/ANI-17 indexing work.
- `/compare/anidachi-vs-teleparty` owns "teleparty alternative". The homepage mentions Teleparty at most once, in the FAQ.

### Order and risk

1. **First**: index and strengthen the Crunchyroll hub (ANI-7, ANI-17) and the Netflix hub (ANI-5, ANI-6). If the
   homepage stops matching Crunchyroll terms before the hub is indexed and linked, those impressions go nowhere for a while.
2. **Then**: ship the homepage title, subhead, description and platform grid in one commit, with the
   `/watch-party-app` 301 in a second commit. A website-only push to `staging` auto-promotes to production.
   Rollback is reverting those commits.
3. **Measure weekly**:
   - The ANI-7 four-query split. The goal is that the hub gains what the homepage gives up.
   - Brand clicks on `/` stay flat.
   - Homepage impressions for the category terms in the table above. Today it's 34 in 28 days.
4. **Expect a dip** of up to ~1.2k impressions and ~40 clicks a month on Crunchyroll terms while the hub takes them
   over. That's the cost, and it's small next to the categories it opens.

## Open questions for the owner

- Brand name: "AniDachi" reads as anime. The plan keeps the name and puts anime in the story, not the keywords. If a
  rename or subtitle ("AniDachi Watch Party") is on the table, it changes the title options above.
- Launch order for new platforms. By US volume: Netflix (done) → Prime Video → Hulu → Disney+ → HBO Max.
