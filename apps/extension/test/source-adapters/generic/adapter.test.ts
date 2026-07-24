import { describe, expect, it, vi } from "vitest";
import { GenericVideoAdapter } from "../../../src/source-adapters/generic/adapter";
import { genericDefinition } from "../../../src/source-adapters/generic/definition";

describe("generic source adapter", () => {
  it("creates the existing HTML5 adapter for the selected video", () => {
    mockLocation("https://example.com/watch/demo");
    document.body.innerHTML = `
      <main id="player"><video></video></main>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const player = document.querySelector("#player") as HTMLElement;
    mockRect(video, 640, 360);
    mockRect(player, 640, 360);

    const adapter = genericDefinition.detect(video);

    expect(genericDefinition).toMatchObject({
      id: "generic-html5-video",
      provider: "generic",
      priority: 100,
    });
    expect(adapter).toBeInstanceOf(GenericVideoAdapter);
    expect(adapter?.provider).toBe("generic");
    expect(adapter?.video).toBe(video);
    expect(adapter?.container).toBe(player);
    expect(adapter?.getOverlayBinding()).toEqual({
      fillMountTarget: false,
      mountTarget: player,
      useNativePlayerDoubleClick: false,
    });
    expect(adapter?.getFingerprint()).toBe("html5|/watch/demo|/watch/demo");
    expect(adapter?.getSourceDescriptor()).toMatchObject({
      provider: "generic",
      videoFingerprint: "html5|/watch/demo|/watch/demo",
    });
    expect(adapter?.playbackPolicy).toMatchObject({
      playBeforeMediaReady: false,
      readyTimeoutMs: 2500,
      remoteSeekThrottleMs: 0,
      pendingSeekGuard: null,
      localSeekCoalescing: null,
    });
    expect(adapter?.getPlaybackSnapshot()).toMatchObject({
      phase: "content",
      contentTime: 0,
      playing: false,
      playbackRate: 1,
    });
  });

  it("sets and publishes playback-rate changes through the adapter contract", () => {
    mockLocation("https://example.com/watch/demo");
    document.body.innerHTML = `
      <main id="player"><video></video></main>
    `;
    const video = document.querySelector("video") as HTMLVideoElement;
    const player = document.querySelector("#player") as HTMLElement;
    mockRect(video, 640, 360);
    mockRect(player, 640, 360);
    const adapter = genericDefinition.detect(video);
    const listener = vi.fn();
    const unsubscribe = adapter?.subscribe(listener);

    adapter?.setPlaybackRate(1.5);
    video.dispatchEvent(new Event("ratechange"));

    expect(video.playbackRate).toBe(1.5);
    expect(listener).toHaveBeenCalledWith({
      type: "ratechange",
      time: 0,
      playbackRate: 1.5,
    });
    unsubscribe?.();
  });
});

function mockLocation(url: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: new URL(url),
  });
}

function mockRect(element: Element, width: number, height: number): void {
  element.getBoundingClientRect = () =>
    ({
      bottom: height,
      height,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}
