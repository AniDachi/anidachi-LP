import { useRef } from "react";
import { WEB_HTTP_BASE } from "./constants";
import { overlayHotkeyBoundaryProps, overlayInteractionBoundaryProps } from "./overlay-interaction-boundary";

export function Free20WarningNotice({ onDismiss, restoreFocus }: { onDismiss(): void; restoreFocus(): void }) {
  const notice = useRef<HTMLElement>(null);
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
  return <aside ref={notice} className="free20-warning-notice" aria-label="Hosting time warning"
    {...overlayHotkeyBoundaryProps} {...overlayInteractionBoundaryProps}
    onKeyDown={event => {
      if (event.key === "Escape" && holdsFocus()) { event.preventDefault(); dismiss(); }
      overlayInteractionBoundaryProps.onKeyDown(event);
    }}>
    <div role="status" aria-live="polite" aria-atomic="true">Free hosting time is running low</div>
    <div className="free20-warning-actions">
      <a href={new URL("/account/billing", WEB_HTTP_BASE).href} target="_blank" rel="noopener noreferrer" onClick={onDismiss}>View plans</a>
      <button type="button" aria-label="Dismiss hosting time warning" onClick={dismiss}>Dismiss</button>
    </div>
  </aside>;
}
