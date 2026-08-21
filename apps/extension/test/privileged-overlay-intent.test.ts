import { describe, expect, it, vi } from "vitest";
import { isAuthMessage } from "../src/auth-client";
import { isRoomHttpMessage } from "../src/room-client";
import {
  handlePrivilegedOverlayIntentMessage,
  requestPrivilegedOverlayAction,
  syncPrivilegedOverlayContext,
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

  it("does not send a synthetic click to the privileged sign-out action", async () => {
    const sendMessage = vi.fn();

    await expect(
      requestPrivilegedOverlayAction(
        { nativeEvent: { isTrusted: false } },
        "sign-out",
        signOutContext(),
        sendMessage,
      ),
    ).resolves.toEqual({ ok: false, error: "Privileged action requires a trusted user gesture" });

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("fails forged room, role, generation, and account contexts before the server mutation", async () => {
    const contexts = new Map<number, PrivilegedOverlayContext>();
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    const dependencies = {
      contexts,
      endRoom,
      getStoredSession: async () => sessionFor("user-a"),
      getCurrentSession: async () => sessionFor("user-a"),
    };
    const trusted = roomHostContext();
    const sender = { tab: { id: 7 } };

    await expect(
      handlePrivilegedOverlayIntentMessage(
        { type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT", command: "set-context", context: trusted },
        sender,
        dependencies,
      ),
    ).resolves.toEqual({ ok: true });

    for (const context of [
      { ...trusted, accountUserId: "user-forged" },
      { ...trusted, roomId: "room-forged" },
      { ...trusted, role: "guest" as const },
      { ...trusted, roomGeneration: 99 },
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
          dependencies,
        ),
      ).resolves.toEqual(expect.objectContaining({ ok: false }));
    }
    expect(endRoom).not.toHaveBeenCalled();
  });

  it("executes one trusted host end only after matching the extension-owned context", async () => {
    const contexts = new Map<number, PrivilegedOverlayContext>();
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    const dependencies = {
      contexts,
      endRoom,
      getStoredSession: async () => sessionFor("user-a"),
      getCurrentSession: async () => sessionFor("user-a"),
    };
    const context = roomHostContext();
    const sender = { tab: { id: 8 } };
    const sendMessage = (message: Parameters<typeof handlePrivilegedOverlayIntentMessage>[0]) =>
      handlePrivilegedOverlayIntentMessage(message, sender, dependencies);

    await syncPrivilegedOverlayContext(context, sendMessage);
    await expect(
      requestPrivilegedOverlayAction(
        { nativeEvent: { isTrusted: true } },
        "end-room",
        context,
        sendMessage,
      ),
    ).resolves.toEqual({ ok: true, endedAt: "2026-08-21T00:00:00.000Z" });

    expect(endRoom).toHaveBeenCalledTimes(1);
    expect(endRoom).toHaveBeenCalledWith("room-a", "access-token-user-a");
  });

  it("rejects an otherwise exact intent after the extension account switches", async () => {
    const contexts = new Map<number, PrivilegedOverlayContext>();
    const endRoom = vi.fn(async () => ({ endedAt: "2026-08-21T00:00:00.000Z" }));
    const context = roomHostContext();
    const sender = { tab: { id: 9 } };

    await handlePrivilegedOverlayIntentMessage(
      { type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT", command: "set-context", context },
      sender,
      {
        contexts,
        endRoom,
        getStoredSession: async () => sessionFor("user-a"),
        getCurrentSession: async () => sessionFor("user-b"),
      },
    );
    await expect(
      handlePrivilegedOverlayIntentMessage(
        {
          type: "ANIDACHI_PRIVILEGED_OVERLAY_INTENT",
          command: "invoke",
          action: "end-room",
          context,
        },
        sender,
        {
          contexts,
          endRoom,
          getCurrentSession: async () => sessionFor("user-b"),
        },
      ),
    ).resolves.toEqual({ ok: false, error: "Privileged overlay account changed" });
    expect(endRoom).not.toHaveBeenCalled();
  });
});

function signOutContext(): PrivilegedOverlayContext {
  return { accountUserId: "user-a", roomId: null, role: null, roomGeneration: null };
}

function roomHostContext(): PrivilegedOverlayContext {
  return { accountUserId: "user-a", roomId: "room-a", role: "host", roomGeneration: 3 };
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
