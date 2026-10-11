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
test("zero recurring invoice is not a cardless paid conversion", async () => {
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
	assert.equal(result?.firstPaymentState, "awaiting");
	assert.equal(result?.firstInvoiceId, null);
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
