/**
 * ANI-38 batch 1 (owner-approved 2026-11-10): Crunchyroll pages that 308 into the
 * Crunchyroll hub. Used by the redirects in next.config.ts and by the temporary
 * /sitemap-redirects.xml.
 */
export const ANI38_BATCH1_SOURCES = [
  "/guides/how-to-sync-crunchyroll-with-friends",
  "/guides/crunchyroll-group-watch",
  "/guides/how-to-host-a-crunchyroll-watch-party",
  "/guides/watch-party-app-for-crunchyroll",
  "/guides/crunchyroll-watch-party-chrome-extension",
  "/guides/crunchyroll-watch-party-free",
  "/guides/how-to-watch-crunchyroll-together-without-screen-share",
  "/guides/does-crunchyroll-have-watch-party",
  "/guides/does-teleparty-work-with-crunchyroll",
  "/guides/teleparty-not-working-crunchyroll",
  "/guides/netflix-party-for-crunchyroll",
  "/guides/crunchyroll-party-alternative",
  "/guides/is-crunchyroll-party-worth-it",
  "/compare/anidachi-vs-crunchyroll-party",
  "/compare/crunchyroll-party-vs-teleparty-for-anime",
] as const;

/**
 * Owner-approved 2026-11-22: Discord guides that 308 into /discord-watch-party.
 * See the decisions log in docs/seo-content-guidelines.md.
 */
export const DISCORD_HUB_MERGE_SOURCES = [
  "/guides/discord-watch-together",
  "/guides/youtube-watch-party-with-discord",
] as const;

/**
 * Owner-approved 2026-11-23 (ANI-44 steps 4-5, ANI-79/ANI-80): competitor pages folded into
 * one page per searched competitor, the /compare pillar or the Discord hub. Keys are the
 * destinations. "anidachi vs <competitor>" gets no searches for any competitor.
 */
export const COMPETITOR_PAGE_MERGES: Record<string, readonly string[]> = {
  "/guides/watch2gether-alternatives-for-anime": [
    "/guides/watch2gether-alternatives-for-youtube",
    "/compare/anidachi-vs-watch2gether",
  ],
  "/guides/rave-alternatives-for-youtube": [
    "/guides/rave-alternatives-for-anime",
    "/compare/anidachi-vs-rave",
    "/guides/does-rave-work-with-youtube",
  ],
  "/guides/kast-alternatives-for-youtube": [
    "/guides/kast-alternatives-for-anime",
    "/compare/anidachi-vs-kast",
  ],
  "/compare": [
    "/compare/anidachi-vs-scener",
    "/compare/anidachi-vs-twoseven",
    "/compare/anidachi-vs-roll-together",
    "/compare/anidachi-vs-syncup",
    "/compare/anidachi-vs-anime-watch-parties-extension",
    "/compare/anidachi-vs-syncplay",
  ],
  "/discord-watch-party": [
    "/compare/anidachi-vs-discord-screen-share",
    "/guides/switch-from-discord-screen-share",
  ],
};

/**
 * Temporary recrawl sitemap (owner-approved 2026-11-20, ANI-38). Lists old URLs that
 * now redirect, so Google refetches them and moves their signals to the new page.
 * On 20 Nov several were still indexed under their own address, last crawled before
 * the redirect. Remove the sitemap and its robots.txt line after 2026-12-18.
 */
export const RECRAWL_REDIRECT_PATHS: readonly string[] = [
  ...ANI38_BATCH1_SOURCES,
  // Folded into the Prime Video hub on 2026-11-14; the hub is still unknown to Google.
  "/compare/anidachi-vs-amazon-watch-party",
  // Folded into the Discord hub on 2026-11-22. Indexed (last crawled 26 Jul 2026), so a
  // recrawl leads Google to the hub, which it had never fetched.
  "/guides/youtube-watch-party-with-discord",
  // Folded into the Teleparty alternatives page on 2026-11-23 (ANI-76). Both indexed.
  "/guides/best-teleparty-alternatives-for-youtube",
  "/compare/anidachi-vs-teleparty",
  // Teleparty question pages merged on 2026-11-23 (ANI-77). Both indexed.
  "/guides/is-teleparty-safe",
  "/guides/does-teleparty-work-with-youtube",
  // Folded into the /compare pillar on 2026-11-23 (ANI-78). Indexed.
  "/guides/best-watch-party-apps-for-anime",
  // Competitor pages folded on 2026-11-23 (ANI-79/ANI-80). All indexed except the
  // Watch2Gether YouTube twin, which Google never knew.
  ...Object.values(COMPETITOR_PAGE_MERGES)
    .flat()
    .filter((path) => path !== "/guides/watch2gether-alternatives-for-youtube"),
];

export const RECRAWL_SITEMAP_PATH = "/sitemap-redirects.xml";
export const RECRAWL_SITEMAP_REMOVE_AFTER = "2026-12-18";
