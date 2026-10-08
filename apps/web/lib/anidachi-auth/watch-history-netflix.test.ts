import assert from "node:assert/strict";
import test from "node:test";
import { buildWatchHistoryV3Response, parseWatchProgressEventV3 } from "./watch-history-v3";
import { applyPersonalWatchProgress } from "./personal-watch-history";
const owner = "11111111-1111-4111-8111-111111111111", eventId = "22222222-2222-4222-8222-222222222222";
const now = "2026-10-08T00:00:00.000Z";
function event(movie = false) {
  const id = movie ? "81078819" : "70196259";
  return { schemaVersion: 3, clientEventId: eventId, clientSessionKey: "netflix-session", accountGeneration: 1, provider: "netflix",
    titleKey: movie ? `netflix:movie:${id}` : "netflix:series:70143836", episodeKey: `netflix:${movie ? "movie" : "episode"}:${id}`,
    itemKind: movie ? "movie" : "series", title: movie ? "El Camino" : "Breaking Bad", episodeTitle: "Title",
    seasonKey: movie ? null : "netflix:season:70114191", seasonTitle: movie ? null : "Season 2", seasonNumber: movie ? null : 2, episodeNumber: movie ? null : 1,
    artworkUrl: "https://occ-0-123.nflxso.net/poster.jpg", sourceUrl: `https://www.netflix.com/watch/${id}`, currentTime: 300, duration: 1800, progress: 1/6, observedAt: now, kind: "pause",
    netflixIdentity: movie ? { kind: "movie", providerMovieId: id } : { kind: "episode", providerSeriesId: "70143836", providerSeasonIdentifier: "70114191", providerEpisodeIdentifier: id } };
}
test("server accepts Netflix movie and episode events and builds canonical personal history", () => {
  for (const movie of [false, true]) {
    const e = parseWatchProgressEventV3(event(movie));
    const row = { user_id: owner, provider: e.provider, title_key: e.titleKey, episode_key: e.episodeKey, item_kind: e.itemKind, title: e.title, artwork_url: e.artworkUrl,
      episode_title: e.episodeTitle, season_key: e.seasonKey, season_title: e.seasonTitle, season_number: e.seasonNumber, episode_number: e.episodeNumber,
      source_url: e.sourceUrl, current_time_seconds: e.currentTime, duration: e.duration, progress: e.progress, completed_at: null, latest_session_id: null, observed_at: now, server_order: 1, history_generation: 1 };
    const result = buildWatchHistoryV3Response({ userId: owner, accountGeneration: 1, progressRows: [row], sessions: [], limit: 20, generatedAt: new Date(now) });
    assert.equal(result.items[0]!.provider, "netflix"); assert.equal(result.items[0]!.sourceUrl, e.sourceUrl);
    assert.equal(result.items[0]!.itemKind, e.itemKind);
    assert.equal(result.items[0]!.seasons.length, movie ? 0 : 1);
  }
});
test("both personal and legacy parsers reject untrusted Netflix artwork before persistence", async () => {
  for (const artworkUrl of ["https://127.0.0.1/a", "https://occ-0.nflxso.net.evil.test/a", "https://user@occ-0.nflxso.net/a"]) {
    const e = { ...event(), artworkUrl };
    assert.throws(() => parseWatchProgressEventV3(e), { code: "INVALID_REQUEST" });
    await assert.rejects(applyPersonalWatchProgress({ userId: owner, input: { captureVersion: 1, accessEpoch: 1, youtubeConsentEpoch: 0, clientSequence: 1, event: e },
      store: { apply: async () => { throw Error("must not persist"); } } }), { code: "INVALID_REQUEST" });
  }
});
