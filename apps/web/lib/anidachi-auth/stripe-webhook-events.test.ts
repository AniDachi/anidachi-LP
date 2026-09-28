import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { processSubscriptionWebhookEvent } from "./stripe-webhook-events";

function fixture(type: string, object: unknown, livemode = true) {
	return { type, livemode, data: { object } } as Stripe.Event;
}
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
