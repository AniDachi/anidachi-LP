import { describe, expect, it } from "vitest";
import type { Participant, PlaybackState, WatchSourceDescriptor } from "@anidachi/protocol";
import { RoomState } from "../src/room-state";

function participant(id: string, role: Participant["role"] = "viewer"): Participant {
  return {
    id,
    displayName: id,
    role,
    cameraEnabled: false,
    mediaSeat: "none",
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

  it("restores durable snapshots without losing host/source/camera state", () => {
    const room = new RoomState("room-1", {
      hostPlanCode: "plus",
      maxParticipants: 6,
      maxMediaSeats: 4,
      canNameRoom: true,
      canSendPushInvites: true,
    });
    room.join(participant("host", "host"));
    room.join(participant("viewer"));
    room.setCamera("viewer", true);
    const state = playbackState("crunchyroll|series-a|s1|e7", "https://crunchyroll.com/watch/e7");
    room.updateHostState("host", state, sourceDescriptor(state, "Episode 7"));

    const restored = new RoomState("room-1", undefined, room.toSnapshot(1234));
    const snapshot = restored.snapshot;

    expect(snapshot.type).toBe("ROOM_SNAPSHOT");
    if (snapshot.type !== "ROOM_SNAPSHOT") {
      throw new Error("Expected room snapshot");
    }
    expect(snapshot.capabilities?.hostPlanCode).toBe("plus");
    expect(snapshot.participants).toHaveLength(2);
    expect(snapshot.participants.find((item) => item.id === "viewer")?.cameraEnabled).toBe(true);
    expect(snapshot.hostState?.videoFingerprint).toBe(state.videoFingerprint);
    expect(snapshot.source?.title).toBe("Episode 7");
    expect(restored.currentHostId).toBe("host");
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

  it("auto-assigns media seats up to the signed media limit and leaves overflow chat-only", () => {
    const room = new RoomState("room-1", {
      hostPlanCode: "pro",
      maxParticipants: 15,
      maxMediaSeats: 2,
      canNameRoom: true,
      canSendPushInvites: true,
    });
    const host = room.join(participant("u1", "host"));
    const viewer = room.join(participant("u2"));
    const overflow = room.join(participant("u3"));

    expect(host.mediaSeat).toBe("joined");
    expect(host.mediaSeatSource).toBe("auto");
    expect(viewer.mediaSeat).toBe("joined");
    expect(viewer.mediaSeatSource).toBe("auto");
    expect(overflow.mediaSeat).toBe("none");
    expect(room.occupiedMediaSeats).toBe(2);

    expect(room.canEnableCamera("u1")).toBe(true);
    expect(room.canEnableCamera("u2")).toBe(true);
    expect(room.canEnableCamera("u3")).toBe(false);
  });

  it("treats camera as an option inside a media seat instead of the media seat itself", () => {
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
    expect(room.canEnableCamera("u3")).toBe(false);
    expect(room.participants.find((item) => item.id === "u2")?.mediaSeat).toBe("joined");
  });

  it("lets the host grant and revoke media seats without controlling user camera or mic", () => {
    const room = new RoomState("room-1", {
      hostPlanCode: "pro",
      maxParticipants: 15,
      maxMediaSeats: 2,
      canNameRoom: true,
      canSendPushInvites: true,
    });
    room.join(participant("host", "host"));
    room.join(participant("viewer-a"));
    room.join(participant("viewer-b"));

    expect(room.requestMediaSeat("viewer-b")?.mediaSeat).toBe("requested");
    expect(room.grantMediaSeat("viewer-b", "viewer-a")).toEqual({
      accepted: false,
      code: "NOT_HOST",
    });
    expect(room.grantMediaSeat("viewer-b", "host")).toEqual({
      accepted: false,
      code: "MEDIA_SEATS_FULL",
    });

    const revoked = room.revokeMediaSeat("viewer-a", "host");
    expect(revoked.accepted).toBe(true);
    expect(room.participants.find((item) => item.id === "viewer-a")?.mediaSeat).toBe("none");
    expect(room.participants.find((item) => item.id === "viewer-a")?.cameraEnabled).toBe(false);

    const granted = room.grantMediaSeat("viewer-b", "host");
    expect(granted.accepted).toBe(true);
    expect(room.participants.find((item) => item.id === "viewer-b")?.mediaSeat).toBe("joined");
    expect(room.participants.find((item) => item.id === "viewer-b")?.mediaSeatSource).toBe("host");
    expect(room.canEnableCamera("viewer-b")).toBe(true);
  });

  it("preserves explicit media-seat removal across unrelated leave and restore", () => {
    const room = new RoomState("room-1", {
      hostPlanCode: "pro",
      maxParticipants: 15,
      maxMediaSeats: 3,
      canNameRoom: true,
      canSendPushInvites: true,
    });
    room.join(participant("host", "host"));
    room.join(participant("viewer-a"));
    room.join(participant("viewer-b"));

    room.revokeMediaSeat("viewer-a", "host");
    expect(room.participants.find((item) => item.id === "viewer-a")?.mediaSeat).toBe("none");

    room.leave("viewer-b");
    expect(room.participants.find((item) => item.id === "viewer-a")?.mediaSeat).toBe("none");

    const restored = new RoomState("room-1", undefined, room.toSnapshot(1234));
    expect(restored.participants.find((item) => item.id === "viewer-a")?.mediaSeat).toBe("none");
    expect(restored.canEnableCamera("viewer-a")).toBe(false);
  });

  it("allows P2P signaling only between joined media-seat participants", () => {
    const room = new RoomState("room-1", {
      hostPlanCode: "pro",
      maxParticipants: 15,
      maxMediaSeats: 2,
      canNameRoom: true,
      canSendPushInvites: true,
    });
    room.join(participant("host", "host"));
    room.join(participant("viewer-a"));
    room.join(participant("viewer-b"));

    expect(room.canSignal("host", "viewer-a")).toBe(true);
    expect(room.canSignal("host", "viewer-b")).toBe(false);

    room.revokeMediaSeat("viewer-a", "host");
    room.grantMediaSeat("viewer-b", "host");

    expect(room.canSignal("host", "viewer-a")).toBe(false);
    expect(room.canSignal("host", "viewer-b")).toBe(true);
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
