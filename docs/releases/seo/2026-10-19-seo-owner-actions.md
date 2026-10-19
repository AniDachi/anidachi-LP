# SEO owner actions (October 19, 2026)

Owner-only steps from the [revised SEO plan](../../superpowers/plans/2026-10-19-seo-growth-plan.md):
admin consoles, Store listing text, and changes that need owner approval under the
[SEO safety rules](../../../apps/web/docs/seo-content-guidelines.md). Nothing here has
been done; each item is ready to act on or approve.

## 1. Search Console (this week)

**Request indexing** (URL Inspection → Request indexing). These Netflix pages
describe a feature that went live today. Google hasn't indexed them yet:

| URL | Status on Oct 19 |
|---|---|
| `https://www.anidachi.app/netflix-watch-party` | Discovered – currently not indexed |
| `https://www.anidachi.app/guides/watch-netflix-together` | Discovered – currently not indexed |
| `https://www.anidachi.app/guides/how-to-watch-netflix-together` | Discovered – currently not indexed |
| `https://www.anidachi.app/guides/does-netflix-have-a-watch-party` | Discovered – currently not indexed |
| `https://www.anidachi.app/compare/anidachi-vs-netflix-watch-party` | URL is unknown to Google |
| `https://www.anidachi.app/netflix-party` | URL is unknown to Google |
| `https://www.anidachi.app/guides/how-to-watch-netflix-with-friends` | Alternate page (last crawl saw the old apex canonical) |
| `https://www.anidachi.app/guides/netflix-party-for-crunchyroll` | Alternate page (same) |

Also request `https://www.anidachi.app/tools/crunchyroll-schedule` after each Monday
update; it is indexed but its content is weekly.

**Re-check the Pages report** for the apex → www move. The API's sitemap `indexed`
field returns 0, so the Pages report is the only source.

## 2. GA4 admin (property `531363877`)

The code shipped today sends two new events and fixes a third (see
[`CONVERSION_METRICS.md`](../../../apps/web/docs/CONVERSION_METRICS.md)).

1. **Key events:** mark `extension_store_clicked`, `checkout_session_started`
   and `checkout_redirect_success`.
   - Do **not** mark `extension_clicked`. Despite its name, it fires on the
     homepage's "See How It Works" scroll link.
2. **Event-scoped custom dimensions** (none are registered today): register
   `seo_landing_path`, `placement`, `cta_variant`, `page_template`, `metric_name`
   and `metric_rating`. Until then, read Store clicks by landing page in
   Amplitude.
3. **Data filter:** exclude hostnames `staging.anidachi.app`, `localhost` and
   `127.0.0.1`. They sent 265 sessions in the last 28 days.
4. **Tell analysts about the invite tokens.** Before today, `seo_landing_path`
   could contain `/friend/invite/<token>` in GA4, Amplitude and Stripe Checkout
   metadata. New events report `/friend/invite` without the token. Decide whether
   past Amplitude rows need deleting under your data-retention policy.

## 3. Chrome Web Store listing (dashboard)

The live listing (0.1.4, 283 users, 8 ratings) has these problems:

- It never mentions Netflix.
- The summary doesn't contain "watch party" for any platform.
- One sentence ("Friends who join later can quickly catch up with the room") can
  read as the async catch-up feature, which is still planned only.

**Proposed summary** (132-character limit, this is 124):

> Crunchyroll, YouTube & Netflix watch party: watch together in sync with chat, reactions, voice and video. Friends join free.

**Proposed description** (confirm each sentence against the product before
pasting):

> Watch together, wherever your friends are.
>
> AniDachi is a watch party extension for Crunchyroll, YouTube and Netflix. Open a supported video in desktop Chrome, create a room, and invite your friends. Everyone watches on their own account while the room keeps you on the same moment.
>
> Pause to talk, rewind a scene, jump ahead, or move to the next episode — everyone follows along. Friends who join a room mid-episode land on the room's current moment.
>
> Chat, send reactions, turn on your microphone, or bring your camera into the room. Share an invite link or invite friends directly from AniDachi. The host can manage who uses voice and video.
>
> Hosting a room needs Plus or Pro (a 3-day trial is available for eligible accounts). Friends join free.
>
> Keep your personal watch progress in one place. Continue from where you stopped, see what you have watched, and manage your history from your AniDachi account.
>
> Supported: Crunchyroll catalog pages, full YouTube watch pages, and Netflix movie and episode pages in desktop Chrome. Each viewer needs their own access to the video. Not affiliated with Crunchyroll, YouTube or Netflix.

