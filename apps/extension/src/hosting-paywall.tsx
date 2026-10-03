import { useEffect, useId, useRef } from "react";
import { ArrowUpRight, RefreshCw, X } from "lucide-react";
import { WEB_HTTP_BASE } from "./constants";
import type { HostingDisplayState } from "./use-hosting-access";
import { overlayHotkeyBoundaryProps } from "./overlay-interaction-boundary";

/** Display only. The server's create endpoint remains the hosting authority. */
export function HostingPaywall({
	state: current,
	onClose,
	onRefresh,
}: {
	state: HostingDisplayState;
	onClose(): void;
	onRefresh(): void;
}) {
	const titleId = useId();
	const dialogRef = useRef<HTMLElement>(null);
	useEffect(() => {
		const dialog = dialogRef.current;
		const root = dialog?.getRootNode() as Document | ShadowRoot | undefined;
		const previous = root?.activeElement;
		dialog?.focus({ preventScroll: true });
		return () => {
			if (previous instanceof HTMLElement && previous.isConnected)
				previous.focus({ preventScroll: true });
		};
	}, []);
	const hosting = current?.access?.hosting;
	const ready = hosting?.canHost === true;
	const eligible = !ready && hosting?.trialEligibility === "eligible";
	return (
		<section
			ref={dialogRef}
			role="dialog"
			aria-labelledby={titleId}
			tabIndex={-1}
			className="hosting-paywall"
			{...overlayHotkeyBoundaryProps}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					event.stopPropagation();
					onClose();
				}
			}}
		>
			<div className="hosting-paywall-heading">
				<strong id={titleId}>
					{ready
						? "Your account can create rooms"
						: "Host your own watch party"}
				</strong>
				<button
					type="button"
					className="hosting-paywall-close"
					aria-label="Close plan offer"
					onClick={onClose}
				>
					<X size={16} aria-hidden="true" />
				</button>
			</div>
			<p>
				{ready
					? "Your hosting access is up to date. Close this window and create a room when you’re ready."
					: "Join friends’ rooms for free. To create your own room, choose Plus or Pro."}
			</p>
			<div className="hosting-paywall-status" role="status">
				{eligible ? (
					<p>
						Try Plus or Pro with a 3-day free trial. Card required. Your
						selected plan renews automatically after the trial unless you cancel
						before it ends.
					</p>
				) : current?.error ? (
					<p>
						Could not check your current plan. You can review your options on
						the plans page.
					</p>
				) : current?.busy || !current ? (
					<p>Checking your plan…</p>
				) : !ready && hosting?.trialEligibility === "existing_account" ? (
					<p>
						Check trial availability on the plans page, or refresh your plan.
					</p>
				) : !ready && hosting?.trialEligibility === "used" ? (
					<p>
						You’ve already used your trial. Choose a paid plan to host again.
					</p>
				) : null}
			</div>
			<div className="hosting-paywall-actions">
				{ready ? (
					<button type="button" className="free-quota-plans" onClick={onClose}>
						Back to rooms
					</button>
				) : (
					<a
						className="free-quota-plans"
						href={new URL("/pricing", WEB_HTTP_BASE).href}
						target="_blank"
						rel="noopener noreferrer"
					>
						Choose a plan
						<ArrowUpRight size={13} aria-hidden="true" />
					</a>
				)}
				<button
					type="button"
					className="free-quota-retry"
					aria-label="Refresh hosting access"
					disabled={current?.busy === true}
					onClick={onRefresh}
				>
					<RefreshCw size={13} aria-hidden="true" />
					Refresh
				</button>
			</div>
		</section>
	);
}
