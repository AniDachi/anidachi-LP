import { describe, expect, it } from "vitest";
import {
  WATCH_HISTORY_SCHEMA_VERSION,
  WatchCatalogSnapshotInputSchema,
  WatchHistoryCursorSchema,
  WatchHistoryDeletionAckSchema,
  WatchHistoryDeletionRequestSchema,
  WatchHistoryPreferencesSchema,
  WatchHistoryPreferencesUpdateSchema,
  WatchHistoryResponseSchema,
  WatchLibraryResponseSchema,
  WatchProgressAckSchema,
  WatchProgressEventSchema,
} from "../src";

const NOW = "2026-08-13T12:00:00.000Z";
const EARLIER = "2026-08-13T11:00:00.000Z";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const HOST_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const MUTATION_ID = "44444444-4444-4444-8444-444444444444";
const SESSION_ID = "55555555-5555-4555-8555-555555555555";

function accountMeta() {
  return {
    serverTime: NOW,
    schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
    ownerUserId: USER_ID,
  };
}

function catalogEpisode(input: {
  episodeKey: string;
  order: number;
  episodeNumber: number;
  title?: string;
}) {
  return {
    episodeKey: input.episodeKey,
    providerEpisodeId: `provider-${input.episodeKey}`,
    variantKey: null,
    title: input.title ?? `Episode ${input.episodeNumber}`,
    episodeNumber: input.episodeNumber,
    order: input.order,
    sourceUrl: `https://www.crunchyroll.com/watch/${input.episodeKey}/demo`,
    releasedAt: EARLIER,
    available: true,
  };
}

function completeCatalog() {
  return {
    schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
    provider: "crunchyroll" as const,
    titleKey: "series-one",
    providerSeriesId: "GYQ4MW246",
    itemKind: "series" as const,
    title: "Series One",
    sourceUrl: "https://www.crunchyroll.com/series/GYQ4MW246/series-one",
    artworkUrl: "https://static.crunchyroll.com/poster.jpg",
    completeness: "complete" as const,
    localeContext: {
      locale: "en-US",
      audioLocale: "ja-JP",
      subtitleLocales: ["en-US"],
    },
    fetchedAt: NOW,
    lastAttemptAt: NOW,
    contentHash: "sha256:complete-catalog",
    seasons: [
      {
        seasonKey: "season-one",
        providerSeasonId: "season-provider-one",
        title: "Season 1",
        seasonNumber: 1,
        order: 0,
        episodes: [
          catalogEpisode({ episodeKey: "episode-one", episodeNumber: 1, order: 0 }),
          catalogEpisode({ episodeKey: "episode-two", episodeNumber: 2, order: 1 }),
        ],
      },
      {
        seasonKey: "season-two",
        providerSeasonId: "season-provider-two",
        title: "Season 2",
        seasonNumber: 2,
        order: 1,
        episodes: [
          catalogEpisode({ episodeKey: "episode-three", episodeNumber: 1, order: 0 }),
        ],
      },
    ],
  };
}

function progressEvent() {
  return {
    schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
    clientEventId: EVENT_ID,
    clientSessionKey: "tab-7:source-2",
    accountGeneration: 4,
    provider: "crunchyroll" as const,
    titleKey: "series-one",
    itemKind: "series" as const,
    title: "Series One",
    artworkUrl: "https://static.crunchyroll.com/poster.jpg",
    episodeKey: "episode-one",
    episodeTitle: "Episode 1",
    seasonKey: "season-one",
    seasonTitle: "Season 1",
    seasonNumber: 1,
    episodeNumber: 1,
    sourceUrl: "https://www.crunchyroll.com/watch/episode-one/demo",
    currentTime: 600,
    duration: 1_200,
    progress: 0.5,
    observedAt: NOW,
    kind: "heartbeat" as const,
    sharedRoom: null,
  };
}

function canonicalEpisodeState() {
  return {
    episodeKey: "episode-one",
    episodeTitle: "Episode 1",
    seasonKey: "season-one",
    seasonTitle: "Season 1",
    seasonNumber: 1,
    episodeNumber: 1,
    sourceUrl: "https://www.crunchyroll.com/watch/episode-one/demo",
    currentTime: 600,
    duration: 1_200,
    progress: 0.5,
    completedAt: null,
    lastWatchedAt: NOW,
    sessions: [],
  };
}

