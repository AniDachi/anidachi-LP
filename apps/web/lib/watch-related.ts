import { animeList, type AnimeEntry } from "@/lib/anime-data";
import { GENRE_HUB_LINKS } from "@/lib/genre-hub-links";

export const WATCH_RELATED_LIMIT = 6;

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** FNV-1a, so each page gets a stable but different order among equally close titles. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Related titles for a watch page: the given picks first (curated or MyAnimeList
 * recommendations), then titles that share the most genres. Ties rotate per page,
 * which spreads inbound links across the catalog instead of always favouring the
 * same few shows.
 */
export function getWatchRelated(
  anime: AnimeEntry,
  picks: AnimeEntry[],
  limit = WATCH_RELATED_LIMIT,
): AnimeEntry[] {
  const chosen: AnimeEntry[] = [];
  const seen = new Set<string>([anime.slug]);
  for (const pick of picks) {
    if (chosen.length >= limit || seen.has(pick.slug)) continue;
    seen.add(pick.slug);
    chosen.push(pick);
  }
  const genres = new Set(anime.genres.map(slugify));
  const candidates = animeList
    .filter((other) => !seen.has(other.slug))
    .map((other) => ({
      other,
      shared: other.genres.filter((g) => genres.has(slugify(g))).length,
      order: hash(`${anime.slug}>${other.slug}`),
    }))
    .filter((c) => c.shared > 0)
    .sort((a, b) => b.shared - a.shared || a.order - b.order);
  for (const { other } of candidates) {
    if (chosen.length >= limit) break;
    chosen.push(other);
  }
  return chosen;
}

/** Genre hubs whose genre this title has, in hub order. */
export function getWatchGenreHubs(anime: AnimeEntry, limit = 2) {
  const genres = new Set(anime.genres.map(slugify).map((g) => (g === "shounen" ? "shonen" : g)));
  return GENRE_HUB_LINKS.filter((hub) => {
    const match = /^\/watch-(.+)-anime-with-friends$/.exec(hub.href);
    return match ? genres.has(match[1]) : false;
  }).slice(0, limit);
}