**Reviews:** the listing has 8 ratings. Asking for a review after a good session
(e.g. after a room with 2+ people ends) is a product change; plan it separately.

## 4. Analytics and performance proposals (approve or decline)

- **Amplitude Session Replay** records every session (`lib/amplitude.ts:34`,
  `sampleRate: 1`). Proposal: 0.1–0.2, plus 1.0 for checkout and onboarding
  routes if those recordings are used. This lowers script work on every page
  view and the recorded volume.
- **Geist Mono** loads on every page (`app/layout.tsx:31`) for 7 public uses:
  step badges and tabular numbers. Proposal: switch those to
  `font-variant-numeric: tabular-nums` with the main font, then drop the font.
  Low SEO value; do it with the next design pass.
- **Homepage client bundle:** `components/home/home-client.tsx` makes the whole
  homepage a client tree only for `useHomeScrollAssist`. Server-rendering the
  static sections needs its own plan and visual QA.
- **Bing Webmaster Tools and IndexNow:** not set up. Bing also feeds ChatGPT
  search, which sent 71 sessions in the last 28 days. Verify the domain in Bing
  Webmaster Tools and import from Search Console. IndexNow can come later as a
  small code change.

## 5. Changes that need owner approval (publishing gate)

### Section index pages

`/guides`, `/compare`, `/watch`, `/glossary` and `/tools` return 404, while the
breadcrumbs point elsewhere:

- 15 "Compare" crumbs link to `/watch-crunchyroll-together` and 1 to
  `/watch-anime-together`.
- 9 glossary pages hard-code a "Glossary" crumb linking to `/watch-anime-together`.
- Both "Guides" crumbs in `lib/pseo-new-guides.tsx` (`:890`, `:1021`) link to a
  pillar page.

**Option A (recommended): five lightweight index pages.**

- Each is a list of the existing pages in its section, built from
  `lib/guide-links.ts`, `animeList` and the tool registry.
- Point the crumbs at them and add them to the footer.
- **Risk:** five new URLs.
- **Benefit:** honest breadcrumbs, a crawl path to every page in a section (most
  zero-impression pages aren't indexed; see the
  [coverage report](2026-10-19-index-coverage-and-consolidation-report.md)), and
  hubs Google can rank for "anime watch party guides".

**Option B: relabel the crumbs to match their targets.** For example, "Compare"
becomes "Crunchyroll Watch Party". No new URLs, but no crawl benefit.

### New compare pages: SyncUp and Kosmi

- "kosmi alternative" has no strong result.
- SyncUp is the most active SEO rival and has no anime angle.
- Both pages need the publishing gate: primary sources for competitor claims,
  a verification date, one parent hub, two inbound links, and a 30/60/90-day
  review.
- Draft only after approval.

### Directory listings (drafts, not submitted)

**AlternativeTo:** list AniDachi as an alternative to Teleparty, Scener, Kosmi,
Watch2Gether and Crunchyroll Party.

- Category: Video sync / Watch party.
- Platforms: Chrome.
- License: Freemium.
- Use the Store summary above as the short description.
- Tags: watch-party, crunchyroll, netflix, youtube, anime.

**Gitnux:** use "Apply for a Listing" for its 2026 best watch party apps list,
with the same short description and the Chrome Web Store link.

**Outreach:** "best watch party apps 2026" and long-distance couple app
roundups. The audit found AniDachi missing from SyncUp's, Gitnux's and
Peepstune's lists. Pitch the anime and Crunchyroll angle; none of those lists
covers it.

### Homepage title (after about November 2)

The homepage now outranks `/watch-crunchyroll-together` for "crunchyroll watch
party", "watch together crunchyroll" and "crunchyroll watch together". The hub
converts better: 65% of hub visitors who reach `/extension` click to the Store,
vs 43% from the homepage.

- **After the freeze:** confirm in Search Console that the homepage has moved to
  `www`.
- **Then approve a brand-first title**, e.g. "AniDachi — Watch Together on
  Crunchyroll, YouTube & Netflix" (59 characters, absolute title). This keeps the homepage on brand
  and product queries.
- **Already done:** the homepage now has exact-match body links to the three
  platform hubs (How It Works, step 3).

### Watch pages and genre hubs

See the [index coverage and consolidation report](2026-10-19-index-coverage-and-consolidation-report.md)
for:

- the next watch pages to enrich;
- index state for every zero-impression watch page;
- genre-hub options with evidence.

All of it is report-only until you approve.
