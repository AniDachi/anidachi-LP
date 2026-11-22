import { z } from "zod";
import { MAX_URL_CHARS } from "./limits";

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const uuid = new RegExp(`^${uuidPattern}$`);
export const HboMaxProviderIdSchema = z.string().regex(uuid);

export const HBO_MAX_ORIGIN = "https://www.hbomax.com";
export const HBO_MAX_BROWSER_HOSTS = [
  "www.hbomax.com", "play.hbomax.com", "hbomax.com",
  "www.max.com", "play.max.com", "max.com",
] as const;
const browserOrigins = new Set(HBO_MAX_BROWSER_HOSTS.map(host => `https://${host}`));

export function isHboMaxOrigin(origin: string): boolean {
  return browserOrigins.has(origin);
}
const artworkRoute = /^(https:\/\/images[.]cdn[.]prd[.]api[.]discomax[.]com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+[.]jpe?g)(?:\?(?:[wh]=[0-9]+|f=[A-Za-z0-9]+)(?:&(?:[wh]=[0-9]+|f=[A-Za-z0-9]+))*)?$/;

export function hboMaxArtworkUrl(value: string): string | null {
  return value.length <= MAX_URL_CHARS ? artworkRoute.exec(value)?.[1] ?? null : null;
}
export function isHboMaxArtworkUrl(value: string | null): boolean {
  return value === null || hboMaxArtworkUrl(value) === value;
}

const routeUuid = uuidPattern.replaceAll("a-f", "a-fA-F");
// On the two-UUID watch route the first is the video and the second its edition.
// HBO's public Big Little Lies S1E2 episode page also identifies it by the first UUID.
const playbackRoute = new RegExp(`^/video/watch/(${routeUuid})(?:/${routeUuid})?/?$`);
const slug = "[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N}_-]*";
const titleId = `(?:(?!${routeUuid}/)${slug}/)?(${routeUuid})`;
const seriesDetailRoute = new RegExp(`^/shows?/${titleId}(?:/s[1-9][0-9]*)?/?$`, "u");
const movieDetailRoute = new RegExp(`^/movies?/${titleId}/?$`, "u");
const episodeDetailRoute = new RegExp(`^/shows?/${titleId}/s[1-9][0-9]*/e[1-9][0-9]*(?:-${slug})?/${routeUuid}/?$`, "u");
const catalogRoute = /^\/(?:home|series|shows|movies|categories|audio-description|search|my-stuff|(?:channel|genre)\/[a-z0-9_-]+|collections(?:\/genre\/[a-z0-9_-]+)?|browse(?:\/[a-z0-9_-]+)*)?\/?$/;
const localePrefix = /^\/(?:[a-z]{2}\/)?[a-z]{2}(?:-[a-zA-Z]{2,4})?(?=\/|$)/;

function browserRoute(value: string) {
  if (value.length > MAX_URL_CHARS || /[\\\s\x00-\x1f\x7f]/.test(value)) return null;
  // URL.pathname silently resolves dot segments and URL.origin drops explicit default ports.
  const match = /^(https:\/\/[^/?#]+)(\/[^?#]*)?(?:[?#].*)?$/u.exec(value);
  if (!match || !isHboMaxOrigin(match[1]!)) return null;
  const rawPath = match[2] ?? "/";
  // Only localized title slugs need UTF-8 escapes. Structural characters and IDs must be literal.
  if (/%[0-7][0-9a-f]/i.test(rawPath) || rawPath.includes("//")) return null;
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  const prefix = localePrefix.exec(path)?.[0] ?? "";
  return { origin: match[1]!, prefix, path: path.slice(prefix.length) || "/" };
}

export function hboMaxPlaybackId(value: string): string | null {
  const route = browserRoute(value);
  return route ? playbackRoute.exec(route.path)?.[1]?.toLowerCase() ?? null : null;
}
export function hboMaxDetail(value: string): { kind: "series" | "movie"; id: string } | null {
  const route = browserRoute(value);
  if (!route) return null;
  const show = seriesDetailRoute.exec(route.path);
  if (show) return { kind: "series", id: show[1]!.toLowerCase() };
  const movie = movieDetailRoute.exec(route.path);
  return movie ? { kind: "movie", id: movie[1]!.toLowerCase() } : null;
}
function isCatalogPath(path: string): boolean {
  return catalogRoute.test(path) || seriesDetailRoute.test(path) || movieDetailRoute.test(path) || episodeDetailRoute.test(path);
}
export function hboMaxCatalogPath(value: string): boolean {
  const route = browserRoute(value);
  return !!route && isCatalogPath(route.path);
}

/** Localize a canonical navigation target. Catalog prefixes need not exist on the player. */
export function localizeHboMaxUrl(targetUrl: string, currentHref: string): string {
  const target = browserRoute(targetUrl);
  const current = browserRoute(currentHref);
  if (!target || !current) return targetUrl;
  const watch = playbackRoute.test(target.path);
  if (!watch && !isCatalogPath(target.path)) return targetUrl;
  const currentWatch = playbackRoute.test(current.path);
  if (!currentWatch && !isCatalogPath(current.path)) return targetUrl;
  const prefix = watch && !currentWatch ? "" : current.prefix;
  return new URL(prefix + target.path, current.origin).href;
}
export function hboMaxSourceUrl(id: string): string {
  return `${HBO_MAX_ORIGIN}/video/watch/${id}`;
}
export function hboMaxFingerprint(id: string): string {
  return `hbomax|video/watch/${id}`;
}
export function hboMaxSeasonIdentifier(seriesId: string, seasonNumber: number): string {
  return `${seriesId}:${seasonNumber}`;
}
export function isHboMaxHistoryKey(key: string, kind: string): boolean {
  if (kind === "season") return new RegExp(`^hbomax:season:${uuidPattern}:(?:[1-9][0-9]{0,2}|1000)$`).test(key);
  return ["series", "episode", "movie"].includes(kind) && key.startsWith(`hbomax:${kind}:`) &&
    uuid.test(key.slice(`hbomax:${kind}:`.length));
}
export const HboMaxHistoryIdentitySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("movie"), providerMovieId: HboMaxProviderIdSchema, providerPlaybackId: HboMaxProviderIdSchema }),
  z.strictObject({
    kind: z.literal("episode"),
    providerSeriesId: HboMaxProviderIdSchema,
    providerEpisodeIdentifier: HboMaxProviderIdSchema,
  }),
]);
export type HboMaxHistoryIdentity = z.infer<typeof HboMaxHistoryIdentitySchema>;

export function hboMaxHistoryKeys(identity: HboMaxHistoryIdentity, seasonNumber?: number | null) {
  if (identity.kind === "movie") {
    const key = `hbomax:movie:${identity.providerMovieId}`;
    return { itemKind: "movie" as const, titleKey: key, episodeKey: `hbomax:movie:${identity.providerPlaybackId}`, seasonKey: null };
  }
  return {
    itemKind: "series" as const,
    titleKey: `hbomax:series:${identity.providerSeriesId}`,
    episodeKey: `hbomax:episode:${identity.providerEpisodeIdentifier}`,
    seasonKey: seasonNumber == null ? null : `hbomax:season:${hboMaxSeasonIdentifier(identity.providerSeriesId, seasonNumber)}`,
  };
}
