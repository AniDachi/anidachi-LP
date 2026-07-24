import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YouTubeVideoAdapter } from "../../../src/source-adapters/youtube/adapter";
import { YouTubePlaybackPhaseTracker } from "../../../src/source-adapters/youtube/playback-phase";

describe("YouTube playback phase tracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-23T00:00:00Z"));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports content for a ready watch video", () => {
    const { tracker } = createHarness();

    expect(tracker.getSnapshot()).toMatchObject({
      phase: "content",
      contentTime: 12,
      playing: true,
      playbackRate: 1,
    });
  });

  it("reports interstitial when the player has the ad-showing class", () => {
    const { player, tracker } = createHarness();
    player.classList.add("ad-showing");

    expect(tracker.getSnapshot().phase).toBe("interstitial");
  });

  it("does not confirm an interstitial from one weak marker alone", () => {
    const { player, tracker } = createHarness();
    appendVisibleMarker(player, "ytp-ad-module ytp-ad-text");

    expect(tracker.getSnapshot().phase).toBe("content");
  });

  it("confirms an interstitial from corroborated visible ad signals", () => {
    const { player, tracker } = createHarness();
    appendVisibleMarker(player, "ytp-ad-module");
    appendVisibleMarker(player, "ytp-ad-text");

    expect(tracker.getSnapshot().phase).toBe("interstitial");
  });

  it("ignores hidden persistent ad-module nodes", () => {
    const { player, tracker } = createHarness();
    const module = appendVisibleMarker(player, "ytp-ad-module");
    module.hidden = true;
    appendVisibleMarker(player, "ytp-ad-text");

    expect(tracker.getSnapshot().phase).toBe("content");
  });

  it("does not exit between consecutive ads in one ad pod", () => {
    const { player, tracker } = createHarness();
    player.classList.add("ad-showing");
    expect(tracker.getSnapshot().phase).toBe("interstitial");

    player.classList.remove("ad-showing");
    vi.advanceTimersByTime(400);
    expect(tracker.getSnapshot().phase).toBe("interstitial");

    player.classList.add("ad-showing");
    vi.advanceTimersByTime(400);
    expect(tracker.getSnapshot().phase).toBe("interstitial");
  });

  it("does not leak an ad media event that beats the observer callback", () => {
    const { player, video } = createHarness();
    const adapter = new YouTubeVideoAdapter(video, player);
    const events: string[] = [];
    const dispose = adapter.subscribe((event) => events.push(event.type));
    events.length = 0;

    player.classList.add("ad-showing");
    video.dispatchEvent(new Event("play"));

    expect(events).not.toContain("play");
    expect(adapter.getPlaybackSnapshot().phase).toBe("interstitial");
    dispose();
  });

  it("keeps ad buffering inside the interstitial phase", () => {
    const { player, tracker, video } = createHarness();
    player.classList.add("ad-showing");
    setMediaState(video, { readyState: 2 });

    expect(tracker.getSnapshot().phase).toBe("interstitial");
  });

  it("prefers transition when an ad signal overlaps a SPA source change", () => {
    let currentVideoId = "video-a";
    const { player, tracker } = createHarness({
      expectedVideoId: "video-a",
      getCurrentVideoId: () => currentVideoId,
    });
    player.classList.add("ad-showing");
    currentVideoId = "video-b";

    expect(tracker.getSnapshot().phase).toBe("transition");
  });

  it("reports transition when the watch id and adapter fingerprint disagree", () => {
    const { tracker } = createHarness({
      expectedVideoId: "video-a",
      getCurrentVideoId: () => "video-b",
    });

    expect(tracker.getSnapshot().phase).toBe("transition");
  });

  it("reports buffering for content with insufficient readyState", () => {
    const { tracker, video } = createHarness();
    setMediaState(video, { readyState: 2 });

    expect(tracker.getSnapshot().phase).toBe("buffering");
  });

  it("reports buffering while a ready video is temporarily waiting", () => {
    const { tracker, video } = createHarness();
    const dispose = tracker.subscribe(() => undefined);

    video.dispatchEvent(new Event("waiting"));
    expect(tracker.getSnapshot().phase).toBe("buffering");

    video.dispatchEvent(new Event("canplay"));
    expect(tracker.getSnapshot().phase).toBe("content");
    dispose();
  });

  it("reports unsupported for live or non-finite media after metadata is ready", () => {
    const { tracker, video } = createHarness();
    setMediaState(video, {
      duration: Number.POSITIVE_INFINITY,
      readyState: 1,
    });

    expect(tracker.getSnapshot().phase).toBe("unsupported");
  });

  it("keeps loading media in transition instead of prematurely calling it unsupported", () => {
    const { tracker, video } = createHarness();
    setMediaState(video, {
      duration: Number.NaN,
      readyState: 0,
    });

    expect(tracker.getSnapshot().phase).toBe("transition");
  });

  it("keeps the last content time while an interstitial video time advances", () => {
    const { player, tracker, video } = createHarness();
    expect(tracker.getSnapshot().contentTime).toBe(12);

    player.classList.add("ad-showing");
    setMediaState(video, { currentTime: 25 });

    expect(tracker.getSnapshot()).toMatchObject({
      phase: "interstitial",
      contentTime: 12,
    });
  });

  it("returns to content with the new content time after the ad", () => {
    const { player, tracker, video } = createHarness();
    expect(tracker.getSnapshot().contentTime).toBe(12);
    player.classList.add("ad-showing");
    expect(tracker.getSnapshot().phase).toBe("interstitial");

    player.classList.remove("ad-showing");
    setMediaState(video, { currentTime: 44 });
    vi.advanceTimersByTime(501);

    expect(tracker.getSnapshot()).toMatchObject({
      phase: "content",
      contentTime: 44,
    });
  });

  it("scopes its observer to the player and disconnects listeners exactly once", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "MutationObserver",
      class {
        observe = observe;
        disconnect = disconnect;
        takeRecords = vi.fn(() => []);
      },
    );
    const { player, tracker, video } = createHarness();
    appendVisibleMarker(player, "ytp-ad-module");
    const removeEventListener = vi.spyOn(video, "removeEventListener");

    const dispose = tracker.subscribe(() => undefined);
    dispose();
    dispose();

    expect(observe).toHaveBeenCalled();
    for (const [target] of observe.mock.calls) {
      expect(target === player || player.contains(target as Node)).toBe(true);
    }
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledTimes(7);
  });
});

