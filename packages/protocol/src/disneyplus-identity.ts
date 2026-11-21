import { z } from "zod";
import { MAX_URL_CHARS } from "./limits";

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const uuid = new RegExp(`^${uuidPattern}$`);
export const DisneyPlusProviderIdSchema = z.string().regex(uuid);

/** The image host used by Disney+ catalog and playback artwork. */
export function isDisneyPlusArtworkUrl(value: string | null): boolean {
  return value === null || (value.length <= MAX_URL_CHARS &&
    /^https:\/\/disney[.]images[.]edge[.]bamgrid[.]com\/[^?#\s\\]+(?:\?[^#\s\\]*)?$/.test(value) &&
    !/%2e|\/\.{1,2}(?:\/|\?|$)/i.test(value));
}

function disneyRoute(pattern: string): RegExp {
  return new RegExp(`^https://www[.]disneyplus[.]com/(?:[a-z]{2}(?:-[a-z]{2})?/)?${pattern}(${uuidPattern})/?(?:[?#].*)?$`, "i");
}
const playbackRoute = disneyRoute("play/");
const entityRoute = disneyRoute("browse/entity-");

function readRoute(value: string, route: RegExp): string | null {
  if (value.length > MAX_URL_CHARS || /[\\\s\x00-\x1f\x7f]/.test(value)) return null;
  return route.exec(value)?.[1]?.toLowerCase() ?? null;
}
export function disneyPlusPlaybackId(value: string): string | null {
  return readRoute(value, playbackRoute);
}
export function disneyPlusEntityId(value: string): string | null {
  return readRoute(value, entityRoute);
}
export function disneyPlusSourceUrl(id: string): string {
  return `https://www.disneyplus.com/play/${id}`;
}
export function disneyPlusFingerprint(id: string): string {
  return `disneyplus|play/${id}`;
}
export function disneyPlusSeasonIdentifier(seriesId: string, seasonNumber: number): string {
  return `${seriesId}:${seasonNumber}`;
}
export function isDisneyPlusHistoryKey(key: string, kind: string): boolean {
  if (kind === "season") return new RegExp(`^disneyplus:season:${uuidPattern}:(?:[1-9][0-9]{0,2}|1000)$`).test(key);
  return ["series", "episode", "movie"].includes(kind) && key.startsWith(`disneyplus:${kind}:`) &&
    uuid.test(key.slice(`disneyplus:${kind}:`.length));
}
export const DisneyPlusHistoryIdentitySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("movie"), providerMovieId: DisneyPlusProviderIdSchema }),
  z.strictObject({
    kind: z.literal("episode"),
    providerSeriesId: DisneyPlusProviderIdSchema,
    providerEpisodeIdentifier: DisneyPlusProviderIdSchema,
  }),
]);
export type DisneyPlusHistoryIdentity = z.infer<typeof DisneyPlusHistoryIdentitySchema>;

export function disneyPlusHistoryKeys(identity: DisneyPlusHistoryIdentity, seasonNumber?: number | null) {
  if (identity.kind === "movie") {
    const key = `disneyplus:movie:${identity.providerMovieId}`;
    return { itemKind: "movie" as const, titleKey: key, episodeKey: key, seasonKey: null };
  }
  return {
    itemKind: "series" as const,
    titleKey: `disneyplus:series:${identity.providerSeriesId}`,
    episodeKey: `disneyplus:episode:${identity.providerEpisodeIdentifier}`,
    seasonKey: seasonNumber == null ? null : `disneyplus:season:${disneyPlusSeasonIdentifier(identity.providerSeriesId, seasonNumber)}`,
  };
}
