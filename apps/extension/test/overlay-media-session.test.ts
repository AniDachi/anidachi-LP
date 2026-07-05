import { describe, expect, it } from "vitest";
import { getP2PMediaSessionState } from "../src/overlay-media-session";

describe("overlay P2P media session state", () => {
  it("keeps the media session active during a same-room websocket reconnect", () => {
    expect(
      getP2PMediaSessionState({
        participantId: "user-1",
        roomId: "room-1",
        roomMediaSeatLimit: 4,
        roomSnapshotReady: false,
        status: "connecting",
      }),
    ).toEqual({
      p2pReady: false,
      p2pSessionActive: true,
    });

    expect(
      getP2PMediaSessionState({
        participantId: "user-1",
        roomId: "room-1",
        roomMediaSeatLimit: 4,
        roomSnapshotReady: true,
        status: "closed",
      }),
    ).toEqual({
      p2pReady: false,
      p2pSessionActive: true,
    });
  });

  it("only reports ready once the room is connected and the snapshot is loaded", () => {
    expect(
      getP2PMediaSessionState({
        participantId: "user-1",
        roomId: "room-1",
        roomMediaSeatLimit: 4,
        roomSnapshotReady: true,
        status: "connected",
      }),
    ).toEqual({
      p2pReady: true,
      p2pSessionActive: true,
    });
  });

  it("disables media without a room, user, or media seats", () => {
    expect(
      getP2PMediaSessionState({
        participantId: "user-1",
        roomId: "room-1",
        roomMediaSeatLimit: 4,
        roomSnapshotReady: true,
        status: "idle",
      }),
    ).toEqual({
      p2pReady: false,
      p2pSessionActive: false,
    });

    expect(
      getP2PMediaSessionState({
        participantId: null,
        roomId: "room-1",
        roomMediaSeatLimit: 4,
        roomSnapshotReady: true,
        status: "connected",
      }),
    ).toEqual({
      p2pReady: false,
      p2pSessionActive: false,
    });

    expect(
      getP2PMediaSessionState({
        participantId: "user-1",
        roomId: "room-1",
        roomMediaSeatLimit: 0,
        roomSnapshotReady: true,
        status: "connected",
      }),
    ).toEqual({
      p2pReady: false,
      p2pSessionActive: false,
    });
  });
});
