/**
 * `/watch/<slug>-with-friends` pages left out of sitemap.xml.
 *
 * Owner-approved 2026-11-10. Rule: zero Search Console impressions in the 90
 * days to 2026-11-09 (www and apex combined), no store clicks, and not in the
 * sitemap's top-priority set. The pages stay live, indexable and linked from
 * `/watch`; they just stop being pushed at Google, so crawling goes to pages
 * that earn impressions (the Netflix hub first). Re-measure on 2026-12-08:
 * put a page back once it earns impressions or gets enriched.
 */
export const SITEMAP_EXCLUDED_WATCH_SLUGS: ReadonlySet<string> = new Set([
  "solo-leveling",
  "dandadan",
  "spy-x-family",
  "made-in-abyss",
  "code-geass",
  "boruto",
  "oshi-no-ko",
  "konosuba",
  "undead-unluck",
  "jojos-bizarre-adventure",
  "no-game-no-life",
  "ranking-of-kings",
  "wind-breaker",
  "psycho-pass",
  "hyouka",
  "march-comes-in-like-a-lion",
  "akame-ga-kill",
  "fairy-tail",
  "golden-kamuy",
  "the-disastrous-life-of-saiki-k",
  "slam-dunk",
  "kabaneri-of-the-iron-fortress",
  "rising-of-the-shield-hero",
  "clannad",
  "kingdom",
  "the-devil-is-a-part-timer",
  "ghost-in-the-shell-stand-alone-complex",
  "puella-magi-madoka-magica",
  "trigun-stampede",
  "sailor-moon",
  "weathering-with-you",
  "my-neighbor-totoro",
]);
