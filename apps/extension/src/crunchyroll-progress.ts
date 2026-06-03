import type { WatchProgressEntry } from "./watch-progress";

interface CrunchyrollProgressInput {
  title: string | null;
  video: HTMLVideoElement;
  roomId?: string;
  watchedWithCount: number;
}

export function getCrunchyrollProgressEntry(
  input: CrunchyrollProgressInput,
): WatchProgressEntry | null {
  if (!location.hostname.endsWith("crunchyroll.com")) {
    return null;
  }

  const url = new URL(location.href);
  const match = url.pathname.match(/\/watch\/([^/?#]+)\/?([^/?#]*)?/);
  if (!match?.[1]) {
    return null;
  }

  const watchId = match[1];
  const slug = match[2] || watchId;
  const title = cleanCrunchyrollTitle(input.title ?? document.title) || toTitle(slug);
  const duration = Number.isFinite(input.video.duration) ? input.video.duration : 0;
  const sourceUrl = `${url.origin}${url.pathname}`;
  const seriesInfo = getCrunchyrollSeriesInfo(title);
  const isMovie = looksLikeMovie(title, duration);
  const isEpisode = !isMovie && (Boolean(seriesInfo.title) || looksLikeEpisode(title));
  const itemTitle = isEpisode ? (seriesInfo.title ?? toTitle(slug)) : title;
  const seriesKey = slugify(seriesInfo.slug || seriesInfo.title || slug) || slug;

  return {
    provider: "crunchyroll",
    kind: isEpisode ? "episode" : "movie",
    itemId: isEpisode ? `crunchyroll-series:${seriesKey}` : `crunchyroll-movie:${watchId}`,
    itemTitle,
    contentId: watchId,
    ...(isEpisode && seriesInfo.seriesId ? { seriesId: seriesInfo.seriesId } : {}),
    episodeId: watchId,
    episodeTitle: title,
    ...(isEpisode && seriesInfo.artworkUrl ? { artworkUrl: seriesInfo.artworkUrl } : {}),
    sourceUrl,
    currentTime: input.video.currentTime || 0,
    duration,
    roomId: input.roomId,
    watchedWithCount: input.watchedWithCount,
  };
}

interface CrunchyrollSeriesInfo {
  title: string | null;
  slug: string | null;
  seriesId: string | null;
  artworkUrl: string | null;
}

interface CrunchyrollSeriesCandidate {
  title?: string | null;
  url?: string | null;
  artworkUrl?: string | null;
}

function getCrunchyrollSeriesInfo(episodeTitle: string): CrunchyrollSeriesInfo {
  const metaSeriesUrl =
    document.querySelector<HTMLMetaElement>('meta[property="og:video:series"]')?.content ??
    document.querySelector<HTMLMetaElement>('meta[property="video:series"]')?.content;
  const linkCandidates = getSeriesLinkCandidates();
  const jsonLdCandidates = getJsonLdSeriesCandidates();
  const candidates: CrunchyrollSeriesCandidate[] = [
    ...jsonLdCandidates,
    ...linkCandidates,
    {
      title: document.querySelector<HTMLMetaElement>('meta[name="series-title"]')?.content,
      url: metaSeriesUrl,
    },
    {
      title: document.querySelector<HTMLMetaElement>('meta[name="crunchyroll:series_title"]')
        ?.content,
      url: metaSeriesUrl,
    },
    {
      title: document.querySelector<HTMLElement>('[data-t*="series" i]')?.textContent,
      url: metaSeriesUrl,
    },
    {
      title: document.querySelector<HTMLElement>('[data-testid*="series" i]')?.textContent,
      url: metaSeriesUrl,
    },
    { url: metaSeriesUrl },
  ];

  const usable = candidates
    .map((candidate) => ({
      ...candidate,
      title: cleanCrunchyrollTitle(candidate.title ?? ""),
    }))
    .find((candidate) => isUsefulSeriesTitle(candidate.title ?? "", episodeTitle));
  const urlInfo =
    candidates.map((candidate) => getCrunchyrollSeriesUrlInfo(candidate.url)).find(Boolean) ?? null;
  const artworkUrl =
    candidates.map((candidate) => cleanImageUrl(candidate.artworkUrl)).find(Boolean) ?? null;
  const fallbackTitle = urlInfo?.slug ? toTitle(urlInfo.slug) : null;
  const title = usable?.title ?? fallbackTitle;

  return {
    title: title && isUsefulSeriesTitle(title, episodeTitle) ? title : null,
    slug: urlInfo?.slug ?? null,
    seriesId: urlInfo?.seriesId ?? null,
    artworkUrl,
  };
}

function getSeriesLinkCandidates(): CrunchyrollSeriesCandidate[] {
  return [...document.querySelectorAll<HTMLAnchorElement>('a[href*="/series/"]')].map((link) => {
    const image = link.querySelector("img");
    return {
      title: link.textContent || link.getAttribute("aria-label") || image?.alt,
      url: link.href,
      artworkUrl: isPortraitImage(image) ? image?.currentSrc || image?.src : null,
    };
  });
}

function getCrunchyrollSeriesUrlInfo(value: string | null | undefined): {
  seriesId: string;
  slug: string;
} | null {
  if (!value) {
    return null;
  }

  const match = value.match(/\/series\/([^/?#]+)\/?([^/?#]*)?/);
  if (!match?.[1]) {
    return null;
  }

  return {
    seriesId: match[1],
    slug: match[2] || match[1],
  };
}

function cleanImageUrl(value: string | null | undefined): string | null {
  if (!value || !/^https?:\/\//i.test(value) || value.includes("crunchyroll.com/ru/")) {
    return null;
  }

  return value;
}

function isPortraitImage(image: HTMLImageElement | null): boolean {
  if (!image) {
    return false;
  }

  return image.naturalHeight > image.naturalWidth && image.naturalWidth > 0;
}

function getJsonLdSeriesCandidates(): CrunchyrollSeriesCandidate[] {
  const candidates: CrunchyrollSeriesCandidate[] = [];

  for (const script of document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  )) {
    const parsed = parseJson(script.textContent ?? "");
    collectJsonLdSeriesCandidates(parsed, candidates, 0);
  }

  return candidates;
}

function cleanCrunchyrollTitle(title: string): string {
  return title
    .replace(/\s*-\s*Watch on Crunchyroll\s*$/i, "")
    .replace(/\s*\|\s*Crunchyroll\s*$/i, "")
    .replace(/\s*·\s*Crunchyroll\s*$/i, "")
    .trim();
}

function looksLikeEpisode(title: string): boolean {
  return (
    /^E\s?\d+\b/i.test(title) ||
    /^EP\s?\.?\s?\d+\b/i.test(title) ||
    /^S\d+\s+E\d+\b/i.test(title) ||
    /\bEpisode\s+\d+\b/i.test(title) ||
    /\bEp\.?\s+\d+\b/i.test(title) ||
    /\bСерия\s+\d+\b/i.test(title) ||
    /\bЭпизод\s+\d+\b/i.test(title) ||
    /\bСезон\s+\d+\s+Серия\s+\d+\b/i.test(title)
  );
}

function looksLikeMovie(title: string, duration: number): boolean {
  const normalized = title.toLowerCase();
  const hasMovieWord =
    /\b(movie|film|feature)\b/i.test(title) || /фильм|полнометраж/i.test(normalized);
  if (!hasMovieWord) {
    return false;
  }

  return duration >= 40 * 60 || !looksLikeEpisode(title);
}

function isUsefulSeriesTitle(value: string, episodeTitle: string): boolean {
  if (!value || value.length < 2) {
    return false;
  }

  const normalized = value.toLowerCase();
  return (
    normalized !== "crunchyroll" &&
    normalized !== episodeTitle.toLowerCase() &&
    !/^https?:\/\//i.test(value) &&
    !value.includes("crunchyroll.com/") &&
    !/^e\d+\b/i.test(value)
  );
}

function toTitle(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase())
    .trim();
}

function collectJsonLdSeriesCandidates(
  value: unknown,
  output: CrunchyrollSeriesCandidate[],
  depth: number,
): void {
  if (!value || depth > 8) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdSeriesCandidates(item, output, depth + 1);
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  if (record["@type"] === "BreadcrumbList" && Array.isArray(record.itemListElement)) {
    for (const item of record.itemListElement) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const listItem = item as Record<string, unknown>;
      const itemUrl =
        typeof listItem.item === "string"
          ? listItem.item
          : typeof listItem.url === "string"
            ? listItem.url
            : null;
      if (!itemUrl?.includes("/series/")) {
        continue;
      }

      output.push({
        title: typeof listItem.name === "string" ? listItem.name : null,
        url: itemUrl,
      });
    }
  }

  for (const key of ["partOfSeries", "partOfTVSeries", "partOfSeason", "isPartOf"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const name = (nested as Record<string, unknown>).name;
      const id = (nested as Record<string, unknown>)["@id"];
      const url = (nested as Record<string, unknown>).url;
      if (typeof name === "string") {
        output.push({
          title: name,
          url: typeof id === "string" ? id : typeof url === "string" ? url : null,
        });
      }
      collectJsonLdSeriesCandidates(nested, output, depth + 1);
    }
  }

  const graph = record["@graph"];
  if (graph) {
    collectJsonLdSeriesCandidates(graph, output, depth + 1);
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
