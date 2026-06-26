import { describe, expect, it } from "vitest";
import type { Participant, PlaybackState, WatchSourceDescriptor } from "@anidachi/protocol";
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

    expect(room.updateHostState("viewer", state).accepted).toBe(false);
    expect(room.updateHostState("host", state).accepted).toBe(true);
    expect(room.updateHostState("missing", state).accepted).toBe(false);
  });

  it("tracks source descriptors and increments source generation only on source changes", () => {
    const room = new RoomState("room-1");
    room.join(participant("host", "host"));

    const firstState = playbackState("crunchyroll|series-a|s1|e1", "https://crunchyroll.com/watch/one");
    const firstUpdate = room.updateHostState("host", firstState, sourceDescriptor(firstState, "Episode 1"));

    expect(firstUpdate.accepted).toBe(true);
    expect(firstUpdate.sourceChanged).toBe(false);
    expect(room.sourceGeneration).toBe(1);

    const initialSnapshot = room.snapshot;
    expect(initialSnapshot.type).toBe("ROOM_SNAPSHOT");
    if (initialSnapshot.type !== "ROOM_SNAPSHOT") {
      throw new Error("Expected room snapshot");
    }
    expect(initialSnapshot.source?.videoFingerprint).toBe(firstState.videoFingerprint);
    expect(initialSnapshot.source?.title).toBe("Episode 1");

    const repeatedUpdate = room.updateHostState(
      "host",
      { ...firstState, hostTime: 42, updatedAt: 2000 },
      sourceDescriptor(firstState, "Episode 1"),
    );
    expect(repeatedUpdate.sourceChanged).toBe(false);
    expect(room.sourceGeneration).toBe(1);

    const nextState = playbackState("crunchyroll|series-a|s1|e2", "https://crunchyroll.com/watch/two");
    const changedUpdate = room.updateHostState("host", nextState, sourceDescriptor(nextState, "Episode 2"));

    expect(changedUpdate.accepted).toBe(true);
    expect(changedUpdate.sourceChanged).toBe(true);
    expect(changedUpdate.previousSource?.videoFingerprint).toBe(firstState.videoFingerprint);
    expect(changedUpdate.source?.videoFingerprint).toBe(nextState.videoFingerprint);
    expect(room.sourceGeneration).toBe(2);

    const changedSnapshot = room.snapshot;
    expect(changedSnapshot.type).toBe("ROOM_SNAPSHOT");
    if (changedSnapshot.type !== "ROOM_SNAPSHOT") {
      throw new Error("Expected room snapshot");
    }
    expect(changedSnapshot.sourceGeneration).toBe(2);
    expect(changedSnapshot.source?.title).toBe("Episode 2");
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

  it("includes room generations and a monotonic room sequence in snapshots", () => {
    const room = new RoomState("room-1");
    const initial = room.snapshot;
    expect(initial.type).toBe("ROOM_SNAPSHOT");
    if (initial.type !== "ROOM_SNAPSHOT") {
      throw new Error("Expected room snapshot");
    }

    expect(initial.roomGeneration).toBe(1);
    expect(initial.sourceGeneration).toBe(1);
    expect(initial.serverSeq).toBe(0);

    room.join(participant("host", "host"));
    const afterJoin = room.snapshot;
    expect(afterJoin.type).toBe("ROOM_SNAPSHOT");
    if (afterJoin.type !== "ROOM_SNAPSHOT") {
      throw new Error("Expected room snapshot");
    }

    expect(afterJoin.roomGeneration).toBe(1);
    expect(afterJoin.sourceGeneration).toBe(1);
    expect(afterJoin.serverSeq).toBeGreaterThan(initial.serverSeq);
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

  it("uses signed room capabilities for participant caps", () => {
    const room = new RoomState("room-1", {
      hostPlanCode: "plus",
      maxParticipants: 6,
      maxMediaSeats: 4,
      canNameRoom: true,
      canSendPushInvites: true,
    });
    for (let i = 1; i <= 6; i++) {
      room.join(participant(`u${i}`, i === 1 ? "host" : "viewer"));
    }

    expect(room.canAdmit("u7")).toBe(false);
    expect(room.canAdmit("u3")).toBe(true);
    const snapshot = room.snapshot;
    expect(snapshot.type).toBe("ROOM_SNAPSHOT");
    if (snapshot.type !== "ROOM_SNAPSHOT") {
      throw new Error("Expected room snapshot");
    }
    expect(snapshot.capabilities?.maxParticipants).toBe(6);
  });

  it("caps camera/media seats independently from participant count", () => {
    const room = new RoomState("room-1", {
      hostPlanCode: "pro",
      maxParticipants: 15,
      maxMediaSeats: 2,
      canNameRoom: true,
      canSendPushInvites: true,
    });
    room.join(participant("u1", "host"));
    room.join(participant("u2"));
    room.join(participant("u3"));

    expect(room.canEnableCamera("u1")).toBe(true);
    room.setCamera("u1", true);
    expect(room.canEnableCamera("u2")).toBe(true);
    room.setCamera("u2", true);
    expect(room.canEnableCamera("u3")).toBe(false);
    expect(room.canEnableCamera("missing")).toBe(false);

    room.setCamera("u2", false);
    expect(room.canEnableCamera("u3")).toBe(true);
  });
});

function playbackState(videoFingerprint: string, sourceUrl: string): PlaybackState {
  return {
    videoFingerprint,
    sourceUrl,
    playing: true,
    hostTime: 10,
    updatedAt: 1000,
    playbackRate: 1,
  };
}

function sourceDescriptor(state: PlaybackState, title: string): WatchSourceDescriptor {
  if (!state.sourceUrl) {
    throw new Error("Expected sourceUrl");
  }

  return {
    provider: "crunchyroll",
    sourceUrl: state.sourceUrl,
    canonicalUrl: state.sourceUrl,
    videoFingerprint: state.videoFingerprint,
    title,
    seriesTitle: "Series A",
    episodeTitle: title,
    episodeNumber: title === "Episode 1" ? 1 : 2,
  };
}
