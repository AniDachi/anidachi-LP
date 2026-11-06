import type Stripe from "stripe";
import { resolveStripeMode } from "./stripe-env";
import { stripePriceIdForPlanCode } from "./stripe-plans";
import { UNINSTALL_REQUEST, verifyUninstallCatalog } from "./uninstall-stripe";

/** Each deployment opts in independently; no unsuffixed/cross-mode fallback. */
export function uninstallCampaignConfig() {
	const suffix = resolveStripeMode() === "live" ? "LIVE" : "TEST";
	return {
		firstCoupon:
			process.env[`STRIPE_UNINSTALL_FIRST_ENABLED_${suffix}`] === "true"
				? (process.env[`STRIPE_UNINSTALL_FIRST_COUPON_ID_${suffix}`] ?? null)
				: null,
		renewalCoupon:
			process.env[`STRIPE_UNINSTALL_RENEWAL_ENABLED_${suffix}`] === "true"
				? (process.env[`STRIPE_UNINSTALL_RENEWAL_COUPON_ID_${suffix}`] ?? null)
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
