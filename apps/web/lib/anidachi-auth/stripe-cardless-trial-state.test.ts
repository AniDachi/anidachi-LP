import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { syncStripeSubscriptionById } from "./stripe-subscription-sync";
import { resolveStripeTrialSnapshot } from "./stripe-trial-state";

const start = 1_790_000_000,
	end = start + 259200;
const iso = (t: number) => new Date(t * 1000).toISOString();
const activation = {
	id: "a2000000-0000-4000-8000-000000000001",
	user_id: "owner",
	state: "created" as const,
	stripe_customer_id: "cus_trial",
	stripe_schedule_id: "sub_sched_trial",
	stripe_subscription_id: "sub_trial",
	trial_started_at: iso(start),
	trial_ends_at: iso(end),
};
const subscription = {
	id: "sub_trial",
	customer: "cus_trial",
	schedule: "sub_sched_trial",
	status: "trialing",
	livemode: false,
	trial_start: start,
	trial_end: end,
	cancel_at: end,
	cancel_at_period_end: false,
	metadata: {
		userId: "owner",
		planCode: "plus",
		anidachiTrial: "72h_v1",
		anidachiTrialMode: "cardless_v1",
		trialActivationId: activation.id,
	},
	items: { data: [{ price: { id: "price_plus" }, current_period_end: end }] },
} as unknown as Stripe.Subscription;
const schedule = {
	id: "sub_sched_trial",
	customer: "cus_trial",
	subscription: "sub_trial",
	released_subscription: null,
	status: "active",
	end_behavior: "cancel",
	livemode: false,
	metadata: {
		userId: "owner",
		anidachiTrialMode: "cardless_v1",
		trialActivationId: activation.id,
	},
	phases: [{ start_date: start, end_date: end, trial_end: end }],
} as unknown as Stripe.SubscriptionSchedule;
function client(
	s = subscription,
	sc = schedule,
	invoices: Stripe.Invoice[] = [],
) {
	const reads: string[] = [];
	const stripe = {
		subscriptions: {
			retrieve: async () => {
				reads.push("subscription");
				return s;
			},
		},
		subscriptionSchedules: {
			retrieve: async (id: string) => {
				assert.equal(id, activation.stripe_schedule_id);
				reads.push("schedule");
				return sc;
			},
		},
		invoices: {
			list: async () => ({ data: invoices, has_more: false }),
			retrieve: async () => invoices[0],
		},
	} as unknown as Stripe;
	return { stripe, reads };
}
test("cardless snapshot carries verified activation and fresh schedule provenance", async () => {
	const { stripe, reads } = client();
	const result = await resolveStripeTrialSnapshot(
		stripe,
		subscription,
		null,
		undefined,
		activation,
	);
	assert.equal(result?.trialMode, "cardless");
	assert.equal(result?.trialActivationId, activation.id);
	assert.equal(result?.stripeScheduleId, schedule.id);
	assert.equal(result?.scheduleEndBehavior, "cancel");
	assert.equal(result?.checkoutReservationId, null);
	assert.deepEqual(reads, ["schedule"]);
});
test("metadata alone cannot turn an unreserved subscription into a trial", async () => {
	await assert.rejects(
		resolveStripeTrialSnapshot(client().stripe, subscription, null),
		/activation/i,
	);
});
test("activation owner, customer, dates, subscription and state are fenced", async () => {
	for (const patch of [
		{ user_id: "other" },
		{ stripe_customer_id: "cus_other" },
		{ stripe_subscription_id: "sub_other" },
		{ trial_ends_at: iso(end + 1) },
		{ state: "pending" as const },
	]) {
		await assert.rejects(
			resolveStripeTrialSnapshot(
				client().stripe,
				subscription,
				null,
				undefined,
				{ ...activation, ...patch },
			),
			/activation|identity|owner/i,
		);
	}
});
test("fresh schedule with wrong customer, link, mode or changed phase never commits", async () => {
	for (const patch of [
		{ customer: "cus_other" },
		{ subscription: "sub_other" },
		{ livemode: true },
		{ phases: [{ start_date: start, end_date: end + 1, trial_end: end + 1 }] },
		{ metadata: { ...schedule.metadata, trialActivationId: "other" } },
	]) {
		const { stripe } = client(subscription, {
			...schedule,
			...patch,
		} as Stripe.SubscriptionSchedule);
		await assert.rejects(
			resolveStripeTrialSnapshot(
				stripe,
				subscription,
				null,
				undefined,
				activation,
			),
			/schedule|identity|owner/i,
		);
	}
});
test("completed cancellation and automatic release retain the same trial identity", async () => {
	for (const status of ["completed", "released"] as const) {
		const sub = {
			...subscription,
			schedule: null,
			status: status === "completed" ? "canceled" : "active",
		} as Stripe.Subscription;
		const sc = {
			...schedule,
			status,
			end_behavior: status === "completed" ? "cancel" : "release",
			subscription: status === "completed" ? sub.id : null,
			released_subscription: status === "released" ? sub.id : null,
		} as Stripe.SubscriptionSchedule;
		const result = await resolveStripeTrialSnapshot(
			client(sub, sc).stripe,
			sub,
			null,
			undefined,
			activation,
		);
		assert.equal(result?.scheduleStatus, status);
		assert.equal(result?.trialEndsAt, iso(end));
	}
});
test("a credit-settled recurring service grants access without recording cash conversion", async () => {
	const zero = {
		id: "in_zero",
		customer: "cus_trial",
		billing_reason: "subscription_cycle",
		created: end,
		status: "paid",
		amount_due: 0,
		amount_paid: 0,
		amount_remaining: 0,
		parent: { subscription_details: { subscription: "sub_trial" } },
		status_transitions: { paid_at: end + 1 },
		lines: {
			has_more: false,
			data: [
				{
					period: { start: end, end: end + 86400 * 30 },
					parent: { subscription_item_details: { subscription: "sub_trial" } },
				},
			],
		},
	} as unknown as Stripe.Invoice;
	const result = await resolveStripeTrialSnapshot(
		client(subscription, schedule, [zero]).stripe,
		subscription,
		null,
		undefined,
		activation,
	);
	assert.equal(result?.firstPaymentState, "paid");
	assert.equal(result?.firstInvoiceId, "in_zero");
	assert.equal(result?.firstCashInvoiceId, null);
});
test("sync reads activation after lease and passes provenance to the common commit", async () => {
	const { stripe, reads } = client();
	let committed = false;
	await syncStripeSubscriptionById(stripe, subscription.id, {
		begin: async () => {
			reads.push("lease");
			return { fence: 1, token: "token" };
		},
		release: async () => {},
		resolveUserId: async () => "owner",
		resolveSubscriptionOwner: async () => null,
		readTrial: async () => null,
		readTrialActivation: async (id) => {
			assert.equal(id, activation.id);
			reads.push("activation");
			return activation;
		},
		commit: async (params) => {
			assert.equal(params.trial?.trialMode, "cardless");
			assert.equal(params.trial?.trialActivationId, activation.id);
			committed = true;
			return "plus";
		},
	});
	assert.deepEqual(reads, ["lease", "subscription", "activation", "schedule"]);
	assert.equal(committed, true);
});
test("invalid activation never reaches the shared mirror commit", async () => {
	let committed = false;
	await assert.rejects(
		syncStripeSubscriptionById(client().stripe, subscription.id, {
			begin: async () => ({ fence: 1, token: "token" }),
			release: async () => {},
			resolveUserId: async () => "owner",
			resolveSubscriptionOwner: async () => null,
			readTrial: async () => null,
			readTrialActivation: async () => ({ ...activation, user_id: "other" }),
			commit: async () => {
				committed = true;
				return "plus";
			},
		}),
		/activation|owner/i,
	);
	assert.equal(committed, false);
});

