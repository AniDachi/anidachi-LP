import { describe, expect, it, vi } from "vitest";
import { connectRoomHttpMessage } from "../src/room-client";

describe("background privileged room route", () => {
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
        authorityDependencies: {
          sessionStorage: storage,
          getStoredSession: async () => sessionFor("user-a"),
        },
      },
    };

    const connected = await background.dispatchPrivilegedRoomRuntimeMessage(
      connectRoomHttpMessage("room-a", "access-a"),
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
          authorityRequestSequences: requestSequences,
          authorityDependencies: {
            sessionStorage: storage,
            getStoredSession: async () => sessionFor("user-a"),
          },
        },
      };
      const older = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(`room-old-${action}`, "access-a"),
        sender,
        dependencies,
      );
      const newer = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(`room-new-${action}`, "access-a"),
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
            authorityGeneration: 1,
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
        connectRoomHttpMessage(`room-old-${outcome}`, "access-a"),
        { tab: { id: tabId } },
        dependencies,
      );
      await storage.firstWriteStarted;
      const newer = background.dispatchPrivilegedRoomRuntimeMessage(
        connectRoomHttpMessage(`room-new-${outcome}`, "access-a"),
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
    value: () => values.values().next().value,
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
