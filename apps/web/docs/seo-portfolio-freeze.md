# SEO Trust & Authority plan (2026-07-28)

Net-new SEO route batches are **frozen** until the current public cohort completes a 30/60/90-day review.

## Owner decisions since the freeze (updated 2026-10-12)

These are explicit owner exceptions. The rest of this document still applies.

- **2026-10-09:** the free tool pages plan (`/tools/*`: filler lists, One Piece episode count, random anime generator, watch orders, Crunchyroll schedule) is approved. It overrides the 2026-09-28 rejection in `.cursor/scratchpad.md`.
- **2026-10-12, SEO audit (GSC + GA4 + Amplitude):**
  - **Canonical host is `https://www.anidachi.app`.** Public metadata and sitemaps use `getSeoSiteOrigin()` to normalize the known public hosts to www. Keep `NEXT_PUBLIC_SITE_URL` and `getResolvedSiteOrigin()` unchanged for runtime consumers, including Gmail OAuth callback fallbacks; changing the shared env value is not an SEO fix. After separate production authorization, change only the existing Vercel apex-to-www redirect status from 307 to 308, preserving its destination, paths, and queries. See the [selective release contract](../../../docs/releases/seo/2026-10-12-selective-website-release.md).
  - **Permanent redirects (308) for exact twins**, approved:
    - `/guides/netflix-teleparty` → `/guides/teleparty-netflix`
    - `/guides/anime-date-night-ideas-long-distance` → `/long-distance-anime-date-night-ideas`
    - `/guides/how-to-remove-anime-from-continue-watching-on-crunchyroll` → `/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll`
    - `/guides/how-to-stream-anime-on-discord` → `/guides/how-to-watch-anime-with-friends-on-discord`
  - **Bare watch slugs** (`/watch/naruto`) 308 to `/watch/naruto-with-friends`.
  - **Sitemap:** no `lastmod` (file mtimes reset on every Vercel build), no private or `/dev` routes, and `/extension` is included.
  - **Watch pages** no longer publish MyAnimeList ratings as `AggregateRating`.
  - **Until about 2026-11-02**, don't change titles, H1s or URLs on `/`, `/watch-anime-together` or `/guides/best-anime-to-watch-with-friends` while Google moves them from the apex to www.

## Hard safety constraint

Do **not** risk current ranking, indexation, or core product flows.

- Allowed: enrich **existing** URLs in place, additive docs/tools/pages (non-SEO or owner-approved), analytics attribution, agent rules, stop *false* freshness while keeping discovery sitemaps live.
- Owner-approved additive surfaces (not SEO growth bait): `/feature-requests` (public product feedback form).
- Forbidden without explicit owner approval + GSC evidence: 301/Merge/Retire, **slug/path renames or canonical retargets**, new `noindex` on marketing URLs, deleting the cohort/force-index sitemap while Coverage recovers, shrinking footer/nav crawl paths, high-traffic H1/intent rewrites, checkout/auth/room/billing behavior changes beyond optional metadata.

### URL stability (ranked pages)

Public marketing URLs are already ranked. **Do not change URL structure** (paths, slugs, redirects, canonical targets to a different page). Google must not be forced to re-associate equity. Enrich copy/CTA/schema on the **same** path only.

### Winner queue (while freeze is active)

1. Run `seo:portfolio` and treat **Keep / Enrich** as the default backlog.
2. Enrich winners **in place** (same URL): CTR meta, answer-first copy, mid CTA, product truth.
3. Treat **Merge/301** rows as report-only — strengthen internal links toward the owner page; do **not** redirect.
4. Keep [`FORCE_INDEX_URL_PATHS`](../lib/force-index-urls.ts) + `/force-index-sitemap.xml` advertised until Coverage recovers.

## Freeze exit criteria

All required before lifting:

1. 30/60/90-day cohort review documented against GSC Coverage (Indexed vs Discovered / Crawled – not indexed) for the force-index set.
2. Material drop in Discovered-not-indexed for that cohort (or owner accepts residual).
3. Publishing gate still enforced for any net-new URL (owned-query check, hub + 2 inbounds, &lt;10 searches/mo reject) — never by renaming ranked URLs.
4. Owner explicit “freeze lifted” note in this doc.

## Run the portfolio audit

```bash
pnpm --filter @anidachi/web seo:portfolio
pnpm --filter @anidachi/web seo:portfolio -- --days 28 --out ./tmp/seo-portfolio.json
```

Requires Google Marketing OAuth (Search Console + Analytics) via Kreatli CRM reconnect.

## What the report covers

- Full public route inventory (static discovery + `animeList`)
- GSC page + query×page (cannibalization candidates)
- GA4 sessions, organic channel sessions, key events by landing path
- Suggested action per URL: Keep / Enrich / Merge/301 / Review

## What it does not replace

- GSC **Coverage** (Indexed vs Discovered / Crawled – not indexed)
- Manual claim verification before any Merge/301
- Owner approval before any URL removal or redirect
- URL stability: Merge/301 must not ship without owner + evidence; prefer never moving ranked paths

## Attribution

First-touch `seo_landing_path` is captured in session storage and attached to GA4 conversion events and Stripe Checkout/Subscription metadata. See `docs/CONVERSION_METRICS.md`. Invisible to UI; does not change checkout success/failure.

## Agent / guidelines

SEO agent operating contract + publishing gates: [`.cursor/agents/anidachi-seo-aeo-pages.md`](../../../.cursor/agents/anidachi-seo-aeo-pages.md)  
Durable SoT: [`seo-content-guidelines.md`](./seo-content-guidelines.md)

*Last reviewed: 2026-08-12 — owner-approved `/feature-requests`; prior URL stability + winner queue + exit criteria.*
