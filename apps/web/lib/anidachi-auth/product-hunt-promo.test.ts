import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
	ensureProductHuntPromotion,
	type CampaignBinding,
} from "./product-hunt-promo";

function fixture() {
	let now = Date.parse("2026-10-25T12:00:00Z");
	const deadline = Date.parse("2026-11-01T17:00:00Z") / 1000;
	const coupon = {
		id: "coupon_campaign",
		livemode: false,
		valid: true,
		percent_off: 40,
		amount_off: null,
		duration: "repeating",
		duration_in_months: 3,
		redeem_by: deadline,
		applies_to: { products: ["prod_plus", "prod_pro"] },
		metadata: { anidachiCampaign: "product_hunt_2026" },
	} as unknown as Stripe.Coupon;
	const customer = {
		id: "cus_owner",
		livemode: false,
		metadata: { userId: "owner" },
		discount: null,
	} as unknown as Stripe.Customer;
	const binding: CampaignBinding = {
		id: "binding",
		user_id: "owner",
		stripe_customer_id: "cus_owner",
		coupon_id: coupon.id,
		created_at: new Date(now).toISOString(),
	};
	const invoices: Stripe.Invoice[] = [];
	const promotions: Stripe.PromotionCode[] = [];
	const creates: {
		params: Stripe.PromotionCodeCreateParams;
		options: Stripe.RequestOptions;
	}[] = [];
	let claims = 0;
	let loseResponse = false;
	let hasMoreInvoices = false;
	const stripe = {
		customers: { retrieve: async () => customer },
		coupons: { retrieve: async () => coupon },
		prices: {
			retrieve: async (id: string) => ({
				id,
				product: id === "price_plus" ? "prod_plus" : "prod_pro",
				active: true,
				livemode: false,
				currency: "usd",
				type: "recurring",
				billing_scheme: "per_unit",
				transform_quantity: null,
				unit_amount: id === "price_plus" ? 799 : 1499,
				recurring: {
					interval: "month",
					interval_count: 1,
					usage_type: "licensed",
				},
			}),
		},
		invoices: {
			list: async (p: Stripe.InvoiceListParams) => {
				assert.equal(p.customer, "cus_owner");
				assert.equal(p.status, "paid");
				return { data: invoices, has_more: hasMoreInvoices };
			},
		},
		promotionCodes: {
			list: async (p: Stripe.PromotionCodeListParams) => {
				assert.equal(p.customer, "cus_owner");
				assert.equal(p.code, "ANIHUNT40");
				assert.equal(p.active, undefined); // Never lose consumed/inactive history.
				return { data: promotions, has_more: false };
			},
			create: async (
				p: Stripe.PromotionCodeCreateParams,
				o: Stripe.RequestOptions,
			) => {
				creates.push({ params: p, options: o });
				const result = {
					id: "promo_owner",
					...p,
					coupon,
					livemode: false,
					active: true,
					times_redeemed: 0,
					restrictions: {
						first_time_transaction: false,
						minimum_amount: null,
						minimum_amount_currency: null,
					},
				} as Stripe.PromotionCode;
				promotions.push(result);
				if (loseResponse) {
					loseResponse = false;
					throw new Error("lost Stripe response");
				}
				return result;
			},
			update: async (id: string, p: { active: boolean }) => {
				const found = promotions.find((item) => item.id === id)!;
				found.active = p.active;
				return found;
			},
		},
	} as unknown as Stripe;
	const run = () =>
		ensureProductHuntPromotion(
			{ userId: "owner", customerId: "cus_owner" },
			{
				stripe,
				couponId: coupon.id,
				livemode: false,
				monthlyPriceIds: ["price_plus", "price_pro"],
				now: () => now,
				claim: async () => {
					claims++;
					return binding;
				},
				accountHistory: async () => ({
					customerIds: ["cus_owner"],
					hasPaid: false,
				}),
			},
		);
	const paid = (amount: number) =>
		({
			id: "in_one",
			customer: "cus_owner",
			livemode: false,
			status: "paid",
			total: amount,
			amount_paid: amount,
			amount_remaining: 0,
			parent: { subscription_details: { subscription: "sub_one" } },
		}) as Stripe.Invoice;
	return {
		run,
		coupon,
		customer,
		binding,
		invoices,
		promotions,
		creates,
		paid,
		claims: () => claims,
		loseResponse: () => {
			loseResponse = true;
		},
		setNow: (n: number) => {
			now = n;
		},
		moreInvoices: () => {
			hasMoreInvoices = true;
		},
	};
}

