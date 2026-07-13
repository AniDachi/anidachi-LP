import {
  RoomUsageSummarySchema,
  type RoomUsageSummary,
} from "@anidachi/protocol";

const MAX_ROOM_USAGE_MS = 24 * 60 * 60 * 1_000;

export interface RoomMeterState {
  schemaVersion: 1;
  accumulatedMs: number;
  activeSince: number | null;
  day: string | null;
}

export function createRoomMeterState(): RoomMeterState {
  return {
    schemaVersion: 1,
    accumulatedMs: 0,
    activeSince: null,
    day: null,
  };
}

export function reconcileRoomMeter(
  state: RoomMeterState,
  shouldMeter: boolean,
  now: number,
): RoomMeterState {
  const safeNow = safeTimestamp(now);

  if (shouldMeter) {
    if (state.activeSince !== null) return state;
    return {
      ...state,
      activeSince: safeNow,
      day: state.day ?? utcDay(safeNow),
    };
  }

  if (state.activeSince === null) return state;
  return {
    ...state,
    accumulatedMs: Math.min(
      MAX_ROOM_USAGE_MS,
      state.accumulatedMs + elapsedMs(state.activeSince, safeNow),
    ),
    activeSince: null,
  };
}

export function roomUsageSummary(
  state: RoomMeterState,
  now: number,
): RoomUsageSummary {
  const safeNow = safeTimestamp(now);
  const activeMs =
    state.activeSince === null ? 0 : elapsedMs(state.activeSince, safeNow);
  return {
    day: state.day ?? utcDay(safeNow),
    seconds: Math.floor(
      Math.min(MAX_ROOM_USAGE_MS, state.accumulatedMs + activeMs) / 1_000,
    ),
  };
}

export function parseRoomMeterState(value: unknown): RoomMeterState | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (
    !isSafeTimestamp(value.accumulatedMs) ||
    value.accumulatedMs > MAX_ROOM_USAGE_MS
  ) {
    return null;
  }
  if (value.activeSince !== null && !isSafeTimestamp(value.activeSince))
    return null;
  const day =
    value.day === null
      ? null
      : typeof value.day === "string" &&
          RoomUsageSummarySchema.safeParse({ day: value.day, seconds: 0 })
            .success
        ? value.day
        : undefined;
  if (day === undefined) return null;
  return {
    schemaVersion: 1,
    accumulatedMs: value.accumulatedMs,
    activeSince: value.activeSince,
    day,
  };
}

function elapsedMs(startedAt: number, now: number): number {
  return Math.max(0, now - startedAt);
}

function safeTimestamp(value: number): number {
  return isSafeTimestamp(value) ? value : 0;
}

function isSafeTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function utcDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
