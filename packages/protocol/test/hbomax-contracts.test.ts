import { describe, expect, it } from "vitest";
import { historyReadReferencesMatchProvider } from "../src/history-provider-validation";
import {
  hboMaxArtworkUrl, isHboMaxArtworkUrl, canonicalizeRoomSourceUrl, hboMaxDetail, hboMaxPlaybackId, hboMaxSourceUrl,
  hboMaxFingerprint, hboMaxHistoryKeys, RoomSourceDescriptorSchema, WatchSourceDescriptorSchema,
  WatchProgressEventSchema, WatchCatalogSnapshotInputSchema, HBO_MAX_BROWSER_HOSTS, isHboMaxOrigin,
  hboMaxCatalogPath, localizeHboMaxUrl,
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
  it("uses the video UUID on both native watch route formats, across regional addresses", () => {
    // HBO's public Big Little Lies S1E2 summary has the same episode UUID as the first
    // segment of the historical two-ID player link for Serious Mothering.
    const episode = "bf44a7dc-e340-4207-ae67-3736179c47c6";
    const edit = "8f3a759a-7464-438c-956d-a2e65bf3184f";
    for (const host of HBO_MAX_BROWSER_HOSTS) {
      expect(isHboMaxOrigin(`https://${host}`)).toBe(true);
      for (const prefix of ["", "/br/pt", "/gb/en", "/es", "/zh-Hant"]) {
        const link = `https://${host}${prefix}/video/watch/${episode}/${edit}/?source=external#player`;
        const canonical = canonicalizeRoomSourceUrl(link, "hbomax");
        expect(hboMaxPlaybackId(link)).toBe(episode);
        expect(canonical).toEqual(canonicalizeRoomSourceUrl(hboMaxSourceUrl(episode)));
        expect(hboMaxCatalogPath(link)).toBe(false);
        expect(RoomSourceDescriptorSchema.safeParse({ ...descriptor, sourceUrl: link }).success).toBe(false);
      }
    }
    expect(hboMaxPlaybackId(`https://play.max.com/video/watch/${play}/${edit}`)).toBe(play);
  });
  it("keeps local catalog listings, title pages and episode summaries distinct from playback", () => {
    const title = `https://www.hbomax.com/es/es/show/${series}`;
    const summary = `${title}/s1/e2-peque%C3%B1as-mentiras/${play}`;
    const season = "https://www.hbomax.com/br/pt/show/4f6b4985-2dc9-4ab6-ac79-d60f0860b0ac/s5";
    const legacyMovie = `https://max.com/br/pt/movies/comemora%C3%A7%C3%A3o-20-anos/${series}`;
    expect(hboMaxDetail(title)).toEqual({ kind: "series", id: series });
    expect(hboMaxDetail(legacyMovie)).toEqual({ kind: "movie", id: series });
    expect(hboMaxDetail(season)).toEqual({ kind: "series", id: "4f6b4985-2dc9-4ab6-ac79-d60f0860b0ac" });
    expect(hboMaxDetail(summary)).toBeNull();
    for (const candidate of [title, summary, season, legacyMovie, `https://www.max.com/pl/pl/shows/gra-o-tron/${series}`,
      "https://www.hbomax.com/br/pt", "https://www.hbomax.com/br/pt/channel/harry-potter",
      "https://www.hbomax.com/tw/zh/collections/genre/action", "https://play.hbomax.com/search?q=test"]) {
      expect(hboMaxCatalogPath(candidate)).toBe(true);
      expect(hboMaxPlaybackId(candidate)).toBeNull();
      expect(canonicalizeRoomSourceUrl(candidate, "hbomax").ok).toBe(false);
    }
  });
  it("keeps recognized browser hosts out of generic descriptors and foreign-provider history", () => {
    for (const host of HBO_MAX_BROWSER_HOSTS) {
      const sourceUrl = `https://${host}/br/pt/video/watch/${play}`;
      const generic = { provider: "generic", sourceUrl, canonicalUrl: sourceUrl, videoFingerprint: "generic|selected", title: "Title" };
      expect(WatchSourceDescriptorSchema.safeParse(generic).success).toBe(false);
      expect(historyReadReferencesMatchProvider("youtube", ["legacy"], [sourceUrl])).toBe(false);
      expect(WatchProgressEventSchema.safeParse({ ...event, sourceUrl }).success).toBe(false);
    }
  });
  it("rejects ambiguous URLs and out-of-scope authorities before the browser can normalize them", () => {
    for (const origin of ["https://profiles.hbomax.com", "https://help.max.com", "https://play.max.com.example.org",
      "https://play.max.com:443", "https://user@www.hbomax.com", "http://play.max.com", "https://max.com."]) {
      expect(isHboMaxOrigin(origin)).toBe(false);
      for (const path of [`/es/es/video/watch/${play}`, `/es/es/show/${series}`]) {
        expect(hboMaxCatalogPath(origin + path)).toBe(false);
        expect(hboMaxPlaybackId(origin + path)).toBeNull();
        expect(hboMaxDetail(origin + path)).toBeNull();
        expect(canonicalizeRoomSourceUrl(origin + path).ok).toBe(false);
      }
    }
    for (const path of [`/browse/../video/watch/${play}`, `/fr//video/watch/${play}`,
      `/video/watch/${play}/%2e%2e/${series}`, `/video/watch/${play}/extra`, `/video/watch/${series}/${play}/${series}`,
      `/video/watch/%34${play.slice(1)}`, `/es/es/videos/watch/${play}`, `/show/${play}/${series}`,
      `/show/a%2Fb/${series}`, `/es/es/show/%EF/${series}`, "/br/pt/account", "/es/es/signup"]) {
      const link = "https://www.hbomax.com" + path;
      expect(hboMaxPlaybackId(link)).toBeNull();
      expect(hboMaxDetail(link)).toBeNull();
      expect(hboMaxCatalogPath(link)).toBe(false);
      expect(canonicalizeRoomSourceUrl(link, "hbomax").ok).toBe(false);
    }
  });
  it("uses the viewer's native origin and only prefixes a player link after observing a prefixed player", () => {
    const localOrigin = "https://play.hbomax.com";
    const catalog = localOrigin + "/br/pt/search?q=filme";
    const localPlayer = `${localOrigin}/br/pt/video/watch/${series}`;
    expect(localizeHboMaxUrl(url, catalog)).toBe(`${localOrigin}/video/watch/${play}`);
    expect(localizeHboMaxUrl(url, localPlayer)).toBe(`${localOrigin}/br/pt/video/watch/${play}`);
    expect(localizeHboMaxUrl(`https://www.hbomax.com/movie/${series}`, localPlayer)).toBe(`${localOrigin}/br/pt/movie/${series}`);
    expect(localizeHboMaxUrl("https://www.hbomax.com/home", localPlayer)).toBe(localOrigin + "/br/pt/home");
    for (const current of ["https://other.example/br/pt", "https://www.hbomax.com:443/br/pt/home", localOrigin + "/br/pt/login"]) {
      expect(localizeHboMaxUrl(url, current)).toBe(url);
    }
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
