import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handleDiagnosticMessage,
  recordDiagnosticEvent,
  type DiagnosticMessage,
} from "../src/diagnostic-log";

const DIAGNOSTIC_STORAGE_KEY = "anidachi:diagnostic-log:v1";

function installChromeMock(options: { downloads?: boolean } = { downloads: true }) {
  const storage = new Map<string, unknown>();
  const download = vi.fn(async () => 42);
  const clipboard = {
    writeText: vi.fn(async () => undefined),
  };

  vi.stubGlobal("chrome", {
    storage: {
      local: {
        async get(key: string | null) {
          if (key === null) {
            return Object.fromEntries(storage);
          }
          return { [key]: storage.get(key) };
        },
        async set(values: Record<string, unknown>) {
          for (const [key, value] of Object.entries(values)) {
            storage.set(key, value);
          }
        },
        async remove(key: string) {
          storage.delete(key);
        },
      },
    },
    downloads: options.downloads ? { download } : undefined,
    runtime: {
      sendMessage: vi.fn(),
    },
  });
  vi.stubGlobal("navigator", {
    ...navigator,
    clipboard,
    userAgent: "vitest",
  });

  return { storage, download, clipboard };
}

function parseDownloadedBundle(download: ReturnType<typeof vi.fn>) {
  const [options] = download.mock.calls.at(-1) ?? [];
  if (!options || typeof options.url !== "string") {
    throw new Error("Missing download URL");
  }

  const prefix = "data:application/json;charset=utf-8,";
  if (!options.url.startsWith(prefix)) {
    throw new Error(`Unexpected download URL: ${options.url.slice(0, 40)}`);
  }

  return JSON.parse(decodeURIComponent(options.url.slice(prefix.length))) as unknown;
}

