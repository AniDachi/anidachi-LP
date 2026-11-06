import { resolveStripeMode } from "./stripe-env";
import type Stripe from "stripe";
import { verifiedBillingPrice } from "./billing-price";
import { type UninstallPlan, uninstallDiscount } from "./uninstall-offer";
import {
	UNINSTALL_REQUEST as REQUEST,
	stripeObjectId,
	UNINSTALL_RENEWAL_CAMPAIGN,
	verifyUninstallCustomer,
} from "./uninstall-stripe";

export type RetentionClaim = {
	id: string;
	user_id: string;
	stripe_customer_id: string;
	stripe_subscription_id: string;
	coupon_id: string;
	product_ids: string[];
	price_id: string;
	plan_code: UninstallPlan;
	unit_amount: number;
	target_period_start: number;
	review_revision: string;
	state: "accepted" | "applied" | "ineligible" | "reconciliation";
	stripe_invoice_id: string | null;
	reason: string;
	created_at: string;
};
export type RetentionInvoiceDeps = {
	stripe: Stripe;
	find: (subscriptionId: string) => Promise<RetentionClaim | null>;
	bind: (claimId: string, invoiceId: string) => Promise<RetentionClaim>;
	finish: (
		claimId: string,
		invoiceId: string | null,
		state: RetentionClaim["state"],
		reason: string,
	) => Promise<void>;
};
const subscriptionOf = (i: Stripe.Invoice) =>
	stripeObjectId(i.parent?.subscription_details?.subscription);
function verifiedInvoice(i: Stripe.Invoice, c: RetentionClaim): boolean {
	const expectedLive = resolveStripeMode() === "live";
	const line = i.lines.data[0];
	return (
		i.livemode === expectedLive &&
		stripeObjectId(i.customer) === c.stripe_customer_id &&
		subscriptionOf(i) === c.stripe_subscription_id &&
		i.billing_reason === "subscription_cycle" &&
		i.currency === "usd" &&
		!i.lines.has_more &&
		i.lines.data.length === 1 &&
		line.parent?.type === "subscription_item_details" &&
		!line.parent.subscription_item_details?.proration &&
		stripeObjectId(line.parent.subscription_item_details?.subscription) ===
			c.stripe_subscription_id &&
		line.pricing?.price_details?.price === c.price_id &&
		line.quantity === 1 &&
		line.amount === c.unit_amount &&
		line.period.start === c.target_period_start &&
		line.period.end > line.period.start &&
		line.discountable
	);
}
function applied(i: Stripe.Invoice, c: RetentionClaim): boolean {
	if (
		!verifiedInvoice(i, c) ||
		i.metadata?.uninstallRetentionClaimId !== c.id ||
		i.discounts.length !== 1
	)
		return false;
	const d = i.discounts[0];
	if (
		typeof d === "string" ||
		"deleted" in d ||
		d.coupon.id !== c.coupon_id ||
		d.coupon.livemode !== (resolveStripeMode() === "live") ||
		d.coupon.metadata?.anidachiCampaign !== UNINSTALL_RENEWAL_CAMPAIGN ||
		d.coupon.percent_off !== 40 ||
		d.coupon.duration !== "once" ||
		stripeObjectId(d.customer) !== c.stripe_customer_id ||
		d.invoice !== i.id ||
		d.subscription
	)
		return false;
	const amounts = i.total_discount_amounts ?? [];
	return (
		amounts.length === 1 &&
		stripeObjectId(amounts[0].discount) === d.id &&
		amounts[0].amount === c.unit_amount - uninstallDiscount(c.unit_amount) &&
		(i.lines.data[0].discounts ?? []).every(
			(discount) => stripeObjectId(discount) === d.id,
		) &&
		(i.lines.data[0].discount_amounts ?? []).every(
			(amount) => stripeObjectId(amount.discount) === d.id,
		)
	);
}

/** Called only after signature verification. Invoice-level discounts never touch
 * the subscription/customer and therefore cannot leak into prorations or annual
 * changes. Accepted promises work independently of issuance environment flags. */