function v1Fixture() {
  return {
    meta: { serverTime: NOW, schemaVersion: 1 as const },
    generatedAt: NOW,
    limits: {
      planCode: "plus" as const,
      maxActiveTrackedTitles: 100,
      activeTrackedTitleCount: 1,
      historyRetentionDays: 90,
      retainedSince: EARLIER,
    },
    items: [
      {
        provider: "youtube" as const,
        itemKey: "abcdefghijk",
        itemKind: "movie" as const,
        itemTitle: "Demo",
        sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
        artworkUrl: null,
        active: true,
        lastWatchedAt: NOW,
        episodes: [],
      },
    ],
  };
}

describe("watch history v2 catalog contracts", () => {
  it("accepts a complete two-season catalog snapshot", () => {
    expect(WatchCatalogSnapshotInputSchema.parse(completeCatalog())).toEqual(
      completeCatalog(),
    );
  });

  it("accepts a partial catalog without claiming exact totals", () => {
    const catalog = completeCatalog();
    const firstSeason = catalog.seasons[0];
    const firstEpisode = firstSeason?.episodes[0];
    if (!firstSeason || !firstEpisode) {
      throw new Error("Complete catalog fixture must include a first episode");
    }
    const partial = {
      ...catalog,
      completeness: "partial" as const,
      contentHash: "sha256:partial-catalog",
      seasons: [
        {
          ...firstSeason,
          episodes: [firstEpisode],
        },
      ],
    };

    expect(WatchCatalogSnapshotInputSchema.parse(partial)).toEqual(partial);
  });

  it("rejects oversized, unsafe, and non-strict catalog snapshots", () => {
    const catalog = completeCatalog();
    const season = catalog.seasons[0];
    const tooManySeasons = Array.from({ length: 101 }, (_, index) => ({
      ...season,
      seasonKey: `season-${index}`,
      order: index,
      episodes: [],
    }));
    const tooManyEpisodes = Array.from({ length: 501 }, (_, index) =>
      catalogEpisode({
        episodeKey: `episode-${index}`,
        episodeNumber: index + 1,
        order: index,
      }),
    );

    expect(() =>
      WatchCatalogSnapshotInputSchema.parse({ ...catalog, seasons: tooManySeasons }),
    ).toThrow();
    expect(() =>
      WatchCatalogSnapshotInputSchema.parse({
        ...catalog,
        seasons: [{ ...season, episodes: tooManyEpisodes }],
      }),
    ).toThrow();
    expect(() =>
      WatchCatalogSnapshotInputSchema.parse({ ...catalog, title: "x".repeat(301) }),
    ).toThrow();
    expect(() =>
      WatchCatalogSnapshotInputSchema.parse({ ...catalog, sourceUrl: "file:///tmp/demo" }),
    ).toThrow();
    expect(() =>
      WatchCatalogSnapshotInputSchema.parse({ ...catalog, privatePayload: "no" }),
    ).toThrow();
  });

  it("rejects payloads above 512 KiB before they reach storage", () => {
    const catalog = completeCatalog();
    const season = catalog.seasons[0];
    if (!season) {
      throw new Error("Complete catalog fixture must include a season");
    }
    const paddedEpisodes = Array.from({ length: 300 }, (_, index) => ({
      ...catalogEpisode({
        episodeKey: `episode-${index}`,
        episodeNumber: index + 1,
        order: index,
      }),
      sourceUrl: `https://www.crunchyroll.com/watch/episode-${index}/${"a".repeat(1_700)}`,
    }));
    const oversized = {
      ...catalog,
      seasons: [{ ...season, episodes: paddedEpisodes }],
    };

    expect(new TextEncoder().encode(JSON.stringify(oversized)).byteLength).toBeGreaterThan(
      512 * 1_024,
    );
    expect(() => WatchCatalogSnapshotInputSchema.parse(oversized)).toThrow();
  });

  it("requires non-empty unique identities for complete catalogs", () => {
    const catalog = completeCatalog();
    const firstSeason = catalog.seasons[0];
    const secondSeason = catalog.seasons[1];
    const firstEpisode = firstSeason?.episodes[0];
    if (!firstSeason || !secondSeason || !firstEpisode) {
      throw new Error("Complete catalog fixture must include two seasons");
    }

    expect(() =>
      WatchCatalogSnapshotInputSchema.parse({ ...catalog, seasons: [] }),
    ).toThrow();
    expect(() =>
      WatchCatalogSnapshotInputSchema.parse({
        ...catalog,
        seasons: [{ ...firstSeason, episodes: [] }],
      }),
    ).toThrow();
    expect(() =>
      WatchCatalogSnapshotInputSchema.parse({
        ...catalog,
        seasons: [firstSeason, { ...secondSeason, seasonKey: firstSeason.seasonKey }],
      }),
    ).toThrow();
    expect(() =>
      WatchCatalogSnapshotInputSchema.parse({
        ...catalog,
        seasons: [
          firstSeason,
          { ...secondSeason, episodes: [{ ...firstEpisode }] },
        ],
      }),
    ).toThrow();
  });
});

