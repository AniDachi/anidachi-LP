import { afterEach, expect, it, vi } from "vitest";
import { startContentLifecycle } from "../../../entrypoints/content";
import { fixture, bridgeTransport, ids } from "./fixture";
import { startPrimeBridge } from "../../../src/source-adapters/primevideo/main-bridge";
import { PrimeVideoAdapter } from "../../../src/source-adapters/primevideo/adapter";
import type { VideoAdapter } from "../../../src/source-adapters/core/types";
const stops: (() => void)[] = [];
afterEach(() => { stops.splice(0).reverse().forEach(stop => stop()); vi.restoreAllMocks(); vi.useRealTimers(); document.body.innerHTML = ""; });
it("replaces a same-video same-URL source through immediate binding notification and disposes old subscription", async () => {
  vi.useFakeTimers(); const f = fixture(); bridgeTransport(); stops.push(startPrimeBridge());
  let active: VideoAdapter | null = null, unsubscribe: (() => void) | null = null;
  const replace = vi.fn((adapter: VideoAdapter) => { unsubscribe?.(); active = adapter; unsubscribe = adapter.subscribe(() => {}); });
  const runtime = startContentLifecycle({ ensureStyles: () => {}, installKeyboardGuard: () => () => {}, startProviderStudy: () => null,
    mount: adapter => { active = adapter; unsubscribe = adapter.subscribe(() => {}); return { adapter, replaceAdapter: replace, relocate() {}, suspend() {}, dispose() { unsubscribe?.(); } }; } });
  stops.push(runtime.dispose); await vi.advanceTimersByTimeAsync(100);
  const first = active as unknown as PrimeVideoAdapter; expect(first.getSourceDescriptor()?.sourceUrl).toContain(ids.first);
  f.next(); f.video.dispatchEvent(new Event("timeupdate")); await vi.advanceTimersByTimeAsync(100);
  expect(replace).toHaveBeenCalledTimes(1); expect((active as unknown as PrimeVideoAdapter).getFingerprint()).toContain(ids.second);
  expect(first.getPrimeSnapshot()).toBeNull(); first.seek(200); await vi.advanceTimersByTimeAsync(100); expect(f.context.playback.seek).not.toHaveBeenCalled();
  runtime.dispose(); stops[0]!(); expect(vi.getTimerCount()).toBe(0);
});
it("isolates Prime composer keyboard events and releases the guard on disposal", () => {
  fixture(); const runtime = startContentLifecycle({ detect: () => ({ status: "none" }), ensureStyles: () => {}, mount: vi.fn(), startProviderStudy: () => null }); stops.push(runtime.dispose);
  const native = vi.fn(); window.addEventListener("keydown", native, true); stops.push(() => window.removeEventListener("keydown", native, true));
  document.documentElement.setAttribute("data-anidachi-composer-open", "true");
  try { window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true })); expect(native).not.toHaveBeenCalled();
    runtime.dispose(); window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true })); expect(native).toHaveBeenCalledTimes(1);
  } finally { document.documentElement.removeAttribute("data-anidachi-composer-open"); }
});

it("recovers snapshots and commands after binding loss/restoration before one reconciliation frame", async () => {
  vi.useFakeTimers(); const f = fixture(); bridgeTransport(); stops.push(startPrimeBridge());
  let adapter!: PrimeVideoAdapter, unsubscribe: (() => void) | null = null;
  const replace = vi.fn();
  const runtime = startContentLifecycle({ ensureStyles: () => {}, installKeyboardGuard: () => () => {}, startProviderStudy: () => null,
    mount: active => { adapter = active as PrimeVideoAdapter; unsubscribe = adapter.subscribe(() => {});
      return { adapter, replaceAdapter: replace, relocate() {}, suspend() {}, dispose() { unsubscribe?.(); } }; } });
  stops.push(runtime.dispose); await vi.advanceTimersByTimeAsync(100);
  expect(adapter.getPrimeSnapshot()?.contentId).toBe(ids.first);
  adapter.seek(50); await vi.advanceTimersByTimeAsync(1);
  f.context.webPlayer.isPlayerOpen = false; f.video.dispatchEvent(new Event("timeupdate"));
  expect(adapter.getPrimeSnapshot()).toBeNull();
  f.context.webPlayer.isPlayerOpen = true; f.video.dispatchEvent(new Event("timeupdate"));
  await vi.advanceTimersByTimeAsync(100);
  expect(replace).not.toHaveBeenCalled(); expect(adapter.getPrimeSnapshot()?.contentId).toBe(ids.first);
  expect(f.context.playback.seek).not.toHaveBeenCalled();
  adapter.seek(200); await vi.advanceTimersByTimeAsync(100);
  expect(f.context.playback.seek).toHaveBeenCalledExactlyOnceWith(200000);
});
