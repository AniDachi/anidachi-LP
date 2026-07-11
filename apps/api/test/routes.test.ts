import { describe, expect, it } from "vitest";
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
  sendAndCloseEndedRoomSockets,
} from "../src/index";
import { RoomRateLimiter } from "../src/room-rate-limit";

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
