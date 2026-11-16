import { boundedMessage, PRIME_NAVIGATING, PRIME_BINDING, PRIME_BINDING_CHANGED, PRIME_RESULT, PrimeRequestSchema, PrimeResultSchema, PrimeSnapshotSchema, type PrimeSnapshot, type PrimeRequest } from "./contract";
import { object } from "./metadata";
import { callPrime, inspectPrimeSdk, type PrimeSdk } from "./sdk";
type Binding = { sdk: PrimeSdk; generation: string; snapshot: PrimeSnapshot };
/** MAIN-world owner. No extension APIs, network requests, credentials or native seeking. */
export function startPrimeBridge(): () => void {
  let navigating = false;
  let stopped = false, binding: Binding | null = null;
  const pending = new Map<string, AbortController>();
  const retired = new Set<string>();
  const announce = () => document.dispatchEvent(new Event(PRIME_BINDING_CHANGED));
  function invalidate(notify = true) {
    if (!binding) return;
    binding.sdk.video.removeAttribute(PRIME_BINDING); binding = null; if (notify) announce();
  }
  function inspect(): Binding | null {
    if (stopped || navigating) return null;
    const sdk = inspectPrimeSdk(); if (!sdk) { invalidate(); return null; }
    const changed = !binding || binding.sdk.context !== sdk.context || binding.sdk.webPlayer !== sdk.webPlayer || binding.sdk.titleApi !== sdk.titleApi || binding.sdk.timelineApi !== sdk.timelineApi || binding.sdk.playerFacade !== sdk.playerFacade || binding.sdk.playback !== sdk.playback || binding.sdk.video !== sdk.video ||
      binding.snapshot.contentId !== sdk.snapshot.contentId || (["content", "buffering"].includes(binding.snapshot.phase) ? "main" : binding.snapshot.phase) !== (["content", "buffering"].includes(sdk.snapshot.phase) ? "main" : sdk.snapshot.phase);
    const generation = changed ? crypto.randomUUID() : binding!.generation;
    const parsed = PrimeSnapshotSchema.safeParse({ ...sdk.snapshot, generation }); if (!parsed.success) { invalidate(); return null; }
    if (changed) invalidate(false);
    binding = { sdk, generation, snapshot: parsed.data };
    if (changed) { sdk.video.setAttribute(PRIME_BINDING, `${sdk.page.contentId}:${generation}`); announce(); }
    return binding;
  }
  const retire = (id: string) => { retired.add(id); if (retired.size > 256) retired.delete(retired.values().next().value!); };
  function current(request: PrimeRequest, expected?: Binding): Binding | null {
    const value = inspect();
    return value && value.snapshot.contentId === request.contentId && (!request.generation || value.generation === request.generation) &&
      (!expected || value.generation === expected.generation) ? value : null;
  }
  const delay = (signal: AbortSignal) => new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, 50); signal.addEventListener("abort", finish, { once: true });
  });
  async function run(request: PrimeRequest, abort: AbortController) {
    let result: { ok: boolean; snapshot?: PrimeSnapshot; catalog?: PrimeSdk["page"]["catalog"] } = { ok: false };
    try {
      const initial = current(request); if (!initial || abort.signal.aborted) return;
      if (request.action === "snapshot") result = { ok: true, snapshot: initial.snapshot };
      else if (request.action === "catalog") {
        if (initial.snapshot.phase === "content" && initial.sdk.page.catalog) result = { ok: true, snapshot: initial.snapshot, catalog: initial.sdk.page.catalog };
      } else {
        // Yield once so same-turn cancellation/disposal can fence a queued request.
        await delay(abort.signal);
        const before = current(request, initial);
        if (!before || abort.signal.aborted || before.snapshot.phase !== "content" || request.expiresAt !== undefined && request.expiresAt <= Date.now()) return;
        if (request.action === "seek" && (!before.sdk.seekAllowed || request.time! > before.snapshot.duration)) return;
        if (request.action === "pause" && !before.sdk.pauseAllowed) return;
        if (request.action === "rate" && !before.sdk.rateAllowed) return;
        if (!["play", "pause", "seek", "rate"].includes(request.action)) return;
        // Call only after the last synchronous identity, phase and cancellation check.
        const returned = request.action === "rate" ? callPrime(object(before.sdk.playback.player), "setPlaybackRate", request.rate!) : request.action === "seek" ? callPrime(before.sdk.playback, "seek", request.time! * 1000) : callPrime(before.sdk.playback, request.action);
        // SDK completion is not trusted as proof; consume rejection without awaiting an unbounded page promise.
        if (returned && typeof (returned as PromiseLike<unknown>).then === "function") Promise.resolve(returned).catch(() => undefined);
        const until = Date.now() + 2000;
        while (!abort.signal.aborted && Date.now() < until) {
          const after = current(request, before); if (!after) break;
          if (after.snapshot.phase === "buffering") { await delay(abort.signal); continue; }
          if (after.snapshot.phase !== "content") break;
          const confirmed = request.action === "rate" ? Math.abs(after.snapshot.playbackRate - request.rate!) < 0.001 : request.action === "seek" ? Math.abs(after.snapshot.currentTime - request.time!) <= 1.25 :
            request.action === "play" ? after.snapshot.playing : !after.snapshot.playing;
          if (confirmed) { result = { ok: true, snapshot: after.snapshot }; break; }
          await delay(abort.signal);
        }
      }
    } catch { /* Undocumented API changes fail closed. */ }
    finally {
      if (!stopped && !abort.signal.aborted) {
        const parsed = PrimeResultSchema.safeParse({ source: PRIME_RESULT, id: request.id, ...result });
        if (parsed.success) window.postMessage(parsed.data, location.origin);
      }
      if (pending.get(request.id) === abort) pending.delete(request.id); retire(request.id);
    }
  }
  const navigate = () => { navigating = true; for (const abort of pending.values()) abort.abort(); pending.clear(); invalidate(); };
  const listener = (event: MessageEvent) => {
    if (stopped || event.source !== window || event.origin !== location.origin || !boundedMessage(event.data, 32)) return;
    const parsed = PrimeRequestSchema.safeParse(event.data); if (!parsed.success) return;
    const request = parsed.data;
    if (request.action === "cancel") { pending.get(request.id)?.abort(); pending.delete(request.id); retire(request.id); return; }
    if (pending.has(request.id) || retired.has(request.id) || pending.size >= 8) return;
    const abort = new AbortController(); pending.set(request.id, abort); void run(request, abort);
  };
  // Media signals cover native Next Episode with the same URL and video. The bounded
  // SDK poll also catches a paused title/context swap without a DOM mutation.
  const refresh = () => { inspect(); };
  const events = ["timeupdate", "play", "pause", "loadedmetadata", "emptied", "loadstart"];
  for (const name of events) document.addEventListener(name, refresh, true);
  document.addEventListener(PRIME_NAVIGATING, navigate);
  window.addEventListener("message", listener); window.addEventListener("pagehide", stop);
  const timer = setInterval(refresh, 250); inspect();
  function stop() {
    if (stopped) return; stopped = true; clearInterval(timer);
    document.removeEventListener(PRIME_NAVIGATING, navigate);
    window.removeEventListener("message", listener); window.removeEventListener("pagehide", stop);
    for (const name of events) document.removeEventListener(name, refresh, true);
    for (const abort of pending.values()) abort.abort(); pending.clear(); retired.clear(); invalidate();
  }
  return stop;
}
