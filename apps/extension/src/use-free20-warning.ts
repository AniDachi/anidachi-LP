import { FREE20_WARNING_THRESHOLD_SECONDS } from "@anidachi/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { claimFinalHostingMinute, isFree20WarningLoginKey, requestFree20Warning } from "./free20-warning-client";
import { isFinalHostingMinute, type HostingTimeDisplay } from "./room-hosting-time";
import type { NoticeDismissReason } from "./use-capsule-notice-presentation";

export type Free20WarningInput = {
  ownerUserId: string | null; sessionKey: string | null; credentialRevision: string | null;
  isHost: boolean; connected: boolean; roomId: string | null; roomGeneration: number;
  connectionGeneration: number;
  reading: HostingTimeDisplay | null; readFresh(): HostingTimeDisplay | null;
  request?: typeof requestFree20Warning;
  claimFinalMinute?: typeof claimFinalHostingMinute;
};
type Budget = { attempts: number; phase: "idle" | "pending" | "retry" | "crossing" | "done"; lastAttempt: number; sequence: number; roomId: string | null; roomGeneration: number };
type FinalClaim = { room: string; phase: "pending" | "ready" | "done" | "retry"; retryAt: number };

function eligible(input: Free20WarningInput, time: HostingTimeDisplay | null): time is HostingTimeDisplay {
  return Boolean(input.ownerUserId && input.sessionKey && isFree20WarningLoginKey(input.ownerUserId, input.sessionKey) && input.credentialRevision && input.isHost && input.connected && input.roomId && document.visibilityState !== "hidden" && time &&
    time.snapshot.ownerUserId === input.ownerUserId && time.snapshot.roomId === input.roomId && time.snapshot.roomGeneration === input.roomGeneration && time.snapshot.access.kind === "daily_free" &&
    time.remainingSeconds !== null && Number.isFinite(time.remainingSeconds) && time.remainingSeconds > 0 && time.remainingSeconds <= FREE20_WARNING_THRESHOLD_SECONDS && time.resetSeconds > 0);
}

/** The room clock drives both notices. The background deduplicates the early
 * warning per daily allowance and the final reminder per hosted room. */
