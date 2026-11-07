import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { fulfillRetentionInvoice } from "./retention-invoice";
import { processSubscriptionWebhookEvent } from "./stripe-webhook-events";

function fixture(type: string, object: unknown, livemode = true) {
	return { type, livemode, data: { object } } as Stripe.Event;
}
test("cardless setup uses the same finalizer without announcing a purchase", async () => {
	const calls: string[] = [];
	await processSubscriptionWebhookEvent(
		fixture("checkout.session.completed", {
			id: "cs_setup",
			mode: "setup",
			metadata: { trialRenewalId: "op" },
		}),
		{
			sync: async () => {
				calls.push("sync");
			},
			alert: async () => {
				calls.push("alert");
			},
			completeSetup: async (id) => {
				calls.push(id);
			},
		},
	);
	assert.deepEqual(calls, ["cs_setup"]);
});
test("unresolved setup finalizer fails delivery so Stripe retries", async () => {
	await assert.rejects(
		processSubscriptionWebhookEvent(
			fixture("checkout.session.completed", {
				id: "cs_setup",
				mode: "setup",
				metadata: { trialRenewalId: "op" },
			}),
			{
				sync: async () => {},
				alert: async () => {},
				completeSetup: async () => {
					throw Error("pending retry");
				},
			},
		),
		/pending retry/,
	);
});
test("action-required invoice refreshes current subscription just like failed/paid", async () => {
	for (const type of [
		"invoice.payment_action_required",
		"invoice.payment_failed",
		"invoice.paid",
	]) {
		const ids: string[] = [];
		await processSubscriptionWebhookEvent(
			fixture(type, {
				parent: { subscription_details: { subscription: "sub_trial" } },
			}),
			{
				sync: async (id) => {
					ids.push(id);
				},
				alert: async () => {
					throw Error("no checkout alert expected");
				},
			},
		);
		assert.deepEqual(ids, ["sub_trial"]);
	}
});
test("zero initial trial invoice/checkout never generates a purchase alert", async () => {
	let synced = 0,
		alerts = 0;
	await processSubscriptionWebhookEvent(
		fixture("checkout.session.completed", {
			id: "cs_trial",
			mode: "subscription",
			subscription: "sub_trial",
			payment_status: "no_payment_required",
			amount_total: 0,
		}),
		{
			sync: async () => {
				synced++;
			},
			alert: async () => {
				alerts++;
			},
		},
	);
	assert.equal(synced, 1);
	assert.equal(alerts, 0);
});
test("sandbox never sends internal purchase email while live paid checkout syncs before alert", async () => {
	for (const live of [false, true]) {
		const order: string[] = [];
		await processSubscriptionWebhookEvent(
			fixture(
				"checkout.session.completed",
				{
					id: "cs_paid",
					mode: "subscription",
					subscription: "sub_paid",
					payment_status: "paid",
					amount_total: 799,
					customer: "cus_paid",
					currency: "usd",
				},
				live,
			),
			{
				sync: async () => {
					order.push("sync");
				},
				alert: async () => {
					order.push("alert");
				},
			},
		);
		assert.deepEqual(order, live ? ["sync", "alert"] : ["sync"]);
	}
});
test("failed synchronization does not announce a purchase", async () => {
	let alerted = false;
	await assert.rejects(
		processSubscriptionWebhookEvent(
			fixture("checkout.session.completed", {
				mode: "subscription",
				subscription: "sub_paid",
				payment_status: "paid",
				amount_total: 799,
			}),
			{
				sync: async () => {
					throw Error("authority unavailable");
				},
				alert: async () => {
					alerted = true;
				},
			},
		),
		/authority/,
	);
	assert.equal(alerted, false);
});