describe("diagnostic log", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stores only sanitized diagnostic events", async () => {
    const { storage } = installChromeMock();

    recordDiagnosticEvent(
      "auth.refresh",
      "failed",
      {
        candidate: "candidate:842163049 1 udp 1677729535 203.0.113.8 56143 typ host",
        participantSessionId: "session-secret-id",
        storedUserId: "stored-user-secret",
        probeUserId: "probe-user-secret",
        currentUserId: "current-user-secret",
        voiceParticipantIds: ["voice-user-one", "voice-user-two"],
        reason: "join:hash",
        userId: "user-secret-id",
        refreshToken: "refresh-secret",
        roomHistoryAttestation: "opaque-room-authority",
        url: "https://staging.anidachi.app/room?token=secret",
      },
      "warn",
    );

    await vi.waitFor(() => {
      expect(storage.get(DIAGNOSTIC_STORAGE_KEY)).toEqual([
        expect.objectContaining({
          scope: "auth.refresh",
          event: "failed",
          severity: "warn",
          data: {
            candidate: "<redacted-media>",
            participantSessionId: expect.stringMatching(/^id_[a-z0-9]+$/),
            storedUserId: expect.stringMatching(/^id_[a-z0-9]+$/),
            probeUserId: expect.stringMatching(/^id_[a-z0-9]+$/),
            currentUserId: expect.stringMatching(/^id_[a-z0-9]+$/),
            voiceParticipantIds: [
              expect.stringMatching(/^id_[a-z0-9]+$/),
              expect.stringMatching(/^id_[a-z0-9]+$/),
            ],
            reason: "join:hash",
            userId: expect.stringMatching(/^id_[a-z0-9]+$/),
            refreshToken: "<redacted>",
            roomHistoryAttestation: "<redacted>",
            url: "https://staging.anidachi.app/room?<redacted>",
          },
        }),
      ]);
    });
    expect(JSON.stringify(storage.get(DIAGNOSTIC_STORAGE_KEY))).not.toContain("session-secret-id");
    expect(JSON.stringify(storage.get(DIAGNOSTIC_STORAGE_KEY))).not.toContain("opaque-room-authority");
    expect(JSON.stringify(storage.get(DIAGNOSTIC_STORAGE_KEY))).not.toMatch(
      /stored-user-secret|probe-user-secret|current-user-secret|voice-user-(?:one|two)/,
    );
  });

  it("downloads a compact diagnostics bundle without raw tokens", async () => {
    const { storage, download } = installChromeMock();
    storage.set("authTokens", {
      accessToken: "access-secret",
      refreshToken: "refresh-secret",
      user: {
        id: "user-1",
        displayName: "Alina",
        plan: "plus",
        avatarUrl: "https://example.com/avatar.png",
      },
    });
    storage.set("anidachi.watchLibraryCache.v1.user-1", { entries: [] });

    const pageDebug = {
      entries: Array.from({ length: 620 }, (_, index) => ({
        id: index + 1,
        scope: "identity",
        message: `entry-${index + 1}`,
      })),
    };
    const message: DiagnosticMessage = {
      type: "ANIDACHI_DIAGNOSTICS",
      command: "save",
      mode: "full",
      page: {
        mode: "full",
        url: "https://www.crunchyroll.com/watch?token=secret",
        participantId: "user-1",
        voice: {
          mode: "open-mic",
          microphoneStatus: "on",
          localSpeaking: false,
          p2p: {
            remoteAudioExpectedIds: ["remote-user-1"],
            peers: [
              {
                remoteUserId: "remote-user-1",
                remoteAudioExpected: true,
                participantAudioOutput: { muted: true, volume: 0.35 },
              },
            ],
          },
        },
        pageDebug,
      },
    };

    const response = await handleDiagnosticMessage(message);

    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        action: "downloaded",
        downloadId: 42,
      }),
    );
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringMatching(/^data:application\/json;charset=utf-8,/),
        filename: expect.stringMatching(/^anidachi-logs\/anidachi-diagnostics-full-/),
        conflictAction: "uniquify",
        saveAs: true,
      }),
    );
    const bundle = parseDownloadedBundle(download) as {
      format: string;
      mode: string;
      page: {
        url: string;
        participantId: string;
        voice: {
          mode: string;
          microphoneStatus: string;
          localSpeaking: boolean;
          p2p: {
            remoteAudioExpectedIds: string[];
            peers: Array<{
              remoteUserId: string;
              remoteAudioExpected: boolean;
              participantAudioOutput: { muted: boolean; volume: number };
            }>;
          };
        };
        pageDebug: { entries: unknown[] };
      };
      storage: {
        keys: string[];
        auth: {
          hasAccessToken: boolean;
          hasRefreshToken: boolean;
          user: { id: string; displayName: string; plan: string };
        };
      };
    };
    const bundleText = JSON.stringify(bundle);
    expect(bundle.format).toBe("diagnostics");
    expect(bundle.mode).toBe("full");
    expect(bundle.page.url).toBe("https://www.crunchyroll.com/watch?<redacted>");
    expect(bundle.page.participantId).toMatch(/^id_[a-z0-9]+$/);
    expect(bundle.page.voice).toEqual({
      mode: "open-mic",
      microphoneStatus: "on",
      localSpeaking: false,
      p2p: {
        remoteAudioExpectedIds: [
          expect.stringMatching(/^id_[a-z0-9]+$/),
        ],
        peers: [
          {
            remoteUserId: expect.stringMatching(/^id_[a-z0-9]+$/),
            remoteAudioExpected: true,
            participantAudioOutput: { muted: true, volume: 0.35 },
          },
        ],
      },
    });
    expect(bundle.page.pageDebug.entries).toHaveLength(500);
    expect(bundle.storage.auth.hasAccessToken).toBe(true);
    expect(bundle.storage.auth.hasRefreshToken).toBe(true);
    expect(bundle.storage.keys).toContain(
      "anidachi.watchLibraryCache.v1.<redacted-id>",
    );
    expect(bundle.storage.auth.user).toEqual({
      id: expect.stringMatching(/^id_[a-z0-9]+$/),
      displayName: "Alina",
      hasAvatar: true,
      plan: "plus",
    });
    expect(bundleText).not.toContain("access-secret");
    expect(bundleText).not.toContain("refresh-secret");
    expect(bundleText).not.toContain("user-1");
    expect(bundleText).not.toContain("remote-user-1");
    expect(bundleText).not.toContain("token=secret");
  });

  it("returns an error when downloads permission is unavailable", async () => {
    const { clipboard } = installChromeMock({ downloads: false });

    const response = await handleDiagnosticMessage({
      type: "ANIDACHI_DIAGNOSTICS",
      command: "save",
      mode: "light",
      page: { mode: "light", url: "https://example.com/watch" },
    });

    expect(response).toEqual({
      ok: false,
      error: "Chrome downloads permission is unavailable",
    });
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it("downloads via a data URL when blob object URLs are unavailable", async () => {
    const { clipboard, download } = installChromeMock();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: undefined,
    });

    const response = await handleDiagnosticMessage({
      type: "ANIDACHI_DIAGNOSTICS",
      command: "save",
      mode: "full",
      page: { mode: "full", url: "https://example.com/watch" },
    });

    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        action: "downloaded",
      }),
    );
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringMatching(/^data:application\/json;charset=utf-8,/),
        saveAs: true,
      }),
    );
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it("keeps full page debug reasons while removing raw WebRTC and identifier material", async () => {
    const { download } = installChromeMock();

    const response = await handleDiagnosticMessage({
      type: "ANIDACHI_DIAGNOSTICS",
      command: "save",
      mode: "full",
      page: {
        mode: "full",
        pageDebug: {
          entries: [
            {
              id: 1,
              scope: "p2p.ice",
              message: "local candidate",
              data: {
                candidate: "candidate:842163049 1 udp 1677729535 203.0.113.8 56143 typ host",
                sdp: "v=0\r\na=ice-pwd:raw-ice-password\r\na=msid:raw-stream raw-track",
                raw: '{"candidate":"raw-frame-candidate"}',
                roomId: "raw-room-id",
                clientSignalId: "raw-client-signal-id",
                senderConnectionId: "raw-connection-id",
                senderMediaSessionId: "raw-media-session-id",
                mediaSessionId: "raw-plain-media-session-id",
                invite: "https://staging.anidachi.app/room/raw-room-path-id",
                deviceId: "raw-device-id",
                trackId: "raw-track-id",
                streamId: "raw-stream-id",
                participantSessionId: "session-debug-id",
                reason: "join:hash",
              },
            },
          ],
        },
      },
    });

    expect(response).toEqual(expect.objectContaining({ ok: true, action: "downloaded" }));
    const bundle = parseDownloadedBundle(download) as {
      page: {
        pageDebug: {
          entries: Array<{ data?: unknown }>;
        };
      };
    };
    expect(bundle.page.pageDebug.entries[0]?.data).toEqual({
      candidate: "<redacted-media>",
      sdp: "<redacted-media>",
      raw: "<redacted-frame>",
      roomId: expect.stringMatching(/^id_[a-z0-9]+$/),
      clientSignalId: expect.stringMatching(/^id_[a-z0-9]+$/),
      senderConnectionId: expect.stringMatching(/^id_[a-z0-9]+$/),
      senderMediaSessionId: expect.stringMatching(/^id_[a-z0-9]+$/),
      mediaSessionId: expect.stringMatching(/^id_[a-z0-9]+$/),
      invite: "https://staging.anidachi.app/room/<redacted-id>",
      deviceId: "<redacted-media-id>",
      trackId: "<redacted-media-id>",
      streamId: "<redacted-media-id>",
      participantSessionId: expect.stringMatching(/^id_[a-z0-9]+$/),
      reason: "join:hash",
    });
    const bundleText = JSON.stringify(bundle);
    for (const forbidden of [
      "session-debug-id",
      "raw-ice-password",
      "raw-frame-candidate",
      "raw-room-id",
      "raw-client-signal-id",
      "raw-connection-id",
      "raw-media-session-id",
      "raw-plain-media-session-id",
      "raw-room-path-id",
      "raw-device-id",
      "raw-track-id",
      "raw-stream-id",
      "203.0.113.8",
      "nullhash",
    ]) {
      expect(bundleText).not.toContain(forbidden);
    }
  });

  it("exports light diagnostics from the last two minutes only", async () => {
    const { storage, download } = installChromeMock();
    const now = Date.now();
    storage.set(DIAGNOSTIC_STORAGE_KEY, [
      {
        at: new Date(now - 3 * 60_000).toISOString(),
        elapsedMs: 1,
        scope: "auth",
        event: "too old",
        severity: "warn",
      },
      {
        at: new Date(now - 30_000).toISOString(),
        elapsedMs: 2,
        scope: "auth",
        event: "recent",
        severity: "warn",
      },
    ]);

    const response = await handleDiagnosticMessage({
      type: "ANIDACHI_DIAGNOSTICS",
      command: "save",
      mode: "light",
      page: {
        mode: "light",
        pageDebug: {
          entries: [
            {
              id: 1,
              at: new Date(now - 3 * 60_000).toISOString(),
              scope: "room.ws",
              message: "old closed",
            },
            {
              id: 2,
              at: new Date(now - 30_000).toISOString(),
              scope: "room.ws",
              message: "recent closed",
            },
          ],
        },
      },
    });

    expect(response).toEqual(expect.objectContaining({ ok: true, action: "downloaded" }));
    const bundle = parseDownloadedBundle(download) as {
      limits: { windowSeconds: number };
      entries: Array<{ event: string }>;
      page: { pageDebug: { entries: Array<{ id: number }> } };
    };
    expect(bundle.limits.windowSeconds).toBe(120);
    expect(bundle.entries.map((entry) => entry.event)).toEqual(["recent closed", "recent"]);
    expect(bundle.page.pageDebug.entries.map((entry) => entry.id)).toEqual([2]);
  });

  it("exports full diagnostics from the last two minutes only", async () => {
    const { storage, download } = installChromeMock();
    const now = Date.now();
    storage.set(DIAGNOSTIC_STORAGE_KEY, [
      {
        at: new Date(now - 3 * 60_000).toISOString(),
        elapsedMs: 1,
        scope: "p2p",
        event: "too old",
        severity: "warn",
      },
      {
        at: new Date(now - 30_000).toISOString(),
        elapsedMs: 2,
        scope: "p2p",
        event: "recent enough",
        severity: "warn",
      },
    ]);

    const response = await handleDiagnosticMessage({
      type: "ANIDACHI_DIAGNOSTICS",
      command: "save",
      mode: "full",
      page: {
        mode: "full",
        pageDebug: {
          entries: [
            {
              id: 1,
              at: new Date(now - 3 * 60_000).toISOString(),
              scope: "p2p.state",
              message: "old connection",
            },
            {
              id: 2,
              at: new Date(now - 30_000).toISOString(),
              scope: "p2p.state",
              message: "recent connection",
            },
          ],
        },
      },
    });

    expect(response).toEqual(expect.objectContaining({ ok: true, action: "downloaded" }));
    const bundle = parseDownloadedBundle(download) as {
      limits: { windowSeconds: number };
      entries: Array<{ event: string }>;
      page: { pageDebug: { entries: Array<{ id: number }> } };
    };
    expect(bundle.limits.windowSeconds).toBe(120);
    expect(bundle.entries.map((entry) => entry.event)).toEqual([
      "recent connection",
      "recent enough",
    ]);
    expect(bundle.page.pageDebug.entries.map((entry) => entry.id)).toEqual([2]);
  });

  it("prunes old stored diagnostic entries while appending", async () => {
    const { storage } = installChromeMock();
    const now = Date.now();
    storage.set(DIAGNOSTIC_STORAGE_KEY, [
      {
        at: new Date(now - 20 * 60_000).toISOString(),
        elapsedMs: 1,
        scope: "auth",
        event: "stale",
        severity: "warn",
      },
    ]);

    recordDiagnosticEvent("auth", "fresh", undefined, "info");

    await vi.waitFor(() => {
      const entries = storage.get(DIAGNOSTIC_STORAGE_KEY) as Array<{ event: string }>;
      expect(entries.map((entry) => entry.event)).toEqual(["fresh"]);
    });
  });

  it("keeps light diagnostics focused and filters noisy page debug events", async () => {
    const { download } = installChromeMock();

    const response = await handleDiagnosticMessage({
      type: "ANIDACHI_DIAGNOSTICS",
      command: "save",
      mode: "light",
      page: {
        mode: "light",
        pageDebug: {
          entries: [
            { id: 1, scope: "probe", message: "interval", data: { noise: true } },
            { id: 2, scope: "video.event", message: "timeupdate", data: { currentTime: 10 } },
            {
              id: 3,
              scope: "identity",
              message: "website session mismatch; clearing extension session",
              data: {
                userId: "user-1",
                refreshToken: "secret-refresh",
                status: "signed-out",
                extra: "ignored in light",
              },
            },
            {
              id: 4,
              scope: "room.ws",
              message: "closed",
              data: { code: 1006, roomId: "room-1" },
            },
            {
              id: 5,
              scope: "overlay.room",
              message: "join skipped for in-flight room connection",
              data: {
                candidate: "candidate:842163049 1 udp 1677729535 203.0.113.8 56143 typ host",
                participantSessionId: "session-debug-id",
                reason: "join:hash",
                roomId: "room-1",
              },
            },
          ],
        },
      },
    });

    expect(response).toEqual(expect.objectContaining({ ok: true, action: "downloaded" }));
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: expect.stringMatching(/^anidachi-logs\/anidachi-diagnostics-light-/),
        saveAs: true,
      }),
    );
    const bundle = parseDownloadedBundle(download) as {
      mode: string;
      page: { pageDebug: { entries: Array<{ id: number; data?: unknown }> } };
    };
    expect(bundle.mode).toBe("light");
    expect(bundle.page.pageDebug.entries.map((entry) => entry.id)).toEqual([3, 4, 5]);
    expect(bundle.page.pageDebug.entries.at(-1)?.data).toEqual({
      participantSessionId: expect.stringMatching(/^id_[a-z0-9]+$/),
      reason: "join:hash",
      roomId: expect.stringMatching(/^id_[a-z0-9]+$/),
    });
    expect(JSON.stringify(bundle)).not.toContain("secret-refresh");
    expect(JSON.stringify(bundle)).not.toContain("session-debug-id");
    expect(JSON.stringify(bundle)).not.toContain("ignored in light");
  });
});
