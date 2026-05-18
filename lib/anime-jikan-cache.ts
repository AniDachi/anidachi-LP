import cacheFile from "@/lib/anime-jikan-cache.json";
import type { JikanAnime, JikanGenre } from "@/lib/jikan";

/** Snapshot written by `npm run cache:jikan` before production builds. */
export interface CachedJikanEntry {
  mal_id: number;
  posterUrl: string;
  episodes: number | null;
  airing: boolean;
  score: number | null;
  members: number;
  status?: string;
  genres: string[];
}

export interface AnimeJikanCacheFile {
  generatedAt: string;
  entries: Record<string, CachedJikanEntry>;
}

const cache = cacheFile as AnimeJikanCacheFile;

export function getCachedJikanEntry(slug: string): CachedJikanEntry | null {
  return cache.entries[slug] ?? null;
}

/** Rehydrate a minimal `JikanAnime` for formatters / JSON-LD when live Jikan fails. */
export function jikanAnimeFromCache(entry: CachedJikanEntry): JikanAnime {
  const genres: JikanGenre[] = entry.genres.map((name, i) => ({
    mal_id: i,
    type: "anime",
    name,
    url: "",
  }));

  return {
    mal_id: entry.mal_id,
    title: "",
    title_english: null,
    type: "TV",
    episodes: entry.episodes,
    airing: entry.airing,
    score: entry.score,
    synopsis: "",
    members: entry.members,
    status: entry.status,
    genres,
    images: {
      jpg: {
        image_url: entry.posterUrl,
        large_image_url: entry.posterUrl,
        small_image_url: entry.posterUrl,
      },
    },
  };
}

export function getCacheGeneratedAt(): string {
  return cache.generatedAt;
}
