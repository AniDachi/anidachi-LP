import { HboCmsPlaybackSchema, type HboCmsPlayback } from "./cms-catalog";

/** Both sides speak in seconds. Only the page-world reader talks to the HBO SDK. */
export const HBO_CLOCK_REQUEST = "anidachi:hbo-clock:read";
export const HBO_CLOCK_REPLY = "anidachi:hbo-clock:reply";

export interface HboContentClock {
  position: number;
  duration: number;
  inMain: boolean;
  streamTarget?: number;
  episode?: HboCmsPlayback;
}

export function readHboClock(video: HTMLVideoElement, target?: number | "episode"): HboContentClock | null {
  let clock: HboContentClock | null = null;
  const receive = (event: Event) => {
    const value = (event as CustomEvent<HboContentClock>).detail;
    if (value && Number.isFinite(value.duration) && value.duration > 0 &&
        Number.isFinite(value.position) && value.position >= 0 && value.position <= value.duration &&
        typeof value.inMain === "boolean" && (value.streamTarget === undefined ||
        (Number.isFinite(value.streamTarget) && value.streamTarget >= 0 && value.streamTarget <= video.duration))) {
      clock = { position: value.position, duration: value.duration, inMain: value.inMain, streamTarget: value.streamTarget };
      if (target === "episode" && value.episode) clock.episode = HboCmsPlaybackSchema.safeParse(value.episode).data;
    }
  };
  video.addEventListener(HBO_CLOCK_REPLY, receive);
  try {
    video.dispatchEvent(new CustomEvent(HBO_CLOCK_REQUEST, { bubbles: true, detail: target ?? null }));
  } finally {
    video.removeEventListener(HBO_CLOCK_REPLY, receive);
  }
  return clock;
}
