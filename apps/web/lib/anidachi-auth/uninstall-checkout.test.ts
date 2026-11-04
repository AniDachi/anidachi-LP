import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { CHECKOUT_PROMOTION_POLICY } from "./product-hunt-promo";
import {
	type CheckoutDeps,
	type CheckoutInput,
	type CheckoutReservation,
	createSubscriptionCheckoutService,
} from "./subscription-trial";
import { UNINSTALL_CHECKOUT_POLICY } from "./uninstall-stripe";

const userId = "11111111-1111-4111-8111-111111111111";
const input: CheckoutInput = {
	userId,
	email: "",
	planCode: "plus",
	priceId: "price_plus",
	billingPeriod: "monthly",
	origin: "https://anidachi.test",
	requestId: userId,
	attribution: { uninstallCouponId: "coupon_first" },
};
function fixture() {
	let reservation: CheckoutReservation | null = null;
	let count = 0;
	let failReply = false;
	const sessions: Stripe.Checkout.Session[] = [];
	const creates: Stripe.Checkout.SessionCreateParams[] = [];
	const promotions: string[] = [];
	const expired: string[] = [];
	const stripe = {
		subscriptions: { list: async () => ({ data: [], has_more: false }) },
		checkout: {
			sessions: {
				list: async (p: Stripe.Checkout.SessionListParams) => ({
					data: p.status
						? sessions.filter((s) => s.status === p.status)
						: sessions,
					has_more: false,
				}),
				retrieve: async (id: string) => sessions.find((s) => s.id === id),
				expire: async (id: string) => {
					expired.push(id);
					const s = sessions.find((s) => s.id === id);
					assert.ok(s);
					s.status = "expired";
					return s;
				},
				create: async (p: Stripe.Checkout.SessionCreateParams) => {
					creates.push(structuredClone(p));
					const s = {
						id: "cs_" + creates.length,
						mode: "subscription",
						status: "open",
						customer: "cus_owner",
						client_reference_id: userId,
						metadata: p.metadata,
						url: "https://checkout.stripe.com/c/pay/test",
						subscription: null,
						discounts: p.discounts?.map((d) => ({
							coupon: "coupon_first",
							promotion_code: d.promotion_code,
						})),
						allow_promotion_codes: p.allow_promotion_codes ?? null,
					} as unknown as Stripe.Checkout.Session;
					sessions.push(s);
					if (failReply) {
						failReply = false;
						throw Error("lost create reply");
					}
					return s;
				},
			},
		},
	} as unknown as Stripe;
	const deps: CheckoutDeps = {
		stripe,
		now: () => Date.parse("2026-11-04T12:00:00Z"),
		readReservation: async () => reservation,
		reserve: async (next) => {
			if (!reservation || reservation.state === "expired")
				reservation = {
					user_id: userId,
					id: `22222222-2222-4222-8222-${String(++count).padStart(12, "0")}`,
					request_id: next.requestId,
					plan_code: next.planCode,
					price_id: next.priceId,
					origin: next.origin,
					attribution: next.attribution,
					policy_revision: 1,
					trial_offered: false,
					created_at: "2026-11-04T12:00:00Z",
					stripe_session_id: null,
					stripe_subscription_id: null,
					state: "pending",
				};
			return reservation;
		},
		finish: async (r, id, state) => {
			assert.ok(reservation);
			assert.equal(r.id, reservation.id);
			reservation.stripe_session_id = id;
			reservation.state = state;
		},
		getCustomer: async () => ({
			user_id: userId,
			stripe_customer_id: "cus_owner",
		}),
		saveCustomer: async () => {},
		access: async () => ({ hostingPolicyVersion: 1, trialEligibility: "used" }),
		sync: async () => ({ status: "active" }),
		ensurePromotion: async () => {
			promotions.push("product-hunt");
		},
		frozenPromotion: async (r) => {
			assert.equal(r.attribution.uninstallCouponId, "coupon_first");
			promotions.push("uninstall");
			return "promo_owner";
		},
	};
	return {
		offer: createSubscriptionCheckoutService({
			...deps,
			checkoutPolicy: UNINSTALL_CHECKOUT_POLICY,
		}),
		normal: createSubscriptionCheckoutService(deps),
		creates,
		promotions,
		expired,
		sessions,
		lostReply() {
			failReply = true;
		},
		get reservation() {
			return reservation;
		},
	};
}
test("offer checkout auto-applies one promo without manual stacking; same request restores same session", async () => {
	const f = fixture();
	const a = await f.offer.prepareSubscriptionCheckout(input);
	const b = await f.offer.prepareSubscriptionCheckout(input);
	assert.equal(a.sessionId, b.sessionId);
	assert.equal(f.creates.length, 1);
	assert.equal(f.creates[0].allow_promotion_codes, undefined);
	assert.deepEqual(f.creates[0].discounts, [{ promotion_code: "promo_owner" }]);
	assert.equal(f.creates[0].subscription_data?.trial_period_days, undefined);
	assert.ok(!f.promotions.includes("product-hunt"));
});
test("normal checkout after lost offer creation recovers frozen discounted session then expires it before replacement", async () => {
	const f = fixture();
	f.lostReply();
	await assert.rejects(
		() => f.offer.prepareSubscriptionCheckout(input),
		/lost/,
	);
	const result = await f.normal.prepareSubscriptionCheckout({
		...input,
		attribution: {},
	});
	assert.equal(result.sessionId, "cs_2");
	assert.deepEqual(f.expired, ["cs_1"]);
	assert.equal(
		f.creates[0].metadata?.checkoutPromotionPolicy,
		UNINSTALL_CHECKOUT_POLICY,
	);
	assert.equal(
		f.creates[1].metadata?.checkoutPromotionPolicy,
		CHECKOUT_PROMOTION_POLICY,
	);
	assert.equal(f.creates[1].discounts, undefined);
});
test("offer after abandoned normal checkout retires original session before discount URL", async () => {
	const f = fixture();
	await f.normal.prepareSubscriptionCheckout({ ...input, attribution: {} });
	const result = await f.offer.prepareSubscriptionCheckout(input);
	assert.equal(result.sessionId, "cs_2");
	assert.deepEqual(f.expired, ["cs_1"]);
	assert.deepEqual(f.creates[1].discounts, [{ promotion_code: "promo_owner" }]);
});
test("legacy trial retirement recovers the original offer parameters even on a normal service", async () => {
	const f = fixture();
	f.lostReply();
	await assert.rejects(() => f.offer.prepareSubscriptionCheckout(input));
	assert.equal(await f.normal.retireForCardless(userId), "clear");
	assert.equal(f.creates.length, 1);
	assert.deepEqual(f.expired, ["cs_1"]);
});
test("no silently undiscounted URL if Stripe session lost its frozen promotion", async () => {
	const f = fixture();
	await f.offer.prepareSubscriptionCheckout(input);
	f.sessions[0].discounts = [];
	await assert.rejects(
		() => f.offer.prepareSubscriptionCheckout(input),
		/discount mismatch/,
	);
	assert.equal(f.creates.length, 1);
});
