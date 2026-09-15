import { useCallback, useEffect, useRef, useState } from "react";
import { requestRoomQuotaStatus } from "./room-quota-status-client";

export interface QuotaExhaustion {
  ownerUserId: string;
  resetAt?: string;
}
export interface FreeQuotaNoticeState {
  ownerUserId: string;
  kind: "checking" | "exhausted" | "unavailable" | "ready";
  remainingSeconds: number | null;
}
type Context = {
  ownerUserId: string;
  exhausted: boolean;
  resetAt?: number;
};

/** Dates only detect sleep/clock jumps. Countdown arithmetic uses server time + monotonic elapsed time. */
export function useFreeQuotaNotice(options: {
  ownerUserId: string | null;
  accessToken: string | null;
  visible: boolean;
  isFree: boolean;
  exhaustion: QuotaExhaustion | null;
  request?: typeof requestRoomQuotaStatus;
}) {
  const { ownerUserId, accessToken, visible, isFree, exhaustion, request = requestRoomQuotaStatus } = options;
  const [state, setState] = useState<FreeQuotaNoticeState | null>(null);
  const contextRef = useRef<Context | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const retry = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    if (contextRef.current?.ownerUserId !== ownerUserId) {
      contextRef.current = ownerUserId ? { ownerUserId, exhausted: false } : null;
      setState(null);
    }
    const context = contextRef.current;
    if (!ownerUserId || !accessToken || !context) return;
    if (exhaustion?.ownerUserId === ownerUserId) {
      context.exhausted = true;
      const reset = Date.parse(exhaustion.resetAt ?? "");
      if (Number.isFinite(reset)) context.resetAt = reset;
      setState({ ownerUserId, kind: "checking", remainingSeconds: null });
    }
    if (!visible || (!isFree && !context.exhausted)) return;

    let alive = true;
    let pending = false;
    let lastAttempt = Number.NEGATIVE_INFINITY;
    let anchor: { serverMs: number; monotonicMs: number; resetMs: number } | null = null;
    let checkedZero = false;
    let refreshQueued = false;
    let lastWall = Date.now();
    let lastMonotonic = performance.now();
    const show = (kind: FreeQuotaNoticeState["kind"], remainingSeconds: number | null = null) => {
      if (alive) setState({ ownerUserId, kind, remainingSeconds });
    };

    async function refresh() {
      if (!alive || document.visibilityState === "hidden") return;
      if (pending) { refreshQueued = true; return; }
      const monotonic = performance.now();
      const requestWall = Date.now();
      if (monotonic - lastAttempt < 5_000) { refreshQueued = true; return; }
      refreshQueued = false;
      pending = true;
      lastAttempt = monotonic;
      anchor = null;
      if (context!.exhausted) show("checking");
      try {
        const result = await request(ownerUserId!, accessToken!);
        if (!alive) return;
        if (result.ownerUserId !== ownerUserId) throw new Error("Quota owner changed");
        const elapsed = Math.max(0, performance.now() - monotonic);
        if (Math.abs((Date.now() - requestWall) - elapsed) > 2_000) {
          // An in-flight response can predate sleep even when performance paused.
          // Discard all of it, including a stale positive quota, and read again.
          refreshQueued = true;
          if (context!.exhausted) show("checking");
          return;
        }
        const serverMs = Date.parse(result.serverTime);
        const quota = result.quota;
        // A just-ended room can reach this read before final usage settles.
        // Do not mistake that lag for a new UTC day; current paid access is immediate.
        const stillExhaustedDay = quota && context!.exhausted && context!.resetAt !== undefined && serverMs < context!.resetAt;
        if (quota && (quota.remainingSeconds === 0 || stillExhaustedDay)) {
          context!.exhausted = true;
          context!.resetAt = Date.parse(quota.resetAt);
          // Reception time is paired with request start: network overhead can
          // make zero slightly early, but only another server read can confirm it.
          anchor = { serverMs, monotonicMs: monotonic, resetMs: context!.resetAt };
          checkedZero = false;
          const remaining = Math.max(0, Math.ceil((anchor.resetMs - serverMs - elapsed) / 1000));
          if (remaining === 0) { show("checking"); refreshQueued = true; }
          else show("exhausted", remaining);
        } else {
          anchor = null;
          if (context!.exhausted) show("ready");
          else setState(null);
          context!.exhausted = false;
          context!.resetAt = undefined;
        }
      } catch {
        if (alive && context!.exhausted) show("unavailable");
      } finally {
        pending = false;
      }
    }

    refreshRef.current = () => { void refresh(); };
    void refresh();
    const resume = () => { void refresh(); };
    const tick = () => {
      const monotonic = performance.now();
      const wall = Date.now();
      const discontinuity = Math.abs((wall - lastWall) - (monotonic - lastMonotonic)) > 2_000;
      lastWall = wall;
      lastMonotonic = monotonic;
      if (document.visibilityState === "hidden") return;
      if (discontinuity) { void refresh(); return; }
      if (refreshQueued && monotonic - lastAttempt >= 5_000) { void refresh(); return; }
      if (!anchor || pending) return;
      const remaining = Math.max(0, Math.ceil((anchor.resetMs - anchor.serverMs - Math.max(0, monotonic - anchor.monotonicMs)) / 1000));
      if (remaining === 0) {
        show("checking");
        if (!checkedZero && monotonic - lastAttempt >= 5_000) {
          checkedZero = true;
          void refresh();
        }
      } else show("exhausted", remaining);
    };
    const interval = window.setInterval(tick, 1_000);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    return () => {
      alive = false;
      refreshRef.current = () => {};
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
    };
  }, [ownerUserId, accessToken, visible, isFree, exhaustion, request]);

  return { state: state?.ownerUserId === ownerUserId ? state : null, retry };
}
