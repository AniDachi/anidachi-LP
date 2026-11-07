# AniDachi landing page positioning

> **Status: partly superseded by [the plan audit](2026-11-03-landing-page-plan-audit.md).** Don't drop Crunchyroll
> and anime from the homepage title yet, and don't name Prime Video until it is supported. The homepage
> converts better than the hubs today.

## The idea
The homepage covers the **category**: watch together online, on any streaming service.
It names platforms only as links to their own pages, and anime is part of the **brand story**, not the main keyword.

## Keywords
- **Primary:** watch party extension, watch together online, watch movies together online, stream together
- **Secondary:** sync streaming with friends, teleparty alternative (the Teleparty comparison page carries the detail)
- **Don't target:**
  - any "*platform* watch party" search; those belong to the platform pages
  - "watch party" on its own (27k searches, but mostly sports and the TV show *Party Down*)

## On-page
- **Title options:**
  - `AniDachi — Watch Party Extension to Watch Together Online` (57 characters)
  - `AniDachi: Watch Together Online, Synced with Friends` (51 characters)

  Drop the drafted title that lists Crunchyroll, YouTube and Netflix.
- **Headline:** keep the current hook and add a subhead: "The watch party extension for Netflix, Prime Video, Crunchyroll and more."
- **Meta description:** lead with the category and use platforms as proof:
  "Watch together online with friends. AniDachi syncs playback across Netflix, Prime Video, Crunchyroll and YouTube, with chat and reactions. Friends join free."
- **Platform grid:** one card per platform. Each card links to its platform page with the exact keyword as link text, like "Prime Video watch party". Unbuilt platforms show "Coming soon" with no link.
- **Anime:** keep "built by anime fans" and the mascot. Add a "Watch anime together" card that links to `/watch-anime-together`.
- **Structured data:** in the schema markup, say "streaming services" instead of naming three platforms.
- **Teleparty:** mention it once at most, in the FAQ.

## Why
- **Anime and Crunchyroll are a small market:** about 2k US searches a month. Netflix, Prime Video, Hulu, Disney+ and HBO Max together are about 50k.
- **Every platform's demand is phrased "*platform* watch party".** That keyword belongs to each platform page, so the homepage shouldn't compete for it.
- **The homepage is taking the Crunchyroll page's traffic:** it gets 72–80% of the impressions for Crunchyroll searches (ANI-7).
- **No page ranks for the general category yet:** only 82 impressions across the whole site in 28 days, so targeting it with the homepage takes nothing from any other page.
- **A title that lists platforms doesn't scale:** it gets longer with every new platform and still loses each platform's searches to that platform's page.

## Rollout
1. Get the Crunchyroll and Netflix pages indexed and linked first (ANI-5, ANI-6, ANI-7, ANI-17).
2. Ship the homepage title, subhead, description and platform grid in one commit. Redirect `/watch-party-app` to `/` in a second commit.
3. Track weekly:
   - the Crunchyroll page picks up what the homepage gives up
   - brand clicks on the homepage stay flat
   - category-keyword impressions grow from 34 in 28 days
4. Expect a short dip of about 1.2k impressions and 40 clicks a month on Crunchyroll searches while that traffic moves to the Crunchyroll page.
