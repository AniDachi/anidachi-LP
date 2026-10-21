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

Free accounts join Plus/Pro/trial hosts; creating rooms requires the host's own Plus or Pro access. Plus supports 6 people including the host, Pro 15; friends join free. Recording and editing personal history require each viewer's own paid/trial access. Automatic recording additionally requires permission in the extension; YouTube has a separate recording switch. Saved history, Resume and deletion remain available on Free.

Plus and Pro offer monthly/yearly billing and one 3-day trial per eligible account, including existing Free accounts that have not used it. Describe the current server offer: a card-required trial renews automatically unless renewal is canceled before the end; a cardless trial requires no card and ends without payment unless the user explicitly enables renewal with the displayed plan, period, price and first-charge date. Existing card-required trials retain their original terms. Cardless rollout remains gated; do not claim it is enabled in an environment merely because its code exists. Do not promise a new trial for switching plans or billing periods.

**Planned only:** async catch-up, shared group progress, persistent room context/chat and replayed reactions. Never sell these as current features or paid-plan benefits. Mark future mentions clearly; do not include them among instructions users can follow today.

Use `lib/pricing-copy.ts` for shared commercial copy. Legacy Free hosting/quota data in the protocol is compatibility data, not a current marketing offer. Update visible text, FAQ/HowTo JSON-LD and search/social metadata together.

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
  - **Sitemap:** no `lastmod` (file mtimes reset on every Vercel build), no private or `/dev` routes, and `/extension` is included.
  - **Watch pages** don't publish MyAnimeList ratings as `AggregateRating`.
  - **Until about 2026-11-02**, don't change titles, H1s or URLs on `/`, `/watch-anime-together` or `/guides/best-anime-to-watch-with-friends` while Google moves them from the apex to www.
  - Keep `/force-index-sitemap.xml` until the host move settles. It repeats URLs already in `sitemap.xml`; remove it after reviewing GSC Coverage.
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

*Last updated: 2026-10-17 (Netflix launch copy; existing URL/title and canonical safeguards retained)*
