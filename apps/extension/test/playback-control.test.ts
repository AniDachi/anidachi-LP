import { describe, expect, it, vi } from "vitest";
import { getCrunchyrollTimelineValueForTime } from "../src/crunchyroll-control";
import {
  getRemotePlayReadyTimeoutMs,
  isMediaTimeBuffered,
  isMediaSettling,
  shouldDeferHostStateSeek,
  shouldPlayWithoutWaitingForMediaReady,
  shouldSeekForHostState,
  shouldSeekForRemoteCommand,
  shouldThrottleRemoteSeekAttempt,
  waitForMediaReady,
} from "../src/playback-control";

describe("playback control helpers", () => {
  it("treats ready media as immediately playable", async () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "readyState", { configurable: true, value: 3 });
    Object.defineProperty(video, "seeking", { configurable: true, value: false });

    await expect(waitForMediaReady(video)).resolves.toBe("ready");
    expect(isMediaSettling(video)).toBe(false);
  });

  it("waits until a seeking media element becomes ready", async () => {
    vi.useFakeTimers();
    const video = document.createElement("video");
    let readyState = 1;
    let seeking = true;
    Object.defineProperty(video, "readyState", { configurable: true, get: () => readyState });
    Object.defineProperty(video, "seeking", { configurable: true, get: () => seeking });

    const ready = waitForMediaReady(video, 1000);
    readyState = 3;
    seeking = false;
    video.dispatchEvent(new Event("seeked"));

    await expect(ready).resolves.toBe("seeked");
    vi.useRealTimers();
  });

  it("forces explicit remote command seeks through stale settling media", () => {
    expect(shouldSeekForRemoteCommand(0.8, true)).toBe(false);
    expect(shouldSeekForRemoteCommand(1.6, false)).toBe(true);
    expect(shouldSeekForRemoteCommand(3, true)).toBe(true);
  });

  it("auto-seeks catch-up host state even while Crunchyroll is settling", () => {
    expect(shouldSeekForHostState("seek", true)).toBe(false);
    expect(shouldDeferHostStateSeek("seek", true)).toBe(true);
    expect(shouldSeekForHostState("catch-up", true)).toBe(true);
    expect(shouldDeferHostStateSeek("catch-up", true)).toBe(false);
  });

  it("starts Crunchyroll playback immediately so the player can fetch the seek target", () => {
    expect(shouldPlayWithoutWaitingForMediaReady("crunchyroll")).toBe(true);
    expect(shouldPlayWithoutWaitingForMediaReady("youtube")).toBe(false);
  });

  it("allows a longer remote play readiness window on Crunchyroll", () => {
    expect(getRemotePlayReadyTimeoutMs("crunchyroll")).toBe(6500);
    expect(getRemotePlayReadyTimeoutMs("youtube")).toBe(2500);
  });

  it("throttles repeated Crunchyroll remote seeks to the same target window", () => {
    const previousAttempt = { attemptedAt: 10_000, targetTime: 728.5 };

    expect(shouldThrottleRemoteSeekAttempt("crunchyroll", previousAttempt, 729.25, 11_000)).toBe(
      true,
    );
    expect(shouldThrottleRemoteSeekAttempt("crunchyroll", previousAttempt, 735, 11_000)).toBe(
      false,
    );
    expect(shouldThrottleRemoteSeekAttempt("crunchyroll", previousAttempt, 729.25, 13_000)).toBe(
      false,
    );
    expect(shouldThrottleRemoteSeekAttempt("youtube", previousAttempt, 729.25, 11_000)).toBe(
      false,
    );
  });

  it("detects whether a requested media time is already buffered", () => {
    const video = document.createElement("video");
    Object.defineProperty(video, "buffered", {
      configurable: true,
      value: {
        length: 2,
        start: (index: number) => (index === 0 ? 10 : 40),
        end: (index: number) => (index === 0 ? 20 : 55),
      },
    });

    expect(isMediaTimeBuffered(video, 10)).toBe(true);
    expect(isMediaTimeBuffered(video, 55)).toBe(true);
    expect(isMediaTimeBuffered(video, 39.8)).toBe(true);
    expect(isMediaTimeBuffered(video, 30)).toBe(false);
  });

  it("maps Crunchyroll seek time to timeline input scale", () => {
    expect(getCrunchyrollTimelineValueForTime(50, 200, 0, 100)).toBe(25);
    expect(getCrunchyrollTimelineValueForTime(50, 200, 0, 200)).toBe(50);
    expect(getCrunchyrollTimelineValueForTime(50, null, 0, 100)).toBe(50);
  });
});
