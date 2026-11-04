import type Stripe from "stripe";
import { resolveStripeMode } from "./stripe-env";
import { stripePriceIdForPlanCode } from "./stripe-plans";
import { UNINSTALL_REQUEST, verifyUninstallCatalog } from "./uninstall-stripe";

/** Deliberately TEST-only, with no unsuffixed or LIVE campaign fallback. */
export function uninstallCampaignConfig() {
	const test = resolveStripeMode() === "test";
	return {
		firstCoupon:
			test && process.env.STRIPE_UNINSTALL_FIRST_ENABLED_TEST === "true"
				? (process.env.STRIPE_UNINSTALL_FIRST_COUPON_ID_TEST ?? null)
				: null,
		renewalCoupon:
			test && process.env.STRIPE_UNINSTALL_RENEWAL_ENABLED_TEST === "true"
				? (process.env.STRIPE_UNINSTALL_RENEWAL_COUPON_ID_TEST ?? null)
				: null,
	};
}
export async function readUninstallCatalog(stripe: Stripe) {
	const ids = [
		stripePriceIdForPlanCode("plus"),
		stripePriceIdForPlanCode("pro"),
	];
	if (ids.some((id) => !id)) throw new Error("Uninstall catalog unavailable.");
	const prices = await Promise.all(
		ids.map((id) => {
			if (!id) throw new Error("Uninstall catalog unavailable.");
			return stripe.prices.retrieve(id, {}, UNINSTALL_REQUEST);
		}),
	);
	return verifyUninstallCatalog(prices, ids as string[]);
}
