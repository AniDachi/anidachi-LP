export type RoomActionFeedback =
  | "room-created"
  | "invite-copied"
  | "room-closed"
  | "room-left";

export type PrimaryRoomActionKind = "create" | "leave";

export const ROOM_ACTION_FEEDBACK_DURATION_MS = 2000;

interface PrimaryRoomActionLabelInput {
  feedback: RoomActionFeedback | null;
  isHost?: boolean;
  roomCreatePending: boolean;
  roomEndPending: boolean;
  roomExists: boolean;
  roomLeavePending?: boolean;
}

export function getPrimaryRoomActionKind({
  isHost,
  roomExists,
}: {
  isHost: boolean;
  roomExists: boolean;
}): PrimaryRoomActionKind {
  return roomExists && !isHost ? "leave" : "create";
}

export function getPrimaryRoomActionLabel({
  feedback,
  isHost = true,
  roomCreatePending,
  roomEndPending,
  roomExists,
  roomLeavePending = false,
}: PrimaryRoomActionLabelInput): string {
  if (roomCreatePending) {
    return "Creating room";
  }
  if (roomLeavePending) {
    return "Leaving room";
  }
  if (roomEndPending) {
    return "Closing room";
  }
  if (feedback === "room-created" && roomExists) {
    return "Room created";
  }
  if (feedback === "room-closed" && !roomExists) {
    return "Room closed";
  }
  if (feedback === "room-left" && !roomExists) {
    return "Room left";
  }
  if (getPrimaryRoomActionKind({ isHost, roomExists }) === "leave") {
    return "Leave room";
  }
  return roomExists ? "New room" : "Create room";
}

export function isInviteCopiedFeedback(feedback: RoomActionFeedback | null): boolean {
  return feedback === "invite-copied";
}

export async function copyRoomInviteText(
  text: string,
  writeText: (text: string) => Promise<void>,
  fallbackCopy: (text: string) => boolean,
): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch {
    try {
      return fallbackCopy(text);
    } catch {
      return false;
    }
  }
}
