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
      { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
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
    expect(first).toEqual(second);
    expect(JSON.stringify(second)).toContain("turns:turn.cloudflare.com:443?transport=tcp");
  });

  it("does not silently degrade authenticated media setup to STUN-only", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("temporarily unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);

    await expect(
      loadP2PIceServers({ roomId: "room-1", roomToken: "room-token" }),
    ).rejects.toThrow("ICE server endpoint failed: 503");
  });
});
