import { afterEach, describe, expect, it } from "vitest";
import { getWatchProgressEntryForAdapter } from "../src/watch-progress-entry";
import type { VideoAdapter } from "../src/source-adapters/core/types";

describe("watch progress entry extraction", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  it("extracts YouTube movie progress without persisting the room hash in sourceUrl", () => {
    mockLocation("https://www.youtube.com/watch?v=dQw4w9WgXcQ#anidachiRoom=room-1");
    const video = document.createElement("video");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 42 });
    Object.defineProperty(video, "duration", { configurable: true, value: 180 });

    const entry = getWatchProgressEntryForAdapter({
      adapter: fakeAdapter({
        id: "youtube",
        title: "Anime opening",
        video,
      }),
      roomId: "room-1",
      watchedWithCount: 2,
    });

    expect(entry).toMatchObject({
      provider: "youtube",
      kind: "movie",
      itemId: "youtube:dQw4w9WgXcQ",
      itemTitle: "Anime opening",
      contentId: "dQw4w9WgXcQ",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      currentTime: 42,
      duration: 180,
      roomId: "room-1",
      watchedWithCount: 2,
    });
  });

  it.each([
    ["blank v on a Shorts path", "https://www.youtube.com/shorts/dQw4w9WgXcQ?v="],
    ["invalid v on a Shorts path", "https://www.youtube.com/shorts/dQw4w9WgXcQ?v=short"],
    ["blank v on an embed path", "https://www.youtube.com/embed/dQw4w9WgXcQ?v="],
    ["invalid v on an embed path", "https://www.youtube.com/embed/dQw4w9WgXcQ?v=short"],
  ])("does not persist YouTube progress for %s", (_caseName, url) => {
    mockLocation(url);
    const video = document.createElement("video");

    expect(
      getWatchProgressEntryForAdapter({
        adapter: fakeAdapter({ id: "youtube", title: "Anime opening", video }),
        watchedWithCount: 1,
      }),
    ).toBeNull();
  });

  it("ignores unsupported generic video adapters", () => {
    mockLocation("https://example.com/watch/1");
    const video = document.createElement("video");

    expect(
      getWatchProgressEntryForAdapter({
        adapter: fakeAdapter({ id: "generic-html5-video", title: "Example", video }),
        watchedWithCount: 1,
      }),
    ).toBeNull();
  });
});

function fakeAdapter(input: {
  id: string;
  title: string;
  video: HTMLVideoElement;
}): VideoAdapter {
  const container = document.createElement("div");
  return {
    id: input.id,
    name: input.id,
    video: input.video,
    container,
    getTitle: () => input.title,
    getFingerprint: () => `${input.id}|test`,
    getCurrentTime: () => input.video.currentTime || 0,
    getState: () => ({
      videoFingerprint: `${input.id}|test`,
      sourceUrl: location.href,
      playing: false,
      hostTime: input.video.currentTime || 0,
      updatedAt: Date.now(),
      playbackRate: 1,
    }),
    play: async () => {},
    pause: () => {},
    seek: () => {},
    subscribe: () => () => {},
    duckVolume: () => () => {},
    isFullscreen: () => false,
    enterFullscreen: async () => {},
    exitFullscreen: async () => {},
  };
}

function mockLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url),
  });
}
