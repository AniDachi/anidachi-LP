import type { WatchHistoryController } from "./watch-history-controller";

type WatchHistoryPlaybackController = Pick<
  WatchHistoryController,
  "dispose" | "noteSeeking" | "observe" | "recover"
> & Partial<Pick<WatchHistoryController, "notePlaybackInteraction">>;

export type WatchHistoryListenerBindingOptions = {
  video: HTMLVideoElement;
  controller: WatchHistoryPlaybackController;
  setInterval?: (callback: () => void, timeout: number) => number;
  clearInterval?: (timer: number) => void;
  windowTarget?: Window;
};

export function bindWatchHistoryPlaybackListeners(
  options: WatchHistoryListenerBindingOptions,
): () => void {
  const windowTarget = options.windowTarget ?? window;
  const documentTarget = options.video.ownerDocument ?? document;
  const setIntervalFn = options.setInterval ?? windowTarget.setInterval.bind(windowTarget);
  const clearIntervalFn = options.clearInterval ?? windowTarget.clearInterval.bind(windowTarget);
  let disposed = false;
  const invoke = (callback: () => Promise<void>) => {
    try {
      void callback().catch(() => undefined);
    } catch {
      // Content lifecycle callbacks must not surface detached promise failures.
    }
  };
  const heartbeat = () => {
    if (!disposed) invoke(() => options.controller.observe("heartbeat"));
  };
  const pause = () => {
    if (!disposed) invoke(() => options.controller.observe("pause"));
  };
  const playing = () => {
    if (!disposed && options.controller.notePlaybackInteraction) invoke(() => options.controller.notePlaybackInteraction!());
  };
  const seeking = () => {
    if (!disposed) invoke(() => options.controller.noteSeeking());
  };
  const seeked = () => {
    if (!disposed) invoke(() => options.controller.observe("seek"));
  };
  const ended = () => {
    if (!disposed) invoke(() => options.controller.observe("ended"));
  };
  const pagehide = () => {
    if (!disposed) invoke(() => options.controller.observe("pagehide"));
  };
  const visibilitychange = () => {
    if (!disposed && documentTarget.visibilityState === "hidden") {
      invoke(() => options.controller.observe("pagehide"));
    }
  };
  const online = () => {
    if (!disposed) invoke(() => options.controller.recover());
  };
  const interval = setIntervalFn(heartbeat, 5_000);
  options.video.addEventListener("pause", pause);
  options.video.addEventListener("playing", playing);
  options.video.addEventListener("seeking", seeking);
  options.video.addEventListener("seeked", seeked);
  options.video.addEventListener("ended", ended);
  windowTarget.addEventListener("pagehide", pagehide);
  documentTarget.addEventListener("visibilitychange", visibilitychange, { capture: true });
  windowTarget.addEventListener("online", online);

  return () => {
    if (disposed) return;
    disposed = true;
    clearIntervalFn(interval);
    options.video.removeEventListener("pause", pause);
    options.video.removeEventListener("playing", playing);
    options.video.removeEventListener("seeking", seeking);
    options.video.removeEventListener("seeked", seeked);
    options.video.removeEventListener("ended", ended);
    windowTarget.removeEventListener("pagehide", pagehide);
    documentTarget.removeEventListener("visibilitychange", visibilitychange, { capture: true });
    windowTarget.removeEventListener("online", online);
    invoke(() => options.controller.dispose());
  };
}
