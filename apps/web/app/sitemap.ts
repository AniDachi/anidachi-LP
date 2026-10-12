import type { MetadataRoute } from "next";
import { animeList } from "@/lib/anime-data";
import {
  discoverStaticSitemapUrlPaths,
  staticPathsToSitemapEntries,
} from "@/lib/sitemap-discovery";
import {
  getSeoSiteOrigin,
  isRobotsIndexingDisabled,
} from "@/lib/site-url";

/** Per sitemaps.org; split with `generateSitemaps` before exceeding this. */
const SITEMAP_URL_SOFT_LIMIT = 50_000;

export default function sitemap(): MetadataRoute.Sitemap {
  if (isRobotsIndexingDisabled()) {
    return [];
  }

  const siteUrl = getSeoSiteOrigin();
  const staticPaths = discoverStaticSitemapUrlPaths();
  const staticRoutes = staticPathsToSitemapEntries(siteUrl, staticPaths);

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

  const animeRoutes: MetadataRoute.Sitemap = animeList.map((anime) => ({
    url: `${siteUrl}/watch/${anime.slug}-with-friends`,
    changeFrequency: "monthly",
    priority: TOP_ANIME_SLUGS.has(anime.slug) ? 0.8 : 0.6,
  }));

  const combined = [...staticRoutes, ...animeRoutes].sort((a, b) =>
    a.url.localeCompare(b.url)
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
