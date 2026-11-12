import type { Metadata } from "next";

/**
 * Canonical plus hreflang alternates for a page that exists in English and German.
 * Both versions use the same call so the links always point both ways; x-default is English.
 * Each version's canonical is itself, never the other language.
 */
export function languageAlternates(
  pair: { en: string; de: string },
  current: "en" | "de",
): NonNullable<Metadata["alternates"]> {
  return {
    canonical: pair[current],
    languages: {
      en: pair.en,
      de: pair.de,
      "x-default": pair.en,
    },
  };
}

/** English and German URL pairs for the German pilot. Used by page metadata and the sitemap. */
export const HREFLANG_PAIRS = [
  { en: "/", de: "/de" },
  { en: "/netflix-watch-party", de: "/de/netflix-watchparty" },
  { en: "/guides/how-to-screen-share-netflix-on-discord", de: "/de/netflix-auf-discord-streamen" },
  { en: "/watch-youtube-together", de: "/de/youtube-watchparty" },
  { en: "/watch-crunchyroll-together", de: "/de/crunchyroll-watchparty" },
  { en: "/compare/anidachi-vs-watch2gether", de: "/de/watch2gether-alternative" },
  { en: "/tools/crunchyroll-schedule", de: "/de/tools/crunchyroll-kalender" },
  { en: "/pricing", de: "/de/preise" },
  { en: "/extension", de: "/de/erweiterung" },
] as const;

export type HreflangPair = (typeof HREFLANG_PAIRS)[number];

/** The pair a path belongs to, in either language. */
export function hreflangPairFor(path: string): HreflangPair | undefined {
  return HREFLANG_PAIRS.find((pair) => pair.en === path || pair.de === path);
}
