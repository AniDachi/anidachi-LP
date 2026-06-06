import { afterEach, describe, expect, it, vi } from "vitest";
import { clearDebugLog, getDebugEntries, logDebug } from "../src/debug-log";

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
        address: "<redacted>",
        candidate:
          "candidate:842163049 1 udp 1677729535 <redacted-ip> 56143 typ srflx raddr <redacted-ip> rport 56143",
      }),
    );
    expect(JSON.stringify(entry?.data)).not.toContain("user-local");
    expect(JSON.stringify(entry?.data)).not.toContain("user-remote");
    expect(JSON.stringify(entry?.data)).not.toContain("192.168.1.20");
    expect(JSON.stringify(entry?.data)).not.toContain("10.0.0.2");
  });
});
