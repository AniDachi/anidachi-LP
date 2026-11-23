import { describe, expect, it } from "vitest";
import {
  canonicalizeRoomSourceUrl, disneyPlusEntityId, disneyPlusPlaybackId, disneyPlusSourceUrl,
  disneyPlusFingerprint, disneyPlusHistoryKeys, RoomSourceDescriptorSchema, WatchSourceDescriptorSchema,
  WatchProgressEventSchema, WatchCatalogSnapshotInputSchema,
} from "../src";

const play = "8e091093-986b-442d-ac01-b772d025af44";
const series = "ba195597-9083-40d9-b9ac-71eaa632b69d";
const url = disneyPlusSourceUrl(play);
const descriptor = { provider: "disneyplus", sourceUrl: url, canonicalUrl: url, videoFingerprint: disneyPlusFingerprint(play) };
const identity = { kind: "episode" as const, providerSeriesId: series, providerEpisodeIdentifier: play };
const event = {
  schemaVersion: 3, provider: "disneyplus", disneyplusIdentity: identity, ...disneyPlusHistoryKeys(identity, 2),
  title: "Series", episodeTitle: "Episode", seasonNumber: 2, episodeNumber: 3, seasonTitle: "Season 2",
  sourceUrl: url, clientSessionKey: "disney", clientEventId: play, accountGeneration: 1,
  currentTime: 30, duration: 120, progress: 0.25, kind: "pause", artworkUrl: null, observedAt: "2026-11-21T00:00:00Z",
};

describe("Disney+ provider contract", () => {
  it("binds localized individual play addresses to one room fingerprint", () => {
    const localized = `https://www.disneyplus.com/pt-br/play/${play.toUpperCase()}/?tracking=1#hash`;
    expect(canonicalizeRoomSourceUrl(localized, "disneyplus")).toEqual({ ok: true, source: descriptor });
    expect(disneyPlusPlaybackId(localized)).toBe(play);
    expect(RoomSourceDescriptorSchema.safeParse(descriptor).success).toBe(true);
    expect(WatchSourceDescriptorSchema.safeParse({ ...descriptor, title: "Episode", provider: "generic" }).success).toBe(false);
    expect(RoomSourceDescriptorSchema.safeParse({ ...descriptor, videoFingerprint: disneyPlusFingerprint(series) }).success).toBe(false);
    const entity = `https://www.disneyplus.com/es/browse/entity-${series}`;
    expect(disneyPlusEntityId(entity)).toBe(series);
    for (const value of [entity, url.replace("www.disneyplus.com", "www.hulu.com"), url.replace(".com/", ".com:443/"),
      url.replace("www.", "user@www."), url.replace("/play/", "/browse/../play/"), url.replace("/play/", "/en-us/other/play/"),
      url.replace("https:", "http:"), url.replace(play, "not-a-uuid")]) {
      expect(canonicalizeRoomSourceUrl(value).ok).toBe(false);
    }
  });
  it("binds optional live room identity to the exact movie or episode without adding it to persistence", () => {
    const source = { ...descriptor, title: "Title", disneyplusIdentity: identity };
    expect(WatchSourceDescriptorSchema.safeParse(source).success).toBe(true);
    expect(WatchSourceDescriptorSchema.safeParse({ ...source, disneyplusIdentity: { kind: "movie", providerMovieId: play } }).success).toBe(true);
    for (const patch of [{ provider: "youtube" }, { sourceUrl: disneyPlusSourceUrl(series) },
      { videoFingerprint: disneyPlusFingerprint(series) }, { disneyplusIdentity: { ...identity, providerEpisodeIdentifier: series } }]) {
      expect(WatchSourceDescriptorSchema.safeParse({ ...source, ...patch }).success).toBe(false);
    }
    expect(RoomSourceDescriptorSchema.safeParse({ ...descriptor, disneyplusIdentity: identity }).success).toBe(false);
  });
  it("admits bound series, movie and unknown-season history, and rejects conflicting metadata", () => {
    expect(WatchProgressEventSchema.safeParse(event).success).toBe(true);
    expect(WatchProgressEventSchema.safeParse({ ...event, seasonNumber: null, seasonTitle: null, seasonKey: null }).success).toBe(true);
    const movie = { kind: "movie" as const, providerMovieId: play };
    expect(WatchProgressEventSchema.safeParse({ ...event, ...disneyPlusHistoryKeys(movie), disneyplusIdentity: movie,
      seasonNumber: null, episodeNumber: null, seasonTitle: null }).success).toBe(true);
    for (const patch of [{ sourceUrl: disneyPlusSourceUrl(series) }, { seasonNumber: 1 }, { disneyplusIdentity: undefined },
      { youtubeVideoId: series }, { episodeKey: "disneyplus:episode:" + series }, { artworkUrl: "https://www.hulu.com/poster.jpg" }]) {
      expect(WatchProgressEventSchema.safeParse({ ...event, ...patch }).success).toBe(false);
    }
  });
  it("binds every catalog variant and season to its observed episode and series", () => {
    const seasonId = series + ":2";
    const season = { seasonKey: event.seasonKey, providerSeasonIdentifier: seasonId, title: "Season 2", seasonNumber: 2, order: 0,
      episodes: [{ episodeKey: event.episodeKey, providerEpisodeIdentifier: play, title: "Episode", episodeNumber: 3, order: 0,
        releasedAt: null, available: true, watchVariants: [{ providerContentId: play, audioLocale: null, original: true, order: 0, sourceUrl: url }] }] };
    const snapshot = { schemaVersion: 3, provider: "disneyplus", titleKey: event.titleKey, providerSeriesId: series, title: "Series",
      completeness: "partial", context: { region: null, requestedLocale: "pt-BR", audioLocale: null, subtitleLocales: [], observedAt: event.observedAt },
      seasons: [season] };
    expect(WatchCatalogSnapshotInputSchema.safeParse(snapshot).success).toBe(true);
    expect(WatchCatalogSnapshotInputSchema.safeParse({ ...snapshot, seasons: [{ ...season, seasonNumber: 1 }] }).success).toBe(false);
    expect(WatchCatalogSnapshotInputSchema.safeParse({ ...snapshot, completeness: "complete" }).success).toBe(false);
  });
});
