export type RoomActionFeedback =
  | "room-created"
  | "invite-copied"
  | "room-closed"
  | "room-left";

export type PrimaryRoomActionKind = "create" | "end" | "leave";

export const ROOM_ACTION_FEEDBACK_DURATION_MS = 2000;
export const ROOM_END_CONFIRMATION_DURATION_MS = 4000;

interface PrimaryRoomActionLabelInput {
  feedback: RoomActionFeedback | null;
  isHost?: boolean;
  roomCreatePending: boolean;
  roomEndConfirmationPending?: boolean;
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
  if (!roomExists) {
    return "create";
  }
  return isHost ? "end" : "leave";
}

export function shouldConfirmRoomEnd(participantCount: number): boolean {
  return participantCount > 1;
}

export function getPrimaryRoomActionLabel({
  feedback,
  isHost = true,
  roomCreatePending,
  roomEndConfirmationPending = false,
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
  if (roomEndConfirmationPending) {
    return "Confirm end";
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
  const actionKind = getPrimaryRoomActionKind({ isHost, roomExists });
  if (actionKind === "leave") {
    return "Leave room";
  }
  return actionKind === "end" ? "End room" : "Create room";
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
