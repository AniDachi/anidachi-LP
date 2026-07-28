# AniDachi SEO Content Guidelines

**Single source of truth** for public marketing SEO on [anidachi.app](https://anidachi.app).  
Dated keyword volumes and batch plans live in separate plan docs — re-pull Keyword Planner before treating any number as current.

Operational agent: [`.cursor/agents/anidachi-seo-aeo-pages.md`](../../../.cursor/agents/anidachi-seo-aeo-pages.md)  
Portfolio freeze / safety: [`seo-portfolio-freeze.md`](./seo-portfolio-freeze.md)  
Editorial standards: [`/editorial-policy`](https://anidachi.app/editorial-policy)

---

## Product truth

AniDachi is a Chrome extension + web product for **watchrooms** on:

- **Crunchyroll** (catalog pages, desktop Chrome)
- **YouTube** (full `youtube.com/watch` pages, desktop Chrome — not Shorts, embeds, feeds, or native mobile apps)

Differentiators: sync + async catch-up, chat, progress. Each person uses their own streaming account.  
**Not supported:** Netflix, Disney+, Hulu, Amazon Prime Video sync.  
**Not affiliated** with Crunchyroll, Sony, YouTube, or Google.

Primary conversion path: **`/pricing`** until a real Chrome Web Store listing is live. Install how-tos must not invent generic `chromewebstore.google.com` “Add to Chrome” CTAs. Prefer linking the install hub when `/extension` is the live download/store path.

---

## Hard safety rules (ranking / indexation)

Do **not**, without owner approval + GSC evidence:

- Ship net-new SEO URL batches while the publishing freeze is active (`seo-portfolio-freeze.md`)
- 301 / Merge / Retire / Delete public marketing URLs
- Add `noindex` to previously indexable marketing URLs
- Remove the cohort discovery sitemap while Coverage is recovering
- Shrink footer/nav crawl paths to existing spokes
- Rewrite high-traffic pillar H1s or primary intent

Default: **enrich in place**, additive pages, reversible changes.

Evidence order: Google documentation → AniDachi GSC/GA4 → reproducible tests → third-party studies → patents/leaks as hypotheses only.  
Do **not** treat domain age, WHOIS, dwell time, schema, or “force-index” sitemaps as ranking levers.

---

## Publishing gate (every new or major SEO URL)

A page may ship only if **all** are true:

1. Previous cohort is healthy enough (or freeze is lifted by owner).
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

When adding titles: update `animeList` + MAL ids, hub/listicle backlinks, bump `dateModified` only when content meaningfully changes. Prefer enriching existing titles over unbounded catalog growth while freeze is active.

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

- Answer-first; commercial pages: fold CTA + mid `PrimaryCheckoutCta`
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

---

## Pre-publish checklist

- [ ] Freeze / publishing gate passed
- [ ] No cannibalization of an owned query
- [ ] Canonical = path; FAQ body ↔ JSON-LD
- [ ] Product claims truthful (CR + YT limits)
- [ ] Sources for competitor / absolute claims
- [ ] Inbound links planned
- [ ] `pnpm --filter @anidachi/web check` (and build when required)

*Last updated: 2026-07-28*
