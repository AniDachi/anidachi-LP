import { useEffect, useId, useRef } from "react";
import { ArrowUpRight, Check, CircleAlert, RefreshCw, UsersRound, X } from "lucide-react";
import { getHostingOfferUrl } from "./hosting-offer-link";
import type { HostingDisplayState } from "./use-hosting-access";
import { overlayHotkeyBoundaryProps } from "./overlay-interaction-boundary";

export function getHostingNoticeKind(current: HostingDisplayState) {
  if (current.error) return "error";
  if (current.busy || !current.access) return "checking";
  const { hosting, hostingOffer, serverTime } = current.access;
  if (!hosting) return "unverified";
  if (hosting.canHost) return "ready";
  if (current.mode !== "paid-hosting") return "unverified";
  if (hosting.trialEligibility === "eligible") {
    return hostingOffer?.trialMode === "cardless" &&
      hostingOffer.policyRevision === hosting.hostingPolicyVersion
      ? "cardless" : "eligible";
  }
  if (hosting.trialEligibility === "used" && hosting.trialEndsAt &&
    Date.parse(hosting.trialEndsAt) <= Date.parse(serverTime)) return "ended";
  return "plans";
}

const titles = {
  cardless: "Host your next watch party",
  eligible: "Host your next watch party",
  ended: "Your trial has ended",
  plans: "Host your next watch party",
  ready: "You’re ready to host",
  error: "Couldn’t check your access",
  unverified: "Check your hosting access",
  checking: "Checking your access…",
};

/** Display only. The create endpoint and website remain the access/trial authority. */
export function HostingPaywall({ state: current, onClose, onRefresh }: {
  state: HostingDisplayState;
  onClose(): void;
  onRefresh(): void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = (dialog?.getRootNode() as Document | ShadowRoot | undefined)?.activeElement;
    dialog?.focus({ preventScroll: true });
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);
  const kind = getHostingNoticeKind(current);
  const retry = kind === "error" || kind === "unverified";
  const checking = kind === "checking";
  const ready = kind === "ready";
  return (
    <section ref={dialogRef} role="dialog" aria-labelledby={titleId}
      aria-describedby={descriptionId} aria-busy={checking} tabIndex={-1}
      className="hosting-notice" {...overlayHotkeyBoundaryProps}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault(); event.stopPropagation(); onClose();
        }
      }}>
      <div className="hosting-notice-top">
        {retry ? <CircleAlert className="hosting-notice-symbol neutral" size={23} strokeWidth={1.6} aria-hidden="true" />
          : ready ? <Check className="hosting-notice-symbol" size={25} strokeWidth={1.6} aria-hidden="true" />
          : <UsersRound className="hosting-notice-symbol" size={25} strokeWidth={1.6} aria-hidden="true" />}
        <button className="hosting-notice-close" type="button" aria-label="Close plan offer" onClick={onClose}>
          <X size={17} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
      <div role="status" aria-live="polite">
        <h2 id={titleId}>{titles[kind]}</h2>
        <div id={descriptionId} className="hosting-notice-description">
          {kind === "cardless" ? <>
            <p>Try <strong>Plus</strong> free for 3 days.</p>
            <p className="hosting-notice-terms">No card required.<br />No automatic charge.</p>
          </> : kind === "eligible" ? <>
            <p>Explore <strong>Plus</strong> and <strong>Pro</strong> to host your own watch parties.</p>
            <p className="hosting-notice-terms">Review your trial offer and terms on the plans page.</p>
          </> : <p>{kind === "ended" ? "Choose a plan to keep creating rooms and watching with friends."
            : kind === "error" ? "Please try again. Your subscription hasn’t changed."
            : kind === "unverified" ? "Refresh your access to see the options available to your account."
            : ready ? "Your hosting access is up to date. Create a room when you’re ready."
            : checking ? "Getting the latest status for your account."
            : "Choose Plus or Pro to create rooms and watch with friends."}</p>}
        </div>
      </div>
      {retry || ready || checking ? (
        <button className="hosting-notice-primary" type="button" disabled={checking}
          onClick={ready ? onClose : onRefresh} aria-label={retry ? "Refresh hosting access" : undefined}>
          <span>{ready ? "Back to rooms" : checking ? "Checking…" : "Try again"}</span>
          {retry && <RefreshCw size={16} strokeWidth={1.8} aria-hidden="true" />}
        </button>
      ) : (
        <a className="hosting-notice-primary" href={getHostingOfferUrl(kind === "cardless" ? "trial" : "plans")}
          target="_blank" rel="noopener noreferrer">
          <span>{kind === "cardless" ? "Try 3 days free" : "View plans"}</span>
          <ArrowUpRight size={18} strokeWidth={1.8} aria-hidden="true" />
        </a>
      )}
      {!retry && !checking && !ready && <p className="hosting-notice-footer">You can still join friends for free.</p>}
    </section>
  );
}
