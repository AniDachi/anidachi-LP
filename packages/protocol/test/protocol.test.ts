import { describe, expect, it } from "vitest";
import {
  ClientEventSchema,
  EMPTY_ROOM_TIMEOUT_MS,
  MAX_DISPLAY_NAME_CHARS,
  MAX_ICE_CANDIDATE_BYTES,
  MAX_PARTICIPANT_ID_CHARS,
  MAX_ROOM_HISTORY_ATTESTATION_CHARS,
  ROOM_HISTORY_OFFLINE_GRACE_SECONDS,
  RoomHistoryAttestationClaimsSchema,
  MAX_ROOM_ID_CHARS,
  MAX_SDP_BYTES,
  MAX_SESSION_ID_CHARS,
  MAX_REACTION_EMOJI_CHARS,
  MAX_URL_CHARS,
  MAX_VIDEO_FINGERPRINT_CHARS,
  MAX_WATCH_TITLE_CHARS,
  type PlaybackState,
  ReactionEventSchema,
  RoomCapabilitiesSchema,
  RoomEndReasonSchema,
  RoomSourcePersistenceAcknowledgementSchema,
  RoomSourcePersistenceCallbackSchema,
  ServerEventSchema,
  WatchSourceDescriptorSchema,
  createEmptyRoomEndEventId,
  getExpectedHostTime,
  normalizeRemotePlaybackState,
  getSyncCorrection,
} from "../src";

