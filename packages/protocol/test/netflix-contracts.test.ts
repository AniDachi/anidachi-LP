import { describe, expect, it } from "vitest";
import {
  canonicalizeRoomSourceUrl, NetflixHistoryIdentitySchema, RoomSourceDescriptorSchema,
  WatchSourceDescriptorSchema, WatchProgressEventSchema, PersonalWatchProgressRequestSchema,
  WatchCatalogSnapshotInputSchema, WatchCatalogBeginRequestSchema,
  WatchCatalogCommitRequestSchema, WatchCatalogBeginAckSchema, WatchCatalogCommitAckSchema,
  WatchHistoryCapacitySchema, WatchHistoryCapacityV1Schema, WatchHistoryCapacityV2Schema,
  WatchHistoryCapacityCompatibleSchema, WatchHistoryGridQuerySchema, WatchHistoryGridResponseSchema,
  WatchHistoryEditorQuerySchema, WatchHistoryEditorResponseSchema, WatchHistoryEditRequestSchema,
  WatchHistoryBrowseQuerySchema, WatchHistoryBrowseTitleEpisodesQuerySchema, WatchHistoryBrowseSessionsQuerySchema,
  buildPersonalHistoryResumeUrl, parsePersonalHistoryResumeUrl, isWatchHistoryAccessCurrent,
  WatchHistoryAccessSchema, WatchHistoryItemSchema, WatchHistoryTitleEpisodesResponseSchema,
} from "../src";

const NOW = "2026-10-08T00:00:00.000Z";
const ID = "11111111-1111-4111-8111-111111111111";
const meta = { schemaVersion: 3, ownerUserId: ID, accountGeneration: 4, serverTime: NOW };
const sourceUrl = "https://www.netflix.com/watch/70196259";
const episodeKey = "netflix:episode:70196259";
const seasonKey = "netflix:season:70114191";
const titleKey = "netflix:series:70143836";
const identity = { kind: "episode", providerSeriesId: "70143836", providerSeasonIdentifier: "70114191", providerEpisodeIdentifier: "70196259" };
function progress() {
  return { schemaVersion: 3, clientEventId: ID, clientSessionKey: "tab:source:1", accountGeneration: 4,
    provider: "netflix", titleKey, itemKind: "series", title: "Breaking Bad", artworkUrl: null,
    episodeKey, episodeTitle: "Seven Thirty-Seven", seasonKey, seasonTitle: "Season 2", seasonNumber: 2, episodeNumber: 1,
    sourceUrl, currentTime: 600, duration: 1200, progress: .5, observedAt: NOW, kind: "pause", sharedRoom: null,
    netflixIdentity: identity };
}
function catalog() {
  return { schemaVersion: 3, provider: "netflix", titleKey, providerSeriesId: "70143836", title: "Breaking Bad",
    completeness: "complete", context: { region: "VN", requestedLocale: "uk-HU", audioLocale: null, subtitleLocales: [], observedAt: NOW },
    seasons: [{ seasonKey, providerSeasonIdentifier: "70114191", title: "Season 2", seasonNumber: 2, order: 1,
      episodes: [{ episodeKey, providerEpisodeIdentifier: "70196259", title: "Seven Thirty-Seven", episodeNumber: 1, order: 0,
        releasedAt: null, available: true, watchVariants: [{ providerContentId: "70196259", audioLocale: null, original: true, order: 0, sourceUrl }] }] }] };
}
function begin() {
  const c = catalog();
  return { schemaVersion: 3, accountGeneration: 4, provider: c.provider, titleKey: c.titleKey,
    providerSeriesId: c.providerSeriesId, context: c.context, historyAccess: { accessVersion: 1, accessEpoch: 2 } };
}
const aggregate = { completedEpisodes: 0, availableEpisodes: 1, progress: 0 };
function grid() {
  return { meta, provider: "netflix", titleKey, state: "complete", revision: "accepted", seasonKey,
    seasons: [{ seasonKey, seasonTitle: "Season 2", seasonNumber: 2, order: 1, aggregate, nextEpisode: null, kind: "season" }],
    mainAggregate: aggregate, specialsAggregate: null, episodes: [{ episodeKey, episodeTitle: "Seven Thirty-Seven", episodeNumber: 1,
      seasonKey, order: 0, releasedAt: null, available: true, sourceUrl, history: null }], nextCursor: null };
}
function editor() {
  return { meta, provider: "netflix", titleKey, revision: "a".repeat(32), catalogComplete: true,
    episodes: [{ episodeKey, episodeTitle: "Seven Thirty-Seven", episodeNumber: 1, seasonKey, seasonTitle: "Season 2", seasonNumber: 2,
      seasonOrder: 1, order: 0, sourceUrl, available: true, watched: false, currentTime: 600, duration: 1200, progress: .5 }] };
}

