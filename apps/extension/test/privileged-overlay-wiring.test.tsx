import { afterEach, describe, expect, it, vi } from "vitest";
import { mountOverlay, type OverlayRenderer } from "../entrypoints/content";
import * as overlayApp from "../src/overlay-app";
import type { PrivilegedOverlayContext } from "../src/privileged-overlay-intent";
import type { VideoAdapter } from "../src/source-adapters/core/types";

describe("privileged overlay wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
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
});

function createAdapter(container: HTMLElement, video: HTMLVideoElement): VideoAdapter {
  return {
    id: "youtube",
    provider: "youtube",
    video,
    container,
    getFingerprint: () => "youtube|test",
    getOverlayBinding: () => ({ mountTarget: container, fillMountTarget: true, useNativePlayerDoubleClick: true }),
    getCurrentTime: () => 0,
    getDuration: () => 0,
    getPlaybackRate: () => 1,
    isPaused: () => true,
    isFullscreen: () => false,
    pause: () => undefined,
    play: async () => undefined,
    seek: () => undefined,
    setPlaybackRate: () => undefined,
    getSourceDescriptor: () => ({ provider: "youtube", videoFingerprint: "youtube|test", sourceUrl: location.href, canonicalUrl: location.href, title: null }),
  } as unknown as VideoAdapter;
}
