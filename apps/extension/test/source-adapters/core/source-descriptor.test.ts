import { MAX_URL_CHARS, MAX_WATCH_TITLE_CHARS, type PlaybackState } from "@anidachi/protocol";
import { describe, expect, it } from "vitest";
import { buildWatchSourceDescriptor } from "../../../src/source-adapters/core/source-descriptor";
import { DEFAULT_PLAYER_OVERLAY_GEOMETRY } from "../../../src/source-adapters/core/overlay-geometry";
import type { VideoAdapter } from "../../../src/source-adapters/core/types";

describe("buildWatchSourceDescriptor", () => {
  it("canonicalizes the adapter state URL and includes finite video duration", () => {
    mockLocation("https://example.com/watch/current");
    const adapter = createAdapter({ duration: 1420, id: "youtube", title: " Episode title " });
    const state = createPlaybackState(
      "https://example.com/watch/episode-1#anidachiRoom=room-1&chapter=2",
    );

    expect(buildWatchSourceDescriptor(adapter, state)).toEqual({
      canonicalUrl: "https://example.com/watch/episode-1#chapter=2",
      duration: 1420,
      provider: "youtube",
      sourceUrl: "https://example.com/watch/episode-1#chapter=2",
      title: "Episode title",
      videoFingerprint: "youtube|episode-1",
    });
  });

  it("uses the current page context for the URL and title fallbacks", () => {
    mockLocation("https://example.com/watch/current#anidachiRoom=room-1&chapter=2");
    document.title = "Current page title";
    const adapter = createAdapter({ id: "crunchyroll", title: "  " });

    expect(buildWatchSourceDescriptor(adapter, createPlaybackState())).toMatchObject({
      canonicalUrl: "https://example.com/watch/current#chapter=2",
      provider: "crunchyroll",
      title: "Current page title",
    });

    document.title = "";
    expect(buildWatchSourceDescriptor(adapter, createPlaybackState())).toMatchObject({
      title: "Test adapter",
    });
  });

  it("bounds titles, omits non-finite durations, and rejects overlong URLs", () => {
    mockLocation("https://example.com/watch/current");
    const adapter = createAdapter({
      duration: Number.POSITIVE_INFINITY,
      id: "other-provider",
      title: "T".repeat(MAX_WATCH_TITLE_CHARS + 1),
    });

    expect(buildWatchSourceDescriptor(adapter, createPlaybackState())).toMatchObject({
      provider: "generic",
      title: "T".repeat(MAX_WATCH_TITLE_CHARS),
    });
    expect(buildWatchSourceDescriptor(adapter, createPlaybackState())).not.toHaveProperty("duration");
    expect(
      buildWatchSourceDescriptor(adapter, createPlaybackState(`https://example.com/${"a".repeat(MAX_URL_CHARS)}`)),
    ).toBeUndefined();
  });
});

function createAdapter({
  duration = Number.NaN,
  id = "generic-html5-video",
  title = null,
}: {
  duration?: number;
  id?: string;
  title?: string | null;
} = {}): VideoAdapter {
  const video = document.createElement("video");
  Object.defineProperty(video, "duration", { configurable: true, value: duration });

  return {
    container: document.body,
    duckVolume: () => () => undefined,
    enterFullscreen: async () => undefined,
    exitFullscreen: async () => undefined,
    getCurrentTime: () => 0,
    getFingerprint: () => "test|fingerprint",
    getOverlayGeometry: () => DEFAULT_PLAYER_OVERLAY_GEOMETRY,
    getState: () => createPlaybackState(),
    getTitle: () => title,
    id,
    isFullscreen: () => false,
    name: "Test adapter",
    pause: () => undefined,
    play: async () => undefined,
    seek: () => undefined,
    subscribe: () => () => undefined,
    subscribeOverlayGeometry: () => () => undefined,
    video,
  };
}

function createPlaybackState(sourceUrl?: string): PlaybackState {
  return {
    hostTime: 0,
    playbackRate: 1,
    playing: false,
    ...(sourceUrl ? { sourceUrl } : {}),
    updatedAt: 1,
    videoFingerprint: "youtube|episode-1",
  };
}

function mockLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url),
  });
}
