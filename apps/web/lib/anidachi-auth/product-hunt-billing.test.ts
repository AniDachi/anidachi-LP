import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { productHuntBillingSnapshot } from "./product-hunt-billing";

function fixture() {
	const now = Date.parse("2026-10-25T12:00:00Z");
	const sub = {
		id: "sub_one",
		customer: "cus_owner",
		livemode: false,
		metadata: { userId: "owner" },
		status: "active",
		discounts: [
			{
				id: "di_one",
				end: 1798200000,
				coupon: {
					percent_off: 40,
					duration: "repeating",
					duration_in_months: 3,
					metadata: { anidachiCampaign: "product_hunt_2026" },
				},
			},
		],
		items: {
			has_more: false,
			data: [
				{
					quantity: 1,
					current_period_end: 1795608000,
					discounts: [],
					price: {
						id: "price_one",
						unit_amount: 799,
						currency: "usd",
						recurring: { interval: "month", interval_count: 1 },
					},
				},
			],
		},
	} as unknown as Stripe.Subscription;
	return {
		sub,
		now,
		run: () =>
			productHuntBillingSnapshot(sub, {
				userId: "owner",
				customerId: "cus_owner",
				priceId: "price_one",
				livemode: false,
				now,
			}),
	};
}
test("billing uses discounted next renewal, then full monthly price at the discount boundary", () => {
	const f = fixture();
	assert.equal(f.run()?.state, "active");
	assert.equal(f.run()?.nextPrice?.unitAmount, 479);
	f.sub.items.data[0].current_period_end = (
		f.sub.discounts[0] as Stripe.Discount
	).end!;
	assert.equal(f.run()?.nextPrice?.unitAmount, 799);
	(f.sub.discounts[0] as Stripe.Discount).end = f.now / 1000;
	assert.equal(f.run(), undefined);
});
test("unsafe or changed discount snapshots never invent a next charge", () => {
	for (const mutate of [
		(f: ReturnType<typeof fixture>) => {
			f.sub.customer = "cus_foreign";
		},
		(f: ReturnType<typeof fixture>) => {
			f.sub.items.data[0].price.id = "price_changed";
		},
		(f: ReturnType<typeof fixture>) => {
			f.sub.discounts = ["di_unexpanded"];
		},
		(f: ReturnType<typeof fixture>) => {
			f.sub.discounts.push(f.sub.discounts[0]);
		},
	]) {
		const f = fixture();
		mutate(f);
		assert.throws(f.run);
	}
});
