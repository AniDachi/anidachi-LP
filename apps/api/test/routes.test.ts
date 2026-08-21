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

  it("releases admission when a pending socket loses its attachment before JOIN", async () => {
    const now = Date.now();
    const socket = { close: vi.fn() } as unknown as WebSocket;
    const verified = {
      avatarUrl: null,
      role: "member" as const,
      roomId: "room-1",
      sub: "member-1",
    };
    const admission = new RoomAdmission({ maxParticipants: 4 });
    const admissionId = "missing-attachment-admission";
    const reservation = admission.reserve(verified.sub, admissionId, now);
    if (!reservation.allowed) throw new Error("expected reservation");
    const clearAdmissionTimeout = vi.fn();
    const send = vi.fn();
    const lifecycleTransaction = {
      deleteAlarm: async () => undefined,
      get: async () => undefined,
      put: async () => undefined,
    };
    const roomObject = {
      admission,
      admissionIdBySocket: new Map<WebSocket, string>([[socket, admissionId]]),
      clearAdmissionTimeout,
      endedTombstone: null,
      getSocketAttachment: () => null,
      hasJoinDeadlineElapsed: () => false,
      room: new RoomState("room-1"),
      roomEndInProgress: false,
      send,
      socketsByParticipant: new Map<string, WebSocket>(),
      state: {
        storage: {
          transaction: async <T>(callback: (transaction: typeof lifecycleTransaction) => Promise<T>) =>
            callback(lifecycleTransaction),
        },
      },
      track: vi.fn(),
      verifiedBySocket: new Map<WebSocket, typeof verified>([[socket, verified]]),
    };
    Object.setPrototypeOf(roomObject, RoomDurableObject.prototype);

    await (
      RoomDurableObject.prototype as unknown as {
        handleJoin(
          this: typeof roomObject,
          socket: WebSocket,
          event: {
            type: "JOIN";
            roomId: string;
            participant: {
              id: string;
              displayName: string;
              role: "viewer";
              cameraEnabled: false;
              mediaSeat: "none";
              syncStatus: "unknown";
              lastSeenAt: number;
            };
            videoFingerprint: string;
          },
        ): Promise<void>;
      }
    ).handleJoin.call(roomObject, socket, {
      type: "JOIN",
      roomId: "room-1",
      participant: {
        id: verified.sub,
        displayName: "Member",
        role: "viewer",
        cameraEnabled: false,
        mediaSeat: "none",
        syncStatus: "unknown",
        lastSeenAt: now,
      },
      videoFingerprint: "video-1",
    });

    expect(send).toHaveBeenCalledWith(socket, {
      type: "ERROR",
      code: "JOIN_COMMIT_FAILED",
      message: "Unable to commit this room join. Please reconnect and try again.",
    });
    expect(socket.close).toHaveBeenCalledWith(1011, "Room admission attachment is unavailable");
    expect(admission.isPending(admissionId)).toBe(false);
    expect(roomObject.admissionIdBySocket.has(socket)).toBe(false);
    expect(clearAdmissionTimeout).toHaveBeenCalledWith(socket);
  });

  it("finalizes a replacement when the incumbent close throws after durable join", async () => {
    const now = Date.now();
    const room = new RoomState("room-1");
    const oldSocket = {
      close: vi.fn(() => { throw new Error("incumbent close failed"); }),
    } as unknown as WebSocket;
    const replacementSocket = { close: vi.fn() } as unknown as WebSocket;
    const verified = { avatarUrl: null, role: "member" as const, roomId: "room-1", sub: "member-1" };
    const oldParticipant = room.join({
      cameraEnabled: false,
      displayName: "Member",
      id: "member-1",
      lastSeenAt: now,
      mediaSeat: "none",
      role: "viewer",
      syncStatus: "unknown",
    });
    const admission = new RoomAdmission({ maxParticipants: 4 });
    const admissionId = "replacement-admission";
    const reservation = admission.reserve("member-1", admissionId, now);
    if (!reservation.allowed) throw new Error("expected reservation");
    let attachment = createRoomSocketAttachment("room-1", verified, now, {
      deadlineAt: reservation.deadlineAt,
      joined: false,
    });
    const clearAdmissionTimeout = vi.fn();
    const participantsBySocket = new Map<WebSocket, string>([[oldSocket, "member-1"]]);
    const socketsByParticipant = new Map<string, WebSocket>([["member-1", oldSocket]]);
    const sessionIdBySocket = new Map<WebSocket, string | undefined>([[oldSocket, "shared-session"]]);
    const verifiedBySocket = new Map<WebSocket, typeof verified>([
      [oldSocket, verified],
      [replacementSocket, verified],
    ]);
    const sendRoomHistoryAuthority = vi.fn(async () => undefined);
    const lifecycleTransaction = {
      deleteAlarm: async () => undefined,
      get: async () => undefined,
      put: async () => undefined,
    };
    const roomObject = {
      admission,
      admissionIdBySocket: new Map<WebSocket, string>([[replacementSocket, admissionId]]),
      broadcast: vi.fn(),
      clearAdmissionTimeout,
      currentRoomSnapshot: vi.fn(() => ({ type: "ROOM_SNAPSHOT", roomId: "room-1" })),
      endedTombstone: null,
      expirePendingAdmission: vi.fn(),
      getSocketAttachment: () => attachment,
      hasJoinDeadlineElapsed: () => false,
      participantsBySocket,
      p2pSignalBuffer: { requiresResyncAfter: () => false },
      persistRoomState: vi.fn(),
      reconcileRoomUsage: vi.fn(),
      replayP2PSignals: vi.fn(),
      room,
      roomEndInProgress: false,
      send: vi.fn(),
      sendRoomHistoryAuthority,
      sessionIdBySocket,
      socketsByParticipant,
      state: {
        storage: {
          transaction: async <T>(callback: (transaction: typeof lifecycleTransaction) => Promise<T>) =>
            callback(lifecycleTransaction),
        },
      },
      track: vi.fn(),
      verifiedBySocket,
      writeSocketAttachment: (_socket: WebSocket, next: typeof attachment) => {
        attachment = next;
      },
    };
    Object.setPrototypeOf(roomObject, RoomDurableObject.prototype);

    await expect((RoomDurableObject.prototype as unknown as {
      handleJoin(
        this: typeof roomObject,
        socket: WebSocket,
        event: {
          type: "JOIN";
          roomId: string;
          participant: typeof oldParticipant;
          participantSessionId: string;
          videoFingerprint: string;
        },
      ): Promise<void>;
    }).handleJoin.call(roomObject, replacementSocket, {
      type: "JOIN",
      roomId: "room-1",
      participant: oldParticipant,
      participantSessionId: "shared-session",
      videoFingerprint: "video-1",
    })).resolves.toBeUndefined();

    expect(admission.isPending(admissionId)).toBe(false);
    expect(clearAdmissionTimeout).toHaveBeenCalledWith(replacementSocket);
    expect(attachment.admission.joined).toBe(true);
    expect(roomObject.room.participants).toHaveLength(1);
    expect(socketsByParticipant.get("member-1")).toBe(replacementSocket);
    expect(participantsBySocket.get(replacementSocket)).toBe("member-1");
    expect(sessionIdBySocket.get(replacementSocket)).toBe("shared-session");
    expect(participantsBySocket.has(oldSocket)).toBe(false);
    expect(verifiedBySocket.has(oldSocket)).toBe(false);
    expect(sessionIdBySocket.has(oldSocket)).toBe(false);
    expect(sendRoomHistoryAuthority).toHaveBeenCalledWith(replacementSocket);
  });

  it("keeps admission pending when joined attachment serialization fails before participant replacement", async () => {
    const now = Date.now();
    const room = new RoomState("room-1");
    const oldSocket = { close: vi.fn() } as unknown as WebSocket;
    const replacementSocket = { close: vi.fn() } as unknown as WebSocket;
    const verified = { avatarUrl: null, role: "member" as const, roomId: "room-1", sub: "member-1" };
    const oldParticipant = room.join({
      cameraEnabled: false,
      displayName: "Member",
      id: "member-1",
      lastSeenAt: now,
      mediaSeat: "none",
      role: "viewer",
      syncStatus: "unknown",
    });
    const admission = new RoomAdmission({ maxParticipants: 4 });
    const admissionId = "replacement-admission";
    const reservation = admission.reserve("member-1", admissionId, now);
    if (!reservation.allowed) throw new Error("expected reservation");
    let attachment = createRoomSocketAttachment("room-1", verified, now, {
      deadlineAt: reservation.deadlineAt,
      joined: false,
    });
    const attachmentsBySocket = new Map<WebSocket, typeof attachment>([[replacementSocket, attachment]]);
    let failJoinedAttachmentWrite = true;
    let failPendingAttachmentWrite = false;
    let failPersistRoomState = false;
    let failRollbackPersistRoomState = false;
    const clearAdmissionTimeout = vi.fn();
    const participantsBySocket = new Map<WebSocket, string>([[oldSocket, "member-1"]]);
    const socketsByParticipant = new Map<string, WebSocket>([["member-1", oldSocket]]);
    const sessionIdBySocket = new Map<WebSocket, string | undefined>([[oldSocket, "old-session"]]);
    const verifiedBySocket = new Map<WebSocket, typeof verified>([
      [oldSocket, verified],
      [replacementSocket, verified],
    ]);
    const lifecycleTransaction = {
      deleteAlarm: async () => undefined,
      get: async () => undefined,
      put: async () => undefined,
    };
    const roomObject = {
      admission,
      admissionIdBySocket: new Map<WebSocket, string>([[replacementSocket, admissionId]]),
      clearAdmissionTimeout,
      currentRoomSnapshot: vi.fn(() => ({ type: "ROOM_SNAPSHOT", roomId: "room-1" })),
      endedTombstone: null,
      expirePendingAdmission: vi.fn(),
      getSocketAttachment: (socket: WebSocket) => attachmentsBySocket.get(socket) ?? null,
      hasJoinDeadlineElapsed: () => false,
      participantsBySocket,
      p2pSignalBuffer: { requiresResyncAfter: () => false },
      persistRoomState: vi.fn(() => {
        if (failPersistRoomState) {
          failPersistRoomState = false;
          throw new Error("room persistence failed");
        }
        if (failRollbackPersistRoomState) {
          failRollbackPersistRoomState = false;
          throw new Error("room persistence rollback failed");
        }
      }),
      reconcileRoomUsage: vi.fn(),
      replayP2PSignals: vi.fn(),
      room,
      roomEndInProgress: false,
      send: vi.fn(),
      sendRoomHistoryAuthority: vi.fn(async () => undefined),
      sessionIdBySocket,
      socketsByParticipant,
      state: {
        storage: {
          transaction: async <T>(callback: (transaction: typeof lifecycleTransaction) => Promise<T>) =>
            callback(lifecycleTransaction),
        },
      },
      track: vi.fn(),
      verifiedBySocket,
      writeSocketAttachment: (_socket: WebSocket, next: typeof attachment) => {
        if (failJoinedAttachmentWrite && next.admission.joined) {
          failJoinedAttachmentWrite = false;
          throw new Error("serializeAttachment failed");
        }
        if (failPendingAttachmentWrite && !next.admission.joined) {
          failPendingAttachmentWrite = false;
          throw new Error("serializeAttachment rollback failed");
        }
        attachment = next;
        attachmentsBySocket.set(_socket, next);
      },
    };
    Object.setPrototypeOf(roomObject, RoomDurableObject.prototype);
    const join = (
      joiningSocket = replacementSocket,
      participantSessionId = "replacement-session",
    ) => (
      RoomDurableObject.prototype as unknown as {
        handleJoin(
          this: typeof roomObject,
          socket: WebSocket,
          event: {
            type: "JOIN";
            roomId: string;
            participant: typeof oldParticipant;
            participantSessionId: string;
            videoFingerprint: string;
          },
        ): Promise<void>;
      }
    ).handleJoin.call(roomObject, joiningSocket, {
      type: "JOIN",
      roomId: "room-1",
      participant: oldParticipant,
      participantSessionId,
      videoFingerprint: "video-1",
    });

    await join().catch(() => undefined);

    expect(admission.isPending(admissionId)).toBe(true);
    expect(attachment.admission.joined).toBe(false);
    expect(clearAdmissionTimeout).not.toHaveBeenCalled();
    expect(socketsByParticipant.get("member-1")).toBe(oldSocket);
    expect(participantsBySocket.has(replacementSocket)).toBe(false);
    expect(oldSocket.close).not.toHaveBeenCalled();
    expect(roomObject.room.participants).toEqual([oldParticipant]);

    await join();

    expect(attachment.admission.joined).toBe(true);
    expect(socketsByParticipant.get("member-1")).toBe(replacementSocket);
    expect(oldSocket.close).toHaveBeenCalledOnce();

    const persistenceSocket = { close: vi.fn() } as unknown as WebSocket;
    const persistenceAdmissionId = "persistence-admission";
    const persistenceReservation = admission.reserve("member-1", persistenceAdmissionId, Date.now());
    if (!persistenceReservation.allowed) throw new Error("expected persistence reservation");
    const pendingPersistenceAttachment = createRoomSocketAttachment("room-1", verified, Date.now(), {
      deadlineAt: persistenceReservation.deadlineAt,
      joined: false,
    });
    attachmentsBySocket.set(persistenceSocket, pendingPersistenceAttachment);
    verifiedBySocket.set(persistenceSocket, verified);
    roomObject.admissionIdBySocket.set(persistenceSocket, persistenceAdmissionId);
    const { updatedAt: _roomBeforePersistenceUpdatedAt, ...roomBeforePersistenceFailure } =
      roomObject.room.toSnapshot();
    failPersistRoomState = true;

    await join(persistenceSocket, "persistence-session");

    expect(admission.isPending(persistenceAdmissionId)).toBe(true);
    expect(attachmentsBySocket.get(persistenceSocket)?.admission.joined).toBe(false);
    expect(socketsByParticipant.get("member-1")).toBe(replacementSocket);
    expect(participantsBySocket.has(persistenceSocket)).toBe(false);
    const { updatedAt: _roomAfterPersistenceUpdatedAt, ...roomAfterPersistenceFailure } =
      roomObject.room.toSnapshot();
    expect(roomAfterPersistenceFailure).toEqual(roomBeforePersistenceFailure);

    await join(persistenceSocket, "persistence-session");

    expect(attachmentsBySocket.get(persistenceSocket)?.admission.joined).toBe(true);
    expect(socketsByParticipant.get("member-1")).toBe(persistenceSocket);

    const rollbackFailureSocket = { close: vi.fn() } as unknown as WebSocket;
    const rollbackFailureAdmissionId = "rollback-failure-admission";
    const rollbackFailureReservation = admission.reserve(
      "member-1",
      rollbackFailureAdmissionId,
      Date.now(),
    );
    if (!rollbackFailureReservation.allowed) throw new Error("expected rollback-failure reservation");
    attachmentsBySocket.set(rollbackFailureSocket, createRoomSocketAttachment("room-1", verified, Date.now(), {
      deadlineAt: rollbackFailureReservation.deadlineAt,
      joined: false,
    }));
    verifiedBySocket.set(rollbackFailureSocket, verified);
    roomObject.admissionIdBySocket.set(rollbackFailureSocket, rollbackFailureAdmissionId);
    failJoinedAttachmentWrite = true;
    failPendingAttachmentWrite = true;

    await join(rollbackFailureSocket, "rollback-failure-session");

    expect(rollbackFailureSocket.close).toHaveBeenCalledWith(1011, "Room join rollback failed");
    expect(admission.isPending(rollbackFailureAdmissionId)).toBe(false);
    expect(roomObject.admissionIdBySocket.has(rollbackFailureSocket)).toBe(false);

    const persistenceRollbackFailureSocket = { close: vi.fn() } as unknown as WebSocket;
    const persistenceRollbackFailureAdmissionId = "persistence-rollback-failure-admission";
    const persistenceRollbackFailureReservation = admission.reserve(
      "member-1",
      persistenceRollbackFailureAdmissionId,
      Date.now(),
    );
    if (!persistenceRollbackFailureReservation.allowed) {
      throw new Error("expected persistence rollback-failure reservation");
    }
    attachmentsBySocket.set(
      persistenceRollbackFailureSocket,
      createRoomSocketAttachment("room-1", verified, Date.now(), {
        deadlineAt: persistenceRollbackFailureReservation.deadlineAt,
        joined: false,
      }),
    );
    verifiedBySocket.set(persistenceRollbackFailureSocket, verified);
    roomObject.admissionIdBySocket.set(
      persistenceRollbackFailureSocket,
      persistenceRollbackFailureAdmissionId,
    );
    failPersistRoomState = true;
    failRollbackPersistRoomState = true;

    await join(persistenceRollbackFailureSocket, "persistence-rollback-failure-session");

    expect(persistenceRollbackFailureSocket.close).toHaveBeenCalledWith(1011, "Room join rollback failed");
    expect(admission.isPending(persistenceRollbackFailureAdmissionId)).toBe(false);
    expect(roomObject.admissionIdBySocket.has(persistenceRollbackFailureSocket)).toBe(false);
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
