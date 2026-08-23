import type { FriendListItem, RoomInvite } from "@anidachi/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { mountOverlay, type OverlayRenderer } from "../entrypoints/content";
import * as overlayApp from "../src/overlay-app";
import { AUTH_TOKENS_KEY } from "../src/auth-tokens";
import type { PrivilegedOverlayContext } from "../src/privileged-overlay-intent";
import { RoomClient } from "../src/room-client";
import { listInviteTargets, listRoomInvites } from "../src/social-client";
import type { VideoAdapter } from "../src/source-adapters/core/types";

const extensionStorage = vi.hoisted(() => {
  const values = new Map<string, unknown>();
  const listeners = new Map<string, Set<(value: unknown, oldValue: unknown) => void>>();
  const storage = {
    async getItem<T>(key: string): Promise<T | null> {
      return (values.get(key) as T | undefined) ?? null;
    },
    async setItem<T>(key: string, value: T): Promise<void> {
      const oldValue = values.get(key);
      values.set(key, value);
      for (const listener of listeners.get(key) ?? []) listener(value, oldValue);
    },
    async removeItem(key: string): Promise<void> {
      const oldValue = values.get(key);
      values.delete(key);
      for (const listener of listeners.get(key) ?? []) listener(null, oldValue);
    },
    watch<T>(key: string, listener: (value: T | null, oldValue: T | null) => void) {
      const scoped = listeners.get(key) ?? new Set();
      scoped.add(listener as (value: unknown, oldValue: unknown) => void);
      listeners.set(key, scoped);
      return () => scoped.delete(listener as (value: unknown, oldValue: unknown) => void);
    },
  };
  return { storage, values };
});

vi.mock("wxt/utils/storage", () => ({ storage: extensionStorage.storage }));

vi.mock("../src/social-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/social-client")>()),
  listInviteTargets: vi.fn(),
  listRoomInvites: vi.fn(),
}));

