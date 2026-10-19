import { unstable_cache } from "next/cache";
import type { BillingPeriod } from "../billing-view";
import { readBillingPrice } from "./billing-price";
import { getStripeSecretKey, resolveStripeMode } from "./stripe-env";

/** Historical subscription amounts can include archived prices. Display only;
 * confirmations must still call readBillingPrice directly. */
export async function readBillingDisplayPrice(priceId: string) {
	const mode = resolveStripeMode();
	getStripeSecretKey(mode);
	return unstable_cache(
		() => readBillingPrice(priceId),
		["billing-display-price-v1", mode, priceId],
		{ revalidate: 300 },
	)();
}

/** Only public amounts are cached. Account/trial/policy reads remain private and fresh. */
export async function readPricingPrice(
	priceId: string,
	requireActive = true,
	period: BillingPeriod = "monthly",
) {
	if (!requireActive) return readBillingPrice(priceId, false, period);
	const mode = resolveStripeMode();
	// Even a cache hit must not mask missing or mismatched Stripe configuration.
	getStripeSecretKey(mode);
	return unstable_cache(
		() => readBillingPrice(priceId, true, period),
		["pricing-recurring-price-v2", mode, priceId, period],
		{ revalidate: 300 },
	)();
}