test("a later cash payment is recorded after the first cycle was covered by credit", async () => {
	const cash = {
		id: "in_cash_later",
		customer: "cus_trial",
		billing_reason: "subscription_cycle",
		created: end + 30 * 86400,
		status: "paid",
		amount_due: 799,
		amount_paid: 799,
		amount_remaining: 0,
		parent: { subscription_details: { subscription: "sub_trial" } },
		status_transitions: { paid_at: end + 30 * 86400 + 1 },
		lines: {
			has_more: false,
			data: [
				{
					period: { start: end + 30 * 86400, end: end + 60 * 86400 },
					parent: { subscription_item_details: { subscription: "sub_trial" } },
				},
			],
		},
	} as unknown as Stripe.Invoice;
	const prior = {
		user_id: "owner",
		stripe_subscription_id: subscription.id,
		trial_mode: "cardless" as const,
		trial_activation_id: activation.id,
		stripe_schedule_id: schedule.id,
		trial_started_at: iso(start),
		trial_ends_at: iso(end),
		first_invoice_id: "in_credit",
		first_payment_state: "paid" as const,
		first_paid_at: iso(end + 1),
	};
	const result = await resolveStripeTrialSnapshot(
		client(subscription, schedule, [cash]).stripe,
		subscription,
		prior,
		undefined,
		activation,
	);
	assert.equal(result?.firstInvoiceId, "in_credit");
	assert.equal(result?.firstPaidAt, iso(end + 1));
	assert.equal(result?.firstCashInvoiceId, cash.id);
	assert.equal(result?.firstCashPaidAt, iso(end + 30 * 86400 + 1));
	assert.equal(result?.firstCashAmountPaid, 799);
});

