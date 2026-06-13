import { describe, expect, it } from "vitest";
import type { Participant, PlaybackState } from "@anidachi/protocol";
import { RoomState } from "../src/room-state";

function participant(id: string, role: Participant["role"] = "viewer"): Participant {
  return {
    id,
    displayName: id,
    role,
    cameraEnabled: false,
    syncStatus: "unknown",
    lastSeenAt: 0,
  };
}

describe("RoomState", () => {
  it("uses server-provided host role instead of join order", () => {
    const room = new RoomState("room-1");
    const viewer = room.join(participant("user-1"));
    const host = room.join(participant("user-2", "host"));

    expect(viewer.role).toBe("viewer");
    expect(host.role).toBe("host");
    expect(room.currentHostId).toBe("user-2");
  });

  it("keeps subsequent participants as viewers", () => {
    const room = new RoomState("room-1");
    room.join(participant("user-1", "host"));
    const joined = room.join(participant("user-2"));

    expect(joined.role).toBe("viewer");
    expect(room.participants).toHaveLength(2);
  });

  it("accepts playback state updates only from the host", () => {
    const room = new RoomState("room-1");
    room.join(participant("host", "host"));
    room.join(participant("viewer"));

    const state: PlaybackState = {
      videoFingerprint: "video",
      playing: true,
      hostTime: 10,
      updatedAt: 1000,
      playbackRate: 1,
    };

    expect(room.updateHostState("viewer", state)).toBe(false);
    expect(room.updateHostState("host", state)).toBe(true);
    expect(room.updateHostState("missing", state)).toBe(false);
  });

  it("allows only the host to control playback", () => {
    const room = new RoomState("room-1");
    room.join(participant("host", "host"));
    room.join(participant("viewer"));

    expect(room.canControlPlayback("host")).toBe(true);
    expect(room.canControlPlayback("viewer")).toBe(false);
    expect(room.canControlPlayback("missing")).toBe(false);
  });

  it("allows targeted signaling only between joined participants", () => {
    const room = new RoomState("room-1");
    room.join(participant("host", "host"));
    room.join(participant("viewer"));

    expect(room.canSignal("host", "viewer")).toBe(true);
    expect(room.canSignal("viewer", "host")).toBe(true);
    expect(room.canSignal("host", "host")).toBe(false);
    expect(room.canSignal("host", "missing")).toBe(false);
    expect(room.canSignal("missing", "host")).toBe(false);
  });

  it("does not promote viewers when host leaves", () => {
    const room = new RoomState("room-1");
    room.join(participant("host", "host"));
    room.join(participant("viewer"));
    room.leave("host");

    expect(room.currentHostId).toBeNull();
    expect(room.participants.find((item) => item.id === "viewer")?.role).toBe("viewer");
  });

  it("updates camera status for participants", () => {
    const room = new RoomState("room-1");
    room.join(participant("user-1"));

    expect(room.setCamera("user-1", true)?.cameraEnabled).toBe(true);
    expect(room.snapshot.type).toBe("ROOM_SNAPSHOT");
  });

  it("caps the room at four participants but admits reconnecting members", () => {
    const room = new RoomState("room-1");
    room.join(participant("u1", "host"));
    room.join(participant("u2"));
    room.join(participant("u3"));
    room.join(participant("u4"));

    // Room is full: a new fifth user is rejected.
    expect(room.canAdmit("u5")).toBe(false);
    // But an already-joined member reconnecting is always admitted.
    expect(room.canAdmit("u2")).toBe(true);

    // After someone leaves, a new user can join again.
    room.leave("u2");
    expect(room.canAdmit("u5")).toBe(true);
  });
});
