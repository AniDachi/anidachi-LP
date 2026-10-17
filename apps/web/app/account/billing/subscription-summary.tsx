"use client";

import { ArrowRight } from "lucide-react";
import { useRef, type ReactNode } from "react";
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
}: {
	subscription: BillingSubscription;
	busy: boolean;
	onManage: () => void;
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
	const manageTrialRenewal = Boolean(trial && (pending || enabled));
	return (
		<div className="billing-summary-card">
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
								: "No automatic charge. This trial ends on the date shown."
						: off
							? `No further renewal payments. ${plan} stays active until this date.`
							: "Renews automatically. You can cancel anytime."}
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
								: "Choose a plan to continue after your trial."
						: "Manage renewal and billing preferences."}
				</p>
				{trial && !manageTrialRenewal ? (
					<a className="billing-summary-button" href="/pricing">
						View plans <ArrowRight size={20} aria-hidden />
					</a>
				) : (
					<button
						className="billing-summary-button"
						type="button"
						disabled={busy}
						onClick={onManage}
					>
						{trial
							? pending
								? "View renewal status"
								: "Manage renewal"
							: "Manage subscription"}{" "}
						<ArrowRight size={20} aria-hidden />
					</button>
				)}
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
				onManage={() => {
					if (!details.current) return;
					onOpenChange(true);
					details.current.querySelector("summary")?.focus();
				}}
			/>
			<details
				ref={details}
				className="billing-summary-management"
				open={open}
				onToggle={(event) => onOpenChange(event.currentTarget.open)}
			>
				<summary>
					{trial ? "Manage trial renewal" : "Subscription options"}
				</summary>
				<div className="billing-summary-management-body">{children}</div>
			</details>
		</>
	);
}
