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
  const firstItem = getFirstCmsObject(value);
  const seriesId = firstItem?.episode_metadata?.series_id;
  return typeof seriesId === "string" && seriesId ? seriesId : null;
}

function collectPosterTallImages(value: unknown): Array<{ source: string; width: number }> {
  const firstItem = getFirstCmsObject(value);
  const posterTall = firstItem?.images?.poster_tall;
  if (!Array.isArray(posterTall)) {
    return [];
  }

  return posterTall
    .flat()
    .filter((image): image is { source: string; width: number; height: number } => {
      return (
        Boolean(image) &&
        typeof image === "object" &&
        typeof image.source === "string" &&
        typeof image.width === "number" &&
        typeof image.height === "number" &&
        image.height > image.width
      );
    })
    .map((image) => ({
      source: image.source,
      width: image.width,
    }));
}

function getFirstCmsObject(value: unknown):
  | {
      images?: {
        poster_tall?: unknown;
      };
      episode_metadata?: {
        series_id?: unknown;
      };
    }
  | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as { data?: unknown };
  if (!Array.isArray(record.data)) {
    return undefined;
  }

  const first = record.data[0];
  return first && typeof first === "object"
    ? (first as {
        images?: { poster_tall?: unknown };
        episode_metadata?: { series_id?: unknown };
      })
    : undefined;
}