describe("privileged overlay wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    extensionStorage.values.clear();
    vi.mocked(listInviteTargets).mockReset();
    vi.mocked(listRoomInvites).mockReset();
  });

  it("keeps the overlay tree closed to the hosting page", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const container = document.createElement("div");
    const video = document.createElement("video");
    container.append(video);
    document.body.append(container);
    const renderer: OverlayRenderer = { render: vi.fn(), unmount: vi.fn() };
    const mounted = mountOverlay(createAdapter(container, video), { renderer });

    const host = document.querySelector("anidachi-overlay-root");
    expect(host?.shadowRoot).toBeNull();

    mounted.dispose();
  });

  it("keeps both OverlayApp teardown paths untouched after synthetic privileged controls", async () => {
    const teardown = vi.fn();
    const context: PrivilegedOverlayContext = {
      accountUserId: "user-a",
      roomId: "room-a",
      role: "host",
      authorityGeneration: 3,
    };

    for (const action of ["sign-out", "end-room"] as const) {
      await expect(
        overlayApp.runOverlayPrivilegedAction(
          { nativeEvent: { isTrusted: false } },
          action,
          action === "sign-out" ? { ...context, roomId: null, role: null, authorityGeneration: null } : context,
          teardown,
        ),
      ).rejects.toThrow("Privileged action requires a trusted user gesture");
    }

    expect(teardown).not.toHaveBeenCalled();
  });

  it("runs an OverlayApp teardown once after a trusted privileged action succeeds", async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("chrome", { runtime: { sendMessage } });
    const teardown = vi.fn();

    await overlayApp.runOverlayPrivilegedAction(
      { nativeEvent: { isTrusted: true } },
      "end-room",
      {
        accountUserId: "user-a",
        roomId: "room-a",
        role: "host",
        authorityGeneration: 3,
      },
      teardown,
    );

    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it("does not suppress silent auth recovery after a trusted sign-out request is rejected", async () => {
    let currentSession: ReturnType<typeof sessionFor> | null = sessionFor("user-a");
    const sendMessage = vi.fn(async (message: { type?: string; command?: string }) => {
      if (message.type === "ANIDACHI_AUTH" && message.command === "sign-in-silent") {
        currentSession = sessionFor("user-a");
        return { ok: true, tokens: currentSession };
      }
      if (message.type === "ANIDACHI_AUTH") {
        return { ok: true, tokens: currentSession };
      }
      if (message.type === "ANIDACHI_PRIVILEGED_OVERLAY_INTENT") {
        return { ok: false, error: "Privileged sign-out rejected" };
      }
      throw new Error(`Unexpected runtime message ${message.type}:${message.command}`);
    });
    installOverlayRuntime(sendMessage);
    const view = await renderOverlay();

    await click(button(view.container, "Open Anidachi controls"));
    await trustedClick(button(view.container, "Sign out"));
    expect(button(view.container, "Sign out")).toBeInstanceOf(HTMLButtonElement);

    currentSession = null;
    await extensionStorage.storage.removeItem(AUTH_TOKENS_KEY);
    await flushMountedWork();
    await click(button(view.container, "Close Anidachi controls"));
    await click(button(view.container, "Open Anidachi controls"));
    await flushMountedWork();

    expect(
      sendMessage.mock.calls.filter(
        ([message]) =>
          (message as { type?: string; command?: string }).type === "ANIDACHI_AUTH" &&
          (message as { command?: string }).command === "sign-in-silent",
      ),
    ).toHaveLength(1);
    expect(button(view.container, "Sign out")).toBeInstanceOf(HTMLButtonElement);
    await unmount(view.root);
  });

  it.each(["sign-out", "end-room"] as const)(
    "keeps the mounted room reconnect timer after a trusted %s request is rejected",
    async (action) => {
      const sendMessage = vi.fn(async (message: { type?: string; command?: string }) => {
        if (message.type === "ANIDACHI_AUTH") {
          return { ok: true, tokens: sessionFor("user-a") };
        }
        if (message.type === "ANIDACHI_ROOM_HTTP" && message.command === "create-room") {
          return {
            ok: true,
            room: {
              roomId: "room-a",
              roomToken: "room-token-a",
              shareableLink: "http://localhost:3003/room/room-a",
              privilegedRoomAuthority: roomAuthority(),
              roomSession: confirmedRoomSession(),
            },
          };
        }
        if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
          const response = roomSessionStorageResponse(message.command);
          if (response) return response;
        }
        if (message.type === "ANIDACHI_PRIVILEGED_OVERLAY_INTENT") {
          return { ok: false, error: `Privileged ${action} rejected` };
        }
        throw new Error(`Unexpected runtime message ${message.type}:${message.command}`);
      });
      installOverlayRuntime(sendMessage);
      let roomConnectionOptions: Parameters<RoomClient["connect"]>[0] | null = null;
      vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
        roomConnectionOptions = options;
        options.onStatus("connected");
        options.onEvent({
          type: "ROOM_SNAPSHOT",
          roomId: "room-a",
          roomGeneration: 1,
          sourceGeneration: 1,
          serverSeq: 1,
          participants: [hostParticipant()],
        });
      });
      const setTimeoutSpy = vi.spyOn(window, "setTimeout");
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
      const close = vi.spyOn(RoomClient.prototype, "close");
      const view = await renderOverlay();

      await click(button(view.container, "Open Anidachi controls"));
      await click(button(view.container, "Create room"));
      close.mockClear();
      await act(async () => {
        roomConnectionOptions?.onStatus("closed");
        await Promise.resolve();
      });
      const reconnectCallIndex = setTimeoutSpy.mock.calls.findIndex(
        ([, delay]) => delay === 900,
      );
      expect(reconnectCallIndex).toBeGreaterThanOrEqual(0);
      const reconnectTimerId = setTimeoutSpy.mock.results[reconnectCallIndex]?.value;
      const actionButton =
        action === "sign-out"
          ? button(view.container, "Sign out")
          : primaryRoomAction(view.container);

      await trustedClick(actionButton);

      expect(privilegedInvokes(sendMessage)).toHaveLength(1);
      expect(close).not.toHaveBeenCalled();
      expect(clearTimeoutSpy).not.toHaveBeenCalledWith(reconnectTimerId);
      expect(button(view.container, "Sign out")).toBeInstanceOf(HTMLButtonElement);
      expect(primaryRoomAction(view.container)).toBeInstanceOf(HTMLButtonElement);
      await unmount(view.root);
    },
  );

  it("keeps the mounted OverlayApp signed in after a synthetic sign-out control click", async () => {
    const sendMessage = vi.fn(async (message: { type?: string; command?: string }) => {
      if (message.type === "ANIDACHI_AUTH") return { ok: true, tokens: sessionFor("user-a") };
      throw new Error(`Unexpected runtime message ${message.type}:${message.command}`);
    });
    installOverlayRuntime(sendMessage);
    const view = await renderOverlay();
    const close = vi.spyOn(RoomClient.prototype, "close");

    await click(button(view.container, "Open Anidachi controls"));
    const signOut = button(view.container, "Sign out");
    await click(signOut);

    expect(privilegedInvokes(sendMessage)).toHaveLength(0);
    expect(close).not.toHaveBeenCalled();
    expect(button(view.container, "Sign out")).toBe(signOut);
    await unmount(view.root);
  });

  it("keeps the mounted OverlayApp host room intact after a synthetic end-room control click", async () => {
    const sendMessage = vi.fn(async (message: { type?: string; command?: string }) => {
      if (message.type === "ANIDACHI_AUTH") return { ok: true, tokens: sessionFor("user-a") };
      if (message.type === "ANIDACHI_ROOM_HTTP" && message.command === "create-room") {
        return {
          ok: true,
          room: {
            roomId: "room-a",
            roomToken: "room-token-a",
            shareableLink: "http://localhost:3003/room/room-a",
            privilegedRoomAuthority: roomAuthority(),
            roomSession: confirmedRoomSession(),
          },
        };
      }
      if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
        const response = roomSessionStorageResponse(message.command);
        if (response) return response;
      }
      if (message.type === "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" && message.command === "invoke") {
        return { ok: true, endedAt: "2026-08-21T00:00:00.000Z" };
      }
      throw new Error(`Unexpected runtime message ${message.type}:${message.command}`);
    });
    installOverlayRuntime(sendMessage);
    const view = await renderOverlay();

    const close = vi.spyOn(RoomClient.prototype, "close");
    vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
      options.onStatus("connected");
      options.onEvent({
        type: "ROOM_SNAPSHOT",
        roomId: "room-a",
        roomGeneration: 1,
        sourceGeneration: 1,
        serverSeq: 1,
        participants: [hostParticipant()],
      });
    });

    await click(button(view.container, "Open Anidachi controls"));
    const createRoom = button(view.container, "Create room");
    await click(createRoom);
    const endRoom = primaryRoomAction(view.container);
    close.mockClear();
    await click(endRoom);

    expect(privilegedInvokes(sendMessage)).toHaveLength(0);
    expect(close).not.toHaveBeenCalled();
    expect(primaryRoomAction(view.container)).toBe(endRoom);

    await trustedClick(endRoom);

    expect(privilegedInvokes(sendMessage)).toHaveLength(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(primaryRoomAction(view.container)).toBe(endRoom);
    expect(primaryRoomAction(view.container).classList).not.toContain("room-exit");
    await unmount(view.root);
  });

  it("refreshes an open invite panel when an invited participant joins", async () => {
    const sendMessage = vi.fn(async (message: { type?: string; command?: string }) => {
      if (message.type === "ANIDACHI_AUTH") return { ok: true, tokens: sessionFor("user-a") };
      if (message.type === "ANIDACHI_ROOM_HTTP" && message.command === "create-room") {
        return {
          ok: true,
          room: {
            roomId: "room-a",
            roomToken: "room-token-a",
            shareableLink: "http://localhost:3003/room/room-a",
            privilegedRoomAuthority: roomAuthority(),
            roomSession: confirmedRoomSession(),
          },
        };
      }
      if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
        const response = roomSessionStorageResponse(message.command);
        if (response) return response;
      }
      throw new Error(`Unexpected runtime message ${message.type}:${message.command}`);
    });
    installOverlayRuntime(sendMessage);
    vi.mocked(listInviteTargets).mockResolvedValue({ friends: [inviteFriend()], groups: [] });
    vi.mocked(listRoomInvites)
      .mockResolvedValueOnce(invitesResponse("pending"))
      .mockResolvedValueOnce(invitesResponse("accepted"));

    let roomConnectionOptions: Parameters<RoomClient["connect"]>[0] | null = null;
    vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
      roomConnectionOptions = options;
      options.onStatus("connected");
      options.onEvent({
        type: "ROOM_SNAPSHOT",
        roomId: "room-a",
        roomGeneration: 1,
        sourceGeneration: 1,
        serverSeq: 1,
        participants: [hostParticipant()],
      });
    });
    const view = await renderOverlay();

    await click(button(view.container, "Open Anidachi controls"));
    await click(button(view.container, "Create room"));
    await click(button(view.container, "Invite friends and groups"));
    await flushMountedWork();

    expect(button(view.container, "Pending")).toBeInstanceOf(HTMLButtonElement);
    expect(listRoomInvites).toHaveBeenCalledTimes(1);

    await act(async () => {
      roomConnectionOptions?.onEvent({
        type: "PARTICIPANT_JOINED",
        participant: guestParticipant(),
      });
      await Promise.resolve();
    });
    await flushMountedWork();

    expect(listRoomInvites).toHaveBeenCalledTimes(2);
    expect(button(view.container, "Accepted")).toBeInstanceOf(HTMLButtonElement);
    await unmount(view.root);
  });

  it("shows one active-room conflict and opens the authoritative room", async () => {
    const sendMessage = vi.fn(async (message: {
      type?: string;
      command?: string;
      roomId?: string | null;
    }) => {
      if (message.type === "ANIDACHI_AUTH") return { ok: true, tokens: sessionFor("user-a") };
      if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
        if (message.command === "load") return { ok: true, record: null };
        if (message.command === "prepare") {
          return {
            ok: true,
            record: null,
            prepared: {
              ...preparedRoomSession(),
              roomId: message.roomId ?? null,
            },
          };
        }
        if (message.command === "discard-prepared") {
          return { ok: true, record: null, prepared: null };
        }
      }
      if (message.type === "ANIDACHI_ROOM_HTTP" && message.command === "create-room") {
        return {
          ok: false,
          error: "An active room already exists",
          code: "ACTIVE_ROOM_CONFLICT",
          status: 409,
          activeRoom: {
            roomId: "room-active",
            role: "member",
            provider: "youtube",
            title: "Active video",
          },
        };
      }
      if (
        message.type === "ANIDACHI_ROOM_HTTP" &&
        message.command === "connect-room" &&
        message.roomId === "room-active"
      ) {
        return {
          ok: true,
          connection: {
            roomToken: "room-token-active",
            roomSession: {
              ...confirmedRoomSession(),
              roomId: "room-active",
            },
          },
        };
      }
      throw new Error(`Unexpected runtime message ${message.type}:${message.command}`);
    });
    installOverlayRuntime(sendMessage);
    const connect = vi.spyOn(RoomClient.prototype, "connect").mockImplementation((options) => {
      options.onStatus("connected");
    });
    const view = await renderOverlay();

    await click(button(view.container, "Open Anidachi controls"));
    await click(button(view.container, "Create room"));
    await flushMountedWork();

    expect(view.container.textContent).toContain("You already have an active watch room.");
    await click(button(view.container, "Open active room"));
    await flushMountedWork();

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-active",
        participantSessionId: "participant-session-a",
      }),
    );
    expect(view.container.textContent).not.toContain("You already have an active watch room.");
    await unmount(view.root);
  });

  it("does not take over an active room from a different provider tab", async () => {
    const sendMessage = vi.fn(async (message: { type?: string; command?: string }) => {
      if (message.type === "ANIDACHI_AUTH") {
        return { ok: true, tokens: sessionFor("user-a") };
      }
      if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE") {
        if (message.command === "load") return { ok: true, record: null };
        if (message.command === "prepare") {
          return {
            ok: true,
            record: null,
            prepared: preparedRoomSession(),
          };
        }
        if (message.command === "discard-prepared") {
          return { ok: true, record: null, prepared: null };
        }
      }
      if (message.type === "ANIDACHI_ROOM_HTTP" && message.command === "create-room") {
        return {
          ok: false,
          error: "An active room already exists",
          code: "ACTIVE_ROOM_CONFLICT",
          status: 409,
          activeRoom: {
            roomId: "room-active",
            role: "member",
            provider: "crunchyroll",
            title: "Active episode",
          },
        };
      }
      throw new Error(`Unexpected runtime message ${message.type}:${message.command}`);
    });
    installOverlayRuntime(sendMessage);
    const connect = vi.spyOn(RoomClient.prototype, "connect");
    const view = await renderOverlay();

    await click(button(view.container, "Open Anidachi controls"));
    await click(button(view.container, "Create room"));
    await flushMountedWork();

    expect(view.container.textContent).toContain(
      "You already have an active watch room on Crunchyroll. Open that tab to continue.",
    );
    expect(view.container.textContent).not.toContain("Open active room");
    expect(connect).not.toHaveBeenCalled();
    await unmount(view.root);
  });
});

