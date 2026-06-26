export interface CrunchyrollSeasonMetadata {
  seasonId: string;
  seasonTitle: string;
  seasonNumber: number | null;
}

const ORDINAL_WORD_SEASONS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
};

const KNOWN_CRUNCHYROLL_SEASONS_BY_WATCH_ID: Record<string, CrunchyrollSeasonMetadata> = {
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
): CrunchyrollSeasonMetadata | null {
  const watchId = getCrunchyrollWatchId(sourceUrl);
  return watchId ? KNOWN_CRUNCHYROLL_SEASONS_BY_WATCH_ID[watchId] ?? null : null;
}

export function inferCrunchyrollSeasonFromTitle(
  title: string | null | undefined,
): CrunchyrollSeasonMetadata | null {
  const seasonNumber = seasonNumberFromTitle(title ?? "");
  return seasonNumber ? season(seasonNumber) : null;
}

export function seasonNumberFromTitle(title: string): number | null {
  const numericMatch =
    title.match(/\bS(?:eason)?\s*(\d+)\s*E(?:pisode|p\.?)?\s*\d+/i) ??
    title.match(/\bSeason\s*(\d+)\b/i) ??
    title.match(/\b(\d+)(?:st|nd|rd|th)\s+Season\b/i) ??
    title.match(/\bСезон\s*(\d+)\b/i) ??
    title.match(/\b(\d+)\s*сезон\b/i) ??
    title.match(/\b(\d+)[\s-]*(?:й|я|ой)\s+сезон\b/i);
  const numeric = normalizeSeasonNumber(numericMatch?.[1]);
  if (numeric) return numeric;

  const word = title.match(
    /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+Season\b/i,
  )?.[1];
  return word ? ORDINAL_WORD_SEASONS[word.toLowerCase()] ?? null : null;
}

export function normalizeSeasonTitle(
  title: string | null | undefined,
  seasonNumber: number | null,
): string | null {
  const cleaned = cleanCrunchyrollTitle(title ?? "");
  if (!cleaned || cleaned.toLowerCase() === "crunchyroll" || isPlaceholderSeasonTitle(cleaned)) {
    return seasonNumber ? season(seasonNumber).seasonTitle : null;
  }
  if (/^s\d+$/i.test(cleaned) || seasonNumberFromTitle(cleaned)) {
    return seasonNumber ? season(seasonNumber).seasonTitle : cleaned.toUpperCase();
  }
  return cleaned;
}

function isPlaceholderSeasonTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return normalized === "?" || normalized === "unknown" || normalized === "n/a" || normalized === "na";
}

function season(seasonNumber: number): CrunchyrollSeasonMetadata {
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

function cleanCrunchyrollTitle(title: string): string {
  return title
    .replace(/\s*-\s*Watch on Crunchyroll\s*$/i, "")
    .replace(/\s*\|\s*Crunchyroll\s*$/i, "")
    .replace(/\s*·\s*Crunchyroll\s*$/i, "")
    .trim();
}

function normalizeSeasonNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(number) && number > 0 && number <= 1000 ? Math.floor(number) : null;
}
