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
 * Owner-approved 2026-11-24 (ANI-8, ANI-39): pages that target the same searches as their
 * hub fold into it. Keys are the destinations. `/anime-watch-party` was the owner's 23 Nov
 * decision on ANI-8; the YouTube guides are the 10 Nov ANI-39 mapping.
 */
export const HUB_PAGE_MERGES: Record<string, readonly string[]> = {
  "/watch-anime-together": ["/anime-watch-party"],
  "/watch-youtube-together": [
    "/guides/best-way-to-watch-youtube-with-friends",
    "/guides/how-to-watch-youtube-with-friends",
    "/guides/how-to-sync-youtube-with-friends",
    "/guides/how-to-host-a-youtube-watch-party",
    "/guides/youtube-group-watch",
    "/guides/youtube-watch-party-chrome-extension",
    "/guides/youtube-watch-party-free",
    "/guides/how-to-watch-youtube-together-without-screen-share",
    "/guides/does-youtube-have-watch-party",
  ],
};

/** Of HUB_PAGE_MERGES, the URLs Google had indexed (URL Inspection, 24 Nov 2026). */
const HUB_PAGE_MERGES_INDEXED = [
  "/anime-watch-party",
  "/guides/best-way-to-watch-youtube-with-friends",
  "/guides/how-to-watch-youtube-with-friends",
  "/guides/how-to-sync-youtube-with-friends",
  "/guides/youtube-watch-party-chrome-extension",
  "/guides/how-to-watch-youtube-together-without-screen-share",
] as const;

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
  // Anime and YouTube pages folded into their hubs on 2026-11-24 (ANI-8, ANI-39).
  ...HUB_PAGE_MERGES_INDEXED,
];

export const RECRAWL_SITEMAP_PATH = "/sitemap-redirects.xml";
export const RECRAWL_SITEMAP_REMOVE_AFTER = "2026-12-18";
