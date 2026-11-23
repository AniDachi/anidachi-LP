import { animeList, isMovieEntry } from "@/lib/anime-data";
import { GENRE_HUB_LINKS } from "@/lib/genre-hub-links";
import { guideLinks } from "@/lib/guide-links";

/**
 * Data for the section index pages (/guides, /compare, /watch, /glossary, /tools).
 * Owner-approved 19 Oct 2026. `section-index.test.ts` fails when a page in one of these
 * sections exists without being listed here, so the indexes stay complete.
 */
export type SectionEntry = { href: string; label: string; description?: string };
export type SectionGroup = { id: string; heading: string; entries: SectionEntry[] };

export const COMPARE_ENTRIES: SectionEntry[] = [
  { href: "/compare/anidachi-vs-kosmi", label: "Kosmi alternatives", description: "Sites like Kosmi for Netflix, Crunchyroll and phones, with free calls." },
  { href: "/compare/anidachi-vs-hyperbeam", label: "Hyperbeam alternatives", description: "Shared-browser and synced-player alternatives to Hyperbeam." },
  { href: "/compare/anidachi-vs-metastream", label: "Metastream alternatives", description: "Apps like Metastream for watching web videos and streaming together." },
];

export const GLOSSARY_ENTRIES: SectionEntry[] = [
  { href: "/glossary/watchroom", label: "Watchroom", description: "A shared space for watching together in sync." },
  { href: "/glossary/asynchronous-watching", label: "Asynchronous watching", description: "Watching the same show on your own schedules." },
  { href: "/glossary/dub-vs-sub-watch-party", label: "Dub vs sub for watch parties", description: "Choosing audio and subtitles for a mixed group." },
  { href: "/glossary/anime-marathon", label: "Anime marathon", description: "Many episodes or a whole series in one sitting." },
  { href: "/glossary/anime-simulcast", label: "Anime simulcast", description: "Episodes released internationally as they air in Japan." },
  { href: "/glossary/anime-filler", label: "Anime filler", description: "Episodes not adapted from the original manga." },
  { href: "/glossary/ova-meaning", label: "OVA", description: "Original Video Animation, released straight to home video." },
  { href: "/glossary/shonen-anime", label: "Shonen anime", description: "Anime aimed at teenage boys: action, friendship, growth." },
  { href: "/glossary/crunchyroll-mega-fan", label: "Crunchyroll Mega Fan", description: "What Crunchyroll's Mega Fan tier changes." },
];

export const TOOLS_ENTRIES: SectionEntry[] = [
  { href: "/tools/crunchyroll-schedule", label: "Crunchyroll release schedule", description: "This week's Crunchyroll simulcasts in your timezone." },
  { href: "/tools/crunchyroll-dub-schedule", label: "Crunchyroll dub schedule", description: "This week's English dub episodes on Crunchyroll." },
  { href: "/tools/random-anime-generator", label: "Random anime generator", description: "Spin a random series, filtered by length." },
  { href: "/tools/one-piece-how-many-episodes", label: "How many episodes does One Piece have?", description: "Episodes by arc and a finish-date planner." },
  { href: "/tools/one-piece-filler-list", label: "One Piece filler list", description: "Anime-original episodes to skip." },
  { href: "/tools/naruto-filler-list", label: "Naruto filler list", description: "Filler to skip in the original Naruto." },
  { href: "/tools/naruto-shippuden-filler-list", label: "Naruto Shippuden filler list", description: "Filler to skip in Shippuden." },
  { href: "/tools/bleach-filler-list", label: "Bleach filler list", description: "Filler arcs to skip on the way to Thousand-Year Blood War." },
  { href: "/tools/black-clover-filler-list", label: "Black Clover filler list", description: "Filler to skip in the first 170 episodes." },
  { href: "/tools/fate-watch-order", label: "Fate watch order", description: "Which Fate route to start with." },
  { href: "/tools/monogatari-watch-order", label: "Monogatari watch order", description: "A first-watch order, including Kizumonogatari." },
];

const GUIDE_GROUPS: { id: string; heading: string; match: (tags: string[]) => boolean }[] = [
  { id: "crunchyroll", heading: "Crunchyroll", match: (t) => t.includes("crunchyroll") || t.includes("pillar-watch-crunchyroll") },
  { id: "netflix", heading: "Netflix", match: (t) => t.includes("pillar-netflix") },
  { id: "youtube", heading: "YouTube", match: (t) => t.includes("youtube") || t.includes("pillar-watch-youtube") },
  { id: "discord", heading: "Discord", match: (t) => t.includes("discord") || t.includes("pillar-discord-watch-party") },
  { id: "long-distance", heading: "Long distance", match: (t) => t.includes("long-distance") || t.includes("pillar-long-distance") },
  { id: "what-to-watch", heading: "What to watch together", match: (t) => t.includes("listicle") },
  { id: "how-to", heading: "Hosting and watch party how-tos", match: () => true },
];

const byLabel = (a: SectionEntry, b: SectionEntry) => a.label.localeCompare(b.label, "en");

/** Every `/guides/*` page from the guide-links registry, each in its first matching group. */
export function getGuideGroups(): SectionGroup[] {
  const groups = GUIDE_GROUPS.map((g) => ({ id: g.id, heading: g.heading, entries: [] as SectionEntry[] }));
  for (const guide of guideLinks) {
    if (!guide.href.startsWith("/guides/")) continue;
    const index = GUIDE_GROUPS.findIndex((g) => g.match(guide.tags));
    groups[index].entries.push({ href: guide.href, label: guide.label });
  }
  return groups.filter((g) => g.entries.length > 0).map((g) => ({ ...g, entries: g.entries.sort(byLabel) }));
}

/** Genre hubs, then every `/watch/{slug}-with-friends` page A–Z, with films separated. */
export function getWatchGroups(): SectionGroup[] {
  const titles = animeList.map((anime) => ({
    href: `/watch/${anime.slug}-with-friends`,
    label: anime.title,
    movie: isMovieEntry(anime),
  }));
  return [
    { id: "genres", heading: "By genre", entries: GENRE_HUB_LINKS.map(({ href, label }) => ({ href, label })) },
    { id: "series", heading: "Series A–Z", entries: titles.filter((t) => !t.movie).map(({ href, label }) => ({ href, label })).sort(byLabel) },
    { id: "films", heading: "Films", entries: titles.filter((t) => t.movie).map(({ href, label }) => ({ href, label })).sort(byLabel) },
  ];
}

export const SECTION_INDEX_PATHS = ["/guides", "/compare", "/watch", "/glossary", "/tools"] as const;
