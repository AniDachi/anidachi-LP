# SEO Trust & Authority plan (2026-07-28)

Net-new SEO route batches are **frozen** until the current public cohort completes a 30/60/90-day review.

## Hard safety constraint

Do **not** risk current ranking, indexation, or core product flows.

- Allowed: additive docs/tools/pages, analytics attribution, agent rules, stop *false* freshness while keeping discovery sitemaps live.
- Forbidden without explicit owner approval + GSC evidence: 301/Merge/Retire, new `noindex` on marketing URLs, deleting the cohort/force-index sitemap while Coverage recovers, shrinking footer/nav crawl paths, high-traffic H1/intent rewrites, checkout/auth/room/billing behavior changes beyond optional metadata.

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

## Attribution

First-touch `seo_landing_path` is captured in session storage and attached to GA4 conversion events and Stripe Checkout/Subscription metadata. See `docs/CONVERSION_METRICS.md`. Invisible to UI; does not change checkout success/failure.

## Agent / guidelines

SEO agent operating contract + publishing gates: [`.cursor/agents/anidachi-seo-aeo-pages.md`](../../../.cursor/agents/anidachi-seo-aeo-pages.md)  
Durable SoT: [`seo-content-guidelines.md`](./seo-content-guidelines.md)
