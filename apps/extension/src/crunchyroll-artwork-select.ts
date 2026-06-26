const POSTER_TARGET_WIDTH = 480;

export function selectCrunchyrollPosterTall(value: unknown): string | null {
  const posters = collectPosterTallImages(value);
  if (!posters.length) {
    return null;
  }

  posters.sort(
    (first, second) =>
      Math.abs(first.width - POSTER_TARGET_WIDTH) - Math.abs(second.width - POSTER_TARGET_WIDTH),
  );

  return posters[0]?.source ?? null;
}

export function getCrunchyrollRelatedSeriesId(value: unknown): string | null {
  return findRelatedSeriesId(value, 0);
}

function collectPosterTallImages(value: unknown): Array<{ source: string; width: number }> {
  const posters: Array<{ source: string; width: number }> = [];
  collectPosterTallImagesFromValue(value, posters, 0);
  return posters;
}

function collectPosterTallImagesFromValue(
  value: unknown,
  output: Array<{ source: string; width: number }>,
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
  const posterTall = images?.poster_tall;
  if (posterTall) {
    output.push(...readPosterTallImages(posterTall));
  }

  for (const nested of Object.values(record)) {
    collectPosterTallImagesFromValue(nested, output, depth + 1);
  }
}

function readPosterTallImages(value: unknown): Array<{ source: string; width: number }> {
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
        record.height > record.width
      );
    })
    .map((image) => ({
      source: image.source,
      width: image.width,
    }));
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
