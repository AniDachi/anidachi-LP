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
  participantSessionId: "participant-session-1",
  role: "host",
  roomId: "room-1",
  sub: "host-user",
};

describe("room socket attachments", () => {
  it("serializes and parses verified socket state", () => {
    const attachment = createRoomSocketAttachment("room-1", verified, 1_000);
    const parsed = parseRoomSocketAttachment(attachment, "room-1");

    expect(parsed?.verified.sub).toBe("host-user");
    expect(parsed?.verified.participantSessionId).toBe("participant-session-1");
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
      participantSessionId: "participant-session-1",
      participant: {
        id: "host-user",
        displayName: "Host",
        role: "host",
        cameraEnabled: true,
        mediaSeat: "joined",
        mediaSeatSource: "auto",
        syncStatus: "synced",
        lastSeenAt: 2_000,
      },
    });

    expect(updated.lastSeenAt).toBe(2_000);
    expect(updated.participantSessionId).toBe("participant-session-1");
    expect(updated.participant?.cameraEnabled).toBe(true);
  });

  it("persists only compact admission state below the WebSocket attachment ceiling", () => {
    const attachment = createRoomSocketAttachment("room-1", verified, 1_000, {
      deadlineAt: 11_000,
      joined: false,
    });

    expect(attachment.admission).toEqual({ deadlineAt: 11_000, joined: false });
    expect(new TextEncoder().encode(JSON.stringify(attachment)).byteLength).toBeLessThan(1_024);
  });

  it("does not grandfather a legacy pre-JOIN attachment after hibernation", () => {
    const legacy = {
      connectedAt: 1_000,
      lastSeenAt: 1_000,
      roomId: "room-1",
      schemaVersion: 1,
      verified: {
        avatarUrl: null,
        capabilities: verified.capabilities,
        displayName: "Host",
        role: "host",
        roomId: "room-1",
        sub: "host-user",
      },
    };

    expect(parseRoomSocketAttachment(legacy, "room-1")).toBeNull();
  });

  it("rejects a legacy joined attachment without token-bound session authority", () => {
    const current = createRoomSocketAttachment("room-1", verified, 1_000);
    const legacyJoined = {
      ...current,
      participant: {
        id: "host-user",
        displayName: "Host",
        role: "host",
        cameraEnabled: false,
        mediaSeat: "none",
        syncStatus: "synced",
        lastSeenAt: 1_000,
      },
      schemaVersion: 1,
    };

    expect(parseRoomSocketAttachment(legacyJoined, "room-1")).toBeNull();
  });
});
