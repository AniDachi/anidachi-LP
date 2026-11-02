import { acceptAccountHostingStatus, type AccountHostingStatus } from "@anidachi/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestAccountHostingStatus } from "./account-hosting-status-client";
import type { QuotaExhaustion } from "./use-free-quota-notice";

type State = {
  ownerUserId: string | null; sessionKey: string | null;
  mode: "unknown" | "legacy" | "free20";
  status: AccountHostingStatus | null;
  roomEpoch: number; monotonic: number; wall: number; exhaustedUntil: number | null;
  exhaustionEvent: QuotaExhaustion | null;
  periodClock: { serverTime: number; monotonic: number; resetAt: number } | null;
  busy: boolean; error: boolean;
};
const empty = (ownerUserId: string | null, sessionKey: string | null): State => ({ ownerUserId, sessionKey, mode: "unknown", status: null, roomEpoch: -1, monotonic: 0, wall: 0, exhaustedUntil: null, exhaustionEvent: null, periodClock: null, busy: false, error: false });
const RECOVERY_DELAYS_MS = [500, 1_500] as const;

/** On-demand display authority. One expiry/reset recovery is allowed per visible
 * activation or user resume; a successful recovery never starts a polling loop. */
export function useAccountHostingStatus({ ownerUserId, sessionKey, enabled, visible = enabled, roomId = null, settlementRevision = 0, exhaustion, request = requestAccountHostingStatus }: {
  ownerUserId: string | null; sessionKey: string | null; enabled: boolean;
  /** Opening the panel recovers expired data without discarding fresh prefetch. */
  visible?: boolean;
  /** Room boundaries require a new account read before idle seconds can return. */
  roomId?: string | null;
  /** A successful end HTTP response arrives after the earlier terminal socket
   * event. Retire its possibly-unsettled read and read the completed ledger. */
  settlementRevision?: number;
  exhaustion: QuotaExhaustion | null; request?: typeof requestAccountHostingStatus;
}) {
  const stateRef = useRef<State>(empty(ownerUserId, sessionKey));
  const [state, setState] = useState(stateRef.current);
  const [roomScope, setRoomScope] = useState({ roomId, epoch: 0 });
  // A return to null is a new idle period, even if the room's read never finished.
  if (roomScope.roomId !== roomId) setRoomScope({ roomId, epoch: roomScope.epoch + 1 });
  const [, tick] = useState(0);
  const refreshRef = useRef<() => void>(() => {});
  const openRef = useRef<() => void>(() => {});
  const invalidateRef = useRef<() => void>(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  const invalidate = useCallback(() => invalidateRef.current(), []);
  useEffect(() => {
    if (stateRef.current.ownerUserId !== ownerUserId || stateRef.current.sessionKey !== sessionKey) stateRef.current = empty(ownerUserId, sessionKey);
    let current: State = { ...stateRef.current, busy: false,
      ...(!enabled ? { status: null, periodClock: null } : {}) };
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
    async function load(recovery = 0, recoveryStartedAt = performance.now()) {
      if (!alive || pending || document.visibilityState === "hidden") return;
      const now = performance.now();
      if (recovery > 0 && now - recoveryStartedAt >= 5_000) {
        show({ busy: false, error: true });
        return;
      }
      if (recovery === 0 && now - lastAttempt < 5_000) {
        if (retryTimer === null) retryTimer = setTimeout(() => { retryTimer = null; void load(); }, 5_000 - (now - lastAttempt));
        return;
      }
      cancelRetry(); lastAttempt = now; pending = true;
      const ownGeneration = ++generation, wall = Date.now();
      // Keep only the originally anchored observation during revalidation.
      // The room scope below fences seconds; its fresh plan can stay visible.
      show({ busy: true, error: false });
      let retryable = true;
      try {
        // This consumer anchors age at this load's start. A shared older pending
        // request has an earlier start and must never acquire this newer clock.
        const result = await request(ownerUserId!, true);
        if (!alive || ownGeneration !== generation) return;
        retryable = false;
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
        show({ mode: "free20", status, roomEpoch: roomScope.epoch, monotonic, wall: wall - (now - monotonic), exhaustedUntil,
          periodClock: access.kind === "daily_free" ? { serverTime: status.serverTime, monotonic, resetAt: status.period.resetAt } : null,
          busy: false, error: false });
      } catch {
        if (alive && ownGeneration === generation) {
          // A transient read failure does not revoke an already confirmed plan.
          // Its original TTL still applies; the room epoch fences old seconds.
          const delay = retryable && performance.now() - recoveryStartedAt < 5_000 ? RECOVERY_DELAYS_MS[recovery] : undefined;
          show({ busy: delay !== undefined, error: delay === undefined });
          if (delay !== undefined) retryTimer = setTimeout(() => {
            retryTimer = null; void load(recovery + 1, recoveryStartedAt);
          }, delay);
        }
      } finally { if (ownGeneration === generation) pending = false; }
    }
    const suspend = () => {
      generation++; pending = false; cancelRetry();
      // A visibility boundary cancels the read, not just its UI. On return
      // there is no usable observation to justify the ordinary click cooldown.
      lastAttempt = Number.NEGATIVE_INFINITY;
      show({ status: null, periodClock: null, busy: false });
    };
    const resume = () => {
      if (document.visibilityState === "hidden") { suspend(); return; }
      if (pending || (current.status && performance.now() - lastAttempt < 5_000)) return;
      expiryRecheckUsed = false; resetRecheckUsed = false;
      void load();
    };
    refreshRef.current = () => {
      // The explicit retry replaces a failed read immediately. Its busy state
      // suppresses repeated clicks; no stale allowance is made visible.
      if (current.error) lastAttempt = Number.NEGATIVE_INFINITY;
      expiryRecheckUsed = false; resetRecheckUsed = false; void load();
    };
    invalidateRef.current = () => {
      // A newer admission denial supersedes both the display and pending reads.
      generation++; pending = false; cancelRetry(); show({ status: null, busy: false });
      refreshRef.current();
    };
    openRef.current = () => {
      const elapsed = Math.max(0, performance.now() - current.monotonic);
      const reading = current.status;
      if (reading && current.roomEpoch === roomScope.epoch &&
        Math.abs(Date.now() - current.wall - elapsed) < 2_000 &&
        reading.serverTime + elapsed < reading.validUntil &&
        (reading.access.kind !== "daily_free" || reading.serverTime + elapsed < reading.period.resetAt)) return;
      refreshRef.current();
    };
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
      alive = false; cancelRetry(); clearInterval(interval); refreshRef.current = () => {}; openRef.current = () => {}; invalidateRef.current = () => {};
      window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [ownerUserId, sessionKey, enabled, roomScope, settlementRevision, exhaustion, request]);
  useEffect(() => { if (visible) openRef.current(); }, [visible]);
  const scoped = state.ownerUserId === ownerUserId && state.sessionKey === sessionKey ? state : empty(ownerUserId, sessionKey);
  const elapsed = Math.max(0, performance.now() - scoped.monotonic);
  const observation = enabled && scoped.status && document.visibilityState !== "hidden" &&
    Math.abs(Date.now() - scoped.wall - elapsed) < 2_000 &&
    scoped.status.serverTime + elapsed < scoped.status.validUntil &&
    (scoped.status.access.kind !== "daily_free" || scoped.status.serverTime + elapsed < scoped.status.period.resetAt)
    ? scoped.status : null;
  const status = scoped.roomEpoch === roomScope.epoch && roomScope.roomId === roomId ? observation : null;
  const exhausted = scoped.mode === "free20" && scoped.exhaustedUntil !== null;
  return {
    mode: scoped.mode, status, planCode: observation?.planCode ?? null, busy: scoped.busy, error: scoped.error, exhausted,
    remainingSeconds: exhausted ? 0 : status?.access.kind === "daily_free" ? Math.max(0, status.access.remainingSeconds - (status.access.metering ? Math.floor(elapsed / 1000) : 0)) : null,
    // Bounds the last confirmed number during the short visual room handoff.
    displayExpiresAt: status ? scoped.monotonic + Math.min(status.validUntil, status.period.resetAt) - status.serverTime : null,
    resetSeconds: exhausted && enabled && scoped.periodClock && document.visibilityState !== "hidden" ? Math.max(0, Math.ceil((scoped.periodClock.resetAt - scoped.periodClock.serverTime - Math.max(0, performance.now() - scoped.periodClock.monotonic)) / 1000)) : null,
    refresh, invalidate,
  };
}
