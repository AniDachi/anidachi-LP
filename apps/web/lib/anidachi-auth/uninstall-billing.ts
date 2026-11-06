import { resolveStripeMode } from "./stripe-env";
import type Stripe from "stripe";
import type { BillingPromotion } from "../billing-view";
import type { RetentionClaim } from "./retention-invoice";
import { uninstallDiscount } from "./uninstall-offer";
import { stripeObjectId } from "./uninstall-stripe";

export function retentionBillingSnapshot(
	sub: Stripe.Subscription,
	claim: RetentionClaim,
	now: number,
	expectedLive = resolveStripeMode() === "live",
): BillingPromotion | undefined {
	if (claim.state === "ineligible") return undefined;
	if (claim.state === "reconciliation") return { state: "unavailable" };
	const item = sub.items.data[0];
	if (
		sub.livemode !== expectedLive ||
		sub.id !== claim.stripe_subscription_id ||
		stripeObjectId(sub.customer) !== claim.stripe_customer_id ||
		sub.metadata.userId !== claim.user_id
	)
		throw new Error("Retention billing ownership unavailable.");
	if (claim.state === "applied") return undefined; // That invoice was discounted; future renewals remain full price.
	if (claim.target_period_start * 1000 <= now) return { state: "unavailable" };
	if (
		sub.status !== "active" ||
		sub.cancel_at ||
		sub.cancel_at_period_end ||
		sub.pending_update ||
		sub.schedule ||
		sub.pause_collection ||
		sub.pending_invoice_item_interval ||
		sub.billing_thresholds ||
		sub.items.has_more ||
		sub.items.data.length !== 1 ||
		item.price.id !== claim.price_id ||
		item.quantity !== 1 ||
		item.billing_thresholds ||
		item.current_period_end !== claim.target_period_start ||
		item.price.unit_amount !== claim.unit_amount ||
		sub.discounts.length ||
		item.discounts.length
	)
		return undefined;
	return {
		state: "active",
		campaign: "uninstall_renewal",
		percentOff: 40,
		endsAt: new Date(claim.target_period_start * 1000).toISOString(),
		nextPrice: {
			unitAmount: uninstallDiscount(claim.unit_amount),
			currency: "usd",
			billingPeriod: "monthly",
		},
	};
}
