import { z } from "zod";
import { MAX_URL_CHARS } from "./limits";

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const uuid = new RegExp(`^${uuidPattern}$`);
export const HboMaxProviderIdSchema = z.string().regex(uuid);

export const HBO_MAX_ORIGIN = "https://www.hbomax.com";
const artworkRoute = /^(https:\/\/images[.]cdn[.]prd[.]api[.]discomax[.]com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+[.]jpe?g)(?:\?(?:[wh]=[0-9]+|f=[A-Za-z0-9]+)(?:&(?:[wh]=[0-9]+|f=[A-Za-z0-9]+))*)?$/;

export function hboMaxArtworkUrl(value: string): string | null {
  return value.length <= MAX_URL_CHARS ? artworkRoute.exec(value)?.[1] ?? null : null;
}
export function isHboMaxArtworkUrl(value: string | null): boolean {
  return value === null || hboMaxArtworkUrl(value) === value;
}

const routeUuid = uuidPattern.replaceAll("a-f", "a-fA-F");
const playbackRoute = new RegExp(`^https://www[.]hbomax[.]com/video/watch/(${routeUuid})/?(?:[?#].*)?$`);
const detailRoute = new RegExp(`^https://www[.]hbomax[.]com/(show|movie)/(${routeUuid})/?(?:[?#].*)?$`);
function matchRoute(value: string, route: RegExp): RegExpExecArray | null {
  if (value.length > MAX_URL_CHARS || /[\\\s\x00-\x1f\x7f]/.test(value)) return null;
  return route.exec(value);
}
export function hboMaxPlaybackId(value: string): string | null {
  return matchRoute(value, playbackRoute)?.[1]?.toLowerCase() ?? null;
}
export function hboMaxDetail(value: string): { kind: "series" | "movie"; id: string } | null {
  const match = matchRoute(value, detailRoute);
  return match ? { kind: match[1] === "show" ? "series" : "movie", id: match[2]!.toLowerCase() } : null;
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
