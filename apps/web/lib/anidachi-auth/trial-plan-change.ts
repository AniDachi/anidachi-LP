import type Stripe from "stripe";
import { BillingError } from "./billing";
import {
	getBillingCustomerByUserId,
	getSubscriptionTrial,
	listSubscriptionsForUser,
} from "./db";
import type { PaidPlanCode } from "./plan-entitlements";
import { createStripeClient, resolveStripeMode } from "./stripe-env";
import {
	stripePriceIdForPlanCode,
	stripeSubscriptionCancellationScheduled,
} from "./stripe-plans";
import { syncStripeSubscriptionById } from "./stripe-subscription-sync";

/** Monthly list price; existing discounts, tax and credits remain with Stripe. */
export type TrialPlanQuote = {
	planCode: PaidPlanCode;
	currentPlanCode: PaidPlanCode;
	unitAmount: number;
	currency: string;
	trialEndsAt: string;
	renewalCanceled: boolean;
};
type Deps = {
	listSubscriptions: typeof listSubscriptionsForUser;
	getCustomer: typeof getBillingCustomerByUserId;
	readTrial: typeof getSubscriptionTrial;
	createStripe: typeof createStripeClient;
	priceId: typeof stripePriceIdForPlanCode;
	mode: typeof resolveStripeMode;
	sync: typeof syncStripeSubscriptionById;
	now: () => number;
};
const defaults: Deps = {
	listSubscriptions: listSubscriptionsForUser,
	getCustomer: getBillingCustomerByUserId,
	readTrial: getSubscriptionTrial,
	createStripe: createStripeClient,
	priceId: stripePriceIdForPlanCode,
	mode: resolveStripeMode,
	sync: syncStripeSubscriptionById,
	now: Date.now,
};
const REQUEST = { timeout: 8000, maxNetworkRetries: 0 };
const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createTrialPlanChangeService(deps: Deps = defaults) {
	async function prepare(
		userId: string,
		rowId: string,
		planCode: PaidPlanCode,
	) {
		if (planCode !== "plus" && planCode !== "pro")
			throw new BillingError(400, "Select Plus or Pro.");
		const [rows, customer] = await Promise.all([
			deps.listSubscriptions(userId),
			deps.getCustomer(userId),
		]);
		const row = rows.find((r) => r.id === rowId);
		if (!row)
			throw new BillingError(404, "Subscription not found for this account.");
		if (
			row.user_id !== userId ||
			!customer ||
			customer.user_id !== userId ||
			customer.stripe_customer_id !== row.stripe_customer_id
		)
			throw new BillingError(
				503,
				"Subscription ownership could not be verified.",
			);
		const stripe = deps.createStripe();
		const [trial, sub] = await Promise.all([
			deps.readTrial(row.stripe_subscription_id),
			stripe.subscriptions.retrieve(row.stripe_subscription_id, {}, REQUEST),
		]);
		const customerId =
			typeof sub.customer === "string" ? sub.customer : sub.customer.id;
		if (
			!trial ||
			trial.user_id !== userId ||
			trial.stripe_subscription_id !== row.stripe_subscription_id ||
			sub.id !== row.stripe_subscription_id ||
			customerId !== customer.stripe_customer_id ||
			(sub.metadata.userId && sub.metadata.userId !== userId) ||
			sub.livemode !== (deps.mode() === "live")
		)
			throw new BillingError(
				503,
				"Subscription trial ownership could not be verified.",
			);
		const originalStart = Date.parse(trial.trial_started_at) / 1000,
			originalEnd = Date.parse(trial.trial_ends_at) / 1000;
		if (
			!Number.isSafeInteger(originalStart) ||
			!Number.isSafeInteger(originalEnd) ||
			originalEnd - originalStart !== 259200 ||
			sub.trial_start !== originalStart ||
			sub.trial_end !== originalEnd ||
			sub.status !== "trialing" ||
			deps.now() >= originalEnd * 1000 ||
			trial.first_payment_state !== "awaiting"
		)
			throw new BillingError(
				409,
				"This trial has ended or changed. Refresh your subscription.",
			);
		const item = sub.items.data[0];
		if (
			sub.items.has_more ||
			sub.items.data.length !== 1 ||
			!item ||
			item.quantity !== 1 ||
			sub.schedule ||
			sub.pending_update ||
			sub.pause_collection
		)
			throw new BillingError(
				409,
				"This subscription needs review before changing its plan.",
			);
		const currentPlanCode = (["plus", "pro"] as const).find(
			(plan) => deps.priceId(plan) === item.price.id,
		);
		const targetPriceId = deps.priceId(planCode);
		if (!currentPlanCode || !targetPriceId)
			throw new BillingError(503, "Plan pricing is unavailable.");
		const target = await stripe.prices.retrieve(targetPriceId, {}, REQUEST);
		function validPrice(p: Stripe.Price) {
			return (
				p.type === "recurring" &&
				p.billing_scheme === "per_unit" &&
				!p.transform_quantity &&
				p.livemode === sub.livemode &&
				p.recurring?.interval === "month" &&
				p.recurring.interval_count === 1 &&
				p.recurring.usage_type === "licensed" &&
				Number.isSafeInteger(p.unit_amount) &&
				(p.unit_amount ?? 0) > 0
			);
		}
		if (
			target.id !== targetPriceId ||
			!target.active ||
			!validPrice(target) ||
			!validPrice(item.price) ||
			target.currency !== item.price.currency
		)
			throw new BillingError(
				503,
				"The monthly plan price could not be verified.",
			);
		const quote: TrialPlanQuote = {
			planCode,
			currentPlanCode,
			unitAmount: target.unit_amount!,
			currency: target.currency,
			trialEndsAt: new Date(originalEnd * 1000).toISOString(),
			renewalCanceled: stripeSubscriptionCancellationScheduled(sub),
		};
		return { stripe, sub, item, originalEnd, targetPriceId, customerId, quote };
	}
	return {
		async quote(
			userId: string,
			rowId: string,
			planCode: PaidPlanCode,
		): Promise<TrialPlanQuote> {
			return (await prepare(userId, rowId, planCode)).quote;
		},
		async confirm(
			userId: string,
			rowId: string,
			planCode: PaidPlanCode,
			accepted: TrialPlanQuote,
			requestId: string,
		) {
			if (!UUID.test(requestId))
				throw new BillingError(400, "Refresh the plan change and try again.");
			const p = await prepare(userId, rowId, planCode),
				q = p.quote;
			if (
				!accepted ||
				accepted.planCode !== q.planCode ||
				accepted.unitAmount !== q.unitAmount ||
				accepted.currency !== q.currency ||
				accepted.trialEndsAt !== q.trialEndsAt ||
				accepted.renewalCanceled !== q.renewalCanceled ||
				(accepted.currentPlanCode !== q.currentPlanCode &&
					q.currentPlanCode !== planCode)
			)
				throw new BillingError(
					409,
					"Subscription terms changed. Review the new price before confirming.",
				);
			if (q.currentPlanCode !== planCode) {
				// Sending the immutable future end makes a request arriving after expiry
				// fail at Stripe instead of silently changing an ordinary paid subscription.
				// Never send cancel_at/cancel_at_period_end: concurrent cancellation wins.
				await p.stripe.subscriptions.update(
					p.sub.id,
					{
						items: [{ id: p.item.id, price: p.targetPriceId, quantity: 1 }],
						trial_end: p.originalEnd,
						proration_behavior: "none",
						metadata: { planCode },
					},
					{ ...REQUEST, idempotencyKey: `trial-plan:${userId}:${requestId}` },
				);
			}
			// A response loss is not a rollback. Replays refetch; if the desired price
			// is already present they only reconcile the authoritative subscription.
			const result = await deps.sync(p.stripe, p.sub.id, {
				expectedUserId: userId,
			});
			if (
				!result ||
				result.userId !== userId ||
				result.stripeCustomerId !== p.customerId ||
				result.stripeSubscriptionId !== p.sub.id ||
				result.stripePriceId !== p.targetPriceId
			)
				throw new BillingError(
					409,
					"The subscription changed concurrently. Refresh its current status.",
				);
			return {
				ownerUserId: userId,
				planCode: result.planCode,
				trialEndsAt: q.trialEndsAt,
			};
		},
	};
}
export type TrialPlanChangeService = ReturnType<
	typeof createTrialPlanChangeService
>;
