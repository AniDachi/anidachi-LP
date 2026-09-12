import type { PlanCode } from "@anidachi/protocol";

export const BILLING_OWNER_HEADER = "X-Anidachi-Billing-Owner";

export type BillingSubscription = {
	id: string;
	planCode: PlanCode;
	status: string;
	currentPeriodEnd: string | null;
	cancelAtPeriodEnd: boolean;
	canCancel: boolean;
};

export type BillingOverview = {
	ownerUserId: string;
	planCode: PlanCode;
	subscriptions: BillingSubscription[];
};

export function subscriptionStatusLabel(
	subscription: BillingSubscription,
): string {
	if (subscription.cancelAtPeriodEnd && subscription.status !== "canceled") {
		return "Renewal canceled";
	}
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
	if (subscription.cancelAtPeriodEnd) return "Subscription ends";
	if (subscription.status === "trialing") return "Trial ends";
	if (subscription.status === "active") return "Renews";
	return "Billing period ends";
}
