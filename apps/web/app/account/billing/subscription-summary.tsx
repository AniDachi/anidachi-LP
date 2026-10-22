"use client";

import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useBillingTimeZone } from "./use-billing-time-zone";
import { useEffect, useRef, type ReactNode } from "react";
import {
	billingPeriodUnit,
	formatBillingTime,
	subscriptionStatusLabel,
	formatMonthlyPrice,
	type BillingSubscription,
} from "@/lib/billing-view";

/** Shared presentation only: status and actions still come from the billing owner. */
export function BillingSummaryCard({
	status,
	plan,
	primary,
	secondary,
	note,
	actionTitle,
	actionDescription,
	children,
	hidden = false,
}: {
	status: string;
	plan: string;
	primary: ReactNode;
	secondary?: ReactNode;
	note?: ReactNode;
	actionTitle: string;
	actionDescription: ReactNode;
	children: ReactNode;
	hidden?: boolean;
}) {
	return (
		<div className="billing-summary-card" hidden={hidden}>
			<div className="billing-summary-details">
				<p className="billing-summary-status">{status}</p>
				<h2
					className={`billing-summary-plan${plan === "Free" ? " billing-summary-plan-free" : ""}`}
				>
					{plan}
					<span className="sr-only"> subscription</span>
				</h2>
				<p className="billing-summary-primary">{primary}</p>
				{secondary && <p className="billing-summary-secondary">{secondary}</p>}
				{note && <p className="billing-summary-note">{note}</p>}
			</div>
			<div className="billing-summary-action">
				<h3>{actionTitle}</h3>
				<p>{actionDescription}</p>
				{children}
			</div>
		</div>
	);
}

export function SubscriptionSummary({
	subscription: s,
	accountPlan,
	busy,
	onManage,
	onRefresh,
	onPayment,
	hidden = false,
}: {
	subscription: BillingSubscription;
	accountPlan: BillingSubscription["planCode"];
	busy: boolean;
	onManage: () => void;
	onRefresh: () => void;
	onPayment?: () => void;
	hidden?: boolean;
}) {
	const timeZone = useBillingTimeZone();
	const trial = s.trial?.stage === "trial" ? s.trial : undefined;
	const paid = s.status === "active" && (!s.trial || s.trial.stage === "paid");
	const processing = s.trial?.stage === "processing";
	const attention =
		s.trial?.stage === "payment_required" ||
		["past_due", "unpaid", "incomplete"].includes(s.status);
	const pending =
		Boolean(s.trial?.pendingRenewal) || s.trial?.renewalState === "pending";
	const off = s.cancelAtPeriodEnd;
	const names = { free: "Free", plus: "Plus", pro: "Pro" };
	const plan = names[s.planCode];
	const rawDate = trial?.endsAt ?? s.currentPeriodEnd;
	const date =
		rawDate && Number.isFinite(Date.parse(rawDate)) ? new Date(rawDate) : null;
	const dateText = date
		? new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone }).format(
				date,
			)
		: "Date unavailable";
	const time = date
		? new Intl.DateTimeFormat("en", {
				hour: "numeric",
				minute: "2-digit",
				timeZoneName: "short",
				timeZone,
			}).format(date)
		: "";
	const price = s.promotion
		? s.promotion.nextPrice
		: (s.price ?? s.monthlyPrice);
	const enabled =
		trial?.mode === "cardless"
			? trial.renewalEnabled || trial.renewalState === "enabled"
			: Boolean(trial && !off);
	const status = trial
		? "Free trial"
		: paid
			? off
				? "Renewal off"
				: "Active subscription"
			: subscriptionStatusLabel(s);
	const secondary = trial
		? `${time} · Your local time`
		: paid
			? `${off ? "Paid until" : "Next payment"} · ${dateText}`
			: `Current account access: ${names[accountPlan]}.`;
	const note = pending
		? "A renewal change is being confirmed."
		: trial
			? enabled
				? "Renewal is enabled. Your first payment is scheduled for the end of your trial."
				: "No automatic charges."
			: paid
				? off
					? `No further renewal payments. ${plan} stays active until this date.`
					: "Renews automatically. Cancel anytime."
				: processing
					? "Your first payment is being confirmed."
					: attention
						? "Payment has not been completed."
						: s.trial?.stage === "ended"
							? "Your trial has ended."
							: s.status === "paused"
								? "This subscription is paused."
								: "Refresh your status or contact support for help.";
	const actionTitle = pending
		? "Renewal pending"
		: trial
			? enabled
				? "Manage your renewal"
				: "Keep watching together"
			: paid
				? "Manage your plan"
				: processing
					? "Confirming your payment"
					: onPayment
						? "Complete your payment"
						: "Check your subscription";
	const actionDescription = pending
		? "Review the pending change and check its status."
		: trial
			? enabled
				? "Review or cancel your renewal before the trial ends."
				: `Keep ${plan} after your trial.`
			: paid
				? "Manage renewal and billing preferences."
				: processing
					? `Temporary access lasts at most until ${formatBillingTime(s.trial!.pendingUntil, timeZone)}. This is not yet a paid period.`
					: onPayment
						? `Complete payment in Stripe to activate ${plan}.`
						: accountPlan === "free"
							? "You can still join friends for free."
							: `Your current account access is ${names[accountPlan]}.`;
	const manageFirst = pending || Boolean(trial) || paid;
	const action = manageFirst ? onManage : (onPayment ?? onRefresh);
	const actionLabel = pending
		? "View renewal status"
		: trial
			? enabled
				? "Manage renewal"
				: trial.mode === "cardless"
					? "Set up renewal"
					: "Manage trial"
			: paid
				? "Manage subscription"
				: onPayment
					? "Complete payment in Stripe"
					: "Refresh status";
	return (
		<BillingSummaryCard
			status={status}
			plan={plan}
			hidden={hidden}
			primary={
				trial ? (
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
				)
			}
			secondary={secondary}
			note={
				<>
					{note}
					{s.promotion?.state === "active" && (
						<span className="billing-summary-access">
							40% off your first 3 months.
							{(s.price ?? s.monthlyPrice) ? (
								<>
									{" "}
									Then {formatMonthlyPrice((s.price ?? s.monthlyPrice)!)} /
									month.
								</>
							) : (
								" Then the regular monthly price."
							)}
						</span>
					)}
					{s.promotion?.state === "unavailable" && (
						<span className="billing-summary-access">
							Refresh to check your discount and next payment.
						</span>
					)}
					{(trial || paid) && accountPlan !== s.planCode && (
						<span className="billing-summary-access">
							Current account access: {names[accountPlan]}.
						</span>
					)}
				</>
			}
			actionTitle={actionTitle}
			actionDescription={actionDescription}
		>
			<button
				className="billing-summary-button"
				type="button"
				disabled={busy}
				onClick={action}
				data-billing-manage={manageFirst ? "" : undefined}
			>
				{actionLabel}{" "}
				{!manageFirst && onPayment ? (
					<ExternalLink size={19} aria-hidden />
				) : !manageFirst ? (
					<RefreshCw size={19} aria-hidden />
				) : (
					<ArrowRight size={20} aria-hidden />
				)}
			</button>
			{!manageFirst && (
				<button
					className="billing-summary-secondary-action"
					data-billing-manage=""
					type="button"
					disabled={busy}
					onClick={onManage}
				>
					View billing details <ArrowRight size={16} aria-hidden />
				</button>
			)}
		</BillingSummaryCard>
	);
}

