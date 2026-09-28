import type Stripe from "stripe";
import { getPricingOffer } from "./pricing-offer";
import { readBillingPrice } from "./billing-price";
import { resolveAccountEntitlements } from "./account-entitlements";
import { db, getBillingCustomerByUserId } from "./db";
import { syncStripeSubscriptionById } from "./stripe-subscription-sync";
import {
	createSubscriptionCheckoutService,
	parseCheckoutReservation,
	SubscriptionCheckoutError,
} from "./subscription-trial";

/** Server adapter; neither Stripe IDs nor trial eligibility come from a browser. */
export function subscriptionCheckoutService(stripe: Stripe) {
	return createSubscriptionCheckoutService({
		stripe,
		async offer(userId, priceId) {
			const [offer, price] = await Promise.all([
				getPricingOffer(userId),
				// Checkout always validates the selected price directly with Stripe.
				// Cached public catalog values only accelerate display.
				readBillingPrice(priceId, true),
			]);
			return { action: offer.action, price };
		},
		getCustomer: getBillingCustomerByUserId,
		async saveCustomer(userId, customerId) {
			const { error } = await db()
				.from("billing_customers")
				.upsert(
					{ user_id: userId, stripe_customer_id: customerId },
					{ onConflict: "user_id", ignoreDuplicates: true },
				)
				.abortSignal(AbortSignal.timeout(10_000));
			if (error)
				throw new SubscriptionCheckoutError("Customer mapping unavailable.");
			const saved = await getBillingCustomerByUserId(userId);
			if (saved?.stripe_customer_id !== customerId)
				throw new SubscriptionCheckoutError(
					"Customer mapping changed; reconciliation required.",
				);
		},
		async reserve(input) {
			const { data, error } = await db()
				.rpc("reserve_subscription_checkout_v1", {
					p_user_id: input.userId,
					p_plan_code: input.planCode,
					p_price_id: input.priceId,
					p_origin: input.origin,
					p_request_id: input.requestId,
					p_attribution: input.attribution,
				})
				.abortSignal(AbortSignal.timeout(20_000));
			if (error)
				throw new SubscriptionCheckoutError(
					"Checkout reservation unavailable.",
				);
			return parseCheckoutReservation(data);
		},
		async finish(reservation, sessionId, state, subscriptionId) {
			const { error } = await db()
				.rpc("complete_subscription_checkout_reservation_v1", {
					p_user_id: reservation.user_id,
					p_reservation_id: reservation.id,
					p_session_id: sessionId,
					p_state: state,
					p_subscription_id: subscriptionId ?? null,
				})
				.abortSignal(AbortSignal.timeout(20_000));
			if (error)
				throw new SubscriptionCheckoutError(
					"Checkout reconciliation required.",
				);
		},
		async access(userId) {
			const access = await resolveAccountEntitlements(userId, new Date());
			if (!access.hosting)
				throw new SubscriptionCheckoutError("Checkout authority unavailable.");
			return access.hosting;
		},
		async sync(subscriptionId, userId) {
			const result = await syncStripeSubscriptionById(stripe, subscriptionId, {
				expectedUserId: userId,
			});
			if (!result)
				throw new SubscriptionCheckoutError(
					"Subscription reconciliation required.",
				);
			return { status: result.status };
		},
	});
}
