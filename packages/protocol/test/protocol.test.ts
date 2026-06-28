import { describe, expect, it } from "vitest";
import {
  ClientEventSchema,
  type PlaybackState,
  ReactionEventSchema,
  RoomCapabilitiesSchema,
  ServerEventSchema,
  WatchSourceDescriptorSchema,
  getExpectedHostTime,
  normalizeRemotePlaybackState,
  getSyncCorrection,
} from "../src";

describe("room protocol schemas", () => {
  it("accepts room keepalive ping and pong events", () => {
    expect(
      ClientEventSchema.parse({
        type: "PING",
        roomId: "room-1",
        sentAt: 1_000,
      }),
    ).toEqual({
      type: "PING",
      roomId: "room-1",
      sentAt: 1_000,
    });

    expect(
      ServerEventSchema.parse({
        type: "PONG",
        roomId: "room-1",
        sentAt: 1_000,
        serverTime: 1_005,
      }),
    ).toEqual({
      type: "PONG",
      roomId: "room-1",
      sentAt: 1_000,
      serverTime: 1_005,
    });
  });

  it("accepts room snapshots with capability metadata", () => {
    const snapshot = ServerEventSchema.parse({
      type: "ROOM_SNAPSHOT",
      roomId: "room-1",
      roomGeneration: 1,
      serverSeq: 0,
      sourceGeneration: 1,
      capabilities: {
        hostPlanCode: "pro",
        maxParticipants: 15,
        maxMediaSeats: 4,
        canNameRoom: true,
        canSendPushInvites: true,
      },
      participants: [],
    });

    expect(snapshot.type).toBe("ROOM_SNAPSHOT");
    if (snapshot.type !== "ROOM_SNAPSHOT") {
      throw new Error("Expected room snapshot");
    }
    expect(snapshot.capabilities?.hostPlanCode).toBe("pro");
    expect(snapshot.capabilities?.maxParticipants).toBe(15);

    expect(() =>
      ServerEventSchema.parse({
        type: "ROOM_SNAPSHOT",
        roomId: "room-1",
        roomGeneration: 1,
        serverSeq: 0,
        sourceGeneration: 1,
        capabilities: {
          hostPlanCode: "pro",
          maxParticipants: 0,
          maxMediaSeats: 4,
          canNameRoom: true,
          canSendPushInvites: true,
        },
        participants: [],
      }),
    ).toThrow();

    const parsedLegacy = RoomCapabilitiesSchema.parse({
      hostPlanCode: "junkie",
      maxParticipants: 15,
      maxMediaSeats: 4,
      canNameRoom: true,
      canSendPushInvites: true,
    });
    expect(parsedLegacy.hostPlanCode).toBe("pro");
  });

  it("accepts valid join and reaction events", () => {
    const joined = ClientEventSchema.parse({
      type: "JOIN",
      roomId: "room-1",
      lastSeenP2PServerSeq: 24,
      videoFingerprint: "video-1",
      participant: {
        id: "user-1",
        displayName: "Max",
        role: "viewer",
        cameraEnabled: false,
        syncStatus: "unknown",
        lastSeenAt: 1000,
      },
    });

    const reaction = ReactionEventSchema.parse({
      id: "reaction-1",
      userId: "user-1",
      roomId: "room-1",
      emoji: "🔥",
      text: "огонь",
      videoTime: 12,
      createdAt: 1100,
    });

    expect(joined.type).toBe("JOIN");
    expect(reaction.emoji).toBe("🔥");
  });

  it("accepts atomic fire reaction effect metadata", () => {
    const reaction = ReactionEventSchema.parse({
      id: "reaction-super",
      userId: "user-1",
      roomId: "room-1",
      emoji: "🔥",
      effect: "atomic-fire",
      videoTime: 12,
      createdAt: 1100,
    });

    expect(reaction.effect).toBe("atomic-fire");
  });

  it("accepts text-only reactions and rejects empty reactions", () => {
    const reaction = ReactionEventSchema.parse({
      id: "reaction-2",
      userId: "user-1",
      roomId: "room-1",
      text: "что это было",
      videoTime: 14,
      createdAt: 1200,
    });

    expect(reaction.text).toBe("что это было");
    expect(reaction.emoji).toBeUndefined();

    expect(() =>
      ReactionEventSchema.parse({
        id: "reaction-3",
        userId: "user-1",
        roomId: "room-1",
        videoTime: 15,
        createdAt: 1300,
      }),
    ).toThrow();
  });

  it("rejects malformed playback state events", () => {
    expect(() =>
      ClientEventSchema.parse({
        type: "HOST_STATE",
        roomId: "room-1",
        state: {
          videoFingerprint: "",
          playing: true,
          hostTime: -1,
          updatedAt: 1000,
          playbackRate: 1,
        },
      }),
    ).toThrow();
  });

  it("accepts source descriptors and source change events", () => {
    const source = WatchSourceDescriptorSchema.parse({
      provider: "crunchyroll",
      sourceUrl: "https://www.crunchyroll.com/watch/episode-2",
      canonicalUrl: "https://www.crunchyroll.com/watch/episode-2",
      videoFingerprint: "crunchyroll|series-a|s1|e2",
      title: "Episode 2",
      seriesTitle: "Series A",
      episodeTitle: "Episode 2",
      seasonNumber: 1,
      episodeNumber: 2,
      duration: 1440,
      posterUrl: "https://static.example.com/poster.jpg",
    });

    expect(source.provider).toBe("crunchyroll");
    expect(source.episodeNumber).toBe(2);

    const event = ServerEventSchema.parse({
      type: "SOURCE_CHANGED",
      roomId: "room-1",
      roomGeneration: 1,
      sourceGeneration: 2,
      serverSeq: 12,
      serverReceivedAt: 1_000,
      source,
      previousSource: {
        ...source,
        sourceUrl: "https://www.crunchyroll.com/watch/episode-1",
        canonicalUrl: "https://www.crunchyroll.com/watch/episode-1",
        videoFingerprint: "crunchyroll|series-a|s1|e1",
        title: "Episode 1",
        episodeTitle: "Episode 1",
        episodeNumber: 1,
      },
      hostState: {
        videoFingerprint: source.videoFingerprint,
        sourceUrl: source.sourceUrl,
        playing: true,
        hostTime: 10,
        updatedAt: 1_000,
        playbackRate: 1,
      },
    });

    expect(event.type).toBe("SOURCE_CHANGED");
    if (event.type !== "SOURCE_CHANGED") {
      throw new Error("Expected SOURCE_CHANGED");
    }
    expect(event.sourceGeneration).toBe(2);
    expect(event.previousSource?.episodeNumber).toBe(1);
  });

  it("accepts explicit playback command server events", () => {
    expect(
      ServerEventSchema.parse({
        type: "SEEK",
        roomId: "room-1",
        byUserId: "host",
        to: 123,
      }),
    ).toEqual({
      type: "SEEK",
      roomId: "room-1",
      byUserId: "host",
      to: 123,
    });
  });

  it("accepts targeted P2P signaling events", () => {
    const offer = ClientEventSchema.parse({
      type: "P2P_SIGNAL",
      clientSignalId: "signal-1",
      roomId: "room-1",
      fromUserId: "user-1",
      senderConnectionId: "connection-1",
      toUserId: "user-2",
      signal: {
        kind: "offer",
        sdp: { type: "offer", sdp: "v=0\r\n" },
      },
    });

    const candidate = ServerEventSchema.parse({
      type: "P2P_SIGNAL",
      clientSignalId: "signal-2",
      roomId: "room-1",
      fromUserId: "user-2",
      roomGeneration: 1,
      senderConnectionId: "connection-2",
      serverReceivedAt: 1_000,
      serverSeq: 3,
      sourceGeneration: 1,
      toUserId: "user-1",
      signal: {
        kind: "ice",
        candidate: {
          candidate: "candidate:1 1 udp 2122260223 192.168.1.2 61764 typ host",
          sdpMid: "0",
          sdpMLineIndex: 0,
        },
      },
    });

    expect(offer.type).toBe("P2P_SIGNAL");
    expect(candidate.type).toBe("P2P_SIGNAL");
    if (candidate.type !== "P2P_SIGNAL") {
      throw new Error("Expected P2P signal");
    }
    expect(candidate.signal.kind).toBe("ice");
    expect(candidate.roomGeneration).toBe(1);
    expect(candidate.serverSeq).toBe(3);
    expect(candidate.sourceGeneration).toBe(1);
  });

  it("accepts lightweight P2P renegotiation requests", () => {
    const renegotiate = ClientEventSchema.parse({
      type: "P2P_SIGNAL",
      clientSignalId: "signal-3",
      roomId: "room-1",
      fromUserId: "user-1",
      roomGeneration: 1,
      senderConnectionId: "connection-1",
      sourceGeneration: 2,
      toUserId: "user-2",
      signal: { kind: "renegotiate" },
    });

    expect(renegotiate.type).toBe("P2P_SIGNAL");
    if (renegotiate.type !== "P2P_SIGNAL") {
      throw new Error("Expected P2P signal");
    }
    expect(renegotiate.signal.kind).toBe("renegotiate");
  });

  it("rejects malformed targeted P2P signaling events", () => {
    expect(() =>
      ClientEventSchema.parse({
        type: "P2P_SIGNAL",
        clientSignalId: "signal-4",
        roomId: "room-1",
        fromUserId: "user-1",
        senderConnectionId: "connection-1",
        toUserId: "user-2",
        signal: {
          kind: "offer",
          sdp: { type: "answer", sdp: "v=0\r\n" },
        },
      }),
    ).toThrow();

    expect(() =>
      ClientEventSchema.parse({
        type: "P2P_SIGNAL",
        roomId: "room-1",
        fromUserId: "user-1",
        senderConnectionId: "connection-1",
        toUserId: "user-2",
        signal: { kind: "renegotiate" },
      }),
    ).toThrow();

    expect(() =>
      ClientEventSchema.parse({
        type: "P2P_SIGNAL",
        clientSignalId: "signal-5",
        roomId: "room-1",
        fromUserId: "user-1",
        toUserId: "user-2",
        signal: { kind: "renegotiate" },
      }),
    ).toThrow();
  });
});

describe("sync math", () => {
  const state: PlaybackState = {
    videoFingerprint: "video-1",
    playing: true,
    hostTime: 10,
    updatedAt: 1000,
    playbackRate: 1,
  };

  it("computes expected host time while playing", () => {
    expect(getExpectedHostTime(state, 3500)).toBe(12.5);
  });

  it("ignores small drift", () => {
    expect(getSyncCorrection(12.9, state, 3500).action).toBe("none");
  });

  it("seeks on medium drift", () => {
    expect(getSyncCorrection(16, state, 3500).action).toBe("seek");
  });

  it("shows catch-up on large drift", () => {
    expect(getSyncCorrection(24, state, 3500).action).toBe("catch-up");
  });

  it("normalizes remote playback timestamps to the receiver clock", () => {
    const hostClockState: PlaybackState = {
      ...state,
      hostTime: 42,
      updatedAt: 3_600_000,
    };

    const normalized = normalizeRemotePlaybackState(hostClockState, 10_000);

    expect(normalized.updatedAt).toBe(10_000);
    expect(getExpectedHostTime(normalized, 11_500)).toBe(43.5);
  });
});
