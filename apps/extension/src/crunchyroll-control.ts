export const CRUNCHYROLL_CONTROL_SOURCE = "anidachi-crunchyroll-control";
export const CRUNCHYROLL_CONTROL_RESULT_SOURCE = "anidachi-crunchyroll-control-result";

export type CrunchyrollControlAction =
  | "play"
  | "pause"
  | "seek"
  | "snapshot"
  | "navigate"
  | "seriesPoster";

export interface CrunchyrollVideoSnapshot {
  buffered: Array<[number, number]>;
  currentTime: number;
  duration: number | null;
  ended: boolean;
  muted: boolean;
  networkState: number;
  paused: boolean;
  playbackRate: number;
  readyState: number;
  seeking: boolean;
  volume: number;
}

export interface CrunchyrollTimelineSnapshot {
  ariaValueMax?: string | null;
  ariaValueMin?: string | null;
  ariaValueNow?: string | null;
  max: string;
  min: string;
  value: string;
}

export interface CrunchyrollControlRequest {
  action: CrunchyrollControlAction;
  id: string;
  source: typeof CRUNCHYROLL_CONTROL_SOURCE;
  contentId?: string;
  locale?: string;
  seriesId?: string;
  time?: number;
  url?: string;
}

export interface CrunchyrollControlResult {
  action: CrunchyrollControlAction;
  error?: string;
  id: string;
  ok: boolean;
  source: typeof CRUNCHYROLL_CONTROL_RESULT_SOURCE;
  currentUrl?: string;
  method?: string;
  posterUrl?: string | null;
  timedOut?: boolean;
  timeline?: CrunchyrollTimelineSnapshot | null;
  video?: CrunchyrollVideoSnapshot;
}

export function getCrunchyrollTimelineValueForTime(
  targetTime: number,
  duration: number | null,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(targetTime)) {
    return min;
  }

  if (!Number.isFinite(min)) {
    min = 0;
  }

  if (!Number.isFinite(max) || max <= min) {
    return targetTime;
  }

  if (duration !== null && Number.isFinite(duration) && duration > 0 && max <= 100) {
    return min + (Math.max(0, targetTime) / duration) * (max - min);
  }

  return targetTime;
}
