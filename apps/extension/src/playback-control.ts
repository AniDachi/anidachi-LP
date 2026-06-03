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

export const CRUNCHYROLL_REMOTE_SEEK_THROTTLE_MS = 2400;
export const CRUNCHYROLL_REMOTE_SEEK_TARGET_TOLERANCE_SECONDS = 3;
export const DEFAULT_REMOTE_PLAY_READY_TIMEOUT_MS = 2500;
export const CRUNCHYROLL_REMOTE_PLAY_READY_TIMEOUT_MS = 6500;

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

export function shouldPlayWithoutWaitingForMediaReady(_adapterId: string): boolean {
  return _adapterId === "crunchyroll";
}

export function getRemotePlayReadyTimeoutMs(adapterId: string): number {
  return adapterId === "crunchyroll"
    ? CRUNCHYROLL_REMOTE_PLAY_READY_TIMEOUT_MS
    : DEFAULT_REMOTE_PLAY_READY_TIMEOUT_MS;
}

export function shouldThrottleRemoteSeekAttempt(
  adapterId: string,
  previousAttempt: RemoteSeekAttempt | null,
  targetTime: number,
  nowMs = Date.now(),
): boolean {
  if (adapterId !== "crunchyroll" || !previousAttempt) {
    return false;
  }

  const ageMs = nowMs - previousAttempt.attemptedAt;
  if (ageMs < 0 || ageMs > CRUNCHYROLL_REMOTE_SEEK_THROTTLE_MS) {
    return false;
  }

  return (
    Math.abs(previousAttempt.targetTime - targetTime) <=
    CRUNCHYROLL_REMOTE_SEEK_TARGET_TOLERANCE_SECONDS
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
