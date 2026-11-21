import { describe, expect, it } from "vitest";
import {
  hboMaxArtworkUrl, isHboMaxArtworkUrl, canonicalizeRoomSourceUrl, hboMaxDetail, hboMaxPlaybackId, hboMaxSourceUrl,
  hboMaxFingerprint, hboMaxHistoryKeys, RoomSourceDescriptorSchema, WatchSourceDescriptorSchema,
  WatchProgressEventSchema, WatchCatalogSnapshotInputSchema,
} from "../src";

const play = "4d269596-6871-4419-892a-ca2b801d447d";
const series = "b117b2fd-aed9-43d8-aa30-66f7f10d2cb2";
const url = hboMaxSourceUrl(play);
const descriptor = { provider: "hbomax", sourceUrl: url, canonicalUrl: url, videoFingerprint: hboMaxFingerprint(play) };
const identity = { kind: "episode" as const, providerSeriesId: series, providerEpisodeIdentifier: play };
const event = {
  schemaVersion: 3, provider: "hbomax", hbomaxIdentity: identity, ...hboMaxHistoryKeys(identity, 2),
  title: "Series", episodeTitle: "Episode", seasonNumber: 2, episodeNumber: 3, seasonTitle: "Season 2",
  sourceUrl: url, clientSessionKey: "hbomax", clientEventId: play, accountGeneration: 1,
  currentTime: 30, duration: 120, progress: 0.25, kind: "pause", artworkUrl: null, observedAt: "2026-11-21T00:00:00Z",
};

describe("HBO Max provider contract", () => {
  it("stores only the observed public artwork asset and discards resizing parameters", () => {
    const image = "https://images.cdn.prd.api.discomax.com/YJfqK/AZSMHD71Ag5vb-HrQ.jpeg";
    expect(hboMaxArtworkUrl(image + "?w=400&f=jpeg")).toBe(image);
    expect(isHboMaxArtworkUrl(image)).toBe(true);
    for (const value of [image + "?token=private", image + "#frag", image.replace("/YJfqK/", "/../")]) {
      expect(hboMaxArtworkUrl(value)).toBeNull();
    }
  });
  it("binds individual play addresses to one room fingerprint", () => {
    const localized = `https://www.hbomax.com/video/watch/${play.toUpperCase()}/?tracking=1#hash`;
    expect(canonicalizeRoomSourceUrl(localized, "hbomax")).toEqual({ ok: true, source: descriptor });
    expect(hboMaxPlaybackId(localized)).toBe(play);
    expect(RoomSourceDescriptorSchema.safeParse(descriptor).success).toBe(true);
    expect(WatchSourceDescriptorSchema.safeParse({ ...descriptor, title: "Episode", provider: "generic" }).success).toBe(false);
    expect(RoomSourceDescriptorSchema.safeParse({ ...descriptor, videoFingerprint: hboMaxFingerprint(series) }).success).toBe(false);
    const entity = `https://www.hbomax.com/show/${series}`;
    expect(hboMaxDetail(entity)).toEqual({kind: "series", id: series});
    for (const value of [entity, url.replace("www.hbomax.com", "www.hulu.com"), url.replace(".com/", ".com:443/"),
      url.replace("www.", "user@www."), url.replace("/video/watch/", "/browse/../video/watch/"), url.replace("/video/watch/", "/en-us/other/video/watch/"),
      url.replace("https:", "http:"), url.replace(play, "not-a-uuid")]) {
      expect(canonicalizeRoomSourceUrl(value).ok).toBe(false);
    }
  });
  it("binds optional live room identity to the exact movie or episode without adding it to persistence", () => {
    const source = { ...descriptor, title: "Title", hbomaxIdentity: identity };
    expect(WatchSourceDescriptorSchema.safeParse(source).success).toBe(true);
    expect(WatchSourceDescriptorSchema.safeParse({ ...source, hbomaxIdentity: { kind: "movie", providerMovieId: series, providerPlaybackId: play } }).success).toBe(true);
    for (const patch of [{ provider: "youtube" }, { sourceUrl: hboMaxSourceUrl(series) },
      { videoFingerprint: hboMaxFingerprint(series) }, { hbomaxIdentity: { ...identity, providerEpisodeIdentifier: series } }]) {
      expect(WatchSourceDescriptorSchema.safeParse({ ...source, ...patch }).success).toBe(false);
    }
    expect(RoomSourceDescriptorSchema.safeParse({ ...descriptor, hbomaxIdentity: identity }).success).toBe(false);
  });
  it("admits bound series, movie and unknown-season history, and rejects conflicting metadata", () => {
    expect(WatchProgressEventSchema.safeParse(event).success).toBe(true);
    expect(WatchProgressEventSchema.safeParse({ ...event, seasonNumber: null, seasonTitle: null, seasonKey: null }).success).toBe(true);
    const movie = { kind: "movie" as const, providerMovieId: series, providerPlaybackId: play };
    expect(WatchProgressEventSchema.safeParse({ ...event, ...hboMaxHistoryKeys(movie), hbomaxIdentity: movie,
      seasonNumber: null, episodeNumber: null, seasonTitle: null }).success).toBe(true);
    for (const patch of [{ sourceUrl: hboMaxSourceUrl(series) }, { seasonNumber: 1 }, { hbomaxIdentity: undefined },
      { youtubeVideoId: series }, { episodeKey: "hbomax:episode:" + series }, { artworkUrl: "https://www.hulu.com/poster.jpg" }]) {
      expect(WatchProgressEventSchema.safeParse({ ...event, ...patch }).success).toBe(false);
    }
  });
  it("binds every catalog variant and season to its observed episode and series", () => {
    const seasonId = series + ":2";
    const season = { seasonKey: event.seasonKey, providerSeasonIdentifier: seasonId, title: "Season 2", seasonNumber: 2, order: 0,
      episodes: [{ episodeKey: event.episodeKey, providerEpisodeIdentifier: play, title: "Episode", episodeNumber: 3, order: 0,
        releasedAt: null, available: true, watchVariants: [{ providerContentId: play, audioLocale: null, original: true, order: 0, sourceUrl: url }] }] };
    const snapshot = { schemaVersion: 3, provider: "hbomax", titleKey: event.titleKey, providerSeriesId: series, title: "Series",
      completeness: "partial", context: { region: null, requestedLocale: "pt-BR", audioLocale: null, subtitleLocales: [], observedAt: event.observedAt },
      seasons: [season] };
    expect(WatchCatalogSnapshotInputSchema.safeParse(snapshot).success).toBe(true);
    expect(WatchCatalogSnapshotInputSchema.safeParse({ ...snapshot, seasons: [{ ...season, seasonNumber: 1 }] }).success).toBe(false);
    expect(WatchCatalogSnapshotInputSchema.safeParse({ ...snapshot, completeness: "complete" }).success).toBe(false);
  });
});
