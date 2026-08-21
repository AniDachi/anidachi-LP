import { describe, expect, it } from "vitest";
import {
  MAX_ROOM_HISTORY_ATTESTATION_CHARS,
  WATCH_HISTORY_SCHEMA_VERSION,
  WatchCatalogSnapshotInputSchema,
  WatchHistoryDeletionAckSchema,
  WatchHistoryDeletionRequestSchema,
  WatchHistoryPreferencesSchema,
  WatchHistoryPreferencesUpdateSchema,
  WatchHistoryRoomRecreationResponseSchema,
  WatchHistoryResponseSchema,
  WatchHistoryTitleEpisodesResponseSchema,
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

function roomRecreationResponse() {
  return {
    roomId: "room-watch-history-1",
    roomToken: "room-token",
    shareableLink: "https://www.anidachi.app/room/room-watch-history-1",
    reused: false,
    capabilities: {
      hostPlanCode: "plus",
      maxParticipants: 8,
      maxMediaSeats: 4,
      canNameRoom: true,
      canSendPushInvites: true,
    },
    quota: { remainingSeconds: 3600, resetAt: NOW },
  };
}

function accountMeta() {
  return {
    serverTime: NOW,
    schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
    ownerUserId: USER_ID,
    accountGeneration: 4,
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
  it("accepts meaningful event kinds including backward seeks and shared room authority", () => {
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
        sharedRoom: {
          roomId: "room-one",
          participantSessionId: "participant-session-one",
          roomGeneration: 2,
          sourceGeneration: 3,
          attestation: "opaque.signed.attestation",
        },
      }),
    ).toMatchObject({
      sharedRoom: {
        roomId: "room-one",
        participantSessionId: "participant-session-one",
        roomGeneration: 2,
        sourceGeneration: 3,
        attestation: "opaque.signed.attestation",
      },
    });
    expect(
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        kind: "ended",
        currentTime: 1_200,
        progress: 1,
      }),
    ).toMatchObject({ kind: "ended", progress: 1 });
  });

  it("rejects the saved room/source proof and requires the complete authority tuple", () => {
    expect(() =>
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        sharedRoom: { roomId: "room-one", sourceGeneration: 3 },
      }),
    ).toThrow();
    expect(() =>
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        sharedRoom: {
          roomId: "room-one",
          roomGeneration: 2,
          sourceGeneration: 3,
          attestation: "opaque.signed.attestation",
        },
      }),
    ).toThrow();
  });

  it("keeps purpose and audience inside the signed opaque authority", () => {
    const sharedRoom = {
      roomId: "room-one",
      participantSessionId: "participant-session-one",
      roomGeneration: 2,
      sourceGeneration: 3,
      attestation: "opaque.signed.attestation",
    };

    expect(() =>
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        sharedRoom: { ...sharedRoom, purpose: "room" },
      }),
    ).toThrow();
    expect(() =>
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        sharedRoom: { ...sharedRoom, audience: "anidachi-worker" },
      }),
    ).toThrow();
  });

  it("rejects invalid generations, oversized authority, and undeclared sequencing", () => {
    const sharedRoom = {
      roomId: "room-one",
      participantSessionId: "participant-session-one",
      roomGeneration: 2,
      sourceGeneration: 3,
      attestation: "opaque.signed.attestation",
    };

    expect(() =>
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        sharedRoom: { ...sharedRoom, roomGeneration: 0 },
      }),
    ).toThrow();
    expect(() =>
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        sharedRoom: { ...sharedRoom, sourceGeneration: 0 },
      }),
    ).toThrow();
    expect(() =>
      WatchProgressEventSchema.parse({
        ...progressEvent(),
        sharedRoom: {
          ...sharedRoom,
          attestation: "a".repeat(MAX_ROOM_HISTORY_ATTESTATION_CHARS + 1),
        },
      }),
    ).toThrow();
    expect(() =>
      WatchProgressEventSchema.parse({ ...progressEvent(), clientSequence: 1 }),
    ).toThrow();
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
    expect(() =>
      WatchProgressAckSchema.parse({
        ...ack,
        meta: { ...ack.meta, accountGeneration: 3 },
      }),
    ).toThrow();
  });
});

