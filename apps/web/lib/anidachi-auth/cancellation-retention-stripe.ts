import { resolveStripeMode } from "./stripe-env";
import type Stripe from "stripe";
import type { CancellationOffer } from "./cancellation-retention-store";

export const CANCELLATION_RETENTION_CAMPAIGN = "cancellation_retention_v1";
export const CANCELLATION_REQUEST = {
	timeout: 8000,
	maxNetworkRetries: 0,
} as const;
export function cancellationCouponParams(
	offer: CancellationOffer,
): Stripe.CouponCreateParams {
	return {
		id: offer.coupon_id,
		percent_off: 40,
		duration: "once",
		max_redemptions: 1,
		redeem_by: offer.redeem_by,
		applies_to: { products: offer.product_ids },
		expand: ["applies_to"],
		metadata: {
			anidachiCampaign: CANCELLATION_RETENTION_CAMPAIGN,
			offerId: offer.id,
			userId: offer.user_id,
			customerId: offer.stripe_customer_id,
			subscriptionId: offer.stripe_subscription_id,
			priceId: offer.price_id,
			targetPeriodStart: String(offer.target_period_start),
		},
	};
}
/** valid=false is expected after the once-only coupon reaches max_redemptions. */
export function verifyCancellationCoupon(
	coupon: Stripe.Coupon,
	offer: CancellationOffer,
	expectedLive = resolveStripeMode() === "live",
): void {
	const terms = cancellationCouponParams(offer);
	if (
		coupon.id !== offer.coupon_id ||
		coupon.livemode !== expectedLive ||
		coupon.percent_off !== 40 ||
		coupon.amount_off !== null ||
		coupon.currency !== null ||
		coupon.duration !== "once" ||
		coupon.duration_in_months !== null ||
		coupon.max_redemptions !== 1 ||
		coupon.redeem_by !== offer.redeem_by ||
		![0, 1].includes(coupon.times_redeemed) ||
		offer.product_ids.length !== 2 ||
		new Set(offer.product_ids).size !== 2 ||
		coupon.applies_to?.products.length !== 2 ||
		!offer.product_ids.every((p) => coupon.applies_to?.products.includes(p)) ||
		Object.entries(terms.metadata!).some(
			([key, value]) => coupon.metadata?.[key] !== value,
		)
	)
		throw new Error("Cancellation coupon terms changed.");
}
export function isMissingCancellationCoupon(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const e = error as { code?: string; statusCode?: number };
	return e.code === "resource_missing" && e.statusCode === 404;
}
