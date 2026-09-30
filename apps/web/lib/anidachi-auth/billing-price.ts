import {
	billingPeriodUnit,
	type BillingPeriod,
	type BillingPrice,
} from "../billing-view";
import type Stripe from "stripe";
import { createStripeClient, resolveStripeMode } from "./stripe-env";

/** Read the actual recurring USD amount and period from Stripe. */
export async function readBillingPrice(
	priceId: string,
	requireActive = false,
	expectedPeriod?: BillingPeriod,
): Promise<BillingPrice> {
	const price = await createStripeClient().prices.retrieve(
		priceId,
		{},
		{ timeout: 8000, maxNetworkRetries: 0 },
	);
	return verifiedBillingPrice(
		price,
		priceId,
		resolveStripeMode() === "live",
		requireActive,
		expectedPeriod,
	);
}

export function verifiedBillingPrice(
	price: Stripe.Price,
	priceId: string,
	livemode: boolean,
	requireActive = false,
	expectedPeriod?: BillingPeriod,
): BillingPrice {
	if (
		(requireActive && !price.active) ||
		price.id !== priceId ||
		price.livemode !== livemode ||
		price.type !== "recurring" ||
		!["month", "year"].includes(price.recurring?.interval ?? "") ||
		(expectedPeriod !== undefined &&
			price.recurring?.interval !== billingPeriodUnit(expectedPeriod)) ||
		!price.recurring ||
		price.recurring.interval_count !== 1 ||
		price.recurring.usage_type !== "licensed" ||
		price.currency !== "usd" ||
		!Number.isSafeInteger(price.unit_amount) ||
		price.unit_amount! < 0 ||
		price.billing_scheme !== "per_unit" ||
		price.transform_quantity
	) {
		throw new Error("Recurring price unavailable");
	}
	return {
		unitAmount: price.unit_amount!,
		currency: price.currency,
		billingPeriod: price.recurring.interval === "year" ? "yearly" : "monthly",
	};
}
