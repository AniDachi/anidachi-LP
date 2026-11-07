import { Clock3, Check, RefreshCw, ArrowUpRight } from "lucide-react";
import { WEB_HTTP_BASE } from "./constants";
import type { FreeQuotaNoticeState } from "./use-free-quota-notice";

export type FreeQuotaRenewal = { serverTime: number; resetAt: number };

/** The server owns the instant and current date. The device supplies only its
 * local timezone; changing its wall clock cannot move the renewal boundary. */
function localRenewalLabel(renewal: FreeQuotaRenewal | null): string | null {
  if (!renewal || !Number.isFinite(renewal.serverTime) || !Number.isFinite(renewal.resetAt) ||
    renewal.serverTime >= renewal.resetAt || !Number.isFinite(new Date(renewal.resetAt).getTime()) ||
    !Number.isFinite(new Date(renewal.serverTime).getTime())) return null;
  const calendar = new Intl.DateTimeFormat('en', {year:'numeric',month:'numeric',day:'numeric'});
  const localDay = (at: number) => {
    const parts = Object.fromEntries(calendar.formatToParts(at).map(part => [part.type,part.value]));
    return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)) / 86_400_000;
  };
  const difference = localDay(renewal.resetAt) - localDay(renewal.serverTime);
  const day = difference === 0 ? 'today' : difference === 1 ? 'tomorrow'
    : new Intl.DateTimeFormat('en', {month:'short',day:'numeric'}).format(renewal.resetAt);
  const time = new Intl.DateTimeFormat('en', {hour:'numeric',minute:'2-digit',hour12:true}).format(renewal.resetAt);
  return `${day} at ${time}`;
}

export function FreeQuotaNotice({ state, onRetry, compact = false, dailyFree = false, renewal = null }: {
  state: FreeQuotaNoticeState; onRetry: () => void; compact?: boolean;
  dailyFree?: boolean; renewal?: FreeQuotaRenewal | null;
}) {
  if (compact && dailyFree) {
    const label = localRenewalLabel(renewal);
    return <section className="panel-limit-copy" data-daily-free="true" aria-label="Free watch-party limit">
      <h2>Daily limit reached</h2>
      {label ? <p>20 free minutes <strong className="panel-limit-renewal"><time dateTime={new Date(renewal!.resetAt).toISOString()}>{label}</time></strong></p>
        : <p>{state.kind === 'unavailable' ? "Couldn't check renewal time." : 'Checking renewal time…'}</p>}
      {!label && state.kind === 'unavailable' && <button type="button" className="free-quota-retry" onClick={onRetry}><RefreshCw size={13} aria-hidden="true" />Retry</button>}
    </section>;
  }
  if (compact) return <section className="panel-limit-copy" aria-label="Free watch-party limit">
    <strong>{state.kind === "unavailable" ? "Free time unavailable" : state.remainingSeconds === null ? "Checking your limit…" : "Today's free time is used up"}</strong>
    {state.kind === "unavailable" && <p>Couldn't check your free time.</p>}
    <p>{state.kind !== "unavailable" && state.remainingSeconds !== null ? `Renews in ${formatResetCountdown(state.remainingSeconds)}. ` : ""}You can still join a friend's room.</p>
    {state.kind === "unavailable" && <button type="button" className="free-quota-retry" onClick={onRetry}><RefreshCw size={13} aria-hidden="true" />Retry</button>}
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
