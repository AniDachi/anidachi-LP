import { describe, expect, it } from "vitest";
import {
  clearWatchLibraryHttpMessage,
  createRoomFromWatchSessionHttpMessage,
  isWatchLibraryCacheFresh,
  isWatchLibraryHttpMessage,
  reconcileWatchProgressHttpMessage,
  WATCH_LIBRARY_CACHE_MAX_AGE_MS,
  WATCH_LIBRARY_CACHE_KEY,
  WATCH_LIBRARY_CACHE_STORAGE_KEY,
  watchProgressEntriesFromStore,
  type CachedWatchLibrary,
} from "../src/watch-library-client";
import type { WatchProgressStore } from "../src/watch-progress";

describe("extension watch library HTTP bridge", () => {
  it("keeps the watch library cache in extension-local storage", () => {
    expect(WATCH_LIBRARY_CACHE_STORAGE_KEY).toBe("anidachi.watchLibraryCache.v1");
    expect(WATCH_LIBRARY_CACHE_KEY).toBe("local:anidachi.watchLibraryCache.v1");
    expect(WATCH_LIBRARY_CACHE_MAX_AGE_MS).toBe(60_000);
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
});
