const POSTER_TARGET_WIDTH = 480;

export function selectCrunchyrollPosterTall(value: unknown): string | null {
  const posters = collectCrunchyrollArtworkImages(value);
  if (!posters.length) {
    return null;
  }

  posters.sort(
    (first, second) =>
      first.priority - second.priority ||
      orientationPenalty(first) - orientationPenalty(second) ||
      Math.abs(first.width - POSTER_TARGET_WIDTH) - Math.abs(second.width - POSTER_TARGET_WIDTH),
  );

  return posters[0]?.source ?? null;
}

export function getCrunchyrollRelatedSeriesId(value: unknown): string | null {
  return findRelatedSeriesId(value, 0);
}

interface CrunchyrollArtworkCandidate {
  source: string;
  width: number;
  height: number;
  priority: number;
}

function collectCrunchyrollArtworkImages(value: unknown): CrunchyrollArtworkCandidate[] {
  const posters: CrunchyrollArtworkCandidate[] = [];
  collectPosterTallImagesFromValue(value, posters, 0);
  return posters;
}

function collectPosterTallImagesFromValue(
  value: unknown,
  output: CrunchyrollArtworkCandidate[],
  depth: number,
): void {
  if (!value || depth > 8) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectPosterTallImagesFromValue(item, output, depth + 1);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const images = asRecord(record.images);
  if (images) {
    for (const [key, imageSet] of Object.entries(images)) {
      output.push(...readArtworkImages(imageSet, key));
    }
  }

  for (const nested of Object.values(record)) {
    collectPosterTallImagesFromValue(nested, output, depth + 1);
  }
}

function readArtworkImages(value: unknown, key: string): CrunchyrollArtworkCandidate[] {
  const flattened = flattenUnknownArray(value);
  return flattened
    .filter((image): image is { source: string; width: number; height: number } => {
      if (!image || typeof image !== "object") {
        return false;
      }

      const record = image as Record<string, unknown>;
      return (
        typeof record.source === "string" &&
        typeof record.width === "number" &&
        typeof record.height === "number" &&
        record.width > 0 &&
        record.height > 0
      );
    })
    .map((image) => ({
      height: image.height,
      priority: artworkPriority(key, image),
      source: image.source,
      width: image.width,
    }));
}

function artworkPriority(
  key: string,
  image: { source: string; width: number; height: number },
): number {
  const normalizedKey = key.toLowerCase();
  if (normalizedKey === "poster_tall") {
    return 0;
  }
  if (normalizedKey.includes("poster") && image.height > image.width) {
    return 1;
  }
  if (image.height > image.width) {
    return 2;
  }
  if (normalizedKey.includes("thumbnail")) {
    return 3;
  }
  if (/backdrop_wide\b/.test(image.source)) {
    return 5;
  }
  return 4;
}

function orientationPenalty(image: { width: number; height: number }): number {
  return image.height >= image.width ? 0 : 1;
}

function flattenUnknownArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => (Array.isArray(item) ? flattenUnknownArray(item) : [item]));
}

function findRelatedSeriesId(value: unknown, depth: number): string | null {
  if (!value || depth > 8) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findRelatedSeriesId(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const episodeMetadata = asRecord(record.episode_metadata);
  const episodeSeriesId = readNonEmptyString(episodeMetadata?.series_id);
  if (episodeSeriesId) {
    return episodeSeriesId;
  }

  const directSeriesId = readNonEmptyString(record.series_id) ?? readNonEmptyString(record.seriesId);
  if (directSeriesId) {
    return directSeriesId;
  }

  const series = asRecord(record.series);
  const nestedSeriesId = readNonEmptyString(series?.id) ?? readNonEmptyString(series?.series_id);
  if (nestedSeriesId) {
    return nestedSeriesId;
  }

  for (const nested of Object.values(record)) {
    const found = findRelatedSeriesId(nested, depth + 1);
    if (found) {
      return found;
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
