# AniDachi — Watch Anime Together

AniDachi (アニ友 = "anime friend") is a platform for watching anime together with friends. This repository is the source of truth for the website, Chrome extension, room API, shared protocol, SEO content hub, and internal tools.

## Stack

- **Monorepo:** pnpm 11 + Turborepo
- **Website:** Next.js 15 App Router, React 19, Tailwind CSS 4, shadcn/ui
- **Extension:** WXT, React, TypeScript
- **Realtime API:** Cloudflare Workers, Durable Objects, Hono, WebSocket
- **Shared protocol:** TypeScript + Zod
- **Database/auth:** Supabase-backed website auth and room records
- **Payments:** Stripe Checkout
- **Analytics:** Google Analytics 4
- **Hosting:** Vercel for web, Cloudflare Workers for API

## Local Development

```bash
corepack enable
corepack prepare pnpm@11.2.2 --activate
pnpm install

cp apps/web/.env.example apps/web/.env.local   # Fill in required values
pnpm dev:web                                  # Runs on http://localhost:3003
```

Useful commands:

```bash
pnpm check
pnpm test
pnpm dev:extension
pnpm dev:api
pnpm dev:demo
pnpm build:extension:public
```

## Project Structure

```
apps/
  web/                        # anidachi.app website, auth, rooms, Stripe, SEO, Supabase migrations
  extension/                  # WXT Chrome extension
  api/                        # Cloudflare Worker + Durable Objects room server
  demo/                       # Local HTML5 video demo page

packages/
  protocol/                   # Shared Zod protocol, sync math, event types

docs/                         # Product architecture and migration plans
infra/                        # Local/dev infra helpers
scripts/                      # Repository-level build scripts
```

## SEO / Content

Authoritative rules for new pages (templates, URLs, Jikan, TOC, checklist): **[apps/web/docs/seo-content-guidelines.md](apps/web/docs/seo-content-guidelines.md)**.

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

See `apps/web/.env.example` for website variables. Key ones:

- `NEXT_PUBLIC_SITE_URL` — canonical origin for metadata, sitemap, robots, JSON-LD (production: `https://anidachi.app`; on Vercel previews, `VERCEL_URL` is used when this is unset)
- `NEXT_PUBLIC_ROBOTS_NOINDEX` / `VERCEL_ENV` — see `.env.example`; preview hosts avoid indexing via `lib/site-url.ts`
- Optional: `NEXT_PUBLIC_DISALLOW_AI_TRAINING_BOTS` — opt-in AI crawler blocks in `app/robots.ts`
- `KREATLI_CRM_PASSWORD` / `KREATLI_CRM_SESSION_SECRET` — internal tools
- Stripe and Google API keys for payments and CRM

## Development Workflow

- `main` is production.
- `staging` is the shared test environment.
- Create feature branches from `staging`.
- Open PRs into `staging` first.
- After testing staging, open a release PR from `staging` into `main`.
- Do not commit generated extension folders.
- Build extension artifacts through CI or `pnpm build:extension:public`.

See **[docs/development-environments.md](docs/development-environments.md)** for
the full staging/production model, current protected staging URL, extension build
targets, OAuth redirects, and release checklist.

For a human-readable Russian team guide, read
**[docs/team-guide-ru.md](docs/team-guide-ru.md)**.

For a complete developer or AI-agent handoff, read
**[docs/developer-handoff.md](docs/developer-handoff.md)**.
