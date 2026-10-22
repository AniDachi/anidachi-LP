import type Stripe from "stripe";
import type { BillingPromotion } from "../billing-view";
import { PRODUCT_HUNT_CAMPAIGN } from "./product-hunt-promo";

/** Display only. Stripe remains the authority for invoices, tax and credits. */
export function productHuntBillingSnapshot(
	sub: Stripe.Subscription,
	expected: {
		userId: string;
		customerId: string;
		priceId: string;
		livemode: boolean;
		now: number;
	},
): BillingPromotion | undefined {
	const customer =
		typeof sub.customer === "string" ? sub.customer : sub.customer.id;
	const item = sub.items.data[0];
	if (
		customer !== expected.customerId ||
		sub.livemode !== expected.livemode ||
		(sub.metadata.userId && sub.metadata.userId !== expected.userId) ||
		sub.items.has_more ||
		sub.items.data.length !== 1 ||
		item.price.id !== expected.priceId ||
		item.quantity !== 1
	)
		throw new Error("Promotion subscription changed.");
	const discounts = [...(sub.discounts ?? []), ...(item.discounts ?? [])];
	if (discounts.some((d) => typeof d === "string"))
		throw new Error("Promotion discount unverified.");
	const active = (discounts as Stripe.Discount[]).filter(
		(d) => !d.end || d.end * 1000 > expected.now,
	);
	if (!active.length) return undefined;
	const d = active[0];
	if (
		active.length !== 1 ||
		d.coupon.metadata?.anidachiCampaign !== PRODUCT_HUNT_CAMPAIGN ||
		d.coupon.percent_off !== 40 ||
		d.coupon.duration !== "repeating" ||
		d.coupon.duration_in_months !== 3 ||
		!d.end ||
		!Number.isSafeInteger(d.end) ||
		!Number.isSafeInteger(item.current_period_end) ||
		item.price.currency !== "usd" ||
		!Number.isSafeInteger(item.price.unit_amount) ||
		item.price.recurring?.interval !== "month" ||
		item.price.recurring.interval_count !== 1
	)
		throw new Error("Promotion terms unverified.");
	const amount = item.price.unit_amount!;
	return {
		state: "active",
		percentOff: 40,
		endsAt: new Date(d.end * 1000).toISOString(),
		nextPrice: {
			unitAmount:
				item.current_period_end < d.end
					? amount - Math.round(amount * 0.4)
					: amount,
			currency: "usd",
			billingPeriod: "monthly",
		},
	};
}
