import { afterEach, describe, expect, it } from "vitest";
import variantsFixture from "./fixtures/crunchyroll/catalog-variants.json";
import {
  getCrunchyrollProgressEntry,
  getCrunchyrollHistoryObservation,
  resolveCrunchyrollCurrentObjectIdentity,
} from "../src/source-adapters/crunchyroll/progress";

describe("Crunchyroll current-object canonical identity", () => {
  it.each([
    ["English dub", "G8WUNEWJE", "en-US"],
    ["Japanese original", "GY2PDV78Y", "ja-JP"],
  ])("resolves the exact %s watch GUID to one logical episode", (_name, watchId, audioLocale) => {
    expect(resolveCrunchyrollCurrentObjectIdentity({
      watchId,
      objectResponse: variantsFixture.objectResponses[watchId as keyof typeof variantsFixture.objectResponses],
      seasonsResponse: variantsFixture.seasonsResponse,
      episodesResponse: variantsFixture.episodesResponse,
    })).toEqual({
      providerSeriesId: "G6NQ5DWZ6",
      providerSeasonIdentifier: "G6NQ5DWZ6|S00003205",
      providerEpisodeIdentifier: "G6NQ5DWZ6|S00003205|E3",
      providerContentId: watchId,
      audioLocale,
      titleKey: "crunchyroll:series:G6NQ5DWZ6",
      seasonKey: "crunchyroll:season:G6NQ5DWZ6|S00003205",
      episodeKey: "crunchyroll:episode:G6NQ5DWZ6|S00003205|E3",
    });
  });

  it("keeps provider seasons distinct even when their presentation matches", () => {
    const shared = {
      watchId: "LEGACY-WATCH-1",
      objectResponse: {
        total: 1,
        data: [{ id: "LEGACY-WATCH-1", type: "episode", episode_metadata: {
          series_id: "LEGACY-SERIES", season_id: "LEGACY-SEASON-GUID-1", audio_locale: "en-US",
          versions: [{ guid: "LEGACY-WATCH-1", season_guid: "LEGACY-SEASON-GUID-1", audio_locale: "en-US" }],
        } }],
      },
      episodesResponse: {
        total: 1,
        data: [{ id: "LEGACY-WATCH-1", identifier: "LEGACY-SERIES|LEGACY-SEASON-1|E1", versions: [{ guid: "LEGACY-WATCH-1", season_guid: "LEGACY-SEASON-GUID-1" }] }],
      },
    };
    const first = resolveCrunchyrollCurrentObjectIdentity({
      ...shared,
      seasonsResponse: { total: 2, data: [
        { id: "LEGACY-SEASON-GUID-1", identifier: "LEGACY-SERIES|LEGACY-SEASON-1", title: "Season 1 (English Dub)", season_number: 1, versions: [{ guid: "LEGACY-SEASON-GUID-1" }] },
        { id: "LEGACY-SEASON-GUID-2", identifier: "LEGACY-SERIES|LEGACY-SEASON-2", title: "Season 1 (English Dub)", season_number: 1, versions: [{ guid: "LEGACY-SEASON-GUID-2" }] },
      ] },
    });

    expect(first?.seasonKey).toBe("crunchyroll:season:LEGACY-SERIES|LEGACY-SEASON-1");
    expect(first?.seasonKey).not.toBe("crunchyroll:season:LEGACY-SERIES|LEGACY-SEASON-2");
  });

  it.each([
    ["missing season list", { seasonsResponse: null }],
    ["missing episode list", { episodesResponse: null }],
    ["wrong recorded watch GUID", { watchId: "NOT-THE-RECORDED-GUID" }],
    ["ambiguous episode alias", { episodesResponse: variantsFixture.ambiguousEpisodesResponse }],
  ])("leaves identity pending for %s", (_name, override) => {
    expect(resolveCrunchyrollCurrentObjectIdentity({
      watchId: "G8WUNEWJE",
      objectResponse: variantsFixture.objectResponses.G8WUNEWJE,
      seasonsResponse: variantsFixture.seasonsResponse,
      episodesResponse: variantsFixture.episodesResponse,
      ...override,
    })).toBeNull();
  });

  it.each(variantsFixture.invalidIdentityCases)(
    "leaves identity pending for $name",
    ({ input }) => {
      expect(resolveCrunchyrollCurrentObjectIdentity(input)).toBeNull();
    },
  );

  it("keeps identity when an unrecognized audio locale is safely nullable", () => {
    const objectResponse = structuredClone(
      variantsFixture.objectResponses.G8WUNEWJE,
    );
    objectResponse.data[0].episode_metadata.versions[1].audio_locale =
      "not a locale";

    expect(resolveCrunchyrollCurrentObjectIdentity({
      watchId: "G8WUNEWJE",
      objectResponse,
      seasonsResponse: variantsFixture.seasonsResponse,
      episodesResponse: variantsFixture.episodesResponse,
    })?.audioLocale).toBeNull();
  });
});

