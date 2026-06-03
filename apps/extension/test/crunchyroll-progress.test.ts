import { afterEach, describe, expect, it } from "vitest";
import { getCrunchyrollProgressEntry } from "../src/crunchyroll-progress";

describe("Crunchyroll progress extraction", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
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
    mockLocation("https://www.crunchyroll.com/ru/watch/GEVUZP0ZM/the-end");
    document.title = "The End of the Beginning - Watch on Crunchyroll";
    document.body.innerHTML = `
      <script type="application/ld+json">
        {
          "@type": "TVEpisode",
          "name": "The End of the Beginning",
          "partOfSeries": { "name": "Re:ZERO -Starting Life in Another World-" }
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
