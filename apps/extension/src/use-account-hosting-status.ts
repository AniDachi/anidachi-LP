import { acceptAccountHostingStatus, type AccountHostingStatus } from "@anidachi/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestAccountHostingStatus } from "./account-hosting-status-client";
import type { QuotaExhaustion } from "./use-free-quota-notice";

type State = {
  ownerUserId: string | null; sessionKey: string | null;
  mode: "unknown" | "legacy" | "free20";
  status: AccountHostingStatus | null;
  monotonic: number; exhaustedUntil: number | null;
  exhaustionEvent: QuotaExhaustion | null;
  periodClock: { serverTime: number; monotonic: number; resetAt: number } | null;
  busy: boolean; error: boolean;
};
const empty = (ownerUserId: string | null, sessionKey: string | null): State => ({ ownerUserId, sessionKey, mode: "unknown", status: null, monotonic: 0, exhaustedUntil: null, exhaustionEvent: null, periodClock: null, busy: false, error: false });

/** On-demand display authority. One expiry/reset recovery is allowed per visible
 * activation or user resume; a successful recovery never starts a polling loop. */
export function useAccountHostingStatus({ ownerUserId, sessionKey, enabled, exhaustion, request = requestAccountHostingStatus }: {
  ownerUserId: string | null; sessionKey: string | null; enabled: boolean;
  exhaustion: QuotaExhaustion | null; request?: typeof requestAccountHostingStatus;
}) {
  const stateRef = useRef<State>(empty(ownerUserId, sessionKey));
  const [state, setState] = useState(stateRef.current);
  const [, tick] = useState(0);
  const refreshRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  useEffect(() => {
    if (stateRef.current.ownerUserId !== ownerUserId || stateRef.current.sessionKey !== sessionKey) stateRef.current = empty(ownerUserId, sessionKey);
    let current: State = { ...stateRef.current, status: null, periodClock: null, busy: false };
    const exhaustedUntil = exhaustion?.ownerUserId === ownerUserId && (exhaustion.sessionKey === undefined || exhaustion.sessionKey === sessionKey) ? Date.parse(exhaustion.resetAt ?? "") : NaN;
    if (Number.isFinite(exhaustedUntil) && current.exhaustionEvent !== exhaustion) {
      current.exhaustionEvent = exhaustion;
      current.exhaustedUntil = exhaustedUntil;
      if (exhaustion?.free20) current.mode = "free20";
    }
    const show = (patch: Partial<State>) => { current = { ...current, ...patch }; stateRef.current = current; setState(current); };
    show({});
    if (!enabled || !ownerUserId || !sessionKey) return;
    let alive = true, pending = false, generation = 0, expiryRecheckUsed = false, resetRecheckUsed = false;
    let lastAttempt = Number.NEGATIVE_INFINITY;
    let lastMonotonic = performance.now(), lastWall = Date.now();
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const cancelRetry = () => { if (retryTimer !== null) clearTimeout(retryTimer); retryTimer = null; };
    async function load() {
      if (!alive || pending || document.visibilityState === "hidden") return;
      const now = performance.now();
      if (now - lastAttempt < 5_000) {
        if (retryTimer === null) retryTimer = setTimeout(() => { retryTimer = null; void load(); }, 5_000 - (now - lastAttempt));
        return;
      }
      cancelRetry(); lastAttempt = now; pending = true;
      const ownGeneration = ++generation, wall = Date.now();
      show({ busy: true, error: false, status: null });
      try {
        const result = await request(ownerUserId!);
        if (!alive || ownGeneration !== generation) return;
        const elapsed = Math.max(0, performance.now() - now);
        if (String(document.visibilityState) === "hidden" || Math.abs(Date.now() - wall - elapsed) > 2_000) throw new Error("Stale read");
        if (result.mode === "legacy") { show({ mode: "legacy", status: null, periodClock: null, exhaustedUntil: null, busy: false }); return; }
        const status = acceptAccountHostingStatus(ownerUserId!, result.status);
        if (!status) throw new Error("Invalid status");
        // Retain the established UTC clock when a later response carries an
        // older measurement. Re-reading cannot restart an expired allowance.
        const monotonic = current.periodClock ? Math.min(now, current.periodClock.monotonic + status.serverTime - current.periodClock.serverTime) : now;
        if (status.serverTime + Math.max(0, performance.now() - monotonic) >= status.validUntil) throw new Error("Expired status");
        const access = status.access;
        let exhaustedUntil = current.exhaustedUntil;
        if (access.kind === "confirmed_unlimited" || (exhaustedUntil !== null && status.serverTime >= exhaustedUntil)) exhaustedUntil = null;
        if (access.kind === "daily_free" && access.remainingSeconds === 0) exhaustedUntil = status.period.resetAt;
        show({ mode: "free20", status, monotonic, exhaustedUntil,
          periodClock: access.kind === "daily_free" ? { serverTime: status.serverTime, monotonic, resetAt: status.period.resetAt } : null,
          busy: false, error: false });
      } catch {
        if (alive && ownGeneration === generation) show({ status: null, busy: false, error: true });
      } finally { if (ownGeneration === generation) pending = false; }
    }
    const suspend = () => { generation++; pending = false; cancelRetry(); show({ status: null, periodClock: null, busy: false }); };
    const resume = () => {
      if (document.visibilityState === "hidden") { suspend(); return; }
      if (pending || (current.status && performance.now() - lastAttempt < 5_000)) return;
      expiryRecheckUsed = false; resetRecheckUsed = false;
      void load();
    };
    refreshRef.current = () => { expiryRecheckUsed = false; resetRecheckUsed = false; void load(); };
    const interval = setInterval(() => {
      const now = performance.now(), wall = Date.now();
      const discontinuity = now - lastMonotonic > 5_000 || Math.abs(wall - lastWall - (now - lastMonotonic)) > 2_000;
      lastMonotonic = now; lastWall = wall;
      if (document.visibilityState === "hidden") return;
      if (discontinuity) { suspend(); if (!expiryRecheckUsed) { expiryRecheckUsed = true; void load(); } return; }
      if (!resetRecheckUsed && current.periodClock && current.periodClock.serverTime + Math.max(0, now - current.periodClock.monotonic) >= current.periodClock.resetAt) {
        resetRecheckUsed = true;
        // The UTC boundary retires the observation. Only this fresh read may
        // clear the exhaustion latch or expose the next day's budget.
        show({ status: null, periodClock: null });
        void load();
      }
      if (current.status && current.status.serverTime + Math.max(0, now - current.monotonic) >= current.status.validUntil) {
        show({ status: null });
        if (!expiryRecheckUsed) { expiryRecheckUsed = true; void load(); }
      }
      tick(n => n + 1);
    }, 1_000);
    void load();
    window.addEventListener("focus", resume); window.addEventListener("pageshow", resume); window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      alive = false; cancelRetry(); clearInterval(interval); refreshRef.current = () => {};
      window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [ownerUserId, sessionKey, enabled, exhaustion, request]);
  const scoped = state.ownerUserId === ownerUserId && state.sessionKey === sessionKey ? state : empty(ownerUserId, sessionKey);
  const elapsed = Math.max(0, performance.now() - scoped.monotonic);
  const status = enabled && scoped.status && document.visibilityState !== "hidden" && scoped.status.serverTime + elapsed < scoped.status.validUntil ? scoped.status : null;
  const exhausted = scoped.mode === "free20" && scoped.exhaustedUntil !== null;
  return {
    mode: scoped.mode, status, busy: scoped.busy, error: scoped.error, exhausted,
    remainingSeconds: exhausted ? 0 : status?.access.kind === "daily_free" ? Math.max(0, status.access.remainingSeconds - (status.access.metering ? Math.floor(elapsed / 1000) : 0)) : null,
    resetSeconds: exhausted && enabled && scoped.periodClock && document.visibilityState !== "hidden" ? Math.max(0, Math.ceil((scoped.periodClock.resetAt - scoped.periodClock.serverTime - Math.max(0, performance.now() - scoped.periodClock.monotonic)) / 1000)) : null,
    refresh,
  };
}