test("expired free trial invoices allow a customer-bound one-use code without Stripe's first-transaction restriction", async () => {
	const f = fixture();
	f.invoices.push(f.paid(0));
	assert.equal(await f.run(), true);
	assert.deepEqual(f.creates[0].params, {
		coupon: "coupon_campaign",
		code: "ANIHUNT40",
		customer: "cus_owner",
		max_redemptions: 1,
		expires_at: Date.parse("2026-11-01T17:00:00Z") / 1000,
		restrictions: { first_time_transaction: false },
		metadata: {
			anidachiCampaign: "product_hunt_2026",
			userId: "owner",
			campaignBindingId: "binding",
		},
	});
	assert.equal(
		f.creates[0].options.idempotencyKey,
		"product-hunt-promo:binding",
	);
	assert.equal(await f.run(), true);
	assert.equal(f.creates.length, 1);
});

test("past positive subscription invoices block the campaign even after cancellation or refund", async () => {
	const f = fixture();
	f.invoices.push(f.paid(799));
	assert.equal(await f.run(), false);
	assert.equal(f.creates.length, 0);
	assert.equal(f.claims(), 0);
});

test("a later prior-payment discovery deactivates an unredeemed code without touching a subscription", async () => {
	const f = fixture();
	await f.run();
	f.invoices.push(f.paid(799));
	assert.equal(await f.run(), false);
	assert.equal(f.promotions[0].active, false);
	assert.equal(f.creates.length, 1);
});

test("lost creation response recovers the same Stripe promotion instead of issuing another", async () => {
	const f = fixture();
	f.loseResponse();
	await assert.rejects(f.run, /lost Stripe response/);
	assert.equal(await f.run(), true);
	assert.equal(f.creates.length, 1);
});

test("consumed or inactive promotions can never be replaced", async () => {
	for (const state of ["consumed", "inactive"]) {
		const f = fixture();
		await f.run();
		if (state === "consumed") f.promotions[0].times_redeemed = 1;
		else f.promotions[0].active = false;
		assert.equal(await f.run(), false);
		assert.equal(f.creates.length, 1);
	}
});

test("expired campaign never issues a code and unknown long-lived creation fails closed", async () => {
	const f = fixture();
	f.setNow(Date.parse("2026-11-01T17:00:00Z"));
	assert.equal(await f.run(), false);
	assert.equal(f.creates.length, 0);
	const unknown = fixture();
	unknown.binding.created_at = "2026-10-20T00:00:00Z";
	await assert.rejects(unknown.run, /reconciliation/i);
	assert.equal(unknown.creates.length, 0);
});

test("wrong customer, mode, coupon terms, product scope and incomplete history never mint a code", async () => {
	const mutations = [
		(f: ReturnType<typeof fixture>) => {
			f.customer.metadata.userId = "foreign";
		},
		(f: ReturnType<typeof fixture>) => {
			f.customer.livemode = true;
		},
		(f: ReturnType<typeof fixture>) => {
			f.coupon.percent_off = 50;
		},
		(f: ReturnType<typeof fixture>) => {
			f.coupon.redeem_by! += 86400;
		},
		(f: ReturnType<typeof fixture>) => {
			f.coupon.applies_to = { products: ["prod_plus"] };
		},
		(f: ReturnType<typeof fixture>) => {
			f.binding.stripe_customer_id = "cus_foreign";
		},
		(f: ReturnType<typeof fixture>) => {
			f.moreInvoices();
		},
	];
	for (const mutate of mutations) {
		const f = fixture();
		mutate(f);
		await assert.rejects(f.run);
		assert.equal(f.creates.length, 0);
	}
});