describe("Netflix source contracts", () => {
  it("canonicalizes watch links and strips tracking while pinning numeric player identity", () => {
    const parsed = canonicalizeRoomSourceUrl(`${sourceUrl}/?trackId=123#player`, "netflix");
    expect(parsed).toEqual({ ok: true, source: { provider: "netflix", sourceUrl, canonicalUrl: sourceUrl, videoFingerprint: "netflix|watch/70196259" } });
    if (!parsed.ok) throw Error("missing source");
    expect(RoomSourceDescriptorSchema.safeParse(parsed.source).success).toBe(true);
    expect(WatchSourceDescriptorSchema.safeParse({ ...parsed.source, title: "Episode" }).success).toBe(true);
    for (const patch of [{ sourceUrl: `${sourceUrl}?trackId=1` }, { canonicalUrl: `${sourceUrl}/` }, { videoFingerprint: "netflix|watch/81078819" }, { provider: "youtube" }]) {
      expect(RoomSourceDescriptorSchema.safeParse({ ...parsed.source, ...patch }).success).toBe(false);
      expect(WatchSourceDescriptorSchema.safeParse({ ...parsed.source, title: "Episode", ...patch }).success).toBe(false);
    }
    expect(canonicalizeRoomSourceUrl(sourceUrl, "crunchyroll").ok).toBe(false);
  });
  it.each([
    "http://www.netflix.com/watch/70196259", "https://user:pass@www.netflix.com/watch/70196259",
    "https://www.netflix.com.evil.test/watch/70196259", "https://netflix.com/watch/70196259",
    "https://api.netflix.com/watch/70196259", "https://www.netflix.com:444/watch/70196259",
    "https://www.netflix.com/browse/70196259", "https://www.netflix.com/watch/episode",
    "https://www.netflix.com/watch/0", "https://www.netflix.com/watch/070196259",
    "https://www.netflix.com/watch/70196259/extra", "https://www.netflix.com/watch/%37%30%31%39%36%32%35%39",
    "https://www.netflix.com/watch/70196259\\extra", " https://www.netflix.com/watch/70196259",
    "https://www.netflix.com/watch/123456789012345678901",
  ])("rejects unsupported or hostile URL %s", url => expect(canonicalizeRoomSourceUrl(url).ok).toBe(false));
});

