import { BillingError } from "./billing";
import { getBillingCustomerByUserId, listSubscriptionsForUser } from "./db";
import { createStripeClient, resolveStripeMode } from "./stripe-env";

const defaults = {
	listSubscriptions: listSubscriptionsForUser,
	getCustomer: getBillingCustomerByUserId,
	createStripe: createStripeClient,
	mode: resolveStripeMode,
};
const REQUEST = { timeout: 8000, maxNetworkRetries: 0 };
const id = (value: string | { id?: string } | null | undefined) =>
	typeof value === "string" ? value : value?.id;
/** A fresh, owner-verified hosted invoice. This only reads Stripe; payment stays in Stripe. */
export async function paymentRecoveryLink(
	userId: string,
	rowId: string,
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
		throw new BillingError(503, "Payment ownership could not be verified.");
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
		throw new BillingError(503, "Payment ownership could not be verified.");
	const invoiceId = id(sub.latest_invoice);
	if (!invoiceId || ["canceled", "incomplete_expired"].includes(sub.status))
		throw new BillingError(
			409,
			"No open payment is available. Refresh your subscription status.",
		);
	const invoice = await stripe.invoices.retrieve(invoiceId, {}, REQUEST);
	if (
		invoice.id !== invoiceId ||
		id(invoice.customer) !== customer.stripe_customer_id ||
		id(invoice.parent?.subscription_details?.subscription) !== sub.id ||
		invoice.livemode !== sub.livemode
	)
		throw new BillingError(503, "Payment ownership could not be verified.");
	if (invoice.status !== "open" || !invoice.hosted_invoice_url)
		throw new BillingError(
			409,
			"No open payment is available. Refresh your subscription status.",
		);
	const url = new URL(invoice.hosted_invoice_url);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "invoice.stripe.com" ||
		url.username ||
		url.password ||
		url.port
	)
		throw new BillingError(503, "Payment page unavailable.");
	return url.toString();
}
