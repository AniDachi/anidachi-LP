import { RoomEndReasonSchema, type RoomEndReason } from "@anidachi/protocol";

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
}

export function endedRoomTombstone(command: EndRoomCommand): EndedRoomTombstone {
  return { schemaVersion: 1, ...command };
}
