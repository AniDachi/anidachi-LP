export type InferredWatchSeason = {
  seasonId: string;
  seasonTitle: string;
  seasonNumber: number | null;
};

const KNOWN_CRUNCHYROLL_SEASONS_BY_WATCH_ID: Record<string, InferredWatchSeason> = {
  G31UVXQPG: season(1),
  GPWU8KEQG: season(1),
  G2XUN0J2D: season(1),
  G8WU7NEDG: season(1),
  GRKE28PWR: season(1),
  GEVUZGE02: season(1),
  GJWU2XVK0: season(1),
  GRP8P9XGR: season(2),
  GWDU78GG3: season(2),
  G68VM8X86: season(2),
  GG1UX2002: season(2),
  GYDQVZNG6: season(2),
};

export function inferCrunchyrollSeasonFromSourceUrl(
  sourceUrl: string | null | undefined,
): InferredWatchSeason | null {
  const watchId = getCrunchyrollWatchId(sourceUrl);
  return watchId ? KNOWN_CRUNCHYROLL_SEASONS_BY_WATCH_ID[watchId] ?? null : null;
}

export function inferSeasonNumberFromTitle(title: string): number | null {
  const numericMatch =
    title.match(/\bS(?:eason)?\s*(\d+)\s*E(?:pisode|p\.?)?\s*\d+/i) ??
    title.match(/\bSeason\s*(\d+)\b/i) ??
    title.match(/\b(\d+)(?:st|nd|rd|th)\s+Season\b/i) ??
    title.match(/\bСезон\s*(\d+)\b/i) ??
    title.match(/\b(\d+)\s*сезон\b/i) ??
    title.match(/\b(\d+)[\s-]*(?:й|я|ой)\s+сезон\b/i);
  if (!numericMatch) return null;
  const value = Number.parseInt(numericMatch[1] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function season(seasonNumber: number): InferredWatchSeason {
  return {
    seasonId: `season-${seasonNumber}`,
    seasonTitle: `Season ${seasonNumber}`,
    seasonNumber,
  };
}

function getCrunchyrollWatchId(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/\/watch\/([^/?#]+)/i);
    return match?.[1]?.toUpperCase() ?? null;
  } catch {
    const match = sourceUrl.match(/\/watch\/([^/?#]+)/i);
    return match?.[1]?.toUpperCase() ?? null;
  }
}
