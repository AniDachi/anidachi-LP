import type { BillingPromotion } from "../billing-view";
import { db, type SubscriptionRow } from "./db";
import { productHuntBillingSnapshot } from "./product-hunt-billing";
import { PRODUCT_HUNT_CAMPAIGN } from "./product-hunt-promo";
import { createStripeClient, resolveStripeMode } from "./stripe-env";

export async function readProductHuntBilling(
	userId: string,
	rows: SubscriptionRow[],
): Promise<Record<string, BillingPromotion | undefined>> {
	const current = rows.filter((row) =>
		["active", "past_due", "unpaid", "incomplete"].includes(row.status),
	);
	if (!current.length) return {};
	const unavailable = Object.fromEntries(
		current.map((row) => [row.id, { state: "unavailable" as const }]),
	);
	try {
		const { data: binding, error } = await db()
			.from("subscription_campaign_bindings")
			.select("user_id,stripe_customer_id")
			.eq("campaign", PRODUCT_HUNT_CAMPAIGN)
			.eq("user_id", userId)
			.abortSignal(AbortSignal.timeout(8000))
			.maybeSingle();
		if (error) return unavailable;
		if (!binding) return {};
		if (binding.user_id !== userId || current.length > 2) return unavailable;
		const stripe = createStripeClient();
		return Object.fromEntries(
			await Promise.all(
				current.map(async (row) => {
					if (row.stripe_customer_id !== binding.stripe_customer_id)
						throw new Error("Promotion owner mismatch.");
					const sub = await stripe.subscriptions.retrieve(
						row.stripe_subscription_id,
						{ expand: ["discounts", "items.data.discounts"] },
						{ timeout: 8000, maxNetworkRetries: 0 },
					);
					if (sub.id !== row.stripe_subscription_id)
						throw new Error("Promotion subscription mismatch.");
					return [
						row.id,
						productHuntBillingSnapshot(sub, {
							userId,
							customerId: binding.stripe_customer_id,
							priceId: row.stripe_price_id,
							livemode: resolveStripeMode() === "live",
							now: Date.now(),
						}),
					];
				}),
			),
		);
	} catch {
		return unavailable;
	}
}
