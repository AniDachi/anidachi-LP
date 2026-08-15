import { describe, expect, it, vi } from "vitest";
import { bindWatchHistoryPlaybackListeners } from "../src/watch-history-listeners";
import type { WatchHistoryController } from "../src/watch-history-controller";

describe("watch history playback listener binding", () => {
  it("binds real media/window events, contains detached errors, and disposes exactly once", async () => {
    const video = document.createElement("video");
    const onObserve = vi.fn<(kind: Parameters<WatchHistoryController["observe"]>[0]) => Promise<void>>(
      async () => { throw new Error("offline"); },
    );
    const onSeeking = vi.fn<() => Promise<void>>(async () => { throw new Error("offline"); });
    const onDispose = vi.fn<() => Promise<void>>(async () => { throw new Error("offline"); });
    const clearInterval = vi.fn();
    let heartbeat: () => void = () => { throw new Error("heartbeat was not bound"); };
    const cleanup = bindWatchHistoryPlaybackListeners({
      video,
      controller: { observe: onObserve, noteSeeking: onSeeking, dispose: onDispose },
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
    heartbeat();
    await Promise.resolve();

    expect(onObserve.mock.calls.map(([kind]) => kind)).toEqual(["pause", "seek", "ended", "pagehide", "heartbeat"]);
    expect(onSeeking).toHaveBeenCalledTimes(1);
    cleanup();
    cleanup();
    expect(onDispose).toHaveBeenCalledTimes(1);
    expect(clearInterval).toHaveBeenCalledOnce();
    expect(clearInterval).toHaveBeenCalledWith(1);

    video.dispatchEvent(new Event("pause"));
    window.dispatchEvent(new Event("pagehide"));
    heartbeat();
    await Promise.resolve();
    expect(onObserve).toHaveBeenCalledTimes(5);
  });
});
