import { afterEach, describe, expect, it } from "vitest";
import { getYouTubeHistoryObservation } from "../../../src/source-adapters/youtube/progress";
import type { VideoAdapter } from "../../../src/source-adapters/core/types";

describe("YouTube history policy", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("fails closed until canonical preferences have loaded and explicitly enable YouTube", () => {
    mockLocation("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const adapter = fakeAdapter();

    expect(getYouTubeHistoryObservation({ adapter, preferences: null })).toBeNull();
    expect(getYouTubeHistoryObservation({ adapter, preferences: { youtubeHistoryEnabled: false } })).toBeNull();
    expect(getYouTubeHistoryObservation({ adapter, preferences: { youtubeHistoryEnabled: true } }))
      .toMatchObject({ provider: "youtube", titleKey: "youtube:dQw4w9WgXcQ" });
  });

  it.each([
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/preview?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://example.com/watch?v=dQw4w9WgXcQ",
  ])("rejects non-canonical history route %s", (url) => {
    mockLocation(url);

    expect(getYouTubeHistoryObservation({
      adapter: fakeAdapter(),
      preferences: { youtubeHistoryEnabled: true },
    })).toBeNull();
  });

  it("accepts a short valid long-form video without a duration or watched-time threshold", () => {
    mockLocation("https://m.youtube.com/watch?v=dQw4w9WgXcQ#anidachiRoom=room-1");
    const adapter = fakeAdapter({ currentTime: 0.1, duration: 0.2 });

    expect(getYouTubeHistoryObservation({
      adapter,
      preferences: { youtubeHistoryEnabled: true },
    })).toMatchObject({
      titleKey: "youtube:dQw4w9WgXcQ",
      episodeKey: "youtube:dQw4w9WgXcQ",
      currentTime: 0.1,
      duration: 0.2,
      sourceUrl: "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("rejects invalid media values", () => {
    mockLocation("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(getYouTubeHistoryObservation({
      adapter: fakeAdapter({ currentTime: -1, duration: 120 }),
      preferences: { youtubeHistoryEnabled: true },
    })).toBeNull();
    expect(getYouTubeHistoryObservation({
      adapter: fakeAdapter({ currentTime: 1, duration: Number.NaN }),
      preferences: { youtubeHistoryEnabled: true },
    })).toBeNull();
  });
});

function fakeAdapter(input: { currentTime?: number; duration?: number } = {}): VideoAdapter {
  const video = document.createElement("video");
  Object.defineProperty(video, "currentTime", { configurable: true, value: input.currentTime ?? 12 });
  Object.defineProperty(video, "duration", { configurable: true, value: input.duration ?? 120 });
  return { id: "youtube", provider: "youtube", video, getTitle: () => "A short title" } as VideoAdapter;
}

function mockLocation(url: string): void {
  Object.defineProperty(window, "location", { configurable: true, value: new URL(url) });
}
