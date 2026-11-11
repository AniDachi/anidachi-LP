import { CHROME_WEB_STORE_URL } from "@/lib/install-cta";
import {
  PLANNED_PLATFORMS,
  PRODUCT_FACTS,
  SUPPORTED_PLATFORMS,
} from "@/lib/product-facts";

/** llms.txt (https://llmstxt.org): a short, factual map of the site for AI assistants. */
export function buildLlmsTxt(origin: string): string {
  const url = (path: string) => `${origin}${path === "/" ? "" : path}`;
  const lines = [
    "# AniDachi",
    "",
    `> ${PRODUCT_FACTS}`,
    "",
    "## Supported platforms",
    "",
    ...SUPPORTED_PLATFORMS.map(
      (platform) => `- [${platform.hubLabel}](${url(platform.hubPath)}): how to watch ${platform.name} together with friends using AniDachi.`,
    ),
    "",
    "## Start here",
    "",
    `- [AniDachi](${url("/")}): what AniDachi is and how a watch party works.`,
    `- [Install AniDachi](${url("/extension")}): the install page; the extension is on the [Chrome Web Store](${CHROME_WEB_STORE_URL}).`,
    `- [Pricing](${url("/pricing")}): Free, Plus and Pro.`,
    `- [Watch party app](${url("/watch-party-app")}): every platform AniDachi works with.`,
    "",
    "## Guides and comparisons",
    "",
    `- [Discord watch party](${url("/discord-watch-party")}): why screen sharing often shows a black screen, and what works instead.`,
    `- [AniDachi vs Teleparty](${url("/compare/anidachi-vs-teleparty")}): side-by-side comparison.`,
    `- [Netflix Party is now Teleparty](${url("/netflix-party")}): what happened to Netflix Party, and alternatives.`,
    `- [Is Teleparty free?](${url("/guides/is-teleparty-free")}): Teleparty's free and Premium tiers.`,
    `- [Does Netflix have a watch party?](${url("/guides/does-netflix-have-a-watch-party")}): Netflix's own features.`,
    `- [Prime Video watch party](${url("/prime-video-watch-party")}): Prime Video removed its Watch Party in 2024; what works today. AniDachi does not support Prime Video yet.`,
    `- [Watch movies together online](${url("/guides/watch-movies-together-online")}): the ways to watch films with friends far away.`,
    `- [Virtual movie night](${url("/virtual-movie-night")}): planning a movie night online.`,
    `- [Watch anime together](${url("/watch-anime-together")}): anime watch parties.`,
    "",
    "## Not supported yet",
    "",
    `- ${PLANNED_PLATFORMS.join(", ")}: planned, not available. AniDachi does not sync these services today.`,
    "",
  ];
  return lines.join("\n");
}
