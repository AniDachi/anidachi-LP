import {
  EMPTY_ROOM_TIMEOUT_MS,
  RoomEndReasonSchema,
  RoomUsageSummarySchema,
  isEmptyRoomEndEventId,
  type RoomEndReason,
  type RoomUsageSummary,
} from "@anidachi/protocol";

export const ROOM_LIFECYCLE_STORAGE_KEY = "room_lifecycle";
export const EMPTY_ROOM_RETRY_BASE_MS = 30_000;
export const EMPTY_ROOM_RETRY_MAX_MS = 30 * 60 * 1_000;

export interface EndRoomCommand {
  endedAt: number;
  reason: RoomEndReason;
}

export function parseEndRoomCommand(value: unknown): EndRoomCommand | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const command = value as Record<string, unknown>;
  const reason = RoomEndReasonSchema.safeParse(command.reason);
  if (
    typeof command.endedAt !== "number" ||
    !Number.isInteger(command.endedAt) ||
    command.endedAt < 0 ||
    !reason.success
  ) return null;
  return { endedAt: command.endedAt, reason: reason.data };
}

export interface EndedRoomTombstone extends EndRoomCommand {
  schemaVersion: 1;
  usage?: RoomUsageSummary;
  usageFinalized?: true;
}

export function endedRoomTombstone(
  command: EndRoomCommand,
  details: Pick<EndedRoomTombstone, "usage" | "usageFinalized"> = {},
): EndedRoomTombstone {
  return { schemaVersion: 1, ...command, ...details };
}

export interface ActiveRoomLifecycle {
  schemaVersion: 1;
  status: "active";
  updatedAt: number;
}

export interface EmptyRoomLifecycle {
  schemaVersion: 1;
  status: "empty";
  emptySince: number;
  alarmAt: number;
}

export interface EndingRoomLifecycle {
  schemaVersion: 1;
  status: "ending";
  emptySince: number;
  endedAt: number;
  eventId: string;
  attempts: number;
  nextAttemptAt: number;
}

export interface EndedRoomLifecycle extends EndRoomCommand {
  schemaVersion: 1;
  status: "ended";
  usage?: RoomUsageSummary;
  usageFinalized?: true;
}

export type RoomLifecycleState =
  | ActiveRoomLifecycle
  | EmptyRoomLifecycle
  | EndingRoomLifecycle
  | EndedRoomLifecycle;

export function activeRoomLifecycle(updatedAt: number): ActiveRoomLifecycle {
  return { schemaVersion: 1, status: "active", updatedAt };
}

export function emptyRoomLifecycle(emptySince: number): EmptyRoomLifecycle {
  return {
    schemaVersion: 1,
    status: "empty",
    emptySince,
    alarmAt: emptySince + EMPTY_ROOM_TIMEOUT_MS,
  };
}

export function endedRoomLifecycle(tombstone: EndedRoomTombstone): EndedRoomLifecycle {
  return { ...tombstone, status: "ended" };
}

export function emptyRoomRetryAt(attempts: number, now: number): number {
  const exponent = Math.max(0, Math.min(16, Math.floor(attempts) - 1));
  const delay = Math.min(
    EMPTY_ROOM_RETRY_MAX_MS,
    EMPTY_ROOM_RETRY_BASE_MS * (2 ** exponent),
  );
  return Math.min(Number.MAX_SAFE_INTEGER, now + delay);
}

export function parseRoomLifecycleState(value: unknown): RoomLifecycleState | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;

  if (value.status === "active") {
    return isTimestamp(value.updatedAt)
      ? { schemaVersion: 1, status: "active", updatedAt: value.updatedAt }
      : null;
  }

  if (value.status === "empty") {
    if (
      !isTimestamp(value.emptySince) ||
      !isTimestamp(value.alarmAt) ||
      value.alarmAt !== value.emptySince + EMPTY_ROOM_TIMEOUT_MS
    ) return null;
    return {
      schemaVersion: 1,
      status: "empty",
      emptySince: value.emptySince,
      alarmAt: value.alarmAt,
    };
  }

  if (value.status === "ending") {
    if (
      !isTimestamp(value.emptySince) ||
      !isTimestamp(value.endedAt) ||
      value.endedAt !== value.emptySince + EMPTY_ROOM_TIMEOUT_MS ||
      !isEmptyRoomEndEventId(value.eventId) ||
      !Number.isSafeInteger(value.attempts) ||
      (value.attempts as number) < 1 ||
      !isTimestamp(value.nextAttemptAt)
    ) return null;
    return {
      schemaVersion: 1,
      status: "ending",
      emptySince: value.emptySince,
      endedAt: value.endedAt,
      eventId: value.eventId,
      attempts: value.attempts as number,
      nextAttemptAt: value.nextAttemptAt,
    };
  }

  if (value.status === "ended") {
    const command = parseEndRoomCommand(value);
    const usage =
      value.usage === undefined
        ? undefined
        : RoomUsageSummarySchema.safeParse(value.usage);
    if (
      !command ||
      (usage !== undefined && !usage.success) ||
      (value.usageFinalized !== undefined && value.usageFinalized !== true)
    ) return null;
    return {
      schemaVersion: 1,
      status: "ended",
      ...command,
      ...(usage?.success ? { usage: usage.data } : {}),
      ...(value.usageFinalized === true ? { usageFinalized: true as const } : {}),
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
