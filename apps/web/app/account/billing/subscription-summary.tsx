"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import {
	billingPeriodUnit,
	formatMonthlyPrice,
	type BillingSubscription,
} from "@/lib/billing-view";

export function hasSubscriptionSummary(s: BillingSubscription) {
	return (
		(s.trial?.mode === "cardless" && s.trial.stage === "trial") ||
		(s.status === "active" && (!s.trial || s.trial.stage === "paid"))
	);
}

/** Presentation only. All billing authority and handlers stay with the caller. */
export function SubscriptionSummary({
	subscription: s,
	busy,
	onManage,
	hidden = false,
}: {
	subscription: BillingSubscription;
	busy: boolean;
	onManage: () => void;
	hidden?: boolean;
}) {
	const trial = s.trial?.stage === "trial" ? s.trial : undefined;
	const off = s.cancelAtPeriodEnd;
	const plan =
		s.planCode === "pro" ? "Pro" : s.planCode === "plus" ? "Plus" : "Free";
	const rawDate = trial?.endsAt ?? s.currentPeriodEnd;
	const date =
		rawDate && Number.isFinite(Date.parse(rawDate)) ? new Date(rawDate) : null;
	const dateText = date
		? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(date)
		: "Date unavailable";
	const time = date
		? new Intl.DateTimeFormat("en", {
				hour: "numeric",
				minute: "2-digit",
				timeZoneName: "short",
			}).format(date)
		: "";
	const price = s.price ?? s.monthlyPrice;
	const pending =
		Boolean(trial?.pendingRenewal) || trial?.renewalState === "pending";
	const enabled = trial?.renewalEnabled || trial?.renewalState === "enabled";
	return (
		<div className="billing-summary-card" hidden={hidden}>
			<div className="billing-summary-details">
				<p className="billing-summary-status">
					{trial ? "Free trial" : off ? "Renewal off" : "Active subscription"}
				</p>
				<h2 className="billing-summary-plan">
					{plan}
					<span className="sr-only"> subscription</span>
				</h2>
				<p className="billing-summary-primary">
					{trial ? (
						`Active until ${dateText}`
					) : price ? (
						<>
							{formatMonthlyPrice(price)}
							<span>
								{" "}
								/ {billingPeriodUnit(s.price?.billingPeriod ?? "monthly")}
							</span>
						</>
					) : (
						"Amount unavailable"
					)}
				</p>
				<p className="billing-summary-secondary">
					{trial
						? `${time} · Your local time`
						: `${off ? "Paid until" : "Next payment"} · ${dateText}`}
				</p>
				<p className="billing-summary-note">
					{trial
						? pending
							? "A renewal change is being confirmed. Check its status below."
							: enabled
								? "Renewal is enabled. Your first payment is scheduled for the end of your trial."
								: "No automatic charges."
						: off
							? `No further renewal payments. ${plan} stays active until this date.`
							: "Renews automatically. Cancel anytime."}
				</p>
			</div>
			<div className="billing-summary-action">
				<h3>
					{trial
						? pending
							? "Renewal pending"
							: enabled
								? "Manage your renewal"
								: "Keep watching together"
						: "Manage your plan"}
				</h3>
				<p>
					{trial
						? pending
							? "Review the pending change and check its status."
							: enabled
								? "Review or cancel your renewal before the trial ends."
								: `Keep ${plan} after your trial.`
						: "Manage renewal and billing preferences."}
				</p>
				<button
					className="billing-summary-button"
					type="button"
					disabled={busy}
					onClick={onManage}
				>
					{trial
						? pending
							? "View renewal status"
							: enabled
								? "Manage renewal"
								: "Set up renewal"
						: "Manage subscription"}{" "}
					<ArrowRight size={20} aria-hidden />
				</button>
			</div>
		</div>
	);
}

/** The approved card opens existing controls; it never creates a payment session. */
export function SubscriptionPresentation({
	subscription,
	busy,
	open,
	onOpenChange,
	children,
	heading,
}: {
	subscription: BillingSubscription;
	busy: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
	heading: ReactNode;
}) {
	const details = useRef<HTMLDetailsElement>(null);
	const wasOpen = useRef(open);
	useEffect(() => {
		if (open) details.current?.querySelector("summary")?.focus();
		else if (wasOpen.current)
			details.current?.previousElementSibling?.querySelector("button")?.focus();
		wasOpen.current = open;
	}, [open]);
	if (!hasSubscriptionSummary(subscription))
		return (
			<>
				{heading}
				{children}
			</>
		);
	const trial = subscription.trial?.stage === "trial";
	return (
		<>
			<SubscriptionSummary
				subscription={subscription}
				busy={busy}
				hidden={open}
				onManage={() => {
					if (!details.current) return;
					onOpenChange(true);
				}}
			/>
			<details
				ref={details}
				className="billing-summary-management"
				open={open}
				onToggle={(event) => onOpenChange(event.currentTarget.open)}
			>
				<summary>
					<ArrowLeft size={18} aria-hidden /> Subscription
				</summary>
				<div
					className={`billing-summary-management-body${trial ? "" : " billing-paid-management"}`}
				>
					{!trial && <h2>Manage your subscription</h2>}
					{children}
				</div>
			</details>
		</>
	);
}

/** Shown only when the account is Free and has no unresolved subscription. */
export function EndedTrialSummary({
	subscription,
}: {
	subscription: BillingSubscription;
}) {
	const date = subscription.trial?.endsAt;
	const ended =
		date && Number.isFinite(Date.parse(date))
			? new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
					new Date(date),
				)
			: null;
	return (
		<section className="billing-summary-card" aria-label="Trial ended">
			<div className="billing-summary-details">
				<p className="billing-summary-status">Trial ended</p>
				<h2 className="billing-summary-plan billing-summary-plan-free">Free</h2>
				<p className="billing-summary-primary">Join friends for free</p>
				{ended && (
					<p className="billing-summary-secondary">
						Your trial ended on {ended}.
					</p>
				)}
				<p className="billing-summary-note">No automatic renewal.</p>
			</div>
			<div className="billing-summary-action">
				<h3>Host your own room</h3>
				<p>Choose Plus or Pro to start hosting.</p>
				<a className="billing-summary-button" href="/pricing">
					Choose a plan <ArrowRight size={20} aria-hidden />
				</a>
			</div>
		</section>
	);
}
