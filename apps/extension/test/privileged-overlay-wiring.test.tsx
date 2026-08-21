import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { mountOverlay, type OverlayRenderer } from "../entrypoints/content";
import * as overlayApp from "../src/overlay-app";
import type { PrivilegedOverlayContext } from "../src/privileged-overlay-intent";
import { RoomClient } from "../src/room-client";
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

describe("privileged overlay wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
    extensionStorage.values.clear();
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
          },
        };
      }
      if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE" && message.command === "load") {
        return { ok: true, record: null };
      }
      if (message.type === "ANIDACHI_ROOM_SESSION_STORAGE" && message.command === "persist") {
        return {
          ok: true,
          record: {
            version: 1,
            revision: 1,
            roomId: "room-a",
            ownerUserId: "user-a",
            participantSessionId: "participant-session-a",
            voiceMode: "camera",
          },
        };
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
