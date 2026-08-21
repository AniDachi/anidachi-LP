import { describe, expect, it, vi } from "vitest";
import { ExtensionAuthTemporarilyUnavailableError, isAuthMessage } from "../src/auth-client";
import {
  createAuthSessionStorageAuthority,
  type ExtensionAuthTokens,
} from "../src/auth-tokens";
import { isRoomHttpMessage } from "../src/room-client";
import {
  handlePrivilegedOverlayIntentMessage,
  isPrivilegedOverlayIntentMessage,
  issuePrivilegedRoomAuthority,
  removePrivilegedRoomAuthorityStateForTab,
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

  it.each([
    "end-room",
    "quota-end-room",
  ] as const)("restores %s authority after temporary session resolution failure so a legitimate retry can finish", async (action) => {
    const storage = createSessionStorage();
    const sender = { tab: { id: action === "end-room" ? 17 : 18 } };
    const session = sessionFor("user-a");
    const endRoom = vi.fn(async () => ({
      endedAt: "2026-08-21T00:00:00.000Z",
    }));
    const getCurrentSession = vi
      .fn()
      .mockRejectedValueOnce(new ExtensionAuthTemporarilyUnavailableError(session))
      .mockResolvedValueOnce(session);
    const authority = await reserveAndIssueRoomAuthority(
      {
        roomId: "room-a",
        roomToken: trustedRoomToken("user-a", "room-a", "host"),
      },
      sender,
      { sessionStorage: storage, getStoredSession: async () => session },
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
      claimOwnerId: `same-worker-${action}`,
    };

    await expect(
      handlePrivilegedOverlayIntentMessage(message, sender, dependencies),
    ).rejects.toBeInstanceOf(ExtensionAuthTemporarilyUnavailableError);
    expect(endRoom).not.toHaveBeenCalled();

    await expect(
      handlePrivilegedOverlayIntentMessage(message, sender, dependencies),
    ).resolves.toEqual({ ok: true, endedAt: "2026-08-21T00:00:00.000Z" });
    expect(endRoom).toHaveBeenCalledOnce();
  });

  it("lets a new worker instance reclaim one in-flight idempotent room end while the old owner stays rejected", async () => {
    const storage = createSessionStorage();
    const sender = { tab: { id: 19 } };
    const oldSession = deferred<ReturnType<typeof sessionFor> | null>();
    const oldSessionStarted = deferred<void>();
    const endRoom = vi.fn(async () => ({
      endedAt: "2026-08-21T00:00:00.000Z",
    }));
    const authority = await reserveAndIssueRoomAuthority(
      {
        roomId: "room-a",
        roomToken: trustedRoomToken("user-a", "room-a", "host"),
      },
      sender,
      {
        sessionStorage: storage,
        getStoredSession: async () => sessionFor("user-a"),
      },
    );
    const message = {
      type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" as const,
      command: "invoke" as const,
      action: "end-room" as const,
      context: authority as PrivilegedOverlayContext,
    };

    const oldInvoke = handlePrivilegedOverlayIntentMessage(message, sender, {
      sessionStorage: storage,
      endRoom,
      claimOwnerId: "worker-before-restart",
      getCurrentSession: () => {
        oldSessionStarted.resolve();
        return oldSession.promise;
      },
    });
    await oldSessionStarted.promise;

    const reclaimed = handlePrivilegedOverlayIntentMessage(message, sender, {
      sessionStorage: storage,
      endRoom,
      claimOwnerId: "worker-after-restart",
      getCurrentSession: async () => sessionFor("user-a"),
    });
    await expect(reclaimed).resolves.toEqual({
      ok: true,
      endedAt: "2026-08-21T00:00:00.000Z",
    });

    oldSession.resolve(sessionFor("user-a"));
    await expect(oldInvoke).resolves.toEqual({
      ok: false,
      error: "Privileged overlay room authority is stale",
    });
    expect(endRoom).toHaveBeenCalledOnce();
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

  it("does not restore a temporarily unavailable claim after a newer room reservation supersedes it", async () => {
    const storage = createSessionStorage();
    const sender = { tab: { id: 20 } };
    const sessionResult = deferred<ReturnType<typeof sessionFor> | null>();
    const sessionStarted = deferred<void>();
    const endRoom = vi.fn(async () => ({
      endedAt: "2026-08-21T00:00:00.000Z",
    }));
    const authority = await reserveAndIssueRoomAuthority(
      {
        roomId: "room-a",
        roomToken: trustedRoomToken("user-a", "room-a", "host"),
      },
      sender,
      {
        sessionStorage: storage,
        getStoredSession: async () => sessionFor("user-a"),
      },
    );
    const message = {
      type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" as const,
      command: "invoke" as const,
      action: "end-room" as const,
      context: authority as PrivilegedOverlayContext,
    };
    const invoke = handlePrivilegedOverlayIntentMessage(message, sender, {
      sessionStorage: storage,
      endRoom,
      claimOwnerId: "worker-a",
      getCurrentSession: () => {
        sessionStarted.resolve();
        return sessionResult.promise;
      },
    });
    await sessionStarted.promise;
    await reservePrivilegedRoomAuthorityForTab(sender.tab.id, {
      sessionStorage: storage,
    });
    sessionResult.reject(new ExtensionAuthTemporarilyUnavailableError(sessionFor("user-a")));

    await expect(invoke).rejects.toBeInstanceOf(ExtensionAuthTemporarilyUnavailableError);
    await expect(
      handlePrivilegedOverlayIntentMessage(message, sender, {
        sessionStorage: storage,
        endRoom,
        claimOwnerId: "worker-a",
        getCurrentSession: async () => sessionFor("user-a"),
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Privileged overlay room authority is stale",
    });
    expect(endRoom).not.toHaveBeenCalled();
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

  it("binds sign-out to the exact validated refresh family across a paused account switch", async () => {
    const sender = { tab: { id: 21 } };
    const validatedSession = deferred<ReturnType<typeof sessionFor> | null>();
    const validationStarted = deferred<void>();
    const accountA = sessionFor("user-a");
    const accountB = sessionFor("user-b");
    let currentSession: ExtensionAuthTokens | null = accountA;
    const websiteLogout = vi.fn(async () => undefined);
    const signOut = vi.fn(async (expectedSession: ExtensionAuthTokens) => {
      if (
        !currentSession ||
        expectedSession.user.id !== currentSession.user.id ||
        expectedSession.refreshToken !== currentSession.refreshToken
      ) {
        return false;
      }
      await websiteLogout();
      currentSession = null;
      return true;
    });

    const invoke = handlePrivilegedOverlayIntentMessage(
      {
        type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
        command: "invoke",
        action: "sign-out",
        context: signOutContext("user-a"),
      },
      sender,
      {
        sessionStorage: createSessionStorage(),
        getStoredSession: () => {
          validationStarted.resolve();
          return validatedSession.promise;
        },
        signOut,
      },
    );
    await validationStarted.promise;
    currentSession = accountB;
    validatedSession.resolve(accountA);

    await expect(invoke).resolves.toEqual({
      ok: false,
      error: "Privileged overlay account changed",
    });
    expect(signOut).toHaveBeenCalledWith(accountA, expect.any(Function));
    expect(websiteLogout).not.toHaveBeenCalled();
    expect(currentSession).toBe(accountB);
  });

  it("authorizes sign-out from the stored exact family without live refresh or profile lookup", async () => {
    const account = sessionFor("user-a");
    const signOut = vi.fn(async () => true);
    const getCurrentSession = vi.fn(async () => {
      throw new Error("offline live auth must not run");
    });

    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "sign-out",
          context: signOutContext("user-a"),
        },
        { tab: { id: 28 } },
        {
          sessionStorage: createSessionStorage(),
          getStoredSession: async () => account,
          getCurrentSession,
          signOut,
        },
      ),
    ).resolves.toEqual({ ok: true });
    expect(getCurrentSession).not.toHaveBeenCalled();
    expect(signOut).toHaveBeenCalledWith(account, expect.any(Function));
  });

  it.each(["end-room", "quota-end-room"] as const)(
    "invalidates matched account A authority before queued account B can issue authority for %s",
    async (action) => {
      const storage = createSessionStorage();
      const sender = { tab: { id: action === "end-room" ? 25 : 26 } };
      const accountA = sessionFor("user-a");
      const accountB = sessionFor("user-b");
      let currentSession: ExtensionAuthTokens | null = accountA;
      const authAdapter = {
        get: async () => currentSession,
        set: async (tokens: ExtensionAuthTokens) => {
          currentSession = tokens;
        },
        remove: async () => {
          currentSession = null;
        },
      };
      const authAuthority = createAuthSessionStorageAuthority(authAdapter);
      const signOutSideEffectsStarted = deferred<void>();
      const releaseSignOutSideEffects = deferred<void>();
      const accountBAuthorityIssued = deferred<PrivilegedOverlayContext | null>();
      let replacementInstall: Promise<void> | null = null;
      let matchedCallbackWasProvided = false;
      const accountAAuthority = await reserveAndIssueRoomAuthority(
        {
          roomId: "room-a",
          roomToken: trustedRoomToken("user-a", "room-a", "host"),
        },
        sender,
        { sessionStorage: storage, getStoredSession: authAdapter.get },
      );
      expect(accountAAuthority).toEqual(roomHostContext(1));

      const signOut = async (
        expectedSession: ExtensionAuthTokens,
        onMatchedSession?: (matchedSession: ExtensionAuthTokens) => Promise<void>,
      ) => {
        matchedCallbackWasProvided = typeof onMatchedSession === "function";
        const result = await authAuthority.clearIfCurrentAfter(
          expectedSession,
          async (matchedSession) => {
            await onMatchedSession?.(matchedSession);
            signOutSideEffectsStarted.resolve();
            await releaseSignOutSideEffects.promise;
          },
        );
        if (!replacementInstall) {
          throw new Error("Replacement account was not queued");
        }
        await replacementInstall;
        const authorityGeneration = await reservePrivilegedRoomAuthorityForTab(
          sender.tab.id,
          { sessionStorage: storage },
        );
        accountBAuthorityIssued.resolve(
          await issuePrivilegedRoomAuthority(
            {
              roomId: "room-b",
              roomToken: trustedRoomToken("user-b", "room-b", "host"),
              authorityGeneration,
            },
            sender,
            { sessionStorage: storage, getStoredSession: authAdapter.get },
          ),
        );
        return result.committed;
      };

      const signOutInvoke = handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "sign-out",
          context: signOutContext("user-a"),
        },
        sender,
        {
          sessionStorage: storage,
          getStoredSession: authAdapter.get,
          signOut,
        },
      );
      await signOutSideEffectsStarted.promise;
      replacementInstall = authAuthority.replace(accountB);
      await Promise.resolve();
      expect(currentSession).toBe(accountA);
      releaseSignOutSideEffects.resolve();

      await expect(signOutInvoke).resolves.toEqual({ ok: true });
      const accountBAuthority = await accountBAuthorityIssued.promise;
      expect(matchedCallbackWasProvided).toBe(true);
      expect(currentSession).toBe(accountB);
      expect(accountBAuthority).toEqual({
        accountUserId: "user-b",
        roomId: "room-b",
        role: "host",
        authorityGeneration: 3,
      });
      if (!accountBAuthority) {
        throw new Error("Account B authority was not issued");
      }

      const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
      await expect(
        handlePrivilegedOverlayIntentMessage(
          {
            type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
            command: "invoke",
            action,
            context: accountBAuthority,
          },
          sender,
          {
            sessionStorage: storage,
            endRoom,
            getCurrentSession: authAdapter.get,
          },
        ),
      ).resolves.toEqual({ ok: true, endedAt: "2026-08-21T00:00:00.000Z" });
      expect(endRoom).toHaveBeenCalledWith("room-b", "access-token-user-b");
    },
  );

  it("does not run account A's matched-session callback or clear account B authority when A is stale", async () => {
    const storage = createSessionStorage();
    const sender = { tab: { id: 27 } };
    const accountA = sessionFor("user-a");
    const accountB = sessionFor("user-b");
    let currentSession: ExtensionAuthTokens | null = accountB;
    const authAdapter = {
      get: async () => currentSession,
      set: async (tokens: ExtensionAuthTokens) => {
        currentSession = tokens;
      },
      remove: async () => {
        currentSession = null;
      },
    };
    const authAuthority = createAuthSessionStorageAuthority(authAdapter);
    const accountBAuthority = await reserveAndIssueRoomAuthority(
      {
        roomId: "room-b",
        roomToken: trustedRoomToken("user-b", "room-b", "host"),
      },
      sender,
      { sessionStorage: storage, getStoredSession: authAdapter.get },
    );
    let matchedCallbackWasProvided = false;
    let matchedCallbackCalls = 0;
    const signOut = async (
      expectedSession: ExtensionAuthTokens,
      onMatchedSession?: (matchedSession: ExtensionAuthTokens) => Promise<void>,
    ) => {
      matchedCallbackWasProvided = typeof onMatchedSession === "function";
      const result = await authAuthority.clearIfCurrentAfter(
        expectedSession,
        async (matchedSession) => {
          matchedCallbackCalls += 1;
          await onMatchedSession?.(matchedSession);
        },
      );
      return result.committed;
    };

    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "sign-out",
          context: signOutContext("user-a"),
        },
        sender,
        {
          sessionStorage: storage,
          getStoredSession: async () => accountA,
          signOut,
        },
      ),
    ).resolves.toEqual({ ok: false, error: "Privileged overlay account changed" });
    expect(matchedCallbackWasProvided).toBe(true);
    expect(matchedCallbackCalls).toBe(0);
    expect(currentSession).toBe(accountB);

    const endRoom = vi.fn(async () => ({ endedAt: null }));
    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: accountBAuthority as PrivilegedOverlayContext,
        },
        sender,
        {
          sessionStorage: storage,
          endRoom,
          getCurrentSession: authAdapter.get,
        },
      ),
    ).resolves.toEqual({ ok: true, endedAt: null });
    expect(endRoom).toHaveBeenCalledWith("room-b", "access-token-user-b");
  });

  it("signs out the exact validated session and clears the tab room authority", async () => {
    const storage = createSessionStorage();
    const sender = { tab: { id: 22 } };
    const account = sessionFor("user-a");
    const signOut = vi.fn(
      async (
        _expectedSession: ExtensionAuthTokens,
        onMatchedSession?: (matchedSession: ExtensionAuthTokens) => Promise<void>,
      ) => {
        await onMatchedSession?.(account);
        return true;
      },
    );
    const authority = await reserveAndIssueRoomAuthority(
      {
        roomId: "room-a",
        roomToken: trustedRoomToken("user-a", "room-a", "host"),
      },
      sender,
      { sessionStorage: storage, getStoredSession: async () => account },
    );

    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "sign-out",
          context: signOutContext(),
        },
        sender,
        {
          sessionStorage: storage,
          getStoredSession: async () => account,
          signOut,
        },
      ),
    ).resolves.toEqual({ ok: true });
    expect(signOut).toHaveBeenCalledWith(account, expect.any(Function));

    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: authority as PrivilegedOverlayContext,
        },
        sender,
        {
          sessionStorage: storage,
          endRoom: vi.fn(async () => ({ endedAt: null })),
          getCurrentSession: async () => account,
        },
      ),
    ).resolves.toEqual({
      ok: false,
      error: "Privileged overlay room authority is stale",
    });
  });

  it("migrates the version-one authority state before claiming it", async () => {
    const storage = createSessionStorage();
    const sender = { tab: { id: 23 } };
    const authority = roomHostContext(7);
    const key = "anidachi:privileged-room-authority:v1:tab:23";
    await storage.set({
      [key]: {
        version: 1,
        lastAuthorityGeneration: 7,
        currentAuthority: authority,
      },
    });

    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context: authority,
        },
        sender,
        {
          sessionStorage: storage,
          claimOwnerId: "worker-after-upgrade",
          endRoom: async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }),
          getCurrentSession: async () => sessionFor("user-a"),
        },
      ),
    ).resolves.toEqual({ ok: true, endedAt: "2026-08-21T00:00:00.000Z" });
    await expect(storage.get(key)).resolves.toEqual({
      [key]: {
        version: 2,
        lastAuthorityGeneration: 7,
        currentAuthority: null,
        inFlightClaim: null,
      },
    });
  });

  it("does not let a removed tab claim mutate a reused tab id with the same room context", async () => {
    const storage = createSessionStorage();
    const sender = { tab: { id: 24 } };
    const oldSession = deferred<ReturnType<typeof sessionFor> | null>();
    const oldSessionStarted = deferred<void>();
    const endResult = deferred<{ endedAt: string | null }>();
    const endRoom = vi.fn(() => endResult.promise);
    const oldAuthority = await reserveAndIssueRoomAuthority(
      {
        roomId: "room-a",
        roomToken: trustedRoomToken("user-a", "room-a", "host"),
      },
      sender,
      {
        sessionStorage: storage,
        getStoredSession: async () => sessionFor("user-a"),
      },
    );
    const message = {
      type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" as const,
      command: "invoke" as const,
      action: "end-room" as const,
      context: oldAuthority as PrivilegedOverlayContext,
    };
    const oldInvoke = handlePrivilegedOverlayIntentMessage(message, sender, {
      sessionStorage: storage,
      claimOwnerId: "same-worker",
      endRoom,
      getCurrentSession: () => {
        oldSessionStarted.resolve();
        return oldSession.promise;
      },
    });
    await oldSessionStarted.promise;

    await removePrivilegedRoomAuthorityStateForTab(sender.tab.id, {
      sessionStorage: storage,
    });
    const reusedAuthority = await reserveAndIssueRoomAuthority(
      {
        roomId: "room-a",
        roomToken: trustedRoomToken("user-a", "room-a", "host"),
      },
      sender,
      {
        sessionStorage: storage,
        getStoredSession: async () => sessionFor("user-a"),
      },
    );
    const reusedInvoke = handlePrivilegedOverlayIntentMessage(
      { ...message, context: reusedAuthority as PrivilegedOverlayContext },
      sender,
      {
        sessionStorage: storage,
        claimOwnerId: "same-worker",
        endRoom,
        getCurrentSession: async () => sessionFor("user-a"),
      },
    );
    await vi.waitFor(() => expect(endRoom).toHaveBeenCalledOnce());

    oldSession.resolve(sessionFor("user-a"));
    await Promise.resolve();
    await Promise.resolve();
    expect(endRoom).toHaveBeenCalledOnce();

    endResult.resolve({ endedAt: "2026-08-21T00:00:00.000Z" });
    await expect(reusedInvoke).resolves.toEqual({
      ok: true,
      endedAt: "2026-08-21T00:00:00.000Z",
    });
    await expect(oldInvoke).resolves.toEqual({
      ok: false,
      error: "Privileged overlay room authority is stale",
    });
  });
});

function signOutContext(accountUserId = "user-a"): PrivilegedOverlayContext {
  return { accountUserId, roomId: null, role: null, authorityGeneration: null };
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
