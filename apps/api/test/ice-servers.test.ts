import { describe, expect, it, vi } from "vitest";
import { createIceServersPayload, parseTurnTtlSeconds } from "../src/ice-servers";

describe("ICE servers", () => {
  it("returns Cloudflare STUN fallback when TURN credentials are not configured", async () => {
    const payload = await createIceServersPayload({});

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
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
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
        CLOUDFLARE_TURN_TTL_SECONDS: "3600",
      },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledWith(
      "https://rtc.live.cloudflare.com/v1/turn/keys/turn-key-id/credentials/generate-ice-servers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ttl: 3600 }),
      }),
    );
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
        fetcher,
      ),
    ).rejects.toThrow("usable TURN URLs");
  });

  it("clamps TURN credential TTL to a safe range", () => {
    expect(parseTurnTtlSeconds("120")).toBe(600);
    expect(parseTurnTtlSeconds("999999")).toBe(86_400);
    expect(parseTurnTtlSeconds("3600")).toBe(3600);
  });
});