describe("Netflix progress identity", () => {
  it("accepts numeric episode identity and rejects ID/keys/source/provider drift", () => {
    expect(WatchProgressEventSchema.parse(progress()).netflixIdentity).toEqual(identity);
    const { sharedRoom: _room, ...personalEvent } = progress();
    const request = { captureVersion: 1, accessEpoch: 2, youtubeConsentEpoch: 0, clientSequence: 1, event: personalEvent };
    expect(PersonalWatchProgressRequestSchema.safeParse(request).success).toBe(true);
    expect(PersonalWatchProgressRequestSchema.safeParse({ ...request, event: { ...personalEvent, sourceUrl: "https://www.netflix.com/watch/70196260" } }).success).toBe(false);
    for (const patch of [
      { titleKey: "netflix:series:9" }, { seasonKey: "netflix:season:9" }, { episodeKey: "netflix:episode:9" },
      { sourceUrl: "https://www.netflix.com/watch/81078819" }, { itemKind: "movie" },
      { youtubeVideoId: "abcdefghijk" }, { crunchyrollIdentity: { providerSeriesId: "S", providerSeasonIdentifier: "S1", providerEpisodeIdentifier: "E", providerContentId: "E", audioLocale: null } },
      { netflixIdentity: undefined }, { netflixIdentity: { ...identity, providerSeriesId: "Breaking Bad" } },
      { netflixIdentity: { ...identity, providerEpisodeIdentifier: "070196259" } },
      { sourceUrl: `${sourceUrl}?tracking=1` }, { provider: "amazon" },
    ]) expect(WatchProgressEventSchema.safeParse({ ...progress(), ...patch }).success).toBe(false);
  });
  it("keeps movies independent from series and forbids invented seasons", () => {
    const movie = { ...progress(), itemKind: "movie", titleKey: "netflix:movie:81078819", episodeKey: "netflix:movie:81078819",
      sourceUrl: "https://www.netflix.com/watch/81078819", seasonKey: null, seasonTitle: null, seasonNumber: null, episodeNumber: null,
      netflixIdentity: { kind: "movie", providerMovieId: "81078819" } };
    expect(WatchProgressEventSchema.safeParse(movie).success).toBe(true);
    for (const patch of [{ seasonKey }, { seasonTitle: "Season 1" }, { seasonNumber: 1 }, { episodeNumber: 1 },
      { titleKey }, { episodeKey: "netflix:episode:81078819" }, { sourceUrl: "https://www.netflix.com/watch/81169895" }, { itemKind: "series" }])
      expect(WatchProgressEventSchema.safeParse({ ...movie, ...patch }).success).toBe(false);
    expect(NetflixHistoryIdentitySchema.safeParse({ kind: "movie", providerMovieId: "81078819", providerSeasonIdentifier: "1" }).success).toBe(false);
  });
});

describe("Netflix catalogs and immutable attempts", () => {
  it("accepts bounded series catalogs only with honest availability context", () => {
    expect(WatchCatalogSnapshotInputSchema.safeParse(catalog()).success).toBe(true);
    const c = catalog();
    expect(WatchCatalogSnapshotInputSchema.safeParse({ ...c, context: { ...c.context, region: null } }).success).toBe(false);
    expect(WatchCatalogSnapshotInputSchema.safeParse({ ...c, completeness: "partial", context: { ...c.context, region: null } }).success).toBe(true);
    expect(WatchCatalogSnapshotInputSchema.safeParse({ ...c, seasons: [] }).success).toBe(false);
    expect(WatchCatalogSnapshotInputSchema.safeParse({ ...c, providerSeriesId: "S", titleKey: "netflix:series:S" }).success).toBe(false);
  });
  it("rejects foreign keys, raw IDs, URLs and multiple or mismatched Netflix variants", () => {
    for (const mutate of [
      (c: ReturnType<typeof catalog>) => { c.seasons[0]!.seasonKey = "crunchyroll:season:70114191"; },
      (c: ReturnType<typeof catalog>) => { c.seasons[0]!.episodes[0]!.episodeKey = "crunchyroll:episode:70196259"; },
      (c: ReturnType<typeof catalog>) => { c.seasons[0]!.providerSeasonIdentifier = "Season 2"; },
      (c: ReturnType<typeof catalog>) => { c.seasons[0]!.episodes[0]!.watchVariants[0]!.sourceUrl = "https://www.crunchyroll.com/watch/70196259"; },
      (c: ReturnType<typeof catalog>) => { c.seasons[0]!.episodes[0]!.watchVariants[0]!.providerContentId = "70196260"; c.seasons[0]!.episodes[0]!.watchVariants[0]!.sourceUrl = "https://www.netflix.com/watch/70196260"; },
      (c: ReturnType<typeof catalog>) => { c.seasons[0]!.episodes[0]!.watchVariants.push({ ...c.seasons[0]!.episodes[0]!.watchVariants[0]!, original: false, providerContentId: "70196260", sourceUrl: "https://www.netflix.com/watch/70196260" }); },
      (c: ReturnType<typeof catalog>) => { c.provider = "crunchyroll"; c.titleKey = "crunchyroll:series:70143836"; },
    ]) { const c = catalog(); mutate(c); expect(WatchCatalogSnapshotInputSchema.safeParse(c).success).toBe(false); }
  });
  it("binds begin/commit/ack to provider, series, generation and exact context", () => {
    const request = { ...begin(), revision: 1, snapshot: catalog() };
    expect(WatchCatalogBeginRequestSchema.safeParse(begin()).success).toBe(true);
    expect(WatchCatalogCommitRequestSchema.safeParse(request).success).toBe(true);
    for (const patch of [{ provider: "crunchyroll" }, { accountGeneration: 0 }, { revision: 0 },
      { context: { ...request.context, observedAt: "2026-10-07T00:00:00.000Z" } },
      { context: { ...request.context, region: "US" } }, { providerSeriesId: "9", titleKey: "netflix:series:9" }])
      expect(WatchCatalogCommitRequestSchema.safeParse({ ...request, ...patch }).success).toBe(false);
    const ack = { meta, schemaVersion: 3, provider: "netflix", titleKey, accountGeneration: 4, revision: 1,
      effectiveCatalogState: "complete", projectionRevision: 1, acceptedHash: "a".repeat(32), acceptedAt: NOW };
    for (const [schema, value] of [[WatchCatalogBeginAckSchema, { ...ack, refreshRequired: false, availabilityChanged: false }],
      [WatchCatalogCommitAckSchema, { ...ack, outcome: "applied" }]] as const) {
      expect(schema.safeParse(value).success).toBe(true);
      expect(schema.safeParse({ ...value, titleKey: "crunchyroll:series:S" }).success).toBe(false);
      expect(schema.safeParse({ ...value, accountGeneration: 3 }).success).toBe(false);
    }
  });
});

