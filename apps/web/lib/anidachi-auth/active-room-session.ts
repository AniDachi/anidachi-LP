import {
  ActiveRoomConflictResponseSchema,
  type ActiveRoomConflictResponse,
} from "@anidachi/protocol";

export const ACTIVE_ROOM_CONFLICT_MESSAGE =
  "You already have an active room.";

type ActiveRoomSummary = ActiveRoomConflictResponse["activeRoom"];

export type ActiveRoomCreateDatabaseResult =
  | {
      outcome: "claimed" | "reused";
      roomRecord: Record<string, unknown>;
    }
  | { outcome: "conflict"; activeRoom: ActiveRoomSummary };

export type ActiveRoomClaimDatabaseResult =
  | { outcome: "claimed" | "reused" }
  | { outcome: "conflict"; activeRoom: ActiveRoomSummary };

export type ActiveRoomReleaseDatabaseResult = {
  outcome: "released" | "stale";
};

export class ActiveRoomSessionDatabaseError extends Error {
  constructor(message = "Malformed active-room database response") {
    super(message);
    this.name = "ActiveRoomSessionDatabaseError";
  }
}

export function parseActiveRoomCreateRpcResult(
  value: unknown,
): ActiveRoomCreateDatabaseResult {
  const row = singleStrictRow(value, ["active_room", "outcome", "room_record"]);

  if (row.outcome === "conflict") {
    if (row.room_record !== null) throw malformed();
    return { outcome: "conflict", activeRoom: parseActiveRoom(row.active_room) };
  }

  if (
    (row.outcome !== "claimed" && row.outcome !== "reused") ||
    row.active_room !== null ||
    !isRecord(row.room_record) ||
    typeof row.room_record.room_id !== "string" ||
    row.room_record.room_id.length < 1 ||
    row.room_record.room_id.length > 128
  ) {
    throw malformed();
  }

  return { outcome: row.outcome, roomRecord: row.room_record };
}

export function parseActiveRoomClaimRpcResult(
  value: unknown,
): ActiveRoomClaimDatabaseResult {
  const row = singleStrictRow(value, ["active_room", "outcome"]);

  if (row.outcome === "conflict") {
    return { outcome: "conflict", activeRoom: parseActiveRoom(row.active_room) };
  }
  if (
    (row.outcome !== "claimed" && row.outcome !== "reused") ||
    row.active_room !== null
  ) {
    throw malformed();
  }
  return { outcome: row.outcome };
}

export function parseActiveRoomReleaseRpcResult(
  value: unknown,
): ActiveRoomReleaseDatabaseResult {
  const row = singleStrictRow(value, ["outcome"]);
  if (row.outcome !== "released" && row.outcome !== "stale") {
    throw malformed();
  }
  return { outcome: row.outcome };
}

function parseActiveRoom(value: unknown): ActiveRoomSummary {
  const parsed = ActiveRoomConflictResponseSchema.safeParse({
    code: "ACTIVE_ROOM_CONFLICT",
    message: ACTIVE_ROOM_CONFLICT_MESSAGE,
    activeRoom: value,
  });
  if (!parsed.success) throw malformed();
  return parsed.data.activeRoom;
}

function singleStrictRow(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw malformed();
  }
  if (Object.keys(value[0]).sort().join(",") !== [...keys].sort().join(",")) {
    throw malformed();
  }
  return value[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function malformed(): ActiveRoomSessionDatabaseError {
  return new ActiveRoomSessionDatabaseError();
}
