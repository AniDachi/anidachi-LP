import type Stripe from "stripe";
import { BillingError } from "./billing";
import { getBillingCustomerByUserId, listSubscriptionsForUser } from "./db";
import {
	createStripeClient,
	resolveStripeMode,
	stripeEnvForMode,
} from "./stripe-env";
import {
	stripePlanCodeForPriceId,
	stripePriceIdForPlanCode,
	stripeSubscriptionCancellationScheduled,
} from "./stripe-plans";

const REQUEST = { timeout: 8000, maxNetworkRetries: 0 };
const id = (value: string | { id?: string } | null | undefined) =>
	typeof value === "string" ? value : value?.id;
export function yearlyPortalConfigurationId() {
	return stripeEnvForMode("STRIPE_YEARLY_PORTAL_CONFIGURATION_ID");
}
const defaults = {
	listSubscriptions: listSubscriptionsForUser,
	getCustomer: getBillingCustomerByUserId,
	createStripe: createStripeClient,
	mode: resolveStripeMode,
	planCode: stripePlanCodeForPriceId,
	priceId: stripePriceIdForPlanCode,
	configurationId: yearlyPortalConfigurationId,
	now: Date.now,
};

/** Opens a Stripe confirmation only. No charge or subscription mutation before the customer confirms. */
export async function yearlyBillingPortal(
	userId: string,
	rowId: string,
	returnUrl: string,
	deps = defaults,
): Promise<string> {
	const [rows, customer] = await Promise.all([
		deps.listSubscriptions(userId),
		deps.getCustomer(userId),
	]);
	const row = rows.find((s) => s.id === rowId);
	if (!row)
		throw new BillingError(404, "Subscription not found for this account.");
	if (
		row.user_id !== userId ||
		customer?.user_id !== userId ||
		customer.stripe_customer_id !== row.stripe_customer_id
	)
		throw new BillingError(
			503,
			"Subscription ownership could not be verified.",
		);
	const stripe = deps.createStripe();
	const sub = await stripe.subscriptions.retrieve(
		row.stripe_subscription_id,
		{},
		REQUEST,
	);
	if (
		sub.id !== row.stripe_subscription_id ||
		id(sub.customer) !== customer.stripe_customer_id ||
		sub.livemode !== (deps.mode() === "live") ||
		(sub.metadata.userId && sub.metadata.userId !== userId)
	)
		throw new BillingError(
			503,
			"Subscription ownership could not be verified.",
		);
	const item = sub.items.data[0];
	if (
		sub.status !== "active" ||
		sub.items.has_more ||
		sub.items.data.length !== 1 ||
		!item ||
		item.quantity !== 1 ||
		sub.schedule ||
		sub.pending_update ||
		sub.pause_collection ||
		stripeSubscriptionCancellationScheduled(sub) ||
		!(item.current_period_end * 1000 > deps.now()) ||
		sub.collection_method !== "charge_automatically"
	)
		throw new BillingError(
			409,
			"Refresh your subscription. Yearly billing requires an active monthly plan with renewal enabled and no pending changes.",
		);
	const plan = deps.planCode(item.price.id);
	const targetId = plan && deps.priceId(plan, "yearly");
	const configId = deps.configurationId();
	if (!plan || !targetId || !configId)
		throw new BillingError(503, "Yearly billing is not available yet.");
	const invoiceId = id(sub.latest_invoice);
	if (!invoiceId)
		throw new BillingError(
			409,
			"Complete your current payment before switching to yearly billing.",
		);
	const [target, invoice, config] = await Promise.all([
		stripe.prices.retrieve(targetId, {}, REQUEST),
		stripe.invoices.retrieve(invoiceId, {}, REQUEST),
		stripe.billingPortal.configurations.retrieve(
			configId,
			{ expand: ["features.subscription_update.products"] },
			REQUEST,
		),
	]);
	function validPrice(p: Stripe.Price, interval: "month" | "year") {
		return (
			p.livemode === sub.livemode &&
			p.type === "recurring" &&
			p.recurring?.interval === interval &&
			p.recurring.interval_count === 1 &&
			p.recurring.usage_type === "licensed" &&
			p.currency === "usd" &&
			p.billing_scheme === "per_unit" &&
			!p.transform_quantity &&
			Number.isSafeInteger(p.unit_amount) &&
			p.unit_amount! > 0
		);
	}
	if (
		target.id !== targetId ||
		!target.active ||
		!validPrice(target, "year") ||
		!validPrice(item.price, "month") ||
		id(target.product) !== id(item.price.product)
	)
		throw new BillingError(503, "The yearly price could not be verified.");
	if (
		invoice.id !== invoiceId ||
		id(invoice.customer) !== customer.stripe_customer_id ||
		id(invoice.parent?.subscription_details?.subscription) !== sub.id ||
		invoice.livemode !== sub.livemode
	)
		throw new BillingError(503, "Payment ownership could not be verified.");
	if (invoice.status !== "paid" || invoice.amount_remaining !== 0)
		throw new BillingError(
			409,
			"Complete your current payment before switching to yearly billing.",
		);
	const updates = config.features.subscription_update;
	if (
		config.id !== configId ||
		!config.active ||
		config.is_default ||
		config.livemode !== sub.livemode ||
		!updates.enabled ||
		updates.proration_behavior !== "always_invoice" ||
		updates.default_allowed_updates.length !== 1 ||
		updates.default_allowed_updates[0] !== "price" ||
		(updates.schedule_at_period_end?.conditions.length ?? 0) !== 0 ||
		!updates.products?.some(
			(p) => p.product === id(target.product) && p.prices.includes(targetId),
		)
	)
		throw new BillingError(
			503,
			"Yearly billing confirmation is temporarily unavailable.",
		);
	const portal = await stripe.billingPortal.sessions.create(
		{
			configuration: configId,
			customer: customer.stripe_customer_id,
			return_url: returnUrl,
			flow_data: {
				type: "subscription_update_confirm",
				subscription_update_confirm: {
					subscription: sub.id,
					items: [{ id: item.id, price: targetId, quantity: 1 }],
				},
				after_completion: {
					type: "redirect",
					redirect: { return_url: returnUrl },
				},
			},
		},
		REQUEST,
	);
	const url = new URL(portal.url);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "billing.stripe.com" ||
		url.username ||
		url.password ||
		url.port
	)
		throw new BillingError(503, "Billing confirmation page unavailable.");
	return url.toString();
}
