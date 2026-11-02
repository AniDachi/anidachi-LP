import { Clock3, Check, RefreshCw, ArrowUpRight } from "lucide-react";
import { WEB_HTTP_BASE } from "./constants";
import type { FreeQuotaNoticeState } from "./use-free-quota-notice";

export function FreeQuotaNotice({ state, onRetry, compact = false }: { state: FreeQuotaNoticeState; onRetry: () => void; compact?: boolean }) {
  if (compact) return <section className="panel-limit-copy" aria-label="Free watch-party limit">
    <strong>Today's free time is used up</strong>
    <p>{state.remainingSeconds !== null ? `Renews in ${formatResetCountdown(state.remainingSeconds)}. You can still join a friend's room.` : "Checking your limit…"}</p>
  </section>;
  const ready = state.kind === "ready";
  return <section className="free-quota-notice" data-state={state.kind} aria-label="Free watch-party limit">
    <div className="free-quota-heading" role="status">
      {ready ? <Check size={17} aria-hidden="true" /> : <Clock3 size={17} aria-hidden="true" />}
      <strong>{ready ? "Free time renewed" : "Free time used up"}</strong>
    </div>
    {state.kind === "exhausted" && state.remainingSeconds !== null ?
      <div className="free-quota-countdown"><span>Renews in</span><strong role="timer" aria-live="off">{formatResetCountdown(state.remainingSeconds)}</strong></div>
      : <p>{ready ? "Your daily time is available. Create a new room to continue." : state.kind === "unavailable" ? "Connect to check when your time renews." : "Checking your limit…"}</p>}
    {!ready && <div className="free-quota-footer">
      <span>You can still join someone else's room.</span>
      {state.kind === "unavailable" ? <button type="button" className="free-quota-retry" onClick={onRetry}><RefreshCw size={13} aria-hidden="true" />Retry</button> : null}
      <a className="free-quota-plans" href={new URL("/pricing", WEB_HTTP_BASE).href} target="_blank" rel="noopener noreferrer">View plans<ArrowUpRight size={13} aria-hidden="true" /></a>
    </div>}
  </section>;
}

export function formatResetCountdown(seconds: number): string {
  const value = Math.max(0, Math.ceil(seconds));
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60].map(part => String(part).padStart(2, "0")).join(":");
}
