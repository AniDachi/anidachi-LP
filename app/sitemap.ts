import type { MetadataRoute } from "next";
import fs from "node:fs";
import path from "node:path";
import { animeList } from "@/lib/anime-data";
import {
  discoverStaticSitemapUrlPaths,
  staticPathsToSitemapEntries,
} from "@/lib/sitemap-discovery";
import {
  getResolvedSiteOrigin,
  isRobotsIndexingDisabled,
} from "@/lib/site-url";

/** Per sitemaps.org; split with `generateSitemaps` before exceeding this. */
const SITEMAP_URL_SOFT_LIMIT = 50_000;

export default function sitemap(): MetadataRoute.Sitemap {
  if (isRobotsIndexingDisabled()) {
    return [];
  }

  const siteUrl = getResolvedSiteOrigin();
  const staticPaths = discoverStaticSitemapUrlPaths();
  const staticRoutes = staticPathsToSitemapEntries(siteUrl, staticPaths);

  let watchLastModified: Date | undefined;
  try {
    watchLastModified = fs.statSync(
      path.join(process.cwd(), "app/watch/[slug]/page.tsx")
    ).mtime;
  } catch {
    watchLastModified = undefined;
  }

  const TOP_ANIME_SLUGS = new Set([
    "attack-on-titan",
    "one-piece",
    "demon-slayer",
    "jujutsu-kaisen",
    "death-note",
    "naruto",
    "fullmetal-alchemist-brotherhood",
    "my-hero-academia",
    "dragon-ball-super",
    "hunter-x-hunter",
  ]);

  const animeRoutes: MetadataRoute.Sitemap = animeList.map((anime) => {
    const entry: MetadataRoute.Sitemap[number] = {
      url: `${siteUrl}/watch/${anime.slug}-with-friends`,
      changeFrequency: "monthly",
      priority: TOP_ANIME_SLUGS.has(anime.slug) ? 0.8 : 0.6,
    };
    if (watchLastModified) entry.lastModified = watchLastModified;
    return entry;
  });

  const genreHubRoutes: MetadataRoute.Sitemap = [
    "/watch-action-anime-with-friends",
    "/watch-romance-anime-with-friends",
    "/watch-comedy-anime-with-friends",
    "/watch-sports-anime-with-friends",
    "/watch-mystery-anime-with-friends",
  ].map((urlPath) => ({
    url: `${siteUrl}${urlPath}`,
    changeFrequency: "monthly" as const,
    priority: 0.85,
    ...(watchLastModified ? { lastModified: watchLastModified } : {}),
  }));

  const combined = [...staticRoutes, ...animeRoutes, ...genreHubRoutes].sort(
    (a, b) => a.url.localeCompare(b.url)
  );

  if (
    process.env.NODE_ENV === "development" &&
    combined.length > SITEMAP_URL_SOFT_LIMIT
  ) {
    console.warn(
      `[sitemap] URL count (${combined.length}) exceeds ${SITEMAP_URL_SOFT_LIMIT}; implement Next.js generateSitemaps before shipping.`
    );
  }

  return combined;
}
