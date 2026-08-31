import { describe, expect, it, vi } from "vitest";
import { connectRoomHttpMessage } from "../src/room-client";
import type { PreparedRoomSession } from "../src/room-session-storage";

function preparedRoomSession(roomId: string): PreparedRoomSession {
  return {
    version: 1 as const,
    preparationId: `preparation-${roomId}`,
    roomId,
    ownerUserId: "user-a",
    participantSessionId: `session-${roomId}`,
  };
}

const roomSessionRouteDependencies = {
  confirmRoomSession: async (
    _tabId: number,
    prepared: PreparedRoomSession,
    roomId: string,
  ) => ({
    version: 1 as const,
    revision: 1,
    roomId,
    ownerUserId: prepared.ownerUserId,
    participantSessionId: prepared.participantSessionId,
    cameraEnabled: false,
    voiceMode: "push-to-talk" as const,
  }),
  discardPreparedRoomSession: async () => false,
};

describe("background privileged room route", () => {
  it("routes a real tab removal through exact departure and authority cleanup", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const calls: string[] = [];

    await background.handleRemovedRoomTab(60, {
      clearRoomAuthorityRequest: (tabId) => calls.push(`request:${tabId}`),
      departRoom: async (tabId) => {
        calls.push(`depart:${tabId}`);
        return "departed";
      },
      removePrivilegedAuthority: async (tabId) => {
        calls.push(`authority:${tabId}`);
      },
    });

    expect(calls).toEqual(["request:60", "depart:60", "authority:60"]);
  });

  it("routes an explicit leave through the sender tab's background-owned session", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const requestDeparture = vi.fn(async () => ({
      kind: "ack",
      outcome: "departed",
    }) as const);

    const result = await background.dispatchPrivilegedRoomRuntimeMessage(
      { type: "ANIDACHI_ROOM_DEPARTURE", command: "depart" },
      { tab: { id: 62 } },
      {
        departureDependencies: {
          loadRoomSession: async (tabId) => ({
            version: 1,
            revision: 1,
            roomId: "room-a",
            ownerUserId: "user-a",
            participantSessionId: `session-${tabId}`,
            cameraEnabled: false,
            voiceMode: "push-to-talk",
          }),
          getStoredSession: async () => sessionFor("user-a"),
          refreshSession: async () => null,
          requestDeparture,
          timeoutMs: 100,
        },
      },
    );

    expect(result).toEqual({ ok: true, outcome: "departed" });
    expect(requestDeparture).toHaveBeenCalledWith(
      expect.objectContaining({ participantSessionId: "session-62" }),
      expect.any(String),
      expect.any(AbortSignal),
    );
  });

  it("routes a background-issued authority through connect, rejects a forgery, ends once, and rejects replay", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const storage = createSessionStorage();
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            roomToken: trustedRoomToken({ sub: "user-a", roomId: "room-a", role: "host" }),
          }),
          { status: 200 },
        ),
      ),
    );
    const sender = { tab: { id: 61 } };
    const dependencies = {
      endRoom,
      intentDependencies: {
        sessionStorage: storage,
        getCurrentSession: async () => sessionFor("user-a"),
      },
      roomDependencies: {
        ...roomSessionRouteDependencies,
        authorityDependencies: {
          sessionStorage: storage,
          getStoredSession: async () => sessionFor("user-a"),
        },
      },
    };

    const connected = await background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-a", "access-a", preparedRoomSession("room-a")),
      sender,
      dependencies,
    );
    expect(connected).toMatchObject({
      ok: true,
      connection: {
        privilegedRoomAuthority: {
          accountUserId: "user-a",
          roomId: "room-a",
          role: "host",
          authorityGeneration: 1,
        },
      },
    });
    const authority = (connected as { connection: { privilegedRoomAuthority: object } }).connection
      .privilegedRoomAuthority;

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: { ...authority, authorityGeneration: 2 },
        },
        sender,
        dependencies,
      ),
    ).resolves.toEqual({ ok: false, error: "Privileged overlay room authority is stale" });
    expect(endRoom).not.toHaveBeenCalled();

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: authority,
        },
        sender,
        dependencies,
      ),
    ).resolves.toEqual({ ok: true, endedAt: "2026-08-21T00:00:00.000Z" });
    expect(endRoom).toHaveBeenCalledOnce();

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: authority,
        },
        sender,
        dependencies,
      ),
    ).resolves.toEqual({ ok: false, error: "Privileged overlay room authority is stale" });
  });

  it("keeps the newest out-of-order room authority usable for manual and quota end", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const endRoom = vi.fn(async (roomId: string) => ({ endedAt: `${roomId}-ended` }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sender = { tab: { id: 62 } };

    for (const action of ["end-room", "quota-end-room"] as const) {
      const storage = createSessionStorage();
      const requestSequences = new Map<number, number>();
      const oldResponse = deferred<Response>();
      const newResponse = deferred<Response>();
      fetchMock.mockImplementationOnce(() => oldResponse.promise).mockImplementationOnce(() => newResponse.promise);
      const dependencies = {
        endRoom,
        intentDependencies: {
          sessionStorage: storage,
          getCurrentSession: async () => sessionFor("user-a"),
        },
        roomDependencies: {
          ...roomSessionRouteDependencies,
          authorityRequestSequences: requestSequences,
          authorityDependencies: {
            sessionStorage: storage,
            getStoredSession: async () => sessionFor("user-a"),
          },
        },
      };
      const older = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          `room-old-${action}`,
          "access-a",
          preparedRoomSession(`room-old-${action}`),
        ),
        sender,
        dependencies,
      );
      const newer = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          `room-new-${action}`,
          "access-a",
          preparedRoomSession(`room-new-${action}`),
        ),
        sender,
        dependencies,
      );
      newResponse.resolve(roomResponse(`room-new-${action}`));
      const newest = await newer;
      oldResponse.resolve(roomResponse(`room-old-${action}`));
      const stale = await older;

      expect(stale).toMatchObject({ ok: true, connection: { privilegedRoomAuthority: null } });
      expect(newest).toMatchObject({
        ok: true,
        connection: {
          privilegedRoomAuthority: {
            roomId: `room-new-${action}`,
            role: "host",
            authorityGeneration: 2,
          },
        },
      });
      const authority = (newest as { connection: { privilegedRoomAuthority: object } }).connection
        .privilegedRoomAuthority;

      await expect(
        background.dispatchPrivilegedRoomRuntimeMessage(
          {
            type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
            command: "invoke",
            action,
            context: { ...authority, roomId: `room-old-${action}` },
          },
          sender,
          dependencies,
        ),
      ).resolves.toEqual({ ok: false, error: "Privileged overlay room authority is stale" });
      await expect(
        background.dispatchPrivilegedRoomRuntimeMessage(
          {
            type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
            command: "invoke",
            action,
            context: authority,
          },
          sender,
          dependencies,
        ),
      ).resolves.toEqual({ ok: true, endedAt: `room-new-${action}-ended` });
      await expect(
        background.dispatchPrivilegedRoomRuntimeMessage(
          {
            type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
            command: "invoke",
            action,
            context: authority,
          },
          sender,
          dependencies,
        ),
      ).resolves.toEqual({ ok: false, error: "Privileged overlay room authority is stale" });
    }

    expect(endRoom).toHaveBeenNthCalledWith(1, "room-new-end-room", "access-token-user-a");
    expect(endRoom).toHaveBeenNthCalledWith(2, "room-new-quota-end-room", "access-token-user-a");
  });

  it("linearizes a superseding reservation with an older pending authority write", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const outcome of ["success", "failure"] as const) {
      const tabId = outcome === "success" ? 71 : 72;
      const storage = createPausedFirstWriteStorage();
      const dependencies = {
        roomDependencies: {
          ...roomSessionRouteDependencies,
          authorityDependencies: {
            sessionStorage: storage,
            getStoredSession: async () => sessionFor("user-a"),
          },
        },
      };
      fetchMock
        .mockImplementationOnce(() => Promise.resolve(roomResponse(`room-old-${outcome}`)))
        .mockImplementationOnce(() =>
          Promise.resolve(
            outcome === "success"
              ? roomResponse(`room-new-${outcome}`)
              : new Response(JSON.stringify({ error: "new request failed" }), { status: 500 }),
          ),
        );

      const older = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          `room-old-${outcome}`,
          "access-a",
          preparedRoomSession(`room-old-${outcome}`),
        ),
        { tab: { id: tabId } },
        dependencies,
      );
      await storage.firstWriteStarted;
      const newer = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          `room-new-${outcome}`,
          "access-a",
          preparedRoomSession(`room-new-${outcome}`),
        ),
        { tab: { id: tabId } },
        dependencies,
      );
      expect(fetchMock).toHaveBeenCalledTimes(outcome === "success" ? 2 : 4);

      storage.releaseFirstWrite();
      const [oldResult, newResult] = await Promise.all([older, newer]);

      expect(oldResult).toMatchObject({ ok: true, connection: { privilegedRoomAuthority: null } });
      if (outcome === "success") {
        expect(newResult).toMatchObject({
          ok: true,
          connection: { privilegedRoomAuthority: { roomId: "room-new-success", role: "host" } },
        });
        expect(storage.value()).toMatchObject({ roomId: "room-new-success", role: "host" });
      } else {
        expect(newResult).toMatchObject({ ok: false, status: 500 });
        expect(storage.value()).toBeUndefined();
      }
    }
  });

  it("blocks invoke behind a superseding clear and does not finish a failed newer request early", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const storage = createPausableSessionStorage();
    const sender = { tab: { id: 73 } };
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    const oldResponse = deferred<Response>();
    const failedResponseRead = deferred<void>();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(roomResponse("room-active"))
      .mockImplementationOnce(() => oldResponse.promise)
      .mockResolvedValueOnce(failingRoomResponse(failedResponseRead))
      .mockResolvedValueOnce(roomResponse("room-after-failure"));
    vi.stubGlobal("fetch", fetchMock);
    const dependencies = {
      endRoom,
      intentDependencies: {
        sessionStorage: storage,
        getCurrentSession: async () => sessionFor("user-a"),
      },
      roomDependencies: {
        ...roomSessionRouteDependencies,
        authorityDependencies: {
          sessionStorage: storage,
          getStoredSession: async () => sessionFor("user-a"),
        },
      },
    };

    const connected = await background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage(
        "room-active",
        "access-a",
        preparedRoomSession("room-active"),
      ),
      sender,
      dependencies,
    );
    const activeAuthority = (
      connected as { connection: { privilegedRoomAuthority: object } }
    ).connection.privilegedRoomAuthority;

    const pausedMutation = storage.pauseNextMutation();
    const older = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage(
        "room-old-pending",
        "access-a",
        preparedRoomSession("room-old-pending"),
      ),
      sender,
      dependencies,
    );
    await pausedMutation.started;

    const newer = background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage(
        "room-new-failed",
        "access-a",
        preparedRoomSession("room-new-failed"),
      ),
      sender,
      dependencies,
    );
    if (!newer) throw new Error("Expected newer room request to be routed");
    oldResponse.resolve(roomResponse("room-old-pending"));
    await failedResponseRead.promise;

    let newerSettled = false;
    void newer.then(() => {
      newerSettled = true;
    });
    const invoke = background.dispatchPrivilegedRoomRuntimeMessage(
      {
        type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
        command: "invoke",
        action: "end-room",
        context: activeAuthority,
      },
      sender,
      dependencies,
    );
    if (!invoke) throw new Error("Expected privileged invoke to be routed");
    let invokeSettled = false;
    void invoke.then(() => {
      invokeSettled = true;
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(endRoom).not.toHaveBeenCalled();
    expect(newerSettled).toBe(false);
    expect(invokeSettled).toBe(false);

    pausedMutation.release();
    const [oldResult, newResult, invokeResult] = await Promise.all([older, newer, invoke]);

    expect(oldResult).toMatchObject({ ok: true, connection: { privilegedRoomAuthority: null } });
    expect(newResult).toMatchObject({ ok: false, status: 500 });
    expect(invokeResult).toEqual({
      ok: false,
      error: "Privileged overlay room authority is stale",
    });
    expect(endRoom).not.toHaveBeenCalled();
    expect(storage.currentAuthority()).toBeNull();

    await expect(
      background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(
          "room-after-failure",
          "access-a",
          preparedRoomSession("room-after-failure"),
        ),
        sender,
        dependencies,
      ),
    ).resolves.toMatchObject({
      ok: true,
      connection: {
        privilegedRoomAuthority: {
          roomId: "room-after-failure",
          authorityGeneration: 4,
        },
      },
    });
  });

  it("does not reuse a same-room authority generation after restart-style storage re-read", async () => {
    vi.stubGlobal("chrome", {});
    const background = await import("../entrypoints/background");
    const storage = createSessionStorage();
    const sender = { tab: { id: 74 } };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(roomResponse("room-same"))
        .mockResolvedValueOnce(roomResponse("room-same")),
    );
    const dependencies = {
      roomDependencies: {
        ...roomSessionRouteDependencies,
        authorityDependencies: {
          sessionStorage: storage,
          getStoredSession: async () => sessionFor("user-a"),
        },
      },
    };

    const first = await background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-same", "access-a", preparedRoomSession("room-same")),
      sender,
      dependencies,
    );
    const second = await background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-same", "access-a", preparedRoomSession("room-same")),
      sender,
      dependencies,
    );
    const firstAuthority = (
      first as { connection: { privilegedRoomAuthority: Record<string, unknown> } }
    ).connection.privilegedRoomAuthority;
    const secondAuthority = (
      second as { connection: { privilegedRoomAuthority: Record<string, unknown> } }
    ).connection.privilegedRoomAuthority;

    vi.resetModules();
    const restartedIntent = await import("../src/privileged-overlay-intent");
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    const replayResult = await restartedIntent.handlePrivilegedOverlayIntentMessage(
      {
        type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
        command: "invoke",
        action: "end-room",
        context: firstAuthority as never,
      },
      sender,
      {
        sessionStorage: storage,
        endRoom,
        getCurrentSession: async () => sessionFor("user-a"),
      },
    );

    expect({
      firstGeneration: firstAuthority.authorityGeneration,
      secondGeneration: secondAuthority.authorityGeneration,
      replayResult,
      endCalls: endRoom.mock.calls.length,
    }).toEqual({
      firstGeneration: 1,
      secondGeneration: 2,
      replayResult: { ok: false, error: "Privileged overlay room authority is stale" },
      endCalls: 0,
    });
  });
});

