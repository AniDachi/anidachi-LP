import { unstable_cache } from "next/cache";
import type { PricingPrices } from "../pricing-offer";
import { readBillingPrice } from "./billing-price";
import { getStripeSecretKey, resolveStripeMode } from "./stripe-env";
import { stripePriceIdForPlanCode } from "./stripe-plans";

/** Only public amounts are cached. Account/trial/policy reads remain private and fresh. */
export async function readPricingPrice(priceId: string, requireActive = true) {
	if (!requireActive) return readBillingPrice(priceId);
	const mode = resolveStripeMode();
	// Even a cache hit must not mask missing or mismatched Stripe configuration.
	getStripeSecretKey(mode);
	return unstable_cache(
		() => readBillingPrice(priceId, true),
		["pricing-monthly-price-v1", mode, priceId],
		{ revalidate: 300 },
	)();
}

/** Public server-rendered prices; no cookies, owner IDs or trial eligibility. */
export async function initialPricingPrices(): Promise<PricingPrices | null> {
	try {
		const plusId = stripePriceIdForPlanCode("plus");
		const proId = stripePriceIdForPlanCode("pro");
		if (!plusId || !proId) return null;
		const [plus, pro] = await Promise.all([
			readPricingPrice(plusId),
			readPricingPrice(proId),
		]);
		return { plus, pro };
	} catch {
		// An unavailable catalog must not invent prices or break the whole site.
		return null;
	}
}
