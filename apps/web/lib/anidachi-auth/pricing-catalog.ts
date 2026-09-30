import { unstable_cache } from "next/cache";
import type { PricingPrices } from "../pricing-offer";
import type { BillingPeriod } from "../billing-view";
import { readBillingPrice } from "./billing-price";
import { getStripeSecretKey, resolveStripeMode } from "./stripe-env";
import { stripePriceIdForPlanCode } from "./stripe-plans";

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

/** Public server-rendered prices; no cookies, owner IDs or trial eligibility. */
export async function initialPricingPrices(
	period: BillingPeriod = "monthly",
): Promise<PricingPrices | null> {
	try {
		const plusId = stripePriceIdForPlanCode("plus", period);
		const proId = stripePriceIdForPlanCode("pro", period);
		if (!plusId || !proId) return null;
		const [plus, pro] = await Promise.all([
			readPricingPrice(plusId, true, period),
			readPricingPrice(proId, true, period),
		]);
		return { plus, pro };
	} catch {
		// An unavailable catalog must not invent prices or break the whole site.
		return null;
	}
}
