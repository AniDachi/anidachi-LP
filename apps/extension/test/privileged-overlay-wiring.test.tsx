import { afterEach, describe, expect, it, vi } from "vitest";
import { mountOverlay, type OverlayRenderer } from "../entrypoints/content";
import type { VideoAdapter } from "../src/source-adapters/core/types";

describe("privileged overlay wiring", () => {
  afterEach(() => {
    vi.restoreAllMocks();
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
