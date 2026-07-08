import { describe, expect, it } from "vitest";
import { parseRoomStateSnapshot } from "../src/room-persistence";

const capabilities = {
  hostPlanCode: "pro",
  maxParticipants: 15,
  maxMediaSeats: 3,
  canNameRoom: true,
  canSendPushInvites: true,
} as const;

describe("room state persistence", () => {
  it("migrates legacy participants without mediaSeat once without rewriting explicit removals", () => {
    const legacy = parseRoomStateSnapshot({
      schemaVersion: 1,
      capabilities,
      hostId: "host",
      roomGeneration: 1,
      serverSeq: 5,
      sourceGeneration: 1,
      updatedAt: 1000,
      participants: [
        participant("host", "host"),
        participant("viewer-a", "viewer"),
        participant("viewer-b", "viewer"),
      ],
    });

    expect(legacy?.participants.map((item) => [item.id, item.mediaSeat])).toEqual([
      ["host", "joined"],
      ["viewer-a", "joined"],
      ["viewer-b", "joined"],
    ]);
    if (!legacy) {
      throw new Error("Expected legacy snapshot to parse");
    }

    const explicit = parseRoomStateSnapshot({
      ...legacy,
      participants: [
        { ...participant("host", "host"), mediaSeat: "joined", mediaSeatSource: "auto" },
        { ...participant("viewer-a", "viewer"), mediaSeat: "none" },
      ],
    });

    expect(explicit?.participants.find((item) => item.id === "viewer-a")?.mediaSeat).toBe(
      "none",
    );
    expect(explicit?.participants.find((item) => item.id === "viewer-a")?.cameraEnabled).toBe(
      false,
    );
  });
});

function participant(id: string, role: "host" | "viewer") {
  return {
    id,
    displayName: id,
    role,
    cameraEnabled: false,
    syncStatus: "unknown",
    lastSeenAt: 1000,
  };
}
