import type Stripe from "stripe";
import { verifiedBillingPrice } from "./billing-price";
import { resolveStripeMode } from "./stripe-env";
import {
	stripePlanCodeForPriceId,
	stripePriceIdForPlanCode,
} from "./stripe-plans";

const REQUEST = { timeout: 8000, maxNetworkRetries: 0 };
const unavailable = () =>
	new Error("Cancellation retention catalog unavailable");

/**
 * Verify product-scoped coupons cannot discount an annual or alternate price.
 * Read fresh before issuance; no catalog mutation and no LIVE offer support.
 */
export async function verifyCancellationCatalog(stripe: Stripe): Promise<{
	productIds: [string, string];
	monthlyPriceIds: [string, string];
}> {
	if (resolveStripeMode() !== "test") throw unavailable();
	const entries = (["monthly", "yearly"] as const).flatMap((period) =>
		(["plus", "pro"] as const).map((plan) => ({
			plan,
			period,
			priceId: stripePriceIdForPlanCode(plan, period),
		})),
	);
	if (
		entries.some(({ priceId }) => !priceId?.trim()) ||
		new Set(entries.map(({ priceId }) => priceId)).size !== 4
	)
		throw unavailable();

	const prices = await Promise.all(
		entries.map(async ({ plan, period, priceId }) => {
			const price = await stripe.prices.retrieve(priceId!, {}, REQUEST);
			const verified = verifiedBillingPrice(
				price,
				priceId!,
				false,
				true,
				period,
			);
			const productId =
				typeof price.product === "string" ? price.product : price.product?.id;
			if (
				verified.unitAmount <= 0 ||
				stripePlanCodeForPriceId(price.id) !== plan ||
				!productId?.trim() ||
				(typeof price.product !== "string" && price.product?.deleted)
			)
				throw unavailable();
			return { price, productId };
		}),
	);
	// Both plans and both periods need distinct products. In particular, no
	// annual product may belong to either monthly coupon product.
	if (new Set(prices.map(({ productId }) => productId)).size !== 4)
		throw unavailable();

	await Promise.all(
		prices.slice(0, 2).map(async ({ price, productId }) => {
			// Do not filter by interval/type: any alternate active price is unsafe.
			const inventory = await stripe.prices.list(
				{ active: true, product: productId, limit: 100 },
				REQUEST,
			);
			if (
				!inventory ||
				inventory.has_more !== false ||
				inventory.data.length !== 1 ||
				inventory.data[0].id !== price.id
			)
				throw unavailable();
			const listed = inventory.data[0];
			verifiedBillingPrice(listed, price.id, false, true, "monthly");
			const listedProduct =
				typeof listed.product === "string"
					? listed.product
					: listed.product?.id;
			if (
				listedProduct !== productId ||
				listed.unit_amount !== price.unit_amount
			)
				throw unavailable();
		}),
	);

	return {
		productIds: [prices[0].productId, prices[1].productId],
		monthlyPriceIds: [prices[0].price.id, prices[1].price.id],
	};
}
