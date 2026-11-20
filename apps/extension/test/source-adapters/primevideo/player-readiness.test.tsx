import { afterEach, expect, it, vi } from "vitest";
import { mountOverlay, startContentLifecycle } from "../../../entrypoints/content";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { detectSourceAdapter } from "../../../src/source-adapters/registry";
import { primeHistoryPolicy } from "../../../src/source-adapters/primevideo/progress";
import { HISTORY_OBSERVATION_SUSPENDED } from "../../../src/source-adapters/core/history-policy";
import { readPrimeBinding } from "../../../src/source-adapters/primevideo/contract";
import { bridgeTransport, fixture, ids } from "./fixture";

const stops: (() => void)[] = [];
afterEach(() => {
  stops.splice(0).reverse().forEach(stop => stop());
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

it("keeps the capsule through missing metadata, recovery and an unverified next episode", async () => {
  vi.useFakeTimers();
  const f = fixture();
  bridgeTransport();
  const hydration = document.getElementById("dv-web-page-hydration-data")!;
  hydration.textContent = "{}";
  stops.push(startPrimeBridge());
  let current = detectSourceAdapter();
  const runtime = startContentLifecycle({
    ensureStyles() {}, startProviderStudy: () => null,
    mount(adapter) {
      current = adapter;
      let unsubscribe = adapter.subscribe(() => {});
      const overlay = mountOverlay(adapter, { renderer: {
        render(next) {
          if (next !== current) { unsubscribe(); current = next; unsubscribe = next.subscribe(() => {}); }
        }, unmount: () => unsubscribe(),
      } });
      return overlay;
    },
  });
  stops.push(runtime.dispose);
  await vi.advanceTimersByTimeAsync(100);
  let host = f.root.querySelector("anidachi-overlay-root");
  expect(host).not.toBeNull();
  expect(current?.getSourceDescriptor()).toBeUndefined();
  expect(current?.getPlaybackSnapshot().phase).toBe("transition");
  expect(primeHistoryPolicy.observe({ adapter: current!, preferences: null })).toBe(HISTORY_OBSERVATION_SUSPENDED);
  const seek = vi.spyOn(f.context.playback, "seek");
  current!.seek(200);
  await vi.advanceTimersByTimeAsync(100);
  expect(seek).not.toHaveBeenCalled();

  f.write();
  await vi.advanceTimersByTimeAsync(600);
  expect(f.root.querySelectorAll("anidachi-overlay-root")).toHaveLength(1);
  host = f.root.querySelector("anidachi-overlay-root");
  expect(current?.getSourceDescriptor()?.videoFingerprint).toBe(`primevideo|detail/${ids.first}`);
  const oldAdapter = current!;
  const oldGeneration = readPrimeBinding(f.video)?.generation;
  f.next();
  hydration.textContent = "{}";
  await vi.advanceTimersByTimeAsync(350);
  expect(f.root.querySelector("anidachi-overlay-root")).toBe(host);
  expect(current?.getSourceDescriptor()).toBeUndefined();
  expect(oldAdapter.getSourceDescriptor()).toBeUndefined();
  oldAdapter.seek(400);
  await vi.advanceTimersByTimeAsync(100);
  expect(seek).not.toHaveBeenCalled();
  f.write();
  await vi.advanceTimersByTimeAsync(600);
  expect(current?.getSourceDescriptor()?.videoFingerprint).toBe(`primevideo|detail/${ids.second}`);
  expect(readPrimeBinding(f.video)?.generation).not.toBe(oldGeneration);
  expect(f.root.querySelectorAll("anidachi-overlay-root")).toHaveLength(1);
});

it("preserves an invitation until metadata is ready even when Prime clears the fragment", async () => {
  vi.useFakeTimers();
  const f = fixture();
  Object.defineProperty(window, "location", { configurable: true,
    value: new URL(`https://www.primevideo.com/detail/${ids.first}#anidachiRoom=waiting-room`),
  });
  document.getElementById("dv-web-page-hydration-data")!.textContent = "{}";
  bridgeTransport();
  stops.push(startPrimeBridge());
  const rooms: (string | null | undefined)[] = [];
  const runtime = startContentLifecycle({
    ensureStyles() {}, startProviderStudy: () => null,
    mount(adapter, launch) {
      rooms.push(launch?.readRoom(location.href, adapter.getFingerprint()));
      return mountOverlay(adapter, { renderer: { render() {}, unmount() {} } });
    },
  });
  stops.push(runtime.dispose);
  await vi.advanceTimersByTimeAsync(100);
  expect(rooms).toEqual([null]);
  location.hash = "";
  f.write();
  await vi.advanceTimersByTimeAsync(400);
  expect(rooms).toEqual([null, "waiting-room"]);
});

it.each(["closed", "preview", "ambiguous"])("does not admit a %s player without metadata", async mode => {
  vi.useFakeTimers();
  const f = fixture();
  document.getElementById("dv-web-page-hydration-data")!.textContent = "{}";
  if (mode === "closed") f.context.webPlayer.isPlayerOpen = false;
  if (mode === "preview") f.root.remove();
  if (mode === "ambiguous") f.root.append(document.createElement("video"));
  stops.push(startPrimeBridge());
  expect(detectSourceAdapter()).toBeNull();
});
