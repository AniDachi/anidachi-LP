import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { cancellationBillingSnapshot } from "./cancellation-retention-billing";
import type { CancellationOffer } from "./cancellation-retention-store";
import { cancellationCouponParams } from "./cancellation-retention-stripe";

const offer: CancellationOffer = {
	id: "offer_1",
	user_id: "owner",
	stripe_customer_id: "cus_owner",
	stripe_subscription_id: "sub_owner",
	price_id: "price_monthly",
	product_ids: ["prod_monthly", "prod_pro_monthly"],
	target_period_start: 2000000000,
	coupon_id: "coupon_native",
	redeem_by: 1900000600,
	state: "accepted",
	created_at: "2030-01-01T00:00:00Z",
	accepted_at: "2030-01-01T00:01:00Z",
	reconciled_at: null,
};
function subscription() {
	const coupon = {
		...cancellationCouponParams(offer),
		id: offer.coupon_id,
		livemode: false,
		amount_off: null,
		currency: null,
		duration_in_months: null,
		times_redeemed: 1,
		valid: false,
	};
	return {
		id: "sub_owner",
		customer: "cus_owner",
		metadata: { userId: "owner" },
		livemode: false,
		status: "active",
		discounts: [{ id: "di_native", coupon, subscription: "sub_owner" }],
		cancel_at_period_end: false,
		cancel_at: null,
		items: {
			has_more: false,
			data: [
				{
					id: "si_1",
					quantity: 1,
					current_period_end: offer.target_period_start,
					discounts: [],
					price: {
						id: "price_monthly",
						product: "prod_monthly",
						currency: "usd",
						unit_amount: 799,
						type: "recurring",
						billing_scheme: "per_unit",
						recurring: {
							interval: "month",
							interval_count: 1,
							usage_type: "licensed",
						},
					},
				},
			],
		},
	} as unknown as Stripe.Subscription;
}
test("verified attached redeemed coupon discounts only the pending monthly renewal", () => {
	const view = cancellationBillingSnapshot(
		subscription(),
		offer,
		1900000000000,
	);
	assert.equal(view?.campaign, "cancellation_retention");
	assert.equal(view?.nextPrice?.unitAmount, 479);
	assert.equal(view?.nextPrice?.billingPeriod, "monthly");
});
test("opening without acceptance never promises a monthly discount", () => {
	const sub = subscription();
	sub.discounts = [];
	assert.equal(
		cancellationBillingSnapshot(
			sub,
			{ ...offer, state: "pending" },
			1900000000000,
		),
		undefined,
	);
});
test("coupon disappearing at draft creation or target passing removes the next-price promise", () => {
	const sub = subscription();
	sub.discounts = [];
	assert.equal(
		cancellationBillingSnapshot(sub, offer, 1900000000000),
		undefined,
	);
	assert.equal(
		cancellationBillingSnapshot(subscription(), offer, 2000000000000),
		undefined,
	);
	const next = subscription();
	next.items.data[0].current_period_end++;
	assert.equal(
		cancellationBillingSnapshot(next, offer, 1900000000000),
		undefined,
	);
});
test("stale accepted monthly offer on annual remains explanatory with no reduced annual or future monthly promise", () => {
	const sub = subscription();
	const price = sub.items.data[0].price;
	price.id = "price_annual";
	price.product = "prod_annual";
	price.recurring!.interval = "year";
	price.unit_amount = 7670;
	const view = cancellationBillingSnapshot(sub, offer, 1900000000000);
	assert.equal(view?.campaign, "cancellation_retention");
	assert.equal(view?.nextPrice, undefined);
});
test("billing evidence rejects ownership and altered coupon terms", () => {
	for (const mutate of [
		(s: Stripe.Subscription) => {
			s.metadata.userId = "foreign";
		},
		(s: Stripe.Subscription) => {
			s.customer = "cus_foreign";
		},
		(s: Stripe.Subscription) => {
			(s.discounts[0] as Stripe.Discount).coupon.percent_off = 99;
		},
	]) {
		const sub = subscription();
		mutate(sub);
		assert.throws(() => cancellationBillingSnapshot(sub, offer, 1900000000000));
	}
});
test("failed payment, canceled or changed monthly subscriptions cannot promise the pending charge", () => {
	for (const mutate of [
		(s: Stripe.Subscription) => {
			s.status = "past_due";
		},
		(s: Stripe.Subscription) => {
			s.cancel_at_period_end = true;
		},
		(s: Stripe.Subscription) => {
			s.items.data[0].price.id = "price_other";
		},
	]) {
		const sub = subscription();
		mutate(sub);
		assert.equal(
			cancellationBillingSnapshot(sub, offer, 1900000000000)?.nextPrice,
			undefined,
		);
	}
});
