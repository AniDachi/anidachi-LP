import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
	createCancellationRetentionService,
	type CancellationRetentionDeps,
} from "./cancellation-retention";
import type {
	CancellationOffer,
	CancellationStore,
} from "./cancellation-retention-store";

function fixture(options: Partial<CancellationRetentionDeps> = {}) {
	let time = 2_000_000_000_000;
	let pending: CancellationOffer | null = null;
	let grant = false;
	let enabled = true;
	let testMode = true;
	let missing = true;
	let readFailure = false;
	let delayRead = 0;
	let creationTimeout = false;
	let coupon: Stripe.Coupon | null = null;
	const writes: Stripe.CouponCreateParams[] = [];
	const account = {
		customerId: "cus_1",
		subscriptionIds: ["sub_1"],
		hasGrant: false,
		legacyBusy: false,
	};
	const price = {
		id: "price_plus",
		object: "price",
		active: true,
		livemode: false,
		type: "recurring",
		currency: "usd",
		unit_amount: 799,
		product: "prod_plus",
		billing_scheme: "per_unit",
		transform_quantity: null,
		recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
	};
	const sub = {
		id: "sub_1",
		livemode: false,
		customer: "cus_1",
		metadata: { userId: "user_1" },
		status: "active",
		cancel_at_period_end: false,
		cancel_at: null,
		schedule: null,
		pending_update: null,
		pause_collection: null,
		pending_invoice_item_interval: null,
		billing_thresholds: null,
		discounts: [],
		trial_end: null,
		items: {
			has_more: false,
			data: [
				{
					id: "si_1",
					price,
					quantity: 1,
					discounts: [],
					billing_thresholds: null,
					current_period_start: 1_999_900_000,
					current_period_end: 2_001_000_000,
				},
			],
		},
	} as unknown as Stripe.Subscription;
	const invoice = {
		id: "in_paid",
		status: "paid",
		livemode: false,
		total: 799,
		customer: "cus_1",
		parent: { subscription_details: { subscription: "sub_1" } },
		lines: {
			has_more: false,
			data: [
				{
					amount: 799,
					period: { start: 1_999_900_000, end: 2_001_000_000 },
					pricing: {
						type: "price_details",
						price_details: { price: "price_plus", product: "prod_plus" },
					},
				},
			],
		},
	} as unknown as Stripe.Invoice;
	const store: CancellationStore = {
		pending: async () => pending,
		account: async () => ({ ...account, hasGrant: grant || account.hasGrant }),
		reserve: async (input) => {
			if (grant) throw new Error("limit");
			if (!pending)
				pending = {
					...input,
					id: "11111111-1111-4111-8111-111111111111",
					coupon_id: "cancel_retention_11111111111141118111111111111111",
					redeem_by: Math.floor(time / 1000) + 600,
					state: "pending",
					created_at: new Date(time).toISOString(),
					accepted_at: null,
					reconciled_at: null,
				};
			return pending;
		},
		reconcile: async (offer, evidence) => {
			assert.equal(offer.id, pending?.id);
			if (evidence.timesRedeemed === 1) {
				grant = true;
				pending = null;
			} else if (evidence.observedAt > offer.redeem_by) pending = null;
		},
	};
	const customer = {
		id: "cus_1",
		livemode: false,
		metadata: { userId: "user_1" },
		discount: null,
		test_clock: null as string | null,
	};
	const clock = {
		id: "clock_1",
		livemode: false,
		status: "ready",
		frozen_time: 2_000_000_000,
	};
	let clockFailure = false;
	const stripe = {
		customers: { retrieve: async () => customer },
		testHelpers: {
			testClocks: {
				retrieve: async () => {
					if (clockFailure) throw new Error("clock unavailable");
					return clock;
				},
			},
		},
		subscriptions: {
			retrieve: async () => sub,
			list: async () => ({ data: [sub], has_more: false }),
		},
		invoices: { list: async () => ({ data: [invoice], has_more: false }) },
		coupons: {
			retrieve: async () => {
				time += delayRead;
				if (readFailure) throw new Error("network");
				if (missing)
					throw Object.assign(new Error("No such coupon"), {
						code: "resource_missing",
						statusCode: 404,
					});
				return coupon;
			},
			create: async (input: Stripe.CouponCreateParams) => {
				writes.push(input);
				missing = false;
				coupon = {
					...input,
					object: "coupon",
					id: input.id!,
					livemode: false,
					amount_off: null,
					currency: null,
					duration_in_months: null,
					times_redeemed: 0,
					valid: true,
				} as Stripe.Coupon;
				if (creationTimeout) throw new Error("lost response");
				return coupon;
			},
		},
	} as unknown as Stripe;
	const service = createCancellationRetentionService({
		stripe,
		store,
		now: () => time,
		enabled: () => enabled,
		isTest: () => testMode,
		catalog: async () => ({
			productIds: ["prod_plus", "prod_pro"],
			monthlyPriceIds: ["price_plus", "price_pro"],
		}),
		...options,
	});
	return {
		service,
		customer,
		clock,
		failClock: () => {
			clockFailure = true;
		},
		account,
		sub,
		invoice,
		writes,
		get pending() {
			return pending;
		},
		get grant() {
			return grant;
		},
		get coupon() {
			return coupon!;
		},
		get time() {
			return time;
		},
		advance: (ms: number) => {
			time += ms;
		},
		disable: () => {
			enabled = false;
		},
		live: () => {
			testMode = false;
		},
		delayRead: (ms: number) => {
			delayRead = ms;
		},
		failRead: () => {
			readFailure = true;
		},
		loseCreateResponse: () => {
			creationTimeout = true;
		},
		deleteCoupon: () => {
			missing = true;
		},
	};
}
const prepare = (f: ReturnType<typeof fixture>) =>
	f.service.prepare("user_1", "cus_1", "sub_1");

