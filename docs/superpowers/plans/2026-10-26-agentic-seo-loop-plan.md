# Agentic SEO loop plan (October 26, 2026)

Status: proposed. Works alongside the
[SEO growth plan](2026-10-19-seo-growth-plan.md); where they disagree, the growth
plan, `.cursor/agents/anidachi-seo-aeo-pages.md` and
`apps/web/docs/seo-content-guidelines.md` win.

Source: Kourosh Ghaffari, "$12k/month with Agentic SEO"
(https://x.com/BuildingWaves/status/2112177318080942110, Oct 19, 2026). He runs
SEO for Voicy as a weekly closed loop: research, brief, write, QA, publish, audit,
then refine by conversions, with Linear as the work queue. His results are
self-reported, and the article promotes his product (RomeoSEO). This plan keeps
the loop and adapts it to AniDachi.

## The main change for AniDachi

The article leads with new content. AniDachi's limit right now is indexing, not
volume:

- 155 of 386 sitemap URLs had zero impressions in the 28 days before Oct 19.
- URL Inspection on a random 30 of them: 22 not indexed.
- 11 of the 17 Netflix-intent URLs are "Discovered – currently not indexed" or
  "URL is unknown to Google".

More URLs would spread crawl attention thinner. The loop therefore splits work
roughly **70% audit and refresh, 30% new pages**, and new URLs stay capped until
the indexed share goes up. `seo:keywords` already says it is ideation only and is
not permission to publish new URLs; that rule stands.

## Step 1: Connections

| Loop needs | AniDachi has | Gap |
|---|---|---|
| Search Console | Composio (read-only) and `lib/google-marketing/gsc` | none |
| Keyword volumes and ideas | Google Ads Keyword Planner via `lib/google-ads/client` (`seo:keywords`) | volumes are ranges unless the Ads account has spend |
| SERP data (who ranks, SERP features) | none | supervised browser SERP checks (step 2b) instead of a paid SERP API |
| Analytics | Amplitude (`seo_landing_path` funnel), GA4 | GA4 has no custom dimensions; Amplitude is the source for conversions |
| Ticket queue | Linear | create an SEO project or label |
| Screenshots | in-app browser | none |

Decision (Oct 26): no new vendor. DataForSEO is not added. Keyword Planner covers
volumes, GSC covers our own rankings, and supervised browser checks cover SERP
context.

## Step 2a: Weekly keyword research → Linear tickets

- Every Monday, run `pnpm --filter @anidachi/web seo:keywords` plus a GSC query
  pull.
- Each opportunity becomes one Linear ticket with: target query, intent, target
  URL (existing page first; a new URL only if no page fits), Keyword Planner volume
  range, current GSC position, and a short brief.
- Tickets that need competitor context get the label **needs SERP check**.
- Score with conversion data (step 7), not impressions alone.

## Step 2b: Supervised SERP checks

The agent reads Google results in the Claude in-app browser during a live session
and adds the findings to tickets labeled **needs SERP check**.

What it records per query:

- Top 10 organic results: domain, title, page type (forum, video, app page,
  guide, publisher).
- SERP features: AI Overview, People Also Ask, video pack.
- Whether AniDachi is cited in the AI Overview.

Rules:

1. **Supervised only.** Runs in a session with the owner present. Never in a
   scheduled or unattended job.
2. **Small batches.** 20–30 queries per session, with pauses between queries.
3. **CAPTCHA means stop.** The agent never solves or works around a CAPTCHA or
   other bot check. It stops and hands the browser to the owner. If Google keeps
   blocking, stop for the day.
4. **Read-only.** No clicking ads, no form submissions, no signed-in actions.
5. **Location bias.** Results follow this machine's IP even with `hl=en&gl=us&pws=0`.
   Use SERPs for competitor and format context only. GSC stays the source of
   truth for AniDachi's own positions.

Pilot (Oct 26, 3 queries, no CAPTCHA):

| Query | AI Overview | People Also Ask | AniDachi |
|---|---|---|---|
| crunchyroll watch party | yes | yes | cited in the AI Overview; not in the top 8 organic (Reddit, Crunchyroll news, YouTube, crunchyrollwithfriends.com, Teleparty, TikTok) |
| ldr anime | yes | yes | absent (Reddit, Pinterest, Crunchyroll category page, TikTok, MyAnimeList) |
| crunchyroll simulcast calendar | yes | no | absent; Crunchyroll holds 7 of the top 9 |

GSC puts the homepage near position 6.5 for "crunchyroll watch party" and the LDR
page at 2.6 for "ldr anime", which confirms the location bias. What carries over:
these SERPs are mostly forums and video, not app landing pages, and AI Overviews
appear on all three. Track AI Overview citations as their own metric.

## Step 3: Writer

The writer follows `.cursor/agents/anidachi-seo-aeo-pages.md` and
`apps/web/docs/seo-content-guidelines.md`. It picks up a Linear ticket, writes or
revises the page, and does not publish.

## Step 4: QA gate

A draft ships only after QA passes. If QA fails, the writer revises and QA runs
again.

- Reads at about a 7th-grade level, no jargon, and no AI-style prose (use the
  `humanizer` skill).
- **Every factual claim is checked against its source.** The Oct 19 enrichment
  work found 30 watch pages pointing at the wrong MyAnimeList entry; this check is
  the most important one.
- Title of 60 characters or less with the brand once (the existing guard test),
  one H1, description of 160 characters or less.
- `seo:links` shows contextual inbound links to the page.
- The correct `InstallLink` CTA; images present with alt text.
- Product claims match production (platforms, plans, trial wording).

## Step 5: Publishing

The article publishes automatically. AniDachi does not: site-only pushes to
`staging` can auto-promote to production within minutes. The agent prepares one
weekly batch (one commit), the owner approves it, and Linear tickets close after
the production deploy. Normal web checks from `docs/development-quality-gates.md`
apply.

## Step 6: Weekly audit → improvement tickets

The audit produces tickets for:

- **Indexing:** URLs not indexed or unknown to Google. Options: merge into a
  stronger page, add contextual internal links, or add to the weekly reindex list
  (`docs/releases/seo/*-reindex-list.md`).
- **Cannibalization:** e.g. the homepage taking "crunchyroll watch party" from
  `/watch-crunchyroll-together`.
- **High rank, low clicks:** e.g. "ldr anime" at position 2.6 with 0 clicks.
- **Stale titles and copy:** pages whose title no longer matches what they cover
  (Netflix support).
- **Recurring updates:** automate the Monday refresh of
  `/tools/crunchyroll-schedule`.
- **Re-measurement:** 28 days after each change reaches production.

## Step 7: Optimize for installs

Clicks are not the goal; Chrome Web Store clicks and paid hosts are.

- Use `extension_store_clicked` by `seo_landing_path` (Amplitude) in keyword and
  audit scoring.
- Sep 21 – Oct 19 rates, `/extension` reach to Store click: `/watch-crunchyroll-together`
  65%, `/guides/how-to-watch-crunchyroll-with-friends` 67%, `/` 43%,
  `/watch-anime-together` 20%. Favor how-to and platform-hub intents.
- Keep traffic that doesn't convert at low priority (`/glossary/ova-meaning`:
  14,200 impressions, 1 click).

## Step 8: Feedback loop

Once a week the owner reads a sample of output. Corrections go into
`apps/web/docs/seo-content-guidelines.md` so the writer and QA steps pick them
up. Judge the loop after about three months.

## Rollout

1. **Week of Oct 26:** create the Linear SEO project and labels; write the QA
   checklist as a skill.
2. **Week of Nov 2:** Monday routine for research and audit tickets; automate the
   Crunchyroll schedule refresh; first supervised SERP session.
3. **After the Nov 2 freeze ends:** writer → QA → approved weekly batches, scored
   on installs.
