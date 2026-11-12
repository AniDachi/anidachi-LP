# German Localization Pilot

Status: built locally on 12 Nov 2026, not committed. Waiting for the owner's proofreading and the Impressum details before publishing.

Build notes:
- All 7 pages live under `app/de/` and use the same layout as their English partners: `/de` uses the homepage sections, the platform pages use the hub template, and the Discord, Watch2Gether and calendar pages use the guide layout. German pricing (on `/de` and the new `/de/preise`, paired with `/pricing`) is a separate German component that reads the same published prices and plan limits; the Stripe pricing component is unchanged, and Plus and Pro hand off to the English `/pricing` checkout. Shared German text sits in `lib/locale/ui-strings.ts` and `lib/locale/de-copy.ts`. The hreflang pairs are in `lib/hreflang.ts`, with tests in `lib/hreflang.test.ts`.
- German install buttons go to the German install page `/de/erweiterung` (paired with `/extension`; text localized, animations unchanged). Its store button uses `utm_campaign=de_pilot`. Track `install_hub_view` and `cta_click` with `page_path` `/de/erweiterung` as the step between the landing page and the store.
- The calendar reuses the English schedule data. Bump its `dateModified` whenever the English schedule is updated on Mondays.
- Checked: `pnpm --filter @anidachi/web check`, `pnpm --filter @anidachi/web test` (1,814 tests), eslint on the changed files, `seo:links`, and all 14 paired pages in the local dev server (status 200, self canonicals, two-way hreflang, one H1, no English template labels). Not yet run: `pnpm dev:check`, which is due before committing.
Owner and German proofreader: George
Related: localization market check (https://claude.ai/artifact/BgYf8gPEJWwtcg4ys5k75i) and the full plan in `~/.claude/plans/we-are-planning-expansion-bright-wave.md`

## Why German first, and what the pilot answers

German ranks 2nd in the market model (8.23, effectively tied with Portuguese). It has the highest purchasing power, the easiest payments (PayPal, SEPA and cards on Stripe) and the most existing DACH traffic. Your German means every page gets a native review at no cost.

The pilot answers one question: **do German-language pages win German searches and turn those visitors into installs and sign-ups, even though the Chrome Web Store listing and the extension stay in English?**

Out of scope: extension UI strings, a localized Chrome Web Store listing, a German checkout, and every other language.

## Baseline, frozen 12 Nov 2026 (Search Console, 14 Aug–10 Nov)

| Country | Clicks | Impressions |
|---|---|---|
| Germany | 86 | 2,239 |
| Austria | 23 | 595 |
| Switzerland | 11 | 148 |
| **DACH total** | **120** | **2,982** |

- Almost every query that reaches the site from Germany is in English ("crunchyroll watch together", "watch anime together").
- No German co-watching query ranks at all ("netflix zusammen schauen" and similar get zero impressions).
- One German query already shows the English site: "crunchyroll simulcast kalender", 220 impressions at position 8.3 on `/tools/crunchyroll-schedule`.
- At launch, also record DACH store clicks and sign-ups from Amplitude for the 8 weeks before, plus the same numbers for France and Italy. Those two are the control markets, since nothing changes there.

## Pilot pages (7)

Chosen from a broad Keyword Planner sweep on 12 Nov 2026: German language, DE/AT/CH, 120 seed terms across eight topics (watching together, long distance, Discord, platforms, competitor alternatives, anime tools, plus the w2g.tv and teleparty.com sites as URL seeds), about 6,100 ideas in all. Volumes are monthly. Keyword Planner gives close variants the same number, so totals below count each variant group once.

**Conversion pages**: people who want to watch together, so these test whether German pages bring installs and sign-ups.

| German URL | Main queries (searches a month) | Cluster | Paired with |
|---|---|---|---|
| `/de` | "watch together" (18,100), "Watchparty" (3,600), "zusammen schauen" phrases (~300) | ~22,000 | `/` |
| `/de/netflix-watchparty` | "netflix watch party" (1,000), "watchparty netflix" (590), "netflix zusammen schauen" (320), "zusammen netflix schauen" (140), "netflix gemeinsam schauen" (90) | ~2,300 | `/netflix-watch-party` |
| `/de/netflix-auf-discord-streamen` | "netflix auf discord streamen" (260), "netflix über discord streamen" (170), "discord netflix streamen" (140) | ~640 | `/guides/how-to-screen-share-netflix-on-discord` |
| `/de/youtube-watchparty` | "youtube watch party" (140), "watchparty youtube" (90), "youtube zusammen schauen" (90), "youtube gemeinsam schauen" (40) | ~390 | `/watch-youtube-together` |
| `/de/watch2gether-alternative` | "watch2gether netflix" (140), "watch2gether alternative" (110), "w2g alternative" (20) | ~300 | none (standalone) |
| `/de/crunchyroll-watchparty` | "crunchyroll watchparty" (140), "crunchyroll party" (50), plus a section for "crunchyroll auf discord streamen" and variants (~260) | ~500 | `/watch-crunchyroll-together` |

**Ranking pages**: anime tool searches with big German demand and an English page that already shows up for some of them. These test how fast and how high German pages rank, not conversion.

| German URL | Main queries (searches a month) | Cluster | Paired with |
|---|---|---|---|
| `/de/tools/crunchyroll-kalender` | "crunchyroll kalender" (1,900), "crunchyroll release kalender" (1,300), "crunchyroll simulcast" (1,300), "crunchyroll simulcast kalender" (1,000), "anime kalender" (1,000) | ~7,000 | `/tools/crunchyroll-schedule` |

- Planned demand rose from about 2,600 to about 14,900 searches a month compared with the first page list.
- **German uses the English loanword "Watchparty".** It's the biggest generic term (3,600), so titles and H1s use "Watchparty" alongside "zusammen schauen" (watch together). This differs from Portuguese, Spanish and Korean, where "watch party" isn't searched.
- **Netflix on Discord is about 4× bigger than first measured.** Germans search "Netflix auf Discord streamen" (stream Netflix on Discord) rather than "schwarzer Bildschirm" (black screen), so the page is framed around streaming Netflix on Discord, with the black screen as the problem it solves.
- **The Watch2Gether page leads with "watch2gether netflix" (140).** These are people trying to use Watch2Gether for Netflix, which it handles poorly and AniDachi solves.
- **The calendar is now the main ranking test,** at ~7,000 searches a month instead of ~1,000. The English schedule tool already ranks around 8th for "crunchyroll simulcast kalender".
- Only supported platforms (Netflix, YouTube, Crunchyroll). Confirm ANI-38 is settled before publishing the Crunchyroll page.

**Checked and left out:**

| Topic | Demand | Why not now |
|---|---|---|
| Prime Video watchparty ("amazon watchparty", "prime watchparty" and variants) | ~1,600 | The extension doesn't support Prime Video. Larger than any planned conversion page except Netflix, which is a strong argument for shipping Prime support. |
| Disney+ watchparty | ~500 | Not supported |
| One Piece and Naruto filler lists ("one piece filler folgen", "naruto filler folgen" and variants) | ~12,500 and ~15,000 | Big but low-intent: people want episode lists, not a watch party app, and anime is a maintained vertical. Left out by the owner on 12 Nov. |
| Long-distance relationship apps and date ideas ("app für fernbeziehung", "online date ideen") | ~400, scattered | The big long-distance terms are gifts and tips (720, 590), which don't fit the product. Revisit with a guide later. |
| Teleparty alternative | ~130 | Small. Covered inside the Netflix and Watch2Gether pages instead. |
| Competitor brands (Hyperbeam 1,900, Scener 1,300, Rave 720, Metastream 390, Syncplay 260) | | People searching for those products by name. Compare pages are a later option. |
| Generic streaming terms ("film streamen", "streaming seite") | 1,000–15,000 | People looking for free films, not watching together |

## What has to be built

### 1. Approval and logging
- Log the 7 new URLs and the `/de` folder as owner-approved in the decisions log of `docs/seo-content-guidelines.md`, as the URL stability gate in `.cursor/agents/anidachi-seo-aeo-pages.md` (lines 34–41) requires.
- The rule "do not add hreflang unless localized copies exist" (same file, line 82) is satisfied once the German pages exist.

### 2. Language basics
- `app/layout.tsx:88` hardcodes `<html lang="en">`, and Next.js allows only one root layout without moving every page into route groups. For the pilot, add `app/de/layout.tsx` with a wrapper `<div lang="de">`. Google detects language from the content and the hreflang tags, so this is enough to test. If German proceeds, move to route-group root layouts with a real `<html lang="de">`.
- Add `lib/locale/de.ts` for shared German strings: install steps, CTA labels, breadcrumb "Startseite", FAQ and table-of-contents headings, "Funktioniert mit".
- `components/hub-landing-layout.tsx` hardcodes the English install step (lines 20–36). Add props, or a `locale` prop, so German pages pass German text. `components/hub-hero.tsx` already takes `ctaLabel` and `worksOnLabel`.

### 3. Pages
- Build the pages under `app/de/...` with the existing `HubLandingLayout` (Netflix, YouTube, Crunchyroll) and `SeoPageLayout` (homepage, Watch2Gether, Discord).
- Every page gets the full metadata set from the new-URL checklist (`.cursor/agents/anidachi-seo-aeo-pages.md`, lines 276–299): self canonical, title of 60 characters or less, description of 160 or less, openGraph with `locale: "de_DE"`, twitter, matching FAQ JSON-LD, and honest dates.
- Pass `conversionTemplate="de_pilot"`. Otherwise `inferPageTemplateFromPath` in `lib/conversion-events.ts` files `/de/*` pages under "default" and they can't be separated in reports.
- Internal links: `/de` links to every other German page, each German page links to at least two others, and the footer gets a "Deutsch" link to `/de`. That meets the 2-inbound-link rule.

### 4. hreflang and sitemap
- Add a helper in `lib/hreflang.ts`, for example `languageAlternates({ en, de })`. It returns `{ canonical, languages: { en, de, "x-default": en } }` for both pages in a pair.
- Use it in the metadata of each German page and its English partner (`/`, `/netflix-watch-party`, `/watch-youtube-together`, `/watch-crunchyroll-together`, the Discord guide, and `/tools/crunchyroll-schedule`). Standalone pages keep a plain self canonical.
- In `app/sitemap.ts`, add `alternates.languages` to paired entries. `lib/sitemap-discovery.ts` already picks up new `app/de/**/page.tsx` files automatically. Give `/de` pages explicit priorities in `inferSitemapMeta`.
- No redirects and no IP or browser-language detection (decided 11 Nov).

### 5. Tracking changes
Most of the tracking already exists. Three small changes:
- **Tag German store links.** `lib/install-cta.ts:10` has one Chrome Web Store URL (`utm_source=item-share-cb`). Add a German variant (for example `utm_source=anidachi&utm_medium=web&utm_campaign=de_pilot`) so the Chrome Web Store dashboard can show installs coming from German pages. `components/install-link.tsx:36` only tracks a click when the href exactly equals the constant, so change that check to a small `isChromeWebStoreUrl()` helper. Otherwise German store clicks would silently stop being tracked.
- **`conversionTemplate="de_pilot"`**, as in step 3.
- **Nothing else.** `seo_landing_path` is already attached to `cta_click` and `extension_store_clicked`, the first-touch cookie (`lib/seo-landing-path.ts`, 90 days) already carries the landing path into the server `sign_up` event, and Stripe checkout metadata already gets `seo_landing_path`.

### 6. Legal check before launch
- **Impressum:** the site has none. A commercial service aimed at German users needs one (§5 DDG). Add `/impressum` (German, linked in the footer) with the operating company's details, which the owner supplies.
- **Checkout and cancellation rules** already apply to German customers today, pilot or not: the order button wording rule (§312j BGB) and the online cancellation button for subscriptions (§312k BGB). Have someone check them. They don't block the pilot, because checkout stays in English.

### 7. Quality gate and publishing
1. Draft all 7 pages, then George proofreads every one.
2. Run the `anidachi-seo-qa` gate on each page, plus `pnpm --filter @anidachi/web seo:links`, `pnpm --filter @anidachi/web check`, the title guard (`lib/seo-guards.test.ts`) and `pnpm dev:check`.
3. Check hreflang with a validator: every pair links back, and every canonical points to its own page.
4. Push to staging only after proofreading, since site-only staging pushes auto-promote to production.
5. After launch, request indexing for each German URL in Search Console (manual, by George), and resubmit the sitemap.

## How we tell whether it works

### Weekly funnel for German pages (landing path starts with `/de`)

| Step | Metric | Source |
|---|---|---|
| 1. Indexed | Each German URL indexed, with Google's chosen canonical equal to the German URL, not the English one | Search Console URL Inspection |
| 2. Seen | Impressions and average position for German pages, and for the target queries in the pages tables | Search Console, page filter `/de/` |
| 3. Clicked | Clicks and CTR | Search Console |
| 4. Engaged | Sessions by device, `scroll_50`, `cta_impression` to `cta_click` | GA4 / Amplitude, `seo_landing_path` starts with `/de` |
| 5. Store click | `extension_store_clicked` + `cta_click` per desktop session | Amplitude |
| 6. Install | Installs with `utm_campaign=de_pilot` | Chrome Web Store dashboard |
| 7. Sign-up | Server `sign_up` with `first_landing_path` starting `/de` | Amplitude |
| 8. Paid | Checkout sessions and purchases with `seo_landing_path` starting `/de` | Stripe metadata / GA4 `purchase` |

### Comparisons that isolate the effect of the language
- **Same visitors, other language:** compare store-click rate and sign-up rate for DACH visitors on German pages with DACH visitors on English pages in the same weeks. That shows whether German copy converts better.
- **English drop-off:** sign-ups per store click from German pages against English pages. If German visitors click to the store as often but sign up less, the English store listing and extension are the bottleneck, and that's the case for localizing them next.
- **Market total, with a control:** total DACH clicks and sign-ups before and after launch, minus the change in France and Italy over the same weeks. That removes seasonality.
- **Expected shift:** DACH clicks on paired English pages may fall as German pages take over through hreflang. That's fine as long as the DACH total rises.

### Decision at week 8 (and week 12)
Judge the two page groups separately: the ranking pages answer whether German pages rank, and the conversion pages answer whether they bring users.
- **Go** (expand German to the full hub set and start Portuguese), if all of these hold:
  - All pilot pages are indexed with self canonicals.
  - The conversion pages together earn 1,000+ impressions a month, and the calendar alone 1,000+.
  - At least 3 target German queries for the conversion pages rank in the top 10.
  - The store-click rate on conversion pages is at or above English pages for DACH visitors.
  - At least 15 sign-ups first-touched on German conversion pages. The DACH baseline is about 35 desktop logins a month.
- **If only the ranking pages work** (high positions, little conversion), German pages rank fine and the problem is the funnel. Look at the English store listing and extension first.
- **Hold**, if pages are indexed and impressions are growing but below target: recheck at week 12.
- **Stop**, if pages aren't indexed, Google picks the English page as canonical, or German pages have under 200 impressions a month at week 12.
- **Next step if it's a go but the English drop-off is large:** localize the Chrome Web Store listing and the extension interface into German before starting a new language.

## Timeline

| When | What |
|---|---|
| Days 1–3 | Approvals logged, language basics, hreflang, sitemap and tracking changes, Impressum, first drafts of the 7 pages |
| Days 4–5 | George proofreads, then the QA gate |
| Day 6 | Publish, request indexing, freeze the launch baseline |
| Weeks 1–8 | Weekly snapshot of the funnel table |
| Week 8 | Go / hold / stop decision |
| Week 12 | Second look if on hold |
