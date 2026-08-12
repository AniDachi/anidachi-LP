import type { RoomInvite } from "@anidachi/protocol";

export type RoomInviteTargetStatus = "pending" | "accepted" | "invited";

export function roomInviteTargetStatuses(
  sentInvites: readonly RoomInvite[],
  roomId: string,
): ReadonlyMap<string, RoomInviteTargetStatus> {
  const statuses = new Map<string, RoomInviteTargetStatus>();

  for (const invite of sentInvites) {
    if (invite.roomId !== roomId) continue;

    if (invite.targetKind === "group" && invite.targetGroupId) {
      const key = `group:${invite.targetGroupId}`;
      if (!statuses.has(key)) {
        statuses.set(key, aggregateRecipientStatus(invite));
      }
      continue;
    }

    for (const recipient of invite.recipients) {
      const key = `friend:${recipient.user.userId}`;
      if (!statuses.has(key)) {
        statuses.set(key, recipientStatus(recipient.status));
      }
    }
  }

  return statuses;
}

export function mergeRoomInviteTargetStatus(
  current: ReadonlyMap<string, RoomInviteTargetStatus>,
  targetKey: string,
  invite: RoomInvite,
): ReadonlyMap<string, RoomInviteTargetStatus> {
  const next = new Map(current);
  next.set(
    targetKey,
    invite.targetKind === "group"
      ? aggregateRecipientStatus(invite)
      : recipientStatus(invite.recipients[0]?.status),
  );
  return next;
}

export function roomInviteTargetStatusLabel(
  status: RoomInviteTargetStatus,
): string {
  if (status === "pending") return "Pending";
  if (status === "accepted") return "Accepted";
  return "Invited";
}

function aggregateRecipientStatus(invite: RoomInvite): RoomInviteTargetStatus {
  if (invite.recipients.some((recipient) => recipient.status === "pending")) {
    return "pending";
  }
  if (invite.recipients.some((recipient) => recipient.status === "accepted")) {
    return "accepted";
  }
  return "invited";
}

function recipientStatus(
  status: RoomInvite["recipients"][number]["status"] | undefined,
) {
  if (status === "pending") return "pending";
  if (status === "accepted") return "accepted";
  return "invited";
}