describe("Netflix grid and editor", () => {
  it("binds nested sources to provider while preserving partial-grid restrictions", () => {
    expect(WatchHistoryGridQuerySchema.safeParse({ provider: "netflix", titleKey, seasonKey }).success).toBe(true);
    expect(WatchHistoryGridResponseSchema.safeParse(grid()).success).toBe(true);
    for (const mutate of [
      (g: ReturnType<typeof grid>) => { g.provider = "crunchyroll"; },
      (g: ReturnType<typeof grid>) => { g.seasons[0]!.seasonKey = "crunchyroll:season:S"; },
      (g: ReturnType<typeof grid>) => { g.episodes[0]!.sourceUrl = "https://www.crunchyroll.com/watch/70196259"; },
      (g: ReturnType<typeof grid>) => { g.episodes[0]!.sourceUrl = "https://www.netflix.com/watch/70196260"; },
      (g: ReturnType<typeof grid>) => { g.state = "partial"; },
    ]) { const g = grid(); mutate(g); expect(WatchHistoryGridResponseSchema.safeParse(g).success).toBe(false); }
    expect(WatchHistoryGridQuerySchema.safeParse({ provider: "netflix", titleKey: "crunchyroll:series:S" }).success).toBe(false);
    expect(WatchHistoryGridQuerySchema.safeParse({ provider: "netflix", titleKey, seasonKey: "crunchyroll:season:S" }).success).toBe(false);
  });
  it("supports episode and movie editing and rejects cross-provider sources/keys", () => {
    expect(WatchHistoryEditorQuerySchema.safeParse({ provider: "netflix", titleKey, accountGeneration: 4 }).success).toBe(true);
    expect(WatchHistoryEditorResponseSchema.safeParse(editor()).success).toBe(true);
    const edit = { provider: "netflix", titleKey, accountGeneration: 4, clientMutationId: ID, revision: "a".repeat(32), changes: [{ episodeKey, watched: true }] };
    expect(WatchHistoryEditRequestSchema.safeParse(edit).success).toBe(true);
    expect(WatchHistoryEditRequestSchema.safeParse({ ...edit, changes: [{ episodeKey: "crunchyroll:episode:E", watched: true }] }).success).toBe(false);
    for (const mutate of [
      (e: ReturnType<typeof editor>) => { e.provider = "youtube"; },
      (e: ReturnType<typeof editor>) => { e.episodes[0]!.sourceUrl = "https://user:pass@www.netflix.com/watch/70196259"; },
      (e: ReturnType<typeof editor>) => { e.episodes[0]!.sourceUrl = "https://www.netflix.com/watch/70196260"; },
      (e: ReturnType<typeof editor>) => { e.episodes[0]!.seasonKey = "crunchyroll:season:S"; },
    ]) { const e = editor(); mutate(e); expect(WatchHistoryEditorResponseSchema.safeParse(e).success).toBe(false); }
    const movie = { ...editor(), titleKey: "netflix:movie:81078819", episodes: [{ ...editor().episodes[0], episodeKey: "netflix:movie:81078819",
      seasonKey: null, seasonTitle: null, seasonNumber: null, episodeNumber: null, sourceUrl: "https://www.netflix.com/watch/81078819" }] };
    expect(WatchHistoryEditorResponseSchema.safeParse(movie).success).toBe(true);
    expect(WatchHistoryEditorResponseSchema.safeParse({ ...movie, titleKey }).success).toBe(false);
  });
});

