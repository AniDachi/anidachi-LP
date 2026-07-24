import type { AdapterPlaybackPolicy } from "./source-adapters/core/types";

const HAVE_CURRENT_DATA = 2;
const READY_EVENTS = [
  "seeked",
  "canplay",
  "canplaythrough",
  "loadeddata",
  "timeupdate",
  "playing",
] as const;

export type MediaReadyReason = "ready" | "timeout" | (typeof READY_EVENTS)[number];

export interface RemoteSeekAttempt {
  attemptedAt: number;
  targetTime: number;
}

export function isMediaSettling(video: HTMLVideoElement): boolean {
  return video.seeking || video.readyState < HAVE_CURRENT_DATA;
}

export function shouldSeekForRemoteCommand(drift: number, settling: boolean): boolean {
  const absDrift = Math.abs(drift);
  return absDrift > 1.25 && (!settling || absDrift > 2);
}

export function shouldSeekForHostState(
  correctionAction: "none" | "seek" | "catch-up",
  settling: boolean,
): boolean {
  return correctionAction === "catch-up" || (correctionAction === "seek" && !settling);
}

export function shouldDeferHostStateSeek(
  correctionAction: "none" | "seek" | "catch-up",
  settling: boolean,
): boolean {
  return correctionAction === "seek" && settling;
}

export function shouldThrottleRemoteSeekAttempt(
  policy: AdapterPlaybackPolicy,
  previousAttempt: RemoteSeekAttempt | null,
  targetTime: number,
  nowMs = Date.now(),
): boolean {
  if (policy.remoteSeekThrottleMs <= 0 || !previousAttempt) {
    return false;
  }

  const ageMs = nowMs - previousAttempt.attemptedAt;
  if (ageMs < 0 || ageMs > policy.remoteSeekThrottleMs) {
    return false;
  }

  return (
    Math.abs(previousAttempt.targetTime - targetTime) <=
    policy.remoteSeekTargetToleranceSeconds
  );
}

export function isMediaTimeBuffered(
  video: HTMLVideoElement,
  time: number,
  paddingSeconds = 0.35,
): boolean {
  if (!Number.isFinite(time)) {
    return false;
  }

  for (let index = 0; index < video.buffered.length; index += 1) {
    if (
      time >= video.buffered.start(index) - paddingSeconds &&
      time <= video.buffered.end(index) + paddingSeconds
    ) {
      return true;
    }
  }

  return false;
}

export function waitForMediaReady(
  video: HTMLVideoElement,
  timeoutMs = 2500,
): Promise<MediaReadyReason> {
  if (!isMediaSettling(video)) {
    return Promise.resolve("ready");
  }

  return new Promise((resolve) => {
    let completed = false;
    let timeout = 0;
    const cleanup = () => {
      window.clearTimeout(timeout);
      for (const eventName of READY_EVENTS) {
        video.removeEventListener(eventName, onReadyEvent);
      }
    };
    const complete = (reason: MediaReadyReason) => {
      if (completed) {
        return;
      }

      completed = true;
      cleanup();
      resolve(reason);
    };
    const onReadyEvent = (event: Event) => {
      if (!isMediaSettling(video)) {
        complete(event.type as MediaReadyReason);
      }
    };
    timeout = window.setTimeout(() => complete("timeout"), timeoutMs);

    for (const eventName of READY_EVENTS) {
      video.addEventListener(eventName, onReadyEvent);
    }
  });
}