test("native offer reserves before creation and reuses exactly one finite monthly coupon without consuming allowance", async () => {
	const f = fixture();
	const id = await prepare(f);
	assert.equal(id, "cancel_retention_11111111111141118111111111111111");
	assert.equal(f.grant, false);
	assert.equal(f.pending?.state, "pending");
	assert.equal(f.writes.length, 1);
	assert.deepEqual(f.writes[0], {
		id,
		percent_off: 40,
		duration: "once",
		max_redemptions: 1,
		redeem_by: 2_000_000_600,
		applies_to: { products: ["prod_plus", "prod_pro"] },
		metadata: {
			anidachiCampaign: "cancellation_retention_v1",
			offerId: f.pending!.id,
			userId: "user_1",
			customerId: "cus_1",
			subscriptionId: "sub_1",
			priceId: "price_plus",
			targetPeriodStart: "2001000000",
		},
	});
	assert.equal(await prepare(f), id);
	assert.equal(f.writes.length, 1);
});

test("lost create response retains the reservation and exact coupon identity", async () => {
	const f = fixture();
	f.loseCreateResponse();
	await assert.rejects(prepare(f));
	assert.ok(f.pending);
	assert.equal(f.grant, false);
	const id = await prepare(f);
	assert.equal(id, f.coupon.id);
	assert.equal(f.writes.length, 1);
});

test("accepted once coupon with valid=false consumes allowance even after annual conversion or payment failure and gate off", async () => {
	const f = fixture();
	await prepare(f);
	f.coupon.times_redeemed = 1;
	f.coupon.valid = false;
	f.sub.items.data[0].price.recurring!.interval = "year";
	f.sub.status = "past_due";
	f.sub.discounts = [];
	f.disable();
	await f.service.reconcile("user_1");
	assert.equal(f.grant, true);
	assert.equal(f.pending, null);
	assert.equal(await prepare(f), null);
});

test("abandoned unredeemed hold releases only after deadline and fresh provider evidence even with issuance off", async () => {
	const f = fixture();
	await prepare(f);
	f.disable();
	await f.service.reconcile("user_1");
	assert.ok(f.pending);
	f.advance(600_000);
	await f.service.reconcile("user_1");
	assert.ok(f.pending);
	f.advance(1000);
	f.coupon.valid = false;
	await f.service.reconcile("user_1");
	assert.equal(f.pending, null);
	assert.equal(f.grant, false);
});