test("signed subscription/invoice sync reconciles native allowance using current state on duplicate and delayed events", async () => {
	const order: string[] = [];
	const deps = {
		sync: async (id: string) => {
			order.push(`sync:${id}`);
		},
		reconcileCancellation: async (id: string) => {
			order.push(`native:${id}`);
		},
		alert: async () => {},
	};
	for (const type of [
		"customer.subscription.updated",
		"invoice.paid",
		"invoice.payment_failed",
		"customer.subscription.updated",
	]) {
		const event = fixture(
			type,
			type.startsWith("invoice")
				? { parent: { subscription_details: { subscription: "sub_native" } } }
				: { id: "sub_native" },
			false,
		);
		await processSubscriptionWebhookEvent(event, deps);
	}
	assert.deepEqual(
		order,
		Array.from({ length: 4 }, () => [
			"sync:sub_native",
			"native:sub_native",
		]).flat(),
	);
});
test("draft-created reconciles native redemption independently of legacy invoice-only fulfillment", async () => {
	const order: string[] = [];
	await processSubscriptionWebhookEvent(
		fixture(
			"invoice.created",
			{ parent: { subscription_details: { subscription: "sub_native" } } },
			false,
		),
		{
			sync: async () => {
				order.push("sync");
			},
			alert: async () => {},
			reconcileCancellation: async (id) => {
				order.push(`native:${id}`);
			},
			retentionInvoice: async () => {
				order.push("legacy");
			},
		},
	);
	assert.deepEqual(order, ["native:sub_native", "legacy"]);
});
test("native reconciliation errors retry signed delivery and never create another invoice discount", async () => {
	let legacy = 0;
	await assert.rejects(
		processSubscriptionWebhookEvent(
			fixture(
				"invoice.created",
				{ parent: { subscription_details: { subscription: "sub_native" } } },
				false,
			),
			{
				sync: async () => {},
				alert: async () => {},
				reconcileCancellation: async () => {
					throw Error("reconcile pending");
				},
				retentionInvoice: async () => {
					legacy++;
				},
			},
		),
		/reconcile pending/,
	);
	assert.equal(legacy, 0);
});
test("live event sync reconciles its native cancellation allowance", async () => {
	let reconciled = 0;
	await processSubscriptionWebhookEvent(
		fixture("customer.subscription.updated", { id: "sub_live" }, true),
		{
			sync: async () => {},
			alert: async () => {},
			reconcileCancellation: async () => {
				reconciled++;
			},
		},
	);
	assert.equal(reconciled, 1);
});

test("native draft event never invokes legacy Stripe discount fulfillment when no uninstall claim exists", async () => {
	let writes = 0;
	let native = 0;
	const invoice = {
		id: "in_native",
		livemode: false,
		billing_reason: "subscription_cycle",
		parent: { subscription_details: { subscription: "sub_native" } },
	} as Stripe.Invoice;
	await processSubscriptionWebhookEvent(
		fixture("invoice.created", invoice, false),
		{
			sync: async () => {},
			alert: async () => {},
			reconcileCancellation: async () => {
				native++;
			},
			retentionInvoice: async (inv) =>
				fulfillRetentionInvoice(inv, {
					stripe: {} as Stripe,
					find: async () => null,
					bind: async () => {
						writes++;
						throw Error("native must not bind legacy claim");
					},
					finish: async () => {
						writes++;
					},
				}),
		},
	);
	assert.equal(native, 1);
	assert.equal(writes, 0);
});

test("LIVE draft-created reconciles and fulfills accepted retention independently of issuance flags", async () => {
	const calls: string[] = [];
	await processSubscriptionWebhookEvent(
		fixture(
			"invoice.created",
			{
				id: "in_live",
				livemode: true,
				parent: { subscription_details: { subscription: "sub_live" } },
			},
			true,
		),
		{
			expectedLivemode: true,
			sync: async () => {},
			alert: async () => {},
			reconcileCancellation: async () => {
				calls.push("reconcile");
			},
			retentionInvoice: async () => {
				calls.push("invoice");
			},
		},
	);
	assert.deepEqual(calls, ["reconcile", "invoice"]);
});

test("webhook mode mismatch is rejected before any durable or provider handler", async () => {
	for (const expectedLivemode of [true, false]) {
		let calls = 0;
		await assert.rejects(
			processSubscriptionWebhookEvent(
				fixture("invoice.created", {}, !expectedLivemode),
				{
					expectedLivemode,
					sync: async () => {
						calls++;
					},
					alert: async () => {
						calls++;
					},
					reconcileCancellation: async () => {
						calls++;
					},
					retentionInvoice: async () => {
						calls++;
					},
				},
			),
			/mode mismatch/,
		);
		assert.equal(calls, 0);
	}
});
