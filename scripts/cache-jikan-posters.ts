/**
 * Serializes Jikan fetches (~2.5 rps) and writes lib/anime-jikan-cache.json.
 * Run before `next build` so watch pages have posters when live Jikan rate-limits.
 *
 * Usage:
 *   npm run cache:jikan           # fetch only slugs missing from cache
 *   npm run cache:jikan -- --force  # refetch every slug
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAL_ID_BY_SLUG } from "../lib/anime-mal-ids";
import type { AnimeJikanCacheFile, CachedJikanEntry } from "../lib/anime-jikan-cache";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, "../lib/anime-jikan-cache.json");
const JIKAN = "https://api.jikan.moe/v4";
const DELAY_MS = 400;
const force = process.argv.includes("--force");

interface JikanApiAnime {
  mal_id: number;
  episodes: number | null;
  airing: boolean;
  score: number | null;
  members: number;
  status?: string;
  genres?: { name: string }[];
  images?: {
    jpg?: {
      large_image_url?: string;
      image_url?: string;
    };
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function posterFromApi(data: JikanApiAnime): string | null {
  const large = data.images?.jpg?.large_image_url?.trim();
  const fallback = data.images?.jpg?.image_url?.trim();
  return large || fallback || null;
}

function entryFromApi(data: JikanApiAnime): CachedJikanEntry | null {
  const posterUrl = posterFromApi(data);
  if (!posterUrl) return null;
  return {
    mal_id: data.mal_id,
    posterUrl,
    episodes: data.episodes ?? null,
    airing: Boolean(data.airing),
    score: data.score ?? null,
    members: data.members ?? 0,
    status: data.status,
    genres: (data.genres ?? []).map((g) => g.name).filter(Boolean),
  };
}

async function fetchAnime(malId: number): Promise<JikanApiAnime> {
  let attempt = 0;
  const maxAttempts = 4;
  while (attempt < maxAttempts) {
    attempt += 1;
    const res = await fetch(`${JIKAN}/anime/${malId}`);
    if (res.ok) {
      const json = (await res.json()) as { data?: JikanApiAnime };
      if (!json.data?.mal_id) {
        throw new Error("empty Jikan payload");
      }
      return json.data;
    }
    const retryable =
      res.status === 429 ||
      res.status === 500 ||
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504;
    if (!retryable || attempt >= maxAttempts) {
      throw new Error(`Jikan ${res.status} for mal_id=${malId}`);
    }
    const retryAfter = res.headers.get("retry-after");
    const waitMs =
      retryAfter && /^\d+$/.test(retryAfter)
        ? Math.min(parseInt(retryAfter, 10) * 1000, 4000)
        : 1200 * attempt;
    await sleep(waitMs);
  }
  throw new Error(`Jikan failed for mal_id=${malId}`);
}

function loadExisting(): AnimeJikanCacheFile {
  if (!fs.existsSync(CACHE_PATH)) {
    return { generatedAt: "", entries: {} };
  }
  return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as AnimeJikanCacheFile;
}

async function main(): Promise<void> {
  const existing = loadExisting();
  const entries: Record<string, CachedJikanEntry> = { ...existing.entries };
  const slugs = Object.keys(MAL_ID_BY_SLUG).sort();
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `Caching Jikan data for ${slugs.length} titles (${force ? "force" : "incremental"})…`
  );

  for (const slug of slugs) {
    const malId = MAL_ID_BY_SLUG[slug];
    if (!force && entries[slug]?.posterUrl) {
      skipped += 1;
      continue;
    }

    await sleep(DELAY_MS);

    try {
      const data = await fetchAnime(malId);
      const entry = entryFromApi(data);
      if (!entry) {
        throw new Error("no poster URL in response");
      }
      entries[slug] = entry;
      updated += 1;
      process.stdout.write(`  ✓ ${slug}\n`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`  ✗ ${slug}: ${msg}\n`);
    }
  }

  const out: AnimeJikanCacheFile = {
    generatedAt: new Date().toISOString(),
    entries,
  };
  fs.writeFileSync(CACHE_PATH, `${JSON.stringify(out, null, 2)}\n`);

  console.log(
    `\nWrote ${CACHE_PATH}\n  updated: ${updated}, skipped: ${skipped}, failed: ${failed}, total cached: ${Object.keys(entries).length}`
  );

  if (Object.keys(entries).length === 0) {
    console.error("No cache entries — watch pages will have no poster fallbacks.");
    process.exit(1);
  }
  if (failed > 0) {
    console.warn(
      `${failed} fetch(es) failed; kept existing cache entries where present.`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
