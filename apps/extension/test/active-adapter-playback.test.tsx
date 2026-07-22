import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useActiveAdapterPlayback } from "../src/active-adapter-playback";
import { DEFAULT_PLAYER_OVERLAY_GEOMETRY } from "../src/source-adapters/core/overlay-geometry";
import type {
  PlayerEvent,
  VideoAdapter,
} from "../src/source-adapters/core/types";

describe("useActiveAdapterPlayback", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("unsubscribes, cancels heartbeat, and reports suspension while inactive", () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const adapter = createAdapter(subscribe);
    const onAdapterEvent = vi.fn();
    const onHeartbeat = vi.fn();
    const onSuspend = vi.fn();

    renderHarness({
      active: true,
      adapter,
      onAdapterEvent,
      onHeartbeat,
      onSuspend,
    });
    expect(subscribe).toHaveBeenCalledWith(onAdapterEvent);
    act(() => vi.advanceTimersByTime(1500));
    expect(onHeartbeat).toHaveBeenCalledTimes(1);

    renderHarness({
      active: false,
      adapter,
      onAdapterEvent,
      onHeartbeat,
      onSuspend,
    });
    expect(onSuspend).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(3000));
    expect(onHeartbeat).toHaveBeenCalledTimes(1);

    renderHarness({
      active: true,
      adapter,
      onAdapterEvent,
      onHeartbeat,
      onSuspend,
    });
    expect(subscribe).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(1500));
    expect(onHeartbeat).toHaveBeenCalledTimes(2);
  });

  function renderHarness(props: HarnessProps): void {
    act(() => root.render(<Harness {...props} />));
  }
});

interface HarnessProps {
  active: boolean;
  adapter: VideoAdapter;
  onAdapterEvent(event: PlayerEvent): void;
  onHeartbeat(): void;
  onSuspend(): void;
}

function Harness(props: HarnessProps) {
  useActiveAdapterPlayback({
    ...props,
    heartbeatEnabled: true,
  });
  return null;
}

function createAdapter(
  subscribe: VideoAdapter["subscribe"],
): VideoAdapter {
  const video = document.createElement("video");
  return {
    container: document.createElement("div"),
    duckVolume: () => () => undefined,
    enterFullscreen: async () => undefined,
    exitFullscreen: async () => undefined,
    getCurrentTime: () => 0,
    getFingerprint: () => "youtube|video",
    getOverlayGeometry: () => DEFAULT_PLAYER_OVERLAY_GEOMETRY,
    getState: () => ({
      hostTime: 0,
      playbackRate: 1,
      playing: false,
      updatedAt: 0,
      videoFingerprint: "youtube|video",
    }),
    getTitle: () => null,
    id: "youtube",
    isFullscreen: () => false,
    name: "YouTube",
    pause: () => undefined,
    play: async () => undefined,
    seek: () => undefined,
    subscribe,
    subscribeOverlayGeometry: () => () => undefined,
    video,
  };
}
