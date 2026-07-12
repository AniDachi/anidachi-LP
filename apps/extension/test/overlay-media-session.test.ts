import { describe, expect, it } from "vitest";
import {
  getP2PMediaSessionState,
  persistRoomSessionForCurrentJoin,
} from "../src/overlay-media-session";

describe("overlay P2P media session state", () => {
  it("rejects a persisted room session when its join becomes stale while storage resolves", async () => {
    let resolvePersist: (value: { participantSessionId: string }) => void = () => {};
    const persist = new Promise<{ participantSessionId: string }>((resolve) => {
      resolvePersist = resolve;
    });
    let currentJoin = true;
    const discarded: Array<{ participantSessionId: string }> = [];
    const guardedPersistence = {
      discard: async (session: { participantSessionId: string }) => {
        discarded.push(session);
      },
      isCurrentJoin: () => currentJoin,
      persist: () => persist,
    };

    const pending = persistRoomSessionForCurrentJoin(guardedPersistence);
    currentJoin = false;
    resolvePersist({ participantSessionId: "stale-session" });

    await expect(pending).resolves.toBeNull();
    expect(discarded).toEqual([{ participantSessionId: "stale-session" }]);
  });

  it("keeps the media session active during a same-room websocket reconnect", () => {
    expect(
      getP2PMediaSessionState({
        localHasMediaSeat: true,
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
        localHasMediaSeat: true,
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
        localHasMediaSeat: true,
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
        localHasMediaSeat: true,
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
        localHasMediaSeat: true,
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
        localHasMediaSeat: true,
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

  it("disables media for chat-only participants", () => {
    expect(
      getP2PMediaSessionState({
        localHasMediaSeat: false,
        participantId: "user-1",
        roomId: "room-1",
        roomMediaSeatLimit: 4,
        roomSnapshotReady: true,
        status: "connected",
      }),
    ).toEqual({
      p2pReady: false,
      p2pSessionActive: false,
    });
  });
});
