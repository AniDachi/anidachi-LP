import {
  controlsDebugSnapshot,
  elementDebugSnapshot,
  logDebug,
  videoDebugSnapshot,
} from "./debug-log";
import type { VideoAdapter } from "./video-adapter";

const VIDEO_EVENTS = [
  "abort",
  "canplay",
  "canplaythrough",
  "durationchange",
  "emptied",
  "ended",
  "error",
  "loadeddata",
  "loadedmetadata",
  "loadstart",
  "pause",
  "play",
  "playing",
  "progress",
  "ratechange",
  "seeked",
  "seeking",
  "stalled",
  "suspend",
  "timeupdate",
  "volumechange",
  "waiting",
] as const;

export function startDebugProbe(adapter: VideoAdapter): () => void {
  let lastTimeUpdate = 0;
  let lastProgress = 0;

  logDebug("probe", "started", {
    adapterId: adapter.id,
    adapterName: adapter.name,
    fingerprint: adapter.getFingerprint(),
    title: adapter.getTitle(),
    pageUrl: location.href,
    container: elementDebugSnapshot(adapter.container),
    video: videoDebugSnapshot(adapter.video),
    controls: controlsDebugSnapshot(adapter.container),
  });

  const disposers: Array<() => void> = [];

  for (const eventName of VIDEO_EVENTS) {
    const listener = () => {
      const now = Date.now();
      if (eventName === "timeupdate" && now - lastTimeUpdate < 3000) {
        return;
      }
      if (eventName === "progress" && now - lastProgress < 5000) {
        return;
      }

      if (eventName === "timeupdate") {
        lastTimeUpdate = now;
      }
      if (eventName === "progress") {
        lastProgress = now;
      }

      logDebug("video.event", eventName, {
        adapterId: adapter.id,
        fingerprint: adapter.getFingerprint(),
        video: videoDebugSnapshot(adapter.video),
      });
    };

    adapter.video.addEventListener(eventName, listener, true);
    disposers.push(() => adapter.video.removeEventListener(eventName, listener, true));
  }

  const fullscreenListener = () => {
    logDebug("fullscreen", "change", {
      adapterId: adapter.id,
      isAdapterFullscreen: adapter.isFullscreen(),
      fullscreenElement: elementDebugSnapshot(document.fullscreenElement),
      container: elementDebugSnapshot(adapter.container),
      video: videoDebugSnapshot(adapter.video),
    });
  };

  const visibilityListener = () => {
    logDebug("page", "visibilitychange", {
      visibilityState: document.visibilityState,
      video: videoDebugSnapshot(adapter.video),
    });
  };

  document.addEventListener("fullscreenchange", fullscreenListener, true);
  document.addEventListener("visibilitychange", visibilityListener, true);
  disposers.push(() => document.removeEventListener("fullscreenchange", fullscreenListener, true));
  disposers.push(() => document.removeEventListener("visibilitychange", visibilityListener, true));

  const interval = window.setInterval(() => {
    logDebug("probe", "interval", {
      adapterId: adapter.id,
      fingerprint: adapter.getFingerprint(),
      container: elementDebugSnapshot(adapter.container),
      video: videoDebugSnapshot(adapter.video),
      controls: controlsDebugSnapshot(adapter.container),
    });
  }, 5000);
  disposers.push(() => window.clearInterval(interval));

  return () => {
    logDebug("probe", "stopped", {
      adapterId: adapter.id,
      video: videoDebugSnapshot(adapter.video),
    });
    for (const dispose of disposers.splice(0)) {
      dispose();
    }
  };
}