it("preserves exact legacy v1 capacity while explicitly validating v2 Netflix counts and limits", () => {
  const v1 = { capacityVersion: 1, ownerUserId: ID, accountGeneration: 4, serverTime: NOW,
    providers: { youtube: { used: 101, limit: 100 }, crunchyroll: { used: 250, limit: 200 } } };
  const v2 = { ...v1, capacityVersion: 2, providers: { ...v1.providers, netflix: { used: 201, limit: 200 } } };
  expect(WatchHistoryCapacitySchema).toBe(WatchHistoryCapacityV1Schema);
  expect(WatchHistoryCapacityV1Schema.parse(v1)).toEqual(v1);
  expect(WatchHistoryCapacityV2Schema.parse(v2)).toEqual(v2);
  expect(WatchHistoryCapacityCompatibleSchema.parse(v1)).toEqual(v1);
  expect(WatchHistoryCapacityCompatibleSchema.parse(v2)).toEqual(v2);
  expect(WatchHistoryCapacitySchema.safeParse(v2).success).toBe(false);
  expect(WatchHistoryCapacityV1Schema.safeParse({ ...v2, capacityVersion: 1 }).success).toBe(false);
  expect(WatchHistoryCapacityV2Schema.safeParse({ ...v1, capacityVersion: 2 }).success).toBe(false);
  for (const netflix of [{ used: -1, limit: 200 }, { used: .5, limit: 200 }, { used: 0, limit: 100 }, { used: 0, limit: 200, full: false }])
    expect(WatchHistoryCapacityV2Schema.safeParse({ ...v2, providers: { ...v2.providers, netflix } }).success).toBe(false);
  expect(WatchHistoryCapacityV2Schema.safeParse({ ...v2, providers: { ...v2.providers, amazon: { used: 0, limit: 200 } } }).success).toBe(false);
});

it("accepts Netflix browse filters without changing social/filter restrictions", () => {
  expect(WatchHistoryBrowseQuerySchema.parse({ mode: "personal", provider: "netflix" }).limit).toBe(20);
  expect(WatchHistoryBrowseTitleEpisodesQuerySchema.safeParse({ mode: "personal", provider: "netflix", titleKey }).success).toBe(true);
  expect(WatchHistoryBrowseSessionsQuerySchema.safeParse({ mode: "personal", provider: "netflix", titleKey, episodeKey }).success).toBe(true);
  expect(WatchHistoryBrowseQuerySchema.safeParse({ mode: "personal", provider: "netflix", groupId: ID }).success).toBe(false);
});
it("binds Netflix Resume to one movie/episode and the existing bounded owner lifetime", async () => {
  for (const id of ["70196259", "81078819"]) {
    const url = await buildPersonalHistoryResumeUrl({ ownerUserId: ID, accountGeneration: 4, provider: "netflix",
      sourceUrl: `https://www.netflix.com/watch/${id}`, currentTime: 600, now: 1000, intentId: ID });
    expect(parsePersonalHistoryResumeUrl(url, 1000)).toMatchObject({ provider: "netflix", sourceUrl: `https://www.netflix.com/watch/${id}`, currentTime: 600 });
    expect(parsePersonalHistoryResumeUrl(url.replace(`/watch/${id}#`, "/watch/9#"), 1000)).toBeNull();
    expect(parsePersonalHistoryResumeUrl(url, 301000)).toBeNull();
  }
});

