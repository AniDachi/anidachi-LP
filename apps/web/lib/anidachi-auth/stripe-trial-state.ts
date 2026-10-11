import type Stripe from "stripe";

export type CardlessTrialActivationRecord = {
	id: string;
	user_id: string;
	state: "pending" | "created" | "committed" | "failed";
	stripe_customer_id: string | null;
	stripe_schedule_id: string | null;
	stripe_subscription_id: string | null;
	trial_started_at: string | null;
	trial_ends_at: string | null;
	plan_code?: "plus" | "pro";
	price_id?: string;
};
export type SubscriptionTrialRecord = {
	user_id: string;
	stripe_subscription_id: string;
	trial_started_at: string;
	trial_ends_at: string;
	first_invoice_id: string | null;
	first_payment_state: "awaiting" | "paid" | "failed" | "action_required";
	first_paid_at: string | null;
	first_cash_invoice_id?: string | null;
	first_cash_paid_at?: string | null;
	first_cash_amount_paid?: number | null;
	trial_mode?: "card_required" | "cardless";
	trial_activation_id?: string | null;
	stripe_schedule_id?: string | null;
	renewal_operation_id?: string | null;
};
export type StripeTrialSnapshot = {
	checkoutReservationId: string | null;
	trialStartedAt: string;
	trialEndsAt: string;
	firstInvoiceId: string | null;
	firstPaymentState: SubscriptionTrialRecord["first_payment_state"];
	firstPaidAt: string | null;
	firstCashInvoiceId?: string | null;
	firstCashPaidAt?: string | null;
	firstCashAmountPaid?: number | null;
	trialMode?: "cardless";
	trialActivationId?: string;
	stripeScheduleId?: string;
	scheduleStatus?: Stripe.SubscriptionSchedule.Status;
	scheduleEndBehavior?: Stripe.SubscriptionSchedule.EndBehavior;
};
export async function resolveStripeTrialSnapshot(
	stripe: Stripe,
	subscription: Stripe.Subscription,
	prior: SubscriptionTrialRecord | null,
	requestOptions: () => Stripe.RequestOptions = () => ({
		timeout: 8000,
		maxNetworkRetries: 0,
	}),
	activation: CardlessTrialActivationRecord | null = null,
): Promise<StripeTrialSnapshot | null> {
	const cardless =
		prior?.trial_mode === "cardless" ||
		subscription.metadata.anidachiTrialMode === "cardless_v1";
	if (!prior && !cardless && subscription.metadata.anidachiTrial !== "72h_v1")
		return null;
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
	const id = (v: string | { id: string } | null | undefined) =>
		typeof v === "string" ? v : (v?.id ?? null);
	const customer = id(subscription.customer);
	if (cardless) {
		if (
			!activation ||
			!["created", "committed"].includes(activation.state) ||
			activation.id !==
				(prior?.trial_activation_id ??
					subscription.metadata.trialActivationId) ||
			activation.user_id !== (prior?.user_id ?? subscription.metadata.userId) ||
			activation.stripe_customer_id !== customer ||
			activation.stripe_subscription_id !== subscription.id ||
			!activation.stripe_schedule_id ||
			Date.parse(activation.trial_started_at ?? "") !== start * 1000 ||
			Date.parse(activation.trial_ends_at ?? "") !== end * 1000 ||
			(prior &&
				(prior.trial_mode !== "cardless" ||
					prior.stripe_schedule_id !== activation.stripe_schedule_id))
		)
			throw new Error("Cardless trial activation identity or owner mismatch.");
		// Retrieve under the same bounded refresh lease; never trust a replayed event
		// or the cached response to an earlier Stripe mutation.
		const schedule = await stripe.subscriptionSchedules.retrieve(
			activation.stripe_schedule_id,
			{},
			requestOptions(),
		);
		const phase = schedule.phases[0];
		const linkedSubscription =
			schedule.status === "released"
				? id(schedule.released_subscription)
				: id(schedule.subscription);
		if (
			schedule.id !== activation.stripe_schedule_id ||
			id(schedule.customer) !== customer ||
			schedule.livemode !== subscription.livemode ||
			schedule.metadata?.trialActivationId !== activation.id ||
			schedule.metadata?.userId !== activation.user_id ||
			schedule.metadata?.anidachiTrialMode !== "cardless_v1" ||
			!["active", "completed", "released", "canceled"].includes(
				schedule.status,
			) ||
			!["cancel", "release"].includes(schedule.end_behavior) ||
			schedule.phases.length !== 1 ||
			phase?.start_date !== start ||
			phase.end_date !== end ||
			phase.trial_end !== end ||
			(linkedSubscription !== subscription.id &&
				!(
					schedule.status === "canceled" &&
					linkedSubscription === null &&
					subscription.status === "canceled"
				)) ||
			(schedule.status === "active" &&
				id(subscription.schedule) !== schedule.id) ||
			(id(subscription.schedule) !== null &&
				id(subscription.schedule) !== schedule.id)
		)
			throw new Error("Cardless trial schedule identity or owner mismatch.");
		Object.assign(result, {
			checkoutReservationId: null,
			trialMode: "cardless",
			firstCashInvoiceId: prior?.first_cash_invoice_id ?? null,
			firstCashPaidAt: prior?.first_cash_paid_at ?? null,
			firstCashAmountPaid: prior?.first_cash_amount_paid ?? null,
			trialActivationId: activation.id,
			stripeScheduleId: schedule.id,
			scheduleStatus: schedule.status,
			scheduleEndBehavior: schedule.end_behavior,
		});
	}
	if (
		result.firstPaymentState === "paid" &&
		(!cardless || result.firstCashInvoiceId)
	)
		return result;
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

	let recurring: Stripe.Invoice[] | undefined;
	async function recurringInvoices() {
		if (recurring) return recurring;
		const list = await stripe.invoices.list(
			{ subscription: subscription.id, created: { gte: trialEnd }, limit: 100 },
			requestOptions(),
		);
		if (list.has_more)
			throw new Error("First trial invoice requires reconciliation.");
		recurring = list.data
			.filter(
				(inv) =>
					inv.billing_reason === "subscription_cycle" &&
					inv.created >= trialEnd,
			)
			.sort((a, b) => a.created - b.created);
		return recurring;
	}
	function isCashPayment(inv: Stripe.Invoice) {
		return (
			inv.status === "paid" &&
			inv.amount_remaining === 0 &&
			Number.isSafeInteger(inv.amount_paid) &&
			inv.amount_paid > 0
		);
	}
	async function recordCashPayment(current?: Stripe.Invoice) {
		if (!cardless || result.firstCashInvoiceId) return result;
		let cash = current && isCashPayment(current) ? current : undefined;
		if (!cash) {
			const candidate = (await recurringInvoices()).find(isCashPayment);
			if (!candidate?.id) return result;
			cash = await stripe.invoices.retrieve(candidate.id, {}, requestOptions());
			if (cash.id !== candidate.id)
				throw new Error("Cash invoice identity mismatch.");
		}
		verifyInvoice(cash);
		if (!isCashPayment(cash)) return result;
		const paidAt = cash.status_transitions.paid_at;
		if (!paidAt || paidAt < trialEnd)
			throw new Error("Cash payment timestamp unavailable.");
		result.firstCashInvoiceId = cash.id!;
		result.firstCashPaidAt = iso(paidAt);
		result.firstCashAmountPaid = cash.amount_paid;
		return result;
	}
	// Settled service keeps access even when customer credit covered the invoice.
	// Cash conversion can occur on a later cycle and has its own immutable proof.
	if (result.firstPaymentState === "paid") return recordCashPayment();
	let invoiceId = result.firstInvoiceId;
	if (!invoiceId) {
		const regular = await recurringInvoices();
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
		return recordCashPayment(invoice);
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