describe("Crunchyroll progress extraction", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("accepts only an active Crunchyroll adapter on canonical watch media with partial observed metadata", () => {
    mockLocation("https://www.crunchyroll.com/watch/G8WUNM123/e4-bold-step");
    document.body.innerHTML = `<a href="/series/GYEXAMPLE/my-hero-academia">My Hero Academia</a>`;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 1 });
    Object.defineProperty(video, "duration", { configurable: true, value: 2 });

    expect(getCrunchyrollHistoryObservation({
      adapter: { id: "crunchyroll", provider: "crunchyroll", video, getTitle: () => "E4 - Bold step" } as never,
    })).toMatchObject({
      provider: "crunchyroll",
      providerLabel: "Crunchyroll",
      titleKey: "crunchyroll-series:my-hero-academia",
      episodeKey: "G8WUNM123",
      catalogState: "unavailable",
    });
  });

  it.each([
    ["canonical base", "https://www.crunchyroll.com/watch/G8WUNM123"],
    ["validated locale", "https://www.crunchyroll.com/ru/watch/G8WUNM123/e4-bold-step"],
  ])("accepts %s", (_name, url) => {
    mockLocation(url);
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 1 });
    Object.defineProperty(video, "duration", { configurable: true, value: 2 });
    expect(getCrunchyrollHistoryObservation({
      adapter: { id: "crunchyroll", provider: "crunchyroll", video, getTitle: () => "Episode" } as never,
    })).not.toBeNull();
  });

  it.each([
    "https://www.crunchyroll.com/foo/watch/G8WUNM123",
    "https://www.crunchyroll.com/foo/bar/watch/G8WUNM123",
    "https://www.crunchyroll.com/rus/watch/G8WUNM123",
    "https://www.crunchyroll.com/watch/G8WUNM123/e4-bold-step/extra",
    "https://www.crunchyroll.com/watch/G8WUNM123/bad_slug",
    "https://www.crunchyroll.com/foo?path=/watch/G8WUNM123",
  ])("rejects non-canonical Crunchyroll history route %s", (url) => {
    mockLocation(url);
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 1 });
    Object.defineProperty(video, "duration", { configurable: true, value: 2 });
    expect(getCrunchyrollHistoryObservation({
      adapter: { id: "crunchyroll", provider: "crunchyroll", video, getTitle: () => "Episode" } as never,
    })).toBeNull();
  });

  it.each([
    ["unsupported route", "https://www.crunchyroll.com/series/G8WUNM123/title"],
    ["missing stable id", "https://www.crunchyroll.com/watch/"],
  ])("rejects %s", (_name, url) => {
    mockLocation(url);
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 1 });
    Object.defineProperty(video, "duration", { configurable: true, value: 2 });

    expect(getCrunchyrollHistoryObservation({
      adapter: { id: "crunchyroll", provider: "crunchyroll", video, getTitle: () => "Episode" } as never,
    })).toBeNull();
  });

  it("extracts an episode progress entry from a Crunchyroll watch URL", () => {
    mockLocation("https://www.crunchyroll.com/ru/watch/G8WUNM123/e4-bold-step#anidachiRoom=room-1");
    document.title = "E4 - Смелый шаг - Watch on Crunchyroll";
    document.body.innerHTML = `<a href="/ru/series/GYEXAMPLE/my-hero-academia">My Hero Academia</a>`;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 873 });
    Object.defineProperty(video, "duration", { configurable: true, value: 3159 });

    const entry = getCrunchyrollProgressEntry({
      title: "E4 - Смелый шаг",
      video,
      roomId: "room-1",
      watchedWithCount: 2,
    });

    expect(entry).toMatchObject({
      provider: "crunchyroll",
      kind: "episode",
      itemId: "crunchyroll-series:my-hero-academia",
      itemTitle: "My Hero Academia",
      contentId: "G8WUNM123",
      episodeId: "G8WUNM123",
      episodeTitle: "E4 - Смелый шаг",
      currentTime: 873,
      duration: 3159,
      roomId: "room-1",
      watchedWithCount: 2,
    });
    expect(entry?.sourceUrl).toBe("https://www.crunchyroll.com/ru/watch/G8WUNM123/e4-bold-step");
  });

  it("treats a movie-looking Crunchyroll watch page as a movie item", () => {
    mockLocation(
      "https://www.crunchyroll.com/ru/watch/GMEE00351495ENUS/chainsaw-man--the-movie-reze-arc",
    );
    document.title = "Человек-бензопила – Фильм: История Резе - Watch on Crunchyroll";
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 1200 });
    Object.defineProperty(video, "duration", { configurable: true, value: 6200 });

    const entry = getCrunchyrollProgressEntry({
      title: "Человек-бензопила – Фильм: История Резе",
      video,
      watchedWithCount: 1,
    });

    expect(entry).toMatchObject({
      kind: "movie",
      itemId: "crunchyroll-movie:GMEE00351495ENUS",
      itemTitle: "Человек-бензопила – Фильм: История Резе",
      contentId: "GMEE00351495ENUS",
      episodeId: "GMEE00351495ENUS",
      currentTime: 1200,
      duration: 6200,
    });
  });

  it("uses Crunchyroll series links to classify localized episode titles", () => {
    mockLocation("https://www.crunchyroll.com/ru/watch/G8WUNEWJE/roaring-muscles");
    document.title = "Ревущие мышцы - Watch on Crunchyroll";
    document.body.innerHTML = `<a href="/ru/series/GYEXAMPLE/my-hero-academia">My Hero Academia</a>`;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 312 });
    Object.defineProperty(video, "duration", { configurable: true, value: 1430 });

    const entry = getCrunchyrollProgressEntry({
      title: "Ревущие мышцы",
      video,
      watchedWithCount: 1,
    });

    expect(entry).toMatchObject({
      kind: "episode",
      itemId: "crunchyroll-series:my-hero-academia",
      itemTitle: "My Hero Academia",
      contentId: "G8WUNEWJE",
      episodeId: "G8WUNEWJE",
      episodeTitle: "Ревущие мышцы",
    });
  });

  it("uses JSON-LD series metadata when visible links are missing", () => {
    const artworkUrl =
      "https://www.crunchyroll.com/imgsrv/display/thumbnail/480x720/catalog/crunchyroll/rezero.png";
    mockLocation("https://www.crunchyroll.com/ru/watch/GEVUZP0ZM/the-end");
    document.title = "The End of the Beginning - Watch on Crunchyroll";
    document.body.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "TVEpisode",
          "name": "The End of the Beginning",
          "partOfSeries": {
            "name": "Re:ZERO -Starting Life in Another World-",
            "image": {
              "@type": "ImageObject",
              "url": "${artworkUrl}"
            }
          }
        }
      </script>
    `;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 41 });
    Object.defineProperty(video, "duration", { configurable: true, value: 1500 });

    const entry = getCrunchyrollProgressEntry({
      title: "The End of the Beginning",
      video,
      watchedWithCount: 1,
    });

    expect(entry).toMatchObject({
      kind: "episode",
      itemId: "crunchyroll-series:re-zero-starting-life-in-another-world",
      itemTitle: "Re:ZERO -Starting Life in Another World-",
    });
    expect(entry?.artworkUrl).toBe(artworkUrl);
  });

  it("extracts Crunchyroll season metadata from JSON-LD", () => {
    mockLocation("https://www.crunchyroll.com/watch/G8WUNS207/the-view-from-the-summit");
    document.title = "S2 E7 - The View From the Summit - Watch on Crunchyroll";
    document.body.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "TVEpisode",
          "name": "S2 E7 - The View From the Summit",
          "partOfSeries": { "name": "Haikyu!!" },
          "partOfSeason": {
            "@type": "TVSeason",
            "name": "Haikyu!! Season 2",
            "seasonNumber": 2
          }
        }
      </script>
    `;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 600 });
    Object.defineProperty(video, "duration", { configurable: true, value: 1500 });

    const entry = getCrunchyrollProgressEntry({
      title: "S2 E7 - The View From the Summit",
      video,
      watchedWithCount: 1,
    });

    expect(entry).toMatchObject({
      kind: "episode",
      itemId: "crunchyroll-series:haikyu",
      itemTitle: "Haikyu!!",
      seasonId: "season-2",
      seasonTitle: "Season 2",
      seasonNumber: 2,
      episodeId: "G8WUNS207",
    });
  });

  it("falls back to title season markers when JSON-LD has no season object", () => {
    mockLocation("https://www.crunchyroll.com/watch/G8WUNS207/the-view-from-the-summit");
    document.body.innerHTML = `<a href="/series/GYEXAMPLE/haikyu">Haikyu!!</a>`;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 600 });
    Object.defineProperty(video, "duration", { configurable: true, value: 1500 });

    const entry = getCrunchyrollProgressEntry({
      title: "S2 E7 - The View From the Summit",
      video,
      watchedWithCount: 1,
    });

    expect(entry).toMatchObject({
      seasonId: "season-2",
      seasonTitle: "Season 2",
      seasonNumber: 2,
    });
  });

  it("infers known Crunchyroll season metadata from the watch URL when page metadata is missing", () => {
    mockLocation("https://www.crunchyroll.com/watch/GRP8P9XGR/lets-go-to-tokyo");
    document.title = "E1 - Let's Go To Tokyo!! - Watch on Crunchyroll";
    document.body.innerHTML = `<a href="/series/GYEXAMPLE/haikyu">Haikyu!!</a>`;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 456 });
    Object.defineProperty(video, "duration", { configurable: true, value: 1440 });

    const entry = getCrunchyrollProgressEntry({
      title: "E1 - Let's Go To Tokyo!!",
      video,
      watchedWithCount: 1,
    });

    expect(entry).toMatchObject({
      itemTitle: "Haikyu!!",
      episodeId: "GRP8P9XGR",
      seasonId: "season-2",
      seasonTitle: "Season 2",
      seasonNumber: 2,
    });
  });

  it("prefers known watch URL seasons over ambiguous Crunchyroll JSON-LD placeholders", () => {
    mockLocation(
      "https://www.crunchyroll.com/watch/GEVUZGE02/kaguya-wants-to-know--kaguya-wants-to-give-a-gift--chika-fujiwara-wants-to-confirm-it",
    );
    document.title =
      "E2 - Kaguya Wants to Know / Kaguya Wants to Give a Gift / Chika Fujiwara Wants to Confirm It - Watch on Crunchyroll";
    document.body.innerHTML = `
      <a href="/series/GRJ0J828Y/kaguya-sama-love-is-war">Kaguya-sama: Love Is War</a>
      <script type="application/ld+json">
        {
          "@type": "TVEpisode",
          "name": "E2 - Kaguya Wants to Know / Kaguya Wants to Give a Gift / Chika Fujiwara Wants to Confirm It",
          "partOfSeries": { "name": "Kaguya-sama: Love Is War" },
          "partOfSeason": {
            "@type": "TVSeason",
            "name": "?",
            "position": 2
          }
        }
      </script>
    `;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 42 });
    Object.defineProperty(video, "duration", { configurable: true, value: 1440 });

    const entry = getCrunchyrollProgressEntry({
      title: "E2 - Kaguya Wants to Know / Kaguya Wants to Give a Gift / Chika Fujiwara Wants to Confirm It",
      video,
      watchedWithCount: 1,
    });

    expect(entry).toMatchObject({
      itemTitle: "Kaguya-sama: Love Is War",
      episodeId: "GEVUZGE02",
      seasonId: "season-1",
      seasonTitle: "Season 1",
      seasonNumber: 1,
    });
  });

  it("infers ordinal Crunchyroll season metadata from page titles", () => {
    mockLocation("https://www.crunchyroll.com/watch/GUNKNOWN/lets-go-to-tokyo");
    document.head.innerHTML = `
      <meta property="og:title" content="HAIKYU!! 2nd Season Let's Go To Tokyo!! - Watch on Crunchyroll">
    `;
    document.body.innerHTML = `<a href="/series/GYEXAMPLE/haikyu">Haikyu!!</a>`;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 456 });
    Object.defineProperty(video, "duration", { configurable: true, value: 1440 });

    const entry = getCrunchyrollProgressEntry({
      title: "E1 - Let's Go To Tokyo!!",
      video,
      watchedWithCount: 1,
    });

    expect(entry).toMatchObject({
      seasonId: "season-2",
      seasonTitle: "Season 2",
      seasonNumber: 2,
    });
  });

  it("uses breadcrumb titles instead of Crunchyroll series URLs", () => {
    mockLocation(
      "https://www.crunchyroll.com/ru/watch/GEVUZP0ZM/the-end-of-the-beginning-and-the-beginning-of-the-end",
    );
    document.title =
      "Re:Zero — жизнь с нуля в другом мире. Режиссёрская версия Конец начала и начало конца - смотреть на Crunchyroll";
    document.head.innerHTML = `
      <meta property="video:series" content="https://www.crunchyroll.com/ru/series/GRGG9798R/rezero--starting-life-in-another-world-">
    `;
    document.body.innerHTML = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home" },
            { "@type": "ListItem", "position": 2, "name": "Фэнтези" },
            {
              "@type": "ListItem",
              "position": 3,
              "name": "Re:Zero — жизнь с нуля в другом мире",
              "item": "https://www.crunchyroll.com/ru/series/GRGG9798R/rezero--starting-life-in-another-world-"
            }
          ]
        }
      </script>
    `;
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 84 });
    Object.defineProperty(video, "duration", { configurable: true, value: 3160 });

    const entry = getCrunchyrollProgressEntry({
      title: "E1 - Конец начала и начало конца",
      video,
      watchedWithCount: 1,
    });

    expect(entry).toMatchObject({
      kind: "episode",
      itemId: "crunchyroll-series:rezero-starting-life-in-another-world",
      itemTitle: "Re:Zero — жизнь с нуля в другом мире",
      contentId: "GEVUZP0ZM",
      seriesId: "GRGG9798R",
    });
    expect(entry?.artworkUrl).toBeUndefined();
    expect(entry?.itemTitle).not.toContain("crunchyroll.com");
  });

  it("returns null outside active Crunchyroll watch pages", () => {
    mockLocation("https://www.crunchyroll.com/ru/series/GYEXAMPLE/example");
    const video = document.createElement("video");

    expect(
      getCrunchyrollProgressEntry({
        title: "Example",
        video,
        watchedWithCount: 1,
      }),
    ).toBeNull();
  });
});

function mockLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url),
  });
}
