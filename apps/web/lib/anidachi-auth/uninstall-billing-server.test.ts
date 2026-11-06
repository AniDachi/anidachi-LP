import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { db, type SubscriptionRow } from "./db";
import { readUninstallAccount } from "./uninstall-store";
import type { CancellationOffer } from "./cancellation-retention-store";
import { PRODUCT_HUNT_CAMPAIGN } from "./product-hunt-promo";
import { UNINSTALL_RENEWAL_CAMPAIGN } from "./uninstall-stripe";
import { cancellationCouponParams } from "./cancellation-retention-stripe";
import { readBillingPromotions } from "./uninstall-billing-server";

function fixture(accepted = false, live = false) {
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
		livemode: live,
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
		livemode: live,
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
		mode: () => (live ? "live" : "test"),
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
						livemode: live,
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

function pendingOutageFixture(type = "StripeConnectionError") {
	const f = fixture();
	f.row.stripe_price_id = f.offer.price_id;
	const results: Record<string, unknown> = {
		billing_customers: { user_id: "owner", stripe_customer_id: "cus_owner" },
		subscriptions: [{ ...f.row }],
		account_subscription_trials: [],
		uninstall_offer_grants: null,
	};
	const fakeDb = () =>
		({
			from: (table: string) => {
				const result = () => ({ data: results[table], error: null });
				const query = {
					select() {
						return query;
					},
					eq() {
						return query;
					},
					abortSignal() {
						return query;
					},
					limit() {
						return query;
					},
					maybeSingle: async () => result(),
					then(
						resolve: (value: unknown) => unknown,
						reject: (reason: unknown) => unknown,
					) {
						return Promise.resolve(result()).then(resolve, reject);
					},
				};
				return query;
			},
		}) as unknown as ReturnType<typeof db>;
	const accountDeps = {
		db: fakeDb,
		mode: () => "test" as const,
		pending: async () => f.offer,
		reconcile: async () => {
			throw Object.assign(Error("provider read unavailable"), { type });
		},
		createStripe: () => ({}) as Stripe,
	};
	f.deps.readAccount = (id, options) =>
		readUninstallAccount(id, options, accountDeps);
	return { ...f, results, accountDeps };
}
test("actual account presentation preserves known pending native classification during provider reconciliation outage", async () => {
	for (const type of [
		"StripeConnectionError",
		"StripeAPIError",
		"StripeRateLimitError",
	]) {
		const f = pendingOutageFixture(type);
		assert.deepEqual((await f.read()).local, {
			state: "unavailable",
			campaign: "cancellation_retention",
		});
		assert.equal(f.reads(), 0);
	}
});
test("actual default issuance remains strict on pending native provider failure", async () => {
	const f = pendingOutageFixture();
	await assert.rejects(
		readUninstallAccount("owner", undefined, f.accountDeps),
		/provider read unavailable/,
	);
	await assert.rejects(
		readUninstallAccount("owner", undefined, {
			...f.accountDeps,
			reconcile: async () => {},
		}),
		/verification pending/,
	);
});
test("unknown ownership and explicit validation failures do not gain native annual exemption", async () => {
	const f = pendingOutageFixture();
	f.results.billing_customers = {
		user_id: "owner",
		stripe_customer_id: "cus_changed",
	};
	assert.deepEqual((await f.read()).local, { state: "unavailable" });
	const invalid = pendingOutageFixture("ValidationError");
	assert.deepEqual((await invalid.read()).local, { state: "unavailable" });
});
test("Product Hunt and uninstall uncertainty still blocks annual under known native provider outage", async () => {
	const productHunt = pendingOutageFixture();
	productHunt.deps.readProductHuntBilling = async () => ({
		local: { state: "unavailable" },
	});
	assert.deepEqual((await productHunt.read()).local, { state: "unavailable" });
	const legacy = pendingOutageFixture();
	legacy.deps.readClaim = async () => {
		throw Error("uninstall state unavailable");
	};
	assert.deepEqual((await legacy.read()).local, { state: "unavailable" });
});

test("pending fallback requires exact durable owner/subscription/price and readable local storage", async () => {
	for (const field of [
		"user_id",
		"stripe_subscription_id",
		"price_id",
	] as const) {
		const f = pendingOutageFixture();
		f.offer[field] = "foreign";
		assert.deepEqual((await f.read()).local, { state: "unavailable" });
	}
	const storage = pendingOutageFixture();
	storage.results.subscriptions = null;
	assert.deepEqual((await storage.read()).local, { state: "unavailable" });
	const grant = pendingOutageFixture();
	grant.results.uninstall_offer_grants = {
		user_id: "owner",
		stripe_customer_id: "cus_owner",
		kind: "renewal",
	};
	assert.deepEqual((await grant.read()).local, { state: "unavailable" });
});

function laterProviderFixture(state: "pending" | "accepted") {
	const f = pendingOutageFixture();
	f.offer.state = state;
	if (state === "accepted")
		f.results.uninstall_offer_grants = {
			user_id: "owner",
			stripe_customer_id: "cus_owner",
			kind: "cancellation",
		};
	let reconciliations = 0;
	f.deps.readAccount = (id, options) =>
		readUninstallAccount(id, options, {
			...f.accountDeps,
			pending: async () => (state === "pending" ? f.offer : null),
			reconcile: async () => {
				reconciliations++;
			},
		});
	const stripe = f.deps.createStripe();
	f.deps.createStripe = () => stripe;
	return { ...f, stripe, reconciliations: () => reconciliations };
}
async function attachPartialNativeCoupon(
	f: ReturnType<typeof laterProviderFixture>,
) {
	const coupon = await f.stripe.coupons.retrieve(f.offer.coupon_id, {
		expand: ["applies_to"],
	});
	delete coupon.applies_to;
	f.sub.discounts = [
		{ id: "di_native", coupon },
	] as unknown as Stripe.Discount[];
	return coupon;
}
const unavailableProvider = async () => {
	throw Object.assign(Error("provider read unavailable"), {
		type: "StripeConnectionError",
	});
};
for (const state of ["pending", "accepted"] as const)
	for (const phase of ["customer", "subscription", "coupon"] as const) {
		test(`actual ${state} native classification survives later ${phase} provider read outage`, async () => {
			const f = laterProviderFixture(state);
			if (phase === "customer")
				f.stripe.customers.retrieve = unavailableProvider;
			if (phase === "subscription")
				f.stripe.subscriptions.retrieve = unavailableProvider;
			if (phase === "coupon") {
				await attachPartialNativeCoupon(f);
				f.stripe.coupons.retrieve = unavailableProvider;
			}
			assert.deepEqual((await f.read()).local, {
				state: "unavailable",
				campaign: "cancellation_retention",
			});
			assert.equal(f.reconciliations(), state === "pending" ? 1 : 0);
		});
	}
test("observed provider ownership or coupon validation failure cannot be masked by a subsequent outage", async () => {
	const customer = laterProviderFixture("pending");
	customer.stripe.customers.retrieve = async () =>
		({
			id: "cus_foreign",
			livemode: false,
			metadata: { userId: "owner" },
		}) as unknown as Stripe.Response<Stripe.Customer>;
	customer.stripe.subscriptions.retrieve = unavailableProvider;
	assert.deepEqual((await customer.read()).local, { state: "unavailable" });
	const sub = laterProviderFixture("pending");
	await attachPartialNativeCoupon(sub);
	sub.sub.metadata.userId = "foreign";
	sub.stripe.coupons.retrieve = unavailableProvider;
	assert.deepEqual((await sub.read()).local, { state: "unavailable" });
	const terms = laterProviderFixture("pending");
	const coupon = await attachPartialNativeCoupon(terms);
	coupon.percent_off = 99;
	terms.stripe.coupons.retrieve = unavailableProvider;
	assert.deepEqual((await terms.read()).local, { state: "unavailable" });
});
test("later provider outage preserves local ownership, storage and legacy campaign blocks", async () => {
	for (const state of ["pending", "accepted"] as const) {
		const owner = laterProviderFixture(state);
		owner.offer.user_id = "foreign";
		owner.stripe.customers.retrieve = unavailableProvider;
		assert.deepEqual((await owner.read()).local, { state: "unavailable" });
		const storage = laterProviderFixture(state);
		storage.deps.readCancellationOffer = unavailableProvider;
		assert.deepEqual((await storage.read()).local, { state: "unavailable" });
		const hunt = laterProviderFixture(state);
		hunt.deps.readProductHuntBilling = async () => ({
			local: { state: "active" },
		});
		hunt.stripe.customers.retrieve = unavailableProvider;
		assert.deepEqual((await hunt.read()).local, { state: "unavailable" });
		const legacy = laterProviderFixture(state);
		legacy.results.uninstall_offer_grants = {
			user_id: "owner",
			stripe_customer_id: "cus_owner",
			kind: "renewal",
		};
		legacy.stripe.subscriptions.retrieve = unavailableProvider;
		assert.deepEqual((await legacy.read()).local, { state: "unavailable" });
	}
});

test("observed legacy discounts and invalid native shape remain blocked before later provider outages", async () => {
	for (const campaign of [PRODUCT_HUNT_CAMPAIGN, UNINSTALL_RENEWAL_CAMPAIGN]) {
		const customer = laterProviderFixture("accepted");
		customer.stripe.customers.retrieve = async () =>
			({
				id: "cus_owner",
				livemode: false,
				metadata: { userId: "owner" },
				discount: { coupon: { metadata: { anidachiCampaign: campaign } } },
			}) as unknown as Stripe.Response<Stripe.Customer>;
		customer.stripe.subscriptions.retrieve = unavailableProvider;
		assert.deepEqual((await customer.read()).local, { state: "unavailable" });
		const sub = laterProviderFixture("accepted");
		const coupon = await attachPartialNativeCoupon(sub);
		coupon.metadata!.anidachiCampaign = campaign;
		sub.stripe.coupons.retrieve = unavailableProvider;
		assert.deepEqual((await sub.read()).local, { state: "unavailable" });
	}
	const shape = laterProviderFixture("pending");
	await attachPartialNativeCoupon(shape);
	shape.sub.items.has_more = true;
	shape.stripe.coupons.retrieve = unavailableProvider;
	assert.deepEqual((await shape.read()).local, { state: "unavailable" });
});

test("LIVE billing displays accepted monthly cancellation discount and rejects TEST subscription", async () => {
	const f = fixture(true, true);
	assert.equal((await f.read()).local?.nextPrice?.unitAmount, 479);
	f.sub.livemode = false;
	assert.equal((await f.read()).local?.state, "unavailable");
});
