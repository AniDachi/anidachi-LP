import type { NextConfig } from "next";
import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";
import { ANI38_BATCH1_SOURCES, DISCORD_HUB_MERGE_SOURCES } from "./lib/recrawl-redirects";

const nextConfig: NextConfig = {
  // Dynamic routes (e.g. /extension) stream metadata into <body> for unlisted user agents.
  // Add Googlebot to Next's default list so it gets <title> and description in <head>.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|Googlebot`, "i"),
  async headers() {
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    if (process.env.VERCEL_GIT_COMMIT_REF !== "staging" || !sha || !/^[a-f0-9]{40}$/.test(sha)) return [];
    return [{
      source: "/robots.txt",
      headers: [{ key: "X-AniDachi-Staging-Commit", value: sha }],
    }];
  },
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
        destination: "/netflix-watch-party",
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
        destination: "/netflix-watch-party",
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
        destination: "/discord-watch-party",
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
      ...ANI38_BATCH1_SOURCES.map((source) => ({
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
        ["/guides/teleparty-netflix", "/netflix-watch-party"],
      ].map(([source, destination]) => ({ source, destination, permanent: true })),
      // 2026-11-14 (owner-approved): /netflix-party folds into the Netflix hub.
      // It is indexed and recrawled every few days, so the redirect gets Google to
      // fetch the hub, which had sat in "Discovered – not indexed" since 8 Oct.
      {
        source: "/netflix-party",
        destination: "/netflix-watch-party",
        permanent: true,
      },
      // 2026-11-22 (owner-approved): two Discord guides fold into the Discord hub, which
      // Google had never fetched. The Watch Together guide (never crawled) targeted the
      // same searches; the YouTube guide is indexed, so its redirect leads Google to the hub.
      ...DISCORD_HUB_MERGE_SOURCES.map((source) => ({
        source,
        destination: "/discord-watch-party",
        permanent: true,
      })),
      // 2026-11-14 (owner-approved): the Amazon comparison page answered the same
      // question as the Prime Video hub (0 impressions in 28 days); it folds in.
      {
        source: "/compare/anidachi-vs-amazon-watch-party",
        destination: "/prime-video-watch-party",
        permanent: true,
      },
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
