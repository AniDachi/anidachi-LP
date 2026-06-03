import { describe, expect, it } from "vitest";
import {
  buildProviderFolders,
  createEmptyWatchProgressStore,
  formatProgressClock,
  normalizeWatchProgressStore,
  recordWatchProgressInStore,
  type WatchProgressEntry,
} from "../src/watch-progress";

describe("watch progress store", () => {
  it("clamps and upserts Crunchyroll episode progress", () => {
    const store = createEmptyWatchProgressStore();
    const entry: WatchProgressEntry = {
      provider: "crunchyroll",
      kind: "episode",
      itemId: "series:chainsaw-man",
      itemTitle: "Chainsaw Man",
      contentId: "GMEE00351495ENUS",
      seriesId: "GCHAINSAW",
      episodeId: "GMEE00351495ENUS",
      episodeTitle: "E1 - Reze Arc",
      artworkUrl: "https://imgsrv.crunchyroll.com/keyart/example-backdrop_wide",
      sourceUrl:
        "https://www.crunchyroll.com/ru/watch/GMEE00351495ENUS/chainsaw-man--the-movie-reze-arc",
      currentTime: 900,
      duration: 1800,
      roomId: "room-1",
      watchedWithCount: 2,
    };

    const next = recordWatchProgressInStore(store, entry, 1_000);
    const updated = recordWatchProgressInStore(
      next,
      { ...entry, currentTime: 2500, duration: 1800 },
      2_000,
    );

    const episode =
      updated.providers.crunchyroll.items["series:chainsaw-man"]?.episodes?.GMEE00351495ENUS;

    expect(episode?.currentTime).toBe(1800);
    expect(episode?.duration).toBe(1800);
    expect(episode?.progress).toBe(1);
    expect(episode?.lastWatchedAt).toBe(2_000);
    expect(updated.providers.crunchyroll.items["series:chainsaw-man"]?.artworkUrl).toBe(
      "https://imgsrv.crunchyroll.com/keyart/example-backdrop_wide",
    );
    expect(updated.providers.crunchyroll.items["series:chainsaw-man"]?.contentId).toBe(
      "GMEE00351495ENUS",
    );
  });

  it("preserves stored artwork when a later progress update has none", () => {
    const entry: WatchProgressEntry = {
      provider: "crunchyroll",
      kind: "episode",
      itemId: "crunchyroll-series:rezero-starting-life-in-another-world",
      itemTitle: "Re:Zero — жизнь с нуля в другом мире",
      seriesId: "GRGG9798R",
      episodeId: "GEVUZP0ZM",
      episodeTitle: "E1 - Конец начала и начало конца",
      artworkUrl:
        "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/d1c2ab296014342d154f8467628ad323.png",
      sourceUrl:
        "https://www.crunchyroll.com/ru/watch/GEVUZP0ZM/the-end-of-the-beginning-and-the-beginning-of-the-end",
      currentTime: 84,
      duration: 3160,
      watchedWithCount: 1,
    };

    const withArtwork = recordWatchProgressInStore(createEmptyWatchProgressStore(), entry, 1_000);
    const withoutArtwork = recordWatchProgressInStore(
      withArtwork,
      { ...entry, artworkUrl: undefined, currentTime: 120 },
      2_000,
    );

    expect(
      withoutArtwork.providers.crunchyroll.items[
        "crunchyroll-series:rezero-starting-life-in-another-world"
      ]?.artworkUrl,
    ).toBe(
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/d1c2ab296014342d154f8467628ad323.png",
    );
  });

  it("does not preserve generated Crunchyroll backdrop artwork", () => {
    const entry: WatchProgressEntry = {
      provider: "crunchyroll",
      kind: "episode",
      itemId: "crunchyroll-series:rezero-starting-life-in-another-world",
      itemTitle: "Re:Zero — жизнь с нуля в другом мире",
      seriesId: "GRGG9798R",
      episodeId: "GEVUZP0ZM",
      episodeTitle: "E1 - Конец начала и начало конца",
      artworkUrl:
        "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=360,height=202/keyart/GRGG9798R-backdrop_wide",
      sourceUrl:
        "https://www.crunchyroll.com/ru/watch/GEVUZP0ZM/the-end-of-the-beginning-and-the-beginning-of-the-end",
      currentTime: 84,
      duration: 3160,
      watchedWithCount: 1,
    };

    const withBackdrop = recordWatchProgressInStore(createEmptyWatchProgressStore(), entry, 1_000);
    const withoutArtwork = recordWatchProgressInStore(
      withBackdrop,
      { ...entry, artworkUrl: undefined, currentTime: 120 },
      2_000,
    );

    expect(
      withoutArtwork.providers.crunchyroll.items[
        "crunchyroll-series:rezero-starting-life-in-another-world"
      ]?.artworkUrl,
    ).toBeUndefined();
  });

  it("replaces generated Crunchyroll backdrop artwork with catalog poster artwork", () => {
    const entry: WatchProgressEntry = {
      provider: "crunchyroll",
      kind: "episode",
      itemId: "crunchyroll-series:rezero-starting-life-in-another-world",
      itemTitle: "Re:Zero — жизнь с нуля в другом мире",
      seriesId: "GRGG9798R",
      episodeId: "GEVUZP0ZM",
      episodeTitle: "E1 - Конец начала и начало конца",
      artworkUrl:
        "https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=360,height=202/keyart/GRGG9798R-backdrop_wide",
      sourceUrl:
        "https://www.crunchyroll.com/ru/watch/GEVUZP0ZM/the-end-of-the-beginning-and-the-beginning-of-the-end",
      currentTime: 84,
      duration: 3160,
      watchedWithCount: 1,
    };
    const posterUrl =
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/d1c2ab296014342d154f8467628ad323.png";

    const withBackdrop = recordWatchProgressInStore(createEmptyWatchProgressStore(), entry, 1_000);
    const withPoster = recordWatchProgressInStore(
      withBackdrop,
      { ...entry, artworkUrl: posterUrl, currentTime: 120 },
      2_000,
    );

    expect(
      withPoster.providers.crunchyroll.items[
        "crunchyroll-series:rezero-starting-life-in-another-world"
      ]?.artworkUrl,
    ).toBe(posterUrl);
  });

  it("keeps placeholder folders for resources without tracking yet", () => {
    const folders = buildProviderFolders(createEmptyWatchProgressStore());

    expect(folders.map((folder) => folder.provider)).toEqual([
      "crunchyroll",
      "netflix",
      "youtube",
      "amazon",
    ]);
    expect(folders.find((folder) => folder.provider === "netflix")?.items).toEqual([]);
  });

  it("removes stale Crunchyroll movie records when the same watch id becomes a series episode", () => {
    const movieEntry: WatchProgressEntry = {
      provider: "crunchyroll",
      kind: "movie",
      itemId: "crunchyroll-movie:G8WUNEWJE",
      itemTitle: "Ревущие мышцы",
      episodeId: "G8WUNEWJE",
      episodeTitle: "Ревущие мышцы",
      sourceUrl: "https://www.crunchyroll.com/ru/watch/G8WUNEWJE/roaring-muscles",
      currentTime: 100,
      duration: 1430,
      watchedWithCount: 1,
    };
    const episodeEntry: WatchProgressEntry = {
      ...movieEntry,
      kind: "episode",
      itemId: "crunchyroll-series:my-hero-academia",
      itemTitle: "My Hero Academia",
    };

    const withMovie = recordWatchProgressInStore(
      createEmptyWatchProgressStore(),
      movieEntry,
      1_000,
    );
    const corrected = recordWatchProgressInStore(withMovie, episodeEntry, 2_000);

    expect(corrected.providers.crunchyroll.items["crunchyroll-movie:G8WUNEWJE"]).toBeUndefined();
    expect(
      corrected.providers.crunchyroll.items["crunchyroll-series:my-hero-academia"]?.episodes
        ?.G8WUNEWJE,
    ).toMatchObject({
      title: "Ревущие мышцы",
      lastWatchedAt: 2_000,
    });
  });

  it("normalizes legacy Crunchyroll series URL titles into readable folder names", () => {
    const store = normalizeWatchProgressStore({
      version: 1,
      providers: {
        crunchyroll: {
          items: {
            legacy: {
              id: "legacy",
              kind: "series",
              title:
                "https://www.crunchyroll.com/ru/series/GRGG9798R/rezero--starting-life-in-another-world-",
              provider: "crunchyroll",
              sourceUrl: "https://www.crunchyroll.com/ru/watch/GEVUZP0ZM/example",
              currentTime: 84,
              duration: 3160,
              progress: 0.03,
              watchedWithCount: 1,
              lastWatchedAt: 1_000,
              episodes: {},
            },
          },
        },
      },
    });

    const item =
      store.providers.crunchyroll.items["crunchyroll-series:rezero-starting-life-in-another-world"];

    expect(store.providers.crunchyroll.items.legacy).toBeUndefined();
    expect(item?.title).toBe("Rezero Starting Life In Another World");
    expect(item?.seriesId).toBe("GRGG9798R");
    expect(item?.artworkUrl).toBeUndefined();
  });

  it("formats progress clock compactly", () => {
    expect(formatProgressClock(873)).toBe("14:33");
    expect(formatProgressClock(3673)).toBe("1:01:13");
  });
});
