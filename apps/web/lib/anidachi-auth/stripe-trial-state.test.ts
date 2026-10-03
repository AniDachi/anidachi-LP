import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { resolveStripeTrialSnapshot } from "./stripe-trial-state";

const start = 1_790_000_000,
	end = start + 72 * 3600;
const sub = {
	id: "sub_trial",
	customer: "cus_trial",
	status: "trialing",
	trial_start: start,
	trial_end: end,
	metadata: {
		anidachiTrial: "72h_v1",
		checkoutReservationId: "11111111-1111-4111-8111-111111111111",
	},
} as unknown as Stripe.Subscription;
const iso = (v: number) => new Date(v * 1000).toISOString();
function invoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
	return {
		id: "in_first",
		customer: "cus_trial",
		parent: { subscription_details: { subscription: "sub_trial" } },
		billing_reason: "subscription_cycle",
		created: end,
		status: "draft",
		amount_remaining: 799,
		status_transitions: { paid_at: null },
		attempted: false,
		attempt_count: 0,
		lines: {
			has_more: false,
			data: [
				{
					period: { start: end, end: end + 30 * 86400 },
					parent: { subscription_item_details: { subscription: "sub_trial" } },
				},
			],
		},
		payments: { has_more: false, data: [] },
		...overrides,
	} as unknown as Stripe.Invoice;
}
function stripe(invoices: Stripe.Invoice[], current?: Stripe.Invoice) {
	return {
		invoices: {
			list: async () => ({ data: invoices, has_more: false }),
			retrieve: async () => current ?? invoices[0],
		},
	} as unknown as Stripe;
}
test("unmanaged subscriptions never consume the new account trial", async () => {
	assert.equal(
		await resolveStripeTrialSnapshot(
			stripe([]),
			{ ...sub, metadata: {} } as Stripe.Subscription,
			null,
		),
		null,
	);
});
test("trial identity comes from Stripe and zero initial invoice is not conversion", async () => {
	const result = await resolveStripeTrialSnapshot(
		stripe([
			invoice({
				billing_reason: "subscription_create",
				created: start,
				status: "paid",
				amount_remaining: 0,
			}),
		]),
		sub,
		null,
	);
	assert.equal(result?.trialStartedAt, iso(start));
	assert.equal(result?.trialEndsAt, iso(end));
	assert.equal(result?.firstPaymentState, "awaiting");
	assert.equal(result?.firstInvoiceId, null);
});
test("first regular draft invoice retains bounded pending state", async () => {
	const result = await resolveStripeTrialSnapshot(
		stripe([invoice()]),
		sub,
		null,
	);
	assert.equal(result?.firstInvoiceId, "in_first");
	assert.equal(result?.firstPaymentState, "awaiting");
});
test("confirmed regular payment is distinct from subscription active", async () => {
	const paid = invoice({
		status: "paid",
		amount_remaining: 0,
		status_transitions: {
			paid_at: end + 3700,
		} as Stripe.Invoice.StatusTransitions,
	});
	const result = await resolveStripeTrialSnapshot(
		stripe([paid]),
		{ ...sub, status: "active" },
		null,
	);
	assert.equal(result?.firstPaymentState, "paid");
	assert.equal(result?.firstPaidAt, iso(end + 3700));
});
test("3DS and rejected payment end waiting before the two-hour bound", async () => {
	for (const [status, state] of [
		["requires_action", "action_required"],
		["requires_payment_method", "failed"],
	] as const) {
		const inv = invoice({
			status: "open",
			attempted: true,
			payments: {
				has_more: false,
				data: [
					{
						payment: {
							type: "payment_intent",
							payment_intent: { id: "pi_1", customer: "cus_trial", status },
						},
					},
				],
			},
		} as unknown as Partial<Stripe.Invoice>);
		assert.equal(
			(await resolveStripeTrialSnapshot(stripe([inv]), sub, null))
				?.firstPaymentState,
			state,
		);
	}
});
test("processing payment is still pending even after an attempt", async () => {
	const inv = invoice({
		status: "open",
		attempted: true,
		payments: {
			has_more: false,
			data: [
				{
					payment: {
						type: "payment_intent",
						payment_intent: {
							id: "pi_1",
							customer: "cus_trial",
							status: "processing",
						},
					},
				},
			],
		},
	} as unknown as Partial<Stripe.Invoice>);
	assert.equal(
		(await resolveStripeTrialSnapshot(stripe([inv]), sub, null))
			?.firstPaymentState,
		"awaiting",
	);
});
test("late delivery uses earliest renewal and fresh invoice rather than event snapshot", async () => {
	const first = invoice(),
		next = invoice({ id: "in_later", created: end + 30 * 86400 });
	const fresh = invoice({
		status: "paid",
		amount_remaining: 0,
		status_transitions: {
			paid_at: end + 4000,
		} as Stripe.Invoice.StatusTransitions,
	});
	assert.equal(
		(await resolveStripeTrialSnapshot(stripe([next, first], fresh), sub, null))
			?.firstInvoiceId,
		"in_first",
	);
	assert.equal(
		(await resolveStripeTrialSnapshot(stripe([next, first], fresh), sub, null))
			?.firstPaymentState,
		"paid",
	);
});
test("invoice owner mismatch fails without a paid snapshot", async () => {
	await assert.rejects(
		resolveStripeTrialSnapshot(
			stripe([invoice({ customer: "cus_other" })]),
			sub,
			null,
		),
		/owner|identity/i,
	);
});
test("trial extension or second trial start is rejected against immutable ledger", async () => {
	const old = {
		user_id: "u",
		stripe_subscription_id: "sub_trial",
		trial_started_at: iso(start),
		trial_ends_at: iso(end),
		first_invoice_id: null,
		first_payment_state: "awaiting" as const,
		first_paid_at: null,
	};
	await assert.rejects(
		resolveStripeTrialSnapshot(
			stripe([]),
			{ ...sub, trial_end: end + 86400 },
			old,
		),
		/trial.*identity/i,
	);
});
test("confirmed first payment remains monotonic on an old repeated event", async () => {
	const old = {
		user_id: "u",
		stripe_subscription_id: "sub_trial",
		trial_started_at: iso(start),
		trial_ends_at: iso(end),
		first_invoice_id: "in_first",
		first_payment_state: "paid" as const,
		first_paid_at: iso(end + 3700),
	};
	const result = await resolveStripeTrialSnapshot(stripe([]), sub, old);
	assert.equal(result?.firstPaymentState, "paid");
	assert.equal(result?.firstPaidAt, old.first_paid_at);
});