export function useFree20Warning(input: Free20WarningInput) {
  const latest = useRef(input); latest.current = input;
  const budgets = useRef(new Map<string, Budget>());
  const active = useRef<{ controller: AbortController; budget: Budget } | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shown, setShown] = useState<{ scope: string; phase: "open" | "final" } | null>(null);
  const finalClaim = useRef<FinalClaim | null>(null);
  const drive = useRef<() => void>(() => {});
  const day = input.reading?.snapshot.period.utcDay ?? null;
  const access = input.reading?.snapshot.access;
  const budgetSeconds = access?.kind === "daily_free" ? access.budgetSeconds : null;
  const budgetKey = JSON.stringify([input.ownerUserId, input.sessionKey, day, budgetSeconds]);
  const roomSession = JSON.stringify([input.ownerUserId, input.sessionKey, input.credentialRevision, input.roomId, input.roomGeneration, input.connectionGeneration, input.isHost, input.connected]);
  const scope = JSON.stringify([roomSession, day, budgetSeconds]);
  const currentScope = useRef(scope); currentScope.current = scope;
  const stop = useCallback(() => {
    if (retry.current !== null) { clearTimeout(retry.current); retry.current = null; }
    if (active.current) { active.current.budget.phase = "done"; active.current.controller.abort(); active.current = null; }
  }, []);
  const dismiss = useCallback((_reason: NoticeDismissReason = "dismiss") => {
    if (currentScope.current !== scope) return;
    stop();
    // The open early notice already shows the final countdown while its room claim is in flight.
    if (finalClaim.current?.phase === "pending") finalClaim.current.phase = "done";
    setShown(null);
  }, [stop, scope]);
  useEffect(() => () => { finalClaim.current = null; }, [input.ownerUserId, input.sessionKey, input.roomId]);
  useEffect(() => {
    setShown(null);
    const hide = () => { stop(); setShown(null); };
    const visibility = () => { if (document.visibilityState === "hidden") hide(); else drive.current(); };
    document.addEventListener("visibilitychange", visibility);
    return () => { stop(); document.removeEventListener("visibilitychange", visibility); };
  }, [scope, stop]);

  drive.current = () => {
    const value = latest.current;
    const time = value.readFresh();
    if (!eligible(value, time) || time.snapshot.period.utcDay !== day || time.snapshot.access.kind !== "daily_free" || time.snapshot.access.budgetSeconds !== budgetSeconds) { stop(); setShown(previous => previous === null ? previous : null); return; }
    if (isFinalHostingMinute(time.remainingSeconds)) {
      stop();
      const room = JSON.stringify([value.ownerUserId, value.sessionKey, value.roomId]);
      const previous = finalClaim.current;
      if (previous?.room === room) {
        if (previous.phase === "ready") {
          previous.phase = "done";
          setShown({ scope, phase: "final" });
          return;
        }
        if (previous.phase === "done") {
          setShown(notice => notice?.phase === "open" ? null : notice);
          return;
        }
        if (previous.phase !== "retry" || performance.now() < previous.retryAt) return;
      }
      const claim: FinalClaim = { room, phase: "pending", retryAt: 0 };
      finalClaim.current = claim;
      void (value.claimFinalMinute ?? claimFinalHostingMinute)({
        ownerUserId: value.ownerUserId!, loginKey: value.sessionKey!, credentialRevision: value.credentialRevision!, roomId: value.roomId!,
      }).then(show => {
        if (finalClaim.current !== claim || claim.phase !== "pending") return;
        claim.phase = show ? "ready" : "done";
        drive.current();
      }).catch(() => {
        if (finalClaim.current !== claim || claim.phase !== "pending") return;
        claim.phase = "retry";
        claim.retryAt = performance.now() + 5_000;
      });
      return;
    }
    let budget = budgets.current.get(budgetKey);
    if (!budget) {
      budget = { attempts: 0, phase: "idle", lastAttempt: Number.NEGATIVE_INFINITY, sequence: -1, roomId: null, roomGeneration: 0 };
      budgets.current.set(budgetKey, budget);
      if (budgets.current.size > 8) budgets.current.delete(budgets.current.keys().next().value!);
    }
    if (active.current || budget.phase === "done" || budget.phase === "pending" || budget.attempts >= 2) return;
    // Sequences order one room/generation only. A different stream may use the
    // remaining attempt after a fresh authoritative below-threshold observation.
    const sameStream = budget.roomId === time.snapshot.roomId && budget.roomGeneration === time.snapshot.roomGeneration;
    if (budget.phase === "crossing" && ((sameStream && time.snapshot.snapshotSequence <= budget.sequence) || time.snapshot.access.kind !== "daily_free" || time.snapshot.access.remainingSeconds > FREE20_WARNING_THRESHOLD_SECONDS)) return;
    const delay = budget.attempts ? Math.max(0, 5_000 - (performance.now() - budget.lastAttempt)) : 0;
    if (delay > 0) {
      if (retry.current === null) retry.current = setTimeout(() => { retry.current = null; drive.current(); }, delay);
      return;
    }
    if (retry.current !== null) { clearTimeout(retry.current); retry.current = null; }
    const reason = budget.phase === "crossing" ? "crossing" : budget.attempts ? "retry" : "initial";
    const own = budget;
    const controller = new AbortController();
    const started = performance.now(), wall = Date.now();
    own.attempts++; own.phase = "pending"; own.lastAttempt = started; own.sequence = time.snapshot.snapshotSequence;
    own.roomId = time.snapshot.roomId; own.roomGeneration = time.snapshot.roomGeneration;
    active.current = { controller, budget: own };
    void (value.request ?? requestFree20Warning)({
      ownerUserId: value.ownerUserId!, loginKey: value.sessionKey!, credentialRevision: value.credentialRevision!, reason,
      snapshotSequence: time.snapshot.snapshotSequence, budgetSeconds: time.snapshot.access.budgetSeconds,
      request: { hostingWarningVersion: 1, roomId: value.roomId!, roomGeneration: value.roomGeneration, utcDay: time.snapshot.period.utcDay },
    }, controller.signal).then(result => {
      if (controller.signal.aborted || currentScope.current !== scope) return;
      active.current = null;
      const current = latest.current, fresh = current.readFresh();
      const elapsed = Math.max(0, performance.now() - started);
      if (!eligible(current, fresh) || fresh.snapshot.period.utcDay !== day || fresh.snapshot.access.kind !== "daily_free" || fresh.snapshot.access.budgetSeconds !== budgetSeconds || Math.abs(Date.now() - wall - elapsed) > 2_000) { own.phase = "done"; return; }
      if (result.kind === "failed") {
        own.phase = result.retryable && own.attempts < 2 ? "retry" : "done";
        if (own.phase === "retry") drive.current();
        return;
      }
      if (result.kind === "suppressed") { own.phase = "done"; return; }
      const response = result.response;
      if (response.ownerUserId !== current.ownerUserId || response.roomId !== current.roomId || response.roomGeneration !== current.roomGeneration || response.utcDay !== day || response.serverTime + elapsed >= response.validUntil) { own.phase = "done"; return; }
      if (response.decision === "not_eligible") { own.phase = own.attempts < 2 ? "crossing" : "done"; return; }
      own.phase = "done";
      if (isFinalHostingMinute(fresh.remainingSeconds)) drive.current();
      else if (response.decision === "show") setShown({ scope, phase: "open" });
    }).catch(() => {
      if (controller.signal.aborted || currentScope.current !== scope) return;
      active.current = null; own.phase = own.attempts < 2 ? "retry" : "done"; drive.current();
    });
  };
  // Local room ticks can trigger the first crossing, but a pending/consumed
  // budget cannot issue another request on render, focus or reconnect.
  useEffect(() => { drive.current(); });
  return { visible: Boolean(shown && shown.scope === scope && eligible(input, input.reading) && (shown.phase === "open" || isFinalHostingMinute(input.reading.remainingSeconds))), dismiss };
}
