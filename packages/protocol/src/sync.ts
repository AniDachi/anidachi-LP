import type { PlaybackState } from "./types";

export type SyncCorrection =
  | { action: "none"; drift: number; expectedTime: number }
  | { action: "seek"; drift: number; expectedTime: number }
  | { action: "catch-up"; drift: number; expectedTime: number };

export const SYNC_IGNORE_DRIFT_SECONDS = 0.5;
export const SYNC_SEEK_DRIFT_SECONDS = 2;
export const SYNC_CATCH_UP_DRIFT_SECONDS = 8;

export function getExpectedHostTime(state: PlaybackState, nowMs = Date.now()): number {
  if (!state.playing) {
    return state.hostTime;
  }

  const elapsedSeconds = Math.max(0, nowMs - state.updatedAt) / 1000;
  return state.hostTime + elapsedSeconds * state.playbackRate;
}

export function normalizeRemotePlaybackState(
  state: PlaybackState,
  receivedAtMs = Date.now(),
): PlaybackState {
  return {
    ...state,
    updatedAt: receivedAtMs,
  };
}

export function getPlaybackDrift(
  localTime: number,
  state: PlaybackState,
  nowMs = Date.now(),
): number {
  return localTime - getExpectedHostTime(state, nowMs);
}

export function getSyncCorrection(
  localTime: number,
  state: PlaybackState,
  nowMs = Date.now(),
): SyncCorrection {
  const expectedTime = getExpectedHostTime(state, nowMs);
  const drift = localTime - expectedTime;
  const absDrift = Math.abs(drift);

  if (absDrift < SYNC_IGNORE_DRIFT_SECONDS) {
    return { action: "none", drift, expectedTime };
  }

  if (absDrift > SYNC_CATCH_UP_DRIFT_SECONDS) {
    return { action: "catch-up", drift, expectedTime };
  }

  if (absDrift > SYNC_SEEK_DRIFT_SECONDS) {
    return { action: "seek", drift, expectedTime };
  }

  return { action: "none", drift, expectedTime };
}
