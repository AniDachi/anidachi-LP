import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

const nextConfig: NextConfig = {
  // Dynamic routes (e.g. /extension) stream metadata into <body> for unlisted user agents.
  // Add Googlebot to Next's default list so it gets <title> and description in <head>.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|Googlebot`, "i"),
  async redirects() {
    return [
      // Canonicalize non-www → www to consolidate PageRank
      {
        source: "/:path*",
        has: [{ type: "host", value: "anidachi.app" }],
        destination: "https://www.anidachi.app/:path*",
        permanent: true,
      },
      {
        source: "/watch-party-starter",
        destination: "/watch-party-app",
        permanent: true,
      },
      {
        source: "/guides/netflix-teleparty",
        destination: "/netflix-party",
        permanent: true,
      },
      {
        source: "/guides/anime-date-night-ideas-long-distance",
        destination: "/long-distance-anime-date-night-ideas",
        permanent: true,
      },
      {
        source: "/guides/how-to-remove-anime-from-continue-watching-on-crunchyroll",
        destination: "/guides/how-to-remove-shows-from-continue-watching-on-crunchyroll",
        permanent: true,
      },
      {
        source: "/guides/how-to-stream-anime-on-discord",
        destination: "/guides/how-to-watch-anime-with-friends-on-discord",
        permanent: true,
      },
      {
        source: "/guides/how-to-watch-netflix-together",
        destination: "/netflix-watch-party",
        permanent: true,
      },
      {
        source: "/guides/netflix-party-extension",
        destination: "/netflix-party",
        permanent: true,
      },
      {
        source: "/watch-action-anime-with-friends",
        destination: "/guides/best-action-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-comedy-anime-with-friends",
        destination: "/guides/best-comedy-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-fantasy-anime-with-friends",
        destination: "/guides/best-fantasy-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-horror-anime-with-friends",
        destination: "/guides/best-horror-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-isekai-anime-with-friends",
        destination: "/guides/best-isekai-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-psychological-anime-with-friends",
        destination: "/guides/best-psychological-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-romance-anime-with-friends",
        destination: "/guides/best-romance-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-sci-fi-anime-with-friends",
        destination: "/guides/best-sci-fi-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-shonen-anime-with-friends",
        destination: "/guides/best-shonen-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-slice-of-life-anime-with-friends",
        destination: "/guides/best-slice-of-life-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/watch-sports-anime-with-friends",
        destination: "/guides/best-sports-anime-to-watch-with-friends",
        permanent: true,
      },
      {
        source: "/guides/discord-watch-together-activity",
        destination: "/guides/discord-watch-together",
        permanent: true,
      },
      {
        source: "/compare/anidachi-vs-netflix-watch-party",
        destination: "/netflix-watch-party",
        permanent: true,
      },
      {
        source: "/guides/can-you-stream-crunchyroll-on-discord",
        destination: "/guides/can-you-screen-share-crunchyroll-on-discord",
        permanent: true,
      },
      // ANI-38 batch 1 (owner-approved 2026-11-10): Crunchyroll hub-intent,
      // Teleparty and Crunchyroll Party pages fold into the Crunchyroll hub.
      ...[
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
      ].map((source) => ({
        source,
        destination: "/watch-crunchyroll-together",
        permanent: true,
      })),
      // ANI-38 account pair (owner-approved 2026-11-10, direction reversed):
      // the Premium page folds into the account-sharing guide.
      {
        source: "/guides/does-everyone-need-crunchyroll-premium-for-watch-party",
        destination: "/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing",
        permanent: true,
      },
      // ANI-37 (owner-approved 2026-11-10): Netflix cluster down to the hub,
      // /netflix-party, the Discord guide and the "does Netflix have" guide.
      ...[
        ["/guides/watch-netflix-together", "/netflix-watch-party"],
        ["/guides/how-to-watch-netflix-with-friends", "/netflix-watch-party"],
        ["/guides/netflix-group-watch", "/netflix-watch-party"],
        ["/guides/netflix-movie-night", "/virtual-movie-night"],
        ["/guides/teleparty-netflix", "/netflix-party"],
      ].map(([source, destination]) => ({ source, destination, permanent: true })),
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.tiktokcdn.com", pathname: "/**" },
      { protocol: "https", hostname: "**.tiktokcdn-us.com", pathname: "/**" },
      { protocol: "https", hostname: "**.tiktokcdn-eu.com", pathname: "/**" },
      // Jikan / MAL anime posters (large_image_url, image_url)
      { protocol: "https", hostname: "cdn.myanimelist.net", pathname: "/**" },
      { protocol: "https", hostname: "myanimelist.net", pathname: "/**" },
      // Discord user avatars
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/avatars/**" },
      // Google profile pictures
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      // YouTube channel thumbnails / avatars
      { protocol: "https", hostname: "**.ggpht.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