interface HarnessOptions {
  expectedVideoId?: string;
  getCurrentVideoId?: () => string | null;
}

function createHarness(options: HarnessOptions = {}) {
  document.body.innerHTML = `
    <div id="movie_player" class="html5-video-player">
      <video></video>
    </div>
  `;
  mockLocation("https://www.youtube.com/watch?v=video-a");
  const player = document.querySelector("#movie_player") as HTMLElement;
  const video = player.querySelector("video") as HTMLVideoElement;
  setMediaState(video, {
    currentTime: 12,
    duration: 120,
    paused: false,
    playbackRate: 1,
    readyState: 4,
  });
  const tracker = new YouTubePlaybackPhaseTracker({
    expectedVideoId: options.expectedVideoId ?? "video-a",
    getCurrentVideoId: options.getCurrentVideoId ?? (() => "video-a"),
    player,
    video,
  });
  return { player, tracker, video };
}

function appendVisibleMarker(player: HTMLElement, className: string): HTMLElement {
  const marker = document.createElement("div");
  marker.className = className;
  Object.defineProperty(marker, "getBoundingClientRect", {
    configurable: true,
    value: () => ({ height: 10, width: 10 }),
  });
  player.append(marker);
  return marker;
}

function setMediaState(
  video: HTMLVideoElement,
  state: Partial<
    Pick<
      HTMLVideoElement,
      "currentTime" | "duration" | "paused" | "playbackRate" | "readyState"
    >
  >,
): void {
  for (const [key, value] of Object.entries(state)) {
    Object.defineProperty(video, key, {
      configurable: true,
      value,
      writable: true,
    });
  }
}

function mockLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url),
  });
}
