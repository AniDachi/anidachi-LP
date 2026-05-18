import { cache } from "react";
import {
  getAnimeById,
  getAnimeRecommendations,
  type JikanAnime,
  type JikanRecommendation,
} from "@/lib/jikan";
import {
  getCachedJikanEntry,
  jikanAnimeFromCache,
} from "@/lib/anime-jikan-cache";
import { animeList, type AnimeEntry } from "@/lib/anime-data";
import { getSlugByMalIdMap } from "@/lib/anime-mal-ids";

/** Cached for the RSC so metadata + page body can share one Jikan round-trip per slug. */
export const fetchJikanForWatchPage = cache(
  async (malId: number, slug: string) => {
    let jikanAnime: JikanAnime | null = null;
    try {
      jikanAnime = await getAnimeById(malId);
    } catch {
      const cached = getCachedJikanEntry(slug);
      if (cached) jikanAnime = jikanAnimeFromCache(cached);
    }

    if (!jikanAnime) return null;

    let recs: Awaited<ReturnType<typeof getAnimeRecommendations>> = [];
    try {
      recs = await getAnimeRecommendations(malId);
    } catch {
      // Jikan often rate-limits; keep poster + core anime metadata when recs fail.
    }
    return { jikanAnime, recs } as const;
  }
);

export function resolveRelatedFromJikan(
  recs: JikanRecommendation[] | null | undefined,
  currentSlug: string
): AnimeEntry[] {
  if (!recs?.length) return [];
  const malToSlug = getSlugByMalIdMap();
  const out: AnimeEntry[] = [];
  for (const r of recs) {
    const id = r.entry.mal_id;
    const slug = malToSlug.get(id);
    if (!slug || slug === currentSlug) continue;
    const entry = animeList.find((a) => a.slug === slug);
    if (entry) out.push(entry);
    if (out.length >= 3) break;
  }
  return out;
}

/** Prefer large poster from Jikan; safe when `jikan` is null or fetch failed. */
export function posterUrlFromJikan(j: JikanAnime | null): string | null {
  if (j == null) return null;
  const large = j.images?.jpg?.large_image_url?.trim();
  const fallback = j.images?.jpg?.image_url?.trim();
  const url = large || fallback;
  return url || null;
}

/** Poster from live/cached Jikan, then prebuild snapshot (`npm run cache:jikan`). */
export function resolvePosterUrl(
  slug: string,
  j: JikanAnime | null
): string | null {
  const fromJikan = posterUrlFromJikan(j);
  if (fromJikan) return fromJikan;
  return getCachedJikanEntry(slug)?.posterUrl ?? null;
}

export function formatEpisodesForUi(
  j: JikanAnime | null,
  staticEpisodes: string
): string {
  if (j == null) return staticEpisodes;
  const n = j.episodes;
  if (n == null || n < 1) return staticEpisodes;
  if (j.airing) {
    return `${n}+ episodes (airing — count may change)`;
  }
  return `${n} episodes`;
}

export function formatScoreLine(j: JikanAnime | null): string | null {
  if (j?.score == null || j.score <= 0) return null;
  return `★ ${j.score.toFixed(1)} / 10 (MAL)`;
}

export function formatMembersLine(j: JikanAnime | null): string | null {
  if (j?.members == null || j.members < 1) return null;
  return `${j.members.toLocaleString("en-US")} members (MAL community)`;
}

export function jikanStatusLine(j: JikanAnime | null): string | null {
  if (j == null) return null;
  if (j.status) return j.status;
  if (j.airing) return "Currently Airing";
  return "Finished Airing";
}

export function jikanGenresText(j: JikanAnime | null, fallback: string[]): string {
  const g = j?.genres;
  if (g && g.length > 0) {
    return g
      .map((x) => x.name)
      .filter(Boolean)
      .slice(0, 5)
      .join(", ");
  }
  return fallback.join(", ");
}