function createAdapter(container: HTMLElement, video: HTMLVideoElement): VideoAdapter {
  return {
    id: "youtube",
    provider: "youtube",
    video,
    container,
    getFingerprint: () => "youtube|test",
    getTitle: () => "Test video",
    getOverlayBinding: () => ({ mountTarget: container, fillMountTarget: true, useNativePlayerDoubleClick: true }),
    getOverlayGeometry: () => ({
      controlsVisible: true,
      viewport: { widthPx: 1280, heightPx: 720 },
      safeInsets: { topPx: 0, rightPx: 0, bottomPx: 0, leftPx: 0 },
      launcher: { topPx: 10, rightPx: 10 },
      panel: { topPx: 48, rightPx: 10 },
    }),
    subscribeOverlayGeometry: () => () => undefined,
    getCurrentTime: () => 0,
    getDuration: () => 0,
    getPlaybackRate: () => 1,
    getState: () => ({ videoFingerprint: "youtube|test", sourceUrl: location.href, playing: false, hostTime: 0, updatedAt: 0, playbackRate: 1 }),
    getPlaybackSnapshot: () => ({ currentTime: 0, duration: 0, paused: true, playbackRate: 1 }),
    isPaused: () => true,
    isFullscreen: () => false,
    pause: () => undefined,
    play: async () => undefined,
    seek: () => undefined,
    setPlaybackRate: () => undefined,
    subscribe: () => () => undefined,
    duckVolume: () => () => undefined,
    enterFullscreen: async () => undefined,
    exitFullscreen: async () => undefined,
    getSourceDescriptor: () => ({ provider: "youtube", videoFingerprint: "youtube|test", sourceUrl: location.href, canonicalUrl: location.href, title: null }),
  } as unknown as VideoAdapter;
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

function roomAuthority(): PrivilegedOverlayContext {
  return {
    accountUserId: "user-a",
    roomId: "room-a",
    role: "host",
    authorityGeneration: 1,
  };
}

function preparedRoomSession() {
  return {
    version: 1 as const,
    preparationId: "preparation-room-a",
    roomId: null,
    ownerUserId: "user-a",
    participantSessionId: "participant-session-a",
  };
}

function confirmedRoomSession() {
  return {
    version: 1 as const,
    revision: 1,
    roomId: "room-a",
    ownerUserId: "user-a",
    participantSessionId: "participant-session-a",
    voiceMode: "push-to-talk" as const,
  };
}

function roomSessionStorageResponse(command: string | undefined) {
  if (command === "load") return { ok: true, record: null };
  if (command === "prepare") {
    return { ok: true, record: null, prepared: preparedRoomSession() };
  }
  if (command === "discard-prepared") {
    return { ok: true, record: null, prepared: null };
  }
  return null;
}

function hostParticipant() {
  return {
    id: "user-a",
    displayName: "User",
    role: "host" as const,
    cameraEnabled: false,
    mediaSeat: "none" as const,
    syncStatus: "unknown" as const,
    lastSeenAt: 0,
  };
}

function guestParticipant() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    displayName: "Ads Mag",
    role: "viewer" as const,
    cameraEnabled: false,
    mediaSeat: "none" as const,
    syncStatus: "unknown" as const,
    lastSeenAt: 0,
  };
}

