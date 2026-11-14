# AniDachi SEO Content Guidelines

**Single source of truth** for public marketing SEO on [www.anidachi.app](https://www.anidachi.app). `https://www.anidachi.app` is the canonical host; `anidachi.app` must 308 to it.  
Dated keyword volumes and batch plans live in separate plan docs — re-pull Keyword Planner before treating any number as current.

Operational agent: [`.cursor/agents/anidachi-seo-aeo-pages.md`](../../../.cursor/agents/anidachi-seo-aeo-pages.md)  
Owner decisions: [Decisions log](#decisions-log) below. The 2026-07-28 portfolio freeze was lifted on 2026-10-12.  
Editorial standards: [`/editorial-policy`](https://www.anidachi.app/editorial-policy)

---

## Product truth

AniDachi is a Chrome extension + web product for **watchrooms** on:

- **Crunchyroll** (catalog pages, desktop Chrome)
- **YouTube** (full `youtube.com/watch` pages, desktop Chrome — not Shorts, embeds, feeds, or native mobile apps)
- **Netflix** (movie and episode watch pages in desktop Chrome; each viewer needs their own access to the same title)

Netflix launched in production on 2026-10-19 (Web/Worker `b48de0e9`, Chrome Web Store
0.1.4). Do not promise Netflix ad-plan compatibility without acceptance evidence.

Current features: live synchronized players, on-player chat and reactions, voice/video calls, and personal watch history. Each person uses their own access to the video.

Approved Free20 release copy: Free includes 20 host minutes per UTC day for up to 4 people, including the host. Plus supports 6 people and Pro 15, with no daily hosting time limit; friends join free without spending their own hosting minutes. Recording and editing personal history require each viewer's own eligible access. Automatic recording additionally requires permission in the extension; YouTube has a separate recording switch. Saved history, Resume and deletion remain available on Free.

Plus and Pro offer monthly/yearly billing, with monthly selected by default. Do not advertise new trials or include trial language in acquisition copy. Existing paid/manual and previously granted trial rights retain their conditions in the backend; they are not new offers. Free20 is active on staging and still awaits the coordinated production launch. Source copy is release preparation, not proof of current production activation; follow the [launch runbook](../../../docs/releases/free20/production-preparation-2026-11-06.md).

**Planned only:** async catch-up, shared group progress, persistent room context/chat and replayed reactions. Never sell these as current features or paid-plan benefits. Mark future mentions clearly; do not include them among instructions users can follow today.

Use `lib/pricing-copy.ts` for shared commercial copy. The Free20 contract defines the release offer; older protocol fields do not define its limits. Update visible text, FAQ/HowTo JSON-LD and search/social metadata together.

**Not supported:** Disney+, Hulu, Amazon Prime Video sync.
**Not affiliated** with Crunchyroll, Sony, YouTube, Google, or Netflix.

Primary conversion path: the official Chrome Web Store listing linked from
**`/extension`**. Install how-tos should link that listing or the install hub;
do not invent a different `chromewebstore.google.com` item URL.

---

## Hard safety rules (ranking / indexation)

Do **not**, without owner approval + GSC evidence:

- 301 / Merge / Retire / Delete public marketing URLs
- Change URL structure on ranked pages (slug renames, path moves, canonical retarget to another path)
- Add `noindex` to previously indexable marketing URLs
- Remove the cohort discovery sitemap while Coverage is recovering
- Shrink footer/nav crawl paths to existing spokes
- Rewrite high-traffic pillar H1s or primary intent

Default: **enrich in place on the same URL**, additive pages, reversible changes. Ranked pages keep their paths so Google does not re-associate equity.

Evidence order: Google documentation → AniDachi GSC/GA4 → reproducible tests → third-party studies → patents/leaks as hypotheses only.  
Do **not** treat domain age, WHOIS, dwell time, schema, or “force-index” sitemaps as ranking levers.

Default backlog: `seo:portfolio` Keep/Enrich winners on their existing URLs first. A new URL ships only when it passes the publishing gate below.

---

## Publishing gate (every new or major SEO URL)

A page may ship only if **all** are true:

1. The owner approved the page or the batch it belongs to.
2. Target query is not already owned (full route inventory + GSC query data — not top pages only). Run `pnpm --filter @anidachi/web seo:portfolio` / `seo:keywords` with full inventory.
3. Page adds distinct information (not a modifier twin / doorway).
4. One parent hub + **two contextual inbound links** planned **before** publish; ≤3 clicks from a relevant pillar.
5. `datePublished` / `dateModified` honest; 30/60/90-day review date recorded in the PR or plan.
6. Claims match product, pricing, and legal pages; competitor claims have primary sources + verification dates.
7. CTA and `seo_landing_path` attribution remain intact (see `CONVERSION_METRICS.md`).

Reject: avg monthly searches &lt; 10 unless clear commercial value **and** unique intent (being a twin of another platform page is **not** enough).

---

## Information architecture

| Cluster | Pillar / hub | Notes |
|--------|----------------|-------|
| Anime vertical | `/watch-anime-together` | Genre hubs + `/watch/{slug}-with-friends` (Crunchyroll-first) |
| Crunchyroll platform | `/watch-crunchyroll-together` | Sibling of anime/YouTube — do not nest YT under anime |
| YouTube platform | `/watch-youtube-together` | Sibling cluster; crumbs: Home → YouTube Watch Party → … |
| Trust | `/about`, `/editorial-policy`, `/contact`, `/security` | Additive trust surfaces |
| Product | `/`, `/pricing`, install hub when live | Conversion |

Related lists: prefer narrow tags (`pillar-watch-youtube` or `pillar-watch-crunchyroll` alone). Avoid OR-ing broad `watch-party` across clusters.

---

## Canonical anime URL (programmatic)

- Pattern: `/watch/{base-slug}-with-friends`
- Implementation: `app/watch/[slug]/page.tsx` + `lib/anime-data.ts` + `lib/watch-page-rich-content.ts`
- Do **not** invent nested `/anime/...` paths or mass-301 for prettier URLs

When adding titles: update `animeList` + MAL ids, hub/listicle backlinks, bump `dateModified` only when content meaningfully changes. Prefer enriching existing titles over unbounded catalog growth.

---

## Page checklist (new or substantial edit)

1. `metadata`: title, description, canonical, openGraph, twitter
2. `SeoPageLayout` (or trust-page article layout for About/Contact/etc.): breadcrumbs, dates, FAQ parity with `FAQPageJsonLd`
3. Editorial byline via layout (About + Editorial Policy) unless the page already shows equivalent meta
4. Structured data from `components/json-ld.tsx` (initial HTML — no deferred Script wrapper)
5. Sitemap: static routes auto-discovered via `lib/sitemap-discovery.ts` — do not maintain a manual static list
6. Internal links: ≥1 pillar, ≥1 sibling, descriptive anchors
7. CTA: `/pricing` (or install hub when designated) — keep `PrimaryCheckoutCta` wiring
8. No Blou / CRM routes in public SEO copy

---

## Templates (intent → shape)

Use existing gold-standard pages in the agent file. Do **not** treat “do not mix schema types” as a ban on combining Article + FAQ + HowTo when the visible page has those sections.

### Programmatic watch pages

- Title-specific value required; avoid sitewide boilerplate FAQs for pricing/platform — centralize those on pillars/`/pricing`
- Meta descriptions must differ meaningfully across titles (group angle, format, availability, action phrase)
- Opening copy: answer-first and title-specific — **do not** force one identical three-sentence template on every title
- Schema may include HowTo, TVSeries/Movie, Article, Breadcrumb, FAQ, ItemList when UI matches

### Guides / compare / listicles

- Answer-first; commercial pages: `aboveFoldCta` plus the layout end card. Two install cards maximum. Do not add a mid `PrimaryCheckoutCta`.
- Compare pages: fair tables + primary sources for competitor claims
- CTA destination: `/pricing` (not `/#pricing` alone)

### Trust pages

- `/about`, `/editorial-policy`, `/contact`, `/security` — no invented founders; no checkout-hard-sell required

---

## Schema honesty

- FAQ/HowTo markup describes on-page content; **do not** promise rich results (FAQ rich results are largely limited; HowTo is desktop-limited)
- No fake `SearchAction` / site search until a real search endpoint exists
- Organization `sameAs` = `PUBLIC_SOCIAL_LINKS`; author/publisher may point at `/about`

---

## Measurement

```bash
pnpm --filter @anidachi/web seo:portfolio
pnpm --filter @anidachi/web seo:links
pnpm --filter @anidachi/web seo:keywords
```

Track: Coverage cohorts, query cannibalization, impressions → clicks → `seo_landing_path` → checkout.  
Impressions before clicks is normal for new URLs. Prefer enriching winners over shipping more thin spokes.

`seo:portfolio` and `seo:keywords` need Google Marketing OAuth (Search Console + Analytics), reconnected through the Kreatli CRM. Composio's Search Console, GA4 and Amplitude connections work too. `seo:portfolio` writes a route inventory with GSC pages, query×page pairs, GA4 landing sessions and key events, and a suggested action per URL (Keep / Enrich / Merge/301 / Review). It does not replace:

- GSC **Pages** (indexing) report: Indexed vs Discovered / Crawled – not indexed. Export it from the GSC UI.
- Manual claim checks and owner approval before any merge, redirect or removal.

Attribution: first-touch `seo_landing_path` is stored in session storage and sent with GA4 and Amplitude conversion events and Stripe Checkout/Subscription metadata. See `docs/CONVERSION_METRICS.md`.

---

## Decisions log

Owner-approved exceptions to the safety rules above, newest first.

- **2026-11-14, `/netflix-party` folds into the Netflix hub (owner in chat):** `/netflix-party` → `/netflix-watch-party` (308). The hub had been "Discovered – currently not indexed" since 8 Oct (URL Inspection, 14 Nov) despite links from 38 files and the homepage, while `/netflix-party` was indexed and recrawled every few days (last 10 Nov). The redirect sends Google to the hub on its next visit and passes `/netflix-party`'s signals to it. What it gives up: 331 impressions and 2 clicks in 28 days at about position 10, mostly "does netflix party still exist"; no AniDachi page appears for "netflix watch party". The hub gains a "What happened to Netflix Party?" section, four FAQ answers (rename, still available, made by Netflix, where to find it) and the MakeUseOf source; title, H1 and URL are unchanged. The existing redirects `/guides/netflix-teleparty`, `/guides/netflix-party-extension` and `/guides/teleparty-netflix` now point straight at the hub, so there are no chains. Inbound links go to `/netflix-watch-party#netflix-party`. This reverses the 10 Nov choice of `/netflix-party` as the Netflix comparison page; the plan puts the Teleparty comparison inside each hub. Rollback: restore the route from git and remove the redirect. Re-check the hub's index status and the old page's queries on 28 Nov.

- **2026-11-12, German localization pilot (owner in chat; plan: [German localization pilot](../../../docs/superpowers/plans/2026-11-12-german-localization-pilot.md)):** a new `/de` folder with seven German pages, the first localized pages on the site. Publishing only after the owner proofreads every page.
  - **New URLs:** `/de` ("Watchparty", 3,600/mo in DACH), `/de/netflix-watchparty` (~2,300), `/de/netflix-auf-discord-streamen` (~640), `/de/youtube-watchparty` (~390), `/de/crunchyroll-watchparty` (~500 with the Discord section), `/de/watch2gether-alternative` (~300) and `/de/tools/crunchyroll-kalender` (~7,000). Volumes: Keyword Planner, German, DE/AT/CH, 12 Nov 2026. Added the same day: `/de/preise` (German pricing, paired with `/pricing`) and `/de/erweiterung` (German install page, paired with `/extension`; the post-install `?welcome=1` flow stays on `/extension`).
  - **hreflang:** each German page and its English partner (`/`, `/netflix-watch-party`, `/guides/how-to-screen-share-netflix-on-discord`, `/watch-youtube-together`, `/watch-crunchyroll-together`, `/compare/anidachi-vs-watch2gether`, `/tools/crunchyroll-schedule`, `/pricing`, `/extension`) list `en`, `de` and `x-default` (English) through `lib/hreflang.ts`, in metadata and in `sitemap.xml`. Canonicals stay self-referencing. The "no hreflang until localized copies exist" rule is met.
  - **No redirects** and no IP or browser-language detection. A footer language switcher links each page to its translation.
  - **Install CTAs on `/de` pages go to `/de/erweiterung`** (`DE_INSTALL_HUB_PATH`), the German counterpart of `/extension`. Its install button, and the inline install-step links, use the store URL tagged `utm_campaign=de_pilot` (`CHROME_WEB_STORE_URL_DE`). `InstallLink` tracks both store URLs (`isChromeWebStoreUrl`). `/de` pages report `page_template: "de_pilot"`.
  - **Same layouts as the English partners:** `/de` renders the homepage sections (`HomeClient locale="de"`), the Netflix, YouTube and Crunchyroll pages use `HubLandingLayout`, and the Discord, Watch2Gether and calendar pages use `SeoPageLayout`. The shared components take a `locale` prop and English output is unchanged.
  - **Known limits for the pilot:** `<html lang>` stays `en` (German content sits in `<div lang="de">`). The nav, footer, demo, store review quotes, Stripe checkout, store listing and extension stay English. German pricing (`components/pricing-section-de.tsx`, on `/de` and `/de/preise`) reads the published prices and plan limits without touching `components/pricing.tsx`, and its Plus and Pro buttons open `/pricing?billing=…` for checkout.
  - **Open item:** an Impressum (§5 DDG) with the operating company's details, which the owner supplies.
  - **Review:** week 8 after launch (go / hold / stop rules in the plan), second look at week 12. Rollback: delete `app/de`, revert the hreflang lines on the nine English pages (the pairs are in `lib/hreflang.ts`).

- **2026-11-11, Prime Video pre-launch pages (owner in chat, ANI-52 step 1):** two new URLs, published before the Prime Video adapter ships (expected about 25 Nov) so they can be indexed in time. Prime Video stays **not supported** everywhere until the store build has it: no HowTo for AniDachi on Prime Video, not in `SUPPORTED_PLATFORMS`, schema, the homepage or the facts paragraph. It is now in `PLANNED_PLATFORMS` (llms.txt "not available").
  - `/prime-video-watch-party`, titled "Prime Video Watch Party (Amazon Watch Party)" so it covers both names ("amazon prime video watch party" 3,600/mo, "amazon watch party" 2,900, "prime video watch party" 2,400, KP worldwide 12-month average). Answer first: Amazon removed Watch Party in spring 2024; what works today; AniDachi's Prime Video support "coming in an update", with no date. Built on `HubLandingLayout` (the platform hub template) with honest pre-launch content: the generic install button, "Works today on Netflix · Crunchyroll · YouTube", and steps for watching Prime Video together today without AniDachi (no HowTo JSON-LD). On launch day only the button text, the steps (AniDachi install steps plus HowTo) and the platforms line change (ANI-43 checklist). Conversion template: pillar. Listed in the navbar Watch menu as "Prime Video Watch Party · Coming soon", in the footer, and in the sitemap's weekly 0.9 hub tier, so it gets the same crawl paths as the other hubs.
  - `/guides/how-to-stream-prime-video-on-discord` (about 2,900/mo): DRM black screen, what people try, mobile, and the own-account setup, which works without AniDachi.
  - **Not built:** `/guides/amazon-watch-party`. `/compare/anidachi-vs-amazon-watch-party` already answers "does Amazon Watch Party still work" and now links the hub.
  - **Inbound links:** navbar and footer (hub), the compare page (hub and guide), `/guides/watch-movies-together-online` (hub), `/guides/how-to-screen-share-netflix-on-discord` (guide); the two new pages link each other.
  - **Facts (checked 11 Nov 2026):** Prime Video Usage Rules allow up to three streams per Amazon account and the same video on no more than two devices; the Terms of Use forbid broadcasting and circumventing DRM; Teleparty's FAQ lists Prime Video ("Amazon") on its free tier with sync and text chat.
  - **Review:** 30 days (11 Dec): indexed? impressions for the Prime queries? 60 and 90 days after launch day: desktop store clicks and sign-in reach (ANI-42).

- **2026-11-10, platform feature fact-check and llms.txt (owner in chat, ANI-50, ANI-41):**
  - **Fact-check (sources checked 10 Nov 2026):**
    - Prime Video removed Watch Party in spring 2024 (reported end date 2 April 2024; How-To Geek, Neowin, Tech Times).
    - Disney+ removed GroupWatch on 18 September 2023 (How-To Geek, GamesRadar).
    - HBO Max offers SharePlay on Apple devices only (HBO Max help center).
    - Netflix and Crunchyroll have no built-in watch party. YouTube has creator-run Premieres.
    - Hulu is unverified: sources conflict.
  - **Corrections:** `/compare/anidachi-vs-amazon-watch-party` was rewritten in place (same URL, title and H1). It no longer presents Amazon Watch Party as current, cites its sources with a check date, and lists Netflix as supported. The `/watch-movies-together-long-distance` FAQ no longer recommends Disney GroupWatch. Never describe Prime Video Watch Party or Disney+ GroupWatch as available.
  - **New route `/llms.txt`** (not a marketing page; 404 on non-production hosts) and `lib/product-facts.ts`: one facts paragraph and the supported and planned platform lists, also feeding the SoftwareApplication JSON-LD (`featureList`, `installUrl`). Tested in `lib/llms-txt.test.ts`. Add a platform there only once the store build supports it.

- **2026-11-10, 32 watch pages out of sitemap.xml (owner in chat):** `/watch/<slug>-with-friends` pages with zero Search Console impressions in the 90 days to 2026-11-09 (www and apex combined) and no store clicks are no longer listed in `sitemap.xml` (`lib/sitemap-watch-exclusions.ts`, tested in `lib/sitemap-watch-exclusions.test.ts`). They stay live, indexable (no `noindex`), self-canonical and linked from `/watch`. URLs and content are unchanged. The goal is to point Google's crawl at pages that earn impressions, starting with `/netflix-watch-party`, which is still "Discovered – not indexed". The sitemap drops from 358 to 326 URLs. One Piece, Demon Slayer, Jujutsu Kaisen and Fullmetal Alchemist: Brotherhood also had zero impressions but stay in, as top-priority franchises for the planned "where to watch" test. The 28-day view showed 71 zero-impression pages; the 90-day window is the more conservative cut. Re-measure on Dec 8: put a page back once it earns impressions or gets enriched. Noindex or merging remains a separate decision.

- **2026-11-10, Netflix merge and the Crunchyroll account pair (owner in chat, ANI-37, ANI-38):** 6 URLs → permanent redirects (308). Route folders removed, inbound links repointed or dropped, entries removed from `lib/guide-links.ts`. None of the six had more than 12 impressions in 90 days (GSC); `/netflix-watch-party` itself is not indexed yet.
  - `/guides/watch-netflix-together`, `/guides/how-to-watch-netflix-with-friends`, `/guides/netflix-group-watch` → `/netflix-watch-party`. The hub's steps heading is now "How to Watch Netflix Together" (3,600/mo for "how to watch netflix together"), the intro says "watch Netflix with friends online", and the hub gains four FAQ answers from the merged pages: black screen when sharing, video chat, who pauses, sharing one account.
  - `/guides/netflix-movie-night` → `/virtual-movie-night` (the cross-platform movie-night hub), which gains its time-zone and "can't find the movie" answers.
  - `/guides/teleparty-netflix` → `/netflix-party`, the Netflix comparison page. It's the stronger URL: 93 impressions, position 6.7–6.9 for "is netflix party still a thing" and "does netflix party still exist", against 12 impressions at position 37. It gains "Does Teleparty work on Netflix?". Its title stays as it is (it already ranks); the existing `/guides/netflix-teleparty` redirect now points straight at `/netflix-party`.
  - The existing `/guides/how-to-watch-netflix-together` redirect now points straight at `/netflix-watch-party`, so there's no chain.
  - Account pair, direction reversed by the owner: `/guides/does-everyone-need-crunchyroll-premium-for-watch-party` → `/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing`. The account-sharing guide is the stronger page (2,096 words, sourced from Crunchyroll's terms, titled for "crunchyroll account sharing", 1,300/mo). It gains the Premium page's four plan questions. Both had 0 impressions in 90 days.
  - Not in this change: `/guides/netflix-party-for-youtube` (goes into the YouTube merge, ANI-39) and `/watch-netflix-together-long-distance` (kept: 590/mo and rising).
  - Unsupported claims trimmed while carrying copy over: a camera-count limit and a Teleparty plan claim without a source.
  - Rollback: remove the redirects and restore the folders from git. Re-measure on Nov 24 and Dec 8, and request indexing for the four Netflix pages (ANI-17) once live.

- **2026-11-10, Crunchyroll merge batch 1 (owner in chat, ANI-38):** 15 URLs → permanent redirects (308) → `/watch-crunchyroll-together`. Route folders removed, inbound links repointed (or dropped where they would duplicate a hub link or point the hub at itself), entries removed from `lib/guide-links.ts`, `lib/section-index.ts` and `lib/pseo-new-guides.tsx`. Evidence: GSC 90 days (1,084 page-query rows), where the hub outranks every merged page on every shared query and the 15 pages together got about 6 clicks. The hub gains two FAQ answers ("Why is Teleparty not syncing on Crunchyroll?", "What is a good Crunchyroll Party alternative?"), and its quick-answer cards no longer link out to the merged pages.
  - Hub-intent guides: `how-to-sync-crunchyroll-with-friends`, `crunchyroll-group-watch`, `how-to-host-a-crunchyroll-watch-party`, `watch-party-app-for-crunchyroll`, `crunchyroll-watch-party-chrome-extension`, `crunchyroll-watch-party-free`, `how-to-watch-crunchyroll-together-without-screen-share`, `does-crunchyroll-have-watch-party`.
  - Teleparty and Crunchyroll Party: `does-teleparty-work-with-crunchyroll`, `teleparty-not-working-crunchyroll`, `netflix-party-for-crunchyroll`, `crunchyroll-party-alternative`, `is-crunchyroll-party-worth-it`, `/compare/anidachi-vs-crunchyroll-party`, `/compare/crunchyroll-party-vs-teleparty-for-anime`. No separate alternatives page: the hub already ranks 5–7 for "teleparty crunchyroll" and "crunchyroll party".
  - Not in this batch: `crunchyroll-watch-party-not-working` (not in the approved mapping), the account-sharing / Premium pair (direction under review), and batch 2 (`crunchyroll-watch-party-with-discord` → `can-you-screen-share-crunchyroll-on-discord`, `best-way-to-watch-crunchyroll-with-friends` → hub). Batch 2 waits until the hub has two weeks at ≥900 impressions a week. The hub fell from about 1,100–1,400 to about 500–660 a week from mid-October, when Google moved the Crunchyroll queries to the homepage.
  - Rollback: remove the redirects and restore the folders from git if the hub drops below about 450 impressions a week for two weeks, or loses more than 2 positions on "crunchyroll watch party" (5.3 in the week of 2 Nov). Re-measure on Nov 24 and Dec 8.

- **2026-11-07, platform hub layout and pillar headings (owner in chat, ANI-28, ANI-8):** `/watch-crunchyroll-together`, `/watch-anime-together`, `/watch-youtube-together`, `/netflix-watch-party` and `/discord-watch-party` moved to `HubLandingLayout` (homepage-style hero, demo, reviews and steps, then a centered reading section). Same URLs, canonicals and JSON-LD types; HowTo data now comes from the same step list as the visible steps. Approved heading changes:
  - `/watch-anime-together` title: "Watch Anime Together Online: Sync with Friends" (ANI-8; was "Watch Anime Together Online — Methods, Sync & Genre Guides (2026)", too long).
  - `/watch-youtube-together` H1: "YouTube Watch Party: Watch YouTube Together" (was "… With Friends").
  - `/watch-crunchyroll-together` H1: "Crunchyroll Watch Party" (was "Watch Crunchyroll Together with Friends"; matches the page title, breadcrumb and the higher-volume query, 480 vs 170 a month in the US. "Watch Crunchyroll together" stays in the URL and the steps heading).
  - `/discord-watch-party` H1: "Discord Watch Party" (was "Discord Watch Party: Three Ways to Watch Together"; the three ways stay in the short answer and the page title).

- **2026-11-07, pruning and force-index removal (owner in chat, ANI-25, ANI-14, ANI-16):** evidence in the [indexing diagnosis](../../../docs/releases/seo/2026-11-03-indexing-diagnosis.md) (URL Inspection of all 392 sitemap URLs, Nov 3).
  - **Force-index sitemap removed (ANI-25).** `/force-index-sitemap.xml`, `lib/force-index-urls.ts` and its `robots.txt` entry are gone; the route now 404s. It repeated 247 URLs already in `sitemap.xml` (164 of them `/watch/*`), was never submitted in Search Console, and its purpose (the www host move) is complete: 70% of sitemap URLs were indexed on Nov 3.
  - **11 genre hubs → their "best X anime" guides, permanent redirects (308) (ANI-14):** action, comedy, fantasy, horror, isekai, psychological, romance, sci-fi, shonen, slice-of-life, sports. `/watch-{genre}-anime-with-friends` → `/guides/best-{genre}-anime-to-watch-with-friends`. The 15 hubs had 7 impressions and 0 clicks in four weeks; the matching guides had 633 impressions and 7 clicks. ANI-14 said 9; the real count of hubs with a matching guide is 11, and the owner approved all 11. Mecha, mystery, shoujo and supernatural keep their hubs. `GENRE_HUB_LINKS` now points those genres at the guides, inbound links were repointed, and guides' links to their own hub were removed.
  - **Last two merges, 308 (ANI-16):** `/guides/discord-watch-together-activity` → `/guides/discord-watch-together`; `/compare/anidachi-vs-netflix-watch-party` → `/netflix-watch-party`. All four pages were "Discovered – not indexed". Inbound links repointed; both removed from `lib/guide-links.ts` and the `/compare` index.
  - **Sitemap `lastmod` (Nov 7, commit 49c37133):** the sitemap now carries `lastmod` read from each page's declared content date (`lib/sitemap-lastmod.ts`), never file mtimes or build time. This replaces the "no `lastmod`" rule in the 2026-10-12 entry.

- **2026-10-29, Crunchyroll-on-Discord merge (owner in chat, ANI-10):** `/guides/can-you-stream-crunchyroll-on-discord` → 308 → `/guides/can-you-screen-share-crunchyroll-on-discord`. Same question, 740 words, "URL is unknown to Google" on Oct 29. Route folder removed and its one inbound link repointed. The target was refreshed the same day with Go Live steps and the hardware acceleration fix. Of the five merge proposals, two remain: `discord-watch-together-activity` and `/compare/anidachi-vs-netflix-watch-party`.

- **2026-10-28, Netflix merges (owner in chat, ANI-6):** two of the five merge proposals in section 6 of the [indexing plan](../../../docs/superpowers/plans/2026-10-20-indexing-enrichment-linking-plan.md) are approved. Permanent redirects (308), route folders removed, inbound links repointed:
  - `/guides/how-to-watch-netflix-together` → `/guides/watch-netflix-together` (384 words, same "watch netflix together" intent; never indexed)
  - `/guides/netflix-party-extension` → `/netflix-party` (305 words, same "Netflix Party" intent; unknown to Google on Oct 28). `/netflix-party` gains a "Where do I find the Netflix Party extension?" FAQ.
  - The other three proposals still need separate approval. Re-inspect the Netflix cluster on Nov 4.

- **2026-10-20, indexing and enrichment plan (owner in chat):** approved items 1–5 of the [indexing, enrichment and linking plan](../../../docs/superpowers/plans/2026-10-20-indexing-enrichment-linking-plan.md); items 6–8 (Crunchyroll plans guide, Netflix anime list, streaming-services matrix) are not approved.
  - **Same-URL rebuilds:** `/netflix-watch-party` (Netflix hub), `/tools/crunchyroll-schedule` (title now leads with "release schedule"), `/guides/how-to-screen-share-netflix-on-discord`.
  - **New URLs:** `/tools/crunchyroll-dub-schedule` (parent `/tools`, updated every Monday with the simulcast calendar) and `/guides/is-teleparty-free` (parent `/compare/anidachi-vs-teleparty`; Teleparty claims cite its own pages, checked 20 Oct 2026). Review both at 30/60/90 days (Nov 19, Dec 19, Jan 18).
  - Same-URL enrichment of the unindexed Netflix, Discord, Crunchyroll, schedule, movie and free-anime pages listed in the plan, plus 43 contextual links from indexed pages. No merges, redirects or URL changes; the five merge proposals in section 6 of the plan still need separate approval.

- **2026-10-19, section index pages (owner in chat, H.1 option A):** new URLs `/guides`, `/compare`, `/watch`, `/glossary`, `/tools`. Each lists every page in its section (data in `lib/section-index.ts`; `section-index.test.ts` fails if a section page is missing). "Compare", "Glossary" and generated "Guides" breadcrumbs now point at them, and the footer links all five under "Browse". No existing URL, title or redirect changed. Review at 30/60/90 days with the index-coverage re-check. The homepage title (E) stays frozen until about Nov 2.
- **2026-10-19, SEO plan follow-up (owner in chat):**
  - **New compare pages approved:** `/compare/anidachi-vs-syncup` and `/compare/anidachi-vs-kosmi`. Parent hub `/watch-party-app`; inbound links from `/watch-party-app` and `/guides/best-watch-party-apps-for-anime`; competitor claims cite the competitors' own sites, checked 19 Oct 2026. Review at 30/60/90 days (Nov 18, Dec 18, Jan 17).
  - **Watch pages and genre hubs:** enrich the next 15 watch pages by GSC impressions in place (`lib/watch-page-enrichment.ts`). Genre hubs stay as they are (option A, keep and differentiate); re-measure after about Nov 2 before any merge, canonical or redirect, which still needs separate approval. Evidence: [index coverage report](../../../docs/releases/seo/2026-10-19-index-coverage-and-consolidation-report.md).

- **2026-10-12, SEO audit (GSC + GA4 + Amplitude):**
  - The 2026-07-28 portfolio freeze is lifted. New URLs still go through the publishing gate.
  - **Canonical host is `https://www.anidachi.app`.** Public metadata and sitemaps use `getSeoSiteOrigin()` to normalize the known public hosts to www. Keep `NEXT_PUBLIC_SITE_URL` and `getResolvedSiteOrigin()` unchanged for runtime consumers, including Gmail OAuth callback fallbacks; changing the shared env value is not an SEO fix. After separate production authorization, change only the existing Vercel apex-to-www redirect status from 307 to 308, preserving its destination, paths, and queries. See the [selective release contract](../../../docs/releases/seo/2026-10-12-selective-website-release.md).
  - **Permanent redirects (308) for exact twins:**
    - `/guides/netflix-teleparty` → `/guides/teleparty-netflix`
    - `/guides/anime-date-night-ideas-long-distance` → `/long-distance-anime-date-night-ideas`
    - `/guides/how-to-remove-anime-from-continue-watching-on-crunchyroll` → `/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll`
    - `/guides/how-to-stream-anime-on-discord` → `/guides/how-to-watch-anime-with-friends-on-discord`
  - **Bare watch slugs** (`/watch/naruto`) 308 to `/watch/naruto-with-friends`.
  - **Sitemap:** no `lastmod` from file mtimes (they reset on every Vercel build); real content dates were added 2026-11-07, no private or `/dev` routes, and `/extension` is included.
  - **Watch pages** don't publish MyAnimeList ratings as `AggregateRating`.
  - **Until about 2026-11-02**, don't change titles, H1s or URLs on `/`, `/watch-anime-together` or `/guides/best-anime-to-watch-with-friends` while Google moves them from the apex to www.
  - ~~Keep `/force-index-sitemap.xml` until the host move settles.~~ Removed 2026-11-07 (ANI-25).
- **2026-10-09:** the free tool pages plan (`/tools/*`: filler lists, One Piece episode count, random anime generator, watch orders, Crunchyroll schedule) is approved. It overrides the 2026-09-28 rejection in `.cursor/scratchpad.md`.
- **2026-08-11:** `/feature-requests`, a public product feedback form, is approved as an additive page.

---

## Pre-publish checklist

- [ ] Publishing gate passed
- [ ] URL stability: same path (no slug/redirect/canonical retarget)
- [ ] No cannibalization of an owned query
- [ ] Canonical = path; FAQ body ↔ JSON-LD
- [ ] Product claims truthful (Crunchyroll + YouTube + Netflix limits)
- [ ] Sources for competitor / absolute claims
- [ ] Inbound links planned
- [ ] `pnpm --filter @anidachi/web check` (and build when required)

*Last updated: 2026-11-07 (approved Free20 release copy; production activation remains separately gated; URL/title and canonical safeguards retained)*
