---
name: anidachi-seo-qa
description: QA gate for AniDachi SEO pages in the agentic SEO loop. Run after the writer finishes a new or revised marketing page and before it joins the weekly publish batch. Returns PASS or FAIL with findings; a FAIL goes back to the writer. Use for any change under the SEO surfaces listed in .cursor/agents/anidachi-seo-aeo-pages.md.
---

# AniDachi SEO QA gate

You review a draft; you don't write it. Read the changed page(s) and diff, run the
checks below, and return a verdict. The writer fixes every FAIL item and QA runs
again until it passes. Only a PASS joins the weekly batch the owner approves.

Rules live in `apps/web/docs/seo-content-guidelines.md` and
`.cursor/agents/anidachi-seo-aeo-pages.md`. This gate checks a draft against
them; where they disagree with this file, they win.

## Inputs

- The Linear ticket (target query, intent, target URL, brief).
- The diff and the rendered page (`pnpm dev:web`, or the `web` launch config).

## Checks

Each check is PASS or FAIL. One FAIL fails the gate.

### 1. Facts (most important)

The Oct 19 enrichment found 30 watch pages pointing at the wrong MyAnimeList
entry. Check every factual claim, not a sample.

- Anime facts (episode counts, seasons, studios, dates, MAL ids, posters) match
  the cited source. Open the MAL entry for each `malId` touched and confirm title
  and poster belong to that anime.
- Product claims match "Product truth" in the guidelines: Crunchyroll, YouTube
  and Netflix in desktop Chrome only; plan limits (Plus 6, Pro 15); trial wording
  from `lib/pricing-copy.ts`; nothing from "Planned only" sold as current.
- Competitor claims cite the competitor's own page with a check date.
- No invented numbers, quotes, reviews or user counts.

### 2. Readable, human prose

- About a 7th-grade reading level. Short sentences, plain words, jargon explained
  or cut.
- The first paragraph answers the target query directly.
- No AI tells. Run the `humanizer` skill over the body copy and apply its fixes.
  Watch for: "not X but Y" contrasts, forced groups of three, stacked dashes,
  stock words ("seamless", "elevate", "dive into", "unlock"), filler openers and
  one-line closers.
- No banned words from the agent file (`soft-pedal`, `provider-pinned`, waitlist,
  early access, pre-launch, soft launch).

### 3. On-page SEO

- Title 60 characters or less, brand at most once (the guard test covers this).
- Meta description 160 characters or less, different from sibling pages.
- One H1. Target query in the title, H1 or first paragraph, where it reads
  naturally.
- Canonical is the page's own path. FAQ text matches `FAQPageJsonLd`; JSON-LD
  describes only what is visible.
- `dateModified` changed only if the content meaningfully changed.

### 4. Links and URL safety

- `pnpm --filter @anidachi/web seo:links`: the page has at least two contextual
  inbound links and links to at least one pillar and one sibling, with descriptive
  anchors.
- No new, renamed or deleted route folders, redirects, canonical retargets or
  `noindex`, unless the guidelines decisions log approves them.
- A new URL passed the publishing gate (owner approval recorded).

### 5. Conversion

- Install CTAs use `InstallLink` or `TrackedStoreLink` to the official Store
  listing, or `/extension`; no invented Store URL.
- At most two install cards; `seo_landing_path` attribution intact.

### 6. Images

- Images exist where the brief asks for them, have useful alt text, and use WebP
  or AVIF at a sensible size.

### 7. Build

- `pnpm --filter @anidachi/web check` passes. It runs `tsc` only.
- `pnpm --filter @anidachi/web exec eslint <changed files>` has no errors.
  Pass paths relative to `apps/web`, for example `app/watch-youtube-together/page.tsx`,
  not repository-root paths such as `apps/web/app/watch-youtube-together/page.tsx`.
  `next build` (Vercel) fails on lint errors such as a raw `'` in JSX text
  (`react/no-unescaped-entities`); use `&apos;`.
- Relevant tests pass (title guard, section index, link tests).

## Output

Post this as a comment on the Linear ticket and return it:

```
SEO QA: PASS | FAIL (round N)
Page: <path>

FAIL
- [Facts] <what is wrong> → <what the fix should be>
- ...

PASS
- Readable, On-page, Links, Conversion, Images, Build
```

After three FAIL rounds on the same ticket, stop and flag the ticket for the
owner instead of looping again.
