import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.tiktokcdn.com", pathname: "/**" },
      { protocol: "https", hostname: "**.tiktokcdn-us.com", pathname: "/**" },
      // Jikan / MAL anime posters (large_image_url, image_url)
      { protocol: "https", hostname: "cdn.myanimelist.net", pathname: "/**" },
      { protocol: "https", hostname: "myanimelist.net", pathname: "/**" },
      // Discord user avatars
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/avatars/**" },
      // Google profile pictures
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