it("keeps Netflix capture bound to paid access, owner epochs and lease expiry", () => {
  const access = WatchHistoryAccessSchema.parse({ accessVersion: 1, ownerUserId: ID, accountGeneration: 4,
    accessEpoch: 2, youtubeConsentEpoch: 0, state: "allowed", serverTime: NOW, captureNotBefore: NOW,
    validUntil: "2026-10-08T00:05:00.000Z", youtubeHistoryEnabled: false });
  const context = { ownerUserId: ID, accountGeneration: 4, accessEpoch: 2, youtubeConsentEpoch: 0, now: Date.parse(NOW), provider: "netflix" as const };
  expect(isWatchHistoryAccessCurrent(access, context)).toBe(true);
  expect(isWatchHistoryAccessCurrent({ ...access, state: "plan_required" }, context)).toBe(false);
  for (const patch of [{ ownerUserId: "other" }, { accessEpoch: 3 }, { accountGeneration: 5 }, { youtubeConsentEpoch: 1 }, { now: Date.parse(access.validUntil) }])
    expect(isWatchHistoryAccessCurrent(access, { ...context, ...patch })).toBe(false);
});
it("validates Netflix title/episode page sources and nested projection identities", () => {
  const { seasonOrder: _seasonOrder, order: _order, available: _available, watched: _watched, ...observed } = editor().episodes[0]!;
  const episode = { ...observed, completedAt: null, lastWatchedAt: NOW, sessions: [] };
  const page = { meta, generatedAt: NOW, provider: "netflix", titleKey, observedEpisodeCount: 1, completedEpisodeCount: 0,
    episodes: [episode], catalog: { state: "unavailable", title: null, aggregate: null, seasons: [] }, complete: true, nextCursor: null };
  expect(WatchHistoryTitleEpisodesResponseSchema.safeParse(page).success).toBe(true);
  expect(WatchHistoryTitleEpisodesResponseSchema.safeParse({ ...page, episodes: [{ ...episode, sourceUrl: "https://www.netflix.com/watch/70196260" }] }).success).toBe(false);
  const item = { provider: "netflix", titleKey, observedEpisodeCount: 1, completedEpisodeCount: 0,
    episodePage: { complete: true, nextCursor: null }, itemKind: "series", title: "Breaking Bad", sourceUrl,
    artworkUrl: null, catalogState: "partial", aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
    seasons: [{ seasonKey, seasonTitle: "Season 2", seasonNumber: 2, order: 1,
      aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null }, episodes: [episode], nextEpisode: null }],
    sessions: [], latestActivity: { episodeKey, currentTime: 600, duration: 1200, progress: .5, completedAt: null, lastWatchedAt: NOW }, lastWatchedAt: NOW };
  expect(WatchHistoryItemSchema.safeParse(item).success).toBe(true);
  expect(WatchHistoryItemSchema.safeParse({ ...item, seasons: [{ ...item.seasons[0], episodes: [{ ...episode, seasonKey: "crunchyroll:season:S" }] }] }).success).toBe(false);
  const movie = { ...item, itemKind: "movie", titleKey: "netflix:movie:81078819", sourceUrl: "https://www.netflix.com/watch/81078819",
    seasons: [], latestActivity: { ...item.latestActivity, episodeKey: "netflix:movie:81078819" } };
  expect(WatchHistoryItemSchema.safeParse(movie).success).toBe(true);
  expect(WatchHistoryItemSchema.safeParse({ ...movie, seasons: item.seasons }).success).toBe(false);
});
it("retains valid legacy editor sources and rejects qualified foreign keys", () => {
  const legacy = { ...editor(), provider: "youtube", titleKey: "youtube:video:abcdefghijk", episodes: [{ ...editor().episodes[0],
    episodeKey: "youtube:video:abcdefghijk", seasonKey: null, sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk&t=30" }] };
  expect(WatchHistoryEditorResponseSchema.safeParse(legacy).success).toBe(true);
  expect(WatchHistoryEditorResponseSchema.safeParse({ ...legacy, episodes: [{ ...legacy.episodes[0], episodeKey: "netflix:movie:81078819" }] }).success).toBe(false);
});

describe("review regression: provider and standalone movie boundaries", () => {
  const observedEpisode = () => ({ episodeKey, episodeTitle: "Episode", episodeNumber: 1, seasonKey,
    seasonTitle: "Season 2", seasonNumber: 2, sourceUrl, currentTime: 600, duration: 1200, progress: .5,
    completedAt: null, lastWatchedAt: NOW, sessions: [] });
  const page = () => ({ meta, generatedAt: NOW, provider: "netflix", titleKey, observedEpisodeCount: 1,
    completedEpisodeCount: 0, episodes: [observedEpisode()], catalog: { state: "unavailable", title: null, aggregate: null, seasons: [] },
    complete: true, nextCursor: null });
  const item = () => ({ provider: "netflix", titleKey, itemKind: "series", title: "Series", sourceUrl, artworkUrl: null,
    catalogState: "partial", observedEpisodeCount: 1, completedEpisodeCount: 0, episodePage: { complete: true, nextCursor: null },
    aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null }, seasons: [{ seasonKey, seasonTitle: "Season 2", seasonNumber: 2, order: 1,
      aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null }, episodes: [observedEpisode()], nextEpisode: null }],
    sessions: [], latestActivity: { episodeKey, currentTime: 600, duration: 1200, progress: .5, completedAt: null, lastWatchedAt: NOW }, lastWatchedAt: NOW });
  it("recognizes malformed Netflix sources before canonicalization when provider is foreign", () => {
    const youtube = { provider: "youtube", title: "Video", sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      canonicalUrl: "https://www.youtube.com/watch?v=abcdefghijk", videoFingerprint: "youtube|abcdefghijk" };
    expect(WatchSourceDescriptorSchema.safeParse(youtube).success).toBe(true);
    for (const foreignUrl of ["https://user:pass@www.netflix.com/watch/70196259", "https://www.netflix.com:444/watch/70196259",
      "http://www.netflix.com/watch/70196259", "https://www.netflix.com/browse", "https://api.netflix.com/watch/70196259"]) {
      expect(WatchSourceDescriptorSchema.safeParse({ ...youtube, sourceUrl: foreignUrl }).success).toBe(false);
      expect(WatchSourceDescriptorSchema.safeParse({ ...youtube, canonicalUrl: foreignUrl }).success).toBe(false);
    }
  });
  it.each(["crunchyroll", "youtube"])("rejects trailing-dot Netflix host under declared %s without accepting it canonically", provider => {
    const foreignUrl = "https://www.netflix.com./watch/70196259";
    const legacyUrl = provider === "youtube" ? "https://www.youtube.com/watch?v=abcdefghijk" : "https://www.crunchyroll.com/watch/E1";
    const descriptor = { provider, title: "Video", sourceUrl: legacyUrl, canonicalUrl: legacyUrl,
      videoFingerprint: provider === "youtube" ? "youtube|abcdefghijk" : "crunchyroll|watch/E1" };
    expect(WatchSourceDescriptorSchema.safeParse(descriptor).success).toBe(true);
    expect(WatchSourceDescriptorSchema.safeParse({ ...descriptor, sourceUrl: foreignUrl }).success).toBe(false);
    expect(WatchSourceDescriptorSchema.safeParse({ ...descriptor, canonicalUrl: foreignUrl }).success).toBe(false);
    const legacyEpisode = { ...observedEpisode(), episodeKey: "E1", seasonKey: "S1", sourceUrl: legacyUrl };
    const legacyPage = { ...page(), provider, titleKey: "T1", episodes: [legacyEpisode] };
    expect(WatchHistoryTitleEpisodesResponseSchema.safeParse(legacyPage).success).toBe(true);
    expect(WatchHistoryTitleEpisodesResponseSchema.safeParse({ ...legacyPage,
      episodes: [{ ...legacyEpisode, sourceUrl: foreignUrl }] }).success).toBe(false);
    const legacyItem = { ...item(), provider, titleKey: "T1", sourceUrl: legacyUrl,
      seasons: [{ ...item().seasons[0], seasonKey: "S1", episodes: [legacyEpisode] }],
      latestActivity: { ...item().latestActivity, episodeKey: "E1" } };
    expect(WatchHistoryItemSchema.safeParse({ ...legacyItem, sourceUrl: foreignUrl }).success).toBe(false);
    expect(canonicalizeRoomSourceUrl(foreignUrl, "netflix").ok).toBe(false);
  });
  it("forbids Netflix movie episode metadata and series projections", () => {
    const movieKey = "netflix:movie:81078819";
    const movie = { ...page(), titleKey: movieKey, episodes: [{ ...observedEpisode(), episodeKey: movieKey,
      sourceUrl: "https://www.netflix.com/watch/81078819", seasonKey: null, seasonTitle: null, seasonNumber: null, episodeNumber: null }] };
    expect(WatchHistoryTitleEpisodesResponseSchema.safeParse(movie).success).toBe(true);
    for (const patch of [{ seasonTitle: "Season 1" }, { seasonNumber: 1 }, { episodeNumber: 1 }])
      expect(WatchHistoryTitleEpisodesResponseSchema.safeParse({ ...movie, episodes: [{ ...movie.episodes[0], ...patch }] }).success).toBe(false);
    const catalog = { state: "complete", title: "Series", aggregate,
      seasons: [{ seasonKey, seasonTitle: "Season 2", seasonNumber: 2, order: 1, aggregate, nextEpisode: null }] };
    expect(WatchHistoryTitleEpisodesResponseSchema.safeParse({ ...movie, catalog }).success).toBe(false);
    const nextEpisode = { episodeKey, episodeTitle: "Episode", seasonKey, seasonTitle: "Season 2", seasonNumber: 2,
      episodeNumber: 1, sourceUrl, releasedAt: null };
    expect(WatchHistoryTitleEpisodesResponseSchema.safeParse({ ...movie, catalog: { ...catalog,
      seasons: [{ ...catalog.seasons[0], nextEpisode }] } }).success).toBe(false);
  });
  it.each(["crunchyroll", "youtube"])("rejects Netflix read identities under declared %s while retaining bare legacy keys", provider => {
    expect(WatchHistoryItemSchema.safeParse({ ...item(), provider }).success).toBe(false);
    expect(WatchHistoryTitleEpisodesResponseSchema.safeParse({ ...page(), provider }).success).toBe(false);
    const legacyUrl = provider === "youtube" ? "https://www.youtube.com/watch?v=abcdefghijk" : "https://www.crunchyroll.com/watch/E1/legacy";
    const legacyEpisode = { ...observedEpisode(), episodeKey: "E1", seasonKey: "S1", sourceUrl: legacyUrl };
    const legacyPage = { ...page(), provider, titleKey: "T1", episodes: [legacyEpisode] };
    expect(WatchHistoryTitleEpisodesResponseSchema.safeParse(legacyPage).success).toBe(true);
    for (const episodePatch of [{ episodeKey }, { seasonKey }, { sourceUrl },
      { sourceUrl: "http://user:pass@www.netflix.com:444/watch/70196259" }])
      expect(WatchHistoryTitleEpisodesResponseSchema.safeParse({ ...legacyPage,
        episodes: [{ ...legacyEpisode, ...episodePatch }] }).success).toBe(false);
    const legacyItem = { ...item(), provider, titleKey: "T1", sourceUrl: legacyUrl,
      seasons: [{ ...item().seasons[0], seasonKey: "S1", episodes: [legacyEpisode] }],
      latestActivity: { ...item().latestActivity, episodeKey: "E1" } };
    expect(WatchHistoryItemSchema.safeParse(legacyItem).success).toBe(true);
    for (const patch of [{ titleKey }, { sourceUrl }, { latestActivity: { ...legacyItem.latestActivity, episodeKey } },
      { seasons: [{ ...legacyItem.seasons[0], seasonKey }] }, { seasons: [{ ...legacyItem.seasons[0], episodes: [observedEpisode()] }] }])
      expect(WatchHistoryItemSchema.safeParse({ ...legacyItem, ...patch }).success).toBe(false);
    const projection = { state: "complete", title: "Series", aggregate, seasons: [{ seasonKey: "S1", seasonTitle: "Season 1", seasonNumber: 1,
      order: 0, aggregate, nextEpisode: { episodeKey, episodeTitle: "Episode", seasonKey, seasonTitle: "Season 2", seasonNumber: 2, episodeNumber: 1, sourceUrl, releasedAt: null } }] };
    expect(WatchHistoryTitleEpisodesResponseSchema.safeParse({ ...legacyPage, catalog: projection }).success).toBe(false);
  });
});
