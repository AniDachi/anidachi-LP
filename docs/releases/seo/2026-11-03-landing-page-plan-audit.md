# Audit of the landing page repositioning plan (2026-11-03)

Checks [the positioning plan](2026-11-03-homepage-positioning.md) and
[its summary](2026-11-03-landing-page-positioning-summary.md) against live data and the ANI board.

Data, all read-only:
- GA4 property 531363877, Oct 6 – Nov 2 (28 days), plus weekly sessions from Aug 3.
- Search Console `sc-domain:anidachi.app`, by week from Aug 3 to Nov 1, and Oct 5 – Nov 1 for devices and countries.
- Linear ANI-5 to ANI-24, including all comments.

## What the data says

**Traffic is growing, but not where the plan looks.**
- Organic sessions grew from ~235 a week (mid-September) to 692 (week of Oct 26).
- Weekly Search Console impressions, week of Aug 3 → week of Oct 26:

  | Page group | Aug 3 | Oct 26 | Clicks (Oct 26 week) |
  |---|---:|---:|---:|
  | Tools (schedules, filler lists) | 0 | 16,452 | 131 |
  | Guides | 2.3k | 7.9k | |
  | Homepage | 1.7k | 2.3k | 232 |
  | Platform hubs | 2.0k (peak 2.3k, week of Sep 28) | 1.3k | 28 (was 86, week of Sep 21) |

  Hubs are down about 43% from their peak.
- 2/3 of clicks come from outside the US: US 33%, India 11%, UK 6%.
- Mobile has more impressions than desktop (26.7k vs 20.3k), mostly on tools pages.

**The homepage is where installs come from.** Organic sessions, Oct 6 – Nov 2:

| Landing page | Sessions | Store-click users | Rate |
|---|---:|---:|---:|
| `/` | 927 | 207 | **24.6%** |
| `/watch-anime-together` | 102 | 15 | 15.2% |
| `/watch-crunchyroll-together` | 35 | 2 | **5.7%** |
| `/watch-youtube-together` | 54 | 0 | 0% |
| `/tools/crunchyroll-schedule` | 241 | 1 | 0.7% |

The homepage brings in **83% of organic store-click users** (207 of 249).

**Other signals:**
- **AI assistants convert best.** 310 sessions and 66 store-click users out of 268 users (25%). The weekly count jumped in late October. 55 of the 66 were on mobile.
- **Almost half of "store clicks" can't become installs.** 192 of 415 store-click users were on mobile, where Chrome extensions don't install. 288 mobile users saw the mobile install panel; 22 (7.6%) copied the desktop link.
- **The data is polluted.**
  - Singapore desktop: 1,235 sessions, 0% engagement, 4-second visits. China shows the same pattern. Direct traffic is 2,394 sessions at 21% engagement.
  - `accounts.google.com` shows up as a referrer for 265 sessions (plus .vn and .ca). These are people coming back from Google sign-in, and each one starts a new session that wipes out its organic or AI attribution.

## Errors and inconsistencies in the plan

1. **The main move sends traffic to a worse page (critical).**
   - The plan hands Crunchyroll and anime searches from the homepage to the hubs, based on ANI-7's "hub 65% vs homepage 43%".
   - That figure only counts people who already reached `/extension` (Amplitude). From the first page of a visit through to a store click, the homepage converts at 24.6% and the Crunchyroll hub at 5.7%.
   - So Google ranking the homepage for these searches is helping installs, not hurting them. Moving the traffic before the hub converts would cost installs.
2. **Category demand is overstated (high).**
   - "60k generic" counts "watch party" (27.1k, mostly sports and the TV show *Party Down*) plus loosely related keyword suggestions.
   - On exact terms in the US: watch party extension 110, teleparty alternative 260, watch movies together online 1,300 (results dominated by listicles), stream together 880 (largely about game streamers).
   - Realistic upside is a few thousand searches a month in tough results. That doesn't justify dropping terms the homepage already converts on.
3. **It claims Prime Video, which isn't supported (high).** The proposed subhead and meta description name Prime Video. That breaks the plan's own rule (publish only after the adapter works) and misleads visitors.
4. **Three homepage titles are in play (high).**
   - The working-tree draft: "…Watch Together on Crunchyroll, YouTube & Netflix".
   - ANI-7's Nov 2 comment: "AniDachi: Watch Party for Crunchyroll, YouTube & Netflix".
   - The plan's two options.

   Only one should ship, and ANI-7 should record which.