function clockFixture() {
	const sub = {
		...subscription,
		status: "active",
		schedule: null,
		test_clock: "clock_trial",
	} as Stripe.Subscription;
	const sc = {
		...schedule,
		status: "released",
		end_behavior: "release",
		subscription: null,
		released_subscription: sub.id,
	} as Stripe.SubscriptionSchedule;
	const first = {
		id: "in_clock_first",
		customer: sub.customer,
		created: end,
		billing_reason: "subscription_cycle",
		status: "paid",
		amount_due: 799,
		amount_paid: 799,
		amount_remaining: 0,
		parent: { subscription_details: { subscription: sub.id } },
		status_transitions: { paid_at: end + 3600 },
		lines: {
			has_more: false,
			data: [
				{
					period: { start: end, end: end + 30 * 86400 },
					parent: { subscription_item_details: { subscription: sub.id } },
				},
			],
		},
	} as unknown as Stripe.Invoice;
	const invoices = [
		{ ...first, id: "in_later", created: end + 30 * 86400 },
		first,
		{ ...first, id: "in_before_trial_end", created: end - 1 },
		{
			...first,
			id: "in_initial_zero",
			billing_reason: "subscription_create",
			created: start,
			amount_paid: 0,
		},
		{
			...first,
			id: "in_update_zero",
			billing_reason: "subscription_update",
			amount_paid: 0,
		},
	] as Stripe.Invoice[];
	const { stripe } = client(sub, sc);
	// Observed Sandbox behavior: `created[gte]` hides invoices generated by
	// advancing an existing customer's clock, despite their returned timestamp.
	stripe.invoices.list = (async (params: Stripe.InvoiceListParams) => {
		assert.equal(params.subscription, sub.id);
		assert.equal(params.limit, 100);
		return { data: params.created ? [] : invoices, has_more: false };
	}) as typeof stripe.invoices.list;
	stripe.invoices.retrieve = (async (id: string) => {
		const found = invoices.find((inv) => inv.id === id);
		assert.ok(found);
		return found;
	}) as typeof stripe.invoices.retrieve;
	return { sub, stripe, first };
}

test("Test Clock recovery finds the first paid cycle despite provider created filtering", async () => {
	const { sub, stripe, first } = clockFixture();
	const result = await resolveStripeTrialSnapshot(
		stripe,
		sub,
		null,
		undefined,
		activation,
	);
	assert.equal(result?.firstInvoiceId, first.id);
	assert.equal(result?.firstPaymentState, "paid");
	assert.equal(result?.firstPaidAt, iso(end + 3600));
	assert.equal(result?.firstCashInvoiceId, first.id);
	assert.equal(result?.firstCashAmountPaid, 799);
	assert.equal(result?.firstCashPaidAt, iso(end + 3600));
	assert.equal(result?.trialEndsAt, iso(end));
});

for (const [paymentStatus, expected] of [
	["requires_action", "action_required"],
	["requires_payment_method", "failed"],
] as const) {
	test(`Test Clock recovery records ${expected} without a cash conversion`, async () => {
		const { sub, stripe, first } = clockFixture();
		Object.assign(first, {
			status: "open",
			amount_paid: 0,
			amount_remaining: 799,
			attempted: true,
			status_transitions: { paid_at: null },
			payments: {
				has_more: false,
				data: [
					{
						payment: {
							type: "payment_intent",
							payment_intent: {
								id: "pi_trial",
								customer: "cus_trial",
								status: paymentStatus,
							},
						},
					},
				],
			},
		});
		const result = await resolveStripeTrialSnapshot(
			stripe,
			sub,
			null,
			undefined,
			activation,
		);
		assert.equal(result?.firstInvoiceId, first.id);
		assert.equal(result?.firstPaymentState, expected);
		assert.equal(result?.firstPaidAt, null);
		assert.equal(result?.firstCashInvoiceId, null);
	});
}

test("Test Clock discovery still rejects wrong invoice ownership and truncated history", async () => {
	const { sub, stripe, first } = clockFixture();
	first.customer = "cus_other";
	await assert.rejects(
		resolveStripeTrialSnapshot(stripe, sub, null, undefined, activation),
		/owner|identity/i,
	);
	stripe.invoices.list = (async () => ({
		data: [first],
		has_more: true,
	})) as typeof stripe.invoices.list;
	await assert.rejects(
		resolveStripeTrialSnapshot(stripe, sub, null, undefined, activation),
		/requires reconciliation/i,
	);
});
