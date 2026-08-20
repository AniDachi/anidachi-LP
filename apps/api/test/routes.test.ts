import { describe, expect, it, vi } from "vitest";
import { MAX_ROOM_FRAME_BYTES, MAX_ROOM_ID_CHARS } from "@anidachi/protocol";
import { signRoomTokenForTest } from "../src/auth";
import app, {
  closeInvalidRoomFrame,
  consumeParsedRoomEventBoundary,
  consumeRoomFrameBoundary,
  closeRoomRateLimitedSocket,
  isRoomEventInScope,
  handleRoomWebSocketMessageBoundary,
  persistRoomEndAfterDisablingAutoResponse,
  RoomDurableObject,
  sendAndCloseEndedRoomSockets,
} from "../src/index";
import { RecentP2PSignalBuffer } from "../src/p2p-signal-buffer";
import * as privacyId from "../src/privacy-id";
import { RoomAdmission } from "../src/room-admission";
import { RoomRateLimiter } from "../src/room-rate-limit";
import { createRoomSocketAttachment } from "../src/room-socket-attachment";
import { RoomState } from "../src/room-state";

const authEnv = { ANIDACHI_JWT_SECRET: "test-secret-at-least-32-characters-long" };
const internalEnv = {
  ANIDACHI_INTERNAL_API_SECRET: "internal-secret",
};

function trackingRooms() {
  const calls: string[] = [];
  return {
    calls,
    namespace: {
      idFromName(roomId: string) {
        calls.push(roomId);
        return roomId;
      },
      get() {
        return { fetch: () => new Response("proxied") };
      },
    },
  };
}