function sessionFor(userId: string) {
  return {
    accessToken: `access-token-${userId}`,
    refreshToken: `refresh-token-${userId}`,
    user: {
      id: userId,
      email: `${userId}@example.com`,
      displayName: "User",
      avatarUrl: null,
      plan: "free" as const,
    },
  };
}

function trustedRoomToken(payload: Record<string, unknown>): string {
  return `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ typ: "room", ...payload }))}.signature`;
}

function roomResponse(roomId: string): Response {
  return new Response(
    JSON.stringify({ roomToken: trustedRoomToken({ sub: "user-a", roomId, role: "host" }) }),
    { status: 200 },
  );
}

function failingRoomResponse(read: ReturnType<typeof deferred<void>>): Response {
  return {
    ok: false,
    status: 500,
    async json() {
      read.resolve();
      return { error: "new request failed" };
    },
  } as Response;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createSessionStorage() {
  const values = new Map<string, unknown>();
  return {
    async get(key: string) {
      return values.has(key) ? { [key]: values.get(key) } : {};
    },
    async set(items: Record<string, unknown>) {
      for (const [key, value] of Object.entries(items)) values.set(key, value);
    },
    async remove(key: string) {
      values.delete(key);
    },
  };
}

function createPausableSessionStorage() {
  const values = new Map<string, unknown>();
  let nextPause:
    | {
        started: ReturnType<typeof deferred<void>>;
        released: ReturnType<typeof deferred<void>>;
      }
    | undefined;

  const beforeMutation = async () => {
    const pause = nextPause;
    if (!pause) return;
    nextPause = undefined;
    pause.started.resolve();
    await pause.released.promise;
  };

  return {
    pauseNextMutation() {
      const started = deferred<void>();
      const released = deferred<void>();
      nextPause = { started, released };
      return {
        started: started.promise,
        release: () => released.resolve(),
      };
    },
    currentAuthority() {
      const value = values.values().next().value;
      if (
        typeof value === "object" &&
        value !== null &&
        "currentAuthority" in value
      ) {
        return (value as { currentAuthority?: unknown }).currentAuthority ?? null;
      }
      return value ?? null;
    },
    async get(key: string) {
      return values.has(key) ? { [key]: values.get(key) } : {};
    },
    async set(items: Record<string, unknown>) {
      await beforeMutation();
      for (const [key, value] of Object.entries(items)) values.set(key, value);
    },
    async remove(key: string) {
      await beforeMutation();
      values.delete(key);
    },
  };
}

function createPausedFirstWriteStorage() {
  const values = new Map<string, unknown>();
  let releaseFirstWrite!: () => void;
  let signalFirstWrite!: () => void;
  let firstWrite = true;
  const firstWriteStarted = new Promise<void>((resolve) => {
    signalFirstWrite = resolve;
  });
  const firstWriteReleased = new Promise<void>((resolve) => {
    releaseFirstWrite = resolve;
  });
  return {
    firstWriteStarted,
    releaseFirstWrite,
    value: () => {
      const value = values.values().next().value;
      if (typeof value === "object" && value !== null && "currentAuthority" in value) {
        return (value as { currentAuthority?: unknown }).currentAuthority ?? undefined;
      }
      return value;
    },
    async get(key: string) {
      return values.has(key) ? { [key]: values.get(key) } : {};
    },
    async set(items: Record<string, unknown>) {
      if (firstWrite) {
        firstWrite = false;
        signalFirstWrite();
        await firstWriteReleased;
      }
      for (const [key, value] of Object.entries(items)) values.set(key, value);
    },
    async remove(key: string) {
      values.delete(key);
    },
  };
}
