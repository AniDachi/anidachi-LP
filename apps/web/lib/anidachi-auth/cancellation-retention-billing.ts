import type Stripe from "stripe";
import type { BillingPromotion } from "../billing-view";
import type { CancellationOffer } from "./cancellation-retention-store";
import { verifyCancellationCoupon } from "./cancellation-retention-stripe";
import { uninstallDiscount } from "./uninstall-offer";
import { stripeObjectId } from "./uninstall-stripe";

/** Display only. Permanent allowance authority is the reconciled shared grant. */
export function cancellationBillingSnapshot(
	sub: Stripe.Subscription,
	offer: CancellationOffer,
	now: number,
	freshCoupon?: Stripe.Coupon,
): BillingPromotion | undefined {
	if (
		sub.livemode ||
		sub.id !== offer.stripe_subscription_id ||
		stripeObjectId(sub.customer) !== offer.stripe_customer_id ||
		sub.metadata.userId !== offer.user_id
	)
		throw new Error("Cancellation billing ownership unavailable.");
	if (offer.state === "expired") return undefined;
	const item = sub.items.data[0];
	const discounts = [
		...sub.discounts,
		...sub.items.data.flatMap((i) => i.discounts ?? []),
	];
	const native = discounts.find(
		(d) => typeof d !== "string" && d.coupon?.id === offer.coupon_id,
	);
	// A once coupon disappears when Stripe creates the renewal draft. Never
	// resurrect its benefit from the accepted row or permanent lifetime grant.
	if (!native) return undefined;
	if (
		typeof native === "string" ||
		discounts.length !== 1 ||
		sub.items.has_more ||
		sub.items.data.length !== 1 ||
		item.quantity !== 1
	)
		throw new Error("Cancellation billing terms unavailable.");
	const coupon = freshCoupon ?? native.coupon;
	if (coupon.id !== native.coupon.id)
		throw new Error("Cancellation billing coupon mismatch.");
	verifyCancellationCoupon(coupon, offer);
	if (coupon.times_redeemed !== 1) return undefined;
	// An already-open monthly offer can be explicitly accepted after conversion.
	// Explain its scope while showing the ordinary annual amount.
	if (
		item.price.recurring?.interval === "year" &&
		!offer.product_ids.includes(stripeObjectId(item.price.product) ?? "")
	)
		return { state: "active", campaign: "cancellation_retention" };
	if (
		sub.status !== "active" ||
		sub.cancel_at_period_end ||
		sub.cancel_at ||
		sub.pending_update ||
		sub.schedule ||
		sub.pause_collection ||
		sub.pending_invoice_item_interval ||
		sub.billing_thresholds ||
		item.billing_thresholds ||
		item.price.id !== offer.price_id ||
		!offer.product_ids.includes(stripeObjectId(item.price.product) ?? "") ||
		item.price.currency !== "usd" ||
		item.price.recurring?.interval !== "month" ||
		item.price.recurring.interval_count !== 1 ||
		item.price.recurring.usage_type !== "licensed" ||
		item.price.billing_scheme !== "per_unit" ||
		item.price.transform_quantity ||
		item.current_period_end !== offer.target_period_start ||
		offer.target_period_start * 1000 <= now ||
		!Number.isSafeInteger(item.price.unit_amount) ||
		(item.price.unit_amount ?? 0) <= 0
	)
		return undefined;
	return {
		state: "active",
		campaign: "cancellation_retention",
		percentOff: 40,
		endsAt: new Date(offer.target_period_start * 1000).toISOString(),
		nextPrice: {
			unitAmount: uninstallDiscount(item.price.unit_amount!),
			currency: "usd",
			billingPeriod: "monthly",
		},
	};
}