5. **It adds pages while crawling is the bottleneck (high).**
   - 73 sitemap URLs are "Discovered – not indexed".
   - `/netflix-watch-party` has about 25 internal links, including from the homepage, and has never been crawled (ANI-5, ANI-6).
   - The plan adds 4–5 hubs plus two guides each (~15 URLs). Pruning (ANI-14, 15, 16) should come first, and each new platform should get one strong hub.
6. **It looks only at the US (medium).** The volumes are US, but the US is 33% of clicks. Rank using worldwide volume (the adapter doc already does).
7. **Wrong blocker for the Crunchyroll hub (medium).** The rollout says to get it indexed, but it's indexed (907 impressions in 28 days). Its problems are ranking and conversion.
8. **It measures the wrong thing (medium).**
   - Success is defined as impressions moving to the hubs. It should be desktop store clicks and trial starts by landing page.
   - Those can't be measured cleanly yet: ANI-20 and ANI-21 are open, mobile inflates store clicks, sign-in returns break attribution, and bots inflate Direct.
9. **It leaves out the biggest growth source (medium).** Tools pages went from 0 to 16k impressions a week and are mostly mobile. The plan doesn't mention them.
10. **"Friends join free" in the meta description (low).** Check this against the Free20 policy (free 20 min per person) before shipping.

## Asymmetric gains, ranked by impact per effort

| # | Move | Effort | Why it pays off |
|---|---|---|---|
| 1 | **Fix measurement.** Add `accounts.google.com` (all country domains) to GA4 unwanted referrals. Filter out the Singapore/China zero-engagement traffic. Mark `extension_store_clicked` as a key event, desktop only (ANI-20). Ship ANI-21 (trial attribution). | Hours | Every decision below depends on desktop installs by landing page, and today that number is wrong in three ways. |
| 2 | **Mobile capture.** On mobile, replace the Chrome Web Store button with "Email me the desktop link". Add one reminder email when someone signs up (uses the lifecycle email plan). | 1–2 days | 46% of store clicks and most AI-assistant clicks are mobile dead ends. Even a modest capture rate adds 10–20% to installs. |
| 3 | **Give hubs the homepage's conversion pattern before giving them its traffic.** Same above-the-fold demo and install card, same proof. Re-measure the end-to-end rate. | 1–2 days | Turns the 5.7% → 24.6% gap into an opportunity instead of a risk. Only then retarget ANI-7. |
| 4 | **Add to the homepage title rather than replacing it.** Keep the platforms that already work and add the category: `AniDachi — Watch Party Extension for Crunchyroll & Netflix` (58 characters). Later, "…for Netflix, Crunchyroll & More". Name only supported platforms. | 1 hour | Keeps converting terms, adds category eligibility and scales without a rewrite. |
| 5 | **Write for AI assistants.** A short factual description near the top of the homepage: what it is, Chrome desktop, supported platforms, price, how friends join. Add an FAQ, `llms.txt`, and keep comparison pages factual. Track citations in ANI-23. | Half a day | It's the best-converting channel (25%) and the fastest-growing one. |
| 6 | **Prune before adding** (ANI-14, 15, 16). Then each new platform gets one hub, linked from the homepage platform grid. | Owner decisions | Frees crawl budget for pages that convert, so new hubs get indexed. |
| 7 | **Turn tools traffic into email signups.** "Get the weekly simulcast schedule by email" on `/tools/crunchyroll-schedule`, then nurture toward a desktop install. Fix the Black Clover snippet (ANI-13: 6k impressions, 3 clicks). | 1–2 days | 16k impressions a week, mostly mobile, convert at 0.7% today. Email turns phone visitors into later desktop installs. |

## What changes in the plan

- **Keep:** platform hubs own "*platform* watch party". The platform grid on the homepage. Anime stays as the brand story. Redirect `/watch-party-app`.
- **Change:**
  - The homepage keeps its proven Crunchyroll and anime terms and adds the category.
  - Hubs take traffic only after they convert.
  - Name only supported platforms.
  - Prune before adding.
  - Measure desktop installs and trials, not impression share.
- **Order:** measurement (1) → mobile capture (2) → hub conversion (3) → homepage title (4) → AI description (5). Pruning (6) runs in parallel as owner decisions, and tools email (7) after (2).