/** The approved card opens existing controls; it never creates a payment session. */
export function SubscriptionPresentation({
	subscription,
	busy,
	open,
	onOpenChange,
	children,
	accountPlan,
	onRefresh,
	onPayment,
}: {
	subscription: BillingSubscription;
	busy: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
	accountPlan: BillingSubscription["planCode"];
	onRefresh: () => void;
	onPayment?: () => void;
}) {
	const details = useRef<HTMLDetailsElement>(null);
	const wasOpen = useRef(open);
	useEffect(() => {
		if (open) details.current?.querySelector("summary")?.focus();
		else if (wasOpen.current)
			details.current?.previousElementSibling
				?.querySelector<HTMLButtonElement>("[data-billing-manage]")
				?.focus();
		wasOpen.current = open;
	}, [open]);
	const cardless =
		subscription.trial?.mode === "cardless" &&
		(subscription.trial.stage === "trial" ||
			Boolean(subscription.trial.pendingRenewal));
	return (
		<>
			<SubscriptionSummary
				subscription={subscription}
				accountPlan={accountPlan}
				onRefresh={onRefresh}
				onPayment={onPayment}
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
					className={`billing-summary-management-body${cardless ? "" : " billing-paid-management"}`}
				>
					{!cardless && (
						<header className="billing-management-heading">
							<p className="billing-summary-status">
								{subscriptionStatusLabel(subscription)}
							</p>
							<h2>
								{subscription.planCode === "pro"
									? "Pro"
									: subscription.planCode === "plus"
										? "Plus"
										: "Free"}{" "}
								subscription
							</h2>
						</header>
					)}
					{accountPlan !== subscription.planCode && (
						<p className="billing-management-access">
							Current account access:{" "}
							{accountPlan === "pro"
								? "Pro"
								: accountPlan === "plus"
									? "Plus"
									: "Free"}
							.
						</p>
					)}
					{children}
				</div>
			</details>
		</>
	);
}

/** Shown only when the account is Free and has no unresolved subscription. */
export function EndedTrialSummary() {
	return (
		<section className="billing-ended" aria-label="Trial ended">
			<div className="billing-ended-message">
				<h2>
					Your <span>trial</span> has ended.
				</h2>
				<p>Choose Plus or Pro to create rooms again.</p>
				<Link
					className="billing-summary-button billing-ended-button"
					href="/pricing"
				>
					Choose a plan <ArrowRight size={22} aria-hidden />
				</Link>
			</div>
			<div className="billing-ended-access">
				<p className="billing-ended-label">Current plan</p>
				<h3>Free</h3>
				<p className="billing-ended-note">
					You can still join friends for free.
				</p>
			</div>
		</section>
	);
}
