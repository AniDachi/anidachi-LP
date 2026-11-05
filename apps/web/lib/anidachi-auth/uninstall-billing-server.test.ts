import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import type { SubscriptionRow } from "./db";
import type { CancellationOffer } from "./cancellation-retention-store";
import { cancellationCouponParams } from "./cancellation-retention-stripe";
import { readBillingPromotions } from "./uninstall-billing-server";

function fixture(accepted = false) {
	const row = {
		id: "local",
		user_id: "owner",
		stripe_customer_id: "cus_owner",
		stripe_subscription_id: "sub_owner",
		status: "active",
	} as SubscriptionRow;
	const offer: CancellationOffer = {
		id: "offer",
		user_id: "owner",
		stripe_customer_id: "cus_owner",
		stripe_subscription_id: "sub_owner",
		price_id: "price_monthly",
		product_ids: ["prod_monthly", "prod_pro"],
		target_period_start: 2000000000,
		coupon_id: "coupon_native",
		redeem_by: 1900000600,
		state: accepted ? "accepted" : "pending",
		created_at: "2030-01-01T00:00:00Z",
		accepted_at: null,
		reconciled_at: null,
	};
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
	const sub = {
		id: "sub_owner",
		customer: "cus_owner",
		metadata: { userId: "owner" },
		livemode: false,
		status: "active",
		discounts: accepted ? [{ coupon }] : [],
		items: {
			has_more: false,
			data: [
				{
					quantity: 1,
					current_period_end: offer.target_period_start,
					discounts: [],
					price: {
						id: offer.price_id,
						product: "prod_monthly",
						currency: "usd",
						unit_amount: 799,
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
	const fullCoupon = structuredClone(coupon);
	let couponReads = 0;
	let reads = 0;
	const deps: NonNullable<Parameters<typeof readBillingPromotions>[2]> = {
		readProductHuntBilling: async () => ({}),
		mode: () => "test",
		readClaim: async () => null,
		readAccount: async (userId, options) => {
			assert.equal(userId, "owner");
			assert.equal(options?.presentationOnly, true);
			return {
				customerId: "cus_owner",
				customerIds: ["cus_owner"],
				subscriptionIds: ["sub_owner"],
				hasPaid: true,
				grant: accepted ? "cancellation" : undefined,
				firstBinding: null,
			};
		},
		createStripe: () =>
			({
				coupons: {
					retrieve: async (id: string, params: unknown) => {
						assert.equal(id, offer.coupon_id);
						assert.deepEqual(params, { expand: ["applies_to"] });
						couponReads++;
						return fullCoupon;
					},
				},
				customers: {
					retrieve: async () => ({
						id: "cus_owner",
						livemode: false,
						metadata: { userId: "owner" },
					}),
				},
				subscriptions: {
					retrieve: async () => {
						reads++;
						return sub;
					},
				},
			}) as unknown as Stripe,
		readCancellationOffer: async () => offer,
	};
	return {
		row,
		sub,
		offer,
		deps,
		read: () => readBillingPromotions("owner", [row], deps),
		reads: () => reads,
		couponReads: () => couponReads,
	};
}
test("pending native opening uses presentation-only account history without marking allowance used", async () => {
	const f = fixture();
	assert.deepEqual(await f.read(), {});
	assert.equal(f.reads(), 1);
});
test("native acceptance shows discounted next monthly price and consumed coupon disappears without a lingering promise", async () => {
	const f = fixture(true);
	assert.equal((await f.read()).local?.nextPrice?.unitAmount, 479);
	f.sub.discounts = [];
	assert.deepEqual(await f.read(), {});
});
test("native accepted after annual conversion keeps actual annual display and monthly-only campaign", async () => {
	const f = fixture(true);
	const price = f.sub.items.data[0].price;
	price.id = "price_yearly";
	price.product = "prod_yearly";
	price.unit_amount = 7670;
	price.recurring!.interval = "year";
	assert.deepEqual((await f.read()).local, {
		state: "active",
		campaign: "cancellation_retention",
	});
});
test("uncertain native terms remain unavailable rather than a claimed price", async () => {
	const f = fixture(true);
	f.sub.metadata.userId = "other";
	assert.deepEqual((await f.read()).local, { state: "unavailable" });
});
test("no native or legacy allowance avoids additional Stripe subscription/customer reads", async () => {
	const f = fixture();
	f.deps.readCancellationOffer = async () => null;
	assert.deepEqual(await f.read(), {});
	assert.equal(f.reads(), 0);
});

test("omitted embedded coupon scope is read from the exact durable coupon before price display", async () => {
	const f = fixture(true);
	delete (f.sub.discounts[0] as Stripe.Discount).coupon.applies_to;
	assert.equal((await f.read()).local?.nextPrice?.unitAmount, 479);
	assert.equal(f.couponReads(), 1);
});
