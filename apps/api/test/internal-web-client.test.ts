import { describe, expect, it, vi } from "vitest";
import * as internalWebClient from "../src/internal-web-client";

const clientApi = internalWebClient as typeof internalWebClient & {
  notifyWebRoomEnded?: (
    env: {
      ANIDACHI_INTERNAL_API_SECRET?: string;
      ANIDACHI_WEB_INTERNAL_BASE_URL?: string;
    },
    roomId: string,
    command: {
      endedAt: number;
      eventId: string;
      reason: "empty_timeout";
    },
    fetchImplementation?: typeof fetch,
    timeoutMs?: number,
  ) => Promise<void>;
};

const command = {
  endedAt: 14_401_000,
  eventId: `empty_timeout:${"a".repeat(64)}`,
  reason: "empty_timeout" as const,
};

describe("internal Web room lifecycle client", () => {
  it("rejects missing or unsafe configuration before making a request", async () => {
    expect(typeof clientApi.notifyWebRoomEnded).toBe("function");
    if (!clientApi.notifyWebRoomEnded) return;
    const fetchImplementation = vi.fn<typeof fetch>();

    await expect(clientApi.notifyWebRoomEnded({}, "room-1", command, fetchImplementation))
      .rejects.toThrow("not configured");
    await expect(clientApi.notifyWebRoomEnded({
      ANIDACHI_INTERNAL_API_SECRET: "secret",
      ANIDACHI_WEB_INTERNAL_BASE_URL: "file:///tmp/web",
    }, "room-1", command, fetchImplementation)).rejects.toThrow("not configured");
    await expect(clientApi.notifyWebRoomEnded({
      ANIDACHI_INTERNAL_API_SECRET: "secret",
      ANIDACHI_WEB_INTERNAL_BASE_URL: "http://example.com",
    }, "room-1", command, fetchImplementation)).rejects.toThrow("not configured");
    await expect(clientApi.notifyWebRoomEnded({
      ANIDACHI_INTERNAL_API_SECRET: "secret",
      ANIDACHI_WEB_INTERNAL_BASE_URL: "http://127.attacker.example",
    }, "room-1", command, fetchImplementation)).rejects.toThrow("not configured");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("aborts a callback that exceeds its bounded request timeout", async () => {
    expect(typeof clientApi.notifyWebRoomEnded).toBe("function");
    if (!clientApi.notifyWebRoomEnded) return;
    let observedAbort = false;
    const hangingFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const guard = setTimeout(() => reject(new Error("missing abort signal")), 100);
        init?.signal?.addEventListener("abort", () => {
          observedAbort = true;
          clearTimeout(guard);
          reject(init.signal?.reason ?? new Error("aborted"));
        }, { once: true });
      }));

    await expect(clientApi.notifyWebRoomEnded({
      ANIDACHI_INTERNAL_API_SECRET: "secret",
      ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
    }, "room-1", command, hangingFetch, 5)).rejects.toThrow("request failed");
    expect(observedAbort).toBe(true);
  });

  it("rejects non-2xx and sends only the bounded internal callback payload", async () => {
    expect(typeof clientApi.notifyWebRoomEnded).toBe("function");
    if (!clientApi.notifyWebRoomEnded) return;
    const failedFetch = vi.fn(async (
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ) => new Response(null, { status: 503 }));
    const env = {
      ANIDACHI_INTERNAL_API_SECRET: "secret",
      ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
    };

    await expect(clientApi.notifyWebRoomEnded(env, "room 1", command, failedFetch))
      .rejects.toThrow("503");
    const [input, init] = failedFetch.mock.calls[0] ?? [];
    expect(String(input)).toBe("https://web.internal/api/internal/rooms/room%201/ended");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer secret");
    expect(init?.body).toBe(JSON.stringify(command));
  });
});
