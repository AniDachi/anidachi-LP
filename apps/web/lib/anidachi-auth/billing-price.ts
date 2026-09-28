import type { MonthlyPrice } from "../billing-view";
import { createStripeClient, resolveStripeMode } from "./stripe-env";

/** Read the configured monthly USD amount, never a browser-supplied price. */
export async function readBillingPrice(
	priceId: string,
	requireActive = false,
): Promise<MonthlyPrice> {
	const price = await createStripeClient().prices.retrieve(
		priceId,
		{},
		{ timeout: 8000, maxNetworkRetries: 0 },
	);
	if (
		(requireActive && !price.active) ||
		price.id !== priceId ||
		price.livemode !== (resolveStripeMode() === "live") ||
		price.type !== "recurring" ||
		price.recurring?.interval !== "month" ||
		price.recurring.interval_count !== 1 ||
		price.recurring.usage_type !== "licensed" ||
		price.currency !== "usd" ||
		!Number.isSafeInteger(price.unit_amount) ||
		price.unit_amount! < 0 ||
		price.billing_scheme !== "per_unit" ||
		price.transform_quantity
	) {
		throw new Error("Monthly price unavailable");
	}
	return { unitAmount: price.unit_amount!, currency: price.currency };
}
