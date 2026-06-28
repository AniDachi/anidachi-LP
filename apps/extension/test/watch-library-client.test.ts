import { describe, expect, it } from "vitest";
import {
  clearWatchLibraryHttpMessage,
  createRoomFromWatchSessionHttpMessage,
  isWatchLibraryCacheFresh,
  isWatchLibraryHttpMessage,
  mergeWatchLibraryIntoProgressStore,
  reconcileWatchProgressHttpMessage,
  WATCH_LIBRARY_CACHE_MAX_AGE_MS,
  WATCH_LIBRARY_CACHE_KEY,
  WATCH_LIBRARY_CACHE_STORAGE_KEY,
  watchProgressEntriesFromStoreForSync,
  watchProgressEntriesFromStore,
  watchProgressSyncEntryKey,
  watchLibraryCacheKeyForUser,
  watchLibrarySyncLedgerKeyForUser,
  type CachedWatchLibrary,
  type WatchLibraryResponse,
} from "../src/watch-library-client";
import { createEmptyWatchProgressStore, recordWatchProgressInStore, type WatchProgressStore } from "../src/watch-progress";

describe("extension watch library HTTP bridge", () => {
  it("keeps the watch library cache in extension-local storage", () => {
    expect(WATCH_LIBRARY_CACHE_STORAGE_KEY).toBe("anidachi.watchLibraryCache.v1");
    expect(WATCH_LIBRARY_CACHE_KEY).toBe("local:anidachi.watchLibraryCache.v1");
    expect(WATCH_LIBRARY_CACHE_MAX_AGE_MS).toBe(60_000);
  });

  it("scopes watch library cache snapshots by signed-in user", () => {
    expect(watchLibraryCacheKeyForUser("user-a")).toBe(
      "local:anidachi.watchLibraryCache.v1.user-a",
    );
    expect(watchLibraryCacheKeyForUser("user-a")).not.toBe(
      watchLibraryCacheKeyForUser("user-b"),
    );
    expect(watchLibraryCacheKeyForUser("user/with space")).toContain(
      encodeURIComponent("user/with space"),
    );
  });

  it("scopes watch library sync ledgers by signed-in user", () => {
    expect(watchLibrarySyncLedgerKeyForUser("user-a")).toBe(
      "local:anidachi.watchLibrarySyncLedger.v1.user-a",
    );
    expect(watchLibrarySyncLedgerKeyForUser("user-a")).not.toBe(
      watchLibrarySyncLedgerKeyForUser("user-b"),
    );
    expect(watchLibrarySyncLedgerKeyForUser("user/with space")).toContain(
      encodeURIComponent("user/with space"),
    );
  });

  it("treats recent watch library cache as fresh", () => {
    const cached: CachedWatchLibrary = {
      userId: "user-1",
      cachedAt: "2026-06-25T00:00:00.000Z",
      library: {
        generatedAt: "2026-06-25T00:00:00.000Z",
        limits: {
          planCode: "free",
          maxActiveTrackedTitles: 3,
          activeTrackedTitleCount: 0,
          historyRetentionDays: 7,
          retainedSince: "2026-06-18T00:00:00.000Z",
        },
        items: [],
      },
    };

    expect(isWatchLibraryCacheFresh(cached, Date.parse("2026-06-25T00:00:59.000Z"))).toBe(true);
    expect(isWatchLibraryCacheFresh(cached, Date.parse("2026-06-25T00:01:01.000Z"))).toBe(false);
  });

  it("accepts list, clear, reconcile, and create-room messages", () => {
    expect(
      isWatchLibraryHttpMessage({
        type: "ANIDACHI_WATCH_LIBRARY_HTTP",
        command: "list-library",
        accessToken: "access-1",
      }),
    ).toBe(true);
    expect(isWatchLibraryHttpMessage(clearWatchLibraryHttpMessage("access-1"))).toBe(true);
    expect(
      isWatchLibraryHttpMessage(
        reconcileWatchProgressHttpMessage("access-1", [
          {
            provider: "crunchyroll",
            kind: "episode",
            itemId: "series-1",
            itemTitle: "Series",
            sourceUrl: "https://www.crunchyroll.com/watch/episode-1/example",
            currentTime: 10,
            duration: 100,
            watchedWithCount: 1,
          },
        ]),
      ),
    ).toBe(true);
    expect(
      isWatchLibraryHttpMessage(
        createRoomFromWatchSessionHttpMessage({
          accessToken: "access-1",
          sessionId: "session-1",
        }),
      ),
    ).toBe(true);
  });

  it("rejects malformed reconcile messages", () => {
    expect(
      isWatchLibraryHttpMessage({
        type: "ANIDACHI_WATCH_LIBRARY_HTTP",
        command: "reconcile-progress",
        accessToken: "access-1",
        entries: [{ provider: "crunchyroll" }],
      }),
    ).toBe(false);
  });

  it("converts local series and movie progress into server reconcile entries", () => {
    const store: WatchProgressStore = {
      version: 1,
      providers: {
        crunchyroll: {
          items: {
            "series-1": {
              id: "series-1",
              kind: "series",
              title: "Kill Blue",
              provider: "crunchyroll",
              seriesId: "GKILLBLUE",
              artworkUrl: "https://imgsrv.crunchyroll.com/poster.png",
              sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/example",
              currentTime: 10,
              duration: 100,
              progress: 0.1,
              watchedWithCount: 2,
              lastWatchedAt: 2_000,
              episodes: {
                G31UXV53P: {
                  id: "G31UXV53P",
                  title: "E3 - Clean Up After Yourself",
                  seasonId: "season-1",
                  seasonTitle: "Season 1",
                  seasonNumber: 1,
                  sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/example",
                  currentTime: 90,
                  duration: 100,
                  progress: 0.9,
                  lastRoomId: "room-1",
                  watchedWithCount: 4,
                  lastWatchedAt: 3_000,
                },
              },
            },
          },
        },
        netflix: { items: {} },
        youtube: {
          items: {
            "movie-1": {
              id: "movie-1",
              kind: "movie",
              title: "Video",
              provider: "youtube",
              sourceUrl: "https://youtube.com/watch?v=1",
              currentTime: 20,
              duration: 200,
              progress: 0.1,
              watchedWithCount: 1,
              lastWatchedAt: 1_000,
            },
          },
        },
        amazon: { items: {} },
      },
    };

    const entries = watchProgressEntriesFromStore(store);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      provider: "crunchyroll",
      kind: "episode",
      itemId: "series-1",
      seasonId: "season-1",
      seasonTitle: "Season 1",
      seasonNumber: 1,
      episodeId: "G31UXV53P",
      roomId: "room-1",
      watchedWithCount: 4,
    });
    expect(entries[1]).toMatchObject({
      provider: "youtube",
      kind: "movie",
      itemId: "movie-1",
      episodeId: "movie-1",
    });
  });

  it("merges server watch library into local progress for instant future popup renders", () => {
    const library: WatchLibraryResponse = {
      generatedAt: "2026-06-25T00:00:00.000Z",
      limits: {
        planCode: "plus",
        maxActiveTrackedTitles: 15,
        activeTrackedTitleCount: 1,
        historyRetentionDays: 92,
        retainedSince: "2026-03-25T00:00:00.000Z",
      },
      items: [
        {
          provider: "crunchyroll",
          itemKey: "crunchyroll-series:haikyu",
          itemKind: "series",
          itemTitle: "Haikyu!!",
          sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/the-end",
          artworkUrl: "https://imgsrv.crunchyroll.com/poster.png",
          active: true,
          lastWatchedAt: "2026-06-25T00:02:00.000Z",
          episodes: [
            {
              episodeKey: "G31UXV53P",
              episodeTitle: "E1 - The End & The Beginning",
              seasonId: "season-1",
              seasonTitle: "Season 1",
              seasonNumber: 1,
              sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/the-end",
              currentTime: 600,
              duration: 1500,
              progress: 0.4,
              lastWatchedAt: "2026-06-25T00:02:00.000Z",
              sessions: [
                {
                  id: "session-1",
                  roomId: null,
                  hostUserId: "user-1",
                  kind: "solo",
                  currentTime: 600,
                  duration: 1500,
                  progress: 0.4,
                  startedAt: "2026-06-25T00:00:00.000Z",
                  endedAt: null,
                  lastWatchedAt: "2026-06-25T00:02:00.000Z",
                  participants: [],
                },
              ],
            },
          ],
        },
      ],
    };

    const merged = mergeWatchLibraryIntoProgressStore(createEmptyWatchProgressStore(), library);
    const episode =
      merged.providers.crunchyroll.items["crunchyroll-series:haikyu"]?.episodes?.G31UXV53P;

    expect(episode).toMatchObject({
      title: "E1 - The End & The Beginning",
      seasonId: "season-1",
      seasonTitle: "Season 1",
      seasonNumber: 1,
      currentTime: 600,
      duration: 1500,
      lastWatchedAt: Date.parse("2026-06-25T00:02:00.000Z"),
    });
    expect(
      merged.providers.crunchyroll.items["crunchyroll-series:haikyu"]?.artworkUrl,
    ).toBe("https://imgsrv.crunchyroll.com/poster.png");
  });

  it("does not let older server watch library overwrite newer local progress", () => {
    const local = recordWatchProgressInStore(
      createEmptyWatchProgressStore(),
      {
        provider: "crunchyroll",
        kind: "episode",
        itemId: "crunchyroll-series:haikyu",
        itemTitle: "Haikyu!!",
        episodeId: "G31UXV53P",
        episodeTitle: "E1 - The End & The Beginning",
        sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/the-end",
        currentTime: 900,
        duration: 1500,
        watchedWithCount: 1,
      },
      Date.parse("2026-06-25T00:03:00.000Z"),
    );
    const library: WatchLibraryResponse = {
      generatedAt: "2026-06-25T00:00:00.000Z",
      limits: {
        planCode: "plus",
        maxActiveTrackedTitles: 15,
        activeTrackedTitleCount: 1,
        historyRetentionDays: 92,
        retainedSince: "2026-03-25T00:00:00.000Z",
      },
      items: [
        {
          provider: "crunchyroll",
          itemKey: "crunchyroll-series:haikyu",
          itemKind: "series",
          itemTitle: "Haikyu!!",
          sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/the-end",
          artworkUrl: null,
          active: true,
          lastWatchedAt: "2026-06-25T00:02:00.000Z",
          episodes: [
            {
              episodeKey: "G31UXV53P",
              episodeTitle: "E1 - The End & The Beginning",
              seasonId: null,
              seasonTitle: null,
              seasonNumber: null,
              sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/the-end",
              currentTime: 600,
              duration: 1500,
              progress: 0.4,
              lastWatchedAt: "2026-06-25T00:02:00.000Z",
              sessions: [],
            },
          ],
        },
      ],
    };

    const merged = mergeWatchLibraryIntoProgressStore(local, library);
    const episode =
      merged.providers.crunchyroll.items["crunchyroll-series:haikyu"]?.episodes?.G31UXV53P;

    expect(episode?.currentTime).toBe(900);
    expect(episode?.lastWatchedAt).toBe(Date.parse("2026-06-25T00:03:00.000Z"));
  });

  it("only returns entries strictly newer than the provided watermark", () => {
    const store: WatchProgressStore = {
      version: 1,
      providers: {
        crunchyroll: {
          items: {
            "series-1": {
              id: "series-1",
              kind: "series",
              title: "Kill Blue",
              provider: "crunchyroll",
              sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/example",
              currentTime: 90,
              duration: 100,
              progress: 0.9,
              watchedWithCount: 1,
              lastWatchedAt: 3_000,
              episodes: {
                G31UXV53P: {
                  id: "G31UXV53P",
                  title: "E3",
                  sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/example",
                  currentTime: 90,
                  duration: 100,
                  progress: 0.9,
                  watchedWithCount: 1,
                  lastWatchedAt: 3_000,
                },
              },
            },
          },
        },
        netflix: { items: {} },
        youtube: {
          items: {
            "movie-1": {
              id: "movie-1",
              kind: "movie",
              title: "Video",
              provider: "youtube",
              sourceUrl: "https://youtube.com/watch?v=1",
              currentTime: 20,
              duration: 200,
              progress: 0.1,
              watchedWithCount: 1,
              lastWatchedAt: 1_000,
            },
          },
        },
        amazon: { items: {} },
      },
    };

    // Default watermark (0) backfills everything.
    expect(watchProgressEntriesFromStore(store)).toHaveLength(2);

    // A mid watermark drops the older movie (1_000) and keeps the newer episode (3_000).
    const sinceMid = watchProgressEntriesFromStore(store, "reconcile", 1_500);
    expect(sinceMid).toHaveLength(1);
    expect(sinceMid[0]).toMatchObject({ provider: "crunchyroll", episodeId: "G31UXV53P" });

    // A watermark at the newest observation leaves nothing to send (strictly-greater).
    expect(watchProgressEntriesFromStore(store, "reconcile", 3_000)).toHaveLength(0);
  });

  it("filters sync entries by per-entry ledger instead of one global timestamp", () => {
    const store: WatchProgressStore = {
      version: 1,
      providers: {
        crunchyroll: {
          items: {
            "series-1": {
              id: "series-1",
              kind: "series",
              title: "Kill Blue",
              provider: "crunchyroll",
              sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/example",
              currentTime: 90,
              duration: 100,
              progress: 0.9,
              watchedWithCount: 1,
              lastWatchedAt: 3_000,
              episodes: {
                G31UXV53P: {
                  id: "G31UXV53P",
                  title: "E3",
                  sourceUrl: "https://www.crunchyroll.com/watch/G31UXV53P/example",
                  currentTime: 90,
                  duration: 100,
                  progress: 0.9,
                  watchedWithCount: 1,
                  lastWatchedAt: 3_000,
                },
              },
            },
          },
        },
        netflix: { items: {} },
        youtube: {
          items: {
            "movie-1": {
              id: "movie-1",
              kind: "movie",
              title: "Video",
              provider: "youtube",
              sourceUrl: "https://youtube.com/watch?v=1",
              currentTime: 20,
              duration: 200,
              progress: 0.1,
              watchedWithCount: 1,
              lastWatchedAt: 1_000,
            },
          },
        },
        amazon: { items: {} },
      },
    };
    const allEntries = watchProgressEntriesFromStore(store);
    const syncedEpisode = allEntries.find((entry) => entry.provider === "crunchyroll");
    expect(syncedEpisode).toBeTruthy();

    const pending = watchProgressEntriesFromStoreForSync(store, "reconcile", {
      [watchProgressSyncEntryKey(syncedEpisode!)]: Number(syncedEpisode!.observedAt),
    });

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ provider: "youtube", itemId: "movie-1" });
  });

  it("does not drop older unsynced entries when the newest 100 entries are already synced", () => {
    let store = createEmptyWatchProgressStore();
    const ledger: Record<string, number> = {};

    for (let index = 0; index < 101; index += 1) {
      const itemId = `synced-${index}`;
      const observedAt = 10_000 + index;
      store = recordWatchProgressInStore(
        store,
        {
          provider: "crunchyroll",
          kind: "movie",
          itemId,
          itemTitle: `Synced ${index}`,
          sourceUrl: `https://www.crunchyroll.com/watch/${itemId}`,
          currentTime: 50,
          duration: 100,
          watchedWithCount: 1,
        },
        observedAt,
      );
      ledger[
        watchProgressSyncEntryKey({
          provider: "crunchyroll",
          kind: "movie",
          itemId,
          episodeId: itemId,
        })
      ] = observedAt;
    }

    store = recordWatchProgressInStore(
      store,
      {
        provider: "youtube",
        kind: "movie",
        itemId: "older-unsynced",
        itemTitle: "Older unsynced",
        sourceUrl: "https://youtube.com/watch?v=older",
        currentTime: 20,
        duration: 100,
        watchedWithCount: 1,
      },
      1_000,
    );

    const pending = watchProgressEntriesFromStoreForSync(store, "reconcile", ledger);

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ provider: "youtube", itemId: "older-unsynced" });
  });
});
