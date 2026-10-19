import type { HostingAccess, PlanCode } from "@anidachi/protocol";

export const BILLING_OWNER_HEADER = "X-Anidachi-Billing-Owner";

export type BillingPeriod = "monthly" | "yearly";
export type MonthlyPrice = { unitAmount: number; currency: string };
export type BillingPrice = MonthlyPrice & { billingPeriod: BillingPeriod };
export function billingPeriodUnit(period: BillingPeriod): "month" | "year" {
	return period === "yearly" ? "year" : "month";
}
export type BillingTrial = {
	mode?: "card_required" | "cardless";
	renewalState?: "not_enabled" | "pending" | "enabled";
	// Confirmed state stays visible while a newer change is unresolved.
	renewalEnabled?: boolean;
	// Latest owned, unexpired quote; read-only confirmation for retained UI terms.
	renewalQuoteId?: string;
	pendingRenewal?: {
		id: string;
		action: "enable" | "cancel";
		setupRequestId?: string;
		terms?: {
			planCode: "plus" | "pro";
			price: BillingPrice;
			firstChargeAt: string;
		};
	};
	endsAt: string;
	stage: "trial" | "processing" | "payment_required" | "ended" | "paid";
	pendingUntil: string;
};
export function formatMonthlyPrice(price: MonthlyPrice): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: price.currency,
	}).format(price.unitAmount / 100);
}
export function formatBillingTime(value: string, timeZone?: string): string {
	return new Date(value).toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
		timeZone,
	});
}

export type BillingSubscription = {
	id: string;
	planCode: PlanCode;
	status: string;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	canCancel: boolean;
	canRestoreRenewal?: boolean;
	trial?: BillingTrial;
	canChangeTrialPlan?: boolean;
	monthlyPrice?: MonthlyPrice | null;
	price?: BillingPrice | null;
	canSwitchToYearly?: boolean;
};

export type PendingTrialActivation = {
	id: string;
	planCode: "plus" | "pro";
	billingPeriod: BillingPeriod;
};

export type BillingOverview = {
	pendingTrialActivation?: PendingTrialActivation;
	ownerUserId: string;
	planCode: PlanCode;
	subscriptions: BillingSubscription[];
	hosting?: HostingAccess;
	serverTime?: string;
	selectedPlanExpiresAt?: string | null;
};

// A display lease only: expiry requires a server reread, never a local grant.
export function billingDisplayValidityMs(
	overview: BillingOverview,
	maxAgeMs = 60_000,
): number {
	const now = Date.parse(overview.serverTime ?? "");
	if (!Number.isFinite(now)) return Math.min(maxAgeMs, 60_000);
	const deadlines: number[] = [now + maxAgeMs];
	const activation = Date.parse(overview.hosting?.hostingActivationAt ?? "");
	if (activation > now) deadlines.push(activation);
	if (overview.planCode !== "free" && overview.selectedPlanExpiresAt)
		deadlines.push(Date.parse(overview.selectedPlanExpiresAt));
	for (const subscription of overview.subscriptions) {
		if (subscription.canRestoreRenewal)
			deadlines.push(Date.parse(subscription.currentPeriodEnd ?? ""));
		if (subscription.trial?.stage === "trial")
			deadlines.push(Date.parse(subscription.trial.endsAt));
		if (subscription.trial?.stage === "processing")
			deadlines.push(Date.parse(subscription.trial.pendingUntil));
	}
	return Math.max(0, Math.min(...deadlines) - now);
}

export function subscriptionStatusLabel(
	subscription: BillingSubscription,
): string {
	if (
		subscription.trial?.mode === "cardless" &&
		subscription.trial.stage !== "paid"
	) {
		return {
			trial: "Free trial",
			ended: "Trial ended",
			processing: "First payment processing",
			payment_required: "Payment needs attention",
		}[subscription.trial.stage];
	}
	if (subscription.cancelAtPeriodEnd && subscription.status !== "canceled") {
		return "Renewal canceled";
	}
	if (subscription.trial?.stage === "processing")
		return "First payment processing";
	if (subscription.trial?.stage === "payment_required")
		return "Payment needs attention";
	if (subscription.trial?.stage === "ended") return "Trial ended";
	if (subscription.trial?.stage === "trial") return "Free trial";
	const labels: Record<string, string> = {
		active: "Active",
		trialing: "Trial",
		past_due: "Payment overdue",
		unpaid: "Unpaid",
		canceled: "Canceled",
		incomplete: "Payment incomplete",
		incomplete_expired: "Payment expired",
		paused: "Paused",
	};
	return labels[subscription.status] ?? "Status unavailable";
}

export function subscriptionDateLabel(
	subscription: BillingSubscription,
): string {
	if (
		subscription.trial?.mode === "cardless" &&
		subscription.trial.stage !== "paid"
	)
		return "Trial ends";
	if (subscription.cancelAtPeriodEnd) return "Subscription ends";
	if (subscription.status === "trialing") return "Trial ends";
	if (subscription.status === "active") return "Renews";
	return "Billing period ends";
}
