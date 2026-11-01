import { FREE20_WARNING_THRESHOLD_SECONDS, type Free20WarningResponse } from "@anidachi/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { isFree20WarningLoginKey, requestFree20Warning } from "./free20-warning-client";
import type { HostingTimeDisplay } from "./room-hosting-time";

export type Free20WarningInput = {
  ownerUserId: string | null; sessionKey: string | null; credentialRevision: string | null;
  isHost: boolean; connected: boolean; roomId: string | null; roomGeneration: number;
  sourceGeneration: number; connectionGeneration: number;
  reading: HostingTimeDisplay | null; readFresh(): HostingTimeDisplay | null;
  request?: typeof requestFree20Warning;
};
type Budget = { attempts: number; phase: "idle" | "pending" | "retry" | "crossing" | "done"; lastAttempt: number; sequence: number; roomId: string | null; roomGeneration: number };
function eligible(input: Free20WarningInput, time: HostingTimeDisplay | null): time is HostingTimeDisplay {
  return Boolean(input.ownerUserId && input.sessionKey && isFree20WarningLoginKey(input.ownerUserId, input.sessionKey) && input.credentialRevision && input.isHost && input.connected && input.roomId && document.visibilityState !== "hidden" && time &&
    time.snapshot.ownerUserId === input.ownerUserId && time.snapshot.roomId === input.roomId && time.snapshot.roomGeneration === input.roomGeneration && time.snapshot.access.kind === "daily_free" &&
    time.remainingSeconds !== null && Number.isFinite(time.remainingSeconds) && time.remainingSeconds > 0 && time.remainingSeconds <= FREE20_WARNING_THRESHOLD_SECONDS && time.resetSeconds > 0);
}

/** The room clock owns time. This hook owns presentation and one retry timeout;
 * the background's session storage owns the cross-document attempt budget. */
export function useFree20Warning(input: Free20WarningInput) {
  const latest = useRef(input); latest.current = input;
  const budgets = useRef(new Map<string, Budget>());
  const active = useRef<{ controller: AbortController; budget: Budget } | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shown, setShown] = useState<{ scope: string; response: Free20WarningResponse } | null>(null);
  const drive = useRef<() => void>(() => {});
  const day = input.reading?.snapshot.period.utcDay ?? null;
  const budgetKey = JSON.stringify([input.ownerUserId, input.sessionKey, day]);
  const scope = JSON.stringify([budgetKey, input.credentialRevision, input.roomId, input.roomGeneration, input.sourceGeneration, input.connectionGeneration]);
  const currentScope = useRef(scope); currentScope.current = scope;
  const stop = useCallback(() => {
    if (retry.current !== null) { clearTimeout(retry.current); retry.current = null; }
    if (active.current) { active.current.budget.phase = "done"; active.current.controller.abort(); active.current = null; }
  }, []);
  const dismiss = useCallback(() => { stop(); setShown(null); }, [stop]);

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
    if (!eligible(value, time) || time.snapshot.period.utcDay !== day) { stop(); setShown(previous => previous === null ? previous : null); return; }
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
      snapshotSequence: time.snapshot.snapshotSequence,
      request: { hostingWarningVersion: 1, roomId: value.roomId!, roomGeneration: value.roomGeneration, utcDay: time.snapshot.period.utcDay },
    }, controller.signal).then(result => {
      if (controller.signal.aborted || currentScope.current !== scope) return;
      active.current = null;
      const current = latest.current, fresh = current.readFresh();
      const elapsed = Math.max(0, performance.now() - started);
      if (!eligible(current, fresh) || fresh.snapshot.period.utcDay !== day || Math.abs(Date.now() - wall - elapsed) > 2_000) { own.phase = "done"; return; }
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
      if (response.decision === "show") setShown({ scope, response });
    }).catch(() => {
      if (controller.signal.aborted || currentScope.current !== scope) return;
      active.current = null; own.phase = own.attempts < 2 ? "retry" : "done"; drive.current();
    });
  };
  // Local room ticks can trigger the first crossing, but a pending/consumed
  // budget cannot issue another request on render, focus or reconnect.
  useEffect(() => { drive.current(); });
  return { visible: Boolean(shown && shown.scope === scope && eligible(input, input.reading)), dismiss };
}