test("provider-confirmed expired missing coupon releases; network uncertainty never does", async () => {
	const f = fixture();
	await prepare(f);
	f.advance(601_000);
	f.failRead();
	await assert.rejects(f.service.reconcile("user_1"));
	assert.ok(f.pending);
	const absent = fixture();
	await prepare(absent);
	absent.deleteCoupon();
	absent.advance(601_000);
	await absent.service.reconcile("user_1");
	assert.equal(absent.pending, null);
	assert.equal(absent.grant, false);
});

test("changed coupon immutable fields retain hold and refuse issuance or acceptance", async () => {
	for (const change of [
		(c: Stripe.Coupon) => {
			c.percent_off = 50;
		},
		(c: Stripe.Coupon) => {
			c.metadata!.userId = "foreign";
		},
		(c: Stripe.Coupon) => {
			c.applies_to!.products.push("annual");
		},
		(c: Stripe.Coupon) => {
			c.redeem_by! += 1;
		},
		(c: Stripe.Coupon) => {
			c.livemode = true;
		},
	]) {
		const f = fixture();
		await prepare(f);
		change(f.coupon);
		f.coupon.times_redeemed = 1;
		await assert.rejects(f.service.reconcile("user_1"));
		assert.ok(f.pending);
		assert.equal(f.grant, false);
	}
});

test("ineligible local or provider account never creates a coupon", async () => {
	const changes = [
		(f: ReturnType<typeof fixture>) => {
			f.account.customerId = "cus_foreign";
		},
		(f: ReturnType<typeof fixture>) => {
			f.account.subscriptionIds = [];
		},
		(f: ReturnType<typeof fixture>) => {
			f.account.hasGrant = true;
		},
		(f: ReturnType<typeof fixture>) => {
			f.account.legacyBusy = true;
		},
		(f: ReturnType<typeof fixture>) => {
			f.sub.metadata.userId = "foreign";
		},
		(f: ReturnType<typeof fixture>) => {
			f.sub.cancel_at_period_end = true;
		},
		(f: ReturnType<typeof fixture>) => {
			f.sub.status = "past_due";
		},
		(f: ReturnType<typeof fixture>) => {
			f.sub.items.data[0].price.recurring!.interval = "year";
		},
		(f: ReturnType<typeof fixture>) => {
			f.sub.items.data[0].current_period_end = 2_000_003_600;
		},
		(f: ReturnType<typeof fixture>) => {
			f.invoice.total = 0;
		},
		(f: ReturnType<typeof fixture>) => {
			f.invoice.lines.data[0].pricing!.price_details!.price = "annual_price";
		},
		(f: ReturnType<typeof fixture>) => {
			f.sub.discounts = ["di_stacked"];
		},
		(f: ReturnType<typeof fixture>) => {
			f.disable();
		},
		(f: ReturnType<typeof fixture>) => {
			f.live();
		},
	];
	for (const change of changes) {
		const f = fixture();
		change(f);
		await prepare(f).catch(() => null);
		assert.equal(f.writes.length, 0);
		assert.equal(f.pending, null);
	}
});

test("an expired uncreated reservation cannot mint its coupon late", async () => {
	const f = fixture();
	f.loseCreateResponse();
	await assert.rejects(prepare(f));
	f.deleteCoupon();
	f.advance(601_000);
	f.disable();
	assert.equal(await prepare(f), null);
	assert.equal(f.writes.length, 1);
	assert.equal(f.grant, false);
});

test("TEST issuance gate uses only exact suffixed value and never LIVE or unsuffixed fallback", async () => {
	const keys = [
		"STRIPE_CANCELLATION_RETENTION_ENABLED_TEST",
		"STRIPE_CANCELLATION_RETENTION_ENABLED",
		"STRIPE_CANCELLATION_RETENTION_ENABLED_LIVE",
	];
	const saved = keys.map((key) => process.env[key]);
	try {
		process.env.STRIPE_CANCELLATION_RETENTION_ENABLED = "1";
		process.env.STRIPE_CANCELLATION_RETENTION_ENABLED_LIVE = "1";
		for (const value of [undefined, "true", "0", " 1", "1"]) {
			if (value === undefined)
				delete process.env.STRIPE_CANCELLATION_RETENTION_ENABLED_TEST;
			else process.env.STRIPE_CANCELLATION_RETENTION_ENABLED_TEST = value;
			const f = fixture({ enabled: undefined });
			assert.equal(!!(await prepare(f)), value === "1");
		}
	} finally {
		keys.forEach((key, i) => {
			if (saved[i] === undefined) delete process.env[key];
			else process.env[key] = saved[i];
		});
	}
});

