import { describe, expect, it, vi } from "vitest";
import { isAuthMessage } from "../src/auth-client";
import { isRoomHttpMessage } from "../src/room-client";
import {
  handlePrivilegedOverlayIntentMessage,
  isPrivilegedOverlayIntentMessage,
  issuePrivilegedRoomAuthority,
  reservePrivilegedRoomAuthorityForTab,
  requestPrivilegedOverlayAction,
  type IssuedRoomAuthorityInput,
  type PrivilegedOverlayIntentDependencies,
  type PrivilegedOverlayContext,
} from "../src/privileged-overlay-intent";

describe("privileged overlay intent boundary", () => {
  it("rejects the generic sign-out runtime message that a hostile page could forge", () => {
    expect(isAuthMessage({ type: "ANIDACHI_AUTH", command: "sign-out" })).toBe(false);
  });

  it("rejects the generic end-room runtime message with a caller supplied access token", () => {
    expect(
      isRoomHttpMessage({
        type: "ANIDACHI_ROOM_HTTP",
        command: "end-room",
        roomId: "room-forged",
        accessToken: "forged-access-token",
      }),
    ).toBe(false);
  });

  it("rejects a synthetic click before a sign-out caller can run local teardown", async () => {
    const sendMessage = vi.fn();

    await expect(
      requestPrivilegedOverlayAction(
        { nativeEvent: { isTrusted: false } },
        "sign-out",
        signOutContext(),
        sendMessage,
      ),
    ).rejects.toThrow("Privileged action requires a trusted user gesture");

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("rejects the complete forged set-context then end-room message sequence", async () => {
    const storage = createSessionStorage();
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    const forged = roomHostContext();
    const sender = { tab: { id: 7 } };
    const setContext = {
      type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
      command: "set-context",
      context: forged,
    };

    expect(isPrivilegedOverlayIntentMessage(setContext)).toBe(false);
    if (isPrivilegedOverlayIntentMessage(setContext)) {
      await handlePrivilegedOverlayIntentMessage(setContext, sender, {
        sessionStorage: storage,
        endRoom,
        getCurrentSession: async () => sessionFor("user-a"),
      });
    }

    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: forged,
        },
        sender,
        {
          sessionStorage: storage,
          endRoom,
          getCurrentSession: async () => sessionFor("user-a"),
        },
      ),
    ).resolves.toEqual({ ok: false, error: "Privileged overlay room authority is stale" });
    expect(endRoom).not.toHaveBeenCalled();
  });

  it("issues host authority only from a matching trusted room token and current extension account", async () => {
    const storage = createSessionStorage();
    const authority = await reserveAndIssueRoomAuthority(
      { roomId: "room-a", roomToken: trustedRoomToken("user-a", "room-a", "host") },
      { tab: { id: 8 } },
      { sessionStorage: storage, getStoredSession: async () => sessionFor("user-a") },
    );

    expect(authority).toEqual(roomHostContext(1));

    await expect(
      reserveAndIssueRoomAuthority(
        { roomId: "room-a", roomToken: trustedRoomToken("user-forged", "room-a", "host") },
        { tab: { id: 8 } },
        { sessionStorage: storage, getStoredSession: async () => sessionFor("user-a") },
      ),
    ).resolves.toBeNull();
  });

  it("executes one trusted host end only with the background-issued authority generation", async () => {
    const storage = createSessionStorage();
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    const sender = { tab: { id: 9 } };
    const authority = await reserveAndIssueRoomAuthority(
      { roomId: "room-a", roomToken: trustedRoomToken("user-a", "room-a", "host") },
      sender,
      { sessionStorage: storage, getStoredSession: async () => sessionFor("user-a") },
    );
    expect(authority).toEqual(roomHostContext(1));
    const sendMessage = (message: Parameters<typeof handlePrivilegedOverlayIntentMessage>[0]) =>
      handlePrivilegedOverlayIntentMessage(message, sender, {
        sessionStorage: storage,
        endRoom,
        getCurrentSession: async () => sessionFor("user-a"),
      });

    await expect(
      requestPrivilegedOverlayAction(
        { nativeEvent: { isTrusted: true } },
        "end-room",
        authority as PrivilegedOverlayContext,
        sendMessage,
      ),
    ).resolves.toEqual({ ok: true, endedAt: "2026-08-21T00:00:00.000Z" });
    expect(endRoom).toHaveBeenCalledWith("room-a", "access-token-user-a");

    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: authority as PrivilegedOverlayContext,
        },
        sender,
        { sessionStorage: storage, endRoom, getCurrentSession: async () => sessionFor("user-a") },
      ),
    ).resolves.toEqual({ ok: false, error: "Privileged overlay room authority is stale" });
    expect(endRoom).toHaveBeenCalledOnce();
  });

  it("atomically consumes authority before the end request so concurrent replay is rejected", async () => {
    const storage = createSessionStorage();
    const sender = { tab: { id: 12 } };
    const endResult = deferred<{ endedAt: string | null }>();
    const endStarted = deferred<void>();
    const endRoom = vi.fn(() => {
      endStarted.resolve();
      return endResult.promise;
    });
    const authority = await reserveAndIssueRoomAuthority(
      { roomId: "room-a", roomToken: trustedRoomToken("user-a", "room-a", "host") },
      sender,
      { sessionStorage: storage, getStoredSession: async () => sessionFor("user-a") },
    );
    const message = {
      type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" as const,
      command: "invoke" as const,
      action: "end-room" as const,
      context: authority as PrivilegedOverlayContext,
    };
    const dependencies = {
      sessionStorage: storage,
      endRoom,
      getCurrentSession: async () => sessionFor("user-a"),
    };

    const first = handlePrivilegedOverlayIntentMessage(message, sender, dependencies);
    await endStarted.promise;
    const replay = handlePrivilegedOverlayIntentMessage(message, sender, dependencies);
    await Promise.resolve();
    await Promise.resolve();
    const callsBeforeEndResolved = endRoom.mock.calls.length;
    endResult.resolve({ endedAt: "2026-08-21T00:00:00.000Z" });

    expect({
      callsBeforeEndResolved,
      results: await Promise.all([first, replay]),
    }).toEqual({
      callsBeforeEndResolved: 1,
      results: [
        { ok: true, endedAt: "2026-08-21T00:00:00.000Z" },
        { ok: false, error: "Privileged overlay room authority is stale" },
      ],
    });
  });

  it.each(["end-room", "quota-end-room"] as const)(
    "rejects a concurrent %s replay that arrived before failed-end authority restoration",
    async (action) => {
      const storage = createSessionStorage();
      const sender = { tab: { id: action === "end-room" ? 15 : 16 } };
      const firstEndResult = deferred<{ endedAt: string | null }>();
      const firstEndStarted = deferred<void>();
      const replaySessionResult = deferred<ReturnType<typeof sessionFor> | null>();
      let sessionCall = 0;
      const getCurrentSession = vi.fn(() => {
        sessionCall += 1;
        if (sessionCall === 2) return replaySessionResult.promise;
        return Promise.resolve(sessionFor("user-a"));
      });
      const endRoom = vi
        .fn()
        .mockImplementationOnce(() => {
          firstEndStarted.resolve();
          return firstEndResult.promise;
        })
        .mockResolvedValueOnce({ endedAt: "2026-08-21T00:00:00.000Z" });
      const authority = await reserveAndIssueRoomAuthority(
        { roomId: "room-a", roomToken: trustedRoomToken("user-a", "room-a", "host") },
        sender,
        { sessionStorage: storage, getStoredSession: async () => sessionFor("user-a") },
      );
      const message = {
        type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" as const,
        command: "invoke" as const,
        action,
        context: authority as PrivilegedOverlayContext,
      };
      const dependencies = {
        sessionStorage: storage,
        endRoom,
        getCurrentSession,
      };

      const first = handlePrivilegedOverlayIntentMessage(message, sender, dependencies);
      await firstEndStarted.promise;
      const replay = handlePrivilegedOverlayIntentMessage(message, sender, dependencies);
      await Promise.resolve();
      await Promise.resolve();

      firstEndResult.reject(new Error("temporary end failure"));
      await expect(first).rejects.toThrow("temporary end failure");
      replaySessionResult.resolve(sessionFor("user-a"));

      await expect(replay).resolves.toEqual({
        ok: false,
        error: "Privileged overlay room authority is stale",
      });
      expect(endRoom).toHaveBeenCalledOnce();

      await expect(
        handlePrivilegedOverlayIntentMessage(message, sender, dependencies),
      ).resolves.toEqual({ ok: true, endedAt: "2026-08-21T00:00:00.000Z" });
      expect(endRoom).toHaveBeenCalledTimes(2);
    },
  );

  it("restores consumed authority for an idempotent retry after an unsuperseded end failure", async () => {
    const storage = createSessionStorage();
    const sender = { tab: { id: 13 } };
    const endRoom = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary end failure"))
      .mockResolvedValueOnce({ endedAt: "2026-08-21T00:00:00.000Z" });
    const authority = await reserveAndIssueRoomAuthority(
      { roomId: "room-a", roomToken: trustedRoomToken("user-a", "room-a", "host") },
      sender,
      { sessionStorage: storage, getStoredSession: async () => sessionFor("user-a") },
    );
    const message = {
      type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" as const,
      command: "invoke" as const,
      action: "end-room" as const,
      context: authority as PrivilegedOverlayContext,
    };
    const dependencies = {
      sessionStorage: storage,
      endRoom,
      getCurrentSession: async () => sessionFor("user-a"),
    };

    await expect(
      handlePrivilegedOverlayIntentMessage(message, sender, dependencies),
    ).rejects.toThrow("temporary end failure");
    await expect(
      handlePrivilegedOverlayIntentMessage(message, sender, dependencies),
    ).resolves.toEqual({ ok: true, endedAt: "2026-08-21T00:00:00.000Z" });
    expect(endRoom).toHaveBeenCalledTimes(2);
  });

  it("does not restore a consumed authority after a newer reservation supersedes it", async () => {
    const storage = createSessionStorage();
    const sender = { tab: { id: 14 } };
    const endResult = deferred<{ endedAt: string | null }>();
    const endStarted = deferred<void>();
    const endRoom = vi.fn(() => {
      endStarted.resolve();
      return endResult.promise;
    });
    const authority = await reserveAndIssueRoomAuthority(
      { roomId: "room-a", roomToken: trustedRoomToken("user-a", "room-a", "host") },
      sender,
      { sessionStorage: storage, getStoredSession: async () => sessionFor("user-a") },
    );
    const message = {
      type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" as const,
      command: "invoke" as const,
      action: "end-room" as const,
      context: authority as PrivilegedOverlayContext,
    };
    const dependencies = {
      sessionStorage: storage,
      endRoom,
      getCurrentSession: async () => sessionFor("user-a"),
    };

    const invoke = handlePrivilegedOverlayIntentMessage(message, sender, dependencies);
    await endStarted.promise;
    await reservePrivilegedRoomAuthorityForTab(sender.tab.id, { sessionStorage: storage });
    endResult.reject(new Error("temporary end failure"));

    await expect(invoke).rejects.toThrow("temporary end failure");
    await expect(
      handlePrivilegedOverlayIntentMessage(message, sender, dependencies),
    ).resolves.toEqual({ ok: false, error: "Privileged overlay room authority is stale" });
    expect(endRoom).toHaveBeenCalledOnce();
  });

  it("rejects every caller alteration to the issued room authority", async () => {
    const storage = createSessionStorage();
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    const sender = { tab: { id: 11 } };
    const authority = await reserveAndIssueRoomAuthority(
      { roomId: "room-a", roomToken: trustedRoomToken("user-a", "room-a", "host") },
      sender,
      { sessionStorage: storage, getStoredSession: async () => sessionFor("user-a") },
    );

    for (const context of [
      { ...(authority as PrivilegedOverlayContext), roomId: "room-forged" },
      { ...(authority as PrivilegedOverlayContext), role: "member" as const },
      { ...(authority as PrivilegedOverlayContext), authorityGeneration: 99 },
    ]) {
      await expect(
        handlePrivilegedOverlayIntentMessage(
          {
            type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
            command: "invoke",
            action: "end-room",
            context,
          },
          sender,
          { sessionStorage: storage, endRoom, getCurrentSession: async () => sessionFor("user-a") },
        ),
      ).resolves.toEqual({ ok: false, error: "Privileged overlay room authority is stale" });
    }
    expect(endRoom).not.toHaveBeenCalled();
  });

  it("rejects a host invoke after the current extension account switches without restoring authority", async () => {
    const storage = createSessionStorage();
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    const sender = { tab: { id: 10 } };
    const authority = await reserveAndIssueRoomAuthority(
      { roomId: "room-a", roomToken: trustedRoomToken("user-a", "room-a", "host") },
      sender,
      { sessionStorage: storage, getStoredSession: async () => sessionFor("user-a") },
    );

    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: authority as PrivilegedOverlayContext,
        },
        sender,
        { sessionStorage: storage, endRoom, getCurrentSession: async () => sessionFor("user-b") },
      ),
    ).resolves.toEqual({ ok: false, error: "Privileged overlay account changed" });

    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: authority as PrivilegedOverlayContext,
        },
        sender,
        { sessionStorage: storage, endRoom, getCurrentSession: async () => sessionFor("user-a") },
      ),
    ).resolves.toEqual({ ok: false, error: "Privileged overlay room authority is stale" });
    expect(endRoom).not.toHaveBeenCalled();
  });
});

function signOutContext(): PrivilegedOverlayContext {
  return { accountUserId: "user-a", roomId: null, role: null, authorityGeneration: null };
}

function roomHostContext(authorityGeneration = 3): PrivilegedOverlayContext {
  return { accountUserId: "user-a", roomId: "room-a", role: "host", authorityGeneration };
}

async function reserveAndIssueRoomAuthority(
  input: Omit<IssuedRoomAuthorityInput, "authorityGeneration">,
  sender: { tab: { id: number } },
  dependencies: PrivilegedOverlayIntentDependencies,
) {
  const authorityGeneration = await reservePrivilegedRoomAuthorityForTab(
    sender.tab.id,
    dependencies,
  );
  return issuePrivilegedRoomAuthority(
    { ...input, authorityGeneration },
    sender,
    dependencies,
  );
}

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

function trustedRoomToken(sub: string, roomId: string, role: "host" | "member"): string {
  return `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ typ: "room", sub, roomId, role }))}.signature`;
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}
