import { describe, expect, it, vi } from "vitest";
import type { ExtensionAuthTokens } from "../src/auth-tokens";
import {
  departWebsiteRoomFromApi,
  handleRoomTabDeparture,
  type RoomDepartureRequestResult,
} from "../src/room-departure";
import type { RoomSessionRecord } from "../src/room-session-storage";

describe("closed-tab room departure", () => {
  it("derives the exact departure from background session and auth state", async () => {
    const calls: string[] = [];
    const requestDeparture = vi.fn(async (record: RoomSessionRecord, accessToken: string) => {
      calls.push(`depart:${record.roomId}:${record.participantSessionId}:${accessToken}`);
      return { kind: "ack", outcome: "room_ended" } as const;
    });
    const clearRoomSession = vi.fn(async () => {
      calls.push("clear");
      return true;
    });

    await expect(
      handleRoomTabDeparture(11, {
        loadRoomSession: async () => roomSession(),
        getStoredSession: async () => authSession(),
        refreshSession: async () => null,
        requestDeparture,
        clearRoomSession,
        timeoutMs: 100,
      }),
    ).resolves.toBe("room_ended");

    expect(requestDeparture).toHaveBeenCalledWith(
      roomSession(),
      "access-user-a",
      expect.any(AbortSignal),
    );
    expect(calls).toEqual([
      "depart:room-a:participant-session-a:access-user-a",
      "clear",
    ]);
  });

  it("refreshes only after an unauthorized departure and retries once", async () => {
    const requestDeparture = vi
      .fn<(record: RoomSessionRecord, accessToken: string) => Promise<RoomDepartureRequestResult>>()
      .mockResolvedValueOnce({ kind: "unauthorized" })
      .mockResolvedValueOnce({ kind: "ack", outcome: "departed" });
    const clearRoomSession = vi.fn(async () => true);

    await expect(
      handleRoomTabDeparture(12, {
        loadRoomSession: async () => roomSession(),
        getStoredSession: async () => authSession(),
        refreshSession: async () => ({ ...authSession(), accessToken: "fresh-access" }),
        requestDeparture,
        clearRoomSession,
        timeoutMs: 100,
      }),
    ).resolves.toBe("departed");

    expect(requestDeparture).toHaveBeenNthCalledWith(
      1,
      roomSession(),
      "access-user-a",
      expect.any(AbortSignal),
    );
    expect(requestDeparture).toHaveBeenNthCalledWith(
      2,
      roomSession(),
      "fresh-access",
      expect.any(AbortSignal),
    );
    expect(clearRoomSession).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing auth", null, "no-auth"],
    ["another account", authSession("user-b"), "account-changed"],
  ] as const)("clears the closed tab with %s without sending a request", async (_label, auth, outcome) => {
    const requestDeparture = vi.fn();
    const clearRoomSession = vi.fn(async () => true);

    await expect(
      handleRoomTabDeparture(13, {
        loadRoomSession: async () => roomSession(),
        getStoredSession: async () => auth,
        refreshSession: async () => null,
        requestDeparture,
        clearRoomSession,
        timeoutMs: 100,
      }),
    ).resolves.toBe(outcome);

    expect(requestDeparture).not.toHaveBeenCalled();
    expect(clearRoomSession).toHaveBeenCalledWith(13, roomSession());
  });

  it("bounds a stalled request and still clears the closed tab", async () => {
    const clearRoomSession = vi.fn(async () => true);

    await expect(
      handleRoomTabDeparture(14, {
        loadRoomSession: async () => roomSession(),
        getStoredSession: async () => authSession(),
        refreshSession: async () => null,
        requestDeparture: async () => new Promise<never>(() => undefined),
        clearRoomSession,
        timeoutMs: 5,
      }),
    ).resolves.toBe("timed-out");

    expect(clearRoomSession).toHaveBeenCalledWith(14, roomSession());
  });

  it("treats network failure as best effort and still clears locally", async () => {
    const clearRoomSession = vi.fn(async () => true);

    await expect(
      handleRoomTabDeparture(15, {
        loadRoomSession: async () => roomSession(),
        getStoredSession: async () => authSession(),
        refreshSession: async () => null,
        requestDeparture: async () => {
          throw new Error("offline");
        },
        clearRoomSession,
        timeoutMs: 100,
      }),
    ).resolves.toBe("failed");

    expect(clearRoomSession).toHaveBeenCalledWith(15, roomSession());
  });

  it("sends only the exact session field to the public room route", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ ok: true, outcome: "departed" }, { status: 200 }),
    );
    const controller = new AbortController();

    await expect(
      departWebsiteRoomFromApi(roomSession(), "access-user-a", controller.signal, fetcher),
    ).resolves.toEqual({ kind: "ack", outcome: "departed" });

    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(String(url)).toContain("/api/rooms/room-a/depart");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer access-user-a",
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      participantSessionId: "participant-session-a",
    });
  });
});

function roomSession(): RoomSessionRecord {
  return {
    version: 1,
    revision: 3,
    roomId: "room-a",
    ownerUserId: "user-a",
    participantSessionId: "participant-session-a",
    cameraEnabled: false,
    voiceMode: "push-to-talk",
  };
}

function authSession(userId = "user-a"): ExtensionAuthTokens {
  return {
    accessToken: `access-${userId}`,
    refreshToken: `refresh-${userId}`,
    user: {
      id: userId,
      email: `${userId}@example.com`,
      displayName: userId,
      avatarUrl: null,
      plan: "free",
    },
  };
}
