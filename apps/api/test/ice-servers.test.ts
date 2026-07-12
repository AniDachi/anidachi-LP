import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearIceServersCacheForTest,
  createIceServersPayload,
  getIceServersCacheSizeForTest,
  parseTurnTtlSeconds,
} from "../src/ice-servers";

function scope(roomId = "room-1", userId = "user-1", now = Date.now()) {
  return { roomId, userId, now };
}

describe("ICE servers", () => {
  beforeEach(() => {
    clearIceServersCacheForTest();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-27T00:00:00.000Z"));
  });

  afterEach(() => {
    clearIceServersCacheForTest();
    vi.useRealTimers();
  });

  it("returns Cloudflare STUN fallback when TURN credentials are not configured", async () => {
    const payload = await createIceServersPayload({}, scope());

    expect(payload.configured).toBe(false);
    expect(payload.provider).toBe("fallback");
    expect(payload.iceServers[0]?.urls).toContain("stun:stun.cloudflare.com:3478");
    expect(payload.relay).toEqual({
      hasStun: true,
      hasTurn: false,
      hasTurns443: false,
      stunUrlCount: 2,
      turnUrlCount: 0,
      turnsUrlCount: 0,
    });
  });

  it("generates short-lived Cloudflare TURN credentials server-side", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(
        JSON.stringify({
          iceServers: [
            { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.cloudflare.com:53"] },
            {
              urls: [
                "turn:turn.cloudflare.com:3478?transport=udp",
                "turn:turn.cloudflare.com:53?transport=udp",
                "turns:turn.cloudflare.com:443?transport=tcp",
              ],
              username: "temporary-user",
              credential: "temporary-credential",
            },
          ],
        }),
        { status: 201 },
      ),
    );

    const payload = await createIceServersPayload(
      {
        CLOUDFLARE_TURN_KEY_ID: "turn-key-id",
        CLOUDFLARE_TURN_KEY_API_TOKEN: "turn-token",
        CLOUDFLARE_TURN_TTL_SECONDS: "1200",
      },
      scope(),
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://rtc.live.cloudflare.com/v1/turn/keys/turn-key-id/credentials/generate-ice-servers",
      expect.objectContaining({
        method: "POST",
        body: expect.any(String),
      }),
    );
    const requestBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as {
      customIdentifier: string;
      ttl: number;
    };
    expect(requestBody.ttl).toBe(1200);
    expect(requestBody.customIdentifier).toMatch(/^ani_[a-f0-9]{40}$/);
    expect(requestBody.customIdentifier).not.toContain("room-1");
    expect(requestBody.customIdentifier).not.toContain("user-1");
    expect(payload.configured).toBe(true);
    expect(payload.provider).toBe("cloudflare");
    expect(payload.relay).toEqual({
      hasStun: true,
      hasTurn: true,
      hasTurns443: true,
      stunUrlCount: 2,
      turnUrlCount: 1,
      turnsUrlCount: 1,
    });
    expect(payload.iceServers[1]?.urls).toEqual([
      "turn:turn.cloudflare.com:3478?transport=udp",
      "turns:turn.cloudflare.com:443?transport=tcp",
    ]);
  });

  it("serves fresh cached Cloudflare TURN credentials without refetching", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
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
        }),
        { status: 201 },
      ),
    );

    const env = {
      CLOUDFLARE_TURN_KEY_ID: "turn-key-id",
      CLOUDFLARE_TURN_KEY_API_TOKEN: "turn-token",
      CLOUDFLARE_TURN_TTL_SECONDS: "1200",
    };

    const first = await createIceServersPayload(env, scope(), fetcher);
    const second = await createIceServersPayload(env, scope(), fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first.provider).toBe("cloudflare");
    expect(second.provider).toBe("cloudflare");
    expect(second.cache).toBe("fresh");
    expect(second.relay.hasTurn).toBe(true);
    expect(second.relay.hasTurns443).toBe(true);
  });

  it("uses still-valid cached TURN credentials when Cloudflare refresh fails", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(new Response("temporarily unavailable", { status: 503 }));

    const env = {
      CLOUDFLARE_TURN_KEY_ID: "turn-key-id",
      CLOUDFLARE_TURN_KEY_API_TOKEN: "turn-token",
      CLOUDFLARE_TURN_TTL_SECONDS: "1800",
    };

    await createIceServersPayload(env, scope(), fetcher);
    vi.setSystemTime(new Date("2026-06-27T00:26:00.000Z"));
    const payload = await createIceServersPayload(env, scope(), fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(payload.cache).toBe("stale-if-error");
    expect(payload.provider).toBe("cloudflare");
    expect(payload.relay.hasTurn).toBe(true);
    expect(payload.relay.hasTurns443).toBe(true);
  });

  it("does not fall back to STUN-only when configured TURN has no cached credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("temporarily unavailable", { status: 503 }),
    );

    await expect(
      createIceServersPayload(
        {
          CLOUDFLARE_TURN_KEY_ID: "turn-key-id",
          CLOUDFLARE_TURN_KEY_API_TOKEN: "turn-token",
        },
        scope(),
        fetcher,
      ),
    ).rejects.toThrow("Cloudflare TURN credentials failed: 503");
  });

  it("fails closed when configured TURN credentials return no browser-usable TURN URLs", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          iceServers: [
            { urls: ["stun:stun.cloudflare.com:3478"] },
            {
              urls: ["turn:turn.cloudflare.com:53?transport=udp"],
              username: "temporary-user",
              credential: "temporary-credential",
            },
          ],
        }),
        { status: 201 },
      ),
    );

    await expect(
      createIceServersPayload(
        {
          CLOUDFLARE_TURN_KEY_ID: "turn-key-id",
          CLOUDFLARE_TURN_KEY_API_TOKEN: "turn-token",
        },
        scope(),
        fetcher,
      ),
    ).rejects.toThrow("usable TURN URLs");
  });

  it("clamps TURN credential TTL to a safe range", () => {
    expect(parseTurnTtlSeconds("120")).toBe(600);
    expect(parseTurnTtlSeconds("999999")).toBe(1_800);
    expect(parseTurnTtlSeconds("1200")).toBe(1200);
    expect(parseTurnTtlSeconds(undefined)).toBe(900);
  });

  it("isolates credentials and custom identifiers across room and user scopes", async () => {
    let issued = 0;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      issued += 1;
      return new Response(
        JSON.stringify({
          iceServers: [
            { urls: ["stun:stun.cloudflare.com:3478"] },
            {
              urls: ["turns:turn.cloudflare.com:443?transport=tcp"],
              username: `temporary-user-${issued}`,
              credential: `temporary-credential-${issued}`,
            },
          ],
        }),
        { status: 201 },
      );
    });
    const env = {
      CLOUDFLARE_TURN_KEY_ID: "turn-key-id",
      CLOUDFLARE_TURN_KEY_API_TOKEN: "turn-token",
    };

    const roomA = await createIceServersPayload(env, scope("room-a", "user-a"), fetcher);
    const roomB = await createIceServersPayload(env, scope("room-b", "user-a"), fetcher);
    const userB = await createIceServersPayload(env, scope("room-a", "user-b"), fetcher);
    await createIceServersPayload(env, scope("room-a", "user-a"), fetcher);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(roomA.iceServers[1]?.username).toBe("temporary-user-1");
    expect(roomB.iceServers[1]?.username).toBe("temporary-user-2");
    expect(userB.iceServers[1]?.username).toBe("temporary-user-3");
    const customIdentifiers = fetcher.mock.calls.map(
      (call) => JSON.parse(String(call[1]?.body)).customIdentifier,
    );
    expect(new Set(customIdentifiers).size).toBe(3);
  });

  it("keeps the isolate credential cache bounded", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            iceServers: [
              { urls: ["stun:stun.cloudflare.com:3478"] },
              {
                urls: ["turns:turn.cloudflare.com:443?transport=tcp"],
                username: "temporary-user",
                credential: "temporary-credential",
              },
            ],
          }),
          { status: 201 },
        ),
    );
    const env = {
      CLOUDFLARE_TURN_KEY_ID: "turn-key-id",
      CLOUDFLARE_TURN_KEY_API_TOKEN: "turn-token",
    };

    for (let index = 0; index < 80; index += 1) {
      await createIceServersPayload(env, scope(`room-${index}`, "user"), fetcher);
    }

    expect(getIceServersCacheSizeForTest()).toBeLessThanOrEqual(64);
  });
});
