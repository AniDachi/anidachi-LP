import type Stripe from "stripe";
import { db } from "./db";
import {
	ensureProductHuntPromotion,
	type CampaignBinding,
} from "./product-hunt-promo";
import { resolveStripeMode, stripeEnvForMode } from "./stripe-env";
import { stripePriceIdForPlanCode } from "./stripe-plans";

export async function provisionProductHuntPromotion(
	stripe: Stripe,
	userId: string,
	customerId: string,
) {
	const couponId = stripeEnvForMode("STRIPE_PRODUCT_HUNT_COUPON_ID");
	if (!couponId) return;
	const priceIds = [
		stripePriceIdForPlanCode("plus"),
		stripePriceIdForPlanCode("pro"),
	];
	if (priceIds.some((p) => !p))
		throw new Error("Promotion catalog unavailable.");
	await ensureProductHuntPromotion(
		{ userId, customerId },
		{
			stripe,
			couponId,
			livemode: resolveStripeMode() === "live",
			monthlyPriceIds: priceIds as string[],
			async accountHistory(owner) {
				const [subs, trials] = await Promise.all([
					db()
						.from("subscriptions")
						.select("stripe_customer_id")
						.eq("user_id", owner)
						.limit(101)
						.abortSignal(AbortSignal.timeout(10_000)),
					db()
						.from("account_subscription_trials")
						.select("first_paid_at,first_cash_paid_at")
						.eq("user_id", owner)
						.limit(101)
						.abortSignal(AbortSignal.timeout(10_000)),
				]);
				if (
					subs.error ||
					trials.error ||
					!subs.data ||
					!trials.data ||
					subs.data.length > 100 ||
					trials.data.length > 100
				)
					throw new Error("Promotion history unavailable.");
				return {
					customerIds: subs.data.map((row) => row.stripe_customer_id),
					hasPaid: trials.data.some(
						(row) => row.first_paid_at || row.first_cash_paid_at,
					),
				};
			},
			async claim(owner, customer, coupon) {
				const { data, error } = await db()
					.rpc("claim_product_hunt_promotion_v1", {
						p_user_id: owner,
						p_customer_id: customer,
						p_coupon_id: coupon,
					})
					.abortSignal(AbortSignal.timeout(10_000));
				if (error || !data) throw new Error("Promotion binding unavailable.");
				return data as CampaignBinding;
			},
		},
	);
}