describe("watch history v2 progress contracts", () => {
  it("accepts meaningful event kinds including backward seeks and shared room proof", () => {
    expect(WatchProgressEventSchema.parse(progressEvent())).toEqual(progressEvent());
    expect(
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        kind: "seek",
        currentTime: 120,
        progress: 0.1,
      }),
    ).toMatchObject({ kind: "seek", currentTime: 120, progress: 0.1 });
    expect(
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        kind: "pause",
        sharedRoom: { roomId: "room-one", sourceGeneration: 3 },
      }),
    ).toMatchObject({ sharedRoom: { roomId: "room-one", sourceGeneration: 3 } });
    expect(
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        kind: "ended",
        currentTime: 1_200,
        progress: 1,
      }),
    ).toMatchObject({ kind: "ended", progress: 1 });
  });

  it("rejects client-provided ownership", () => {
    expect(() =>
      WatchProgressEventSchema.parse({ ...progressEvent(), userId: USER_ID }),
    ).toThrow();
  });

  it("accepts an idempotent acknowledgement with canonical episode state", () => {
    const ack = {
      meta: accountMeta(),
      schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
      acceptedEventId: EVENT_ID,
      acceptedAt: NOW,
      accountGeneration: 4,
      duplicate: false,
      episode: canonicalEpisodeState(),
    };

    expect(WatchProgressAckSchema.parse(ack)).toEqual(ack);
  });
});