describe("watch history v2 read and mutation contracts", () => {
  function responseFixture() {
    const crunchSession = {
      id: SESSION_ID,
      roomId: "room-one",
      roomGeneration: 2,
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
          observedEpisodeCount: 1,
          completedEpisodeCount: 1,
          episodePage: { complete: true, nextCursor: null },
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
          observedEpisodeCount: 1,
          completedEpisodeCount: 0,
          episodePage: { complete: true, nextCursor: null },
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
      nextCursor: "opaque_cursor-v2",
    };
  }

  it("accepts complete Crunchyroll series and movie-like YouTube items", () => {
    const response = responseFixture();
    expect(WatchHistoryResponseSchema.parse(response)).toEqual(response);
    expect(() =>
      WatchHistoryResponseSchema.parse({
        ...response,
        meta: { ...response.meta, accountGeneration: undefined },
      }),
    ).toThrow();
  });

  it("requires an honest bounded episode slice with exact title counts", () => {
    const response = responseFixture();
    const item = response.items[0];
    if (!item) throw new Error("Response fixture must include a title");

    expect(WatchHistoryResponseSchema.parse(response).items[0]).toMatchObject({
      observedEpisodeCount: 1,
      completedEpisodeCount: 1,
      episodePage: { complete: true, nextCursor: null },
    });
    expect(() =>
      WatchHistoryResponseSchema.parse({
        ...response,
        items: [{ ...item, unexpected: true }, ...response.items.slice(1)],
      }),
    ).toThrow();
    expect(() =>
      WatchHistoryResponseSchema.parse({
        ...response,
        items: [
          {
            ...item,
            observedEpisodeCount: 9,
            completedEpisodeCount: 0,
            episodePage: { complete: false, nextCursor: "episode_cursor" },
            seasons: [{
              ...item.seasons[0]!,
              episodes: Array.from({ length: 9 }, (_, index) => ({
                ...canonicalEpisodeState(),
                episodeKey: `episode-${index}`,
                episodeTitle: `Episode ${index}`,
              })),
            }],
          },
        ],
        nextCursor: null,
      }),
    ).toThrow();
    expect(() => WatchHistoryResponseSchema.parse({
      ...response,
      items: [{
        ...item,
        observedEpisodeCount: 9,
        episodePage: { complete: false, nextCursor: "episode_cursor" },
        seasons: Array.from({ length: 9 }, (_, index) => ({
          ...item.seasons[0]!,
          seasonKey: `empty-season-${index}`,
          order: index,
          episodes: [],
        })),
      }],
      nextCursor: null,
    })).toThrow();
  });

  it("defines a strict 50-row title episode detail response", () => {
    const detail = {
      meta: accountMeta(),
      generatedAt: NOW,
      provider: "crunchyroll" as const,
      titleKey: "series-one",
      observedEpisodeCount: 51,
      completedEpisodeCount: 1,
      episodes: [canonicalEpisodeState()],
      complete: false,
      nextCursor: "episode_cursor",
    };
    expect(WatchHistoryTitleEpisodesResponseSchema.parse(detail)).toEqual(detail);
    expect(() => WatchHistoryTitleEpisodesResponseSchema.parse({ ...detail, unknown: true })).toThrow();
    expect(() =>
      WatchHistoryTitleEpisodesResponseSchema.parse({
        ...detail,
        episodes: Array.from({ length: 51 }, (_, index) => ({
          ...canonicalEpisodeState(),
          episodeKey: `episode-${index}`,
        })),
      }),
    ).toThrow();
  });

  it("requires every shared session to retain both room generations", () => {
    const response = responseFixture();
    const item = response.items[0];
    const session = item?.sessions[0];
    if (!item || !session) {
      throw new Error("Response fixture must include a shared session");
    }

    const { roomGeneration: _roomGeneration, ...withoutRoomGeneration } = session;
    expect(() =>
      WatchHistoryResponseSchema.parse({
        ...response,
        items: [{ ...item, sessions: [withoutRoomGeneration] }, ...response.items.slice(1)],
      }),
    ).toThrow();
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
      meta: { ...accountMeta(), accountGeneration: 5 },
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

  it("exposes only a bounded opaque base64url cursor", () => {
    const response = responseFixture();
    expect(WatchHistoryResponseSchema.parse(response).nextCursor).toBe(
      "opaque_cursor-v2",
    );
    expect(() =>
      WatchHistoryResponseSchema.parse({ ...response, nextCursor: "not opaque" }),
    ).toThrow();
    expect(() =>
      WatchHistoryResponseSchema.parse({ ...response, nextCursor: "a".repeat(513) }),
    ).toThrow();
    expect(() =>
      WatchHistoryResponseSchema.parse({
        ...response,
        nextCursor: { lastWatchedAt: NOW, stableId: "crunchyroll:series-one" },
      }),
    ).toThrow();
  });

  it("caps the title snapshot at eight episodes without claiming the title is complete", () => {
    const response = responseFixture();
    const unavailableItem = response.items[1];
    if (!unavailableItem) {
      throw new Error("Response fixture must include an unavailable item");
    }
    const observedEpisode = {
      ...canonicalEpisodeState(),
      sessions: [],
    };
    const observedSeason = {
      seasonKey: "season-0",
      seasonTitle: "Season 0",
      seasonNumber: 0,
      order: 0,
      aggregate: {
        completedEpisodes: 0,
        availableEpisodes: null,
        progress: null,
      },
      episodes: [observedEpisode],
      nextEpisode: null,
    };
    const episodes = Array.from({ length: 8 }, (_, index) => ({
      ...observedEpisode,
      episodeKey: `episode-${index}`,
      episodeTitle: `Episode ${index}`,
      seasonKey: "season-0",
      seasonTitle: "Season 0",
      seasonNumber: 0,
      episodeNumber: index,
    }));
    const parsed = WatchHistoryResponseSchema.parse({
        ...response,
        items: [
          {
            ...unavailableItem,
            itemKind: "series",
            observedEpisodeCount: 501,
            completedEpisodeCount: 0,
            episodePage: { complete: false, nextCursor: "episode_cursor" },
            seasons: [{ ...observedSeason, episodes }],
          },
        ],
        nextCursor: null,
      });
    expect(parsed.items[0]?.seasons[0]?.episodes).toHaveLength(8);
  });

  it("accepts season zero and rejects season numbers above 1000", () => {
    expect(
      WatchProgressEventSchema.parse({ ...progressEvent(), seasonNumber: 0 })
        .seasonNumber,
    ).toBe(0);
    expect(() =>
      WatchProgressEventSchema.parse({ ...progressEvent(), seasonNumber: 1001 }),
    ).toThrow();
  });

  it("keeps a maximum-Unicode 20-session acknowledgement below two MiB", () => {
    const unicode = "😀";
    const maxUnicode = (maxCodeUnits: number) =>
      unicode.repeat(Math.floor(maxCodeUnits / unicode.length)) +
      "a".repeat(maxCodeUnits % unicode.length);
    const maxUrl = (label: string) => {
      const prefix = `https://example.com/${label}/`;
      return prefix + maxUnicode(2_048 - prefix.length);
    };
    const uuid = (index: number) =>
      `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
    const sessions = Array.from({ length: 20 }, (_, sessionIndex) => ({
      id: uuid(sessionIndex + 10),
      roomId: maxUnicode(128),
      roomGeneration: sessionIndex + 1,
      hostUserId: HOST_ID,
      kind: "shared" as const,
      sourceGeneration: sessionIndex + 1,
      currentTime: Number.MAX_SAFE_INTEGER,
      duration: Number.MAX_SAFE_INTEGER,
      progress: 1,
      startedAt: EARLIER,
      endedAt: NOW,
      lastWatchedAt: NOW,
      participants: Array.from({ length: 15 }, (_, participantIndex) => ({
        user: {
          userId: uuid(100 + sessionIndex * 15 + participantIndex),
          handle: "h".repeat(24),
          displayName: maxUnicode(80),
          avatarUrl: maxUrl(`avatar-${sessionIndex}-${participantIndex}`),
        },
        role: participantIndex === 0 ? ("host" as const) : ("viewer" as const),
        currentTime: Number.MAX_SAFE_INTEGER,
        progress: 1,
        joinedAt: EARLIER,
        leftAt: NOW,
        updatedAt: NOW,
      })),
    }));
    const maximumShape = WatchProgressAckSchema.parse({
      meta: accountMeta(),
      schemaVersion: WATCH_HISTORY_SCHEMA_VERSION,
      acceptedEventId: EVENT_ID,
      acceptedAt: NOW,
      accountGeneration: 4,
      duplicate: false,
      episode: {
        episodeKey: maxUnicode(220),
        episodeTitle: maxUnicode(300),
        seasonKey: maxUnicode(220),
        seasonTitle: maxUnicode(300),
        seasonNumber: 1000,
        episodeNumber: Number.MAX_SAFE_INTEGER,
        sourceUrl: maxUrl("episode"),
        currentTime: Number.MAX_SAFE_INTEGER,
        duration: Number.MAX_SAFE_INTEGER,
        progress: 1,
        completedAt: NOW,
        lastWatchedAt: NOW,
        sessions,
      },
    });
    const postgresJsonText = (value: unknown): string => {
      if (Array.isArray(value)) {
        return `[${value.map(postgresJsonText).join(", ")}]`;
      }
      if (value !== null && typeof value === "object") {
        return `{${Object.entries(value)
          .map(([key, item]) => `${JSON.stringify(key)}: ${postgresJsonText(item)}`)
          .join(", ")}}`;
      }
      return JSON.stringify(value);
    };
    const acknowledgementBytes = new TextEncoder().encode(
      postgresJsonText(maximumShape),
    ).byteLength;
    expect(acknowledgementBytes).toBe(1_383_287);
    expect(acknowledgementBytes).toBeGreaterThan(1_024 * 1_024);
    expect(acknowledgementBytes).toBeLessThan(2 * 1_024 * 1_024);
  });

  it("keeps the strict v1 watch library contract separate from v2", () => {
    const fixture = v1Fixture();
    expect(WatchLibraryResponseSchema.parse(fixture)).toEqual(fixture);
    expect(() => WatchHistoryResponseSchema.parse(fixture)).toThrow();
    expect(() => WatchLibraryResponseSchema.parse(responseFixture())).toThrow();
  });

  it("strictly validates room recreation responses", () => {
    const response = roomRecreationResponse();
    expect(WatchHistoryRoomRecreationResponseSchema.parse(response)).toEqual(response);
    expect(() =>
      WatchHistoryRoomRecreationResponseSchema.parse({ ...response, extra: true }),
    ).toThrow();
    expect(() =>
      WatchHistoryRoomRecreationResponseSchema.parse({ ...response, roomToken: "" }),
    ).toThrow();
    expect(() =>
      WatchHistoryRoomRecreationResponseSchema.parse({
        ...response,
        shareableLink: "javascript:alert(1)",
      }),
    ).toThrow();
    expect(() =>
      WatchHistoryRoomRecreationResponseSchema.parse({
        ...response,
        quota: { remainingSeconds: -1, resetAt: "not-a-timestamp" },
      }),
    ).toThrow();
  });
});