function inviteFriend(): FriendListItem {
  return {
    friendshipId: "22222222-2222-4222-8222-222222222222",
    user: {
      userId: guestParticipant().id,
      handle: null,
      displayName: guestParticipant().displayName,
      avatarUrl: null,
    },
    status: "accepted",
    direction: "mutual",
    requestedAt: "2026-08-22T08:00:00.000Z",
    respondedAt: "2026-08-22T08:01:00.000Z",
    updatedAt: "2026-08-22T08:01:00.000Z",
  };
}

function invitesResponse(status: RoomInvite["recipients"][number]["status"]) {
  const invite: RoomInvite = {
    id: "33333333-3333-4333-8333-333333333333",
    roomId: "room-a",
    sender: {
      userId: "44444444-4444-4444-8444-444444444444",
      handle: null,
      displayName: "Host",
      avatarUrl: null,
    },
    targetKind: "direct",
    targetGroupId: null,
    message: null,
    roomTitle: "Test video",
    sourceUrl: "https://www.youtube.com/watch?v=test",
    videoFingerprint: "youtube|test",
    createdAt: "2026-08-22T08:00:00.000Z",
    expiresAt: "2026-08-22T20:00:00.000Z",
    recipients: [
      {
        user: inviteFriend().user,
        status,
        updatedAt: "2026-08-22T08:01:00.000Z",
        respondedAt: status === "pending" ? null : "2026-08-22T08:01:00.000Z",
      },
    ],
  };
  return {
    meta: { serverTime: "2026-08-22T08:01:00.000Z", schemaVersion: 1 as const },
    inbox: [],
    sent: [invite],
  };
}

