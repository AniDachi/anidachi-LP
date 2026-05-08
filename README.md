# AniDachi — Watch Anime Together

AniDachi (アニ友 = "anime friend") is a platform for watching anime together with friends. It includes a landing site, SEO content hub, and internal tools.

## Stack

- **Framework:** Next.js 15 (App Router, React 19)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Payments:** Stripe Checkout
- **Analytics:** Google Analytics 4
- **Hosting:** Vercel

## Local Development

```bash
cp .env.example .env.local   # Fill in required values
npm install
npm run dev                   # Runs on http://localhost:3003
```

## Project Structure

```
app/
  page.tsx                    # Landing page (home)
  watch-anime-together/       # Pillar: watch anime together guide
  watch-crunchyroll-together/ # Pillar: Crunchyroll-specific guide
  guides/                     # Spoke articles (how-to, comparisons)
  compare/                    # Comparison pages (vs Teleparty, etc.)
  glossary/                   # AEO glossary terms
  watch/[slug]/               # Programmatic anime pages (50+ titles)
  privacy/                    # Privacy policy
  terms/                      # Terms of service
  success/                    # Post-checkout confirmation
  blou/                       # Internal content manager (noindex)
  api/                        # API routes (Stripe, auth, media)

components/                   # Shared React components
  table-of-contents.tsx       # In-page “On this page” (via SeoPageLayout)
lib/                          # Utilities, data, analytics
  anime-data.ts               # Anime title seed for programmatic pages
  jikan.ts                    # MyAnimeList data via Jikan API (revalidated 24h)
  anime-mal-ids.ts            # MAL id per anime slug (for Jikan on /watch/ pages)
  jikan-for-watch-page.ts     # Cached Jikan fetch + related-title resolution
  home-faq.ts                 # FAQ data shared between component + JSON-LD
  gtag.ts                     # GA4 event helper
```

## SEO / Content

Authoritative rules for new pages (templates, URLs, Jikan, TOC, checklist): **[docs/seo-content-guidelines.md](docs/seo-content-guidelines.md)**.

The site uses a hub-and-spoke content model:

- **Pillars:** `/watch-anime-together`, `/watch-crunchyroll-together`
- **Spokes:** Guide and comparison pages in `/guides/` and `/compare/`
- **Programmatic:** `/watch/[slug]-with-friends` pages from `lib/anime-data.ts`
- **Glossary:** AEO-optimized definitions in `/glossary/`

Every page includes:
- Per-route `Metadata` (title, description, canonical, OG, Twitter)
- JSON-LD structured data (FAQPage, Article, BreadcrumbList, etc.)
- Internal links to 3+ sibling pages

## Environment Variables

See `.env.example` for all variables. Key ones:

- `NEXT_PUBLIC_SITE_URL` — canonical origin for metadata, sitemap, robots, JSON-LD (production: `https://anidachi.app`; on Vercel previews, `VERCEL_URL` is used when this is unset)
- `NEXT_PUBLIC_ROBOTS_NOINDEX` / `VERCEL_ENV` — see `.env.example`; preview hosts avoid indexing via `lib/site-url.ts`
- Optional: `NEXT_PUBLIC_DISALLOW_AI_TRAINING_BOTS` — opt-in AI crawler blocks in `app/robots.ts`
- `KREATLI_CRM_PASSWORD` / `KREATLI_CRM_SESSION_SECRET` — internal tools
- Stripe and Google API keys for payments and CRM
