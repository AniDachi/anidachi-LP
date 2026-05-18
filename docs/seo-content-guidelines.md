# AniDachi Programmatic SEO — Content Engine Guidelines

This document is the single source of truth for creating new SEO pages on [anidachi.app](https://anidachi.app). Follow it so every page matches the quality of existing pillars (`/watch-anime-together`, `/watch-crunchyroll-together`), guides under `/guides/`, and comparisons under `/compare/`.

## Context

AniDachi is a Chrome extension for creating **watchrooms**, syncing **Crunchyroll** playback, and discussing episodes **asynchronously**—the main differentiator is **async co-watching** (no shared schedule required).

## Canonical anime URL (Template A)

**Do not** use a nested path like `/anime/.../watch-with-friends`. Production uses a **flat** URL:

- **Pattern:** `/watch/{anime-base-slug}-with-friends`
- **Example:** `/watch/attack-on-titan-with-friends`
- **Implementation:** `app/watch/[slug]/page.tsx` — the dynamic `slug` is the full segment (e.g. `attack-on-titan-with-friends`); code strips `-with-friends` to resolve `lib/anime-data.ts`.

**Rationale:** Shorter paths, stable indexed URLs (49+ pages), and avoiding unnecessary 301 chains and crawl budget cost. The phrase `watch-with-friends` as a **suffix** on the slug is enough for relevance; it does not need to be a separate path segment.

---

## Page template catalog

Identify **one** template per page. **Do not mix** templates.

### Template A — Anime title pages

| | |
|---|---|
| **URL** | `/watch/{base-slug}-with-friends` |
| **Primary keyword** | `watch [Anime Title] with friends` |
| **Secondary** | `[Anime] watch party`, `[Anime] watchroom`, `[Anime] sync Crunchyroll` |
| **Word count** | 450–650 |
| **Schema** | `FAQPage` + `BreadcrumbList` + `Article` |

**Sections (order):**

1. **H1:** `Watch [Anime Title] with Friends — AniDachi Watchrooms` (or equivalent on-brand)
2. **Lede** (60–80 words, lead with `<strong>`): Why this anime is better shared; reference a **concrete** story moment (finale, twist, cliffhanger)—not generic copy. Synopsis context can be informed by Jikan `GET /v4/anime/{id}` (do not copy-paste MAL/Crunchyroll text verbatim for the lede).
3. **Step-by-step setup** (5 numbered steps): Standard AniDachi flow; inject `[Anime Title]` in steps 2 and 3.
4. **Why [Anime] is perfect for async watching** (150–200 words): Episode length, cadence, spoiler/discussion density. Prefer Jikan for `episodes`, `airing`.
5. **Discussion tips** (3–5 bullets): Evergreen but fan-specific hooks.
6. **CTA** → `/#pricing`
7. **Related anime** (3 internal links) → `/watch/{slug}-with-friends` (from Jikan recommendations where possible, matched to your seed list).
8. **FAQ** (exactly 3) + `FAQPage` schema:
   - Does [Anime] have a watch party feature on Crunchyroll?
   - Can I watch [Anime] with friends asynchronously?
   - Do all my friends need Crunchyroll to watch [Anime] together?

---

### Template B — Competitor comparison pages

| | |
|---|---|
| **URL** | `/compare/anidachi-vs-[competitor]` |
| **Primary** | `anidachi vs [competitor]`, `[competitor] alternative for anime` |
| **Word count** | 550–750 |
| **Schema** | `FAQPage` + `BreadcrumbList` |
| **Tone** | Informative, not adversarial |

**Competitors to cover:** `teleparty` (done), `discord`, `crunchyroll-party`, `syncplay`, `watch2gether`, `kast`, `scener`

**Sections (order):**

1. H1: `AniDachi vs [Competitor]: Which Is Better for Watching Anime Together?`
2. **TL;DR** + table: columns Feature \| AniDachi \| [Competitor]. Rows: Crunchyroll sync, Async watching, Auto anime detection, Chat, Free tier, Setup time.
3. **When to use AniDachi** (4–5 bullets)
4. **When to use [Competitor]** (3–4 bullets, fair)
5. **Feature deep-dive** (2–3 paragraphs), emphasize async + Crunchyroll fit; verify competitor facts.
6. CTA
7. FAQ (3) + schema: free vs; Crunchyroll support; switching

---

### Template C — How-to guides

| | |
|---|---|
| **URL** | `/guides/[action-slug]` |
| **Primary** | `how to [action]` (problem-first) |
| **Word count** | 600–900 |
| **Schema** | `FAQPage` + `HowTo` (Method 1 steps) + `BreadcrumbList` |

**Priority slugs (build order):**

1. `how-to-watch-anime-with-friends-online`
2. `how-to-watch-anime-long-distance`
3. `how-to-watch-anime-with-friends-in-different-time-zones`
4. `how-to-watch-anime-without-spoilers`
5. `how-to-create-an-anime-watch-party`
6. `how-to-watch-crunchyroll-on-two-screens`
7. `how-to-sync-crunchyroll-with-someone`
8. `how-to-watch-anime-with-a-group`
9. `how-to-share-anime-reactions-with-friends`
10. `how-to-start-an-anime-club-online`

**Sections (order):**

1. H1 = exact keyword, title case
2. **Answer-first** (50–70 words, `<strong>`): `[Action] is possible by [method]. The easiest way is [AniDachi] because [benefit].`
3. **Methods** (2–4): H2 each; Method 1 AniDachi (150–200 words), others shorter, honest
4. **Numbered steps** for Method 1 (≤10) — feed `HowTo` JSON-LD
5. CTA
6. **Related guides** (3–4 internal links)
7. FAQ (3) + `FAQPage`

---

### Template D — “Best anime to watch [modifier]” listicles

| | |
|---|---|
| **URL** | `/guides/best-anime-to-watch-[modifier]` |
| **Primary** | `best anime to watch [modifier]` |
| **Word count** | 1,200–1,800 |
| **Schema** | `FAQPage` + `ItemList` + `BreadcrumbList` |
| **Layout** | Use `aboveFoldCta` on `SeoPageLayout` so a CTA appears high on mobile |

**Modifier backlog (priority):** `with-friends` (exists), `with-girlfriend`, `with-boyfriend`, `online-together`, `long-distance`, `as-a-group`, `in-a-watch-party`, `for-beginners`, `on-crunchyroll-with-friends`, `asynchronously`

**Sections (order):**

1. H1: `[N] Best Anime to Watch [Modifier] in [Year]`
2. Intro (80–100 words)
3. Per anime: H2, poster from Jikan `images.jpg.large_image_url`, `alt="[Title] watch party"`, 60–80 words, link `Watch [Title] with friends →` → `/watch/{slug}-with-friends`
4. CTA
5. FAQ (3)

---

## Global rules

### One primary keyword per page

Check existing routes and Search Console; avoid cannibalization.

Place the primary keyword in: `<title>`, `<h1>`, first ~100 words, at least one `<h2>`, meta description.

- **Title:** `"[Primary Keyword] — AniDachi"` (≤60 characters)
- **Description:** one sentence answer + CTA (≤155 characters)

### Internal linking (minimum 3 per new page)

- One to `/` or `/#pricing`
- One to a pillar: `/watch-anime-together` or `/watch-crunchyroll-together`
- One to a related live page
- Add every new guide/listicle route to `lib/guide-links.ts` so hub pages can pick it up automatically.

When you add a Template A page, update the **pillar** (e.g. “Popular anime”) so the graph stays bidirectional.

### Schema

Use JSON-LD via the shared components in `components/json-ld.tsx`. Always include **BreadcrumbList**; add **FAQPage** when an FAQ block exists; **HowTo** on Template C; **ItemList** on Template D; **Article** on article-style pages as implemented.

### Content quality

- No filler openers (“In today’s world…”, “Anime fans know…”).
- Reading level: grade 8–10; paragraphs ≤3 sentences; bullets for steps and comparisons.
- **Anime facts** (episodes, score, airing) should come from **Jikan** when publishing or refreshing pages—not invented.
- At least one **anime-specific** detail per Template A page (arc, episode beat, character moment).
- CTA: visible early on long pages (Template D) **and** at the end.

### URL and file naming

- Lowercase, hyphens, no trailing slash.
- Drop stop words in slugs unless they are part of the query.
- App Router examples: `app/watch/[slug]/page.tsx`, `app/guides/.../page.tsx`, `app/compare/.../page.tsx`.

---

## Jikan API (`lib/jikan.ts`)

The repo includes typed helpers in `lib/jikan.ts` and, for programmatic watch pages, `lib/jikan-for-watch-page.ts` (React `cache` for one Jikan request per page) plus `lib/anime-mal-ids.ts` (slug → MAL id). Server-side fetch uses `next: { revalidate: 86400 }` (24h) for caching. If Jikan is unavailable, pages fall back to the copy in `anime-data.ts` and the static `related` list.

Common endpoints:

- `GET /v4/anime?order_by=members&sort=desc&limit=25`
- `GET /v4/anime/{id}`
- `GET /v4/anime/{id}/recommendations`
- `GET /v4/anime/{id}/episodes`

Respect Jikan’s rate limit (~3 rps). Before production builds, run **`npm run cache:jikan`** (also runs automatically via `npm run build`) to refresh **`lib/anime-jikan-cache.json`**. Watch pages use that file when live Jikan fails during static generation.

---

## `lib/anime-data.ts` (build-time slugs)

Used for `generateStaticParams` and local copy. Each entry: `slug`, `title`, unique written synopsis, `episodes` string, `genres` (3), `related` (3 slugs to existing entries). Add titles with **≥~100k MAL members** for Template A at scale.

---

## Sitemap (`app/sitemap.ts`)

- Template A URLs are generated from the anime list (`/watch/{slug}-with-friends`).
- New static pages must be added to the static routes list.
- Priorities: pillar 0.9; compare + guide 0.8; listicle 0.7; anime title 0.6; glossary 0.5 (adjust to match `sitemap.ts` when editing).

---

## `dateModified` protocol

- Set `datePublished` once at launch.
- Bump `dateModified` on every **meaningful** content edit (use `YYYY-MM-DD` in `SeoPageLayout`).
- Do not backdate to manipulate freshness.

---

## Table of contents (on-page SEO)

Long SEO pages should pass a `headings` array into `SeoPageLayout` so users (and search features) can jump to sections. Each linked section needs a stable **`id` on the corresponding `<h2>`** (or `h3`) that matches the TOC.

**Rationale:** In-page anchor navigation supports “Jump to” style behavior in SERPs when headings are clear and first-party anchor links are consistent.

---

## Interactive TOC component

Implementation: `components/table-of-contents.tsx` (client) + `headings` prop on `SeoPageLayout`.

- **Desktop:** sticky “On this page” beside the article.
- **Mobile:** collapsible “Contents” at the top of the article column.
- **Active state:** `IntersectionObserver` to highlight the section in view.

All published SEO routes that use `SeoPageLayout` (pillars, guides, compare, glossary, and programmatic `/watch/...-with-friends` pages) pass `headings` with matching `id` / `scroll-mt-24` on section headings so the TOC stays in sync.

---

## 100-page build order (summary)

| Priority | Template | Count | Notes |
|----------|----------|-------|--------|
| 1 | Template A (top anime) | 50 | Highest volume, direct product fit |
| 2 | Template C (how-tos) | 20 | Snippets + intent |
| 3 | Template D (listicles) | 15 | Funnel to Template A |
| 4 | Template B (comparisons) | 10 | Competitor + conversion |
| 5 | Template A (seasonal / airing) | 5 | Topicality |

Use the seed list and topic lists in this doc’s Template sections as the working backlog.

---

## Pre-publish checklist

- [ ] `metadata` title ≤60 chars, description ≤155 chars, canonical = exact path
- [ ] H1 and **one primary keyword** strategy satisfied; no cannibalization
- [ ] `SeoPageLayout` props align with `metadata` (title, description, url, dates)
- [ ] Breadcrumb JSON-LD + any FAQ/HowTo/ItemList/Article as required by template
- [ ] If TOC: `headings[]` and matching **`id` on sections**
- [ ] ≥3 internal links (home, pillar, related)
- [ ] Outbound to a primary source on Template C where applicable
- [ ] `dateModified` updated if content changed
- [ ] `npm run build` passes

---

*Last updated: 2026-04-24*