async function renderOverlay(): Promise<{ container: HTMLDivElement; root: Root }> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  const container = document.createElement("div");
  const video = document.createElement("video");
  container.append(video);
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<overlayApp.OverlayApp adapter={createAdapter(container, video)} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

function installOverlayRuntime(sendMessage: ReturnType<typeof vi.fn>): void {
  vi.stubGlobal("chrome", {
    runtime: { sendMessage },
    storage: {
      onChanged: {
        addListener: () => undefined,
        removeListener: () => undefined,
      },
    },
  });
}

async function click(target: HTMLButtonElement): Promise<void> {
  await act(async () => {
    target.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function trustedClick(target: HTMLButtonElement): Promise<void> {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "isTrusted", { configurable: true, value: true });
  await act(async () => {
    target.dispatchEvent(event);
    await Promise.resolve();
    await Promise.resolve();
  });
}

function button(container: HTMLElement, name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (candidate) =>
      candidate.getAttribute("aria-label") === name || candidate.textContent?.trim() === name,
  );
  if (!(found instanceof HTMLButtonElement)) throw new Error(`Missing button ${name}`);
  return found;
}

function primaryRoomAction(container: HTMLElement): HTMLButtonElement {
  const action = container.querySelector("button.panel-primary-action");
  if (!(action instanceof HTMLButtonElement)) throw new Error("Missing primary room action");
  return action;
}

function privilegedInvokes(sendMessage: ReturnType<typeof vi.fn>) {
  return sendMessage.mock.calls.filter(
    ([message]) =>
      (message as { type?: string; command?: string }).type === "ANIDACHI_PRIVILEGED_OVERLAY_INTENT" &&
      (message as { command?: string }).command === "invoke",
  );
}

async function unmount(root: Root): Promise<void> {
  await act(async () => root.unmount());
}

async function flushMountedWork(): Promise<void> {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}
