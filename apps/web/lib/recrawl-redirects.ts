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
];

export const RECRAWL_SITEMAP_PATH = "/sitemap-redirects.xml";
export const RECRAWL_SITEMAP_REMOVE_AFTER = "2026-12-18";
