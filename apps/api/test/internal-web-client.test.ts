import { describe, expect, it, vi } from "vitest";
import type { RoomSourcePersistenceCallback } from "@anidachi/protocol";
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
      eventId?: string;
      reason: "empty_timeout" | "host_ended";
      usage?: { day: string; seconds: number };
    },
    fetchImplementation?: typeof fetch,
    timeoutMs?: number,
  ) => Promise<void>;
};

const command = {
  endedAt: 14_401_000,
  eventId: `empty_timeout:${"a".repeat(64)}`,
  reason: "empty_timeout" as const,
  usage: { day: "2026-07-12", seconds: 125 },
};

const sourceCallback: RoomSourcePersistenceCallback = {
  roomId: "room-1",
  sourceGeneration: 2,
  source: {
    provider: "youtube",
    sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoFingerprint: "youtube|dQw4w9WgXcQ",
  },
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

  it("applies the lifecycle deadline while consuming a successful response body", async () => {
    expect(typeof clientApi.notifyWebRoomEnded).toBe("function");
    if (!clientApi.notifyWebRoomEnded) return;
    const { fetchImplementation, observedAbort, observedCancel } = stallingJsonBodyFetch();

    await expect(withTestDeadline(clientApi.notifyWebRoomEnded({
      ANIDACHI_INTERNAL_API_SECRET: "secret",
      ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
    }, "room-1", command, fetchImplementation, 5))).rejects.toThrow("request failed");
    expect(observedAbort()).toBe(true);
    expect(observedCancel()).toBe(true);
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

  it("requires an explicit acknowledgement for host-triggered finalization", async () => {
    expect(typeof clientApi.notifyWebRoomEnded).toBe("function");
    if (!clientApi.notifyWebRoomEnded) return;
    const env = {
      ANIDACHI_INTERNAL_API_SECRET: "secret",
      ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
    };
    const hostCommand = {
      endedAt: 15_000,
      reason: "host_ended" as const,
      usage: { day: "2026-07-12", seconds: 130 },
    };

    await expect(
      clientApi.notifyWebRoomEnded(
        env,
        "room-1",
        hostCommand,
        async () => Response.json({ error: "not finalized" }),
      ),
    ).rejects.toThrow("invalid acknowledgement");
    await expect(
      clientApi.notifyWebRoomEnded(
        env,
        "room-1",
        hostCommand,
        async () => Response.json({ ok: true }),
      ),
    ).rejects.toThrow("invalid acknowledgement");
    await expect(
      clientApi.notifyWebRoomEnded(
        env,
        "room-1",
        hostCommand,
        async () => Response.json({ ok: true, usageFinalized: true }),
      ),
    ).resolves.toBeUndefined();
  });
});

describe("internal Web room source client", () => {
  const env = {
    ANIDACHI_INTERNAL_API_SECRET: "secret",
    ANIDACHI_WEB_INTERNAL_BASE_URL: "https://web.internal",
  };

  it("posts the exact shared callback with bearer auth to the encoded room source endpoint", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ ok: true, outcome: "persisted", sourceGeneration: 2 }),
    );

    await internalWebClient.notifyWebRoomSource(
      env,
      "room 1",
      { ...sourceCallback, roomId: "room 1" },
      fetchImplementation,
    );

    const [input, init] = fetchImplementation.mock.calls[0] ?? [];
    expect(String(input)).toBe("https://web.internal/api/internal/rooms/room%201/source");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers)).toEqual(
      new Headers({
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
      }),
    );
    expect(init?.body).toBe(JSON.stringify({ ...sourceCallback, roomId: "room 1" }));
  });

  it("validates the exact callback schema before external I/O", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();

    await expect(
      internalWebClient.notifyWebRoomSource(
        env,
        "room-1",
        { ...sourceCallback, extra: true } as RoomSourcePersistenceCallback,
        fetchImplementation,
      ),
    ).rejects.toThrow("invalid callback");
    await expect(
      internalWebClient.notifyWebRoomSource(
        env,
        "other-room",
        sourceCallback,
        fetchImplementation,
      ),
    ).rejects.toThrow("invalid callback");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("accepts only an exact shared acknowledgement for the attempted generation", async () => {
    for (const acknowledgement of [
      null,
      { ok: true, outcome: "persisted" },
      { ok: true, outcome: "persisted", sourceGeneration: 1 },
      { ok: true, outcome: "persisted", sourceGeneration: 2, extra: true },
      { ok: true, outcome: "conflict", sourceGeneration: 2 },
    ]) {
      await expect(
        internalWebClient.notifyWebRoomSource(
          env,
          "room-1",
          sourceCallback,
          async () => Response.json(acknowledgement),
        ),
      ).rejects.toThrow("invalid acknowledgement");
    }

    await expect(
      internalWebClient.notifyWebRoomSource(
        env,
        "room-1",
        sourceCallback,
        async () => Response.json({ ok: true, outcome: "stale", sourceGeneration: 2 }),
      ),
    ).resolves.toBeUndefined();
  });

  it("reuses safe configuration, bounded timeout, and stable transport failures", async () => {
    const fetchImplementation = vi.fn<typeof fetch>();
    await expect(
      internalWebClient.notifyWebRoomSource({}, "room-1", sourceCallback, fetchImplementation),
    ).rejects.toThrow("not configured");
    expect(fetchImplementation).not.toHaveBeenCalled();

    const failedFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(
      internalWebClient.notifyWebRoomSource(env, "room-1", sourceCallback, failedFetch),
    ).rejects.toThrow("503");

    let observedAbort = false;
    const hangingFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          observedAbort = true;
          reject(init.signal?.reason ?? new Error("aborted"));
        }, { once: true });
      }));
    await expect(
      internalWebClient.notifyWebRoomSource(env, "room-1", sourceCallback, hangingFetch, 5),
    ).rejects.toThrow("request failed");
    expect(observedAbort).toBe(true);
  });

  it("applies the source deadline while consuming a successful response body", async () => {
    const { fetchImplementation, observedAbort, observedCancel } = stallingJsonBodyFetch();

    await expect(withTestDeadline(internalWebClient.notifyWebRoomSource(
      env,
      "room-1",
      sourceCallback,
      fetchImplementation,
      5,
    ))).rejects.toThrow("request failed");
    expect(observedAbort()).toBe(true);
    expect(observedCancel()).toBe(true);
  });

  it("cancels an unsuccessful response body before returning the status error", async () => {
    let cancelled = false;
    const fetchImplementation = vi.fn(() => Promise.resolve(new Response(
      new ReadableStream({
        cancel() {
          cancelled = true;
        },
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"error":"temporary"'));
        },
      }),
      { status: 503 },
    ))) as typeof fetch;

    await expect(
      internalWebClient.notifyWebRoomSource(
        env,
        "room-1",
        sourceCallback,
        fetchImplementation,
      ),
    ).rejects.toThrow("503");
    expect(cancelled).toBe(true);
  });
});

function stallingJsonBodyFetch(): {
  fetchImplementation: typeof fetch;
  observedAbort: () => boolean;
  observedCancel: () => boolean;
} {
  let aborted = false;
  let cancelled = false;
  const fetchImplementation = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    init?.signal?.addEventListener("abort", () => {
      aborted = true;
    }, { once: true });
    return Promise.resolve(new Response(new ReadableStream({
      cancel() {
        cancelled = true;
      },
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ok":true'));
      },
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }));
  }) as typeof fetch;
  return {
    fetchImplementation,
    observedAbort: () => aborted,
    observedCancel: () => cancelled,
  };
}

async function withTestDeadline<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error("callback body deadline was not enforced")),
          100,
        );
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}
