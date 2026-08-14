import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearDebugLog,
  getDebugEntries,
  getDebugLogText,
  logDebug,
  playerOverlayGeometryDebugSnapshot,
  roomEventDebugSnapshot,
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
          data: { sourceUrl: "https://example.com/watch?<redacted>" },
        }),
      ]),
    );
    expect(info).not.toHaveBeenCalled();
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
      roomId: "room-1",
      participantSessionId: "participant-session-1",
      roomGeneration: 2,
      sourceGeneration: 3,
    });
    expect(snapshot).not.toHaveProperty("attestation");
    expect(JSON.stringify(snapshot)).not.toContain(attestation);
    expect(JSON.stringify(snapshot)).not.toContain("private-payload");
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
        url: "https://staging.anidachi.app/room?<redacted>",
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