describe("worker routes", () => {
  it("serves room-scoped ICE credentials through bearer auth with no-store CORS", async () => {
    const roomToken = await signRoomTokenForTest(
      { sub: "user-1", roomId: "room-1", role: "member" },
      authEnv,
    );
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
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
      ...authEnv,
      CLOUDFLARE_TURN_KEY_ID: "turn-key-id",
      CLOUDFLARE_TURN_KEY_API_TOKEN: "turn-token",
    };

    const response = await app.request(
      "/rooms/room-1/ice-servers",
      { headers: { Authorization: `Bearer ${roomToken}` } },
      env,
    );
    const preflight = await app.request(
      "/rooms/room-1/ice-servers",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://www.crunchyroll.com",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization",
        },
      },
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      configured: true,
      provider: "cloudflare",
      ttlSeconds: 900,
    });
    expect(preflight.headers.get("Access-Control-Allow-Headers")?.toLowerCase()).toContain(
      "authorization",
    );
    const providerBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)) as {
      customIdentifier: string;
    };
    expect(providerBody.customIdentifier).not.toContain("room-1");
    expect(providerBody.customIdentifier).not.toContain("user-1");
    fetcher.mockRestore();
  });

  it("keeps query-token ICE auth only on the legacy route and measures fallback use", async () => {
    const roomToken = await signRoomTokenForTest(
      { sub: "user-1", roomId: "room-1", role: "member" },
      authEnv,
    );
    const dataPoints: Array<{ blobs?: string[] }> = [];
    const env = {
      ...authEnv,
      ANIDACHI_ENV: "test",
      ROOM_ANALYTICS: {
        writeDataPoint(point: { blobs?: string[] }) {
          dataPoints.push(point);
        },
      },
    };

    const primaryWithoutBearer = await app.request(
      `/rooms/room-1/ice-servers?roomToken=${encodeURIComponent(roomToken)}`,
      {},
      env,
    );
    const legacy = await app.request(
      `/ice-servers?roomId=room-1&roomToken=${encodeURIComponent(roomToken)}`,
      {},
      env,
    );

    expect(primaryWithoutBearer.status).toBe(401);
    expect(legacy.status).toBe(200);
    expect(legacy.headers.get("Cache-Control")).toBe("no-store");
    expect(legacy.headers.get("X-Anidachi-Auth-Fallback")).toBe("query");
    expect(dataPoints.some((point) => point.blobs?.includes("ice_query_auth_fallback"))).toBe(true);
  });

  it("rejects missing and wrong internal room lifecycle secrets", async () => {
    const rooms = trackingRooms();
    for (const authorization of [undefined, "Bearer wrong-secret"]) {
      const response = await app.request(
        "/internal/rooms/room-1/end",
        {
          method: "POST",
          ...(authorization ? { headers: { Authorization: authorization } } : {}),
          body: JSON.stringify({ endedAt: 1_000, reason: "host_ended" }),
        },
        { ...internalEnv, ROOMS: rooms.namespace },
      );
      expect(response.status).toBe(401);
    }
    expect(rooms.calls).toEqual([]);
  });

  it("rejects malformed internal room end commands before Durable Object lookup", async () => {
    const rooms = trackingRooms();
    const response = await app.request(
      "/internal/rooms/room-1/end",
      {
        method: "POST",
        headers: { Authorization: "Bearer internal-secret", "Content-Type": "application/json" },
        body: JSON.stringify({ endedAt: -1, reason: "unknown" }),
      },
      { ...internalEnv, ROOMS: rooms.namespace },
    );

    expect(response.status).toBe(400);
    expect(rooms.calls).toEqual([]);
  });

  it("forwards authenticated room end commands to the named Durable Object", async () => {
    const requests: Request[] = [];
    const response = await app.request(
      "/internal/rooms/room-1/end",
      {
        method: "POST",
        headers: { Authorization: "Bearer internal-secret", "Content-Type": "application/json" },
        body: JSON.stringify({ endedAt: 1_000, reason: "host_ended" }),
      },
      {
        ...internalEnv,
        ROOMS: {
          idFromName: (roomId: string) => roomId,
          get: () => ({
            fetch: async (request: Request) => {
              requests.push(request);
              return Response.json({ ok: true });
            },
          }),
        },
      },
    );

    expect(response.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.get("Authorization")).toBe("Bearer internal-secret");
    expect(await requests[0]?.json()).toEqual({ endedAt: 1_000, reason: "host_ended" });
  });

  it("continues terminal delivery and closure when one socket throws", () => {
    const calls: string[] = [];
    const stale = {
      send() { throw new Error("stale send"); },
      close() { throw new Error("stale close"); },
    } as unknown as WebSocket;
    const healthy = {
      send(value: string) { calls.push(`send:${JSON.parse(value).type}`); },
      close(code: number) { calls.push(`close:${code}`); },
    } as unknown as WebSocket;

    expect(() => sendAndCloseEndedRoomSockets([stale, healthy], {
      type: "ROOM_ENDED",
      roomId: "room-1",
      endedAt: 1_000,
      reason: "host_ended",
    })).not.toThrow();
    expect(calls).toEqual(["send:ROOM_ENDED", "close:4004"]);
  });

  it("does not dispatch websocket messages after a room tombstone", () => {
    const calls: string[] = [];
    const socket = {
      send(value: string) { calls.push(`send:${JSON.parse(value).type}`); },
      close(code: number) { calls.push(`close:${code}`); },
    } as unknown as WebSocket;
    const dispatch = () => calls.push("dispatch");

    expect(handleRoomWebSocketMessageBoundary(
      socket,
      "room-1",
      { schemaVersion: 1, endedAt: 1_000, reason: "host_ended" },
      dispatch,
    )).toBe(false);
    expect(calls).toEqual(["send:ROOM_ENDED", "close:4004"]);
  });

  it("revalidates media signaling after asynchronous privacy hashing", async () => {
    let releaseHash: (value: string) => void = () => {};
    let markHashStarted: () => void = () => {};
    const hashStarted = new Promise<void>((resolve) => {
      markHashStarted = resolve;
    });
    const privacySpy = vi.spyOn(privacyId, "createPrivacySafeHmacId").mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          releaseHash = resolve;
          markHashStarted();
        }),
    );

    try {
      const senderSocket = {} as WebSocket;
      const targetSocket = {} as WebSocket;
      let canSignal = true;
      const send = vi.fn();
      const sqlExec = vi.fn();
      const fakeRoomObject = {
        endedTombstone: null,
        env: authEnv,
        nextP2PServerSeq: 1,
        participantsBySocket: new Map([[senderSocket, "sender-user"]]),
        p2pSignalOperationsBySocket: new Map<WebSocket, Promise<void>>(),
        p2pSignalBuffer: new RecentP2PSignalBuffer(),
        persistedP2PDedupeHashes: new Set<string>(),
        persistP2PState: vi.fn(),
        room: {
          canSignal: () => canSignal,
          roomGeneration: 1,
          sourceGeneration: 1,
        },
        send,
        socketsByParticipant: new Map([
          ["sender-user", senderSocket],
          ["target-user", targetSocket],
        ]),
        state: { storage: { sql: { exec: sqlExec } } },
        track: vi.fn(),
      };
      Object.setPrototypeOf(fakeRoomObject, RoomDurableObject.prototype);
      const event = {
        type: "P2P_SIGNAL" as const,
        roomId: "room-1",
        fromUserId: "sender-user",
        toUserId: "target-user",
        clientSignalId: "signal-1",
        signal: { kind: "renegotiate" as const },
      };

      const pending = (
        RoomDurableObject.prototype as unknown as {
          handleP2PSignal(
            this: typeof fakeRoomObject,
            socket: WebSocket,
            value: typeof event,
          ): Promise<void>;
        }
      ).handleP2PSignal.call(fakeRoomObject, senderSocket, event);
      await hashStarted;
      canSignal = false;
      releaseHash("a".repeat(64));
      await pending;

      expect(sqlExec).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalledWith(targetSocket, expect.anything());
    } finally {
      privacySpy.mockRestore();
    }
  });

  it("preserves per-socket signaling order across asynchronous privacy hashing", async () => {
    const hashResolvers: Array<(value: string) => void> = [];
    let hashCallCount = 0;
    let markFirstHashStarted: () => void = () => {};
    let markSecondHashStarted: () => void = () => {};
    const firstHashStarted = new Promise<void>((resolve) => {
      markFirstHashStarted = resolve;
    });
    const secondHashStarted = new Promise<void>((resolve) => {
      markSecondHashStarted = resolve;
    });
    const privacySpy = vi.spyOn(privacyId, "createPrivacySafeHmacId").mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          hashCallCount += 1;
          hashResolvers.push(resolve);
          if (hashCallCount === 1) {
            markFirstHashStarted();
          } else if (hashCallCount === 2) {
            markSecondHashStarted();
          }
        }),
    );
    const pending: Promise<void>[] = [];

    try {
      const senderSocket = {} as WebSocket;
      const targetSocket = {} as WebSocket;
      const send = vi.fn();
      const fakeRoomObject = {
        endedTombstone: null,
        env: authEnv,
        nextP2PServerSeq: 1,
        participantsBySocket: new Map([[senderSocket, "sender-user"]]),
        p2pSignalOperationsBySocket: new Map<WebSocket, Promise<void>>(),
        p2pSignalBuffer: new RecentP2PSignalBuffer(),
        persistedP2PDedupeHashes: new Set<string>(),
        persistP2PState: vi.fn(),
        room: {
          canSignal: () => true,
          roomGeneration: 1,
          sourceGeneration: 1,
        },
        send,
        socketsByParticipant: new Map([
          ["sender-user", senderSocket],
          ["target-user", targetSocket],
        ]),
        state: { storage: { sql: { exec: vi.fn() } } },
        track: vi.fn(),
      };
      Object.setPrototypeOf(fakeRoomObject, RoomDurableObject.prototype);
      const invoke = (clientSignalId: string, kind: "voice-start" | "voice-stop") =>
        (
          RoomDurableObject.prototype as unknown as {
            handleP2PSignal(
              this: typeof fakeRoomObject,
              socket: WebSocket,
              value: {
                type: "P2P_SIGNAL";
                roomId: string;
                fromUserId: string;
                toUserId: string;
                clientSignalId: string;
                signal: { kind: typeof kind };
              },
            ): Promise<void>;
          }
        ).handleP2PSignal.call(fakeRoomObject, senderSocket, {
          type: "P2P_SIGNAL",
          roomId: "room-1",
          fromUserId: "sender-user",
          toUserId: "target-user",
          clientSignalId,
          signal: { kind },
        });

      pending.push(invoke("signal-start", "voice-start"));
      pending.push(invoke("signal-stop", "voice-stop"));
      await firstHashStarted;

      expect(hashCallCount).toBe(1);
      hashResolvers[0]?.("a".repeat(64));
      await secondHashStarted;
      hashResolvers[1]?.("b".repeat(64));
      await Promise.all(pending);

      expect(
        send.mock.calls
          .filter(([socket]) => socket === targetSocket)
          .map(([, event]) => event.signal.kind),
      ).toEqual(["voice-start", "voice-stop"]);
    } finally {
      hashResolvers.forEach((resolve, index) => {
        resolve((index === 0 ? "a" : "b").repeat(64));
      });
      await Promise.allSettled(pending);
      privacySpy.mockRestore();
    }
  });

  it("disables hibernation auto-response before persisting a tombstone", () => {
    const calls: string[] = [];
    const state = {
      setWebSocketAutoResponse(pair?: WebSocketRequestResponsePair) {
        calls.push(pair ? "enable" : "disable");
      },
    };

    persistRoomEndAfterDisablingAutoResponse(
      state,
      () => calls.push("persist"),
    );
    expect(calls).toEqual(["disable", "persist"]);
  });

  it("reconstructs a pending reservation from a hibernating socket attachment", () => {
    const deadlineAt = Date.now() + 5_000;
    const socket = {
      close: vi.fn(),
      deserializeAttachment: () => createRoomSocketAttachment(
        "room-1",
        { avatarUrl: null, role: "member", roomId: "room-1", sub: "member-1" },
        Date.now(),
        { deadlineAt, joined: false },
      ),
    } as unknown as WebSocket;
    const roomObject = {
      admission: new RoomAdmission({ maxParticipants: 4 }),
      admissionIdBySocket: new Map<WebSocket, string>(),
      admissionTimeoutBySocket: new Map<WebSocket, ReturnType<typeof setTimeout>>(),
      participantsBySocket: new Map<WebSocket, string>(),
      room: new RoomState("room-1"),
      scheduleAdmissionTimeout: vi.fn(),
      sessionIdBySocket: new Map<WebSocket, string | undefined>(),
      socketsByParticipant: new Map<string, WebSocket>(),
      state: { getWebSockets: () => [socket] },
      verifiedBySocket: new Map(),
    };
    Object.setPrototypeOf(roomObject, RoomDurableObject.prototype);

    (RoomDurableObject.prototype as unknown as {
      restoreWebSocketsFromAttachments(this: typeof roomObject): void;
    }).restoreWebSocketsFromAttachments.call(roomObject);

    expect(roomObject.admission.pendingCount).toBe(1);
    expect(roomObject.scheduleAdmissionTimeout).toHaveBeenCalledWith(socket, deadlineAt);
    expect(socket.close).not.toHaveBeenCalled();
  });
  it("does not expose the legacy LiveKit token endpoint", async () => {
    const response = await app.request(
      "/livekit/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: "room-1",
          identity: "user-1",
          name: "AniDachi user",
        }),
      },
      {},
    );

    expect(response.status).toBe(404);
  });

  it("rejects unauthenticated room upgrades before Durable Object lookup", async () => {
    const rooms = trackingRooms();
    const response = await app.request(
      "/ws/room-1",
      { headers: { Upgrade: "websocket" } },
      { ...authEnv, ROOMS: rooms.namespace },
    );

    expect(response.status).toBe(401);
    expect(rooms.calls).toEqual([]);
  });

  it("rejects malformed room ids before Durable Object lookup", async () => {
    const rooms = trackingRooms();
    const roomId = "r".repeat(MAX_ROOM_ID_CHARS + 1);
    const token = await signRoomTokenForTest({ sub: "user-1", roomId, role: "member" }, authEnv);
    const response = await app.request(
      `/ws/${roomId}?roomToken=${encodeURIComponent(token)}`,
      { headers: { Upgrade: "websocket" } },
      { ...authEnv, ROOMS: rooms.namespace },
    );

    expect(response.status).toBe(400);
    expect(rooms.calls).toEqual([]);
  });

  it("closes binary and oversized room frames with 1009", () => {
    const closed: Array<[number, string]> = [];
    const socket = {
      close(code: number, reason: string) {
        closed.push([code, reason]);
      },
    } as unknown as WebSocket;

    expect(closeInvalidRoomFrame(socket, new ArrayBuffer(1))).toBe(true);
    expect(closeInvalidRoomFrame(socket, "x".repeat(MAX_ROOM_FRAME_BYTES + 1))).toBe(true);
    expect(closed.map(([code]) => code)).toEqual([1009, 1009]);
  });

  it("rejects outer and nested room scope mismatches before dispatch", () => {
    expect(isRoomEventInScope({ type: "PING", roomId: "other", sentAt: 1 }, "room-1")).toBe(false);
    expect(
      isRoomEventInScope(
        {
          type: "REACTION",
          roomId: "room-1",
          reaction: {
            id: "reaction-1",
            userId: "user-1",
            roomId: "other",
            emoji: "fire",
            videoTime: 1,
            createdAt: 1,
          },
        },
        "room-1",
      ),
    ).toBe(false);
  });

  it("counts malformed frames against the total limit before JSON parsing", () => {
    const socket = { close() {} } as unknown as WebSocket;
    const limiter = new RoomRateLimiter();

    for (let index = 0; index < 120; index += 1) {
      expect(consumeRoomFrameBoundary(socket, limiter, "{", 0)?.allowed).toBe(true);
    }
    expect(consumeRoomFrameBoundary(socket, limiter, "{", 0)?.allowed).toBe(false);
  });

  it("does not double-count total frames when applying class limits", () => {
    const socket = { close() {} } as unknown as WebSocket;
    const limiter = new RoomRateLimiter();
    const events = [
      ...Array.from({ length: 80 }, (_, index) => ({
        type: "P2P_SIGNAL" as const,
        clientSignalId: `ice-${index}`,
        roomId: "room-1",
        fromUserId: "user-1",
        senderConnectionId: "connection-1",
        toUserId: "user-2",
        signal: { kind: "ice" as const, candidate: { candidate: `candidate-${index}` } },
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        type: "P2P_SIGNAL" as const,
        clientSignalId: `sdp-${index}`,
        roomId: "room-1",
        fromUserId: "user-1",
        senderConnectionId: "connection-1",
        toUserId: "user-2",
        signal: { kind: "offer" as const, sdp: { type: "offer" as const, sdp: "v=0" } },
      })),
      ...Array.from({ length: 32 }, (_, index) => ({
        type: "PING" as const,
        roomId: "room-1",
        sentAt: index,
      })),
    ];

    for (const event of events) {
      expect(consumeRoomFrameBoundary(socket, limiter, JSON.stringify(event), 0)?.allowed).toBe(true);
      expect(consumeParsedRoomEventBoundary(limiter, event, "room-1", 0).rateLimit.allowed).toBe(
        true,
      );
    }
    expect(consumeRoomFrameBoundary(socket, limiter, "{", 0)?.allowed).toBe(false);
  });

  it("counts scope mismatches in the class bucket and closes the third rejection with 1008", () => {
    const closed: number[] = [];
    const socket = {
      close(code: number) {
        closed.push(code);
      },
    } as unknown as WebSocket;
    const limiter = new RoomRateLimiter();
    const event = { type: "PING", roomId: "other", sentAt: 1 } as const;
    const raw = JSON.stringify(event);

    for (let index = 0; index < 40; index += 1) {
      expect(consumeRoomFrameBoundary(socket, limiter, raw, 0)?.allowed).toBe(true);
      expect(consumeParsedRoomEventBoundary(limiter, event, "room-1", 0)).toEqual({
        rateLimit: { allowed: true, close: false, retryAfterMs: 0 },
        inScope: false,
      });
    }
    for (let index = 0; index < 3; index += 1) {
      expect(consumeRoomFrameBoundary(socket, limiter, raw, 0)?.allowed).toBe(true);
      const boundary = consumeParsedRoomEventBoundary(limiter, event, "room-1", 0);
      expect(boundary.rateLimit.allowed).toBe(false);
      closeRoomRateLimitedSocket(socket, boundary.rateLimit);
    }

    expect(closed).toEqual([1008]);
  });
});
