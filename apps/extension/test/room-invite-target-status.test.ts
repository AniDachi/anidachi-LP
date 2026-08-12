import type { RoomInvite } from "@anidachi/protocol";
import { describe, expect, it } from "vitest";
import {
  mergeRoomInviteTargetStatus,
  roomInviteTargetStatuses,
} from "../src/room-invite-target-status";

const ROOM_ID = "room-1";
const FRIEND_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";

describe("room invite target status", () => {
  it("restores pending and accepted target state from canonical sent invites", () => {
    const statuses = roomInviteTargetStatuses(
      [
        invite("direct", "accepted"),
        invite("group", "pending"),
        { ...invite("direct", "pending"), roomId: "another-room" },
      ],
      ROOM_ID,
    );

    expect([...statuses]).toEqual([
      [`friend:${FRIEND_ID}`, "accepted"],
      [`group:${GROUP_ID}`, "pending"],
    ]);
  });

  it("marks non-actionable recipients as already invited", () => {
    const statuses = roomInviteTargetStatuses([invite("direct", "declined")], ROOM_ID);
    expect(statuses.get(`friend:${FRIEND_ID}`)).toBe("invited");
  });

  it("updates the clicked target immediately from the create response", () => {
    const current = new Map([[`friend:${FRIEND_ID}`, "invited" as const]]);
    const next = mergeRoomInviteTargetStatus(
      current,
      `friend:${FRIEND_ID}`,
      invite("direct", "pending"),
    );

    expect(next.get(`friend:${FRIEND_ID}`)).toBe("pending");
    expect(current.get(`friend:${FRIEND_ID}`)).toBe("invited");
  });
});

function invite(
  targetKind: "direct" | "group",
  status: RoomInvite["recipients"][number]["status"],
): RoomInvite {
  return {
    id: crypto.randomUUID(),
    roomId: ROOM_ID,
    sender: {
      userId: "33333333-3333-4333-8333-333333333333",
      handle: null,
      displayName: "Host",
      avatarUrl: null,
    },
    targetKind,
    targetGroupId: targetKind === "group" ? GROUP_ID : null,
    message: null,
    roomTitle: null,
    sourceUrl: null,
    videoFingerprint: null,
    createdAt: "2026-08-10T08:00:00.000Z",
    expiresAt: "2026-08-11T08:00:00.000Z",
    recipients: [
      {
        user: {
          userId: FRIEND_ID,
          handle: null,
          displayName: "Friend",
          avatarUrl: null,
        },
        status,
        updatedAt: "2026-08-10T08:00:00.000Z",
        respondedAt: status === "pending" ? null : "2026-08-10T08:01:00.000Z",
      },
    ],
  };
}
