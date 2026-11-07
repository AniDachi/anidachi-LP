import { useRef } from "react";
import { ArrowUpRight, Clock3, X } from "lucide-react";
import { WEB_HTTP_BASE } from "./constants";
import { overlayHotkeyBoundaryProps, overlayInteractionBoundaryProps } from "./overlay-interaction-boundary";

export type Free20WarningNoticeProps = {
  kind: "warning" | "closed";
  remainingSeconds: number | null;
  open: boolean;
  onDismiss(): void;
  restoreFocus(): void;
};

/** Presentation only: the room clock and terminal event own these values. */
export function Free20WarningNotice({ kind, remainingSeconds, open, onDismiss, restoreFocus }: Free20WarningNoticeProps) {
  const notice = useRef<HTMLElement>(null);
  const seconds = remainingSeconds !== null && Number.isFinite(remainingSeconds) && remainingSeconds >= 0
    ? Math.ceil(remainingSeconds) : null;
  const minutesText = seconds === null ? "--" : String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsText = seconds === null ? "--" : String(seconds % 60).padStart(2, "0");
  const holdsFocus = () => {
    const element = notice.current;
    const tree = element?.getRootNode();
    const focused = tree instanceof ShadowRoot ? tree.activeElement : document.activeElement;
    return focused !== null && element?.contains(focused);
  };
  const dismiss = () => {
    const heldFocus = holdsFocus();
    onDismiss();
    if (heldFocus) restoreFocus();
  };
  return <aside ref={notice} className="free20-warning-notice" aria-label={kind === "warning" ? "Hosting time warning" : "Room closed notification"}
    data-kind={kind} data-open={open} data-urgent={kind === "warning" && seconds !== null && seconds > 0 && seconds <= 60}
    inert={!open} aria-hidden={!open || undefined}
    {...overlayHotkeyBoundaryProps} {...overlayInteractionBoundaryProps}
    onKeyDown={event => {
      if (event.key === "Escape" && holdsFocus()) { event.preventDefault(); dismiss(); }
      overlayInteractionBoundaryProps.onKeyDown(event);
    }}>
    <span className="free20-notice-announcement" role="status" aria-live="polite" aria-atomic="true">
      {open ? kind === "warning" ? "Free hosting time is running low" : "Room closed. Daily limit reached." : ""}
    </span>
    <div className="free20-notice-layout">
      <div className="free20-notice-sleeve">
        <button className="free20-notice-dismiss" type="button"
          aria-label={kind === "warning" ? "Dismiss hosting time warning" : "Dismiss room closed notification"} onClick={dismiss}>
          <X size={14} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
      <div className="free20-notice-message-clip">
        <div className="free20-notice-message">
          <div className="free20-notice-copy">
            {kind === "warning" ? <>
              <span className="free20-notice-timer" role="timer" aria-live="off"
                aria-label={seconds === null ? "Remaining time unavailable" : `${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds left today`}>
                <Clock3 className="free20-notice-clock" size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="free20-notice-digits" aria-hidden="true"><span>{minutesText}</span><span className="free20-notice-colon">:</span><span>{secondsText}</span></span>
              </span>
              <span className="free20-notice-context" aria-hidden="true">left today</span>
            </> : <>
              <Clock3 className="free20-notice-clock" size={18} strokeWidth={1.65} aria-hidden="true" />
              <span className="free20-notice-context" aria-hidden="true"><strong>Room closed</strong><span>Daily limit reached</span></span>
            </>}
          </div>
          <a className="free20-notice-plans" href={new URL("/pricing", WEB_HTTP_BASE).href} target="_blank" rel="noopener noreferrer"
            aria-label="View plans" title={kind === "warning" ? "View plans to keep your room going" : "View plans for more room time"} onClick={onDismiss}>
            <span>View plans</span><ArrowUpRight size={11} strokeWidth={1.5} aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  </aside>;
}
