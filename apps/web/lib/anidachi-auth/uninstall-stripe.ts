import type Stripe from "stripe";
import { verifiedBillingPrice } from "./billing-price";
import type { UninstallPlan } from "./uninstall-offer";

export const UNINSTALL_FIRST_CAMPAIGN = "uninstall_first_month_2026";
export const UNINSTALL_RENEWAL_CAMPAIGN = "uninstall_renewal_2026";
export const UNINSTALL_CHECKOUT_POLICY = "uninstall_first_month_v1";
export const UNINSTALL_REQUEST = {
	timeout: 8000,
	maxNetworkRetries: 0,
} as const;
export const stripeObjectId = (
	value: string | { id: string } | null | undefined,
) => (typeof value === "string" ? value : value?.id);
export type UninstallCatalog = Record<UninstallPlan, Stripe.Price>;
export function verifyUninstallCatalog(
	prices: Stripe.Price[],
	ids: string[],
): UninstallCatalog {
	if (prices.length !== 2 || new Set(ids).size !== 2)
		throw new Error("Offer catalog unavailable.");
	prices.forEach((price, i) => {
		const verified = verifiedBillingPrice(
			price,
			ids[i],
			false,
			true,
			"monthly",
		);
		if (verified.unitAmount <= 0) throw new Error("Offer catalog unavailable.");
	});
	if (
		prices.some((p) => !stripeObjectId(p.product)) ||
		new Set(prices.map((p) => stripeObjectId(p.product))).size !== 2
	)
		throw new Error("Offer product scope unavailable.");
	return { plus: prices[0], pro: prices[1] };
}
export function verifyUninstallCoupon(
	coupon: Stripe.Coupon,
	couponId: string,
	campaign: string,
	catalog: UninstallCatalog,
	requireValid = true,
) {
	const products = Object.values(catalog).map(
		(p) => stripeObjectId(p.product) ?? "",
	);
	if (
		coupon.id !== couponId ||
		coupon.livemode ||
		(requireValid && !coupon.valid) ||
		coupon.percent_off !== 40 ||
		coupon.amount_off !== null ||
		coupon.duration !== "once" ||
		coupon.redeem_by !== null ||
		coupon.max_redemptions !== null ||
		coupon.metadata?.anidachiCampaign !== campaign ||
		coupon.applies_to?.products.length !== 2 ||
		!products.every((p) => coupon.applies_to?.products.includes(p))
	)
		throw new Error("Offer coupon unavailable.");
}
export function verifyUninstallCustomer(
	customer: Stripe.Customer | Stripe.DeletedCustomer,
	customerId: string,
	userId: string,
) {
	if (
		customer.deleted ||
		customer.id !== customerId ||
		customer.livemode ||
		customer.metadata.userId !== userId
	)
		throw new Error("Offer customer ownership unavailable.");
	return customer;
}
/** A positive paid invoice counts even when settled by credit or later refunded. */
export function hasPositiveSubscriptionInvoice(
	invoices: Stripe.ApiList<Stripe.Invoice>,
	customerId: string,
): boolean {
	if (invoices.has_more) throw new Error("Offer invoice history incomplete.");
	for (const invoice of invoices.data) {
		if (
			stripeObjectId(invoice.customer) !== customerId ||
			invoice.livemode ||
			invoice.status !== "paid" ||
			!Number.isSafeInteger(invoice.total)
		)
			throw new Error("Offer invoice history unavailable.");
	}
	return invoices.data.some(
		(i) => i.total > 0 && !!i.parent?.subscription_details?.subscription,
	);
}
export function renewalIneligibility(
	sub: Stripe.Subscription,
	catalog: UninstallCatalog,
	customer: Stripe.Customer,
	userId: string,
): string | null {
	if (
		stripeObjectId(sub.customer) !== customer.id ||
		sub.metadata.userId !== userId ||
		sub.livemode
	)
		throw new Error("Subscription owner mismatch.");
	if (sub.status !== "active")
		return "This offer requires an active paid monthly subscription.";
	if (sub.cancel_at_period_end || sub.cancel_at)
		return "Renewal is canceled. You can manage your subscription below.";
	if (
		sub.schedule ||
		sub.pending_update ||
		sub.pause_collection ||
		sub.pending_invoice_item_interval ||
		sub.billing_thresholds
	)
		return "A pending subscription change prevents this offer.";
	if (
		sub.discounts.length ||
		customer.discount ||
		sub.items.data.some((i) => i.discounts.length)
	)
		return "This subscription already has a discount.";
	const item = sub.items.data[0];
	if (
		sub.items.has_more ||
		sub.items.data.length !== 1 ||
		item.quantity !== 1 ||
		item.billing_thresholds ||
		!Object.values(catalog).some((p) => p.id === item.price.id) ||
		item.price.recurring?.interval !== "month" ||
		item.price.recurring.interval_count !== 1
	)
		return "This offer is available only for monthly Plus or Pro.";
	if (
		!Number.isSafeInteger(item.current_period_end) ||
		!Number.isSafeInteger(item.current_period_start)
	)
		throw new Error("Renewal date unavailable.");
	return null;
}
