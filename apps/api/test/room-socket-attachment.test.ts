import { describe, expect, it } from "vitest";
import type { VerifiedRoomToken } from "../src/auth";
import {
  attachmentToVerifiedRoomToken,
  createRoomSocketAttachment,
  parseRoomSocketAttachment,
  updateRoomSocketAttachment,
} from "../src/room-socket-attachment";

const verified: VerifiedRoomToken = {
  avatarUrl: null,
  capabilities: {
    hostPlanCode: "plus",
    maxParticipants: 6,
    maxMediaSeats: 4,
    canNameRoom: true,
    canSendPushInvites: true,
  },
  displayName: "Host",
  role: "host",
  roomId: "room-1",
  sub: "host-user",
};

describe("room socket attachments", () => {
  it("serializes and parses verified socket state", () => {
    const attachment = createRoomSocketAttachment("room-1", verified, 1_000);
    const parsed = parseRoomSocketAttachment(attachment, "room-1");

    expect(parsed?.verified.sub).toBe("host-user");
    expect(parsed?.verified.capabilities?.hostPlanCode).toBe("plus");
    expect(attachmentToVerifiedRoomToken(parsed ?? attachment)).toEqual(verified);
  });

  it("rejects attachments for another room or malformed participants", () => {
    const attachment = createRoomSocketAttachment("room-1", verified, 1_000);

    expect(parseRoomSocketAttachment(attachment, "room-2")).toBeNull();
    expect(parseRoomSocketAttachment({ ...attachment, participant: { id: "" } }, "room-1")).toBeNull();
  });

  it("updates joined participant and session state", () => {
    const attachment = createRoomSocketAttachment("room-1", verified, 1_000);
    const updated = updateRoomSocketAttachment(attachment, {
      lastSeenAt: 2_000,
      participantSessionId: "session-1",
      participant: {
        id: "host-user",
        displayName: "Host",
        role: "host",
        cameraEnabled: true,
        syncStatus: "synced",
        lastSeenAt: 2_000,
      },
    });

    expect(updated.lastSeenAt).toBe(2_000);
    expect(updated.participantSessionId).toBe("session-1");
    expect(updated.participant?.cameraEnabled).toBe(true);
  });
});