export async function fulfillRetentionInvoice(
	eventInvoice: Stripe.Invoice,
	deps: RetentionInvoiceDeps,
): Promise<void> {
	const expectedLive = resolveStripeMode() === "live";
	if (
		eventInvoice.livemode !== expectedLive ||
		eventInvoice.billing_reason !== "subscription_cycle"
	)
		return;
	const invoiceId = eventInvoice.id;
	if (!invoiceId) throw new Error("Retention invoice identity missing.");
	const subscriptionId = subscriptionOf(eventInvoice);
	if (!subscriptionId) return;
	const c = await deps.find(subscriptionId);
	if (!c || c.state === "ineligible") return;
	if (c.stripe_subscription_id !== subscriptionId)
		throw new Error("Retention subscription binding mismatch.");
	if (c.stripe_invoice_id && c.stripe_invoice_id !== eventInvoice.id) return;
	// Cheap period filter before external calls. Never delay unrelated renewals.
	if (
		!eventInvoice.lines.data.some(
			(line) => line.period.start === c.target_period_start,
		)
	)
		return;
	const read = () =>
		deps.stripe.invoices.retrieve(
			invoiceId,
			{ expand: ["discounts", "lines.data.discounts"] },
			REQUEST,
		);
	let invoice = await read();
	if (
		invoice.id !== eventInvoice.id ||
		invoice.livemode !== expectedLive ||
		stripeObjectId(invoice.customer) !== c.stripe_customer_id ||
		subscriptionOf(invoice) !== c.stripe_subscription_id
	)
		throw new Error("Retention invoice identity mismatch.");
	if (applied(invoice, c)) {
		const bound = await deps.bind(c.id, invoiceId);
		if (bound.stripe_invoice_id !== invoice.id)
			throw new Error("Retention invoice binding mismatch.");
		await deps.finish(
			c.id,
			invoiceId,
			"applied",
			"The discount was applied to your reserved renewal invoice.",
		);
		return;
	}
	if (c.state === "applied")
		throw new Error(
			"Applied retention discount changed; reconciliation required.",
		);
	if (!verifiedInvoice(invoice, c)) {
		await deps.finish(
			c.id,
			c.stripe_invoice_id,
			"ineligible",
			"The renewal invoice changed and no discount was applied.",
		);
		return;
	}
	const bound = await deps.bind(c.id, invoiceId);
	if (
		bound.stripe_invoice_id !== invoice.id ||
		bound.user_id !== c.user_id ||
		bound.coupon_id !== c.coupon_id
	)
		throw new Error("Retention invoice binding mismatch.");
	if (invoice.status !== "draft") {
		await deps.finish(
			c.id,
			invoiceId,
			"reconciliation",
			"The invoice finalized before the discount was confirmed. Contact support.",
		);
		throw new Error(
			"Retention invoice finalized without confirmed discount; reconciliation required.",
		);
	}
	const [sub, rawCustomer, coupon] = await Promise.all([
		deps.stripe.subscriptions.retrieve(subscriptionId, {}, REQUEST),
		deps.stripe.customers.retrieve(c.stripe_customer_id, {}, REQUEST),
		deps.stripe.coupons.retrieve(
			c.coupon_id,
			{ expand: ["applies_to"] },
			REQUEST,
		),
	]);
	const customer = verifyUninstallCustomer(
		rawCustomer,
		c.stripe_customer_id,
		c.user_id,
	);
	if (
		sub.id !== subscriptionId ||
		sub.livemode !== expectedLive ||
		stripeObjectId(sub.customer) !== customer.id ||
		sub.metadata.userId !== c.user_id
	)
		throw new Error("Retention subscription ownership changed.");
	const item = sub.items.data[0];
	if (
		sub.status !== "active" ||
		sub.cancel_at_period_end ||
		sub.cancel_at ||
		sub.schedule ||
		sub.pending_update ||
		sub.pause_collection ||
		sub.pending_invoice_item_interval ||
		sub.billing_thresholds ||
		sub.items.has_more ||
		sub.items.data.length !== 1 ||
		item.price.id !== c.price_id ||
		item.quantity !== 1 ||
		item.current_period_start !== c.target_period_start ||
		item.billing_thresholds ||
		sub.discounts.length ||
		item.discounts.length ||
		customer.discount ||
		invoice.discounts.length ||
		(invoice.lines.data[0].discount_amounts?.length ?? 0) ||
		(invoice.lines.data[0].discounts?.length ?? 0) ||
		item.price.recurring?.interval !== "month"
	) {
		await deps.finish(
			c.id,
			invoiceId,
			"ineligible",
			"The subscription or invoice changed and no discount was applied.",
		);
		return;
	}
	const price = verifiedBillingPrice(
		item.price,
		c.price_id,
		expectedLive,
		false,
		"monthly",
	);
	if (
		price.unitAmount !== c.unit_amount ||
		coupon.id !== c.coupon_id ||
		coupon.livemode !== expectedLive ||
		!coupon.valid ||
		coupon.percent_off !== 40 ||
		coupon.amount_off !== null ||
		coupon.duration !== "once" ||
		coupon.redeem_by !== null ||
		coupon.max_redemptions !== null ||
		coupon.metadata?.anidachiCampaign !== UNINSTALL_RENEWAL_CAMPAIGN ||
		c.product_ids.length !== 2 ||
		coupon.applies_to?.products.length !== 2 ||
		!c.product_ids.every((p) => coupon.applies_to?.products.includes(p)) ||
		!c.product_ids.includes(stripeObjectId(item.price.product) ?? "")
	)
		throw new Error("Retention frozen terms unavailable.");
	try {
		await deps.stripe.invoices.update(
			invoiceId,
			{
				discounts: [{ coupon: c.coupon_id }],
				metadata: { uninstallRetentionClaimId: c.id },
			},
			{
				...REQUEST,
				idempotencyKey: "uninstall-renewal-invoice:" + c.id + ":" + invoice.id,
			},
		);
	} catch {
		// A lost response is ambiguous, not a failed grant. Read the same invoice.
	}
	invoice = await read();
	if (!applied(invoice, c)) {
		if (invoice.status !== "draft")
			await deps.finish(
				c.id,
				invoiceId,
				"reconciliation",
				"The invoice finalized before the discount was confirmed. Contact support.",
			);
		throw new Error(
			"Retention invoice discount not confirmed; retry reconciliation.",
		);
	}
	await deps.finish(
		c.id,
		invoiceId,
		"applied",
		"The discount was applied to your reserved renewal invoice.",
	);
}
