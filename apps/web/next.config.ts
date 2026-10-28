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
        destination: "/guides/teleparty-netflix",
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
        destination: "/guides/watch-netflix-together",
        permanent: true,
      },
      {
        source: "/guides/netflix-party-extension",
        destination: "/netflix-party",
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