test("live mode never reads pending state or reconciles TEST coupons", async () => {
	const f = fixture();
	await prepare(f);
	f.coupon.times_redeemed = 1;
	f.live();
	await f.service.reconcile("user_1");
	assert.equal(f.grant, false);
	assert.ok(f.pending);
});

test("a provider request started before expiry cannot release the hold after a slow response", async () => {
	const f = fixture();
	await prepare(f);
	f.advance(599_000);
	// Reconfigure only the provider response boundary, keeping the real service.
	const stripe = {
		customers: { retrieve: async () => f.customer },
		coupons: {
			retrieve: async () => {
				f.advance(2_000);
				return f.coupon;
			},
		},
	} as unknown as Stripe;
	let releases = 0;
	const service = createCancellationRetentionService({
		stripe,
		now: () => f.time,
		isTest: () => true,
		store: {
			pending: async () => f.pending,
			reconcile: async () => {
				releases++;
			},
		} as unknown as CancellationStore,
	});
	await service.reconcile("user_1");
	assert.equal(releases, 0);
	assert.ok(f.pending);
});

test("a missing-coupon request that crosses the deadline never creates the coupon late", async () => {
	const f = fixture();
	f.delayRead(600_000);
	assert.equal(await prepare(f), null);
	assert.ok(f.pending);
	assert.equal(f.writes.length, 0);
	assert.equal(f.grant, false);
});

test("a provider that still considers a zero-use coupon valid retains the hold after local expiry", async () => {
	const f = fixture();
	await prepare(f);
	f.advance(601_000);
	await f.service.reconcile("user_1");
	assert.ok(f.pending);
	assert.equal(f.grant, false);
});

test("frozen or unresolved test clocks cannot release an old native portal hold despite wall-clock expired coupon", async () => {
	for (const status of [
		"ready",
		"advancing",
		"internal_failure",
		"unavailable",
	]) {
		const f = fixture();
		await prepare(f);
		f.customer.test_clock = "clock_1";
		f.advance(601_000);
		f.coupon.valid = false;
		f.clock.status = status;
		if (status === "unavailable") f.failClock();
		await f.service.reconcile("user_1");
		assert.ok(f.pending, status);
		assert.equal(f.grant, false);
	}
});

test("a ready test clock past deadline followed by fresh coupon zero-use read can release", async () => {
	const f = fixture();
	await prepare(f);
	f.customer.test_clock = "clock_1";
	f.advance(601_000);
	f.coupon.valid = false;
	f.clock.frozen_time = 2_000_000_601;
	await f.service.reconcile("user_1");
	assert.equal(f.pending, null);
	assert.equal(f.grant, false);
});

test("accepted redemption on a frozen clock still consumes allowance", async () => {
	const f = fixture();
	await prepare(f);
	f.customer.test_clock = "clock_1";
	f.advance(601_000);
	f.coupon.valid = false;
	f.coupon.times_redeemed = 1;
	await f.service.reconcile("user_1");
	assert.equal(f.pending, null);
	assert.equal(f.grant, true);
});

test("customer and item discounts each prevent native discount stacking", async () => {
	const customerDiscount = fixture();
	(customerDiscount.customer as unknown as Stripe.Customer).discount = {
		id: "di_customer",
	} as Stripe.Discount;
	assert.equal(await prepare(customerDiscount), null);
	assert.equal(customerDiscount.writes.length, 0);
	const itemDiscount = fixture();
	itemDiscount.sub.items.data[0].discounts = ["di_item"];
	assert.equal(await prepare(itemDiscount), null);
	assert.equal(itemDiscount.writes.length, 0);
});
