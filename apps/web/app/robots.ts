import type { MetadataRoute } from "next";
import {
  getResolvedSiteOrigin,
  isAiTrainingCrawlerBlockEnabled,
  isRobotsIndexingDisabled,
} from "@/lib/site-url";

/** Optional extra rules when `NEXT_PUBLIC_DISALLOW_AI_TRAINING_BOTS=true`. */
const AI_TRAINING_BOT_AGENTS = [
  "GPTBot",
  "Google-Extended",
  "CCBot",
  "anthropic-ai",
] as const;

export default function robots(): MetadataRoute.Robots {
  if (isRobotsIndexingDisabled()) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    };
  }

  const origin = getResolvedSiteOrigin();

  const rules: MetadataRoute.Robots["rules"] = [
    {
      userAgent: "*",
      allow: ["/"],
      disallow: ["/blou", "/kreatli-email-crm"],
    },
  ];

  if (isAiTrainingCrawlerBlockEnabled()) {
    for (const userAgent of AI_TRAINING_BOT_AGENTS) {
      rules.push({ userAgent, disallow: ["/"] });
    }
  }

  return {
    rules,
    sitemap: `${origin}/sitemap.xml`,
  };
}
