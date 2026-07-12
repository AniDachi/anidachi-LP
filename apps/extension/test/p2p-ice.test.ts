import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearP2PIceServersCacheForTest,
  loadP2PIceServers,
  prioritizeDirectIceServers,
  refreshP2PIceServers,
} from "../src/p2p-ice";
import { getDefaultP2PIceServers } from "../src/p2p-media";

describe("P2P ICE server prioritization", () => {
  beforeEach(() => {
    clearP2PIceServersCacheForTest();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-27T00:00:00.000Z"));
  });

  afterEach(() => {
    clearP2PIceServersCacheForTest();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not include OpenRelay TURN servers by default", () => {
    expect(JSON.stringify(getDefaultP2PIceServers())).not.toContain("openrelay");
  });

  it("uses Cloudflare STUN in the local unauthenticated fallback", () => {
    expect(getDefaultP2PIceServers()).toEqual([
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ]);
  });

  it("keeps STUN-only servers before TURN fallback servers", () => {
    const servers = prioritizeDirectIceServers(
      [
        {
          urls: [
            "turn:turn.cloudflare.com:3478?transport=udp",
            "stun:stun.cloudflare.com:3478",
            "turns:turn.cloudflare.com:443?transport=tcp",
          ],
          username: "user",
          credential: "pass",
        },
      ],
      [{ urls: "stun:stun.l.google.com:19302" }],
    );

    expect(servers).toEqual([
      { urls: ["stun:stun.cloudflare.com:3478"] },
      { urls: ["stun:stun.l.google.com:19302"] },
      {
        urls: [
          "turn:turn.cloudflare.com:3478?transport=udp",
          "turns:turn.cloudflare.com:443?transport=tcp",
        ],
        username: "user",
        credential: "pass",
      },
    ]);
  });

  it("deduplicates STUN URLs without dropping TURN credentials", () => {
    const servers = prioritizeDirectIceServers(
      [
        { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:3478"] },
        {
          urls: "turn:turn.cloudflare.com:3478?transport=udp",
          username: "user",
          credential: "pass",
        },
      ],
      [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun1.l.google.com:19302"] }],
    );

    expect(servers).toEqual([
      { urls: ["stun:stun.cloudflare.com:3478"] },
      { urls: ["stun:stun1.l.google.com:19302"] },
      {
        urls: ["turn:turn.cloudflare.com:3478?transport=udp"],
        username: "user",
        credential: "pass",
      },
    ]);
  });

  it("uses cached relay ICE servers when authenticated refresh fails", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            configured: true,
            iceServers: [
              { urls: ["stun:stun.cloudflare.com:3478"] },
              {
                urls: [
                  "turn:turn.cloudflare.com:3478?transport=udp",
                  "turns:turn.cloudflare.com:443?transport=tcp",
                ],
                username: "temporary-user",
                credential: "temporary-credential",
              },
            ],
            provider: "cloudflare",
            ttlSeconds: 3600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);

    const auth = { roomId: "room-1", roomToken: "room-token" };
    const first = await loadP2PIceServers(auth);
    const second = await refreshP2PIceServers(auth);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8787/rooms/room-1/ice-servers");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Accept: "application/json",
        Authorization: "Bearer room-token",
      },
    });
    expect(String(fetcher.mock.calls[0]?.[0])).not.toContain("room-token");
    expect(first).toEqual(second);
    expect(JSON.stringify(second)).toContain("turns:turn.cloudflare.com:443?transport=tcp");
  });

  it("does not silently degrade authenticated media setup to STUN-only", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("temporarily unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);

    await expect(loadP2PIceServers({ roomId: "room-1", roomToken: "room-token" })).rejects.toThrow(
      "ICE server endpoint failed: 503",
    );
  });

  it("never reuses cached relay credentials across room or token scopes", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            configured: true,
            iceServers: [
              { urls: ["stun:stun.cloudflare.com:3478"] },
              {
                urls: ["turns:turn.cloudflare.com:443?transport=tcp"],
                username: "room-a-user",
                credential: "room-a-credential",
              },
            ],
            provider: "cloudflare",
            ttlSeconds: 900,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValue(new Response("temporarily unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);

    await loadP2PIceServers({ roomId: "room-a", roomToken: "token-a" });

    await expect(refreshP2PIceServers({ roomId: "room-b", roomToken: "token-b" })).rejects.toThrow(
      "ICE server endpoint failed: 503",
    );
    await expect(refreshP2PIceServers({ roomId: "room-a", roomToken: "token-b" })).rejects.toThrow(
      "ICE server endpoint failed: 503",
    );
  });

  it("keeps credential scopes distinct when short diagnostic hashes collide", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            configured: true,
            iceServers: [
              { urls: ["stun:stun.cloudflare.com:3478"] },
              {
                urls: ["turns:turn.cloudflare.com:443?transport=tcp"],
                username: "first-user",
                credential: "first-credential",
              },
            ],
            provider: "cloudflare",
            ttlSeconds: 900,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValue(new Response("temporarily unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);

    // These strings are a known FNV-1a 32-bit collision. A diagnostic hash is
    // useful in logs, but it must never define a credential cache boundary.
    await loadP2PIceServers({ roomId: "room-a", roomToken: "costarring" });

    await expect(refreshP2PIceServers({ roomId: "room-a", roomToken: "liquid" })).rejects.toThrow(
      "ICE server endpoint failed: 503",
    );
  });

  it("never serves an authenticated relay cache beyond its declared TTL", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            configured: true,
            iceServers: [
              { urls: ["stun:stun.cloudflare.com:3478"] },
              {
                urls: ["turns:turn.cloudflare.com:443?transport=tcp"],
                username: "temporary-user",
                credential: "temporary-credential",
              },
            ],
            provider: "cloudflare",
            ttlSeconds: 600,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValue(new Response("temporarily unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const auth = { roomId: "room-1", roomToken: "room-token" };

    await loadP2PIceServers(auth);
    vi.advanceTimersByTime(600_001);

    await expect(refreshP2PIceServers(auth)).rejects.toThrow("ICE server endpoint failed: 503");
  });
});
