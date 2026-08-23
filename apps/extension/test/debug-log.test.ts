import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDebugLog,
  getCompactDebugLogText,
  getDebugEntries,
  getDebugLogText,
  logDebug,
  playerOverlayGeometryDebugSnapshot,
  roomEventDebugSnapshot,
  videoDebugSnapshot,
} from "../src/debug-log";

function createStorageMock(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: createStorageMock(),
  });
}

describe("debug log", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    clearDebugLog();
  });

  it("removes exactly the legacy page-origin debug buffer once before logging", () => {
    localStorage.clear();
    localStorage.setItem("anidachi:debug-log:v1", "legacy-sensitive-buffer");
    localStorage.setItem("page-owned-neighbor", "must-remain");
    const getItem = vi.spyOn(localStorage, "getItem");
    const removeItem = vi.spyOn(localStorage, "removeItem");

    logDebug("room.ws", "connected");
    logDebug("room.ws", "still connected");

    expect(getItem).not.toHaveBeenCalledWith("anidachi:debug-log:v1");
    expect(localStorage.getItem("anidachi:debug-log:v1")).toBeNull();
    expect(localStorage.getItem("page-owned-neighbor")).toBe("must-remain");
    expect(removeItem).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith("anidachi:debug-log:v1");
  });

  it("stores debug entries without printing to the console by default", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    clearDebugLog();
    logDebug("test.scope", "captured message", {
      sourceUrl: "https://example.com/watch?token=secret",
    });

    expect(getDebugEntries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: "test.scope",
          message: "captured message",
          data: { sourceUrl: "https://example.com/watch" },
        }),
      ]),
    );
    expect(info).not.toHaveBeenCalled();
  });

  it("removes transient CDN and blob media identifiers from routine and serialized debug", () => {
    const cdnLiteral = "token-host/master.m3u8";
    const blobLiteral = "youtube-private-blob-7f2e";
    const cdnVideo = document.createElement("video");
    const blobVideo = document.createElement("video");
    Object.defineProperty(cdnVideo, "currentSrc", {
      configurable: true,
      value: `https://media-user:media-password@v.vrv.co/evs1/${cdnLiteral}?Policy=private-query#private-fragment`,
    });
    Object.defineProperty(blobVideo, "currentSrc", {
      configurable: true,
      value: `blob:https://www.youtube.com/${blobLiteral}`,
    });

    const snapshots = {
      cdn: videoDebugSnapshot(cdnVideo),
      blob: videoDebugSnapshot(blobVideo),
    };
    logDebug("video.event", "media sources", { video: snapshots.cdn });
    logDebug("video.event", "blob source", { video: snapshots.blob });

    const outputs = [
      JSON.stringify(snapshots),
      JSON.stringify(getDebugEntries()),
      getCompactDebugLogText(),
      getDebugLogText(),
    ];
    for (const output of outputs) {
      expect(output).not.toContain(cdnLiteral);
      expect(output).not.toContain(blobLiteral);
      expect(output).not.toContain("media-user");
      expect(output).not.toContain("media-password");
      expect(output).not.toContain("private-query");
      expect(output).not.toContain("private-fragment");
    }
    expect(JSON.stringify(snapshots.cdn)).toContain(
      "https://v.vrv.co/<redacted-media-source>",
    );
    expect(JSON.stringify(snapshots.blob)).toContain(
      "blob:https://www.youtube.com/<redacted-media-source>",
    );
  });

  it("keeps the bounded page diagnostics buffer out of page localStorage", () => {
    localStorage.clear();

    logDebug("room.ws", "connected", { roomId: "room-private" });
    window.dispatchEvent(new Event("pagehide"));

    expect(localStorage.getItem("anidachi:debug-log:v1")).toBeNull();
  });

  it("omits page titles, reaction text, user text, tokens, and attestations from routine diagnostics", () => {
    document.title = "Private episode title";
    const token = "access-token-private";
    const attestation = "header.private-payload.signature";

    logDebug("reaction", "sent", {
      text: "Private reaction text",
      title: "Private episode title",
      userText: "Private user text",
      accessToken: token,
      attestation,
    });

    const exported = getDebugLogText();
    for (const privateValue of [
      "Private episode title",
      "Private reaction text",
      "Private user text",
      token,
      attestation,
      "private-payload",
    ]) {
      expect(exported).not.toContain(privateValue);
    }
  });

  it("removes display names, invite labels, target keys, and reactions from memory, console, compact, and full diagnostics", () => {
    const privateValues = [
      "Unique Display Name 7f1d",
      "Unique Invite Label 81ab",
      "friend:unique-target-key-4e2c",
      "Unique Reaction 19cd",
      "Unique Source Title 65ee",
    ];
    localStorage.setItem("anidachi:debug-console", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logDebug("identity", "participant ready", {
      displayName: privateValues[0],
      label: privateValues[1],
      targetKey: privateValues[2],
      reaction: privateValues[3],
      sourceTitle: privateValues[4],
      roomId: "room-technical-id",
      status: "connected",
    });

    const outputs = [
      JSON.stringify(getDebugEntries()),
      getCompactDebugLogText(),
      getDebugLogText(),
      JSON.stringify(info.mock.calls),
    ];
    for (const output of outputs) {
      for (const privateValue of privateValues) {
        expect(output).not.toContain(privateValue);
      }
    }
    expect(outputs.join("\n")).toContain("connected");
  });

  it("removes current Crunchyroll and YouTube content identifiers from routine, compact, and full output", () => {
    const privateLiterals = [
      "G14PRIVATE1",
      "unique-private-episode-slug-91c2",
      "YtWatchA91Q",
      "YtShortB82W",
      "YtShortsC73E",
      "YtEmbedD64R",
      "YtNoCookieE55T",
      "unique-list-query-54db",
      "unique-share-query-3ed1",
      "unique-player-hash-a27f",
    ];

    logDebug("room.ws", "provider URL snapshot", {
      crunchyrollUrl:
        "https://www.crunchyroll.com/watch/G14PRIVATE1/unique-private-episode-slug-91c2?from=unique-list-query-54db#unique-player-hash-a27f",
      youtubeWatchUrl:
        "https://www.youtube.com/watch?v=YtWatchA91Q&list=unique-list-query-54db#unique-player-hash-a27f",
      youtubeShortUrl: "https://youtu.be/YtShortB82W?si=unique-share-query-3ed1",
      youtubeShortsUrl:
        "https://www.youtube.com/shorts/YtShortsC73E?feature=unique-share-query-3ed1",
      youtubeEmbedUrl:
        "https://www.youtube.com/embed/YtEmbedD64R?start=unique-list-query-54db",
      youtubePrivacyEmbedUrl:
        "https://www.youtube-nocookie.com/embed/YtNoCookieE55T#unique-player-hash-a27f",
    });

    const outputs = [
      JSON.stringify(getDebugEntries()),
      getCompactDebugLogText(),
      getDebugLogText(),
    ];
    for (const output of outputs) {
      for (const literal of privateLiterals) {
        expect(output).not.toContain(literal);
      }
      expect(output).toContain("https://www.crunchyroll.com/watch/<redacted-id>");
      expect(output).toContain("https://www.youtube.com/watch");
      expect(output).toContain("https://youtu.be/<redacted-id>");
      expect(output).toContain("https://www.youtube.com/shorts/<redacted-id>");
      expect(output).toContain("https://www.youtube.com/embed/<redacted-id>");
      expect(output).toContain("https://www.youtube-nocookie.com/embed/<redacted-id>");
      expect(output).not.toContain("?<redacted>");
      expect(output).not.toContain("#<redacted>");
    }
  });

  it("prints debug entries when console debug is explicitly enabled", () => {
    clearDebugLog();
    localStorage.setItem("anidachi:debug-console", "1");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logDebug("test.scope", "captured message");

    expect(info).toHaveBeenCalledWith("[Anidachi Debug]", "test.scope", "captured message", "");
  });

  it("keeps player geometry diagnostics bounded to numeric layout data", () => {
    expect(
      playerOverlayGeometryDebugSnapshot("youtube", {
        controlsVisible: true,
        viewport: { widthPx: 1280, heightPx: 720 },
        safeInsets: { topPx: 44, rightPx: 18, bottomPx: 88, leftPx: 8 },
        launcher: { topPx: 54, rightPx: 22 },
        panel: { topPx: 92, rightPx: 22 },
      }),
    ).toEqual({
      adapterId: "youtube",
      controlsVisible: true,
      viewport: { widthPx: 1280, heightPx: 720 },
      safeInsets: { topPx: 44, rightPx: 18, bottomPx: 88, leftPx: 8 },
      launcher: { topPx: 54, rightPx: 22 },
      panel: { topPx: 92, rightPx: 22 },
    });
  });

  it("omits room history attestation from event debug snapshots", () => {
    const attestation = "header.private-payload.signature";
    const snapshot = roomEventDebugSnapshot({
      type: "ROOM_HISTORY_AUTHORITY",
      roomId: "room-1",
      participantSessionId: "participant-session-1",
      roomGeneration: 2,
      sourceGeneration: 3,
      attestation,
    });

    expect(snapshot).toEqual({
      type: "ROOM_HISTORY_AUTHORITY",
      roomId: expect.stringMatching(/^id_[a-z0-9]+$/),
      participantSessionId: expect.stringMatching(/^id_[a-z0-9]+$/),
      roomGeneration: 2,
      sourceGeneration: 3,
    });
    expect(snapshot).not.toHaveProperty("attestation");
    expect(JSON.stringify(snapshot)).not.toContain(attestation);
    expect(JSON.stringify(snapshot)).not.toContain("private-payload");
  });

  it("keeps literal room and participant identifiers out of routine room snapshots", () => {
    const serialized = JSON.stringify([
      roomEventDebugSnapshot({
        type: "ROOM_SNAPSHOT",
        roomId: "room-private-literal",
        roomGeneration: 2,
        sourceGeneration: 3,
        serverSeq: 4,
        participants: [
          {
            id: "participant-private-literal",
            displayName: "Private user",
            role: "host",
            cameraEnabled: false,
            mediaSeat: "none",
            syncStatus: "unknown",
            lastSeenAt: 0,
          },
        ],
      }),
      roomEventDebugSnapshot({
        type: "ROOM_HISTORY_AUTHORITY",
        roomId: "room-private-literal",
        participantSessionId: "participant-session-private-literal",
        roomGeneration: 2,
        sourceGeneration: 3,
        attestation: "private-attestation",
      }),
      roomEventDebugSnapshot({
        type: "PLAY",
        roomId: "room-private-literal",
        byUserId: "by-user-private-literal",
        at: 10,
      }),
      roomEventDebugSnapshot({
        type: "CAMERA_ON",
        roomId: "room-private-literal",
        userId: "user-private-literal",
      }),
    ]);
    for (const rawIdentifier of [
      "room-private-literal",
      "participant-private-literal",
      "participant-session-private-literal",
      "by-user-private-literal",
      "user-private-literal",
    ]) {
      expect(serialized).not.toContain(rawIdentifier);
    }
  });

  it("hashes P2P participant identifiers and redacts ICE addresses", () => {
    clearDebugLog();

    logDebug("p2p.ice", "candidate error", {
      localParticipantId: "user-local",
      remoteUserId: "user-remote",
      remoteIds: ["user-remote", "user-third"],
      address: "192.168.1.20",
      candidate:
        "candidate:842163049 1 udp 1677729535 192.168.1.20 56143 typ srflx raddr 10.0.0.2 rport 56143",
    });

    const entry = getDebugEntries().find((item) => item.scope === "p2p.ice");
    expect(entry?.data).toEqual(
      expect.objectContaining({
        localParticipantId: expect.stringMatching(/^id_[a-z0-9]+$/),
        remoteUserId: expect.stringMatching(/^id_[a-z0-9]+$/),
        remoteIds: [
          expect.stringMatching(/^id_[a-z0-9]+$/),
          expect.stringMatching(/^id_[a-z0-9]+$/),
        ],
        address: "<redacted-media>",
        candidate: "<redacted-media>",
      }),
    );
    expect(JSON.stringify(entry?.data)).not.toContain("user-local");
    expect(JSON.stringify(entry?.data)).not.toContain("user-remote");
    expect(JSON.stringify(entry?.data)).not.toContain("192.168.1.20");
    expect(JSON.stringify(entry?.data)).not.toContain("10.0.0.2");
  });

  it("keeps diagnostic reason labels readable and hashes room session ids", () => {
    clearDebugLog();

    logDebug("room.ws", "connecting", {
      candidate: "candidate:842163049 1 udp 1677729535 203.0.113.8 56143 typ host",
      participantSessionId: "session-secret-value",
      reason: "join:hash",
      url: "https://staging.anidachi.app/room?token=secret",
    });

    const entry = getDebugEntries().find((item) => item.scope === "room.ws");
    expect(entry?.data).toEqual(
      expect.objectContaining({
        candidate: "<redacted-media>",
        participantSessionId: expect.stringMatching(/^id_[a-z0-9]+$/),
        reason: "join:hash",
        url: "https://staging.anidachi.app/room",
      }),
    );
    expect(JSON.stringify(entry?.data)).not.toContain("session-secret-value");
  });

  it("hashes identifier aliases used by auth and voice diagnostics", () => {
    clearDebugLog();

    logDebug("identity", "probe", {
      storedUserId: "stored-user-secret",
      probeUserId: "probe-user-secret",
      currentUserId: "current-user-secret",
      inviteId: "invite-secret",
      voiceParticipantIds: ["voice-user-one", "voice-user-two"],
    });

    const entry = getDebugEntries().find((item) => item.message === "probe");
    expect(entry?.data).toEqual({
      storedUserId: expect.stringMatching(/^id_[a-z0-9]+$/),
      probeUserId: expect.stringMatching(/^id_[a-z0-9]+$/),
      currentUserId: expect.stringMatching(/^id_[a-z0-9]+$/),
      inviteId: expect.stringMatching(/^id_[a-z0-9]+$/),
      voiceParticipantIds: [
        expect.stringMatching(/^id_[a-z0-9]+$/),
        expect.stringMatching(/^id_[a-z0-9]+$/),
      ],
    });
    expect(JSON.stringify(entry?.data)).not.toMatch(
      /stored-user-secret|probe-user-secret|current-user-secret|invite-secret|voice-user-(?:one|two)/,
    );
  });

  it("removes raw signaling, network, and identifier material from full exports", () => {
    clearDebugLog();

    logDebug("room.recv", "invalid server event", {
      raw: '{"sdp":"raw-sdp-frame","candidate":"raw-candidate-frame"}',
      error: "setRemoteDescription failed for candidate:9 1 udp 1 198.51.100.17 6000 typ host",
      roomId: "raw-room-id",
      participantId: "raw-participant-id",
      clientSignalId: "raw-client-signal-id",
      senderConnectionId: "raw-connection-id",
      senderMediaSessionId: "raw-media-session-id",
      mediaSessionId: "raw-plain-media-session-id",
      invite: "https://staging.anidachi.app/room/raw-room-path-id",
      deviceId: "raw-device-id",
      trackId: "raw-track-id",
      streamId: "raw-stream-id",
      sdp: "v=0\r\na=ice-ufrag:raw-ufrag\r\na=msid:raw-stream raw-track",
      candidate: "candidate:1 1 udp 1 203.0.113.9 5000 typ host",
      nested: {
        address: "2001:db8::1",
        participants: [{ id: "raw-nested-participant-id" }],
      },
    });

    const exported = getDebugLogText();
    for (const forbidden of [
      "raw-sdp-frame",
      "raw-candidate-frame",
      "candidate:9 1 udp",
      "raw-room-id",
      "raw-participant-id",
      "raw-client-signal-id",
      "raw-connection-id",
      "raw-media-session-id",
      "raw-plain-media-session-id",
      "raw-room-path-id",
      "raw-device-id",
      "raw-track-id",
      "raw-stream-id",
      "raw-ufrag",
      "203.0.113.9",
      "2001:db8::1",
      "raw-nested-participant-id",
    ]) {
      expect(exported).not.toContain(forbidden);
    }
    expect(exported).toContain("<redacted-media>");
    expect(exported).toContain("<redacted-frame>");
    expect(exported).toContain("/room/<redacted-id>");
  });
});