describe("watch history v2 read and mutation contracts", () => {
  function responseFixture() {
    const crunchSession = {
      id: SESSION_ID,
      roomId: "room-one",
      hostUserId: HOST_ID,
      kind: "shared" as const,
      sourceGeneration: 3,
      currentTime: 600,
      duration: 1_200,
      progress: 0.5,
      startedAt: EARLIER,
      endedAt: null,
      lastWatchedAt: NOW,
      participants: [],
    };
    return {
      meta: accountMeta(),
      generatedAt: NOW,
      totalTitleCount: 2,
      items: [
        {
          provider: "crunchyroll" as const,
          titleKey: "series-one",
          itemKind: "series" as const,
          title: "Series One",
          sourceUrl: "https://www.crunchyroll.com/series/GYQ4MW246/series-one",
          artworkUrl: null,
          catalogState: "complete" as const,
          aggregate: { completedEpisodes: 1, availableEpisodes: 3, progress: 1 / 3 },
          seasons: [
            {
              seasonKey: "season-one",
              seasonTitle: "Season 1",
              seasonNumber: 1,
              order: 0,
              aggregate: {
                completedEpisodes: 1,
                availableEpisodes: 2,
                progress: 0.5,
              },
              episodes: [{ ...canonicalEpisodeState(), sessions: [crunchSession] }],
              nextEpisode: {
                episodeKey: "episode-two",
                episodeTitle: "Episode 2",
                seasonKey: "season-one",
                seasonTitle: "Season 1",
                seasonNumber: 1,
                episodeNumber: 2,
                sourceUrl: "https://www.crunchyroll.com/watch/episode-two/demo",
                releasedAt: EARLIER,
              },
            },
          ],
          sessions: [crunchSession],
          latestActivity: {
            episodeKey: "episode-one",
            currentTime: 600,
            duration: 1_200,
            progress: 0.5,
            completedAt: null,
            lastWatchedAt: NOW,
          },
          lastWatchedAt: NOW,
        },
        {
          provider: "youtube" as const,
          titleKey: "abcdefghijk",
          itemKind: "movie" as const,
          title: "Demo",
          sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
          artworkUrl: null,
          catalogState: "unavailable" as const,
          aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
          seasons: [],
          sessions: [],
          latestActivity: {
            episodeKey: "abcdefghijk",
            currentTime: 60,
            duration: 600,
            progress: 0.1,
            completedAt: null,
            lastWatchedAt: NOW,
          },
          lastWatchedAt: NOW,
        },
      ],
      nextCursor: {
        lastWatchedAt: NOW,
        stableId: "youtube:abcdefghijk",
      },
    };
  }

  it("accepts complete Crunchyroll series and movie-like YouTube items", () => {
    const response = responseFixture();
    expect(WatchHistoryResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects fabricated denominators and inconsistent aggregates", () => {
    const response = responseFixture();
    const completeItem = response.items[0];
    const unavailableItem = response.items[1];
    if (!completeItem || !unavailableItem) {
      throw new Error("Response fixture must include both catalog states");
    }

    expect(() =>
      WatchHistoryResponseSchema.parse({
        ...response,
        items: [
          {
            ...completeItem,
            aggregate: {
              completedEpisodes: 4,
              availableEpisodes: 3,
              progress: 1,
            },
          },
          unavailableItem,
        ],
      }),
    ).toThrow();
    expect(() =>
      WatchHistoryResponseSchema.parse({
        ...response,
        items: [
          completeItem,
          {
            ...unavailableItem,
            aggregate: {
              completedEpisodes: 0,
              availableEpisodes: 10,
              progress: 0,
            },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      WatchHistoryResponseSchema.parse({
        ...response,
        items: [
          {
            ...completeItem,
            seasons: completeItem.seasons.map((season) => ({
              ...season,
              aggregate: {
                completedEpisodes: 1,
                availableEpisodes: null,
                progress: null,
              },
            })),
          },
          unavailableItem,
        ],
      }),
    ).toThrow();
  });

  it("accepts episode, title, and all-history deletion requests", () => {
    const base = {
      schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
      clientMutationId: MUTATION_ID,
      accountGeneration: 4,
      requestedAt: NOW,
    };

    expect(
      WatchHistoryDeletionRequestSchema.parse({
        ...base,
        target: {
          scope: "episode",
          provider: "crunchyroll",
          titleKey: "series-one",
          episodeKey: "episode-one",
        },
      }),
    ).toMatchObject({ target: { scope: "episode" } });
    expect(
      WatchHistoryDeletionRequestSchema.parse({
        ...base,
        target: { scope: "title", provider: "crunchyroll", titleKey: "series-one" },
      }),
    ).toMatchObject({ target: { scope: "title" } });
    expect(
      WatchHistoryDeletionRequestSchema.parse({ ...base, target: { scope: "all" } }),
    ).toMatchObject({ target: { scope: "all" } });

    const ack = {
      meta: accountMeta(),
      schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
      clientMutationId: MUTATION_ID,
      accountGeneration: 5,
      target: { scope: "all" as const },
      deletedAt: NOW,
    };
    expect(WatchHistoryDeletionAckSchema.parse(ack)).toEqual(ack);
  });

  it("defaults the account-wide YouTube history preference to disabled", () => {
    expect(WatchHistoryPreferencesSchema.parse({})).toEqual({
      youtubeHistoryEnabled: false,
    });
    expect(() => WatchHistoryPreferencesUpdateSchema.parse({})).toThrow();
    expect(WatchHistoryPreferencesUpdateSchema.parse({ youtubeHistoryEnabled: true })).toEqual(
      { youtubeHistoryEnabled: true },
    );
  });

  it("requires a stable provider:title cursor identity", () => {
    expect(
      WatchHistoryCursorSchema.parse({
        lastWatchedAt: NOW,
        stableId: "crunchyroll:series-one",
      }),
    ).toEqual({ lastWatchedAt: NOW, stableId: "crunchyroll:series-one" });
    expect(() =>
      WatchHistoryCursorSchema.parse({ lastWatchedAt: NOW, stableId: "series-one" }),
    ).toThrow();
  });

  it("keeps the strict v1 watch library contract separate from v2", () => {
    const fixture = v1Fixture();
    expect(WatchLibraryResponseSchema.parse(fixture)).toEqual(fixture);
    expect(() => WatchHistoryResponseSchema.parse(fixture)).toThrow();
    expect(() => WatchLibraryResponseSchema.parse(responseFixture())).toThrow();
  });
});
