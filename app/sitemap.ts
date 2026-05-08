import type { MetadataRoute } from "next";
import { animeList } from "@/lib/anime-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://anidachi.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    {
      url: `${SITE_URL}/watch-crunchyroll-together`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/watch-anime-together`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/anime-watch-party-toolkit`,
      changeFrequency: "weekly",
      priority: 0.9,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/watch-party-starter`,
      changeFrequency: "weekly",
      priority: 0.88,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/resources/group-watch-onboarding`,
      changeFrequency: "monthly",
      priority: 0.72,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/guides/how-to-watch-crunchyroll-with-friends`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/how-to-watch-anime-with-friends-online`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/how-to-watch-anime-with-friends-on-discord`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/how-to-watch-anime-long-distance`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/how-to-fix-watch-party-audio-delay`,
      changeFrequency: "monthly",
      priority: 0.78,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/guides/how-to-watch-anime-with-friends-in-different-time-zones`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/how-to-watch-anime-without-spoilers`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/how-to-create-an-anime-watch-party`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/first-anime-watch-party-checklist`,
      changeFrequency: "monthly",
      priority: 0.78,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/guides/how-to-watch-anime-with-a-group`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/guides/crunchyroll-watch-party-chrome-extension`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/compare/anidachi-vs-teleparty`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/compare/anidachi-vs-discord-screen-share`,
      changeFrequency: "monthly",
      priority: 0.7,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/guides/anime-watch-party-ideas`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/guides/best-anime-to-watch-as-a-couple`,
      changeFrequency: "monthly",
      priority: 0.71,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/guides/best-anime-to-watch-with-friends`,
      changeFrequency: "monthly",
      priority: 0.7,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/guides/best-anime-to-watch-for-beginners`,
      changeFrequency: "monthly",
      priority: 0.7,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/guides/asynchronous-vs-live-watch-party`,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/glossary/watchroom`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/glossary/asynchronous-watching`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/glossary/anime-simulcast`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/glossary/crunchyroll-mega-fan`,
      changeFrequency: "monthly",
      priority: 0.52,
      lastModified: new Date("2026-05-08"),
    },
    {
      url: `${SITE_URL}/glossary/dub-vs-sub-watch-party`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const animeRoutes: MetadataRoute.Sitemap = animeList.map((anime) => ({
    url: `${SITE_URL}/watch/${anime.slug}-with-friends`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
    lastModified: new Date("2026-05-08"),
  }));

  return [...staticRoutes, ...animeRoutes];
}