describe("room protocol schemas", () => {
  // Break caught: an internal callback without a positive generation or a
  // canonical source could regress durable room state.
  it("defines strict source persistence callback and acknowledgement envelopes", () => {
    const callback = {
      roomId: "room-1",
      sourceGeneration: 2,
      source: {
        provider: "youtube",
        sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoFingerprint: "youtube|dQw4w9WgXcQ",
      },
    } as const;

    expect(RoomSourcePersistenceCallbackSchema.parse(callback)).toEqual(callback);
    expect(() => RoomSourcePersistenceCallbackSchema.parse({ ...callback, sourceGeneration: 0 })).toThrow();
    expect(() => RoomSourcePersistenceCallbackSchema.parse({ ...callback, extra: true })).toThrow();

    expect(RoomSourcePersistenceAcknowledgementSchema.parse({
      ok: true,
      outcome: "persisted",
      sourceGeneration: 2,
    })).toEqual({ ok: true, outcome: "persisted", sourceGeneration: 2 });
    expect(RoomSourcePersistenceAcknowledgementSchema.parse({
      ok: true,
      outcome: "stale",
      sourceGeneration: 1,
    })).toEqual({ ok: true, outcome: "stale", sourceGeneration: 1 });
    expect(() => RoomSourcePersistenceAcknowledgementSchema.parse({
      ok: true,
      outcome: "persisted",
      sourceGeneration: 0,
    })).toThrow();
    expect(() => RoomSourcePersistenceAcknowledgementSchema.parse({
      ok: true,
      outcome: "persisted",
      sourceGeneration: 2,
      unexpected: true,
    })).toThrow();
  });

  it("derives one private empty-room callback identity across service planes", async () => {
    const roomId = "private-room-1";
    const emptySince = 1_000;
    const eventId = await createEmptyRoomEndEventId(roomId, emptySince);

    expect(EMPTY_ROOM_TIMEOUT_MS).toBe(4 * 60 * 60 * 1_000);
    expect(eventId).toMatch(/^empty_timeout:[a-f0-9]{64}$/);
    expect(eventId).toBe(await createEmptyRoomEndEventId(roomId, emptySince));
    expect(eventId).not.toContain(roomId);
    expect(eventId).not.toBe(await createEmptyRoomEndEventId(roomId, emptySince + 1));
  });

  it("accepts one terminal room-ended event with a bounded reason", () => {
    expect(RoomEndReasonSchema.options).toEqual([
      "host_ended",
      "host_disconnected",
      "empty_timeout",
      "quota_exhausted",
    ]);
    expect(
      ServerEventSchema.parse({
        type: "ROOM_ENDED",
        roomId: "room-1",
        endedAt: 1_000,
        reason: "host_ended",
      }),
    ).toEqual({
      type: "ROOM_ENDED",
      roomId: "room-1",
      endedAt: 1_000,
      reason: "host_ended",
    });
  });
  it("exports the canonical room signaling limits", () => {
    expect(MAX_ROOM_ID_CHARS).toBe(128);
    expect(MAX_PARTICIPANT_ID_CHARS).toBe(128);
    expect(MAX_SESSION_ID_CHARS).toBe(128);
    expect(MAX_SDP_BYTES).toBe(48 * 1024);
    expect(MAX_ICE_CANDIDATE_BYTES).toBe(2 * 1024);
    expect(MAX_VIDEO_FINGERPRINT_CHARS).toBe(400);
    expect(MAX_DISPLAY_NAME_CHARS).toBe(120);
    expect(MAX_URL_CHARS).toBe(2048);
    expect(MAX_REACTION_EMOJI_CHARS).toBe(64);
    expect(MAX_WATCH_TITLE_CHARS).toBe(300);
  });

  it("rejects room, participant, and session identifiers beyond their bounds", () => {
    const baseJoin = {
      type: "JOIN",
      roomId: "room-1",
      videoFingerprint: "video-1",
      participantSessionId: "session-1",
      participant: {
        id: "user-1",
        displayName: "Max",
        role: "viewer",
        cameraEnabled: false,
        mediaSeat: "none",
        syncStatus: "unknown",
        lastSeenAt: 1_000,
      },
    } as const;

    expect(() =>
      ClientEventSchema.parse({ ...baseJoin, roomId: "r".repeat(MAX_ROOM_ID_CHARS + 1) }),
    ).toThrow();
    expect(() =>
      ClientEventSchema.parse({
        ...baseJoin,
        participant: { ...baseJoin.participant, id: "u".repeat(MAX_PARTICIPANT_ID_CHARS + 1) },
      }),
    ).toThrow();
    expect(() =>
      ClientEventSchema.parse({
        ...baseJoin,
        participantSessionId: "s".repeat(MAX_SESSION_ID_CHARS + 1),
      }),
    ).toThrow();
  });

  it("rejects oversized SDP and ICE candidates", () => {
    const signalBase = {
      type: "P2P_SIGNAL",
      clientSignalId: "signal-1",
      roomId: "room-1",
      fromUserId: "user-1",
      senderConnectionId: "connection-1",
      toUserId: "user-2",
    } as const;

    for (const sdp of [
      "s".repeat(MAX_SDP_BYTES + 1),
      "é".repeat(MAX_SDP_BYTES / 2 + 1),
    ]) {
      expect(() =>
        ClientEventSchema.parse({
          ...signalBase,
          signal: { kind: "offer", sdp: { type: "offer", sdp } },
        }),
      ).toThrow();
    }
    for (const candidate of [
      "c".repeat(MAX_ICE_CANDIDATE_BYTES + 1),
      "é".repeat(MAX_ICE_CANDIDATE_BYTES / 2 + 1),
    ]) {
      expect(() =>
        ClientEventSchema.parse({
          ...signalBase,
          signal: { kind: "ice", candidate: { candidate } },
        }),
      ).toThrow();
    }
  });

  it("accepts 400-character fingerprints and rejects 401", () => {
    const event = {
      type: "JOIN",
      roomId: "room-1",
      participantSessionId: "session-1",
      participant: {
        id: "user-1",
        displayName: "Max",
        role: "viewer",
        cameraEnabled: false,
        mediaSeat: "none",
        syncStatus: "unknown",
        lastSeenAt: 1_000,
      },
    } as const;

    expect(() =>
      ClientEventSchema.parse({ ...event, videoFingerprint: "f".repeat(400) }),
    ).not.toThrow();
    expect(() =>
      ClientEventSchema.parse({ ...event, videoFingerprint: "f".repeat(401) }),
    ).toThrow();
  });

  it("bounds display names, URLs, and reaction emoji", () => {
    const participant = {
      id: "user-1",
      displayName: "D".repeat(MAX_DISPLAY_NAME_CHARS + 1),
      role: "viewer",
      cameraEnabled: false,
      mediaSeat: "none",
      syncStatus: "unknown",
      lastSeenAt: 1_000,
    } as const;
    expect(() =>
      ClientEventSchema.parse({
        type: "JOIN",
        roomId: "room-1",
        videoFingerprint: "video-1",
        participant,
      }),
    ).toThrow();

    const longUrl = `https://example.com/${"x".repeat(MAX_URL_CHARS)}`;
    expect(() =>
      ClientEventSchema.parse({
        type: "HOST_STATE",
        roomId: "room-1",
        state: {
          videoFingerprint: "video-1",
          sourceUrl: longUrl,
          playing: true,
          hostTime: 1,
          updatedAt: 1,
          playbackRate: 1,
        },
      }),
    ).toThrow();

    expect(() =>
      ClientEventSchema.parse({
        type: "JOIN",
        roomId: "room-1",
        videoFingerprint: "video-1",
        participant: { ...participant, displayName: "Max", avatarUrl: longUrl },
      }),
    ).toThrow();
    const descriptor = {
      provider: "generic",
      sourceUrl: "https://example.com/source",
      canonicalUrl: "https://example.com/canonical",
      videoFingerprint: "video-1",
      title: "Episode",
      posterUrl: "https://example.com/poster",
    } as const;
    for (const field of ["sourceUrl", "canonicalUrl", "posterUrl"] as const) {
      expect(() =>
        WatchSourceDescriptorSchema.parse({ ...descriptor, [field]: longUrl }),
      ).toThrow();
    }
    expect(() =>
      ReactionEventSchema.parse({
        id: "reaction-1",
        userId: "user-1",
        roomId: "room-1",
        emoji: "e".repeat(MAX_REACTION_EMOJI_CHARS + 1),
        videoTime: 1,
        createdAt: 1,
      }),
    ).toThrow();
  });

  it("uses the shared watch title bound for descriptor title fields", () => {
    const descriptor = {
      provider: "generic",
      sourceUrl: "https://example.com/source",
      canonicalUrl: "https://example.com/canonical",
      videoFingerprint: "video-1",
      title: "T".repeat(MAX_WATCH_TITLE_CHARS),
      seriesTitle: "S".repeat(MAX_WATCH_TITLE_CHARS),
      episodeTitle: "E".repeat(MAX_WATCH_TITLE_CHARS),
    } as const;

    expect(() => WatchSourceDescriptorSchema.parse(descriptor)).not.toThrow();
    for (const field of ["title", "seriesTitle", "episodeTitle"] as const) {
      expect(() =>
        WatchSourceDescriptorSchema.parse({
          ...descriptor,
          [field]: "x".repeat(MAX_WATCH_TITLE_CHARS + 1),
        }),
      ).toThrow();
    }
  });

  it("rejects reactions scoped to a different nested room", () => {
    expect(() =>
      ClientEventSchema.parse({
        type: "REACTION",
        roomId: "room-1",
        reaction: {
          id: "reaction-1",
          userId: "user-1",
          roomId: "room-2",
          emoji: "fire",
          videoTime: 12,
          createdAt: 1_100,
        },
      }),
    ).toThrow();
  });

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

  it("accepts an optional P2P resync flag without breaking legacy room snapshots", () => {
    const legacy = ServerEventSchema.parse({
      type: "ROOM_SNAPSHOT",
      roomId: "room-1",
      roomGeneration: 1,
      serverSeq: 1,
      sourceGeneration: 1,
      participants: [],
    });
    const resync = ServerEventSchema.parse({
      type: "ROOM_SNAPSHOT",
      roomId: "room-1",
      roomGeneration: 1,
      serverSeq: 2,
      sourceGeneration: 1,
      participants: [],
      p2pResyncRequired: true,
    });

    expect(legacy).not.toHaveProperty("p2pResyncRequired");
    expect(resync).toMatchObject({ p2pResyncRequired: true });
    expect(() =>
      ServerEventSchema.parse({
        type: "ROOM_SNAPSHOT",
        roomId: "room-1",
        roomGeneration: 1,
        serverSeq: 2,
        sourceGeneration: 1,
        participants: [],
        p2pResyncRequired: "yes",
      }),
    ).toThrow();
  });

  it("carries a bounded authoritative room-usage summary in snapshots", () => {
    const snapshot = ServerEventSchema.parse({
      type: "ROOM_SNAPSHOT",
      roomId: "room-1",
      roomGeneration: 1,
      serverSeq: 1,
      sourceGeneration: 1,
      participants: [],
      roomUsage: {
        day: "2026-07-12",
        seconds: 125,
      },
    });

    expect(snapshot).toHaveProperty("roomUsage", {
      day: "2026-07-12",
      seconds: 125,
    });
    expect(() =>
      ServerEventSchema.parse({
        type: "ROOM_SNAPSHOT",
        roomId: "room-1",
        roomGeneration: 1,
        serverSeq: 1,
        sourceGeneration: 1,
        participants: [],
        roomUsage: { day: "12-07-2026", seconds: 125 },
      }),
    ).toThrow();
    expect(() =>
      ServerEventSchema.parse({
        type: "ROOM_SNAPSHOT",
        roomId: "room-1",
        roomGeneration: 1,
        serverSeq: 1,
        sourceGeneration: 1,
        participants: [],
        roomUsage: { day: "2026-07-12", seconds: -1 },
      }),
    ).toThrow();
  });

  it("accepts valid join and reaction events", () => {
    const joined = ClientEventSchema.parse({
      type: "JOIN",
      roomId: "room-1",
      lastSeenP2PServerSeq: 24,
      participantSessionId: "session-1",
      videoFingerprint: "video-1",
      participant: {
        id: "user-1",
        displayName: "Max",
        role: "viewer",
        cameraEnabled: false,
        mediaSeat: "none",
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

  it("accepts media seat state and host-controlled media seat events", () => {
    const snapshot = ServerEventSchema.parse({
      type: "ROOM_SNAPSHOT",
      roomId: "room-1",
      roomGeneration: 1,
      serverSeq: 0,
      sourceGeneration: 1,
      participants: [
        {
          id: "host",
          displayName: "Host",
          role: "host",
          cameraEnabled: false,
          mediaSeat: "joined",
          mediaSeatSource: "auto",
          syncStatus: "unknown",
          lastSeenAt: 1000,
        },
        {
          id: "viewer",
          displayName: "Viewer",
          role: "viewer",
          cameraEnabled: false,
          mediaSeat: "requested",
          syncStatus: "unknown",
          lastSeenAt: 1000,
        },
      ],
    });

    expect(snapshot.type).toBe("ROOM_SNAPSHOT");
    if (snapshot.type !== "ROOM_SNAPSHOT") {
      throw new Error("Expected room snapshot");
    }
    expect(snapshot.participants[0]?.mediaSeat).toBe("joined");
    expect(snapshot.participants[1]?.mediaSeat).toBe("requested");

    expect(
      ClientEventSchema.parse({
        type: "MEDIA_JOIN_REQUEST",
        roomId: "room-1",
        userId: "viewer",
      }),
    ).toMatchObject({ type: "MEDIA_JOIN_REQUEST" });
    expect(
      ClientEventSchema.parse({
        type: "MEDIA_SEAT_GRANT",
        roomId: "room-1",
        targetUserId: "viewer",
      }),
    ).toMatchObject({ type: "MEDIA_SEAT_GRANT" });
    expect(
      ClientEventSchema.parse({
        type: "MEDIA_SEAT_REVOKE",
        roomId: "room-1",
        targetUserId: "viewer",
      }),
    ).toMatchObject({ type: "MEDIA_SEAT_REVOKE" });
    expect(
      ClientEventSchema.parse({
        type: "MEDIA_SEAT_LEAVE",
        roomId: "room-1",
        userId: "viewer",
      }),
    ).toMatchObject({ type: "MEDIA_SEAT_LEAVE" });
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
    expect(WatchSourceDescriptorSchema.parse({ ...source, seasonNumber: 0 }).seasonNumber).toBe(0);
    expect(() =>
      WatchSourceDescriptorSchema.parse({ ...source, seasonNumber: 1001 }),
    ).toThrow();

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

  it("accepts one strict private room history authority server event", () => {
    const authority = {
      type: "ROOM_HISTORY_AUTHORITY" as const,
      roomId: "room-1",
      participantSessionId: "participant-session-1",
      roomGeneration: 2,
      sourceGeneration: 3,
      attestation: "opaque.signed.attestation",
    };

    expect(ServerEventSchema.parse(authority)).toEqual(authority);
    expect(() => ClientEventSchema.parse(authority)).toThrow();
    expect(() =>
      ServerEventSchema.parse({ ...authority, participantSessionId: undefined }),
    ).toThrow();
    expect(() =>
      ServerEventSchema.parse({ ...authority, purpose: "room" }),
    ).toThrow();
    expect(() =>
      ServerEventSchema.parse({ ...authority, audience: "anidachi-worker" }),
    ).toThrow();
    expect(() =>
      ServerEventSchema.parse({
        ...authority,
        attestation: "a".repeat(MAX_ROOM_HISTORY_ATTESTATION_CHARS + 1),
      }),
    ).toThrow();
  });

  it("defines one exact 24-hour room history attestation contract", () => {
    expect(ROOM_HISTORY_OFFLINE_GRACE_SECONDS).toBe(86_400);
    const claims = {
      typ: "room_history",
      iss: "anidachi-worker",
      aud: "anidachi-web-history",
      sub: "user-1",
      roomId: "room-1",
      participantSessionId: "participant-session-1",
      roomGeneration: 2,
      sourceGeneration: 3,
      iat: 1_786_680_000,
      exp: 1_786_766_400,
      jti: "11111111-1111-4111-8111-111111111111",
    };

    expect(RoomHistoryAttestationClaimsSchema.parse(claims)).toEqual(claims);
    expect(() => RoomHistoryAttestationClaimsSchema.parse({ ...claims, exp: undefined })).toThrow();
    expect(() => RoomHistoryAttestationClaimsSchema.parse({ ...claims, jti: undefined })).toThrow();
    expect(() => RoomHistoryAttestationClaimsSchema.parse({ ...claims, exp: claims.exp - 1 })).toThrow();
    expect(() => RoomHistoryAttestationClaimsSchema.parse({ ...claims, exp: claims.exp + 1 })).toThrow();
    expect(() => RoomHistoryAttestationClaimsSchema.parse({ ...claims, aud: [claims.aud] })).toThrow();
    expect(() => RoomHistoryAttestationClaimsSchema.parse({ ...claims, email: "private@example.com" })).toThrow();
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

  it("accepts bounded media-session identities without breaking legacy P2P envelopes", () => {
    const legacyClientEvent = ClientEventSchema.parse({
      type: "P2P_SIGNAL",
      clientSignalId: "signal-legacy",
      roomId: "room-1",
      fromUserId: "user-1",
      senderConnectionId: "connection-1",
      toUserId: "user-2",
      signal: { kind: "voice-start" },
    });
    const currentClientEvent = ClientEventSchema.parse({
      type: "P2P_SIGNAL",
      clientSignalId: "signal-current",
      roomId: "room-1",
      fromUserId: "user-1",
      senderConnectionId: "connection-1",
      senderMediaSessionId: "media-session-1",
      toUserId: "user-2",
      signal: { kind: "voice-start", voiceMode: "push-to-talk" },
    });
    const currentServerEvent = ServerEventSchema.parse({
      type: "P2P_SIGNAL",
      clientSignalId: "signal-server",
      roomId: "room-1",
      fromUserId: "user-1",
      roomGeneration: 1,
      senderConnectionId: "connection-1",
      senderMediaSessionId: "media-session-1",
      serverReceivedAt: 1_000,
      serverSeq: 3,
      sourceGeneration: 1,
      toUserId: "user-2",
      signal: { kind: "voice-start" },
    });

    expect(legacyClientEvent).not.toHaveProperty("senderMediaSessionId");
    expect(currentClientEvent).toMatchObject({
      senderMediaSessionId: "media-session-1",
      signal: {
        kind: "voice-start",
        voiceMode: "push-to-talk",
      },
    });
    expect(currentServerEvent).toMatchObject({
      senderMediaSessionId: "media-session-1",
    });

    const oversizedMediaSessionId = "m".repeat(MAX_SESSION_ID_CHARS + 1);
    expect(() =>
      ClientEventSchema.parse({
        type: "P2P_SIGNAL",
        clientSignalId: "signal-oversized-client",
        roomId: "room-1",
        fromUserId: "user-1",
        senderConnectionId: "connection-1",
        senderMediaSessionId: oversizedMediaSessionId,
        toUserId: "user-2",
        signal: { kind: "voice-start" },
      }),
    ).toThrow();
    expect(() =>
      ServerEventSchema.parse({
        type: "P2P_SIGNAL",
        clientSignalId: "signal-oversized-server",
        roomId: "room-1",
        fromUserId: "user-1",
        roomGeneration: 1,
        senderConnectionId: "connection-1",
        senderMediaSessionId: oversizedMediaSessionId,
        serverReceivedAt: 1_000,
        serverSeq: 3,
        sourceGeneration: 1,
        toUserId: "user-2",
        signal: { kind: "voice-start" },
      }),
    ).toThrow();
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
