import { describe, expect, it } from "vitest";
import { createStoredP2PReplayMetadata, parseRoomStateSnapshot } from "../src/room-persistence";

const capabilities = {
  hostPlanCode: "pro",
  maxParticipants: 15,
  maxMediaSeats: 3,
  canNameRoom: true,
  canSendPushInvites: true,
} as const;

describe("room state persistence", () => {
  it("reduces durable P2P replay rows to privacy-safe metadata", () => {
    const metadata = createStoredP2PReplayMetadata(
      {
        type: "P2P_SIGNAL",
        clientSignalId: "raw-client-signal-id",
        fromUserId: "raw-user-a",
        roomId: "raw-room-id",
        roomGeneration: 3,
        senderConnectionId: "raw-connection-id",
        senderMediaSessionId: "raw-media-session-id",
        serverReceivedAt: 1_000,
        serverSeq: 8,
        signal: {
          kind: "offer",
          sdp: {
            type: "offer",
            sdp: "v=0\\r\\na=candidate:raw-peer-address\\r\\na=msid:raw-stream raw-track",
          },
        },
        sourceGeneration: 5,
        toUserId: "raw-user-b",
      },
      "hmac_dedupe_value",
    );
    const serialized = JSON.stringify(metadata);

    expect(metadata).toEqual({
      dedupeHash: "hmac_dedupe_value",
      roomGeneration: 3,
      serverReceivedAt: 1_000,
      serverSeq: 8,
      signalKind: "offer",
      sourceGeneration: 5,
    });
    for (const forbidden of [
      "raw-client-signal-id",
      "raw-user-a",
      "raw-user-b",
      "raw-room-id",
      "raw-connection-id",
      "raw-media-session-id",
      "raw-peer-address",
      "raw-stream",
      "raw-track",
      "candidate",
      "sdp",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

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

    expect(explicit?.participants.find((item) => item.id === "viewer-a")?.mediaSeat).toBe("none");
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
