import { afterEach, describe, expect, it } from "vitest";
import { HISTORY_OBSERVATION_SUSPENDED } from "../../../src/source-adapters/core/history-policy";
import type {
  AdapterPlaybackPhase,
  VideoAdapter,
} from "../../../src/source-adapters/core/types";
import { getYouTubeHistoryObservation } from "../../../src/source-adapters/youtube/progress";

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
      .toMatchObject({ provider: "youtube", providerLabel: "YouTube", titleKey: "youtube:video:dQw4w9WgXcQ" });
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
      titleKey: "youtube:video:dQw4w9WgXcQ",
      episodeKey: "youtube:video:dQw4w9WgXcQ",
      currentTime: 0.1,
      duration: 0.2,
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("uses the confirmed content clock instead of the raw media clock", () => {
    mockLocation("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const adapter = fakeAdapter({
      currentTime: 30,
      duration: 120,
      contentTime: 12,
      phase: "content",
    });

    expect(getYouTubeHistoryObservation({
      adapter,
      preferences: { youtubeHistoryEnabled: true },
    })).toMatchObject({
      currentTime: 12,
      duration: 120,
      progress: 0.1,
    });
  });

  it.each([
    "interstitial",
    "buffering",
    "transition",
    "unsupported",
  ] as const)("suspends history while playback phase is %s", (phase) => {
    mockLocation("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    expect(getYouTubeHistoryObservation({
      adapter: fakeAdapter({ currentTime: 30, duration: 30, contentTime: 600, phase }),
      preferences: { youtubeHistoryEnabled: true },
    })).toBe(HISTORY_OBSERVATION_SUSPENDED);
  });

  it("keeps bare YouTube watch URLs inside the server-approved canonical host set", () => {
    mockLocation("https://youtube.com/watch?v=dQw4w9WgXcQ");

    expect(getYouTubeHistoryObservation({
      adapter: fakeAdapter(),
      preferences: { youtubeHistoryEnabled: true },
    })).toMatchObject({ sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
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

  it("uses the current video thumbnail after YouTube navigation, independent of stale page metadata", () => {
    document.head.innerHTML = '<meta property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg">';
    for (const videoId of ["dQw4w9WgXcQ", "FyS5dAywkEo"]) {
      mockLocation(`https://www.youtube.com/watch?v=${videoId}`);
      expect(getYouTubeHistoryObservation({
        adapter: fakeAdapter(), preferences: { youtubeHistoryEnabled: true },
      })).toMatchObject({
        artworkUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        titleKey: `youtube:video:${videoId}`,
      });
    }
  });
});

function fakeAdapter(input: {
  currentTime?: number;
  duration?: number;
  contentTime?: number;
  phase?: AdapterPlaybackPhase;
} = {}): VideoAdapter {
  const video = document.createElement("video");
  Object.defineProperty(video, "currentTime", { configurable: true, value: input.currentTime ?? 12 });
  Object.defineProperty(video, "duration", { configurable: true, value: input.duration ?? 120 });
  return {
    id: "youtube",
    provider: "youtube",
    video,
    getTitle: () => "A short title",
    getPlaybackSnapshot: () => ({
      phase: input.phase ?? "content",
      contentTime: input.contentTime ?? input.currentTime ?? 12,
      playing: true,
      playbackRate: 1,
      capturedAt: 1_700_000_000_000,
    }),
  } as VideoAdapter;
}

function mockLocation(url: string): void {
  Object.defineProperty(window, "location", { configurable: true, value: new URL(url) });
}
