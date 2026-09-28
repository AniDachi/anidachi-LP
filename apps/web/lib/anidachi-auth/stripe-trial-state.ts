import type Stripe from "stripe";

export type SubscriptionTrialRecord = {
	user_id: string;
	stripe_subscription_id: string;
	trial_started_at: string;
	trial_ends_at: string;
	first_invoice_id: string | null;
	first_payment_state: "awaiting" | "paid" | "failed" | "action_required";
	first_paid_at: string | null;
};
export type StripeTrialSnapshot = {
	checkoutReservationId: string | null;
	trialStartedAt: string;
	trialEndsAt: string;
	firstInvoiceId: string | null;
	firstPaymentState: SubscriptionTrialRecord["first_payment_state"];
	firstPaidAt: string | null;
};
export async function resolveStripeTrialSnapshot(
	stripe: Stripe,
	subscription: Stripe.Subscription,
	prior: SubscriptionTrialRecord | null,
	requestOptions: () => Stripe.RequestOptions = () => ({
		timeout: 8000,
		maxNetworkRetries: 0,
	}),
): Promise<StripeTrialSnapshot | null> {
	if (!prior && subscription.metadata.anidachiTrial !== "72h_v1") return null;
	const start = subscription.trial_start,
		end = subscription.trial_end;
	if (
		!Number.isSafeInteger(start) ||
		!Number.isSafeInteger(end) ||
		!start ||
		!end ||
		end - start !== 72 * 3600
	)
		throw new Error("Invalid trial identity.");
	const trialEnd = end;
	const iso = (v: number) => new Date(v * 1000).toISOString();
	if (
		prior &&
		(prior.stripe_subscription_id !== subscription.id ||
			Date.parse(prior.trial_started_at) !== start * 1000 ||
			Date.parse(prior.trial_ends_at) !== end * 1000)
	)
		throw new Error("Stripe trial identity changed.");
	const result: StripeTrialSnapshot = {
		checkoutReservationId: subscription.metadata.checkoutReservationId ?? null,
		trialStartedAt: iso(start),
		trialEndsAt: iso(end),
		firstInvoiceId: prior?.first_invoice_id ?? null,
		firstPaymentState: prior?.first_payment_state ?? "awaiting",
		firstPaidAt: prior?.first_paid_at ?? null,
	};
	if (result.firstPaymentState === "paid") return result;
	const id = (v: string | { id: string } | null | undefined) =>
		typeof v === "string" ? v : (v?.id ?? null);
	const customer = id(subscription.customer);
	function verifyInvoice(inv: Stripe.Invoice) {
		if (
			id(inv.customer) !== customer ||
			id(inv.parent?.subscription_details?.subscription) !== subscription.id
		)
			throw new Error("Trial invoice owner or identity mismatch.");
		if (
			inv.billing_reason !== "subscription_cycle" ||
			inv.created < trialEnd ||
			inv.lines.has_more ||
			!inv.lines.data.some(
				(line) =>
					line.parent?.subscription_item_details?.subscription ===
						subscription.id &&
					line.period.start >= trialEnd &&
					line.period.end > line.period.start,
			)
		)
			throw new Error(
				"Trial invoice does not prove a recurring service period.",
			);
	}
	let invoiceId = result.firstInvoiceId;
	if (!invoiceId) {
		const list = await stripe.invoices.list(
			{ subscription: subscription.id, created: { gte: end }, limit: 100 },
			requestOptions(),
		);
		if (list.has_more)
			throw new Error("First trial invoice requires reconciliation.");
		const regular = list.data
			.filter(
				(inv) =>
					inv.billing_reason === "subscription_cycle" && inv.created >= end,
			)
			.sort((a, b) => a.created - b.created);
		if (!regular.length) return result;
		verifyInvoice(regular[0]);
		invoiceId = regular[0].id ?? null;
	}
	if (!invoiceId) throw new Error("Trial invoice identity unavailable.");
	// Current invoice/payment state is authoritative; event payloads can arrive out of order.
	const invoice = await stripe.invoices.retrieve(
		invoiceId,
		{ expand: ["payments.data.payment.payment_intent"] },
		requestOptions(),
	);
	if (invoice.id !== invoiceId)
		throw new Error("Trial invoice identity mismatch.");
	verifyInvoice(invoice);
	result.firstInvoiceId = invoiceId;
	if (invoice.status === "paid" && invoice.amount_remaining === 0) {
		const paidAt = invoice.status_transitions.paid_at;
		if (!paidAt || paidAt < end)
			throw new Error("First recurring payment timestamp unavailable.");
		result.firstPaymentState = "paid";
		result.firstPaidAt = iso(paidAt);
		return result;
	}
	if (invoice.status === "void" || invoice.status === "uncollectible") {
		result.firstPaymentState = "failed";
		return result;
	}
	if (invoice.payments?.has_more)
		throw new Error("Trial invoice payments require reconciliation.");
	const intents = (invoice.payments?.data ?? []).flatMap((payment) => {
		const intent = payment.payment.payment_intent;
		if (typeof intent === "string")
			throw new Error("Expanded trial payment state unavailable.");
		if (intent && id(intent.customer) !== customer)
			throw new Error("Trial payment owner mismatch.");
		return intent ? [intent] : [];
	});
	if (intents.some((pi) => pi.status === "requires_action"))
		result.firstPaymentState = "action_required";
	else if (
		intents.some(
			(pi) =>
				pi.status === "requires_payment_method" || pi.status === "canceled",
		)
	)
		result.firstPaymentState = "failed";
	else if (
		invoice.attempted &&
		!intents.some((pi) =>
			["processing", "succeeded", "requires_capture"].includes(pi.status),
		)
	)
		result.firstPaymentState = "failed";
	// Never restore the waiting window after a confirmed failure; only paid can restore access.
	return result;
}
