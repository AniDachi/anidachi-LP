import { describe, expect, it, vi } from "vitest";
import { bindWatchHistoryPlaybackListeners } from "../src/watch-history-listeners";
import type { WatchHistoryController } from "../src/watch-history-controller";

describe("watch history playback listener binding", () => {
  it("marks only real playing events as catalog interactions", async () => {
    const video = document.createElement("video");
    const interaction = vi.fn(async () => undefined);
    const cleanup = bindWatchHistoryPlaybackListeners({ video, controller: {
      observe: async () => undefined, recover: async () => undefined, dispose: async () => undefined,
      noteSeeking: async () => undefined, notePlaybackInteraction: interaction,
    }, setInterval: () => 1, clearInterval: () => undefined });
    video.dispatchEvent(new Event("playing"));
    expect(interaction).toHaveBeenCalledOnce();
    cleanup();
    video.dispatchEvent(new Event("playing"));
    expect(interaction).toHaveBeenCalledOnce();
  });
  it("captures the latest position when the document becomes hidden", async () => {
    const video = document.createElement("video");
    const onObserve = vi.fn<WatchHistoryController["observe"]>(async () => undefined);
    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, "visibilityState");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const cleanup = bindWatchHistoryPlaybackListeners({
      video,
      controller: {
        observe: onObserve,
        noteSeeking: async () => undefined,
        recover: async () => undefined,
        dispose: async () => undefined,
      },
      setInterval: () => 1,
      clearInterval: () => undefined,
    });

    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();

    expect(onObserve).toHaveBeenCalledWith("pagehide");
    cleanup();
    if (originalVisibilityState) {
      Object.defineProperty(document, "visibilityState", originalVisibilityState);
    }
  });

  it("binds real media/window events, contains detached errors, and disposes exactly once", async () => {
    const video = document.createElement("video");
    const onObserve = vi.fn<(kind: Parameters<WatchHistoryController["observe"]>[0]) => Promise<void>>(
      async () => { throw new Error("offline"); },
    );
    const onSeeking = vi.fn<() => Promise<void>>(async () => { throw new Error("offline"); });
    const onDispose = vi.fn<() => Promise<void>>(async () => { throw new Error("offline"); });
    const onRecover = vi.fn<() => Promise<void>>(async () => { throw new Error("offline"); });
    const clearInterval = vi.fn();
    let heartbeat: () => void = () => { throw new Error("heartbeat was not bound"); };
    const cleanup = bindWatchHistoryPlaybackListeners({
      video,
      controller: { observe: onObserve, noteSeeking: onSeeking, recover: onRecover, dispose: onDispose },
      setInterval: (callback) => {
        heartbeat = callback;
        return 1;
      },
      clearInterval,
    });

    video.dispatchEvent(new Event("pause"));
    video.dispatchEvent(new Event("seeking"));
    video.dispatchEvent(new Event("seeked"));
    video.dispatchEvent(new Event("ended"));
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("online"));
    heartbeat();
    await Promise.resolve();

    expect(onObserve.mock.calls.map(([kind]) => kind)).toEqual(["pause", "seek", "ended", "pagehide", "heartbeat"]);
    expect(onSeeking).toHaveBeenCalledTimes(1);
    expect(onRecover).toHaveBeenCalledTimes(1);
    cleanup();
    cleanup();
    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(clearInterval).toHaveBeenCalledOnce();
    expect(clearInterval).toHaveBeenCalledWith(1);

    video.dispatchEvent(new Event("pause"));
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("online"));
    heartbeat();
    await Promise.resolve();
    expect(onObserve).toHaveBeenCalledTimes(5);
    expect(onRecover).toHaveBeenCalledTimes(1);
  });
});
