export type RoomActionFeedback = "room-created" | "invite-copied" | "room-closed";

export const ROOM_ACTION_FEEDBACK_DURATION_MS = 2000;

interface PrimaryRoomActionLabelInput {
  feedback: RoomActionFeedback | null;
  roomCreatePending: boolean;
  roomEndPending: boolean;
  roomExists: boolean;
}

export function getPrimaryRoomActionLabel({
  feedback,
  roomCreatePending,
  roomEndPending,
  roomExists,
}: PrimaryRoomActionLabelInput): string {
  if (roomCreatePending) {
    return "Creating room";
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
